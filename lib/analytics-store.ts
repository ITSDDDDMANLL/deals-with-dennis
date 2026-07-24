import { createSupabaseAdmin } from "./supabase/admin";

export type AnalyticsEventType =
  | "page_view"
  | "inventory_search"
  | "inventory_filter"
  | "inventory_sort"
  | "view_mode_change"
  | "filter_reset"
  | "vehicle_view"
  | "photo_browse"
  | "contact_click"
  | "contact_submit";

export type AnalyticsEvent = {
  createdAt: string;
  eventType: AnalyticsEventType;
  id: string;
  metadata: Record<string, unknown>;
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
  contactSubmits: number;
  deviceBreakdown: Array<{
    count: number;
    label: string;
  }>;
  eventBreakdown: Array<{
    count: number;
    eventType: AnalyticsEventType;
  }>;
  events: AnalyticsEvent[];
  featuredVehicleViews: number;
  filterActions: number;
  inventoryPageVehicleViews: number;
  isAvailable: boolean;
  pageViews: number;
  photoBrowses: number;
  searches: number;
  since: string;
  sourceBreakdown: Array<{
    count: number;
    label: string;
  }>;
  sortActions: number;
  todayEvents: number;
  topVehicles: VehicleAnalyticsRow[];
  topVisitorLocations: Array<{
    count: number;
    label: string;
  }>;
  totalEvents: number;
  vehicleViews: number;
};

export type AnalyticsRange = "30d" | "7d" | "all" | "today";

type SiteEventRow = {
  created_at: string;
  event_type: AnalyticsEventType;
  id: string;
  metadata: Record<string, unknown> | null;
  page_path: string | null;
  vehicle_id: string | null;
  vehicle_label: string | null;
  vehicle_stock_number: string | null;
};

const EVENT_WINDOW_DAYS = 30;
const VANCOUVER_TIME_ZONE = "America/Vancouver";

export async function getAnalyticsSummary(
  range: AnalyticsRange = "30d",
): Promise<AnalyticsSummary> {
  const since = getRangeStart(range);
  const supabase = createSupabaseAdmin();

  if (!supabase) {
    return emptySummary(since ?? "", false);
  }

  let query = supabase
    .from("site_events")
    .select(
      "id, event_type, vehicle_id, vehicle_stock_number, vehicle_label, page_path, metadata, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(5000);

  if (since) {
    query = query.gte("created_at", since);
  }

  const { data, error } = await query;

  if (error || !data) {
    return emptySummary(since ?? "", false);
  }

  const events = (data as SiteEventRow[]).map((row) => ({
    createdAt: row.created_at,
    eventType: row.event_type,
    id: row.id,
    metadata: row.metadata ?? {},
    pagePath: row.page_path ?? "",
    vehicleId: row.vehicle_id ?? "",
    vehicleLabel: row.vehicle_label ?? "Unknown vehicle",
    vehicleStockNumber: row.vehicle_stock_number ?? "",
  }));

  const topVehicleMap = new Map<string, VehicleAnalyticsRow>();

  for (const event of events) {
    if (
      event.eventType !== "vehicle_view" &&
      event.eventType !== "photo_browse" &&
      event.eventType !== "contact_click"
    ) {
      continue;
    }

    if (!event.vehicleId && !event.vehicleStockNumber) {
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

  const todayKey = getVancouverDateKey(new Date());
  const eventBreakdownMap = new Map<AnalyticsEventType, number>();
  const deviceMap = new Map<string, number>();
  const locationMap = new Map<string, number>();
  const sourceMap = new Map<string, number>();

  for (const event of events) {
    eventBreakdownMap.set(
      event.eventType,
      (eventBreakdownMap.get(event.eventType) ?? 0) + 1,
    );
    incrementMap(deviceMap, metadataText(event.metadata.deviceType) || "Unknown");
    incrementMap(locationMap, visitorLocationLabel(event.metadata));
    incrementMap(sourceMap, trafficSourceLabel(event.metadata, event.pagePath));
  }

  return {
    contactClicks: events.filter((event) => event.eventType === "contact_click")
      .length,
    contactSubmits: events.filter((event) => event.eventType === "contact_submit")
      .length,
    deviceBreakdown: mapToSortedRows(deviceMap, 5),
    eventBreakdown: Array.from(eventBreakdownMap.entries())
      .map(([eventType, count]) => ({ count, eventType }))
      .sort((a, b) => b.count - a.count),
    events: events.slice(0, 60),
    featuredVehicleViews: events.filter(
      (event) =>
        event.eventType === "vehicle_view" &&
        event.metadata.context === "featured_inventory",
    ).length,
    filterActions: events.filter(
      (event) =>
        event.eventType === "inventory_filter" ||
        event.eventType === "filter_reset",
    ).length,
    inventoryPageVehicleViews: events.filter(
      (event) =>
        event.eventType === "vehicle_view" &&
        event.metadata.context === "inventory_page",
    ).length,
    isAvailable: true,
    pageViews: events.filter((event) => event.eventType === "page_view").length,
    photoBrowses: events.filter((event) => event.eventType === "photo_browse")
      .length,
    searches: events.filter((event) => event.eventType === "inventory_search")
      .length,
    since: since ?? "",
    sourceBreakdown: mapToSortedRows(sourceMap, 5),
    sortActions: events.filter((event) => event.eventType === "inventory_sort")
      .length,
    todayEvents: events.filter(
      (event) => getVancouverDateKey(event.createdAt) === todayKey,
    ).length,
    topVehicles: Array.from(topVehicleMap.values())
      .sort((a, b) => b.contacts - a.contacts || b.views - a.views)
      .slice(0, 30),
    topVisitorLocations: mapToSortedRows(locationMap, 5),
    totalEvents: events.length,
    vehicleViews: events.filter((event) => event.eventType === "vehicle_view")
      .length,
  };
}

function getRangeStart(range: AnalyticsRange) {
  if (range === "all") {
    return null;
  }

  const sinceDate = new Date();

  if (range === "today") {
    sinceDate.setHours(0, 0, 0, 0);
    return sinceDate.toISOString();
  }

  sinceDate.setDate(
    sinceDate.getDate() - (range === "7d" ? 7 : EVENT_WINDOW_DAYS),
  );

  return sinceDate.toISOString();
}

function emptySummary(since: string, isAvailable: boolean): AnalyticsSummary {
  return {
    contactClicks: 0,
    contactSubmits: 0,
    deviceBreakdown: [],
    eventBreakdown: [],
    events: [],
    featuredVehicleViews: 0,
    filterActions: 0,
    inventoryPageVehicleViews: 0,
    isAvailable,
    pageViews: 0,
    photoBrowses: 0,
    searches: 0,
    since,
    sourceBreakdown: [],
    sortActions: 0,
    todayEvents: 0,
    topVehicles: [],
    topVisitorLocations: [],
    totalEvents: 0,
    vehicleViews: 0,
  };
}

function incrementMap(map: Map<string, number>, key: string) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function mapToSortedRows(map: Map<string, number>, limit: number) {
  return Array.from(map.entries())
    .map(([label, count]) => ({ count, label }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, limit);
}

function visitorLocationLabel(metadata: Record<string, unknown>) {
  const city = metadataText(metadata.city);
  const region = metadataText(metadata.region);
  const country = metadataText(metadata.country);

  if (city && region) {
    return `${city}, ${region}`;
  }

  if (city && country) {
    return `${city}, ${country}`;
  }

  return country || "Unknown location";
}

function trafficSourceLabel(metadata: Record<string, unknown>, pagePath: string) {
  const source = metadataText(metadata.source);

  if (source) {
    return source;
  }

  const referrerHost = metadataText(metadata.referrerHost);

  if (referrerHost) {
    return referrerHost;
  }

  if (pagePath.startsWith("/admin")) {
    return "Admin";
  }

  return "Direct / unknown";
}

function metadataText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getVancouverDateKey(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: VANCOUVER_TIME_ZONE,
    year: "numeric",
  }).formatToParts(date);

  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  return `${values.year}-${values.month}-${values.day}`;
}
