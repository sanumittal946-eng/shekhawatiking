# Number Display Website — shekhawatiking

A modern, responsive website that displays a large animated number on a premium black card, with automatic scheduled updates at **12:00 PM** and **8:00 PM** daily. Powered by a **Node.js + MySQL** backend with **bcrypt-hashed** admin credentials.

## Features

- Large animated yellow number with flip animation on change
- Live red countdown timer to the next scheduled update
- Automatic number switching at 12:00 PM and 8:00 PM
- Admin dashboard to set today's numbers with live preview
- **MySQL database** for persistent number storage
- **Secure admin auth** — credentials set in backend `.env`, stored as bcrypt hashes in MySQL
- JWT session tokens for admin dashboard access
- Responsive design for desktop, tablet, and mobile

## Folder Structure

```
number website/
├── index.html                  # Public number display
├── admin/
│   ├── login.html              # Admin login
│   └── dashboard.html          # Admin dashboard
├── css/
│   ├── main.css
│   └── admin.css
├── js/
│   ├── api-config.js           # API base URL
│   ├── utils.js                # Schedule & date helpers
│   ├── data-service.js         # API client
│   ├── app.js
│   ├── admin-login.js
│   └── admin-dashboard.js
└── backend/
    ├── server.js               # Express server + static files
    ├── package.json
    ├── .env.example
    ├── config/db.js            # MySQL connection pool
    ├── middleware/auth.js      # JWT verification
    ├── routes/
    │   ├── auth.js             # Login (bcrypt verify)
    │   └── numbers.js          # Number CRUD API
    ├── database/schema.sql     # MySQL tables
    └── scripts/
        ├── seed-admin.js       # Seeds admin with hashed password
        └── hash-password.js    # Generate bcrypt hash
```

## Deploying to production

See **[DEPLOY.md](DEPLOY.md)** for full step-by-step instructions.

**Quick summary:**
1. Get a **VPS** (DigitalOcean, Hostinger) or use **Railway/Render**
2. Install **Node.js + MySQL** on the server
3. Upload your project and run `npm install` in `backend/`
4. Configure `backend/.env` with production secrets
5. Use **PM2** to keep the app running
6. Use **Nginx + Certbot** for HTTPS on your domain

**Live URLs after deploy:**
- Main site: `https://yourdomain.com`
- Admin: `https://yourdomain.com/admin/login.html`

## Setup Instructions

### 1. Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [MySQL](https://www.mysql.com/) 8.0+

### 2. Create the Database

```bash
mysql -u root -p < backend/database/schema.sql
```

### 3. Configure Environment

```bash
cd backend
copy .env.example .env    # Windows
# cp .env.example .env  # Mac/Linux
```

Edit `backend/.env`:

```env
PORT=3000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=number_display

ADMIN_USERNAME=admin
ADMIN_PASSWORD=your_secure_password

JWT_SECRET=your_long_random_secret_key_at_least_32_characters
```

> On first startup, the server **hashes** `ADMIN_PASSWORD` with bcrypt (12 rounds) and stores only the hash in MySQL. The plain password is never saved to the database.

### 4. Install & Run

```bash
cd backend
npm install
npm start
```

Open **http://localhost:3000**

- Main display: `http://localhost:3000/`
- Admin login: `http://localhost:3000/admin/login.html`

### 5. Production Password Hashing

For production, do **not** keep the plain password in `.env`. Generate a bcrypt hash instead:

```bash
cd backend
npm run hash-password -- your_secure_password
```

Copy the output into `.env`:

```env
ADMIN_PASSWORD_HASH=$2a$12$...
```

Remove `ADMIN_PASSWORD` from `.env`. Restart the server to update the hash in MySQL.

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/health` | No | Server & DB health check |
| GET | `/api/numbers/current` | No | Current display number |
| GET | `/api/numbers/today` | No | Today's 12 PM & 8 PM numbers |
| GET | `/api/numbers/history` | Yes | Saved number history, newest first |
| PUT | `/api/numbers/today` | Yes | Save today's numbers |
| POST | `/api/auth/login` | No | Admin login → JWT token |
| GET | `/api/auth/me` | Yes | Verify session |
| POST | `/api/auth/logout` | Yes | End session |

## How Admin Auth Works

1. Admin email and password are configured in `backend/.env`
2. On startup, `seed-admin.js` bcrypt-hashes the password and stores it in the `admins` table
3. Login compares the submitted password against the stored hash — plain text is never stored
4. On success, a JWT token is returned and stored in the browser session
5. Protected routes require `Authorization: Bearer <token>`

## Schedule Logic

| Current Time | Displayed Number | Countdown To |
|---|---|---|
| Before 12:00 PM | Yesterday's 8 PM # | Today 12:00 PM |
| 12:00 PM – 7:59 PM | Today's 12 PM # | Today 8:00 PM |
| After 8:00 PM | Today's 8 PM # | Tomorrow 12:00 PM |

## Security — How Your Database Is Protected

| Protection | What it does |
|------------|----------------|
| **Bcrypt hashing** | Passwords are never stored in plain text — only a 12-round bcrypt hash in MySQL |
| **Username login** | Admin logs in with username + password (no email) |
| **JWT tokens** | 8-hour session tokens; admin routes require a valid token |
| **Rate limiting** | Blocks brute-force: max 20 login requests per 15 min per IP |
| **Login lockout** | After 5 wrong passwords, IP is locked for 15 minutes |
| **Safe errors** | Server returns `"Invalid username or password"` — never reveals if username exists |
| **SQL injection** | All queries use parameterized statements (no raw user input in SQL) |
| **HTTP headers** | Helmet adds XSS, clickjacking, and MIME-sniffing protection |
| **Request size limit** | JSON body capped at 10 KB |
| **CORS** | Only allowed origins can call the API |
| **Limited DB user** | Production: use `secure-user.sql` — app user can only SELECT/INSERT/UPDATE |

### Production checklist

1. Set a strong `JWT_SECRET` (32+ random characters) in `.env`
2. Set `NODE_ENV=production`
3. Run `backend/database/secure-user.sql` and use `DB_USER=number_app` (not root)
4. Set `ADMIN_PASSWORD_HASH` instead of plain `ADMIN_PASSWORD`
5. Use a strong admin password (8+ characters)
6. Do not expose phpMyAdmin publicly on the internet

## Accessing the Database (phpMyAdmin)

Since you use **XAMPP**, you can view and edit the database in your browser:

1. Start **Apache** and **MySQL** in the XAMPP Control Panel
2. Open **http://localhost/phpmyadmin**
3. Click the **`number_display`** database on the left
4. Tables:
   - **`daily_numbers`** — saved 12 PM and 8 PM numbers per date
   - **`admins`** — admin email and bcrypt password hash (never plain text)

| Table | Columns |
|-------|---------|
| `daily_numbers` | `date_key`, `noon`, `four_pm` (8 PM slot), `updated_at` |
| `admins` | `username`, `password_hash` (bcrypt — never plain text) |

## Change Admin Password

**Option 1 — Dashboard (recommended):**
1. Log in at http://localhost:3000/admin/login.html
2. Click **Change Password** at the bottom of the dashboard
3. Enter current password, new password, and confirm

**Option 2 — Command line:**
```bash
cd backend
npm run hash-password -- your_new_password
```
Copy the hash into `backend/.env` as `ADMIN_PASSWORD_HASH=...`, remove `ADMIN_PASSWORD`, restart the server.

## Troubleshooting Admin Login

| Problem | Solution |
|---------|----------|
| Login button does nothing | Open **http://localhost:3000/admin/login.html** (not the HTML file directly) |
| "Backend server is not running" | Run `cd backend && npm start` |
| "Invalid username or password" | Default: username `admin` / password `admin123` |
| Dashboard redirects to login | Clear browser session: F12 → Application → Session Storage → clear |
| MySQL error on start | Start MySQL in XAMPP Control Panel |

## License

MIT
