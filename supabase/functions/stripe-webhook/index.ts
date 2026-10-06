// Recibe los avisos de Stripe y guarda el estado de la suscripción en la base de datos.
// Desplegar con: supabase functions deploy stripe-webhook --no-verify-jwt
import Stripe from "npm:stripe@17";
import { stripe, admin } from "../_shared/util.ts";

const crypto = Stripe.createSubtleCryptoProvider();

async function saveSubscription(sub: Stripe.Subscription) {
  let userId = sub.metadata?.user_id;
  if (!userId) {
    const { data } = await admin.from("customers").select("user_id").eq("stripe_customer_id", sub.customer as string).maybeSingle();
    userId = data?.user_id;
  }
  if (!userId) { console.error("Suscripción sin usuario", sub.id); return; }
  // En versiones recientes de la API, current_period_end está en los items.
  // deno-lint-ignore no-explicit-any
  const s = sub as any;
  const end = s.current_period_end ?? s.items?.data?.[0]?.current_period_end;
  await admin.from("subscriptions").upsert({
    user_id: userId,
    stripe_subscription_id: sub.id,
    status: sub.status,
    price_id: sub.items.data[0]?.price.id ?? null,
    current_period_end: end ? new Date(end * 1000).toISOString() : null,
    cancel_at_period_end: sub.cancel_at_period_end,
    updated_at: new Date().toISOString(),
  });
}

/** Pago único (WeChat Pay / Alipay): alarga el acceso Premium 1 o 12 meses. */
async function savePass(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.user_id ?? session.client_reference_id;
  if (!userId) return;
  const months = session.metadata?.pass === "yearly" ? 12 : 1;
  const { data } = await admin.from("subscriptions").select("current_period_end,stripe_subscription_id,status").eq("user_id", userId).maybeSingle();
  const now = new Date();
  // Si aún le queda tiempo, el pase se suma al final.
  const from = data?.current_period_end && new Date(data.current_period_end) > now ? new Date(data.current_period_end) : now;
  const end = new Date(from); end.setMonth(end.getMonth() + months);
  await admin.from("subscriptions").upsert({
    user_id: userId,
    stripe_subscription_id: data?.stripe_subscription_id ?? null,
    status: "active",
    price_id: `pass_${session.metadata?.pass}`,
    current_period_end: end.toISOString(),
    cancel_at_period_end: true,   // un pase no se renueva solo
    updated_at: now.toISOString(),
  });
}

Deno.serve(async (req) => {
  const signature = req.headers.get("Stripe-Signature");
  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature!, Deno.env.get("STRIPE_WEBHOOK_SECRET")!, undefined, crypto);
  } catch (e) {
    return new Response(`Firma no válida: ${(e as Error).message}`, { status: 400 });
  }

  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      await saveSubscription(event.data.object as Stripe.Subscription);
      break;
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode === "payment" && session.metadata?.pass) {
        if (session.payment_status === "paid") await savePass(session);
      } else if (session.subscription) {
        const sub = await stripe.subscriptions.retrieve(session.subscription as string);
        await saveSubscription(sub);
      }
      break;
    }
  }
  return new Response(JSON.stringify({ received: true }), { headers: { "Content-Type": "application/json" } });
});
