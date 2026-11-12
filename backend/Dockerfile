FROM python:3.11-slim
RUN apt-get update && apt-get install -y \
    gcc g++ default-jdk \
    libpq-dev curl postgresql-client \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 DJANGO_SETTINGS_MODULE=config.settings.production
COPY requirements/base.txt requirements/base.txt
RUN pip install --no-cache-dir -r requirements/base.txt
COPY . .
RUN useradd -M -r appuser && chown -R appuser:appuser /app && chmod +x scripts/entrypoint.sh
ENTRYPOINT ["bash", "scripts/entrypoint.sh"]
