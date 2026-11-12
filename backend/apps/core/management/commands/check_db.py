from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = 'Verify DB + Redis + all tables'

    def handle(self, *args, **kwargs):
        from django.db import connection
        connection.ensure_connection()
        cursor = connection.cursor()
        cursor.execute("SELECT version();")
        self.stdout.write(f"✅ PostgreSQL: {cursor.fetchone()[0][:60]}")
        from django.core.cache import cache
        cache.set('_chk', 'ok', 5)
        assert cache.get('_chk') == 'ok'
        self.stdout.write("✅ Redis: connected")
        for app, model in [
            ('apps.users', 'CustomUser'),
            ('apps.problems', 'Problem'),
            ('apps.submissions', 'Submission'),
            ('apps.contests', 'Contest'),
        ]:
            import importlib
            mod = importlib.import_module(f'{app}.models')
            cls = getattr(mod, model)
            self.stdout.write(f"✅ {model}: {cls.objects.count()} rows")
        self.stdout.write(self.style.SUCCESS("All checks passed!"))
