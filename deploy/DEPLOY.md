# Deploying to the Ubuntu app server

Topology for this deployment:

```
Browser ──HTTPS──► Apache (separate server, already configured) ──HTTP──► this Ubuntu box:3000 ──► remote MySQL "railway_central" (192.168.243.89)
```

This server only needs to run the Next.js app itself. TLS and the public domain are handled by the existing
Apache reverse proxy on the other machine; this box is never exposed directly to the internet.

## 1. One-time server setup

```bash
# Node.js 20 LTS (the app requires >= 20.19; Ubuntu's apt version is usually too old)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs git

node -v   # confirm >= 20.19

# Dedicated non-root user to run the app
sudo useradd --system --create-home --shell /usr/sbin/nologin slr
```

## 2. Get the code onto the server

Use a GitHub **deploy key** (repo-scoped, read-only) rather than a personal account token:

```bash
sudo -u slr ssh-keygen -t ed25519 -f /home/slr/.ssh/id_ed25519 -N ""
sudo -u slr cat /home/slr/.ssh/id_ed25519.pub
```

Add that public key on GitHub: **repo → Settings → Deploy keys → Add deploy key** (leave "Allow write access"
unchecked — it only needs to pull).

```bash
sudo mkdir -p /opt/railway-schedule-modern
sudo chown slr:slr /opt/railway-schedule-modern
sudo -u slr git clone git@github.com:ICTASL/railway-schedule-modern.git /opt/railway-schedule-modern
```

## 3. Database side (on 192.168.243.89, not this server)

The production database is `railway_central`, reached at `192.168.243.89`. There's already a general-purpose
account there (used by the CMS) — **do not put that account in this app's `DATABASE_URL`.** It has full
read/write access to everything, including the admin/session tables this app must never touch. Use it only
once, as an admin login, to create the dedicated read-only account below.

`db/readonly-user.sql` as committed targets a schema named `railway` and `'slr_search'@'localhost'`, which
matches a local dev setup, not this production DB. Copy it and adapt both before running it:

```bash
scp db/readonly-user.sql you@192.168.243.89:~/
ssh you@192.168.243.89
sed -i \
  -e "s/railway\./railway_central./g" \
  -e "s/'slr_search'@'localhost'/'slr_search'@'<this-app-server-ip>'/" \
  readonly-user.sql
cat readonly-user.sql   # double-check the substitutions before running

mysql -h 127.0.0.1 -u railuser -p railway_central < readonly-user.sql
```

Use a strong, unique password for `slr_search` — don't reuse `railuser`'s.

Also on the DB server:
- Confirm MySQL's `bind-address` allows connections from the app server (not just `127.0.0.1`).
- Firewall port 3306 to only accept connections from the app server's IP, not the open internet.
- Consider enabling TLS for this connection since credentials and query traffic now cross the network
  (`mysql2` supports it; the current `src/lib/db/pool.ts` doesn't pass SSL options yet — ask if you want that
  added before go-live).
- Worth doing when convenient: `railuser`'s password is currently the same as its username — rotate it when
  you get a chance, independent of this deployment.

## 4. Configure the app

```bash
sudo cp /opt/railway-schedule-modern/deploy/env.production.example /etc/railway-schedule-modern.env
sudo chown root:slr /etc/railway-schedule-modern.env
sudo chmod 640 /etc/railway-schedule-modern.env
sudo nano /etc/railway-schedule-modern.env   # set the real DATABASE_URL (host + password)
```

## 5. Build

```bash
cd /opt/railway-schedule-modern
sudo -u slr npm ci
sudo -u slr npm run build
```

## 6. Run it as a service

```bash
sudo cp deploy/railway-schedule-modern.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now railway-schedule-modern
sudo systemctl status railway-schedule-modern
journalctl -u railway-schedule-modern -f   # tail logs
```

The app now listens on `127.0.0.1:3000` (or whatever `PORT` you set).

## 7. Point the existing Apache proxy at it

On the *other* server (where Apache already runs), make sure its vhost proxies to this box's IP and port, e.g.:

```apache
<VirtualHost *:443>
    ServerName schedule.railway.gov.lk

    ProxyPreserveHost On
    ProxyPass / http://<this-app-server-ip>:3000/
    ProxyPassReverse / http://<this-app-server-ip>:3000/
    RequestHeader set X-Forwarded-Proto "https"
</VirtualHost>
```

Requires `mod_proxy`, `mod_proxy_http`, `mod_headers` (`sudo a2enmod proxy proxy_http headers`).

## 8. Firewall on this app server

Only the Apache server should be able to reach port 3000 — nothing else:

```bash
sudo ufw allow OpenSSH
sudo ufw allow from <apache-server-ip> to any port 3000 proto tcp
sudo ufw enable
sudo ufw status
```

## 9. Updating later

```bash
cd /opt/railway-schedule-modern
sudo -u slr git pull
sudo -u slr npm ci
sudo -u slr npm run build
sudo systemctl restart railway-schedule-modern
```

There's a brief restart gap (a few seconds); acceptable for this traffic level. Ask if you want a
zero-downtime setup (e.g. two instances behind Apache with a health check) later.

## Notes

- Backend failures currently render inline as HTTP 200 (see README "Known limits" #7) — an uptime check that
  only looks at the status code won't catch a database outage. Watch `journalctl -u railway-schedule-modern`,
  or ask for a `/api/health` route that actually checks the DB connection.
- Never run the app as root; the systemd unit and the clone above both use the dedicated `slr` user.
- Keep `/etc/railway-schedule-modern.env` out of git — it holds the real `DATABASE_URL` password.
