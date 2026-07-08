"""Wallet Service — Deposits, withdrawals, transfers, wallet summary."""
import logging
import uuid as uuid_lib
from pathlib import Path
from decimal import Decimal
from uuid import UUID
from datetime import datetime

from fastapi import HTTPException, UploadFile
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.models import (
    BankAccount, BonusOffer, Deposit, Transaction, TradingAccount, User, Withdrawal,
)
from packages.common.src.notify import create_notification
from packages.common.src.config import get_settings
from packages.common.src.path_safety import PathTraversalError, safe_join_under_base
from . import oxapay_service

logger = logging.getLogger("wallet_service")

DEPOSIT_PROOF_EXT = {".jpg", ".jpeg", ".png", ".pdf", ".webp"}
MAX_PROOF_BYTES = 10 * 1024 * 1024

METHOD_MAP = {
    "bank": "bank_transfer",
    "bank_transfer": "bank_transfer",
    "upi": "upi",
    "qr": "qr",
    "crypto": "crypto_btc",
    "crypto_btc": "crypto_btc",
    "crypto_eth": "crypto_eth",
    "crypto_usdt": "crypto_usdt",
    "metamask": "metamask",
    "card": "bank_transfer",
    "oxapay": "oxapay",
    "manual": "manual",
}


def _wallet_upload_root() -> Path:
    raw = get_settings().WALLET_UPLOAD_ROOT.strip() or "uploads/wallet"
    p = Path(raw)
    if not p.is_absolute():
        p = Path.cwd() / p
    try:
        p.mkdir(parents=True, exist_ok=True)
    except OSError as e:
        logger.error("Wallet upload dir not writable: %s — %s", p, e)
        raise HTTPException(
            status_code=503,
            detail="File upload is temporarily unavailable. Please contact support.",
        ) from e
    return p


async def _get_user_account_ids(user_id, db: AsyncSession) -> list[UUID]:
    result = await db.execute(
        select(TradingAccount.id).where(TradingAccount.user_id == user_id)
    )
    return [row[0] for row in result.all()]


async def _get_live_account_ids(user_id, db: AsyncSession) -> list[UUID]:
    result = await db.execute(
        select(TradingAccount.id).where(
            TradingAccount.user_id == user_id,
            TradingAccount.is_demo == False,
        )
    )
    return [row[0] for row in result.all()]


async def _get_bank_for_tier(amount: Decimal, db: AsyncSession) -> BankAccount | None:
    result = await db.execute(
        select(BankAccount).where(
            BankAccount.is_active == True,
            BankAccount.method_type == "bank",
            BankAccount.min_amount <= amount,
            BankAccount.max_amount >= amount,
        ).order_by(BankAccount.last_used_at.asc().nullsfirst(), BankAccount.rotation_order)
    )
    bank = result.scalars().first()
    if bank:
        bank.last_used_at = datetime.utcnow()
    return bank


async def get_deposit_crypto_details(db: AsyncSession) -> dict:
    """The active crypto (e.g. USDT TRC20) deposit wallet configured by admin."""
    result = await db.execute(
        select(BankAccount).where(
            BankAccount.is_active == True,
            BankAccount.method_type == "crypto",
        ).order_by(BankAccount.rotation_order)
    )
    w = result.scalars().first()
    if not w:
        return {"available": False}
    return {
        "available": True,
        "asset": w.asset or "USDT",
        "network": w.network or "TRC20",
        "wallet_address": (w.wallet_address or w.account_number or "").strip(),
        "qr_code_url": w.qr_code_url,
    }


# ─── Deposits ─────────────────────────────────────────────────────────────

async def create_deposit(req, user_id: UUID, db: AsyncSession) -> dict:
    from packages.common.src.settings_store import get_bool_setting
    if await get_bool_setting("maintenance_mode", False):
        raise HTTPException(status_code=503, detail="Platform is under maintenance. Deposits are temporarily disabled.")
    if not await get_bool_setting("allow_deposits", True):
        raise HTTPException(status_code=403, detail="Deposits are currently disabled")

    if req.account_id is not None:
        acct = await db.execute(
            select(TradingAccount).where(
                TradingAccount.id == req.account_id,
                TradingAccount.user_id == user_id,
            )
        )
        account = acct.scalar_one_or_none()
        if not account:
            raise HTTPException(status_code=404, detail="Account not found")

    bank = await _get_bank_for_tier(req.amount, db)
    db_method = METHOD_MAP.get(req.method, "bank_transfer")

    # For OxaPay, use 'initiated' status until payment is actually started
    # This prevents showing incomplete payment attempts in history
    settings = get_settings()
    crypto_currency = getattr(req, "crypto_currency", None)
    is_oxapay = db_method == "oxapay" and bool(settings.OXAPAY_MERCHANT_KEY)
    
    deposit = Deposit(
        user_id=user_id,
        account_id=req.account_id if req.account_id else None,
        amount=req.amount,
        method=db_method,
        transaction_id=req.transaction_id,
        screenshot_url=req.screenshot_url,
        crypto_tx_hash=getattr(req, "crypto_tx_hash", None),
        crypto_address=getattr(req, "crypto_address", None),
        bank_account_id=bank.id if bank else None,
        status="initiated" if is_oxapay else "pending",
    )
    db.add(deposit)
    await db.commit()
    await db.refresh(deposit)

    # ── OxaPay automated payment ──────────────────────────────────────
    payment_url: str | None = None
    if is_oxapay:
        try:
            ox = await oxapay_service.create_payment(
                amount=req.amount,
                crypto_currency=crypto_currency,
                order_id=str(deposit.id),
                description=f"Proline Markets deposit ${float(req.amount):,.2f}",
            )
            deposit.transaction_id = ox["track_id"]
            payment_url = ox["payment_url"]
            await db.commit()
        except Exception as oxapay_err:
            logger.exception(
                "OxaPay create_payment failed for deposit %s",
                deposit.id,
            )
            # Delete the initiated deposit since payment creation failed
            await db.delete(deposit)
            await db.commit()
            raise HTTPException(
                status_code=502,
                detail=f"OxaPay payment creation failed: {str(oxapay_err)}",
            )

    try:
        await create_notification(
            db, user_id,
            title="Deposit Submitted",
            message=f"${float(req.amount):,.2f} deposit via {req.method} is pending approval",
            notif_type="deposit", action_url="/wallet", email=True,
        )
        await db.commit()
    except Exception:
        logger.exception("create_notification failed after deposit (deposit already saved) user_id=%s", user_id)
        try:
            await db.rollback()
        except Exception:
            pass

    result: dict = {"id": str(deposit.id), "status": "pending", "amount": float(deposit.amount)}
    if payment_url:
        result["payment_url"] = payment_url
    return result


async def create_manual_deposit(
    user_id: UUID,
    account_id: UUID | None,
    amount: Decimal,
    transaction_id: str,
    file: UploadFile,
    db: AsyncSession,
    method: str = "manual",
) -> dict:
    from packages.common.src.settings_store import get_bool_setting
    if not await get_bool_setting("allow_deposits", True):
        raise HTTPException(status_code=403, detail="Deposits are currently disabled")

    if amount <= 0:
        raise HTTPException(status_code=400, detail="Invalid amount")

    # 'manual' = bank/UPI (needs a pay-to bank). 'crypto_*' = manual crypto (USDT etc.):
    # the tx hash is the reference, no bank tier is attached.
    method = (method or "manual").strip().lower()
    is_crypto = method.startswith("crypto")
    if not is_crypto:
        method = "manual"

    tid = (transaction_id or "").strip()
    if not tid:
        label = "Transaction hash" if is_crypto else "Transaction / reference ID"
        raise HTTPException(status_code=400, detail=f"{label} is required for manual deposits")

    if account_id is not None:
        acct = await db.execute(
            select(TradingAccount).where(
                TradingAccount.id == account_id,
                TradingAccount.user_id == user_id,
            )
        )
        account = acct.scalar_one_or_none()
        if not account:
            raise HTTPException(status_code=404, detail="Account not found")

    if not file.filename:
        raise HTTPException(status_code=400, detail="Payment screenshot or proof file is required")
    suffix = Path(file.filename).suffix.lower()
    if suffix not in DEPOSIT_PROOF_EXT:
        raise HTTPException(status_code=400, detail="Allowed file types: JPG, PNG, PDF, WEBP")
    content = await file.read()
    if len(content) > MAX_PROOF_BYTES:
        raise HTTPException(status_code=400, detail="File too large (max 10 MB)")

    bank = None if is_crypto else await _get_bank_for_tier(amount, db)
    try:
        user_dir = safe_join_under_base(_wallet_upload_root(), "deposits", str(user_id))
    except PathTraversalError:
        raise HTTPException(status_code=400, detail="Invalid upload path")
    user_dir.mkdir(parents=True, exist_ok=True)
    safe = f"deposit_{uuid_lib.uuid4().hex}{suffix}"
    try:
        out_path = safe_join_under_base(user_dir, safe)
    except PathTraversalError:
        raise HTTPException(status_code=400, detail="Invalid file path")
    try:
        out_path.write_bytes(content)
    except OSError as e:
        logger.exception("manual deposit write failed: %s", out_path)
        raise HTTPException(status_code=503, detail="Could not save file") from e

    deposit = Deposit(
        user_id=user_id,
        account_id=account_id if account_id else None,
        amount=amount,
        method=method,
        transaction_id=tid[:100],
        crypto_tx_hash=tid[:255] if is_crypto else None,
        screenshot_url=str(out_path.resolve()),
        bank_account_id=bank.id if bank else None,
        status="pending",
    )
    db.add(deposit)
    await db.commit()
    await db.refresh(deposit)

    try:
        await create_notification(
            db, user_id,
            title="Deposit Submitted",
            message=f"${float(amount):,.2f} manual deposit pending approval",
            notif_type="deposit", action_url="/wallet", email=True,
        )
        await db.commit()
    except Exception:
        logger.exception("create_notification failed after manual deposit (deposit already saved) user_id=%s", user_id)
        try:
            await db.rollback()
        except Exception:
            pass

    return {"id": str(deposit.id), "status": "pending", "amount": float(deposit.amount)}


# ─── OxaPay Webhook ──────────────────────────────────────────────────────

async def handle_oxapay_webhook(
    order_id: str,
    oxapay_status: str,
    track_id: str | None,
    payload: dict,
    db: AsyncSession,
) -> None:
    """Process OxaPay webhook callback. Auto-approve on 'paid', reject on 'expired'/'failed'."""
    from uuid import UUID as UUIDType

    try:
        deposit_uuid = UUIDType(order_id)
    except ValueError:
        logger.warning("OxaPay webhook: invalid order_id=%s", order_id)
        return

    result = await db.execute(select(Deposit).where(Deposit.id == deposit_uuid))
    deposit = result.scalar_one_or_none()
    if not deposit:
        logger.warning("OxaPay webhook: deposit not found order_id=%s", order_id)
        return

    # Idempotent — skip if already processed (but allow 'initiated' to transition)
    if deposit.status not in ("initiated", "pending"):
        logger.info("OxaPay webhook: deposit %s already %s, skipping", order_id, deposit.status)
        return

    if track_id:
        deposit.transaction_id = track_id

    # If payment is waiting/confirming, move from 'initiated' to 'pending'
    if oxapay_status in ("waiting", "confirming") and deposit.status == "initiated":
        deposit.status = "pending"
        await db.commit()
        logger.info("OxaPay webhook: deposit %s → pending (payment started)", order_id)
        return

    if oxapay_status == "paid":
        deposit.status = "auto_approved"
        deposit.approved_at = datetime.utcnow()

        user_q = await db.execute(select(User).where(User.id == deposit.user_id))
        user_row = user_q.scalar_one_or_none()
        if not user_row:
            logger.error("OxaPay webhook: user not found for deposit %s", order_id)
            return

        user_row.main_wallet_balance = (user_row.main_wallet_balance or Decimal("0")) + deposit.amount

        db.add(Transaction(
            user_id=deposit.user_id,
            account_id=None,
            type="deposit",
            amount=deposit.amount,
            balance_after=user_row.main_wallet_balance,
            reference_id=deposit.id,
            description=f"Deposit to main wallet - oxapay (auto)",
        ))

        # Apply bonus offers (mirrors admin approve_deposit logic)
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
            db.add(Transaction(
                user_id=deposit.user_id,
                account_id=None,
                type="bonus",
                amount=bonus_amount,
                balance_after=user_row.main_wallet_balance,
                description=f"Bonus: {offer.name} ({offer.percentage or 0}%)",
            ))
            bonus_msg = f" + ${float(bonus_amount):.2f} bonus ({offer.name})"

        await create_notification(
            db, deposit.user_id,
            title="Deposit approved",
            message=f"Your deposit of ${float(deposit.amount):,.2f} was approved automatically.{bonus_msg}",
            notif_type="deposit", action_url="/wallet", email=True,
        )

    elif oxapay_status in ("expired", "failed"):
        deposit.status = "rejected"
        deposit.rejection_reason = f"OxaPay payment {oxapay_status}"
        await create_notification(
            db, deposit.user_id,
            title="Deposit not completed",
            message=f"Your ${float(deposit.amount):,.2f} crypto deposit {oxapay_status}. Please try again.",
            notif_type="deposit", action_url="/wallet", email=True,
        )

    else:
        # "waiting", "confirming" — informational only
        logger.info("OxaPay webhook: deposit %s status=%s (no action)", order_id, oxapay_status)
        return

    await db.commit()
    logger.info("OxaPay webhook: deposit %s → %s", order_id, deposit.status)


# ─── Withdrawals ──────────────────────────────────────────────────────────

async def create_withdrawal(req, user_id: UUID, db: AsyncSession) -> dict:
    from packages.common.src.settings_store import get_bool_setting
    if await get_bool_setting("maintenance_mode", False):
        raise HTTPException(status_code=503, detail="Platform is under maintenance. Withdrawals are temporarily disabled.")
    if not await get_bool_setting("allow_withdrawals", True):
        raise HTTPException(status_code=403, detail="Withdrawals are currently disabled")

    user_q = await db.execute(select(User).where(User.id == user_id))
    user_row = user_q.scalar_one_or_none()
    if not user_row:
        raise HTTPException(status_code=404, detail="User not found")

    main_bal = user_row.main_wallet_balance or Decimal("0")
    if main_bal < req.amount:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Insufficient main wallet balance. Available: ${float(main_bal):.2f}. "
                "Transfer profit from your trading accounts to your main wallet first (Wallet page)."
            ),
        )

    withdrawal = Withdrawal(
        user_id=user_id,
        account_id=None,
        amount=req.amount,
        method=METHOD_MAP.get(req.method, "bank_transfer"),
        bank_details=getattr(req, "bank_details", None),
        crypto_address=getattr(req, "crypto_address", None),
        status="pending",
    )
    db.add(withdrawal)
    await db.commit()
    await db.refresh(withdrawal)

    await create_notification(
        db, user_id,
        title="Withdrawal Submitted",
        message=f"${float(req.amount):,.2f} withdrawal via {req.method} is pending approval",
        notif_type="withdrawal", action_url="/wallet", email=True,
    )
    await db.commit()

    return {"id": str(withdrawal.id), "status": "pending", "amount": float(withdrawal.amount)}


async def create_manual_withdrawal(
    user_id: UUID,
    amount: Decimal,
    upi_id: str,
    payout_notes: str,
    file: UploadFile | None,
    db: AsyncSession,
) -> dict:
    from packages.common.src.settings_store import get_bool_setting
    if not await get_bool_setting("allow_withdrawals", True):
        raise HTTPException(status_code=403, detail="Withdrawals are currently disabled")

    if amount <= 0:
        raise HTTPException(status_code=400, detail="Invalid amount")

    upi = (upi_id or "").strip()
    notes = (payout_notes or "").strip()
    qr_path_str: str | None = None

    if file and file.filename:
        suffix = Path(file.filename).suffix.lower()
        if suffix not in DEPOSIT_PROOF_EXT:
            raise HTTPException(status_code=400, detail="Allowed file types for QR: JPG, PNG, PDF, WEBP")
        content = await file.read()
        if len(content) > MAX_PROOF_BYTES:
            raise HTTPException(status_code=400, detail="File too large (max 10 MB)")
        try:
            user_dir = safe_join_under_base(_wallet_upload_root(), "withdrawals", str(user_id))
        except PathTraversalError:
            raise HTTPException(status_code=400, detail="Invalid upload path")
        user_dir.mkdir(parents=True, exist_ok=True)
        safe = f"payout_qr_{uuid_lib.uuid4().hex}{suffix}"
        try:
            out_path = safe_join_under_base(user_dir, safe)
        except PathTraversalError:
            raise HTTPException(status_code=400, detail="Invalid file path")
        try:
            out_path.write_bytes(content)
        except OSError as e:
            logger.exception("manual withdrawal qr write failed: %s", out_path)
            raise HTTPException(status_code=503, detail="Could not save file") from e
        qr_path_str = str(out_path.resolve())

    if not upi and not qr_path_str:
        raise HTTPException(
            status_code=400,
            detail="Provide a UPI ID and/or upload a QR code image for manual payout.",
        )

    user_q = await db.execute(select(User).where(User.id == user_id))
    user_row = user_q.scalar_one_or_none()
    if not user_row:
        raise HTTPException(status_code=404, detail="User not found")

    main_bal = user_row.main_wallet_balance or Decimal("0")
    if main_bal < amount:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Insufficient main wallet balance. Available: ${float(main_bal):.2f}. "
                "Transfer profit from trading accounts first."
            ),
        )

    bank_details: dict = {
        "manual": True,
        "upi_id": upi or None,
        "notes": notes or None,
        "user_payout_qr_path": qr_path_str,
    }

    withdrawal = Withdrawal(
        user_id=user_id,
        account_id=None,
        amount=amount,
        method="manual",
        bank_details=bank_details,
        status="pending",
    )
    db.add(withdrawal)
    await db.commit()
    await db.refresh(withdrawal)

    await create_notification(
        db, user_id,
        title="Withdrawal Submitted",
        message=f"${float(amount):,.2f} manual withdrawal pending approval",
        notif_type="withdrawal", action_url="/wallet", email=True,
    )
    await db.commit()

    return {"id": str(withdrawal.id), "status": "pending", "amount": float(withdrawal.amount)}


# ─── Transfers ────────────────────────────────────────────────────────────

async def internal_wallet_transfer(req, user_id: UUID, db: AsyncSession) -> dict:
    if req.from_account_id == req.to_account_id:
        raise HTTPException(status_code=400, detail="Choose two different accounts")

    fq = await db.execute(
        select(TradingAccount).where(
            TradingAccount.id == req.from_account_id,
            TradingAccount.user_id == user_id,
            TradingAccount.is_demo == False,
        )
    )
    from_a = fq.scalar_one_or_none()
    tq = await db.execute(
        select(TradingAccount).where(
            TradingAccount.id == req.to_account_id,
            TradingAccount.user_id == user_id,
            TradingAccount.is_demo == False,
        )
    )
    to_a = tq.scalar_one_or_none()
    if not from_a or not to_a:
        raise HTTPException(status_code=404, detail="Account not found")

    amt = Decimal(str(req.amount))
    free = (from_a.balance or Decimal("0")) - (from_a.margin_used or Decimal("0"))
    if free < amt:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Insufficient available balance on the source account. "
                f"Available: ${float(free):.2f} (${float(from_a.margin_used or 0):.2f} locked in open trades)."
            ),
        )

    from_a.balance = (from_a.balance or Decimal("0")) - amt
    from_a.equity = from_a.balance + (from_a.credit or Decimal("0"))
    from_a.free_margin = from_a.equity - (from_a.margin_used or Decimal("0"))

    to_a.balance = (to_a.balance or Decimal("0")) + amt
    to_a.equity = to_a.balance + (to_a.credit or Decimal("0"))
    to_a.free_margin = to_a.equity - (to_a.margin_used or Decimal("0"))

    db.add(Transaction(
        user_id=user_id, account_id=from_a.id, type="transfer",
        amount=-amt, balance_after=from_a.balance,
        description=f"Transfer to {to_a.account_number}",
    ))
    db.add(Transaction(
        user_id=user_id, account_id=to_a.id, type="transfer",
        amount=amt, balance_after=to_a.balance,
        description=f"Transfer from {from_a.account_number}",
    ))
    await db.commit()

    return {
        "message": "Transfer completed.",
        "from_balance": float(from_a.balance),
        "to_balance": float(to_a.balance),
    }


async def transfer_trading_to_main(req, user_id: UUID, db: AsyncSession) -> dict:
    amt = Decimal(str(req.amount))

    acc_q = await db.execute(
        select(TradingAccount).where(
            TradingAccount.id == req.from_account_id,
            TradingAccount.user_id == user_id,
            TradingAccount.is_demo == False,
        )
    )
    account = acc_q.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Trading account not found")

    free = (account.balance or Decimal("0")) - (account.margin_used or Decimal("0"))
    if free < amt:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Insufficient available balance on this trading account. "
                f"Available: ${float(free):.2f} (${float(account.margin_used or 0):.2f} locked in open trades)."
            ),
        )

    user_q = await db.execute(select(User).where(User.id == user_id))
    user_row = user_q.scalar_one_or_none()
    if not user_row:
        raise HTTPException(status_code=404, detail="User not found")

    account.balance = (account.balance or Decimal("0")) - amt
    account.equity = account.balance + (account.credit or Decimal("0"))
    account.free_margin = account.equity - (account.margin_used or Decimal("0"))

    user_row.main_wallet_balance = (user_row.main_wallet_balance or Decimal("0")) + amt

    db.add(Transaction(
        user_id=user_id, account_id=account.id, type="transfer",
        amount=-amt, balance_after=account.balance,
        description="Transfer to main wallet",
    ))
    db.add(Transaction(
        user_id=user_id, account_id=None, type="transfer",
        amount=amt, balance_after=user_row.main_wallet_balance,
        description=f"From trading account {account.account_number}",
    ))
    await db.commit()

    return {
        "message": "Funds moved to main wallet.",
        "main_wallet_balance": float(user_row.main_wallet_balance),
        "trading_balance": float(account.balance),
    }


async def transfer_main_to_trading(req, user_id: UUID, db: AsyncSession) -> dict:
    amt = Decimal(str(req.amount))

    user_q = await db.execute(select(User).where(User.id == user_id))
    user_row = user_q.scalar_one_or_none()
    if not user_row:
        raise HTTPException(status_code=404, detail="User not found")

    main_bal = user_row.main_wallet_balance or Decimal("0")
    if main_bal < amt:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient main wallet balance. Available: ${float(main_bal):.2f}",
        )

    acc_q = await db.execute(
        select(TradingAccount).where(
            TradingAccount.id == req.to_account_id,
            TradingAccount.user_id == user_id,
            TradingAccount.is_demo == False,
        )
    )
    account = acc_q.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Trading account not found")

    user_row.main_wallet_balance = main_bal - amt
    account.balance = (account.balance or Decimal("0")) + amt
    account.equity = account.balance + (account.credit or Decimal("0"))
    account.free_margin = account.equity - (account.margin_used or Decimal("0"))

    db.add(Transaction(
        user_id=user_id, account_id=None, type="transfer",
        amount=-amt, balance_after=user_row.main_wallet_balance,
        description=f"To trading account {account.account_number}",
    ))
    db.add(Transaction(
        user_id=user_id, account_id=account.id, type="transfer",
        amount=amt, balance_after=account.balance,
        description="Transfer from main wallet",
    ))
    await db.commit()

    return {
        "message": "Funds moved to trading account.",
        "main_wallet_balance": float(user_row.main_wallet_balance),
        "trading_balance": float(account.balance),
    }


# ─── Queries ──────────────────────────────────────────────────────────────

async def list_deposits(user_id: UUID, db: AsyncSession) -> dict:
    # Exclude 'initiated' deposits (OxaPay payments that were never started)
    query = (
        select(Deposit)
        .where(
            Deposit.user_id == user_id,
            Deposit.status != "initiated"
        )
        .order_by(Deposit.created_at.desc())
    )
    result = await db.execute(query)
    deposits = result.scalars().all()
    return {
        "items": [
            {
                "id": str(d.id),
                "created_at": d.created_at.isoformat() if d.created_at else None,
                "type": "deposit",
                "method": d.method or "bank",
                "amount": float(d.amount or 0),
                "status": d.status or "pending",
                "currency": "USD",
            }
            for d in deposits
        ]
    }


async def list_withdrawals(user_id: UUID, db: AsyncSession) -> dict:
    query = (
        select(Withdrawal)
        .where(Withdrawal.user_id == user_id)
        .order_by(Withdrawal.created_at.desc())
    )
    result = await db.execute(query)
    withdrawals = result.scalars().all()
    return {
        "items": [
            {
                "id": str(w.id),
                "created_at": w.created_at.isoformat() if w.created_at else None,
                "type": "withdrawal",
                "method": w.method or "bank",
                "amount": float(w.amount or 0),
                "status": w.status or "pending",
                "currency": "USD",
            }
            for w in withdrawals
        ]
    }


def _ledger_entry_method(txn_type: str | None) -> str:
    t = (txn_type or "").lower()
    if t == "transfer":
        return "Internal transfer"
    if t in ("adjustment", "credit"):
        return "Admin adjustment"
    if t == "profit":
        return "Trading — profit"
    if t == "loss":
        return "Trading — loss"
    return t.replace("_", " ").title() if t else "Ledger"


async def list_transactions(user_id: UUID, account_id: UUID | None, db: AsyncSession) -> dict:
    if account_id:
        acct = await db.execute(
            select(TradingAccount).where(
                TradingAccount.id == account_id,
                TradingAccount.user_id == user_id,
            )
        )
        if not acct.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="Account not found")
        query = select(Transaction).where(Transaction.account_id == account_id)
    else:
        query = select(Transaction).where(Transaction.user_id == user_id)

    query = query.order_by(Transaction.created_at.desc()).limit(500)
    result = await db.execute(query)
    txns = result.scalars().all()

    return {
        "items": [
            {
                "id": str(t.id),
                "created_at": t.created_at.isoformat() if t.created_at else None,
                "type": t.type or "adjustment",
                "method": _ledger_entry_method(t.type),
                "amount": float(t.amount or 0),
                "status": "completed",
                "currency": "USD",
                "description": (t.description or "").strip(),
                "account_id": str(t.account_id) if t.account_id else None,
            }
            for t in txns
        ]
    }


async def wallet_summary(user_id: UUID, account_id: UUID | None, db: AsyncSession) -> dict:
    user_q = await db.execute(select(User).where(User.id == user_id))
    user_row = user_q.scalar_one_or_none()
    main_wallet_balance = float(user_row.main_wallet_balance or 0) if user_row else 0.0

    dep_glob = await db.execute(
        select(func.coalesce(func.sum(Deposit.amount), 0)).where(
            Deposit.user_id == user_id,
            Deposit.status.in_(["approved", "auto_approved"]),
        )
    )
    total_deposited = float(dep_glob.scalar() or 0)

    wd_glob = await db.execute(
        select(func.coalesce(func.sum(Withdrawal.amount), 0)).where(
            Withdrawal.user_id == user_id,
            Withdrawal.status.in_(["approved", "completed"]),
        )
    )
    total_withdrawn = float(wd_glob.scalar() or 0)

    adj_main_in = await db.execute(
        select(func.coalesce(func.sum(Transaction.amount), 0)).where(
            Transaction.user_id == user_id,
            Transaction.account_id.is_(None),
            Transaction.type.in_(["adjustment", "credit"]),
            Transaction.amount > 0,
        )
    )
    adj_main_out = await db.execute(
        select(func.coalesce(func.sum(Transaction.amount), 0)).where(
            Transaction.user_id == user_id,
            Transaction.account_id.is_(None),
            Transaction.type.in_(["adjustment", "credit"]),
            Transaction.amount < 0,
        )
    )
    total_deposited += float(adj_main_in.scalar() or 0)
    total_withdrawn += abs(float(adj_main_out.scalar() or 0))

    acct_q = await db.execute(
        select(TradingAccount)
        .where(
            TradingAccount.user_id == user_id,
            TradingAccount.is_demo == False,
            TradingAccount.is_active == True,
        )
        .order_by(TradingAccount.created_at)
    )
    live_list = list(acct_q.scalars().all())

    live_accounts_payload = [
        {
            "id": str(a.id),
            "account_number": a.account_number,
            "balance": float(a.balance or 0),
            "credit": float(a.credit or 0),
            "margin_used": float(a.margin_used or 0),
            "currency": a.currency or "USD",
            "free_margin": float((a.balance or Decimal("0")) - (a.margin_used or Decimal("0"))),
        }
        for a in live_list
    ]
    total_live_balance = sum(float(a.balance or 0) for a in live_list)

    if not live_list:
        return {
            "main_wallet_balance": main_wallet_balance,
            "balance": 0, "credit": 0, "equity": 0, "margin_used": 0, "free_margin": 0,
            "total_deposited": total_deposited, "total_withdrawn": total_withdrawn,
            "total_live_balance": 0, "live_accounts": [],
        }

    if account_id is not None:
        account = next((a for a in live_list if a.id == account_id), None)
        if not account:
            raise HTTPException(status_code=404, detail="Live account not found")
        accounts_for_metrics = [account]
    else:
        accounts_for_metrics = live_list

    total_credit = Decimal("0")
    total_equity = Decimal("0")
    total_margin = Decimal("0")
    total_free = Decimal("0")

    for acc in accounts_for_metrics:
        total_credit += acc.credit or Decimal("0")
        total_equity += acc.equity or acc.balance or Decimal("0")
        total_margin += acc.margin_used or Decimal("0")
        bal = acc.balance or Decimal("0")
        mu = acc.margin_used or Decimal("0")
        total_free += bal - mu

    primary_balance = float(account.balance or 0) if account_id is not None else total_live_balance

    return {
        "main_wallet_balance": main_wallet_balance,
        "balance": primary_balance,
        "credit": float(total_credit),
        "equity": float(total_equity),
        "margin_used": float(total_margin),
        "free_margin": float(total_free),
        "total_deposited": total_deposited,
        "total_withdrawn": total_withdrawn,
        "total_live_balance": total_live_balance,
        "live_accounts": live_accounts_payload,
    }


async def get_deposit_bank_details(amount: Decimal | None, db: AsyncSession) -> dict:
    bank = None
    if amount is not None and amount > 0:
        bank = await _get_bank_for_tier(amount, db)
        await db.commit()
    if bank is None:
        result = await db.execute(
            select(BankAccount)
            .where(BankAccount.is_active == True)
            .order_by(BankAccount.rotation_order)
            .limit(1)
        )
        bank = result.scalars().first()
    if not bank:
        return {}

    resp: dict = {}
    if bank.bank_name:
        resp["bank_name"] = bank.bank_name
    if bank.account_name:
        resp["account_holder"] = bank.account_name
    if bank.account_number:
        resp["account_number"] = bank.account_number
    if bank.ifsc_code:
        resp["ifsc_code"] = bank.ifsc_code
    if bank.upi_id:
        resp["upi_id"] = bank.upi_id
    if bank.qr_code_url:
        resp["qr_code_url"] = bank.qr_code_url
    return resp


async def get_bank_info(amount: Decimal, db: AsyncSession) -> dict:
    bank = await _get_bank_for_tier(amount, db)
    if not bank:
        raise HTTPException(status_code=404, detail="No bank account available for this amount")
    await db.commit()
    return {
        "bank_name": bank.bank_name,
        "account_name": bank.account_name,
        "account_number": bank.account_number,
        "ifsc_code": bank.ifsc_code,
        "upi_id": bank.upi_id,
        "qr_code_url": bank.qr_code_url,
    }
