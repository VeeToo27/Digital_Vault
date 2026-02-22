// POST /api/seed?secret=YOUR_SEED_SECRET
// Seeds initial stall data. Run once after DB setup. Protected by secret.
import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { supabaseAdmin } from '@/lib/supabase'

const STALLS = [
  {
    stall_id: 'S101', name: 'Tasty Bites', pin: '2134',
    menu: [
      { name: 'Burger',     price: 80 },
      { name: 'Sandwich',   price: 60 },
      { name: 'French Fries', price: 40 },
      { name: 'Cold Coffee',  price: 50 },
    ],
  },
  {
    stall_id: 'S102', name: 'Spice Junction', pin: '1234',
    menu: [
      { name: 'Biryani',    price: 120 },
      { name: 'Paneer Roll', price: 90 },
      { name: 'Lassi',      price: 40 },
      { name: 'Gulab Jamun', price: 30 },
    ],
  },
  {
    stall_id: 'S103', name: 'Sweet Treats', pin: '4321',
    menu: [
      { name: 'Ice Cream',  price: 50 },
      { name: 'Brownie',    price: 60 },
      { name: 'Waffles',    price: 80 },
      { name: 'Milkshake',  price: 70 },
    ],
  },
]

export async function POST(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  if (secret !== process.env.SEED_SECRET)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const results: string[] = []

  for (const stall of STALLS) {
    const pin_hash = await bcrypt.hash(stall.pin, 10)
    const { error: se } = await supabaseAdmin
      .from('stalls')
      .upsert({ stall_id: stall.stall_id, name: stall.name, pin_hash }, { onConflict: 'stall_id' })
    if (se) { results.push(`Stall ${stall.stall_id} error: ${se.message}`); continue }

    // Delete old menu items and re-insert
    await supabaseAdmin.from('menu_items').delete().eq('stall_id', stall.stall_id)
    const { error: me } = await supabaseAdmin
      .from('menu_items')
      .insert(stall.menu.map(m => ({ stall_id: stall.stall_id, name: m.name, price: m.price })))
    if (me) results.push(`Menu ${stall.stall_id} error: ${me.message}`)
    else results.push(`✅ ${stall.name} (${stall.stall_id}) seeded`)
  }

  // Admin account
  const { error: ae } = await supabaseAdmin
    .from('admins')
    .upsert({ username: 'Admin', password: 'Hello' }, { onConflict: 'username' })
  results.push(ae ? `Admin error: ${ae.message}` : '✅ Admin seeded (username: Admin, password: Hello)')

  return NextResponse.json({ results })
}
