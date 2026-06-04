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
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { image, mimeType, type } = req.body;

  if (!image || !mimeType || !PROMPTS[type]) {
    return res.status(400).json({ error: "Missing required fields: image, mimeType, type" });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "OpenAI API key not configured on server" });
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
        max_tokens: type === "quotation" ? 1500 : 500,
        messages: [{
          role: "user",
          content: [
            { type: "image_url", image_url: { url: `data:${mimeType};base64,${image}`, detail: "high" } },
            { type: "text", text: PROMPTS[type] },
          ],
        }],
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return res.status(response.status).json({ error: err.error?.message || `OpenAI error ${response.status}` });
    }

    const data = await response.json();
    const text = data.choices[0].message.content;
    const jsonStr = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    const result = JSON.parse(jsonStr);

    return res.status(200).json(result);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
