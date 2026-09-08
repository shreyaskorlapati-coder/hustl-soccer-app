from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.auth.utils import hash_password, verify_password
from app.database import get_db
from app.logging_config import get_logger
from app.models.db_models import UserDB
from app.schemas.auth import (
    UserListResponse,
    UserPasswordUpdate,
    UserResponse,
    UserUpdate,
)

router = APIRouter(prefix="/api/users")
logger = get_logger(__name__)

USER_NOT_FOUND = "User not found"


@router.get("", response_model=UserListResponse)
async def search_users(
    q: str | None = Query(None, description="Search query for name or email"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
):
    """Search users by name or email."""
    logger.debug(f"Searching users: q={q} skip={skip} limit={limit}")

    query = select(UserDB)

    if q:
        search_term = f"%{q.lower()}%"
        query = query.where(
            or_(
                func.lower(UserDB.name).like(search_term),
                func.lower(UserDB.email).like(search_term),
            )
        )

    query = query.order_by(UserDB.name.asc()).offset(skip).limit(limit)

    result = await db.execute(query)
    users = result.scalars().all()

    count_query = select(func.count(UserDB.id))
    if q:
        search_term = f"%{q.lower()}%"
        count_query = count_query.where(
            or_(
                func.lower(UserDB.name).like(search_term),
                func.lower(UserDB.email).like(search_term),
            )
        )

    count_result = await db.execute(count_query)
    total = count_result.scalar() or 0

    logger.debug(f"Found {total} users, returning {len(users)}")
    return UserListResponse(
        count=total,
        results=[UserResponse.from_db(u) for u in users],
    )


@router.get("/me", response_model=UserResponse)
async def get_current_user_profile(
    current_user: UserDB = Depends(get_current_user),
):
    """Get current user's profile."""
    return UserResponse.from_db(current_user)


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
):
    """Get a user by ID."""
    logger.debug(f"Fetching user: id={user_id}")

    result = await db.execute(select(UserDB).where(UserDB.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        logger.warning(f"User not found: id={user_id}")
        raise HTTPException(status_code=404, detail=USER_NOT_FOUND)

    return UserResponse.from_db(user)


@router.put("/me", response_model=UserResponse)
async def update_current_user(
    user_update: UserUpdate,
    current_user: UserDB = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update current user's profile."""
    logger.info(f"Updating user profile: id={current_user.id}")

    update_data = user_update.model_dump(exclude_unset=True)

    if "email" in update_data and update_data["email"]:
        new_email = update_data["email"].lower()
        if new_email != current_user.email:
            existing = await db.execute(
                select(UserDB).where(UserDB.email == new_email)
            )
            if existing.scalar_one_or_none():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="An account with this email already exists.",
                )
            update_data["email"] = new_email

    for field, value in update_data.items():
        if field == "phone":
            # Allow phone to be set to empty string (to clear it)
            setattr(current_user, field, value if value else None)
        elif value is not None:
            setattr(current_user, field, value)

    await db.commit()
    await db.refresh(current_user)

    logger.info(f"Updated user: id={current_user.id}")
    return UserResponse.from_db(current_user)


@router.put("/me/password", status_code=status.HTTP_204_NO_CONTENT)
async def update_password(
    password_update: UserPasswordUpdate,
    current_user: UserDB = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update current user's password."""
    logger.info(f"Updating password for user: id={current_user.id}")

    if not verify_password(password_update.current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect.",
        )

    current_user.password_hash = hash_password(password_update.new_password)

    await db.commit()

    logger.info(f"Password updated for user: id={current_user.id}")
    return None


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
async def delete_current_user(
    current_user: UserDB = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete current user's account."""
    logger.info(f"Deleting user: id={current_user.id}")

    await db.delete(current_user)
    await db.commit()

    logger.info(f"Deleted user: id={current_user.id}")
    return None


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: str,
    current_user: UserDB = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a user by ID (admin only or self-delete)."""
    logger.info(f"Deleting user: id={user_id} by user={current_user.id}")

    if user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to delete this user.",
        )

    result = await db.execute(select(UserDB).where(UserDB.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        logger.warning(f"User not found for delete: id={user_id}")
        raise HTTPException(status_code=404, detail=USER_NOT_FOUND)

    await db.delete(user)
    await db.commit()

    logger.info(f"Deleted user: id={user_id}")
    return None
