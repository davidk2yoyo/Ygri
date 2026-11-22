import { supabase } from "../../supabaseClient";

// Uploads evidence (photo or video) for a warranty claim to the portal's insert-only drop box and
// returns { url, kind }. Photos are shrunk first (phones produce 5 MB+ pictures); videos go up as is.
const MAX_SIDE = 1600;

async function shrink(blob) {
  try {
    const bmp = await createImageBitmap(blob);
    const k = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(bmp.width * k)); c.height = Math.max(1, Math.round(bmp.height * k));
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(bmp, 0, 0, c.width, c.height);
    return await new Promise(res => c.toBlob(b => res(b || blob), "image/jpeg", 0.85));
  } catch { return blob; }
}

export async function uploadPortalMedia(file) {
  const isVideo = (file.type || "").startsWith("video/");
  const body = isVideo ? file : await shrink(file);
  const ext = isVideo ? ((file.name?.split(".").pop() || "mp4").toLowerCase()) : "jpg";
  const path = `${crypto.randomUUID()}/evidencia.${ext}`;
  const { error } = await supabase.storage.from("client-portal-uploads").upload(path, body, { contentType: isVideo ? file.type : "image/jpeg" });
  if (error) throw error;
  return { url: supabase.storage.from("client-portal-uploads").getPublicUrl(path).data.publicUrl, kind: isVideo ? "video" : "image" };
}
