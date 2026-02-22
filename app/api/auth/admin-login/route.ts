import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createSession, sessionCookieOptions } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const { username, password } = await req.json()
  if (!username || !password)
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  const { data: admin, error } = await supabaseAdmin
    .from('admins')
    .select('username, password')
    .eq('username', username.trim())
    .single()

  if (error || !admin || admin.password !== password.trim())
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })

  const token = await createSession({ role: 'admin', username: admin.username })
  const res = NextResponse.json({ ok: true })
  res.cookies.set(sessionCookieOptions(token))
  return res
}
