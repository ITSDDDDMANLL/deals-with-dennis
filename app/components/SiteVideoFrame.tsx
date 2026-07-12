import type { SiteVideo } from "../../lib/video-store";

type SiteVideoFrameProps = {
  className?: string;
  video: Pick<SiteVideo, "title" | "thumbnailUrl" | "videoUrl">;
};

export function SiteVideoFrame({ className = "", video }: SiteVideoFrameProps) {
  const embedUrl = getEmbeddableVideoUrl(video.videoUrl);
  const isDirectVideo = isDirectVideoUrl(video.videoUrl);

  if (embedUrl) {
    return (
      <iframe
        allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
        className={`video-embed-frame ${className}`.trim()}
        loading="lazy"
        src={embedUrl}
        title={video.title || "Deals with Dennis video"}
      />
    );
  }

  if (!isDirectVideo) {
    return (
      <div className={`external-video-preview ${className}`}>
        {video.thumbnailUrl ? (
          <img
            alt=""
            className="external-video-thumbnail"
            src={video.thumbnailUrl}
          />
        ) : null}
        <span>Deals with Dennis</span>
        <p>{video.title || "Social video"}</p>
        <a href={video.videoUrl} rel="noopener" target="_blank">
          Open video
        </a>
      </div>
    );
  }

  return (
    <video
      className={`video-file-frame ${className}`.trim()}
      controls
      playsInline
      poster={video.thumbnailUrl || undefined}
      preload="metadata"
      src={video.videoUrl}
    />
  );
}

function isDirectVideoUrl(value: string) {
  const url = safeUrl(value);

  if (!url) {
    return false;
  }

  return /\.(mp4|mov|m4v|webm)(\?.*)?$/i.test(url.pathname + url.search);
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
