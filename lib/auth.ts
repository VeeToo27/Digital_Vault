import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? 'change-this-secret-in-env'
)
const COOKIE = 'vault_session'
const TTL = 60 * 60 * 12 // 12 hours

export type SessionPayload =
  | { role: 'user';        username: string; uid: string }
  | { role: 'stall_owner'; stall_id: string; stall_name: string }
  | { role: 'admin';       username: string }

export async function createSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime(`${TTL}s`)
    .setIssuedAt()
    .sign(SECRET)
}

export async function getSession(req?: NextRequest): Promise<SessionPayload | null> {
  try {
    let token: string | undefined
    if (req) {
      token = req.cookies.get(COOKIE)?.value
    } else {
      token = (await cookies()).get(COOKIE)?.value
    }
    if (!token) return null
    const { payload } = await jwtVerify(token, SECRET)
    return payload as unknown as SessionPayload
  } catch {
    return null
  }
}

export function sessionCookieOptions(token: string) {
  return {
    name: COOKIE,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: TTL,
    path: '/',
  }
}

export function clearSessionCookie() {
  return { name: COOKIE, value: '', maxAge: 0, path: '/' }
}
