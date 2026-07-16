import { getStripe } from "./_lib/stripe.js";
import { kvGet, kvSet } from "./_lib/supabaseAdmin.js";

// Currencies Stripe treats as zero-decimal (amount is NOT multiplied by 100).
const ZERO_DECIMAL = new Set(["clp", "jpy", "krw", "vnd"]);
const FX_RATES = { CLP: 950, USD: 1, EUR: 0.92 }; // must mirror src/App.jsx CURRENCIES

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { cart, currency, customer, shipping, notes } = req.body || {};

    if (!Array.isArray(cart) || cart.length === 0) {
      return res.status(400).json({ error: "El carrito está vacío." });
    }
    if (!customer?.email || !customer?.fullName) {
      return res.status(400).json({ error: "Faltan datos del cliente." });
    }

    const currencyCode = (currency || "CLP").toUpperCase();
    const rate = FX_RATES[currencyCode] ?? 1;

    // Load the real catalog from Supabase — never trust price/availability
    // sent from the browser.
    const rawProducts = await kvGet("ldm-products");
    const products = rawProducts ? JSON.parse(rawProducts) : [];

    const lineItems = [];
    const verifiedItems = [];

    for (const cartItem of cart) {
      const product = products.find((p) => p.id === cartItem.id);
      if (!product || product.visible === false) {
        return res.status(400).json({ error: `Producto no disponible: ${cartItem.name || cartItem.id}` });
      }
      const variant = (product.variants || []).find((v) => v.size === cartItem.size && v.color === cartItem.color);
      const qty = Math.max(1, Number(cartItem.qty) || 1);
      if (!variant || Number(variant.stock) < qty) {
        return res.status(400).json({ error: `Sin stock suficiente: ${product.name}` });
      }

      const unitUsd = Number(product.price) || 0;
      const unitConverted = unitUsd * rate;
      const isZeroDecimal = ZERO_DECIMAL.has(currencyCode.toLowerCase());
      const unitAmount = Math.round(isZeroDecimal ? unitConverted : unitConverted * 100);

      lineItems.push({
        price_data: {
          currency: currencyCode.toLowerCase(),
          product_data: { name: `${product.name} — ${cartItem.color} / ${cartItem.size}` },
          unit_amount: unitAmount,
        },
        quantity: qty,
      });

      verifiedItems.push({ id: product.id, name: product.name, size: cartItem.size, color: cartItem.color, qty, price: unitUsd });
    }

    const stripe = getStripe();
    const origin = req.headers.origin || `https://${req.headers.host}`;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: lineItems,
      customer_email: customer.email,
      success_url: `${origin}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?checkout=cancelled`,
    });

    // Stash the full order so the webhook can build the final order record
    // once payment is confirmed (Stripe metadata is too small/limited for this).
    const pendingOrder = {
      id: `ord-${Date.now()}`,
      date: new Date().toISOString(),
      currency: currencyCode,
      subtotal: verifiedItems.reduce((s, i) => s + i.price * i.qty * rate, 0),
      status: "Pedido recibido",
      pinned: false,
      color: null,
      customer,
      shipping,
      notes: notes || "",
      payment: { method: "card", provider: "stripe" },
      items: verifiedItems,
    };
    await kvSet(`pending-order-${session.id}`, JSON.stringify(pendingOrder));

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error("create-checkout-session error", err);
    return res.status(500).json({ error: "No se pudo iniciar el pago." });
  }
}
