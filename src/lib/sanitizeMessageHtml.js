import DOMPurify from "dompurify";

export function sanitizeMessageHtml(html) {
  return DOMPurify.sanitize(html || "", {
    ALLOWED_TAGS: ["p", "strong", "em", "u", "s", "a", "ul", "ol", "li", "br", "span", "code", "blockquote"],
    ALLOWED_ATTR: ["href", "target", "rel", "data-type", "data-id", "data-label", "class"],
  });
}

// Messages sent before the Tiptap rewrite stored the body as plain text
// with hand-rolled Markdown ([@Name](mention:id), **bold**, *italic*)
// instead of HTML — convert that old format so those messages still
// render (and remain editable) correctly instead of showing raw syntax.
export function legacyBodyToHtml(text) {
  if (!text) return "";
  if (/^\s*</.test(text)) return text; // already HTML (current Tiptap output)
  const html = text
    .replace(/\[@([^\]]+)\]\(mention:([a-f0-9-]+)\)/g, '<span data-type="mention" data-id="$2" data-label="$1">@$1</span>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, "<em>$1</em>")
    .replace(/\r\n/g, "\n");
  return html
    .split(/\n{2,}/)
    .map(p => `<p>${p.replace(/\n/g, "<br>")}</p>`)
    .join("");
}
