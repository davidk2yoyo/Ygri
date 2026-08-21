import StarterKit from "@tiptap/starter-kit";
import { Underline } from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Mention from "@tiptap/extension-mention";
import Placeholder from "@tiptap/extension-placeholder";

// Vanilla-DOM suggestion popup (no extra portal/tooltip library) shown while
// typing "@" — reads the current profiles list via a ref so the callback
// never goes stale even though the editor's extensions are built once.
function createMentionSuggestion(profilesRef) {
  return {
    items: ({ query }) =>
      (profilesRef.current || [])
        .filter(p => p.full_name?.toLowerCase().includes(query.toLowerCase()))
        .slice(0, 8),
    command: ({ editor, range, props }) => {
      editor.chain().focus().insertContentAt(range, [
        { type: "mention", attrs: { id: props.id, label: props.full_name } },
        { type: "text", text: " " },
      ]).run();
    },
    render: () => {
      let popup = null;
      let selectedIndex = 0;
      let currentItems = [];
      let currentCommand = null;

      const renderItems = () => {
        if (!popup) return;
        popup.innerHTML = "";
        if (currentItems.length === 0) {
          popup.style.display = "none";
          return;
        }
        popup.style.display = "block";
        currentItems.forEach((item, i) => {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.textContent = item.full_name;
          btn.className = `block w-full text-left px-3 py-2 text-sm transition ${
            i === selectedIndex ? "bg-bgray-100 dark:bg-darkblack-400" : ""
          } text-darkblack-700 dark:text-white`;
          btn.addEventListener("mousedown", (e) => { e.preventDefault(); currentCommand(item); });
          popup.appendChild(btn);
        });
      };

      const positionPopup = (clientRect) => {
        const rect = clientRect?.();
        if (!rect || !popup) return;
        popup.style.left = `${rect.left + window.scrollX}px`;
        popup.style.top = `${rect.bottom + window.scrollY + 4}px`;
      };

      return {
        onStart: (props) => {
          currentItems = props.items;
          currentCommand = props.command;
          selectedIndex = 0;
          popup = document.createElement("div");
          popup.className = "fixed z-[300] w-64 bg-white dark:bg-darkblack-500 border border-bgray-200 dark:border-darkblack-400 rounded-xl shadow-lg max-h-48 overflow-y-auto";
          document.body.appendChild(popup);
          renderItems();
          positionPopup(props.clientRect);
        },
        onUpdate: (props) => {
          currentItems = props.items;
          currentCommand = props.command;
          selectedIndex = 0;
          renderItems();
          positionPopup(props.clientRect);
        },
        onKeyDown: (props) => {
          if (!currentItems.length) return false;
          if (props.event.key === "ArrowDown") { selectedIndex = (selectedIndex + 1) % currentItems.length; renderItems(); return true; }
          if (props.event.key === "ArrowUp") { selectedIndex = (selectedIndex - 1 + currentItems.length) % currentItems.length; renderItems(); return true; }
          if (props.event.key === "Enter") { currentCommand(currentItems[selectedIndex]); return true; }
          if (props.event.key === "Escape") { popup?.remove(); popup = null; return true; }
          return false;
        },
        onExit: () => { popup?.remove(); popup = null; },
      };
    },
  };
}

export function buildMessageExtensions(profilesRef, placeholderText) {
  return [
    StarterKit.configure({ heading: false }),
    Underline,
    Link.configure({ openOnClick: false }),
    Mention.configure({
      HTMLAttributes: { class: "mention-chip" },
      suggestion: createMentionSuggestion(profilesRef),
    }),
    Placeholder.configure({
      placeholder: placeholderText || "Write a message...",
    }),
  ];
}
