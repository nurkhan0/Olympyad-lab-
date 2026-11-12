from django.contrib.auth import get_user_model
from rest_framework.authentication import BaseAuthentication

from .jwt_utils import decode_access_token

User = get_user_model()


class BearerTokenAuthentication(BaseAuthentication):
    keyword = 'Bearer'

    def authenticate_header(self, request):
        return self.keyword

    def authenticate(self, request):
        """Authenticate via Bearer access token.

        An invalid, expired, or malformed token is treated as anonymous
        (returns None) rather than raising. DRF still runs authentication on
        AllowAny views (e.g. /auth/refresh/), so raising here would 401 the
        refresh request itself whenever it carries a stale Authorization
        header. Anonymous handling keeps credential validation where it
        belongs: on permission classes of protected views.
        """
        auth_header = request.headers.get('Authorization', '')
        if not auth_header.startswith(f'{self.keyword} '):
            return None

        token = auth_header[len(self.keyword) + 1:].strip()
        if not token:
            return None

        payload = decode_access_token(token)
        if payload is None:
            return None

        try:
            user = User.objects.get(pk=payload['sub'])
        except User.DoesNotExist:
            return None

        if not user.is_active or user.is_banned:
            return None

        return user, token
