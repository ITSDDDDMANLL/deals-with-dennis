import { createSupabaseAdmin } from "./supabase/admin";

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
    return options.includeHidden
      ? fallback
      : fallback.filter((video) => video.isFeatured !== false);
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
    throw error;
  }

  return { mode: "supabase", count: videos.length };
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
