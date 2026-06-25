# Deployment Guide

This app needs **Node.js + MySQL** running together. It cannot run on plain HTML hosting (GitHub Pages, etc.).

---

## Option A — VPS (Recommended)

Best for full control. Works with **Hostinger VPS**, **DigitalOcean**, **Linode**, **AWS EC2**, etc.

**Cost:** ~$5–10/month

### What you need

- A VPS with Ubuntu 22.04
- A domain name (e.g. `yourdomain.com`)
- SSH access to the server

### Step 1 — Upload your project

On your **local PC**, zip the project (exclude `node_modules`):

```powershell
cd "c:\Users\sanum\Downloads"
# Upload via FileZilla/WinSCP, or use git:
```

**Or use Git on the server:**

```bash
# On the VPS
sudo apt update && sudo apt install -y git
git clone YOUR_REPO_URL /var/www/number-website
cd /var/www/number-website
```

### Step 2 — Install Node.js and MySQL on the VPS

```bash
# Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# MySQL
sudo apt install -y mysql-server
sudo mysql_secure_installation
```

### Step 3 — Create the database

```bash
sudo mysql -u root -p < /var/www/number-website/backend/database/schema.sql
```

Optional — use a limited database user (more secure):

```bash
# Edit secure-user.sql first — set a strong password
sudo mysql -u root -p < /var/www/number-website/backend/database/secure-user.sql
```

### Step 4 — Configure environment

```bash
cd /var/www/number-website/backend
cp .env.example .env
nano .env
```

Set these values for **production**:

```env
PORT=3000
NODE_ENV=production

DB_HOST=localhost
DB_PORT=3306
DB_USER=number_app
DB_PASSWORD=YOUR_STRONG_DB_PASSWORD
DB_NAME=number_display

ADMIN_USERNAME=admin
ADMIN_PASSWORD_HASH=PASTE_BCRYPT_HASH_HERE

JWT_SECRET=PASTE_32_PLUS_RANDOM_CHARACTERS_HERE

ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

Generate password hash **on your PC or server**:

```bash
cd backend
npm install
npm run hash-password -- YourStrongAdminPassword123
```

Copy the hash into `.env` as `ADMIN_PASSWORD_HASH`. **Remove** `ADMIN_PASSWORD` from `.env`.

Generate JWT secret:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### Step 5 — Install and start the app

```bash
cd /var/www/number-website/backend
npm install --production
npm start
```

Test: visit `http://YOUR_SERVER_IP:3000`

### Step 6 — Keep it running with PM2

```bash
sudo npm install -g pm2
cd /var/www/number-website/backend
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### Step 7 — Nginx reverse proxy + HTTPS

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
```

Create `/etc/nginx/sites-available/number-website`:

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/number-website /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

Free SSL certificate:

```bash
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

### Step 8 — Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

### Your live URLs

| Page | URL |
|------|-----|
| Main site | `https://yourdomain.com` |
| Admin login | `https://yourdomain.com/admin/login.html` |

---

## Option B — Railway (Easier, no server management)

**Cost:** ~$5/month (includes MySQL addon)

1. Push your project to **GitHub**
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Add a **MySQL** service in the same project
4. Set **Root Directory** to `backend` (or set start command)
5. Add environment variables from `.env.example`:
   - `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` — copy from Railway MySQL variables
   - `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH`, `JWT_SECRET`, `NODE_ENV=production`
   - `ALLOWED_ORIGINS=https://your-app.up.railway.app`
6. Set **Start Command:** `node server.js`
7. Railway gives you a public URL like `https://your-app.up.railway.app`

> Note: Upload the **whole project** (not just backend) so static files are served. Set working directory to `backend` but ensure `server.js` static path still finds parent folder — it already uses `path.join(__dirname, '..')` ✓

---

## Option C — Render

Similar to Railway:

1. [render.com](https://render.com) → New **Web Service** from GitHub
2. **Root Directory:** `backend`
3. **Build Command:** `npm install`
4. **Start Command:** `node server.js`
5. Add **MySQL** from Render or use an external DB (PlanetScale, Railway MySQL)
6. Set all `.env` variables in the Render dashboard

---

## Before going live — checklist

- [ ] `NODE_ENV=production`
- [ ] Strong `JWT_SECRET` (32+ random characters)
- [ ] `ADMIN_PASSWORD_HASH` set (no plain password in `.env`)
- [ ] Strong admin password (8+ characters)
- [ ] `ALLOWED_ORIGINS` set to your real domain
- [ ] MySQL not exposed to the public internet (localhost only)
- [ ] HTTPS enabled (SSL certificate)
- [ ] PM2 or similar process manager running
- [ ] Change default username/password from `admin` / `admin123`

---

## Updating after deployment

```bash
cd /var/www/number-website
git pull
cd backend
npm install --production
pm2 restart number-website
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Site not loading | Check `pm2 status` and `pm2 logs number-website` |
| Database error | Verify MySQL is running: `sudo systemctl status mysql` |
| Login fails | Check `ADMIN_PASSWORD_HASH` in `.env`, restart app |
| CORS error | Add your domain to `ALLOWED_ORIGINS` in `.env` |
| 502 Bad Gateway | App not running on port 3000 — restart PM2 |

---

## Files to NEVER upload publicly

- `backend/.env` (secrets)
- `node_modules/` (reinstall on server)

Your `.gitignore` already excludes these if you use Git.
