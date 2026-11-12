import json

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer


class SubmissionConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.submission_id = self.scope['url_route']['kwargs']['submission_id']
        self.group_name = f'submission_{self.submission_id}'

        user = self.scope['user']
        if not user.is_authenticated:
            await self.close()
            return

        if not await self.can_view(user, self.submission_id):
            await self.close()
            return

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

        status_payload = await self.get_status(self.submission_id)
        await self.send(text_data=json.dumps(status_payload))

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def submission_update(self, event):
        await self.send(text_data=json.dumps(event['data']))

    @database_sync_to_async
    def can_view(self, user, submission_id):
        from apps.submissions.models import Submission

        try:
            sub = Submission.objects.get(id=submission_id)
        except Submission.DoesNotExist:
            return False
        return sub.user_id == user.id or user.is_staff

    @database_sync_to_async
    def get_status(self, submission_id):
        from apps.submissions.models import Submission

        sub = Submission.objects.get(id=submission_id)
        return {
            'type': 'status_update',
            'submission_id': sub.id,
            'status': sub.status,
            'verdict': sub.verdict,
            'time_ms': sub.time_ms,
            'memory_kb': sub.memory_kb,
        }
