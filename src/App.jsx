import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Menu, X, ShoppingBag, Star, ChevronDown, Plus, Minus,
  Trash2, Pencil, Check, Lock, LogOut, Eye, EyeOff, ArrowLeft, Upload, Search, SlidersHorizontal, Tag, Moon, Sun,
  Package, Pin, ArrowUpDown, Mail, Phone, MapPin, CreditCard, Globe2, Send, Coins, AlertCircle, ArrowUp, ArrowDown, Copy, Flame,
  Layers, Building2, Tags, ShieldCheck, RotateCcw, BarChart3, TrendingUp, BadgeCheck, Sparkles
} from "lucide-react";
import { storage } from "./lib/storage.js";
import { LOGO_DARK_MARK, LOGO_LIGHT_MARK } from "./logoAssets.js";

/* ========================================================================
   LA DOBLE M — minimalist luxury storefront
   Storefront + admin CMS. Shared data (products, categories, brands, logo,
   reviews, orders, images) persists in Supabase; per-visitor data (cart,
   wishlist, theme, currency, admin session) persists in localStorage.
   See src/lib/storage.js.
   ======================================================================== */

// Brand mark: black ink version shows on light backgrounds, white ink version
// shows on dark backgrounds. See src/logoAssets.js.
const DEFAULT_LOGO_SRC_DARK_MARK = LOGO_DARK_MARK;
const DEFAULT_LOGO_SRC_LIGHT_MARK = LOGO_LIGHT_MARK;

const LogoMark = ({ size = "", onClick, theme = "light" }) => {
  const logo = theme === "dark" ? DEFAULT_LOGO_SRC_LIGHT_MARK : DEFAULT_LOGO_SRC_DARK_MARK;
  return logo ? (
    <img src={logo} alt="La Doble M" className={`ldm-logomark ${size}`} onClick={onClick} style={onClick ? { cursor: "pointer" } : undefined} />
  ) : (
    <svg viewBox="0 0 40 40" className={`ldm-logomark ${size}`} onClick={onClick} style={onClick ? { cursor: "pointer" } : undefined} fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 30 L6 10 L14 22 L20 10 L20 30" />
      <path d="M20 30 L20 10 L28 22 L34 10 L34 30" />
    </svg>
  );
};

/* ---------------------------- storage hook -----------------------------
   Keys in ADMIN_PROTECTED_KEYS can only be written through the signed
   admin session (see api/admin-kv.js) — Supabase's RLS policy rejects
   anon writes to them, so ordinary visitors only ever read these, never
   write. See src/lib/storage.js for the admin-authenticated write path. */
const ADMIN_PROTECTED_KEYS = new Set(["ldm-products", "ldm-categories", "ldm-brands", "ldm-tags"]);

function useStoredState(key, initial, shared = false, adminToken = null) {
  const [state, setState] = useState(initial);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await storage.get(key, shared);
        if (!cancelled && r && r.value != null) setState(JSON.parse(r.value));
      } catch (e) { /* no stored value yet */ }
      finally { if (!cancelled) setReady(true); }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line
  }, [key]);
  useEffect(() => {
    if (!ready) return;
    if (shared && ADMIN_PROTECTED_KEYS.has(key) && !adminToken) return; // read-only for visitors
    (async () => {
      try {
        if (shared && adminToken) await storage.adminSet(key, JSON.stringify(state), adminToken);
        else await storage.set(key, JSON.stringify(state), shared);
      } catch (e) {}
    })();
    // eslint-disable-next-line
  }, [state, ready, adminToken]);
  return [state, setState, ready];
}

/* ------------------ per-image storage (large-file safe) -------------------
   Uploaded photos are base64 and can be several hundred KB to a few MB each.
   If we embedded them straight into the products record, a handful of
   uploads would blow past the 5MB-per-key storage ceiling and the whole
   catalog would silently fail to save — which is what caused broken/missing
   image icons. Instead every uploaded image lives under its own storage key
   ("img-<id>"), and products only keep a lightweight { id, stored:true }
   reference. Pasted image URLs are tiny strings, so those stay inline.
   A small in-memory cache avoids refetching the same image twice. ---------- */
const imageMemoryCache = new Map();

function useResolvedImageSrc(img) {
  const stored = !!img?.stored;
  const cacheKey = stored ? `img-${img.id}` : null;
  const [src, setSrc] = useState(() => (stored ? imageMemoryCache.get(cacheKey) || null : img?.src || null));

  useEffect(() => {
    if (!stored) { setSrc(img?.src || null); return; }
    if (imageMemoryCache.has(cacheKey)) { setSrc(imageMemoryCache.get(cacheKey)); return; }
    let cancelled = false;
    (async () => {
      try {
        const r = await storage.get(cacheKey, true);
        if (r && r.value) {
          imageMemoryCache.set(cacheKey, r.value);
          if (!cancelled) setSrc(r.value);
        }
      } catch (e) { /* not saved yet, or storage not ready */ }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line
  }, [cacheKey, stored]);

  return src;
}

// Fire-and-forget persist. The memory cache is populated synchronously
// (before the await) so any component reading this image right away —
// like the upload preview — sees it immediately, with no flash/broken icon.
function saveImageToStore(id, dataUrl) {
  const key = `img-${id}`;
  imageMemoryCache.set(key, dataUrl);
  (async () => { try { await storage.set(key, dataUrl, true); } catch (e) { /* best effort */ } })();
}

function deleteImageFromStore(id) {
  const key = `img-${id}`;
  imageMemoryCache.delete(key);
  (async () => { try { await storage.delete(key, true); } catch (e) { /* already gone */ } })();
}

/* ------------------------------ currency -------------------------------- */
const CURRENCIES = {
  CLP: { label: "CLP — Peso Chileno", rate: 950, decimals: 0, prefix: "$" },
  USD: { label: "USD — US Dollar", rate: 1, decimals: 0, prefix: "$" },
  EUR: { label: "EUR — Euro", rate: 0.92, decimals: 0, prefix: "€" },
};
const formatPrice = (usd, code) => {
  const c = CURRENCIES[code] || CURRENCIES.CLP;
  const val = usd * c.rate;
  return `${c.prefix}${Math.round(val).toLocaleString("en-US")}`;
};

/* ---------------------------- checkout: countries ------------------------
   Each country carries its dial code, a phone grouping pattern (used to
   live-format the national number as the person types), and — where it's
   useful for the person filling the form — a label + list for the
   state/province/region/department level so it can render as a dropdown.
   Countries without a `subdivisions` list still get the right label, just
   as a free-text field instead of a dropdown. ---------------------------- */
const COUNTRIES = [
  {
    code: "CL", name: "Chile", dial: "+56", phonePattern: [1, 4, 4],
    subdivisionLabel: "Región",
    subdivisions: [
      "Arica y Parinacota", "Tarapacá", "Antofagasta", "Atacama", "Coquimbo", "Valparaíso",
      "Metropolitana de Santiago", "O'Higgins", "Maule", "Ñuble", "Biobío", "La Araucanía",
      "Los Ríos", "Los Lagos", "Aysén", "Magallanes",
    ],
  },
  {
    code: "AR", name: "Argentina", dial: "+54", phonePattern: [2, 4, 4],
    subdivisionLabel: "Provincia",
    subdivisions: [
      "Buenos Aires", "Ciudad Autónoma de Buenos Aires", "Catamarca", "Chaco", "Chubut", "Córdoba",
      "Corrientes", "Entre Ríos", "Formosa", "Jujuy", "La Pampa", "La Rioja", "Mendoza", "Misiones",
      "Neuquén", "Río Negro", "Salta", "San Juan", "San Luis", "Santa Cruz", "Santa Fe",
      "Santiago del Estero", "Tierra del Fuego", "Tucumán",
    ],
  },
  {
    code: "UY", name: "Uruguay", dial: "+598", phonePattern: [1, 4, 4],
    subdivisionLabel: "Departamento",
    subdivisions: [
      "Artigas", "Canelones", "Cerro Largo", "Colonia", "Durazno", "Flores", "Florida", "Lavalleja",
      "Maldonado", "Montevideo", "Paysandú", "Río Negro", "Rivera", "Rocha", "Salto", "San José",
      "Soriano", "Tacuarembó", "Treinta y Tres",
    ],
  },
  {
    code: "US", name: "Estados Unidos", dial: "+1", phonePattern: [3, 3, 4],
    subdivisionLabel: "Estado",
    subdivisions: [
      "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut", "Delaware",
      "Florida", "Georgia", "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky",
      "Louisiana", "Maine", "Maryland", "Massachusetts", "Michigan", "Minnesota", "Mississippi",
      "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire", "New Jersey", "New Mexico",
      "New York", "North Carolina", "North Dakota", "Ohio", "Oklahoma", "Oregon", "Pennsylvania",
      "Rhode Island", "South Carolina", "South Dakota", "Tennessee", "Texas", "Utah", "Vermont",
      "Virginia", "Washington", "West Virginia", "Wisconsin", "Wyoming",
    ],
  },
  {
    code: "MX", name: "México", dial: "+52", phonePattern: [2, 4, 4],
    subdivisionLabel: "Estado",
    subdivisions: [
      "Aguascalientes", "Baja California", "Baja California Sur", "Campeche", "Chiapas", "Chihuahua",
      "Ciudad de México", "Coahuila", "Colima", "Durango", "Guanajuato", "Guerrero", "Hidalgo",
      "Jalisco", "México", "Michoacán", "Morelos", "Nayarit", "Nuevo León", "Oaxaca", "Puebla",
      "Querétaro", "Quintana Roo", "San Luis Potosí", "Sinaloa", "Sonora", "Tabasco", "Tamaulipas",
      "Tlaxcala", "Veracruz", "Yucatán", "Zacatecas",
    ],
  },
  {
    code: "CA", name: "Canadá", dial: "+1", phonePattern: [3, 3, 4],
    subdivisionLabel: "Provincia",
    subdivisions: [
      "Alberta", "British Columbia", "Manitoba", "New Brunswick", "Newfoundland and Labrador",
      "Nova Scotia", "Ontario", "Prince Edward Island", "Quebec", "Saskatchewan",
    ],
  },
  { code: "BR", name: "Brasil", dial: "+55", phonePattern: [2, 5, 4], subdivisionLabel: "Estado" },
  { code: "ES", name: "España", dial: "+34", phonePattern: [3, 3, 3], subdivisionLabel: "Provincia" },
  { code: "CO", name: "Colombia", dial: "+57", phonePattern: [3, 3, 4], subdivisionLabel: "Departamento" },
  { code: "PE", name: "Perú", dial: "+51", phonePattern: [3, 3, 3], subdivisionLabel: "Departamento" },
  { code: "EC", name: "Ecuador", dial: "+593", phonePattern: [2, 3, 4], subdivisionLabel: "Provincia" },
  { code: "BO", name: "Bolivia", dial: "+591", phonePattern: [1, 3, 4], subdivisionLabel: "Departamento" },
  { code: "PY", name: "Paraguay", dial: "+595", phonePattern: [3, 3, 3], subdivisionLabel: "Departamento" },
  { code: "VE", name: "Venezuela", dial: "+58", phonePattern: [3, 3, 4], subdivisionLabel: "Estado" },
];

/* ---------------------------- checkout: formatters ------------------------ */
const onlyDigits = (s) => (s || "").replace(/\D/g, "");

// Groups raw national-number digits per the country's pattern, e.g.
// CL [1,4,4] turns "847255481" into "8 4725 5481".
function formatNationalPhone(digits, pattern) {
  const groups = pattern || [3, 3, 4];
  const clean = onlyDigits(digits);
  const parts = [];
  let idx = 0;
  for (const size of groups) {
    if (idx >= clean.length) break;
    parts.push(clean.slice(idx, idx + size));
    idx += size;
  }
  if (idx < clean.length) parts.push(clean.slice(idx)); // overflow digits still visible
  return parts.filter(Boolean).join(" ");
}

// "1234123412341234" -> "1234 1234 1234 1234" (caps at 19 digits for longer card schemes)
function formatCardNumber(value) {
  const digits = onlyDigits(value).slice(0, 19);
  return (digits.match(/.{1,4}/g) || []).join(" ");
}

// "1228" -> "12/28", clamps the month between 01–12 as it's typed
function formatExpiry(value) {
  let digits = onlyDigits(value).slice(0, 4);
  if (digits.length === 1 && Number(digits) > 1) digits = `0${digits}`;
  if (digits.length >= 2) {
    let mm = digits.slice(0, 2);
    if (Number(mm) === 0) mm = "01";
    if (Number(mm) > 12) mm = "12";
    digits = mm + digits.slice(2);
  }
  return digits.length <= 2 ? digits : `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

function validateCheckout(form, t) {
  const errors = {};
  if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) errors.email = t.errEmail;
  if (!form.fullName.trim()) errors.fullName = t.errRequired;
  if (!form.countryCode) errors.countryCode = t.errRequired;
  if (onlyDigits(form.phoneNational).length < 6) errors.phoneNational = t.errPhone;
  if (!form.address.trim()) errors.address = t.errRequired;
  if (!form.city.trim()) errors.city = t.errRequired;
  if (!form.subdivision.trim()) errors.subdivision = t.errRequired;
  if (!form.zip.trim()) errors.zip = t.errRequired;
  return errors;
}

/* ------------------------- auto locale detection ------------------------- */
// Best-effort, no network calls: reads the browser's own language/region info.
// Falls back to Spanish / CLP whenever detection isn't possible.
const detectDefaults = () => {
  let lang = "es";
  let currency = "CLP";
  try {
    const navLang = (navigator.language || navigator.userLanguage || "es").toLowerCase();
    lang = navLang.startsWith("en") ? "en" : "es";
    let region = null;
    try { region = new Intl.Locale(navigator.language).maximize().region; } catch (e) { /* older browsers */ }
    if (!region) {
      const parts = navLang.split("-");
      if (parts[1]) region = parts[1].toUpperCase();
    }
    const EU_REGIONS = ["DE", "FR", "ES", "IT", "PT", "NL", "BE", "AT", "IE", "FI", "GR", "LU", "SK", "SI", "EE", "LV", "LT", "MT", "CY", "HR"];
    if (region === "US") currency = "USD";
    else if (region && EU_REGIONS.includes(region)) currency = "EUR";
    else currency = "CLP";
  } catch (e) { /* keep defaults */ }
  return { lang, currency };
};

/* ------------------------------ translations ------------------------------ */
const STRINGS = {
  es: {
    menu: "Menú", brands: "Marcas", search: "Buscar productos", noResults: (q) => `Sin resultados para "${q}"`,
    account: "Cuenta", accountNote: "Las cuentas de cliente estarán disponibles pronto.",
    seasonEyebrow: "Colección Otoño / Invierno", heroLine1: "TWO LETTERS.", heroLine2: "ONE STANDARD.",
    viewCollection: "Ver la Colección", curated: "Piezas Seleccionadas", thisSeason: "Esta Temporada", viewFull: "Ver Colección Completa",
    collection: "Colección", allProducts: "Todos los Productos", all: "All", filters: "Filtros", pieces: "piezas",
    all_f: "Todas", trend: "Tendencia", size: "Talla", color: "Color", maxPrice: "Precio máx.", inStockOnly: "Solo en stock",
    sort: "Ordenar", clearFilters: "Limpiar filtros", noneYet: "No hay piezas en esta selección todavía.",
    selectSize: "Selecciona una talla", left: (n) => `Quedan ${n}`, qty: "Cantidad", selectSizeBtn: "Selecciona una Talla",
    outOfStock: "Agotado", addToBag: "Añadir a la Bolsa", added: "Añadido a tu bolsa",
    yourBag: "Tu Bolsa", checkout: "Checkout", emptyBag: "Tu bolsa está vacía.", subtotal: "Subtotal", shipping: "Envío",
    free: "Gratis", back: "Volver a la bolsa", email: "Correo electrónico", fullName: "Nombre completo", address: "Dirección",
    address2: "Dirección 2 (opcional)",
    city: "Ciudad", zip: "Código postal", country: "País", phone: "Número de teléfono", cardNumber: "Número de tarjeta", total: "Total", confirmOrder: "Confirmar Pedido",
    orderConfirmed: "Pedido confirmado.", orderConfirmedNote: "Hemos enviado una confirmación a tu correo.", continue: "Continuar",
    wishlist: "Favoritos", nothingSaved: "Aún no has guardado nada.", remove: "Eliminar",
    store: "Tienda", customerCare: "Atención al Cliente", shipments: "Envíos", returns: "Devoluciones", rights: "Todos los derechos reservados.",
    darkMode: "Modo Oscuro", lightMode: "Modo Claro", currencyLabel: "Moneda",
    reviews: "Reseñas", writeReview: "Escribir una Reseña", reviewPlaceholder: "Cuéntanos qué te pareció este producto...",
    submitReview: "Publicar Reseña", noReviews: "Aún no hay reseñas para este producto.",
    mustPurchaseToReview: "Compra este producto para poder dejar una reseña.", rating: "Calificación",
    // checkout — new
    contactSection: "Contacto", shippingSection: "Envío", paymentSection: "Pago", notesSection: "Notas del pedido",
    notesPlaceholder: "Agregá indicaciones de entrega o solicitudes especiales",
    selectCountry: "Selecciona un país", stateProvince: "Estado / Provincia / Región",
    errRequired: "Este campo es obligatorio.", errEmail: "Ingresá un correo válido.",
    errPhone: "Ingresá un número de teléfono válido.", errCard: "El número de tarjeta no es válido.",
    errExpiry: "Fecha inválida (MM/AA).", errCvc: "CVC inválido.",
    paymentNote: "Vas a ingresar los datos de tu tarjeta en la página segura de Stripe.",
    payWithCard: "Pagar con Tarjeta", redirecting: "Redirigiendo al pago seguro…",
    paymentError: "No pudimos iniciar el pago. Intentá de nuevo.",
    checkoutSuccessBanner: "¡Pago confirmado! Gracias por tu compra.",
    checkoutCancelledBanner: "Pago cancelado. Tu bolsa sigue intacta.",
    checkoutErrorBanner: "No pudimos confirmar el pago. Si te cobraron, contactanos.",
  },
  en: {
    menu: "Menu", brands: "Brands", search: "Search products", noResults: (q) => `No results for "${q}"`,
    account: "Account", accountNote: "Customer accounts coming soon.",
    seasonEyebrow: "Autumn / Winter Collection", heroLine1: "TWO LETTERS.", heroLine2: "ONE STANDARD.",
    viewCollection: "View the Collection", curated: "Curated Pieces", thisSeason: "This Season", viewFull: "View Full Collection",
    collection: "Collection", allProducts: "All Products", all: "All", filters: "Filters", pieces: "pieces",
    all_f: "All", trend: "Trend", size: "Size", color: "Color", maxPrice: "Max. price", inStockOnly: "In stock only",
    sort: "Sort", clearFilters: "Clear filters", noneYet: "No pieces in this selection yet.",
    selectSize: "Select a size", left: (n) => `${n} left`, qty: "Quantity", selectSizeBtn: "Select a Size",
    outOfStock: "Sold Out", addToBag: "Add to Bag", added: "Added to your bag",
    yourBag: "Your Bag", checkout: "Checkout", emptyBag: "Your bag is empty.", subtotal: "Subtotal", shipping: "Shipping",
    free: "Free", back: "Back to bag", email: "Email address", fullName: "Full name", address: "Address",
    address2: "Address line 2 (optional)",
    city: "City", zip: "Postal code", country: "Country", phone: "Phone number", cardNumber: "Card number", total: "Total", confirmOrder: "Confirm Order",
    orderConfirmed: "Order confirmed.", orderConfirmedNote: "We've sent a confirmation to your email.", continue: "Continue",
    wishlist: "Wishlist", nothingSaved: "You haven't saved anything yet.", remove: "Remove",
    store: "Shop", customerCare: "Customer Care", shipments: "Shipping", returns: "Returns", rights: "All rights reserved.",
    darkMode: "Dark Mode", lightMode: "Light Mode", currencyLabel: "Currency",
    reviews: "Reviews", writeReview: "Write a Review", reviewPlaceholder: "Tell us what you thought of this product...",
    submitReview: "Post Review", noReviews: "No reviews yet for this product.",
    mustPurchaseToReview: "Purchase this product to leave a review.", rating: "Rating",
    // checkout — new
    contactSection: "Contact", shippingSection: "Shipping", paymentSection: "Payment", notesSection: "Order notes",
    notesPlaceholder: "Add delivery instructions or special requests",
    selectCountry: "Select a country", stateProvince: "State / Province / Region",
    errRequired: "This field is required.", errEmail: "Enter a valid email.",
    errPhone: "Enter a valid phone number.", errCard: "That card number isn't valid.",
    errExpiry: "Invalid date (MM/YY).", errCvc: "Invalid CVC.",
    paymentNote: "You'll enter your card details on Stripe's secure page.",
    payWithCard: "Pay with Card", redirecting: "Redirecting to secure payment…",
    paymentError: "We couldn't start the payment. Please try again.",
    checkoutSuccessBanner: "Payment confirmed! Thanks for your purchase.",
    checkoutCancelledBanner: "Payment cancelled. Your bag is still here.",
    checkoutErrorBanner: "We couldn't confirm the payment. If you were charged, contact us.",
  },
};

/* --------------------------- garment croquis ---------------------------- */
const Croquis = ({ variant = "jacket", className = "" }) => {
  const paths = {
    jacket: <><path d="M100 40 L70 55 L55 80 L60 260 L85 275 L85 130 L92 130 L92 275 L108 275 L108 130 L92 130" /><path d="M100 40 L130 55 L145 80 L140 260 L115 275 L115 130" /><path d="M70 55 L100 75 L130 55" /><line x1="100" y1="75" x2="100" y2="270" strokeDasharray="2 6" /></>,
    denim: <><path d="M75 40 L60 90 L58 280 L82 285 L92 150 L100 150 L108 285 L132 280 L130 90 L115 40 Z" /><line x1="100" y1="40" x2="100" y2="150" strokeDasharray="2 6" /><path d="M75 40 L100 55 L125 40" /></>,
    knit: <><path d="M100 45 L65 60 L50 90 L65 105 L80 90 L80 270 L120 270 L120 90 L135 105 L150 90 L135 60 Z" /><path d="M80 90 L65 60 M120 90 L135 60" /><line x1="100" y1="100" x2="100" y2="260" strokeDasharray="1 10" /></>,
    boot: <><path d="M75 40 L75 160 L60 200 L60 260 L150 260 L150 225 L110 210 L100 160 L100 40 Z" /><line x1="75" y1="120" x2="100" y2="120" strokeDasharray="2 6" /></>,
    bag: <><rect x="55" y="110" width="90" height="140" rx="4" /><path d="M75 110 L75 75 A25 25 0 0 1 125 75 L125 110" /><line x1="55" y1="150" x2="145" y2="150" strokeDasharray="2 6" /></>,
    hat: <><path d="M60 140 A40 32 0 0 1 140 140" /><ellipse cx="100" cy="140" rx="55" ry="13" /></>,
    belt: <><rect x="45" y="120" width="110" height="26" rx="3" /><rect x="88" y="112" width="24" height="42" rx="3" /></>,
    dress: <><path d="M100 40 L75 60 L70 110 L45 270 L155 270 L130 110 L125 60 Z" /><path d="M75 60 L100 78 L125 60" /><line x1="100" y1="78" x2="100" y2="265" strokeDasharray="1 10" /></>,
  };
  return (
    <svg viewBox="0 0 200 320" className={className} fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round">
      {paths[variant] || paths.jacket}
    </svg>
  );
};

/* image plate: shows a real admin-uploaded image if present, else croquis */
const Plate = ({ product, tone = 0, className = "", imageIndex = 0, eager = false }) => {
  const tones = [
    "linear-gradient(160deg, var(--panel) 0%, var(--panel-2) 100%)",
    "linear-gradient(200deg, var(--panel-2) 0%, var(--panel) 100%)",
    "linear-gradient(135deg, var(--panel-3) 0%, var(--panel-2) 100%)",
  ];
  const img = product?.images?.[imageIndex] || product?.images?.[0];
  const resolvedSrc = useResolvedImageSrc(img);
  const [imgError, setImgError] = useState(false);
  useEffect(() => { setImgError(false); }, [resolvedSrc]);
  const showImg = !!resolvedSrc && !imgError;
  return (
    <div className={`ldm-plate ${className}`} style={{ background: tones[tone % tones.length] }}>
      {showImg ? (
        <img
          src={resolvedSrc} alt={product.name} className="ldm-plate-img" onError={() => setImgError(true)}
          loading={eager ? "eager" : "lazy"} decoding="async" fetchpriority={eager ? "high" : "auto"}
        />
      ) : (
        <Croquis variant={product?.variant || "jacket"} className="ldm-croquis" />
      )}
    </div>
  );
};

/* ------------------------------- reveal --------------------------------- */
const Reveal = ({ children, delay = 0, className = "" }) => {
  const ref = useRef(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && setShown(true)), { threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return <div ref={ref} className={`ldm-reveal ${shown ? "is-shown" : ""} ${className}`} style={{ transitionDelay: `${delay}ms` }}>{children}</div>;
};

/* ------------------------------- defaults -------------------------------- */
const DEFAULT_CATEGORIES = [
  { id: "men", label: "Men", subcategories: ["Zapatos", "Camisas", "Camisetas", "Pantalones", "Hoodies", "Chaquetas"] },
  { id: "women", label: "Women", subcategories: ["Vestidos", "Tops", "Pantalones", "Zapatos"] },
  { id: "accessories", label: "Accessories", subcategories: ["Gorras", "Cinturones", "Lentes"] },
  { id: "bags", label: "Bags", subcategories: [] },
  { id: "new-arrivals", label: "New Arrivals", subcategories: [] },
];

const DEFAULT_BRANDS = [
  { id: "ladoblem", label: "La Doble M" },
];

const genVariants = (sizes, colors, stock = 12) => {
  const out = [];
  sizes.forEach((s) => colors.forEach((c) => out.push({ id: `${s}-${c}`, size: s, color: c, stock })));
  return out;
};

const DEFAULT_PRODUCTS = [
  { id: "p1", brand: null, featured: true, name: "Star Panel Track Jacket", category: "men", subcategory: "Chaquetas", price: 480, variant: "jacket", tone: 0, images: [], visible: true, desc: "Color-blocked shell with hand-appliquéd star panels at the shoulder. Cut full, zips clean.", tags: ["trending", "new-season"], popularity: 92, variants: genVariants(["S", "M", "L", "XL"], ["Jet", "Bone"]) },
  { id: "p2", brand: null, featured: false, name: "Doble M Raw Denim", category: "men", subcategory: "Pantalones", price: 240, variant: "denim", tone: 1, images: [], visible: true, desc: "Heavyweight raw denim with a tonal Doble M stitched at the back pocket.", tags: ["bestseller"], popularity: 88, variants: genVariants(["28", "30", "32", "34", "36"], ["Indigo", "Jet"]) },
  { id: "p3", brand: null, featured: true, name: "Estrella Hoodie", category: "men", subcategory: "Hoodies", price: 220, variant: "knit", tone: 2, images: [], visible: true, desc: "Heavyweight fleece with an embroidered star at the chest and a dropped shoulder.", tags: ["trending", "bestseller"], popularity: 95, variants: genVariants(["S", "M", "L", "XL", "XXL"], ["Jet", "Ash"]) },
  { id: "p4", brand: null, featured: false, name: "Combat Sneaker Boot", category: "men", subcategory: "Zapatos", price: 340, variant: "boot", tone: 0, images: [], visible: true, desc: "Full-grain leather boot with a lugged sole and reflective star lace-lock.", tags: ["new-season"], popularity: 80, variants: genVariants(["40", "41", "42", "43", "44", "45"], ["Jet"]) },
  { id: "p5", brand: null, featured: false, name: "Ribbed Crewneck", category: "men", subcategory: "Camisas", price: 160, variant: "knit", tone: 1, images: [], visible: true, desc: "Fine-gauge ribbed cotton with a tonal Doble M woven at the hem.", tags: [], popularity: 60, variants: genVariants(["S", "M", "L", "XL"], ["Jet", "Bone", "Ash"]) },
  { id: "p6", brand: null, featured: true, name: "Crest Crossbody", category: "bags", subcategory: null, price: 260, variant: "bag", tone: 1, images: [], visible: true, desc: "Structured crossbody with the Doble M crest debossed at the flap.", tags: ["bestseller"], popularity: 85, variants: genVariants(["One Size"], ["Jet", "Grey"]) },
  { id: "p7", brand: null, featured: false, name: "Star Crest Cap", category: "accessories", subcategory: "Gorras", price: 95, variant: "hat", tone: 0, images: [], visible: true, desc: "Six-panel cap with a raised star crest at the front.", tags: ["new-season"], popularity: 70, variants: genVariants(["One Size"], ["Jet", "Bone"]) },
  { id: "p8", brand: null, featured: false, name: "Doble M Leather Belt", category: "accessories", subcategory: "Cinturones", price: 130, variant: "belt", tone: 2, images: [], visible: true, desc: "Full-grain leather belt with a brushed crest buckle.", tags: [], popularity: 55, variants: genVariants(["S", "M", "L"], ["Jet"]) },
  { id: "p9", brand: null, featured: true, name: "Slip Dress", category: "women", subcategory: "Vestidos", price: 310, variant: "dress", tone: 1, images: [], visible: true, desc: "Bias-cut slip dress in a fluid matte satin, finished with a star clasp at the strap.", tags: ["trending"], popularity: 90, variants: genVariants(["XS", "S", "M", "L"], ["Jet", "Bone"]) },
  { id: "p10", brand: null, featured: false, name: "Track Pant", category: "women", subcategory: "Pantalones", price: 230, variant: "denim", tone: 0, images: [], visible: true, desc: "Relaxed track pant with a tonal side stripe and elastic hem.", tags: ["new-season"], popularity: 65, variants: genVariants(["XS", "S", "M", "L", "XL"], ["Jet", "Ash"]) },
];

const fmtStock = (variants) => variants.reduce((s, v) => s + Number(v.stock || 0), 0);
// Customers never see the raw stock number (3 vs 900 shouldn't matter) — only
// a qualitative low-stock nudge when it's genuinely about to sell out.
const stockBadgeLabel = (stock) => {
  if (stock === 1) return "ÚLTIMA UNIDAD";
  if (stock === 2) return "ÚLTIMAS 2 UNIDADES";
  if (stock > 0 && stock <= 5) return "QUEDAN POCOS";
  return null;
};
const DEFAULT_TAGS = [
  { id: "trending", label: "Trending" },
  { id: "new-season", label: "New Season" },
  { id: "bestseller", label: "Best Sellers" },
];

/* ============================ TOP NAV ==================================== */
const TopNav = ({ onMenu, onCart, onWishlist, cartCount, wishCount, solid, onLogo, products, currency, openProduct, t, theme }) => {
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchRef = useRef(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return products.filter((p) => p.visible && p.name.toLowerCase().includes(q)).slice(0, 6);
  }, [query, products]);

  useEffect(() => {
    if (!searchOpen) return;
    const onClick = (e) => { if (searchRef.current && !searchRef.current.contains(e.target)) { setSearchOpen(false); setQuery(""); } };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [searchOpen]);

  return (
    <header className={`ldm-nav ${solid ? "ldm-nav--solid" : ""}`}>
      <div className="ldm-nav-left">
        <button className="ldm-nav-icon" onClick={onMenu} aria-label={t.menu}><Menu size={20} strokeWidth={1.4} /></button>
      </div>
      <button className="ldm-nav-logo" onClick={onLogo} aria-label="La Doble M — home">
        <LogoMark theme={theme} />
        <span>LA DOBLE M</span>
      </button>
      <div className="ldm-nav-right">
        <div className="ldm-nav-search" ref={searchRef}>
          <button className="ldm-nav-icon" onClick={() => setSearchOpen((v) => !v)} aria-label={t.search}>
            <Search size={18} strokeWidth={1.4} />
          </button>
          {searchOpen && (
            <div className="ldm-nav-search-panel">
              <input autoFocus placeholder={t.search} value={query} onChange={(e) => setQuery(e.target.value)} />
              {query.trim() && (
                <div className="ldm-nav-search-results">
                  {results.length === 0 ? (
                    <p className="ldm-drawer-results-empty">{t.noResults(query)}</p>
                  ) : (
                    results.map((p) => (
                      <button key={p.id} className="ldm-drawer-result" onClick={() => { setSearchOpen(false); setQuery(""); openProduct(p); }}>
                        <Plate product={p} tone={p.tone} className="ldm-drawer-result-plate" />
                        <span>
                          <strong>{p.name}</strong>
                          <em>{formatPrice(p.price, currency)}</em>
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </div>
        <button className="ldm-nav-icon" onClick={onWishlist} aria-label={t.wishlist}>
          <Star size={19} strokeWidth={1.4} />
          {wishCount > 0 && <span className="ldm-nav-badge">{wishCount}</span>}
        </button>
        <button className="ldm-nav-icon" onClick={onCart} aria-label={t.yourBag}>
          <ShoppingBag size={19} strokeWidth={1.4} />
          {cartCount > 0 && <span className="ldm-nav-badge">{cartCount}</span>}
        </button>
      </div>
    </header>
  );
};

/* =========================== SIDE MENU =================================== */
const SideMenu = ({ open, onClose, categories, brands, onNavigate, onNavigateBrand, currency, setCurrency, t, theme, onToggleTheme }) => {
  const [expanded, setExpanded] = useState(null);
  const [accountOpen, setAccountOpen] = useState(false);

  useEffect(() => { if (!open) { setAccountOpen(false); setExpanded(null); } }, [open]);

  return (
    <>
      <div className={`ldm-scrim ${open ? "is-open" : ""}`} onClick={onClose} />
      <aside className={`ldm-drawer ${open ? "is-open" : ""}`}>
        <div className="ldm-drawer-head">
          <span className="ldm-drawer-title">{t.menu}</span>
          <button className="ldm-nav-icon" onClick={onClose} aria-label="Close menu"><X size={19} strokeWidth={1.4} /></button>
        </div>

        <nav className="ldm-drawer-cats">
          {brands.length > 0 && (
            <div className="ldm-drawer-cat ldm-drawer-cat--brands">
              <button className="ldm-drawer-cat-head" onClick={() => setExpanded(expanded === "__brands" ? null : "__brands")}>
                <span>{t.brands}</span>
                <ChevronDown size={15} strokeWidth={1.4} className={`ldm-chev ${expanded === "__brands" ? "is-open" : ""}`} />
              </button>
              {expanded === "__brands" && (
                <div className="ldm-drawer-subs">
                  {brands.map((b) => (
                    <button key={b.id} className="ldm-drawer-sub" onClick={() => onNavigateBrand(b.id)}>
                      {b.label}{b.trending && <Flame size={12} strokeWidth={1.8} fill="currentColor" className="ldm-drawer-brand-flame" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {categories.map((cat) => (
            <div key={cat.id} className="ldm-drawer-cat">
              <button
                className="ldm-drawer-cat-head"
                onClick={() => {
                  if (cat.subcategories.length === 0) { onNavigate(cat.id, null); return; }
                  setExpanded(expanded === cat.id ? null : cat.id);
                }}
              >
                <span onClick={(e) => { if (cat.subcategories.length) { e.stopPropagation(); onNavigate(cat.id, null); } }}>{cat.label}</span>
                {cat.subcategories.length > 0 && (
                  <ChevronDown size={15} strokeWidth={1.4} className={`ldm-chev ${expanded === cat.id ? "is-open" : ""}`} />
                )}
              </button>
              {expanded === cat.id && cat.subcategories.length > 0 && (
                <div className="ldm-drawer-subs">
                  {cat.subcategories.map((s) => (
                    <button key={s} className="ldm-drawer-sub" onClick={() => onNavigate(cat.id, s)}>{s}</button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>

        <div className="ldm-drawer-foot">
          <div className="ldm-drawer-account-row">
            <button className="ldm-drawer-account" onClick={() => setAccountOpen((v) => !v)}>
              {t.account} <ChevronDown size={14} strokeWidth={1.4} className={`ldm-chev ${accountOpen ? "is-open" : ""}`} />
            </button>
            <button className="ldm-nav-icon" onClick={onToggleTheme} aria-label={theme === "light" ? t.darkMode : t.lightMode}>
              {theme === "light" ? <Moon size={18} strokeWidth={1.4} /> : <Sun size={18} strokeWidth={1.4} />}
            </button>
          </div>
          {accountOpen && <p className="ldm-drawer-account-note">{t.accountNote}</p>}

          {/* Currency — kept as the exact same state/logic as before (setCurrency),
              only the UI changed from a stacked button list to a compact dropdown. */}
          <label className="ldm-currency-block">
            <select className="ldm-currency-select" value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {Object.entries(CURRENCIES).map(([code, c]) => (
                <option key={code} value={code}>{c.label}</option>
              ))}
            </select>
          </label>
        </div>
      </aside>
    </>
  );
};

/* ============================ PRODUCT CARD ================================ */
const ProductCard = ({ product, currency, onOpen, tags, eager = false }) => {
  const [hovered, setHovered] = useState(false);
  const tagLabel = product.tags?.length > 0 ? (tags.find((tg) => tg.id === product.tags[0])?.label || product.tags[0]) : null;
  const stockLabel = stockBadgeLabel(fmtStock(product.variants));
  const hasSecondImage = (product.images || []).length > 1;
  return (
    <div
      className={`ldm-card ${hovered ? "is-hovered" : ""}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="ldm-card-media">
        <button className="ldm-card-media-btn" onClick={() => onOpen(product)}>
          <Plate product={product} tone={product.tone} className="ldm-card-plate" imageIndex={hovered && hasSecondImage ? 1 : 0} eager={eager} />
          {tagLabel && <span className="ldm-card-tag">{tagLabel}</span>}
          {stockLabel && <span className="ldm-card-stock-badge">{stockLabel}</span>}
        </button>
      </div>
      <button className="ldm-card-info" onClick={() => onOpen(product)}>
        <div>
          <p className="ldm-card-name">{product.name}</p>
          <p className="ldm-card-cat">{product.category}{product.subcategory ? ` / ${product.subcategory}` : ""}</p>
        </div>
        <p className="ldm-card-price">{formatPrice(product.price, currency)}</p>
      </button>
    </div>
  );
};

/* =============================== HOME ===================================== */
const BENEFITS = [
  { icon: Package, label: "Envíos a toda Latinoamérica" },
  { icon: ShieldCheck, label: "Pago 100% seguro con Stripe" },
  { icon: RotateCcw, label: "Cambios y devoluciones simples" },
];

const QUALITY_POINTS = [
  { icon: BadgeCheck, title: "100% Originales", text: "Cada pieza de marca que vendemos pasa por un proceso de verificación de autenticidad antes de publicarse." },
  { icon: Sparkles, title: "Inspección de calidad", text: "Revisamos costuras, materiales y terminaciones de cada producto antes de despacharlo." },
  { icon: ShieldCheck, title: "Empaque protegido", text: "Tu pedido viaja embalado con cuidado para que llegue en las mismas condiciones en que salió." },
];

const Home = ({ products, currency, setPage, openProduct, tags, t }) => {
  const visible = products.filter((p) => p.visible);
  const picked = visible.filter((p) => p.featured);
  const featured = (picked.length > 0 ? picked : visible).slice(0, 4);
  const newArrivals = visible.filter((p) => p.newArrival).slice(0, 4);
  const bestSellers = visible.filter((p) => (p.tags || []).includes("bestseller")).slice(0, 4);
  return (
    <>
      <section className="ldm-hero">
        <div className="ldm-hero-croquis"><Croquis variant="jacket" /></div>
        <div className="ldm-hero-content">
          <span className="ldm-eyebrow">{t.seasonEyebrow}</span>
          <h1 className="ldm-hero-title">{t.heroLine1}<br />{t.heroLine2}</h1>
          <button className="ldm-btn ldm-btn--solid" onClick={() => setPage("shop")}>{t.viewCollection}</button>
        </div>
      </section>

      <div className="ldm-benefits">
        {BENEFITS.map((b, i) => (
          <span key={i}><b.icon size={16} strokeWidth={1.6} /> {b.label}</span>
        ))}
      </div>

      <section className="ldm-section">
        <Reveal className="ldm-section-head">
          <span className="ldm-eyebrow">{t.curated}</span>
          <h2 className="ldm-h2">{t.thisSeason}</h2>
        </Reveal>
        <div className="ldm-grid">
          {featured.map((p, i) => (
            <Reveal key={p.id} delay={i * 80}>
              <ProductCard product={p} currency={currency} onOpen={openProduct} tags={tags} eager={i < 2} />
            </Reveal>
          ))}
        </div>
        <Reveal className="ldm-center-cta">
          <button className="ldm-btn ldm-btn--outline" onClick={() => setPage("shop")}>{t.viewFull}</button>
        </Reveal>
      </section>

      {newArrivals.length > 0 && (
        <section className="ldm-section ldm-section--tight">
          <Reveal className="ldm-section-head">
            <span className="ldm-eyebrow">Recién llegados</span>
            <h2 className="ldm-h2">New Arrivals</h2>
          </Reveal>
          <div className="ldm-grid">
            {newArrivals.map((p, i) => (
              <Reveal key={p.id} delay={i * 80}>
                <ProductCard product={p} currency={currency} onOpen={openProduct} tags={tags} />
              </Reveal>
            ))}
          </div>
        </section>
      )}

      {bestSellers.length > 0 && (
        <section className="ldm-section ldm-section--tight">
          <Reveal className="ldm-section-head">
            <span className="ldm-eyebrow">Lo más pedido</span>
            <h2 className="ldm-h2">Best Sellers</h2>
          </Reveal>
          <div className="ldm-grid">
            {bestSellers.map((p, i) => (
              <Reveal key={p.id} delay={i * 80}>
                <ProductCard product={p} currency={currency} onOpen={openProduct} tags={tags} />
              </Reveal>
            ))}
          </div>
        </section>
      )}

      <section className="ldm-section ldm-quality">
        <div className="ldm-quality-showcase">
          <Reveal className="ldm-quality-photos">
            <img src="/quality-1.jpg" alt="Producto de marca verificado" loading="lazy" decoding="async" />
            <img src="/quality-2.jpg" alt="Empaque original protegido" loading="lazy" decoding="async" />
          </Reveal>
          <Reveal className="ldm-quality-copy">
            <span className="ldm-eyebrow">Compromiso de Calidad</span>
            <h2 className="ldm-h2">Cada pieza, verificada</h2>
            <p>
              Trabajamos solo con piezas de marca originales, revisadas antes de despacharse y
              enviadas en su empaque de fábrica. LA DOBLE M no está afiliada ni asociada con
              ninguna de las marcas que comercializa.
            </p>
            <button className="ldm-btn ldm-btn--outline" onClick={() => setPage("shop")}>Ver la Colección</button>
          </Reveal>
        </div>
        <div className="ldm-quality-grid">
          {QUALITY_POINTS.map((q, i) => (
            <Reveal key={i} delay={i * 80} className="ldm-quality-card">
              <q.icon size={22} strokeWidth={1.4} />
              <h3>{q.title}</h3>
              <p>{q.text}</p>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="ldm-about">
        <Reveal className="ldm-about-inner">
          <span className="ldm-eyebrow">La Marca</span>
          <h2 className="ldm-h2">Diseño urbano, hecho para durar</h2>
          <p>
            LA DOBLE M nace de la intersección entre streetwear y sastrería: piezas con estructura,
            materiales pensados para el uso diario y detalles que se notan de cerca. Cada colección
            se diseña para acompañar, temporada tras temporada, sin perder identidad.
          </p>
        </Reveal>
      </section>
    </>
  );
};

/* =============================== SHOP (with filters) ======================= */
const SORT_OPTIONS = [
  { id: "newest", label: "Newest" },
  { id: "price-asc", label: "Precio: menor a mayor" },
  { id: "price-desc", label: "Precio: mayor a menor" },
  { id: "popular", label: "Más populares" },
];

const Shop = ({ products, currency, openProduct, tags, activeCategory, activeSub, activeBrand, categories, brands, t }) => {
  const [cat, setCat] = useState(activeCategory || "all");
  const [sub, setSub] = useState(activeSub || null);
  const [brand, setBrand] = useState(activeBrand || null);
  const [attrFilters, setAttrFilters] = useState({});
  const [inStockOnly, setInStockOnly] = useState(false);
  const [tag, setTag] = useState(null);
  const [sort, setSort] = useState("newest");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const visible = products.filter((p) => p.visible);
  const priceCeil = Math.max(...visible.map((p) => p.price), 100);
  const [maxPrice, setMaxPrice] = useState(priceCeil);

  useEffect(() => { setCat(activeCategory || "all"); setSub(activeSub || null); setBrand(activeBrand || null); }, [activeCategory, activeSub, activeBrand]);
  useEffect(() => { setMaxPrice(priceCeil); }, [priceCeil]);
  useEffect(() => { setAttrFilters({}); }, [cat]);

  const inCategory = visible.filter((p) => (cat === "all" || (cat === "new-arrivals" ? p.newArrival : p.category === cat)));
  const allAttrs = useMemo(() => {
    const map = new Map();
    inCategory.forEach((p) => (p.attributes || []).forEach((a) => {
      if (!map.has(a.id)) map.set(a.id, { id: a.id, name: a.name, values: new Set() });
      a.values.forEach((v) => map.get(a.id).values.add(v));
    }));
    return [...map.values()].map((a) => ({ ...a, values: [...a.values] }));
  }, [inCategory]);
  const currentCat = categories.find((c) => c.id === cat);

  let items = inCategory.filter((p) =>
    (!sub || p.subcategory === sub) &&
    (!brand || p.brand === brand) &&
    Object.entries(attrFilters).every(([attrId, val]) => !val || p.variants.some((v) => v.values?.[attrId] === val && Number(v.stock) > 0)) &&
    p.price <= maxPrice &&
    (!inStockOnly || fmtStock(p.variants) > 0) &&
    (!tag || (p.tags || []).includes(tag))
  );

  if (sort === "price-asc") items = [...items].sort((a, b) => a.price - b.price);
  else if (sort === "price-desc") items = [...items].sort((a, b) => b.price - a.price);
  else if (sort === "popular") items = [...items].sort((a, b) => (b.popularity || 0) - (a.popularity || 0));

  const resetFilters = () => { setAttrFilters({}); setBrand(null); setInStockOnly(false); setTag(null); setMaxPrice(priceCeil); setSort("newest"); };

  return (
    <section className="ldm-section ldm-shop">
      <Reveal className="ldm-shop-head">
        <span className="ldm-eyebrow">{t.collection}</span>
        <h1 className="ldm-h1">{currentCat ? currentCat.label : t.allProducts}{sub ? ` — ${sub}` : ""}</h1>
      </Reveal>

      <Reveal className="ldm-filters">
        <button className={`ldm-chip ${cat === "all" ? "is-active" : ""}`} onClick={() => { setCat("all"); setSub(null); }}>{t.all}</button>
        {categories.map((c) => (
          <button key={c.id} className={`ldm-chip ${cat === c.id ? "is-active" : ""}`} onClick={() => { setCat(c.id); setSub(null); }}>{c.label}</button>
        ))}
        <button className="ldm-chip ldm-chip--filters" onClick={() => setFiltersOpen((v) => !v)}>
          <SlidersHorizontal size={13} strokeWidth={1.6} /> {t.filters}
        </button>
        <span className="ldm-filter-count">{items.length} {t.pieces}</span>
      </Reveal>

      {currentCat?.subcategories?.length > 0 && (
        <Reveal className="ldm-filters ldm-filters--subs">
          <button className={`ldm-chip ldm-chip--sm ${!sub ? "is-active" : ""}`} onClick={() => setSub(null)}>{t.all_f}</button>
          {currentCat.subcategories.map((s) => (
            <button key={s} className={`ldm-chip ldm-chip--sm ${sub === s ? "is-active" : ""}`} onClick={() => setSub(s)}>{s}</button>
          ))}
        </Reveal>
      )}

      {filtersOpen && (
        <Reveal className="ldm-filter-panel">
          {brands.length > 0 && (
            <div className="ldm-filter-panel-row">
              <span className="ldm-variant-label">{t.brands}</span>
              <div className="ldm-chip-row">
                {brands.map((b) => (
                  <button key={b.id} className={`ldm-chip ldm-chip--sm ${brand === b.id ? "is-active" : ""}`} onClick={() => setBrand(brand === b.id ? null : b.id)}>{b.label}</button>
                ))}
              </div>
            </div>
          )}

          <div className="ldm-filter-panel-row">
            <span className="ldm-variant-label">{t.trend}</span>
            <div className="ldm-chip-row">
              {tags.map((tg) => (
                <button key={tg.id} className={`ldm-chip ldm-chip--sm ${tag === tg.id ? "is-active" : ""}`} onClick={() => setTag(tag === tg.id ? null : tg.id)}>{tg.label}</button>
              ))}
            </div>
          </div>

          {allAttrs.map((attr) => (
            <div className="ldm-filter-panel-row" key={attr.id}>
              <span className="ldm-variant-label">{attr.name}</span>
              <div className="ldm-chip-row">
                {attr.values.map((val) => (
                  <button
                    key={val}
                    className={`ldm-chip ldm-chip--sm ${attrFilters[attr.id] === val ? "is-active" : ""}`}
                    onClick={() => setAttrFilters((f) => ({ ...f, [attr.id]: f[attr.id] === val ? null : val }))}
                  >{val}</button>
                ))}
              </div>
            </div>
          ))}

          <div className="ldm-filter-panel-row">
            <span className="ldm-variant-label">{t.maxPrice} — {formatPrice(maxPrice, currency)}</span>
            <input type="range" min="0" max={priceCeil} value={maxPrice} onChange={(e) => setMaxPrice(Number(e.target.value))} className="ldm-price-slider" />
          </div>

          <div className="ldm-filter-panel-row ldm-filter-panel-row--inline">
            <label className="ldm-admin-field--checkbox ldm-stock-check">
              <input type="checkbox" checked={inStockOnly} onChange={(e) => setInStockOnly(e.target.checked)} /> {t.inStockOnly}
            </label>
            <label className="ldm-sort-select">
              <span>{t.sort}</span>
              <select value={sort} onChange={(e) => setSort(e.target.value)}>
                {SORT_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            </label>
          </div>

          <button className="ldm-text-link ldm-filter-reset" onClick={resetFilters}>{t.clearFilters}</button>
        </Reveal>
      )}

      <div className="ldm-grid">
        {items.map((p, i) => (
          <Reveal key={p.id} delay={(i % 6) * 60}>
            <ProductCard product={p} currency={currency} onOpen={openProduct} tags={tags} />
          </Reveal>
        ))}
        {items.length === 0 && <p className="ldm-empty-note">{t.noneYet}</p>}
      </div>
    </section>
  );
};

/* ============================= PRODUCT PAGE ================================ */
const ReviewsSection = ({ product, canReview, t }) => {
  const [reviews, setReviews, ready] = useStoredState(`ldm-reviews-${product.id}`, [], true);
  const [rating, setRating] = useState(5);
  const [text, setText] = useState("");
  const [hoverRating, setHoverRating] = useState(0);

  const submit = () => {
    if (!text.trim()) return;
    setReviews((r) => [...r, { id: `rv${Date.now()}`, rating, text: text.trim(), date: new Date().toISOString() }]);
    setText("");
    setRating(5);
  };

  return (
    <div className="ldm-reviews">
      <h3 className="ldm-reviews-title">{t.reviews} {reviews.length > 0 ? `(${reviews.length})` : ""}</h3>

      {ready && reviews.length === 0 && <p className="ldm-empty-note">{t.noReviews}</p>}

      {ready && reviews.length > 0 && (
        <div className="ldm-reviews-list">
          {reviews.map((r) => (
            <div className="ldm-review-item" key={r.id}>
              <div className="ldm-review-stars">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} size={13} strokeWidth={1.4} fill={i < r.rating ? "currentColor" : "none"} />
                ))}
              </div>
              <p className="ldm-review-text">{r.text}</p>
            </div>
          ))}
        </div>
      )}

      {canReview ? (
        <div className="ldm-review-form">
          <span className="ldm-variant-label">{t.writeReview}</span>
          <div className="ldm-review-stars ldm-review-stars--input">
            {Array.from({ length: 5 }).map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setRating(i + 1)}
                onMouseEnter={() => setHoverRating(i + 1)}
                onMouseLeave={() => setHoverRating(0)}
                aria-label={`${i + 1} ${t.rating}`}
              >
                <Star size={17} strokeWidth={1.4} fill={i < (hoverRating || rating) ? "currentColor" : "none"} />
              </button>
            ))}
          </div>
          <textarea rows={3} placeholder={t.reviewPlaceholder} value={text} onChange={(e) => setText(e.target.value)} />
          <button className="ldm-btn ldm-btn--outline" onClick={submit} disabled={!text.trim()}>{t.submitReview}</button>
        </div>
      ) : (
        <p className="ldm-review-locked">{t.mustPurchaseToReview}</p>
      )}
    </div>
  );
};

const ProductPage = ({ product, currency, addToCart, wishlist, toggleWish, t, purchasedIds }) => {
  const attributes = product.attributes || [];
  const [selected, setSelected] = useState({});
  const [qty, setQty] = useState(1);
  const [toast, setToast] = useState(false);

  useEffect(() => {
    const init = {};
    attributes.forEach((a) => { if (!a.required && a.values.length) init[a.id] = a.values[0]; });
    setSelected(init);
    setQty(1);
    // eslint-disable-next-line
  }, [product]);

  const allChosen = attributes.every((a) => selected[a.id]);
  const activeVariant = attributes.length && allChosen
    ? product.variants.find((v) => attributes.every((a) => v.values?.[a.id] === selected[a.id]))
    : (attributes.length === 0 ? product.variants[0] : null);
  const stock = activeVariant ? Number(activeVariant.stock) : 0;
  const missingRequired = attributes.some((a) => a.required && !selected[a.id]);
  const canAdd = !missingRequired && allChosen && stock > 0;
  const inWish = wishlist.includes(product.id);

  const handleAdd = () => {
    if (!canAdd) return;
    addToCart({ ...product, selected, qty: Math.min(qty, stock) });
    setToast(true);
    setTimeout(() => setToast(false), 2000);
  };

  return (
    <section className="ldm-product">
      <div className="ldm-product-gallery">
        <Plate product={product} tone={product.tone} className="ldm-product-plate" eager />
        <button className={`ldm-wish-btn ldm-wish-btn--overlay ${inWish ? "is-active" : ""}`} onClick={() => toggleWish(product.id)} aria-label="Toggle favorite">
          <Star size={18} strokeWidth={1.4} fill={inWish ? "currentColor" : "none"} />
        </button>
      </div>
      <div className="ldm-product-info">
        <span className="ldm-eyebrow">{product.category}{product.subcategory ? ` / ${product.subcategory}` : ""}</span>
        <h1 className="ldm-h1 ldm-product-title">{product.name}</h1>
        <p className="ldm-product-price">{formatPrice(product.price, currency)}</p>

        {attributes.map((attr) => (
          <div className="ldm-variant-block" key={attr.id}>
            <span className="ldm-variant-label">{attr.name}{selected[attr.id] ? ` — ${selected[attr.id]}` : ""}{attr.required ? " *" : ""}</span>
            <div className="ldm-chip-row">
              {attr.values.map((val) => {
                const wouldMatch = { ...selected, [attr.id]: val };
                const anyStock = attributes.every((a) => wouldMatch[a.id]) &&
                  product.variants.some((v) => attributes.every((a) => v.values?.[a.id] === wouldMatch[a.id]) && Number(v.stock) > 0);
                const out = attributes.every((a) => wouldMatch[a.id]) && !anyStock;
                return (
                  <button
                    key={val}
                    disabled={out}
                    className={`ldm-chip ldm-chip--sm ${selected[attr.id] === val ? "is-active" : ""} ${out ? "is-disabled" : ""}`}
                    onClick={() => setSelected((s) => ({ ...s, [attr.id]: val }))}
                  >{val}</button>
                );
              })}
            </div>
            {attr.required && !selected[attr.id] && <span className="ldm-size-warn">Selecciona {attr.name.toLowerCase()}</span>}
          </div>
        ))}

        {allChosen && stockBadgeLabel(stock) && <span className="ldm-size-warn ldm-size-warn--low">{stockBadgeLabel(stock)}</span>}

        <div className="ldm-variant-block ldm-qty-row">
          <span className="ldm-variant-label">{t.qty}</span>
          <div className="ldm-qty-stepper">
            <button onClick={() => setQty((q) => Math.max(1, q - 1))}><Minus size={13} strokeWidth={1.4} /></button>
            <span>{qty}</span>
            <button onClick={() => setQty((q) => Math.min(stock || 1, q + 1))}><Plus size={13} strokeWidth={1.4} /></button>
          </div>
        </div>

        <button
          className={`ldm-btn ldm-btn--solid ldm-add-btn ${!canAdd ? "is-disabled" : ""}`}
          onClick={handleAdd}
          disabled={!canAdd}
        >
          {missingRequired ? t.selectSizeBtn : stock <= 0 ? t.outOfStock : t.addToBag}
        </button>

        <p className="ldm-product-desc">{product.desc}</p>

        <ReviewsSection product={product} canReview={purchasedIds.includes(product.id)} t={t} />
      </div>
      {toast && <div className="ldm-toast"><Check size={14} strokeWidth={1.6} /> {t.added}</div>}
    </section>
  );
};

/* =============================== BAG DRAWER ================================ */
const BagDrawer = ({ open, onClose, cart, currency, updateQty, removeItem, setPage, t }) => {
  const [step, setStep] = useState("bag");
  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  useEffect(() => { if (open) setStep("bag"); }, [open]);

  return (
    <>
      <div className={`ldm-scrim ${open ? "is-open" : ""}`} onClick={onClose} />
      <aside className={`ldm-panel ${open ? "is-open" : ""}`}>
        <div className="ldm-panel-head">
          <h2>{step === "bag" ? t.yourBag : t.checkout}</h2>
          <button className="ldm-nav-icon" onClick={onClose}><X size={18} strokeWidth={1.4} /></button>
        </div>
        {cart.length === 0 ? (
          <div className="ldm-panel-empty">
            <p>{t.emptyBag}</p>
            <button className="ldm-btn ldm-btn--outline" onClick={() => { onClose(); setPage("shop"); }}>{t.viewCollection}</button>
          </div>
        ) : step === "bag" ? (
          <>
            <div className="ldm-panel-items">
              {cart.map((item, idx) => (
                <div className="ldm-panel-item" key={idx}>
                  <Plate product={item} tone={item.tone} className="ldm-panel-item-plate" />
                  <div className="ldm-panel-item-info">
                    <p className="ldm-panel-item-name">{item.name}</p>
                    <p className="ldm-panel-item-meta">{(item.attributes || []).map((a) => item.selected?.[a.id]).filter(Boolean).join(" — ")}</p>
                    <div className="ldm-qty-stepper ldm-qty-stepper--sm">
                      <button onClick={() => updateQty(idx, Math.max(1, item.qty - 1))}><Minus size={11} strokeWidth={1.4} /></button>
                      <span>{item.qty}</span>
                      <button onClick={() => updateQty(idx, item.qty + 1)}><Plus size={11} strokeWidth={1.4} /></button>
                    </div>
                  </div>
                  <div className="ldm-panel-item-right">
                    <p>{formatPrice(item.price * item.qty, currency)}</p>
                    <button className="ldm-remove-link" onClick={() => removeItem(idx)}>{t.remove}</button>
                  </div>
                </div>
              ))}
            </div>
            <div className="ldm-panel-summary">
              <div className="ldm-summary-row"><span>{t.subtotal}</span><span>{formatPrice(subtotal, currency)}</span></div>
              <div className="ldm-summary-row ldm-summary-row--muted"><span>{t.shipping}</span><span>{t.free}</span></div>
              <button className="ldm-btn ldm-btn--solid ldm-full" onClick={() => setStep("checkout")}>{t.checkout} — {formatPrice(subtotal, currency)}</button>
            </div>
          </>
        ) : (
          <CheckoutStep subtotal={subtotal} currency={currency} cart={cart} onBack={() => setStep("bag")} onClose={onClose} t={t} />
        )}
      </aside>
    </>
  );
};

/* ------------------------------ CHECKOUT ------------------------------------
   Smart, self-validating checkout:
   - Country dropdown auto-fills the phone dial code and swaps the address
     subdivision field to the right label (Región/Provincia/Departamento/Estado),
     rendering it as a dropdown when we have a curated list for that country.
   - Phone, card number, and expiry all live-format as the person types.
   - Inline, real-time validation; the confirm button disables while any
     field is invalid.
   ------------------------------------------------------------------------- */
const CheckoutStep = ({ subtotal, currency, cart, onBack, onClose, t }) => {
  const [form, setForm] = useState({
    email: "", fullName: "", countryCode: "", phoneNational: "",
    address: "", address2: "", city: "", subdivision: "", zip: "",
    notes: "",
  });
  const [touched, setTouched] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [payError, setPayError] = useState("");

  const phoneRef = useRef(null);

  const countryData = COUNTRIES.find((c) => c.code === form.countryCode) || null;

  const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const markTouched = (key) => setTouched((tt) => ({ ...tt, [key]: true }));
  const errAt = (key) => touched[key] ? errors[key] : null;

  const errors = useMemo(() => validateCheckout(form, t), [form, t]);
  const hasErrors = Object.keys(errors).length > 0;

  const handleCountryChange = (e) => {
    const code = e.target.value;
    setForm((f) => ({ ...f, countryCode: code, subdivision: "" }));
    markTouched("countryCode");
    if (code) setTimeout(() => phoneRef.current?.focus(), 60);
  };

  const handlePhoneChange = (e) => setField("phoneNational", onlyDigits(e.target.value));

  // Sends the cart + customer/shipping info to our serverless function,
  // which verifies prices/stock server-side and creates a Stripe Checkout
  // Session. We never collect card details ourselves — Stripe's hosted page
  // does, which keeps this app out of PCI-compliance scope entirely.
  const confirm = async () => {
    setTouched({
      email: true, fullName: true, countryCode: true, phoneNational: true,
      address: true, city: true, subdivision: true, zip: true,
    });
    if (hasErrors || submitting) return;

    setPayError("");
    setSubmitting(true);
    try {
      const customer = {
        fullName: form.fullName.trim() || "Cliente sin nombre",
        email: form.email.trim(),
        phone: `${countryData?.dial || ""} ${formatNationalPhone(form.phoneNational, countryData?.phonePattern)}`.trim(),
      };
      const shipping = {
        address: form.address.trim(),
        address2: form.address2.trim(),
        city: form.city.trim(),
        subdivision: form.subdivision.trim(),
        zip: form.zip.trim(),
        country: countryData?.name || form.countryCode,
      };
      const res = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cart: cart.map((i) => ({ id: i.id, name: i.name, size: i.size, color: i.color, qty: i.qty })),
          currency,
          customer,
          shipping,
          notes: form.notes.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) throw new Error(data.error || "checkout session failed");
      window.location.href = data.url; // redirect to Stripe's hosted checkout
    } catch (e) {
      setPayError(t.paymentError);
      setSubmitting(false);
    }
  };

  return (
    <div className="ldm-checkout">
      <button className="ldm-text-link" onClick={onBack}><ArrowLeft size={14} strokeWidth={1.4} /> {t.back}</button>

      <div className="ldm-checkout-form">
        <span className="ldm-checkout-section-label">{t.contactSection}</span>

        <div className="ldm-field-group">
          <input
            placeholder={t.email} value={form.email} type="email"
            onChange={(e) => setField("email", e.target.value)} onBlur={() => markTouched("email")}
            className={errAt("email") ? "has-error" : ""}
          />
          {errAt("email") && <span className="ldm-field-error"><AlertCircle size={11} strokeWidth={1.8} /> {errAt("email")}</span>}
        </div>

        <div className="ldm-field-group">
          <input
            placeholder={t.fullName} value={form.fullName}
            onChange={(e) => setField("fullName", e.target.value)} onBlur={() => markTouched("fullName")}
            className={errAt("fullName") ? "has-error" : ""}
          />
          {errAt("fullName") && <span className="ldm-field-error"><AlertCircle size={11} strokeWidth={1.8} /> {errAt("fullName")}</span>}
        </div>

        <span className="ldm-checkout-section-label">{t.shippingSection}</span>

        <div className="ldm-field-group">
          <select
            value={form.countryCode} onChange={handleCountryChange} onBlur={() => markTouched("countryCode")}
            className={errAt("countryCode") ? "has-error" : ""}
          >
            <option value="">{t.selectCountry}</option>
            {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
          </select>
          {errAt("countryCode") && <span className="ldm-field-error"><AlertCircle size={11} strokeWidth={1.8} /> {errAt("countryCode")}</span>}
        </div>

        <div className="ldm-field-group">
          <div className={`ldm-phone-row ${errAt("phoneNational") ? "has-error" : ""}`}>
            <span className="ldm-phone-dial">{countryData ? countryData.dial : "+__"}</span>
            <input
              ref={phoneRef} type="tel" inputMode="numeric" placeholder={t.phone}
              value={formatNationalPhone(form.phoneNational, countryData?.phonePattern)}
              onChange={handlePhoneChange} onBlur={() => markTouched("phoneNational")}
              disabled={!countryData}
            />
          </div>
          {errAt("phoneNational") && <span className="ldm-field-error"><AlertCircle size={11} strokeWidth={1.8} /> {errAt("phoneNational")}</span>}
        </div>

        <div className="ldm-field-group">
          <input
            placeholder={t.address} value={form.address}
            onChange={(e) => setField("address", e.target.value)} onBlur={() => markTouched("address")}
            className={errAt("address") ? "has-error" : ""}
          />
          {errAt("address") && <span className="ldm-field-error"><AlertCircle size={11} strokeWidth={1.8} /> {errAt("address")}</span>}
        </div>

        <div className="ldm-field-group">
          <input placeholder={t.address2} value={form.address2} onChange={(e) => setField("address2", e.target.value)} />
        </div>

        <div className="ldm-checkout-grid">
          <div className="ldm-field-group">
            <input
              placeholder={t.city} value={form.city}
              onChange={(e) => setField("city", e.target.value)} onBlur={() => markTouched("city")}
              className={errAt("city") ? "has-error" : ""}
            />
            {errAt("city") && <span className="ldm-field-error"><AlertCircle size={11} strokeWidth={1.8} /> {errAt("city")}</span>}
          </div>

          <div className="ldm-field-group">
            {countryData?.subdivisions ? (
              <select
                value={form.subdivision} onChange={(e) => setField("subdivision", e.target.value)} onBlur={() => markTouched("subdivision")}
                className={errAt("subdivision") ? "has-error" : ""}
              >
                <option value="">{countryData.subdivisionLabel}</option>
                {countryData.subdivisions.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            ) : (
              <input
                placeholder={countryData ? countryData.subdivisionLabel : t.stateProvince} value={form.subdivision}
                onChange={(e) => setField("subdivision", e.target.value)} onBlur={() => markTouched("subdivision")}
                className={errAt("subdivision") ? "has-error" : ""}
              />
            )}
            {errAt("subdivision") && <span className="ldm-field-error"><AlertCircle size={11} strokeWidth={1.8} /> {errAt("subdivision")}</span>}
          </div>
        </div>

        <div className="ldm-field-group">
          <input
            placeholder={t.zip} value={form.zip}
            onChange={(e) => setField("zip", e.target.value)} onBlur={() => markTouched("zip")}
            className={errAt("zip") ? "has-error" : ""}
          />
          {errAt("zip") && <span className="ldm-field-error"><AlertCircle size={11} strokeWidth={1.8} /> {errAt("zip")}</span>}
        </div>

        <span className="ldm-checkout-section-label">{t.paymentSection}</span>
        <p className="ldm-payment-note"><CreditCard size={14} strokeWidth={1.6} /> {t.paymentNote}</p>

        <span className="ldm-checkout-section-label">{t.notesSection}</span>
        <div className="ldm-field-group">
          <textarea rows={3} placeholder={t.notesPlaceholder} value={form.notes} onChange={(e) => setField("notes", e.target.value)} />
        </div>
      </div>

      <div className="ldm-panel-summary">
        <div className="ldm-summary-row"><span>{t.total}</span><span>{formatPrice(subtotal, currency)}</span></div>
        {payError && <p className="ldm-field-error ldm-checkout-pay-error"><AlertCircle size={11} strokeWidth={1.8} /> {payError}</p>}
        <button
          className={`ldm-btn ldm-btn--solid ldm-full ${(hasErrors || submitting) ? "is-disabled" : ""}`}
          onClick={confirm}
          disabled={hasErrors || submitting}
        >
          {submitting ? t.redirecting : `${t.payWithCard} — ${formatPrice(subtotal, currency)}`}
        </button>
      </div>
    </div>
  );
};

/* ============================ WISHLIST DRAWER =============================== */
const WishlistDrawer = ({ open, onClose, products, wishlist, currency, toggleWish, openProduct, t }) => {
  const items = products.filter((p) => wishlist.includes(p.id));
  return (
    <>
      <div className={`ldm-scrim ${open ? "is-open" : ""}`} onClick={onClose} />
      <aside className={`ldm-panel ${open ? "is-open" : ""}`}>
        <div className="ldm-panel-head">
          <h2>{t.wishlist}</h2>
          <button className="ldm-nav-icon" onClick={onClose}><X size={18} strokeWidth={1.4} /></button>
        </div>
        {items.length === 0 ? (
          <div className="ldm-panel-empty"><p>{t.nothingSaved}</p></div>
        ) : (
          <div className="ldm-panel-items">
            {items.map((p) => (
              <div className="ldm-panel-item" key={p.id}>
                <button onClick={() => { onClose(); openProduct(p); }} className="ldm-panel-item-plate-btn">
                  <Plate product={p} tone={p.tone} className="ldm-panel-item-plate" />
                </button>
                <div className="ldm-panel-item-info">
                  <p className="ldm-panel-item-name">{p.name}</p>
                  <p className="ldm-panel-item-meta">{formatPrice(p.price, currency)}</p>
                </div>
                <div className="ldm-panel-item-right">
                  <button className="ldm-remove-link" onClick={() => toggleWish(p.id)}>{t.remove}</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </aside>
    </>
  );
};

/* ================================ FOOTER ==================================== */
const POLICY_CONTENT = {
  shipping: {
    title: "Envíos",
    body: [
      "Despachamos a Chile, Argentina, Uruguay, México, Estados Unidos y Canadá.",
      "Los tiempos de entrega y costos se calculan según el destino al finalizar la compra.",
      "Vas a recibir un correo con el número de seguimiento apenas tu pedido sea despachado.",
    ],
  },
  returns: {
    title: "Devoluciones",
    body: [
      "Si tu pedido no te convence, escribinos dentro de los primeros 14 días desde que lo recibiste.",
      "El producto debe estar sin uso, con sus etiquetas originales y en su empaque.",
      "Una vez recibida la devolución, procesamos el reembolso o cambio a la brevedad.",
    ],
  },
};

const PolicyModal = ({ policyKey, onClose }) => {
  const policy = POLICY_CONTENT[policyKey];
  if (!policy) return null;
  return (
    <div className="ldm-policy-overlay" onClick={onClose}>
      <div className="ldm-policy-card" onClick={(e) => e.stopPropagation()}>
        <div className="ldm-panel-head">
          <h2>{policy.title}</h2>
          <button className="ldm-nav-icon" onClick={onClose}><X size={18} strokeWidth={1.4} /></button>
        </div>
        {policy.body.map((p, i) => <p key={i} className="ldm-policy-text">{p}</p>)}
      </div>
    </div>
  );
};

const Footer = ({ setPage, t, theme }) => {
  const [policyOpen, setPolicyOpen] = useState(null);
  return (
    <footer className="ldm-footer">
      <div className="ldm-footer-top">
        <button className="ldm-logo-mark" onClick={() => setPage("home")}><LogoMark size="ldm-logomark--lg" theme={theme} /><span>LA DOBLE M</span></button>
        <div className="ldm-footer-cols">
          <div><span className="ldm-eyebrow">{t.store}</span><button onClick={() => setPage("shop")}>{t.collection}</button></div>
          <div>
            <span className="ldm-eyebrow">{t.customerCare}</span>
            <button onClick={() => setPolicyOpen("shipping")}>{t.shipments}</button>
            <button onClick={() => setPolicyOpen("returns")}>{t.returns}</button>
          </div>
        </div>
      </div>
      <div className="ldm-footer-trust">
        <span><ShieldCheck size={14} strokeWidth={1.6} /> Pago seguro con Stripe</span>
        <span><Package size={14} strokeWidth={1.6} /> Envíos a toda Latinoamérica</span>
        <span><RotateCcw size={14} strokeWidth={1.6} /> Cambios y devoluciones simples</span>
      </div>
      <div className="ldm-footer-bottom">
        <span>© {new Date().getFullYear()} LA DOBLE M. {t.rights}</span>
        <button className="ldm-footer-admin-link" onClick={() => setPage("admin")}>admin</button>
      </div>
      {policyOpen && <PolicyModal policyKey={policyOpen} onClose={() => setPolicyOpen(null)} />}
    </footer>
  );
};

/* ============================================================================
   ADMIN CMS
   ============================================================================ */
// Credentials are verified server-side (api/admin-login.js) against env vars —
// nothing secret ships in this bundle, unlike the old client-side check.
const AdminLogin = ({ onSuccess, onExit, theme }) => {
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (loading) return;
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/admin-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user: user.trim(), pass }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.token) { setError("Credenciales inválidas."); return; }
      onSuccess(data.token);
    } catch (e) {
      setError("No pudimos conectar con el servidor. Intentá de nuevo.");
    } finally {
      setLoading(false);
    }
  };
  const handleKeyDown = (e) => { if (e.key === "Enter") submit(); };
  return (
    <div className="ldm-admin-login">
      <div className="ldm-admin-login-card">
        <div className="ldm-logo-mark"><LogoMark size="ldm-logomark--lg" theme={theme} /><span>LA DOBLE M</span></div>
        <h1>Admin Login</h1>
        <label>Usuario<input value={user} onChange={(e) => setUser(e.target.value)} onKeyDown={handleKeyDown} autoFocus /></label>
        <label>
          Contraseña
          <div className="ldm-pass-row">
            <input type={showPass ? "text" : "password"} value={pass} onChange={(e) => setPass(e.target.value)} onKeyDown={handleKeyDown} />
            <button type="button" onClick={() => setShowPass((v) => !v)}>{showPass ? <EyeOff size={15} strokeWidth={1.4} /> : <Eye size={15} strokeWidth={1.4} />}</button>
          </div>
        </label>
        {error && <p className="ldm-admin-error">{error}</p>}
        <button className="ldm-btn ldm-btn--solid ldm-full" type="button" onClick={submit} disabled={loading}><Lock size={13} strokeWidth={1.6} /> {loading ? "Verificando…" : "Ingresar"}</button>
        <button type="button" className="ldm-text-link" onClick={onExit}><ArrowLeft size={14} strokeWidth={1.4} /> Volver a la tienda</button>
      </div>
    </div>
  );
};

const emptyProduct = (categories, brands) => ({
  id: `p${Date.now()}`,
  name: "",
  category: categories[0]?.id || "",
  subcategory: null,
  brand: brands?.[0]?.id || null,
  featured: false,
  price: 0,
  variant: "jacket",
  tone: 0,
  images: [],
  visible: false,
  newArrival: true,
  desc: "",
  tags: [],
  popularity: 50,
  attributes: [],
  variants: [],
});

// Cartesian product of an attribute list's values, e.g. [{id:'color',values:['Azul','Rojo']}]
// -> [{color:'Azul'}, {color:'Rojo'}]. Used to auto-generate the stock grid.
function cartesianCombos(attributes) {
  if (!attributes || attributes.length === 0) return [];
  return attributes.reduce((acc, attr) => {
    const vals = attr.values.length ? attr.values : [""];
    const next = [];
    acc.forEach((combo) => vals.forEach((v) => next.push({ ...combo, [attr.id]: v })));
    return next;
  }, [{}]);
}
const comboKey = (values) => Object.keys(values).sort().map((k) => `${k}:${values[k]}`).join("|");

// Reads legacy { size, color, stock } variants (from data saved before the
// custom-attributes feature) and synthesizes an equivalent attributes/variants
// shape, so old catalog data keeps working without a manual migration.
function normalizeProduct(p) {
  if (p.attributes) return { newArrival: false, ...p };
  const variants = p.variants || [];
  const sizes = [...new Set(variants.map((v) => v.size).filter(Boolean))];
  const colors = [...new Set(variants.map((v) => v.color).filter(Boolean))];
  const attributes = [];
  if (sizes.length) attributes.push({ id: "size", name: "Talla", required: true, values: sizes });
  if (colors.length) attributes.push({ id: "color", name: "Color", required: true, values: colors });
  const newVariants = variants.map((v) => ({
    id: v.id,
    stock: v.stock,
    values: { ...(sizes.length ? { size: v.size } : {}), ...(colors.length ? { color: v.color } : {}) },
  }));
  return { newArrival: false, ...p, attributes, variants: newVariants };
}

const VARIANT_ICONS = ["jacket", "denim", "knit", "boot", "bag", "hat", "belt", "dress"];

/* small preview tile used inside the admin product form's image list */
const AdminImageThumb = ({ image, onRemove }) => {
  const src = useResolvedImageSrc(image);
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [src]);
  return (
    <div className="ldm-admin-image">
      {src && !failed ? (
        <img src={src} alt="" onError={() => setFailed(true)} loading="lazy" decoding="async" />
      ) : (
        <div className="ldm-admin-image-placeholder">
          {failed ? "No se pudo cargar" : image.stored ? "Cargando…" : "Sin vista previa"}
        </div>
      )}
      <button onClick={onRemove} aria-label="Eliminar imagen"><Trash2 size={13} strokeWidth={1.4} /></button>
    </div>
  );
};

const ProductForm = ({ product, categories, brands, tags, onSave, onCancel }) => {
  const [draft, setDraft] = useState(product);
  const fileInputRef = useRef(null);
  const cat = categories.find((c) => c.id === draft.category);

  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const toggleTag = (tag) => setDraft((d) => ({ ...d, tags: (d.tags || []).includes(tag) ? d.tags.filter((t) => t !== tag) : [...(d.tags || []), tag] }));

  // --- custom attributes (talla, color, o lo que el admin quiera) ---
  const attributes = draft.attributes || [];
  const setAttributes = (next) => setDraft((d) => ({ ...d, attributes: next }));
  const addAttribute = () => setAttributes([...attributes, { id: `attr${Date.now()}`, name: "", required: true, values: [] }]);
  const updateAttribute = (idx, patch) => setAttributes(attributes.map((a, i) => (i === idx ? { ...a, ...patch } : a)));
  const removeAttribute = (idx) => setAttributes(attributes.filter((_, i) => i !== idx));
  const moveAttribute = (idx, dir) => {
    const j = idx + dir;
    if (j < 0 || j >= attributes.length) return;
    const arr = [...attributes];
    [arr[idx], arr[j]] = [arr[j], arr[idx]];
    setAttributes(arr);
  };
  const addAttrValue = (idx, val) => {
    const clean = (val || "").trim();
    if (!clean) return;
    updateAttribute(idx, { values: [...attributes[idx].values, clean] });
  };
  const removeAttrValue = (idx, vi) => updateAttribute(idx, { values: attributes[idx].values.filter((_, i) => i !== vi) });
  const moveAttrValue = (idx, vi, dir) => {
    const j = vi + dir;
    const vals = attributes[idx].values;
    if (j < 0 || j >= vals.length) return;
    const arr = [...vals];
    [arr[vi], arr[j]] = [arr[j], arr[vi]];
    updateAttribute(idx, { values: arr });
  };

  const combos = cartesianCombos(attributes);
  const setComboStock = (values, stock) => {
    const key = comboKey(values);
    setDraft((d) => {
      const exists = d.variants.some((v) => comboKey(v.values) === key);
      const variants = exists
        ? d.variants.map((v) => (comboKey(v.values) === key ? { ...v, stock } : v))
        : [...d.variants, { id: `v${Date.now()}${Math.random().toString(36).slice(2, 5)}`, values, stock }];
      return { ...d, variants };
    });
  };

  const [urlDraft, setUrlDraft] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const addImageUrl = (url) => {
    const clean = (url || "").trim();
    if (!clean) return;
    const id = `img${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
    setDraft((d) => ({ ...d, images: [...d.images, { id, src: clean, stored: false }] }));
  };

  const removeImage = (id) => {
    setDraft((d) => {
      const target = d.images.find((im) => im.id === id);
      if (target?.stored) deleteImageFromStore(id);
      return { ...d, images: d.images.filter((im) => im.id !== id) };
    });
  };

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) { e.target.value = ""; return; }
    if (!file.type.startsWith("image/")) { setUploadError("Ese archivo no es una imagen."); e.target.value = ""; return; }
    if (file.size > 4.5 * 1024 * 1024) { setUploadError("La imagen es muy pesada (máx. ~4.5MB)."); e.target.value = ""; return; }
    setUploadError("");
    setUploading(true);
    const id = `img${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        // Persist the big base64 blob under its own storage key (not inside
        // the product record) — saveImageToStore caches it synchronously so
        // the preview below shows up immediately, no broken-image icon.
        saveImageToStore(id, reader.result);
        setDraft((d) => ({ ...d, images: [...d.images, { id, stored: true }] }));
      } else {
        setUploadError("No se pudo leer el archivo, probá de nuevo.");
      }
      setUploading(false);
    };
    reader.onerror = () => { setUploadError("No se pudo leer el archivo, probá de nuevo."); setUploading(false); };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  return (
    <div className="ldm-admin-form">
      <div className="ldm-admin-form-head">
        <h2>{product.name ? "Editar Producto" : "Añadir Producto"}</h2>
      </div>

      <div className="ldm-admin-form-grid">
        <label className="ldm-admin-field">Nombre<input value={draft.name} onChange={(e) => set({ name: e.target.value })} /></label>
        <label className="ldm-admin-field">Precio (USD)<input type="number" value={draft.price} onChange={(e) => set({ price: Number(e.target.value) })} /></label>

        <label className="ldm-admin-field">Categoría
          <select value={draft.category} onChange={(e) => set({ category: e.target.value, subcategory: null })}>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </label>
        <label className="ldm-admin-field">Subcategoría
          <select value={draft.subcategory || ""} onChange={(e) => set({ subcategory: e.target.value || null })}>
            <option value="">— Ninguna —</option>
            {(cat?.subcategories || []).map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>

        <label className="ldm-admin-field">Marca
          <select value={draft.brand || ""} onChange={(e) => set({ brand: e.target.value || null })}>
            <option value="">— Ninguna —</option>
            {(brands || []).map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
          </select>
        </label>
        <label className="ldm-admin-field">Ícono (si no hay foto cargada)
          <select value={draft.variant} onChange={(e) => set({ variant: e.target.value })}>
            {VARIANT_ICONS.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>
        <label className="ldm-admin-field ldm-admin-field--checkbox">
          <input type="checkbox" checked={draft.visible} onChange={(e) => set({ visible: e.target.checked })} /> Visible en la tienda
        </label>
        <label className="ldm-admin-field ldm-admin-field--checkbox">
          <input type="checkbox" checked={!!draft.featured} onChange={(e) => set({ featured: e.target.checked })} /> Destacado en Home
        </label>
        <label className="ldm-admin-field ldm-admin-field--checkbox">
          <input type="checkbox" checked={!!draft.newArrival} onChange={(e) => set({ newArrival: e.target.checked })} /> Nuevos Ingresos (New Arrivals)
        </label>

        <label className="ldm-admin-field ldm-admin-field--full">Descripción
          <textarea rows={3} value={draft.desc} onChange={(e) => set({ desc: e.target.value })} />
        </label>
      </div>

      <div className="ldm-admin-subsection">
        <h3>Etiquetas de tendencia</h3>
        <div className="ldm-chip-row">
          {tags.map((tg) => (
            <button key={tg.id} type="button" className={`ldm-chip ldm-chip--sm ${(draft.tags || []).includes(tg.id) ? "is-active" : ""}`} onClick={() => toggleTag(tg.id)}>{tg.label}</button>
          ))}
          {tags.length === 0 && <p className="ldm-empty-note">Creá etiquetas en la pestaña "Etiquetas".</p>}
        </div>
      </div>

      <div className="ldm-admin-subsection">
        <h3>Imágenes</h3>
        <div className="ldm-admin-images">
          {draft.images.map((im) => (
            <AdminImageThumb key={im.id} image={im} onRemove={() => removeImage(im.id)} />
          ))}
        </div>
        <div className="ldm-admin-image-add">
          <input placeholder="Pegar URL de imagen" value={urlDraft} onChange={(e) => setUrlDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { addImageUrl(urlDraft); setUrlDraft(""); } }} />
          <button className="ldm-btn ldm-btn--outline" onClick={() => { addImageUrl(urlDraft); setUrlDraft(""); }}>Añadir URL</button>
          <button className="ldm-btn ldm-btn--outline" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            <Upload size={13} strokeWidth={1.4} /> {uploading ? "Subiendo…" : "Subir"}
          </button>
          <input type="file" accept="image/*" ref={fileInputRef} style={{ display: "none" }} onChange={handleFile} />
        </div>
        {uploadError && <p className="ldm-admin-upload-error">{uploadError}</p>}
      </div>

      <div className="ldm-admin-subsection">
        <h3>Atributos (talla, color, o lo que necesites)</h3>
        <div className="ldm-admin-attrs">
          {attributes.map((attr, ai) => (
            <div className="ldm-admin-attr-block" key={attr.id}>
              <div className="ldm-admin-attr-head">
                <input placeholder="Nombre (ej. Color)" value={attr.name} onChange={(e) => updateAttribute(ai, { name: e.target.value })} />
                <label className="ldm-admin-field--checkbox ldm-admin-attr-required">
                  <input type="checkbox" checked={attr.required} onChange={(e) => updateAttribute(ai, { required: e.target.checked })} /> Obligatoria
                </label>
                <button onClick={() => moveAttribute(ai, -1)} disabled={ai === 0} aria-label="Subir atributo"><ArrowUp size={13} strokeWidth={1.4} /></button>
                <button onClick={() => moveAttribute(ai, 1)} disabled={ai === attributes.length - 1} aria-label="Bajar atributo"><ArrowDown size={13} strokeWidth={1.4} /></button>
                <button onClick={() => removeAttribute(ai)} aria-label="Eliminar atributo"><Trash2 size={13} strokeWidth={1.4} /></button>
              </div>
              <div className="ldm-admin-subs">
                {attr.values.map((val, vi) => (
                  <span key={vi} className="ldm-admin-sub-tag">
                    {val}
                    <button onClick={() => moveAttrValue(ai, vi, -1)} disabled={vi === 0} aria-label="Mover antes"><ArrowUp size={11} strokeWidth={1.6} /></button>
                    <button onClick={() => moveAttrValue(ai, vi, 1)} disabled={vi === attr.values.length - 1} aria-label="Mover después"><ArrowDown size={11} strokeWidth={1.6} /></button>
                    <button onClick={() => removeAttrValue(ai, vi)}><X size={11} strokeWidth={1.6} /></button>
                  </span>
                ))}
              </div>
              <AttrValueAdder onAdd={(val) => addAttrValue(ai, val)} />
            </div>
          ))}
        </div>
        <button className="ldm-text-link" onClick={addAttribute}><Plus size={13} strokeWidth={1.4} /> Añadir atributo</button>
      </div>

      <div className="ldm-admin-subsection">
        <h3>Stock por combinación</h3>
        {combos.length === 0 ? (
          <p className="ldm-empty-note">Agregá al menos un atributo con valores para generar combinaciones de stock.</p>
        ) : (
          <div className="ldm-admin-variant-table">
            <div className="ldm-admin-variant-row ldm-admin-variant-row--head" style={{ gridTemplateColumns: `repeat(${attributes.length}, 1fr) 1fr` }}>
              {attributes.map((a) => <span key={a.id}>{a.name || "—"}</span>)}
              <span>Stock</span>
            </div>
            {combos.map((values) => {
              const key = comboKey(values);
              const existing = draft.variants.find((v) => comboKey(v.values) === key);
              return (
                <div className="ldm-admin-variant-row" key={key} style={{ gridTemplateColumns: `repeat(${attributes.length}, 1fr) 1fr` }}>
                  {attributes.map((a) => <span key={a.id}>{values[a.id]}</span>)}
                  <input type="number" value={existing?.stock ?? 0} onChange={(e) => setComboStock(values, Number(e.target.value))} />
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="ldm-admin-form-actions">
        <button className="ldm-btn ldm-btn--outline" onClick={onCancel}>Cancelar</button>
        <button
          className="ldm-btn ldm-btn--solid"
          onClick={() => {
            const comboKeys = new Set(combos.map(comboKey));
            onSave({ ...draft, variants: draft.variants.filter((v) => comboKeys.has(comboKey(v.values))) });
          }}
        >Guardar Producto</button>
      </div>
    </div>
  );
};

const AttrValueAdder = ({ onAdd }) => {
  const [val, setVal] = useState("");
  const submit = () => { if (val.trim()) { onAdd(val); setVal(""); } };
  return (
    <div className="ldm-admin-add-row ldm-admin-add-row--sm">
      <input placeholder="Nuevo valor" value={val} onChange={(e) => setVal(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") submit(); }} />
      <button className="ldm-btn ldm-btn--outline" onClick={submit}>Añadir</button>
    </div>
  );
};

const ProductTable = ({ products, categories, onEdit, onDelete, onToggleVisible, onDuplicate, onAdd }) => (
  <div className="ldm-admin-table-wrap">
    <div className="ldm-admin-table-head">
      <h2>Productos ({products.length})</h2>
      <button className="ldm-btn ldm-btn--solid" onClick={onAdd}><Plus size={13} strokeWidth={1.6} /> Añadir Producto</button>
    </div>
    <div className="ldm-admin-grid">
      {products.map((p) => (
        <div className="ldm-admin-card" key={p.id}>
          <div className="ldm-admin-card-media">
            <Plate product={p} tone={p.tone} className="ldm-admin-card-plate" />
            <button className={`ldm-toggle ldm-admin-card-toggle ${p.visible ? "is-on" : ""}`} onClick={() => onToggleVisible(p.id)} aria-label="Alternar visibilidad">
              <span />
            </button>
          </div>
          <div className="ldm-admin-card-body">
            <p className="ldm-admin-card-name">{p.name}</p>
            <p className="ldm-admin-card-cat">{categories.find((c) => c.id === p.category)?.label || p.category}{p.subcategory ? ` / ${p.subcategory}` : ""}</p>
            <div className="ldm-admin-card-foot">
              <span className="ldm-admin-card-price">${p.price}</span>
              <span className="ldm-admin-card-stock">Stock: {fmtStock(p.variants)}</span>
            </div>
          </div>
          <div className="ldm-admin-card-actions">
            <button onClick={() => onEdit(p)}><Pencil size={13} strokeWidth={1.4} /> Editar</button>
            <button onClick={() => onDuplicate(p.id)}><Copy size={13} strokeWidth={1.4} /> Duplicar</button>
            <button onClick={() => onDelete(p.id)}><Trash2 size={13} strokeWidth={1.4} /> Eliminar</button>
          </div>
        </div>
      ))}
      {products.length === 0 && <p className="ldm-empty-note">Aún no hay productos.</p>}
    </div>
  </div>
);

const CategoryManager = ({ categories, setCategories }) => {
  const [newCat, setNewCat] = useState("");
  const [subDrafts, setSubDrafts] = useState({});

  const addCategory = () => {
    if (!newCat.trim()) return;
    const id = newCat.trim().toLowerCase().replace(/\s+/g, "-");
    setCategories((c) => [...c, { id, label: newCat.trim(), subcategories: [] }]);
    setNewCat("");
  };
  const deleteCategory = (id) => setCategories((c) => c.filter((cat) => cat.id !== id));
  const addSub = (catId) => {
    const val = (subDrafts[catId] || "").trim();
    if (!val) return;
    setCategories((c) => c.map((cat) => (cat.id === catId ? { ...cat, subcategories: [...cat.subcategories, val] } : cat)));
    setSubDrafts((d) => ({ ...d, [catId]: "" }));
  };
  const deleteSub = (catId, sub) => setCategories((c) => c.map((cat) => (cat.id === catId ? { ...cat, subcategories: cat.subcategories.filter((s) => s !== sub) } : cat)));
  const moveSub = (catId, idx, dir) => setCategories((c) => c.map((cat) => {
    if (cat.id !== catId) return cat;
    const j = idx + dir;
    if (j < 0 || j >= cat.subcategories.length) return cat;
    const arr = [...cat.subcategories];
    [arr[idx], arr[j]] = [arr[j], arr[idx]];
    return { ...cat, subcategories: arr };
  }));

  return (
    <div className="ldm-admin-table-wrap">
      <div className="ldm-admin-table-head"><h2>Categorías</h2></div>
      <div className="ldm-admin-add-row">
        <input placeholder="Nueva categoría" value={newCat} onChange={(e) => setNewCat(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addCategory(); }} />
        <button className="ldm-btn ldm-btn--solid" onClick={addCategory}><Plus size={13} strokeWidth={1.6} /> Añadir Categoría</button>
      </div>
      <div className="ldm-admin-cats">
        {categories.map((cat) => (
          <div key={cat.id} className="ldm-admin-cat-block">
            <div className="ldm-admin-cat-head">
              <strong>{cat.label}</strong>
              <button onClick={() => deleteCategory(cat.id)} aria-label="Eliminar categoría"><Trash2 size={13} strokeWidth={1.4} /></button>
            </div>
            <div className="ldm-admin-subs">
              {cat.subcategories.map((s, si) => (
                <span key={s} className="ldm-admin-sub-tag">
                  {s}
                  <button onClick={() => moveSub(cat.id, si, -1)} disabled={si === 0} aria-label="Mover antes"><ArrowUp size={11} strokeWidth={1.6} /></button>
                  <button onClick={() => moveSub(cat.id, si, 1)} disabled={si === cat.subcategories.length - 1} aria-label="Mover después"><ArrowDown size={11} strokeWidth={1.6} /></button>
                  <button onClick={() => deleteSub(cat.id, s)}><X size={11} strokeWidth={1.6} /></button>
                </span>
              ))}
            </div>
            <div className="ldm-admin-add-row ldm-admin-add-row--sm">
              <input placeholder="Nueva subcategoría" value={subDrafts[cat.id] || ""} onChange={(e) => setSubDrafts((d) => ({ ...d, [cat.id]: e.target.value }))} onKeyDown={(e) => { if (e.key === "Enter") addSub(cat.id); }} />
              <button className="ldm-btn ldm-btn--outline" onClick={() => addSub(cat.id)}>Añadir</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const MAX_TRENDING_BRANDS = 3;

const BrandManager = ({ brands, setBrands }) => {
  const [newBrand, setNewBrand] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState("");
  const trendingCount = brands.filter((b) => b.trending).length;

  const addBrand = () => {
    if (!newBrand.trim()) return;
    const id = `brand${Date.now()}`;
    setBrands((b) => [...b, { id, label: newBrand.trim() }].sort((x, y) => x.label.localeCompare(y.label, "es")));
    setNewBrand("");
  };
  const deleteBrand = (id) => setBrands((b) => b.filter((br) => br.id !== id));
  const sortAlpha = () => setBrands((b) => [...b].sort((x, y) => x.label.localeCompare(y.label, "es")));
  const moveBrand = (idx, dir) => setBrands((b) => {
    const j = idx + dir;
    if (j < 0 || j >= b.length) return b;
    const arr = [...b];
    [arr[idx], arr[j]] = [arr[j], arr[idx]];
    return arr;
  });
  const toggleTrending = (id) => setBrands((b) => b.map((br) => {
    if (br.id !== id) return br;
    if (!br.trending && trendingCount >= MAX_TRENDING_BRANDS) return br;
    return { ...br, trending: !br.trending };
  }));
  const startEdit = (b) => { setEditingId(b.id); setEditValue(b.label); };
  const saveEdit = () => {
    setBrands((b) => b.map((br) => (br.id === editingId ? { ...br, label: editValue.trim() || br.label } : br)));
    setEditingId(null);
  };

  return (
    <div className="ldm-admin-table-wrap">
      <div className="ldm-admin-table-head">
        <h2>Marcas</h2>
        <button className="ldm-btn ldm-btn--outline" onClick={sortAlpha}>Ordenar A-Z</button>
      </div>
      <div className="ldm-admin-add-row">
        <input placeholder="Nueva marca" value={newBrand} onChange={(e) => setNewBrand(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addBrand(); }} />
        <button className="ldm-btn ldm-btn--solid" onClick={addBrand}><Plus size={13} strokeWidth={1.6} /> Añadir Marca</button>
      </div>
      <p className="ldm-admin-hint"><Flame size={12} strokeWidth={1.8} /> Marcá hasta {MAX_TRENDING_BRANDS} marcas como tendencia ({trendingCount}/{MAX_TRENDING_BRANDS})</p>
      <div className="ldm-admin-subs">
        {brands.map((b, bi) => (
          editingId === b.id ? (
            <span key={b.id} className="ldm-admin-sub-tag">
              <input className="ldm-admin-tag-edit-input" value={editValue} onChange={(e) => setEditValue(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); }} autoFocus />
              <button onClick={saveEdit}><Check size={11} strokeWidth={1.8} /></button>
            </span>
          ) : (
            <span key={b.id} className={`ldm-admin-sub-tag ${b.trending ? "is-trending" : ""}`}>
              <button
                className="ldm-trending-toggle"
                onClick={() => toggleTrending(b.id)}
                disabled={!b.trending && trendingCount >= MAX_TRENDING_BRANDS}
                aria-label="Marcar como tendencia"
                title="Marcar como tendencia"
              ><Flame size={12} strokeWidth={1.8} fill={b.trending ? "currentColor" : "none"} /></button>
              {b.label}
              <button onClick={() => startEdit(b)} aria-label="Editar marca"><Pencil size={11} strokeWidth={1.6} /></button>
              <button onClick={() => moveBrand(bi, -1)} disabled={bi === 0} aria-label="Mover antes"><ArrowUp size={11} strokeWidth={1.6} /></button>
              <button onClick={() => moveBrand(bi, 1)} disabled={bi === brands.length - 1} aria-label="Mover después"><ArrowDown size={11} strokeWidth={1.6} /></button>
              <button onClick={() => deleteBrand(b.id)}><X size={11} strokeWidth={1.6} /></button>
            </span>
          )
        ))}
        {brands.length === 0 && <p className="ldm-empty-note">Aún no hay marcas.</p>}
      </div>
    </div>
  );
};

const TagManager = ({ tags, setTags }) => {
  const [newTag, setNewTag] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState("");
  const addTag = () => {
    if (!newTag.trim()) return;
    const id = `tag${Date.now()}`;
    setTags((t) => [...t, { id, label: newTag.trim() }]);
    setNewTag("");
  };
  const deleteTag = (id) => setTags((t) => t.filter((tg) => tg.id !== id));
  const startEdit = (tg) => { setEditingId(tg.id); setEditValue(tg.label); };
  const saveEdit = () => {
    setTags((t) => t.map((tg) => (tg.id === editingId ? { ...tg, label: editValue.trim() || tg.label } : tg)));
    setEditingId(null);
  };
  return (
    <div className="ldm-admin-table-wrap">
      <div className="ldm-admin-table-head"><h2>Etiquetas</h2></div>
      <div className="ldm-admin-add-row">
        <input placeholder="Nueva etiqueta" value={newTag} onChange={(e) => setNewTag(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addTag(); }} />
        <button className="ldm-btn ldm-btn--solid" onClick={addTag}><Plus size={13} strokeWidth={1.6} /> Añadir Etiqueta</button>
      </div>
      <div className="ldm-admin-subs">
        {tags.map((tg) => (
          editingId === tg.id ? (
            <span key={tg.id} className="ldm-admin-sub-tag">
              <input
                className="ldm-admin-tag-edit-input"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); }}
                autoFocus
              />
              <button onClick={saveEdit}><Check size={11} strokeWidth={1.8} /></button>
            </span>
          ) : (
            <span key={tg.id} className="ldm-admin-sub-tag">
              {tg.label}
              <button onClick={() => startEdit(tg)} aria-label="Editar etiqueta"><Pencil size={11} strokeWidth={1.6} /></button>
              <button onClick={() => deleteTag(tg.id)}><X size={11} strokeWidth={1.6} /></button>
            </span>
          )
        ))}
        {tags.length === 0 && <p className="ldm-empty-note">Aún no hay etiquetas.</p>}
      </div>
    </div>
  );
};

/* ============================== ORDERS (Pedidos) ============================== */
const STATUS_PRESETS = [
  "Pedido recibido",
  "Empaquetando tu pedido...",
  "Tu paquete ha sido enviado!",
  "En camino",
  "Entregado",
];

const ORDER_COLORS = [
  { id: "green", hex: "#3c8a5b", label: "Verde" },
  { id: "yellow", hex: "#d0a021", label: "Amarillo" },
  { id: "red", hex: "#c1443a", label: "Rojo" },
  { id: "violet", hex: "#8656b8", label: "Violeta" },
];

const ORDER_SORTS = [
  { id: "newest", label: "Más recientes" },
  { id: "oldest", label: "Más antiguos" },
  { id: "expensive", label: "Más caros" },
  { id: "cheap", label: "Más baratos" },
];

const OrderCard = ({ order, currency, onTogglePin, onSetColor, onSetStatus, onComplete, onReopen, onDelete, isCompleted }) => {
  const [draft, setDraft] = useState("");
  const items = order.items || [];
  return (
    <div className={`ldm-order-card ${order.color ? `ldm-order-card--${order.color}` : ""} ${order.pinned ? "is-pinned" : ""}`}>
      <div className="ldm-order-card-top">
        <span className="ldm-order-number">Pedido #{String(order.number).padStart(3, "0")}</span>
        <button className={`ldm-order-pin ${order.pinned ? "is-active" : ""}`} onClick={() => onTogglePin(order.id)} aria-label="Anclar pedido" title="Anclar pedido">
          <Pin size={14} strokeWidth={1.6} fill={order.pinned ? "currentColor" : "none"} />
        </button>
      </div>

      <h3 className="ldm-order-title">{order.customer?.fullName}</h3>
      <span className="ldm-order-date">{new Date(order.date).toLocaleString("es-CL", { dateStyle: "medium", timeStyle: "short" })}</span>

      <div className="ldm-order-colors">
        {ORDER_COLORS.map((c) => (
          <button
            key={c.id}
            className={`ldm-color-dot ${order.color === c.id ? "is-selected" : ""}`}
            style={{ background: c.hex }}
            onClick={() => onSetColor(order.id, c.id)}
            aria-label={c.label}
            title={c.label}
          />
        ))}
      </div>

      <div className="ldm-order-rows">
        <div className="ldm-order-row"><Mail size={12} strokeWidth={1.6} /> <span>{order.customer?.email || "—"}</span></div>
        <div className="ldm-order-row"><Phone size={12} strokeWidth={1.6} /> <span>{order.customer?.phone || "—"}</span></div>
        <div className="ldm-order-row"><MapPin size={12} strokeWidth={1.6} /> <span>{order.shipping?.address || "—"}{order.shipping?.address2 ? `, ${order.shipping.address2}` : ""}, {order.shipping?.city || "—"}</span></div>
        <div className="ldm-order-row"><Globe2 size={12} strokeWidth={1.6} /> <span>{order.shipping?.subdivision ? `${order.shipping.subdivision}, ` : ""}{order.shipping?.country || "—"} · {order.shipping?.zip || "—"}</span></div>
        <div className="ldm-order-row"><CreditCard size={12} strokeWidth={1.6} /> <span>•••• •••• •••• {order.payment?.last4}</span></div>
        <div className="ldm-order-row"><Coins size={12} strokeWidth={1.6} /> <span>{formatPrice(order.subtotal, order.currency || currency)}</span></div>
        {order.notes && <div className="ldm-order-row ldm-order-row--notes"><Pencil size={12} strokeWidth={1.6} /> <span>{order.notes}</span></div>}
      </div>

      <div className="ldm-order-items">
        {items.map((it, i) => (
          <span key={i} className="ldm-order-item-line"><Package size={11} strokeWidth={1.6} /> {it.qty}× {it.name} — {it.color} / {it.size}</span>
        ))}
      </div>

      <div className="ldm-order-status">
        <span className="ldm-status-chip">{order.status || "Pedido recibido"}</span>
        <div className="ldm-status-buttons">
          {STATUS_PRESETS.map((s) => (
            <button key={s} className={order.status === s ? "is-active" : ""} onClick={() => onSetStatus(order.id, s)}>{s}</button>
          ))}
        </div>
        <div className="ldm-status-input-row">
          <input placeholder="Actualización personalizada…" value={draft} onChange={(e) => setDraft(e.target.value)} />
          <button
            onClick={() => { if (draft.trim()) { onSetStatus(order.id, draft.trim()); setDraft(""); } }}
            aria-label="Enviar actualización"
            title="Enviar actualización"
          >
            <Send size={13} strokeWidth={1.8} />
          </button>
        </div>
      </div>

      <div className="ldm-order-actions">
        {isCompleted ? (
          <button className="ldm-order-action-btn" onClick={() => onReopen(order.id)}>
            <ArrowLeft size={13} strokeWidth={1.6} /> Reabrir Pedido
          </button>
        ) : (
          <button className="ldm-order-action-btn ldm-order-action-btn--confirm" onClick={() => onComplete(order.id)}>
            <Check size={13} strokeWidth={1.8} /> Confirmar Pedido
          </button>
        )}
        <button className="ldm-order-action-btn ldm-order-action-btn--delete" onClick={() => onDelete(order.id)}>
          <Trash2 size={13} strokeWidth={1.6} /> Eliminar Pedido
        </button>
      </div>
    </div>
  );
};

const OrderManager = ({ orders, setOrders, currency }) => {
  const [sort, setSort] = useState("newest");
  const [subTab, setSubTab] = useState("pending");
  const [query, setQuery] = useState("");

  const togglePin = (id) => setOrders((os) => os.map((o) => (o.id === id ? { ...o, pinned: !o.pinned } : o)));
  const setColor = (id, color) => setOrders((os) => os.map((o) => (o.id === id ? { ...o, color: o.color === color ? null : color } : o)));
  const setStatus = (id, status) => setOrders((os) => os.map((o) => (o.id === id ? { ...o, status } : o)));
  const completeOrder = (id) => setOrders((os) => os.map((o) => (o.id === id ? { ...o, completed: true, pinned: false } : o)));
  const reopenOrder = (id) => setOrders((os) => os.map((o) => (o.id === id ? { ...o, completed: false } : o)));
  const deleteOrder = (id) => {
    if (!window.confirm("¿Eliminar este pedido? Esta acción no se puede deshacer.")) return;
    setOrders((os) => os.filter((o) => o.id !== id));
  };

  const pending = useMemo(() => orders.filter((o) => !o.completed), [orders]);
  const completedList = useMemo(() => orders.filter((o) => o.completed), [orders]);
  const activeList = subTab === "pending" ? pending : completedList;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return activeList;
    return activeList.filter((o) =>
      String(o.number).includes(q) ||
      (o.customer?.fullName || "").toLowerCase().includes(q) ||
      (o.customer?.email || "").toLowerCase().includes(q) ||
      (o.customer?.phone || "").toLowerCase().includes(q)
    );
  }, [activeList, query]);

  const sorted = useMemo(() => {
    const cmp = {
      newest: (a, b) => new Date(b.date) - new Date(a.date),
      oldest: (a, b) => new Date(a.date) - new Date(b.date),
      expensive: (a, b) => b.subtotal - a.subtotal,
      cheap: (a, b) => a.subtotal - b.subtotal,
    }[sort];
    const arr = [...filtered].sort(cmp);
    const pinnedArr = arr.filter((o) => o.pinned);
    const rest = arr.filter((o) => !o.pinned);
    return [...pinnedArr, ...rest];
  }, [filtered, sort]);

  return (
    <div className="ldm-admin-table-wrap">
      <div className="ldm-admin-table-head">
        <h2>Pedidos ({orders.length})</h2>
        <div className="ldm-order-sort">
          <ArrowUpDown size={13} strokeWidth={1.6} />
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            {ORDER_SORTS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </div>
      </div>

      <div className="ldm-order-subtabs">
        <button className={subTab === "pending" ? "is-active" : ""} onClick={() => setSubTab("pending")}>
          Pedidos Pendientes ({pending.length})
        </button>
        <button className={subTab === "completed" ? "is-active" : ""} onClick={() => setSubTab("completed")}>
          Pedidos Completados ({completedList.length})
        </button>
      </div>

      <div className="ldm-order-search">
        <Search size={14} strokeWidth={1.6} />
        <input
          placeholder="Buscar por nombre, número de pedido, email o teléfono…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="ldm-order-grid">
        {sorted.map((o) => (
          <OrderCard
            key={o.id}
            order={o}
            currency={currency}
            onTogglePin={togglePin}
            onSetColor={setColor}
            onSetStatus={setStatus}
            onComplete={completeOrder}
            onReopen={reopenOrder}
            onDelete={deleteOrder}
            isCompleted={subTab === "completed"}
          />
        ))}
        {sorted.length === 0 && (
          <p className="ldm-empty-note">
            {query
              ? "No se encontraron pedidos con esa búsqueda."
              : subTab === "pending"
              ? "No hay pedidos pendientes."
              : "Aún no hay pedidos completados."}
          </p>
        )}
      </div>
    </div>
  );
};

/* ============================== ESTADÍSTICAS ============================== */
const StatCard = ({ icon: Icon, label, value, sub }) => (
  <div className="ldm-stat-card">
    <div className="ldm-stat-card-icon"><Icon size={16} strokeWidth={1.6} /></div>
    <div>
      <p className="ldm-stat-card-value">{value}</p>
      <p className="ldm-stat-card-label">{label}</p>
      {sub && <p className="ldm-stat-card-sub">{sub}</p>}
    </div>
  </div>
);

const StatsManager = ({ events, products, categories, orders, currency }) => {
  const stats = useMemo(() => {
    const views = events.filter((e) => e.type === "view");
    const carts = events.filter((e) => e.type === "cart");

    const countBy = (list) => list.reduce((m, e) => { m[e.productId] = (m[e.productId] || 0) + 1; return m; }, {});
    const viewCounts = countBy(views);
    const cartCounts = countBy(carts);

    const productIds = new Set([...Object.keys(viewCounts), ...Object.keys(cartCounts)]);
    const perProduct = [...productIds].map((id) => {
      const product = products.find((p) => p.id === id);
      const v = viewCounts[id] || 0;
      const c = cartCounts[id] || 0;
      return {
        id,
        name: product?.name || "(producto eliminado)",
        category: product ? (categories.find((cat) => cat.id === product.category)?.label || product.category) : "—",
        views: v,
        carts: c,
        conversion: v > 0 ? Math.round((c / v) * 100) : 0,
      };
    }).sort((a, b) => b.views - a.views);

    const viewsByCategory = views.reduce((m, e) => {
      const product = products.find((p) => p.id === e.productId);
      const label = product ? (categories.find((c) => c.id === product.category)?.label || product.category) : "Otros";
      m[label] = (m[label] || 0) + 1;
      return m;
    }, {});
    const categoryRows = Object.entries(viewsByCategory).sort((a, b) => b[1] - a[1]);
    const maxCategoryViews = Math.max(1, ...categoryRows.map(([, n]) => n));

    const days = [...Array(14)].map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (13 - i));
      return d.toISOString().slice(0, 10);
    });
    const viewsByDay = views.reduce((m, e) => {
      const day = new Date(e.ts).toISOString().slice(0, 10);
      m[day] = (m[day] || 0) + 1;
      return m;
    }, {});
    const dailySeries = days.map((day) => ({ day, count: viewsByDay[day] || 0 }));
    const maxDaily = Math.max(1, ...dailySeries.map((d) => d.count));

    const revenueUsd = orders.reduce((s, o) => {
      const rate = CURRENCIES[o.currency]?.rate || 1;
      return s + (Number(o.subtotal) || 0) / rate;
    }, 0);

    return { totalViews: views.length, totalCarts: carts.length, perProduct, categoryRows, maxCategoryViews, dailySeries, maxDaily, revenueUsd };
  }, [events, products, categories, orders]);

  return (
    <div className="ldm-stats">
      <div className="ldm-stat-cards">
        <StatCard icon={Eye} label="Vistas de producto" value={stats.totalViews.toLocaleString("es-CL")} />
        <StatCard icon={ShoppingBag} label="Agregados al carrito" value={stats.totalCarts.toLocaleString("es-CL")}
          sub={stats.totalViews > 0 ? `${Math.round((stats.totalCarts / stats.totalViews) * 100)}% conversión` : undefined} />
        <StatCard icon={Package} label="Pedidos" value={orders.length.toLocaleString("es-CL")} />
        <StatCard icon={Coins} label="Ingresos totales" value={formatPrice(stats.revenueUsd, currency)} />
      </div>

      <div className="ldm-admin-table-wrap ldm-stats-trend">
        <div className="ldm-admin-table-head"><h2>Vistas — últimos 14 días</h2></div>
        <div className="ldm-trend-chart">
          {stats.dailySeries.map((d) => (
            <div key={d.day} className="ldm-trend-bar-col" title={`${d.day}: ${d.count} vistas`}>
              <div className="ldm-trend-bar" style={{ height: `${Math.max(4, (d.count / stats.maxDaily) * 100)}%` }} />
              <span>{d.day.slice(8)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="ldm-admin-table-wrap">
        <div className="ldm-admin-table-head"><h2>Productos más vistos</h2></div>
        {stats.perProduct.length === 0 ? (
          <p className="ldm-empty-note">Todavía no hay actividad registrada. Los datos aparecen a medida que la gente navega la tienda.</p>
        ) : (
          <table className="ldm-admin-table">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Categoría</th>
                <th>Vistas</th>
                <th>Agregados al carrito</th>
                <th>Conversión</th>
              </tr>
            </thead>
            <tbody>
              {stats.perProduct.slice(0, 12).map((p) => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td>{p.category}</td>
                  <td>{p.views}</td>
                  <td>{p.carts}</td>
                  <td>{p.conversion}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {stats.categoryRows.length > 0 && (
        <div className="ldm-admin-table-wrap">
          <div className="ldm-admin-table-head"><h2>Vistas por categoría</h2></div>
          <div className="ldm-cat-bars">
            {stats.categoryRows.map(([label, count]) => (
              <div className="ldm-cat-bar-row" key={label}>
                <span className="ldm-cat-bar-label">{label}</span>
                <div className="ldm-cat-bar-track"><div className="ldm-cat-bar-fill" style={{ width: `${(count / stats.maxCategoryViews) * 100}%` }} /></div>
                <span className="ldm-cat-bar-count">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const AdminDashboard = ({ products, setProducts, categories, setCategories, brands, setBrands, tags, setTags, orders, setOrders, events, currency, onLogout, onExit }) => {
  const [tab, setTab] = useState("products");
  const [editing, setEditing] = useState(null);

  const saveProduct = (draft) => {
    setProducts((ps) => {
      const exists = ps.some((p) => p.id === draft.id);
      return exists ? ps.map((p) => (p.id === draft.id ? draft : p)) : [...ps, draft];
    });
    setEditing(null);
  };
  const deleteProduct = (id) => {
    if (!window.confirm("¿Eliminar este producto?")) return;
    setProducts((ps) => {
      const target = ps.find((p) => p.id === id);
      (target?.images || []).forEach((im) => { if (im.stored) deleteImageFromStore(im.id); });
      return ps.filter((p) => p.id !== id);
    });
  };
  const toggleVisible = (id) => setProducts((ps) => ps.map((p) => (p.id === id ? { ...p, visible: !p.visible } : p)));
  const duplicateProduct = (id) => {
    const src = products.find((p) => p.id === id);
    if (!src) return;
    const copy = { ...src, id: `p${Date.now()}`, name: `${src.name} (copia)`, visible: false, newArrival: true };
    setProducts((ps) => [...ps, copy]);
  };

  return (
    <div className="ldm-admin">
      <header className="ldm-admin-header">
        <button className="ldm-logo-mark" onClick={onExit}><LogoMark size="ldm-logomark--lg" /><span>LA DOBLE M Admin</span></button>
        <div className="ldm-admin-header-actions">
          <button className="ldm-text-link" onClick={onExit}><ArrowLeft size={14} strokeWidth={1.4} /> Volver</button>
          <button className="ldm-text-link" onClick={onLogout}><LogOut size={14} strokeWidth={1.4} /> Cerrar Sesión</button>
        </div>
      </header>
      <div className="ldm-admin-body">
        <nav className="ldm-admin-tabs">
          <button className={tab === "products" ? "is-active" : ""} onClick={() => { setTab("products"); setEditing(null); }}><Package size={15} strokeWidth={1.6} /> Productos</button>
          <button className={tab === "orders" ? "is-active" : ""} onClick={() => { setTab("orders"); setEditing(null); }}><ShoppingBag size={15} strokeWidth={1.6} /> Pedidos</button>
          <button className={tab === "categories" ? "is-active" : ""} onClick={() => { setTab("categories"); setEditing(null); }}><Layers size={15} strokeWidth={1.6} /> Categorías</button>
          <button className={tab === "brands" ? "is-active" : ""} onClick={() => { setTab("brands"); setEditing(null); }}><Building2 size={15} strokeWidth={1.6} /> Marcas</button>
          <button className={tab === "tags" ? "is-active" : ""} onClick={() => { setTab("tags"); setEditing(null); }}><Tags size={15} strokeWidth={1.6} /> Etiquetas</button>
          <button className={tab === "stats" ? "is-active" : ""} onClick={() => { setTab("stats"); setEditing(null); }}><BarChart3 size={15} strokeWidth={1.6} /> Estadísticas</button>
        </nav>
        <main className="ldm-admin-main">
          {tab === "products" && (
            editing ? (
              <ProductForm
                product={editing === "new" ? emptyProduct(categories, brands) : editing}
                categories={categories}
                brands={brands}
                tags={tags}
                onSave={saveProduct}
                onCancel={() => setEditing(null)}
              />
            ) : (
              <ProductTable products={products} categories={categories} onEdit={setEditing} onDelete={deleteProduct} onToggleVisible={toggleVisible} onDuplicate={duplicateProduct} onAdd={() => setEditing("new")} />
            )
          )}
          {tab === "orders" && <OrderManager orders={orders} setOrders={setOrders} currency={currency} />}
          {tab === "categories" && <CategoryManager categories={categories} setCategories={setCategories} />}
          {tab === "brands" && <BrandManager brands={brands} setBrands={setBrands} />}
          {tab === "tags" && <TagManager tags={tags} setTags={setTags} />}
          {tab === "stats" && <StatsManager events={events} products={products} categories={categories} orders={orders} currency={currency} />}
        </main>
      </div>
    </div>
  );
};

/* ================================== APP ===================================== */
export default function App() {
  const [theme, setTheme] = useStoredState("ldm-theme", "light", false);
  const [currency, setCurrency] = useStoredState("ldm-currency", "CLP", false);
  const [lang, setLang] = useStoredState("ldm-lang", "es", false);
  const [cart, setCart] = useStoredState("ldm-cart", [], false);
  const [wishlist, setWishlist] = useStoredState("ldm-wishlist", [], false);
  // Admin session token lives in the person's own (non-shared) storage, so
  // once they log in it stays valid across reloads until they log out or it
  // expires. It's what authorizes writes to the admin-protected keys below.
  const [adminToken, setAdminToken, adminTokenReady] = useStoredState("ldm-admin-token", null, false);
  const isAdmin = !!adminToken && Number(String(adminToken).split(".")[0]) > Date.now();

  const [rawProducts, setProducts] = useStoredState("ldm-products", DEFAULT_PRODUCTS, true, adminToken);
  const products = useMemo(() => rawProducts.map(normalizeProduct), [rawProducts]);
  const [categories, setCategories] = useStoredState("ldm-categories", DEFAULT_CATEGORIES, true, adminToken);
  const [brands, setBrands] = useStoredState("ldm-brands", DEFAULT_BRANDS, true, adminToken);
  const [tags, setTags] = useStoredState("ldm-tags", DEFAULT_TAGS, true, adminToken);
  const [orders, setOrders] = useStoredState("ldm-orders", [], true);
  // Lightweight anonymous analytics: every visitor can append (product views,
  // add-to-cart), same trust model as reviews/orders. Capped so the record
  // never grows unbounded. Read by the admin's Estadísticas tab.
  const [events, setEvents] = useStoredState("ldm-events", [], true);
  const logEvent = useCallback((type, productId) => {
    setEvents((e) => [...e, { type, productId, ts: Date.now() }].slice(-5000));
  }, [setEvents]);

  const t = STRINGS[lang] || STRINGS.es;

  const [page, setPage] = useState("home");
  const [product, setProduct] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [bagOpen, setBagOpen] = useState(false);
  const [wishOpen, setWishOpen] = useState(false);
  const [navFilter, setNavFilter] = useState({ category: null, sub: null, brand: null });
  const [solidNav, setSolidNav] = useState(false);
  const [purchasedIds, setPurchasedIds] = useStoredState("ldm-purchased", [], false);

  // SPA SEO: title + meta description per page (real crawler support for a
  // client-rendered app is limited without SSR, but this covers browser
  // tabs/history and any crawler that executes JS).
  useEffect(() => {
    try {
      const base = "LA DOBLE M";
      let title = base;
      let description = "Colección de streetwear y accesorios de diseño: chaquetas, hoodies, denim y calzado. Envíos a Chile, Argentina y Latinoamérica.";
      if (page === "shop") {
        const cat = categories.find((c) => c.id === navFilter.category);
        title = cat ? `${cat.label} — ${base}` : `Colección — ${base}`;
        description = `Comprá ${cat ? cat.label.toLowerCase() : "toda la colección"} de ${base}. ${description}`;
      } else if (page === "product" && product) {
        title = `${product.name} — ${base}`;
        description = product.desc || description;
      }
      document.title = title;
      let meta = document.querySelector('meta[name="description"]');
      if (!meta) { meta = document.createElement("meta"); meta.name = "description"; document.head.appendChild(meta); }
      meta.setAttribute("content", description);
    } catch (e) { /* not in a document context */ }
  }, [page, product, categories, navFilter.category]);

  useEffect(() => {
    const onScroll = () => setSolidNav(window.scrollY > 30);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => { window.scrollTo(0, 0); }, [page, product]);

  // Browser back/forward: keep a history entry per page/product so the
  // native arrows navigate the app instead of leaving it with nothing to go to.
  const historyReady = useRef(false);
  useEffect(() => {
    const state = { page, productId: product?.id || null };
    const current = window.history.state;
    if (!historyReady.current) {
      window.history.replaceState(state, "");
      historyReady.current = true;
      return;
    }
    if (!current || current.page !== state.page || current.productId !== state.productId) {
      window.history.pushState(state, "");
    }
    // eslint-disable-next-line
  }, [page, product]);

  useEffect(() => {
    const onPopState = (e) => {
      const st = e.state || { page: "home", productId: null };
      setPage(st.page);
      if (st.page === "product" && st.productId) {
        const p = products.find((pp) => pp.id === st.productId);
        if (p) setProduct(p);
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
    // eslint-disable-next-line
  }, [products]);

  const openProduct = useCallback((p) => { setProduct(p); setPage("product"); }, []);
  const navigateCategory = (category, sub) => { setNavFilter({ category, sub, brand: null }); setPage("shop"); setMenuOpen(false); };
  const navigateBrand = (brandId) => { setNavFilter({ category: null, sub: null, brand: brandId }); setPage("shop"); setMenuOpen(false); };

  // Records one "view" per product visited (keyed by id, not by object
  // identity, so re-renders of the same product page don't double-count).
  useEffect(() => {
    if (page === "product" && product?.id) logEvent("view", product.id);
    // eslint-disable-next-line
  }, [page, product?.id]);

  const addToCart = (item) => { setCart((c) => [...c, item]); logEvent("cart", item.id); };
  const updateQty = (idx, qty) => setCart((c) => c.map((it, i) => (i === idx ? { ...it, qty } : it)));
  const removeItem = (idx) => setCart((c) => c.filter((_, i) => i !== idx));
  const toggleWish = (id) => setWishlist((w) => (w.includes(id) ? w.filter((x) => x !== id) : [...w, id]));
  const markPurchased = (ids) => {
    setPurchasedIds((p) => [...new Set([...p, ...ids])]);
    setCart([]);
  };
  const cartCount = cart.reduce((s, i) => s + i.qty, 0);

  // Handle the redirect back from Stripe Checkout (success_url/cancel_url).
  // The webhook is the source of truth for the order + stock; here we just
  // confirm payment status so we can clear the cart and show a banner.
  const [checkoutBanner, setCheckoutBanner] = useState(null);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const checkoutState = params.get("checkout");
    if (!checkoutState) return;

    const cleanUrl = () => {
      const url = new URL(window.location.href);
      url.searchParams.delete("checkout");
      url.searchParams.delete("session_id");
      window.history.replaceState({}, "", url.pathname + url.search);
    };

    if (checkoutState === "cancelled") {
      setCheckoutBanner("cancelled");
      cleanUrl();
      return;
    }

    if (checkoutState === "success") {
      const sessionId = params.get("session_id");
      if (!sessionId) { setCheckoutBanner("error"); cleanUrl(); return; }
      (async () => {
        try {
          const res = await fetch(`/api/order-status?session_id=${encodeURIComponent(sessionId)}`);
          const data = await res.json();
          if (data.paid) {
            markPurchased(cart.map((i) => i.id));
            setCheckoutBanner("success");
          } else {
            setCheckoutBanner("error");
          }
        } catch (e) {
          setCheckoutBanner("error");
        } finally {
          cleanUrl();
        }
      })();
    }
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    if (!checkoutBanner) return;
    const timer = setTimeout(() => setCheckoutBanner(null), 6000);
    return () => clearTimeout(timer);
  }, [checkoutBanner]);

  if (page === "admin") {
    return (
      <div className="ldm-root" data-theme={theme}>
        <style>{CSS}</style>
        {!adminTokenReady ? (
          <div className="ldm-admin-login"><p className="ldm-admin-loading">Cargando…</p></div>
        ) : isAdmin ? (
          <AdminDashboard
            products={products} setProducts={setProducts}
            categories={categories} setCategories={setCategories}
            brands={brands} setBrands={setBrands}
            tags={tags} setTags={setTags}
            orders={orders} setOrders={setOrders}
            events={events}
            currency={currency}
            onLogout={() => setAdminToken(null)}
            onExit={() => setPage("home")}
          />
        ) : (
          <AdminLogin onSuccess={(token) => setAdminToken(token)} onExit={() => setPage("home")} theme={theme} />
        )}
      </div>
    );
  }

  return (
    <div className="ldm-root" data-theme={theme}>
      <style>{CSS}</style>

      <TopNav
        onMenu={() => setMenuOpen(true)}
        onCart={() => setBagOpen(true)}
        onWishlist={() => setWishOpen(true)}
        cartCount={cartCount}
        wishCount={wishlist.length}
        solid={solidNav || page !== "home"}
        onLogo={() => setPage("home")}
        products={products}
        currency={currency}
        openProduct={openProduct}
        t={t}
        theme={theme}
        onToggleTheme={() => setTheme(theme === "light" ? "dark" : "light")}
      />

      <SideMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        categories={categories}
        brands={brands}
        onNavigate={navigateCategory}
        onNavigateBrand={navigateBrand}
        currency={currency}
        setCurrency={setCurrency}
        t={t}
        theme={theme}
        onToggleTheme={() => setTheme(theme === "light" ? "dark" : "light")}
      />

      <main className="ldm-main">
        {page === "home" && <Home products={products} currency={currency} setPage={setPage} openProduct={openProduct} tags={tags} t={t} />}
        {page === "shop" && (
          <Shop products={products} currency={currency} openProduct={openProduct} tags={tags}
            activeCategory={navFilter.category} activeSub={navFilter.sub} activeBrand={navFilter.brand}
            categories={categories} brands={brands} t={t} />
        )}
        {page === "product" && product && (
          <ProductPage product={products.find((p) => p.id === product.id) || product} currency={currency} addToCart={addToCart} wishlist={wishlist} toggleWish={toggleWish} t={t} purchasedIds={purchasedIds} />
        )}
      </main>

      <Footer setPage={setPage} t={t} theme={theme} />

      <BagDrawer open={bagOpen} onClose={() => setBagOpen(false)} cart={cart} currency={currency} updateQty={updateQty} removeItem={removeItem} setPage={setPage} t={t} />
      <WishlistDrawer open={wishOpen} onClose={() => setWishOpen(false)} products={products} wishlist={wishlist} currency={currency} toggleWish={toggleWish} openProduct={(p) => { setWishOpen(false); openProduct(p); }} t={t} />

      {checkoutBanner && (
        <div className={`ldm-checkout-banner ldm-checkout-banner--${checkoutBanner}`}>
          <Check size={15} strokeWidth={1.8} />
          <span>
            {checkoutBanner === "success" && t.checkoutSuccessBanner}
            {checkoutBanner === "cancelled" && t.checkoutCancelledBanner}
            {checkoutBanner === "error" && t.checkoutErrorBanner}
          </span>
        </div>
      )}
    </div>
  );
}

/* ==================================== CSS ==================================== */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');

.ldm-root {
  --ink: #101010; --bone: #ffffff; --panel: #f4f4f3; --panel-2: #e7e6e3; --panel-3: #d8d6d2;
  --ash: #8a8a86;
  --bg: var(--bone); --fg: var(--ink); --fg-dim: #6f6d69;
  --surface: var(--panel); --hairline: rgba(16,16,16,0.12);
  background: var(--bg); color: var(--fg); font-family: 'Inter', sans-serif; min-height: 100vh;
  transition: background 0.5s ease, color 0.5s ease; position: relative;
}
.ldm-root[data-theme='dark'] {
  --bg: #101010; --fg: #f5f5f3; --fg-dim: #a3a19c; --surface: #1b1b1b; --hairline: rgba(245,245,243,0.14);
  --panel: #1b1b1b; --panel-2: #242424; --panel-3: #2b2b2b;
}
.ldm-root * { box-sizing: border-box; }
/* :where() keeps this reset's specificity at zero for the element part, so any
   later class rule (.ldm-btn--solid's background, .ldm-btn--outline's border,
   etc.) wins on source order instead of losing to "class + element" specificity —
   that mismatch previously made every solid/outline button render with no
   fill/border at all (invisible in both themes). */
.ldm-root :where(button, input, select, textarea) { font-family: inherit; color: inherit; background: none; border: none; outline: none; }
.ldm-root :where(button) { cursor: pointer; }

.ldm-eyebrow { display: block; font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase; color: var(--fg-dim); font-weight: 500; margin-bottom: 12px; }
.ldm-h1, .ldm-h2 { font-family: "Helvetica Neue", Arial, sans-serif; font-weight: 500; letter-spacing: -0.01em; margin: 0; }
.ldm-h1 { font-size: clamp(2rem, 4.4vw, 3.2rem); }
.ldm-h2 { font-size: clamp(1.6rem, 3vw, 2.2rem); }
.ldm-text-link { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; }

.ldm-btn { padding: 14px 30px; font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase; font-weight: 500; transition: all 0.3s ease; display: inline-flex; align-items: center; gap: 8px; justify-content: center; }
.ldm-btn--solid { background: var(--fg); color: var(--bg); }
.ldm-btn--solid:hover { opacity: 0.85; }
.ldm-btn--solid.is-disabled { background: var(--panel-3); color: var(--fg-dim); opacity: 1; cursor: not-allowed; pointer-events: none; }
.ldm-btn--outline { border: 1px solid var(--hairline); }
.ldm-btn--outline:hover { border-color: var(--fg); }
.ldm-full { width: 100%; }

/* top nav */
.ldm-nav { position: fixed; top: 0; left: 0; right: 0; z-index: 100; display: flex; align-items: center; justify-content: space-between; padding: 18px clamp(16px, 3vw, 40px); background: var(--bg); border-bottom: 1px solid transparent; transition: all 0.4s ease; }
.ldm-nav--solid { border-bottom-color: var(--hairline); }
.ldm-nav-icon { position: relative; padding: 6px; color: var(--fg); }
.ldm-nav-left { display: flex; align-items: center; gap: 4px; }
.ldm-nav-logo { display: flex; align-items: center; gap: 8px; font-family: "Helvetica Neue", Arial, sans-serif; font-size: 15px; letter-spacing: 0.06em; }
.ldm-nav-logo span, .ldm-logo-mark span { font-weight: 700; }
.ldm-logomark { width: 26px; height: 26px; object-fit: contain; flex-shrink: 0; color: var(--fg); }
.ldm-logomark--lg { width: 30px; height: 30px; }
.ldm-nav-right { display: flex; gap: 8px; }
.ldm-nav-badge { position: absolute; top: -2px; right: -2px; background: var(--fg); color: var(--bg); font-size: 9px; width: 15px; height: 15px; border-radius: 50%; display: flex; align-items: center; justify-content: center; }

/* side drawer */
.ldm-scrim { position: fixed; inset: 0; background: rgba(0,0,0,0.45); z-index: 200; opacity: 0; pointer-events: none; transition: opacity 0.35s ease; }
.ldm-scrim.is-open { opacity: 1; pointer-events: auto; }
.ldm-drawer { position: fixed; top: 0; left: 0; bottom: 0; width: min(360px, 86vw); background: var(--bg); z-index: 210; transform: translateX(-100%); transition: transform 0.4s cubic-bezier(.16,.84,.44,1); display: flex; flex-direction: column; padding: 24px; }
.ldm-drawer.is-open { transform: translateX(0); }
.ldm-drawer-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.ldm-drawer-title { font-family: "Helvetica Neue", Arial, sans-serif; font-size: 18px; }
.ldm-drawer-search { display: flex; align-items: center; gap: 10px; border: 1px solid var(--hairline); border-radius: 2px; padding: 10px 12px; margin-bottom: 14px; color: var(--fg-dim); }
.ldm-drawer-search input { flex: 1; font-size: 13px; color: var(--fg); }
.ldm-drawer-results { display: flex; flex-direction: column; gap: 4px; flex: 1; overflow-y: auto; }
.ldm-drawer-results-empty { font-size: 12.5px; color: var(--fg-dim); padding: 12px 0; }
.ldm-drawer-result { display: flex; align-items: center; gap: 12px; padding: 8px 0; text-align: left; }
.ldm-drawer-result-plate { width: 48px; flex-shrink: 0; border-radius: 2px; }
.ldm-drawer-result span { display: flex; flex-direction: column; gap: 2px; }
.ldm-drawer-result strong { font-size: 13px; font-weight: 500; }
.ldm-drawer-result em { font-style: normal; font-size: 11.5px; color: var(--fg-dim); }
.ldm-drawer-cats { flex: 1; overflow-y: auto; }
.ldm-drawer-cat { border-bottom: 1px solid var(--hairline); }
.ldm-drawer-cat-head { width: 100%; display: flex; justify-content: space-between; align-items: center; padding: 16px 0; font-size: 13px; letter-spacing: 0.14em; text-transform: uppercase; font-weight: 500; }
.ldm-chev { transition: transform 0.3s ease; }
.ldm-chev.is-open { transform: rotate(180deg); }
.ldm-drawer-subs { display: flex; flex-direction: column; padding-bottom: 12px; }
.ldm-drawer-sub { text-align: left; padding: 8px 0 8px 12px; font-size: 13px; color: var(--fg-dim); }
.ldm-drawer-sub:hover { color: var(--fg); }
.ldm-drawer-foot { border-top: 1px solid var(--hairline); padding-top: 18px; display: flex; flex-direction: column; gap: 16px; }
.ldm-drawer-account-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.ldm-drawer-account-row .ldm-drawer-account { flex: 1; }
.ldm-drawer-account { display: flex; justify-content: space-between; align-items: center; font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase; }
.ldm-drawer-account-note { font-size: 12px; color: var(--fg-dim); margin: -6px 0 0; }

/* currency picker — now a compact dropdown (logic unchanged, UI simplified) */
.ldm-currency-block { display: flex; flex-direction: column; gap: 8px; }
.ldm-drawer-section-label { display: flex; align-items: center; gap: 6px; font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--fg-dim); }
.ldm-currency-select { border: 1px solid var(--hairline); border-radius: 4px; padding: 10px 12px; font-size: 12.5px; width: 100%; cursor: pointer; transition: border-color 0.2s ease; }
.ldm-currency-select:hover, .ldm-currency-select:focus { border-color: var(--fg); }

/* hero */
.ldm-hero { position: relative; height: 82vh; min-height: 520px; display: flex; align-items: flex-end; padding: 0 5vw 70px; overflow: hidden; background: var(--ink); margin-top: 0; }
.ldm-hero-croquis { position: absolute; right: -10%; top: 46%; transform: translateY(-50%); width: min(58vw, 640px); color: rgba(245,245,243,0.08); }
.ldm-hero-content { position: relative; z-index: 2; max-width: 600px; padding-top: 90px; }
.ldm-hero .ldm-eyebrow { color: rgba(245,245,243,0.6); }
.ldm-hero-title { font-family: "Helvetica Neue", Arial, sans-serif; font-weight: 500; color: #f5f5f3; font-size: clamp(2.2rem, 5.6vw, 4.4rem); line-height: 1; margin: 0 0 30px; }

/* sections */
.ldm-section { padding: 90px 5vw; max-width: 1440px; margin: 0 auto; }
.ldm-section--tight { padding-top: 0; }
.ldm-section-head { margin-bottom: 36px; }
.ldm-center-cta { text-align: center; margin-top: 44px; }
.ldm-main { padding-top: 62px; }

.ldm-benefits { display: flex; flex-wrap: wrap; justify-content: center; gap: 32px; padding: 22px 5vw; border-bottom: 1px solid var(--hairline); }
.ldm-benefits span { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--fg-dim); letter-spacing: 0.02em; }

.ldm-about { padding: 90px 5vw 100px; max-width: 1440px; margin: 0 auto; }
.ldm-about-inner { max-width: 640px; margin: 0 auto; text-align: center; }
.ldm-about-inner .ldm-eyebrow { text-align: center; }
.ldm-about-inner h2 { margin-bottom: 20px; }
.ldm-about-inner p { font-size: 14.5px; line-height: 1.8; color: var(--fg-dim); font-weight: 300; margin: 0; }

.ldm-quality { padding-top: 0; }
.ldm-quality-showcase { display: grid; grid-template-columns: 1.1fr 0.9fr; gap: 6vw; align-items: center; margin-bottom: 80px; }
.ldm-quality-photos { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.ldm-quality-photos img { width: 100%; height: 100%; object-fit: cover; aspect-ratio: 3/4; border-radius: 2px; }
.ldm-quality-photos img:first-child { margin-top: 32px; }
.ldm-quality-copy p { font-size: 14px; line-height: 1.75; color: var(--fg-dim); font-weight: 300; margin: 18px 0 28px; }
.ldm-quality-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 32px; }
.ldm-quality-card { text-align: center; padding: 0 12px; }
.ldm-quality-card svg { color: var(--fg-dim); margin-bottom: 14px; }
.ldm-quality-card h3 { font-family: "Helvetica Neue", Arial, sans-serif; font-size: 15px; font-weight: 500; margin: 0 0 8px; }
.ldm-quality-card p { font-size: 12.5px; line-height: 1.6; color: var(--fg-dim); margin: 0; font-weight: 300; }

.ldm-reveal { opacity: 0; transform: translateY(24px); transition: opacity 0.7s cubic-bezier(.16,.84,.44,1), transform 0.7s cubic-bezier(.16,.84,.44,1); }
.ldm-reveal.is-shown { opacity: 1; transform: translateY(0); }

/* plate */
.ldm-plate { position: relative; aspect-ratio: 4/5; border-radius: 2px; overflow: hidden; display: flex; align-items: center; justify-content: center; }
.ldm-croquis { width: 42%; color: rgba(16,16,16,0.55); }
.ldm-root[data-theme='dark'] .ldm-croquis { color: rgba(245,245,243,0.75); }
.ldm-plate-img { width: 100%; height: 100%; object-fit: cover; }

/* grid & cards */
.ldm-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 24px; }
.ldm-card { position: relative; text-align: left; transition: transform 0.35s cubic-bezier(.16,.84,.44,1); }
.ldm-card.is-hovered { transform: scale(1.035); z-index: 2; }
.ldm-card-media { display: block; width: 100%; position: relative; margin-bottom: 12px; overflow: hidden; border-radius: 2px; }
.ldm-card-media-btn { display: block; width: 100%; }
.ldm-card-plate { width: 100%; }
.ldm-card-tag { position: absolute; top: 10px; left: 10px; background: var(--bg); color: var(--fg); font-size: 9.5px; letter-spacing: 0.08em; text-transform: uppercase; padding: 5px 9px; border-radius: 999px; border: 1px solid var(--hairline); }
.ldm-card-stock-badge { position: absolute; top: 10px; right: 10px; background: var(--fg); color: var(--bg); font-size: 9px; letter-spacing: 0.06em; text-transform: uppercase; padding: 5px 9px; border-radius: 999px; }
.ldm-card-wish { position: absolute; top: 10px; right: 10px; background: var(--bg); border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; color: var(--fg); opacity: 0.85; }
.ldm-card-wish.is-active { color: var(--fg); }
.ldm-card-info { width: 100%; display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; text-align: left; }
.ldm-card-name { font-size: 13px; margin: 0 0 4px; }
.ldm-card-cat { font-size: 11px; color: var(--fg-dim); margin: 0; text-transform: capitalize; }
.ldm-card-price { font-size: 12.5px; margin: 0; color: var(--fg-dim); white-space: nowrap; }

/* shop */
.ldm-shop-head { margin-bottom: 20px; }
.ldm-filters { display: flex; gap: 8px; align-items: center; margin-bottom: 12px; flex-wrap: wrap; }
.ldm-filters--subs { margin-top: -6px; margin-bottom: 16px; }
.ldm-chip { padding: 6px 14px; border: 1px solid var(--hairline); font-size: 10.5px; letter-spacing: 0.08em; text-transform: uppercase; border-radius: 999px; display: inline-flex; align-items: center; gap: 6px; }
.ldm-chip.is-active { background: var(--fg); color: var(--bg); border-color: var(--fg); }
.ldm-chip--sm { padding: 6px 12px; border-radius: 2px; text-transform: none; letter-spacing: 0.02em; font-size: 12px; }
.ldm-chip--filters { background: var(--surface); }
.ldm-chip.is-disabled { opacity: 0.3; text-decoration: line-through; cursor: not-allowed; }
.ldm-filter-count { margin-left: auto; font-size: 11px; color: var(--fg-dim); }
.ldm-empty-note { color: var(--fg-dim); font-size: 13px; grid-column: 1/-1; }
.ldm-chip-row { display: flex; gap: 6px; flex-wrap: wrap; }

.ldm-filter-panel { border: 1px solid var(--hairline); border-radius: 4px; padding: 8px 10px; margin-bottom: 12px; display: flex; flex-direction: column; gap: 5px; background: var(--surface); }
.ldm-filter-panel-row { display: flex; flex-direction: column; gap: 3px; }
.ldm-filter-panel .ldm-chip--sm { padding: 4px 9px; font-size: 11px; }
.ldm-filter-panel .ldm-variant-label { margin-bottom: 3px; font-size: 10px; }
.ldm-filter-panel-row--inline { flex-direction: row; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; }
.ldm-price-slider { width: 100%; accent-color: var(--fg); }
.ldm-stock-check { display: flex; align-items: center; gap: 6px; font-size: 12px; }
.ldm-sort-select { display: flex; align-items: center; gap: 6px; font-size: 11.5px; }
.ldm-sort-select select { border: 1px solid var(--hairline); padding: 6px 8px; border-radius: 2px; font-size: 11.5px; }
.ldm-filter-reset { align-self: flex-start; color: var(--fg-dim); }

/* product page */
.ldm-product { max-width: 1200px; margin: 0 auto; padding: 40px 5vw 100px; display: grid; grid-template-columns: 1.1fr 0.9fr; gap: 6vw; position: relative; }
.ldm-product-plate { width: 100%; }
.ldm-product-title { margin: 4px 0 8px; }
.ldm-product-price { font-size: 16px; color: var(--fg-dim); margin: 0 0 30px; }
.ldm-wish-btn { color: var(--fg-dim); padding: 6px; }
.ldm-wish-btn.is-active { color: var(--fg); }
.ldm-product-gallery { position: relative; }
.ldm-wish-btn--overlay { position: absolute; top: 16px; right: 16px; background: var(--bg); border-radius: 50%; width: 38px; height: 38px; display: flex; align-items: center; justify-content: center; opacity: 0.9; }
.ldm-variant-block { margin-bottom: 26px; }
.ldm-variant-label { display: block; font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--fg-dim); margin-bottom: 8px; }
.ldm-size-warn { display: block; margin-top: 8px; font-size: 11px; color: var(--fg-dim); }
.ldm-size-warn--low { color: var(--fg); font-weight: 500; }
.ldm-qty-row { display: flex; align-items: center; justify-content: space-between; }
.ldm-qty-stepper { display: flex; align-items: center; gap: 14px; border: 1px solid var(--hairline); padding: 7px 14px; border-radius: 2px; }
.ldm-qty-stepper--sm { padding: 5px 10px; gap: 10px; }
.ldm-add-btn { width: 100%; margin-bottom: 26px; }
.ldm-product-desc { font-size: 13.5px; line-height: 1.75; color: var(--fg-dim); font-weight: 300; }

.ldm-toast { position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%); z-index: 250; background: var(--fg); color: var(--bg); padding: 12px 24px; border-radius: 999px; font-size: 12px; display: flex; align-items: center; gap: 8px; }

/* footer */
.ldm-footer { border-top: 1px solid var(--hairline); padding: 60px 5vw 24px; max-width: 1440px; margin: 0 auto; }
.ldm-footer-top { display: flex; justify-content: space-between; gap: 6vw; flex-wrap: wrap; margin-bottom: 40px; }
.ldm-logo-mark { display: flex; align-items: center; gap: 10px; font-family: "Helvetica Neue", Arial, sans-serif; font-size: 16px; letter-spacing: 0.06em; }
.ldm-footer-cols { display: flex; gap: 5vw; flex-wrap: wrap; }
.ldm-footer-cols > div { display: flex; flex-direction: column; gap: 8px; }
.ldm-footer-cols button { text-align: left; font-size: 12.5px; color: var(--fg-dim); width: fit-content; }
.ldm-footer-trust { display: flex; flex-wrap: wrap; gap: 20px; padding: 18px 0; border-top: 1px solid var(--hairline); margin-bottom: 4px; }
.ldm-footer-trust span { display: flex; align-items: center; gap: 8px; font-size: 11.5px; color: var(--fg-dim); }
.ldm-footer-bottom { font-size: 11px; color: var(--fg-dim); padding-top: 18px; border-top: 1px solid var(--hairline); display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.ldm-footer-admin-link { font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--fg-dim); opacity: 0.75; }
.ldm-footer-admin-link:hover { opacity: 1; color: var(--fg); }

.ldm-policy-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 400; display: flex; align-items: center; justify-content: center; padding: 24px; }
.ldm-policy-card { background: var(--bg); border-radius: 8px; max-width: 460px; width: 100%; max-height: 80vh; overflow-y: auto; padding: 26px 28px; }
.ldm-policy-text { font-size: 13.5px; line-height: 1.7; color: var(--fg-dim); margin: 0 0 14px; }

/* side panels (bag/wishlist) */
.ldm-panel { position: fixed; top: 0; right: 0; bottom: 0; width: 100vw; background: var(--bg); z-index: 220; transform: translateX(100%); transition: transform 0.4s cubic-bezier(.16,.84,.44,1); display: flex; flex-direction: column; padding: 26px max(28px, 8vw); overflow-y: auto; }
.ldm-panel-items, .ldm-panel-summary, .ldm-checkout, .ldm-panel-empty { width: 100%; max-width: 640px; margin: 0 auto; }
.ldm-panel.is-open { transform: translateX(0); }
.ldm-panel-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 28px; }
.ldm-panel-head h2 { font-family: "Helvetica Neue", Arial, sans-serif; font-weight: 500; font-size: 20px; margin: 0; }
.ldm-panel-empty { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 18px; text-align: center; color: var(--fg-dim); }
.ldm-panel-items { display: flex; flex-direction: column; gap: 22px; flex: 1; }
.ldm-panel-item { display: flex; gap: 14px; }
.ldm-panel-item-plate { width: 76px; flex-shrink: 0; }
.ldm-panel-item-plate-btn { flex-shrink: 0; }
.ldm-panel-item-info { flex: 1; }
.ldm-panel-item-name { font-size: 13px; margin: 0 0 4px; }
.ldm-panel-item-meta { font-size: 11.5px; color: var(--fg-dim); margin: 0 0 10px; }
.ldm-panel-item-right { text-align: right; display: flex; flex-direction: column; justify-content: space-between; font-size: 12.5px; }
.ldm-remove-link { font-size: 11px; color: var(--fg-dim); text-decoration: underline; margin-top: 6px; }
.ldm-panel-summary { border-top: 1px solid var(--hairline); padding-top: 20px; margin-top: 20px; }
.ldm-summary-row { display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 8px; }
.ldm-summary-row--muted { color: var(--fg-dim); font-size: 12px; }
.ldm-checkout-form { display: flex; flex-direction: column; gap: 12px; }
.ldm-checkout-form input, .ldm-checkout-form select, .ldm-checkout-form textarea {
  border: 1px solid var(--hairline); padding: 12px 14px; font-size: 13px; border-radius: 2px; width: 100%;
  font-family: inherit; transition: border-color 0.2s ease; background: var(--bg); appearance: none;
}
.ldm-checkout-form textarea { resize: vertical; }
.ldm-checkout-form input:focus, .ldm-checkout-form select:focus, .ldm-checkout-form textarea:focus { border-color: var(--fg); }
.ldm-checkout-form input.has-error, .ldm-checkout-form select.has-error { border-color: #c0392b; }
.ldm-checkout-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.ldm-checkout-success { font-family: "Helvetica Neue", Arial, sans-serif; font-size: 20px; }
.ldm-payment-note { display: flex; align-items: center; gap: 8px; font-size: 12.5px; color: var(--fg-dim); background: var(--surface); border-radius: 4px; padding: 12px 14px; margin: 0 0 8px; }
.ldm-checkout-pay-error { margin: 0 0 10px; }
.ldm-checkout-banner { position: fixed; bottom: 26px; left: 50%; transform: translateX(-50%); z-index: 300; background: var(--fg); color: var(--bg); padding: 14px 22px; border-radius: 999px; font-size: 13px; display: flex; align-items: center; gap: 10px; box-shadow: 0 8px 24px rgba(0,0,0,0.2); max-width: 90vw; text-align: center; }
.ldm-checkout-banner--cancelled, .ldm-checkout-banner--error { background: #c1443a; color: #fff; }
.ldm-checkout-section-label { font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--fg-dim); margin-top: 6px; }
.ldm-checkout-section-label:first-child { margin-top: 0; }
.ldm-field-group { display: flex; flex-direction: column; gap: 5px; }
.ldm-field-error { display: flex; align-items: center; gap: 5px; font-size: 11px; color: #c0392b; }
.ldm-phone-row { display: flex; align-items: stretch; border: 1px solid var(--hairline); border-radius: 2px; overflow: hidden; transition: border-color 0.2s ease; background: var(--bg); }
.ldm-phone-row:focus-within { border-color: var(--fg); }
.ldm-phone-row.has-error { border-color: #c0392b; }
.ldm-phone-dial { display: flex; align-items: center; padding: 0 12px; font-size: 13px; color: var(--fg-dim); border-right: 1px solid var(--hairline); white-space: nowrap; background: var(--surface); }
.ldm-phone-row input { border: none; flex: 1; padding: 12px 14px; }
.ldm-phone-row input:disabled { opacity: 0.5; }

/* reviews */
.ldm-reviews { margin-top: 40px; border-top: 1px solid var(--hairline); padding-top: 30px; }
.ldm-reviews-title { font-family: "Helvetica Neue", Arial, sans-serif; font-size: 15px; font-weight: 500; margin: 0 0 16px; }
.ldm-reviews-list { display: flex; flex-direction: column; gap: 16px; margin-bottom: 22px; }
.ldm-review-item { border-bottom: 1px solid var(--hairline); padding-bottom: 14px; }
.ldm-review-stars { display: flex; gap: 2px; color: var(--fg); margin-bottom: 6px; }
.ldm-review-stars--input { gap: 4px; margin-bottom: 12px; }
.ldm-review-stars--input button { color: var(--fg); padding: 2px; }
.ldm-review-text { font-size: 13px; color: var(--fg-dim); line-height: 1.6; margin: 0; }
.ldm-review-form { border-top: 1px solid var(--hairline); padding-top: 20px; display: flex; flex-direction: column; }
.ldm-review-form textarea { border: 1px solid var(--hairline); padding: 12px 14px; font-size: 13px; border-radius: 2px; width: 100%; margin-bottom: 12px; resize: vertical; font-family: inherit; }
.ldm-review-form button { align-self: flex-start; }
.ldm-review-locked { font-size: 12.5px; color: var(--fg-dim); border-top: 1px solid var(--hairline); padding-top: 18px; }

/* ============================ ADMIN ============================ */
.ldm-admin-login { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: var(--surface); }
.ldm-admin-login-card { width: 340px; display: flex; flex-direction: column; gap: 14px; background: var(--bg); padding: 34px; border-radius: 4px; border: 1px solid var(--hairline); }
.ldm-admin-login-card h1 { font-family: "Helvetica Neue", Arial, sans-serif; font-size: 18px; margin: 6px 0 8px; }
.ldm-admin-login-card label { display: flex; flex-direction: column; gap: 6px; font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--fg-dim); }
.ldm-admin-login-card input { border: 1px solid var(--hairline); padding: 10px 12px; border-radius: 2px; font-size: 13px; text-transform: none; letter-spacing: normal; color: var(--fg); }
.ldm-pass-row { display: flex; align-items: center; border: 1px solid var(--hairline); border-radius: 2px; }
.ldm-pass-row input { border: none; flex: 1; }
.ldm-pass-row button { padding: 0 10px; color: var(--fg-dim); }
.ldm-admin-error { color: var(--fg); font-weight: 500; font-size: 12px; margin: 0; }
.ldm-admin-loading { font-size: 13px; color: var(--fg-dim); letter-spacing: 0.06em; text-transform: uppercase; }

.ldm-admin { min-height: 100vh; background: var(--surface); }
.ldm-admin-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 32px; background: var(--bg); border-bottom: 1px solid var(--hairline); position: sticky; top: 0; z-index: 10; }
.ldm-admin-header-actions { display: flex; gap: 24px; }
.ldm-admin-header .ldm-logo-mark { border: none; padding: 0; }
.ldm-admin-body { display: flex; min-height: calc(100vh - 65px); }
.ldm-admin-tabs { width: 210px; flex-shrink: 0; background: var(--bg); border-right: 1px solid var(--hairline); padding: 18px 12px; display: flex; flex-direction: column; gap: 3px; }
.ldm-admin-tabs button { display: flex; align-items: center; gap: 10px; text-align: left; padding: 10px 14px; font-size: 13px; color: var(--fg-dim); border-radius: 6px; transition: background 0.15s ease, color 0.15s ease; }
.ldm-admin-tabs button:hover { background: var(--surface); color: var(--fg); }
.ldm-admin-tabs button.is-active { color: var(--bg); background: var(--fg); font-weight: 500; }
.ldm-admin-main { flex: 1; padding: 32px; max-width: 1240px; }

.ldm-admin-table-wrap { background: var(--bg); border: 1px solid var(--hairline); border-radius: 10px; padding: 26px 28px; box-shadow: 0 1px 3px rgba(16,16,16,0.04); }
.ldm-admin-table-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 22px; flex-wrap: wrap; gap: 12px; }
.ldm-admin-table-head h2 { font-family: "Helvetica Neue", Arial, sans-serif; font-size: 19px; font-weight: 500; margin: 0; }
.ldm-admin-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.ldm-admin-table th { text-align: left; font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--fg-dim); padding: 10px 8px; border-bottom: 1px solid var(--hairline); }
.ldm-admin-table td { padding: 10px 8px; border-bottom: 1px solid var(--hairline); vertical-align: middle; }
.ldm-admin-thumb { width: 42px; border-radius: 2px; }
.ldm-admin-actions { display: flex; gap: 10px; }
.ldm-admin-actions button { color: var(--fg-dim); }
.ldm-admin-actions button:hover { color: var(--fg); }

.ldm-admin-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 18px; }
.ldm-admin-card { border: 1px solid var(--hairline); border-radius: 8px; overflow: hidden; display: flex; flex-direction: column; background: var(--bg); transition: box-shadow 0.2s ease; }
.ldm-admin-card:hover { box-shadow: 0 4px 14px rgba(16,16,16,0.08); }
.ldm-admin-card-media { position: relative; }
.ldm-admin-card-plate { width: 100%; aspect-ratio: 4/5; }
.ldm-admin-card-toggle { position: absolute; top: 8px; right: 8px; background: var(--bg); box-shadow: 0 0 0 1px var(--hairline); }
.ldm-admin-card-body { padding: 12px 14px; flex: 1; }
.ldm-admin-card-name { font-size: 13px; margin: 0 0 3px; font-weight: 500; }
.ldm-admin-card-cat { font-size: 11px; color: var(--fg-dim); margin: 0 0 8px; }
.ldm-admin-card-foot { display: flex; justify-content: space-between; align-items: center; font-size: 11.5px; color: var(--fg-dim); }
.ldm-admin-card-price { font-weight: 500; color: var(--fg); }
.ldm-admin-card-actions { display: flex; border-top: 1px solid var(--hairline); }
.ldm-admin-card-actions button { flex: 1; padding: 10px; font-size: 11.5px; display: flex; align-items: center; justify-content: center; gap: 6px; color: var(--fg-dim); }
.ldm-admin-card-actions button:not(:last-child) { border-right: 1px solid var(--hairline); }
.ldm-admin-card-actions button:hover { color: var(--fg); background: var(--surface); }
.ldm-toggle { width: 34px; height: 18px; border-radius: 999px; background: var(--panel-3); position: relative; }
.ldm-toggle span { position: absolute; top: 2px; left: 2px; width: 14px; height: 14px; border-radius: 50%; background: var(--bg); transition: transform 0.25s ease; }
.ldm-toggle.is-on { background: var(--fg); }
.ldm-toggle.is-on span { transform: translateX(16px); background: var(--bg); }

.ldm-admin-form { background: var(--bg); border: 1px solid var(--hairline); border-radius: 10px; padding: 28px 30px; box-shadow: 0 1px 3px rgba(16,16,16,0.04); }
.ldm-admin-form-head h2 { font-family: "Helvetica Neue", Arial, sans-serif; font-size: 18px; margin: 0 0 20px; }
.ldm-admin-form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 26px; }
.ldm-admin-field { display: flex; flex-direction: column; gap: 6px; font-size: 11px; letter-spacing: 0.04em; text-transform: uppercase; color: var(--fg-dim); }
.ldm-admin-field--full { grid-column: 1 / -1; }
.ldm-admin-field--checkbox { flex-direction: row; align-items: center; gap: 8px; text-transform: none; }
.ldm-admin-field input, .ldm-admin-field select, .ldm-admin-field textarea { border: 1px solid var(--hairline); padding: 10px 12px; border-radius: 2px; font-size: 13px; text-transform: none; letter-spacing: normal; color: var(--fg); font-family: inherit; }
.ldm-admin-subsection { margin-bottom: 26px; }
.ldm-admin-subsection h3 { font-size: 13px; margin: 0 0 14px; }
.ldm-admin-images { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 12px; }
.ldm-admin-image { position: relative; width: 70px; height: 88px; border-radius: 2px; overflow: hidden; border: 1px solid var(--hairline); }
.ldm-admin-image img { width: 100%; height: 100%; object-fit: cover; }
.ldm-admin-image-placeholder { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; text-align: center; font-size: 9px; line-height: 1.3; color: var(--fg-dim); padding: 4px; background: var(--surface); }
.ldm-admin-image button { position: absolute; top: 2px; right: 2px; background: rgba(0,0,0,0.6); color: #fff; width: 18px; height: 18px; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
.ldm-admin-image-add { display: flex; gap: 8px; flex-wrap: wrap; }
.ldm-admin-image-add input { flex: 1; min-width: 160px; border: 1px solid var(--hairline); padding: 9px 12px; border-radius: 2px; font-size: 12.5px; }
.ldm-admin-upload-error { font-size: 11.5px; color: #c0392b; margin: 8px 0 0; }
.ldm-admin-variant-table { display: flex; flex-direction: column; gap: 8px; margin-bottom: 10px; }
.ldm-admin-variant-row { display: grid; grid-template-columns: 1fr 1fr 1fr auto; gap: 8px; align-items: center; }
.ldm-admin-variant-row input { border: 1px solid var(--hairline); padding: 8px 10px; border-radius: 2px; font-size: 12.5px; }
.ldm-admin-variant-row button { color: var(--fg-dim); }
.ldm-admin-variant-row--head { font-size: 10.5px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--fg-dim); }
.ldm-admin-attrs { display: flex; flex-direction: column; gap: 14px; margin-bottom: 12px; }
.ldm-admin-attr-block { border: 1px solid var(--hairline); border-radius: 8px; padding: 14px 16px; background: var(--surface); }
.ldm-admin-attr-head { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; flex-wrap: wrap; }
.ldm-admin-attr-head input { flex: 1; min-width: 140px; border: 1px solid var(--hairline); padding: 8px 10px; border-radius: 2px; font-size: 12.5px; }
.ldm-admin-attr-head button { color: var(--fg-dim); }
.ldm-admin-attr-head button:disabled { opacity: 0.3; cursor: not-allowed; }
.ldm-admin-attr-required { font-size: 11.5px; white-space: nowrap; }
.ldm-admin-sub-tag button:disabled { opacity: 0.3; cursor: not-allowed; }
.ldm-admin-hint { display: flex; align-items: center; gap: 6px; font-size: 11.5px; color: var(--fg-dim); margin: -8px 0 12px; }
.ldm-trending-toggle { color: var(--fg-dim); }
.ldm-admin-sub-tag.is-trending { background: color-mix(in srgb, var(--fg) 10%, var(--surface)); }
.ldm-admin-sub-tag.is-trending .ldm-trending-toggle { color: #d0742a; }
.ldm-drawer-brand-flame { color: #d0742a; margin-left: 4px; vertical-align: -2px; }
.ldm-admin-tag-edit-input { border: 1px solid var(--hairline); border-radius: 2px; padding: 3px 6px; font-size: 12px; width: 110px; }

/* stats */
.ldm-stats { display: flex; flex-direction: column; gap: 20px; }
.ldm-stat-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; }
.ldm-stat-card { display: flex; align-items: flex-start; gap: 12px; background: var(--bg); border: 1px solid var(--hairline); border-radius: 10px; padding: 18px 20px; box-shadow: 0 1px 3px rgba(16,16,16,0.04); }
.ldm-stat-card-icon { width: 34px; height: 34px; border-radius: 8px; background: var(--surface); display: flex; align-items: center; justify-content: center; color: var(--fg-dim); flex-shrink: 0; }
.ldm-stat-card-value { font-family: "Helvetica Neue", Arial, sans-serif; font-size: 22px; font-weight: 500; margin: 0; }
.ldm-stat-card-label { font-size: 11.5px; color: var(--fg-dim); margin: 2px 0 0; }
.ldm-stat-card-sub { font-size: 10.5px; color: var(--fg-dim); opacity: 0.8; margin: 4px 0 0; }
.ldm-stats-trend { overflow-x: auto; }
.ldm-trend-chart { display: flex; align-items: flex-end; gap: 6px; height: 140px; padding-top: 10px; }
.ldm-trend-bar-col { flex: 1; min-width: 20px; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; height: 100%; gap: 6px; }
.ldm-trend-bar { width: 100%; max-width: 26px; background: var(--fg); border-radius: 3px 3px 0 0; opacity: 0.85; transition: opacity 0.15s ease; }
.ldm-trend-bar-col:hover .ldm-trend-bar { opacity: 1; }
.ldm-trend-bar-col span { font-size: 9.5px; color: var(--fg-dim); white-space: nowrap; }
.ldm-cat-bars { display: flex; flex-direction: column; gap: 10px; }
.ldm-cat-bar-row { display: grid; grid-template-columns: 140px 1fr 32px; align-items: center; gap: 12px; }
.ldm-cat-bar-label { font-size: 12.5px; color: var(--fg-dim); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ldm-cat-bar-track { height: 8px; border-radius: 999px; background: var(--surface); overflow: hidden; }
.ldm-cat-bar-fill { height: 100%; background: var(--fg); border-radius: 999px; }
.ldm-cat-bar-count { font-size: 12px; color: var(--fg-dim); text-align: right; }
.ldm-admin-form-actions { display: flex; gap: 12px; justify-content: flex-end; }
.ldm-admin-add-row { display: flex; gap: 10px; margin-bottom: 18px; }
.ldm-admin-add-row--sm { margin-bottom: 0; margin-top: 8px; }
.ldm-admin-add-row input { border: 1px solid var(--hairline); padding: 9px 12px; border-radius: 2px; font-size: 12.5px; flex: 1; }
.ldm-admin-cats { display: flex; flex-direction: column; gap: 16px; }
.ldm-admin-cat-block { border: 1px solid var(--hairline); border-radius: 8px; padding: 16px 18px; background: var(--surface); }
.ldm-admin-cat-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.ldm-admin-cat-head button { color: var(--fg-dim); }
.ldm-admin-subs { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 4px; }
.ldm-admin-sub-tag { font-size: 12px; background: var(--surface); padding: 5px 8px 5px 10px; border-radius: 999px; display: flex; align-items: center; gap: 6px; }
.ldm-admin-sub-tag button { color: var(--fg-dim); display: flex; }

/* orders (pedidos) */
.ldm-order-sort { display: flex; align-items: center; gap: 8px; color: var(--fg-dim); font-size: 12px; }
.ldm-order-sort select { border: 1px solid var(--hairline); padding: 7px 10px; border-radius: 2px; font-size: 12px; color: var(--fg); }
.ldm-order-subtabs { display: flex; gap: 8px; margin-bottom: 14px; flex-wrap: wrap; }
.ldm-order-subtabs button { padding: 8px 16px; border: 1px solid var(--hairline); border-radius: 999px; font-size: 11.5px; letter-spacing: 0.03em; color: var(--fg-dim); }
.ldm-order-subtabs button.is-active { background: var(--fg); color: var(--bg); border-color: var(--fg); }
.ldm-order-search { display: flex; align-items: center; gap: 8px; border: 1px solid var(--hairline); border-radius: 4px; padding: 10px 12px; margin-bottom: 18px; color: var(--fg-dim); }
.ldm-order-search input { flex: 1; font-size: 13px; color: var(--fg); }
.ldm-order-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 18px; }
.ldm-order-card { border: 1px solid var(--hairline); border-radius: 6px; padding: 16px; background: var(--bg); display: flex; flex-direction: column; gap: 10px; border-left: 4px solid var(--hairline); }
.ldm-order-card.is-pinned { box-shadow: 0 0 0 1px var(--fg); }
.ldm-order-card--green { border-left-color: #3c8a5b; }
.ldm-order-card--yellow { border-left-color: #d0a021; }
.ldm-order-card--red { border-left-color: #c1443a; }
.ldm-order-card--violet { border-left-color: #8656b8; }
.ldm-order-card-top { display: flex; justify-content: space-between; align-items: center; }
.ldm-order-number { font-size: 10.5px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--fg-dim); }
.ldm-order-pin { color: var(--fg-dim); padding: 4px; border-radius: 4px; }
.ldm-order-pin.is-active { color: var(--fg); background: var(--surface); }
.ldm-order-title { font-family: "Helvetica Neue", Arial, sans-serif; font-size: 16px; font-weight: 500; margin: 0; }
.ldm-order-date { font-size: 11px; color: var(--fg-dim); margin-top: -6px; }
.ldm-order-colors { display: flex; gap: 8px; }
.ldm-color-dot { width: 16px; height: 16px; border-radius: 50%; border: 2px solid transparent; box-shadow: 0 0 0 1px var(--hairline); }
.ldm-color-dot.is-selected { border-color: var(--bg); box-shadow: 0 0 0 2px currentColor; }
.ldm-order-rows { display: flex; flex-direction: column; gap: 5px; padding: 10px 0; border-top: 1px solid var(--hairline); border-bottom: 1px solid var(--hairline); }
.ldm-order-row { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--fg-dim); }
.ldm-order-row span { overflow-wrap: anywhere; }
.ldm-order-row--notes { align-items: flex-start; }
.ldm-order-items { display: flex; flex-direction: column; gap: 4px; }
.ldm-order-item-line { display: flex; align-items: center; gap: 6px; font-size: 11.5px; color: var(--fg-dim); }
.ldm-order-status { display: flex; flex-direction: column; gap: 8px; margin-top: 4px; }
.ldm-status-chip { align-self: flex-start; font-size: 11px; letter-spacing: 0.04em; padding: 5px 10px; border-radius: 999px; background: var(--surface); border: 1px solid var(--hairline); }
.ldm-status-buttons { display: flex; flex-wrap: wrap; gap: 6px; }
.ldm-status-buttons button { font-size: 10.5px; padding: 5px 9px; border: 1px solid var(--hairline); border-radius: 999px; color: var(--fg-dim); }
.ldm-status-buttons button.is-active { background: var(--fg); color: var(--bg); border-color: var(--fg); }
.ldm-status-buttons button:hover { border-color: var(--fg); }
.ldm-status-input-row { display: flex; gap: 6px; }
.ldm-status-input-row input { flex: 1; border: 1px solid var(--hairline); padding: 8px 10px; border-radius: 2px; font-size: 12px; }
.ldm-status-input-row button { border: 1px solid var(--hairline); padding: 0 10px; border-radius: 2px; color: var(--fg-dim); }
.ldm-status-input-row button:hover { color: var(--fg); border-color: var(--fg); }
.ldm-order-actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 4px; border-top: 1px solid var(--hairline); padding-top: 12px; }
.ldm-order-action-btn { display: flex; align-items: center; gap: 6px; font-size: 11px; padding: 8px 12px; border: 1px solid var(--hairline); border-radius: 4px; color: var(--fg-dim); }
.ldm-order-action-btn:hover { border-color: var(--fg); color: var(--fg); }
.ldm-order-action-btn--confirm { border-color: #3c8a5b; color: #3c8a5b; }
.ldm-order-action-btn--confirm:hover { background: #3c8a5b; color: #fff; border-color: #3c8a5b; }
.ldm-order-action-btn--delete { border-color: #c1443a; color: #c1443a; }
.ldm-order-action-btn--delete:hover { background: #c1443a; color: #fff; border-color: #c1443a; }

@media (max-width: 1080px) {
  .ldm-grid { grid-template-columns: repeat(2, 1fr); }
  .ldm-product { grid-template-columns: 1fr; }
  .ldm-admin-form-grid { grid-template-columns: 1fr; }
  .ldm-admin-body { flex-direction: column; }
  .ldm-admin-tabs { width: 100%; flex-direction: row; border-right: none; border-bottom: 1px solid var(--hairline); }
  .ldm-quality-showcase { grid-template-columns: 1fr; gap: 30px; margin-bottom: 50px; }
  .ldm-quality-photos img:first-child { margin-top: 0; }
}
@media (max-width: 620px) {
  .ldm-grid { grid-template-columns: repeat(2, 1fr); gap: 14px; }
  .ldm-section { padding: 50px 6vw; }
  .ldm-benefits { padding: 16px 6vw; gap: 16px 24px; }
  .ldm-admin-variant-row { grid-template-columns: 1fr 1fr 1fr auto; }
  .ldm-admin-form-grid { grid-template-columns: 1fr; }
  .ldm-checkout-grid { grid-template-columns: 1fr; }
  .ldm-panel { padding: 22px 18px; }
  /* larger touch targets on mobile — icons alone are ~18-20px, well under the
     44px accessibility guideline once you factor in real thumb precision */
  .ldm-nav-icon { padding: 11px; }
  .ldm-chip { padding: 9px 14px; }
  .ldm-chip--sm { padding: 9px 12px; }
  .ldm-qty-stepper button { padding: 6px; }
  .ldm-drawer-sub, .ldm-drawer-cat-head { padding-top: 14px; padding-bottom: 14px; }
  .ldm-card-info { gap: 6px; }
  .ldm-footer-top { gap: 32px; }
  .ldm-footer-cols { gap: 32px; }
}
`;
