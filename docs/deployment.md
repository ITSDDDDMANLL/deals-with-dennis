# Deployment

This project is set up for the same deployment path as Clients in Hands:

1. Commit the code to GitHub.
2. Import the GitHub repository into Vercel as a Next.js project.
3. Create a Supabase project and run the SQL in `supabase/migrations`.
4. Add these environment variables in Vercel:
   - `NEXT_PUBLIC_SITE_URL`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SUPABASE_VEHICLE_IMAGE_BUCKET` (`vehicle-images` by default)
   - `ADMIN_PASSWORD`
   - `ADMIN_SESSION_SECRET`
5. Deploy on Vercel.
6. After the domain is purchased, add it in Vercel Project Settings > Domains.

Until Supabase environment variables are present, the contact form and admin inventory save return local success responses without writing to a database.

## Admin

The private admin page is available at `/admin`.

- `ADMIN_PASSWORD` protects the page and admin API routes.
- `ADMIN_SESSION_SECRET` signs the browser session cookie.
- Inventory saves to Supabase when `SUPABASE_SERVICE_ROLE_KEY` is present.
- Without Supabase env vars, the admin can still edit a browser-local draft for testing.
- Each vehicle supports up to 20 images. Local development returns data URLs; production uploads to the Supabase Storage bucket configured by `SUPABASE_VEHICLE_IMAGE_BUCKET`.

Do not deploy a shared preview without setting `ADMIN_PASSWORD`. Local
development accepts `local-admin` only when `ADMIN_PASSWORD` is missing.

Recommended order before sharing a remote preview:

1. Set `ADMIN_PASSWORD` in Vercel.
2. Set `ADMIN_SESSION_SECRET` in Vercel.
3. Deploy the preview.
4. Open `/admin` and sign in.
5. Add Supabase env vars when remote inventory persistence is ready.
