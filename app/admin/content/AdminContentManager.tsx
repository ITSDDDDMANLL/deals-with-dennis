"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import type { SiteContent, SocialLink } from "../../../lib/site-content";
import { defaultSiteContent } from "../../../lib/site-content";
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
  initialContent,
  initialVideos,
}: {
  initialContent: SiteContent | null;
  initialVideos: SiteVideo[];
}) {
  const [content, setContent] = useState<SiteContent>(
    initialContent ?? defaultSiteContent,
  );
  const [videos, setVideos] = useState<SiteVideo[]>(initialVideos);
  const [selectedVideoId, setSelectedVideoId] = useState(
    initialVideos[0]?.id ?? "",
  );
  const [notice, setNotice] = useState("");
  const [contentSaving, setContentSaving] = useState(false);
  const [videoSaving, setVideoSaving] = useState(false);
  const [videoUploadStatus, setVideoUploadStatus] = useState("");

  useEffect(() => {
    void loadContent();
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

  function updateContent(patch: Partial<SiteContent>) {
    setContent((current) => ({ ...current, ...patch }));
  }

  function updateSocialLink(index: number, patch: Partial<SocialLink>) {
    updateContent({
      socialLinks: content.socialLinks.map((link, currentIndex) =>
        currentIndex === index ? { ...link, ...patch } : link,
      ),
    });
  }

  function addSocialLink() {
    updateContent({
      socialLinks: [...content.socialLinks, { href: "", label: "New link" }],
    });
  }

  function removeSocialLink(index: number) {
    updateContent({
      socialLinks: content.socialLinks.filter((_, currentIndex) => currentIndex !== index),
    });
  }

  async function loadContent() {
    const response = await fetch("/api/admin/content");

    if (!response.ok) {
      return;
    }

    const data = (await response.json()) as { content?: SiteContent };

    if (data.content) {
      setContent(data.content);
    }
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

  async function saveContentOnly() {
    setContentSaving(true);

    const response = await fetch("/api/admin/content", {
      body: JSON.stringify({ content }),
      headers: { "Content-Type": "application/json" },
      method: "PUT",
    });

    if (!response.ok) {
      const result = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      setNotice(result?.error ?? "Website content save failed.");
      setContentSaving(false);
      return;
    }

    const result = (await response.json()) as { mode?: string };
    setNotice(
      result.mode === "supabase"
        ? "Saved website content to Supabase."
        : "Website content save did not reach Supabase. Check server environment variables.",
    );
    setContentSaving(false);
  }

  async function uploadProfileImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    if (!isAllowedImageFile(file) || file.size > maxThumbnailSizeBytes) {
      setNotice("Profile image must be an image file and 2.5 MB or smaller.");
      return;
    }

    setVideoUploadStatus(`Uploading profile image ${file.name}...`);

    const formData = new FormData();
    formData.append("vehicleId", "site-profile");
    formData.append("images", file);

    const response = await fetch("/api/admin/images", {
      body: formData,
      method: "POST",
    });

    if (!response.ok) {
      const result = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      setNotice(result?.error ?? "Profile image upload failed.");
      setVideoUploadStatus("");
      return;
    }

    const result = (await response.json()) as {
      imageUrls?: string[];
      mode?: string;
    };
    const profileImageUrl = result.imageUrls?.[0] ?? "";

    if (!profileImageUrl) {
      setNotice("Profile image upload did not return an image URL.");
      setVideoUploadStatus("");
      return;
    }

    updateContent({ profileImageUrl });
    setNotice(
      `Profile image uploaded${result.mode === "supabase" ? " to Supabase Storage" : ""}. Click Save Website Content to publish it.`,
    );
    setVideoUploadStatus("");
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
          <button
            className="button primary"
            disabled={contentSaving}
            onClick={saveContentOnly}
            type="button"
          >
            {contentSaving ? "Saving..." : "Save Website Content"}
          </button>
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

      <form className="admin-editor content-editor">
        <div className="editor-head">
          <div>
            <p className="eyebrow">Public website</p>
            <h3>Homepage text and photos</h3>
          </div>
          <button
            className="button primary"
            disabled={contentSaving}
            onClick={saveContentOnly}
            type="button"
          >
            {contentSaving ? "Saving..." : "Save Website Content"}
          </button>
        </div>

        <section className="content-editor-section">
          <h4>Header and hero</h4>
          <div className="editor-grid">
            <TextField
              label="Brand label"
              value={content.brandLabel}
              onChange={(value) => updateContent({ brandLabel: value })}
            />
            <TextField
              label="Brand subtitle"
              value={content.brandSubLabel}
              onChange={(value) => updateContent({ brandSubLabel: value })}
            />
            <TextField
              label="Hero eyebrow"
              value={content.heroEyebrow}
              onChange={(value) => updateContent({ heroEyebrow: value })}
            />
            <TextField
              label="Hero headline"
              value={content.heroHeadline}
              onChange={(value) => updateContent({ heroHeadline: value })}
            />
            <TextAreaField
              label="Hero lead"
              value={content.heroLead}
              onChange={(value) => updateContent({ heroLead: value })}
            />
          </div>
        </section>

        <section className="content-editor-section">
          <h4>Profile card</h4>
          <div className="profile-content-editor">
            <div className="thumbnail-uploader">
              <span>Profile image</span>
              <img alt={content.profileName} src={content.profileImageUrl} />
              <div className="admin-actions">
                <label className="button secondary file-button">
                  Upload Profile Image
                  <input
                    accept="image/*"
                    onChange={uploadProfileImage}
                    type="file"
                  />
                </label>
              </div>
            </div>
            <div className="editor-grid">
              <TextField
                label="Profile badge"
                value={content.profileBadge}
                onChange={(value) => updateContent({ profileBadge: value })}
              />
              <TextField
                label="Profile name"
                value={content.profileName}
                onChange={(value) => updateContent({ profileName: value })}
              />
              <TextField
                label="Profile subtitle"
                value={content.profileSubtitle}
                onChange={(value) => updateContent({ profileSubtitle: value })}
              />
              <TextField
                label="Dealer name"
                value={content.dealerName}
                onChange={(value) => updateContent({ dealerName: value })}
              />
              <TextField
                label="Dealer address"
                value={content.dealerAddress}
                onChange={(value) => updateContent({ dealerAddress: value })}
              />
            </div>
          </div>
        </section>

        <section className="content-editor-section">
          <h4>Featured inventory and about</h4>
          <div className="editor-grid">
            <TextField
              label="Inventory eyebrow"
              value={content.inventoryEyebrow}
              onChange={(value) => updateContent({ inventoryEyebrow: value })}
            />
            <TextField
              label="Inventory title"
              value={content.inventoryTitle}
              onChange={(value) => updateContent({ inventoryTitle: value })}
            />
            <TextAreaField
              label="Inventory body"
              value={content.inventoryBody}
              onChange={(value) => updateContent({ inventoryBody: value })}
            />
            <TextField
              label="About eyebrow"
              value={content.aboutEyebrow}
              onChange={(value) => updateContent({ aboutEyebrow: value })}
            />
            <TextField
              label="About headline"
              value={content.aboutHeadline}
              onChange={(value) => updateContent({ aboutHeadline: value })}
            />
            <TextAreaField
              label="About paragraph 1"
              value={content.aboutBodyOne}
              onChange={(value) => updateContent({ aboutBodyOne: value })}
            />
            <TextAreaField
              label="About paragraph 2"
              value={content.aboutBodyTwo}
              onChange={(value) => updateContent({ aboutBodyTwo: value })}
            />
          </div>
        </section>

        <section className="content-editor-section">
          <div className="content-section-head">
            <h4>Social links</h4>
            <button className="button secondary" onClick={addSocialLink} type="button">
              Add Link
            </button>
          </div>
          <div className="social-link-editor">
            {content.socialLinks.map((link, index) => (
              <div className="social-link-row" key={`${link.label}-${index}`}>
                <TextField
                  label="Label"
                  value={link.label}
                  onChange={(value) => updateSocialLink(index, { label: value })}
                />
                <TextField
                  label="URL"
                  value={link.href}
                  onChange={(value) => updateSocialLink(index, { href: value })}
                />
                <button
                  className="button danger"
                  onClick={() => removeSocialLink(index)}
                  type="button"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="content-editor-section">
          <h4>Contact, footer, and ticker</h4>
          <div className="editor-grid">
            <TextField
              label="Contact eyebrow"
              value={content.contactEyebrow}
              onChange={(value) => updateContent({ contactEyebrow: value })}
            />
            <TextField
              label="Contact headline"
              value={content.contactHeadline}
              onChange={(value) => updateContent({ contactHeadline: value })}
            />
            <TextAreaField
              label="Contact body"
              value={content.contactBody}
              onChange={(value) => updateContent({ contactBody: value })}
            />
            <TextField
              label="Contact address"
              value={content.contactAddress}
              onChange={(value) => updateContent({ contactAddress: value })}
            />
            <TextField
              label="Hours"
              value={content.contactHours}
              onChange={(value) => updateContent({ contactHours: value })}
            />
            <TextField
              label="Footer left"
              value={content.footerLeft}
              onChange={(value) => updateContent({ footerLeft: value })}
            />
            <TextField
              label="Footer right"
              value={content.footerRight}
              onChange={(value) => updateContent({ footerRight: value })}
            />
            <TextAreaField
              label="Ticker items"
              value={content.tickerItems.join("\n")}
              onChange={(value) =>
                updateContent({
                  tickerItems: value
                    .split("\n")
                    .map((item) => item.trim())
                    .filter(Boolean),
                })
              }
            />
            <TextField
              label="Video placeholder title"
              value={content.videoPlaceholderTitle}
              onChange={(value) =>
                updateContent({ videoPlaceholderTitle: value })
              }
            />
            <TextAreaField
              label="Video placeholder body"
              value={content.videoPlaceholderBody}
              onChange={(value) => updateContent({ videoPlaceholderBody: value })}
            />
          </div>
        </section>
      </form>

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

function TextField({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label>
      <span>{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        type="text"
      />
    </label>
  );
}

function TextAreaField({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className="editor-wide">
      <span>{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={4}
      />
    </label>
  );
}

function VideoPreview({ video }: { video: SiteVideo }) {
  const videoType = getVideoPreviewType(video.videoUrl);
  const previewThumbnailUrl =
    video.thumbnailUrl || getVideoThumbnailUrl(video.videoUrl);

  if (video.videoUrl) {
    if (previewThumbnailUrl && videoType.prefersThumbnail) {
      return (
        <div className="content-video-preview">
          <div className="admin-video-thumbnail-preview">
            <img
              alt={`${video.title || "Video"} preview`}
              src={previewThumbnailUrl}
            />
            <div>
              <span>Deals with Dennis</span>
              <strong>{video.title || "Social video"}</strong>
              <a href={video.videoUrl} rel="noopener" target="_blank">
                Open video
              </a>
            </div>
          </div>
          <div className="preview-status">
            <strong>{videoType.label}</strong>
            <span>{videoType.help}</span>
          </div>
        </div>
      );
    }

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
      prefersThumbnail: false,
    };
  }

  if (url.hostname.includes("tiktok.com")) {
    return {
      help: "TikTok links open best from a thumbnail preview. Upload a thumbnail if TikTok does not provide one.",
      label: "TikTok preview",
      prefersThumbnail: true,
    };
  }

  if (url.hostname.includes("youtube.com") || url.hostname.includes("youtu.be")) {
    return {
      help: "YouTube and Shorts links show an automatic thumbnail. Uploaded thumbnails override it.",
      label: "YouTube preview",
      prefersThumbnail: true,
    };
  }

  if (/\.(mp4|mov|m4v|webm)(\?.*)?$/i.test(url.pathname + url.search)) {
    return {
      help: "Direct video files preview in the browser player.",
      label: "Direct video preview",
      prefersThumbnail: false,
    };
  }

  return {
    help: "This link will be displayed with an Open video button.",
    label: "External link preview",
    prefersThumbnail: true,
  };
}

function getVideoThumbnailUrl(value: string) {
  const url = safeUrl(value);

  if (!url) {
    return "";
  }

  const youtubeId = getYouTubeId(url);

  return youtubeId ? `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg` : "";
}

function getYouTubeId(url: URL) {
  if (url.hostname.includes("youtu.be")) {
    return url.pathname.split("/").filter(Boolean)[0] ?? "";
  }

  if (!url.hostname.includes("youtube.com")) {
    return "";
  }

  if (url.pathname.startsWith("/shorts/")) {
    return url.pathname.split("/").filter(Boolean)[1] ?? "";
  }

  if (url.pathname.startsWith("/embed/")) {
    return url.pathname.split("/").filter(Boolean)[1] ?? "";
  }

  return url.searchParams.get("v") ?? "";
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
