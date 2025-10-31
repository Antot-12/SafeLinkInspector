import { parse as parseDomain } from 'tldts';

const TOKENS = ['login','signin','verify','update','secure','account','wallet','web3','bank','amazon','steam','apple','support','help','reset','recover','unlock','payment','billing','invoice','gift','promo','bonus','crypto','exchange','airdrop'];

function hasIdn(host) {
  if (!host) return false;
  if (/xn--/i.test(host)) return true;
  if (/[\u0400-\u04FF]/.test(host)) return true;
  if (/[\u0370-\u03FF]/.test(host)) return true;
  return false;
}

function subDepth(host) {
  try {
    const p = parseDomain(host);
    if (!p || !p.hostname || !p.domain) return 0;
    const left = p.hostname.replace(`.${p.domain}`, '');
    if (!left || left === p.domain) return 0;
    return left.split('.').filter(Boolean).length;
  } catch {
    return 0;
  }
}

function findTokens(host, path) {
  const s = `${host}/${path || ''}`.toLowerCase();
  const out = [];
  for (const t of TOKENS) {
    if (s.includes(t)) out.push(t);
  }
  return out;
}

function hasSecretInQuery(path) {
  if (!path) return false;
  return /[?&](pass(word)?|otp|pin|code|seed|mnemonic|cvv|cvc|card)=/i.test(path);
}

export function computeHeuristics(finalUrl) {
  try {
    const u = new URL(finalUrl);
    const host = u.hostname;
    const path = (u.pathname || '') + (u.search || '');
    const flags = [];
    let scoreDelta = 0;
    if (u.protocol === 'http:') {
      flags.push('http-scheme');
      scoreDelta += 5;
    }
    if (hasIdn(host)) {
      flags.push('idn');
      scoreDelta += 8;
    }
    const depth = subDepth(host);
    if (depth >= 3) {
      flags.push(`deep-subdomain:${depth}`);
      scoreDelta += depth >= 4 ? 4 : 2;
    }
    const toks = findTokens(host, path);
    if (toks.length) {
      flags.push('tokens:' + toks.join('|'));
      scoreDelta += Math.min(6, 2 + toks.length);
    }
    const length = finalUrl.length;
    if (length > 200) {
      flags.push('long-url>200');
      scoreDelta += 4;
    } else if (length > 120) {
      flags.push('long-url>120');
      scoreDelta += 2;
    }
    if (hasSecretInQuery(path)) {
      flags.push('query-asks-secret');
      scoreDelta += 6;
    }
    return { flags, scoreDelta, details: { idn: hasIdn(host), subdomainDepth: depth, tokenCount: toks.length, urlLength: length, secretQuery: hasSecretInQuery(path) } };
  } catch {
    return { flags: [], scoreDelta: 0, details: { idn: false, subdomainDepth: 0, tokenCount: 0, urlLength: 0, secretQuery: false } };
  }
}

export function riskScore(finalUrl) {
  let score = 0;
  try {
    const u = new URL(finalUrl);
    if (u.protocol === 'http:') score += 5;
    if (/\.(zip|mov|top|gq|work|click|country|mom|party|review)$/i.test(u.hostname)) score += 2;
  } catch {}
  return Math.max(0, Math.min(100, score));
}

export function riskLabel(score) {
  if (score >= 20) return 'High';
  if (score >= 8) return 'Medium';
  return 'Low';
}
