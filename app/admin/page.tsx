'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

type Tab = 'dashboard' | 'users' | 'transactions' | 'topup'

interface DashData { totalUsers:number; totalBalance:number; totalRevenue:number; pending:number; served:number; totalOrders:number; stalls:Record<string,{name:string;revenue:number;orders:number;pending:number}> }
interface UserRow { id:number; uid:string; username:string; balance:number; blocked:boolean }
interface TxRow   { id:number; token_no:number; stall_id:string; stall_name:string; username:string; items:any; total:number; status:string; created_at:string }

function StatCard({ value, label, color }: { value:string|number; label:string; color:string }) {
  return (
    <div className="stat-card">
      <div className="stat-value" style={{ color }}>{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  )
}

export default function AdminPage() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('dashboard')
  const [dash, setDash]   = useState<DashData|null>(null)
  const [users, setUsers] = useState<UserRow[]>([])
  const [txns, setTxns]   = useState<TxRow[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState('')

  // Filters for transactions
  const [txStall, setTxStall]   = useState('All')
  const [txStatus, setTxStatus] = useState('All')
  const [txUser, setTxUser]     = useState('')

  // Top-up
  const [tuUser, setTuUser]     = useState('')
  const [tuAmount, setTuAmount] = useState(100)
  const [tuMsg, setTuMsg]       = useState('')

  // User search
  const [userSearch, setUserSearch] = useState('')
  const [expandedUser, setExpandedUser] = useState<string|null>(null)
  const [newPin, setNewPin] = useState<Record<string,string>>({})

  const api = useCallback(async (url: string) => {
    const r = await fetch(url)
    if (!r.ok) { router.replace('/'); return null }
    return r.json()
  }, [router])

  const loadDash  = useCallback(() => api('/api/admin?resource=dashboard').then(d => d && setDash(d)), [api])
  const loadUsers = useCallback(() => api('/api/admin?resource=users').then(d => d && setUsers(d)), [api])
  const loadTxns  = useCallback(() => api('/api/admin?resource=tokens').then(d => d && setTxns(d)), [api])

  useEffect(() => {
    // Check session
    fetch('/api/auth/whoami').then(r => { if (!r.ok) router.replace('/') }).then(() => {
      Promise.all([loadDash(), loadUsers(), loadTxns()]).then(() => setLoading(false))
    })
  }, [router, loadDash, loadUsers, loadTxns])

  const postAction = async (body: object) => {
    const r = await fetch('/api/admin', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) })
    return { ok: r.ok, data: await r.json() }
  }

  const doAction = async (key: string, body: object, refresh: ()=>void) => {
    setActionLoading(key)
    const { ok, data } = await postAction(body)
    if (!ok) alert(data.error)
    else refresh()
    setActionLoading('')
  }

  const signOut = async () => { await fetch('/api/auth/logout',{method:'POST'}); router.replace('/') }

  const filteredTxns = txns
    .filter(t => txStall  === 'All' || t.stall_id === txStall)
    .filter(t => txStatus === 'All' || t.status === txStatus)
    .filter(t => !txUser.trim() || t.username.toLowerCase().includes(txUser.toLowerCase()))

  const filteredRevenue = filteredTxns.reduce((s,t) => s + Number(t.total), 0)
  const stallIds = [...new Set(txns.map(t => t.stall_id))].sort()

  const filteredUsers = users.filter(u =>
    !userSearch.trim() || u.username.toLowerCase().includes(userSearch.toLowerCase()) || u.uid.toLowerCase().includes(userSearch.toLowerCase())
  )

  if (loading) return (
    <div className="page" style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh' }}>
      <div className="spinner" style={{ width:36, height:36 }} />
    </div>
  )

  return (
    <div className="page">
      <div className="container" style={{ paddingTop:16 }}>

        {/* TOP BAR */}
        <div className="top-bar anim-1" style={{ background:'linear-gradient(135deg,#7f1d1d,#b91c1c)' }}>
          <div>
            <div style={{ fontSize:'0.62rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', opacity:0.7 }}>Admin Panel</div>
            <div style={{ fontFamily:'var(--font-display)', fontSize:'1.1rem', fontWeight:800 }}>Administrator</div>
          </div>
          <button onClick={signOut} style={{ background:'rgba(255,255,255,0.15)', border:'none', color:'white', borderRadius:10, padding:'6px 14px', fontWeight:700, fontSize:'0.8rem', cursor:'pointer' }}>
            Sign Out
          </button>
        </div>

        {/* TABS */}
        <div className="tabs anim-2" style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)' }}>
          {(['dashboard','users','transactions','topup'] as Tab[]).map(t => (
            <button key={t} className={`tab${tab===t?' active':''}`} onClick={() => setTab(t)}>
              {t==='dashboard'?'📊':t==='users'?'👥':t==='transactions'?'📋':'💰'}
              <span style={{ display:'block', fontSize:'0.65rem', marginTop:2 }}>{t.charAt(0).toUpperCase()+t.slice(1)}</span>
            </button>
          ))}
        </div>

        {/* ── DASHBOARD ── */}
        {tab === 'dashboard' && dash && (
          <div className="anim-3">
            <p className="section-title">Live Summary</p>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:8 }}>
              <StatCard value={dash.totalUsers}  label="Users"       color="var(--accent)" />
              <StatCard value={`₹${dash.totalBalance.toFixed(0)}`} label="In System" color="var(--green)" />
              <StatCard value={dash.totalOrders} label="Total Orders" color="#d97706" />
              <StatCard value={`₹${dash.totalRevenue.toFixed(0)}`} label="Revenue" color="#a78bfa" />
              <StatCard value={dash.pending}     label="Pending"      color="var(--amber)" />
              <StatCard value={dash.served}      label="Served"       color="var(--green)" />
            </div>

            <p className="section-title" style={{ marginTop:18 }}>Per-Stall Breakdown</p>
            {Object.entries(dash.stalls).map(([sid, s]) => (
              <div key={sid} className="card" style={{ borderLeft:'3px solid #d97706', display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                <div>
                  <div style={{ fontSize:'0.9rem', fontWeight:800, color:'var(--text)' }}>{s.name}</div>
                  <div style={{ fontSize:'0.68rem', fontFamily:'var(--font-mono)', color:'var(--soft)' }}>{sid}</div>
                </div>
                <div style={{ textAlign:'right' }}>
                  <div style={{ fontFamily:'var(--font-mono)', fontWeight:700, color:'var(--green)' }}>₹{s.revenue.toFixed(0)}</div>
                  <div style={{ fontSize:'0.68rem', color:'var(--soft)' }}>{s.orders} orders · {s.pending} pending</div>
                </div>
              </div>
            ))}

            <div style={{ display:'flex', gap:8, marginTop:14 }}>
              <button className="btn btn-ghost" style={{ height:40, fontSize:'0.85rem' }} onClick={() => { loadDash(); loadUsers(); loadTxns() }}>
                🔄 Refresh
              </button>
            </div>
          </div>
        )}

        {/* ── USERS ── */}
        {tab === 'users' && (
          <div className="anim-3">
            <input className="input-field" style={{ marginBottom:14 }} placeholder="Search username or UID…"
              value={userSearch} onChange={e => setUserSearch(e.target.value)} />

            {filteredUsers.map(u => (
              <details key={u.uid} open={expandedUser === u.uid}
                onToggle={e => setExpandedUser((e.target as HTMLDetailsElement).open ? u.uid : null)}>
                <summary>
                  <span>{u.blocked ? '🔒' : '👤'} {u.username} <span style={{ fontFamily:'var(--font-mono)', fontSize:'0.7rem', color:'var(--soft)' }}>· {u.uid}</span></span>
                  <span className={u.blocked ? 'badge badge-red' : 'badge badge-green'} style={{ pointerEvents:'none' }}>
                    {u.blocked ? 'Blocked' : `₹${Number(u.balance).toFixed(2)}`}
                  </span>
                </summary>
                <div className="details-body">
                  <div className="info-row" style={{ marginBottom:6 }}><span className="info-label">UID</span><span className="info-value">{u.uid}</span></div>
                  <div className="info-row" style={{ marginBottom:6 }}><span className="info-label">Balance</span><span className="info-value">₹{Number(u.balance).toFixed(2)}</span></div>
                  <div className="info-row" style={{ marginBottom:12 }}><span className="info-label">Status</span><span className="info-value">{u.blocked ? '🔒 Blocked' : '✅ Active'}</span></div>

                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                    {!u.blocked ? (
                      <button className="btn btn-red btn-sm" disabled={!!actionLoading}
                        onClick={() => doAction(`blk-${u.username}`, { action:'block', username:u.username }, loadUsers)}>
                        {actionLoading===`blk-${u.username}` ? <span className="spinner" style={{width:14,height:14}}/> : '🔒 Block'}
                      </button>
                    ) : (
                      <div>
                        <input className="input-field" style={{ height:38, marginBottom:6, fontSize:'0.88rem' }} placeholder="New PIN (4 digits)"
                          maxLength={4} inputMode="numeric"
                          value={newPin[u.username]??''} onChange={e => setNewPin(p => ({...p,[u.username]:e.target.value.replace(/\D/g,'')}))} />
                        <button className="btn btn-green btn-sm" disabled={!!actionLoading}
                          onClick={() => doAction(`ublk-${u.username}`, { action:'unblock', username:u.username, new_pin:newPin[u.username] }, () => { loadUsers(); setNewPin(p=>({...p,[u.username]:''})) })}>
                          {actionLoading===`ublk-${u.username}` ? <span className="spinner" style={{width:14,height:14}}/> : '🔓 Unblock'}
                        </button>
                      </div>
                    )}
                    <button className="btn btn-ghost btn-sm" disabled={!!actionLoading}
                      onClick={() => doAction(`zero-${u.username}`, { action:'zero', username:u.username }, loadUsers)}>
                      {actionLoading===`zero-${u.username}` ? <span className="spinner" style={{width:14,height:14}}/> : '🔄 Zero Balance'}
                    </button>
                  </div>
                </div>
              </details>
            ))}

            <button className="btn btn-ghost" style={{ height:40, fontSize:'0.85rem', marginTop:10 }} onClick={loadUsers}>🔄 Refresh</button>
          </div>
        )}

        {/* ── TRANSACTIONS ── */}
        {tab === 'transactions' && (
          <div className="anim-3">
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:10 }}>
              <div>
                <label className="input-label">Stall</label>
                <select style={{ width:'100%', background:'var(--surface)', border:'1.5px solid var(--border)', borderRadius:10, color:'var(--text)', padding:'10px 12px', fontFamily:'var(--font-body)' }}
                  value={txStall} onChange={e => setTxStall(e.target.value)}>
                  <option>All</option>
                  {stallIds.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="input-label">Status</label>
                <select style={{ width:'100%', background:'var(--surface)', border:'1.5px solid var(--border)', borderRadius:10, color:'var(--text)', padding:'10px 12px', fontFamily:'var(--font-body)' }}
                  value={txStatus} onChange={e => setTxStatus(e.target.value)}>
                  <option>All</option><option>Pending</option><option>Served</option>
                </select>
              </div>
            </div>
            <input className="input-field" style={{ marginBottom:12 }} placeholder="Search username…"
              value={txUser} onChange={e => setTxUser(e.target.value)} />

            <div className="card" style={{ borderLeft:'3px solid #a78bfa', display:'flex', justifyContent:'space-between', marginBottom:12 }}>
              <span style={{ fontSize:'0.72rem', fontWeight:800, textTransform:'uppercase', color:'var(--soft)' }}>{filteredTxns.length} transaction{filteredTxns.length!==1?'s':''}</span>
              <span style={{ fontFamily:'var(--font-mono)', fontWeight:700, color:'#a78bfa' }}>₹{filteredRevenue.toFixed(2)}</span>
            </div>

            {filteredTxns.map(t => {
              const served = t.status === 'Served'
              return (
                <div key={t.id} className="card" style={{ borderLeft:`3px solid ${served?'var(--green)':'var(--amber)'}`, marginBottom:8 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:8 }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <span style={{ fontFamily:'var(--font-mono)', fontSize:'1.2rem', fontWeight:700, color:'var(--accent)' }}>#{t.token_no}</span>
                        <span style={{ fontSize:'0.78rem', fontWeight:700, color:'#d97706' }}>{t.stall_name}</span>
                      </div>
                      <div style={{ fontSize:'0.78rem', color:'var(--soft)', marginTop:3 }}>👤 {t.username}</div>
                      <div style={{ fontSize:'0.7rem', color:'var(--soft)', marginTop:2, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                        {Array.isArray(t.items) ? t.items.map((i:any)=>`${i.qty}x ${i.name}`).join(', ') : String(t.items)}
                      </div>
                      <div style={{ fontSize:'0.62rem', color:'var(--muted)', marginTop:2 }}>
                        🕐 {new Date(t.created_at).toLocaleString('en-IN',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}
                      </div>
                    </div>
                    <div style={{ textAlign:'right', flexShrink:0 }}>
                      <span className={served?'badge badge-green':'badge badge-amber'}>{served?'✅ Served':'⏳ Pending'}</span>
                      <div style={{ fontFamily:'var(--font-mono)', fontSize:'0.9rem', fontWeight:700, color:'var(--text)', marginTop:6 }}>₹{Number(t.total).toFixed(2)}</div>
                    </div>
                  </div>
                </div>
              )
            })}

            <button className="btn btn-ghost" style={{ height:40, fontSize:'0.85rem', marginTop:6 }} onClick={loadTxns}>🔄 Refresh</button>
          </div>
        )}

        {/* ── TOP UP ── */}
        {tab === 'topup' && (
          <div className="anim-3">
            <p className="section-title">Top Up User Balance</p>

            {tuMsg && <div className={`alert ${tuMsg.startsWith('✅')?'alert-success':'alert-error'}`}>{tuMsg}</div>}

            <label className="input-label">Select User</label>
            <select style={{ width:'100%', background:'var(--surface)', border:'1.5px solid var(--border)', borderRadius:12, color:'var(--text)', padding:'13px 16px', fontFamily:'var(--font-body)', fontSize:'1rem', marginBottom:12 }}
              value={tuUser} onChange={e => setTuUser(e.target.value)}>
              <option value="">-- Choose a user --</option>
              {users.filter(u=>!u.blocked).map(u => (
                <option key={u.uid} value={u.username}>{u.username} (₹{Number(u.balance).toFixed(2)})</option>
              ))}
            </select>

            {tuUser && (() => {
              const u = users.find(x => x.username === tuUser)
              if (!u) return null
              return (
                <>
                  <div className="card" style={{ marginBottom:14 }}>
                    <div style={{ fontSize:'0.65rem', fontWeight:800, textTransform:'uppercase', letterSpacing:'0.07em', color:'var(--soft)' }}>Current Balance</div>
                    <div style={{ fontFamily:'var(--font-mono)', fontSize:'1.5rem', fontWeight:700, color:'var(--accent)', marginTop:4 }}>₹{Number(u.balance).toFixed(2)}</div>
                  </div>
                  <label className="input-label">Amount (₹)</label>
                  <input className="input-field" style={{ marginBottom:14 }} type="number" min={1} max={100000}
                    value={tuAmount} onChange={e => setTuAmount(Number(e.target.value))} />
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                    <button className="btn btn-primary" disabled={!!actionLoading}
                      onClick={async () => {
                        setActionLoading('topup'); setTuMsg('')
                        const { ok, data } = await postAction({ action:'topup', username:tuUser, amount:tuAmount })
                        setActionLoading('')
                        if (ok) { setTuMsg(`✅ Added ₹${tuAmount} → ${tuUser} now has ₹${data.new_balance.toFixed(2)}`); loadUsers() }
                        else setTuMsg(`❌ ${data.error}`)
                      }}>
                      {actionLoading==='topup'?<span className="spinner"/>:'➕ Add'}
                    </button>
                    <button className="btn btn-ghost" disabled={!!actionLoading}
                      onClick={async () => {
                        setActionLoading('set'); setTuMsg('')
                        const { ok, data } = await postAction({ action:'set_balance', username:tuUser, amount:tuAmount })
                        setActionLoading('')
                        if (ok) { setTuMsg(`✅ Balance set to ₹${tuAmount} for ${tuUser}`); loadUsers() }
                        else setTuMsg(`❌ ${data.error}`)
                      }}>
                      {actionLoading==='set'?<span className="spinner"/>:'🔄 Set'}
                    </button>
                  </div>
                </>
              )
            })()}
          </div>
        )}

      </div>
    </div>
  )

  async function postAction(body: object) {
    const r = await fetch('/api/admin', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) })
    return { ok: r.ok, data: await r.json() }
  }
}
