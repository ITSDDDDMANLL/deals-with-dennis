"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import type { SiteVideo } from "../../../lib/video-store";
import { SiteVideoFrame } from "../../components/SiteVideoFrame";

const maxVideoSizeBytes = 250_000_000;
const maxThumbnailSizeBytes = 2_500_000;

const blankVideo: SiteVideo = {
  id: "new-video",
  title: "",
  description: "",
  videoUrl: "",
  thumbnailUrl: "",
  isFeatured: true,
  sortOrder: 0,
};

export function AdminContentManager({
  initialVideos,
}: {
  initialVideos: SiteVideo[];
}) {
  const [videos, setVideos] = useState<SiteVideo[]>(initialVideos);
  const [selectedVideoId, setSelectedVideoId] = useState(
    initialVideos[0]?.id ?? "",
  );
  const [notice, setNotice] = useState("");
  const [videoSaving, setVideoSaving] = useState(false);
  const [videoUploadStatus, setVideoUploadStatus] = useState("");

  useEffect(() => {
    void loadVideos();
  }, []);

  const selectedVideo = useMemo(
    () => videos.find((video) => video.id === selectedVideoId) ?? videos[0],
    [selectedVideoId, videos],
  );

  function updateVideo(id: string, patch: Partial<SiteVideo>) {
    setVideos((current) =>
      current.map((video) => (video.id === id ? { ...video, ...patch } : video)),
    );
  }

  async function loadVideos() {
    const response = await fetch("/api/admin/videos");

    if (!response.ok) {
      return;
    }

    const data = (await response.json()) as { videos?: SiteVideo[] };

    if (data.videos?.length) {
      setVideos(data.videos);
      setSelectedVideoId(data.videos[0].id);
    }
  }

  async function saveVideosOnly() {
    setVideoSaving(true);

    const response = await fetch("/api/admin/videos", {
      body: JSON.stringify({ videos }),
      headers: { "Content-Type": "application/json" },
      method: "PUT",
    });

    if (!response.ok) {
      const result = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      setNotice(result?.error ?? "Video save failed.");
      setVideoSaving(false);
      return;
    }

    const result = (await response.json()) as {
      databaseError?: string;
      mode?: string;
      count?: number;
    };
    setNotice(
      result.mode === "supabase" || result.mode === "supabase-storage"
        ? `Saved ${result.count ?? videos.length} homepage videos${
            result.databaseError ? " using Storage fallback" : ""
          }.`
        : "Video save did not reach Supabase. Check server environment variables.",
    );
    setVideoUploadStatus("");
    setVideoSaving(false);
  }

  async function uploadSiteVideo(
    id: string,
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    if (!isAllowedVideoFile(file) || file.size > maxVideoSizeBytes) {
      setNotice(
        "Video must be a .mov, .mp4, .m4v, or .webm file and 250 MB or smaller.",
      );
      return;
    }

    setVideoUploadStatus(`Preparing upload for ${file.name}...`);

    const response = await fetch("/api/admin/videos/upload", {
      body: JSON.stringify({
        contentType: file.type || getVideoContentType(file.name),
        fileName: file.name,
        fileSize: file.size,
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });

    if (!response.ok) {
      const result = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      setNotice(result?.error ?? "Video upload failed.");
      setVideoUploadStatus("");
      return;
    }

    const result = (await response.json()) as {
      contentType?: string;
      signedUrl?: string;
      videoUrl?: string;
      mode?: string;
    };

    if (result.signedUrl) {
      setVideoUploadStatus("Uploading video to Supabase...");
      const uploadForm = new FormData();
      uploadForm.append("cacheControl", "3600");
      uploadForm.append("", file);
      const uploadResponse = await fetch(result.signedUrl, {
        body: uploadForm,
        headers: { "x-upsert": "false" },
        method: "PUT",
      });

      if (!uploadResponse.ok) {
        setNotice("Video upload failed while sending the file to Supabase.");
        setVideoUploadStatus("");
        return;
      }
    }

    if (result.videoUrl) {
      updateVideo(id, { videoUrl: result.videoUrl });
      setNotice(
        `Video uploaded${result.mode === "supabase" ? " to Supabase Storage" : ""}. Click Save Videos to publish it.`,
      );
      setVideoUploadStatus("Upload complete. Click Save Videos to publish.");
    }
  }

  async function uploadVideoThumbnail(
    id: string,
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    if (!isAllowedImageFile(file) || file.size > maxThumbnailSizeBytes) {
      setNotice("Thumbnail must be an image file and 2.5 MB or smaller.");
      return;
    }

    setVideoUploadStatus(`Uploading thumbnail ${file.name}...`);

    const formData = new FormData();
    formData.append("vehicleId", `video-${id}`);
    formData.append("images", file);

    const response = await fetch("/api/admin/images", {
      body: formData,
      method: "POST",
    });

    if (!response.ok) {
      const result = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      setNotice(result?.error ?? "Thumbnail upload failed.");
      setVideoUploadStatus("");
      return;
    }

    const result = (await response.json()) as {
      imageUrls?: string[];
      mode?: string;
    };
    const thumbnailUrl = result.imageUrls?.[0] ?? "";

    if (!thumbnailUrl) {
      setNotice("Thumbnail upload did not return an image URL.");
      setVideoUploadStatus("");
      return;
    }

    updateVideo(id, { thumbnailUrl });
    setNotice(
      `Thumbnail uploaded${result.mode === "supabase" ? " to Supabase Storage" : ""}. Click Save Videos to publish it.`,
    );
    setVideoUploadStatus("Thumbnail uploaded. Click Save Videos to publish.");
  }

  function addVideo() {
    const id = `video-${Date.now()}`;
    const next = { ...blankVideo, id, sortOrder: videos.length };
    setVideos((current) => [next, ...current]);
    setSelectedVideoId(id);
    setNotice("New video added. Click Save Videos to publish it.");
  }

  function removeVideo(id: string) {
    const video = videos.find((item) => item.id === id);
    const confirmed = window.confirm(
      `Remove ${video?.title || "this video"} from homepage videos? Click Save Videos afterward to publish the change.`,
    );

    if (!confirmed) {
      return;
    }

    setVideos((current) => {
      const next = current.filter((video) => video.id !== id);
      setSelectedVideoId(next[0]?.id ?? "");
      return next;
    });
    setNotice("Video removed. Click Save Videos to publish the change.");
  }

  return (
    <section className="admin-shell content-admin-shell">
      <div className="admin-toolbar">
        <div>
          <p className="eyebrow">Website content</p>
          <h2>Media and homepage copy</h2>
        </div>
        <div className="admin-actions">
          <button className="button secondary" onClick={addVideo} type="button">
            Add Video
          </button>
          <button
            className="button primary"
            disabled={videoSaving}
            onClick={saveVideosOnly}
            type="button"
          >
            {videoSaving ? "Saving..." : "Save Videos"}
          </button>
        </div>
      </div>

      {notice ? <p className="admin-notice">{notice}</p> : null}

      <div className="content-placeholder-grid">
        <article>
          <p className="eyebrow">Videos</p>
          <h3>Homepage social media</h3>
          <p>
            Manage the featured video card on the landing page. Paste a
            TikTok/YouTube URL, upload a direct video, and set a thumbnail.
          </p>
        </article>
        <article>
          <p className="eyebrow">Coming next</p>
          <h3>Photos and website text</h3>
          <p>
            This page is ready to hold profile photos, section copy, social
            links, and other non-vehicle website content as separate controls.
          </p>
        </article>
      </div>

      <div className="admin-video-panel">
        <div className="editor-head">
          <div>
            <p className="eyebrow">Social media</p>
            <h3>Homepage videos</h3>
          </div>
        </div>
        <p className="admin-video-help">
          Upload a .mov/.mp4 file or paste a TikTok/YouTube URL. The preview
          updates before saving; click Save Videos to publish changes.
        </p>

        <div className="video-admin-workspace">
          <div className="admin-list video-list" aria-label="Homepage videos">
            {videos.map((video) => (
              <button
                className={video.id === selectedVideo?.id ? "active" : ""}
                key={video.id}
                onClick={() => setSelectedVideoId(video.id)}
                type="button"
              >
                <span>{video.title || "Untitled video"}</span>
                <small>
                  {video.isFeatured === false ? "Hidden" : "Featured"} ·{" "}
                  {video.videoUrl ? "Video ready" : "No video yet"}
                </small>
              </button>
            ))}
            {!videos.length ? (
              <p className="admin-empty">No videos yet. Add one to start.</p>
            ) : null}
          </div>

          {selectedVideo ? (
            <form className="admin-editor video-editor">
              <div className="video-upload-card">
                <VideoPreview video={selectedVideo} />
                {videoUploadStatus ? (
                  <p className="video-upload-status">{videoUploadStatus}</p>
                ) : null}
                <div className="admin-actions">
                  <label className="button secondary file-button">
                    Upload Video
                    <input
                      accept="video/*,.mov,.mp4,.m4v,.webm"
                      onChange={(event) => uploadSiteVideo(selectedVideo.id, event)}
                      type="file"
                    />
                  </label>
                  <button
                    className="button danger"
                    onClick={() => removeVideo(selectedVideo.id)}
                    type="button"
                  >
                    Remove
                  </button>
                </div>
              </div>

              <div className="editor-grid">
                <label>
                  <span>Title</span>
                  <input
                    value={selectedVideo.title}
                    onChange={(event) =>
                      updateVideo(selectedVideo.id, { title: event.target.value })
                    }
                    placeholder="Fresh trade-in walk-around"
                    type="text"
                  />
                </label>
                <label>
                  <span>Featured on homepage</span>
                  <select
                    value={selectedVideo.isFeatured === false ? "no" : "yes"}
                    onChange={(event) =>
                      updateVideo(selectedVideo.id, {
                        isFeatured: event.target.value === "yes",
                      })
                    }
                  >
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </label>
                <label className="editor-wide">
                  <span>Video URL</span>
                  <input
                    value={selectedVideo.videoUrl}
                    onChange={(event) =>
                      updateVideo(selectedVideo.id, {
                        videoUrl: event.target.value,
                      })
                    }
                    placeholder="Paste a TikTok/YouTube link or direct .mp4/.mov URL"
                    type="text"
                  />
                </label>
                <div className="editor-wide thumbnail-uploader">
                  <span>Thumbnail image</span>
                  {selectedVideo.thumbnailUrl ? (
                    <img
                      alt={`${selectedVideo.title || "Video"} thumbnail`}
                      src={selectedVideo.thumbnailUrl}
                    />
                  ) : (
                    <div className="thumbnail-empty">No thumbnail uploaded</div>
                  )}
                  <div className="admin-actions">
                    <label className="button secondary file-button">
                      Upload Thumbnail
                      <input
                        accept="image/*"
                        onChange={(event) =>
                          uploadVideoThumbnail(selectedVideo.id, event)
                        }
                        type="file"
                      />
                    </label>
                    {selectedVideo.thumbnailUrl ? (
                      <button
                        className="button ghost"
                        onClick={() =>
                          updateVideo(selectedVideo.id, { thumbnailUrl: "" })
                        }
                        type="button"
                      >
                        Remove Thumbnail
                      </button>
                    ) : null}
                  </div>
                </div>
                <label>
                  <span>Sort order</span>
                  <input
                    value={selectedVideo.sortOrder ?? 0}
                    onChange={(event) =>
                      updateVideo(selectedVideo.id, {
                        sortOrder: Number(event.target.value),
                      })
                    }
                    type="number"
                  />
                </label>
                <label className="editor-wide">
                  <span>Description</span>
                  <textarea
                    value={selectedVideo.description}
                    onChange={(event) =>
                      updateVideo(selectedVideo.id, {
                        description: event.target.value,
                      })
                    }
                    placeholder="A quick note to show below the video."
                    rows={4}
                  />
                </label>
              </div>
            </form>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function VideoPreview({ video }: { video: SiteVideo }) {
  const videoType = getVideoPreviewType(video.videoUrl);

  if (video.videoUrl) {
    return (
      <div className="content-video-preview">
        <SiteVideoFrame video={video} />
        <div className="preview-status">
          <strong>{videoType.label}</strong>
          <span>{videoType.help}</span>
        </div>
      </div>
    );
  }

  if (video.thumbnailUrl) {
    return (
      <div className="content-video-preview">
        <img
          alt={`${video.title || "Video"} thumbnail preview`}
          className="thumbnail-only-preview"
          src={video.thumbnailUrl}
        />
        <div className="preview-status">
          <strong>Thumbnail ready</strong>
          <span>Add a video URL or upload a video file to make it playable.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="video-upload-empty">
      <span>Deals with Dennis</span>
      <p>Upload a short walk-around or paste a TikTok/YouTube URL.</p>
    </div>
  );
}

function getVideoPreviewType(value: string) {
  const url = safeUrl(value);

  if (!url) {
    return {
      help: "This link cannot be embedded yet. It will show as an external open button.",
      label: "External link preview",
    };
  }

  if (url.hostname.includes("tiktok.com")) {
    return {
      help: "TikTok embeds may show a branded player after the URL is saved.",
      label: "TikTok preview",
    };
  }

  if (url.hostname.includes("youtube.com") || url.hostname.includes("youtu.be")) {
    return {
      help: "YouTube embeds are shown directly in the preview.",
      label: "YouTube preview",
    };
  }

  if (/\.(mp4|mov|m4v|webm)(\?.*)?$/i.test(url.pathname + url.search)) {
    return {
      help: "Direct video files preview in the browser player.",
      label: "Direct video preview",
    };
  }

  return {
    help: "This link will be displayed with an Open video button.",
    label: "External link preview",
  };
}

function getVideoContentType(fileName: string) {
  const lowerName = fileName.toLowerCase();

  if (lowerName.endsWith(".mov")) {
    return "video/quicktime";
  }

  if (lowerName.endsWith(".webm")) {
    return "video/webm";
  }

  if (lowerName.endsWith(".m4v")) {
    return "video/x-m4v";
  }

  return "video/mp4";
}

function isAllowedVideoFile(file: File) {
  const lowerName = file.name.toLowerCase();

  return (
    file.type.startsWith("video/") ||
    lowerName.endsWith(".mov") ||
    lowerName.endsWith(".mp4") ||
    lowerName.endsWith(".m4v") ||
    lowerName.endsWith(".webm")
  );
}

function isAllowedImageFile(file: File) {
  return file.type.startsWith("image/");
}

function safeUrl(value: string) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}
