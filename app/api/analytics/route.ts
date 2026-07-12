import { NextResponse } from "next/server";
import type { AnalyticsEventType } from "../../../lib/analytics-store";
import { createSupabaseAdmin } from "../../../lib/supabase/admin";

const eventTypes = new Set<AnalyticsEventType>([
  "page_view",
  "inventory_search",
  "inventory_filter",
  "inventory_sort",
  "view_mode_change",
  "filter_reset",
  "vehicle_view",
  "photo_browse",
  "contact_click",
  "contact_submit",
]);

type AnalyticsBody = {
  eventType?: string;
  metadata?: Record<string, unknown>;
  pagePath?: string;
  vehicle?: {
    id?: string;
    label?: string;
    stockNumber?: string;
  };
};

export async function POST(request: Request) {
  const supabase = createSupabaseAdmin();

  if (!supabase) {
    return NextResponse.json({ ok: true, mode: "skipped" });
  }

  let body: AnalyticsBody;

  try {
    body = (await request.json()) as AnalyticsBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid analytics payload" });
  }

  if (!body.eventType || !eventTypes.has(body.eventType as AnalyticsEventType)) {
    return NextResponse.json({ ok: false, error: "Invalid analytics event" });
  }

  const { error } = await supabase.from("site_events").insert({
    event_type: body.eventType,
    metadata: body.metadata ?? {},
    page_path: body.pagePath ?? null,
    referrer: request.headers.get("referer"),
    user_agent: request.headers.get("user-agent"),
    vehicle_id: body.vehicle?.id ?? null,
    vehicle_label: body.vehicle?.label ?? null,
    vehicle_stock_number: body.vehicle?.stockNumber ?? null,
  });

  if (error) {
    return NextResponse.json({
      ok: false,
      error: "Analytics event was not saved",
    });
  }

  return NextResponse.json({ ok: true, mode: "supabase" });
}
