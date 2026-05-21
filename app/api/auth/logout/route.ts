import { NextResponse } from 'next/server'

const accessCookieName = 'postops_access'

export async function POST() {
  const response = NextResponse.json({ ok: true })
  response.cookies.set(accessCookieName, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 0,
    path: '/',
  })
  return response
}
