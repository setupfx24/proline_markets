# Proline Markets — Production Deployment (prolinemarket.com)

Hostinger Ubuntu VPS + Cloudflare (proxied) + Cloudflare Origin SSL + Docker.

| Setting | Value |
|---|---|
| Domain | `prolinemarket.com` |
| Server IP | `187.127.162.99` |
| Compose project name | `prolinemarket` |
| Deploy Linux user | `deploy` (change if you want a different name) |

### Subdomain → container map (already configured in `deploy/nginx/prolinemarket.conf`)
```
prolinemarket.com  +  trade.prolinemarket.com  → trader-frontend  127.0.0.1:3012
www.prolinemarket.com                          → 301 redirect to apex
admin.prolinemarket.com                        → admin-frontend   127.0.0.1:3013
api.prolinemarket.com   (REST + WebSocket)     → gateway          127.0.0.1:8002
```
> `admin-api` (127.0.0.1:8003) is reached *through* admin-frontend over the Docker network — nginx never talks to it directly.

```
Browser → Cloudflare (Edge SSL) → Nginx :443 (Origin SSL) → Docker (localhost ports)
```

---

## PHASE 0 — Cloudflare DNS & SSL

Your DNS records are already correct (A records: `@`, `www`, `admin`, `api`, `trade` → `187.127.162.99`, all **Proxied / orange cloud**). Just confirm these Cloudflare settings:

1. **SSL/TLS → Overview** → set encryption mode to **Full (strict)**.
2. **SSL/TLS → Origin Server → Create Certificate**
   - Defaults are fine (RSA 2048; hostnames `*.prolinemarket.com`, `prolinemarket.com`).
   - Validity: **15 years** → **Create**.
   - **Copy the Origin Certificate** (PEM) — you'll paste it into `origin.pem`.
   - **Copy the Private Key** (PEM) — you'll paste it into `origin-key.pem`. ⚠️ This is shown only once.
3. **SSL/TLS → Edge Certificates** → **Always Use HTTPS: ON**, **Minimum TLS: 1.2**.
4. **Network → WebSockets: ON** (required for live price streaming — without this the chart prices won't update).

---

## PHASE 1 — First login & create the deploy user

SSH in as root (Hostinger gives you the root password in hPanel):
```bash
ssh root@187.127.162.99
```

Create a non-root sudo user named `deploy`:
```bash
adduser deploy                 # set a strong password when prompted
usermod -aG sudo deploy        # grant sudo
```

(Optional but recommended) copy your SSH key so you can log in as `deploy` directly:
```bash
rsync --archive --chown=deploy:deploy ~/.ssh /home/deploy/
```

From now on, log in as the new user:
```bash
ssh deploy@187.127.162.99
```

---

## PHASE 2 — System packages, Docker, firewall

```bash
sudo apt update && sudo apt upgrade -y

sudo apt install -y \
  curl wget git unzip nano htop ca-certificates gnupg lsb-release \
  nginx ufw fail2ban
```

### Docker + Compose plugin
```bash
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

sudo systemctl enable --now docker
```

Let the `deploy` user run Docker without sudo:
```bash
sudo usermod -aG docker deploy
newgrp docker          # apply the group now (or log out and back in)
docker --version && docker compose version
```

### Firewall — only SSH + HTTP + HTTPS public
```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status verbose
```
> Do **NOT** open 3012/3013/8002/8003/5432/6379/9092 — they bind to 127.0.0.1 only and nginx proxies them.

### Fail2ban (basic SSH protection)
```bash
sudo tee /etc/fail2ban/jail.local > /dev/null << 'EOF'
[DEFAULT]
bantime  = 3600
findtime = 600
maxretry = 5
backend  = systemd

[sshd]
enabled  = true
maxretry = 3
EOF
sudo systemctl enable --now fail2ban
```

### Swap (skip if the VPS already has ≥ 4 GB RAM)
Docker builds can OOM-kill on small VPSes. Add 4 GB swap:
```bash
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

---

## PHASE 3 — Install the Cloudflare Origin Certificate

```bash
sudo mkdir -p /etc/ssl/cloudflare

# Paste the Origin Certificate (BEGIN/END CERTIFICATE), then Ctrl+O, Enter, Ctrl+X
sudo nano /etc/ssl/cloudflare/origin.pem

# Paste the Private Key (BEGIN/END PRIVATE KEY)
sudo nano /etc/ssl/cloudflare/origin-key.pem

# Lock down permissions
sudo chmod 644 /etc/ssl/cloudflare/origin.pem
sudo chmod 600 /etc/ssl/cloudflare/origin-key.pem
sudo chown root:root /etc/ssl/cloudflare/*
```
These paths exactly match `ssl_certificate` / `ssl_certificate_key` in `prolinemarket.conf`.

---

## PHASE 4 — Clone the project & configure `.env`

```bash
cd ~
git clone https://github.com/YOUR_USERNAME/prolinemarket.git prolinemarket
cd ~/prolinemarket
```
> Private repo? Use a token: `git clone https://YOUR_TOKEN@github.com/YOUR_USERNAME/prolinemarket.git prolinemarket`

Create `.env` from the template:
```bash
cp .env.example .env
```

Generate secrets (run each, paste output into `.env`):
```bash
openssl rand -hex 32     # JWT_SECRET
openssl rand -hex 32     # USER_JWT_SECRET   (different)
openssl rand -hex 32     # ADMIN_JWT_SECRET  (different)
openssl rand -base64 24  # POSTGRES_PASSWORD
openssl rand -base64 24  # TIMESCALE_PASSWORD
```

Edit `.env`:
```bash
nano .env
```
Set these for **prolinemarket.com** (the template still has placeholder domains):
```env
POSTGRES_PASSWORD=<the base64 you generated>
TIMESCALE_PASSWORD=<the other base64>

# URLs must contain the SAME passwords as above
DATABASE_URL=postgresql+asyncpg://prolinemarket:<POSTGRES_PASSWORD>@postgres:5432/prolinemarket
TIMESCALE_URL=postgresql+asyncpg://prolinemarket:<TIMESCALE_PASSWORD>@timescaledb:5432/marketdata

JWT_SECRET=<hex 1>
USER_JWT_SECRET=<hex 2>
ADMIN_JWT_SECRET=<hex 3>

ENVIRONMENT=production
COOKIE_SECURE=true
CORS_ORIGINS=https://prolinemarket.com,https://admin.prolinemarket.com
TRADER_APP_URL=https://prolinemarket.com

# First admin login (change password after first login)
ADMIN_EMAIL=admin@prolinemarket.com
ADMIN_PASSWORD=<a strong password>

# Market data: leave the placeholder for a simulated feed, or paste a real Infoway key
INFOWAY_API_KEY=your-infoway-api-key-here
```
> If you set `POSTGRES_USER` / `POSTGRES_DB` to something other than `prolinemarket`, make the `DATABASE_URL` user/db match. The defaults in `docker-compose.yml` are fine as long as the URL matches.
>
> Want password-reset emails? Fill in the `SMTP_*` block too (e.g. a Gmail App Password).

---

## PHASE 5 — Nginx

```bash
# Remove the default site
sudo rm -f /etc/nginx/sites-enabled/default

# Install the project's prolinemarket config
sudo cp ~/prolinemarket/deploy/nginx/prolinemarket.conf /etc/nginx/sites-available/prolinemarket.conf
sudo ln -sf /etc/nginx/sites-available/prolinemarket.conf /etc/nginx/sites-enabled/prolinemarket.conf
```

The config references `map $http_upgrade $connection_upgrade` indirectly via `Connection "upgrade"`, but to be safe add the WebSocket map and a couple of tuning lines to the main `http {}` block:
```bash
sudo nano /etc/nginx/nginx.conf
```
Inside `http { ... }` ensure these exist:
```nginx
    server_names_hash_bucket_size 64;
    server_tokens off;
    map $http_upgrade $connection_upgrade { default upgrade; '' close; }
```

Test and start:
```bash
sudo nginx -t
sudo systemctl enable --now nginx
sudo systemctl restart nginx
```
> Expect 502s until the containers are up — that's normal.

---

## PHASE 6 — Build & start the stack

```bash
cd ~/prolinemarket

# Helper alias for this session
COMPOSE="docker compose -f docker-compose.yml -f docker-compose.prod.yml"

# Build (APP_VERSION cache-busts the frontend JS). Takes 5–15 min.
APP_VERSION=$(date +%Y%m%d-%H%M%S) $COMPOSE build

# Start everything detached
$COMPOSE up -d

# Run database migrations (creates tables + seeds the admin user)
$COMPOSE --profile migrate run --rm migrate

# Check status
$COMPOSE ps
```
All services should be `running` / `healthy`: postgres, timescaledb, redis, zookeeper, kafka, gateway, admin-api, market-data, b-book-engine, risk-engine, trader-frontend, admin-frontend.

### Local health checks
```bash
curl http://localhost:8002/health      # gateway
curl http://localhost:8003/health      # admin-api
```

---

## PHASE 7 — Verify in the browser

| URL | Expected |
|---|---|
| https://prolinemarket.com | Trader app / landing |
| https://prolinemarket.com/auth/login | Login page |
| https://admin.prolinemarket.com | Admin login |
| https://api.prolinemarket.com/health | `{"status":"ok",...}` |

**WebSocket test** (browser console on the site):
```javascript
const ws = new WebSocket('wss://api.prolinemarket.com/ws/prices');
ws.onopen = () => console.log('connected');
ws.onmessage = (e) => console.log(JSON.parse(e.data));
```

**Admin login:** `admin@prolinemarket.com` / the `ADMIN_PASSWORD` you set → **change it immediately** after first login.

---

## PHASE 8 — Post-deploy hardening

`restart: always` is already set in `docker-compose.prod.yml`, so containers auto-restart on reboot.

### Docker log rotation
```bash
sudo tee /etc/logrotate.d/docker-containers > /dev/null << 'EOF'
/var/lib/docker/containers/*/*.log {
    rotate 7
    daily
    compress
    delaycompress
    missingok
    notifempty
    copytruncate
    maxsize 100M
}
EOF
```

### Weekly image prune (frees disk)
```bash
crontab -e
# add:
0 3 * * 0 docker system prune -af --filter "until=168h" >> /var/log/docker-prune.log 2>&1
```
> Use `--volumes` only if you're sure — it can delete unused data volumes.

---

## Everyday commands

```bash
cd ~/prolinemarket
COMPOSE="docker compose -f docker-compose.yml -f docker-compose.prod.yml"

$COMPOSE ps                                  # status
$COMPOSE logs -f gateway                      # live logs
$COMPOSE restart gateway                      # restart one service

# Redeploy after a git pull (frontend MUST be rebuilt, not just restarted):
git pull
APP_VERSION=$(date +%Y%m%d-%H%M%S) $COMPOSE build --no-cache trader-frontend admin-frontend
$COMPOSE up -d

# Full rebuild + migrations
git pull
APP_VERSION=$(date +%Y%m%d-%H%M%S) $COMPOSE build
$COMPOSE up -d
$COMPOSE --profile migrate run --rm migrate
```

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| Cloudflare **521** (origin down) | nginx not listening on 443 → `sudo systemctl status nginx`, `sudo nginx -t` |
| Cloudflare **525** (SSL handshake) | `origin.pem` / `origin-key.pem` wrong or mismatched in `/etc/ssl/cloudflare/` |
| **502** Bad Gateway | A container crashed → `$COMPOSE ps`, then `$COMPOSE logs <svc>` |
| Prices/chart not updating | Cloudflare **Network → WebSockets** must be ON |
| Admin login fails | Migrations not run → `$COMPOSE --profile migrate run --rm migrate` |
| CORS errors | `CORS_ORIGINS` must match the domains exactly, no trailing slash |
| Build "Killed" / OOM | Add swap (Phase 2) |
| Old JS after deploy | Rebuild frontend with a new `APP_VERSION`, then hard-refresh (Ctrl+Shift+R) |
</content>
</invoke>
