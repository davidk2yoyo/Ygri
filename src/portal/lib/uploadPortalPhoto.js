import { supabase } from "../../supabaseClient";

// Uploads a product photo blob to the portal's insert-only drop box (path is
// unguessable) and returns its public URL. Shared by every place in the portal
// that lets a client attach a photo to an order line.
export async function uploadPortalPhoto(blob) {
  const path = `${crypto.randomUUID()}/foto.jpg`;
  const { error } = await supabase.storage.from("client-portal-uploads").upload(path, blob, { contentType: "image/jpeg" });
  if (error) throw error;
  return supabase.storage.from("client-portal-uploads").getPublicUrl(path).data.publicUrl;
}
