import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSession } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const session = await getSession(req)
  if (!session || session.role !== 'user')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { stall_id, stall_name, items, total, pin } = await req.json()
  if (!stall_id || !items || !total || !pin)
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  // Verify PIN before touching the DB transaction
  const bcrypt = await import('bcryptjs')
  const { data: user } = await supabaseAdmin
    .from('users')
    .select('pin_hash, blocked')
    .eq('username', session.username)
    .single()

  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })
  if (user.blocked) return NextResponse.json({ error: 'Account blocked' }, { status: 403 })
  const pinOk = await bcrypt.compare(pin, user.pin_hash)
  if (!pinOk) return NextResponse.json({ error: 'Wrong PIN' }, { status: 401 })

  // Call atomic DB function
  const { data, error } = await supabaseAdmin.rpc('place_order', {
    p_username:   session.username,
    p_stall_id:   stall_id,
    p_stall_name: stall_name,
    p_items:      items,
    p_total:      total,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data.success) return NextResponse.json({ error: data.error, balance: data.balance }, { status: 400 })

  return NextResponse.json({ token_no: data.token_no, new_balance: data.new_balance })
}

export async function GET(req: NextRequest) {
  const session = await getSession(req)
  if (!session || session.role !== 'user')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabaseAdmin
    .from('tokens')
    .select('*')
    .eq('username', session.username)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
