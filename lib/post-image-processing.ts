"use client"

export const TARGET_IMAGE_WIDTH = 1080
export const TARGET_IMAGE_HEIGHT = 1350
export const TARGET_IMAGE_RATIO = TARGET_IMAGE_WIDTH / TARGET_IMAGE_HEIGHT

export type ImageFitMode = 'fill' | 'fit'

export type SelectedImageMeta = {
  width: number
  height: number
  ratio: number
  needsAttention: boolean
}

export type ImageSource = Blob | string

export type ImageFocus = {
  x: number
  y: number
}

export function clampFocusValue(value: number) {
  return Math.min(1, Math.max(0, value))
}

export async function readImageDimensions(source: ImageSource) {
  return new Promise<SelectedImageMeta>((resolve, reject) => {
    const objectUrl = typeof source === 'string' ? source : URL.createObjectURL(source)
    const image = new Image()

    image.onload = () => {
      const ratio = image.width / image.height
      const ratioDiff = Math.abs(ratio - TARGET_IMAGE_RATIO)
      if (typeof source !== 'string') {
        URL.revokeObjectURL(objectUrl)
      }
      resolve({
        width: image.width,
        height: image.height,
        ratio,
        needsAttention:
          image.width !== TARGET_IMAGE_WIDTH ||
          image.height !== TARGET_IMAGE_HEIGHT ||
          ratioDiff > 0.02,
      })
    }

    image.onerror = () => {
      if (typeof source !== 'string') {
        URL.revokeObjectURL(objectUrl)
      }
      reject(new Error('Could not read image dimensions.'))
    }

    image.crossOrigin = 'anonymous'
    image.src = objectUrl
  })
}

export async function normalizeImageFile(
  source: ImageSource,
  fitMode: ImageFitMode,
  imageFocus: ImageFocus,
  fileName = 'post-image'
) {
  return new Promise<File>((resolve, reject) => {
    const objectUrl = typeof source === 'string' ? source : URL.createObjectURL(source)
    const image = new Image()

    image.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = TARGET_IMAGE_WIDTH
        canvas.height = TARGET_IMAGE_HEIGHT

        const context = canvas.getContext('2d')
        if (!context) {
          throw new Error('Canvas is not available in this browser.')
        }

        context.fillStyle = '#ffffff'
        context.fillRect(0, 0, TARGET_IMAGE_WIDTH, TARGET_IMAGE_HEIGHT)

        const sourceRatio = image.width / image.height
        let drawWidth = TARGET_IMAGE_WIDTH
        let drawHeight = TARGET_IMAGE_HEIGHT
        let offsetX = 0
        let offsetY = 0

        if (fitMode === 'fill') {
          if (sourceRatio > TARGET_IMAGE_RATIO) {
            drawHeight = TARGET_IMAGE_HEIGHT
            drawWidth = drawHeight * sourceRatio
            offsetX = (TARGET_IMAGE_WIDTH - drawWidth) * imageFocus.x
          } else {
            drawWidth = TARGET_IMAGE_WIDTH
            drawHeight = drawWidth / sourceRatio
            offsetY = (TARGET_IMAGE_HEIGHT - drawHeight) * imageFocus.y
          }
        } else {
          if (sourceRatio > TARGET_IMAGE_RATIO) {
            drawWidth = TARGET_IMAGE_WIDTH
            drawHeight = drawWidth / sourceRatio
            offsetY = (TARGET_IMAGE_HEIGHT - drawHeight) * imageFocus.y
          } else {
            drawHeight = TARGET_IMAGE_HEIGHT
            drawWidth = drawHeight * sourceRatio
            offsetX = (TARGET_IMAGE_WIDTH - drawWidth) * imageFocus.x
          }
        }

        context.drawImage(image, offsetX, offsetY, drawWidth, drawHeight)

        canvas.toBlob(
          (blob) => {
            if (typeof source !== 'string') {
              URL.revokeObjectURL(objectUrl)
            }

            if (!blob) {
              reject(new Error('Failed to export normalized image.'))
              return
            }

            const normalizedFileName = fileName.replace(/\.[^.]+$/, '') || 'post-image'
            const normalizedFile = new File(
              [blob],
              `${normalizedFileName}-1080x1350.jpg`,
              { type: 'image/jpeg' }
            )

            resolve(normalizedFile)
          },
          'image/jpeg',
          0.92
        )
      } catch (error) {
        if (typeof source !== 'string') {
          URL.revokeObjectURL(objectUrl)
        }
        reject(error instanceof Error ? error : new Error('Image processing failed.'))
      }
    }

    image.onerror = () => {
      if (typeof source !== 'string') {
        URL.revokeObjectURL(objectUrl)
      }
      reject(new Error('Could not load the selected image.'))
    }

    image.crossOrigin = 'anonymous'
    image.src = objectUrl
  })
}

export async function fetchImageUrlAsBlob(imageUrl: string) {
  const response = await fetch(imageUrl)
  if (!response.ok) {
    throw new Error('Could not download image URL for 1080x1350 processing.')
  }

  const imageBlob = await response.blob()
  if (!imageBlob.type.startsWith('image/')) {
    throw new Error('Image URL did not return an image file.')
  }

  return imageBlob
}

export function imageUrlToFileName(imageUrl: string) {
  try {
    const pathname = new URL(imageUrl).pathname
    const fileName = pathname.split('/').filter(Boolean).pop()
    return fileName || 'post-image'
  } catch {
    return 'post-image'
  }
}
