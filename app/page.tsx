import { ContactForm } from "./components/ContactForm";
import { InventoryBrowser } from "./components/InventoryBrowser";
import { SiteVideoFrame } from "./components/SiteVideoFrame";
import { getFeaturedVehicles } from "./data/inventory";
import { getInventoryVehicles } from "../lib/inventory-store";
import { getSiteContent } from "../lib/site-content";
import { getSiteVideos } from "../lib/video-store";

export const dynamic = "force-dynamic";

export default async function Home() {
  const vehicles = await getInventoryVehicles(getFeaturedVehicles());
  const content = await getSiteContent();
  const videos = await getSiteVideos();
  const featuredVideo = videos[0];

  return (
    <main>
      <header className="site-header">
        <nav className="nav-shell" aria-label="Primary navigation">
          <a className="brand" href="#top" aria-label="Dennis Liu home">
            {content.brandLabel} <span>{content.brandSubLabel}</span>
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
          {content.tickerItems.map((item, index) => (
            <span key={`${item}-${index}`}>{item}</span>
          ))}
        </div>
      </section>

      <div className="page-shell" id="top">
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">{content.heroEyebrow}</p>
            <h1>{content.heroHeadline}</h1>
            <p className="lead">{content.heroLead}</p>
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
            <p className="profile-badge">{content.profileBadge}</p>
            <div className="profile-image">
              <img src={content.profileImageUrl} alt={content.profileName} />
            </div>
            <div className="profile-details">
              <div>
                <p className="profile-name">{content.profileName}</p>
                <p className="muted">{content.profileSubtitle}</p>
              </div>
              <div className="dealer-card">
                <p>{content.dealerName}</p>
                <span>{content.dealerAddress}</span>
              </div>
            </div>
          </aside>
        </section>

        <section className="section inventory-feature" id="inventory">
          <div className="section-head">
            <div>
              <p className="eyebrow">{content.inventoryEyebrow}</p>
              <h2>{content.inventoryTitle}</h2>
            </div>
            <p>{content.inventoryBody}</p>
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
            <p className="eyebrow">{content.aboutEyebrow}</p>
            <h2>{content.aboutHeadline}</h2>
            <p>{content.aboutBodyOne}</p>
            <p>{content.aboutBodyTwo}</p>
            <div className="social-row">
              {content.socialLinks.map((link) => (
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
                <h3>{content.videoPlaceholderTitle}</h3>
                <p>{content.videoPlaceholderBody}</p>
              </div>
            )}
          </div>
        </section>

        <section className="section contact-section" id="contact">
          <div className="contact-copy">
            <p className="eyebrow">{content.contactEyebrow}</p>
            <h2>{content.contactHeadline}</h2>
            <p>{content.contactBody}</p>
            <dl className="info-list">
              <div>
                <dt>Address</dt>
                <dd>{content.contactAddress}</dd>
              </div>
              <div>
                <dt>Hours</dt>
                <dd>{content.contactHours}</dd>
              </div>
            </dl>
          </div>
          <ContactForm />
        </section>
      </div>

      <footer className="footer">
        <span>{content.footerLeft}</span>
        <span>{content.footerRight}</span>
      </footer>
    </main>
  );
}
