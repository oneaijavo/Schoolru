// Configuración pública de la web. Rellena con los datos de tu proyecto de Supabase
// (Project Settings → API). La "anon key" es pública: puede ir aquí sin problema.
// Si lo dejas vacío, la web funciona en modo gratuito y los pagos aparecen como "no configurados".
window.SOR_CONFIG = {
  supabaseUrl: "",        // p. ej. "https://abcdefgh.supabase.co"
  supabaseAnonKey: "",    // p. ej. "eyJhbGciOi..."
  siteUrl: "",            // p. ej. "https://www.tudominio.com"  (sin barra final)
  prices: { monthly: "4,99 €", yearly: "39,99 €" },  // solo el texto que se muestra

  // Datos que aparecen en los Términos de uso y la Política de privacidad.
  // Lo que dejes vacío se muestra resaltado en amarillo como [HUECO].
  // Un valor puede ser texto o { es: "...", zh: "...", en: "..." } si cambia según el idioma.
  legal: {
    owner: "",          // nombre completo o razón social
    address: "",        // dirección completa y país
    taxId: "",          // NIF / CIF / número fiscal
    email: "",          // correo de contacto y privacidad
    country: "",        // país cuya ley se aplica, p. ej. { es: "España", zh: "西班牙", en: "Spain" }
    region: "",         // región del servidor de Supabase, p. ej. "UE – Fráncfort"
    hosting: "",        // p. ej. "Netlify, Inc."
    billingPeriod: "",  // p. ej. { es: "6 años", zh: "6 年", en: "6 years" }
    logDays: "90",
    authority: "",      // p. ej. { es: "la AEPD en España: www.aepd.es", zh: "西班牙数据保护局 www.aepd.es", en: "AEPD in Spain: www.aepd.es" }
    bookAuthor: "",     // autor/a del libro de raíces
    teacher: "Анна",    // profesora cuya voz se usa
    date: ""            // fecha de la última versión, p. ej. "6 de octubre de 2026"
  },
  legalDraft: true      // pon false cuando hayas completado y revisado los textos legales
};
