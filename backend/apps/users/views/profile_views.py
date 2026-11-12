from rest_framework.exceptions import NotFound
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.users.models import CustomUser
from apps.users.serializers import MeSerializer, MeUpdateSerializer, PublicProfileSerializer


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(MeSerializer(request.user).data)

    def patch(self, request):
        serializer = MeUpdateSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(MeSerializer(request.user).data)


class ProfileView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, handle):
        try:
            user = CustomUser.objects.get(handle__iexact=handle)
        except CustomUser.DoesNotExist:
            raise NotFound

        if user.is_banned:
            raise NotFound

        return Response(PublicProfileSerializer(user).data)
