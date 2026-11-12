# Putting Open CRM on the internet

This sets up the website, the API and the database on one small Linux server, with free automatic HTTPS.
Everything used is open source. Expect about one hour the first time.

```
phone app / desktop app / browser ──https──▶ Caddy (website + HTTPS) ──▶ Spring Boot API ──▶ PostgreSQL + PostGIS
```

## 1. Get a server (pick one)

| Option | Cost | Notes |
|---|---|---|
| **Oracle Cloud "Always Free"** ARM VM (4 cores, 24 GB) | ₹0 | Generous but sign-up can be fussy; it is ARM → set `POSTGIS_IMAGE` (step 4) |
| **Hetzner Cloud** CX22 (2 vCPU, 4 GB) | ≈ €4/month | Simple and reliable; Germany/Finland/Singapore |
| DigitalOcean / Linode / AWS Lightsail (Mumbai region) | ≈ $5–6/month | Servers in India = lower latency |
| An old PC in the office | ₹0 | Needs a public IP or a tunnel; power cuts take the CRM down |

Choose **Ubuntu 24.04**, at least **2 GB RAM** (4 GB recommended), and allow ports **22, 80, 443** in the provider's firewall.

## 2. Get a domain name

- Any registrar (₹100–800/year for `.in` / `.com`), or a free subdomain from [DuckDNS](https://www.duckdns.org).
- Create a DNS **A record**: `crm.yourcompany.in → <server IP>`. Wait until `ping crm.yourcompany.in` shows the server's IP.

## 3. Install Docker on the server

```bash
ssh ubuntu@<server-ip>
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER && newgrp docker
sudo apt-get install -y git
```

## 4. Copy the project and configure it

```bash
sudo mkdir -p /opt/open-crm && sudo chown $USER /opt/open-crm
git clone <your repository URL> /opt/open-crm      # or copy the folder with scp/WinSCP
cd /opt/open-crm
cp .env.example .env
nano .env
```

Fill in `.env`:

| Setting | What to put |
|---|---|
| `DOMAIN` | `crm.yourcompany.in` |
| `ACME_EMAIL` | your email (Let's Encrypt warns you here if a certificate ever has a problem) |
| `DB_PASSWORD`, `JWT_SECRET` | random values: run `openssl rand -base64 48` for each |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | the first admin login |
| `CORS_ORIGINS` | `https://crm.yourcompany.in,https://localhost,capacitor://localhost,app://open-crm` |
| `POSTGIS_IMAGE` | only on ARM servers (Oracle free tier): `imresamu/postgis:16-3.5` |

## 5. Start it

```bash
docker compose -f deploy/docker-compose.prod.yml --env-file .env up -d --build
docker compose -f deploy/docker-compose.prod.yml logs -f api     # wait for "Started OpenCrmApplication", then Ctrl+C
```

Open `https://crm.yourcompany.in`, log in with `ADMIN_EMAIL` / `ADMIN_PASSWORD`, and create users under **Users**.
The first start takes 5–10 minutes (it builds the app); Caddy gets the HTTPS certificate within a minute.

On phones, open the site in Chrome and choose **Install app / Add to Home screen** — that's the PWA.

## 6. Backups (do this on day one)

```bash
chmod +x deploy/backup.sh
./deploy/backup.sh                       # test it once
crontab -e                               # add:  30 2 * * * /opt/open-crm/deploy/backup.sh
```

Backups go to `deploy/backups/` (14 days kept). Also copy them off the server, e.g. with [rclone](https://rclone.org)
to Google Drive or any S3 storage.

Restore a backup:
```bash
gunzip -c deploy/backups/opencrm-2026-11-07.sql.gz | docker compose -f deploy/docker-compose.prod.yml --env-file .env exec -T db psql -U opencrm -d opencrm
```

## 7. Updating to a new version

```bash
cd /opt/open-crm
./deploy/backup.sh
git pull
docker compose -f deploy/docker-compose.prod.yml --env-file .env up -d --build
```

Database changes are applied automatically (Flyway) when the API starts. Website users get a
"new version available — Update" banner.

## 8. Point the apps at the server

| App | How |
|---|---|
| Android/iOS | `web/.env.mobile` → `VITE_API_URL=https://crm.yourcompany.in`, then `cd mobile && npm run sync:prod` and build in Android Studio (see README) |
| Desktop (Windows/Mac/Linux) | `cd desktop && set OPENCRM_API_URL=https://crm.yourcompany.in && npm run build` → installer in `desktop/release/` (PowerShell: `$env:OPENCRM_API_URL="https://…"`) |

## Option B: host from your own PC with a Cloudflare Tunnel (no server, no domain)

Good for testing and small teams. It only works while the PC is on and Docker Desktop is running.

1. Create `.env` as in step 4, but set `DOMAIN=:80` (Cloudflare provides the HTTPS).
2. Start it with the tunnel add-on:
   ```bash
   docker compose -f deploy/docker-compose.prod.yml -f deploy/docker-compose.tunnel.yml --env-file .env up -d --build
   docker compose -f deploy/docker-compose.prod.yml -f deploy/docker-compose.tunnel.yml logs tunnel | grep trycloudflare
   ```
   That prints the public link (`https://<random-words>.trycloudflare.com`).
3. A quick-tunnel link **changes whenever the tunnel container restarts** (PC reboot, `down`/`up`). For a permanent
   link: add your domain to a free Cloudflare account, go to Zero Trust → Networks → Tunnels → Create tunnel,
   add a public hostname `crm.yourcompany.in → http://web:80`, then put these in `.env` and run step 2 again:
   ```
   TUNNEL_TOKEN=<token shown by Cloudflare>
   TUNNEL_COMMAND=tunnel --no-autoupdate run
   ```
   Add `https://crm.yourcompany.in` to `CORS_ORIGINS` too, and use that URL for the mobile/desktop apps.

## AI assistant (optional)

Support agents and admins get an **AI assistant** card on every ticket: *Summarise ticket* and *Suggest a reply*
(English or Telugu, with optional guidance such as "offer a visit on Monday"). The AI only drafts text; the agent
checks it, edits it and sends it. Field staff do not see it.

**Option 1: local open-source model (default, free).** Runs [Ollama](https://ollama.com) next to the API.

```bash
docker compose -f deploy/docker-compose.prod.yml -f deploy/docker-compose.ai.yml --env-file .env up -d --build
docker compose -f deploy/docker-compose.prod.yml -f deploy/docker-compose.ai.yml exec ollama ollama pull qwen2.5:3b
```

(Add `-f deploy/docker-compose.tunnel.yml` too if you host with the tunnel.) `qwen2.5:3b` needs about 3 GB RAM and
takes roughly 20-60 s per answer on a laptop CPU. Its replies are basic and its Telugu is weak. With more RAM or a GPU, set
`OLLAMA_MODEL=qwen2.5:7b` in `.env` and pull that model instead.

**Option 2: Claude API (better answers and Telugu, paid, not open source).** In `.env`:

```
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...      # from console.anthropic.com
```

then `up -d` again. Ticket text is sent to Anthropic, so tell your team.

**Turn it off:** `AI_PROVIDER=none` (or leave out the ai add-on file).

For local development: install Ollama for Windows, run `ollama pull qwen2.5:3b`, and the API uses
`http://localhost:11434` automatically.

## Useful commands

```bash
docker compose -f deploy/docker-compose.prod.yml ps              # what is running
docker compose -f deploy/docker-compose.prod.yml logs -f --tail 100
docker compose -f deploy/docker-compose.prod.yml restart api
docker compose -f deploy/docker-compose.prod.yml down            # stop (data is kept in volumes)
```

## Security checklist

- [ ] Strong unique `DB_PASSWORD`, `JWT_SECRET`, `ADMIN_PASSWORD`; `.env` is never committed
- [ ] Only ports 22/80/443 open; SSH with keys, password login off (`PasswordAuthentication no`)
- [ ] `sudo apt-get install unattended-upgrades` for automatic security updates
- [ ] Backups run nightly **and** are copied off the server
- [ ] Map tiles: the public OpenStreetMap tile server is fine for a small team; for heavy use set `VITE_TILE_URL` to your own or a paid tile service (OSM tile usage policy)
