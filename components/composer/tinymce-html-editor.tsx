"use client"

import { useState } from 'react'
import { Editor } from '@tinymce/tinymce-react'
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
}

export function TinyMceHtmlEditor({ value, onChange }: TinyMceHtmlEditorProps) {
  const [isReady, setIsReady] = useState(false)

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
          onInit={() => setIsReady(true)}
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
              'undo redo | blocks | bold italic underline | link image | bullist numlist | table | code',
            block_formats: 'Paragraph=p; Heading 2=h2; Heading 3=h3',
            automatic_uploads: true,
            paste_data_images: true,
            images_upload_handler: async (blobInfo) => {
              const blob = blobInfo.blob()
              const fileName = blobInfo.filename() || 'composer-image.png'
              const file = new File([blob], fileName, { type: blob.type || 'image/png' })
              const uploadedImage = await uploadPostImage(file)
              return uploadedImage.imageUrl
            },
            convert_urls: false,
            extended_valid_elements: 'img[src|alt|style|width|height|loading]',
            content_style:
              'body{font-family:Arial,sans-serif;font-size:14px;line-height:1.55;color:#111827;padding:12px;} img{max-width:100%;height:auto;} p{margin:0 0 12px;} h2,h3{margin:18px 0 10px;}',
          }}
        />
      </div>
    </div>
  )
}
