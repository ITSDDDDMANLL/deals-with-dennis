import { cookies } from "next/headers";
import type { Metadata } from "next";
import { AdminHeader } from "../AdminHeader";
import { AdminLogin } from "../AdminLogin";
import { AdminContentManager } from "./AdminContentManager";
import {
  getAdminCookieName,
  isAdminSessionValueValid,
} from "../../../lib/admin-auth";
import { getSiteContent } from "../../../lib/site-content";
import { getSiteVideos } from "../../../lib/video-store";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: {
    follow: false,
    index: false,
  },
  title: "Content Admin · Deals with Dennis",
};

export default async function AdminContentPage() {
  const cookieStore = await cookies();
  const isAuthenticated = isAdminSessionValueValid(
    cookieStore.get(getAdminCookieName())?.value,
  );
  const videos = isAuthenticated
    ? await getSiteVideos([], { includeHidden: true })
    : [];
  const content = isAuthenticated ? await getSiteContent() : null;

  return (
    <main className="admin-page">
      <AdminHeader section="Content Admin" />

      <div className="page-shell">
        {isAuthenticated ? (
          <>
            <section className="admin-hero">
              <div>
                <p className="eyebrow">Private workspace</p>
                <h1>Content management</h1>
              </div>
              <p>
                Manage website media and text outside of vehicle inventory.
                Homepage videos live here first; photos, profile content, and
                section copy can be added here next.
              </p>
            </section>

            <AdminContentManager
              initialContent={content}
              initialVideos={videos}
            />
          </>
        ) : (
          <AdminLogin />
        )}
      </div>
    </main>
  );
}
