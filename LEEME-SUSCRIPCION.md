# Школа русского — Suscripción Premium (v0.7)

## Qué hay en esta carpeta

```
web/                         → lo que se sube al hosting (Netlify, Vercel…)
  index.html                 la web (solo contenido gratuito dentro)
  audio.mp3                  audios del contenido gratuito
  config.js                  ← rellenar con los datos de Supabase
  favicon.svg
supabase/
  migrations/…sql            tablas: customers, subscriptions, progress + bucket "premium"
  functions/create-checkout  crea el pago en Stripe
  functions/customer-portal  portal para cancelar / cambiar tarjeta
  functions/stripe-webhook   Stripe avisa → se guarda el estado de la suscripción
  functions/premium-content  entrega el contenido Premium solo a suscriptores
  functions/delete-account   borra la cuenta (botón en «Mi cuenta»)
  premium-files/             ← subir al bucket privado "premium"
    premium.json             lecciones 4–40 + nivel A2
    audio-premium.mp3        audios Premium
```

## Formas de pago
| Método | Cómo funciona |
|---|---|
| Tarjeta, Apple Pay, Google Pay | Suscripción con renovación automática (mensual o anual). Apple Pay aparece en Safari/iPhone/Mac y Google Pay en Chrome/Android. |
| WeChat Pay, Alipay | **Pago único** que activa Premium 1 mes o 12 meses. Stripe no permite cobros recurrentes con estos métodos, así que al vencer el usuario vuelve a pagar (la web le muestra el botón «Ampliar»). Si paga antes de que venza, el tiempo se suma. |

En la web en chino, el botón de WeChat Pay / Alipay aparece primero.

## Qué es gratis y qué es Premium
- Gratis: A1 completo, lecciones 1–3, diccionario, alfabeto, 3 partidas al día.
- Premium: lecciones 4–40, A2 (y futuros niveles), partidas ilimitadas, Repaso, Mi progreso con sincronización en la nube.
- El contenido Premium NO está en index.html: el servidor solo lo envía a quien tiene la suscripción activa.

## Puesta en marcha (una sola vez)

### 1. Supabase (cuentas + base de datos + funciones)
1. Crea un proyecto en supabase.com.
2. Instala la herramienta: `brew install supabase/tap/supabase`
3. En la Terminal, dentro de esta carpeta:
   ```
   supabase init          (si pregunta algo, responde que no)
   supabase login
   supabase link --project-ref TU_PROJECT_REF
   supabase db push
   ```
4. Storage → bucket **premium** (ya creado, privado) → sube los dos archivos de `supabase/premium-files/`.
5. Authentication → URL Configuration: Site URL = tu dominio; añade tu dominio en Redirect URLs.
6. Authentication → Email Templates → "Magic Link": cambia el texto para que incluya el código:
   `Tu código para entrar en Школа русского: {{ .Token }}`
7. Authentication → Providers: activa **Google** (necesita credenciales de Google Cloud) y **Apple** (necesita cuenta de Apple Developer, 99 $/año). Ambos son opcionales; el correo con código funciona sin ellos.

### 2. Stripe (cobros)
1. Crea la cuenta en stripe.com. Importante: la cuenta tiene que estar a nombre de una persona o empresa de un país donde Stripe opera (p. ej. España); Stripe no admite cuentas de Rusia.
2. Productos → crea "Premium" con **cuatro precios** y copia sus `price_…`:
   - 4,99 € recurrente mensual → `STRIPE_PRICE_MONTHLY`
   - 39,99 € recurrente anual → `STRIPE_PRICE_YEARLY`
   - 4,99 € **pago único** ("Premium 1 mes") → `STRIPE_PASS_MONTHLY`
   - 39,99 € **pago único** ("Premium 12 meses") → `STRIPE_PASS_YEARLY`
3. Settings → Payment methods: activa **Cards, Apple Pay, Google Pay, Alipay y WeChat Pay**. Alipay y WeChat Pay solo están disponibles si tu cuenta de Stripe es de la UE, EE. UU., Reino Unido, Canadá, Australia, Hong Kong, Japón o Singapur; WeChat Pay puede pedir una revisión de Stripe antes de activarse. Con la página de pago de Stripe (Checkout) no hace falta verificar el dominio para Apple Pay.
4. Settings → Billing → Customer portal: actívalo (permitir cancelar y cambiar tarjeta).
5. Developers → Webhooks → Add endpoint:
   - URL: `https://TU_PROJECT_REF.supabase.co/functions/v1/stripe-webhook`
   - Eventos: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`
   - Copia el "Signing secret" (`whsec_…`).
6. Stripe pide tener en la web: términos de uso, política de privacidad y de reembolsos.

### 3. Conectar ambos
```
supabase secrets set STRIPE_SECRET_KEY=sk_live_... STRIPE_WEBHOOK_SECRET=whsec_... \
  STRIPE_PRICE_MONTHLY=price_... STRIPE_PRICE_YEARLY=price_... \
  STRIPE_PASS_MONTHLY=price_... STRIPE_PASS_YEARLY=price_... SITE_URL=https://tudominio.com
supabase functions deploy create-checkout
supabase functions deploy customer-portal
supabase functions deploy premium-content
supabase functions deploy delete-account
supabase functions deploy stripe-webhook --no-verify-jwt
```

### 4. La web
1. Edita `web/config.js` con la URL y la anon key de Supabase (Project Settings → API) y tu dominio.
2. Sube la carpeta `web/` a tu hosting.

## Textos legales
La web incluye Términos de uso y Política de privacidad en español, chino e inglés (enlaces en el pie de página). Los datos variables (titular, dirección, NIF, correo, país…) se rellenan en `web/config.js` → `legal`. Cuando estén completos y revisados por un abogado, pon `legalDraft: false` para quitar el aviso de borrador.
Antes de pagar, el usuario tiene que marcar una casilla aceptando los términos y renunciando al derecho de desistimiento de 14 días (necesario en la UE para no hacer reembolsos de contenido digital).

## Probar antes de cobrar de verdad
Usa primero las claves de **modo prueba** de Stripe (`sk_test_…`, precios y webhook de prueba) y paga con la tarjeta `4242 4242 4242 4242`, cualquier fecha futura y cualquier CVC. En modo prueba, WeChat Pay y Alipay muestran una página de Stripe donde puedes «autorizar» o «fallar» el pago. Cuando todo funcione, cambia a las claves reales.

## Pruebas
Pruebas automáticas del servidor (no necesitan internet ni instalar nada, solo Node 22):
```
cd tests/backend
node --experimental-strip-types --import ./loader.mjs run.mjs
```
Comprueban los pagos (tarjeta y WeChat/Alipay), el webhook, el acceso al contenido Premium y el borrado de cuenta con Stripe y Supabase simulados.

Lista de comprobación manual con las cuentas reales (modo prueba de Stripe):
1. Entrar con correo: llega el correo con el código de 6 dígitos (no un enlace).
2. Entrar con Google y con Apple.
3. Pagar con la tarjeta 4242 4242 4242 4242 → al volver, «Mi cuenta» muestra Premium (puede tardar unos segundos).
4. Apple Pay en Safari (Mac o iPhone) y Google Pay en Chrome (Android) aparecen en la página de pago.
5. WeChat Pay y Alipay: aparece el QR / la página de prueba y, tras autorizar, el pase queda activo.
6. Lección 10 y A2 se abren y suenan; el progreso aparece en otro dispositivo con la misma cuenta.
7. «Gestionar suscripción» → cancelar → «No se renovará».
8. «Borrar mi cuenta» → la cuenta desaparece en Supabase y la suscripción queda cancelada en Stripe.
9. En el móvil (iPhone y Android) se oye el audio y no hay que hacer scroll lateral.

## Pendiente
- Inicio de sesión con WeChat: requiere cuenta de desarrollador WeChat verificada (empresa china). Se añadirá con una función propia.
- Renovación automática con WeChat Pay / Alipay: no es posible con Stripe; requeriría contratar directamente con WeChat Pay/Alipay (empresa en China).
- En las apps de iPhone/Android, Apple y Google exigen su propio sistema de pago.
