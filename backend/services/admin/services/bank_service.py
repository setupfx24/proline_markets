"""Admin Bank Service — CRUD for bank accounts, QR upload/serve."""
import re
import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import select, update, delete
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.models import BankAccount, Deposit
from packages.common.src.admin_schemas import BankAccountIn, BankAccountOut
from packages.common.src.path_safety import PathTraversalError, safe_join_under_base
from dependencies import write_audit_log

UPLOAD_DIR = Path(__file__).resolve().parent.parent.parent.parent / "uploads" / "qr"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


async def list_bank_accounts(db: AsyncSession) -> list:
    result = await db.execute(
        select(BankAccount).order_by(BankAccount.rotation_order)
    )
    banks = result.scalars().all()
    return [
        BankAccountOut(
            id=str(b.id),
            account_name=b.account_name,
            account_number=b.account_number,
            bank_name=b.bank_name,
            ifsc_code=b.ifsc_code,
            upi_id=b.upi_id,
            qr_code_url=b.qr_code_url,
            method_type=b.method_type or "bank",
            asset=b.asset,
            network=b.network,
            wallet_address=b.wallet_address,
            tier=b.tier or 1,
            min_amount=float(b.min_amount or 0),
            max_amount=float(b.max_amount or 999999999),
            is_active=b.is_active,
            rotation_order=b.rotation_order or 0,
            last_used_at=b.last_used_at,
            created_at=b.created_at,
        )
        for b in banks
    ]


async def create_bank_account(
    body: BankAccountIn,
    admin_id: uuid.UUID,
    ip_address: str | None,
    db: AsyncSession,
) -> dict:
    bank = BankAccount(
        account_name=body.account_name,
        account_number=body.account_number,
        bank_name=body.bank_name,
        ifsc_code=body.ifsc_code,
        upi_id=body.upi_id,
        qr_code_url=body.qr_code_url,
        method_type=body.method_type or "bank",
        asset=body.asset,
        network=body.network,
        wallet_address=body.wallet_address,
        tier=body.tier,
        min_amount=body.min_amount,
        max_amount=body.max_amount,
        is_active=body.is_active,
        rotation_order=body.rotation_order,
    )
    db.add(bank)
    await db.flush()

    await write_audit_log(
        db, admin_id, "create_bank_account", "bank_account", bank.id,
        new_values={"bank_name": body.bank_name, "account_number": body.account_number},
        ip_address=ip_address,
    )
    await db.commit()
    return {"message": "Bank account created", "id": str(bank.id)}


async def update_bank_account(
    bank_id: uuid.UUID,
    body: BankAccountIn,
    admin_id: uuid.UUID,
    ip_address: str | None,
    db: AsyncSession,
) -> dict:
    result = await db.execute(select(BankAccount).where(BankAccount.id == bank_id))
    bank = result.scalar_one_or_none()
    if not bank:
        raise HTTPException(status_code=404, detail="Bank account not found")

    old_values = {"bank_name": bank.bank_name, "account_number": bank.account_number}

    bank.account_name = body.account_name
    bank.account_number = body.account_number
    bank.bank_name = body.bank_name
    bank.ifsc_code = body.ifsc_code
    bank.upi_id = body.upi_id
    bank.qr_code_url = body.qr_code_url
    bank.method_type = body.method_type or "bank"
    bank.asset = body.asset
    bank.network = body.network
    bank.wallet_address = body.wallet_address
    bank.tier = body.tier
    bank.min_amount = body.min_amount
    bank.max_amount = body.max_amount
    bank.is_active = body.is_active
    bank.rotation_order = body.rotation_order

    await write_audit_log(
        db, admin_id, "update_bank_account", "bank_account", bank_id,
        old_values=old_values,
        new_values={"bank_name": body.bank_name, "account_number": body.account_number},
        ip_address=ip_address,
    )
    await db.commit()
    return {"message": "Bank account updated"}


async def upload_qr_code(file: UploadFile) -> dict:
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Only image files are allowed")

    max_size = 5 * 1024 * 1024
    contents = await file.read()
    if len(contents) > max_size:
        raise HTTPException(status_code=400, detail="File too large (max 5MB)")

    ext = file.filename.rsplit(".", 1)[-1].lower() if file.filename and "." in file.filename else "png"
    if ext not in ("png", "jpg", "jpeg", "webp", "gif"):
        ext = "png"

    filename = f"{uuid.uuid4().hex}.{ext}"
    filepath = UPLOAD_DIR / filename
    filepath.write_bytes(contents)

    return {"url": f"/banks/qr/{filename}", "filename": filename}


def serve_qr_code(filename: str) -> FileResponse:
    fn = Path(filename or "").name
    if not fn or fn != filename or ".." in filename:
        raise HTTPException(status_code=400, detail="Invalid filename")
    if not re.fullmatch(r"[a-fA-F0-9]{32}\.[a-zA-Z0-9]+", fn):
        raise HTTPException(status_code=400, detail="Invalid filename")
    try:
        filepath = safe_join_under_base(UPLOAD_DIR, fn)
    except PathTraversalError:
        raise HTTPException(status_code=400, detail="Invalid filename")
    if not filepath.exists() or not filepath.is_file():
        raise HTTPException(status_code=404, detail="QR code not found")
    return FileResponse(filepath)


async def delete_bank_account(
    bank_id: uuid.UUID,
    admin_id: uuid.UUID,
    ip_address: str | None,
    db: AsyncSession,
) -> dict:
    result = await db.execute(select(BankAccount).where(BankAccount.id == bank_id))
    bank = result.scalar_one_or_none()
    if not bank:
        raise HTTPException(status_code=404, detail="Bank account not found")

    old_snapshot = {
        "bank_name": bank.bank_name,
        "account_number": bank.account_number,
        "qr_code_url": bank.qr_code_url,
    }

    await db.execute(
        update(Deposit).where(Deposit.bank_account_id == bank_id).values(bank_account_id=None)
    )

    qr_url = (bank.qr_code_url or "").strip()
    if qr_url and "/banks/qr/" in qr_url:
        fname = qr_url.rsplit("/banks/qr/", 1)[-1].split("?", 1)[0]
        if fname and re.fullmatch(r"[a-fA-F0-9]{32}\.[a-zA-Z0-9]+", fname):
            fp = UPLOAD_DIR / fname
            try:
                fp.resolve().relative_to(UPLOAD_DIR.resolve())
                if fp.is_file():
                    fp.unlink()
            except (OSError, ValueError):
                pass

    await db.execute(delete(BankAccount).where(BankAccount.id == bank_id))

    await write_audit_log(
        db, admin_id, "delete_bank_account", "bank_account", bank_id,
        old_values=old_snapshot,
        new_values={"deleted": True},
        ip_address=ip_address,
    )
    await db.commit()
    return {"message": "Bank account removed"}
