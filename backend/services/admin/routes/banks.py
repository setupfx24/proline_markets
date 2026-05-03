import uuid

from fastapi import APIRouter, Depends, Request, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.database import get_db
from dependencies import require_permission
from packages.common.src.models import User
from packages.common.src.admin_schemas import BankAccountIn
from services import bank_service

router = APIRouter(prefix="/banks", tags=["Banks"])


@router.get("")
async def list_bank_accounts(
    admin: User = Depends(require_permission("banks.view")),
    db: AsyncSession = Depends(get_db),
):
    return await bank_service.list_bank_accounts(db=db)


@router.post("")
async def create_bank_account(
    body: BankAccountIn,
    request: Request,
    admin: User = Depends(require_permission("banks.create")),
    db: AsyncSession = Depends(get_db),
):
    return await bank_service.create_bank_account(
        body=body, admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
    )


@router.put("/{bank_id}")
async def update_bank_account(
    bank_id: uuid.UUID,
    body: BankAccountIn,
    request: Request,
    admin: User = Depends(require_permission("banks.update")),
    db: AsyncSession = Depends(get_db),
):
    return await bank_service.update_bank_account(
        bank_id=bank_id, body=body, admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
    )


@router.post("/upload-qr")
async def upload_qr_code(
    file: UploadFile = File(...),
    admin: User = Depends(require_permission("banks.create")),
):
    return await bank_service.upload_qr_code(file=file)


@router.get("/qr/{filename}")
async def serve_qr_code(filename: str):
    return bank_service.serve_qr_code(filename=filename)


@router.delete("/{bank_id}")
async def delete_bank_account(
    bank_id: uuid.UUID,
    request: Request,
    admin: User = Depends(require_permission("banks.update")),
    db: AsyncSession = Depends(get_db),
):
    return await bank_service.delete_bank_account(
        bank_id=bank_id, admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
    )
