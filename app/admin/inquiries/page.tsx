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
      <header className="site-header">
        <nav className="nav-shell" aria-label="Admin inquiries navigation">
          <a className="brand" href="/admin">
            Dennis Liu <span>Inquiries</span>
          </a>
          <div className="nav-links">
            <a href="/admin">Inventory Admin</a>
            <a href="/admin/analytics">Analytics</a>
            <a href="/admin/history">History</a>
            <a href="/">Public Site</a>
            <a className="nav-cta" href="/inventory">
              View Inventory
            </a>
          </div>
        </nav>
      </header>

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
                          <a href={`tel:${phoneHref(inquiry.phone)}`}>
                            {inquiry.phone || "No phone"}
                          </a>
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
                      </dl>

                      <section className="inquiry-message">
                        <h3>Message</h3>
                        <p>{inquiry.message || "No message provided."}</p>
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
    timeStyle: "short",
  }).format(date);
}

function isSameLocalDate(value: string, compareDate: Date) {
  const date = new Date(value);

  return (
    !Number.isNaN(date.getTime()) &&
    date.getFullYear() === compareDate.getFullYear() &&
    date.getMonth() === compareDate.getMonth() &&
    date.getDate() === compareDate.getDate()
  );
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
