# Suggested next steps

This document summarizes pending features or evolution ideas for DoApi to reach production as a self-hostable tool.

## Backend

1. **Mock server / real runtime**: implement `/api/{projectId}/*` routes that expose data from the loaded dataset (embedded json-server or dynamic FastAPI).
2. **Artifact generator**: connect the `generator/` module to produce code (FastAPI/Express/Nest) and SDKs from the saved definition.
3. **Robust persistence**: move from flat JSON to a SQL database (SQLite/Postgres) with migrations and project versioning.
4. **Advanced authentication**: roles, multiple users, and per-project tokens; possibly OAuth or SSO.

## Frontend

1. **Connect to real backend**: consume `/projects` to list saved projects, edit, and perform full CRUD from the UI.
2. **Real playground**: once the mock server exists, allow executing real requests from "Endpoints & Simulator".
3. **Deployment wizard**: guided flow to export the API, download code, or push to GitHub.
4. **Better snapshot management**: compare versions, clone projects, and tag releases (v1, v2...).

## Security and distribution

1. **Multi-user login**: replace the basic login with a managed system (JWT or integration with existing client proxies).
2. **Centralized configuration**: expose an `.env` file or panel to define backend URL, tokens, etc., without editing code.
3. **Installer/CLI**: package the app (Docker Compose or installer) so users can deploy it with a single command.

## Documentation and demo

1. **Complete example API**: document how to spin up a mock server with the Pokédex demo and consume it from Postman/cURL.
2. **Step-by-step guides**: tutorials for creating an API from CSV, syncing, and sharing docs.
3. **Interactive video/demo**: show the end-to-end flow for faster client adoption.

---

This file will be updated as we prioritize new features. You can open issues or PRs on any of these items.
