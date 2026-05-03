"""Profile API — User profile, password change, sessions, KYC."""
from uuid import UUID

from fastapi import APIRouter, Depends, UploadFile, File, Form
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.database import get_db
from packages.common.src.auth import get_current_user
from ..services import profile_service

router = APIRouter()


class UpdateProfileRequest(BaseModel):
    first_name: str | None = Field(None, max_length=100)
    last_name: str | None = Field(None, max_length=100)
    phone: str | None = Field(None, max_length=20)
    country: str | None = Field(None, max_length=100)
    address: str | None = None
    language: str | None = Field(None, max_length=10)
    theme: str | None = Field(None, pattern="^(light|dark)$")
    date_of_birth: str | None = None


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=1)
    new_password: str = Field(min_length=8, max_length=128)


@router.get("")
async def get_profile(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await profile_service.get_profile(
        user_id=current_user["user_id"], db=db,
    )


@router.put("")
async def update_profile(
    req: UpdateProfileRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await profile_service.update_profile(
        user_id=current_user["user_id"],
        update_data=req.model_dump(exclude_unset=True),
        db=db,
    )


@router.put("/password")
async def change_password(
    req: ChangePasswordRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await profile_service.change_password(
        user_id=current_user["user_id"],
        current_password=req.current_password,
        new_password=req.new_password,
        db=db,
    )


@router.get("/sessions")
async def list_sessions(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await profile_service.list_sessions(
        user_id=current_user["user_id"], db=db,
    )


@router.delete("/sessions/{session_id}")
async def terminate_session(
    session_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await profile_service.terminate_session(
        user_id=current_user["user_id"], session_id=session_id, db=db,
    )


# ── KYC ─────────────────────────────────────────────────────────────────────

@router.post("/kyc/submit")
async def submit_kyc(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    document_type: str = Form(...),
    file: UploadFile = File(...),
    document_type_2: str | None = Form(default=None),
    file_2: UploadFile | None = File(default=None),
    residential_address: str | None = Form(None),
    city: str | None = Form(None),
    postal_code: str | None = Form(None),
    country_of_residence: str | None = Form(None),
):
    """Upload one or two KYC documents (multipart). Optional address fields update the user profile.

    Allowed when kyc_status is pending/rejected. Blocked when submitted, under_review, or approved.
    Sets kyc_status to 'submitted' so admin KYC queue can pick it up.
    """
    return await profile_service.submit_kyc(
        user_id=current_user["user_id"],
        document_type=document_type,
        file=file,
        document_type_2=document_type_2,
        file_2=file_2,
        residential_address=residential_address,
        city=city,
        postal_code=postal_code,
        country_of_residence=country_of_residence,
        db=db,
    )


@router.get("/kyc/file/{doc_id}")
async def get_kyc_file(
    doc_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Stream a KYC document file. Users can only access their own documents."""
    file_path = await profile_service.get_kyc_file(
        user_id=current_user["user_id"], document_id=doc_id, db=db,
    )
    return FileResponse(str(file_path))
