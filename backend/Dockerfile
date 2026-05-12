FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy package config and source
COPY pyproject.toml .
COPY app/ app/

# Install the package and dependencies
RUN pip install --no-cache-dir .

# Copy remaining files (scripts, alembic, tests, etc.)
COPY . .

# Expose port
EXPOSE 8000

# Start application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
