"use client"

const videoExtensionPattern = /\.(mp4|m4v|mov|webm|ogg)(?:$|[?#])/i
const uploadingMediaPrefix = 'uploading:'
const uploadErrorMediaPrefix = 'upload-error:'

export function isVideoFile(file: File | Blob) {
  return file.type.startsWith('video/')
}

export function isVideoUrl(value?: string | null) {
  if (!value) return false
  return videoExtensionPattern.test(value) || /\/video\/upload\//i.test(value)
}

export function isGoogleDriveUrl(value?: string | null) {
  if (!value) return false

  try {
    return new URL(value).hostname.includes('drive.google.com')
  } catch {
    return false
  }
}

export function getGoogleDriveFileId(value?: string | null) {
  if (!value) return ''

  const text = String(value)
  if (text.startsWith('drive:')) return text.slice('drive:'.length)

  try {
    const url = new URL(text)
    const idParam = url.searchParams.get('id')
    if (idParam) return idParam

    const filePathMatch = url.pathname.match(/\/file\/d\/([^/]+)/)
    if (filePathMatch?.[1]) return decodeURIComponent(filePathMatch[1])

    const directPathMatch = url.pathname.match(/\/d\/([^/]+)/)
    if (directPathMatch?.[1]) return decodeURIComponent(directPathMatch[1])
  } catch {
    return ''
  }

  return ''
}

export function getGoogleDrivePreviewUrl(...values: Array<string | null | undefined>) {
  const fileId = values.map(getGoogleDriveFileId).find(Boolean)
  return fileId ? `https://drive.google.com/file/d/${encodeURIComponent(fileId)}/preview` : ''
}

export function getGoogleDriveThumbnailUrl(...values: Array<string | null | undefined>) {
  const fileId = values.map(getGoogleDriveFileId).find(Boolean)
  return fileId ? `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=w1200` : ''
}

export function isImageFile(file: File | Blob) {
  return file.type.startsWith('image/')
}

export function isUploadingMediaPath(value?: string | null) {
  return typeof value === 'string' && value.startsWith(uploadingMediaPrefix)
}

export function isMediaUploadErrorPath(value?: string | null) {
  return typeof value === 'string' && value.startsWith(uploadErrorMediaPrefix)
}

export function uploadingMediaPath(provider = 'google-drive') {
  return `${uploadingMediaPrefix}${provider}`
}

export function uploadErrorMediaPath(provider = 'google-drive') {
  return `${uploadErrorMediaPrefix}${provider}`
}
