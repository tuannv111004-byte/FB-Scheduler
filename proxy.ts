import { NextRequest, NextResponse } from 'next/server'

const accessCookieName = 'postops_access'
const publicPaths = new Set([
  '/api/auth/login',
  '/api/auth/logout',
  '/api/extension/daily-results',
])

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

function isPublicAsset(pathname: string) {
  return (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/tinymce/') ||
    pathname === '/favicon.ico' ||
    pathname === '/icon.svg' ||
    pathname === '/apple-icon.png' ||
    pathname.endsWith('.png') ||
    pathname.endsWith('.jpg') ||
    pathname.endsWith('.jpeg') ||
    pathname.endsWith('.svg') ||
    pathname.endsWith('.webp')
  )
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl

  if (publicPaths.has(pathname) || isPublicAsset(pathname)) {
    return NextResponse.next()
  }

  const configuredPassword = process.env.APP_ACCESS_PASSWORD
  if (!configuredPassword) {
    if (process.env.NODE_ENV === 'development') {
      return NextResponse.next()
    }

    return new NextResponse('APP_ACCESS_PASSWORD is not configured.', { status: 503 })
  }

  const expectedCookieValue = await accessCookieValue(configuredPassword)
  const actualCookieValue = request.cookies.get(accessCookieName)?.value
  const isAuthenticated = actualCookieValue === expectedCookieValue

  if (pathname === '/login') {
    if (isAuthenticated) {
      return NextResponse.redirect(new URL('/', request.url))
    }
    return NextResponse.next()
  }

  if (isAuthenticated) {
    return NextResponse.next()
  }

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  const loginUrl = new URL('/login', request.url)
  loginUrl.searchParams.set('next', `${pathname}${search}`)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
