import { createSupabaseAdmin } from "./supabase/admin";

const storageBucket = process.env.SUPABASE_SITE_VIDEO_BUCKET ?? "site-videos";
const storageConfigPath = "config/homepage-videos.json";

export type SiteVideo = {
  id: string;
  title: string;
  description: string;
  videoUrl: string;
  thumbnailUrl?: string;
  isFeatured?: boolean;
  sortOrder?: number;
};

type SiteVideoRow = {
  id: string;
  title: string | null;
  description: string | null;
  video_url: string | null;
  thumbnail_url: string | null;
  is_featured: boolean | null;
  sort_order: number | null;
};

export async function getSiteVideos(
  fallback: SiteVideo[] = [],
  options: { includeHidden?: boolean } = {},
) {
  const supabase = createSupabaseAdmin();

  if (!supabase) {
    return options.includeHidden
      ? fallback
      : fallback.filter((video) => video.isFeatured !== false);
  }

  let query = supabase
    .from("site_videos")
    .select(
      "id, title, description, video_url, thumbnail_url, is_featured, sort_order",
    )
    .order("is_featured", { ascending: false })
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (!options.includeHidden) {
    query = query.eq("is_featured", true);
  }

  const { data, error } = await query;

  if (error || !data?.length) {
    const storageVideos = await getStorageVideos(supabase);
    const nextVideos = storageVideos.length ? storageVideos : fallback;

    return options.includeHidden
      ? nextVideos
      : nextVideos.filter((video) => video.isFeatured !== false && video.videoUrl);
  }

  return (data as SiteVideoRow[]).map(rowToVideo).filter((video) => video.videoUrl);
}

export async function saveSiteVideos(videos: SiteVideo[]) {
  const supabase = createSupabaseAdmin();

  if (!supabase) {
    return { mode: "local", count: videos.length };
  }

  const rows = videos.map(videoToRow);
  const { error } = await supabase
    .from("site_videos")
    .upsert(rows, { onConflict: "id" });

  if (error) {
    const storageResult = await saveStorageVideos(supabase, videos);
    return { ...storageResult, databaseError: error.message };
  }

  return { mode: "supabase", count: videos.length };
}

async function getStorageVideos(
  supabase: NonNullable<ReturnType<typeof createSupabaseAdmin>>,
) {
  const { data, error } = await supabase.storage
    .from(storageBucket)
    .download(storageConfigPath);

  if (error || !data) {
    return [];
  }

  try {
    const parsed = JSON.parse(await data.text()) as SiteVideo[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveStorageVideos(
  supabase: NonNullable<ReturnType<typeof createSupabaseAdmin>>,
  videos: SiteVideo[],
) {
  await ensureStorageBucket(supabase);

  const { error } = await supabase.storage
    .from(storageBucket)
    .upload(storageConfigPath, JSON.stringify(videos, null, 2), {
      contentType: "application/json",
      upsert: true,
    });

  if (error) {
    throw error;
  }

  return { mode: "supabase-storage", count: videos.length };
}

async function ensureStorageBucket(
  supabase: NonNullable<ReturnType<typeof createSupabaseAdmin>>,
) {
  const { error } = await supabase.storage.createBucket(storageBucket, {
    public: true,
  });

  if (error && !error.message.toLowerCase().includes("already exists")) {
    throw error;
  }
}

function rowToVideo(row: SiteVideoRow): SiteVideo {
  return {
    id: row.id,
    title: row.title ?? "",
    description: row.description ?? "",
    videoUrl: row.video_url ?? "",
    thumbnailUrl: row.thumbnail_url ?? "",
    isFeatured: row.is_featured ?? true,
    sortOrder: row.sort_order ?? 0,
  };
}

function videoToRow(video: SiteVideo) {
  return {
    id: video.id,
    title: video.title || null,
    description: video.description || null,
    video_url: video.videoUrl || null,
    thumbnail_url: video.thumbnailUrl || null,
    is_featured: video.isFeatured !== false,
    sort_order: video.sortOrder ?? 0,
  };
}
