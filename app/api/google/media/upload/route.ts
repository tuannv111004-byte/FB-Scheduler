import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

const accessCookieName = 'postops_access'

function unauthorized() {
  return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
}

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

function getCookieValue(request: Request, name: string) {
  const cookieHeader = request.headers.get('cookie')
  if (!cookieHeader) return null

  const cookies = cookieHeader.split(';').map((cookie) => cookie.trim())
  const match = cookies.find((cookie) => cookie.startsWith(`${name}=`))
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null
}

async function hasValidAppSession(request: Request) {
  const configuredPassword = process.env.APP_ACCESS_PASSWORD
  if (!configuredPassword) return process.env.NODE_ENV === 'development'

  const expectedCookieValue = await accessCookieValue(configuredPassword)
  return getCookieValue(request, accessCookieName) === expectedCookieValue
}

function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is not configured.`)
  return value
}

function getOptionalEnv(name: string) {
  const value = process.env[name]
  return value?.trim() || undefined
}

async function readUploadBody(request: Request) {
  const contentType = request.headers.get('content-type') || ''

  if (contentType.includes('application/json')) {
    const body = await request.json().catch(() => null) as {
      fileName?: unknown
      mimeType?: unknown
      base64?: unknown
    } | null

    if (
      !body ||
      typeof body.fileName !== 'string' ||
      typeof body.mimeType !== 'string' ||
      typeof body.base64 !== 'string'
    ) {
      throw new Error('Video upload payload is invalid.')
    }

    return {
      fileName: body.fileName,
      mimeType: body.mimeType || 'application/octet-stream',
      base64: body.base64,
    }
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    throw new Error('Video upload request used the old FormData format. Refresh the app or restart the dev server, then try again.')
  }
  const file = formData.get('file')
  if (!(file instanceof File)) {
    throw new Error('Video file is required.')
  }

  const bytes = Buffer.from(await file.arrayBuffer())
  return {
    fileName: file.name,
    mimeType: file.type || 'application/octet-stream',
    base64: bytes.toString('base64'),
  }
}

export async function POST(request: Request) {
  if (!(await hasValidAppSession(request))) return unauthorized()

  try {
    const uploadBody = await readUploadBody(request)

    const scriptUrl = getOptionalEnv('GOOGLE_APPS_SCRIPT_URL') || getOptionalEnv('GOOGLE_APPS_SCRIPT_WEBAPP_URL')
    if (!scriptUrl) throw new Error('GOOGLE_APPS_SCRIPT_URL or GOOGLE_APPS_SCRIPT_WEBAPP_URL is not configured.')

    const scriptToken = getOptionalEnv('GOOGLE_APPS_SCRIPT_TOKEN') || getOptionalEnv('GOOGLE_BACKUP_TOKEN')
    if (!scriptToken) throw new Error('GOOGLE_APPS_SCRIPT_TOKEN or GOOGLE_BACKUP_TOKEN is not configured.')

    const response = await fetch(scriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'upload-media',
        token: scriptToken,
        sheetId: getRequiredEnv('GOOGLE_SHEET_ID'),
        folderId: getRequiredEnv('GOOGLE_DRIVE_FOLDER_ID'),
        makePublic: process.env.GOOGLE_DRIVE_MAKE_PUBLIC !== 'false',
        fileName: uploadBody.fileName,
        mimeType: uploadBody.mimeType,
        base64: uploadBody.base64,
      }),
    })

    const result = await response.json().catch(() => null) as {
      ok?: boolean
      error?: string
      media?: {
        drive_file_id?: string
        web_view_link?: string
        direct_url?: string
        image_path?: string
        image_url?: string
      }
    } | null

    if (!response.ok || !result?.ok || !result.media) {
      throw new Error(result?.error || 'Google Drive upload failed.')
    }

    return NextResponse.json({ ok: true, media: result.media })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error
          ? error.message
          : 'Google Drive upload failed. If the video is large, try a smaller compressed MP4.',
      },
      { status: 500 }
    )
  }
}
