export interface User {
  id: number
  uid: string
  username: string
  balance: number
  blocked: boolean
  created_at: string
}

export interface Stall {
  id: number
  stall_id: string
  name: string
}

export interface MenuItem {
  id: number
  stall_id: string
  name: string
  price: number
}

export interface StallWithMenu extends Stall {
  menu_items: MenuItem[]
}

export interface OrderItem {
  name: string
  qty: number
  price: number
}

export interface Token {
  id: number
  token_no: number
  stall_id: string
  stall_name: string
  username: string
  items: OrderItem[]
  total: number
  status: 'Pending' | 'Served'
  created_at: string
}

export interface CartItem {
  price: number
  qty: number
}

export type Cart = Record<string, CartItem>
