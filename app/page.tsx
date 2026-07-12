import { ContactForm } from "./components/ContactForm";
import { InventoryBrowser } from "./components/InventoryBrowser";
import { SiteVideoFrame } from "./components/SiteVideoFrame";
import { getFeaturedVehicles } from "./data/inventory";
import { getInventoryVehicles } from "../lib/inventory-store";
import { getSiteVideos } from "../lib/video-store";

const socialLinks = [
  { label: "Instagram", href: "https://www.instagram.com/dealswithdennis/" },
  { label: "TikTok", href: "https://www.tiktok.com/@dealswithdennis" },
  { label: "YouTube", href: "https://www.youtube.com/@dealswithdennis/" },
  {
    label: "Facebook",
    href: "https://www.facebook.com/profile.php?id=61576507501713",
  },
];

export const dynamic = "force-dynamic";

export default async function Home() {
  const vehicles = await getInventoryVehicles(getFeaturedVehicles());
  const videos = await getSiteVideos();
  const featuredVideo = videos[0];

  return (
    <main>
      <header className="site-header">
        <nav className="nav-shell" aria-label="Primary navigation">
          <a className="brand" href="#top" aria-label="Dennis Liu home">
            Deals with Dennis <span>Dennis Liu · Sales Consultant</span>
          </a>
          <div className="nav-links">
            <a href="#inventory">Featured</a>
            <a href="/inventory">Inventory</a>
            <a href="#about">About</a>
            <a className="nav-cta" href="#contact">
              Book a Visit
            </a>
          </div>
        </nav>
      </header>

      <section className="ticker" aria-label="Dealer highlights">
        <div className="ticker-track">
          <span>Deals with Dennis picks</span>
          <span>Fresh inventory drops</span>
          <span>Walk-around videos coming</span>
          <span>Trade-ins welcome</span>
          <span>Cam Clark Ford Richmond</span>
          <span>DM for availability</span>
          <span>New and used vehicles</span>
          <span>Test drives by appointment</span>
          <span>Trade-ins welcome</span>
        </div>
      </section>

      <div className="page-shell" id="top">
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">Deals with Dennis · Cam Clark Ford Richmond</p>
            <h1>Fresh car finds, picked by Dennis, Deals with Dennis.</h1>
            <p className="lead">
              A short list of cars worth checking out first. Watch the socials,
              browse the inventory, then message me before you visit.
            </p>
            <div className="hero-actions">
              <a className="button primary" href="#inventory">
                View Featured
              </a>
              <a className="button secondary" href="/inventory">
                Inventory
              </a>
              <a className="button secondary" href="#contact">
                Contact Me
              </a>
            </div>
          </div>

          <aside className="profile-panel" aria-label="Dennis Liu profile">
            <p className="profile-badge">Latest picks</p>
            <div className="profile-image">
              <img src="/dennis-liu.jpg" alt="Dennis Liu" />
            </div>
            <div className="profile-details">
              <div>
                <p className="profile-name">Dennis Liu</p>
                <p className="muted">Deals with Dennis</p>
              </div>
              <div className="dealer-card">
                <p>Cam Clark Ford Richmond</p>
                <span>13580 Smallwood Pl, Richmond</span>
              </div>
            </div>
          </aside>
        </section>

        <section className="section inventory-feature" id="inventory">
          <div className="section-head">
            <div>
              <p className="eyebrow">Current stock</p>
              <h2>Featured Inventory</h2>
            </div>
            <p>
              Hand-picked vehicles I want to highlight. Use the inventory page
              for every available listing.
            </p>
          </div>
          <InventoryBrowser
            analyticsContext="featured_inventory"
            vehicles={vehicles}
          />
          <div className="inventory-more">
            <a className="button secondary" href="/inventory">
              View Inventory
            </a>
          </div>
        </section>

        <section className="section about-section" id="about">
          <div className="about-copy">
            <p className="eyebrow">About Dennis</p>
            <h2>Follow Deals with Dennis for quick car finds.</h2>
            <p>
              I make short, practical car content for people who want the real
              details before they visit the store: what just arrived, what is
              worth seeing first, and what each vehicle feels like in person.
            </p>
            <p>
              Deals with Dennis is where I post walk-arounds, fresh inventory
              drops, quick takes, and simple buying notes so you can compare
              options without the dealership pressure.
            </p>
            <div className="social-row">
              {socialLinks.map((link) => (
                <a
                  className="social-pill"
                  href={link.href}
                  key={link.href}
                  rel="noopener"
                  target="_blank"
                >
                  {link.label}
                </a>
              ))}
            </div>
          </div>
          <div className="media-panel video-panel">
            {featuredVideo ? (
              <>
                <SiteVideoFrame video={featuredVideo} />
                <div className="video-caption">
                  <p className="media-kicker">Deals with Dennis</p>
                  <h3>{featuredVideo.title || "Latest walk-around"}</h3>
                  {featuredVideo.description ? (
                    <p>{featuredVideo.description}</p>
                  ) : null}
                </div>
              </>
            ) : (
              <div className="video-placeholder">
                <p className="media-kicker">Deals with Dennis</p>
                <h3>Inventory drops, quick takes, and walk-arounds.</h3>
                <p>
                  Upload a featured video from the admin page and it will play
                  here for visitors.
                </p>
              </div>
            )}
          </div>
        </section>

        <section className="section contact-section" id="contact">
          <div className="contact-copy">
            <p className="eyebrow">Book a visit</p>
            <h2>Ask a question or schedule a test drive.</h2>
            <p>
              Leave your details and I will follow up to confirm availability,
              timing, and next steps.
            </p>
            <dl className="info-list">
              <div>
                <dt>Address</dt>
                <dd>13580 Smallwood Pl, Richmond, BC V6V 2C1</dd>
              </div>
              <div>
                <dt>Hours</dt>
                <dd>Mon-Thu 9-7 · Fri-Sat 9-6 · Sun 11-5</dd>
              </div>
            </dl>
          </div>
          <ContactForm />
        </section>
      </div>

      <footer className="footer">
        <span>Cam Clark Ford Richmond · Dennis Liu</span>
        <span>
          Dealer #10904 · Vehicle information must be confirmed in person
        </span>
      </footer>
    </main>
  );
}
