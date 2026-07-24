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

  const referrer = request.headers.get("referer");
  const userAgent = request.headers.get("user-agent");
  const { error } = await supabase.from("site_events").insert({
    event_type: body.eventType,
    metadata: {
      ...(body.metadata ?? {}),
      ...requestProfileMetadata(request, referrer, userAgent),
    },
    page_path: body.pagePath ?? null,
    referrer,
    user_agent: userAgent,
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

function requestProfileMetadata(
  request: Request,
  referrer: string | null,
  userAgent: string | null,
) {
  const headers = request.headers;

  return {
    city: headerValue(headers, "x-vercel-ip-city"),
    country: headerValue(headers, "x-vercel-ip-country"),
    deviceType: inferDeviceType(userAgent),
    referrerHost: referrerHost(referrer),
    region: headerValue(headers, "x-vercel-ip-country-region"),
    source: trafficSource(referrer),
    userAgentFamily: inferUserAgentFamily(userAgent),
  };
}

function headerValue(headers: Headers, key: string) {
  const value = headers.get(key);
  return value ? decodeURIComponent(value).trim() : "";
}

function referrerHost(referrer: string | null) {
  if (!referrer) {
    return "";
  }

  try {
    const host = new URL(referrer).hostname.replace(/^www\./, "");
    return host === "dealswithdennis.com" ? "" : host;
  } catch {
    return "";
  }
}

function trafficSource(referrer: string | null) {
  const host = referrerHost(referrer);

  if (!host) {
    return "Direct / unknown";
  }

  if (host.includes("instagram")) return "Instagram";
  if (host.includes("tiktok")) return "TikTok";
  if (host.includes("facebook")) return "Facebook";
  if (host.includes("google")) return "Google";
  if (host.includes("youtube")) return "YouTube";

  return host;
}

function inferDeviceType(userAgent: string | null) {
  const value = userAgent?.toLowerCase() ?? "";

  if (/ipad|tablet/.test(value)) return "Tablet";
  if (/mobi|iphone|android/.test(value)) return "Mobile";
  if (value) return "Desktop";

  return "Unknown";
}

function inferUserAgentFamily(userAgent: string | null) {
  const value = userAgent?.toLowerCase() ?? "";

  if (value.includes("edg/")) return "Edge";
  if (value.includes("chrome/")) return "Chrome";
  if (value.includes("safari/")) return "Safari";
  if (value.includes("firefox/")) return "Firefox";

  return value ? "Other" : "Unknown";
}
