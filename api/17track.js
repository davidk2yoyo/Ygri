const API_KEY = process.env.TRACK17_API_KEY;
const BASE = "https://api.17track.net/track/v2.4";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { action, numbers } = req.body;

  if (!action || !numbers?.length) {
    return res.status(400).json({ error: "Missing action or numbers" });
  }

  if (!API_KEY) {
    return res.status(500).json({ error: "17Track API key not configured" });
  }

  const endpoint = action === "register"
    ? `${BASE}/register`
    : `${BASE}/gettrackinfo`;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "17token": API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(numbers.map(n => typeof n === "object" ? n : { number: n })),
    });

    const data = await response.json();
    return res.status(200).json(data);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
