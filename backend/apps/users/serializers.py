import re
from django.conf import settings
from django.contrib.auth.hashers import make_password, check_password
from rest_framework import serializers
from .models import CustomUser

HANDLE_REGEX = re.compile(r'^[a-zA-Z0-9_]{3,20}$')

# Cookie security: Secure flag should be True only for HTTPS environments.
# In production (DEBUG=False, HTTPS), Secure=True.
# In development/test with HTTP (DEBUG=True or explicit override), Secure=False.
COOKIE_SECURE = getattr(settings, 'COOKIE_SECURE', not settings.DEBUG)

# The refresh cookie is scoped to the auth subtree only (/auth/refresh/,
# /auth/logout/) so it is never transmitted with unrelated API requests
# (education, problems, submissions, ...).
REFRESH_COOKIE_PATH = '/api/v1/auth/'

COOKIE_SETTINGS = {
    'httponly': True,
    'secure': COOKIE_SECURE,
    'samesite': 'Lax',
    'max_age': 7 * 24 * 3600,
    'path': REFRESH_COOKIE_PATH,
}

class RegisterSerializer(serializers.Serializer):
    email = serializers.EmailField()
    handle = serializers.CharField(max_length=30)
    password = serializers.CharField(write_only=True, min_length=8)
    password_confirm = serializers.CharField(write_only=True)

    def validate_email(self, value):
        if CustomUser.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError('A user with this email already exists.')
        return value.lower()

    def validate_handle(self, value):
        if not HANDLE_REGEX.match(value):
            raise serializers.ValidationError(
                'Handle must be 3–20 characters: letters, digits, or underscores.',
            )
        if CustomUser.objects.filter(handle__iexact=value).exists():
            raise serializers.ValidationError('This handle is already taken.')
        return value

    def validate(self, attrs):
        if attrs['password'] != attrs['password_confirm']:
            raise serializers.ValidationError({'password_confirm': 'Passwords do not match.'})
        return attrs

    def create(self, validated_data):
        validated_data.pop('password_confirm')
        password = validated_data.pop('password')
        user = CustomUser(**validated_data)
        user.password = make_password(password)
        user.save()
        return user

class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        email = attrs['email'].lower()
        password = attrs['password']
        try:
            user = CustomUser.objects.get(email__iexact=email)
        except CustomUser.DoesNotExist:
            raise serializers.ValidationError('Invalid email or password.')
        if not check_password(password, user.password):
            raise serializers.ValidationError('Invalid email or password.')
        if not user.is_active:
            raise serializers.ValidationError('This account is inactive.')
        if user.is_banned:
            raise serializers.ValidationError('This account has been banned.')
        attrs['user'] = user
        return attrs

class PublicProfileSerializer(serializers.ModelSerializer):
    solved_count = serializers.SerializerMethodField()

    class Meta:
        model = CustomUser
        fields = ['handle', 'rating', 'role', 'is_verified', 'created_at', 'solved_count']

    def get_solved_count(self, obj):
        return 0

class MeSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomUser
        fields = ['id', 'email', 'handle', 'role', 'rating',
                  'is_verified', 'is_banned', 'avatar_url', 'created_at']

class MeUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomUser
        fields = ['avatar_url']
