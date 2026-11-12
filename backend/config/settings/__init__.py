import os

environment = os.environ.get('DJANGO_SETTINGS_MODULE', 'config.settings.production')
if environment.endswith('development'):
    from .development import *  # noqa: F401, F403
else:
    from .production import *  # noqa: F401, F403
