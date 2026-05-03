"""Algo API Keys — User-facing endpoints to manage per-account algo keys.

Users generate API key + secret for each trading account.
"""
import hashlib
import secrets
import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from packages.common.src.database import get_db
from packages.common.src.auth import get_current_user
from packages.common.src.models import AlgoApiKey, TradingAccount, MasterAccount, InvestorAllocation

logger = logging.getLogger("algo_keys")
router = APIRouter()


def _hash_secret(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


def _gen_api_key() -> str:
    return "ak_" + secrets.token_hex(24)


def _gen_api_secret() -> str:
    return "as_" + secrets.token_hex(32)


class GenerateKeyRequest(BaseModel):
    account_id: UUID
    label: Optional[str] = ""


class RevokeKeyRequest(BaseModel):
    key_id: UUID


@router.get("/keys")
async def list_keys(
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all algo API keys for the current user (secrets not returned)."""
    uid = user["user_id"]
    result = await db.execute(
        select(AlgoApiKey).where(AlgoApiKey.user_id == uid).order_by(AlgoApiKey.created_at.desc())
    )
    keys = result.scalars().all()
    return {
        "items": [
            {
                "id": str(k.id),
                "account_id": str(k.account_id),
                "account_number": k.account.account_number if k.account else "",
                "api_key": k.api_key,
                "label": k.label or "",
                "is_active": k.is_active,
                "trades_count": k.trades_count or 0,
                "last_used_at": k.last_used_at.isoformat() if k.last_used_at else None,
                "created_at": k.created_at.isoformat() if k.created_at else None,
            }
            for k in keys
        ]
    }


@router.get("/accounts")
async def list_accounts_with_keys(
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List user's trading accounts with algo key status."""
    uid = user["user_id"]
    accounts_q = await db.execute(
        select(TradingAccount).where(
            TradingAccount.user_id == uid,
            TradingAccount.is_active == True,
        ).order_by(TradingAccount.created_at)
    )
    accounts = accounts_q.scalars().all()

    keys_q = await db.execute(
        select(AlgoApiKey).where(AlgoApiKey.user_id == uid, AlgoApiKey.is_active == True)
    )
    keys = keys_q.scalars().all()
    key_map = {str(k.account_id): k for k in keys}

    # Determine account types: master (PAMM/MAM/Signal) or investor allocation
    master_q = await db.execute(
        select(MasterAccount.account_id, MasterAccount.master_type, MasterAccount.status).where(
            MasterAccount.user_id == uid,
            MasterAccount.status.in_(["active", "approved", "pending"]),
        )
    )
    master_map = {str(row.account_id): row.master_type for row in master_q.all()}

    investor_q = await db.execute(
        select(InvestorAllocation.investor_account_id, InvestorAllocation.copy_type).where(
            InvestorAllocation.investor_user_id == uid,
            InvestorAllocation.status == "active",
        )
    )
    investor_map = {str(row.investor_account_id): row.copy_type for row in investor_q.all()}

    items = []
    for a in accounts:
        aid = str(a.id)
        k = key_map.get(aid)
        # Resolve account type label
        if aid in master_map:
            mt = (master_map[aid] or "").upper()
            if mt == "PAMM":
                account_type = "PAMM Master"
            elif mt == "MAM":
                account_type = "MAM Master"
            else:
                account_type = "Copy Trade Master"
        elif aid in investor_map:
            ct = (investor_map[aid] or "").lower()
            if ct == "pamm":
                account_type = "PAMM Investor"
            elif ct == "mam":
                account_type = "MAM Investor"
            else:
                account_type = "Copy Trade Follower"
        else:
            account_type = "Trading Account"

        items.append({
            "account_id": aid,
            "account_number": a.account_number,
            "balance": float(a.balance or 0),
            "equity": float(a.equity or 0),
            "is_demo": a.is_demo,
            "currency": a.currency or "USD",
            "account_type": account_type,
            "has_key": k is not None,
            "key_id": str(k.id) if k else None,
            "api_key": k.api_key if k else None,
            "api_secret": k.api_secret if k else None,
            "label": k.label if k else "",
            "trades_count": k.trades_count if k else 0,
            "last_used_at": k.last_used_at.isoformat() if k and k.last_used_at else None,
            "key_created_at": k.created_at.isoformat() if k and k.created_at else None,
        })
    return {"items": items}


@router.post("/generate")
async def generate_key(
    body: GenerateKeyRequest,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate a new API key + secret for a trading account. Returns secret ONCE."""
    uid = user["user_id"]
    # Verify account belongs to user
    acct_q = await db.execute(
        select(TradingAccount).where(
            TradingAccount.id == body.account_id,
            TradingAccount.user_id == uid,
            TradingAccount.is_active == True,
        )
    )
    account = acct_q.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found or not yours")

    # Revoke any existing active key for this account
    existing_q = await db.execute(
        select(AlgoApiKey).where(
            AlgoApiKey.user_id == uid,
            AlgoApiKey.account_id == body.account_id,
            AlgoApiKey.is_active == True,
        )
    )
    for old_key in existing_q.scalars().all():
        old_key.is_active = False

    api_key = _gen_api_key()
    raw_secret = _gen_api_secret()

    new_key = AlgoApiKey(
        user_id=uid,
        account_id=body.account_id,
        api_key=api_key,
        secret_hash=_hash_secret(raw_secret),
        api_secret=raw_secret,
        label=body.label or f"Algo - {account.account_number}",
    )
    db.add(new_key)
    await db.commit()

    logger.info("[ALGO] Key generated for account %s by user %s", account.account_number, uid)

    return {
        "id": str(new_key.id),
        "account_id": str(body.account_id),
        "account_number": account.account_number,
        "api_key": api_key,
        "api_secret": raw_secret,
        "label": new_key.label,
        "message": "Save the API Secret now — it will NOT be shown again!",
    }


@router.post("/revoke")
async def revoke_key(
    body: RevokeKeyRequest,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Revoke an algo API key."""
    uid = user["user_id"]
    key_q = await db.execute(
        select(AlgoApiKey).where(
            AlgoApiKey.id == body.key_id,
            AlgoApiKey.user_id == uid,
        )
    )
    key_row = key_q.scalar_one_or_none()
    if not key_row:
        raise HTTPException(status_code=404, detail="Key not found")

    key_row.is_active = False
    await db.commit()

    logger.info("[ALGO] Key revoked: %s", key_row.api_key[:12])
    return {"status": "revoked", "key_id": str(body.key_id)}
