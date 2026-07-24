import { cookies } from "next/headers";
import type { Metadata } from "next";
import { AdminHeader } from "../AdminHeader";
import { AdminLogin } from "../AdminLogin";
import {
  getAdminCookieName,
  isAdminSessionValueValid,
} from "../../../lib/admin-auth";
import { getContactInquiries } from "../../../lib/inquiry-store";
import { AdminAppointmentCalendar } from "./AdminAppointmentCalendar";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: {
    follow: false,
    index: false,
  },
  title: "Appointments · Deals with Dennis",
};

export default async function AdminAppointmentsPage() {
  const cookieStore = await cookies();
  const isAuthenticated = isAdminSessionValueValid(
    cookieStore.get(getAdminCookieName())?.value,
  );
  const appointments = isAuthenticated
    ? (await getContactInquiries()).filter((inquiry) => inquiry.appointmentDate)
    : [];

  return (
    <main className="admin-page">
      <AdminHeader section="Appointments" />

      <div className="page-shell">
        {isAuthenticated ? (
          <>
            <section className="admin-hero">
              <div>
                <p className="eyebrow">Private workspace</p>
                <h1>Appointments</h1>
              </div>
              <p>
                Review requested visit times. SMS requests are marked so you
                can manually confirm them.
              </p>
            </section>

            <AdminAppointmentCalendar appointments={appointments} />
          </>
        ) : (
          <AdminLogin />
        )}
      </div>
    </main>
  );
}
