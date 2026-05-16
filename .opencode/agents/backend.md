---
description: Desarrolla el backend FastAPI: routers, services, db_models, seguridad, mock server
mode: subagent
model: deepseek/deepseek-v4-flash
prompt: "{file:.opencode/prompts/backend.txt}"
permission:
  edit: allow
  bash:
    "*": ask
    "pytest *": allow
    "uvicorn *": allow
    "alembic *": allow
    "pip install *": allow
    "python *": allow
---
