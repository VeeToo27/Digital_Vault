'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Token } from '@/types'

type Tab = 'orders' | 'menu'
type Filter = 'Pending' | 'Served' | 'All'

function StatCard({ value, label, color }: { value: string|number; label: string; color: string }) {
  return (
    <div className="stat-card">
      <div className="stat-value" style={{ color }}>{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  )
}

export default function StallPage() {
  const router = useRouter()
  const [stall, setStall] = useState<{ stall_id: string; stall_name: string } | null>(null)
  const [menu, setMenu] = useState<{ id: number; name: string; price: number }[]>([])
  const [tokens, setTokens] = useState<Token[]>([])
  const [tab, setTab] = useState<Tab>('orders')
  const [filter, setFilter] = useState<Filter>('Pending')
  const [loading, setLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState<number | null>(null)
  const [lastUpdated, setLastUpdated] = useState(new Date())
  const realtimeRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  const loadTokens = useCallback(async () => {
    const r = await fetch('/api/tokens/stall')
    if (!r.ok) { router.replace('/'); return }
    setTokens(await r.json())
    setLastUpdated(new Date())
  }, [router])

  useEffect(() => {
    // Load session + menu
    fetch('/api/auth/whoami')
      .then(r => { if (!r.ok) { router.replace('/'); return null } return r.json() })
      .then(d => {
        if (!d) return
        setStall({ stall_id: d.stall_id, stall_name: d.stall_name })
        // Load menu
        fetch('/api/stalls').then(r => r.json()).then((stalls: any[]) => {
          const s = stalls.find((s: any) => s.stall_id === d.stall_id)
          if (s) setMenu(s.menu_items ?? [])
        })
        setLoading(false)
      })
    loadTokens()
  }, [router, loadTokens])

  // Realtime: new tokens or status changes for this stall
  useEffect(() => {
    if (!stall) return
    realtimeRef.current = supabase
      .channel(`stall-${stall.stall_id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'tokens',
        filter: `stall_id=eq.${stall.stall_id}`,
      }, () => loadTokens())
      .subscribe()
    return () => { realtimeRef.current?.unsubscribe() }
  }, [stall, loadTokens])

  const toggleStatus = async (t: Token) => {
    setUpdatingId(t.id)
    const newStatus = t.status === 'Served' ? 'Pending' : 'Served'
    const r = await fetch('/api/tokens/stall', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token_id: t.id, status: newStatus }),
    })
    if (r.ok) {
      setTokens(prev => prev.map(x => x.id === t.id ? { ...x, status: newStatus } : x))
      setLastUpdated(new Date())
    }
    setUpdatingId(null)
  }

  const signOut = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.replace('/')
  }

  const pending = tokens.filter(t => t.status === 'Pending')
  const served  = tokens.filter(t => t.status === 'Served')
  const display = filter === 'Pending' ? pending : filter === 'Served' ? served : tokens

  if (loading) return (
    <div className="page" style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh' }}>
      <div className="spinner" style={{ width:36, height:36 }} />
    </div>
  )

  return (
    <div className="page">
      <div className="container" style={{ paddingTop:16 }}>

        {/* TOP BAR */}
        <div className="top-bar anim-1" style={{ background:'linear-gradient(135deg,#78350f,#b45309)' }}>
          <div>
            <div style={{ fontSize:'0.62rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', opacity:0.7 }}>Stall Owner</div>
            <div style={{ fontFamily:'var(--font-display)', fontSize:'1.1rem', fontWeight:800 }}>{stall?.stall_name}</div>
            <div style={{ fontSize:'0.58rem', opacity:0.5, fontFamily:'var(--font-mono)' }}>{stall?.stall_id}</div>
          </div>
          <button onClick={signOut} style={{ background:'rgba(255,255,255,0.15)', border:'none', color:'white', borderRadius:10, padding:'6px 14px', fontWeight:700, fontSize:'0.8rem', cursor:'pointer' }}>
            Sign Out
          </button>
        </div>

        {/* TABS */}
        <div className="tabs anim-2">
          <button className={`tab${tab==='orders' ? ' active' : ''}`} onClick={() => setTab('orders')}>🎟️ Orders</button>
          <button className={`tab${tab==='menu' ? ' active' : ''}`} onClick={() => setTab('menu')}>🍽️ Menu</button>
        </div>

        {/* ── ORDERS ── */}
        {tab === 'orders' && (
          <div className="anim-3">
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:12 }}>
              <StatCard value={tokens.length}  label="Total"   color="#d97706" />
              <StatCard value={pending.length} label="Pending" color="var(--amber)" />
              <StatCard value={served.length}  label="Served"  color="var(--green)" />
            </div>

            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
              <p className="hint" style={{ margin:0 }}>⚡ Realtime · Updated {lastUpdated.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}</p>
              <button className="btn btn-ghost btn-sm" style={{ width:'auto', padding:'0 12px' }} onClick={loadTokens}>↻</button>
            </div>

            {/* Filter */}
            <div style={{ display:'flex', gap:6, marginBottom:14 }}>
              {(['Pending','Served','All'] as Filter[]).map(f => (
                <button key={f} onClick={() => setFilter(f)}
                  style={{ flex:1, height:36, borderRadius:10, fontSize:'0.8rem', fontWeight:700, cursor:'pointer', border:'1px solid',
                    background: filter===f ? (f==='Pending' ? 'rgba(245,158,11,0.15)' : f==='Served' ? 'rgba(34,197,94,0.15)' : 'rgba(79,127,255,0.15)') : 'var(--surface)',
                    color: filter===f ? (f==='Pending' ? 'var(--amber)' : f==='Served' ? 'var(--green)' : 'var(--accent)') : 'var(--soft)',
                    borderColor: filter===f ? (f==='Pending' ? 'rgba(245,158,11,0.4)' : f==='Served' ? 'rgba(34,197,94,0.4)' : 'rgba(79,127,255,0.4)') : 'var(--border)',
                  }}>
                  {f === 'Pending' ? '⏳ Pending' : f === 'Served' ? '✅ Served' : 'All'}
                </button>
              ))}
            </div>

            {display.length === 0 ? (
              <div className="alert alert-info">{tokens.length === 0 ? 'No orders yet.' : 'No orders in this filter.'}</div>
            ) : (
              display.map(t => {
                const isServed = t.status === 'Served'
                return (
                  <div key={t.id} className="card" style={{ borderLeft:`3px solid ${isServed ? 'var(--green)' : 'var(--amber)'}`, marginBottom:10 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:8 }}>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontFamily:'var(--font-mono)', fontSize:'1.4rem', fontWeight:700, color:'var(--accent)', lineHeight:1.1 }}>#{t.token_no}</div>
                        <div style={{ fontSize:'0.8rem', fontWeight:700, color:'var(--soft)', marginTop:3 }}>👤 {t.username}</div>
                        <div style={{ fontSize:'0.72rem', color:'var(--soft)', marginTop:3, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                          {Array.isArray(t.items) ? t.items.map((i:any)=>`${i.qty}x ${i.name}`).join(', ') : String(t.items)}
                        </div>
                        <div style={{ fontSize:'0.62rem', color:'var(--muted)', marginTop:3 }}>
                          🕐 {new Date(t.created_at).toLocaleString('en-IN',{hour:'2-digit',minute:'2-digit',day:'2-digit',month:'short'})}
                        </div>
                      </div>
                      <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:6, flexShrink:0 }}>
                        <span className={isServed ? 'badge badge-green' : 'badge badge-amber'}>{isServed ? '✅ Served' : '⏳ Pending'}</span>
                        <div style={{ fontFamily:'var(--font-mono)', fontSize:'0.88rem', fontWeight:700, color:'var(--text)' }}>₹{Number(t.total).toFixed(2)}</div>
                        <button
                          onClick={() => toggleStatus(t)}
                          disabled={updatingId === t.id}
                          style={{ height:32, padding:'0 12px', borderRadius:8, fontSize:'0.78rem', fontWeight:700, cursor:'pointer', border:'1px solid',
                            background: isServed ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.12)',
                            color: isServed ? 'var(--red)' : 'var(--green)',
                            borderColor: isServed ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.3)',
                          }}>
                          {updatingId === t.id ? <span className="spinner" style={{ width:14, height:14 }} /> : isServed ? '↩️ Undo' : '✅ Serve'}
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}

        {/* ── MENU ── */}
        {tab === 'menu' && (
          <div className="anim-3">
            <p className="section-title">Your Menu</p>
            {menu.length === 0 ? (
              <div className="alert alert-info">No menu items found.</div>
            ) : (
              menu.map(item => (
                <div key={item.id} className="card" style={{ borderLeft:'3px solid #d97706', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div style={{ fontSize:'0.92rem', fontWeight:700, color:'var(--text)' }}>{item.name}</div>
                  <div style={{ fontFamily:'var(--font-mono)', fontSize:'0.95rem', fontWeight:700, color:'#d97706' }}>₹{item.price}</div>
                </div>
              ))
            )}
            <div className="info-row" style={{ marginTop:16 }}>
              <span className="info-label">Stall ID</span>
              <span className="info-value">{stall?.stall_id}</span>
            </div>
            <div className="info-row">
              <span className="info-label">Menu Items</span>
              <span className="info-value">{menu.length}</span>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
