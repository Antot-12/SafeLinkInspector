import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { analyze, apiGet, apiDel, apiPost } from '../api'

const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/+$/,'')
const joinApi = (p) => `${API_BASE}${p.startsWith('/') ? p : '/'+p}`

export default function History(){
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)

  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [risk, setRisk] = useState('all')
  const [sort, setSort] = useState('newest')

  const [clearing, setClearing] = useState(false)
  const [busyId, setBusyId] = useState(null)
  const fileRef = useRef(null)

  useEffect(()=>{
    const t = setTimeout(()=> setSearch(searchInput.trim()), 200)
    return ()=> clearTimeout(t)
  }, [searchInput])

  const reload = useCallback(async ()=>{
    setLoading(true)
    try{
      const j = await apiGet('/api/history')
      setItems(Array.isArray(j.items) ? j.items : [])
    }catch{}
    setLoading(false)
  },[])
  useEffect(()=>{ reload() },[reload])

  useEffect(()=>{
    const onRefresh = ()=> reload()
    window.addEventListener('safelink:history-refresh', onRefresh)
    return ()=> window.removeEventListener('safelink:history-refresh', onRefresh)
  },[reload])

  const formatter = useMemo(()=> new Intl.DateTimeFormat(undefined, {
    year:'numeric', month:'2-digit', day:'2-digit',
    hour:'2-digit', minute:'2-digit', second:'2-digit'
  }), [])

  const hostOf = useCallback((u)=>{
    try{
      const h = new URL(u).hostname || ''
      return h.startsWith('www.') ? h.slice(4) : h
    }catch{ return '' }
  },[])

  const filtered = useMemo(()=>{
    const s = search.toLowerCase()
    const arr = items.filter(it=>{
      const txt = `${it.title||''} ${it.finalUrl||''} ${hostOf(it.finalUrl)}`.toLowerCase()
      const okSearch = !s || txt.includes(s)
      const okRisk = risk==='all' || (it.risk?.label||'').toLowerCase()===risk
      return okSearch && okRisk
    })
    if (sort==='risk') {
      arr.sort((a,b)=>(b.risk?.score||0)-(a.risk?.score||0))
    } else {
      arr.sort((a,b)=> new Date(b.startedAt)-new Date(a.startedAt))
    }
    return arr
  },[items, search, risk, sort, hostOf])

  const onDelete = useCallback(async (id)=>{
    setBusyId(id)
    try{
      await apiDel(`/api/history/${id}`)
      await reload()
    }catch{}
    setBusyId(null)
  },[reload])

  const onClear = useCallback(async ()=>{
    if (!confirm('Clear entire history?')) return
    setClearing(true)
    try{
      await apiDel('/api/history')
      await reload()
    }catch{}
    setClearing(false)
  },[reload])

  const onCopy = useCallback(async (text)=>{
    try{ await navigator.clipboard.writeText(text) }catch{}
  },[])

  const onReAnalyze = useCallback(async (url)=>{
    setBusyId(url)
    try{
      const data = await analyze(url)
      window.dispatchEvent(new CustomEvent('safelink:show', { detail: data }))
      window.dispatchEvent(new CustomEvent('safelink:history-refresh'))
      await reload()
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }catch{}
    setBusyId(null)
  },[reload])

  const onShow = useCallback((item)=>{
    window.dispatchEvent(new CustomEvent('safelink:show', { detail: item }))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  },[])

  const onImport = useCallback(async (e)=>{
    const file = e.target.files?.[0]
    if (!file) return
    try{
      const text = await file.text()
      const data = JSON.parse(text)
      await apiPost('/api/history/import', data)
      await reload()
    }catch{}
    e.target.value = ''
  },[reload])

  const onSearchKeyDown = useCallback((e)=>{
    if (e.key === 'Enter' && filtered.length){
      e.preventDefault()
      onShow(filtered[0])
    }
  },[filtered, onShow])

  return (
    <div className="card">
      <div className="history-header">
        <div className="history-title">
          <div style={{fontWeight:800}}>History</div>
          <div className="history-count">
            {loading ? 'Loading…' : `Last ${items.length} items${filtered.length!==items.length ? ` · filtered: ${filtered.length}`:''}`}
          </div>
        </div>

        <div className="history-toolbar">
          <input
            className="input history-search"
            placeholder="Search or domain…"
            value={searchInput}
            onChange={e=>setSearchInput(e.target.value)}
            onKeyDown={onSearchKeyDown}
            aria-label="Search history"
          />

          <div className="history-actions">
            <select className="input" value={risk} onChange={e=>setRisk(e.target.value)} aria-label="Filter by risk">
              <option value="all">All risks</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>

            <select className="input" value={sort} onChange={e=>setSort(e.target.value)} aria-label="Sort">
              <option value="newest">Newest first</option>
              <option value="risk">Risk (desc)</option>
            </select>

            <a className="btn btn-sm" href={joinApi('/api/history/export?fmt=csv')} rel="noopener" download>
              Export CSV
            </a>
            <a className="btn btn-sm" href={joinApi('/api/history/export?fmt=json')} rel="noopener" download>
              Export JSON
            </a>

            <input
              type="file"
              ref={fileRef}
              accept="application/json,.json"
              style={{display:'none'}}
              onChange={onImport}
            />
            <button className="btn btn-sm" onClick={()=>fileRef.current?.click()}>
              Import JSON
            </button>

            <button className="btn btn-sm" onClick={onClear} disabled={clearing}>
              {clearing ? 'Clearing…' : 'Clear all'}
            </button>
          </div>
        </div>
      </div>

      <div className="list" aria-busy={loading ? 'true':'false'}>
        {filtered.map(it=> (
          <div className="item" key={it.id}>
            <div className="item-top">
              <div style={{display:'flex',flexDirection:'column',gap:4,minWidth:0}}>
                <a
                  href={it.finalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{color:'inherit',fontWeight:700,wordBreak:'break-word',overflowWrap:'anywhere'}}
                  title={it.title || it.finalUrl}
                >
                  {it.title || it.finalUrl}
                </a>
                <div className="item-meta">
                  {formatter.format(new Date(it.startedAt))} · {hostOf(it.finalUrl)}
                </div>
              </div>
              <div className={`risk-chip ${String(it.risk?.label||'').toLowerCase()}`}>
                {it.risk?.label} ({it.risk?.score})
              </div>
            </div>

            <div className="item-links">
              <a className="pill" href={it.finalUrl} target="_blank" rel="noopener noreferrer">Final URL</a>
              {it.sanitized && (
                <a className="pill" href={joinApi(it.sanitized)} target="_blank" rel="noopener noreferrer">
                  Sanitized
                </a>
              )}
            </div>

            <div className="item-actions">
              <button className="btn btn-sm" onClick={()=>onShow(it)}>Show in analyzer</button>
              <a className="btn btn-sm" href={it.finalUrl} target="_blank" rel="noopener noreferrer">Open</a>
              <a className="btn btn-sm" href={joinApi(`/live?url=${encodeURIComponent(it.finalUrl)}`)} target="_blank" rel="noopener noreferrer">Live (sandboxed)</a>
              {it.sanitized && <a className="btn btn-sm" href={joinApi(it.sanitized)} target="_blank" rel="noopener noreferrer">View sanitized</a>}
              <button className="btn btn-sm" onClick={()=>onCopy(it.finalUrl)}>Copy URL</button>
              <button className="btn btn-sm" onClick={()=>onReAnalyze(it.finalUrl)} disabled={busyId===it.finalUrl}>
                {busyId===it.finalUrl ? 'Re-analyzing…' : 'Re-analyze'}
              </button>
              <button className="btn btn-sm" onClick={()=>onDelete(it.id)} disabled={busyId===it.id}>
                {busyId===it.id ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        ))}
        {!loading && !filtered.length && <div className="text-muted">No items.</div>}
      </div>
    </div>
  )
}
