import got from 'got';


const SHORTENERS = new Set([
'bit.ly','t.co','goo.gl','tinyurl.com','ow.ly','is.gd','buff.ly','adf.ly','cutt.ly','rebrand.ly','s.id','lnkd.in','v.gd','smarturl.it','trib.al','rb.gy','shorte.st','tiny.cc','bl.ink'
]);


export async function unshortenUrl(inputUrl) {
const url = normalizeUrl(inputUrl);
let finalUrl = url;
let chain = [];
try {
const res = await got(url, {
method: 'GET',
followRedirect: true,
throwHttpErrors: false,
timeout: { request: 12000 },
headers: { 'user-agent': ua() }
});
chain = res.redirectUrls || [];
finalUrl = res.url || url;
} catch (e) {
// якщо вузол не відповідає на GET (HEAD/OPTIONS не гарантує), залишаємо як є
}
const isShort = isShortener(url);
return { inputUrl: url, finalUrl, chain, isShortened: isShort || chain.length > 0 };
}


export function normalizeUrl(u) {
try {
const hasProto = /^https?:\/\//i.test(u);
const full = new URL(hasProto ? u : `https://${u}`);
return full.toString();
} catch {
return u;
}
}


function isShortener(u) {
try { const h = new URL(u).hostname.replace(/^www\./,''); return SHORTENERS.has(h); } catch { return false; }
}


function ua(){
return 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36 SafeLinkInspector/1.0';
}