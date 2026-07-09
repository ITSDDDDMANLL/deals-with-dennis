import { InventoryBrowser } from "../components/InventoryBrowser";
import { getFeaturedVehicles } from "../data/inventory";
import { getInventoryVehicles } from "../../lib/inventory-store";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const vehicles = await getInventoryVehicles(getFeaturedVehicles(), {
    includeHidden: true,
  });
  const publicVehicles = vehicles.filter((vehicle) => vehicle.status !== "sold");

  return (
    <main>
      <header className="site-header">
        <nav className="nav-shell" aria-label="Inventory navigation">
          <a className="brand" href="/">
            Deals with Dennis <span>Full Inventory</span>
          </a>
          <div className="nav-links">
            <a href="/">Featured</a>
            <a href="/inventory">Full Inventory</a>
            <a href="/admin">Admin</a>
            <a className="nav-cta" href="/#contact">
              Book a Visit
            </a>
          </div>
        </nav>
      </header>

      <div className="page-shell inventory-page-shell">
        <section className="inventory-page-head">
          <div>
            <p className="eyebrow">Deals with Dennis</p>
            <h1>Full Inventory</h1>
          </div>
          <p>
            Filter by new, used, and claim status. Sort the list before you
            message me to confirm availability or book a test drive.
          </p>
        </section>

        <InventoryBrowser vehicles={publicVehicles} showAdvancedControls />
      </div>
    </main>
  );
}
