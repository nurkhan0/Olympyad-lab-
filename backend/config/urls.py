from django.contrib import admin
from django.urls import include, path
from django.conf import settings
from django.conf.urls.static import static

from apps.core import views as core_views

urlpatterns = [
    path('admin/', admin.site.urls),
    path('health/', core_views.health),
    path('api/v1/stats/platform/', core_views.platform_stats),
    path('api/v1/', include('apps.users.urls')),
    path('api/v1/', include('apps.problems.urls.admin_urls')),
    path('api/v1/', include('apps.problems.urls.public_urls')),
    path('api/v1/', include('apps.submissions.urls')),
    path('api/v1/education/', include('apps.education.urls')),
    path('api/v1/ratings/', include('apps.ratings.urls')),
    path('api/v1/contests/', include('apps.contests.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    # django-debug-toolbar renders its toolbar on HTML responses; without this
    # include its templates raise KeyError 'djdt' and 500 every HTML page.
    try:
        import debug_toolbar  # noqa: F401

        urlpatterns = [path('__debug__/', include('debug_toolbar.urls'))] + urlpatterns
    except ImportError:
        pass