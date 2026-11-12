from urllib.parse import parse_qs
from channels.db import database_sync_to_async
from channels.middleware import BaseMiddleware


@database_sync_to_async
def _get_user_from_token(token: str):
    from django.contrib.auth.models import AnonymousUser
    from apps.users.jwt_utils import decode_access_token
    from apps.users.models import CustomUser

    payload = decode_access_token(token)
    if payload is None:
        return AnonymousUser()
    try:
        user = CustomUser.objects.get(pk=payload['sub'])
    except CustomUser.DoesNotExist:
        return AnonymousUser()
    if not user.is_active or user.is_banned:
        return AnonymousUser()
    return user


class JwtAuthMiddleware(BaseMiddleware):
    def __init__(self, inner):
        self.inner = inner

    async def __call__(self, scope, receive, send):
        from django.contrib.auth.models import AnonymousUser

        if scope['type'] == 'websocket':
            query = parse_qs(scope.get('query_string', b'').decode())
            token = query.get('token', [None])[0]
            if token:
                scope['user'] = await _get_user_from_token(token)
            else:
                scope['user'] = AnonymousUser()
        return await super().__call__(scope, receive, send)
