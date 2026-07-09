import type { SiteVideo } from "../../lib/video-store";

type SiteVideoFrameProps = {
  className?: string;
  video: Pick<SiteVideo, "title" | "thumbnailUrl" | "videoUrl">;
};

export function SiteVideoFrame({ className = "", video }: SiteVideoFrameProps) {
  const embedUrl = getEmbeddableVideoUrl(video.videoUrl);

  if (embedUrl) {
    return (
      <iframe
        allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
        className={className}
        loading="lazy"
        src={embedUrl}
        title={video.title || "Deals with Dennis video"}
      />
    );
  }

  return (
    <video
      className={className}
      controls
      playsInline
      poster={video.thumbnailUrl || undefined}
      preload="metadata"
      src={video.videoUrl}
    />
  );
}

function getEmbeddableVideoUrl(value: string) {
  if (!value) {
    return "";
  }

  const url = safeUrl(value);

  if (!url) {
    return "";
  }

  if (url.hostname.includes("tiktok.com")) {
    const id = url.pathname.match(/\/video\/(\d+)/)?.[1];
    return id ? `https://www.tiktok.com/embed/v2/${id}` : "";
  }

  if (url.hostname.includes("youtube.com")) {
    const id = url.searchParams.get("v");
    return id ? `https://www.youtube.com/embed/${id}` : "";
  }

  if (url.hostname.includes("youtu.be")) {
    const id = url.pathname.replace("/", "");
    return id ? `https://www.youtube.com/embed/${id}` : "";
  }

  return "";
}

function safeUrl(value: string) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}
