"use client"

import JSZip from 'jszip'
import type { Post } from '@/lib/types'

const imageExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif'])

export type ExtractedArchiveImage = {
  filename: string
  contentType: string
  base64: string
}

export type BulkScheduleAssignment = {
  image: ExtractedArchiveImage
  postDate: string
  timeSlot: string
}

function getArchiveImageExtension(filename: string) {
  const normalizedName = filename.toLowerCase()
  const dotIndex = normalizedName.lastIndexOf('.')
  return dotIndex >= 0 ? normalizedName.slice(dotIndex) : ''
}

function getArchiveImageContentType(filename: string) {
  const extension = getArchiveImageExtension(filename)

  if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg'
  if (extension === '.png') return 'image/png'
  if (extension === '.webp') return 'image/webp'
  if (extension === '.gif') return 'image/gif'
  return 'application/octet-stream'
}

function isArchiveImageFile(filename: string) {
  return imageExtensions.has(getArchiveImageExtension(filename))
}

function sortArchiveImagesByFilename(images: ExtractedArchiveImage[]) {
  return images.sort((first, second) =>
    first.filename.localeCompare(second.filename, undefined, {
      numeric: true,
      sensitivity: 'base',
    })
  )
}

function uint8ArrayToBase64(bytes: Uint8Array) {
  let binary = ''
  const chunkSize = 0x8000

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize)
    binary += String.fromCharCode(...chunk)
  }

  return window.btoa(binary)
}

export function parseScheduleTimeSlotMinutes(timeSlot: string) {
  const match = timeSlot.match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return null

  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null

  return hours * 60 + minutes
}

export function addScheduleDay(dateValue: string) {
  const date = new Date(`${dateValue}T00:00:00`)
  date.setDate(date.getDate() + 1)

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function base64ImageToFile(image: ExtractedArchiveImage) {
  const binary = window.atob(image.base64)
  const bytes = new Uint8Array(binary.length)

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  const fileName = image.filename.split(/[\\/]/).filter(Boolean).pop() || 'archive-image'
  return new File([bytes], fileName, { type: image.contentType })
}

export async function extractZipArchiveImages(file: File) {
  const zip = await JSZip.loadAsync(await file.arrayBuffer())
  const images: ExtractedArchiveImage[] = []

  for (const entry of Object.values(zip.files)) {
    if (entry.dir || !isArchiveImageFile(entry.name)) continue

    const bytes = await entry.async('uint8array')
    images.push({
      filename: entry.name,
      contentType: getArchiveImageContentType(entry.name),
      base64: uint8ArrayToBase64(bytes),
    })
  }

  const sortedImages = sortArchiveImagesByFilename(images)
  if (sortedImages.length === 0) {
    throw new Error('No supported image files were found in the archive.')
  }

  return sortedImages
}

export function buildBulkScheduleAssignments(
  images: ExtractedArchiveImage[],
  posts: Post[],
  pageId: string,
  startDate: string,
  timeSlots: string[],
  startTimeSlot?: string
) {
  const sortedSlots = [...timeSlots].sort((first, second) => {
    const firstMinutes = parseScheduleTimeSlotMinutes(first)
    const secondMinutes = parseScheduleTimeSlotMinutes(second)

    if (firstMinutes !== null && secondMinutes !== null && firstMinutes !== secondMinutes) {
      return firstMinutes - secondMinutes
    }

    return first.localeCompare(second)
  })

  if (sortedSlots.length === 0) {
    throw new Error('Selected page has no time slots configured.')
  }

  const startSlotIndex = startTimeSlot ? sortedSlots.indexOf(startTimeSlot) : -1
  let slotIndex = startSlotIndex >= 0 ? startSlotIndex : 0
  const occupiedSlots = new Set(
    posts
      .filter((post) => post.pageId === pageId && post.status !== 'skipped')
      .map((post) => `${post.postDate}__${post.timeSlot}`)
  )
  const assignments: BulkScheduleAssignment[] = []
  let targetDate = startDate

  for (const image of images) {
    for (;;) {
      const timeSlot = sortedSlots[slotIndex]
      const slotKey = `${targetDate}__${timeSlot}`

      slotIndex += 1
      if (slotIndex >= sortedSlots.length) {
        slotIndex = 0
        targetDate = addScheduleDay(targetDate)
      }

      if (occupiedSlots.has(slotKey)) continue

      occupiedSlots.add(slotKey)
      assignments.push({
        image,
        postDate: slotKey.split('__')[0],
        timeSlot,
      })
      break
    }
  }

  return assignments
}
