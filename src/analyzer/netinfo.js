import dns from 'node:dns/promises';

async function fetchJson(url, headers) {
  const r = await fetch(url, { headers: headers || {}, cache: 'no-store' });
  if (!r.ok) return null;
  return r.json().catch(() => null);
}

async function lookupAll(host) {
  try {
    const arr = await dns.lookup(host, { all: true, verbatim: false });
    if (!Array.isArray(arr) || arr.length === 0) return [];
    return arr.map(x => ({ address: x.address, family: x.family }));
  } catch {
    return [];
  }
}

function pickPreferred(addresses) {
  if (!addresses || addresses.length === 0) return null;
  const v4 = addresses.find(x => x.family === 4);
  if (v4) return v4.address;
  return addresses[0].address;
}

async function fetchGeo(ip) {
  const j = await fetchJson(`https://ipapi.co/${encodeURIComponent(ip)}/json/`, { accept: 'application/json' });
  if (!j) return { asn: null, org: null, country: null, city: null };
  const asn = j.asn || j.org || null;
  const org = j.org || null;
  const country = j.country_name || j.country || null;
  const city = j.city || null;
  return { asn, org, country, city };
}

async function fetchAbuse(ip) {
  const key = process.env.ABUSEIPDB_KEY;
  if (!key) return { enabled: false };
  try {
    const r = await fetch(`https://api.abuseipdb.com/api/v2/check?ipAddress=${encodeURIComponent(ip)}&maxAgeInDays=90`, {
      headers: { Key: key, Accept: 'application/json' }, cache: 'no-store'
    });
    if (!r.ok) return { enabled: true, score: null };
    const j = await r.json().catch(() => null);
    const score = j && j.data && typeof j.data.abuseConfidenceScore === 'number' ? j.data.abuseConfidenceScore : null;
    return { enabled: true, score };
  } catch {
    return { enabled: true, error: true };
  }
}

export async function getIpInfo(targetUrl) {
  try {
    const u = new URL(targetUrl);
    const host = u.hostname;
    const addresses = await lookupAll(host);
    if (addresses.length === 0) return null;
    const ip = pickPreferred(addresses);
    if (!ip) return null;
    const geo = await fetchGeo(ip);
    const abuse = await fetchAbuse(ip);
    return { host, ip, asn: geo.asn, org: geo.org, country: geo.country, city: geo.city, abuse };
  } catch {
    return null;
  }
}
