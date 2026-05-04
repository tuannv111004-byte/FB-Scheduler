import path from 'path'
import JSZip from 'jszip'

export const runtime = 'nodejs'
export const maxDuration = 60

const imageExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif'])

type ExtractedArchiveImage = {
  filename: string
  contentType: string
  base64: string
}

function getImageContentType(filename: string) {
  const extension = path.extname(filename).toLowerCase()

  if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg'
  if (extension === '.png') return 'image/png'
  if (extension === '.webp') return 'image/webp'
  if (extension === '.gif') return 'image/gif'
  return 'application/octet-stream'
}

function isImageFile(filename: string) {
  return imageExtensions.has(path.extname(filename).toLowerCase())
}

function sortImagesByFilename(images: ExtractedArchiveImage[]) {
  return images.sort((first, second) =>
    first.filename.localeCompare(second.filename, undefined, {
      numeric: true,
      sensitivity: 'base',
    })
  )
}

async function extractZip(file: File) {
  const zip = await JSZip.loadAsync(await file.arrayBuffer())
  const images: ExtractedArchiveImage[] = []

  for (const entry of Object.values(zip.files)) {
    if (entry.dir || !isImageFile(entry.name)) continue

    const bytes = await entry.async('uint8array')
    images.push({
      filename: entry.name,
      contentType: getImageContentType(entry.name),
      base64: Buffer.from(bytes).toString('base64'),
    })
  }

  return sortImagesByFilename(images)
}

async function extractRar(file: File) {
  const unrarModule = await import('unrar-js/lib/Unrar')
  const unrar = (unrarModule as unknown as { default?: unknown }).default ?? unrarModule
  const extractedFiles = (unrar as (data: Buffer) => unknown[])(Buffer.from(await file.arrayBuffer()))

  const images: ExtractedArchiveImage[] = []
  for (const extractedFile of extractedFiles) {
    const item = extractedFile as {
      filename?: string
      fileData?: Uint8Array | number[]
    }
    if (!item.filename || !item.fileData || !isImageFile(item.filename)) continue

    images.push({
      filename: item.filename,
      contentType: getImageContentType(item.filename),
      base64: Buffer.from(item.fileData).toString('base64'),
    })
  }

  return sortImagesByFilename(images)
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const archive = formData.get('archive')

    if (!(archive instanceof File)) {
      return Response.json({ error: 'Archive file is required.' }, { status: 400 })
    }

    const extension = path.extname(archive.name).toLowerCase()
    if (extension !== '.zip' && extension !== '.rar') {
      return Response.json({ error: 'Only .zip and .rar archives are supported.' }, { status: 400 })
    }

    const images = extension === '.zip' ? await extractZip(archive) : await extractRar(archive)
    if (images.length === 0) {
      return Response.json({ error: 'No supported image files were found in the archive.' }, { status: 400 })
    }

    return Response.json({ images })
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to extract archive images.',
      },
      { status: 500 }
    )
  }
}
