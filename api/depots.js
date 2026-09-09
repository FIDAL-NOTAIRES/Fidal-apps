// api/depots.js — dépôts d'articles partagés entre associés (onglet « Le cabinet »)
// Déployée automatiquement par Vercel avec le dépôt fidal-apps.
//
// Une seule fonction à actions, pour rester sous la limite de 12 fonctions du plan Hobby :
//   GET  /api/depots?action=list[&limit=60]
//   GET  /api/depots?action=meta&u=<url encodée>     → titre / chapô / image d'un lien
//   POST /api/depots?action=upload                   → { name, mime, data (base64) } → { url }
//   POST /api/depots?action=create                   → { author, kind, title, note, link, fileUrl, mime }
//   POST /api/depots?action=delete                   → { id, author }
//
// Variables d'environnement Vercel attendues :
//   DATABASE_URL            chaîne de connexion Neon (postgresql://…?sslmode=require)
//   BLOB_READ_WRITE_TOKEN   créée automatiquement en connectant un store Blob au projet

import { neon } from "@neondatabase/serverless";

export const config = { maxDuration: 20 };

const AUTHORS = [
  "François-Xavier LAUNAIS", "Pierre HERTFELDER", "Jean-François DUMETZ",
  "Nicolas DIRADOURIAN", "Nathalie DEBLECKER", "Nathalie JURCZAK",
  "Stéphane DELAHAYE", "Laure BISSON", "Camille BARBOT",
  "Charles GRUNBERG", "Mathieu POGNAN", "Ophélie FEVRE"
];

const MAX_UPLOAD = 4 * 1024 * 1024;        // 4 Mo — limite de corps de requête du plan Hobby
const OK_MIME = ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"];

let ready = false;
async function db() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL absente");
  const sql = neon(process.env.DATABASE_URL);
  if (!ready) {
    await sql`
      CREATE TABLE IF NOT EXISTS presse_depots (
        id         bigserial PRIMARY KEY,
        created_at timestamptz NOT NULL DEFAULT now(),
        author     text NOT NULL,
        kind       text NOT NULL,
        title      text,
        note       text,
        link       text,
        file_url   text,
        mime       text
      )`;
    ready = true;
  }
  return sql;
}

function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") { try { return JSON.parse(req.body); } catch (e) { return {}; } }
  return {};
}

function clip(s, n) {
  const v = (s == null ? "" : String(s)).trim();
  return v.length > n ? v.slice(0, n) : v;
}

/* ---------- Vercel Blob, en REST : pas de dépendance supplémentaire ---------- */
async function putBlob(name, mime, buf) {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new Error("BLOB_READ_WRITE_TOKEN absente");
  const safe = name.replace(/[^A-Za-z0-9._-]/g, "_").slice(-60);
  const path = "presse/" + Date.now() + "-" + Math.random().toString(36).slice(2, 8) + "-" + safe;
  const r = await fetch("https://blob.vercel-storage.com/" + encodeURI(path), {
    method: "PUT",
    headers: {
      "Authorization": "Bearer " + token,
      "x-api-version": "7",
      "x-content-type": mime,
      "x-add-random-suffix": "0",
      "x-cache-control-max-age": "31536000"
    },
    body: buf
  });
  const txt = await r.text();
  if (!r.ok) throw new Error("Blob " + r.status + " " + txt.slice(0, 160));
  let j = {}; try { j = JSON.parse(txt); } catch (e) {}
  if (!j.url) throw new Error("Blob : réponse sans url");
  return j.url;
}

async function delBlob(url) {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token || !url) return;
  try {
    await fetch("https://blob.vercel-storage.com/delete", {
      method: "POST",
      headers: { "Authorization": "Bearer " + token, "x-api-version": "7", "content-type": "application/json" },
      body: JSON.stringify({ urls: [url] })
    });
  } catch (e) { /* la suppression du média n'est pas bloquante */ }
}

/* ---------- lecture des métadonnées d'un lien ---------- */
function metaTag(html, keys) {
  for (const k of keys) {
    const re = new RegExp('<meta[^>]+(?:property|name)=["\']' + k + '["\'][^>]*>', "i");
    const tag = html.match(re);
    if (!tag) continue;
    const c = tag[0].match(/content=["']([^"']*)["']/i);
    if (c && c[1].trim()) return c[1].trim();
  }
  return "";
}
function unescapeHtml(s) {
  return String(s || "")
    .replace(/&#(\d+);/g, (m, d) => { try { return String.fromCodePoint(+d); } catch (e) { return m; } })
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#0?39;|&apos;|&rsquo;/g, "’")
    .replace(/&nbsp;/g, " ").replace(/&eacute;/g, "é").replace(/&egrave;/g, "è")
    .replace(/\s+/g, " ").trim();
}

async function linkMeta(target) {
  const ctrl = new AbortController();
  const kill = setTimeout(() => ctrl.abort(), 8000);
  try {
    const r = await fetch(target, {
      signal: ctrl.signal, redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "fr-FR,fr;q=0.9"
      }
    });
    if (!r.ok) return { title: "", note: "", site: "" };
    const html = (await r.text()).slice(0, 300000);
    const t = metaTag(html, ["og:title", "twitter:title"]) ||
              (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [, ""])[1];
    const d = metaTag(html, ["og:description", "description", "twitter:description"]);
    const s = metaTag(html, ["og:site_name"]);
    return { title: clip(unescapeHtml(t), 220), note: clip(unescapeHtml(d), 300), site: clip(unescapeHtml(s), 60) };
  } catch (e) {
    return { title: "", note: "", site: "" };
  } finally { clearTimeout(kill); }
}

/* ------------------------------------------------------------------ */

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-store");

  const action = String((req.query && req.query.action) || "list");

  try {
    if (action === "authors") {
      return res.status(200).json({ authors: AUTHORS });
    }

    if (action === "meta") {
      const raw = (req.query && req.query.u) || "";
      let u; try { u = new URL(raw); } catch (e) { return res.status(400).json({ error: "url invalide" }); }
      if (u.protocol !== "https:" && u.protocol !== "http:") return res.status(400).json({ error: "url invalide" });
      return res.status(200).json(await linkMeta(u.href));
    }

    if (action === "list") {
      const sql = await db();
      const limit = Math.min(parseInt((req.query && req.query.limit) || "80", 10) || 80, 200);
      const rows = await sql`
        SELECT id, created_at, author, kind, title, note, link, file_url, mime
        FROM presse_depots ORDER BY created_at DESC LIMIT ${limit}`;
      return res.status(200).json({ authors: AUTHORS, items: rows });
    }

    if (req.method !== "POST") return res.status(405).json({ error: "méthode non autorisée" });
    const body = readBody(req);

    if (action === "upload") {
      const mime = clip(body.mime, 60);
      if (!OK_MIME.includes(mime)) return res.status(400).json({ error: "type de fichier non accepté" });
      const b64 = String(body.data || "").replace(/^data:[^;]+;base64,/, "");
      if (!b64) return res.status(400).json({ error: "fichier vide" });
      const buf = Buffer.from(b64, "base64");
      if (!buf.length) return res.status(400).json({ error: "fichier illisible" });
      if (buf.length > MAX_UPLOAD) return res.status(413).json({ error: "fichier trop lourd (4 Mo maximum)" });
      const url = await putBlob(clip(body.name, 80) || "piece", mime, buf);
      return res.status(200).json({ url, bytes: buf.length });
    }

    if (action === "create") {
      const author = clip(body.author, 80);
      if (!AUTHORS.includes(author)) return res.status(400).json({ error: "auteur inconnu" });
      const kind = ["photo", "file", "link", "note"].includes(body.kind) ? body.kind : "note";
      const title = clip(body.title, 220);
      const note = clip(body.note, 600);
      const link = clip(body.link, 600);
      const fileUrl = clip(body.fileUrl, 600);
      const mime = clip(body.mime, 60);
      if (!title && !link && !fileUrl) return res.status(400).json({ error: "dépôt vide" });
      const sql = await db();
      const rows = await sql`
        INSERT INTO presse_depots (author, kind, title, note, link, file_url, mime)
        VALUES (${author}, ${kind}, ${title}, ${note}, ${link}, ${fileUrl}, ${mime})
        RETURNING id, created_at, author, kind, title, note, link, file_url, mime`;
      return res.status(200).json({ item: rows[0] });
    }

    if (action === "delete") {
      const id = parseInt(body.id, 10);
      const author = clip(body.author, 80);
      if (!id || !author) return res.status(400).json({ error: "requête incomplète" });
      const sql = await db();
      const rows = await sql`
        DELETE FROM presse_depots WHERE id = ${id} AND author = ${author}
        RETURNING file_url`;
      if (!rows.length) return res.status(403).json({ error: "seul l'auteur peut retirer son dépôt" });
      await delBlob(rows[0].file_url);
      return res.status(200).json({ deleted: id });
    }

    return res.status(400).json({ error: "action inconnue" });
  } catch (e) {
    return res.status(500).json({ error: (e && e.message) || "erreur serveur" });
  }
}
