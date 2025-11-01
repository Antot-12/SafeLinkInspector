// app/src/api.js

const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/+$/, '')

const joinUrl = (p) => `${API_BASE}${p.startsWith('/') ? p : `/${p}`}`

function delay(ms) { return new Promise(r => setTimeout(r, ms)) }

async function request(path, {
  method = 'GET',
  json,           // object to JSON.stringify
  body,           // raw body (if not json)
  headers = {},
  timeoutMs = 15000,
  retry = 0,      // small retry count for GET/DELETE
} = {}) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  const url = joinUrl(path)

  const baseHeaders = json
    ? { 'content-type': 'application/json', ...headers }
    : headers

  const init = {
    method,
    headers: baseHeaders,
    signal: ctrl.signal,
    body: json ? JSON.stringify(json) : body
  }

  let lastErr
  const attempts = Math.max(0, retry) + 1

  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, init)
      clearTimeout(t)

      const ctype = res.headers.get('content-type') || ''
      const isJson = /\bapplication\/json\b/i.test(ctype)

      if (!res.ok) {
        const payload = isJson ? await safeJson(res) : await res.text().catch(() => '')
        throw apiError(res.status, payload, `HTTP ${res.status}`)
      }

      return isJson ? await safeJson(res) : await res.text()
    } catch (err) {
      lastErr = err
      const isAbort = err?.name === 'AbortError'
      const isNet = err instanceof TypeError || String(err?.message || '').includes('NetworkError')
      const idempotent = method === 'GET' || method === 'DELETE'
      if (i < attempts - 1 && !isAbort && isNet && idempotent) {
        await delay(200 * (i + 1))
        continue
      }
      throw normalizeErr(err)
    } finally {
      clearTimeout(t)
    }
  }
  throw normalizeErr(lastErr)
}

function apiError(status, data, message) {
  const e = new Error(message || 'API error')
  e.name = 'ApiError'
  e.status = status
  e.data = data
  return e
}

async function safeJson(res) {
  try { return await res.json() } catch { return {} }
}

function normalizeErr(e) {
  if (e?.name === 'ApiError') return e
  const err = new Error(e?.message || 'Network error')
  err.name = 'ApiError'
  err.status = typeof e?.status === 'number' ? e.status : 0
  err.data = e?.data ?? null
  return err
}

// Public helpers

export async function analyze(url, options = {}, opts = {}) {
  return request('/api/analyze', {
    method: 'POST',
    json: { url, options },
    timeoutMs: opts.timeoutMs ?? 30000,
    retry: 0,
    headers: opts.headers
  })
}

export async function apiGet(path, opts = {}) {
  return request(path, {
    method: 'GET',
    timeoutMs: opts.timeoutMs ?? 12000,
    retry: opts.retry ?? 1,
    headers: opts.headers
  })
}

export async function apiDel(path, opts = {}) {
  return request(path, {
    method: 'DELETE',
    timeoutMs: opts.timeoutMs ?? 12000,
    retry: opts.retry ?? 1,
    headers: opts.headers
  })
}

export async function apiPost(path, body, opts = {}) {
  return request(path, {
    method: 'POST',
    json: body ?? {},
    timeoutMs: opts.timeoutMs ?? 15000,
    retry: 0,
    headers: opts.headers
  })
}

// Download helper for CSV/JSON exports
export async function apiDownload(path, filename) {
  const url = joinUrl(path)
  const r = await fetch(url)
  if (!r.ok) throw new Error(await r.text())
  const blob = await r.blob()
  const a = document.createElement('a')
  const href = URL.createObjectURL(blob)
  a.href = href
  a.download = filename || deriveFilenameFromHeaders(r.headers) || 'download'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(href)
}

function deriveFilenameFromHeaders(headers) {
  const cd = headers.get('content-disposition') || ''
  const m = cd.match(/filename\*?=(?:UTF-8'')?["']?([^"';]+)["']?/i)
  return m ? decodeURIComponent(m[1]) : null
}
