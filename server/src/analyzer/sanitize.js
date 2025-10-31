import { JSDOM } from 'jsdom';
import createDOMPurify from 'dompurify';


export function sanitizeHtml(rawHtml){
const dom = new JSDOM('<!DOCTYPE html><html><head></head><body></body></html>');
const window = dom.window;
const DOMPurify = createDOMPurify(window);
DOMPurify.setConfig({
ALLOWED_TAGS: false, // allow all by default, then remove dangerous attrs
ALLOWED_ATTR: false,
FORBID_TAGS: ['script','iframe','object','embed','link','style','form','input','button','svg','math'],
FORBID_ATTR: ['on*','style','srcset']
});
// санітизуємо вміст
const clean = DOMPurify.sanitize(rawHtml, { WHOLE_DOCUMENT: true });


// Мінімальна темна тема + відсічення зовнішніх ресурсів через CSP на роуті
const wrapped = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta http-equiv="x-ua-compatible" content="ie=edge" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Sanitized Preview</title>
<style>
:root{color-scheme: dark;}
body{margin:0;padding:24px;background:#0b0f14;color:#e6f0f1;font:16px system-ui,-apple-system,Segoe UI,Roboto,Ubuntu;}
a{color:#2ee7d8;text-decoration:none;border-bottom:1px dotted #2ee7d8}
img,video,audio{display:none!important} /* ніяких медіа */
*{max-width:100%;}
</style>
</head>
<body>
<div id="__content">${clean}</div>
</body>
</html>`;
window.close();
return wrapped;
}