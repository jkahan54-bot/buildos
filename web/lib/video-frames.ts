// Samples evenly-spaced frames from a video file using <video>+<canvas>,
// so video walkthroughs can be summarized via the existing image-based AI pipeline.
export async function extractVideoFrames(file: File, count = 8): Promise<File[]> {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = url;

  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadeddata = () => resolve();
      video.onerror = () => reject(new Error("Could not read video file"));
    });

    let duration = video.duration;
    if (!isFinite(duration)) {
      // Some MP4s report Infinity until you seek near the end (Chrome quirk)
      await new Promise<void>((resolve) => {
        video.ontimeupdate = () => { video.ontimeupdate = null; resolve(); };
        video.currentTime = 1e101;
      });
      duration = video.duration;
    }
    if (!isFinite(duration) || duration <= 0) duration = 1;

    const maxDim = 1024;
    const scale = Math.min(1, maxDim / Math.max(video.videoWidth, video.videoHeight, 1));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    const ctx = canvas.getContext("2d")!;

    const frames: File[] = [];
    for (let i = 0; i < count; i++) {
      const t = (duration * (i + 0.5)) / count;
      await new Promise<void>((resolve) => {
        const onSeeked = () => { video.removeEventListener("seeked", onSeeked); resolve(); };
        video.addEventListener("seeked", onSeeked);
        video.currentTime = Math.min(t, Math.max(duration - 0.05, 0));
      });
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob>(resolve => canvas.toBlob(b => resolve(b!), "image/jpeg", 0.8));
      frames.push(new File([blob], `frame-${i}.jpg`, { type: "image/jpeg" }));
    }
    return frames;
  } finally {
    URL.revokeObjectURL(url);
  }
}
