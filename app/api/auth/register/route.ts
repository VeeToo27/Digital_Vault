import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const { username, pin } = await req.json()
  if (!username || !pin) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  if (!/^\d{4}$/.test(pin)) return NextResponse.json({ error: 'PIN must be 4 digits' }, { status: 400 })
  if (!/^[a-zA-Z0-9_]{3,}$/.test(username))
    return NextResponse.json({ error: 'Invalid username' }, { status: 400 })

  // Generate UID
  const { count } = await supabaseAdmin.from('users').select('*', { count: 'exact', head: true })
  const uid = `UID_${String((count ?? 0) + 1).padStart(4, '0')}`

  const pin_hash = await bcrypt.hash(pin, 10)

  const { error } = await supabaseAdmin.from('users').insert({ uid, username, pin_hash, balance: 0 })
  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'Username already taken' }, { status: 409 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, uid })
}
