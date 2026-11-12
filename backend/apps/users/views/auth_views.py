from typing import Optional

import uuid
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.users.jwt_utils import (
    decode_refresh_token,
    generate_access_token,
    generate_refresh_token,
)
from apps.users.models import RefreshToken
from apps.users.serializers import COOKIE_SETTINGS, LoginSerializer, RegisterSerializer


def get_client_ip(request) -> Optional[str]:
    forwarded = request.META.get('HTTP_X_FORWARDED_FOR')
    if forwarded:
        return forwarded.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR')


class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(
            {'message': 'Registration successful'},
            status=status.HTTP_201_CREATED,
        )


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data['user']

        access_token = generate_access_token(user)
        rt_str, jti, expires_at = generate_refresh_token(user)
        RefreshToken.objects.create(
            user=user,
            token=rt_str,
            jti=jti,
            expires_at=expires_at,
            ip_address=get_client_ip(request),
        )

        # The refresh token is delivered exclusively via the HttpOnly cookie;
        # it is intentionally NOT returned in the response body so there is a
        # single transport and no duplicated source of truth.
        response = Response({
            'access_token': access_token,
            'user': {
                'id': str(user.id),
                'email': user.email,
                'handle': user.handle,
                'role': user.role,
            },
        })
        response.set_cookie('refresh_token', rt_str, **COOKIE_SETTINGS)
        return response


class RefreshView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        # Try to get refresh token from header first (for localStorage-based auth), then from cookie
        rt = request.headers.get('X-Refresh-Token') or request.COOKIES.get('refresh_token')
        if not rt:
            return Response({'detail': 'Refresh token missing.'}, status=status.HTTP_401_UNAUTHORIZED)

        payload = decode_refresh_token(rt)
        if payload is None:
            return Response({'detail': 'Invalid refresh token.'}, status=status.HTTP_401_UNAUTHORIZED)

        try:
            db_token = RefreshToken.objects.select_related('user').get(
                jti=uuid.UUID(payload['jti']),
                is_revoked=False,
            )
        except RefreshToken.DoesNotExist:
            return Response({'detail': 'Refresh token not found.'}, status=status.HTTP_401_UNAUTHORIZED)

        if db_token.expires_at < timezone.now():
            return Response({'detail': 'Refresh token expired.'}, status=status.HTTP_401_UNAUTHORIZED)

        db_token.is_revoked = True
        db_token.save(update_fields=['is_revoked'])

        user = db_token.user
        new_access = generate_access_token(user)
        new_rt, new_jti, new_exp = generate_refresh_token(user)
        RefreshToken.objects.create(
            user=user,
            token=new_rt,
            jti=new_jti,
            expires_at=new_exp,
            ip_address=get_client_ip(request),
        )

        response = Response({'access_token': new_access})
        response.set_cookie('refresh_token', new_rt, **COOKIE_SETTINGS)
        return response


class LogoutView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        rt = request.COOKIES.get('refresh_token')
        if rt:
            payload = decode_refresh_token(rt)
            if payload is not None:
                RefreshToken.objects.filter(
                    jti=uuid.UUID(payload['jti']),
                    is_revoked=False,
                ).update(is_revoked=True)

        response = Response({'message': 'Logged out'})
        # Clear cookie with matching attributes
        clear_settings = COOKIE_SETTINGS.copy()
        clear_settings['max_age'] = 0
        clear_settings['expires'] = 'Thu, 01 Jan 1970 00:00:00 GMT'
        response.set_cookie('refresh_token', '', **clear_settings)
        return response
