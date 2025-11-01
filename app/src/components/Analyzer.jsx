import { useEffect, useMemo, useRef, useState } from 'react'
import { analyze } from '../api'

const LIVE_ORIGIN = (import.meta.env.VITE_LIVE_ORIGIN || '').replace(/\/+$/,'')

function StatusDot({ state }) {
  const color =
    state === 'good' ? '#8effb1'
    : state === 'bad' ? '#ff8e8e'
    : state === 'warn' ? '#ffd08e'
    : '#7c8a8f'
  return <span style={{ display:'inline-block', width:8, height:8, borderRadius:999, background:color, marginRight:6, verticalAlign:'middle' }} />
}

function Arrow() {
  return <span aria-hidden style={{ opacity:.5, margin:'0 6px' }}>→</span>
}

function normalizeInput(u) {
  const s = String(u || '').trim()
  if (!s) return ''
  if (/^https?:\/\//i.test(s)) return s
  return `https://${s}`
}

export default function Analyzer(){
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [res, setRes] = useState(null)
  const [tab, setTab] = useState('sanitized')
  const [error, setError] = useState('')

  const inputRef = useRef(null)

  useEffect(()=>{ inputRef.current?.focus() },[])

  useEffect(()=>{
    const p = new URLSearchParams(location.search)
    const id = p.get('id')
    if (!id) return
    fetch(`/api/history/${id}`)
      .then(r=>r.json())
      .then(data=>{
        if (data && !data.error){
          setRes(data)
          setUrl(data.finalUrl || data.inputUrl || '')
        }
      })
      .catch(()=>{})
  },[])

  useEffect(()=>{
    const onKey = (e)=>{
      if (e.key==='/' && document.activeElement!==inputRef.current){ e.preventDefault(); inputRef.current?.focus() }
      if (e.key==='Enter' && (e.ctrlKey||e.metaKey)){ e.preventDefault(); doAnalyze(false) }
    }
    window.addEventListener('keydown', onKey)
    return ()=> window.removeEventListener('keydown', onKey)
  },[url])

  useEffect(()=>{
    const handler = (e)=>{
      const data = e.detail
      if (!data) return
      setRes(data)
      setUrl(data.finalUrl || data.inputUrl || '')
      setError('')
    }
    window.addEventListener('safelink:show', handler)
    return ()=> window.removeEventListener('safelink:show', handler)
  },[])

  useEffect(()=>{
    if (!res) return
    const availableTabs = []
    if (res.sanitized) availableTabs.push('sanitized')
    if (res.screenshot) availableTabs.push('screenshot')
    availableTabs.push('live')
    if (!availableTabs.includes(tab)) setTab(availableTabs[0] || 'live')
  },[res]) 

  const doAnalyze = async (nocache)=>{
    const normalized = normalizeInput(url)
    setUrl(normalized)
    if (!normalized) return
    setError(''); setRes(null); setLoading(true)
    try {
      const data = await analyze(normalized, { nocache })
      setRes(data)
      window.dispatchEvent(new CustomEvent('safelink:history-refresh', { detail: { id: data.id, finalUrl: data.finalUrl } }))
    } catch(e){
      const msg = typeof e?.message === 'string' ? e.message : 'Failed to analyze'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const onSubmit = (e)=>{ e.preventDefault(); doAnalyze(false) }

  const copyChain = async ()=>{
    if (!res?.chain?.length) return
    try{ await navigator.clipboard.writeText(res.chain.join(' -> ')) }catch{}
  }

  const share = async ()=>{
    if (!res?.id) return
    const publicUrl = res?.shareToken
      ? `${location.origin}/public/${encodeURIComponent(res.id)}?token=${encodeURIComponent(res.shareToken)}`
      : `${location.origin}${location.pathname}?id=${encodeURIComponent(res.id)}`
    try{
      if (navigator.share) await navigator.share({ title:'SafeLink Report', url: publicUrl })
      else if (navigator.clipboard){ await navigator.clipboard.writeText(publicUrl); alert('Share link copied:\n'+publicUrl) }
      else { prompt('Copy share link:', publicUrl) }
    }catch{}
  }

  const repChip = (label, v) => {
    let state = 'off'
    if (v?.enabled === false) state = 'off'
    else if (v?.verdict === 'unsafe' || v?.verdict === 'phish') state = 'bad'
    else if (v?.verdict === 'clean' || v?.submitted) state = 'good'
    else state = 'warn'
    return <span className="pill" style={{ marginRight:8 }}><StatusDot state={state}/>{label}</span>
  }

  const redirectChain = useMemo(()=>{
    if (!res?.chain?.length) return null
    return (
      <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
        {res.chain.map((u, idx)=>(
          <span key={idx} className="break-url">
            <a href={u} target="_blank" rel="noopener noreferrer">{u}</a>
            {idx < res.chain.length-1 && <Arrow/>}
          </span>
        ))}
      </div>
    )
  },[res])

  return (
    <div className="card" style={{ position:'relative' }}>
      <form onSubmit={onSubmit} className="row" style={{ marginBottom:16, gap:12, alignItems:'stretch' }}>
        <input
          ref={inputRef}
          className="input"
          placeholder="Paste a link to analyze (https://...)"
          value={url}
          onChange={e=>setUrl(e.target.value)}
          inputMode="url"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
        />
        <button className="btn" disabled={loading || !url.trim()}>
          {loading ? 'Analyzing…' : 'Analyze'}
        </button>
        <button className="btn btn-sm" type="button" onClick={()=>doAnalyze(true)} disabled={loading || !url.trim()}>
          Refresh (skip cache)
        </button>
        {res?.id && <button className="btn btn-sm" type="button" onClick={share}>Share</button>}
        {res?.chain?.length ? <button className="btn btn-sm" type="button" onClick={copyChain}>Copy redirects</button> : null}
      </form>

      {!!error && <div className="text-muted" role="status" aria-live="polite">{error}</div>}

      {res && (
        <div>
          <div className="kv">
            <div>Final URL</div>
            <div><a className="break-url" href={res.finalUrl} target="_blank" rel="noopener noreferrer">{res.finalUrl}</a></div>

            <div>Risk</div>
            <div>
              <span className={`risk-${res.risk?.label}`}>{res.risk?.label} ({res.risk?.score})</span>
              {res.cacheHit && <span className="pill" style={{ marginLeft:10 }}>cache</span>}
              <span style={{ marginLeft:10 }}>
                {repChip('GSB', res.reputation?.gsb)}
                {repChip('PhishTank', res.reputation?.phishTank)}
                {repChip('urlscan', res.reputation?.urlscan)}
			 {repChip('URLhaus', res.reputation?.urlhaus)}
			 {repChip('ThreatFox', res.reputation?.threatFox)}
			 {repChip('OpenPhish', res.reputation?.openPhish)}
			 {repChip('Spamhaus', res.reputation?.spamhaus)}
              </span>
            </div>

            <div>Unshortened</div>
            <div>{res.isShortened? 'Yes' : 'No'}</div>

            <div>Redirect chain</div>
            <div className="break-url">{redirectChain || '—'}</div>

            <div>Title</div>
            <div>{res.title || '—'}</div>

            <div>Description</div>
            <div className="text-muted">{res.description || '—'}</div>

            <div>Network</div>
            <div>
              {res.net
                ? <>IP: {res.net.ip || '—'} · ASN/Org: {res.net.asn || res.net.org || '—'} · {res.net.country || ''} {res.net.city ? `(${res.net.city})` : ''} {res.net.abuse?.enabled ? `· AbuseIPDB: ${res.net.abuse.score ?? '—'}` : '· AbuseIPDB: disabled'}</>
                : '—'}
            </div>

            <div>TLS</div>
            <div>
              {res.tls
                ? <>Issuer: {res.tls.issuer || '—'} · validTo: {res.tls.validTo || '—'}{res.tls.expiresInDays!=null ? ` (${res.tls.expiresInDays} days)` : ''} · SAN ok: {res.tls.matchesHost ? 'Yes' : 'No'}{res.tlsWarnings?.length ? ` · WARN: ${res.tlsWarnings.join('; ')}`:''}</>
                : '—'}
            </div>

            <div>Security</div>
            <div>
              HSTS: {res.security?.hsts ? 'Yes' : 'No'} · HTTP→HTTPS: {res.security?.httpToHttps===null ? 'N/A' : (res.security.httpToHttps ? 'Yes' : 'No')}
            </div>

            <div>WHOIS</div>
            <div>
              {res.whois ? <>Registrar: {res.whois.registrar || '—'}{res.whois.createdAt ? ` · created: ${new Date(res.whois.createdAt).toLocaleDateString()} (${res.whois.ageDays ?? '—'} days)` : ''}</> : '—'}
            </div>

            <div>Heuristics</div>
            <div>{res.heuristics?.flags?.length ? res.heuristics.flags.join(', ') : '—'}</div>

            <div>Security headers</div>
            <div>{res.security?.headers ? Object.entries(res.security.headers).map(([k,v])=><div key={k} className="small text-muted">{k}: {v||'—'}</div>) : '—'}</div>

            <div>Cookies (Set-Cookie)</div>
            <div>{res.security?.cookies?.length ? res.security.cookies.map((c,i)=><div key={i} className="small text-muted">{c.name} · {c.secure?'Secure':''} {c.httponly?'HttpOnly':''} {c.samesite?`SameSite=${c.samesite}`:''}</div>) : '—'}</div>

            <div>3rd-party hosts</div>
            <div className="break-url">{res.networkHosts?.length ? res.networkHosts.slice(0,20).join(', ') : '—'}</div>
          </div>

          <div className="tabs" role="tablist" aria-label="Views">
            {res.screenshot && (
              <div
                role="tab"
                aria-selected={tab==='screenshot'}
                className={`tab ${tab==='screenshot'?'active':''}`}
                onClick={()=>setTab('screenshot')}
              >
                Screenshot
              </div>
            )}
            {res.sanitized && (
              <div
                role="tab"
                aria-selected={tab==='sanitized'}
                className={`tab ${tab==='sanitized'?'active':''}`}
                onClick={()=>setTab('sanitized')}
              >
                Sanitized HTML
              </div>
            )}
            <div
              role="tab"
              aria-selected={tab==='live'}
              className={`tab ${tab==='live'?'active':''}`}
              onClick={()=>setTab('live')}
            >
              Live (sandboxed)
            </div>
          </div>

          {tab==='screenshot' && res.screenshot && (
            <img className="screenshot" src={res.screenshot} alt="Page screenshot" />
          )}

          {tab==='sanitized' && (
            res.sanitized
              ? <iframe src={res.sanitized} sandbox="" style={{ width:'100%', height:480, border:'1px solid #1b2733', borderRadius:12 }} title="Sanitized preview"></iframe>
              : <div className="text-muted">No sanitized preview.</div>
          )}

          {tab==='live' && (
            res.finalUrl
              ? (LIVE_ORIGIN
                  ? <iframe
                      src={`${LIVE_ORIGIN}/live?url=${encodeURIComponent(res.finalUrl)}`}
                      sandbox="allow-scripts allow-forms allow-popups allow-top-navigation-by-user-activation allow-same-origin allow-popups-to-escape-sandbox allow-downloads"
                      style={{ width:'100%', height:480, border:'1px solid #1b2733', borderRadius:12 }}
                      title="Live sandboxed view"
                    />
                  : <div className="text-muted">Set <code>VITE_LIVE_ORIGIN</code> in <code>app/.env</code> to enable the sandboxed live view.</div>)
              : <div className="text-muted">No URL.</div>
          )}
        </div>
      )}

      {loading && (
        <div aria-hidden className="overlay" style={{
          position:'absolute', inset:0, background:'linear-gradient(180deg, rgba(0,0,0,.18), rgba(0,0,0,.24))',
          borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center'
        }}>
          <div className="small text-muted">Analyzing…</div>
        </div>
      )}
    </div>
  )
}
