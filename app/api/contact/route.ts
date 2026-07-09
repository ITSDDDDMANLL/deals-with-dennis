import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "../../../lib/supabase/admin";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  if (!body?.name || !body?.phone) {
    return NextResponse.json(
      { error: "Name and phone are required." },
      { status: 400 },
    );
  }

  const inquiry = {
    name: String(body.name),
    phone: String(body.phone),
    vehicle_type: body.vehicleType ? String(body.vehicleType) : null,
    message: body.message ? String(body.message) : null,
    source: "website",
  };
  const supabase = createSupabaseAdmin();
  let saveMode = "local";

  if (supabase) {
    const { error } = await supabase.from("contact_inquiries").insert(inquiry);

    if (error) {
      return NextResponse.json(
        { error: "Unable to save inquiry." },
        { status: 500 },
      );
    }

    saveMode = "supabase";
  }

  const notification = await sendInquiryNotification(inquiry);

  return NextResponse.json({
    ok: true,
    mode: saveMode,
    notification,
    message: "Inquiry saved.",
  });
}

async function sendInquiryNotification(inquiry: {
  message: string | null;
  name: string;
  phone: string;
  source: string;
  vehicle_type: string | null;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.CONTACT_NOTIFICATION_EMAIL;
  const from =
    process.env.CONTACT_FROM_EMAIL ?? "Deals with Dennis <onboarding@resend.dev>";

  if (!apiKey || !to) {
    return { mode: "skipped", reason: "Email notification env vars not set." };
  }

  const subject = `New Deals with Dennis inquiry from ${inquiry.name}`;
  const text = [
    "New website inquiry",
    "",
    `Name: ${inquiry.name}`,
    `Phone: ${inquiry.phone}`,
    `Vehicle interest: ${inquiry.vehicle_type ?? "Not sure yet"}`,
    "",
    "Message:",
    inquiry.message || "No message provided.",
  ].join("\n");

  const response = await fetch("https://api.resend.com/emails", {
    body: JSON.stringify({
      from,
      subject,
      text,
      to,
    }),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    return { mode: "failed", status: response.status };
  }

  return { mode: "sent" };
}
