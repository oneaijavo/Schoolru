// Borra la cuenta del usuario: cancela su suscripción en Stripe, borra sus datos y su usuario.
import { cors, json, stripe, admin, getUser } from "../_shared/util.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const user = await getUser(req);
  if (!user) return json({ error: "No has iniciado sesión" }, 401);

  // 1. Cancelar la suscripción con renovación automática, si la hay.
  const { data: sub } = await admin.from("subscriptions").select("stripe_subscription_id,status").eq("user_id", user.id).maybeSingle();
  if (sub?.stripe_subscription_id && !["canceled", "incomplete_expired"].includes(sub.status)) {
    try { await stripe.subscriptions.cancel(sub.stripe_subscription_id); } catch (e) { console.error("cancel", e); }
  }
  // 2. Borrar datos propios. El cliente de Stripe y sus facturas se conservan en Stripe
  //    por obligaciones fiscales; aquí solo se elimina el vínculo.
  await admin.from("progress").delete().eq("user_id", user.id);
  await admin.from("subscriptions").delete().eq("user_id", user.id);
  await admin.from("customers").delete().eq("user_id", user.id);
  // 3. Borrar el usuario de Supabase Auth.
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return json({ error: error.message }, 500);
  return json({ deleted: true });
});
