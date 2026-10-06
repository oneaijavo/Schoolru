// Crea una sesión de pago de Stripe Checkout.
//  - method "card"  → suscripción con renovación automática (tarjeta, Apple Pay, Google Pay, Link…)
//  - method "china" → pago único con WeChat Pay o Alipay que activa Premium 1 mes o 12 meses
//    (Stripe no permite cobros recurrentes con WeChat Pay/Alipay en Checkout).
import { cors, json, stripe, getUser, getOrCreateCustomer } from "../_shared/util.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const user = await getUser(req);
  if (!user) return json({ error: "No has iniciado sesión" }, 401);

  const { plan = "monthly", method = "card" } = await req.json().catch(() => ({}));
  const yearly = plan === "yearly";
  const site = Deno.env.get("SITE_URL")!;
  const customer = await getOrCreateCustomer(user.id, user.email ?? undefined);

  if (method === "china") {
    const price = Deno.env.get(yearly ? "STRIPE_PASS_YEARLY" : "STRIPE_PASS_MONTHLY");
    if (!price) return json({ error: "Precio de pago único no configurado" }, 500);
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer,
      client_reference_id: user.id,
      line_items: [{ price, quantity: 1 }],
      payment_method_types: ["wechat_pay", "alipay"],
      payment_method_options: { wechat_pay: { client: "web" } },
      metadata: { user_id: user.id, pass: yearly ? "yearly" : "monthly" },
      success_url: `${site}/?checkout=success#account`,
      cancel_url: `${site}/#premium`,
    });
    return json({ url: session.url });
  }

  const price = Deno.env.get(yearly ? "STRIPE_PRICE_YEARLY" : "STRIPE_PRICE_MONTHLY");
  if (!price) return json({ error: "Precio no configurado" }, 500);
  // Sin payment_method_types: Stripe muestra los métodos activados en el panel
  // (tarjeta, Apple Pay, Google Pay, Link…) que admiten suscripciones.
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer,
    client_reference_id: user.id,
    line_items: [{ price, quantity: 1 }],
    subscription_data: { metadata: { user_id: user.id } },
    allow_promotion_codes: true,
    success_url: `${site}/?checkout=success#account`,
    cancel_url: `${site}/#premium`,
  });
  return json({ url: session.url });
});
