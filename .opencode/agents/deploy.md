---
description: Gestiona Docker, docker-compose, deploys locales, remotos e infraestructura
mode: subagent
model: deepseek/deepseek-v4-flash
prompt: "{file:.opencode/prompts/deploy.txt}"
permission:
  edit: allow
  bash:
    "docker *": allow
    "docker-compose *": allow
    "docker compose *": allow
---
