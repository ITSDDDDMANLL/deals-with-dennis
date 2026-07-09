import { cookies } from "next/headers";
import { AdminInventoryManager } from "./AdminInventoryManager";
import { AdminLogin } from "./AdminLogin";
import { getFeaturedVehicles } from "../data/inventory";
import { getAdminCookieName, isAdminSessionValueValid } from "../../lib/admin-auth";
import { getInventoryVehicles } from "../../lib/inventory-store";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const cookieStore = await cookies();
  const isAuthenticated = isAdminSessionValueValid(
    cookieStore.get(getAdminCookieName())?.value,
  );
  const vehicles = isAuthenticated
    ? await getInventoryVehicles(getFeaturedVehicles(), { includeHidden: true })
    : [];

  return (
    <main className="admin-page">
      <header className="site-header">
        <nav className="nav-shell" aria-label="Admin navigation">
          <a className="brand" href="/">
            Dennis Liu <span>Inventory Admin</span>
          </a>
          <div className="nav-links">
            <a href="/">Public Site</a>
            <a className="nav-cta" href="/#inventory">
              View Inventory
            </a>
          </div>
        </nav>
      </header>

      <div className="page-shell">
        {isAuthenticated ? (
          <>
            <section className="admin-hero">
              <div>
                <p className="eyebrow">Private workspace</p>
                <h1>Inventory management</h1>
              </div>
              <p>
                Manage the vehicles that should appear on the public website.
                Changes save to Supabase when environment variables are set.
              </p>
            </section>

            <AdminInventoryManager initialVehicles={vehicles} />
          </>
        ) : (
          <AdminLogin />
        )}
      </div>
    </main>
  );
}
