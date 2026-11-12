import factory
from django.contrib.auth import get_user_model

User = get_user_model()


class SubmissionFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = "submissions.Submission"

    user = factory.SubFactory("apps.users.factories.UserFactory")
    problem = factory.SubFactory("apps.problems.factories.ProblemFactory")
    code = 'print(1 + 1)'
    language = "python"
    status = "done"
    verdict = "AC"
    time_ms = 50
    memory_kb = 1024


class FailedSubmissionFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = "submissions.FailedSubmission"

    submission = factory.SubFactory("apps.submissions.factories.SubmissionFactory")
    error_message = "Something went wrong"
    retry_count = 0
