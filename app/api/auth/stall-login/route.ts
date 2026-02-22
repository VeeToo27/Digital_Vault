import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { supabaseAdmin } from '@/lib/supabase'
import { createSession, sessionCookieOptions } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const { stall_id, stall_name, pin } = await req.json()
  if (!stall_id || !stall_name || !pin)
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  const { data: stall, error } = await supabaseAdmin
    .from('stalls')
    .select('stall_id, name, pin_hash')
    .ilike('stall_id', stall_id.trim())
    .ilike('name', stall_name.trim())
    .single()

  if (error || !stall) return NextResponse.json({ error: 'No stall found — check ID, Name, and PIN' }, { status: 401 })

  const valid = await bcrypt.compare(pin, stall.pin_hash)
  if (!valid) return NextResponse.json({ error: 'Incorrect PIN' }, { status: 401 })

  const token = await createSession({ role: 'stall_owner', stall_id: stall.stall_id, stall_name: stall.name })
  const res = NextResponse.json({ ok: true, stall_id: stall.stall_id, stall_name: stall.name })
  res.cookies.set(sessionCookieOptions(token))
  return res
}
