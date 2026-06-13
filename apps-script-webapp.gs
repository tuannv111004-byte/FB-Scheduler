const SHEETS = {
  pages: ['id', 'name', 'page_url', 'is_active', 'time_slots', 'notes', 'created_at', 'updated_at', 'logo_url', 'brand_color', 'posts_per_day'],
  posts: [
    'id',
    'page_id',
    'post_date',
    'time_slot',
    'caption',
    'image_path',
    'image_url',
    'drive_file_id',
    'status',
    'notes',
    'created_at',
    'updated_at',
    'ads_link',
  ],
  media: ['id', 'drive_file_id', 'file_name', 'mime_type', 'size', 'web_view_link', 'direct_url', 'created_at'],
}

const BACKUP_TABLE_HEADERS = {
  pages: ['id', 'name', 'page_url', 'logo_url', 'brand_color', 'is_active', 'posts_per_day', 'time_slots', 'notes', 'created_at', 'updated_at'],
  vias: ['id', 'account_name', 'account_link', 'account_password', 'display_name', 'two_factor_code', 'outlook_email', 'outlook_password', 'via_email', 'avatar_url', 'status', 'location', 'created_at', 'updated_at'],
  page_vias: ['page_id', 'via_id', 'created_at'],
  posts: ['id', 'page_id', 'post_date', 'time_slot', 'image_path', 'image_url', 'source_image_url', 'drive_file_id', 'drive_web_view_link', 'drive_direct_url', 'drive_copy_error', 'caption', 'ads_link', 'status', 'notes', 'created_at', 'updated_at'],
  notes: ['id', 'title', 'content', 'color', 'sort_order', 'created_at', 'updated_at'],
  sources: ['id', 'name', 'url', 'type', 'description', 'notes', 'is_active', 'created_at', 'updated_at'],
  sports_teams: ['id', 'name', 'sport', 'league', 'city', 'country', 'logo_url', 'owner_name', 'head_coach', 'assistant_coaches', 'legends', 'notes', 'created_at', 'updated_at'],
  sports_players: ['id', 'team_id', 'full_name', 'position', 'jersey_number', 'birth_date', 'nationality', 'photo_url', 'height', 'weight', 'status', 'spouse', 'father', 'mother', 'children', 'bio', 'notes', 'created_at', 'updated_at'],
  poster_lab_franchises: ['id', 'franchise_name', 'latest_official_title', 'genre', 'notes', 'tmdb_movie_id', 'tmdb_genre_ids', 'tmdb_genre_names', 'release_date', 'overview', 'poster_path', 'backdrop_path', 'source_category', 'created_at', 'updated_at'],
  poster_lab_sequels: ['id', 'franchise_id', 'fake_title', 'release_year', 'tagline', 'synopsis', 'visual_hook', 'prompt', 'caption', 'is_used', 'created_at', 'updated_at'],
}

function authorizeGooglePoc() {
  UrlFetchApp.fetch('https://www.googleapis.com/discovery/v1/apis', {
    muteHttpExceptions: true,
  })
  DriveApp.getRootFolder().getName()
  SpreadsheetApp.getActiveSpreadsheet()
}

function doPost(event) {
  try {
    const expectedToken = PropertiesService.getScriptProperties().getProperty('POC_TOKEN')
    const body = JSON.parse(event.postData.contents || '{}')

    if (!expectedToken || body.token !== expectedToken) {
      return jsonResponse({ ok: false, error: 'Unauthorized.' })
    }

    const spreadsheet = SpreadsheetApp.openById(requireString(body.sheetId, 'sheetId'))
    ensureSheetsAndHeaders(spreadsheet)

    switch (requireString(body.action, 'action')) {
      case 'list-pages':
        return jsonResponse({ ok: true, pages: readObjects(spreadsheet, 'pages') })
      case 'list-posts':
        return jsonResponse({ ok: true, posts: listPosts(spreadsheet, body) })
      case 'create-page':
        return jsonResponse({ ok: true, page: createPage(spreadsheet, body.page || {}) })
      case 'update-page':
        return jsonResponse({ ok: true, page: updateById(spreadsheet, 'pages', requireString(body.id, 'id'), pagePayload(body.updates || {}, false)) })
      case 'delete-page':
        deleteById(spreadsheet, 'pages', requireString(body.id, 'id'))
        deleteRowsWhere(spreadsheet, 'posts', 'page_id', body.id)
        return jsonResponse({ ok: true })
      case 'create-post':
        return jsonResponse({ ok: true, post: createPost(spreadsheet, body.post || {}) })
      case 'update-post':
        return jsonResponse({ ok: true, post: updatePost(spreadsheet, requireString(body.id, 'id'), body.updates || {}) })
      case 'delete-post':
        deletePost(spreadsheet, requireString(body.id, 'id'))
        return jsonResponse({ ok: true })
      case 'upload-media':
        return jsonResponse({ ok: true, media: uploadMedia(spreadsheet, body) })
      case 'get-media':
        return jsonResponse({ ok: true, media: getMedia(requireString(body.fileId, 'fileId'), body.folderId || '') })
      case 'create-post-with-media':
        return jsonResponse(createPostWithMedia(spreadsheet, body))
      case 'backup-postops-database':
        return jsonResponse(backupPostOpsDatabase(spreadsheet, body))
      default:
        return jsonResponse({ ok: false, error: 'Unsupported action.' })
    }
  } catch (error) {
    return jsonResponse({ ok: false, error: error.message || String(error) })
  }
}

function backupPostOpsDatabase(spreadsheet, body) {
  const tables = body.tables || {}
  const exportedAt = body.exportedAt || new Date().toISOString()
  const folderId = typeof body.folderId === 'string' ? body.folderId.trim() : ''
  const makePublic = body.makePublic === true
  const mediaCache = folderId ? readBackupMediaCache(spreadsheet) : {}
  const counts = {}
  let totalRows = 0

  Object.keys(BACKUP_TABLE_HEADERS).forEach((tableName) => {
    let rows = Array.isArray(tables[tableName]) ? tables[tableName] : []
    if (tableName === 'posts' && folderId) {
      rows = rows.map((row) => copyPostImageToDrive(row, folderId, makePublic, mediaCache))
    }
    replaceBackupSheet(spreadsheet, tableName, BACKUP_TABLE_HEADERS[tableName], rows)
    counts[tableName] = rows.length
    totalRows += rows.length
  })

  if (folderId) {
    replaceBackupMediaSheet(spreadsheet, mediaCache)
  }

  appendBackupRun(spreadsheet, exportedAt, totalRows, counts)

  return {
    ok: true,
    exportedAt,
    totalRows,
    counts,
    spreadsheetUrl: spreadsheet.getUrl(),
  }
}

function copyPostImageToDrive(row, folderId, makePublic, mediaCache) {
  const nextRow = Object.assign({}, row)
  const sourceUrl = String(row.image_url || '').trim()
  if (!sourceUrl || sourceUrl.indexOf('http') !== 0) return nextRow

  const existing = mediaCache[sourceUrl]
  if (existing) {
    nextRow.source_image_url = sourceUrl
    nextRow.image_path = `drive:${existing.drive_file_id}`
    nextRow.image_url = existing.thumbnail_url || existing.direct_url || existing.web_view_link
    nextRow.drive_file_id = existing.drive_file_id
    nextRow.drive_web_view_link = existing.web_view_link
    nextRow.drive_direct_url = existing.direct_url
    return nextRow
  }

  try {
    const response = UrlFetchApp.fetch(sourceUrl, {
      followRedirects: true,
      muteHttpExceptions: true,
    })

    const status = response.getResponseCode()
    if (status < 200 || status >= 300) {
      nextRow.drive_copy_error = `Fetch failed: ${status}`
      return nextRow
    }

    const headers = response.getHeaders()
    const mimeType = headers['Content-Type'] || headers['content-type'] || 'application/octet-stream'
    const fileName = backupImageFileName(row, mimeType)
    const blob = response.getBlob().setName(fileName)
    const file = DriveApp.getFolderById(folderId).createFile(blob)

    if (makePublic) {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW)
    }

    const driveFileId = file.getId()
    const mediaRow = {
      source_url: sourceUrl,
      post_id: String(row.id || ''),
      drive_file_id: driveFileId,
      file_name: fileName,
      mime_type: mimeType,
      size: String(response.getContent().length),
      web_view_link: file.getUrl(),
      direct_url: `https://drive.google.com/uc?id=${encodeURIComponent(driveFileId)}`,
      thumbnail_url: `https://lh3.googleusercontent.com/d/${encodeURIComponent(driveFileId)}`,
      created_at: new Date().toISOString(),
    }

    mediaCache[sourceUrl] = mediaRow
    nextRow.source_image_url = sourceUrl
    nextRow.image_path = `drive:${mediaRow.drive_file_id}`
    nextRow.image_url = mediaRow.thumbnail_url
    nextRow.drive_file_id = mediaRow.drive_file_id
    nextRow.drive_web_view_link = mediaRow.web_view_link
    nextRow.drive_direct_url = mediaRow.direct_url
  } catch (error) {
    nextRow.drive_copy_error = error.message || String(error)
  }

  return nextRow
}

function backupImageFileName(row, mimeType) {
  const extensionByMime = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
  }
  const extension = extensionByMime[String(mimeType).split(';')[0].toLowerCase()] || 'img'
  const postId = String(row.id || Utilities.getUuid()).replace(/[^a-zA-Z0-9_-]/g, '-')
  return `post-${postId}.${extension}`
}

function readBackupMediaCache(spreadsheet) {
  const sheet = spreadsheet.getSheetByName('backup_media')
  if (!sheet || sheet.getLastRow() < 2) return {}

  const values = sheet.getDataRange().getDisplayValues()
  const headers = values[0]
  return values.slice(1).filter((row) => row.some(Boolean)).reduce((cache, row) => {
    const item = objectFromRow(headers, row)
    if (item.source_url) cache[item.source_url] = item
    return cache
  }, {})
}

function replaceBackupMediaSheet(spreadsheet, mediaCache) {
  const headers = ['source_url', 'post_id', 'drive_file_id', 'file_name', 'mime_type', 'size', 'web_view_link', 'direct_url', 'thumbnail_url', 'created_at']
  const rows = Object.keys(mediaCache).map((sourceUrl) => mediaCache[sourceUrl])
  replaceBackupSheet(spreadsheet, 'backup_media', headers, rows)
}

function replaceBackupSheet(spreadsheet, sheetName, headers, rows) {
  const sheet = spreadsheet.getSheetByName(sheetName) || spreadsheet.insertSheet(sheetName)
  sheet.clearContents()
  sheet.getRange(1, 1, 1, headers.length).setValues([headers])

  if (rows.length > 0) {
    const values = rows.map((row) => headers.map((header) => serializeCell(row[header])))
    sheet.getRange(2, 1, values.length, headers.length).setNumberFormat('@').setValues(values)
  }

  sheet.getDataRange().setNumberFormat('@')
}

function appendBackupRun(spreadsheet, exportedAt, totalRows, counts) {
  const sheetName = 'backup_runs'
  const headers = ['exported_at', 'total_rows'].concat(Object.keys(BACKUP_TABLE_HEADERS))
  const sheet = spreadsheet.getSheetByName(sheetName) || spreadsheet.insertSheet(sheetName)

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers])
  }

  const values = [
    exportedAt,
    String(totalRows),
  ].concat(Object.keys(BACKUP_TABLE_HEADERS).map((tableName) => String(counts[tableName] || 0)))

  sheet.getRange(sheet.getLastRow() + 1, 1, 1, values.length).setNumberFormat('@').setValues([values])
}

function createPage(spreadsheet, input) {
  const now = new Date().toISOString()
  const row = {
    id: input.id || `page-${Utilities.getUuid()}`,
    ...pagePayload(input, true),
    created_at: now,
    updated_at: now,
  }
  appendObject(spreadsheet, 'pages', row)
  return row
}

function createPost(spreadsheet, input) {
  const now = new Date().toISOString()
  const row = {
    id: input.id || `post-${Utilities.getUuid()}`,
    ...postPayload(input, true),
    created_at: now,
    updated_at: now,
  }
  appendObject(spreadsheet, 'posts', row)
  return row
}

function listPosts(spreadsheet, body) {
  const posts = readObjects(spreadsheet, 'posts')
  const postDate = typeof body.postDate === 'string' ? body.postDate : ''
  if (!postDate) return posts

  const includeNextDateForLateSlot = body.includeNextDateForLateSlot !== false
  const dates = [postDate]
  if (includeNextDateForLateSlot) {
    dates.push(addDays(postDate, 1))
  }

  return posts.filter((post) => dates.includes(post.post_date))
}

function addDays(dateValue, days) {
  const date = new Date(`${dateValue}T00:00:00`)
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

function uploadMedia(spreadsheet, body) {
  const folderId = requireString(body.folderId, 'folderId')
  const fileName = requireString(body.fileName, 'fileName')
  const mimeType = requireString(body.mimeType, 'mimeType')
  const base64 = requireString(body.base64, 'base64')
  const makePublic = body.makePublic !== false
  const bytes = Utilities.base64Decode(base64)
  const blob = Utilities.newBlob(bytes, mimeType, fileName)
  const file = DriveApp.getFolderById(folderId).createFile(blob)

  if (makePublic) {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW)
  }

  const driveFileId = file.getId()
  const directUrl = `https://drive.google.com/uc?id=${encodeURIComponent(driveFileId)}`
  const thumbnailUrl = `https://lh3.googleusercontent.com/d/${encodeURIComponent(driveFileId)}`
  const row = {
    id: `media-${Utilities.getUuid()}`,
    drive_file_id: driveFileId,
    file_name: fileName,
    mime_type: mimeType,
    size: String(bytes.length),
    web_view_link: file.getUrl(),
    direct_url: directUrl,
    created_at: new Date().toISOString(),
  }
  appendObject(spreadsheet, 'media', row)

  return {
    ...row,
    image_path: `drive:${driveFileId}`,
    image_url: thumbnailUrl,
  }
}

function getMedia(fileId, folderId) {
  const file = findDriveFile(fileId, folderId)
  if (!file) return getMediaViaDriveApi(fileId)

  const blob = file.getBlob()
  return {
    file_name: file.getName(),
    mime_type: blob.getContentType(),
    base64: Utilities.base64Encode(blob.getBytes()),
  }
}

function findDriveFile(fileId, folderId) {
  try {
    return DriveApp.getFileById(fileId)
  } catch (error) {
    if (folderId) {
      try {
        const files = DriveApp.getFolderById(String(folderId)).getFiles()
        while (files.hasNext()) {
          const file = files.next()
          if (file.getId() === fileId) return file
        }
      } catch (folderError) {
        console.warn(`DriveApp folder fallback failed for ${fileId}: ${folderError.message || folderError}`)
      }
    }

    console.warn(`DriveApp.getFileById failed for ${fileId}: ${error.message || error}`)
    return null
  }
}

function getMediaViaDriveApi(fileId) {
  const token = ScriptApp.getOAuthToken()
  const metadataResponse = UrlFetchApp.fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=name,mimeType,trashed`,
    {
      headers: { Authorization: `Bearer ${token}` },
      muteHttpExceptions: true,
    }
  )

  if (metadataResponse.getResponseCode() !== 200) {
    throw new Error(`Could not read Drive file metadata ${fileId}. Drive API returned ${metadataResponse.getResponseCode()}: ${metadataResponse.getContentText()}`)
  }

  const metadata = JSON.parse(metadataResponse.getContentText())
  if (metadata.trashed) {
    throw new Error(`Drive file ${fileId} is in Trash.`)
  }

  const mediaResponse = UrlFetchApp.fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`,
    {
      headers: { Authorization: `Bearer ${token}` },
      muteHttpExceptions: true,
    }
  )

  if (mediaResponse.getResponseCode() !== 200) {
    throw new Error(`Could not download Drive file ${fileId}. Drive API returned ${mediaResponse.getResponseCode()}: ${mediaResponse.getContentText()}`)
  }

  return {
    file_name: metadata.name || fileId,
    mime_type: metadata.mimeType || mediaResponse.getHeaders()['Content-Type'] || 'application/octet-stream',
    base64: Utilities.base64Encode(mediaResponse.getContent()),
  }
}

function createPostWithMedia(spreadsheet, body) {
  const media = uploadMedia(spreadsheet, body)
  const page = createPage(spreadsheet, {
    name: 'POC Test Page',
    page_url: '',
    logo_url: '',
    brand_color: '#14b8a6',
    is_active: 'true',
    posts_per_day: '3',
    time_slots: '09:00,13:00,18:00',
    notes: 'Created by Google Apps Script POC',
  })
  const post = createPost(spreadsheet, {
    page_id: page.id,
    post_date: todayDate(),
    time_slot: '09:00',
    caption: requireString(body.caption, 'caption'),
    image_path: media.image_path,
    image_url: media.image_url,
    drive_file_id: media.drive_file_id,
    ads_link: '',
    status: 'scheduled',
    notes: 'Created by Google Apps Script POC',
  })

  return {
    ok: true,
    postsRows: Math.max(0, spreadsheet.getSheetByName('posts').getLastRow() - 1),
    driveFileId: media.drive_file_id,
    imageUrl: media.image_url,
    directUrl: media.direct_url,
    createdPost: post,
  }
}

function pagePayload(input, includeDefaults) {
  const payload = {}
  copyField(payload, input, 'name', includeDefaults ? 'Untitled Page' : undefined)
  copyField(payload, input, 'page_url', includeDefaults ? '' : undefined)
  copyField(payload, input, 'logo_url', includeDefaults ? '' : undefined)
  copyField(payload, input, 'brand_color', includeDefaults ? '#14b8a6' : undefined)
  copyField(payload, input, 'is_active', includeDefaults ? 'true' : undefined)
  copyField(payload, input, 'posts_per_day', includeDefaults ? '1' : undefined)
  copyField(payload, input, 'time_slots', includeDefaults ? '' : undefined)
  copyField(payload, input, 'notes', includeDefaults ? '' : undefined)
  payload.updated_at = new Date().toISOString()
  return payload
}

function postPayload(input, includeDefaults) {
  const payload = {}
  copyField(payload, input, 'page_id', includeDefaults ? '' : undefined)
  copyField(payload, input, 'post_date', includeDefaults ? todayDate() : undefined)
  copyField(payload, input, 'time_slot', includeDefaults ? '' : undefined)
  copyField(payload, input, 'caption', includeDefaults ? '' : undefined)
  copyField(payload, input, 'image_path', includeDefaults ? '' : undefined)
  copyField(payload, input, 'image_url', includeDefaults ? '' : undefined)
  copyField(payload, input, 'ads_link', includeDefaults ? '' : undefined)
  copyField(payload, input, 'drive_file_id', includeDefaults ? '' : undefined)
  copyField(payload, input, 'status', includeDefaults ? 'draft' : undefined)
  copyField(payload, input, 'notes', includeDefaults ? '' : undefined)
  payload.updated_at = new Date().toISOString()
  return payload
}

function copyField(target, source, key, defaultValue) {
  if (Object.prototype.hasOwnProperty.call(source, key)) {
    target[key] = serializeCell(source[key])
    return
  }
  if (defaultValue !== undefined) target[key] = defaultValue
}

function ensureSheetsAndHeaders(spreadsheet) {
  Object.keys(SHEETS).forEach((name) => {
    const sheet = spreadsheet.getSheetByName(name) || spreadsheet.insertSheet(name)
    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, SHEETS[name].length).setValues([SHEETS[name]])
    } else {
      const headers = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getDisplayValues()[0].filter(Boolean)
      const missingHeaders = SHEETS[name].filter((header) => !headers.includes(header))
      if (missingHeaders.length > 0) {
        sheet.getRange(1, headers.length + 1, 1, missingHeaders.length).setValues([missingHeaders])
      }
    }
    sheet.getDataRange().setNumberFormat('@')
  })
}

function readObjects(spreadsheet, sheetName) {
  const sheet = spreadsheet.getSheetByName(sheetName)
  if (!sheet || sheet.getLastRow() < 2) return []

  const values = sheet.getDataRange().getDisplayValues()
  const headers = values[0]
  return values.slice(1).filter((row) => row.some(Boolean)).map((row) => objectFromRow(headers, row))
}

function appendObject(spreadsheet, sheetName, object) {
  const sheet = spreadsheet.getSheetByName(sheetName)
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0]
  const values = headers.map((header) => serializeCell(object[header]))
  const rowIndex = sheet.getLastRow() + 1
  sheet.getRange(rowIndex, 1, 1, values.length).setNumberFormat('@').setValues([values])
}

function updateById(spreadsheet, sheetName, id, updates) {
  const sheet = spreadsheet.getSheetByName(sheetName)
  const values = sheet.getDataRange().getDisplayValues()
  const headers = values[0]
  const idIndex = headers.indexOf('id')
  const rowOffset = values.slice(1).findIndex((row) => row[idIndex] === id)
  if (rowOffset < 0) throw new Error(`${sheetName} row not found: ${id}`)

  const row = objectFromRow(headers, values[rowOffset + 1])
  Object.keys(updates).forEach((key) => {
    if (headers.includes(key)) row[key] = serializeCell(updates[key])
  })

  const rowIndex = rowOffset + 2
  const nextValues = headers.map((header) => serializeCell(row[header]))
  sheet.getRange(rowIndex, 1, 1, nextValues.length).setNumberFormat('@').setValues([nextValues])
  return objectFromRow(headers, nextValues)
}

function deleteById(spreadsheet, sheetName, id) {
  deleteRowsWhere(spreadsheet, sheetName, 'id', id)
}

function deletePost(spreadsheet, id) {
  const post = findById(spreadsheet, 'posts', id)
  if (!post) return

  const driveFileId = post.drive_file_id || extractDriveFileId(post.image_path) || extractDriveFileId(post.image_url)
  deleteById(spreadsheet, 'posts', id)

  if (driveFileId && !isDriveFileReferencedByAnyPost(spreadsheet, driveFileId)) {
    trashDriveFile(driveFileId)
  }
}

function updatePost(spreadsheet, id, updates) {
  const existingPost = findById(spreadsheet, 'posts', id)
  if (!existingPost) throw new Error(`posts row not found: ${id}`)

  const oldDriveFileId =
    existingPost.drive_file_id ||
    extractDriveFileId(existingPost.image_path) ||
    extractDriveFileId(existingPost.image_url)

  const updatedPost = updateById(spreadsheet, 'posts', id, postPayload(updates, false))
  const newDriveFileId =
    updatedPost.drive_file_id ||
    extractDriveFileId(updatedPost.image_path) ||
    extractDriveFileId(updatedPost.image_url)

  if (oldDriveFileId && oldDriveFileId !== newDriveFileId && !isDriveFileReferencedByAnyPost(spreadsheet, oldDriveFileId)) {
    trashDriveFile(oldDriveFileId)
  }

  return updatedPost
}

function findById(spreadsheet, sheetName, id) {
  const sheet = spreadsheet.getSheetByName(sheetName)
  if (!sheet || sheet.getLastRow() < 2) return null

  const values = sheet.getDataRange().getDisplayValues()
  const headers = values[0]
  const idIndex = headers.indexOf('id')
  if (idIndex < 0) return null

  const row = values.slice(1).find((item) => item[idIndex] === id)
  return row ? objectFromRow(headers, row) : null
}

function isDriveFileReferencedByAnyPost(spreadsheet, driveFileId) {
  const posts = readObjects(spreadsheet, 'posts')
  return posts.some((post) => {
    return (
      post.drive_file_id === driveFileId ||
      extractDriveFileId(post.image_path) === driveFileId ||
      extractDriveFileId(post.image_url) === driveFileId
    )
  })
}

function trashDriveFile(driveFileId) {
  try {
    DriveApp.getFileById(driveFileId).setTrashed(true)
  } catch (error) {
    console.warn(`Could not trash Drive file ${driveFileId}: ${error.message || error}`)
  }
}

function extractDriveFileId(value) {
  if (!value) return ''
  if (String(value).indexOf('drive:') === 0) return String(value).slice('drive:'.length)

  const text = String(value)
  const filePathMatch = text.match(/\/file\/d\/([^/]+)/)
  if (filePathMatch && filePathMatch[1]) return filePathMatch[1]

  const idMatch = text.match(/[?&]id=([^&]+)/)
  if (idMatch && idMatch[1]) return decodeURIComponent(idMatch[1])

  return ''
}

function deleteRowsWhere(spreadsheet, sheetName, column, value) {
  const sheet = spreadsheet.getSheetByName(sheetName)
  if (!sheet || sheet.getLastRow() < 2) return

  const values = sheet.getDataRange().getDisplayValues()
  const headers = values[0]
  const columnIndex = headers.indexOf(column)
  if (columnIndex < 0) return

  for (let index = values.length - 1; index >= 1; index -= 1) {
    if (values[index][columnIndex] === value) {
      sheet.deleteRow(index + 1)
    }
  }
}

function objectFromRow(headers, row) {
  return headers.reduce((result, header, index) => {
    result[header] = row[index] === undefined ? '' : String(row[index])
    return result
  }, {})
}

function serializeCell(value) {
  if (Array.isArray(value)) return value.join(',')
  if (value === null || value === undefined) return ''
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  return String(value)
}

function todayDate() {
  return new Date().toISOString().slice(0, 10)
}

function requireString(value, name) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Missing required field: ${name}`)
  }
  return value
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON)
}
