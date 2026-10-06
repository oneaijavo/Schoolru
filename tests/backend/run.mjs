import assert from "node:assert/strict";
import * as M from "./mocks.mjs";
const ENV = { SUPABASE_URL: "http://sb", SUPABASE_ANON_KEY: "anon", SUPABASE_SERVICE_ROLE_KEY: "svc", STRIPE_SECRET_KEY: "sk_test",
  STRIPE_WEBHOOK_SECRET: "whsec", STRIPE_PRICE_MONTHLY: "price_m", STRIPE_PRICE_YEARLY: "price_y", STRIPE_PASS_MONTHLY: "pass_m", STRIPE_PASS_YEARLY: "pass_y", SITE_URL: "https://site.test" };
let last = null;
globalThis.Deno = { env: { get: (k) => ENV[k] }, serve: (h) => { last = h; } };
const F = new URL("../../supabase/functions/", import.meta.url).href;
async function load(name) { await import(F + name + "/index.ts"); return last; }
const checkout = await load("create-checkout"), portal = await load("customer-portal"), hook = await load("stripe-webhook"), content = await load("premium-content"), del = await load("delete-account");
const req = (body, tok, extra = {}) => new Request("https://fn", { method: extra.method || "POST", headers: { ...(tok ? { Authorization: "Bearer " + tok } : {}), ...(extra.headers || {}) }, body: extra.method === "OPTIONS" ? undefined : (typeof body === "string" ? body : JSON.stringify(body ?? {})) });
const J = async (r) => ({ status: r.status, body: await r.json().catch(() => null), headers: r.headers });
let pass = 0, fail = 0; const results = [];
async function test(name, fn) { try { await fn(); pass++; results.push("✓ " + name); } catch (e) { fail++; results.push("✗ " + name + " — " + e.message); } }
const day = 864e5;

await test("CORS preflight devuelve cabeceras", async () => { const r = await checkout(req(null, null, { method: "OPTIONS" })); assert.equal(r.headers.get("Access-Control-Allow-Origin"), "*"); });
await test("create-checkout sin sesión → 401", async () => { assert.equal((await J(await checkout(req({ plan: "monthly" })))).status, 401); });
await test("create-checkout tarjeta mensual → suscripción con precio mensual", async () => {
  const r = await J(await checkout(req({ plan: "monthly", method: "card" }, "tok-ana"))); assert.equal(r.status, 200); assert.match(r.body.url, /checkout/);
  const s = M.STRIPE_LOG.sessions.at(-1); assert.equal(s.mode, "subscription"); assert.equal(s.line_items[0].price, "price_m");
  assert.equal(s.subscription_data.metadata.user_id, "u-ana"); assert.equal(s.payment_method_types, undefined); assert.match(s.success_url, /\?checkout=success#account$/); });
await test("cliente de Stripe se crea una vez y se reutiliza", async () => {
  await checkout(req({ plan: "yearly", method: "card" }, "tok-ana")); assert.equal(M.DB.customers.filter(c => c.user_id === "u-ana").length, 1);
  assert.equal(M.STRIPE_LOG.sessions.at(-1).line_items[0].price, "price_y"); assert.equal(M.STRIPE_LOG.sessions.at(-1).customer, M.STRIPE_LOG.sessions.at(-2).customer); });
await test("create-checkout WeChat/Alipay anual → pago único", async () => {
  await checkout(req({ plan: "yearly", method: "china" }, "tok-li")); const s = M.STRIPE_LOG.sessions.at(-1);
  assert.equal(s.mode, "payment"); assert.deepEqual(s.payment_method_types, ["wechat_pay", "alipay"]); assert.equal(s.line_items[0].price, "pass_y");
  assert.equal(s.metadata.pass, "yearly"); assert.equal(s.metadata.user_id, "u-li"); assert.equal(s.payment_method_options.wechat_pay.client, "web"); });
await test("customer-portal devuelve URL y vuelve a #account", async () => { const r = await J(await portal(req({}, "tok-ana"))); assert.equal(r.status, 200); assert.match(M.STRIPE_LOG.portals.at(-1).return_url, /#account$/); });
await test("webhook con firma inválida → 400", async () => { const r = await hook(req({ type: "x" }, null, { headers: { "Stripe-Signature": "bad" } })); assert.equal(r.status, 400); });
const ev = (type, object) => req(JSON.stringify({ type, data: { object } }), null, { headers: { "Stripe-Signature": "good-signature" } });
const nowS = Math.floor(Date.now() / 1000);
await test("subscription.created guarda suscripción activa (period_end en items)", async () => {
  await hook(ev("customer.subscription.created", { id: "sub_1", customer: "cus_1", metadata: { user_id: "u-ana" }, status: "active", cancel_at_period_end: false, items: { data: [{ price: { id: "price_m" }, current_period_end: nowS + 30 * 86400 }] } }));
  const row = M.DB.subscriptions.find(r => r.user_id === "u-ana"); assert.equal(row.status, "active"); assert.equal(row.price_id, "price_m"); assert.ok(new Date(row.current_period_end) > new Date(Date.now() + 29 * day)); });
await test("subscription.updated sin metadata encuentra usuario por customer", async () => {
  await hook(ev("customer.subscription.updated", { id: "sub_1", customer: M.DB.customers.find(c => c.user_id === "u-ana").stripe_customer_id, metadata: {}, status: "active", cancel_at_period_end: true, current_period_end: nowS + 10 * 86400, items: { data: [{ price: { id: "price_m" } }] } }));
  assert.equal(M.DB.subscriptions.find(r => r.user_id === "u-ana").cancel_at_period_end, true); });
await test("checkout.session.completed (suscripción) recupera y guarda la suscripción", async () => {
  M.SUBS["sub_2"] = { id: "sub_2", customer: "cus_x", metadata: { user_id: "u-bob" }, status: "trialing", cancel_at_period_end: false, items: { data: [{ price: { id: "price_y" }, current_period_end: nowS + 365 * 86400 }] } };
  await hook(ev("checkout.session.completed", { mode: "subscription", subscription: "sub_2" })); assert.equal(M.DB.subscriptions.find(r => r.user_id === "u-bob").status, "trialing"); });
await test("pase WeChat/Alipay mensual pagado → activo ~1 mes, sin renovación", async () => {
  await hook(ev("checkout.session.completed", { mode: "payment", payment_status: "paid", metadata: { user_id: "u-li", pass: "monthly" } }));
  const r = M.DB.subscriptions.find(x => x.user_id === "u-li"); assert.equal(r.status, "active"); assert.equal(r.price_id, "pass_monthly"); assert.equal(r.cancel_at_period_end, true);
  const d = (new Date(r.current_period_end) - Date.now()) / day; assert.ok(d > 27 && d < 32, "días=" + d); });
await test("segundo pase (anual) se suma al tiempo que queda", async () => {
  await hook(ev("checkout.session.async_payment_succeeded", { mode: "payment", payment_status: "paid", metadata: { user_id: "u-li", pass: "yearly" } }));
  const d = (new Date(M.DB.subscriptions.find(x => x.user_id === "u-li").current_period_end) - Date.now()) / day; assert.ok(d > 390 && d < 400, "días=" + d); });
await test("pase no pagado (unpaid) no activa nada", async () => {
  await hook(ev("checkout.session.completed", { mode: "payment", payment_status: "unpaid", metadata: { user_id: "u-zed", pass: "monthly" } }));
  assert.equal(M.DB.subscriptions.find(x => x.user_id === "u-zed"), undefined); });
await test("premium-content sin sesión → 401", async () => { assert.equal((await content(req({}))).status, 401); });
await test("premium-content con suscripción activa → contenido + audio firmado", async () => {
  const r = await J(await content(req({}, "tok-ana"))); assert.equal(r.status, 200); assert.equal(r.body.content.lessons[0].n, 4); assert.match(r.body.audioUrl, /audio-premium\.mp3/); });
await test("premium-content con suscripción caducada → 403", async () => {
  M.DB.subscriptions.find(x => x.user_id === "u-ana").current_period_end = new Date(Date.now() - day).toISOString();
  assert.equal((await content(req({}, "tok-ana"))).status, 403); });
await test("subscription.deleted → status canceled y sin acceso", async () => {
  await hook(ev("customer.subscription.deleted", { id: "sub_1", customer: "cus_1", metadata: { user_id: "u-ana" }, status: "canceled", cancel_at_period_end: false, items: { data: [{ price: { id: "price_m" }, current_period_end: nowS + 86400 }] } }));
  assert.equal(M.DB.subscriptions.find(x => x.user_id === "u-ana").status, "canceled"); assert.equal((await content(req({}, "tok-ana"))).status, 403); });
await test("delete-account cancela suscripción y borra datos y usuario", async () => {
  M.DB.subscriptions.find(x => x.user_id === "u-ana").status = "active"; M.DB.progress.push({ user_id: "u-ana", data: {} });
  const r = await J(await del(req({}, "tok-ana"))); assert.equal(r.status, 200); assert.deepEqual(M.STRIPE_LOG.cancelled, ["sub_1"]);
  for (const t of ["progress", "subscriptions", "customers"]) assert.equal(M.DB[t].filter(x => x.user_id === "u-ana").length, 0, t);
  assert.deepEqual(M.DELETED, ["u-ana"]); });
await test("delete-account de usuario con pase no intenta cancelar en Stripe", async () => { await del(req({}, "tok-li")); assert.deepEqual(M.STRIPE_LOG.cancelled, ["sub_1"]); assert.ok(M.DELETED.includes("u-li")); });
console.log(results.join("\n")); console.log(`\n${pass} correctas, ${fail} fallidas`); process.exit(fail ? 1 : 0);
