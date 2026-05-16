---
description: Desarrolla el frontend React: componentes, hooks, estilos, API client, tipos
mode: subagent
model: deepseek/deepseek-v4-flash
prompt: "{file:.opencode/prompts/frontend.txt}"
permission:
  edit: allow
  bash:
    "*": ask
    "npm run dev": allow
    "npm run lint": allow
    "npm run build": allow
    "npm test": allow
    "npm run test": allow
    "npm install": allow
---
