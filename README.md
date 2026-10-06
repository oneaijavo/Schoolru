# Школа русского · School of Russian

Juego web para aprender vocabulario ruso (A1, A2 y las 40 lecciones de raíces), en chino, español e inglés.

## Estructura

- `docs/`: la web (lo que se publica). Es estática: `index.html`, `audio.mp3`, `config.js` y `favicon.svg`.
- `supabase/`: la base de datos y las funciones para cuentas y pagos (Supabase + Stripe).
- `tests/backend/`: pruebas de las funciones de pago.
- `LEEME-SUSCRIPCION.md`: la guía para activar las cuentas y la suscripción.

## Publicar en GitHub Pages

1. Crea un repositorio nuevo en GitHub (por ejemplo `school-of-russian`) y sube el contenido de esta carpeta.
2. Ve a **Settings → Pages**.
3. En **Source**, elige «Deploy from a branch».
4. En **Branch**, elige `main` y la carpeta `/docs`, y pulsa Save.
5. En 1–2 minutos la web estará en `https://TU-USUARIO.github.io/school-of-russian/`.

Sin rellenar `docs/config.js`, la web funciona en **modo gratuito**: A1, lecciones 1–3, diccionario, alfabeto y 3 partidas al día. Las páginas de Premium aparecen como «no configuradas». Para activar las cuentas y los pagos, sigue `LEEME-SUSCRIPCION.md` y rellena `docs/config.js`. En `siteUrl` pon la URL de GitHub Pages o tu dominio, sin barra final.

## Importante

- El contenido Premium (lecciones 4–40, A2 y su audio) **no está en este repositorio**, a propósito. Está en `supabase/premium-files/` en tu Mac y se sube solo al bucket privado de Supabase. El archivo `.gitignore` impide subirlo por error.
- Con un plan gratuito de GitHub, Pages exige que el repositorio sea **público**, así que no pongas claves secretas en ningún archivo. La `anon key` de Supabase sí es pública y puede ir en `config.js`; las claves de Stripe y la `service_role` van solo en los secretos de Supabase.
- Los textos legales siguen en borrador (`legalDraft: true`) hasta que completes los datos del titular.
