import { NextResponse } from "next/server";
import { pushLeadToClientsInHands } from "../../../lib/clients-in-hands";
import { createSupabaseAdmin } from "../../../lib/supabase/admin";

type PreferredContactMethod = "email" | "phone" | "sms";

function stringOrNull(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function preferredContactMethod(value: unknown): PreferredContactMethod {
  if (value === "email" || value === "sms" || value === "phone") {
    return value;
  }

  return "phone";
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  const name = stringOrNull(body?.name);
  const phone = stringOrNull(body?.phone);
  const email = stringOrNull(body?.email);

  if (!name || (!phone && !email)) {
    return NextResponse.json(
      { error: "Name and either phone or email are required." },
      { status: 400 },
    );
  }

  const contactMethod = preferredContactMethod(body?.preferredContactMethod);
  const inquiry = {
    appointment_date: stringOrNull(body.appointmentDate),
    appointment_notes: stringOrNull(body.appointmentNotes),
    appointment_time: stringOrNull(body.appointmentTime),
    email,
    message: stringOrNull(body.message),
    name,
    phone,
    preferred_contact_method: contactMethod,
    source: "website",
    vehicle_condition: stringOrNull(body.vehicleCondition),
    vehicle_make: stringOrNull(body.vehicleMake),
    vehicle_model: stringOrNull(body.vehicleModel),
    vehicle_stock_number: stringOrNull(body.vehicleStockNumber),
    vehicle_trim: stringOrNull(body.vehicleTrim),
    vehicle_type: stringOrNull(body.vehicleType),
    vehicle_vin: stringOrNull(body.vehicleVin),
    vehicle_year: body.vehicleYear ? Number(body.vehicleYear) : null,
  };
  const supabase = createSupabaseAdmin();
  let inquiryId = crypto.randomUUID();
  let saveMode = "local";

  if (supabase) {
    let { data, error } = await supabase
      .from("contact_inquiries")
      .insert(inquiry)
      .select("id")
      .single();

    if (isMissingContactColumnError(error)) {
      const retry = await supabase
        .from("contact_inquiries")
        .insert({
          message: inquiry.message,
          name: inquiry.name,
          phone: inquiry.phone ?? inquiry.email ?? "No phone provided",
          source: inquiry.source,
          vehicle_type: inquiry.vehicle_type,
        })
        .select("id")
        .single();

      data = retry.data;
      error = retry.error;
    }

    if (error) {
      return NextResponse.json(
        { error: "Unable to save inquiry.", details: error.message },
        { status: 500 },
      );
    }

    inquiryId = data?.id ?? inquiryId;
    saveMode = "supabase";
  }

  if (supabase) {
    await supabase.from("site_events").insert({
      event_type: "contact_submit",
      metadata: {
        appointmentDate: inquiry.appointment_date,
        hasMessage: Boolean(inquiry.message),
        preferredContactMethod: inquiry.preferred_contact_method,
        source: inquiry.source,
      },
      page_path: null,
      vehicle_label: inquiry.vehicle_type,
    });
  }

  const clientsInHands = await pushLeadToClientsInHands({
    appointmentDate: inquiry.appointment_date,
    appointmentNotes: inquiry.appointment_notes,
    appointmentTime: inquiry.appointment_time,
    email: inquiry.email,
    id: inquiryId,
    message: inquiry.message,
    name: inquiry.name,
    phone: inquiry.phone,
    preferredContactMethod: inquiry.preferred_contact_method,
    source: inquiry.source,
    sourceUrl: process.env.NEXT_PUBLIC_SITE_URL
      ? `${process.env.NEXT_PUBLIC_SITE_URL}/admin/inquiries`
      : null,
    vehicle: {
      condition: inquiry.vehicle_type === "new" ? "New" : inquiry.vehicle_type === "used" ? "Used" : null,
      make: inquiry.vehicle_make,
      model: inquiry.vehicle_model,
      stockNumber: inquiry.vehicle_stock_number,
      trim: inquiry.vehicle_trim,
      vin: inquiry.vehicle_vin,
      year: inquiry.vehicle_year,
    },
  });

  if (supabase) {
    const { error } = await supabase
      .from("contact_inquiries")
      .update({
        clients_in_hands_deal_id: clientsInHands.mode === "sent" ? clientsInHands.dealId : null,
        clients_in_hands_error: clientsInHands.mode === "failed" ? clientsInHands.reason : null,
        clients_in_hands_status: clientsInHands.mode,
      })
      .eq("id", inquiryId);

    if (error) {
      return NextResponse.json(
        {
          error: "Inquiry saved, but CRM status update failed.",
          details: error.message,
        },
        { status: 500 },
      );
    }
  }

  const notification = await sendInquiryNotification(inquiry, clientsInHands);

  return NextResponse.json({
    clientsInHands,
    ok: true,
    mode: saveMode,
    notification,
    message: "Inquiry saved.",
  });
}

function isMissingContactColumnError(error: { message?: string } | null) {
  return Boolean(
    error?.message &&
      /(appointment_|preferred_contact_method|vehicle_|clients_in_hands_|email)/i.test(
        error.message,
      ),
  );
}

async function sendInquiryNotification(inquiry: {
  appointment_date: string | null;
  appointment_notes: string | null;
  appointment_time: string | null;
  email: string | null;
  message: string | null;
  name: string;
  phone: string | null;
  preferred_contact_method: PreferredContactMethod;
  source: string;
  vehicle_type: string | null;
}, clientsInHands: { dealId?: string | null; mode: string; reason?: string }) {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.CONTACT_NOTIFICATION_EMAIL ?? process.env.ADMIN_NOTIFICATION_EMAIL;
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
    `Phone: ${inquiry.phone ?? "Not provided"}`,
    `Email: ${inquiry.email ?? "Not provided"}`,
    `Preferred contact: ${inquiry.preferred_contact_method.toUpperCase()}`,
    `Vehicle interest: ${inquiry.vehicle_type ?? "Not sure yet"}`,
    inquiry.appointment_date
      ? `Appointment requested: ${inquiry.appointment_date}${inquiry.appointment_time ? ` ${inquiry.appointment_time}` : ""}`
      : "Appointment requested: No",
    inquiry.preferred_contact_method === "sms"
      ? "SMS selected: manually send confirmation to the customer."
      : null,
    `Clients in Hands: ${clientsInHands.mode}${clientsInHands.dealId ? ` (${clientsInHands.dealId})` : ""}${clientsInHands.reason ? ` - ${clientsInHands.reason}` : ""}`,
    "",
    "Message:",
    inquiry.message || "No message provided.",
    inquiry.appointment_notes ? `\nAppointment notes:\n${inquiry.appointment_notes}` : null,
  ].filter(Boolean).join("\n");

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
