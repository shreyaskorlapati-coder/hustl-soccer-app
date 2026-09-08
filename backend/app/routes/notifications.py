from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.database import get_db
from app.logging_config import get_logger
from app.models.db_models import (
    DeviceTokenDB,
    NotificationDB,
    NotificationPreferenceDB,
    UserDB,
)
from app.schemas.notification import (
    DeviceTokenOut,
    DeviceTokenRegister,
    MarkNotificationsReadRequest,
    NotificationListResponse,
    NotificationOut,
    NotificationPreferenceOut,
    NotificationPreferenceUpdate,
)

router = APIRouter(prefix="/api/notifications")
logger = get_logger(__name__)


def _notification_to_response(notification: NotificationDB) -> NotificationOut:
    return NotificationOut(
        id=notification.id,
        title=notification.title,
        body=notification.body,
        notification_type=notification.notification_type,
        reference_type=notification.reference_type,
        reference_id=notification.reference_id,
        data=notification.data,
        is_read=notification.is_read,
        created_at=notification.created_at,
        read_at=notification.read_at,
    )


@router.post("/device-token", response_model=DeviceTokenOut, status_code=201)
async def register_device_token(
    request: DeviceTokenRegister,
    current_user: UserDB = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Register a device token for push notifications."""
    logger.info(f"Registering device token for user {current_user.id}")
    
    existing = await db.execute(
        select(DeviceTokenDB).where(DeviceTokenDB.token == request.token)
    )
    existing_token = existing.scalar_one_or_none()
    
    if existing_token:
        existing_token.user_id = current_user.id
        existing_token.platform = request.platform.value
        existing_token.device_name = request.device_name
        existing_token.is_active = True
        await db.commit()
        await db.refresh(existing_token)
        logger.info(f"Updated existing device token {existing_token.id}")
        return DeviceTokenOut(
            id=existing_token.id,
            token=existing_token.token,
            platform=existing_token.platform,
            device_name=existing_token.device_name,
            is_active=existing_token.is_active,
            created_at=existing_token.created_at,
        )
    
    device_token = DeviceTokenDB(
        user_id=current_user.id,
        token=request.token,
        platform=request.platform.value,
        device_name=request.device_name,
        is_active=True,
    )
    db.add(device_token)
    await db.commit()
    await db.refresh(device_token)
    
    logger.info(f"Created device token {device_token.id} for user {current_user.id}")
    return DeviceTokenOut(
        id=device_token.id,
        token=device_token.token,
        platform=device_token.platform,
        device_name=device_token.device_name,
        is_active=device_token.is_active,
        created_at=device_token.created_at,
    )


@router.delete("/device-token/{token}")
async def unregister_device_token(
    token: str,
    current_user: UserDB = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Unregister a device token."""
    logger.info(f"Unregistering device token for user {current_user.id}")
    
    result = await db.execute(
        select(DeviceTokenDB).where(
            DeviceTokenDB.token == token,
            DeviceTokenDB.user_id == current_user.id,
        )
    )
    device_token = result.scalar_one_or_none()
    
    if not device_token:
        raise HTTPException(status_code=404, detail="Device token not found")
    
    device_token.is_active = False
    await db.commit()
    
    logger.info(f"Deactivated device token for user {current_user.id}")
    return {"message": "Device token unregistered"}


@router.get("/preferences", response_model=NotificationPreferenceOut)
async def get_notification_preferences(
    current_user: UserDB = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get user's notification preferences."""
    result = await db.execute(
        select(NotificationPreferenceDB).where(
            NotificationPreferenceDB.user_id == current_user.id
        )
    )
    pref = result.scalar_one_or_none()
    
    if not pref:
        pref = NotificationPreferenceDB(user_id=current_user.id)
        db.add(pref)
        await db.commit()
        await db.refresh(pref)
    
    return NotificationPreferenceOut(
        id=pref.id,
        user_id=pref.user_id,
        game_reminders=pref.game_reminders,
        game_player_joined=pref.game_player_joined,
        game_player_left=pref.game_player_left,
        game_cancelled=pref.game_cancelled,
        game_updated=pref.game_updated,
        team_invitations=pref.team_invitations,
        team_member_joined=pref.team_member_joined,
        team_member_left=pref.team_member_left,
        tournament_updates=pref.tournament_updates,
        tournament_match_reminders=pref.tournament_match_reminders,
        tournament_results=pref.tournament_results,
        reminder_hours_before=pref.reminder_hours_before,
        created_at=pref.created_at,
        updated_at=pref.updated_at,
    )


@router.put("/preferences", response_model=NotificationPreferenceOut)
async def update_notification_preferences(
    request: NotificationPreferenceUpdate,
    current_user: UserDB = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update user's notification preferences."""
    logger.info(f"Updating notification preferences for user {current_user.id}")
    
    result = await db.execute(
        select(NotificationPreferenceDB).where(
            NotificationPreferenceDB.user_id == current_user.id
        )
    )
    pref = result.scalar_one_or_none()
    
    if not pref:
        pref = NotificationPreferenceDB(user_id=current_user.id)
        db.add(pref)
        await db.flush()
    
    update_data = request.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(pref, field, value)
    
    await db.commit()
    await db.refresh(pref)
    
    logger.info(f"Updated notification preferences for user {current_user.id}")
    return NotificationPreferenceOut(
        id=pref.id,
        user_id=pref.user_id,
        game_reminders=pref.game_reminders,
        game_player_joined=pref.game_player_joined,
        game_player_left=pref.game_player_left,
        game_cancelled=pref.game_cancelled,
        game_updated=pref.game_updated,
        team_invitations=pref.team_invitations,
        team_member_joined=pref.team_member_joined,
        team_member_left=pref.team_member_left,
        tournament_updates=pref.tournament_updates,
        tournament_match_reminders=pref.tournament_match_reminders,
        tournament_results=pref.tournament_results,
        reminder_hours_before=pref.reminder_hours_before,
        created_at=pref.created_at,
        updated_at=pref.updated_at,
    )


@router.get("", response_model=NotificationListResponse)
async def list_notifications(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    unread_only: bool = Query(False),
    current_user: UserDB = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get user's notifications."""
    base_filter = NotificationDB.user_id == current_user.id
    
    query = select(NotificationDB).where(base_filter)
    count_query = select(func.count(NotificationDB.id)).where(base_filter)
    unread_query = select(func.count(NotificationDB.id)).where(
        base_filter,
        NotificationDB.is_read == False,
    )
    
    if unread_only:
        query = query.where(NotificationDB.is_read == False)
        count_query = count_query.where(NotificationDB.is_read == False)
    
    query = query.order_by(NotificationDB.created_at.desc()).offset(skip).limit(limit)
    
    result = await db.execute(query)
    notifications = result.scalars().all()
    
    count_result = await db.execute(count_query)
    total = count_result.scalar() or 0
    
    unread_result = await db.execute(unread_query)
    unread_count = unread_result.scalar() or 0
    
    return NotificationListResponse(
        count=total,
        unread_count=unread_count,
        results=[_notification_to_response(n) for n in notifications],
    )


@router.post("/mark-read")
async def mark_notifications_read(
    request: MarkNotificationsReadRequest,
    current_user: UserDB = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Mark notifications as read."""
    now = datetime.now(timezone.utc)
    
    if request.mark_all:
        await db.execute(
            update(NotificationDB)
            .where(
                NotificationDB.user_id == current_user.id,
                NotificationDB.is_read == False,
            )
            .values(is_read=True, read_at=now)
        )
        logger.info(f"Marked all notifications as read for user {current_user.id}")
    elif request.notification_ids:
        await db.execute(
            update(NotificationDB)
            .where(
                NotificationDB.user_id == current_user.id,
                NotificationDB.id.in_(request.notification_ids),
                NotificationDB.is_read == False,
            )
            .values(is_read=True, read_at=now)
        )
        logger.info(
            f"Marked {len(request.notification_ids)} notifications as read "
            f"for user {current_user.id}"
        )
    
    await db.commit()
    return {"message": "Notifications marked as read"}


@router.get("/unread-count")
async def get_unread_count(
    current_user: UserDB = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get count of unread notifications."""
    result = await db.execute(
        select(func.count(NotificationDB.id)).where(
            NotificationDB.user_id == current_user.id,
            NotificationDB.is_read == False,
        )
    )
    count = result.scalar() or 0
    return {"unread_count": count}


@router.delete("/{notification_id}", status_code=204)
async def delete_notification(
    notification_id: str,
    current_user: UserDB = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a notification."""
    result = await db.execute(
        select(NotificationDB).where(
            NotificationDB.id == notification_id,
            NotificationDB.user_id == current_user.id,
        )
    )
    notification = result.scalar_one_or_none()
    
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    await db.delete(notification)
    await db.commit()
    
    logger.info(f"Deleted notification {notification_id} for user {current_user.id}")
    return None


@router.delete("", status_code=204)
async def clear_all_notifications(
    current_user: UserDB = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Clear all notifications for the current user."""
    await db.execute(
        delete(NotificationDB).where(NotificationDB.user_id == current_user.id)
    )
    await db.commit()
    
    logger.info(f"Cleared all notifications for user {current_user.id}")
    return None
