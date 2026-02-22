'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { StallWithMenu, Cart, Token } from '@/types'

type View = 'home' | 'stalls' | 'stall_detail' | 'token' | 'my_tokens'

interface LastToken { token_no: number; stall_id: string; stall_name: string; items: Cart; total: number; time: string }

function PinDots({ count }: { count: number }) {
  return (
    <div className="pin-dots">
      {[0,1,2,3].map(i => <div key={i} className={`pin-dot${i < count ? ' filled' : ''}`} />)}
    </div>
  )
}

function StatCard({ value, label, color }: { value: string|number; label: string; color: string }) {
  return (
    <div className="stat-card">
      <div className="stat-value" style={{ color }}>{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  )
}

export default function UserPage() {
  const router = useRouter()
  const [view, setView] = useState<View>('home')
  const [session, setSession] = useState<{ username: string; uid: string } | null>(null)
  const [balance, setBalance] = useState(0)
  const [stalls, setStalls] = useState<StallWithMenu[]>([])
  const [selectedStall, setSelectedStall] = useState<StallWithMenu | null>(null)
  const [cart, setCart] = useState<Cart>({})
  const [tokens, setTokens] = useState<Token[]>([])
  const [lastToken, setLastToken] = useState<LastToken | null>(null)
  const [search, setSearch] = useState('')
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [pageLoading, setPageLoading] = useState(true)
  const realtimeRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  // Load session from cookie via API
  useEffect(() => {
    fetch('/api/users/balance')
      .then(r => {
        if (!r.ok) { router.replace('/'); return null }
        return r.json()
      })
      .then(d => {
        if (!d) return
        setBalance(d.balance)
        // Get session info from whoami
        fetch('/api/auth/whoami').then(r => r.json()).then(s => {
          if (s.username) setSession({ username: s.username, uid: s.uid })
        })
        setPageLoading(false)
      })
  }, [router])

  const refreshBalance = useCallback(async () => {
    const r = await fetch('/api/users/balance')
    if (r.ok) { const d = await r.json(); setBalance(d.balance) }
  }, [])

  const loadStalls = useCallback(async () => {
    const r = await fetch('/api/stalls')
    if (r.ok) setStalls(await r.json())
  }, [])

  const loadTokens = useCallback(async () => {
    const r = await fetch('/api/tokens')
    if (r.ok) setTokens(await r.json())
  }, [])

  // Realtime subscription for token status updates
  useEffect(() => {
    if (view !== 'my_tokens' || !session) return
    loadTokens()

    realtimeRef.current = supabase
      .channel('user-tokens')
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'tokens',
        filter: `username=eq.${session.username}`,
      }, () => loadTokens())
      .subscribe()

    return () => { realtimeRef.current?.unsubscribe() }
  }, [view, session, loadTokens])

  useEffect(() => { if (view === 'stalls') loadStalls() }, [view, loadStalls])
  useEffect(() => { if (view === 'home') { refreshBalance(); const t = setInterval(refreshBalance, 10000); return () => clearInterval(t) } }, [view, refreshBalance])

  const goTo = (v: View) => { setView(v); setError('') }

  const setQty = (name: string, price: number, delta: number) => {
    setCart(prev => {
      const cur = prev[name]?.qty ?? 0
      const next = cur + delta
      if (next <= 0) { const c = {...prev}; delete c[name]; return c }
      return { ...prev, [name]: { price, qty: next } }
    })
  }

  const cartTotal = Object.values(cart).reduce((s, i) => s + i.price * i.qty, 0)
  const cartCount = Object.values(cart).reduce((s, i) => s + i.qty, 0)

  const handlePay = async () => {
    if (!selectedStall || !session) return
    setError(''); setLoading(true)
    const pinClean = pin.replace(/\D/g,'')
    if (pinClean.length !== 4) { setError('Enter your 4-digit PIN'); setLoading(false); return }

    const items = Object.entries(cart).map(([name, v]) => ({ name, qty: v.qty, price: v.price }))
    const r = await fetch('/api/tokens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stall_id: selectedStall.stall_id, stall_name: selectedStall.name, items, total: cartTotal, pin: pinClean }),
    })
    const d = await r.json()
    setLoading(false)
    if (!r.ok) { setError(d.error); return }

    setBalance(d.new_balance)
    setLastToken({
      token_no: d.token_no,
      stall_id: selectedStall.stall_id,
      stall_name: selectedStall.name,
      items: { ...cart },
      total: cartTotal,
      time: new Date().toLocaleString('en-IN', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }),
    })
    setCart({})
    setPin('')
    goTo('token')
  }

  const signOut = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.replace('/')
  }

  if (pageLoading) return (
    <div className="page" style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh' }}>
      <div className="spinner" style={{ width:36, height:36 }} />
    </div>
  )

  return (
    <div className="page">
      <div className="container" style={{ paddingTop: 16 }}>

        {/* TOP BAR */}
        <div className="top-bar anim-1" style={{ background: 'linear-gradient(135deg,#1e3a8a,#312e81)' }}>
          <div>
            <div style={{ fontSize:'0.62rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', opacity:0.7 }}>Logged in as User</div>
            <div style={{ fontFamily:'var(--font-display)', fontSize:'1.1rem', fontWeight:800 }}>{session?.username}</div>
            <div style={{ fontSize:'0.58rem', opacity:0.5, fontFamily:'var(--font-mono)' }}>{session?.uid}</div>
          </div>
          <div style={{ textAlign:'right' }}>
            <div style={{ fontSize:'0.6rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', opacity:0.7 }}>Balance</div>
            <div style={{ fontFamily:'var(--font-mono)', fontSize:'1.4rem', fontWeight:700 }}>₹{balance.toLocaleString('en-IN', {minimumFractionDigits:2})}</div>
          </div>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {/* ── HOME ── */}
        {view === 'home' && (
          <div className="anim-2">
            <p className="section-title">What would you like to do?</p>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:18 }}>
              <button className="btn btn-primary" onClick={() => goTo('stalls')}>🏪 Browse Stalls</button>
              <button className="btn btn-ghost" onClick={() => goTo('my_tokens')}>🎟️ My Tokens</button>
            </div>
            <div className="info-row"><span className="info-label">Username</span><span className="info-value">{session?.username}</span></div>
            <div className="info-row"><span className="info-label">UID</span><span className="info-value">{session?.uid}</span></div>
            <div className="info-row"><span className="info-label">Balance</span><span className="info-value">₹{balance.toLocaleString('en-IN',{minimumFractionDigits:2})}</span></div>
            <button className="btn btn-ghost" style={{ marginTop:14 }} onClick={signOut}>🔓 Sign Out</button>
          </div>
        )}

        {/* ── MY TOKENS ── */}
        {view === 'my_tokens' && (
          <div className="anim-2">
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
              <button className="btn btn-ghost btn-sm" style={{ width:'auto', padding:'0 14px' }} onClick={() => goTo('home')}>← Back</button>
              <span style={{ fontFamily:'var(--font-display)', fontWeight:700, color:'var(--text)' }}>My Order History</span>
            </div>
            {tokens.length > 0 ? (
              <>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:14 }}>
                  <StatCard value={tokens.length} label="Orders" color="var(--accent)" />
                  <StatCard value={tokens.filter(t=>t.status==='Pending').length} label="Pending" color="var(--amber)" />
                  <StatCard value={`₹${tokens.reduce((s,t)=>s+Number(t.total),0).toFixed(0)}`} label="Spent" color="var(--green)" />
                </div>
                <p className="hint" style={{ marginBottom:12 }}>⚡ Live updates via Supabase Realtime</p>
                {tokens.map(t => {
                  const served = t.status === 'Served'
                  return (
                    <div key={t.id} className="card" style={{ borderLeft:`3px solid ${served ? 'var(--green)' : 'var(--amber)'}`, marginBottom:10 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                        <div>
                          <div style={{ fontFamily:'var(--font-mono)', fontSize:'1.4rem', fontWeight:700, color:'var(--accent)' }}>#{t.token_no}</div>
                          <div style={{ fontSize:'0.88rem', fontWeight:700, color:'var(--text)', marginTop:2 }}>
                            {t.stall_name} <span style={{ fontSize:'0.68rem', color:'var(--soft)' }}>({t.stall_id})</span>
                          </div>
                          <div style={{ fontSize:'0.74rem', color:'var(--soft)', marginTop:3 }}>
                            {Array.isArray(t.items) ? t.items.map((i:any)=>`${i.qty}x ${i.name}`).join(', ') : String(t.items)}
                          </div>
                          <div style={{ fontSize:'0.65rem', color:'var(--muted)', marginTop:2 }}>
                            🕐 {new Date(t.created_at).toLocaleString('en-IN',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}
                          </div>
                        </div>
                        <div style={{ textAlign:'right', flexShrink:0, marginLeft:8 }}>
                          <span className={served ? 'badge badge-green' : 'badge badge-amber'}>{served ? '✅ Served' : '⏳ Pending'}</span>
                          <div style={{ fontFamily:'var(--font-mono)', fontSize:'0.9rem', fontWeight:700, color:'var(--text)', marginTop:6 }}>₹{Number(t.total).toFixed(2)}</div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </>
            ) : (
              <div className="alert alert-info">You haven't placed any orders yet.</div>
            )}
          </div>
        )}

        {/* ── STALLS LIST ── */}
        {view === 'stalls' && (
          <div className="anim-2">
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
              <button className="btn btn-ghost btn-sm" style={{ width:'auto', padding:'0 14px' }} onClick={() => goTo('home')}>← Back</button>
              <span style={{ fontFamily:'var(--font-display)', fontWeight:700, color:'var(--text)' }}>Browse Stalls</span>
            </div>
            <input className="input-field" style={{ marginBottom:14 }} value={search}
              onChange={e => setSearch(e.target.value)} placeholder="Search by name or ID…" />
            {stalls
              .filter(s => !search.trim() || s.name.toLowerCase().includes(search.toLowerCase()) || s.stall_id.toLowerCase().includes(search.toLowerCase()))
              .map(s => (
                <button key={s.stall_id} style={{ width:'100%', background:'none', border:'none', marginBottom:8, padding:0 }}
                  onClick={() => { setSelectedStall(s); setCart({}); goTo('stall_detail') }}>
                  <div className="card" style={{ display:'flex', justifyContent:'space-between', alignItems:'center', cursor:'pointer', transition:'border-color 0.2s' }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor='var(--accent)')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor='var(--border)')}>
                    <div style={{ textAlign:'left' }}>
                      <div style={{ fontSize:'0.95rem', fontWeight:800, color:'var(--text)' }}>{s.name}</div>
                      <div style={{ fontSize:'0.7rem', fontFamily:'var(--font-mono)', color:'var(--soft)', marginTop:2 }}>
                        {s.stall_id} · {s.menu_items?.length ?? 0} items
                      </div>
                    </div>
                    <div style={{ fontSize:'1.2rem', color:'var(--accent)' }}>›</div>
                  </div>
                </button>
              ))
            }
          </div>
        )}

        {/* ── STALL DETAIL + CART ── */}
        {view === 'stall_detail' && selectedStall && (
          <div className="anim-2">
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14 }}>
              <button className="btn btn-ghost btn-sm" style={{ width:'auto', padding:'0 14px' }} onClick={() => { goTo('stalls'); setCart({}) }}>← Back</button>
              {cartCount > 0 && (
                <button className="btn btn-ghost btn-sm" style={{ width:'auto', padding:'0 14px' }} onClick={() => setCart({})}>🗑️ Clear</button>
              )}
              <span style={{ fontFamily:'var(--font-display)', fontWeight:700, color:'var(--text)', flex:1 }}>
                {selectedStall.name}
              </span>
              <span style={{ fontSize:'0.7rem', fontFamily:'var(--font-mono)', color:'var(--soft)' }}>{selectedStall.stall_id}</span>
            </div>

            {selectedStall.menu_items?.map(item => {
              const qty = cart[item.name]?.qty ?? 0
              return (
                <div key={item.id} className="menu-row">
                  <div style={{ flex:1, fontSize:'0.92rem', fontWeight:700, color:'var(--text)' }}>{item.name}</div>
                  <div style={{ fontFamily:'var(--font-mono)', fontSize:'0.85rem', color:'var(--accent)', marginRight:12, fontWeight:600 }}>₹{item.price}</div>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <button className="qty-btn" onClick={() => setQty(item.name, item.price, -1)} disabled={qty === 0}>−</button>
                    <span style={{ fontFamily:'var(--font-mono)', fontWeight:700, minWidth:18, textAlign:'center', color:'var(--text)' }}>{qty}</span>
                    <button className="qty-btn" onClick={() => setQty(item.name, item.price, 1)}>+</button>
                  </div>
                </div>
              )
            })}

            {cartCount > 0 ? (
              <>
                <div className="cart-bar" style={{ marginTop:16 }}>
                  <div style={{ fontSize:'0.7rem', fontWeight:800, textTransform:'uppercase', letterSpacing:'0.08em', color:'var(--accent)', marginBottom:8 }}>🛒 Your Cart</div>
                  {Object.entries(cart).map(([name, v]) => (
                    <div key={name} style={{ display:'flex', justifyContent:'space-between', fontSize:'0.88rem', fontWeight:600, color:'var(--soft)', padding:'3px 0' }}>
                      <span>{v.qty}× {name}</span><span>₹{(v.price * v.qty).toFixed(0)}</span>
                    </div>
                  ))}
                  <div style={{ borderTop:'1px solid var(--border)', marginTop:8, paddingTop:8, display:'flex', justifyContent:'space-between', fontWeight:800, color:'var(--text)' }}>
                    <span>Total</span><span>₹{cartTotal.toFixed(2)}</span>
                  </div>
                </div>

                {balance < cartTotal ? (
                  <div className="alert alert-error">❌ Insufficient balance (₹{balance.toFixed(2)} available, ₹{cartTotal.toFixed(2)} needed)</div>
                ) : (
                  <>
                    <p className="hint" style={{ marginBottom:8 }}>Enter your PIN to confirm payment</p>
                    <input className="input-field" type="password" inputMode="numeric" maxLength={4}
                      value={pin} onChange={e => setPin(e.target.value.replace(/\D/g,''))} placeholder="••••" />
                    <PinDots count={Math.min(pin.length, 4)} />
                    <button className="btn btn-primary" style={{ marginTop:8 }} onClick={handlePay} disabled={loading}>
                      {loading ? <span className="spinner" /> : `💳 Pay ₹${cartTotal.toFixed(2)}`}
                    </button>
                  </>
                )}
              </>
            ) : (
              <p className="hint" style={{ marginTop:20 }}>Tap + to add items to your cart</p>
            )}
          </div>
        )}

        {/* ── TOKEN CONFIRMATION ── */}
        {view === 'token' && lastToken && (
          <div className="anim-2">
            <div className="token-card">
              <div style={{ fontSize:'0.7rem', fontWeight:800, textTransform:'uppercase', letterSpacing:'0.12em', opacity:0.8 }}>🎉 Order Confirmed!</div>
              <div style={{ fontSize:'0.65rem', opacity:0.6, marginTop:14, letterSpacing:'0.1em', textTransform:'uppercase' }}>Token Number</div>
              <div className="token-number">#{lastToken.token_no}</div>
              <div style={{ fontSize:'0.95rem', fontWeight:800, marginTop:10 }}>
                📍 {lastToken.stall_name} <span style={{ opacity:0.6, fontSize:'0.75rem' }}>({lastToken.stall_id})</span>
              </div>
              <div style={{ marginTop:10, lineHeight:1.8 }}>
                {Object.entries(lastToken.items).map(([name,v]) => (
                  <div key={name} style={{ fontSize:'0.85rem', opacity:0.9 }}>{v.qty}× {name} — ₹{(v.price*v.qty).toFixed(0)}</div>
                ))}
              </div>
              <div style={{ fontFamily:'var(--font-mono)', fontSize:'1.2rem', fontWeight:700, marginTop:14, paddingTop:14, borderTop:'1px solid rgba(255,255,255,0.15)' }}>
                Total Paid: ₹{lastToken.total.toFixed(2)}
              </div>
              <div style={{ fontSize:'0.62rem', opacity:0.5, marginTop:6 }}>{lastToken.time}</div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginTop:14 }}>
              <button className="btn btn-ghost" onClick={() => { setLastToken(null); goTo('stalls') }}>🛍️ Order More</button>
              <button className="btn btn-primary" onClick={() => { setLastToken(null); goTo('home') }}>🏠 Home</button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
