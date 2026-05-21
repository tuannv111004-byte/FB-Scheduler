import { NextResponse } from 'next/server'

const accessCookieName = 'postops_access'
const accessCookieMaxAge = 60 * 60 * 24 * 30

async function sha256(value: string) {
  const data = new TextEncoder().encode(value)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

async function accessCookieValue(password: string) {
  const salt = process.env.APP_ACCESS_COOKIE_SALT || 'postops'
  return sha256(`${salt}:${password}`)
}

export async function POST(request: Request) {
  const configuredPassword = process.env.APP_ACCESS_PASSWORD
  if (!configuredPassword) {
    return NextResponse.json(
      { error: 'APP_ACCESS_PASSWORD is not configured.' },
      { status: 500 }
    )
  }

  const body = await request.json().catch(() => null)
  const password = typeof body?.password === 'string' ? body.password : ''

  if (password !== configuredPassword) {
    return NextResponse.json({ error: 'Invalid password.' }, { status: 401 })
  }

  const response = NextResponse.json({ ok: true })
  response.cookies.set(accessCookieName, await accessCookieValue(configuredPassword), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: accessCookieMaxAge,
    path: '/',
  })

  return response
}
