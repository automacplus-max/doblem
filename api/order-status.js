import { getStripe } from "./_lib/stripe.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { session_id } = req.query;
  if (!session_id) return res.status(400).json({ error: "Falta session_id." });

  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(session_id);
    return res.status(200).json({ paid: session.payment_status === "paid" });
  } catch (err) {
    console.error("order-status error", err);
    return res.status(500).json({ error: "No se pudo verificar el pago." });
  }
}
