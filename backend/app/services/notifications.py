import os
from datetime import datetime, timezone

import httpx
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.logging_config import get_logger
from app.models.db_models import (
    DeviceTokenDB,
    NotificationDB,
    NotificationPreferenceDB,
    UserDB,
)
from app.schemas.notification import NotificationType, ReferenceType

logger = get_logger(__name__)

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"


class NotificationService:
    def __init__(self):
        self.expo_push_url = EXPO_PUSH_URL
    
    async def send_expo_push(
        self,
        tokens: list[str],
        title: str,
        body: str,
        data: dict | None = None,
    ) -> dict:
        """Send push notifications via Expo Push API."""
        if not tokens:
            return {"success": 0, "failed": 0}
        
        messages = []
        for token in tokens:
            message = {
                "to": token,
                "sound": "default",
                "title": title,
                "body": body,
                "data": data or {},
            }
            messages.append(message)
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    self.expo_push_url,
                    json=messages,
                    headers={
                        "Accept": "application/json",
                        "Content-Type": "application/json",
                    },
                    timeout=30.0,
                )
                
                if response.status_code == 200:
                    result = response.json()
                    success_count = sum(
                        1 for ticket in result.get("data", [])
                        if ticket.get("status") == "ok"
                    )
                    logger.info(f"Push sent: {success_count}/{len(tokens)} successful")
                    return {"success": success_count, "failed": len(tokens) - success_count}
                else:
                    logger.error(f"Expo push failed: {response.status_code} - {response.text}")
                    return {"success": 0, "failed": len(tokens)}
        except Exception as e:
            logger.error(f"Error sending push notification: {e}")
            return {"success": 0, "failed": len(tokens)}
    
    async def get_user_tokens(
        self,
        db: AsyncSession,
        user_ids: list[str],
    ) -> list[str]:
        """Get active device tokens for given users."""
        result = await db.execute(
            select(DeviceTokenDB.token).where(
                DeviceTokenDB.user_id.in_(user_ids),
                DeviceTokenDB.is_active == True,
            )
        )
        return [row[0] for row in result.fetchall()]
    
    async def check_user_preference(
        self,
        db: AsyncSession,
        user_id: str,
        notification_type: NotificationType,
    ) -> bool:
        """Check if user wants to receive this type of notification."""
        result = await db.execute(
            select(NotificationPreferenceDB).where(
                NotificationPreferenceDB.user_id == user_id
            )
        )
        pref = result.scalar_one_or_none()
        
        if not pref:
            return True
        
        preference_map = {
            NotificationType.GAME_REMINDER: pref.game_reminders,
            NotificationType.GAME_PLAYER_JOINED: pref.game_player_joined,
            NotificationType.GAME_PLAYER_LEFT: pref.game_player_left,
            NotificationType.GAME_CANCELLED: pref.game_cancelled,
            NotificationType.GAME_UPDATED: pref.game_updated,
            NotificationType.GAME_FULL: pref.game_player_joined,
            NotificationType.TEAM_INVITATION: pref.team_invitations,
            NotificationType.TEAM_MEMBER_JOINED: pref.team_member_joined,
            NotificationType.TEAM_MEMBER_LEFT: pref.team_member_left,
            NotificationType.TOURNAMENT_REGISTRATION_OPEN: pref.tournament_updates,
            NotificationType.TOURNAMENT_BRACKET_GENERATED: pref.tournament_updates,
            NotificationType.TOURNAMENT_MATCH_REMINDER: pref.tournament_match_reminders,
            NotificationType.TOURNAMENT_MATCH_RESULT: pref.tournament_results,
            NotificationType.TOURNAMENT_COMPLETED: pref.tournament_results,
        }
        
        return preference_map.get(notification_type, True)
    
    async def create_notification(
        self,
        db: AsyncSession,
        user_id: str,
        title: str,
        body: str,
        notification_type: NotificationType,
        reference_type: ReferenceType | None = None,
        reference_id: str | None = None,
        data: dict | None = None,
        send_push: bool = True,
    ) -> NotificationDB | None:
        """Create a notification record and optionally send push."""
        # Guard against null user_id
        if not user_id:
            logger.warning(f"Attempted to create notification with null user_id: {title}")
            return None
        
        notification = NotificationDB(
            user_id=user_id,
            title=title,
            body=body,
            notification_type=notification_type.value,
            reference_type=reference_type.value if reference_type else None,
            reference_id=reference_id,
            data=data,
            is_pushed=False,
        )
        db.add(notification)
        await db.flush()
        
        if send_push:
            wants_notification = await self.check_user_preference(
                db, user_id, notification_type
            )
            if wants_notification:
                tokens = await self.get_user_tokens(db, [user_id])
                if tokens:
                    push_data = {
                        "notification_id": notification.id,
                        "type": notification_type.value,
                        "reference_type": reference_type.value if reference_type else None,
                        "reference_id": reference_id,
                        **(data or {}),
                    }
                    result = await self.send_expo_push(tokens, title, body, push_data)
                    if result["success"] > 0:
                        notification.is_pushed = True
        
        return notification
    
    async def notify_users(
        self,
        db: AsyncSession,
        user_ids: list[str],
        title: str,
        body: str,
        notification_type: NotificationType,
        reference_type: ReferenceType | None = None,
        reference_id: str | None = None,
        data: dict | None = None,
        exclude_user_id: str | None = None,
    ) -> list[NotificationDB]:
        """Send notifications to multiple users."""
        # Filter out None/null user IDs and excluded user
        user_ids = [uid for uid in user_ids if uid is not None]
        if exclude_user_id:
            user_ids = [uid for uid in user_ids if uid != exclude_user_id]
        
        if not user_ids:
            return []
        
        notifications = []
        tokens_to_push = []
        
        for user_id in user_ids:
            notification = NotificationDB(
                user_id=user_id,
                title=title,
                body=body,
                notification_type=notification_type.value,
                reference_type=reference_type.value if reference_type else None,
                reference_id=reference_id,
                data=data,
                is_pushed=False,
            )
            db.add(notification)
            notifications.append(notification)
            
            wants_notification = await self.check_user_preference(
                db, user_id, notification_type
            )
            if wants_notification:
                user_tokens = await self.get_user_tokens(db, [user_id])
                tokens_to_push.extend(user_tokens)
        
        await db.flush()
        
        if tokens_to_push:
            push_data = {
                "type": notification_type.value,
                "reference_type": reference_type.value if reference_type else None,
                "reference_id": reference_id,
                **(data or {}),
            }
            result = await self.send_expo_push(tokens_to_push, title, body, push_data)
            if result["success"] > 0:
                for notification in notifications:
                    notification.is_pushed = True
        
        logger.info(
            f"Created {len(notifications)} notifications of type {notification_type.value}"
        )
        return notifications
    
    async def get_game_participants(
        self,
        db: AsyncSession,
        game_id: str,
    ) -> list[str]:
        """Get all participant user IDs for a game."""
        from app.models.db_models import game_participants
        
        result = await db.execute(
            select(game_participants.c.user_id).where(
                game_participants.c.game_id == game_id
            )
        )
        return [row[0] for row in result.fetchall()]
    
    async def get_team_members(
        self,
        db: AsyncSession,
        team_id: str,
    ) -> list[str]:
        """Get all member user IDs for a team."""
        from app.models.db_models import team_members
        
        result = await db.execute(
            select(team_members.c.user_id).where(
                team_members.c.team_id == team_id
            )
        )
        return [row[0] for row in result.fetchall()]


notification_service = NotificationService()
