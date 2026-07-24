import { cookies } from "next/headers";
import type { Metadata } from "next";
import { AdminLogin } from "../AdminLogin";
import {
  getAdminCookieName,
  isAdminSessionValueValid,
} from "../../../lib/admin-auth";
import { getInventoryHistoryVehicles } from "../../../lib/inventory-store";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: {
    follow: false,
    index: false,
  },
  title: "Vehicle History · Deals with Dennis",
};

export default async function AdminHistoryPage() {
  const cookieStore = await cookies();
  const isAuthenticated = isAdminSessionValueValid(
    cookieStore.get(getAdminCookieName())?.value,
  );
  const history = isAuthenticated ? await getInventoryHistoryVehicles() : [];
  const deletedCount = history.filter(
    (entry) => entry.historyStatus === "deleted",
  ).length;
  const soldCount = history.filter((entry) => entry.historyStatus === "sold").length;

  return (
    <main className="admin-page">
      <header className="site-header">
        <nav className="nav-shell" aria-label="Admin history navigation">
          <a className="brand" href="/admin">
            Dennis Liu <span>Vehicle History</span>
          </a>
          <div className="nav-links">
            <a href="/admin">Inventory Admin</a>
            <a href="/admin/analytics">Analytics</a>
            <a href="/admin/content">Content</a>
            <a href="/admin/inquiries">Inquiries</a>
            <a href="/admin/appointments">Appointments</a>
            <a href="/">Public Site</a>
            <a className="nav-cta" href="/inventory">
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
                <h1>Vehicle history</h1>
              </div>
              <p>
                Review vehicles that are sold or removed from the active
                inventory. Deleted vehicles are hidden from the public site but
                kept here for reference.
              </p>
            </section>

            <section className="history-shell">
              <div className="history-summary">
                <div>
                  <span>Total history</span>
                  <strong>{history.length}</strong>
                </div>
                <div>
                  <span>Sold</span>
                  <strong>{soldCount}</strong>
                </div>
                <div>
                  <span>Deleted</span>
                  <strong>{deletedCount}</strong>
                </div>
              </div>

              <div className="history-list" aria-label="Vehicle history">
                {history.length ? (
                  history.map(({ historyStatus, vehicle }) => (
                    <article className="history-row" key={`${historyStatus}-${vehicle.id}`}>
                      <div className="history-row-main">
                        <span className={`history-status ${historyStatus}`}>
                          {historyStatus === "deleted" ? "Deleted" : "Sold"}
                        </span>
                        <h2>
                          {vehicle.year} {vehicle.make} {vehicle.model}
                        </h2>
                        <p>{vehicle.trim || vehicle.className || "No trim listed"}</p>
                      </div>
                      <dl className="history-meta">
                        <div>
                          <dt>Stock #</dt>
                          <dd>{vehicle.stockNumber || "N/A"}</dd>
                        </div>
                        <div>
                          <dt>VIN</dt>
                          <dd>{vehicle.vin || "N/A"}</dd>
                        </div>
                        <div>
                          <dt>Price</dt>
                          <dd>{vehicle.priceLabel || "Ask for pricing"}</dd>
                        </div>
                        <div>
                          <dt>Mileage</dt>
                          <dd>{vehicle.mileageLabel || "Mileage TBD"}</dd>
                        </div>
                        <div>
                          <dt>History date</dt>
                          <dd>
                            {historyStatus === "deleted"
                              ? formatHistoryDate(vehicle.deletedAt)
                              : "Marked sold"}
                          </dd>
                        </div>
                      </dl>
                    </article>
                  ))
                ) : (
                  <p className="admin-empty">No sold or deleted vehicles yet.</p>
                )}
              </div>
            </section>
          </>
        ) : (
          <AdminLogin />
        )}
      </div>
    </main>
  );
}

function formatHistoryDate(value?: string) {
  if (!value) {
    return "Deletion date not saved";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-CA", {
    day: "numeric",
    month: "short",
    timeZone: "America/Vancouver",
    timeZoneName: "short",
    hour: "numeric",
    minute: "2-digit",
    year: "numeric",
  }).format(date);
}
