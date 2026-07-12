import { cookies } from "next/headers";
import type { Metadata } from "next";
import { AdminLogin } from "../AdminLogin";
import {
  getAdminCookieName,
  isAdminSessionValueValid,
} from "../../../lib/admin-auth";
import { getAnalyticsSummary } from "../../../lib/analytics-store";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: {
    follow: false,
    index: false,
  },
  title: "Analytics · Deals with Dennis",
};

export default async function AdminAnalyticsPage() {
  const cookieStore = await cookies();
  const isAuthenticated = isAdminSessionValueValid(
    cookieStore.get(getAdminCookieName())?.value,
  );
  const summary = isAuthenticated ? await getAnalyticsSummary() : null;
  const conversionRate =
    summary && summary.vehicleViews > 0
      ? Math.round((summary.contactClicks / summary.vehicleViews) * 100)
      : 0;

  return (
    <main className="admin-page">
      <header className="site-header">
        <nav className="nav-shell" aria-label="Admin analytics navigation">
          <a className="brand" href="/admin">
            Dennis Liu <span>Analytics</span>
          </a>
          <div className="nav-links">
            <a href="/admin">Inventory Admin</a>
            <a href="/admin/inquiries">Inquiries</a>
            <a href="/admin/history">History</a>
            <a href="/">Public Site</a>
            <a className="nav-cta" href="/inventory">
              View Inventory
            </a>
          </div>
        </nav>
      </header>

      <div className="page-shell">
        {isAuthenticated && summary ? (
          <>
            <section className="admin-hero">
              <div>
                <p className="eyebrow">Private workspace</p>
                <h1>Website analytics</h1>
              </div>
              <p>
                Track which vehicles people open and which vehicles lead to a
                Contact Dennis click. Data shown here covers the last 30 days.
              </p>
            </section>

            <section className="history-shell analytics-shell">
              {!summary.isAvailable ? (
                <div className="admin-notice warning">
                  Analytics table is not ready yet. Run the
                  <code> supabase/migrations/002_site_events.sql </code>
                  migration in Supabase, then refresh this page.
                </div>
              ) : null}

              <div className="history-summary analytics-summary">
                <div>
                  <span>Vehicle views</span>
                  <strong>{summary.vehicleViews}</strong>
                </div>
                <div>
                  <span>Contact clicks</span>
                  <strong>{summary.contactClicks}</strong>
                </div>
                <div>
                  <span>Conversion</span>
                  <strong>{conversionRate}%</strong>
                </div>
                <div>
                  <span>Today</span>
                  <strong>{summary.todayEvents}</strong>
                </div>
              </div>

              <div className="analytics-grid">
                <section className="analytics-card">
                  <div className="analytics-card-head">
                    <div>
                      <p className="eyebrow">Sales signal</p>
                      <h2>Vehicle interest</h2>
                    </div>
                    <span>{summary.topVehicles.length} vehicles</span>
                  </div>

                  {summary.topVehicles.length ? (
                    <div className="analytics-table" role="table">
                      <div className="analytics-table-row heading" role="row">
                        <span>Vehicle</span>
                        <span>Views</span>
                        <span>Contacts</span>
                        <span>Rate</span>
                      </div>
                      {summary.topVehicles.map((vehicle) => (
                        <div
                          className="analytics-table-row"
                          key={`${vehicle.vehicleId}-${vehicle.vehicleStockNumber}-${vehicle.vehicleLabel}`}
                          role="row"
                        >
                          <span>
                            <strong>{vehicle.vehicleLabel}</strong>
                            <small>
                              {vehicle.vehicleStockNumber
                                ? `Stock ${vehicle.vehicleStockNumber}`
                                : "No stock #"}
                            </small>
                          </span>
                          <span>{vehicle.views}</span>
                          <span>{vehicle.contacts}</span>
                          <span>{vehicleConversion(vehicle)}%</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="admin-empty">No vehicle events yet.</p>
                  )}
                </section>

                <section className="analytics-card">
                  <div className="analytics-card-head">
                    <div>
                      <p className="eyebrow">Recent activity</p>
                      <h2>Event stream</h2>
                    </div>
                    <span>{summary.totalEvents} total</span>
                  </div>

                  {summary.events.length ? (
                    <div className="analytics-events">
                      {summary.events.map((event) => (
                        <article className="analytics-event" key={event.id}>
                          <span className={`analytics-event-type ${event.eventType}`}>
                            {labelEventType(event.eventType)}
                          </span>
                          <div>
                            <strong>{event.vehicleLabel}</strong>
                            <small>
                              {event.vehicleStockNumber
                                ? `Stock ${event.vehicleStockNumber} · `
                                : ""}
                              {formatAnalyticsDate(event.createdAt)}
                            </small>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p className="admin-empty">No events recorded yet.</p>
                  )}
                </section>
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

function formatAnalyticsDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value || "No date";
  }

  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function labelEventType(value: string) {
  if (value === "vehicle_view") {
    return "Vehicle view";
  }

  if (value === "contact_click") {
    return "Contact click";
  }

  return "Page view";
}

function vehicleConversion(vehicle: { contacts: number; views: number }) {
  if (vehicle.views === 0) {
    return vehicle.contacts > 0 ? 100 : 0;
  }

  return Math.round((vehicle.contacts / vehicle.views) * 100);
}
