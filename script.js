import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Menu, X, ShoppingBag, Star, ChevronDown, Plus, Minus,
  Trash2, Pencil, Check, Lock, LogOut, Eye, EyeOff, ArrowLeft, Upload, Search, SlidersHorizontal, Tag, Moon, Sun
} from "lucide-react";

/* ========================================================================
   LADOBLEM — minimalist luxury storefront
   Prototype storefront + admin CMS. Persists via the artifact storage API
   (window.storage) so it behaves like a real database inside this demo.
   ======================================================================== */

// Brand mark provided by the client. Admins can replace it from the admin panel
// (stored in shared storage), which overrides this default.
const DEFAULT_LOGO_SRC = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/7QCEUGhvdG9zaG9wIDMuMAA4QklNBAQAAAAAAGgcAigAYkZCTUQwYTAwMGFkZjAxMDAwMGU5MDIwMDAwMTIwNDAwMDAxZTA0MDAwMDJhMDQwMDAwNzMwNjAwMDBkMzA4MDAwMDJjMDkwMDAwMzgwOTAwMDA0NDA5MDAwMDgyMGIwMDAwAP/bAIQABQYGCwgLCwsLCw0LCwsNDg4NDQ4ODw0ODg4NDxAQEBEREBAQEA8TEhMPEBETFBQTERMWFhYTFhUVFhkWGRYWEgEFBQUKBwoICQkICwgKCAsKCgkJCgoMCQoJCgkMDQsKCwsKCw0MCwsICwsMDAwNDQwMDQoLCg0MDQ0MExQTExOc/8IAEQgAlgCWAwEiAAIRAQMRAf/EAKoAAQEAAwADAQAAAAAAAAAAAAAHBQYIAQMEAhAAAAUCBQMDBQAAAAAAAAAAAQIDBAUABhESExQwMzRgEBVAISMxMlARAAIAAwMGCAwFBQAAAAAAAAECAAMREiFBEDAxUXGxIjJhcoGhwdEEEzNCUmJzkbLC4fAUICNAgkNQYKLxEgEAAQMCBQQBBAMAAAAAAAABEQAhMUFRYXGBkaEQMLHwwUDR4fEgUGD/2gAMAwEAAgADAAAAAbKAAAAAAAABGrLGiygAAAYrIwUvzx5AAAEassaLKAAB8Hwzk2z0+7EH2b3Kv2Vlpe6AACNWWNFlAAJ0bTnOb62aLR+buuCPWLjjqI+3McwWk3YACNWWNFlAAgd8ipKM1svoNQ635M6zOOs/8eYNYrOG2sq4AEassaLKABF7REzY8/g6McodXcm3QiN/gHVpJ/36/BWgAI1ZY0WUADnPozVjWadG6ockXaT9THJfXHJfWJIcN76uZwACNWWNFlAABhcFu+ONS34JftWzY4+XNgAAjVljRZQAAAAAAAAI1ZY0WVGhZUaFlRoWVGhZUaFlRoWVGhZUaFlRoWWNB//aAAgBAQABBQL+eVwAq/BMOAJxypTfAO4TIZeU0ze6jmRmimpNQFC8p3pEzi2VdCtHnOOzTzGgjAKzlVJtFujrF5NuidWpaSFY6zAgt4WUERpNJJI/HMyW3CFd6TiYe7dJr1axwGNeblKReCq4iZHdE4rgQAh8glB68M8O16tYYizfGbBpjlt5AB47m/KTfVj4FrqrN+vTTry7bQXft9FpbfT4rmqBLmbRjLappdxTHuJFhuquTp230+K4zgare7eiGAq/u4ZGPcVcn6W6cCp8U63017cN9mhHEXDTCPaDgrVym+lvN8ynFJsd0lbphIZyfInHNtwsYoGBdIWyoDiE7iu4YtAbJ8ZmhdWbWyN4aP2xKnI7VCLW1W6LQpD8pm5TH9Um5Uh8A//aAAgBAwABPwHyT//aAAgBAgABPwHyT//aAAgBAQEGPwL+3vKxUKffX9kSdEL4T4vgW7Xi77QSur9iFZwGbQK3mHAku6y+O2AiolVkB7Bm1x0aNVYFuWyA+dxhAYaGAI2HPOrkKEVWtE+lXuiY62LJmijEG2VBFKHBQIm0mWEmsC12lbNCOqKDwn9EvXxV1CwvpXshSpW6tdZN9OTVBlPKaWyIoVwaqbNMRoug2r7PnY9NLukZ0vRWmKANdnTS7DJ+HlHg1ssfSOrZHiANC8HnDH3wJE08xvl7shs0V3FSourTGznLCeUbH0R3wKm6bwTtOjri7jvcvaYl89d+SogN5wubaPusNMU0smiEal+6xwvKJxuXlzaNpaZar0UoOgQr4Emm1ad8KeQKBy4+8xL5678lBiYmgf1FpsOvfFvCtnppWGmaGVqbVI0e+/Nyf5/LDHGXMLdFBXqi0eLLv6cO+E9ovxZJXtF+KG9F+EOn6x4OMSSx2sImc/szcn+fywQdBdtwgriWJPZ1QvtR8WSV7Rd8SvUe/mYxL5x3RM5/Zm5NDWhmA7RZg887hkBOgTK/7Qs0rSU0wpXGlLj76xJ9ou/JK5x3Q1TQtMoOXg5sthM4XTjDjU+8DKFxRQ/TpO8xKPrrvySRzuyDMwQXbW+mbs+eL12/WJ0prjcabLjExtSMeqETCtW2DTBB0G6Cp8xv+dUViXKQVNnrY90BB0nWc4s4XOLj6w5YYYzKKPvZFpvKPp5Bq78njUHDXSNa/SJZ1Cydq3Q83TMfHUMAM8Ha8rxdQ5dv5GK3W7yMK6/8B//aAAgBAQIBPyH/AF+PHPp+KDv+iG0AK8jNImV9cvA6mDSVtcoZJMP6DOszB0OdTumBxBArrNnhTOYJA5JLXcD+bU7JZAJKTZiEWLWpB5YsSEluXvMAaQJkYD7ZofpNnwqNQtduUUwkALAnOHcOG9SxxbzYSM94dXzTI8WkT5kGU4SSryDA0Hj0Lej2JgFop0EnbXh2H3VYTqUQu4hveJ9LHcIXKxdsc7vDKsEXG1w5nLm1OgcJm2p+tNqijsmELCeBzQ5+45vAz2M82nV2pNxCupKeOHWpMcT7x+weUr7/AG04qc5CMiZEaB/Y/N1I6qWHcBCWBHiz1VNkLBog4PPXjzPbmSobdoSNDuMtaKgI4h+FNQZPuTV6RX3+2nFTjJYA3VqVq74p0DTzW4JPCUSCyHa8o6A8Pb8H5UhMtfkH83SrDSPft+fRQgdviU4oyH3hUbCOx5nSXSKnsjlaHwQdK8V7fLloIdIKbiDUsXcOEx4x5r6EuK+/20KVrDxrHwehvhPj7cmKwDMIEdk9ZqjQFOwSfFQQJq6AuTiJGhxy/p6fXQbCAVuoMG9r+22kcNtHnfrU24X6+FLBO1TDurSwuLbS+OjhY/j6c4r7B/NM/puy/Pue2TCC6/B4C3Z0oDEbiyLfkK/qSFVlJ+Y+7HWgCkFHBIfFZ7rXEGV1g0ZDCD3oRUwAbh+ArtV75L7zl/BwD3FWGKmHIjiLI8IbYgnMLVll8GnU4hh2+bXs09GOYMFneOPkcihm5R+g2nrSsvbvk7IAJ312PdPaPY5XIN27jSP8BriofbGimYzz/wCB/9oADAMBAAIAAwIAABDzzzzzzzzyjzzzzjTzzyjzzyQCTTzyjzzhCgjDzyjzzzghhTzyjzygCCQjzyjzygSDQjzyjzzwxyjzzyjzzzzzzzzyjDDDDDDDDCD/2gAIAQMAAT8Q8k//2gAIAQIAAT8Q8k//2gAIAQECAT8Q/wBfZRkW96t1nL+iakTLgKU9J9IkYtRyDJJCRMI4f0DCrBIFgjK9hu2L0txIr4oaE0NEeJ0QpMpRuAC9vLsYUmveQoJJQkosk+8QJEQj2YpslwG/fF8Yz1qreFuPbEkiSwr9/W03HlC+Diu3bzrT0DhzMdIH2xInA25Znu85sUSxMAuB6FJlCL4OakC6RoMDyzvqlg91y6lx1oSG41oKpMgZalLr7i/9dq03iybYoADOYUzGc6rjrp9hMeft6Snm61dBPhEgEdxp3jpAieSI6NKAxFUCGjYktCzEmlkExwe2aJLFGn91BE4JpufjvAnKjUnWsSYcWHIoRXebrRKCM2YADm1inJp+Np22pw97G4AdO4q2HEai4EN42PuOL5X0EqVepQmzbOlHg0O1WbrXF6h7cQ5HxePQ+CLXfU7PbF/6zTh6KZ52qzHKzNcAH29NZutGaSjvKefyfH1o0g+33588UwwyNLpVjXMDdTlr01zD1/GkPMihTehO1TxR4kMZzAK4e2LC04LBc4HTr+B0/dKJlgL2r+4wZr7iBA0rf0p3pga6lAZt23Cw5XfbMio/YXbnGzQ0mLez0rJZjzH+abFBwsx4eIrbIOTGO6pTs1tleMQiOQk+aeRu4gcg0IuqF62/8fx7gLVeM0M93U7JIU0uFuROcLqVADS1M33Ex6FrlaWF+Jftu7Fc9BTlzzBRoyzsEA6KLLJ0e8I8aL2E0O0ZkAZJ9UNawbB4XLRAUy/4H//Z";

const LogoMark = ({ size = "", src, onClick }) => {
  const logo = src || DEFAULT_LOGO_SRC;
  return logo ? (
    <img src={logo} alt="Ladoblem" className={`ldm-logomark ${size}`} onClick={onClick} style={onClick ? { cursor: "pointer" } : undefined} />
  ) : (
    <svg viewBox="0 0 40 40" className={`ldm-logomark ${size}`} onClick={onClick} style={onClick ? { cursor: "pointer" } : undefined} fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 30 L6 10 L14 22 L20 10 L20 30" />
      <path d="M20 30 L20 10 L28 22 L34 10 L34 30" />
    </svg>
  );
};

/* ---------------------------- storage hook ----------------------------- */
function useStoredState(key, initial, shared = false) {
  const [state, setState] = useState(initial);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await window.storage?.get(key, shared);
        if (!cancelled && r && r.value != null) setState(JSON.parse(r.value));
      } catch (e) { /* no stored value yet */ }
      finally { if (!cancelled) setReady(true); }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line
  }, [key]);
  useEffect(() => {
    if (!ready) return;
    (async () => { try { await window.storage?.set(key, JSON.stringify(state), shared); } catch (e) {} })();
    // eslint-disable-next-line
  }, [state, ready]);
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
        const r = await window.storage?.get(cacheKey, true);
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
  (async () => { try { await window.storage?.set(key, dataUrl, true); } catch (e) { /* best effort */ } })();
}

function deleteImageFromStore(id) {
  const key = `img-${id}`;
  imageMemoryCache.delete(key);
  (async () => { try { await window.storage?.delete(key, true); } catch (e) { /* already gone */ } })();
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
    city: "Ciudad", zip: "Código postal", cardNumber: "Número de tarjeta", total: "Total", confirmOrder: "Confirmar Pedido",
    orderConfirmed: "Pedido confirmado.", orderConfirmedNote: "Hemos enviado una confirmación a tu correo.", continue: "Continuar",
    wishlist: "Favoritos", nothingSaved: "Aún no has guardado nada.", remove: "Eliminar",
    store: "Tienda", customerCare: "Atención al Cliente", shipments: "Envíos", returns: "Devoluciones", rights: "Todos los derechos reservados.",
    darkMode: "Modo Oscuro", lightMode: "Modo Claro",
    reviews: "Reseñas", writeReview: "Escribir una Reseña", reviewPlaceholder: "Cuéntanos qué te pareció este producto...",
    submitReview: "Publicar Reseña", noReviews: "Aún no hay reseñas para este producto.",
    mustPurchaseToReview: "Compra este producto para poder dejar una reseña.", rating: "Calificación",
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
    city: "City", zip: "Postal code", cardNumber: "Card number", total: "Total", confirmOrder: "Confirm Order",
    orderConfirmed: "Order confirmed.", orderConfirmedNote: "We've sent a confirmation to your email.", continue: "Continue",
    wishlist: "Wishlist", nothingSaved: "You haven't saved anything yet.", remove: "Remove",
    store: "Shop", customerCare: "Customer Care", shipments: "Shipping", returns: "Returns", rights: "All rights reserved.",
    darkMode: "Dark Mode", lightMode: "Light Mode",
    reviews: "Reviews", writeReview: "Write a Review", reviewPlaceholder: "Tell us what you thought of this product...",
    submitReview: "Post Review", noReviews: "No reviews yet for this product.",
    mustPurchaseToReview: "Purchase this product to leave a review.", rating: "Rating",
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
const Plate = ({ product, tone = 0, className = "" }) => {
  const tones = [
    "linear-gradient(160deg, var(--panel) 0%, var(--panel-2) 100%)",
    "linear-gradient(200deg, var(--panel-2) 0%, var(--panel) 100%)",
    "linear-gradient(135deg, var(--panel-3) 0%, var(--panel-2) 100%)",
  ];
  const img = product?.images?.[0];
  const resolvedSrc = useResolvedImageSrc(img);
  const [imgError, setImgError] = useState(false);
  useEffect(() => { setImgError(false); }, [resolvedSrc]);
  const showImg = !!resolvedSrc && !imgError;
  return (
    <div className={`ldm-plate ${className}`} style={{ background: tones[tone % tones.length] }}>
      {showImg ? (
        <img src={resolvedSrc} alt={product.name} className="ldm-plate-img" onError={() => setImgError(true)} />
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
  { id: "ladoblem", label: "Ladoblem" },
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
const TAG_LABELS = { trending: "Trending", "new-season": "New Season", bestseller: "Best Sellers" };

/* ============================ TOP NAV ==================================== */
const TopNav = ({ onMenu, onCart, onWishlist, cartCount, wishCount, solid, logoSrc, onLogo, products, currency, openProduct, t, theme, onToggleTheme }) => {
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
        <button className="ldm-nav-icon" onClick={onToggleTheme} aria-label={theme === "light" ? t.darkMode : t.lightMode}>
          {theme === "light" ? <Moon size={18} strokeWidth={1.4} /> : <Sun size={18} strokeWidth={1.4} />}
        </button>
      </div>
      <button className="ldm-nav-logo" onClick={onLogo} aria-label="Ladoblem — home">
        <LogoMark src={logoSrc} />
        <span>LADOBLEM</span>
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
const SideMenu = ({ open, onClose, categories, brands, onNavigate, onNavigateBrand, currency, setCurrency, t }) => {
  const [expanded, setExpanded] = useState(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [currencyOpen, setCurrencyOpen] = useState(false);

  useEffect(() => { if (!open) { setCurrencyOpen(false); setAccountOpen(false); } }, [open]);

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
                    <button key={b.id} className="ldm-drawer-sub" onClick={() => onNavigateBrand(b.id)}>{b.label}</button>
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
          <button className="ldm-drawer-account" onClick={() => setAccountOpen((v) => !v)}>
            {t.account} <ChevronDown size={14} strokeWidth={1.4} className={`ldm-chev ${accountOpen ? "is-open" : ""}`} />
          </button>
          {accountOpen && <p className="ldm-drawer-account-note">{t.accountNote}</p>}

          <div className="ldm-currency-select">
            <button className="ldm-currency-btn" onClick={() => setCurrencyOpen((v) => !v)}>
              {currency} <ChevronDown size={13} strokeWidth={1.4} className={`ldm-chev ${currencyOpen ? "is-open" : ""}`} />
            </button>
            {currencyOpen && (
              <div className="ldm-currency-menu">
                {Object.entries(CURRENCIES).map(([code, c]) => (
                  <button key={code} className={`ldm-currency-opt ${currency === code ? "is-active" : ""}`} onClick={() => { setCurrency(code); setCurrencyOpen(false); }}>
                    {c.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
};

/* ============================ PRODUCT CARD ================================ */
const ProductCard = ({ product, currency, onOpen, wishlist, toggleWish }) => {
  const inWish = wishlist.includes(product.id);
  return (
    <div className="ldm-card">
      <div className="ldm-card-media">
        <button className="ldm-card-media-btn" onClick={() => onOpen(product)}>
          <Plate product={product} tone={product.tone} className="ldm-card-plate" />
          {product.tags?.length > 0 && (
            <span className="ldm-card-tag">{TAG_LABELS[product.tags[0]]}</span>
          )}
        </button>
        <button className={`ldm-card-wish ${inWish ? "is-active" : ""}`} onClick={() => toggleWish(product.id)} aria-label="Toggle favorite">
          <Star size={15} strokeWidth={1.4} fill={inWish ? "currentColor" : "none"} />
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
const Home = ({ products, currency, setPage, openProduct, wishlist, toggleWish, t }) => {
  const visible = products.filter((p) => p.visible);
  const picked = visible.filter((p) => p.featured);
  const featured = (picked.length > 0 ? picked : visible).slice(0, 4);
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

      <section className="ldm-section">
        <Reveal className="ldm-section-head">
          <span className="ldm-eyebrow">{t.curated}</span>
          <h2 className="ldm-h2">{t.thisSeason}</h2>
        </Reveal>
        <div className="ldm-grid">
          {featured.map((p, i) => (
            <Reveal key={p.id} delay={i * 80}>
              <ProductCard product={p} currency={currency} onOpen={openProduct} wishlist={wishlist} toggleWish={toggleWish} />
            </Reveal>
          ))}
        </div>
        <Reveal className="ldm-center-cta">
          <button className="ldm-btn ldm-btn--outline" onClick={() => setPage("shop")}>{t.viewFull}</button>
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

const Shop = ({ products, currency, openProduct, wishlist, toggleWish, activeCategory, activeSub, activeBrand, categories, brands, t }) => {
  const [cat, setCat] = useState(activeCategory || "all");
  const [sub, setSub] = useState(activeSub || null);
  const [brand, setBrand] = useState(activeBrand || null);
  const [size, setSize] = useState(null);
  const [color, setColor] = useState(null);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [tag, setTag] = useState(null);
  const [sort, setSort] = useState("newest");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const visible = products.filter((p) => p.visible);
  const priceCeil = Math.max(...visible.map((p) => p.price), 100);
  const [maxPrice, setMaxPrice] = useState(priceCeil);

  useEffect(() => { setCat(activeCategory || "all"); setSub(activeSub || null); setBrand(activeBrand || null); }, [activeCategory, activeSub, activeBrand]);
  useEffect(() => { setMaxPrice(priceCeil); }, [priceCeil]);

  const inCategory = visible.filter((p) => (cat === "all" || p.category === cat));
  const allSizes = [...new Set(inCategory.flatMap((p) => p.variants.map((v) => v.size)))];
  const allColors = [...new Set(inCategory.flatMap((p) => p.variants.map((v) => v.color)))];
  const currentCat = categories.find((c) => c.id === cat);

  let items = inCategory.filter((p) =>
    (!sub || p.subcategory === sub) &&
    (!brand || p.brand === brand) &&
    (!size || p.variants.some((v) => v.size === size && Number(v.stock) > 0)) &&
    (!color || p.variants.some((v) => v.color === color)) &&
    p.price <= maxPrice &&
    (!inStockOnly || fmtStock(p.variants) > 0) &&
    (!tag || (p.tags || []).includes(tag))
  );

  if (sort === "price-asc") items = [...items].sort((a, b) => a.price - b.price);
  else if (sort === "price-desc") items = [...items].sort((a, b) => b.price - a.price);
  else if (sort === "popular") items = [...items].sort((a, b) => (b.popularity || 0) - (a.popularity || 0));

  const resetFilters = () => { setSize(null); setColor(null); setBrand(null); setInStockOnly(false); setTag(null); setMaxPrice(priceCeil); setSort("newest"); };

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
              {Object.entries(TAG_LABELS).map(([id, label]) => (
                <button key={id} className={`ldm-chip ldm-chip--sm ${tag === id ? "is-active" : ""}`} onClick={() => setTag(tag === id ? null : id)}>{label}</button>
              ))}
            </div>
          </div>

          {allSizes.length > 0 && (
            <div className="ldm-filter-panel-row">
              <span className="ldm-variant-label">{t.size}</span>
              <div className="ldm-chip-row">
                {allSizes.map((s) => (
                  <button key={s} className={`ldm-chip ldm-chip--sm ${size === s ? "is-active" : ""}`} onClick={() => setSize(size === s ? null : s)}>{s}</button>
                ))}
              </div>
            </div>
          )}

          {allColors.length > 0 && (
            <div className="ldm-filter-panel-row">
              <span className="ldm-variant-label">{t.color}</span>
              <div className="ldm-chip-row">
                {allColors.map((c) => (
                  <button key={c} className={`ldm-chip ldm-chip--sm ${color === c ? "is-active" : ""}`} onClick={() => setColor(color === c ? null : c)}>{c}</button>
                ))}
              </div>
            </div>
          )}

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
            <ProductCard product={p} currency={currency} onOpen={openProduct} wishlist={wishlist} toggleWish={toggleWish} />
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
  const sizes = [...new Set(product.variants.map((v) => v.size))];
  const colors = [...new Set(product.variants.map((v) => v.color))];
  const [size, setSize] = useState(null);
  const [color, setColor] = useState(colors[0] || null);
  const [qty, setQty] = useState(1);
  const [toast, setToast] = useState(false);

  useEffect(() => { setSize(null); setColor(colors[0] || null); setQty(1); }, [product]);

  const activeVariant = product.variants.find((v) => v.size === size && v.color === color);
  const stock = activeVariant ? Number(activeVariant.stock) : 0;
  const inWish = wishlist.includes(product.id);

  const handleAdd = () => {
    if (!size || stock <= 0) return;
    addToCart({ ...product, size, color, qty: Math.min(qty, stock) });
    setToast(true);
    setTimeout(() => setToast(false), 2000);
  };

  return (
    <section className="ldm-product">
      <div className="ldm-product-gallery">
        <Plate product={product} tone={product.tone} className="ldm-product-plate" />
        <button className={`ldm-wish-btn ldm-wish-btn--overlay ${inWish ? "is-active" : ""}`} onClick={() => toggleWish(product.id)} aria-label="Toggle favorite">
          <Star size={18} strokeWidth={1.4} fill={inWish ? "currentColor" : "none"} />
        </button>
      </div>
      <div className="ldm-product-info">
        <span className="ldm-eyebrow">{product.category}{product.subcategory ? ` / ${product.subcategory}` : ""}</span>
        <h1 className="ldm-h1 ldm-product-title">{product.name}</h1>
        <p className="ldm-product-price">{formatPrice(product.price, currency)}</p>

        <div className="ldm-variant-block">
          <span className="ldm-variant-label">{t.color} — {color}</span>
          <div className="ldm-chip-row">
            {colors.map((c) => (
              <button key={c} className={`ldm-chip ldm-chip--sm ${color === c ? "is-active" : ""}`} onClick={() => setColor(c)}>{c}</button>
            ))}
          </div>
        </div>

        <div className="ldm-variant-block">
          <span className="ldm-variant-label">{t.size} {size ? `— ${size}` : ""}</span>
          <div className="ldm-chip-row">
            {sizes.map((s) => {
              const v = product.variants.find((vv) => vv.size === s && vv.color === color);
              const out = !v || Number(v.stock) <= 0;
              return (
                <button key={s} disabled={out} className={`ldm-chip ldm-chip--sm ${size === s ? "is-active" : ""} ${out ? "is-disabled" : ""}`} onClick={() => setSize(s)}>{s}</button>
              );
            })}
          </div>
          {!size && <span className="ldm-size-warn">{t.selectSize}</span>}
          {size && stock > 0 && stock <= 5 && <span className="ldm-size-warn ldm-size-warn--low">{t.left(stock)}</span>}
        </div>

        <div className="ldm-variant-block ldm-qty-row">
          <span className="ldm-variant-label">{t.qty}</span>
          <div className="ldm-qty-stepper">
            <button onClick={() => setQty((q) => Math.max(1, q - 1))}><Minus size={13} strokeWidth={1.4} /></button>
            <span>{qty}</span>
            <button onClick={() => setQty((q) => Math.min(stock || 1, q + 1))}><Plus size={13} strokeWidth={1.4} /></button>
          </div>
        </div>

        <button
          className={`ldm-btn ldm-btn--solid ldm-add-btn ${(!size || stock <= 0) ? "is-disabled" : ""}`}
          onClick={handleAdd}
          disabled={!size || stock <= 0}
        >
          {!size ? t.selectSizeBtn : stock <= 0 ? t.outOfStock : t.addToBag}
        </button>

        <p className="ldm-product-desc">{product.desc}</p>

        <ReviewsSection product={product} canReview={purchasedIds.includes(product.id)} t={t} />
      </div>
      {toast && <div className="ldm-toast"><Check size={14} strokeWidth={1.6} /> {t.added}</div>}
    </section>
  );
};

/* =============================== BAG DRAWER ================================ */
const BagDrawer = ({ open, onClose, cart, currency, updateQty, removeItem, setPage, t, onOrderConfirmed }) => {
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
                    <p className="ldm-panel-item-meta">{item.color} — {item.size}</p>
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
          <CheckoutStep subtotal={subtotal} currency={currency} cart={cart} onBack={() => setStep("bag")} onClose={onClose} t={t} onOrderConfirmed={onOrderConfirmed} />
        )}
      </aside>
    </>
  );
};

const CheckoutStep = ({ subtotal, currency, cart, onBack, onClose, t, onOrderConfirmed }) => {
  const [done, setDone] = useState(false);
  const confirm = () => {
    setDone(true);
    onOrderConfirmed?.(cart.map((i) => i.id));
  };
  if (done) {
    return (
      <div className="ldm-panel-empty">
        <p className="ldm-checkout-success">{t.orderConfirmed}</p>
        <p>{t.orderConfirmedNote}</p>
        <button className="ldm-btn ldm-btn--outline" onClick={onClose}>{t.continue}</button>
      </div>
    );
  }
  return (
    <div className="ldm-checkout">
      <button className="ldm-text-link" onClick={onBack}><ArrowLeft size={14} strokeWidth={1.4} /> {t.back}</button>
      <div className="ldm-checkout-form">
        <input placeholder={t.email} />
        <input placeholder={t.fullName} />
        <input placeholder={t.address} />
        <div className="ldm-checkout-grid"><input placeholder={t.city} /><input placeholder={t.zip} /></div>
        <input placeholder={t.cardNumber} />
        <div className="ldm-checkout-grid"><input placeholder="MM / YY" /><input placeholder="CVC" /></div>
      </div>
      <div className="ldm-panel-summary">
        <div className="ldm-summary-row"><span>{t.total}</span><span>{formatPrice(subtotal, currency)}</span></div>
        <button className="ldm-btn ldm-btn--solid ldm-full" onClick={confirm}>{t.confirmOrder}</button>
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
const Footer = ({ setPage, logoSrc, t }) => (
  <footer className="ldm-footer">
    <div className="ldm-footer-top">
      <button className="ldm-logo-mark" onClick={() => setPage("home")}><LogoMark size="ldm-logomark--lg" src={logoSrc} /><span>LADOBLEM</span></button>
      <div className="ldm-footer-cols">
        <div><span className="ldm-eyebrow">{t.store}</span><button onClick={() => setPage("shop")}>{t.collection}</button></div>
        <div><span className="ldm-eyebrow">{t.customerCare}</span><button>{t.shipments}</button><button>{t.returns}</button></div>
      </div>
    </div>
    <div className="ldm-footer-bottom">
      <span>© {new Date().getFullYear()} LADOBLEM. {t.rights}</span>
      <button className="ldm-footer-admin-link" onClick={() => setPage("admin")}>admin</button>
    </div>
  </footer>
);

/* ============================================================================
   ADMIN CMS
   ============================================================================ */
const ADMIN_CREDENTIALS = { user: "Martin", pass: "2026doblemj" };

const AdminLogin = ({ onSuccess, onExit, logoSrc }) => {
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const submit = () => {
    const userWrong = user.trim() !== ADMIN_CREDENTIALS.user;
    const passWrong = pass !== ADMIN_CREDENTIALS.pass;
    if (userWrong && passWrong) { setError("Credenciales inválidas."); return; }
    if (userWrong) { setError("Usuario incorrecto."); return; }
    if (passWrong) { setError("Contraseña incorrecta."); return; }
    setError("");
    onSuccess();
  };
  const handleKeyDown = (e) => { if (e.key === "Enter") submit(); };
  return (
    <div className="ldm-admin-login">
      <div className="ldm-admin-login-card">
        <div className="ldm-logo-mark"><LogoMark size="ldm-logomark--lg" src={logoSrc} /><span>LADOBLEM</span></div>
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
        <button className="ldm-btn ldm-btn--solid ldm-full" type="button" onClick={submit}><Lock size={13} strokeWidth={1.6} /> Ingresar</button>
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
  visible: true,
  desc: "",
  tags: [],
  popularity: 50,
  variants: [{ id: `v${Date.now()}`, size: "", color: "", stock: 0 }],
});

const VARIANT_ICONS = ["jacket", "denim", "knit", "boot", "bag", "hat", "belt", "dress"];

/* small preview tile used inside the admin product form's image list */
const AdminImageThumb = ({ image, onRemove }) => {
  const src = useResolvedImageSrc(image);
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [src]);
  return (
    <div className="ldm-admin-image">
      {src && !failed ? (
        <img src={src} alt="" onError={() => setFailed(true)} />
      ) : (
        <div className="ldm-admin-image-placeholder">
          {failed ? "No se pudo cargar" : image.stored ? "Cargando…" : "Sin vista previa"}
        </div>
      )}
      <button onClick={onRemove} aria-label="Eliminar imagen"><Trash2 size={13} strokeWidth={1.4} /></button>
    </div>
  );
};

const ProductForm = ({ product, categories, brands, onSave, onCancel }) => {
  const [draft, setDraft] = useState(product);
  const fileInputRef = useRef(null);
  const cat = categories.find((c) => c.id === draft.category);

  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const setVariant = (idx, patch) => setDraft((d) => ({ ...d, variants: d.variants.map((v, i) => (i === idx ? { ...v, ...patch } : v)) }));
  const addVariantRow = () => setDraft((d) => ({ ...d, variants: [...d.variants, { id: `v${Date.now()}`, size: "", color: "", stock: 0 }] }));
  const removeVariantRow = (idx) => setDraft((d) => ({ ...d, variants: d.variants.filter((_, i) => i !== idx) }));
  const toggleTag = (tag) => setDraft((d) => ({ ...d, tags: (d.tags || []).includes(tag) ? d.tags.filter((t) => t !== tag) : [...(d.tags || []), tag] }));

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

        <label className="ldm-admin-field ldm-admin-field--full">Descripción
          <textarea rows={3} value={draft.desc} onChange={(e) => set({ desc: e.target.value })} />
        </label>
      </div>

      <div className="ldm-admin-subsection">
        <h3>Etiquetas de tendencia</h3>
        <div className="ldm-chip-row">
          {Object.entries(TAG_LABELS).map(([id, label]) => (
            <button key={id} type="button" className={`ldm-chip ldm-chip--sm ${(draft.tags || []).includes(id) ? "is-active" : ""}`} onClick={() => toggleTag(id)}>{label}</button>
          ))}
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
          <input placeholder="Pegar URL de imagen" value={urlDraft} onChange={(e) => setUrlDraft(e.target.value)} />
          <button className="ldm-btn ldm-btn--outline" onClick={() => { addImageUrl(urlDraft); setUrlDraft(""); }}>Añadir URL</button>
          <button className="ldm-btn ldm-btn--outline" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            <Upload size={13} strokeWidth={1.4} /> {uploading ? "Subiendo…" : "Subir"}
          </button>
          <input type="file" accept="image/*" ref={fileInputRef} style={{ display: "none" }} onChange={handleFile} />
        </div>
        {uploadError && <p className="ldm-admin-upload-error">{uploadError}</p>}
      </div>

      <div className="ldm-admin-subsection">
        <h3>Variantes (talla / color / stock)</h3>
        <div className="ldm-admin-variant-table">
          {draft.variants.map((v, i) => (
            <div className="ldm-admin-variant-row" key={v.id}>
              <input placeholder="Talla" value={v.size} onChange={(e) => setVariant(i, { size: e.target.value })} />
              <input placeholder="Color" value={v.color} onChange={(e) => setVariant(i, { color: e.target.value })} />
              <input type="number" placeholder="Stock" value={v.stock} onChange={(e) => setVariant(i, { stock: Number(e.target.value) })} />
              <button onClick={() => removeVariantRow(i)} aria-label="Eliminar variante"><Trash2 size={13} strokeWidth={1.4} /></button>
            </div>
          ))}
        </div>
        <button className="ldm-text-link" onClick={addVariantRow}><Plus size={13} strokeWidth={1.4} /> Añadir fila de variante</button>
      </div>

      <div className="ldm-admin-form-actions">
        <button className="ldm-btn ldm-btn--outline" onClick={onCancel}>Cancelar</button>
        <button className="ldm-btn ldm-btn--solid" onClick={() => onSave(draft)}>Guardar Producto</button>
      </div>
    </div>
  );
};

const ProductTable = ({ products, categories, onEdit, onDelete, onToggleVisible, onAdd }) => (
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

  return (
    <div className="ldm-admin-table-wrap">
      <div className="ldm-admin-table-head"><h2>Categorías</h2></div>
      <div className="ldm-admin-add-row">
        <input placeholder="Nueva categoría" value={newCat} onChange={(e) => setNewCat(e.target.value)} />
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
              {cat.subcategories.map((s) => (
                <span key={s} className="ldm-admin-sub-tag">{s} <button onClick={() => deleteSub(cat.id, s)}><X size={11} strokeWidth={1.6} /></button></span>
              ))}
            </div>
            <div className="ldm-admin-add-row ldm-admin-add-row--sm">
              <input placeholder="Nueva subcategoría" value={subDrafts[cat.id] || ""} onChange={(e) => setSubDrafts((d) => ({ ...d, [cat.id]: e.target.value }))} />
              <button className="ldm-btn ldm-btn--outline" onClick={() => addSub(cat.id)}>Añadir</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const BrandManager = ({ brands, setBrands }) => {
  const [newBrand, setNewBrand] = useState("");
  const addBrand = () => {
    if (!newBrand.trim()) return;
    const id = newBrand.trim().toLowerCase().replace(/\s+/g, "-");
    setBrands((b) => [...b, { id, label: newBrand.trim() }]);
    setNewBrand("");
  };
  const deleteBrand = (id) => setBrands((b) => b.filter((br) => br.id !== id));
  return (
    <div className="ldm-admin-table-wrap">
      <div className="ldm-admin-table-head"><h2>Marcas</h2></div>
      <div className="ldm-admin-add-row">
        <input placeholder="Nueva marca" value={newBrand} onChange={(e) => setNewBrand(e.target.value)} />
        <button className="ldm-btn ldm-btn--solid" onClick={addBrand}><Plus size={13} strokeWidth={1.6} /> Añadir Marca</button>
      </div>
      <div className="ldm-admin-subs">
        {brands.map((b) => (
          <span key={b.id} className="ldm-admin-sub-tag">{b.label} <button onClick={() => deleteBrand(b.id)}><X size={11} strokeWidth={1.6} /></button></span>
        ))}
        {brands.length === 0 && <p className="ldm-empty-note">Aún no hay marcas.</p>}
      </div>
    </div>
  );
};

const AdminDashboard = ({ products, setProducts, categories, setCategories, brands, setBrands, onLogout, onExit }) => {
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

  return (
    <div className="ldm-admin">
      <header className="ldm-admin-header">
        <div className="ldm-logo-mark"><LogoMark size="ldm-logomark--lg" /><span>LADOBLEM Admin</span></div>
        <div className="ldm-admin-header-actions">
          <button className="ldm-text-link" onClick={onExit}><ArrowLeft size={14} strokeWidth={1.4} /> Ver Tienda</button>
          <button className="ldm-text-link" onClick={onLogout}><LogOut size={14} strokeWidth={1.4} /> Cerrar Sesión</button>
        </div>
      </header>
      <div className="ldm-admin-body">
        <nav className="ldm-admin-tabs">
          <button className={tab === "products" ? "is-active" : ""} onClick={() => { setTab("products"); setEditing(null); }}>Productos</button>
          <button className={tab === "categories" ? "is-active" : ""} onClick={() => { setTab("categories"); setEditing(null); }}>Categorías</button>
          <button className={tab === "brands" ? "is-active" : ""} onClick={() => { setTab("brands"); setEditing(null); }}>Marcas</button>
        </nav>
        <main className="ldm-admin-main">
          {tab === "products" && (
            editing ? (
              <ProductForm
                product={editing === "new" ? emptyProduct(categories, brands) : editing}
                categories={categories}
                brands={brands}
                onSave={saveProduct}
                onCancel={() => setEditing(null)}
              />
            ) : (
              <ProductTable products={products} categories={categories} onEdit={setEditing} onDelete={deleteProduct} onToggleVisible={toggleVisible} onAdd={() => setEditing("new")} />
            )
          )}
          {tab === "categories" && <CategoryManager categories={categories} setCategories={setCategories} />}
          {tab === "brands" && <BrandManager brands={brands} setBrands={setBrands} />}
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
  const [products, setProducts] = useStoredState("ldm-products", DEFAULT_PRODUCTS, true);
  const [categories, setCategories] = useStoredState("ldm-categories", DEFAULT_CATEGORIES, true);
  const [brands, setBrands] = useStoredState("ldm-brands", DEFAULT_BRANDS, true);
  const [logoSrc] = useStoredState("ldm-logo", null, true);

  const t = STRINGS[lang] || STRINGS.es;

  const [page, setPage] = useState("home");
  const [product, setProduct] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [bagOpen, setBagOpen] = useState(false);
  const [wishOpen, setWishOpen] = useState(false);
  const [navFilter, setNavFilter] = useState({ category: null, sub: null, brand: null });
  const [solidNav, setSolidNav] = useState(false);
  // Admin session lives in the person's own (non-shared) storage, so once
  // they log in it stays valid across reloads until they explicitly log out.
  const [isAdmin, setIsAdmin, isAdminReady] = useStoredState("ldm-admin-session", false, false);
  const [purchasedIds, setPurchasedIds] = useStoredState("ldm-purchased", [], false);

  useEffect(() => {
    const onScroll = () => setSolidNav(window.scrollY > 30);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => { window.scrollTo(0, 0); }, [page, product]);

  const openProduct = useCallback((p) => { setProduct(p); setPage("product"); }, []);
  const navigateCategory = (category, sub) => { setNavFilter({ category, sub, brand: null }); setPage("shop"); setMenuOpen(false); };
  const navigateBrand = (brandId) => { setNavFilter({ category: null, sub: null, brand: brandId }); setPage("shop"); setMenuOpen(false); };

  const addToCart = (item) => setCart((c) => [...c, item]);
  const updateQty = (idx, qty) => setCart((c) => c.map((it, i) => (i === idx ? { ...it, qty } : it)));
  const removeItem = (idx) => setCart((c) => c.filter((_, i) => i !== idx));
  const toggleWish = (id) => setWishlist((w) => (w.includes(id) ? w.filter((x) => x !== id) : [...w, id]));
  const markPurchased = (ids) => {
    setPurchasedIds((p) => [...new Set([...p, ...ids])]);
    setCart([]);
  };

  const cartCount = cart.reduce((s, i) => s + i.qty, 0);

  if (page === "admin") {
    return (
      <div className="ldm-root" data-theme={theme}>
        <style>{CSS}</style>
        {!isAdminReady ? (
          <div className="ldm-admin-login"><p className="ldm-admin-loading">Cargando…</p></div>
        ) : isAdmin ? (
          <AdminDashboard
            products={products} setProducts={setProducts}
            categories={categories} setCategories={setCategories}
            brands={brands} setBrands={setBrands}
            onLogout={() => setIsAdmin(false)}
            onExit={() => setPage("home")}
          />
        ) : (
          <AdminLogin onSuccess={() => setIsAdmin(true)} onExit={() => setPage("home")} logoSrc={logoSrc} />
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
        logoSrc={logoSrc}
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
      />

      <main className="ldm-main">
        {page === "home" && <Home products={products} currency={currency} setPage={setPage} openProduct={openProduct} wishlist={wishlist} toggleWish={toggleWish} t={t} />}
        {page === "shop" && (
          <Shop products={products} currency={currency} openProduct={openProduct} wishlist={wishlist} toggleWish={toggleWish}
            activeCategory={navFilter.category} activeSub={navFilter.sub} activeBrand={navFilter.brand}
            categories={categories} brands={brands} t={t} />
        )}
        {page === "product" && product && (
          <ProductPage product={products.find((p) => p.id === product.id) || product} currency={currency} addToCart={addToCart} wishlist={wishlist} toggleWish={toggleWish} t={t} purchasedIds={purchasedIds} />
        )}
      </main>

      <Footer setPage={setPage} logoSrc={logoSrc} t={t} />

      <BagDrawer open={bagOpen} onClose={() => setBagOpen(false)} cart={cart} currency={currency} updateQty={updateQty} removeItem={removeItem} setPage={setPage} t={t} onOrderConfirmed={markPurchased} />
      <WishlistDrawer open={wishOpen} onClose={() => setWishOpen(false)} products={products} wishlist={wishlist} currency={currency} toggleWish={toggleWish} openProduct={(p) => { setWishOpen(false); openProduct(p); }} t={t} />
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
.ldm-root button, .ldm-root input, .ldm-root select, .ldm-root textarea { font-family: inherit; color: inherit; background: none; border: none; outline: none; }
.ldm-root button { cursor: pointer; }

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
.ldm-nav { position: fixed; top: 0; left: 0; right: 0; z-index: 100; display: flex; align-items: center; justify-content: space-between; padding: 18px 5vw; background: var(--bg); border-bottom: 1px solid transparent; transition: all 0.4s ease; }
.ldm-nav--solid { border-bottom-color: var(--hairline); }
.ldm-nav-icon { position: relative; padding: 6px; color: var(--fg); }
.ldm-nav-left { display: flex; align-items: center; gap: 4px; }
.ldm-nav-logo { display: flex; align-items: center; gap: 8px; font-family: "Helvetica Neue", Arial, sans-serif; font-size: 15px; letter-spacing: 0.24em; }
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
.ldm-drawer-foot { border-top: 1px solid var(--hairline); padding-top: 18px; display: flex; flex-direction: column; gap: 14px; }
.ldm-drawer-account { display: flex; justify-content: space-between; align-items: center; font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase; }
.ldm-drawer-account-note { font-size: 12px; color: var(--fg-dim); margin: -6px 0 0; }
.ldm-drawer-currency { display: flex; justify-content: space-between; align-items: center; font-size: 12px; letter-spacing: 0.06em; }
.ldm-drawer-currency select { border: 1px solid var(--hairline); padding: 6px 8px; border-radius: 2px; font-size: 12px; }

/* hero */
.ldm-hero { position: relative; height: 82vh; min-height: 520px; display: flex; align-items: flex-end; padding: 0 5vw 70px; overflow: hidden; background: var(--ink); margin-top: 0; }
.ldm-hero-croquis { position: absolute; right: -10%; top: 46%; transform: translateY(-50%); width: min(58vw, 640px); color: rgba(245,245,243,0.08); }
.ldm-hero-content { position: relative; z-index: 2; max-width: 600px; padding-top: 90px; }
.ldm-hero .ldm-eyebrow { color: rgba(245,245,243,0.6); }
.ldm-hero-title { font-family: "Helvetica Neue", Arial, sans-serif; font-weight: 500; color: #f5f5f3; font-size: clamp(2.2rem, 5.6vw, 4.4rem); line-height: 1; margin: 0 0 30px; }

/* sections */
.ldm-section { padding: 90px 5vw; max-width: 1440px; margin: 0 auto; }
.ldm-section-head { margin-bottom: 36px; }
.ldm-center-cta { text-align: center; margin-top: 44px; }
.ldm-main { padding-top: 62px; }

.ldm-reveal { opacity: 0; transform: translateY(24px); transition: opacity 0.7s cubic-bezier(.16,.84,.44,1), transform 0.7s cubic-bezier(.16,.84,.44,1); }
.ldm-reveal.is-shown { opacity: 1; transform: translateY(0); }

/* plate */
.ldm-plate { position: relative; aspect-ratio: 4/5; border-radius: 2px; overflow: hidden; display: flex; align-items: center; justify-content: center; }
.ldm-croquis { width: 42%; color: rgba(16,16,16,0.55); }
.ldm-root[data-theme='dark'] .ldm-croquis { color: rgba(245,245,243,0.75); }
.ldm-plate-img { width: 100%; height: 100%; object-fit: cover; }

/* grid & cards */
.ldm-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 24px; }
.ldm-card { position: relative; text-align: left; }
.ldm-card-media { display: block; width: 100%; position: relative; margin-bottom: 12px; }
.ldm-card-media-btn { display: block; width: 100%; }
.ldm-card-plate { width: 100%; }
.ldm-card-tag { position: absolute; top: 10px; left: 10px; background: var(--bg); color: var(--fg); font-size: 9.5px; letter-spacing: 0.08em; text-transform: uppercase; padding: 5px 9px; border-radius: 999px; border: 1px solid var(--hairline); }
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

.ldm-filter-panel { border: 1px solid var(--hairline); border-radius: 4px; padding: 14px 16px; margin-bottom: 18px; display: flex; flex-direction: column; gap: 12px; background: var(--surface); }
.ldm-filter-panel-row { display: flex; flex-direction: column; gap: 6px; }
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
.ldm-logo-mark { display: flex; align-items: center; gap: 10px; font-family: "Helvetica Neue", Arial, sans-serif; font-size: 16px; letter-spacing: 0.2em; }
.ldm-footer-cols { display: flex; gap: 5vw; flex-wrap: wrap; }
.ldm-footer-cols > div { display: flex; flex-direction: column; gap: 8px; }
.ldm-footer-cols button { text-align: left; font-size: 12.5px; color: var(--fg-dim); width: fit-content; }
.ldm-footer-bottom { font-size: 11px; color: var(--fg-dim); padding-top: 18px; border-top: 1px solid var(--hairline); display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.ldm-footer-admin-link { font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--hairline); opacity: 0.5; }
.ldm-footer-admin-link:hover { opacity: 1; color: var(--fg-dim); }

/* side panels (bag/wishlist) */
.ldm-panel { position: fixed; top: 0; right: 0; bottom: 0; width: min(440px, 100vw); background: var(--bg); z-index: 220; transform: translateX(100%); transition: transform 0.4s cubic-bezier(.16,.84,.44,1); display: flex; flex-direction: column; padding: 26px 28px; overflow-y: auto; }
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
.ldm-checkout-form { display: flex; flex-direction: column; gap: 10px; }
.ldm-checkout-form input { border: 1px solid var(--hairline); padding: 12px 14px; font-size: 13px; border-radius: 2px; width: 100%; }
.ldm-checkout-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.ldm-checkout-success { font-family: "Helvetica Neue", Arial, sans-serif; font-size: 20px; }

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
.ldm-admin-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 30px; background: var(--bg); border-bottom: 1px solid var(--hairline); }
.ldm-admin-header-actions { display: flex; gap: 22px; }
.ldm-admin-body { display: flex; min-height: calc(100vh - 65px); }
.ldm-admin-tabs { width: 200px; background: var(--bg); border-right: 1px solid var(--hairline); padding: 20px 0; display: flex; flex-direction: column; }
.ldm-admin-tabs button { text-align: left; padding: 12px 24px; font-size: 13px; color: var(--fg-dim); }
.ldm-admin-tabs button.is-active { color: var(--fg); background: var(--surface); font-weight: 500; }
.ldm-admin-main { flex: 1; padding: 30px; }

.ldm-admin-table-wrap { background: var(--bg); border: 1px solid var(--hairline); border-radius: 4px; padding: 24px; }
.ldm-admin-table-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.ldm-admin-table-head h2 { font-family: "Helvetica Neue", Arial, sans-serif; font-size: 18px; font-weight: 500; margin: 0; }
.ldm-admin-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.ldm-admin-table th { text-align: left; font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--fg-dim); padding: 10px 8px; border-bottom: 1px solid var(--hairline); }
.ldm-admin-table td { padding: 10px 8px; border-bottom: 1px solid var(--hairline); vertical-align: middle; }
.ldm-admin-thumb { width: 42px; border-radius: 2px; }
.ldm-admin-actions { display: flex; gap: 10px; }
.ldm-admin-actions button { color: var(--fg-dim); }
.ldm-admin-actions button:hover { color: var(--fg); }

.ldm-admin-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 18px; }
.ldm-admin-card { border: 1px solid var(--hairline); border-radius: 4px; overflow: hidden; display: flex; flex-direction: column; background: var(--bg); }
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
.ldm-admin-card-actions button:first-child { border-right: 1px solid var(--hairline); }
.ldm-admin-card-actions button:hover { color: var(--fg); background: var(--surface); }
.ldm-toggle { width: 34px; height: 18px; border-radius: 999px; background: var(--panel-3); position: relative; }
.ldm-toggle span { position: absolute; top: 2px; left: 2px; width: 14px; height: 14px; border-radius: 50%; background: var(--bg); transition: transform 0.25s ease; }
.ldm-toggle.is-on { background: var(--fg); }
.ldm-toggle.is-on span { transform: translateX(16px); background: var(--bg); }

.ldm-admin-form { background: var(--bg); border: 1px solid var(--hairline); border-radius: 4px; padding: 26px; }
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
.ldm-admin-form-actions { display: flex; gap: 12px; justify-content: flex-end; }
.ldm-admin-add-row { display: flex; gap: 10px; margin-bottom: 18px; }
.ldm-admin-add-row--sm { margin-bottom: 0; margin-top: 8px; }
.ldm-admin-add-row input { border: 1px solid var(--hairline); padding: 9px 12px; border-radius: 2px; font-size: 12.5px; flex: 1; }
.ldm-admin-cats { display: flex; flex-direction: column; gap: 16px; }
.ldm-admin-cat-block { border: 1px solid var(--hairline); border-radius: 3px; padding: 14px 16px; }
.ldm-admin-cat-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.ldm-admin-cat-head button { color: var(--fg-dim); }
.ldm-admin-subs { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 4px; }
.ldm-admin-sub-tag { font-size: 12px; background: var(--surface); padding: 5px 8px 5px 10px; border-radius: 999px; display: flex; align-items: center; gap: 6px; }
.ldm-admin-sub-tag button { color: var(--fg-dim); display: flex; }

@media (max-width: 1080px) {
  .ldm-grid { grid-template-columns: repeat(2, 1fr); }
  .ldm-product { grid-template-columns: 1fr; }
  .ldm-admin-form-grid { grid-template-columns: 1fr; }
  .ldm-admin-body { flex-direction: column; }
  .ldm-admin-tabs { width: 100%; flex-direction: row; border-right: none; border-bottom: 1px solid var(--hairline); }
}
@media (max-width: 620px) {
  .ldm-grid { grid-template-columns: 1fr; }
  .ldm-section { padding: 60px 6vw; }
  .ldm-admin-variant-row { grid-template-columns: 1fr 1fr 1fr auto; }
  .ldm-admin-form-grid { grid-template-columns: 1fr; }
}
`;