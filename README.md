# OpenGym Super Admin

Next.js 14 admin dashboard for OpenGym — connected to your Supabase backend.

## Stack
- **Next.js 14** (App Router)
- **TypeScript**
- **Tailwind CSS**
- **Supabase JS v2** (service role — bypasses RLS)
- **Lucide React** icons

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Create `.env.local`
```bash
cp .env.local.example .env.local
```

Edit `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://plzubkqnqzyvopisxxls.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

Get your service role key from:
**Supabase Dashboard → Settings → API → service_role key**

### 3. Run
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Pages

| Route | Description |
|---|---|
| `/dashboard` | KPIs, pending payments, system health |
| `/gyms` | All gyms, verify RNE, set rating, soft delete |
| `/users` | All users, token adjustment |
| `/payments` | Confirm/reject payments by tab |
| `/tokens` | Full token ledger with filters |
| `/corporate` | Companies, subscriptions, seat management |
| `/analytics` | Platform-wide stats |
| `/monitoring` | Job logs, cron audit |

## API Routes (server-side, service role)

| Route | Methods |
|---|---|
| `/api/dashboard` | GET |
| `/api/gyms` | GET, PATCH |
| `/api/users` | GET |
| `/api/payments` | GET, PATCH |
| `/api/tokens` | GET, POST |
| `/api/corporate` | GET, POST |
| `/api/monitoring` | GET |
| `/api/analytics` | GET |

## Security
- All API routes use `SUPABASE_SERVICE_ROLE_KEY` (server-side only)
- The key is never exposed to the browser
- Add your own auth middleware in `src/middleware.ts` before deploying

## Deploy
```bash
npm run build
npm start
```

Or deploy to Vercel — set environment variables in the Vercel dashboard.
