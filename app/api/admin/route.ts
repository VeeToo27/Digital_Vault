import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { supabaseAdmin } from '@/lib/supabase'
import { getSession } from '@/lib/auth'

async function requireAdmin(req: NextRequest) {
  const s = await getSession(req)
  if (!s || s.role !== 'admin') return null
  return s
}

// GET /api/admin?resource=users|tokens|stalls|dashboard
export async function GET(req: NextRequest) {
  if (!await requireAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const resource = req.nextUrl.searchParams.get('resource')

  if (resource === 'users') {
    const { data, error } = await supabaseAdmin
      .from('users').select('id,uid,username,balance,blocked,created_at').order('uid')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  if (resource === 'tokens') {
    const { data, error } = await supabaseAdmin
      .from('tokens').select('*').order('created_at', { ascending: false })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  if (resource === 'stalls') {
    const { data, error } = await supabaseAdmin
      .from('stalls').select('stall_id,name,menu_items(id,name,price)').order('stall_id')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  if (resource === 'dashboard') {
    const [users, tokens] = await Promise.all([
      supabaseAdmin.from('users').select('balance,blocked'),
      supabaseAdmin.from('tokens').select('total,status,stall_id,stall_name'),
    ])
    const totalUsers    = users.data?.length ?? 0
    const totalBalance  = users.data?.reduce((s,u) => s + Number(u.balance), 0) ?? 0
    const totalRevenue  = tokens.data?.reduce((s,t) => s + Number(t.total), 0) ?? 0
    const pending       = tokens.data?.filter(t => t.status === 'Pending').length ?? 0
    const served        = tokens.data?.filter(t => t.status === 'Served').length ?? 0
    // Per-stall
    const stallMap: Record<string, { name:string; revenue:number; orders:number; pending:number }> = {}
    for (const t of tokens.data ?? []) {
      if (!stallMap[t.stall_id]) stallMap[t.stall_id] = { name: t.stall_name, revenue: 0, orders: 0, pending: 0 }
      stallMap[t.stall_id].revenue += Number(t.total)
      stallMap[t.stall_id].orders++
      if (t.status === 'Pending') stallMap[t.stall_id].pending++
    }
    return NextResponse.json({ totalUsers, totalBalance, totalRevenue, pending, served, totalOrders: (tokens.data?.length ?? 0), stalls: stallMap })
  }

  return NextResponse.json({ error: 'Unknown resource' }, { status: 400 })
}

// POST /api/admin — actions: topup, set_balance, block, unblock, zero
export async function POST(req: NextRequest) {
  if (!await requireAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { action, username, amount, new_pin } = body

  if (action === 'topup') {
    const { data: u } = await supabaseAdmin.from('users').select('balance').eq('username', username).single()
    if (!u) return NextResponse.json({ error: 'User not found' }, { status: 404 })
    const { error } = await supabaseAdmin.from('users').update({ balance: Number(u.balance) + Number(amount) }).eq('username', username)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, new_balance: Number(u.balance) + Number(amount) })
  }

  if (action === 'set_balance') {
    const { error } = await supabaseAdmin.from('users').update({ balance: Number(amount) }).eq('username', username)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (action === 'zero') {
    const { error } = await supabaseAdmin.from('users').update({ balance: 0 }).eq('username', username)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (action === 'block') {
    const { error } = await supabaseAdmin.from('users').update({ blocked: true }).eq('username', username)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (action === 'unblock') {
    if (!new_pin || !/^\d{4}$/.test(new_pin))
      return NextResponse.json({ error: 'Invalid PIN' }, { status: 400 })
    const pin_hash = await bcrypt.hash(new_pin, 10)
    const { error } = await supabaseAdmin.from('users')
      .update({ blocked: false, pin_hash }).eq('username', username)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
