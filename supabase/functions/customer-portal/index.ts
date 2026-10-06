// Abre el portal de cliente de Stripe (cambiar tarjeta, cancelar, facturas).
import { cors, json, stripe, getUser, getOrCreateCustomer } from "../_shared/util.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const user = await getUser(req);
  if (!user) return json({ error: "No has iniciado sesión" }, 401);
  const customer = await getOrCreateCustomer(user.id, user.email ?? undefined);
  const portal = await stripe.billingPortal.sessions.create({
    customer,
    return_url: `${Deno.env.get("SITE_URL")}/#account`,
  });
  return json({ url: portal.url });
});
