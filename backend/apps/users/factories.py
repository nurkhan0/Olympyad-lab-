import factory
from django.contrib.auth import get_user_model

User = get_user_model()


class UserFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = User

    email = factory.Sequence(lambda n: f"user{n}@example.com")
    handle = factory.Sequence(lambda n: f"user{n}")
    password = factory.PostGenerationMethodCall("set_password", "password123")
    role = "student"
    is_active = True
    is_staff = False
    is_superuser = False
    is_verified = False
    is_banned = False
    rating = 1000

    @classmethod
    def _create(cls, model_class, *args, **kwargs):
        # CustomUserManager.create_user requires email, handle, password
        password = kwargs.pop("password", "password123")
        manager = model_class.objects
        user = manager.create_user(*args, password=password, **kwargs)
        return user


class AdminUserFactory(UserFactory):
    role = "admin"
    is_staff = True
    is_superuser = True
    is_verified = True
    handle = factory.Sequence(lambda n: f"admin{n}")
