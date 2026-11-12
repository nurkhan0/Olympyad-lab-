import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0003_customuser_avatar_url"),
    ]

    operations = [
        migrations.AddField(
            model_name="customuser",
            name="school",
            field=models.CharField(blank=True, default="", max_length=200),
        ),
        migrations.AddField(
            model_name="customuser",
            name="class_name",
            field=models.CharField(blank=True, default="", max_length=100),
        ),
    ]
