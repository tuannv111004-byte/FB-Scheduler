"use client"

import { useRef, useState } from 'react'
import { Editor } from '@tinymce/tinymce-react'
import type { Editor as TinyMceEditor } from 'tinymce'
import 'tinymce/tinymce'
import 'tinymce/icons/default'
import 'tinymce/models/dom'
import 'tinymce/themes/silver'
import 'tinymce/plugins/autolink'
import 'tinymce/plugins/code'
import 'tinymce/plugins/image'
import 'tinymce/plugins/link'
import 'tinymce/plugins/lists'
import 'tinymce/plugins/table'
import { uploadPostImage } from '@/lib/supabase'

type TinyMceHtmlEditorProps = {
  value: string
  onChange: (value: string) => void
  splitPastedCollage?: boolean
  collageSourceUrl?: string
}

export function TinyMceHtmlEditor({
  value,
  onChange,
  splitPastedCollage = false,
  collageSourceUrl = '',
}: TinyMceHtmlEditorProps) {
  const [isReady, setIsReady] = useState(false)
  const editorRef = useRef<TinyMceEditor | null>(null)

  return (
    <div className="min-h-[560px]">
      {!isReady ? (
        <textarea
          className="min-h-[560px] w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          placeholder="Paste or edit article HTML here..."
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : null}
      <div className={isReady ? 'block' : 'hidden'}>
        <Editor
          licenseKey="gpl"
          value={value}
          onInit={(_, editor) => {
            editorRef.current = editor
            setIsReady(true)
          }}
          onEditorChange={onChange}
          init={{
            height: 560,
            menubar: false,
            branding: false,
            promotion: false,
            skin_url: '/tinymce/skins/ui/oxide',
            content_css: '/tinymce/skins/content/default/content.min.css',
            plugins: 'autolink code image link lists table',
            toolbar:
              'undo redo | blocks | bold italic underline | link image collageimages | bullist numlist | table | code',
            block_formats: 'Paragraph=p; Heading 2=h2; Heading 3=h3',
            automatic_uploads: true,
            paste_data_images: true,
            images_upload_handler: async (blobInfo) => {
              const blob = blobInfo.blob()
              const fileName = blobInfo.filename() || 'composer-image.png'
              const file = new File([blob], fileName, { type: blob.type || 'image/png' })

              if (splitPastedCollage) {
                const crops = await splitFourByFiveCollage(file)
                if (crops.length > 1) {
                  const uploadedImages = await Promise.all(crops.map((crop) => uploadPostImage(crop)))
                  const imageUrls = uploadedImages.map((image) => image.imageUrl)

                  window.setTimeout(() => {
                    const editor = editorRef.current
                    if (!editor) return

                    const remainingUrls = shuffle(imageUrls.slice(1))
                    for (const imageUrl of remainingUrls) {
                      insertImageAtRandomParagraph(editor, imageUrl)
                    }
                    onChange(editor.getContent())
                  }, 0)

                  return imageUrls[0]
                }
              }

              const uploadedImage = await uploadPostImage(file)
              return uploadedImage.imageUrl
            },
            convert_urls: false,
            extended_valid_elements: 'img[src|alt|style|width|height|loading]',
            content_style:
              'body{font-family:Arial,sans-serif;font-size:14px;line-height:1.55;color:#111827;padding:12px;} img{max-width:100%;height:auto;} p{margin:0 0 12px;} h2,h3{margin:18px 0 10px;}',
            setup: (editor) => {
              editor.ui.registry.addButton('collageimages', {
                text: '4:5 Images',
                tooltip: 'Crop the current thumbnail into three article images',
                onAction: async () => {
                  if (!splitPastedCollage) {
                    editor.notificationManager.open({
                      type: 'warning',
                      text: 'Turn on Split pasted 4:5 first.',
                    })
                    return
                  }

                  if (!collageSourceUrl.trim()) {
                    editor.notificationManager.open({
                      type: 'warning',
                      text: 'Add a thumbnail image URL first.',
                    })
                    return
                  }

                  try {
                    editor.setProgressState(true)
                    const file = await imageUrlToFile(collageSourceUrl.trim())
                    const crops = await splitFourByFiveCollage(file)

                    if (crops.length <= 1) {
                      editor.notificationManager.open({
                        type: 'warning',
                        text: 'The source image is not a 4:5 collage.',
                      })
                      return
                    }

                    const uploadedImages = await Promise.all(crops.map((crop) => uploadPostImage(crop)))
                    const imageUrls = uploadedImages.map((image) => image.imageUrl)
                    editor.insertContent(`<p><img src="${escapeHtmlAttribute(imageUrls[0])}" loading="lazy" /></p>`)

                    for (const imageUrl of shuffle(imageUrls.slice(1))) {
                      insertImageAtRandomParagraph(editor, imageUrl)
                    }

                    onChange(editor.getContent())
                  } catch (error) {
                    editor.notificationManager.open({
                      type: 'error',
                      text: error instanceof Error ? error.message : 'Could not insert 4:5 images.',
                    })
                  } finally {
                    editor.setProgressState(false)
                  }
                },
              })
            },
          }}
        />
      </div>
    </div>
  )
}

async function imageUrlToFile(imageUrl: string) {
  const response = await fetch(imageUrl)
  if (!response.ok) {
    throw new Error(`Could not load thumbnail image (${response.status}).`)
  }

  const blob = await response.blob()
  const extension = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg'
  return new File([blob], `thumbnail-collage.${extension}`, {
    type: blob.type || 'image/jpeg',
  })
}

async function splitFourByFiveCollage(file: File) {
  if (!file.type.startsWith('image/') || file.type === 'image/gif' || file.type === 'image/svg+xml') {
    return [file]
  }

  const image = await loadImage(file)
  const ratio = image.width / image.height
  const isFourByFive = ratio > 0.74 && ratio < 0.86

  if (!isFourByFive || image.width < 600 || image.height < 700) {
    URL.revokeObjectURL(image.src)
    return [file]
  }

  const halfHeight = Math.floor(image.height / 2)
  const halfWidth = Math.floor(image.width / 2)
  const cropDefinitions = [
    { x: 0, y: 0, width: image.width, height: halfHeight },
    { x: 0, y: halfHeight, width: halfWidth, height: image.height - halfHeight },
    { x: halfWidth, y: halfHeight, width: image.width - halfWidth, height: image.height - halfHeight },
  ]

  try {
    const crops = await Promise.all(
      cropDefinitions.map(async (crop, index) => {
        const blob = await cropImage(image, crop)
        return new File([blob], `${file.name.replace(/\.[^.]+$/, '') || 'collage'}-${index + 1}.webp`, {
          type: 'image/webp',
        })
      })
    )
    return crops
  } finally {
    URL.revokeObjectURL(image.src)
  }
}

function cropImage(
  image: HTMLImageElement,
  crop: { x: number; y: number; width: number; height: number }
) {
  const canvas = document.createElement('canvas')
  canvas.width = crop.width
  canvas.height = crop.height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Could not prepare image crop.')

  context.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height)

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob)
      } else {
        reject(new Error('Could not create image crop.'))
      }
    }, 'image/webp', 0.84)
  })
}

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => {
      URL.revokeObjectURL(image.src)
      reject(new Error('Could not read pasted image.'))
    }
    image.src = URL.createObjectURL(file)
  })
}

function shuffle<T>(items: T[]) {
  const next = [...items]
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[next[index], next[swapIndex]] = [next[swapIndex], next[index]]
  }
  return next
}

function insertImageAtRandomParagraph(editor: TinyMceEditor, imageUrl: string) {
  const paragraphs = Array.from(editor.getBody().querySelectorAll('p')).filter(
    (paragraph) => paragraph.textContent?.trim()
  )
  const html = `<p><img src="${escapeHtmlAttribute(imageUrl)}" loading="lazy" /></p>`

  if (paragraphs.length === 0) {
    editor.insertContent(html)
    return
  }

  const target = paragraphs[Math.floor(Math.random() * paragraphs.length)]
  target.insertAdjacentHTML(Math.random() > 0.5 ? 'afterend' : 'beforebegin', html)
  editor.nodeChanged()
  editor.dispatch('change')
}

function escapeHtmlAttribute(value: string) {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;')
}
