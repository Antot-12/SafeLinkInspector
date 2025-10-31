import https from 'node:https';

function splitSans(input) {
  if (!input) return [];
  return input.split(',').map(s => s.trim()).filter(s => /^DNS:/i.test(s)).map(s => s.replace(/^DNS:\s*/i, '')).filter(Boolean);
}

function lc(x) {
  return typeof x === 'string' ? x.toLowerCase() : '';
}

function matchPattern(host, pattern) {
  const h = lc(host);
  const p = lc(pattern);
  if (!p) return false;
  if (p.startsWith('*.')) {
    const base = p.slice(2);
    return h === base || h.endsWith('.' + base);
  }
  return h === p;
}

function matchesHost(host, sans, cn) {
  if (Array.isArray(sans) && sans.length) {
    for (const s of sans) {
      if (matchPattern(host, s)) return true;
    }
  }
  if (cn && matchPattern(host, cn)) return true;
  return false;
}

function parseExpiry(validTo) {
  if (!validTo) return { validTo, expiresInDays: null };
  const t = Date.parse(validTo);
  if (!Number.isFinite(t)) return { validTo, expiresInDays: null };
  const d = Math.ceil((t - Date.now()) / 86400000);
  return { validTo, expiresInDays: d };
}

export async function getTlsProfile(url) {
  try {
    const u = new URL(url);
    return await new Promise(resolve => {
      const req = https.request({ host: u.hostname, port: u.port || 443, method: 'GET', path: u.pathname || '/', rejectUnauthorized: false }, res => {
        const sock = res.socket;
        const cert = sock && sock.getPeerCertificate ? sock.getPeerCertificate(true) : null;
        if (!cert) {
          res.resume();
          resolve(null);
          return;
        }
        const cn = cert.subject && cert.subject.CN ? cert.subject.CN : '';
        const issuer = cert.issuer && (cert.issuer.CN || cert.issuer.O) ? (cert.issuer.CN || cert.issuer.O) : '';
        const sans = splitSans(cert.subjectaltname);
        const proto = sock.getProtocol ? sock.getProtocol() : '';
        const vf = cert.valid_from || '';
        const vtRaw = cert.valid_to || cert.validTo || '';
        const exp = parseExpiry(vtRaw);
        const ok = matchesHost(u.hostname, sans, cn);
        res.resume();
        resolve({ subjectCN: cn || '', issuer: issuer || '', validFrom: vf || '', validTo: exp.validTo || '', expiresInDays: exp.expiresInDays, protocol: proto || '', sans, matchesHost: !!ok });
      });
      req.on('error', () => resolve(null));
      req.end();
    });
  } catch {
    return null;
  }
}
