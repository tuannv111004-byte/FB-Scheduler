import { mkdir, writeFile } from 'fs/promises'
import path from 'path'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

const accessCookieName = 'postops_access'
const exportRoot = path.join(process.cwd(), 'exports', 'videos')

type ExportVideoItem = {
  id?: unknown
  pageName?: unknown
  postDate?: unknown
  timeSlot?: unknown
  exportOrder?: unknown
  imagePath?: unknown
  imageUrl?: unknown
}

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

function sanitizePathPart(value: string) {
  return value
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/\.+$/g, '')
    .slice(0, 80) || 'untitled'
}

function sanitizeTimeSlot(value: string) {
  return value.trim().replace(/:/g, '-').replace(/[^\d-]/g, '-') || 'time'
}

function getGoogleDriveFileId(...values: Array<string | undefined>) {
  for (const value of values) {
    if (!value) continue
    if (value.startsWith('drive:')) return value.slice('drive:'.length)

    try {
      const url = new URL(value)
      const idParam = url.searchParams.get('id')
      if (idParam) return idParam

      const filePathMatch = url.pathname.match(/\/file\/d\/([^/]+)/)
      if (filePathMatch?.[1]) return decodeURIComponent(filePathMatch[1])

      const directPathMatch = url.pathname.match(/\/d\/([^/]+)/)
      if (directPathMatch?.[1]) return decodeURIComponent(directPathMatch[1])
    } catch {
      // Not a URL. Try the next value.
    }
  }

  return ''
}

function getDownloadUrl(item: { imagePath: string; imageUrl: string }) {
  const driveFileId = getGoogleDriveFileId(item.imagePath, item.imageUrl)
  if (driveFileId) {
    return `https://drive.google.com/uc?export=download&id=${encodeURIComponent(driveFileId)}`
  }

  return item.imageUrl
}

function getExtensionFromContentType(contentType: string) {
  if (contentType.includes('video/mp4')) return '.mp4'
  if (contentType.includes('video/quicktime')) return '.mov'
  if (contentType.includes('video/webm')) return '.webm'
  if (contentType.includes('video/ogg')) return '.ogg'
  return ''
}

function getExtensionFromUrl(value: string) {
  try {
    const pathname = new URL(value).pathname
    const extension = path.extname(pathname).toLowerCase()
    return ['.mp4', '.m4v', '.mov', '.webm', '.ogg'].includes(extension) ? extension : ''
  } catch {
    return ''
  }
}

function readString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function readPositiveInteger(value: unknown) {
  const numberValue = typeof value === 'number' ? value : Number(value)
  return Number.isInteger(numberValue) && numberValue > 0 ? numberValue : null
}

export async function POST(request: Request) {
  if (!(await hasValidAppSession(request))) return unauthorized()

  try {
    const body = (await request.json().catch(() => null)) as { items?: ExportVideoItem[] } | null
    const rawItems = Array.isArray(body?.items) ? body.items : []
    if (rawItems.length === 0) {
      return NextResponse.json({ ok: false, error: 'No videos were selected for export.' }, { status: 400 })
    }

    const items = rawItems.slice(0, 200).map((item) => ({
      id: readString(item.id),
      pageName: readString(item.pageName) || 'Unknown page',
      postDate: readString(item.postDate),
      timeSlot: readString(item.timeSlot),
      exportOrder: readPositiveInteger(item.exportOrder),
      imagePath: readString(item.imagePath),
      imageUrl: readString(item.imageUrl),
    }))

    const exported: Array<{ id: string; filePath: string }> = []
    const failed: Array<{ id: string; error: string }> = []

    for (const item of items) {
      if (!item.postDate || !item.timeSlot || (!item.imagePath && !item.imageUrl)) {
        failed.push({ id: item.id, error: 'Missing date, time, or video URL.' })
        continue
      }

      try {
        const downloadUrl = getDownloadUrl(item)
        if (!downloadUrl) throw new Error('Missing download URL.')

        const response = await fetch(downloadUrl)
        if (!response.ok) throw new Error(`Download failed (${response.status}).`)

        const contentType = response.headers.get('content-type') || ''
        if (contentType.includes('text/html')) {
          throw new Error('The video link returned an HTML page instead of a downloadable video file.')
        }

        const bytes = Buffer.from(await response.arrayBuffer())
        const extension = getExtensionFromUrl(item.imageUrl) || getExtensionFromContentType(contentType) || '.mp4'
        const folder = path.join(exportRoot, sanitizePathPart(item.pageName), sanitizePathPart(item.postDate))
        const fileName = item.exportOrder
          ? `${item.exportOrder}${extension}`
          : `${sanitizeTimeSlot(item.timeSlot)}_${sanitizePathPart(item.postDate)}${extension}`
        const filePath = path.join(folder, fileName)

        await mkdir(folder, { recursive: true })
        await writeFile(filePath, bytes)

        exported.push({
          id: item.id,
          filePath: path.relative(process.cwd(), filePath),
        })
      } catch (error) {
        failed.push({
          id: item.id,
          error: error instanceof Error ? error.message : 'Could not export this video.',
        })
      }
    }

    return NextResponse.json({
      ok: true,
      exportRoot: path.relative(process.cwd(), exportRoot),
      exported,
      failed,
    })
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Could not export videos.' },
      { status: 500 }
    )
  }
}
