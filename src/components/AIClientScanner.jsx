import React, { useCallback, useEffect, useRef, useState } from "react";

const PROMPT = `You are extracting contact information from a business card, email signature, website screenshot, or any document containing company/client details.

Return ONLY a valid JSON object — no markdown, no explanation:
{
  "company_name": "company or organization name, or null",
  "contact_person": "full name of the contact person, or null",
  "email": "email address, or null",
  "phone": "phone number including country code if present, or null",
  "website": "website URL, or null",
  "address": "full address on one line, or null",
  "country": "country name in English, or null"
}

Rules:
- Extract what is visible — leave fields null if not present
- For country: infer from address if not explicitly stated
- website should include https:// if present, otherwise just the domain
- phone: prefer mobile/direct line over main office if multiple are shown`;

const toBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

export default function AIClientScanner({ onFill, onClose }) {
  const [step, setStep] = useState("pick"); // pick | loading | review | error
  const [dragOver, setDragOver] = useState(false);
  const [extracted, setExtracted] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [imagePreview, setImagePreview] = useState("");
  const fileRef = useRef(null);

  const processFile = useCallback(async (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    setImagePreview(URL.createObjectURL(file));
    setStep("loading");
    try {
      const base64 = await toBase64(file);
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          max_tokens: 500,
          messages: [{
            role: "user",
            content: [
              { type: "image_url", image_url: { url: `data:${file.type};base64,${base64}`, detail: "high" } },
              { type: "text", text: PROMPT },
            ],
          }],
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || `API error ${res.status}`);
      }
      const data = await res.json();
      const text = data.choices[0].message.content;
      const jsonStr = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      const result = JSON.parse(jsonStr);
      setExtracted({
        company_name: result.company_name || "",
        contact_person: result.contact_person || "",
        email: result.email || "",
        phone: result.phone || "",
        website: result.website || "",
        address: result.address || "",
        country: result.country || "",
      });
      setStep("review");
    } catch (e) {
      setErrorMsg(e.message);
      setStep("error");
    }
  }, []);

  // Ctrl+V paste listener
  useEffect(() => {
    if (step !== "pick") return;
    const handlePaste = (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          processFile(item.getAsFile());
          break;
        }
      }
    };
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [step, processFile]);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const updateField = (field, val) =>
    setExtracted(prev => ({ ...prev, [field]: val }));

  const fields = [
    { key: "company_name", label: "Company Name", type: "text" },
    { key: "contact_person", label: "Contact Person", type: "text" },
    { key: "email", label: "Email", type: "text" },
    { key: "phone", label: "Phone", type: "text" },
    { key: "website", label: "Website", type: "text" },
    { key: "address", label: "Address", type: "text" },
    { key: "country", label: "Country", type: "text" },
  ];

  return (
    <div className="fixed inset-0 z-[10001] bg-black/80 flex items-center justify-center p-4">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) processFile(f); }}
      />

      <div className="bg-white dark:bg-darkblack-600 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100 dark:border-darkblack-400 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-lg">🤖</span>
            <span className="font-bold text-darkblack-700 dark:text-white">Scan Client Info</span>
            {step === "review" && (
              <span className="text-xs text-bgray-500 dark:text-bgray-400">— Review & edit before filling</span>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">

          {/* Pick */}
          {step === "pick" && (
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className={`relative flex flex-col items-center justify-center gap-5 py-12 px-6 border-2 border-dashed rounded-2xl transition-all cursor-default ${
                dragOver
                  ? "border-blue-500 bg-blue-50 scale-[1.01]"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <div className="flex flex-col items-center gap-2 text-center">
                <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center text-2xl border border-gray-100">
                  🪪
                </div>
                <p className="text-base font-semibold text-gray-800">
                  Paste or drop a photo
                </p>
                <p className="text-xs text-gray-400">
                  Business card, email signature, website screenshot, any document with contact info
                </p>
                <kbd className="mt-1 px-2.5 py-1 bg-gray-100 text-gray-600 text-xs font-mono rounded-lg border border-gray-200 shadow-sm">
                  Ctrl + V
                </kbd>
              </div>

              <div className="flex items-center gap-3 w-full max-w-xs">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-xs text-gray-400">or</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>

              <button
                onClick={() => fileRef.current?.click()}
                className="flex items-center gap-2 px-5 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:border-blue-500 hover:text-blue-600 transition"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                Browse file
              </button>

              {dragOver && (
                <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-blue-50/80">
                  <p className="text-blue-600 font-semibold text-sm">Drop to scan</p>
                </div>
              )}
            </div>
          )}

          {/* Loading */}
          {step === "loading" && (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              {imagePreview && (
                <img src={imagePreview} alt="Scanning" className="w-28 h-28 object-cover rounded-xl border border-gray-200 opacity-60" />
              )}
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-gray-600 font-medium">Reading contact info…</p>
              <p className="text-xs text-gray-400">Usually takes 3–5 seconds</p>
            </div>
          )}

          {/* Error */}
          {step === "error" && (
            <div className="py-12 text-center">
              <p className="text-2xl mb-3">❌</p>
              <p className="text-sm font-semibold text-gray-800 mb-1">Could not read the image</p>
              <p className="text-xs text-gray-500 mb-5 max-w-sm mx-auto">{errorMsg}</p>
              <button
                onClick={() => setStep("pick")}
                className="px-4 py-2 bg-gray-100 rounded-lg text-sm text-gray-700 hover:bg-gray-200 transition"
              >
                Try again
              </button>
            </div>
          )}

          {/* Review */}
          {step === "review" && extracted && (
            <>
              {imagePreview && (
                <div className="flex items-start gap-3">
                  <img src={imagePreview} alt="Scanned" className="w-20 h-16 object-cover rounded-xl border border-gray-200 shrink-0" />
                  <div className="flex-1 bg-green-50 border border-green-100 rounded-xl px-3 py-2">
                    <p className="text-[10px] font-semibold text-green-600 uppercase tracking-wide mb-0.5">Info extracted — edit if needed</p>
                    <p className="text-xs text-gray-500">Check each field before filling the form. You can correct anything the AI got wrong.</p>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                {fields.map(({ key, label }) => (
                  <div key={key}>
                    <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
                    <input
                      type="text"
                      value={extracted[key]}
                      onChange={e => updateField(key, e.target.value)}
                      placeholder={`No ${label.toLowerCase()} detected`}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-300"
                    />
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {step === "review" && extracted && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 shrink-0">
            <button
              onClick={() => setStep("pick")}
              className="text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2 transition"
            >
              Scan different photo
            </button>
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition"
              >
                Cancel
              </button>
              <button
                onClick={() => { onFill(extracted); onClose(); }}
                className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition flex items-center gap-1.5"
              >
                Fill form
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
