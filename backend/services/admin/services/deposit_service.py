"""Admin Finance Service — deposit/withdrawal listing, approval, rejection, screenshots."""
import uuid
from datetime import datetime
from decimal import Decimal
from pathlib import Path

from fastapi import HTTPException
from fastapi.responses import FileResponse
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.models import User, TradingAccount, Deposit, Withdrawal, Transaction, BonusOffer
from packages.common.src.notify import (
    create_notification,
    send_deposit_confirmation_email,
    send_withdrawal_status_email,
)
from packages.common.src.admin_schemas import DepositOut, WithdrawalOut, PaginatedResponse
from dependencies import write_audit_log


def _deposit_to_out(d: Deposit, user: User = None) -> DepositOut:
    return DepositOut(
        id=str(d.id),
        user_id=str(d.user_id),
        account_id=str(d.account_id) if d.account_id else None,
        amount=float(d.amount or 0),
        currency=d.currency or "INR",
        method=d.method,
        status=d.status,
        transaction_id=d.transaction_id,
        screenshot_url=d.screenshot_url,
        rejection_reason=d.rejection_reason,
        created_at=d.created_at,
        user_email=user.email if user else None,
        user_name=f"{user.first_name or ''} {user.last_name or ''}".strip() if user else None,
    )


def _withdrawal_to_out(w: Withdrawal, user: User = None) -> WithdrawalOut:
    return WithdrawalOut(
        id=str(w.id),
        user_id=str(w.user_id),
        account_id=str(w.account_id) if w.account_id else None,
        amount=float(w.amount or 0),
        currency=w.currency or "INR",
        method=w.method,
        status=w.status,
        bank_details=w.bank_details,
        crypto_address=w.crypto_address,
        rejection_reason=w.rejection_reason,
        created_at=w.created_at,
        user_email=user.email if user else None,
        user_name=f"{user.first_name or ''} {user.last_name or ''}".strip() if user else None,
    )


async def list_pending_deposits(page: int, per_page: int, db: AsyncSession):
    query = select(Deposit).where(Deposit.status == "pending")
    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    query = query.order_by(Deposit.created_at.asc()).offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(query)
    deposits = result.scalars().all()

    items = []
    for d in deposits:
        user_q = await db.execute(select(User).where(User.id == d.user_id))
        user = user_q.scalar_one_or_none()
        items.append(_deposit_to_out(d, user))

    return PaginatedResponse(items=items, total=total, page=page, per_page=per_page)


async def list_pending_withdrawals(page: int, per_page: int, db: AsyncSession):
    query = select(Withdrawal).where(Withdrawal.status == "pending")
    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    query = query.order_by(Withdrawal.created_at.asc()).offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(query)
    withdrawals = result.scalars().all()

    items = []
    for w in withdrawals:
        user_q = await db.execute(select(User).where(User.id == w.user_id))
        user = user_q.scalar_one_or_none()
        items.append(_withdrawal_to_out(w, user))

    return PaginatedResponse(items=items, total=total, page=page, per_page=per_page)


async def list_all_deposits(page: int, per_page: int, status: str | None, db: AsyncSession):
    query = select(Deposit)
    if status and status != "all":
        if status == "approved":
            query = query.where(Deposit.status.in_(["approved", "auto_approved"]))
        else:
            query = query.where(Deposit.status == status)
    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    query = query.order_by(Deposit.created_at.desc()).offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(query)
    deposits = result.scalars().all()

    items = []
    for d in deposits:
        user_q = await db.execute(select(User).where(User.id == d.user_id))
        user = user_q.scalar_one_or_none()
        items.append(_deposit_to_out(d, user))

    return PaginatedResponse(items=items, total=total, page=page, per_page=per_page)


async def list_all_withdrawals(page: int, per_page: int, status: str | None, db: AsyncSession):
    query = select(Withdrawal)
    if status and status != "all":
        query = query.where(Withdrawal.status == status)
    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    query = query.order_by(Withdrawal.created_at.desc()).offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(query)
    withdrawals = result.scalars().all()

    items = []
    for w in withdrawals:
        user_q = await db.execute(select(User).where(User.id == w.user_id))
        user = user_q.scalar_one_or_none()
        items.append(_withdrawal_to_out(w, user))

    return PaginatedResponse(items=items, total=total, page=page, per_page=per_page)


async def approve_deposit(
    deposit_id: uuid.UUID, admin_id: uuid.UUID, ip_address: str | None, db: AsyncSession,
) -> dict:
    result = await db.execute(select(Deposit).where(Deposit.id == deposit_id))
    deposit = result.scalar_one_or_none()
    if not deposit:
        raise HTTPException(status_code=404, detail="Deposit not found")
    if deposit.status != "pending":
        raise HTTPException(status_code=400, detail="Deposit is not pending")

    deposit.status = "approved"
    deposit.approved_by = admin_id
    deposit.approved_at = datetime.utcnow()

    user_q = await db.execute(select(User).where(User.id == deposit.user_id))
    user_row = user_q.scalar_one_or_none()
    if not user_row:
        raise HTTPException(status_code=400, detail="User not found for deposit")

    user_row.main_wallet_balance = (user_row.main_wallet_balance or Decimal("0")) + deposit.amount

    db.add(
        Transaction(
            user_id=deposit.user_id,
            account_id=None,
            type="deposit",
            amount=deposit.amount,
            balance_after=user_row.main_wallet_balance,
            reference_id=deposit.id,
            description=f"Deposit to main wallet - {deposit.method or 'manual'}",
            created_by=admin_id,
        )
    )

    bonus_msg = ""
    now = datetime.utcnow()
    offers_q = await db.execute(
        select(BonusOffer).where(
            BonusOffer.is_active == True,
            BonusOffer.bonus_type.in_(["deposit", "welcome"]),
            BonusOffer.min_deposit <= deposit.amount,
        )
    )
    for offer in offers_q.scalars().all():
        if offer.starts_at and offer.starts_at > now:
            continue
        if offer.expires_at and offer.expires_at < now:
            continue

        if offer.percentage and offer.percentage > 0:
            bonus_amount = deposit.amount * offer.percentage / Decimal("100")
        elif offer.fixed_amount and offer.fixed_amount > 0:
            bonus_amount = offer.fixed_amount
        else:
            continue

        if offer.max_bonus and bonus_amount > offer.max_bonus:
            bonus_amount = offer.max_bonus

        user_row.main_wallet_balance = (user_row.main_wallet_balance or Decimal("0")) + bonus_amount
        db.add(
            Transaction(
                user_id=deposit.user_id,
                account_id=None,
                type="bonus",
                amount=bonus_amount,
                balance_after=user_row.main_wallet_balance,
                description=f"Bonus: {offer.name} ({offer.percentage or 0}%)",
                created_by=admin_id,
            )
        )
        bonus_msg = f" + ${float(bonus_amount):.2f} bonus ({offer.name})"

    await write_audit_log(
        db, admin_id, "approve_deposit", "deposit", deposit_id,
        new_values={"amount": float(deposit.amount), "status": "approved"},
        ip_address=ip_address,
    )
    await create_notification(
        db,
        deposit.user_id,
        title="Deposit approved",
        message=(
            f"Your deposit of ${float(deposit.amount):,.2f} was approved and added to your main wallet.{bonus_msg}"
        ),
        notif_type="deposit",
        action_url="/wallet",
        commit=False,
    )
    _email = user_row.email
    _amt = f"{float(deposit.amount):,.2f}"
    _cur = deposit.currency or "USD"
    await db.commit()
    if _email:
        await send_deposit_confirmation_email(_email, _amt, _cur, "approved")
    return {"message": f"Deposit approved successfully{bonus_msg}"}


async def reject_deposit(
    deposit_id: uuid.UUID, reason: str | None,
    admin_id: uuid.UUID, ip_address: str | None, db: AsyncSession,
) -> dict:
    result = await db.execute(select(Deposit).where(Deposit.id == deposit_id))
    deposit = result.scalar_one_or_none()
    if not deposit:
        raise HTTPException(status_code=404, detail="Deposit not found")
    if deposit.status != "pending":
        raise HTTPException(status_code=400, detail="Deposit is not pending")

    deposit.status = "rejected"
    deposit.rejection_reason = reason
    deposit.approved_by = admin_id
    deposit.approved_at = datetime.utcnow()

    await write_audit_log(
        db, admin_id, "reject_deposit", "deposit", deposit_id,
        new_values={"status": "rejected", "reason": reason},
        ip_address=ip_address,
    )
    reason_str = (reason or "").strip()
    extra = f" Reason: {reason_str}" if reason_str else ""
    await create_notification(
        db,
        deposit.user_id,
        title="Deposit not approved",
        message=f"Your deposit request of ${float(deposit.amount):,.2f} was not approved.{extra}",
        notif_type="deposit",
        action_url="/wallet",
        commit=False,
    )
    _email = await db.scalar(select(User.email).where(User.id == deposit.user_id))
    _amt = f"{float(deposit.amount):,.2f}"
    _cur = deposit.currency or "USD"
    await db.commit()
    if _email:
        await send_deposit_confirmation_email(_email, _amt, _cur, "rejected")
    return {"message": "Deposit rejected"}


async def approve_withdrawal(
    withdrawal_id: uuid.UUID, admin_id: uuid.UUID, ip_address: str | None, db: AsyncSession,
) -> dict:
    result = await db.execute(select(Withdrawal).where(Withdrawal.id == withdrawal_id))
    withdrawal = result.scalar_one_or_none()
    if not withdrawal:
        raise HTTPException(status_code=404, detail="Withdrawal not found")
    if withdrawal.status != "pending":
        raise HTTPException(status_code=400, detail="Withdrawal is not pending")

    if withdrawal.account_id:
        acc_q = await db.execute(
            select(TradingAccount).where(TradingAccount.id == withdrawal.account_id)
        )
        account = acc_q.scalar_one_or_none()
        if account:
            if (account.balance or Decimal("0")) < withdrawal.amount:
                raise HTTPException(status_code=400, detail="Insufficient account balance")
            account.balance = (account.balance or Decimal("0")) - withdrawal.amount
            account.equity = account.balance + (account.credit or Decimal("0"))
            account.free_margin = account.equity - (account.margin_used or Decimal("0"))

            txn = Transaction(
                user_id=withdrawal.user_id,
                account_id=account.id,
                type="withdrawal",
                amount=-withdrawal.amount,
                balance_after=account.balance,
                reference_id=withdrawal.id,
                description=f"Withdrawal approved - {withdrawal.method or 'manual'}",
                created_by=admin_id,
            )
            db.add(txn)
    else:
        uw = await db.execute(select(User).where(User.id == withdrawal.user_id))
        user_row = uw.scalar_one_or_none()
        if not user_row:
            raise HTTPException(status_code=400, detail="User not found")
        main_bal = user_row.main_wallet_balance or Decimal("0")
        if main_bal < withdrawal.amount:
            raise HTTPException(status_code=400, detail="Insufficient main wallet balance")
        user_row.main_wallet_balance = main_bal - withdrawal.amount
        db.add(
            Transaction(
                user_id=withdrawal.user_id,
                account_id=None,
                type="withdrawal",
                amount=-withdrawal.amount,
                balance_after=user_row.main_wallet_balance,
                reference_id=withdrawal.id,
                description=f"Withdrawal approved (main wallet) - {withdrawal.method or 'manual'}",
                created_by=admin_id,
            )
        )

    withdrawal.status = "approved"
    withdrawal.approved_by = admin_id
    withdrawal.approved_at = datetime.utcnow()

    await write_audit_log(
        db, admin_id, "approve_withdrawal", "withdrawal", withdrawal_id,
        new_values={"amount": float(withdrawal.amount), "status": "approved"},
        ip_address=ip_address,
    )
    await create_notification(
        db,
        withdrawal.user_id,
        title="Withdrawal approved",
        message=(
            f"Your withdrawal of ${float(withdrawal.amount):,.2f} via "
            f"{withdrawal.method or 'manual'} has been approved and will be processed."
        ),
        notif_type="withdrawal",
        action_url="/wallet",
        commit=False,
    )
    _email = await db.scalar(select(User.email).where(User.id == withdrawal.user_id))
    _amt = f"{float(withdrawal.amount):,.2f}"
    _cur = withdrawal.currency or "USD"
    await db.commit()
    if _email:
        await send_withdrawal_status_email(_email, _amt, _cur, "approved")
    return {"message": "Withdrawal approved successfully"}


async def reject_withdrawal(
    withdrawal_id: uuid.UUID, reason: str | None,
    admin_id: uuid.UUID, ip_address: str | None, db: AsyncSession,
) -> dict:
    result = await db.execute(select(Withdrawal).where(Withdrawal.id == withdrawal_id))
    withdrawal = result.scalar_one_or_none()
    if not withdrawal:
        raise HTTPException(status_code=404, detail="Withdrawal not found")
    if withdrawal.status != "pending":
        raise HTTPException(status_code=400, detail="Withdrawal is not pending")

    withdrawal.status = "rejected"
    withdrawal.rejection_reason = reason
    withdrawal.approved_by = admin_id
    withdrawal.approved_at = datetime.utcnow()

    await write_audit_log(
        db, admin_id, "reject_withdrawal", "withdrawal", withdrawal_id,
        new_values={"status": "rejected", "reason": reason},
        ip_address=ip_address,
    )
    reason_str = (reason or "").strip()
    extra = f" Reason: {reason_str}" if reason_str else ""
    await create_notification(
        db,
        withdrawal.user_id,
        title="Withdrawal not approved",
        message=f"Your withdrawal request of ${float(withdrawal.amount):,.2f} was not approved.{extra}",
        notif_type="withdrawal",
        action_url="/wallet",
        commit=False,
    )
    _email = await db.scalar(select(User.email).where(User.id == withdrawal.user_id))
    _amt = f"{float(withdrawal.amount):,.2f}"
    _cur = withdrawal.currency or "USD"
    await db.commit()
    if _email:
        await send_withdrawal_status_email(_email, _amt, _cur, "rejected")
    return {"message": "Withdrawal rejected"}


async def download_deposit_screenshot(deposit_id: uuid.UUID, db: AsyncSession):
    """Serve manual deposit proof file (same filesystem path gateway wrote)."""
    result = await db.execute(select(Deposit).where(Deposit.id == deposit_id))
    deposit = result.scalar_one_or_none()
    if not deposit or not deposit.screenshot_url:
        raise HTTPException(status_code=404, detail="Screenshot not found")
    p = Path(deposit.screenshot_url)
    if not p.is_file():
        raise HTTPException(status_code=404, detail="File missing on server")
    return FileResponse(str(p), filename=p.name, media_type="application/octet-stream")


async def download_withdrawal_payout_qr(withdrawal_id: uuid.UUID, db: AsyncSession):
    """User-uploaded QR / payout image for manual withdrawals."""
    result = await db.execute(select(Withdrawal).where(Withdrawal.id == withdrawal_id))
    w = result.scalar_one_or_none()
    if not w or not w.bank_details:
        raise HTTPException(status_code=404, detail="Attachment not found")
    raw = w.bank_details.get("user_payout_qr_path") if isinstance(w.bank_details, dict) else None
    if not raw:
        raise HTTPException(status_code=404, detail="No payout QR on file")
    p = Path(str(raw))
    if not p.is_file():
        raise HTTPException(status_code=404, detail="File missing on server")
    return FileResponse(str(p), filename=p.name, media_type="application/octet-stream")
