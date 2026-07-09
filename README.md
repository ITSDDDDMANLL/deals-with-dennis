# Deals with Dennis

Personal sales consultant website for Dennis Liu at Cam Clark Ford Richmond.

## Stack

- Next.js
- Vercel hosting
- Supabase for inventory/contact persistence
- GitHub for source control

## Local Development

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:3000`.

## Data

Used inventory is currently generated from the dealership `.xls` pricing export into:

```text
app/data/used-inventory.json
```

The extraction helper is:

```text
work/extract_used_inventory.py
```

The long-term path is to replace this static JSON with Supabase-backed inventory or an API adapter.

## Deployment

See `docs/deployment.md`.
