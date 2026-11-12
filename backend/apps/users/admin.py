from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import CustomUser, EmailVerifyToken, RefreshToken


@admin.register(CustomUser)
class CustomUserAdmin(BaseUserAdmin):
    ordering = ('email',)
    list_display = ('email', 'handle', 'role', 'rating', 'is_verified', 'is_banned', 'is_staff')
    list_filter = ('role', 'is_verified', 'is_banned', 'is_staff', 'is_active')
    search_fields = ('email', 'handle')
    fieldsets = (
        (None, {'fields': ('email', 'password')}),
        ('Profile', {'fields': ('handle', 'role', 'rating')}),
        ('Status', {'fields': ('is_active', 'is_verified', 'is_banned', 'is_staff', 'is_superuser')}),
        ('Permissions', {'fields': ('groups', 'user_permissions')}),
        ('Dates', {'fields': ('last_login', 'created_at')}),
    )
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('email', 'handle', 'password1', 'password2', 'role'),
        }),
    )
    readonly_fields = ('created_at',)


@admin.register(RefreshToken)
class RefreshTokenAdmin(admin.ModelAdmin):
    list_display = ('user', 'jti', 'expires_at', 'is_revoked', 'created_at')
    list_filter = ('is_revoked',)
    search_fields = ('user__email', 'jti')
    readonly_fields = ('created_at',)


@admin.register(EmailVerifyToken)
class EmailVerifyTokenAdmin(admin.ModelAdmin):
    list_display = ('user', 'token', 'expires_at')
    search_fields = ('user__email', 'token')
    readonly_fields = ('token',)
