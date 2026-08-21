import DOMPurify from "dompurify";

export function sanitizeMessageHtml(html) {
  return DOMPurify.sanitize(html || "", {
    ALLOWED_TAGS: ["p", "strong", "em", "u", "s", "a", "ul", "ol", "li", "br", "span", "code", "blockquote"],
    ALLOWED_ATTR: ["href", "target", "rel", "data-type", "data-id", "data-label", "class"],
  });
}
