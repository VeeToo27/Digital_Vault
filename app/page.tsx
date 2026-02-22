'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Tab = 'user' | 'stall' | 'admin'

function PinDots({ count }: { count: number }) {
  return (
    <div className="pin-dots">
      {[0,1,2,3].map(i => (
        <div key={i} className={`pin-dot${i < count ? ' filled' : ''}`} />
      ))}
    </div>
  )
}

function Alert({ msg, type }: { msg: string; type: 'error'|'success' }) {
  return <div className={`alert alert-${type}`}>{msg}</div>
}

export default function LoginPage() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('user')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showRegister, setShowRegister] = useState(false)

  // User login
  const [uUser, setUUser] = useState('')
  const [uPin, setUPin] = useState('')

  // Register
  const [rUser, setRUser] = useState('')
  const [rPin, setRPin] = useState('')
  const [rConf, setRConf] = useState('')

  // Stall
  const [sId, setSId] = useState('')
  const [sName, setSName] = useState('')
  const [sPin, setSPin] = useState('')

  // Admin
  const [aUser, setAUser] = useState('')
  const [aPass, setAPass] = useState('')

  const post = async (url: string, body: object) => {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    return { ok: r.ok, data: await r.json() }
  }

  const handleUserLogin = async () => {
    setError(''); setLoading(true)
    const pin = uPin.replace(/\D/g,'')
    if (!uUser.trim()) { setError('Enter your username'); setLoading(false); return }
    if (pin.length !== 4) { setError('PIN must be 4 digits'); setLoading(false); return }
    const { ok, data } = await post('/api/auth/login', { username: uUser.trim(), pin })
    setLoading(false)
    if (!ok) return setError(data.error)
    router.push('/user')
  }

  const handleRegister = async () => {
    setError(''); setSuccess(''); setLoading(true)
    const pin = rPin.replace(/\D/g,''), conf = rConf.replace(/\D/g,'')
    if (!rUser.trim() || rUser.trim().length < 3) { setError('Username must be ≥3 chars'); setLoading(false); return }
    if (!/^[a-zA-Z0-9_]+$/.test(rUser.trim())) { setError('Letters, numbers & underscores only'); setLoading(false); return }
    if (pin.length !== 4) { setError('PIN must be 4 digits'); setLoading(false); return }
    if (pin !== conf) { setError('PINs do not match'); setLoading(false); return }
    const { ok, data } = await post('/api/auth/register', { username: rUser.trim(), pin })
    setLoading(false)
    if (!ok) return setError(data.error)
    setSuccess(`Account created! Your UID: ${data.uid}`)
    setRUser(''); setRPin(''); setRConf('')
  }

  const handleStallLogin = async () => {
    setError(''); setLoading(true)
    const pin = sPin.replace(/\D/g,'')
    if (!sId.trim() || !sName.trim()) { setError('Enter Stall ID and Stall Name'); setLoading(false); return }
    if (pin.length !== 4) { setError('PIN must be 4 digits'); setLoading(false); return }
    const { ok, data } = await post('/api/auth/stall-login', { stall_id: sId.trim(), stall_name: sName.trim(), pin })
    setLoading(false)
    if (!ok) return setError(data.error)
    router.push('/stall')
  }

  const handleAdminLogin = async () => {
    setError(''); setLoading(true)
    if (!aUser.trim() || !aPass) { setError('Enter username and password'); setLoading(false); return }
    const { ok, data } = await post('/api/auth/admin-login', { username: aUser.trim(), password: aPass })
    setLoading(false)
    if (!ok) return setError(data.error)
    router.push('/admin')
  }

  const switchTab = (t: Tab) => { setTab(t); setError(''); setSuccess('') }

  return (
    <div className="page">
      <div className="container" style={{ paddingTop: '40px' }}>

        {/* Hero */}
        <div className="anim-1" style={{ textAlign: 'center', paddingBottom: '28px' }}>
          <div style={{
            width: 76, height: 76,
            background: 'linear-gradient(135deg, #4f7fff 0%, #7c5cfc 100%)',
            borderRadius: 22, display: 'inline-flex', alignItems: 'center',
            justifyContent: 'center', fontSize: '2rem', marginBottom: 14,
            boxShadow: '0 8px 40px rgba(79,127,255,0.4)',
          }}>🔐</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--text)' }}>
            Digital{' '}
            <span style={{ background: 'linear-gradient(135deg,#4f7fff,#a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              Vault
            </span>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--soft)', marginTop: 6, fontWeight: 600, letterSpacing: '0.06em' }}>
            CHOOSE YOUR ROLE TO CONTINUE
          </div>
        </div>

        {/* Tabs */}
        <div className="tabs anim-2">
          {(['user','stall','admin'] as Tab[]).map(t => (
            <button key={t} className={`tab${tab === t ? ' active' : ''}`} onClick={() => switchTab(t)}>
              {t === 'user' ? '👤 User' : t === 'stall' ? '🧑‍🍳 Stall' : '🛠️ Admin'}
            </button>
          ))}
        </div>

        {error && <Alert msg={error} type="error" />}
        {success && <Alert msg={success} type="success" />}

        {/* USER TAB */}
        {tab === 'user' && (
          <div className="anim-3">
            {!showRegister ? (
              <>
                <label className="input-label">Username</label>
                <input className="input-field" style={{ marginBottom: 12 }} value={uUser}
                  onChange={e => setUUser(e.target.value)} placeholder="Enter your username"
                  onKeyDown={e => e.key === 'Enter' && handleUserLogin()} />
                <label className="input-label">4-Digit PIN</label>
                <input className="input-field" type="password" inputMode="numeric"
                  maxLength={4} value={uPin} onChange={e => setUPin(e.target.value.replace(/\D/g,''))}
                  placeholder="••••" onKeyDown={e => e.key === 'Enter' && handleUserLogin()} />
                <PinDots count={Math.min(uPin.replace(/\D/g,'').length, 4)} />
                <p className="hint" style={{ marginBottom: 14 }}>Enter your 4-digit numeric PIN</p>
                <button className="btn btn-primary" onClick={handleUserLogin} disabled={loading}>
                  {loading ? <span className="spinner" /> : 'Sign In →'}
                </button>
                <hr className="divider" />
                <button className="btn btn-ghost" onClick={() => { setShowRegister(true); setError(''); setSuccess('') }}>
                  📝 Create Account
                </button>
              </>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <button className="btn btn-ghost" style={{ width: 'auto', padding: '0 14px', height: 38, fontSize: '0.85rem' }}
                    onClick={() => { setShowRegister(false); setError(''); setSuccess('') }}>← Back</button>
                  <span style={{ fontWeight: 700, color: 'var(--text)' }}>Create Account</span>
                </div>
                <label className="input-label">Username</label>
                <input className="input-field" style={{ marginBottom: 12 }} value={rUser}
                  onChange={e => setRUser(e.target.value)} placeholder="Choose a username" />
                <label className="input-label">Create PIN</label>
                <input className="input-field" type="password" inputMode="numeric"
                  maxLength={4} value={rPin} onChange={e => setRPin(e.target.value.replace(/\D/g,''))} placeholder="••••" />
                <PinDots count={Math.min(rPin.length, 4)} />
                <label className="input-label">Confirm PIN</label>
                <input className="input-field" type="password" inputMode="numeric"
                  maxLength={4} value={rConf} onChange={e => setRConf(e.target.value.replace(/\D/g,''))} placeholder="••••" />
                <PinDots count={Math.min(rConf.length, 4)} />
                <button className="btn btn-primary" style={{ marginTop: 8 }} onClick={handleRegister} disabled={loading}>
                  {loading ? <span className="spinner" /> : 'Create Account →'}
                </button>
              </>
            )}
          </div>
        )}

        {/* STALL TAB */}
        {tab === 'stall' && (
          <div className="anim-3">
            <label className="input-label">Stall ID</label>
            <input className="input-field" style={{ marginBottom: 12 }} value={sId}
              onChange={e => setSId(e.target.value)} placeholder="e.g. S101" />
            <label className="input-label">Stall Name</label>
            <input className="input-field" style={{ marginBottom: 12 }} value={sName}
              onChange={e => setSName(e.target.value)} placeholder="e.g. Tasty Bites" />
            <label className="input-label">Stall PIN</label>
            <input className="input-field" type="password" inputMode="numeric"
              maxLength={4} value={sPin} onChange={e => setSPin(e.target.value.replace(/\D/g,''))} placeholder="••••" />
            <PinDots count={Math.min(sPin.length, 4)} />
            <p className="hint" style={{ marginBottom: 14 }}>All three fields must match your stall record</p>
            <button className="btn btn-primary" onClick={handleStallLogin} disabled={loading}>
              {loading ? <span className="spinner" /> : 'Sign In as Stall Owner →'}
            </button>
          </div>
        )}

        {/* ADMIN TAB */}
        {tab === 'admin' && (
          <div className="anim-3">
            <label className="input-label">Admin Username</label>
            <input className="input-field" style={{ marginBottom: 12 }} value={aUser}
              onChange={e => setAUser(e.target.value)} placeholder="Enter admin username"
              onKeyDown={e => e.key === 'Enter' && handleAdminLogin()} />
            <label className="input-label">Password</label>
            <input className="input-field" type="password" value={aPass}
              onChange={e => setAPass(e.target.value)} placeholder="Enter password"
              onKeyDown={e => e.key === 'Enter' && handleAdminLogin()} />
            <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={handleAdminLogin} disabled={loading}>
              {loading ? <span className="spinner" /> : 'Sign In as Admin →'}
            </button>
          </div>
        )}

      </div>
    </div>
  )
}
