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
                Track page views, searches, filters, vehicle detail opens,
                photo browsing, Contact Dennis clicks, and submitted inquiries.
                Data shown here covers the last 30 days.
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
                  <span>Searches</span>
                  <strong>{summary.searches}</strong>
                </div>
                <div>
                  <span>Filter actions</span>
                  <strong>{summary.filterActions}</strong>
                </div>
                <div>
                  <span>Photo browses</span>
                  <strong>{summary.photoBrowses}</strong>
                </div>
                <div>
                  <span>Contact clicks</span>
                  <strong>{summary.contactClicks}</strong>
                </div>
                <div>
                  <span>Submitted leads</span>
                  <strong>{summary.contactSubmits}</strong>
                </div>
                <div>
                  <span>Click conversion</span>
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
                      <p className="eyebrow">Behavior</p>
                      <h2>Event mix</h2>
                    </div>
                    <span>{summary.eventBreakdown.length} types</span>
                  </div>

                  {summary.eventBreakdown.length ? (
                    <div className="analytics-event-breakdown">
                      {summary.eventBreakdown.map((event) => (
                        <div key={event.eventType}>
                          <span>{labelEventType(event.eventType)}</span>
                          <strong>{event.count}</strong>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="admin-empty">No behavior events yet.</p>
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
                              {eventSummary(event)}
                              {eventSummary(event) ? " · " : ""}
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
  if (value === "page_view") {
    return "Page view";
  }

  if (value === "inventory_search") {
    return "Search";
  }

  if (value === "inventory_filter") {
    return "Filter";
  }

  if (value === "filter_reset") {
    return "Filter reset";
  }

  if (value === "inventory_sort") {
    return "Sort";
  }

  if (value === "view_mode_change") {
    return "View mode";
  }

  if (value === "vehicle_view") {
    return "Vehicle view";
  }

  if (value === "photo_browse") {
    return "Photo browse";
  }

  if (value === "contact_click") {
    return "Contact click";
  }

  if (value === "contact_submit") {
    return "Lead submitted";
  }

  return value;
}

function vehicleConversion(vehicle: { contacts: number; views: number }) {
  if (vehicle.views === 0) {
    return vehicle.contacts > 0 ? 100 : 0;
  }

  return Math.round((vehicle.contacts / vehicle.views) * 100);
}

function eventSummary(event: {
  eventType: string;
  metadata: Record<string, unknown>;
  pagePath: string;
}) {
  if (event.eventType === "inventory_search") {
    const query = valueToLabel(event.metadata.query);
    return query ? `Query "${query}"` : "";
  }

  if (event.eventType === "inventory_filter") {
    const field = valueToLabel(event.metadata.field);
    const value = valueToLabel(event.metadata.value);
    return field && value ? `${field}: ${value}` : "";
  }

  if (event.eventType === "inventory_sort") {
    return valueToLabel(event.metadata.value);
  }

  if (event.eventType === "view_mode_change") {
    return valueToLabel(event.metadata.value);
  }

  if (event.eventType === "photo_browse") {
    const index = valueToLabel(event.metadata.imageIndex);
    const total = valueToLabel(event.metadata.imageTotal);
    return index && total ? `Photo ${index}/${total}` : "";
  }

  if (event.eventType === "page_view") {
    return event.pagePath;
  }

  return "";
}

function valueToLabel(value: unknown) {
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }

  return "";
}
