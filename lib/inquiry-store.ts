import { createSupabaseAdmin } from "./supabase/admin";

export type ContactInquiry = {
  appointmentDate: string;
  appointmentNotes: string;
  appointmentTime: string;
  clientsInHandsDealId: string;
  clientsInHandsError: string;
  clientsInHandsStatus: string;
  createdAt: string;
  email: string;
  id: string;
  message: string;
  name: string;
  phone: string;
  preferredContactMethod: string;
  source: string;
  vehicleStockNumber: string;
  vehicleType: string;
};

type ContactInquiryRow = {
  appointment_date: string | null;
  appointment_notes: string | null;
  appointment_time: string | null;
  clients_in_hands_deal_id: string | null;
  clients_in_hands_error: string | null;
  clients_in_hands_status: string | null;
  created_at: string;
  email: string | null;
  id: string;
  message: string | null;
  name: string | null;
  phone: string | null;
  preferred_contact_method: string | null;
  source: string | null;
  vehicle_stock_number: string | null;
  vehicle_type: string | null;
};

export async function getContactInquiries() {
  const supabase = createSupabaseAdmin();

  if (!supabase) {
    return [];
  }

  const primary = await supabase
    .from("contact_inquiries")
    .select("id, name, phone, email, preferred_contact_method, vehicle_type, vehicle_stock_number, message, source, appointment_date, appointment_time, appointment_notes, clients_in_hands_status, clients_in_hands_deal_id, clients_in_hands_error, created_at")
    .order("created_at", { ascending: false });
  let data = primary.data as ContactInquiryRow[] | null;
  let error = primary.error;

  if (error && isMissingContactColumnError(error)) {
    const retry = await supabase
      .from("contact_inquiries")
      .select("id, name, phone, vehicle_type, message, source, created_at")
      .order("created_at", { ascending: false });

    data = retry.data as ContactInquiryRow[] | null;
    error = retry.error;
  }

  if (error || !data) {
    return [];
  }

  return (data as ContactInquiryRow[]).map((row) => ({
    appointmentDate: row.appointment_date ?? "",
    appointmentNotes: row.appointment_notes ?? "",
    appointmentTime: row.appointment_time ?? "",
    clientsInHandsDealId: row.clients_in_hands_deal_id ?? "",
    clientsInHandsError: row.clients_in_hands_error ?? "",
    clientsInHandsStatus: row.clients_in_hands_status ?? "",
    createdAt: row.created_at,
    email: row.email ?? "",
    id: row.id,
    message: row.message ?? "",
    name: row.name ?? "",
    phone: row.phone ?? "",
    preferredContactMethod: row.preferred_contact_method ?? "phone",
    source: row.source ?? "website",
    vehicleStockNumber: row.vehicle_stock_number ?? "",
    vehicleType: row.vehicle_type ?? "Not sure yet",
  }));
}

function isMissingContactColumnError(error: { message?: string } | null) {
  return Boolean(
    error?.message &&
      /(appointment_|preferred_contact_method|vehicle_|clients_in_hands_|email)/i.test(
        error.message,
      ),
  );
}
