import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  getAdminCookieName,
  isAdminSessionValueValid,
} from "../../../../../../lib/admin-auth";
import { pushLeadToClientsInHands } from "../../../../../../lib/clients-in-hands";
import { createSupabaseAdmin } from "../../../../../../lib/supabase/admin";

type InquiryRow = {
  appointment_date: string | null;
  appointment_notes: string | null;
  appointment_time: string | null;
  email: string | null;
  id: string;
  message: string | null;
  name: string | null;
  phone: string | null;
  preferred_contact_method: "email" | "phone" | "sms" | null;
  source: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_stock_number: string | null;
  vehicle_trim: string | null;
  vehicle_type: string | null;
  vehicle_vin: string | null;
  vehicle_year: number | null;
};

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const cookieStore = await cookies();
  const isAuthenticated = isAdminSessionValueValid(
    cookieStore.get(getAdminCookieName())?.value,
  );

  if (!isAuthenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase admin client is not configured." },
      { status: 503 },
    );
  }

  const { id } = await context.params;
  const { data, error } = await supabase
    .from("contact_inquiries")
    .select("id, name, phone, email, preferred_contact_method, vehicle_type, vehicle_year, vehicle_make, vehicle_model, vehicle_trim, vehicle_stock_number, vehicle_vin, message, source, appointment_date, appointment_time, appointment_notes")
    .eq("id", id)
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Inquiry was not found." },
      { status: 404 },
    );
  }

  const inquiry = data as InquiryRow;
  const result = await pushLeadToClientsInHands({
    appointmentDate: inquiry.appointment_date,
    appointmentNotes: inquiry.appointment_notes,
    appointmentTime: inquiry.appointment_time,
    email: inquiry.email,
    id: inquiry.id,
    message: inquiry.message,
    name: inquiry.name || "Website lead",
    phone: inquiry.phone,
    preferredContactMethod: inquiry.preferred_contact_method ?? "phone",
    source: inquiry.source,
    sourceUrl: process.env.NEXT_PUBLIC_SITE_URL
      ? `${process.env.NEXT_PUBLIC_SITE_URL}/admin/inquiries`
      : null,
    stage: "To Do",
    vehicle: {
      condition:
        inquiry.vehicle_type === "new"
          ? "New"
          : inquiry.vehicle_type === "used"
            ? "Used"
            : null,
      make: inquiry.vehicle_make,
      model: inquiry.vehicle_model,
      stockNumber: inquiry.vehicle_stock_number,
      trim: inquiry.vehicle_trim,
      vin: inquiry.vehicle_vin,
      year: inquiry.vehicle_year,
    },
  });

  await supabase
    .from("contact_inquiries")
    .update({
      clients_in_hands_deal_id: result.mode === "sent" ? result.dealId : null,
      clients_in_hands_error: result.mode === "failed" ? result.reason : null,
      clients_in_hands_status: result.mode,
    })
    .eq("id", id);

  if (result.mode !== "sent") {
    return NextResponse.json(
      { error: result.reason ?? "Lead was not pushed.", result },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true, result });
}
