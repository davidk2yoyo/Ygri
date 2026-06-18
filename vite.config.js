import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

const PROMPTS = {
  quotation: `You are extracting structured data from a supplier quotation document image.

Return ONLY a valid JSON object — no markdown, no explanation:
{
  "supplier": {
    "name": "exact company name",
    "contact_person": "person name or null",
    "phone": "phone number or null",
    "email": "email address or null",
    "address": "full address condensed to one line or null"
  },
  "currency": "ISO currency code — use CNY for RMB/yuan/人民币, USD for $, EUR for €",
  "items": [
    {
      "item_number": "product code / SKU / model number or null",
      "description": "complete product description — merge multi-line text into one string, include all specs, variants, notes",
      "quantity": 1,
      "unit_price": 0.00
    }
  ],
  "total": 0.00
}

Rules:
- Only include real product/service line items — skip header rows, empty rows, and totals rows
- quantity and unit_price must be numbers (not strings)
- If a cell spans multiple lines, merge into a single description string`,

  client: `You are extracting contact information from a business card, email signature, website screenshot, or any document containing company/client details.

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
- phone: prefer mobile/direct line over main office if multiple are shown`,

  specs: `You are extracting technical specifications from a product datasheet, catalog page, or technical document image.

Return ONLY a valid JSON object — no markdown, no explanation:
{
  "product_name": "full product name or model number",
  "rows": [
    { "label": "specification name", "value": "specification value with units" }
  ]
}

Rules:
- Extract ALL visible technical parameters: dimensions, weight, voltage, current, pressure, temperature range, accuracy, material, protection rating, certifications, etc.
- Keep labels concise (2-4 words max)
- Include units in the value field (mm, kg, V, A, bar, °C, etc.)
- Skip marketing text, descriptions, and non-technical content
- Aim for 8-20 rows`,

  description: `You are a technical writer for an international trade company. Write a professional technical product description in English based on the image provided (product photo, datasheet, or catalog page).

Return ONLY a valid JSON object — no markdown, no explanation:
{
  "title": "Product name / model",
  "description": "3-5 sentence professional technical description. Include: what the product is, key technical highlights, main application/industry, and a notable feature or advantage. Formal B2B tone."
}`,

  retouch: `You are a technical writer for an international trade company. Rephrase the following product description in a professional, formal B2B tone. Keep all technical facts exactly as they are — only improve the language, clarity, and flow.

Return plain text only — no markdown symbols (no **, no *, no #, no - bullets). Use blank lines to separate paragraphs. Keep distinct specification items on separate lines.

Return ONLY a valid JSON object on a single line — no literal line breaks in the JSON itself, use \\n for line breaks:
{"content": "paragraph one\\n\\nparagraph two\\nspec item one\\nspec item two"}`,

  extract: `You are a document transcription assistant. Copy ALL text from this document image exactly as it appears — preserving every specification, measurement, value, and detail verbatim. Do not summarize, rephrase, or omit anything.

Return ONLY a valid JSON object — no markdown, no explanation:
{
  "title": "product name or document title shown in the image",
  "content": "the full text exactly as written in the document, preserving line breaks with \\n"
}

Rules:
- Copy text character-for-character including units, symbols, punctuation
- Preserve the original line structure using \\n
- If text is in another language, copy it as-is (do not translate)
- Include every line — do not skip any content`,
};

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [
      react(),
      // Dev-only middleware that mirrors the /api/ai-scan Vercel function
      {
        name: "api-dev-middleware",
        configureServer(server) {
          server.middlewares.use("/api/ai-scan", (req, res) => {
            if (req.method !== "POST") {
              res.statusCode = 405;
              res.end(JSON.stringify({ error: "Method not allowed" }));
              return;
            }
            let body = "";
            req.on("data", (chunk) => { body += chunk; });
            req.on("end", async () => {
              try {
                const { image, mimeType, type, text } = JSON.parse(body);
                const apiKey = env.OPENAI_API_KEY;
                if (!apiKey) throw new Error("OPENAI_API_KEY not set in .env");
                if (!PROMPTS[type]) throw new Error(`Unknown type: ${type}`);

                const messages = type === "retouch"
                  ? [{ role: "user", content: `${PROMPTS.retouch}\n\nText to rephrase:\n${text}` }]
                  : [{ role: "user", content: [
                      { type: "image_url", image_url: { url: `data:${mimeType};base64,${image}`, detail: "high" } },
                      { type: "text", text: PROMPTS[type] },
                    ]}];

                const response = await fetch("https://api.openai.com/v1/chat/completions", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${apiKey}`,
                  },
                  body: JSON.stringify({
                    model: "gpt-4o-mini",
                    max_tokens: type === "quotation" ? 2000 : type === "extract" || type === "retouch" ? 2000 : 800,
                    messages,
                  }),
                });

                if (!response.ok) {
                  const err = await response.json().catch(() => ({}));
                  res.statusCode = response.status;
                  res.end(JSON.stringify({ error: err.error?.message || `OpenAI error ${response.status}` }));
                  return;
                }

                const data = await response.json();
                const rawContent = data.choices[0].message.content;
                const jsonStr = rawContent.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
                let result;
                try {
                  result = JSON.parse(jsonStr);
                } catch {
                  const fixed = jsonStr.replace(/"((?:[^"\\]|\\.)*)"/g, (match) =>
                    match.replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\t/g, "\\t")
                  );
                  result = JSON.parse(fixed);
                }
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify(result));
              } catch (e) {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: e.message }));
              }
            });
          });
        },
      },
    ],
  };
});
