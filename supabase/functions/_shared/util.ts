import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@17";

export const cors = {
  "Access-Control-Allow-Origin": "*",   // la autenticación va en la cabecera Authorization, no en cookies
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

export const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  httpClient: Stripe.createFetchHttpClient(),
});

export const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

/** Devuelve el usuario que hace la petición (por su token) o null. */
export async function getUser(req: Request) {
  const auth = req.headers.get("Authorization");
  if (!auth) return null;
  const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: auth } },
  });
  const { data } = await client.auth.getUser();
  return data.user ?? null;
}

/** Busca o crea el cliente de Stripe de este usuario. */
export async function getOrCreateCustomer(userId: string, email?: string) {
  const { data } = await admin.from("customers").select("stripe_customer_id").eq("user_id", userId).maybeSingle();
  if (data?.stripe_customer_id) return data.stripe_customer_id as string;
  const customer = await stripe.customers.create({ email, metadata: { user_id: userId } });
  await admin.from("customers").insert({ user_id: userId, stripe_customer_id: customer.id });
  return customer.id;
}

/** ¿Tiene este usuario una suscripción activa? */
export async function isActive(userId: string) {
  const { data } = await admin.from("subscriptions").select("status,current_period_end").eq("user_id", userId).maybeSingle();
  if (!data) return false;
  const okStatus = ["active", "trialing"].includes(data.status);
  const notExpired = !data.current_period_end || new Date(data.current_period_end) > new Date();
  return okStatus && notExpired;
}
