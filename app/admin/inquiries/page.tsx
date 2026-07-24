import { cookies } from "next/headers";
import type { Metadata } from "next";
import { AdminHeader } from "../AdminHeader";
import { AdminLogin } from "../AdminLogin";
import {
  getAdminCookieName,
  isAdminSessionValueValid,
} from "../../../lib/admin-auth";
import { getContactInquiries } from "../../../lib/inquiry-store";
import { RetryLeadButton } from "../RetryLeadButton";

export const dynamic = "force-dynamic";
const vancouverTimeZone = "America/Vancouver";

export const metadata: Metadata = {
  robots: {
    follow: false,
    index: false,
  },
  title: "Inquiries · Deals with Dennis",
};

export default async function AdminInquiriesPage() {
  const cookieStore = await cookies();
  const isAuthenticated = isAdminSessionValueValid(
    cookieStore.get(getAdminCookieName())?.value,
  );
  const inquiries = isAuthenticated ? await getContactInquiries() : [];
  const todayCount = inquiries.filter((inquiry) =>
    isSameLocalDate(inquiry.createdAt, new Date()),
  ).length;
  const vehicleCount = inquiries.filter(
    (inquiry) => inquiry.vehicleType && inquiry.vehicleType !== "Not sure yet",
  ).length;

  return (
    <main className="admin-page">
      <AdminHeader section="Inquiries" />

      <div className="page-shell">
        {isAuthenticated ? (
          <>
            <section className="admin-hero">
              <div>
                <p className="eyebrow">Private workspace</p>
                <h1>Inquiries</h1>
              </div>
              <p>
                Review website leads from the Contact Dennis forms, including
                who reached out, what vehicle they asked about, and their
                message.
              </p>
            </section>

            <section className="history-shell">
              <div className="history-summary">
                <div>
                  <span>Total inquiries</span>
                  <strong>{inquiries.length}</strong>
                </div>
                <div>
                  <span>Today</span>
                  <strong>{todayCount}</strong>
                </div>
                <div>
                  <span>Vehicle-specific</span>
                  <strong>{vehicleCount}</strong>
                </div>
              </div>

              <div className="inquiry-list" aria-label="Website inquiries">
                {inquiries.length ? (
                  inquiries.map((inquiry) => (
                    <article className="inquiry-card" key={inquiry.id}>
                      <div className="inquiry-card-head">
                        <div>
                          <span className="history-status sold">
                            {inquiry.source || "website"}
                          </span>
                          <h2>{inquiry.name || "No name"}</h2>
                          {inquiry.phone ? (
                            <a href={`tel:${phoneHref(inquiry.phone)}`}>
                              {inquiry.phone}
                            </a>
                          ) : null}
                          {inquiry.email ? (
                            <a href={`mailto:${inquiry.email}`}>
                              {inquiry.email}
                            </a>
                          ) : null}
                        </div>
                        <time dateTime={inquiry.createdAt}>
                          {formatInquiryDate(inquiry.createdAt)}
                        </time>
                      </div>

                      <dl className="history-meta inquiry-meta">
                        <div>
                          <dt>Vehicle interest</dt>
                          <dd>{labelVehicleType(inquiry.vehicleType)}</dd>
                        </div>
                        <div>
                          <dt>Source</dt>
                          <dd>{inquiry.source || "website"}</dd>
                        </div>
                        <div>
                          <dt>Preferred contact</dt>
                          <dd>{labelContactMethod(inquiry.preferredContactMethod)}</dd>
                        </div>
                        <div>
                          <dt>Appointment</dt>
                          <dd>
                            {inquiry.appointmentDate
                              ? `${inquiry.appointmentDate} ${inquiry.appointmentTime || ""}`.trim()
                              : "No appointment"}
                          </dd>
                        </div>
                        <div>
                          <dt>Stock #</dt>
                          <dd>{inquiry.vehicleStockNumber || "N/A"}</dd>
                        </div>
                        <div>
                          <dt>Clients in Hands</dt>
                          <dd>
                            {labelClientsInHandsStatus(inquiry.clientsInHandsStatus)}
                            {inquiry.clientsInHandsError ? ` - ${inquiry.clientsInHandsError}` : ""}
                          </dd>
                        </div>
                      </dl>

                      <section className="inquiry-message">
                        <h3>Message</h3>
                        <p>{inquiry.message || "No message provided."}</p>
                        {inquiry.appointmentNotes ? (
                          <p>Appointment notes: {inquiry.appointmentNotes}</p>
                        ) : null}
                        {inquiry.clientsInHandsStatus !== "sent" ? (
                          <RetryLeadButton inquiryId={inquiry.id} />
                        ) : null}
                      </section>
                    </article>
                  ))
                ) : (
                  <p className="admin-empty">No inquiries yet.</p>
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

function formatInquiryDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value || "No date";
  }

  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeZone: vancouverTimeZone,
    timeStyle: "short",
  }).format(date);
}

function isSameLocalDate(value: string, compareDate: Date) {
  const date = new Date(value);
  const dateParts = vancouverDateParts(date);
  const compareParts = vancouverDateParts(compareDate);

  return (
    !Number.isNaN(date.getTime()) &&
    dateParts.year === compareParts.year &&
    dateParts.month === compareParts.month &&
    dateParts.day === compareParts.day
  );
}

function vancouverDateParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: vancouverTimeZone,
    year: "numeric",
  }).formatToParts(date);

  return {
    day: parts.find((part) => part.type === "day")?.value ?? "",
    month: parts.find((part) => part.type === "month")?.value ?? "",
    year: parts.find((part) => part.type === "year")?.value ?? "",
  };
}

function labelVehicleType(value: string) {
  if (value === "new") {
    return "New vehicle";
  }

  if (value === "used") {
    return "Used vehicle";
  }

  return value || "Not sure yet";
}

function phoneHref(value: string) {
  return value.replace(/[^\d+]/g, "");
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
