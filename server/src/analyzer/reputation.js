// server/src/analyzer/reputation.js

export async function safeBrowsingCheck(url){
  const key = process.env.GSB_API_KEY;
  if (!key) return { enabled:false };
  try{
    const body = {
      client: { clientId: "safelink", clientVersion: "1.0" },
      threatInfo: {
        threatTypes: ["MALWARE","SOCIAL_ENGINEERING","UNWANTED_SOFTWARE","POTENTIALLY_HARMFUL_APPLICATION"],
        platformTypes: ["ANY_PLATFORM"],
        threatEntryTypes: ["URL"],
        threatEntries: [{ url }]
      }
    };
    const r = await fetch(`https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${key}`, {
      method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify(body)
    });
    const j = await r.json();
    const matches = Array.isArray(j?.matches) ? j.matches : [];
    return { enabled:true, matches, verdict: matches.length ? 'unsafe' : 'clean' };
  }catch{ return { enabled:true, error:true, verdict:'unknown' } }
}

export async function phishTankCheck(url){
  const key = process.env.PHISHTANK_KEY; // опційно
  if (!key) return { enabled:false };
  try{
    const r = await fetch('https://checkurl.phishtank.com/checkurl/', {
      method:'POST',
      headers:{'content-type':'application/x-www-form-urlencoded'},
      body: new URLSearchParams({ url, format:'json', app_key:key })
    });
    const j = await r.json();
    const verified = j?.results?.in_database && j.results?.verified;
    const valid = j?.results?.valid;
    return { enabled:true, verdict: (verified && valid) ? 'phish' : 'clean', raw:j };
  }catch{ return { enabled:true, error:true, verdict:'unknown' } }
}

export async function urlscanCheck(url){
  const key = process.env.URLSCAN_KEY; // опційно
  if (!key) return { enabled:false };
  try{
    const r = await fetch('https://urlscan.io/api/v1/scan/', {
      method:'POST',
      headers:{'content-type':'application/json','API-Key':key},
      body: JSON.stringify({ url, public:'off' })
    });
    const j = await r.json();
    return { enabled:true, submitted:true, result:j };
  }catch{ return { enabled:true, error:true } }
}
