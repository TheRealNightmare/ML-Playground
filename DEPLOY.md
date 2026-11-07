# Deploying ML Playground on Dokploy

This guide hosts the site at **https://ml.mirazulislamnahid.com** on a Raspberry Pi running **Dokploy**, reached from the internet through a **Cloudflare Tunnel** that already routes `*.mirazulislamnahid.com` to the Pi.

```
Browser ──HTTPS──▶ Cloudflare edge ──Tunnel──▶ cloudflared on the Pi ──HTTP:80──▶ Traefik (Dokploy) ──▶ ml-playground container (nginx :80)
```

Cloudflare handles HTTPS. Inside the Pi everything is plain HTTP, so **HTTPS stays off in Dokploy** for this app.

---

## What's in the repo

| File | What it does |
|---|---|
| `Dockerfile` | Two stages: `node:22-alpine` runs `npm ci` + `npm run build`, then `nginx:1.27-alpine` serves `dist/`. Both images are multi-arch, so it builds natively on the Pi (arm64). Includes a Docker `HEALTHCHECK`. |
| `nginx.conf` | Serves the static site on port 80. `index.html` is never cached; hashed files in `/assets/` are cached for a year; gzip on; basic security headers; `GET /healthz` returns `ok`. |
| `.dockerignore` | Keeps `node_modules`, `.git`, screenshots and docs out of the build context. |
| `.github/workflows/build.yml` | On every push: builds the site, then builds and smoke-tests the **arm64** Docker image (like the Pi) under QEMU. You get a ✓ or ✗ on each commit. |

---

## 1 · Check the tunnel and DNS (one-time)

Your tunnel already has a wildcard route, so nothing new is needed here. Just confirm these three things:

1. **Zero Trust → Networks → Tunnels → MiraDock → Public Hostnames** has a row like:

   | Subdomain | Domain | Service |
   |---|---|---|
   | `*` | `mirazulislamnahid.com` | `http://localhost:80` *(or wherever Traefik listens on the Pi)* |

2. **DNS → Records** has a proxied (orange cloud) record:

   | Type | Name | Target |
   |---|---|---|
   | CNAME | `*` | `<tunnel-id>.cfargotunnel.com` |

   There should be **no separate `ml` record** pointing somewhere else. A specific record always beats the wildcard.

3. **Zero Trust → Access → Applications**: the Access policy that protects the Dokploy panel must cover only the panel's hostname, **not** `*.mirazulislamnahid.com`. Otherwise visitors to `ml.` would get a Cloudflare login screen.

> Cloudflare's free Universal SSL certificate covers `*.mirazulislamnahid.com` (one level deep), so `ml.mirazulislamnahid.com` gets HTTPS automatically. A name like `a.b.mirazulislamnahid.com` would not.

---

## 2 · Create the application in Dokploy

1. Open the Dokploy panel → **Projects** → create a project, e.g. `ML Playground` (or reuse one).
2. Inside it: **Create Service → Application**. Name: `ml-playground`.
3. **General → Provider**: choose **GitHub** (your GitHub App is already connected).
   - Repository: `TheRealNightmare/ML-Playground`
   - Branch: `main`
   - Build path: `/`
   - Click **Save**.
4. **General → Build Type**: choose **Dockerfile**.
   - Docker File: `Dockerfile`
   - Docker Context Path: `.`
   - Docker Build Stage: *(leave empty)*
   - Click **Save**.
5. **Domains → Add Domain**:

   | Field | Value |
   |---|---|
   | Host | `ml.mirazulislamnahid.com` |
   | Path | `/` |
   | Container Port | `80` |
   | HTTPS | **Off** |
   | Certificate | None |

   Click **Create**. *(HTTPS is off because Cloudflare already terminates TLS. Turning it on here makes Traefik redirect to HTTPS, which loops behind the tunnel.)*
6. Optional, recommended on a Pi: **Advanced → Resources**: Memory limit `256 MB`, CPU limit `0.5`. nginx serving static files uses far less than this.
7. Click **Deploy** (top right). Watch **Deployments → logs**. The first build takes a few minutes on the Pi (downloading images + `npm ci`); later builds reuse cached layers unless `package-lock.json` changed.
8. **General → Autodeploy**: turn it **on**. With the GitHub App, every push to `main` now triggers a deploy automatically.

---

## 3 · Verify

From any computer:

```bash
curl -I https://ml.mirazulislamnahid.com          # expect: HTTP/2 200, cache-control: no-cache
curl https://ml.mirazulislamnahid.com/healthz      # expect: ok
```

Then open **https://ml.mirazulislamnahid.com** in a browser and try `#/kmeans`.

On the Pi (optional):

```bash
docker ps --filter name=ml-playground --format '{{.Names}}  {{.Status}}'   # should say (healthy)
```

---

## 4 · Everyday workflow

```bash
git add -A && git commit -m "Add Decision Tree page" && git push
```

1. GitHub Actions runs **Build check** (✓ / ✗ next to the commit on GitHub).
2. Dokploy receives the push and rebuilds on the Pi.
3. Refresh the site. Because `index.html` is never cached, the new version shows up right away.

Rollback: in Dokploy → **Deployments**, pick an earlier successful deployment and redeploy it, or `git revert` the bad commit and push.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Cloudflare **error 1033** | The tunnel is down. | On the Pi: `sudo systemctl status cloudflared` (or check the cloudflared container in Dokploy) and restart it. |
| Cloudflare **error 502 / 504** | The tunnel works, but Traefik isn't answering on the address the wildcard route points to. | Check the wildcard's service URL (e.g. `http://localhost:80`) and that Traefik is running: `docker ps \| grep traefik`. |
| **404 page not found** (plain Traefik text) | Traefik doesn't know the hostname. | Check the domain in Dokploy is exactly `ml.mirazulislamnahid.com`, then redeploy. |
| **Bad Gateway** from Traefik | The container is down or the port is wrong. | Container Port must be `80`. Check the app's logs in Dokploy. |
| **Too many redirects** | HTTPS was turned on for the domain in Dokploy. | Edit the domain → HTTPS **off** → save → redeploy. Also make sure Cloudflare **SSL/TLS** mode isn't *Flexible* with an HTTPS redirect inside. |
| A **Cloudflare Access login** appears | An Access policy covers the wildcard. | Limit the policy to the Dokploy panel hostname only. |
| Build fails at `npm ci` | Usually a network hiccup on the Pi, or a lockfile mismatch. | Redeploy. If it keeps failing, run `npm install` locally, commit `package-lock.json`, push. |
| Build killed / very slow | Low memory during the build. | The Pi 4 8 GB is fine; if you run many builds at once, deploy one at a time or add swap. |
| Old version after deploy | Browser cache from before the nginx cache headers. | Hard refresh once (Ctrl/Cmd + Shift + R). |

---

## Running the container anywhere else

```bash
docker build -t ml-playground .
docker run -d --name ml-playground -p 8080:80 --restart unless-stopped ml-playground
# open http://localhost:8080
```
