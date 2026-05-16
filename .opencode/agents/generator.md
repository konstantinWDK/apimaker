---
description: Gestiona los templates Jinja2 del generador de codigo: FastAPI, Express, NestJS, SDKs
mode: subagent
model: deepseek/deepseek-v4-flash
prompt: "{file:.opencode/prompts/generator.txt}"
permission:
  edit: allow
  bash:
    "*": ask
    "pytest * -k generator": allow
---
