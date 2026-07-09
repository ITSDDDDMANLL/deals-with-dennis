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

  const supabase = createSupabaseAdmin();

  if (!supabase) {
    return NextResponse.json({
      ok: true,
      mode: "local",
      message:
        "Inquiry accepted locally. Add Supabase env vars in Vercel to persist submissions.",
    });
  }

  const { error } = await supabase.from("contact_inquiries").insert({
    name: String(body.name),
    phone: String(body.phone),
    vehicle_type: body.vehicleType ? String(body.vehicleType) : null,
    message: body.message ? String(body.message) : null,
    source: "website",
  });

  if (error) {
    return NextResponse.json(
      { error: "Unable to save inquiry." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    mode: "supabase",
    message: "Inquiry saved.",
  });
}
