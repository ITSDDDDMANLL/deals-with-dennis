import { cookies } from "next/headers";
import type { Metadata } from "next";
import { AdminLogin } from "../AdminLogin";
import {
  getAdminCookieName,
  isAdminSessionValueValid,
} from "../../../lib/admin-auth";
import { getContactInquiries } from "../../../lib/inquiry-store";

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
  const smsManualCount = appointments.filter(
    (appointment) => appointment.preferredContactMethod === "sms",
  ).length;

  return (
    <main className="admin-page">
      <header className="site-header">
        <nav className="nav-shell" aria-label="Admin appointments navigation">
          <a className="brand" href="/admin">
            Dennis Liu <span>Appointments</span>
          </a>
          <div className="nav-links">
            <a href="/admin">Inventory Admin</a>
            <a href="/admin/analytics">Analytics</a>
            <a href="/admin/content">Content</a>
            <a href="/admin/inquiries">Inquiries</a>
            <a href="/admin/history">History</a>
            <a href="/">Public Site</a>
          </div>
        </nav>
      </header>

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

            <section className="history-shell">
              <div className="history-summary">
                <div>
                  <span>Total appointments</span>
                  <strong>{appointments.length}</strong>
                </div>
                <div>
                  <span>Manual SMS confirmations</span>
                  <strong>{smsManualCount}</strong>
                </div>
              </div>

              <div className="inquiry-list" aria-label="Appointments">
                {appointments.length ? (
                  appointments.map((appointment) => (
                    <article className="inquiry-card" key={appointment.id}>
                      <div className="inquiry-card-head">
                        <div>
                          <span className="history-status sold">
                            {appointment.preferredContactMethod === "sms"
                              ? "Manual SMS"
                              : "Appointment"}
                          </span>
                          <h2>{appointment.name || "No name"}</h2>
                          <p>
                            {appointment.appointmentDate}{" "}
                            {appointment.appointmentTime}
                          </p>
                        </div>
                        <time dateTime={appointment.createdAt}>
                          Requested {formatDate(appointment.createdAt)}
                        </time>
                      </div>

                      <dl className="history-meta inquiry-meta">
                        <div>
                          <dt>Phone</dt>
                          <dd>{appointment.phone || "N/A"}</dd>
                        </div>
                        <div>
                          <dt>Email</dt>
                          <dd>{appointment.email || "N/A"}</dd>
                        </div>
                        <div>
                          <dt>Preferred contact</dt>
                          <dd>{labelContactMethod(appointment.preferredContactMethod)}</dd>
                        </div>
                        <div>
                          <dt>Vehicle</dt>
                          <dd>
                            {labelVehicleType(appointment.vehicleType)}
                            {appointment.vehicleStockNumber
                              ? ` · Stock ${appointment.vehicleStockNumber}`
                              : ""}
                          </dd>
                        </div>
                        <div>
                          <dt>Clients in Hands</dt>
                          <dd>
                            {labelClientsInHandsStatus(appointment.clientsInHandsStatus)}
                            {appointment.clientsInHandsError
                              ? ` - ${appointment.clientsInHandsError}`
                              : ""}
                          </dd>
                        </div>
                      </dl>

                      <section className="inquiry-message">
                        <h3>Notes</h3>
                        <p>
                          {appointment.appointmentNotes ||
                            appointment.message ||
                            "No notes provided."}
                        </p>
                      </section>
                    </article>
                  ))
                ) : (
                  <p className="admin-empty">No appointments yet.</p>
                )}
              </div>
            </section>
          </>
        ) : (
          <AdminLogin />
        )}
      </div>
    </main>
  );
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value || "No date";
  }

  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function labelVehicleType(value: string) {
  if (value === "new") return "New vehicle";
  if (value === "used") return "Used vehicle";
  return value || "Not sure yet";
}

function labelContactMethod(value: string) {
  if (value === "email") return "Email";
  if (value === "sms") return "Text message";
  return "Phone call";
}

function labelClientsInHandsStatus(value: string) {
  if (value === "sent") return "Pushed";
  if (value === "failed") return "Failed";
  if (value === "skipped") return "Not configured";
  return "Pending";
}
