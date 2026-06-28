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

  conclusions: (lang = "en") => {
    const langLine = lang === "es"
      ? "Write ALL output values in Spanish."
      : "Write ALL output values in English.";
    return `You are an expert quality control inspector. Based on the inspection report context provided, write a professional conclusion section. ${langLine}

Return ONLY a valid JSON object — no markdown, no explanation:
{
  "summary": "2-3 sentence overall summary of the inspection findings",
  "positives": "Key positive findings and satisfactory aspects (use \\n for line breaks between points)",
  "risks": "Issues, defects, or risks identified (use \\n for line breaks between points)",
  "recommendations": "Specific actionable recommendations (use \\n for line breaks between points)"
}

Rules:
- Be factual and professional — base conclusions ONLY on the context provided
- If a category has nothing relevant, write a brief neutral statement
- Keep each section concise (3-5 lines max)
- recommendations should be specific and actionable`;
  },

  retouch: (lang = "en") => {
    const langLine = lang === "es"
      ? "Write your output in Spanish."
      : "Write your output in English.";
    return `You are a technical writer for an international trade company. Rephrase the following text in a professional, formal B2B tone. Keep all technical facts exactly as they are — only improve the language, clarity, and flow. ${langLine}

Return plain text only — no markdown symbols (no **, no *, no #, no - bullets). Use blank lines to separate paragraphs. Keep distinct specification items on separate lines.

Return ONLY a valid JSON object on a single line — no literal line breaks in the JSON itself, use \\n for line breaks:
{"content": "paragraph one\\n\\nparagraph two\\nspec item one\\nspec item two"}`;
  },

  diagram: `You are generating a Mermaid.js diagram from a user's description.

Return ONLY a valid JSON object — no markdown, no explanation:
{
  "code": "the complete Mermaid diagram code (raw syntax, no code fences)",
  "title": "short descriptive title for the diagram"
}

Mermaid code rules:
- For Org Charts: use "graph TD" (or LR). Nodes with multiline labels: A["Name\\nTitle"]
- For Process Flows: use "flowchart TD" (or LR). Use shapes: [box] ([rounded]) {diamond} [(cylinder)]
- Always add 2-3 classDef styles for visual polish. Apply them with :::className
- Short descriptive node IDs (A, B, CEO, DIR1, etc.)
- Use double quotes around node labels that contain special characters or spaces
- Maximum 20 nodes — keep it readable
- Do NOT wrap code in backticks or code fences — return raw Mermaid syntax
- If refining existing code, preserve the structure and only apply the requested change

Navy org chart example:
graph TD
  classDef exec fill:#1e3a5f,color:#fff,stroke:#1e3a5f,rx:6
  classDef mgr fill:#2563eb,color:#fff,stroke:#1d4ed8,rx:6
  classDef staff fill:#f1f5f9,color:#1e293b,stroke:#cbd5e1,rx:6
  CEO["Jimena García\\nCEO"]:::exec
  CEO --> DIR1["Clara Castejón\\nDirectora de Cuentas"]:::mgr
  CEO --> DIR2["Valeria Palacio\\nDirectora de Comunicación"]:::mgr
  DIR1 --> E1["Héctor Díaz\\nDiseñador"]:::staff
  DIR2 --> E2["Carlos Gómez\\nVentas"]:::staff

Process flow example:
flowchart LR
  classDef box fill:#dbeafe,stroke:#2563eb,color:#1e3a5f
  classDef action fill:#1e3a5f,color:#fff,stroke:#1e3a5f
  classDef check fill:#fef9c3,stroke:#ca8a04,color:#78350f
  A([Supplier]):::box --> B[Raw Materials]:::action --> C[Fabrication]:::action
  C --> D{Quality\\nCheck}:::check
  D -->|Pass| E[Packaging]:::action --> F([Shipping]):::box
  D -->|Fail| C`,

  table: `You are extracting tabular data from an image (packing list, inspection table, spreadsheet, quality report, or any document with rows and columns).

Return ONLY a valid JSON object — no markdown, no explanation:
{
  "title": "table title or document title visible in the image, or empty string",
  "headers": ["Column Name 1", "Column Name 2", "Column Name 3"],
  "rows": [
    ["value1", "value2", "value3"],
    ["value1", "value2", "value3"]
  ]
}

Rules:
- Include ALL visible columns
- Include ALL data rows — skip header rows only
- Preserve original column names exactly as written
- Empty cells must be empty strings ""
- All values must be strings, not numbers
- If no clear table exists, create one from the most structured content visible`,

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

function parseAIJson(str) {
  try {
    return JSON.parse(str);
  } catch {
    // GPT sometimes returns literal newlines/tabs inside JSON strings — escape them
    const fixed = str.replace(/"((?:[^"\\]|\\.)*)"/g, (match) =>
      match.replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\t/g, "\\t")
    );
    return JSON.parse(fixed);
  }
}

const parseBody = (req) =>
  new Promise((resolve, reject) => {
    if (req.body && typeof req.body === "object") {
      resolve(req.body);
      return;
    }
    let raw = "";
    req.on("data", (chunk) => { raw += chunk; });
    req.on("end", () => {
      try { resolve(JSON.parse(raw)); } catch (e) { reject(e); }
    });
    req.on("error", reject);
  });

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");

  if (req.method !== "POST") {
    res.statusCode = 405;
    res.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }

  let body;
  try {
    body = await parseBody(req);
  } catch {
    res.statusCode = 400;
    res.end(JSON.stringify({ error: "Invalid JSON body" }));
    return;
  }

  const { image, mimeType, type, text, language } = body;

  if (!PROMPTS[type]) {
    res.statusCode = 400;
    res.end(JSON.stringify({ error: `Unknown type: ${type}` }));
    return;
  }
  const TEXT_ONLY = ["retouch", "conclusions", "diagram"];
  if (TEXT_ONLY.includes(type) && !text) {
    res.statusCode = 400;
    res.end(JSON.stringify({ error: "Missing required field: text" }));
    return;
  }
  if (!TEXT_ONLY.includes(type) && (!image || !mimeType)) {
    res.statusCode = 400;
    res.end(JSON.stringify({ error: "Missing required fields: image, mimeType" }));
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: "OpenAI API key not configured on server" }));
    return;
  }

  const retouchPrompt = typeof PROMPTS.retouch === "function" ? PROMPTS.retouch(language) : PROMPTS.retouch;
  let messages;
  if (type === "retouch") {
    messages = [{ role: "user", content: `${retouchPrompt}\n\nText to rephrase:\n${text}` }];
  } else if (type === "conclusions") {
    const conclusionsPrompt = typeof PROMPTS.conclusions === "function" ? PROMPTS.conclusions(language) : PROMPTS.conclusions;
    messages = [{ role: "user", content: `${conclusionsPrompt}\n\nInspection context:\n${text}` }];
  } else if (type === "diagram") {
    messages = [{ role: "user", content: `${PROMPTS.diagram}\n\n${text}` }];
  } else {
    messages = [{ role: "user", content: [
      { type: "image_url", image_url: { url: `data:${mimeType};base64,${image}`, detail: "high" } },
      { type: "text", text: PROMPTS[type] },
    ]}];
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: type === "quotation" ? 2000 : type === "extract" || type === "retouch" ? 2000 : type === "table" ? 3000 : type === "conclusions" ? 1500 : type === "diagram" ? 1200 : 800,
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
    const text = data.choices[0].message.content;
    const jsonStr = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    const result = parseAIJson(jsonStr);

    res.statusCode = 200;
    res.end(JSON.stringify(result));
  } catch (e) {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: e.message }));
  }
}
