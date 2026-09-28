# 🚀 Deploying Serp-Scout to Northflank

This guide provides step-by-step instructions to deploy **Serp-Scout** to [Northflank](https://northflank.com/) with high availability, managed PostgreSQL and Redis, and automated container builds.

---

## 🏗️ Architecture Overview

Serp-Scout runs as two deployment services and two managed addons in a single Northflank project:

```
Northflank Project
├── Addons
│   ├── PostgreSQL 16 (Port 5432)  -> Persistent database
│   └── Redis 7 (Port 6379)        -> BullMQ worker queues & scheduling
└── Services
    ├── serp-scout-api (Port 3001) -> Express backend & Puppeteer report engine (Dockerfile.api)
    └── serp-scout-web (Port 3000) -> Next.js 14 frontend web app (Dockerfile.web)
```

---

## 📋 Prerequisites

Before starting, ensure you have:
1. A **[Northflank Account](https://app.northflank.com/)**.
2. Your repository pushed to GitHub or GitLab.
3. API Keys:
   - **Clerk**: `CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` (from [dashboard.clerk.com](https://dashboard.clerk.com)).
   - **SerpApi**: `SERPAPI_KEY` (from [serpapi.com](https://serpapi.com)).
   - **Groq AI**: `GROQ_API_KEY` (from [console.groq.com](https://console.groq.com)).
   - *(Optional)* **Resend**: `RESEND_API_KEY` (for scheduled email digest dispatching).

---

## 🛠️ Step 1: Create a Project & Provision Addons

1. In Northflank, click **Create Project** → Name it `serp-scout`.
2. **Create PostgreSQL Addon**:
   - Go to **Addons** → **Create Addon** → Select **PostgreSQL**.
   - Name: `serp-scout-postgres`.
   - Version: `16`.
   - Click **Deploy Addon**.
3. **Create Redis Addon**:
   - Click **Create Addon** → Select **Redis**.
   - Name: `serp-scout-redis`.
   - Version: `7`.
   - Click **Deploy Addon**.

---

## ⚙️ Step 2: Deploy the Backend API (`serp-scout-api`)

1. In your project, click **Create Service** → **Deployment Service**.
2. Name: `serp-scout-api`.
3. Source: Select **Git Repository** and link your Serp-Scout repository.
4. **Build Settings**:
   - Build Type: **Dockerfile**.
   - Dockerfile path: `Dockerfile.api`.
   - Context: `/` (Root directory).
5. **Networking**:
   - Port: `3001` (HTTP).
   - Public access: **Enabled** (e.g. `https://api.yourdomain.com` or `https://serp-scout-api--[project].northflank.app`).
   - Health check path: `/health`.
6. **Environment Variables**:
   Add the following variables under the **Environment** tab:

   | Key | Value / Source |
   | :--- | :--- |
   | `NODE_ENV` | `production` |
   | `PORT` | `3001` |
   | `DATABASE_URL` | Select **Link Secret** → `serp-scout-postgres` → `POSTGRES_URI` |
   | `REDIS_URL` | Select **Link Secret** → `serp-scout-redis` → `REDIS_URI` |
   | `CLERK_PUBLISHABLE_KEY` | `pk_test_...` (or `pk_live_...`) |
   | `CLERK_SECRET_KEY` | `sk_test_...` (or `sk_live_...`) |
   | `SERPAPI_KEY` | Your SerpApi Key |
   | `GROQ_API_KEY` | Your Groq API Key |
   | `GROQ_MODEL` | `llama-3.3-70b-versatile` |
   | `FRONTEND_URL` | `https://serp-scout-web--[project].northflank.app` (your web service domain) |

7. Click **Create Service**.

---

## 🗄️ Step 3: Run Database Migrations

Once the `serp-scout-api` service has finished its initial build:

1. Go to **serp-scout-api** in Northflank.
2. Click **Exec** / **Terminal** on the running container.
3. Run the Drizzle database push command:
   ```bash
   pnpm --filter @serp-scout/db db:push
   ```
4. Verify the console prints:
   `✓ Applying migrations... Done.`

---

## 🌐 Step 4: Deploy the Web Frontend (`serp-scout-web`)

1. Click **Create Service** → **Deployment Service**.
2. Name: `serp-scout-web`.
3. Source: Select the same Git Repository.
4. **Build Settings**:
   - Build Type: **Dockerfile**.
   - Dockerfile path: `Dockerfile.web`.
   - Context: `/` (Root directory).
5. **Networking**:
   - Port: `3000` (HTTP).
   - Public access: **Enabled** (this is your customer-facing domain).
6. **Environment Variables**:
   Add the following variables under the **Environment** tab:

   | Key | Value |
   | :--- | :--- |
   | `NODE_ENV` | `production` |
   | `PORT` | `3000` |
   | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `pk_test_...` (or `pk_live_...`) |
   | `CLERK_SECRET_KEY` | `sk_test_...` (or `sk_live_...`) |
   | `NEXT_PUBLIC_API_URL` | Your public API service URL from Step 2 (e.g. `https://serp-scout-api--[project].northflank.app`) |
   | `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | `/sign-in` |
   | `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | `/sign-up` |
   | `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL` | `/app` |
   | `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL` | `/app` |

7. Click **Create Service**.

---

## 🔐 Step 5: Configure Clerk Allowed Domains

1. Open your [Clerk Dashboard](https://dashboard.clerk.com/).
2. Select your application → **Configure** → **Paths & Allowed Origins**.
3. Add your production Northflank web URL (e.g. `https://serp-scout-web--[project].northflank.app` and any custom domains).
4. Save changes.

---

## ✅ Post-Deployment Health Check

Verify your deployment by testing the endpoints:

1. **API Health Check**:
   ```bash
   curl https://serp-scout-api--[project].northflank.app/health
   # Expected response: {"status":"ok","service":"serp-scout-api","environment":"production",...}
   ```

2. **Web Frontend**:
   Visit `https://serp-scout-web--[project].northflank.app/` in your browser.
   - Test Sign Up and Sign In.
   - Run a test scan for a local business.
   - Inspect the **Local Geo-Grid Heatmap** and **Generative AI Radar**.
