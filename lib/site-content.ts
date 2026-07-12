import { createSupabaseAdmin } from "./supabase/admin";

const homepageContentKey = "homepage";

export type SocialLink = {
  href: string;
  label: string;
};

export type SiteContent = {
  aboutBodyOne: string;
  aboutBodyTwo: string;
  aboutEyebrow: string;
  aboutHeadline: string;
  brandLabel: string;
  brandSubLabel: string;
  contactAddress: string;
  contactBody: string;
  contactEyebrow: string;
  contactHeadline: string;
  contactHours: string;
  dealerAddress: string;
  dealerName: string;
  footerLeft: string;
  footerRight: string;
  heroEyebrow: string;
  heroHeadline: string;
  heroLead: string;
  inventoryBody: string;
  inventoryEyebrow: string;
  inventoryTitle: string;
  profileBadge: string;
  profileImageUrl: string;
  profileName: string;
  profileSubtitle: string;
  socialLinks: SocialLink[];
  tickerItems: string[];
  videoPlaceholderBody: string;
  videoPlaceholderTitle: string;
};

type SiteContentRow = {
  content: Partial<SiteContent> | null;
};

export const defaultSiteContent: SiteContent = {
  aboutBodyOne:
    "I make short, practical car content for people who want the real details before they visit the store: what just arrived, what is worth seeing first, and what each vehicle feels like in person.",
  aboutBodyTwo:
    "Deals with Dennis is where I post walk-arounds, fresh inventory drops, quick takes, and simple buying notes so you can compare options without the dealership pressure.",
  aboutEyebrow: "About Dennis",
  aboutHeadline: "Follow Deals with Dennis for quick car finds.",
  brandLabel: "Deals with Dennis",
  brandSubLabel: "Dennis Liu · Sales Consultant",
  contactAddress: "13580 Smallwood Pl, Richmond, BC V6V 2C1",
  contactBody:
    "Leave your details and I will follow up to confirm availability, timing, and next steps.",
  contactEyebrow: "Book a visit",
  contactHeadline: "Ask a question or schedule a test drive.",
  contactHours: "Mon-Thu 9-7 · Fri-Sat 9-6 · Sun 11-5",
  dealerAddress: "13580 Smallwood Pl, Richmond",
  dealerName: "Cam Clark Ford Richmond",
  footerLeft: "Cam Clark Ford Richmond · Dennis Liu",
  footerRight: "Dealer #10904 · Vehicle information must be confirmed in person",
  heroEyebrow: "Deals with Dennis · Cam Clark Ford Richmond",
  heroHeadline: "Fresh car finds, picked by Dennis, Deals with Dennis.",
  heroLead:
    "A short list of cars worth checking out first. Watch the socials, browse the inventory, then message me before you visit.",
  inventoryBody:
    "Hand-picked vehicles I want to highlight. Use the inventory page for every available listing.",
  inventoryEyebrow: "Current stock",
  inventoryTitle: "Featured Inventory",
  profileBadge: "Latest picks",
  profileImageUrl: "/dennis-liu.jpg",
  profileName: "Dennis Liu",
  profileSubtitle: "Deals with Dennis",
  socialLinks: [
    { label: "Instagram", href: "https://www.instagram.com/dealswithdennis/" },
    { label: "TikTok", href: "https://www.tiktok.com/@dealswithdennis" },
    { label: "YouTube", href: "https://www.youtube.com/@dealswithdennis/" },
    {
      label: "Facebook",
      href: "https://www.facebook.com/profile.php?id=61576507501713",
    },
  ],
  tickerItems: [
    "Deals with Dennis picks",
    "Fresh inventory drops",
    "Walk-around videos coming",
    "Trade-ins welcome",
    "Cam Clark Ford Richmond",
    "DM for availability",
    "New and used vehicles",
    "Test drives by appointment",
    "Trade-ins welcome",
  ],
  videoPlaceholderBody:
    "Upload a featured video from the admin page and it will play here for visitors.",
  videoPlaceholderTitle: "Inventory drops, quick takes, and walk-arounds.",
};

export async function getSiteContent() {
  const supabase = createSupabaseAdmin();

  if (!supabase) {
    return defaultSiteContent;
  }

  const { data, error } = await supabase
    .from("site_content")
    .select("content")
    .eq("content_key", homepageContentKey)
    .maybeSingle();

  if (error || !data) {
    return defaultSiteContent;
  }

  return mergeSiteContent((data as SiteContentRow).content ?? {});
}

export async function saveSiteContent(content: SiteContent) {
  const supabase = createSupabaseAdmin();

  if (!supabase) {
    return { mode: "local" };
  }

  const { error } = await supabase.from("site_content").upsert(
    {
      content,
      content_key: homepageContentKey,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "content_key" },
  );

  if (error) {
    throw error;
  }

  return { mode: "supabase" };
}

function mergeSiteContent(content: Partial<SiteContent>): SiteContent {
  return {
    ...defaultSiteContent,
    ...content,
    socialLinks: Array.isArray(content.socialLinks)
      ? content.socialLinks
      : defaultSiteContent.socialLinks,
    tickerItems: Array.isArray(content.tickerItems)
      ? content.tickerItems
      : defaultSiteContent.tickerItems,
  };
}
