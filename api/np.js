// api/np.js — titre en cours de diffusion (métadonnées ICY d'un flux Icecast/Shoutcast)
// Déployée automatiquement par Vercel avec le dépôt fidal-apps.
// Usage : /api/np?u=<url du flux encodée>

const ALLOWED = [
  "icecast.radiofrance.fr",
  "icecast.rtl.fr",
  "europe1.lmn.fm",
  "europe2.lmn.fm",
  "audio.bfmtv.com",
  "start-sud.ice.infomaniak.ch",
  "radioclassique.ice.infomaniak.ch",
  "tsfjazz.ice.infomaniak.ch",
  "jazzradio.ice.infomaniak.ch",
  "novazz.ice.infomaniak.ch",
  "ouifm.ice.infomaniak.ch",
  "radiomeuh.ice.infomaniak.ch",
  "chantefrance.ice.infomaniak.ch",
  "stream.rfm.fr",
  "scdn.nrjaudio.fm",
  "icecast.skyrock.net"
];

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-store");

  const raw = (req.query && req.query.u) || "";
  let target;
  try { target = new URL(raw); } catch (e) { return res.status(400).json({ error: "url invalide" }); }
  if (target.protocol !== "https:" || !ALLOWED.includes(target.hostname)) {
    return res.status(403).json({ error: "hote non autorise" });
  }

  const ctrl = new AbortController();
  const kill = setTimeout(() => ctrl.abort(), 7000);

  try {
    const r = await fetch(target.href, {
      headers: { "Icy-MetaData": "1", "User-Agent": "FIDAL-Apps/1.0" },
      signal: ctrl.signal
    });
    const step = parseInt(r.headers.get("icy-metaint") || "0", 10);
    if (!r.ok || !step || !r.body) {
      try { await r.body?.cancel(); } catch (e) {}
      return res.status(200).json({ title: null });
    }

    const reader = r.body.getReader();
    let seen = 0, chunks = [], total = 0;
    // On lit le premier bloc audio (icy-metaint octets) puis le bloc de métadonnées.
    while (total < step + 4081) {           // 1 octet de longueur + 16*255 max
      const { value, done } = await reader.read();
      if (done || !value) break;
      chunks.push(value); total += value.length; seen++;
      if (seen > 400) break;
    }
    try { await reader.cancel(); } catch (e) {}

    const buf = Buffer.concat(chunks.map(c => Buffer.from(c)), total);
    if (buf.length <= step) return res.status(200).json({ title: null });

    const len = buf[step] * 16;
    if (!len || buf.length < step + 1 + len) return res.status(200).json({ title: null });

    const meta = buf.slice(step + 1, step + 1 + len).toString("utf8");
    const m = /StreamTitle=['"](.*?)['"]\s*;/.exec(meta);
    let title = m ? m[1].trim() : null;
    if (title) {
      title = title.replace(/\s+/g, " ").slice(0, 120);
      if (!title || /^(unknown|no ?title|-)$/i.test(title)) title = null;
    }
    return res.status(200).json({ title: title || null });
  } catch (e) {
    return res.status(200).json({ title: null });
  } finally {
    clearTimeout(kill);
  }
}
