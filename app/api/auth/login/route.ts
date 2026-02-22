import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { supabaseAdmin } from '@/lib/supabase'
import { createSession, sessionCookieOptions } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const { username, pin } = await req.json()
  if (!username || !pin) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  const { data: user, error } = await supabaseAdmin
    .from('users')
    .select('uid, username, pin_hash, balance, blocked')
    .ilike('username', username.trim())
    .single()

  if (error || !user) return NextResponse.json({ error: 'No account found' }, { status: 401 })
  if (user.blocked)   return NextResponse.json({ error: 'Account blocked — contact admin' }, { status: 403 })

  const valid = await bcrypt.compare(pin, user.pin_hash)
  if (!valid) return NextResponse.json({ error: 'Incorrect PIN' }, { status: 401 })

  const token = await createSession({ role: 'user', username: user.username, uid: user.uid })
  const res = NextResponse.json({ ok: true, username: user.username, uid: user.uid, balance: user.balance })
  res.cookies.set(sessionCookieOptions(token))
  return res
}
