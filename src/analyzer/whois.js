// server/src/analyzer/whois.js
import whois from 'whois-json';

const cache = new Map(); // domain -> { at, data }
const TTL_MS = 24 * 60 * 60 * 1000;

async function rdap(domain){
  try{
    const r = await fetch(`https://rdap.org/domain/${encodeURIComponent(domain)}`, {
      headers: { accept: 'application/rdap+json' }
    });
    if (!r.ok) return null;
    const j = await r.json();
    // шукаємо дату реєстрації у events
    const ev = Array.isArray(j.events) ? j.events : [];
    const reg = ev.find(e => /registration/i.test(e.eventAction)) || ev.find(e => /create/i.test(e.eventAction));
    const createdAt = reg?.eventDate ? new Date(reg.eventDate) : null;
    const ageDays = createdAt ? Math.floor((Date.now() - createdAt.getTime())/86400000) : null;
    return {
      registrar: j?.registrar ? (j.registrar.name || j.registrar) : (j?.entities?.[0]?.vcardArray?.[1]?.find(x => Array.isArray(x) && x[0]==='fn')?.[3] || null),
      createdAt: createdAt ? createdAt.toISOString() : null,
      ageDays
    };
  }catch{ return null }
}

export async function getWhoisAge(url){
  try{
    const host = new URL(url).hostname;
    const now = Date.now();
    const hit = cache.get(host);
    if (hit && now - hit.at < TTL_MS) return hit.data;

    // 1) RDAP спроба
    let data = await rdap(host);

    // 2) fallback: стандартний whois
    if (!data){
      const w = await whois(host, { follow: 1, timeout: 7000 }).catch(()=>null);
      if (w){
        const created = w.creationDate || w.created || w['Creation Date'] || w['creation_date'] || null;
        const createdAt = created ? new Date(created) : null;
        const ageDays = createdAt ? Math.floor((Date.now() - createdAt.getTime())/86400000) : null;
        data = {
          registrar: w.registrar || w.Registrar || null,
          createdAt: createdAt ? createdAt.toISOString() : null,
          ageDays
        };
      }
    }

    const result = data || { registrar:null, createdAt:null, ageDays:null };
    cache.set(host, { at: now, data: result });
    return result;
  }catch{
    return { registrar:null, createdAt:null, ageDays:null };
  }
}
