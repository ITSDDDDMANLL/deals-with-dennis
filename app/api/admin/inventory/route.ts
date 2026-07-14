import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getFeaturedVehicles } from "../../../data/inventory";
import { getAdminCookieName, isAdminSessionValueValid } from "../../../../lib/admin-auth";
import {
  getInventoryVehicles,
  saveInventoryVehicles,
} from "../../../../lib/inventory-store";

export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const vehicles = await getInventoryVehicles(getFeaturedVehicles(), {
    includeHidden: true,
  });

  return NextResponse.json({ vehicles });
}

export async function PUT(request: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);

  if (!Array.isArray(body?.vehicles)) {
    return NextResponse.json(
      { error: "Expected vehicles array." },
      { status: 400 },
    );
  }

  try {
    const result = await saveInventoryVehicles(body.vehicles);

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Vehicle save failed.",
        details: getErrorMessage(error),
      },
      { status: 500 },
    );
  }
}

async function isAuthenticated() {
  const cookieStore = await cookies();
  const value = cookieStore.get(getAdminCookieName())?.value;

  return isAdminSessionValueValid(value);
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
