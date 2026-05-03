"""Admin KYC Service — document review, approval, rejection workflows."""
import uuid
from datetime import datetime
from pathlib import Path

from fastapi import HTTPException
from fastapi.responses import FileResponse
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.models import User, KYCDocument
from packages.common.src.notify import create_notification
from dependencies import write_audit_log


async def get_kyc_file(document_id: uuid.UUID, db: AsyncSession) -> FileResponse:
    """Stream a KYC document for admin review (no user-ownership check)."""
    result = await db.execute(
        select(KYCDocument).where(KYCDocument.id == document_id)
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    file_path = Path(doc.file_url)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found on server")

    return FileResponse(str(file_path), filename=file_path.name)


async def list_kyc_pending(page: int, per_page: int, db: AsyncSession) -> dict:
    query = select(User).where(User.kyc_status == "submitted")
    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    query = query.order_by(User.created_at.desc()).offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(query)
    users = result.scalars().all()

    items = []
    for u in users:
        docs_q = await db.execute(
            select(KYCDocument).where(KYCDocument.user_id == u.id).order_by(KYCDocument.created_at.desc())
        )
        docs = docs_q.scalars().all()
        items.append({
            "id": str(u.id),
            "email": u.email,
            "first_name": u.first_name,
            "last_name": u.last_name,
            "phone": u.phone,
            "date_of_birth": u.date_of_birth.isoformat() if u.date_of_birth else None,
            "country": u.country,
            "address": u.address,
            "kyc_status": u.kyc_status,
            "created_at": u.created_at.isoformat() if u.created_at else None,
            "documents": [
                {
                    "id": str(doc.id),
                    "document_type": doc.document_type,
                    "file_url": doc.file_url,
                    "status": doc.status,
                    "created_at": doc.created_at.isoformat() if doc.created_at else None,
                }
                for doc in docs
            ],
        })

    return {"items": items, "total": total, "page": page, "per_page": per_page}


async def list_kyc_approved(page: int, per_page: int, db: AsyncSession) -> dict:
    query = select(User).where(User.kyc_status == "approved")
    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    query = query.order_by(User.updated_at.desc()).offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(query)
    users = result.scalars().all()

    items = []
    for u in users:
        docs_q = await db.execute(
            select(KYCDocument).where(
                KYCDocument.user_id == u.id,
                KYCDocument.status == "approved"
            ).order_by(KYCDocument.reviewed_at.desc())
        )
        docs = docs_q.scalars().all()
        items.append({
            "id": str(u.id),
            "email": u.email,
            "first_name": u.first_name,
            "last_name": u.last_name,
            "phone": u.phone,
            "country": u.country,
            "kyc_status": u.kyc_status,
            "created_at": u.created_at.isoformat() if u.created_at else None,
            "approved_at": u.updated_at.isoformat() if u.updated_at else None,
            "documents": [
                {
                    "id": str(doc.id),
                    "document_type": doc.document_type,
                    "file_url": doc.file_url,
                    "status": doc.status,
                    "reviewed_at": doc.reviewed_at.isoformat() if doc.reviewed_at else None,
                }
                for doc in docs
            ],
        })

    return {"items": items, "total": total, "page": page, "per_page": per_page}


async def list_kyc_rejected(page: int, per_page: int, db: AsyncSession) -> dict:
    query = select(User).where(User.kyc_status == "rejected")
    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    query = query.order_by(User.updated_at.desc()).offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(query)
    users = result.scalars().all()

    items = []
    for u in users:
        docs_q = await db.execute(
            select(KYCDocument).where(KYCDocument.user_id == u.id).order_by(KYCDocument.created_at.desc())
        )
        docs = docs_q.scalars().all()
        items.append({
            "id": str(u.id),
            "email": u.email,
            "first_name": u.first_name,
            "last_name": u.last_name,
            "phone": u.phone,
            "country": u.country,
            "kyc_status": u.kyc_status,
            "created_at": u.created_at.isoformat() if u.created_at else None,
            "documents": [
                {
                    "id": str(doc.id),
                    "document_type": doc.document_type,
                    "file_url": doc.file_url,
                    "status": doc.status,
                    "rejection_reason": doc.rejection_reason,
                    "reviewed_at": doc.reviewed_at.isoformat() if doc.reviewed_at else None,
                }
                for doc in docs
            ],
        })

    return {"items": items, "total": total, "page": page, "per_page": per_page}


async def approve_kyc(
    user_id: uuid.UUID,
    admin_id: uuid.UUID,
    ip_address: str | None,
    db: AsyncSession,
) -> dict:
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.kyc_status != "submitted":
        raise HTTPException(status_code=400, detail="KYC is not in submitted status")

    user.kyc_status = "approved"
    user.updated_at = datetime.utcnow()

    docs_q = await db.execute(
        select(KYCDocument).where(KYCDocument.user_id == user_id, KYCDocument.status == "pending")
    )
    for doc in docs_q.scalars().all():
        doc.status = "approved"
        doc.reviewed_by = admin_id
        doc.reviewed_at = datetime.utcnow()

    await write_audit_log(
        db, admin_id, "approve_kyc", "user", user_id,
        new_values={"kyc_status": "approved"},
        ip_address=ip_address,
    )
    await create_notification(
        db, user_id,
        title="KYC approved",
        message="Your identity verification was successful.",
        notif_type="kyc",
        action_url="/profile",
        commit=False,
    )
    await db.commit()
    return {"message": "KYC approved successfully"}


async def reject_kyc(
    user_id: uuid.UUID,
    reason: str,
    admin_id: uuid.UUID,
    ip_address: str | None,
    db: AsyncSession,
) -> dict:
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.kyc_status != "submitted":
        raise HTTPException(status_code=400, detail="KYC is not in submitted status")

    user.kyc_status = "rejected"
    user.updated_at = datetime.utcnow()

    docs_q = await db.execute(
        select(KYCDocument).where(KYCDocument.user_id == user_id, KYCDocument.status == "pending")
    )
    for doc in docs_q.scalars().all():
        doc.status = "rejected"
        doc.reviewed_by = admin_id
        doc.reviewed_at = datetime.utcnow()
        doc.rejection_reason = reason

    await write_audit_log(
        db, admin_id, "reject_kyc", "user", user_id,
        new_values={"kyc_status": "rejected", "reason": reason},
        ip_address=ip_address,
    )
    reason_str = (reason or "").strip()
    extra = f" Reason: {reason_str}" if reason_str else ""
    await create_notification(
        db, user_id,
        title="KYC not approved",
        message=f"Your identity verification could not be approved.{extra} You may upload new documents from your profile.",
        notif_type="kyc",
        action_url="/profile",
        commit=False,
    )
    await db.commit()
    return {"message": "KYC rejected"}
