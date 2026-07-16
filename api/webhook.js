import { getStripe } from "./_lib/stripe.js";
import { kvGet, kvSet, kvDelete } from "./_lib/supabaseAdmin.js";

// Stripe needs the RAW request body to verify the webhook signature, so we
// disable Vercel's default JSON body parsing for this route.
export const config = { api: { bodyParser: false } };

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const stripe = getStripe();
  const signature = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    const rawBody = await readRawBody(req);
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const pendingKey = `pending-order-${session.id}`;
      const raw = await kvGet(pendingKey);

      if (raw) {
        const order = JSON.parse(raw);
        order.paymentIntent = session.payment_intent;
        order.paidAt = new Date().toISOString();

        // Append to the orders list the admin panel (Pedidos tab) reads.
        const rawOrders = await kvGet("ldm-orders");
        const orders = rawOrders ? JSON.parse(rawOrders) : [];
        orders.push({ ...order, number: orders.length + 1, completed: false });
        await kvSet("ldm-orders", JSON.stringify(orders));

        // Decrement stock for each purchased variant.
        const rawProducts = await kvGet("ldm-products");
        if (rawProducts) {
          const products = JSON.parse(rawProducts);
          for (const item of order.items) {
            const product = products.find((p) => p.id === item.id);
            if (!product) continue;
            const variant = (product.variants || []).find((v) => v.size === item.size && v.color === item.color);
            if (variant) variant.stock = Math.max(0, Number(variant.stock) - item.qty);
          }
          await kvSet("ldm-products", JSON.stringify(products));
        }

        await kvDelete(pendingKey);
      }
    }
    return res.status(200).json({ received: true });
  } catch (err) {
    console.error("Webhook handling error:", err);
    return res.status(500).json({ error: "Webhook handler failed" });
  }
}
