FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

COPY pyproject.toml README.md ./
COPY founder_profile.yaml ./
COPY grant_application_agent ./grant_application_agent

RUN pip install --no-cache-dir .

CMD ["sh", "-c", "uvicorn grant_application_agent.api:app --host 0.0.0.0 --port ${PORT:-8080}"]
