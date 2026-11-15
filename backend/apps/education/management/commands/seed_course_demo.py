"""Fill the demo Python course with lessons, text materials and tasks.

The course exists on the platform but its modules are empty shells: a teacher
created eight modules and never had time to write the lessons. This command
fills two of them — «PYTHON старт» and «Логика және шарттар» — with the kind of
content a teacher would write by hand:

* a lesson with Markdown text (rendered to ``content_html`` on save),
* a text material and a code sample attached to it,
* a public problem attached as practice, with its own tests.

Everything is idempotent and matches on stable keys (lesson title inside a
module, material title inside a lesson, problem slug), so a redeploy refreshes
the demo without duplicating anything and without overwriting a lesson a
teacher has since edited — an existing lesson keeps its own text.

Usage::

    python manage.py seed_course_demo
    python manage.py seed_course_demo --dry-run
    python manage.py seed_course_demo --course "PYTHON бағдарламалау тілі"
"""

import os
import random

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from apps.education.models import Course, Lesson, Material, ProblemCourseLink
from apps.problems.models import Problem, TestCase
from apps.users.models import CustomUser

COURSE_TITLE = "PYTHON бағдарламалау тілі"

TEACHER_EMAIL = "gulmira_ais@olympiad.local"
TEACHER_HANDLE = "gulmira_ais"

# ---------------------------------------------------------------- demo problems

PROBLEMS = [
    {
        "slug": "py-start-sum",
        "title": "Екі санның қосындысы",
        "difficulty": "easy",
        "statement": (
            "Кірісте бір жолда екі бүтін сан берілген: `a` және `b`.\n\n"
            "Шығыста олардың қосындысын бір жолда шығарыңыз.\n\n"
            "**Кіріс:** `1 ≤ a, b ≤ 10^9`\n\n"
            "**Шығыс:** `a + b`\n\n"
            "| Кіріс | Шығыс |\n"
            "|---|---|\n"
            "| `2 3` | `5` |\n"
            "| `10 20` | `30` |\n"
        ),
        "reference": "a, b = map(int, input().split())\nprint(a + b)\n",
        "samples": [("2 3\n", "5\n"), ("10 20\n", "30\n")],
        "random_cases": 6,
        "generator": "a, b = rnd.randint(1, 10**9), rnd.randint(1, 10**9)\n"
                     "payload = f'{a} {b}'\n"
                     "expected = str(a + b)",
    },
    {
        "slug": "py-logic-max",
        "title": "Үш санның ең үлкені",
        "difficulty": "easy",
        "statement": (
            "Үш бүтін сан берілген: `a`, `b`, `c`.\n\n"
            "Олардың ішіндегі ең үлкенін шығарыңыз.\n\n"
            "**Кіріс:** үш сан бір жолда, `1 ≤ a, b, c ≤ 10^9`\n\n"
            "**Шығыс:** ең үлкен сан\n\n"
            "| Кіріс | Шығыс |\n"
            "|---|---|\n"
            "| `3 7 5` | `7` |\n"
            "| `-1 -5 -3` | `-1` |\n"
        ),
        "reference": "a, b, c = map(int, input().split())\nprint(max(a, b, c))\n",
        "samples": [("3 7 5\n", "7\n"), ("-1 -5 -3\n", "-1\n")],
        "random_cases": 6,
        "generator": "a, b, c = (rnd.randint(-10**9, 10**9) for _ in range(3))\n"
                     "payload = f'{a} {b} {c}'\n"
                     "expected = str(max(a, b, c))",
    },
    {
        "slug": "py-logic-even",
        "title": "Жұп сан",
        "difficulty": "easy",
        "statement": (
            "Бүтін сан `n` берілген. Егер ол жұп болса `YES`, әйтпесе `NO` шығарыңыз.\n\n"
            "**Кіріс:** `1 ≤ n ≤ 10^9`\n\n"
            "| Кіріс | Шығыс |\n"
            "|---|---|\n"
            "| `4` | `YES` |\n"
            "| `7` | `NO` |\n"
        ),
        "reference": "n = int(input())\nprint('YES' if n % 2 == 0 else 'NO')\n",
        "samples": [("4\n", "YES\n"), ("7\n", "NO\n")],
        "random_cases": 6,
        "generator": "n = rnd.randint(1, 10**9)\n"
                     "payload = str(n)\n"
                     "expected = 'YES' if n % 2 == 0 else 'NO'",
    },
]

# ---------------------------------------------------------------- demo lessons

MODULE_LESSONS = {
    "PYTHON старт": [
        {
            "title": "Python-мен танысу",
            "estimated_minutes": 15,
            "content": (
                "# Python-мен танысу\n\n"
                "Python — оқуға және жазуға ыңғайлы жоғары деңгейлі тіл. "
                "Ол олимпиада есептерін шығаруда да, деректерді өңдеуде де қолданылады.\n\n"
                "## Неге Python?\n\n"
                "- **Синтаксис қарапайым** — басқа тілдердегі ондаған жол осы тілде 3–4 жол.\n"
                "- **Тез жазылады** — ойды бірден кодқа айналдыруға болады.\n"
                "- **Кітапханалар көп** — есеп шығаруға дайын құралдар бар.\n\n"
                "## Бірінші бағдарлама\n\n"
                "```python\n"
                "print('Сәлем, әлем!')\n"
                "```\n\n"
                "`print()` — экранға мәтін шығару командасы. "
                "Қос тырқакшаға жазылған жол (*string*) сол күйінде басылады.\n\n"
                "## Олимпиадада қалай жұмыс істейміз?\n\n"
                "1. Есепті оқып, шешімді ойлап табамыз.\n"
                "2. Кодты жазып, тесттерге жібереміз.\n"
                "3. Жанармай (вердикт) `Accepted` болса — есеп шешілді.\n\n"
                "> Кеңес: кодты бірден жазбай, алдымен қаламмен 2–3 мысалды "
                "қолмен шығарып көріңіз.\n"
            ),
            "materials": [
                ("Не үйренеміз", "text",
                 "Осы тарауда біз Python тілінің тарихымен, қолданылуымен және "
                 "таныстырамыз. Соңында бірінші бағдарламаны жазып, оны "
                 "тесттерге жібереміз.\n\n"
                 "Басты мақсат — «код деген не, ол қалай жұмыс істейді» деген "
                 "сұраққа жауап беру."),
                ("first.py", "code", "print('Сәлем, әлем!')\n"),
            ],
            "problems": [],
        },
        {
            "title": "Енгізу және шығару",
            "estimated_minutes": 20,
            "content": (
                "# Енгізу және шығару\n\n"
                "Кез келген есеп екі бөліктен тұрады: **кіріс** (бізге берілген "
                "деректер) және **шығыс** (біздің жауабымыз).\n\n"
                "## Шығару — `print()`\n\n"
                "```python\n"
                "print(5)\n"
                "print('Қосынды:', 7)\n"
                "```\n\n"
                "## Енгізу — `input()`\n\n"
                "`input()` — пернетақтадан (клавиатурадан) жол оқып береді. "
                "Сан керек болса, оны `int()` арқылы бүтін санға айналдырамыз.\n\n"
                "```python\n"
                "a = int(input())\n"
                "b = int(input())\n"
                "print(a + b)\n"
                "```\n\n"
                "## Бір жолда екі сан\n\n"
                "Көп есепте сандар бір жолда бос орын арқылы беріледі. "
                "Мұндайда `split()` көмектеседі:\n\n"
                "```python\n"
                "a, b = map(int, input().split())\n"
                "print(a + b)\n"
                "```\n\n"
                "`split()` жолды бөліктерге бөледі, `map(int, ...)` "
                "әрбір бөлікті санға айналдырады.\n\n"
                "## f-жолдар\n\n"
                "```python\n"
                "name = input()\n"
                "print(f'Сәлем, {name}!')\n"
                "```\n"
            ),
            "materials": [
                ("input() қалай жұмыс істейді", "text",
                 "`input()` әрқашан **жол** (string) қайтарады. "
                 "Сондықтан `input() + input()` екі жолды біріктіреді, "
                 "ал `int(input()) + int(input())` екі санды қосады.\n\n"
                 "Бұл — жаңа келгендер жиі жіберіп алатын қате."),
                ("sum_two.py", "code",
                 "a, b = map(int, input().split())\nprint(a + b)\n"),
            ],
            "problems": ["py-start-sum"],
        },
    ],
    "Логика және шарттар": [
        {
            "title": "Шартты оператор if",
            "estimated_minutes": 25,
            "content": (
                "# Шартты оператор if\n\n"
                "Бағдарлама әрқашан бір жолмен жүрмейді: шартқа қарай "
                "әр түрлі жолды таңдайды. Мұны `if` операторы жасайды.\n\n"
                "## Синтаксис\n\n"
                "```python\n"
                "if шарт:\n"
                "    # шарт шын болса, осында кіреміз\n"
                "    ...\n"
                "else:\n"
                "    # шарт жалған болса\n"
                "    ...\n"
                "```\n\n"
                "Екі нәрсені есте сақтаңыз:\n\n"
                "1. `if` және `else` сөздерінің соңында **қос нүкте** `:` тұрады.\n"
                "2. Ішіндегі жолдар **бос орынмен** (4 бос орын) шегінген болуы керек.\n\n"
                "## Мысал\n\n"
                "```python\n"
                "n = int(input())\n"
                "if n > 0:\n"
                "    print('Оң сан')\n"
                "else:\n"
                "    print('Оң емес')\n"
                "```\n\n"
                "## Салыстыру амалдары\n\n"
                "| Амал | Мағынасы |\n"
                "|---|---|\n"
                "| `>` | үлкен |\n"
                "| `<` | кіші |\n"
                "| `>=` | үлкен немесе тең |\n"
                "| `<=` | кіші немесе тең |\n"
                "| `==` | тең |\n"
                "| `!=` | тең емес |\n\n"
                "> Ескерту: теңдікті тексеру үшін `==` жазылады, "
                "`=` емес. `=` — мән беру амалдары.\n\n"
                "## if — elif — else\n\n"
                "```python\n"
                "score = int(input())\n"
                "if score >= 90:\n"
                "    print('Өте жақсы')\n"
                "elif score >= 60:\n"
                "    print('Жақсы')\n"
                "else:\n"
                "    print('Қайта тырысу керек')\n"
                "```\n"
            ),
            "materials": [
                ("Шеттерін қараңыз", "text",
                 "Шарт «шын» (True) немесе «жалған» (False) болады. "
                 "Python-да 0 — жалған, басқа кез келген сан — шын.\n\n"
                 "Сондықтан `if n:` жазу `if n != 0:` дегенмен бірдей."),
                ("grade.py", "code",
                 "score = int(input())\n"
                 "if score >= 90:\n"
                 "    print('Өте жақсы')\n"
                 "elif score >= 60:\n"
                 "    print('Жақсы')\n"
                 "else:\n"
                 "    print('Қайта тырысу керек')\n"),
            ],
            "problems": ["py-logic-max"],
        },
        {
            "title": "Логикалық өрнектер",
            "estimated_minutes": 20,
            "content": (
                "# Логикалық өрнектер\n\n"
                "Күрделі шарттарды бірнеше қарапайым шартты біріктіріп жазуға болады.\n\n"
                "## Үш логикалық амал\n\n"
                "| Амал | Мағынасы | Мысал |\n"
                "|---|---|---|\n"
                "| `and` | екеуі де шын | `x > 0 and x < 10` |\n"
                "| `or` | кемінде біреуі шын | `n == 0 or n == 1` |\n"
                "| `not` | керісінше | `not is_logged_in` |\n\n"
                "## Шындық кестесі\n\n"
                "| A | B | A and B | A or B |\n"
                "|---|---|---|---|\n"
                "| True | True | True | True |\n"
                "| True | False | False | True |\n"
                "| False | True | False | True |\n"
                "| False | False | False | False |\n\n"
                "## Мысал: жұп және оң\n\n"
                "```python\n"
                "n = int(input())\n"
                "if n > 0 and n % 2 == 0:\n"
                "    print('Жұп және оң')\n"
                "```\n\n"
                "`%` — қалдық амалдары: `n % 2` нөлге тең болса, "
                "`n` жұп сан.\n\n"
                "## Қысқаша жазу\n\n"
                "```python\n"
                "print('YES' if n % 2 == 0 else 'NO')\n"
                "```\n\n"
                "Мұндай жазу бір жолдық шарт деп аталады және "
                "кішкентай шарттарда ыңғайлы.\n"
            ),
            "materials": [
                ("Қалдық амалы %", "text",
                 "`a % b` — `a` санының `b`-ге бөлінгендегі қалдығы.\n\n"
                 "- `n % 2 == 0` — жұп сан\n"
                 "- `n % 5 == 0` — 5-ке бөлінеді\n"
                 "- `n % 10` — соңғы цифр\n\n"
                 "Бұл бір ғана амал олимпиада есептерінің жартысына жетеді."),
                ("even.py", "code",
                 "n = int(input())\nprint('YES' if n % 2 == 0 else 'NO')\n"),
            ],
            "problems": ["py-logic-even"],
        },
    ],
}


class Command(BaseCommand):
    help = "Fill the demo Python course with lessons, materials and public tasks."

    def add_arguments(self, parser):
        parser.add_argument("--course", default=COURSE_TITLE,
                            help=f"Course title (default: {COURSE_TITLE!r}).")
        parser.add_argument("--dry-run", action="store_true")

    def handle(self, *args, **options):
        course = Course.objects.filter(title=options["course"]).first()
        if course is None:
            raise CommandError(f"No course titled {options['course']!r}.")

        dry_run = options["dry_run"]
        if dry_run:
            self.stdout.write(self.style.WARNING("DRY RUN — nothing will be written."))

        self._ensure_teacher(course, dry_run)
        problems = self._ensure_problems(dry_run)

        for module_title, lessons in MODULE_LESSONS.items():
            module = course.modules.filter(title=module_title).first()
            if module is None:
                self.stderr.write(f"  skip module {module_title!r}: not in this course")
                continue
            self._fill_module(module, lessons, problems, dry_run)

        self.stdout.write(self.style.SUCCESS(
            f"seed_course_demo: course {course.title!r} ready"
        ))

    # ------------------------------------------------------------------ stages

    def _ensure_teacher(self, course, dry_run):
        """Give the course a real teacher, so more than an admin can edit it.

        The demo course was created by the admin account, which then became the
        course's ``teacher``. ``IsCourseContentManager`` only lets a teacher
        manage their *own* course, so without this the account list for course
        editing is effectively one admin. An admin keeps access either way
        (the permission checks the role first), so re-pointing ownership at a
        real teacher takes nothing away.
        """
        if course.teacher_id and course.teacher.role == "teacher":
            self.stdout.write(f"teacher: {course.teacher.email} (unchanged)")
            return

        teacher = CustomUser.objects.filter(role="teacher").first()
        if teacher is None:
            password = os.environ.get("SEED_TEACHER_PASSWORD") or self._make_password()
            teacher = CustomUser.objects.create_user(
                email=TEACHER_EMAIL,
                handle=TEACHER_HANDLE,
                password=password,
                role="teacher",
            )
            self.stdout.write(f"teacher created: {teacher.email} / {password}")
        else:
            self.stdout.write(f"teacher: {teacher.email} (existing account)")

        if not dry_run:
            course.teacher = teacher
            course.save(update_fields=["teacher"])

    def _ensure_problems(self, dry_run):
        """Create the public practice tasks, each with its own tests."""
        result = {}
        for spec in PROBLEMS:
            problem = Problem.objects.filter(slug=spec["slug"]).first()
            if problem is None:
                if dry_run:
                    self.stdout.write(f"  problem {spec['slug']}: would be created")
                    result[spec["slug"]] = None
                    continue
                problem = Problem.objects.create(
                    slug=spec["slug"],
                    title=spec["title"],
                    statement=spec["statement"],
                    difficulty=spec["difficulty"],
                    status="published",
                    visibility="public",
                )
                self.stdout.write(f"  problem {spec['slug']} created")
            else:
                # A problem a teacher already rewrote keeps its statement; we
                # only make sure students can actually open it.
                changed = False
                if problem.status != "published" or problem.visibility != "public":
                    problem.status = "published"
                    problem.visibility = "public"
                    problem.save(update_fields=["status", "visibility"])
                    changed = True
                self.stdout.write(
                    f"  problem {spec['slug']} exists{' (re-published)' if changed else ''}"
                )
            result[spec["slug"]] = problem
            if problem is not None and not problem.test_cases.exists():
                self._write_tests(problem, spec, dry_run)
        return result

    @staticmethod
    def _write_tests(problem, spec, dry_run):
        """Samples first, then generated hidden cases computed by a reference solution."""
        namespace = {"rnd": random.Random(20261116)}
        cases = []
        for index, (payload, expected) in enumerate(spec["samples"], start=1):
            cases.append((f"sample_{index}", payload, expected, True))
        for index in range(1, spec["random_cases"] + 1):
            exec(spec["generator"], namespace)  # noqa: S102 - seed-local trusted string
            cases.append((f"{index:02d}", namespace["payload"] + "\n",
                          namespace["expected"] + "\n", False))

        if dry_run:
            return
        for order, (_, payload, expected, is_sample) in enumerate(cases, start=1):
            TestCase.objects.update_or_create(
                problem=problem,
                order=order,
                defaults={
                    "input": payload,
                    "expected_output": expected,
                    "is_sample": is_sample,
                },
            )

    def _fill_module(self, module, lessons, problems, dry_run):
        """Write the lessons, keeping their order and leaving foreign lessons last."""
        existing = list(module.lessons.order_by("order"))
        wanted_titles = {lesson["title"] for lesson in lessons}
        others = [lesson for lesson in existing if lesson.title not in wanted_titles]

        # ("module", "order") is unique, so a lesson the teacher wrote while
        # holding one of the demo positions would reject the write below. Park
        # those lessons above the demo range first and renumber them at the end.
        park_from = len(lessons) + 1000
        for offset, lesson in enumerate(others):
            target = park_from + offset
            if lesson.order != target and not dry_run:
                lesson.order = target
                lesson.save(update_fields=["order"])

        for index, spec in enumerate(lessons, start=1):
            lesson = next((l for l in existing if l.title == spec["title"]), None)
            order = index
            if lesson is None:
                if dry_run:
                    self.stdout.write(f"  {module.title}: would add lesson {spec['title']!r}")
                    continue
                lesson = Lesson.objects.create(
                    module=module, title=spec["title"], order=order,
                    content=spec["content"], estimated_minutes=spec["estimated_minutes"],
                    is_published=True,
                )
                self.stdout.write(f"  {module.title}: + {spec['title']}")
            elif lesson.content != spec["content"] or lesson.order != order:
                if not dry_run:
                    lesson.content = spec["content"]
                    lesson.order = order
                    lesson.estimated_minutes = spec["estimated_minutes"]
                    lesson.save()
                self.stdout.write(f"  {module.title}: ~ {spec['title']}")

            if dry_run or lesson is None:
                continue

            for material_index, (title, kind, body) in enumerate(spec["materials"], start=1):
                Material.objects.update_or_create(
                    lesson=lesson, title=title,
                    defaults={"material_type": kind, "content": body,
                              "order": material_index},
                )

            for link_index, slug in enumerate(spec["problems"], start=1):
                problem = problems.get(slug)
                if problem is None:
                    continue
                ProblemCourseLink.objects.update_or_create(
                    lesson=lesson, problem=problem,
                    defaults={"order": link_index, "is_required": True},
                )

        # Lessons that were already in the module but are not part of the demo
        # keep their content and move after the demo ones.
        for offset, lesson in enumerate(others, start=len(lessons) + 1):
            if lesson.order != offset and not dry_run:
                lesson.order = offset
                lesson.save(update_fields=["order"])

    @staticmethod
    def _make_password():
        import secrets
        import string

        alphabet = string.ascii_letters + string.digits
        return "".join(secrets.choice(alphabet) for _ in range(16))