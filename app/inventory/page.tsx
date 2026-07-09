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
            Deals with Dennis <span>Inventory</span>
          </a>
          <div className="nav-links">
            <a href="/">Featured</a>
            <a href="/inventory">Inventory</a>
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
            <h1>Inventory</h1>
          </div>
          <p>
            Filter by year, make, model, body style, price, claim status, and
            more before you message me to confirm availability.
          </p>
        </section>

        <InventoryBrowser vehicles={publicVehicles} showAdvancedControls />
      </div>
    </main>
  );
}
