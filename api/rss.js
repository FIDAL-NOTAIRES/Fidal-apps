// api/rss.js — agrégateur de flux de presse pour la tuile PRESSE de FIDAL Apps
// Déployée automatiquement par Vercel avec le dépôt fidal-apps.
//
// Usage :
//   /api/rss?list=1                 → catalogue des sources uniquement
//   /api/rss?g=une                  → toutes les sources marquées "une"
//   /api/rss?g=juridique|eco|generale|all
//   /api/rss?ids=lemonde,dalloz     → sélection explicite
//   &max=120                        → nombre maximum d'articles renvoyés
//
// Ce fichier est la SOURCE DE VÉRITÉ du catalogue : pour ajouter, retirer ou
// corriger un journal, il suffit d'éditer le tableau SOURCES ci-dessous.
// Le lanceur récupère le catalogue avec le flux, il n'y a rien à changer
// dans index.html.

export const config = { maxDuration: 30 };

const SOURCES = [
  /* ---------- Juridique & notarial ---------- */
  { id:"village",  g:"juridique", n:"Village de la Justice", d:"village-justice.com", une:true,
    us:["https://www.village-justice.com/articles/spip.php?page=backend"] },
  { id:"actuju",   g:"juridique", n:"Actu-Juridique",        d:"actu-juridique.fr", une:true,
    us:["https://www.actu-juridique.fr/feed/"] },
  { id:"dalloz",   g:"juridique", n:"Dalloz Actualité",      d:"dalloz-actualite.fr", une:true,
    us:["https://www.dalloz-actualite.fr/rss/all",
        "https://www.dalloz-actualite.fr/flux-rss",
        "https://www.dalloz-actualite.fr/rss.xml"], gn:"dalloz-actualite.fr" },
  { id:"mdd",      g:"juridique", n:"Le Monde du Droit",     d:"lemondedudroit.fr", une:false,
    us:["https://www.lemondedudroit.fr/?format=feed&type=rss",
        "https://www.lemondedudroit.fr/feed"], gn:"lemondedudroit.fr" },
  { id:"notaires", g:"juridique", n:"Notaires de France",    d:"notaires.fr", une:true,
    us:["https://www.notaires.fr/fr/rss.xml"], gn:"notaires.fr" },
  { id:"legifr",   g:"juridique", n:"Légifrance — JO",       d:"legifrance.gouv.fr", une:false,
    us:["https://www.legifrance.gouv.fr/contenu/rss/jorf",
        "https://www.legifrance.gouv.fr/rss/jorf.xml"], gn:"legifrance.gouv.fr" },

  /* ---------- Économie & immobilier ---------- */
  { id:"echoseco", g:"eco", n:"Les Échos — Économie",  d:"lesechos.fr", une:true,
    us:["https://services.lesechos.fr/rss/les-echos-economie.xml",
        "https://www.lesechos.fr/rss/rss_economie.xml"], gn:"lesechos.fr" },
  { id:"echosune", g:"eco", n:"Les Échos — La une",    d:"lesechos.fr", une:false,
    us:["https://services.lesechos.fr/rss/la-une.xml",
        "https://www.lesechos.fr/rss/rss_une_titres.xml"] },
  { id:"tribune",  g:"eco", n:"La Tribune",            d:"latribune.fr", une:false,
    us:["https://www.latribune.fr/feed.xml"] },
  { id:"bimmo",    g:"eco", n:"Business Immo",         d:"businessimmo.com", une:true,
    us:["https://www.businessimmo.com/rss","https://www.businessimmo.com/rss.xml"],
    gn:"businessimmo.com" },
  { id:"figimmo",  g:"eco", n:"Le Figaro Immobilier",  d:"lefigaro.fr", une:true,
    us:["https://www.lefigaro.fr/rss/figaro_immobilier.xml"] },
  { id:"batiactu", g:"eco", n:"Batiactu",              d:"batiactu.com", une:false,
    us:["https://www.batiactu.com/rss/actualites.xml",
        "https://www.batiactu.com/flux-rss/actualite.xml"], gn:"batiactu.com" },
  { id:"msi",      g:"eco", n:"MySweetImmo",           d:"mysweetimmo.com", une:false,
    us:["https://www.mysweetimmo.com/feed/"] },

  /* ---------- Presse générale ---------- */
  { id:"lemonde",  g:"generale", n:"Le Monde",     d:"lemonde.fr", une:true,
    us:["https://www.lemonde.fr/rss/une.xml"] },
  { id:"lefigaro", g:"generale", n:"Le Figaro",    d:"lefigaro.fr", une:true,
    us:["https://www.lefigaro.fr/rss/figaro_actualites.xml"] },
  { id:"libe",     g:"generale", n:"Libération",   d:"liberation.fr", une:false,
    us:["https://www.liberation.fr/arc/outboundfeeds/rss-all/?outputType=xml"] },
  { id:"finfo",    g:"generale", n:"France Info",  d:"francetvinfo.fr", une:true,
    us:["https://www.francetvinfo.fr/titres.rss"] },
  { id:"lepoint",  g:"generale", n:"Le Point",     d:"lepoint.fr", une:false,
    us:["https://www.lepoint.fr/24h-infos/rss.xml","https://www.lepoint.fr/rss.xml"],
    gn:"lepoint.fr" },
  { id:"f24",      g:"generale", n:"France 24",    d:"france24.com", une:false,
    us:["https://www.france24.com/fr/rss"] }
];

const GROUPS = {
  juridique: "Juridique & notarial",
  eco:       "Économie & immobilier",
  generale:  "Presse générale"
};

/* ------------------------------------------------------------------ */
/* Outils de décodage                                                  */
/* ------------------------------------------------------------------ */

const NAMED = {
  amp:"&", lt:"<", gt:">", quot:'"', apos:"'", nbsp:" ", laquo:"«", raquo:"»",
  hellip:"…", eacute:"é", egrave:"è", ecirc:"ê", agrave:"à", ccedil:"ç",
  ugrave:"ù", ocirc:"ô", icirc:"î", ldquo:"“", rdquo:"”", rsquo:"’",
  lsquo:"‘", ndash:"–", mdash:"—", euro:"€", deg:"°", oelig:"œ", laqno:"«"
};

function decodeEntities(s) {
  if (!s) return "";
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (m, h) => cp(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (m, d) => cp(parseInt(d, 10)))
    .replace(/&([a-zA-Z]+);/g, (m, n) => (NAMED[n] !== undefined ? NAMED[n] : m));
}
function cp(n) { try { return String.fromCodePoint(n); } catch (e) { return ""; } }

function clean(s, limit) {
  if (!s) return "";
  let out = String(s)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ");
  out = decodeEntities(out).replace(/\s+/g, " ").trim();
  if (limit && out.length > limit) out = out.slice(0, limit).replace(/\s\S*$/, "") + "…";
  return out;
}

function tagValue(block, names) {
  for (const name of names) {
    const re = new RegExp("<" + name + "(?:\\s[^>]*)?>([\\s\\S]*?)<\\/" + name + ">", "i");
    const m = block.match(re);
    if (m && m[1] != null && m[1].trim() !== "") return m[1];
  }
  return "";
}

function itemLink(block) {
  // RSS : <link>url</link>  —  Atom : <link rel="alternate" href="url"/>
  const rss = block.match(/<link(?:\s[^>]*)?>([\s\S]*?)<\/link>/i);
  if (rss && rss[1].trim()) return clean(rss[1]);
  const atomAlt = block.match(/<link[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["']/i);
  if (atomAlt) return decodeEntities(atomAlt[1]);
  const atom = block.match(/<link[^>]*href=["']([^"']+)["']/i);
  if (atom) return decodeEntities(atom[1]);
  const guid = block.match(/<guid(?:\s[^>]*)?>([\s\S]*?)<\/guid>/i);
  if (guid && /^https?:/i.test(guid[1].trim())) return clean(guid[1]);
  return "";
}

function itemDate(block) {
  const raw = clean(tagValue(block, ["pubDate", "published", "updated", "dc:date", "date"]));
  if (!raw) return null;
  const t = Date.parse(raw);
  return isNaN(t) ? null : new Date(t).toISOString();
}

function decodeBody(buf, contentType) {
  const head = Buffer.from(buf.slice(0, 200)).toString("latin1");
  const declared =
    (contentType || "").match(/charset=["']?([\w-]+)/i)?.[1] ||
    head.match(/encoding=["']([\w-]+)["']/i)?.[1] ||
    "utf-8";
  const enc = declared.toLowerCase();
  if (enc === "utf-8" || enc === "utf8") return Buffer.from(buf).toString("utf8");
  if (enc.includes("8859") || enc.includes("latin")) {
    try { return new TextDecoder("iso-8859-1").decode(buf); }
    catch (e) { return Buffer.from(buf).toString("latin1"); }
  }
  try { return new TextDecoder(enc).decode(buf); }
  catch (e) { return Buffer.from(buf).toString("utf8"); }
}

function parseFeed(xml, src, perFeed) {
  const blocks = xml.match(/<(item|entry)(?:\s[^>]*)?>[\s\S]*?<\/\1>/gi) || [];
  const out = [];
  for (const b of blocks) {
    const title = clean(tagValue(b, ["title"]), 220);
    const link = itemLink(b);
    if (!title || !link) continue;
    out.push({
      s: src.id,
      t: title,
      l: link,
      d: itemDate(b),
      x: clean(tagValue(b, ["description", "summary", "content:encoded", "content"]), 190)
    });
    if (out.length >= perFeed) break;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Handler                                                             */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* Récupération : URL candidates, puis repli Google Actualités          */
/* ------------------------------------------------------------------ */

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
           "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

async function fetchXml(url, ms) {
  const ctrl = new AbortController();
  const kill = setTimeout(() => ctrl.abort(), ms || 8000);
  try {
    const headers = {
      "User-Agent": UA,
      "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml, text/html;q=0.8, */*;q=0.5",
      "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.6",
      "Cache-Control": "no-cache"
    };
    try { headers.Referer = new URL(url).origin + "/"; } catch (e) {}
    const r = await fetch(url, { signal: ctrl.signal, redirect: "follow", headers });
    if (!r.ok) return { xml: null, err: "HTTP " + r.status };
    const buf = await r.arrayBuffer();
    return { xml: decodeBody(buf, r.headers.get("content-type")), err: null };
  } catch (e) {
    return { xml: null, err: e && e.name === "AbortError" ? "délai dépassé" : ((e && e.message) || "erreur réseau") };
  } finally {
    clearTimeout(kill);
  }
}

function googleNewsUrl(domain) {
  return "https://news.google.com/rss/search?q=" +
         encodeURIComponent("site:" + domain + " when:3d") +
         "&hl=fr&gl=FR&ceid=FR:fr";
}

// Google Actualités suffixe les titres par " - Nom du média" : on le retire.
function stripGnSuffix(title, name) {
  const cut = title.lastIndexOf(" - ");
  if (cut < 12) return title;
  const tail = title.slice(cut + 3);
  if (tail.length <= 45) return title.slice(0, cut);
  return title;
}

async function grab(src, perFeed, deadline) {
  let lastErr = "source injoignable";
  for (const url of (src.us || [])) {
    if (Date.now() > deadline) { lastErr = "budget de temps épuisé"; break; }
    const { xml, err } = await fetchXml(url, Math.min(6000, deadline - Date.now()));
    if (!xml) { lastErr = err; continue; }
    const items = parseFeed(xml, src, perFeed);
    if (items.length) return { src, ok: true, err: null, via: url, mode: "direct", items };
    lastErr = "flux vide ou illisible";
  }
  if (src.gn && Date.now() < deadline) {
    const url = googleNewsUrl(src.gn);
    const { xml, err } = await fetchXml(url, Math.min(7000, deadline - Date.now()));
    if (xml) {
      const items = parseFeed(xml, src, perFeed).map(it => ({
        s: it.s, t: stripGnSuffix(it.t, src.n), l: it.l, d: it.d, x: ""
      }));
      if (items.length) return { src, ok: true, err: null, via: url, mode: "google", items };
    } else if (err) {
      lastErr = lastErr + " ; Google Actualités : " + err;
    }
  }
  return { src, ok: false, err: lastErr, via: null, mode: null, items: [] };
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const q = req.query || {};
  const catalog = SOURCES.map(s => ({ id: s.id, n: s.n, d: s.d, g: s.g, gl: GROUPS[s.g], une: !!s.une }));

  if (q.list) {
    res.setHeader("Cache-Control", "public, s-maxage=86400");
    return res.status(200).json({ groups: GROUPS, sources: catalog });
  }

  let wanted;
  if (q.ids) {
    const ids = String(q.ids).split(",").map(x => x.trim()).filter(Boolean);
    wanted = SOURCES.filter(s => ids.includes(s.id));
  } else {
    const g = String(q.g || "une").toLowerCase();
    if (g === "all") wanted = SOURCES.slice();
    else if (GROUPS[g]) wanted = SOURCES.filter(s => s.g === g);
    else wanted = SOURCES.filter(s => s.une);
  }
  if (!wanted.length) wanted = SOURCES.filter(s => s.une);

  const max = Math.min(parseInt(q.max, 10) || 120, 250);
  const perFeed = Math.max(6, Math.ceil(max / Math.max(wanted.length, 1)) + 6);

  const deadline = Date.now() + 20000;   // garde-fou : la fonction doit rendre la main
  const results = await Promise.all(wanted.map(src => grab(src, perFeed, deadline)));

  // fusion + dédoublonnage par lien, tri par date décroissante
  const seen = new Set();
  let items = [];
  for (const r of results) {
    for (const it of r.items) {
      const key = it.l.split("?")[0];
      if (seen.has(key)) continue;
      seen.add(key);
      items.push(it);
    }
  }
  const now = Date.now();
  items.sort((a, b) => {
    const ta = a.d ? Date.parse(a.d) : now - 864e5;
    const tb = b.d ? Date.parse(b.d) : now - 864e5;
    return tb - ta;
  });
  items = items.slice(0, max);

  res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=900");
  return res.status(200).json({
    at: new Date().toISOString(),
    groups: GROUPS,
    sources: catalog,
    status: results.map(r => ({ id: r.src.id, ok: r.ok, err: r.err, n: r.items.length, mode: r.mode, via: r.via })),
    items
  });
}
