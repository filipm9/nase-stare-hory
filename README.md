# Naše Staré Hory

Domáca aplikácia pre správu domu na Starých Horách. Aktuálne obsahuje modul na sledovanie spotreby vody a detekciu únikov z VAS Smart API.

## Funkcie

- 📊 **Dashboard so spotrebou** - Interaktívne grafy s históriou spotreby
- 🚨 **Detekcia únikov** - Automatické upozornenia na anomálie
- 📧 **Email notifikácie** - Alerty priamo do mailu cez Resend
- 🔄 **Automatická synchronizácia** - Cron endpoint pre Railway

## Detekcia únikov

Systém kontroluje:
- 🌙 **Nočná spotreba** (2-5h) - mala by byť ~0
- 📈 **Náhle skoky** - spotreba > 2.5x priemer
- 🚰 **Nepretržitý prietok** - voda tečie > 18 hodín
- 📊 **Vysoká denná spotreba** - > 1.8x mesačný priemer
- 🥶 **Riziko zamrznutia** - teplota < 5°C

## Quick Start

### 1. Nastavenie environment variables

```bash
cp .env.example .env
# Vyplňte hodnoty v .env
```

### 2. Spustenie s Dockerom

```bash
docker compose up --build
```

Aplikácia beží na:
- Frontend: http://localhost:5173
- Backend: http://localhost:4000

### 3. Prihlásenie

Default credentials (zmeňte po prvom prihlásení!):
- **Email**: `admin@admin.com`
- **Heslo**: `changeme`

Nových používateľov môžete vytvoriť v **Nastavenia** tab po prihlásení.

### 3. Lokálny development (bez Dockeru)

```bash
# Inštalácia závislostí
make install

# Spustenie PostgreSQL (potrebujete mať lokálne alebo cez Docker)
docker compose up -d db

# Spustenie dev serverov
make dev
```

## Railway Deployment

### Environment Variables

Nastavte v Railway tieto premenné:

```
DATABASE_URL=<railway-postgres-url>
JWT_SECRET=<random-secure-string>
SESSION_NAME=app_session
COOKIE_SECURE=true
COOKIE_SAMESITE=none
CORS_ORIGIN=<your-frontend-url>
VAS_API_URL=https://crm.vodarenska.cz:65000
VAS_USERNAME=<your-vas-email>
VAS_PASSWORD=<your-vas-password>
VAS_CLIENT_ID=<your-client-id>
VAS_CLIENT_SECRET=<your-client-secret>
RESEND_API_KEY=<your-resend-api-key>
ALERT_EMAIL=filip.muller22@gmail.com
CRON_SECRET=<random-secret-for-cron>
```

### Cron Job

Pre automatickú synchronizáciu nastavte v Railway cron job:

```bash
# Každú hodinu
curl -X POST https://your-backend.railway.app/cron/sync \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

Alebo použite Railway Cron service s endpoint: `POST /cron/sync`

## API Endpoints

### Public
- `GET /health` - Health check
- `POST /auth/login` - Prihlásenie (nastaví httpOnly cookie)
- `POST /auth/logout` - Odhlásenie (vymaže cookie)

### Protected (vyžaduje httpOnly session cookie)
- `GET /auth/me` - Info o používateľovi
- `GET /water/meters` - Zoznam vodomerov
- `GET /water/meters/:id/readings` - Merania
- `GET /water/meters/:id/stats` - Štatistiky
- `POST /water/sync` - Manuálna synchronizácia
- `POST /water/sync/historical` - Stiahnuť historické dáta
- `POST /water/detect-leaks` - Spustiť detekciu únikov
- `GET /alerts` - Zoznam alertov
- `PATCH /alerts/:id/read` - Označiť ako prečítané

### Cron (chránené Bearer token - CRON_SECRET)
- `POST /cron/sync` - Synchronizácia pre cron job
- `GET /cron/health` - Health check pre monitoring

## Security

- JWT tokeny uložené v **httpOnly cookies** (nie localStorage)
- Heslá hashované cez **bcryptjs**
- **Helmet** pre HTTP security headers
- **Rate limiting** (200 req/5min)
- **CORS** s explicitným origin
- Parameterized SQL queries (SQL injection prevention)

## Tech Stack

- **Backend**: Node.js, Express, PostgreSQL
- **Frontend**: React, Vite, Tailwind CSS, Recharts
- **Email**: Resend
- **Deployment**: Railway
