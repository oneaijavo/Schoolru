// Entrega el contenido Premium (lecciones 4–40, A2) y un enlace temporal al audio Premium,
// solo si el usuario tiene una suscripción activa.
import { cors, json, admin, getUser, isActive } from "../_shared/util.ts";

let cache: unknown = null;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const user = await getUser(req);
  if (!user) return json({ error: "No has iniciado sesión" }, 401);
  if (!(await isActive(user.id))) return json({ error: "Sin suscripción activa" }, 403);

  if (!cache) {
    const { data, error } = await admin.storage.from("premium").download("premium.json");
    if (error || !data) return json({ error: "No se encontró premium.json" }, 500);
    cache = JSON.parse(await data.text());
  }
  const { data: signed } = await admin.storage.from("premium").createSignedUrl("audio-premium.mp3", 60 * 60 * 6);
  return json({ content: cache, audioUrl: signed?.signedUrl ?? null });
});
