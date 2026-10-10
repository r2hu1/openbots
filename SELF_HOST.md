# Self-Hosting OpenBots

A complete guide to self-hosting OpenBots on your own infrastructure — whether locally, on a VPS (Ubuntu/Debian, Hetzner, DigitalOcean), or on bare-metal servers.

---

## Architecture Overview

When self-hosting OpenBots, your stack consists of:

1. **Web Frontend (`apps/web`)**: Next.js 16 app serving the user interface (Port `3000`).
2. **API Backend (`apps/api`)**: High-throughput Bun HTTP service powered by Hono (Port `3001`).
3. **PostgreSQL Database**: Stores agents, conversations, run execution steps, schedules, and user authentication tables.
4. **Storage (Supabase Storage or S3-compatible)**: Secure bucket for user uploads and multimodal image attachments.
5. **Durable Task Engine (Trigger.dev v4)**: Manages delayed execution, background agent tasks, and cron schedules.
6. **Cache / PubSub (Redis or Upstash Redis)**: Handles real-time event streaming and run pub/sub.

---

## 1. Prerequisites & System Requirements

### Hardware Requirements
- **Minimum**: 2 vCPUs, 2 GB RAM, 10 GB Disk (for personal / small team use)
- **Recommended**: 4 vCPUs, 8 GB RAM, 25 GB SSD (for multi-tenant or heavy background agent workloads)

### Software
- **[Bun](https://bun.sh/)** `>= 1.2.0` (required for monorepo workspace & runtime)
- **Node.js** `>= 20.0.0` (required for Next.js build steps)
- **Git**

---

## 2. Infrastructure Services Setup

### A. PostgreSQL Database
You can install PostgreSQL locally (`sudo apt install postgresql`) or use any managed PostgreSQL provider (Supabase, Neon, AWS RDS, Tembo, Railway):
```bash
# Example connection string
postgresql://openbots:your_secure_password@localhost:5432/openbots
```

### B. Storage (Supabase Storage)
OpenBots supports multimodal chat (uploading images, artifacts, and attachments):
1. Create a Supabase project at [supabase.com](https://supabase.com) (or self-host Supabase).
2. Create a storage bucket (e.g. `openbots` or `attachments`).
3. Copy your project URL, `anon` public key, and `service_role` secret key from **Project Settings > API**.

### C. Background Workflows (Trigger.dev v4)
Trigger.dev provides durable agent execution so long-running tasks never get cut off:
1. Sign up at [trigger.dev](https://trigger.dev) (Cloud) or self-host Trigger.dev v4.
2. Create a project and grab your:
   - `TRIGGER_PROJECT_REF` (e.g. `proj_abcdef...`)
   - `TRIGGER_SECRET_KEY` (e.g. `tr_dev_...` for dev, `tr_prod_...` for production)

### D. AI Model Providers
- Obtain an API key for **Google Gemini** at [Google AI Studio](https://aistudio.google.com/) (`GEMINI_API_KEY`).
- *(Optional)* Anthropic (`ANTHROPIC_API_KEY`) or OpenAI (`OPENAI_API_KEY`) if configuring agents with those models.

### E. Integrations (Composio - Optional)
- To enable agent access to 200+ external apps (Gmail, Slack, GitHub, Linear, Notion, etc.), get an API key from [Composio](https://app.composio.dev/) (`COMPOSIO_API_KEY`).

### F. Cloud Isolated Desktop (Browserbase - Optional)
To enable live web navigation, real-time interactive browser debugging, and Human-in-the-Loop (HITL) takeover:
1. Create an account at [Browserbase](https://www.browserbase.com/).
2. Grab your API key and Project ID from your dashboard.
3. Configure the environment variables:
   - `BROWSERBASE_API_KEY="bb_..."`
   - `BROWSERBASE_PROJECT_ID="proj_..."`
   - `BROWSERBASE_REGION="us-west-2"` (Optional: `us-west-2`, `us-east-1`, `eu-central-1`, or `ap-southeast-1`)

### G. Web Push Notifications (Optional)
OpenBots supports native desktop and mobile Web Push notifications for scheduled tasks and background reminders:
1. Generate a standard VAPID key pair:
   ```bash
   bunx web-push generate-vapid-keys
   ```
2. Set the generated public and private keys in `.env`:
   - `VAPID_SUBJECT="mailto:admin@your-domain.com"`
   - `NEXT_PUBLIC_VAPID_PUBLIC_KEY="BL..."`
   - `VAPID_PRIVATE_KEY="..."`

---

## 3. Installation & Configuration

### Step 1: Clone the Repository
```bash
git clone https://github.com/openbots-ai/openbots.git
cd openbots
bun install
```

### Step 2: Configure Environment Variables
Copy `.env.example` to `.env` in the root of the repository:

```bash
cp .env.example .env
```

Fill in the required variables:

```ini
# ==============================================================================
# Database
# ==============================================================================
DATABASE_URL="postgresql://openbots:your_secure_password@localhost:5432/openbots"

# ==============================================================================
# Storage (Supabase)
# ==============================================================================
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOi..."
SUPABASE_ANON_KEY="eyJhbGciOi..."

# ==============================================================================
# AI Provider Keys
# ==============================================================================
GEMINI_API_KEY="AIzaSy..."

# ==============================================================================
# Trigger.dev (Background Scheduling & Long-running Agents)
# ==============================================================================
TRIGGER_PROJECT_REF="proj_..."
TRIGGER_SECRET_KEY="tr_prod_..."

# ==============================================================================
# Better Auth (Session Management)
# ==============================================================================
# Generate a random 32-character string: openssl rand -base64 32
BETTER_AUTH_SECRET="your-32-character-secret-key-here"
BETTER_AUTH_URL="http://localhost:3001"

# ==============================================================================
# Server & Ports
# ==============================================================================
PORT=3001
NEXT_PUBLIC_API_URL="http://localhost:3001"

# ==============================================================================
# Optional Integrations
# ==============================================================================
COMPOSIO_API_KEY=""
UPSTASH_REDIS_REST_URL=""
UPSTASH_REDIS_REST_TOKEN=""

# Cloud Isolated Desktop (Browserbase)
BROWSERBASE_API_KEY=""
BROWSERBASE_PROJECT_ID=""
BROWSERBASE_REGION="us-west-2"

# ==============================================================================
# Web Push Notifications (Optional)
# ==============================================================================
VAPID_SUBJECT="mailto:admin@your-domain.com"
NEXT_PUBLIC_VAPID_PUBLIC_KEY="BL..."
VAPID_PRIVATE_KEY="..."
```

Also verify or set `apps/web/.env.local`:
```ini
NEXT_PUBLIC_API_URL="http://localhost:3001"
NEXT_PUBLIC_VAPID_PUBLIC_KEY="BL..."
```

---

## 4. Initialize Database Schema

OpenBots uses Drizzle ORM to manage database migrations and tables. Push the database schema directly to your PostgreSQL instance:

```bash
cd packages/db
bun run db:push
```

To explore or inspect your data visually via Drizzle Studio:
```bash
bun run db:studio
```

---

## 5. Running OpenBots

### Local / Development Mode
Run the entire stack with live reload via Turborepo:

```bash
# Start Web and API concurrently
bun run dev
```

In a separate terminal, run the Trigger.dev background task worker:
```bash
cd apps/api
bun run trigger:dev
```

Open your browser at `http://localhost:3000`.

---

## 6. Production Deployment

### Option A: Running with Process Managers (Systemd / PM2)

#### 1. Build All Packages
From the root repository:
```bash
bun run build
```

#### 2. Start API Service with PM2
```bash
pm2 start "bun apps/api/src/index.ts" --name "openbots-api"
```

#### 3. Start Next.js Web App
```bash
cd apps/web
pm2 start "bun run start" --name "openbots-web"
```

#### 4. Deploy Trigger.dev Worker
```bash
cd apps/api
bun run trigger:deploy
```

---

### Option B: Reverse Proxy Configuration (Nginx / Caddy)

For production, put OpenBots behind a reverse proxy to handle SSL (HTTPS), domain routing, and compression.

#### Caddy (Recommended - Automatic SSL)
```caddy
your-domain.com {
    # Reverse proxy Next.js frontend
    reverse_proxy localhost:3000
}

api.your-domain.com {
    # Reverse proxy Bun API
    reverse_proxy localhost:3001
}
```

#### Nginx
```nginx
# Web Frontend
server {
    server_name your-domain.com;
    listen 80;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

# API Server
server {
    server_name api.your-domain.com;
    listen 80;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## 7. Health Checks & Verification

After starting services, verify everything is responding:

1. **API Status**:
   ```bash
   curl http://localhost:3001/api/health
   # Returns 200 OK
   ```

2. **Web Interface**:
   Visit `http://localhost:3000` in your browser. You should be directed to the authentication or workspace view.

3. **Database Connectivity**:
   Check logs or run:
   ```bash
   cd packages/db && bun run db:studio
   ```

---

## 8. Backup and Maintenance

### PostgreSQL Database Backups
Schedule daily backups of your PostgreSQL database:
```bash
pg_dump -U openbots -d openbots -F c -b -v -f "/backups/openbots_$(date +%Y%m%d_%H%M%S).dump"
```

To restore from a dump:
```bash
pg_restore -U openbots -d openbots -v "/backups/openbots_backup.dump"
```

### Upgrading OpenBots
When pulling new updates from Git:
```bash
git pull origin main
bun install
bun run --filter @openbots/db db:push
bun run build
pm2 restart all
```

---

## Need Help?
- Check [DOCUMENTATION.md](file:///Users/r2hu1/Projects/openbots/DOCUMENTATION.md) for full architectural specifications.
- Join the community or open an issue on GitHub.
