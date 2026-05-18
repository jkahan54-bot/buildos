# BuildOS — Deployment Guide

## Step 1 — Set up Supabase (database + login)

1. Go to **supabase.com** → New project
2. Save your password somewhere
3. Go to **SQL Editor** → paste the entire contents of `supabase/migrations/001_initial.sql` → Run
4. Go to **Settings → API** and copy:
   - Project URL  
   - anon/public key  
   - service_role key (secret — keep safe)

## Step 2 — Set up GitHub

1. Go to **github.com** → New repository → name it `buildos`
2. Upload this entire `buildos-next` folder (drag & drop works)

## Step 3 — Deploy to Vercel

1. Go to **vercel.com** → Add New Project → Import from GitHub → select `buildos`
2. Add these Environment Variables:
   ```
   NEXT_PUBLIC_SUPABASE_URL         = (from step 1)
   NEXT_PUBLIC_SUPABASE_ANON_KEY    = (from step 1)
   SUPABASE_SERVICE_ROLE_KEY        = (from step 1)
   ANTHROPIC_API_KEY                = sk-ant-api03-...
   OPENAI_API_KEY                   = sk-...
   NEXT_PUBLIC_APP_URL              = https://your-project.vercel.app
   ```
3. Click Deploy — your site will be live at `https://buildos-xyz.vercel.app`

## Step 4 — Mobile App (Expo)

```bash
cd mobile
npm install
npx expo start
```

Install **Expo Go** on your phone and scan the QR code to preview.
For App Store / Google Play builds: `npx eas build --platform all`

## What's built

| Module | Features |
|--------|---------|
| Auth | Login, register, roles (owner/admin/office/field) |
| Dashboard | Real stats, charts, project list |
| Projects | Create, view, edit — standard + medical facility type |
| Safety | Report incidents, resolve, severity tracking |
| Time Log | Real clock in/out with live timer |
| AI Tools | BuildBot chat, Dual AI review, Email parser |
| Settings | Swap AI models (Claude Sonnet/Opus/Haiku + GPT-4o) |

## Coming next (Phase 2)
- Medical facility checklist (Excel import)
- Budget management with line items
- Team management
- Messages / WhatsApp integration
- RFIs
- Documents
- Mobile app (Expo)
