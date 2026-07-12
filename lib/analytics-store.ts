import { createSupabaseAdmin } from "./supabase/admin";

export type AnalyticsEventType = "vehicle_view" | "contact_click" | "page_view";

export type AnalyticsEvent = {
  createdAt: string;
  eventType: AnalyticsEventType;
  id: string;
  pagePath: string;
  vehicleId: string;
  vehicleLabel: string;
  vehicleStockNumber: string;
};

export type VehicleAnalyticsRow = {
  contacts: number;
  lastEventAt: string;
  vehicleId: string;
  vehicleLabel: string;
  vehicleStockNumber: string;
  views: number;
};

export type AnalyticsSummary = {
  contactClicks: number;
  events: AnalyticsEvent[];
  isAvailable: boolean;
  pageViews: number;
  since: string;
  todayEvents: number;
  topVehicles: VehicleAnalyticsRow[];
  totalEvents: number;
  vehicleViews: number;
};

type SiteEventRow = {
  created_at: string;
  event_type: AnalyticsEventType;
  id: string;
  page_path: string | null;
  vehicle_id: string | null;
  vehicle_label: string | null;
  vehicle_stock_number: string | null;
};

const EVENT_WINDOW_DAYS = 30;

export async function getAnalyticsSummary(): Promise<AnalyticsSummary> {
  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - EVENT_WINDOW_DAYS);
  const since = sinceDate.toISOString();
  const supabase = createSupabaseAdmin();

  if (!supabase) {
    return emptySummary(since, false);
  }

  const { data, error } = await supabase
    .from("site_events")
    .select(
      "id, event_type, vehicle_id, vehicle_stock_number, vehicle_label, page_path, created_at",
    )
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(5000);

  if (error || !data) {
    return emptySummary(since, false);
  }

  const events = (data as SiteEventRow[]).map((row) => ({
    createdAt: row.created_at,
    eventType: row.event_type,
    id: row.id,
    pagePath: row.page_path ?? "",
    vehicleId: row.vehicle_id ?? "",
    vehicleLabel: row.vehicle_label ?? "Unknown vehicle",
    vehicleStockNumber: row.vehicle_stock_number ?? "",
  }));

  const topVehicleMap = new Map<string, VehicleAnalyticsRow>();

  for (const event of events) {
    if (!event.vehicleId && !event.vehicleStockNumber && !event.vehicleLabel) {
      continue;
    }

    const key = event.vehicleId || event.vehicleStockNumber || event.vehicleLabel;
    const current =
      topVehicleMap.get(key) ??
      ({
        contacts: 0,
        lastEventAt: event.createdAt,
        vehicleId: event.vehicleId,
        vehicleLabel: event.vehicleLabel,
        vehicleStockNumber: event.vehicleStockNumber,
        views: 0,
      } satisfies VehicleAnalyticsRow);

    if (event.eventType === "vehicle_view") {
      current.views += 1;
    }

    if (event.eventType === "contact_click") {
      current.contacts += 1;
    }

    if (new Date(event.createdAt) > new Date(current.lastEventAt)) {
      current.lastEventAt = event.createdAt;
    }

    topVehicleMap.set(key, current);
  }

  const today = new Date();

  return {
    contactClicks: events.filter((event) => event.eventType === "contact_click")
      .length,
    events: events.slice(0, 60),
    isAvailable: true,
    pageViews: events.filter((event) => event.eventType === "page_view").length,
    since,
    todayEvents: events.filter((event) =>
      isSameLocalDate(event.createdAt, today),
    ).length,
    topVehicles: Array.from(topVehicleMap.values())
      .sort((a, b) => b.contacts - a.contacts || b.views - a.views)
      .slice(0, 30),
    totalEvents: events.length,
    vehicleViews: events.filter((event) => event.eventType === "vehicle_view")
      .length,
  };
}

function emptySummary(since: string, isAvailable: boolean): AnalyticsSummary {
  return {
    contactClicks: 0,
    events: [],
    isAvailable,
    pageViews: 0,
    since,
    todayEvents: 0,
    topVehicles: [],
    totalEvents: 0,
    vehicleViews: 0,
  };
}

function isSameLocalDate(value: string, date: Date) {
  const next = new Date(value);

  if (Number.isNaN(next.getTime())) {
    return false;
  }

  return (
    next.getFullYear() === date.getFullYear() &&
    next.getMonth() === date.getMonth() &&
    next.getDate() === date.getDate()
  );
}
