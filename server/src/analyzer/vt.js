// VirusTotal URL lookup (без активного сканування, швидка перевірка наявного аналізу)
// Увімкнеться автоматично, якщо встановити env: VT_API_KEY


const VT = 'https://www.virustotal.com/api/v3';


export async function vtCheck(finalUrl){
const key = process.env.VT_API_KEY;
if (!key) return { enabled: false };
try {
// VT ідентифікатор URL = base64url(finalUrl)
const id = Buffer.from(finalUrl).toString('base64').replace(/=+$/,'').replace(/\+/g,'-').replace(/\//g,'_');
const res = await fetch(`${VT}/urls/${id}`, { headers: { 'x-apikey': key }});
if (res.status === 404) {
// якщо аналізу немає — створимо запис (без очікування завершення)
const fd = new URLSearchParams({ url: finalUrl });
await fetch(`${VT}/urls`, { method: 'POST', headers: { 'x-apikey': key }, body: fd });
return { enabled: true, status: 'queued' };
}
const data = await res.json();
const stats = data?.data?.attributes?.last_analysis_stats || null;
const harmless = stats?.harmless ?? 0; const malicious = stats?.malicious ?? 0; const suspicious = stats?.suspicious ?? 0;
const verdict = malicious > 0 || suspicious > 0 ? 'malicious_or_suspicious' : 'no_engines_flagged';
return { enabled: true, status: 'ok', stats, verdict };
} catch (e) {
return { enabled: true, status: 'error', error: e.message };
}
}