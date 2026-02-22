import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSession } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const session = await getSession(req)
  if (!session || session.role !== 'stall_owner')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabaseAdmin
    .from('tokens')
    .select('*')
    .eq('stall_id', session.stall_id)
    .order('token_no', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest) {
  const session = await getSession(req)
  if (!session || session.role !== 'stall_owner')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { token_id, status } = await req.json()
  if (!token_id || !['Pending','Served'].includes(status))
    return NextResponse.json({ error: 'Invalid' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('tokens')
    .update({ status })
    .eq('id', token_id)
    .eq('stall_id', session.stall_id)
    .select('id, status')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
