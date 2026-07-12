import { createSupabaseAdmin } from "./supabase/admin";

export type ContactInquiry = {
  createdAt: string;
  id: string;
  message: string;
  name: string;
  phone: string;
  source: string;
  vehicleType: string;
};

type ContactInquiryRow = {
  created_at: string;
  id: string;
  message: string | null;
  name: string | null;
  phone: string | null;
  source: string | null;
  vehicle_type: string | null;
};

export async function getContactInquiries() {
  const supabase = createSupabaseAdmin();

  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("contact_inquiries")
    .select("id, name, phone, vehicle_type, message, source, created_at")
    .order("created_at", { ascending: false });

  if (error || !data) {
    return [];
  }

  return (data as ContactInquiryRow[]).map((row) => ({
    createdAt: row.created_at,
    id: row.id,
    message: row.message ?? "",
    name: row.name ?? "",
    phone: row.phone ?? "",
    source: row.source ?? "website",
    vehicleType: row.vehicle_type ?? "Not sure yet",
  }));
}
