# Deploy Guide

Guía completa para desplegar APIs de DoApi en producción con seguridad.

## Índice

- [Arquitectura recomendada](#arquitectura-recomendada)
- [Opción 1: Deploy local (Docker)](#opción-1-deploy-local-docker)
- [Opción 2: Deploy remoto vía SSH](#opción-2-deploy-remoto-vía-ssh)
- [Opción 3: CLI (doapi deploy)](#opción-3-cli-doapi-deploy)
- [Seguridad en producción](#seguridad-en-producción)
- [Hardening del VPS](#hardening-del-vps)
- [Telemetría (Monitor remoto)](#telemetría-monitor-remoto)
- [Checklist de producción](#checklist-de-producción)
- [Resolución de problemas](#resolución-de-problemas)

---

## Arquitectura recomendada

```
┌───── LOCAL ─────┐        ┌───── VPS PROD ─────┐
│  DoApi Builder   │        │  Nginx/Caddy (SSL)  │
│  - Editor UI     │  SSH   │  → API Docker       │
│  - Mock server   │──────→ │  → PostgreSQL       │
│  - Monitor       │  SCP   │  → Sin panel        │
│  - SQLite local  │        │  → Firewall estricto│
│  Puerto 5173     │        └─────────────────────┘
│  Puerto 8000     │
└──────────────────┘
```

**Principios:**
- El **builder corre en local** (tu máquina de desarrollo)
- El **VPS solo tiene la API desplegada** — sin builder, sin panel, sin Docker socket
- La conexión es vía **SSH con clave** (no password)
- Para telemetría, usar **VPN o túnel** (WireGuard, Tailscale)

---

## Opción 1: Deploy local (Docker)

Desde la UI de DoApi, en la pestaña **Despliegue**:

1. Selecciona el proyecto
2. Elige el puerto (por defecto 8080)
3. Configura la base de datos (SQLite embebida, PostgreSQL o MySQL)
4. Pulsa **Deploy local**

Esto genera un contenedor Docker con la API lista para servir.

```bash
# Lo que ocurre detrás:
docker compose -f deployments/<slug>/docker-compose.yml up -d
```

---

## Opción 2: Deploy remoto vía SSH

### Requisitos en el VPS

```bash
# Ubuntu/Debian
sudo apt update && sudo apt install -y docker.io docker-compose-v2

# Abrir puertos necesarios
sudo ufw allow 22/tcp      # SSH
sudo ufw allow 80/tcp      # HTTP
sudo ufw allow 443/tcp     # HTTPS (si usas SSL)
sudo ufw enable
```

### Desde el builder

```bash
# 1. Exporta el proyecto a JSON
doapi init mi-proyecto -o proyecto.json

# 2. Despliega vía SSH
doapi deploy proyecto.json --ssh usuario@tuvps.com --port 80
```

O desde la UI de DoApi, en la pestaña **Despliegue** → **Remoto SSH**, rellena los datos del VPS y pulsa desplegar.

### Seguridad SSH

```bash
# En el VPS, desactiva login por password
sudo sed -i 's/PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
sudo systemctl restart sshd

# Usa solo claves ed25519
ssh-keygen -t ed25519 -a 100
ssh-copy-id -i ~/.ssh/id_ed25519.pub usuario@tuvps.com
```

---

## Opción 3: CLI (doapi deploy)

El CLI permite desplegar sin depender de la UI:

```bash
# Exportar proyecto
doapi init pokedex-demo -o mi-api.json

# Desplegar local
doapi deploy mi-api.json --port 8080

# Desplegar en VPS
doapi deploy mi-api.json --ssh usuario@midominio.com --port 80

# Servir desde la base de datos del builder (puerto separado)
doapi serve pokedex-demo --port 8081
```

---

## Seguridad en producción

### Variables de entorno obligatorias

```bash
# En el builder (localhost:8000)
APIMAKER_JWT_SECRET_KEY=<genera una clave segura>
APIMAKER_ENCRYPTION_KEY=<clave para encriptar conexiones>

# En cada API desplegada
JWT_SECRET=<secreto único por proyecto>
API_KEY=<api key única por proyecto>
TELEMETRY_URL=https://tu-builder/projects/{id}/monitor/ingest
```

### Generar claves seguras

```bash
python -c "import secrets; print('JWT_SECRET:', secrets.token_hex(32))"
python -c "import secrets; print('ENCRYPTION_KEY:', secrets.token_urlsafe(32))"
```

### HTTPS obligatorio

```bash
# Con Caddy (recomendado, auto-ssl)
# Caddyfile:
api.tudominio.com {
    reverse_proxy localhost:8080
}

# Con Nginx + Certbot
sudo apt install nginx certbot python3-certbot-nginx
sudo nano /etc/nginx/sites-available/api
# Configurar reverse proxy al puerto de la API
sudo certbot --nginx -d api.tudominio.com
```

### Firewall de la API desplegada

La API generada solo debe exponer los endpoints necesarios:

| Ruta | ¿Pública? | Descripción |
|------|-----------|-------------|
| `/health` | Sí | Health check |
| `/docs`, `/redoc` | Opcional | Documentación Swagger |
| `/openapi.json` | Opcional | Especificación OpenAPI |
| `/api/*` | Con auth | Endpoints del negocio |

**Recomendación:** En producción, deshabilitar `/docs` y `/redoc`:

```bash
# En la API generada, pasar variable de entorno
DISABLE_DOCS=true
```

---

## Hardening del VPS

### 1. Usuario no-root para Docker

```bash
sudo useradd -m doapi-deploy
sudo usermod -aG docker doapi-deploy
sudo -u doapi-deploy docker run hello-world
```

### 2. Limitar recursos del contenedor

```yaml
# En el docker-compose.yml generado, añadir:
services:
  api:
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 256M
        reservations:
          cpus: '0.25'
          memory: 128M
```

### 3. Escanear imágenes regularmente

```bash
# Usar Trivy para vulnerabilidades
docker run aquasec/trivy image doapi-deploy:latest
```

### 4. Rotación de logs

```bash
# Limitar logs del contenedor
# docker-compose.yml
services:
  api:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

### 5. Fail2ban para SSH

```bash
sudo apt install fail2ban
sudo systemctl enable fail2ban
```

---

## Telemetría (Monitor remoto)

Para ver las peticiones de tu API desplegada en el Monitor de DoApi:

### 1. Con túnel SSH (seguro)

```bash
# En tu máquina local, crea un túnel para que el VPS llegue al builder
ssh -R 8000:localhost:8000 usuario@tuvps.com
# Luego en el VPS, al ejecutar la API:
TELEMETRY_URL=http://localhost:8000/projects/{id}/monitor/ingest
```

### 2. Con WireGuard (recomendado)

```bash
# Instala WireGuard en local y VPS
# Crea una red privada (ej: 10.0.0.0/24)
# El builder puede recibir peticiones en la IP privada
TELEMETRY_URL=http://10.0.0.1:8000/projects/{id}/monitor/ingest
```

### 3. Con Tailscale (más simple)

```bash
# Instala Tailscale en ambas máquinas
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up

# Conecta usando la IP de Tailscale
TELEMETRY_URL=http://100.x.x.x:8000/projects/{id}/monitor/ingest
```

**Sin telemetría:** Si no configuras `TELEMETRY_URL`, la API desplegada funciona igual pero no envía logs al Monitor. Las peticiones al mock server local sí se registran siempre.

---

## Checklist de producción

- [ ] **JWT Secret**: `APIMAKER_JWT_SECRET_KEY` configurado (nunca el default)
- [ ] **Encryption Key**: `APIMAKER_ENCRYPTION_KEY` configurado
- [ ] **HTTPS**: Certificado SSL activo (Caddy, Nginx + Certbot, Cloudflare)
- [ ] **Firewall**: Solo puertos 22, 80, 443 abiertos
- [ ] **SSH**: Solo claves (nada de password)
- [ ] **Docker socket**: No montado en contenedores de producción
- [ ] **Secrets**: No embebidos en código fuente (usar env vars)
- [ ] **Base de datos**: PostgreSQL en producción (no SQLite)
- [ ] **Rate limiting**: Activado en la API (al menos 100 req/min)
- [ ] **CORS**: Restringido a orígenes conocidos
- [ ] **Workers**: Múltiples workers para producción (gunicorn, pm2)
- [ ] **Logs**: Rotación configurada (max 10MB, 3 archivos)
- [ ] **Recursos**: Límites de CPU/memoria en Docker
- [ ] **Monitoring**: Health check periódico (curl /health)
- [ ] **Backups**: Base de datos respaldada diariamente
- [ ] **Actualizaciones**: Docker images escaneadas con Trivy
- [ ] **Telemetría**: `TELEMETRY_URL` configurado si usas Monitor

---

## Resolución de problemas

### Error "No hay puertos disponibles"

```bash
# Ver puertos en uso
sudo lsof -i :8080
# O cambiar el puerto en el deploy
doapi deploy proyecto.json --port 8081
```

### El contenedor no arranca

```bash
# Ver logs del contenedor
docker logs <container-name>
# Verificar que el project.json existe
ls -la deployments/<slug>/project.json
```

### Timeout en conexión SSH

```bash
# Verificar conectividad
ssh -v usuario@host
# Verificar puerto SSH
nc -zv host 22
# Verificar firewall en el VPS
sudo ufw status
```

### La API responde 401

```bash
# Verificar que el API Key o JWT son correctos
# Los secrets están en project.json y .env
grep api_key deployments/<slug>/project.json
grep API_KEY .env
```

### Telemetría no funciona

```bash
# Verificar que TELEMETRY_URL es accesible desde el VPS
curl -v $TELEMETRY_URL
# Verificar que el puerto del builder está abierto
curl http://localhost:8000/health
```
