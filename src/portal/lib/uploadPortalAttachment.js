import { supabase } from "../../supabaseClient";
import { uploadPortalMedia } from "./uploadPortalMedia";

// Any attachment for a conversation: photos/videos go through the media uploader (photos are shrunk),
// everything else (PDF, Excel, AI/PSD…) is uploaded as is. Returns { url, name, kind }.
export async function uploadPortalAttachment(file) {
  if ((file.type || "").startsWith("image/") || (file.type || "").startsWith("video/")) {
    const m = await uploadPortalMedia(file);
    return { ...m, name: file.name };
  }
  const safe = (file.name || "archivo").replace(/[^A-Za-z0-9._-]+/g, "_").slice(-80) || "archivo";
  const path = `${crypto.randomUUID()}/${safe}`;
  const { error } = await supabase.storage.from("client-portal-uploads").upload(path, file);
  if (error) throw error;
  return { url: supabase.storage.from("client-portal-uploads").getPublicUrl(path).data.publicUrl, name: file.name, kind: "file" };
}
