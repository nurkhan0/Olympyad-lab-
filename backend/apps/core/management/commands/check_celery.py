from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = 'Verify Celery workers are online'

    def handle(self, *args, **kwargs):
        from config.celery import app
        self.stdout.write("Pinging workers (5s timeout)...")
        inspect = app.control.inspect(timeout=5.0)
        stats = inspect.stats()
        if not stats:
            self.stdout.write(self.style.WARNING("⚠️  No workers! Run: docker-compose up celery_worker -d"))
            return
        for worker, info in stats.items():
            procs = len(info.get('pool', {}).get('processes', []))
            self.stdout.write(f"✅ Worker online: {worker} ({procs} processes)")
        active = inspect.active_queues() or {}
        all_q = {q['name'] for qs in active.values() for q in qs}
        self.stdout.write(f"✅ Queues: {', '.join(sorted(all_q))}")
        self.stdout.write(self.style.SUCCESS("Celery OK!"))
