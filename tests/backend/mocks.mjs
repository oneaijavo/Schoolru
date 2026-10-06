// In-memory mocks for Supabase, Stripe and Deno used by the backend tests.
export const DB = { customers: [], subscriptions: [], progress: [] };
export const USERS = { "tok-ana": { id: "u-ana", email: "ana@example.com" }, "tok-li": { id: "u-li", email: "li@example.com" } };
export const DELETED = [];
export const STORAGE = { premium: { "premium.json": JSON.stringify({ lessons: [{ n: 4 }], a2: "x|y|z|w" }) } };
export const STRIPE_LOG = { sessions: [], portals: [], cancelled: [], customers: [] };
export const SUBS = {};

function query(table) {
  let filters = [], op = "select", payload = null;
  const rows = () => DB[table].filter(r => filters.every(([k, v]) => r[k] === v));
  const q = {
    select() { return q; },
    eq(k, v) { filters.push([k, v]); return q; },
    async maybeSingle() { const r = rows(); return { data: r[0] ? { ...r[0] } : null, error: null }; },
    insert(obj) { DB[table].push({ ...obj }); return Promise.resolve({ error: null }); },
    upsert(obj) {
      const key = "user_id"; const i = DB[table].findIndex(r => r[key] === obj[key]);
      if (i >= 0) DB[table][i] = { ...DB[table][i], ...obj }; else DB[table].push({ ...obj });
      return Promise.resolve({ error: null });
    },
    delete() { op = "delete"; return q; },
    then(res) { if (op === "delete") { DB[table] = DB[table].filter(r => !filters.every(([k, v]) => r[k] === v)); } return Promise.resolve({ error: null }).then(res); },
  };
  return q;
}

export function createClient(url, key, opts = {}) {
  const auth = opts?.global?.headers?.Authorization;
  return {
    from: query,
    auth: {
      async getUser() { const tok = (auth || "").replace("Bearer ", ""); const u = USERS[tok]; return { data: { user: u ?? null } }; },
      admin: { async deleteUser(id) { DELETED.push(id); return { error: null }; } },
    },
    storage: { from(bucket) { return {
      async download(path) { const v = STORAGE[bucket]?.[path]; return v ? { data: { text: async () => v }, error: null } : { data: null, error: "nf" }; },
      async createSignedUrl(path, exp) { return { data: { signedUrl: `https://signed/${bucket}/${path}?exp=${exp}` } }; },
    }; } },
  };
}

export default class Stripe {
  constructor(key) { if (!key) throw new Error("no key"); }
  static createFetchHttpClient() { return {}; }
  static createSubtleCryptoProvider() { return {}; }
  customers = { create: async (p) => { const id = "cus_" + (STRIPE_LOG.customers.length + 1); STRIPE_LOG.customers.push({ id, ...p }); return { id }; } };
  checkout = { sessions: { create: async (p) => { STRIPE_LOG.sessions.push(p); return { url: "https://checkout.stripe/test/" + STRIPE_LOG.sessions.length }; } } };
  billingPortal = { sessions: { create: async (p) => { STRIPE_LOG.portals.push(p); return { url: "https://billing.stripe/portal" }; } } };
  subscriptions = { retrieve: async (id) => SUBS[id], cancel: async (id) => { STRIPE_LOG.cancelled.push(id); return { id, status: "canceled" }; } };
  webhooks = { constructEventAsync: async (body, sig) => { if (sig !== "good-signature") throw new Error("bad sig"); return JSON.parse(body); } };
}
