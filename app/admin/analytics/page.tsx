import { cookies } from "next/headers";
import type { Metadata } from "next";
import { AdminHeader } from "../AdminHeader";
import { AdminLogin } from "../AdminLogin";
import {
  getAdminCookieName,
  isAdminSessionValueValid,
} from "../../../lib/admin-auth";
import {
  type AnalyticsRange,
  getAnalyticsSummary,
} from "../../../lib/analytics-store";
import {
  type ContactInquiry,
  getContactInquiries,
} from "../../../lib/inquiry-store";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: {
    follow: false,
    index: false,
  },
  title: "Analytics · Deals with Dennis",
};

const analyticsRanges: Array<{
  href: string;
  label: string;
  value: AnalyticsRange;
}> = [
  { href: "/admin/analytics?range=today", label: "Today", value: "today" },
  { href: "/admin/analytics?range=7d", label: "7 days", value: "7d" },
  { href: "/admin/analytics?range=30d", label: "30 days", value: "30d" },
  { href: "/admin/analytics?range=all", label: "All time", value: "all" },
];

export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams?: Promise<{ range?: string }>;
}) {
  const params = await searchParams;
  const activeRange = normalizeAnalyticsRange(params?.range);
  const cookieStore = await cookies();
  const isAuthenticated = isAdminSessionValueValid(
    cookieStore.get(getAdminCookieName())?.value,
  );
  const summary = isAuthenticated ? await getAnalyticsSummary(activeRange) : null;
  const inquiries = isAuthenticated ? await getContactInquiries() : [];
  const leadFollowUps =
    summary && isAuthenticated
      ? filterInquiriesByRange(inquiries, activeRange).slice(0, 6)
      : [];
  const conversionRate =
    summary && summary.vehicleViews > 0
      ? Math.round((summary.contactClicks / summary.vehicleViews) * 100)
      : 0;
  const popularVehicles = summary?.topVehicles.slice(0, 8) ?? [];

  return (
    <main className="admin-page">
      <AdminHeader section="Analytics" />

      <div className="page-shell">
        {isAuthenticated && summary ? (
          <>
            <section className="admin-hero">
              <div>
                <p className="eyebrow">Private workspace</p>
                <h1>Website analytics</h1>
              </div>
              <p>
                Separate anonymous browsing interest from real customer leads.
                Popular vehicles show attention; lead follow-up shows people you
                can actually contact for {rangeSentence(activeRange)}.
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

              <div className="analytics-range-bar">
                <div>
                  <p className="eyebrow">Time range</p>
                  <strong>{rangeTitle(activeRange)}</strong>
                </div>
                <div
                  aria-label="Analytics time range"
                  className="analytics-range-control"
                >
                  {analyticsRanges.map((range) => (
                    <a
                      aria-current={
                        activeRange === range.value ? "page" : undefined
                      }
                      href={range.href}
                      key={range.value}
                    >
                      {range.label}
                    </a>
                  ))}
                </div>
              </div>

              <section className="analytics-sales-snapshot">
                <div className="analytics-snapshot-copy">
                  <p className="eyebrow">Sales snapshot</p>
                  <h2>Interest vs. leads</h2>
                  <p>
                    Anonymous traffic tells you what is popular. Submitted
                    inquiries and appointments are the people to follow up with.
                  </p>
                </div>
                <div className="analytics-priority-grid">
                  <AnalyticsMetricCard
                    label="Submitted leads"
                    value={summary.contactSubmits}
                    note="People who filled the form"
                    tone="hot"
                  />
                  <AnalyticsMetricCard
                    label="Contact clicks"
                    value={summary.contactClicks}
                    note="Clicked Contact Dennis from a vehicle"
                    tone="warm"
                  />
                  <AnalyticsMetricCard
                    label="Vehicle views"
                    value={summary.vehicleViews}
                    note={`${summary.featuredVehicleViews} from featured, ${summary.inventoryPageVehicleViews} from inventory`}
                    tone="neutral"
                  />
                  <AnalyticsMetricCard
                    label="Click conversion"
                    value={`${conversionRate}%`}
                    note="Contact clicks divided by vehicle views"
                    tone="neutral"
                  />
                </div>
              </section>

              <div className="analytics-grid">
                <section className="analytics-card">
                  <div className="analytics-card-head">
                    <div>
                      <p className="eyebrow">Anonymous interest</p>
                      <h2>Popular vehicles</h2>
                    </div>
                    <span>Top {popularVehicles.length}</span>
                  </div>

                  {popularVehicles.length ? (
                    <div className="hot-vehicle-list" role="table">
                      <div className="hot-vehicle-heading" role="row">
                        <span>Vehicle</span>
                        <span>Views</span>
                        <span>Contacts</span>
                        <span>Rate</span>
                      </div>
                      {popularVehicles.map((vehicle) => (
                        <article
                          className="hot-vehicle-row"
                          key={`${vehicle.vehicleId}-${vehicle.vehicleStockNumber}-${vehicle.vehicleLabel}`}
                          role="row"
                        >
                          <div className="hot-vehicle-main" role="cell">
                            <strong>{vehicle.vehicleLabel}</strong>
                            <small>
                              {vehicle.vehicleStockNumber
                                ? `Stock ${vehicle.vehicleStockNumber}`
                                : "No stock #"}
                            </small>
                            <em>{vehicleSignal(vehicle)}</em>
                          </div>
                          <div className="hot-vehicle-metrics" role="cell">
                            <span className={vehicle.contacts > 0 ? "hot" : ""}>
                              <strong>{vehicle.views}</strong>
                              <small>views</small>
                            </span>
                            <span className={vehicle.contacts > 0 ? "hot" : ""}>
                              <strong>{vehicle.contacts}</strong>
                              <small>contacts</small>
                            </span>
                            <span className={vehicleConversion(vehicle) > 0 ? "hot" : ""}>
                              <strong>{vehicleConversion(vehicle)}%</strong>
                              <small>rate</small>
                            </span>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p className="admin-empty">No vehicle events yet.</p>
                  )}
                </section>

                <section className="analytics-card lead-followup-card">
                  <div className="analytics-card-head">
                    <div>
                      <p className="eyebrow">Known customers</p>
                      <h2>Lead follow-up</h2>
                    </div>
                    <span>{leadFollowUps.length} recent</span>
                  </div>

                  {leadFollowUps.length ? (
                    <div className="lead-followup-list">
                      {leadFollowUps.map((lead) => (
                        <article className="lead-followup-row" key={lead.id}>
                          <div>
                            <strong>{lead.name || "Unnamed lead"}</strong>
                            <small>{leadContactLine(lead)}</small>
                          </div>
                          <span>{leadTypeLabel(lead)}</span>
                          <p>{leadVehicleLine(lead)}</p>
                          <a href="/admin/inquiries">Open inquiries</a>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p className="admin-empty">No submitted leads in this range.</p>
                  )}
                </section>

                <section className="analytics-card">
                  <div className="analytics-card-head">
                    <div>
                      <p className="eyebrow">Recent activity</p>
                      <h2>Latest signals</h2>
                    </div>
                    <span>{summary.totalEvents} total</span>
                  </div>

                  {summary.events.length ? (
                    <div className="analytics-events">
                      {summary.events.slice(0, 14).map((event) => (
                        <article className="analytics-event" key={event.id}>
                          <span className={`analytics-event-type ${event.eventType}`}>
                            {labelEventType(event.eventType)}
                          </span>
                          <div>
                            <strong>{eventTitle(event)}</strong>
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

                <section className="analytics-card audience-card">
                  <div className="analytics-card-head">
                    <div>
                      <p className="eyebrow">Audience snapshot</p>
                      <h2>Visitor profile</h2>
                    </div>
                    <span>Anonymous</span>
                  </div>

                  <div className="audience-grid">
                    <AnalyticsMiniList
                      emptyLabel="No location data yet"
                      items={summary.topVisitorLocations}
                      title="Top locations"
                    />
                    <AnalyticsMiniList
                      emptyLabel="No device data yet"
                      items={summary.deviceBreakdown}
                      title="Devices"
                    />
                    <AnalyticsMiniList
                      emptyLabel="No source data yet"
                      items={summary.sourceBreakdown}
                      title="Traffic sources"
                    />
                  </div>
                </section>

                <section className="analytics-card traffic-card">
                  <div className="analytics-card-head">
                    <div>
                      <p className="eyebrow">Behavior detail</p>
                      <h2>Traffic mix</h2>
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

function AnalyticsMetricCard({
  label,
  note,
  tone,
  value,
}: {
  label: string;
  note: string;
  tone: "hot" | "neutral" | "warm";
  value: number | string;
}) {
  return (
    <div className={`analytics-metric-card ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </div>
  );
}

function AnalyticsMiniList({
  emptyLabel,
  items,
  title,
}: {
  emptyLabel: string;
  items: Array<{ count: number; label: string }>;
  title: string;
}) {
  return (
    <div className="analytics-mini-list">
      <strong>{title}</strong>
      {items.length ? (
        items.map((item) => (
          <div key={item.label}>
            <span>{item.label}</span>
            <em>{item.count}</em>
          </div>
        ))
      ) : (
        <p>{emptyLabel}</p>
      )}
    </div>
  );
}

function filterInquiriesByRange(
  inquiries: ContactInquiry[],
  range: AnalyticsRange,
) {
  if (range === "all") {
    return inquiries;
  }

  const since = new Date();

  if (range === "today") {
    since.setHours(0, 0, 0, 0);
  } else {
    since.setDate(since.getDate() - (range === "7d" ? 7 : 30));
  }

  return inquiries.filter((inquiry) => {
    const createdAt = new Date(inquiry.createdAt);
    return !Number.isNaN(createdAt.getTime()) && createdAt >= since;
  });
}

function leadContactLine(lead: ContactInquiry) {
  return [lead.phone, lead.email].filter(Boolean).join(" · ") || "No contact";
}

function leadTypeLabel(lead: ContactInquiry) {
  if (lead.appointmentDate) {
    return "Appointment";
  }

  return "Inquiry";
}

function leadVehicleLine(lead: ContactInquiry) {
  const type = labelVehicleType(lead.vehicleType);
  const stock = lead.vehicleStockNumber ? `Stock ${lead.vehicleStockNumber}` : "";
  return [type, stock, formatAnalyticsDate(lead.createdAt)]
    .filter(Boolean)
    .join(" · ");
}

function labelVehicleType(value: string) {
  if (value === "new") return "New vehicle";
  if (value === "used") return "Used vehicle";
  if (value === "trade") return "Trade-in";

  return value || "Not sure yet";
}

function normalizeAnalyticsRange(value: string | undefined): AnalyticsRange {
  if (value === "today" || value === "7d" || value === "30d" || value === "all") {
    return value;
  }

  return "30d";
}

function rangeTitle(value: AnalyticsRange) {
  if (value === "today") return "Today";
  if (value === "7d") return "Last 7 days";
  if (value === "all") return "All time";

  return "Last 30 days";
}

function rangeSentence(value: AnalyticsRange) {
  if (value === "today") return "today";
  if (value === "7d") return "the last 7 days";
  if (value === "all") return "all recorded time";

  return "the last 30 days";
}

function formatAnalyticsDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value || "No date";
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

function vehicleSignal(vehicle: { contacts: number; views: number }) {
  if (vehicle.contacts > 0) {
    return "High intent";
  }

  if (vehicle.views >= 5) {
    return "Getting attention";
  }

  return "Early interest";
}

function eventTitle(event: {
  eventType: string;
  pagePath: string;
  vehicleLabel: string;
}) {
  if (event.eventType === "page_view") {
    return pagePathLabel(event.pagePath);
  }

  if (event.eventType === "inventory_search") {
    return "Inventory search";
  }

  if (event.eventType === "inventory_filter") {
    return "Inventory filter";
  }

  if (event.eventType === "inventory_sort") {
    return "Inventory sort";
  }

  if (event.eventType === "view_mode_change") {
    return "Inventory view setting";
  }

  if (event.eventType === "filter_reset") {
    return "Filters reset";
  }

  return event.vehicleLabel || "Vehicle activity";
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
    return `Path ${event.pagePath || "/"}`;
  }

  return "";
}

function pagePathLabel(path: string) {
  if (!path || path === "/") {
    return "Homepage";
  }

  if (path === "/inventory") {
    return "Inventory page";
  }

  if (path === "/admin/analytics") {
    return "Admin analytics";
  }

  if (path.startsWith("/admin")) {
    return "Admin page";
  }

  return path;
}

function valueToLabel(value: unknown) {
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }

  return "";
}
