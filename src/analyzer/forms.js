import { JSDOM } from 'jsdom';
import { parse as parseDomain } from 'tldts';

function sameEtld(a, b) {
  try {
    const da = parseDomain(a);
    const db = parseDomain(b);
    return da && db && da.domain && db.domain && da.domain === db.domain;
  } catch {
    return false;
  }
}

function collectField(el) {
  const name = el.getAttribute('name') || '';
  const type = el.getAttribute('type') || el.tagName.toLowerCase();
  const autocomplete = el.getAttribute('autocomplete') || '';
  const placeholder = el.getAttribute('placeholder') || '';
  const id = el.getAttribute('id') || '';
  const ariaLabel = el.getAttribute('aria-label') || '';
  const inputmode = el.getAttribute('inputmode') || '';
  const pattern = el.getAttribute('pattern') || '';
  return { name, type, autocomplete, placeholder, id, ariaLabel, inputmode, pattern };
}

function sensitiveFields(list) {
  const out = [];
  for (const it of list) {
    const s = `${it.name}|${it.type}|${it.autocomplete}|${it.placeholder}|${it.ariaLabel}|${it.inputmode}|${it.pattern}`;
    if (/(password|pass|card|cvv|cvc|otp|pin|code|seed|mnemonic|iban|swift|ssn|secret|2fa|one.?time|auth)/i.test(s)) out.push(it);
  }
  return out;
}

export function analyzeForms(html, pageUrl) {
  try {
    const dom = new JSDOM(html);
    const doc = dom.window.document;
    const forms = Array.from(doc.querySelectorAll('form')).slice(0, 100);
    const pageHost = new URL(pageUrl).hostname;
    const output = [];
    for (const f of forms) {
      const actionRaw = f.getAttribute('action') || '';
      const absolute = actionRaw ? new URL(actionRaw, pageUrl).href : '';
      const method = (f.getAttribute('method') || 'GET').toUpperCase();
      const enctype = f.getAttribute('enctype') || '';
      const target = f.getAttribute('target') || '';
      const cross = absolute ? !sameEtld(pageHost, new URL(absolute).hostname) : false;
      const inputs = Array.from(f.querySelectorAll('input,textarea,select')).map(collectField).slice(0, 200);
      const sens = sensitiveFields(inputs).slice(0, 50);
      const hiddenFields = Array.from(f.querySelectorAll('input[type="hidden"]')).map(collectField).slice(0, 50);
      output.push({
        action: absolute || '(empty)',
        crossDomain: !!cross,
        method,
        enctype,
        target,
        fields: inputs,
        sensitiveFields: sens,
        hiddenFields
      });
    }
    return output;
  } catch {
    return [];
  }
}
