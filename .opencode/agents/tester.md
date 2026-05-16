---
description: Escribe y ejecuta tests: pytest backend, vitest frontend
mode: subagent
model: deepseek/deepseek-v4-flash
prompt: "{file:.opencode/prompts/tester.txt}"
permission:
  edit: allow
  bash:
    "pytest *": allow
    "npm test": allow
    "npm run test": allow
    "python *": allow
    "pip install *": allow
---
