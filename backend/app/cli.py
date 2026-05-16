"""CLI entry point for DoApi.

Commands:
  deploy  <file.json>   Deploy an exported project as a standalone API
  serve   <slug>        Serve an existing project from the builder database
  init    <file.json>   Initialize a project JSON from an existing database project
  deploy --ssh <host>   Deploy to a remote server via SSH+Docker
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path


def cmd_deploy(args: argparse.Namespace) -> None:
    """Deploy a project from an exported JSON file."""
    json_path = Path(args.file)
    if not json_path.exists():
        print(f" File not found: {args.file}")
        sys.exit(1)

    db_url = args.db
    if not db_url:
        db_path = json_path.with_suffix(".db")
        db_url = f"sqlite:///{db_path.resolve()}"

    if args.ssh:
        _deploy_via_ssh(json_path, args.ssh, args.port, db_url)
    else:
        from app.standalone_server import serve_project_from_json
        serve_project_from_json(
            str(json_path),
            host=args.host,
            port=args.port,
            db_url=db_url,
        )


def _deploy_via_ssh(json_path: Path, ssh_target: str, port: int, db_url: str) -> None:
    """Deploy project to a remote server via SSH + Docker."""
    print(f" Deploying to {ssh_target}...")

    remote_dir = f"/opt/doapi/{json_path.stem}"

    # Read project name
    project_data = json.loads(json_path.read_text(encoding="utf-8"))
    project_name = project_data.get("name", json_path.stem)

    # Create remote directory
    subprocess.run(
        ["ssh", ssh_target, f"mkdir -p {remote_dir}"],
        check=True,
    )

    # Copy project JSON
    subprocess.run(
        ["scp", str(json_path), f"{ssh_target}:{remote_dir}/project.json"],
        check=True,
    )

    # Generate docker-compose on the fly
    docker_compose = f"""version: '3.8'
services:
  api:
    image: python:3.11-slim
    working_dir: /app
    ports:
      - "{port}:{port}"
    command: >
      sh -c "pip install doapi-backend -q &&
             doapi deploy project.json --port {port} --host 0.0.0.0"
    volumes:
      - ./project.json:/app/project.json
      - data:/app/data
    restart: unless-stopped

volumes:
  data:
"""
    # Copy docker-compose
    subprocess.run(
        ["ssh", ssh_target, f"cat > {remote_dir}/docker-compose.yml << 'DOCKEREOF'\n{docker_compose}\nDOCKEREOF"],
        shell=True,
        check=True,
    )

    # Start it
    subprocess.run(
        ["ssh", ssh_target, f"cd {remote_dir} && docker compose up -d"],
        check=True,
    )

    print(f"\n{'='*50}")
    print(f"   '{project_name}' deployed at {ssh_target}")
    print(f"   http://{ssh_target.split('@')[-1]}:{port}/api")
    print(f"{'='*50}\n")


def cmd_serve(args: argparse.Namespace) -> None:
    """Serve an existing project from the builder database as a standalone API."""
    from app.standalone_server import serve_project_from_db
    serve_project_from_db(
        args.project,
        host=args.host,
        port=args.port,
    )


def cmd_init(args: argparse.Namespace) -> None:
    """Export a project from the builder database to a JSON file."""
    import json as _json
    from sqlmodel import Session, select
    from app.db import engine
    from app.db_models import Dataset, DatasetField, Endpoint, MockRecord, Project

    with Session(engine) as session:
        project = session.exec(
            select(Project).where(Project.slug == args.project)
        ).first()
        if not project:
            print(f" Project '{args.project}' not found.")
            sys.exit(1)

        output = {
            "name": project.name,
            "slug": project.slug,
            "description": project.description,
            "auth_method": project.auth_method,
            "target_stack": project.target_stack,
            "datasets": [],
            "endpoints": [],
        }

        datasets = session.exec(
            select(Dataset).where(Dataset.project_id == project.id)
        ).all()
        for ds in datasets:
            fields = session.exec(
                select(DatasetField).where(DatasetField.dataset_id == ds.id)
            ).all()

            records = session.exec(
                select(MockRecord).where(
                    MockRecord.project_id == project.id,
                    MockRecord.dataset_id == ds.id,
                )
            ).all()

            output["datasets"].append({
                "name": ds.name,
                "source_type": ds.source_type,
                "fields": [
                    {
                        "name": f.name,
                        "type": f.field_type,
                        "required": f.required,
                        "description": f.description,
                        "is_primary_key": f.is_primary_key,
                    }
                    for f in fields
                ],
                "sample_rows": [
                    {**json.loads(r.data), "_id": r.record_id} for r in records
                ],
            })

        endpoints = session.exec(
            select(Endpoint).where(Endpoint.project_id == project.id)
        ).all()
        for ep in endpoints:
            output["endpoints"].append({
                "name": ep.name,
                "method": ep.method,
                "path": ep.path,
                "summary": ep.summary,
                "operation_type": ep.operation_type,
            })

    out_path = Path(args.output) if args.output else Path(f"{project.slug}.json")
    out_path.write_text(json.dumps(output, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f" Project '{project.name}' exported to {out_path}")


def main() -> None:
    parser = argparse.ArgumentParser(
        prog="doapi",
        description="DoApi — Deploy and manage your APIs from the command line.",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    # deploy
    dp = subparsers.add_parser("deploy", help="Deploy a project from an exported JSON")
    dp.add_argument("file", help="Path to exported project JSON")
    dp.add_argument("--host", default="0.0.0.0", help="Host to bind (default: 0.0.0.0)")
    dp.add_argument("--port", type=int, default=8080, help="Port (default: 8080)")
    dp.add_argument("--db", help="Database URL (default: SQLite next to JSON)")
    dp.add_argument("--ssh", help="Remote SSH target (user@host) for remote deploy")

    # serve
    sp = subparsers.add_parser("serve", help="Serve a project from the builder database")
    sp.add_argument("project", help="Project slug or ID")
    sp.add_argument("--host", default="0.0.0.0", help="Host (default: 0.0.0.0)")
    sp.add_argument("--port", type=int, default=8081, help="Port (default: 8081)")

    # init
    ip = subparsers.add_parser("init", help="Export a project from the builder DB to a JSON file")
    ip.add_argument("project", help="Project slug or ID")
    ip.add_argument("--output", "-o", help="Output JSON path (default: <slug>.json)")

    args = parser.parse_args()

    if args.command == "deploy":
        cmd_deploy(args)
    elif args.command == "serve":
        cmd_serve(args)
    elif args.command == "init":
        cmd_init(args)


if __name__ == "__main__":
    main()
