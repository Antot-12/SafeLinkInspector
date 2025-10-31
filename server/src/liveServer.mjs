import express from "express";
import got from "got";

const LIVE_PORT = Number(process.env.LIVE_PORT || 4080);
const FRAMERS = ["http://localhost:5173","http://127.0.0.1:5173","http://localhost:5174","http://127.0.0.1:5174"];

function allowedFramers() {
  return FRAMERS.join(" ");
}

function ua() {
  return "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36";
}

function rewriteAttrs(html, baseHref) {
  const re = /(href|src|action)=("|\')([^"\']+)("|\')/gi;
  return html.replace(re, (_m, attr, q, url, q2) => {
    const u = String(url).trim();
    if (!u || /^data:|^blob:|^mailto:|^javascript:/i.test(u)) return `${attr}=${q}${u}${q2}`;
    let abs;
    try { abs = new URL(u, baseHref).href; } catch { abs = u; }
    return `${attr}=${q}/asset?url=${encodeURIComponent(abs)}${q2}`;
  });
}

function stripMetaCsp(html) {
  return html.replace(/<meta[^>]+http-equiv=["']content-security-policy["'][^>]*>/ig, "");
}

function insertBase(html, baseHref) {
  if (/<base\s/i.test(html)) return html;
  return html.replace(/<head[^>]*>/i, m => `${m}\n<base href="${baseHref}">`);
}

function neutralizeFrameBusters(html) {
  let out = html;
  out = out.replace(/\btop\.location\b/gi, "window.location");
  out = out.replace(/\bparent\.location\b/gi, "window.location");
  out = out.replace(/\bwindow\.top\b/gi, "window");
  out = out.replace(/\bwindow\.parent\b/gi, "window");
  return out;
}

function ensureStyles(html) {
  const inject = `<style>html,body{background:#fff;min-height:100%;}img,video{max-width:100%}</style>`;
  if (/<\/head>/i.test(html)) return html.replace(/<\/head>/i, `${inject}</head>`);
  return inject + html;
}

async function fetchUpstream(url, extraHeaders = {}) {
  return got(url, {
    followRedirect: true,
    throwHttpErrors: false,
    timeout: { request: 20000 },
    headers: {
      "user-agent": ua(),
      "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "accept-language": "en-US,en;q=0.9",
      "upgrade-insecure-requests": "1",
      ...extraHeaders
    },
    decompress: true,
    retry: { limit: 1 }
  });
}

export function startLiveServer() {
  const app = express();

  app.get("/", (_req, res) => res.type("text/plain").send("live ok"));

  app.get("/live", async (req, res) => {
    const raw = req.query.url;
    if (!raw) return res.status(400).send("url is required");
    try {
      const r = await fetchUpstream(raw);
      const ct = r.headers["content-type"] || "text/html; charset=utf-8";

      res.setHeader("Content-Security-Policy", `default-src * data: blob: 'unsafe-inline' 'unsafe-eval'; object-src 'none'; frame-ancestors ${allowedFramers()}`);
      res.setHeader("Referrer-Policy", "no-referrer");
      res.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=(), payment=()");
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Cache-Control", "no-store");
      res.removeHeader("Set-Cookie");

      if (/text\/html/i.test(ct)) {
        let html = r.body.toString();
        html = stripMetaCsp(html);
        html = insertBase(html, raw);
        html = neutralizeFrameBusters(html);
        html = rewriteAttrs(html, raw);
        html = ensureStyles(html);
        res.type("html").send(html);
      } else {
        res.setHeader("Content-Type", ct);
        res.send(r.rawBody);
      }
    } catch {
      res.status(502).send("Bad gateway");
    }
  });

  app.get("/asset", async (req, res) => {
    const raw = req.query.url;
    if (!raw) return res.status(400).send("url is required");
    try {
      const origin = new URL(raw);
      const r = await fetchUpstream(raw, { Referer: `${origin.origin}/` });
      const ct = r.headers["content-type"] || "";
      if (r.headers["set-cookie"]) delete r.headers["set-cookie"];
      res.setHeader("Cache-Control", "no-store");
      if (/text\/css/i.test(ct)) {
        let css = r.body.toString();
        css = css.replace(/url\((['"]?)(?!data:|https?:|blob:|#)([^'")]+)\1\)/gi, (_m, q, u) => {
          let abs;
          try { abs = new URL(u, raw).href; } catch { abs = u; }
          return `url(/asset?url=${encodeURIComponent(abs)})`;
        });
        res.type("text/css").send(css);
      } else {
        if (ct) res.setHeader("Content-Type", ct);
        res.send(r.rawBody);
      }
    } catch {
      res.status(502).send("Bad gateway");
    }
  });

  app.listen(LIVE_PORT, () => {
    console.log(`Live sandbox server on http://localhost:${LIVE_PORT}`);
  }).on("error", e => {
    if (e && e.code === "EADDRINUSE") console.error(`Port ${LIVE_PORT} busy. Set LIVE_PORT and VITE_LIVE_ORIGIN.`);
    else console.error("Live server error:", e);
  });
}
