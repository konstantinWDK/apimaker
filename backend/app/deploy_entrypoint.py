"""Entrypoint for Docker deploy — reads project.json and starts the standalone server."""
import json
import os
import sys
from pathlib import Path

# Set DB path BEFORE any app imports
json_path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("/app/deployments/project.json")
port = int(sys.argv[2]) if len(sys.argv) > 2 else 8000
db_path = json_path.parent / "data.db"
os.environ["APIMAKER_DATABASE_URL"] = f"sqlite:///{db_path}"

# Now safe to import app modules
from app.standalone_server import _ensure_project_in_db, create_app_for_project
import uvicorn

project_data = json.loads(json_path.read_text())
pid = _ensure_project_in_db(project_data, os.environ["APIMAKER_DATABASE_URL"])
app = create_app_for_project(pid, title=project_data.get("name", "API"))
print(f"🚀 API running on http://0.0.0.0:{port}")
uvicorn.run(app, host="0.0.0.0", port=port)
