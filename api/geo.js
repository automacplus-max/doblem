// Vercel's edge network automatically populates this header from the
// visitor's IP — no client-side geolocation prompt, no third-party API key.
export default function handler(req, res) {
  const country = req.headers["x-vercel-ip-country"] || "XX";
  res.status(200).json({ country });
}
