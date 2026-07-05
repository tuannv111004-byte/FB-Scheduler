const DAILY_URL = "https://dailychronicle.cafex.biz/backend/posts";
const FEJI_CREATE_URL = "https://s.feji.io/app/links/create";
const FEJI_LIST_URL = "https://s.feji.io/app/links?page=1";
const STATE_KEY = "dailyFejiState";
const SCHEDULER_CONFIG_KEY = "dailyFejiSchedulerConfig";
const DOMAIN_RULE = [
  "headlinebriefs.com",
  "greendailys.com",
  "greenwnbas.com",
  "wnbatime.us",
  "newlifes.org",
  "musicscountry.com"
];

let stopRequested = false;
let running = false;

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "START_BATCH") {
    if (!running) {
      runBatch(message.payload).catch((error) => {
        setState({ status: "error", message: error.message });
        running = false;
      });
    }
    sendResponse({ ok: true });
    return true;
  }

  if (message?.type === "STOP_BATCH") {
    stopRequested = true;
    setState({ status: "stopping", message: "Đang dừng sau bước hiện tại..." });
    sendResponse({ ok: true });
    return true;
  }

  return false;
});

async function runBatch(payload) {
  running = true;
  stopRequested = false;
  const savedConfig = (await chrome.storage.local.get(SCHEDULER_CONFIG_KEY))[SCHEDULER_CONFIG_KEY] || {};
  const items = payload.items || [];
  const options = payload.options || {};
  const scheduler = payload.scheduler || savedConfig;
  const results = [];

  await setState({ status: "running", message: `Chuẩn bị chạy ${items.length} bài...`, results });

  let dailyTab = await getOrCreateTab(DAILY_URL, new URL(DAILY_URL).host);
  await waitForTabComplete(dailyTab.id);

  for (let i = 0; i < items.length; i += 1) {
    if (stopRequested) break;
    const item = items[i];
    const row = {
      title: item.title,
      image: item.image || "",
      caption: item.caption || "",
      schedulerPostId: item.schedulerPostId || "",
      dailyLink: "",
      shortLink: "",
      domain: "",
      cleanupImageUrls: [],
      status: "running",
      error: ""
    };
    results.push(row);

    try {
      await setState({
        status: "running",
        message: `[${i + 1}/${items.length}] Tạo Daily post: ${item.title}`,
        results
      });

      try {
        await chrome.tabs.get(dailyTab.id);
      } catch {
        dailyTab = await getOrCreateTab(DAILY_URL, new URL(DAILY_URL).host);
        await waitForTabComplete(dailyTab.id);
      }

      const dailyResult = await createDailyPost(dailyTab.id, item, options);
      row.dailyLink = dailyResult.dailyLink;
      row.cleanupImageUrls = dailyResult.cleanupImageUrls;
      row.domain = domainForNow();

      await setState({
        status: "running",
        message: `[${i + 1}/${items.length}] Tạo Feji link: ${row.dailyLink}`,
        results
      });

      row.shortLink = await createFejiLink(item, row.dailyLink, row.domain);
      row.status = "done";

      if (scheduler?.enabled && row.schedulerPostId) {
        await sendCompletedRowToScheduler(row, scheduler, results, i, items.length);
      }
    } catch (error) {
      row.status = "error";
      row.error = error.message;
    }

    await setState({
      status: stopRequested ? "stopping" : "running",
      message: `[${i + 1}/${items.length}] ${row.status}: ${item.title}`,
      results
    });
  }

  if (scheduler?.enabled) {
    const doneRows = results.filter((row) => row.status === "done" && !row.schedulerStatus);
    if (doneRows.length > 0) {
      try {
        await setState({
          status: "running",
          message: `Gui ${doneRows.length} ket qua sang FB Scheduler...`,
          results
        });

        const schedulerResult = await sendToScheduler(doneRows, scheduler);
        const itemResults = Array.isArray(schedulerResult?.results) ? schedulerResult.results : [];
        const updatedPosts = schedulerResult?.posts || [];

        doneRows.forEach((row, index) => {
          const itemResult = itemResults[index];
          const updatedPost = itemResult?.post || updatedPosts[index];
          if (itemResult && itemResult.ok === false) {
            row.schedulerStatus = "error";
            row.schedulerError = itemResult.error || "Scheduler did not update this row.";
            return;
          }
          if (!updatedPost) {
            row.schedulerStatus = "error";
            row.schedulerError = "Scheduler did not return an updated post for this row.";
            return;
          }
          row.schedulerStatus = "sent";
          row.schedulerPostId = updatedPost?.id || row.schedulerPostId || "";
          row.schedulerDate = updatedPost?.post_date || "";
          row.schedulerTimeSlot = updatedPost?.time_slot || "";
          row.schedulerCaption = updatedPost?.caption || "";
        });
      } catch (error) {
        doneRows.forEach((row) => {
          row.schedulerStatus = "error";
          row.schedulerError = error.message;
        });
      }

      await setState({
        status: stopRequested ? "stopping" : "running",
        message: `Da gui Scheduler: ${doneRows.filter((row) => row.schedulerStatus === "sent").length}/${doneRows.length}`,
        results
      });
    }
  }

  await setState({
    status: stopRequested ? "stopped" : "done",
    message: stopRequested ? "Đã dừng." : `Hoàn tất ${results.filter((r) => r.status === "done").length}/${items.length} bài.`,
    results
  });
  running = false;
}

async function sendCompletedRowToScheduler(row, scheduler, results, index, total) {
  try {
    row.schedulerStatus = "sending";
    await setState({
      status: "running",
      message: `[${index + 1}/${total}] Gui Scheduler: ${row.title}`,
      results
    });

    const schedulerResult = await sendToScheduler([row], scheduler);
    const itemResult = Array.isArray(schedulerResult?.results) ? schedulerResult.results[0] : null;
    const updatedPost = itemResult?.post || schedulerResult?.posts?.[0];
    if (itemResult && itemResult.ok === false) {
      throw new Error(itemResult.error || "Scheduler did not update this row.");
    }
    if (!updatedPost) {
      throw new Error(schedulerResult?.errors?.[0] || "Scheduler did not return an updated post for this row.");
    }

    row.schedulerStatus = "sent";
    row.schedulerPostId = updatedPost?.id || row.schedulerPostId || "";
    row.schedulerDate = updatedPost?.post_date || "";
    row.schedulerTimeSlot = updatedPost?.time_slot || "";
    row.schedulerCaption = updatedPost?.caption || "";
  } catch (error) {
    row.schedulerStatus = "error";
    row.schedulerError = error.message;
  }

  await setState({
    status: "running",
    message: `[${index + 1}/${total}] Scheduler ${row.schedulerStatus}: ${row.title}`,
    results
  });
}

async function setState(patch) {
  const current = (await chrome.storage.local.get(STATE_KEY))[STATE_KEY] || {};
  await chrome.storage.local.set({ [STATE_KEY]: { ...current, ...patch } });
}

async function sendToScheduler(rows, scheduler) {
  const schedulerUrl = String(scheduler.schedulerUrl || "").replace(/\/+$/, "");
  const token = String(scheduler.token || "");
  const pageId = String(scheduler.pageId || "");
  const startDate = String(scheduler.startDate || "");
  const startTimeSlot = String(scheduler.startTimeSlot || "");
  const status = String(scheduler.status || "draft");
  const hasPostIds = rows.every((row) => String(row.schedulerPostId || "").trim());
  const items = rows.map((row) => ({
    title: String(row.title || ""),
    image: String(row.image || ""),
    caption: String(row.caption || ""),
    schedulerPostId: String(row.schedulerPostId || ""),
    dailyLink: String(row.dailyLink || ""),
    shortLink: String(row.shortLink || row.dailyLink || ""),
    domain: String(row.domain || ""),
    cleanupImageUrls: Array.isArray(row.cleanupImageUrls) ? row.cleanupImageUrls : [],
    status: row.status === "done" ? "done" : String(row.status || "")
  }));

  if (!schedulerUrl) throw new Error("Thieu Scheduler URL");
  if (!token) throw new Error("Thieu Scheduler import token");
  if (!hasPostIds) {
    if (!pageId) throw new Error("Thieu Scheduler pageId");
    if (!startDate) throw new Error("Thieu Scheduler startDate");
    if (!startTimeSlot) throw new Error("Thieu Scheduler startTimeSlot");
  }

  const response = await fetch(`${schedulerUrl}/api/extension/daily-results`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify({
      pageId,
      startDate,
      startTimeSlot,
      status,
      items
    })
  });

  const responseText = await response.text();
  let result = null;
  try {
    result = responseText ? JSON.parse(responseText) : null;
  } catch {
    // Keep raw text for the error below.
  }

  if (!response.ok) {
    throw new Error(result?.error || responseText || `Scheduler API error ${response.status}`);
  }

  return result;
}

function domainForNow(date = new Date()) {
  const intervalMinutes = 60 / DOMAIN_RULE.length;
  const domainIndex = Math.min(DOMAIN_RULE.length - 1, Math.floor(date.getMinutes() / intervalMinutes));
  return DOMAIN_RULE[domainIndex];
}

async function getOrCreateTab(url, host) {
  const tabs = await chrome.tabs.query({});
  const existing = tabs.find((tab) => {
    try {
      return new URL(tab.url || "").host === host;
    } catch {
      return false;
    }
  });

  if (existing) {
    await chrome.tabs.update(existing.id, { url, active: true });
    await waitForTabComplete(existing.id);
    return existing;
  }

  return chrome.tabs.create({ url, active: true });
}

async function navigateTab(tabId, url) {
  await chrome.tabs.update(tabId, { url, active: true });
  await waitForTabComplete(tabId);
}

function waitForTabComplete(tabId, timeoutMs = 45000) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const timer = setInterval(async () => {
      try {
        const tab = await chrome.tabs.get(tabId);
        if (tab.status === "complete") {
          clearInterval(timer);
          resolve();
        } else if (Date.now() - started > timeoutMs) {
          clearInterval(timer);
          reject(new Error("Trang tải quá lâu"));
        }
      } catch (error) {
        clearInterval(timer);
        reject(error);
      }
    }, 300);
  });
}

async function execute(tabId, func, args = []) {
  const [result] = await chrome.scripting.executeScript({
    target: { tabId },
    func,
    args
  });

  if (result?.result?.ok === false) {
    throw new Error(result.result.error);
  }

  return result?.result?.value;
}

async function createDailyPost(tabId, item, options) {
  await navigateTab(tabId, DAILY_URL);
  const result = await execute(tabId, dailyCreatePostScript, [item, options]);
  if (typeof result === "string") {
    return { dailyLink: result, cleanupImageUrls: [] };
  }

  if (result?.dailyLink) {
    await delay(1200);
    return {
      dailyLink: result.dailyLink,
      cleanupImageUrls: Array.isArray(result.cleanupImageUrls) ? result.cleanupImageUrls : []
    };
  }

  if (result?.pending) {
    try {
      await waitForTabComplete(tabId, 45000);
    } catch {
      // Daily may save via XHR without changing the tab loading state.
    }

    const started = Date.now();
    while (Date.now() - started < 12000) {
      await delay(700);
      let dailyLink = "";
      try {
        dailyLink = await execute(tabId, dailyFindPostLinkScript, [
          item.title,
          Array.isArray(result.existingUrls) ? result.existingUrls : []
        ]);
      } catch (error) {
        const message = String(error?.message || "");
        if (
          message.includes("Frame with ID") ||
          message.includes("was removed") ||
          message.includes("Cannot access contents")
        ) {
          try {
            await waitForTabComplete(tabId, 10000);
          } catch {
            // Keep polling until the main timeout expires.
          }
          continue;
        }
        throw error;
      }
      if (dailyLink) {
        return {
          dailyLink,
          cleanupImageUrls: Array.isArray(result.cleanupImageUrls) ? result.cleanupImageUrls : []
        };
      }
    }

    throw new Error("Khong lay duoc Daily link sau khi save");
  }

  return {
    dailyLink: result?.dailyLink || "",
    cleanupImageUrls: Array.isArray(result?.cleanupImageUrls) ? result.cleanupImageUrls : []
  };
}

async function createFejiLink(item, dailyLink, domain) {
  const tab = await chrome.tabs.create({ url: FEJI_CREATE_URL, active: false });
  try {
    await waitForTabComplete(tab.id);
    await execute(tab.id, fejiFillAndSubmitScript, [item, dailyLink, domain]);
    await delay(2500);
    await waitForTabComplete(tab.id, 45000);

    const searchUrl = `${FEJI_LIST_URL}&link=${encodeURIComponent(dailyLink)}`;
    await navigateTab(tab.id, searchUrl);
    const shortLink = await execute(tab.id, fejiFindShortLinkScript, [dailyLink, domain]);
    await chrome.tabs.remove(tab.id);
    return shortLink;
  } catch (error) {
    try {
      await chrome.tabs.remove(tab.id);
    } catch {
      // Tab may already be closed.
    }
    throw error;
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function dailyCreatePostScript(item, options) {
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const normalize = (value) => String(value || "").trim().replace(/\s+/g, " ");
  const fire = (element) => {
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  };
  const setValue = (selector, value) => {
    const element = document.querySelector(selector);
    if (!element) return false;
    element.focus();
    setElementValue(element, value);
    fire(element);
    return true;
  };
  const isUsableField = (element) => {
    if (!element || element.disabled || element.readOnly) return false;
    if (element.matches('input[type="hidden"], [aria-hidden="true"]')) return false;
    return true;
  };
  const setElementValue = (element, value) => {
    const nextValue = value || "";
    const prototype = Object.getPrototypeOf(element);
    const descriptor = prototype ? Object.getOwnPropertyDescriptor(prototype, "value") : null;
    if (descriptor?.set) {
      descriptor.set.call(element, nextValue);
    } else {
      element.value = nextValue;
    }
  };
  const findBySelectors = (selectors) => {
    for (const selector of selectors) {
      const element = [...document.querySelectorAll(selector)].find(isUsableField);
      if (element) return element;
    }
    return null;
  };
  const findFieldByTokens = (tokens, fieldSelector = "input, textarea") => {
    const lowerTokens = tokens.map((token) => token.toLowerCase());
    const fields = [...document.querySelectorAll(fieldSelector)].filter(isUsableField);

    for (const field of fields) {
      const haystack = [
        field.id,
        field.name,
        field.placeholder,
        field.getAttribute("aria-label"),
        field.getAttribute("wire:model"),
        field.getAttribute("wire:model.defer"),
        field.getAttribute("x-model"),
        field.getAttribute("data-field")
      ].map(normalize).join(" ").toLowerCase();
      if (lowerTokens.some((token) => haystack.includes(token))) return field;
    }

    for (const label of document.querySelectorAll("label")) {
      const labelText = normalize(label.textContent).toLowerCase();
      if (!lowerTokens.some((token) => labelText.includes(token))) continue;

      if (label.control && isUsableField(label.control)) return label.control;
      const container = label.closest(".form-group, .mb-3, .row, .col, div") || label.parentElement;
      const field = container?.querySelector(fieldSelector);
      if (isUsableField(field)) return field;
    }

    return null;
  };
  const setFirstValue = (selectors, tokens, value) => {
    const element = findBySelectors(selectors) || findFieldByTokens(tokens);
    if (!element) return false;
    element.focus();
    setElementValue(element, value);
    fire(element);
    return true;
  };
  const stripHtml = (html) => {
    const div = document.createElement("div");
    div.innerHTML = html || "";
    return normalize(div.textContent || "");
  };
  const truncateText = (value, maxLength) => {
    const text = normalize(value);
    return text.length > maxLength ? `${text.slice(0, maxLength - 1).trim()}...` : text;
  };
  const slugify = (value) => {
    const slug = String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .replace(/^vt-+/, "")
      .slice(0, 80)
      .replace(/-+$/g, "");
    const suffix = Date.now().toString(36).slice(-5);
    return `${slug || "post"}-${suffix}`;
  };
  const publicDailyLinkFromSlug = (slug) => `https://dailychronicle.cafex.biz/blog/${slug}`;
  const escapeHtmlAttribute = (value) => String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
  const fileNameFromUrl = (url, fallback = "image.webp") => {
    try {
      const pathname = new URL(url).pathname;
      const name = pathname.split("/").filter(Boolean).pop();
      return name || fallback;
    } catch {
      return fallback;
    }
  };
  const csrfToken = () =>
    document.querySelector('meta[name="csrf-token"]')?.getAttribute("content")
      || document.querySelector('input[name="_token"]')?.value
      || "";
  const uploadImageUrlToDaily = async (imageUrl) => {
    let imageResponse;
    try {
      imageResponse = await fetch(imageUrl, { credentials: "omit" });
    } catch (error) {
      throw new Error(`Khong tai duoc anh: ${error.message}`);
    }

    if (!imageResponse.ok) {
      throw new Error(`Khong tai duoc anh ${imageResponse.status}`);
    }

    const blob = await imageResponse.blob();
    const contentType = blob.type || "image/webp";
    if (!contentType.startsWith("image/")) {
      throw new Error("URL khong phai file anh");
    }

    const token = csrfToken();
    const presignResponse = await fetch("/backend/uploads/presigned-image-url", {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "X-Requested-With": "XMLHttpRequest",
        ...(token ? { "X-CSRF-TOKEN": token } : {})
      },
      body: JSON.stringify({
        fileName: fileNameFromUrl(imageUrl),
        contentType,
        size: blob.size,
        auditContext: null
      })
    });
    const presignResult = await presignResponse.json().catch(() => null);
    if (!presignResponse.ok || !presignResult?.data?.upload?.url || !presignResult?.data?.fileUrl) {
      throw new Error(presignResult?.message || "Khong lay duoc Daily upload URL");
    }

    const upload = presignResult.data.upload;
    const putResponse = await fetch(upload.url, {
      method: upload.method || "PUT",
      credentials: "omit",
      headers: {
        "Content-Type": contentType
      },
      body: blob
    });
    if (!putResponse.ok) {
      throw new Error(`Upload anh Daily that bai ${putResponse.status}`);
    }

    return presignResult.data.fileUrl;
  };
  const replaceDescriptionImagesWithDailyUrls = async (html) => {
    const uploadedUrls = new Map();
    const container = document.createElement("div");
    container.innerHTML = html || "";
    const images = [...container.querySelectorAll("img[src]")];
    const remoteImages = images.filter((image) => {
      const src = image.getAttribute("src") || "";
      return /^https?:\/\//i.test(src) && !src.includes("blog.igallery.blog/assets/");
    });

    for (const image of remoteImages) {
      const src = image.getAttribute("src") || "";
      if (uploadedUrls.has(src)) {
        image.setAttribute("src", uploadedUrls.get(src));
        continue;
      }

      try {
        const dailyUrl = await uploadImageUrlToDaily(src);
        uploadedUrls.set(src, dailyUrl);
        image.setAttribute("src", dailyUrl);
      } catch {
        // Keep the original URL when the page cannot fetch it, usually because of CORS.
      }
    }

    return {
      html: container.innerHTML,
      uploadedUrls
    };
  };
  const getCleanupImageUrls = () => {
    const thumbnailUrl = String(item.image || "").trim();
    return [...uploadedDescriptionImageUrls.keys()].filter((url) =>
      url && url !== thumbnailUrl && url.includes("/storage/v1/object/public/post-images/")
    );
  };
  const buildDescriptionHtml = () => {
    const description = String(item.description || "");
    const placement = options.imagePlacement || (options.prependImageToDescription ? "top" : "none");
    const imageUrl = String(item.descriptionImage || item.image || "").trim();
    if (placement === "none" || !imageUrl || /<img\b/i.test(description)) {
      return description;
    }

    const imageHtml = `<p><img src="${escapeHtmlAttribute(imageUrl)}" alt=""></p>`;
    if (placement === "top") {
      return `${imageHtml}${description}`;
    }

    const container = document.createElement("div");
    container.innerHTML = description;
    const paragraphs = [...container.querySelectorAll("p")];
    if (paragraphs.length < 3) {
      return `${description}${imageHtml}`;
    }

    const minIndex = 1;
    const maxIndex = Math.max(minIndex, paragraphs.length - 2);
    const insertAfterIndex = minIndex + Math.floor(Math.random() * (maxIndex - minIndex + 1));
    paragraphs[insertAfterIndex].insertAdjacentHTML("afterend", imageHtml);
    return container.innerHTML;
  };
  let descriptionHtml = buildDescriptionHtml();
  let uploadedDescriptionImageUrls = new Map();
  const readCandidateUrl = (element) =>
    element?.dataset?.url
      || element?.dataset?.copy
      || element?.getAttribute?.("data-clipboard-text")
      || element?.getAttribute?.("data-link")
      || element?.getAttribute?.("href")
      || element?.value
      || "";
  const isDailyPublicUrl = (value) => {
    try {
      const url = new URL(value, window.location.origin);
      const host = url.hostname.toLowerCase();
      const path = url.pathname.toLowerCase();
      if (!["http:", "https:"].includes(url.protocol)) return false;
      if (host.includes("s.feji.io")) return false;
      if (path.includes("/backend/") || path.includes("/admin/") || path.includes("/assets/")) return false;
      if (host.includes("dailychronicle")) return path.startsWith("/blog/");
      return host.includes("igallery") || host.includes("blog") || path.split("/").filter(Boolean).length >= 1;
    } catch {
      return false;
    }
  };
  const collectDailyLinks = () =>
    [
      ...document.querySelectorAll(
        [
          "button.copy-btn[data-url]",
          "[data-url]",
          "[data-copy]",
          "[data-clipboard-text]",
          "[data-link]",
          'a[href^="http"]',
          'input[value^="http"]'
        ].join(",")
      )
    ]
      .map(readCandidateUrl)
      .filter(isDailyPublicUrl);
  const findNewDailyLink = (existingUrls) => {
    const normalizedTitle = normalize(item.title).toLowerCase();
    const rows = [...document.querySelectorAll("tbody tr, [role='row'], .card, .post-item, .table-row")];

    for (const row of rows) {
      const rowText = normalize(row.textContent).toLowerCase();
      if (normalizedTitle && !rowText.includes(normalizedTitle)) continue;

      const rowLink = [
        ...row.querySelectorAll("[data-url], [data-copy], [data-clipboard-text], [data-link], a[href^='http'], input[value^='http']")
      ]
        .map(readCandidateUrl)
        .find((url) => isDailyPublicUrl(url) && !existingUrls.has(url));
      if (rowLink) return rowLink;
    }

    return collectDailyLinks().find((url) => !existingUrls.has(url)) || "";
  };
  const setDescription = (html) => {
    const editorIds = ["description-editor", "description", "content", "body", "post_content"];

    for (const id of editorIds) {
      const editor = window.tinymce?.get?.(id);
      if (!editor) continue;
      editor.setContent(html);
      editor.save();
      editor.fire("change");
      editor.fire("input");
      return true;
    }

    const tinymceEditor = window.tinymce?.activeEditor || Object.values(window.tinymce?.editors || {})[0];
    if (tinymceEditor?.setContent) {
      tinymceEditor.setContent(html);
      tinymceEditor.save?.();
      tinymceEditor.fire?.("change");
      tinymceEditor.fire?.("input");
      return true;
    }

    if (window.CKEDITOR?.instances) {
      const editor = Object.values(window.CKEDITOR.instances)[0];
      if (editor?.setData) {
        editor.setData(html);
        return true;
      }
    }

    const textarea = document.querySelector("#description-editor")
      || document.querySelector("textarea[name='description']")
      || findBySelectors([
        "#description",
        "#content",
        "#body",
        "textarea[name='content']",
        "textarea[name='body']",
        "textarea[wire\\:model*='content']"
      ])
      || [...document.querySelectorAll("textarea")].find((field) => {
        const fieldName = `${field.id || ""} ${field.name || ""}`.toLowerCase();
        return isUsableField(field) && !fieldName.includes("seo") && !fieldName.includes("meta");
      });
    if (textarea) {
      setElementValue(textarea, html);
      fire(textarea);
    }

    const iframeBody = document.querySelector(".tox-edit-area iframe, iframe[id$='_ifr']")?.contentDocument?.body;
    if (iframeBody) {
      iframeBody.innerHTML = html;
      fire(iframeBody);
      if (textarea) {
        setElementValue(textarea, html);
        fire(textarea);
      }
      return true;
    }

    const editables = [...document.querySelectorAll('[contenteditable="true"]')];
    const editable = editables.sort((a, b) => (b.clientHeight * b.clientWidth) - (a.clientHeight * a.clientWidth))[0];
    if (editable) {
      editable.innerHTML = html;
      fire(editable);
      return true;
    }

    return Boolean(textarea);
  };
  const clickSave = () => {
    const controls = [
      ...document.querySelectorAll("button, input[type='submit'], input[type='button'], a.btn, [role='button']")
    ];
    const saveButton = controls.find((control) => {
      const text = normalize(control.textContent || control.value).toLowerCase();
      const onclick = control.getAttribute("onclick") || "";
      return (
        !control.disabled &&
        (["save", "create", "publish", "submit", "post", "update"].some((word) => text.includes(word)) ||
          onclick.includes("syncAndSave"))
      );
    });

    if (saveButton) {
      saveButton.click();
      return true;
    }

    const form = document.querySelector("form");
    if (form?.requestSubmit) {
      form.requestSubmit();
      return true;
    }
    if (form) {
      form.submit();
      return true;
    }

    return false;
  };
  const existingUrls = new Set(collectDailyLinks());

  try {
    const uploadResult = await replaceDescriptionImagesWithDailyUrls(descriptionHtml);
    descriptionHtml = uploadResult.html;
    uploadedDescriptionImageUrls = uploadResult.uploadedUrls;

    {
      const dailyImageUrl = uploadedDescriptionImageUrls.get(item.image) || item.image || "";
      const dailySlug = slugify(item.title);
      setFirstValue(
        [
          'input[wire\\:model\\.defer="image"]',
          'input[wire\\:model*="image"]',
          "input.image-url",
          "#image",
          "input[name='image']",
          "input[name='thumbnail']",
          "input[name='featured_image']"
        ],
        ["image", "thumbnail", "featured"],
        dailyImageUrl
      );
      if (!setFirstValue(["#title", "input[name='title']", "input[wire\\:model*='title']"], ["title"], item.title)) {
        throw new Error("Khong tim thay field title Daily");
      }
      setFirstValue(["#slug", "input[name='slug']", "input[wire\\:model*='slug']"], ["slug"], dailySlug);
      setFirstValue(
        ["#seo_title", "input[name='seo_title']", "input[name='meta_title']", "input[wire\\:model*='seoTitle']"],
        ["seo title", "meta title"],
        item.title
      );
      setFirstValue(
        ["#seo_description", "textarea[name='seo_description']", "textarea[name='meta_description']"],
        ["seo description", "meta description"],
        truncateText(stripHtml(descriptionHtml), 240)
      );

      if (!setDescription(descriptionHtml)) throw new Error("Khong tim thay description editor Daily");
      if (!clickSave()) throw new Error("Khong tim thay nut Save Daily");

      return {
        ok: true,
        value: {
          dailyLink: publicDailyLinkFromSlug(dailySlug),
          cleanupImageUrls: getCleanupImageUrls(),
          existingUrls: [...existingUrls]
        }
      };
    }

    const dailyImageUrl = uploadedDescriptionImageUrls.get(item.image) || item.image || "";
    setValue('input[wire\\:model\\.defer="image"], input.image-url', dailyImageUrl);
    if (!setValue("#title", item.title)) throw new Error("Không tìm thấy field title Daily");
    setValue("#slug", "");
    setValue("#seo_title", item.title);
    setValue("#seo_description", "");

    const textarea = document.querySelector("#description-editor");
    if (!textarea) throw new Error("Không tìm thấy description editor Daily");
    textarea.value = descriptionHtml;
    fire(textarea);

    if (window.tinymce?.get("description-editor")) {
      const editor = window.tinymce.get("description-editor");
      editor.setContent(descriptionHtml);
      editor.save();
      editor.fire("change");
      editor.fire("input");
    }
    const iframeBody = document.querySelector("#description-editor_ifr")?.contentDocument?.body;
    if (iframeBody) {
      iframeBody.innerHTML = descriptionHtml;
      iframeBody.dispatchEvent(new Event("input", { bubbles: true }));
      iframeBody.dispatchEvent(new Event("change", { bubbles: true }));
      textarea.value = descriptionHtml;
      fire(textarea);
    }
    if (window.CKEDITOR?.instances?.["description-editor"]) {
      window.CKEDITOR.instances["description-editor"].setData(descriptionHtml);
    }
    const editable = textarea.closest(".col-12")?.querySelector('[contenteditable="true"]') || document.querySelector('[contenteditable="true"]');
    if (editable) {
      editable.innerHTML = descriptionHtml;
      fire(editable);
    }

    const saveButton = [...document.querySelectorAll("button")].find((button) => {
      const text = normalize(button.textContent).toLowerCase();
      return text.includes("save") || button.getAttribute("onclick")?.includes("syncAndSave");
    });
    if (!saveButton) throw new Error("Không tìm thấy nút Save Daily");
    saveButton.click();

    const started = Date.now();
    while (Date.now() - started < 60000) {
      await sleep(700);
      const rows = [...document.querySelectorAll("tbody tr")];
      for (const row of rows) {
        const titleText = normalize(row.querySelector("td:nth-child(2)")?.textContent);
        const copy = row.querySelector("button.copy-btn[data-url]");
        if (copy?.dataset.url && !existingUrls.has(copy.dataset.url) && titleText.includes(normalize(item.title))) {
          return { ok: true, value: { dailyLink: copy.dataset.url, cleanupImageUrls: getCleanupImageUrls() } };
        }
      }

      const anyNewCopy = [...document.querySelectorAll("button.copy-btn[data-url]")].find((button) => !existingUrls.has(button.dataset.url));
      if (anyNewCopy?.dataset.url) {
        return { ok: true, value: { dailyLink: anyNewCopy.dataset.url, cleanupImageUrls: getCleanupImageUrls() } };
      }
    }

    return { ok: false, error: "Không lấy được Daily link sau khi save" };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

function dailyFindPostLinkScript(title, existingUrls) {
  const normalize = (value) => String(value || "").trim().replace(/\s+/g, " ");
  const previousUrls = new Set(Array.isArray(existingUrls) ? existingUrls : []);
  const readCandidateUrl = (element) =>
    element?.dataset?.url
      || element?.dataset?.copy
      || element?.getAttribute?.("data-clipboard-text")
      || element?.getAttribute?.("data-link")
      || element?.getAttribute?.("href")
      || element?.value
      || "";
  const isDailyPublicUrl = (value) => {
    try {
      const url = new URL(value, window.location.origin);
      const host = url.hostname.toLowerCase();
      const path = url.pathname.toLowerCase();
      if (!["http:", "https:"].includes(url.protocol)) return false;
      if (host.includes("s.feji.io")) return false;
      if (path.includes("/backend/") || path.includes("/admin/") || path.includes("/assets/")) return false;
      if (host.includes("dailychronicle")) return path.startsWith("/blog/");
      return host.includes("igallery") || host.includes("blog") || path.split("/").filter(Boolean).length >= 1;
    } catch {
      return false;
    }
  };
  const candidateSelector = [
    "button.copy-btn[data-url]",
    "[data-url]",
    "[data-copy]",
    "[data-clipboard-text]",
    "[data-link]",
    'a[href^="http"]',
    'input[value^="http"]'
  ].join(",");
  const normalizedTitle = normalize(title).toLowerCase();
  const rows = [...document.querySelectorAll("tbody tr, [role='row'], .card, .post-item, .table-row")];

  for (const row of rows) {
    const rowText = normalize(row.textContent).toLowerCase();
    if (normalizedTitle && !rowText.includes(normalizedTitle)) continue;

    const rowLink = [...row.querySelectorAll(candidateSelector)]
      .map(readCandidateUrl)
      .find((url) => isDailyPublicUrl(url) && !previousUrls.has(url));
    if (rowLink) return { ok: true, value: rowLink };
  }

  const anyNewLink = [...document.querySelectorAll(candidateSelector)]
    .map(readCandidateUrl)
    .find((url) => isDailyPublicUrl(url) && !previousUrls.has(url));
  return { ok: true, value: anyNewLink || "" };
}

function fejiFillAndSubmitScript(item, dailyLink, domain) {
  const fire = (element) => {
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  };
  const setValue = (selector, value) => {
    const element = document.querySelector(selector);
    if (!element) throw new Error(`Không tìm thấy ${selector}`);
    element.focus();
    element.value = value || "";
    fire(element);
  };
  const stripHtml = (html) => {
    const div = document.createElement("div");
    div.innerHTML = html || "";
    return div.textContent.trim().replace(/\s+/g, " ");
  };
  const slugify = (value) => {
    const maxLength = 60;
    const suffixLength = 6;
    const suffixChars = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const suffix = Array.from({ length: suffixLength }, () =>
      suffixChars[Math.floor(Math.random() * suffixChars.length)]
    ).join("");
    const baseMaxLength = maxLength - suffixLength - 1;
    const slug = String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .replace(/^vt-+/, "");
    const parts = slug.split("-").filter(Boolean);
    let result = "";

    for (const part of parts) {
      const next = result ? `${result}-${part}` : part;
      if (next.length > baseMaxLength) break;
      result = next;
    }

    return `${result || "link"}-${suffix}`;
  };

  try {
    setValue('input[name="title"]', item.title);
    setValue('input[name="link"]', dailyLink);
    setValue('input[name="shorted_link__slug"]', slugify(item.title));
    setValue('input[name="shorted_link__image"]', item.image || "");
    setValue('input[name="shorted_link__title"]', item.title);
    setValue('input[name="shorted_link__description"]', stripHtml(item.description).slice(0, 240));

    const select = document.querySelector('select[name="domain_share"]');
    if (!select) throw new Error("Không tìm thấy domain_share");
    select.value = domain;
    fire(select);

    const form = document.querySelector('form[action*="/app/links/store"]') || document.querySelector("form");
    if (!form) throw new Error("Không tìm thấy form Feji create");
    form.submit();
    return { ok: true, value: true };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

async function fejiFindShortLinkScript(dailyLink, domain) {
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const sameUrl = (a, b) => {
    try {
      const left = new URL(a);
      const right = new URL(b);
      left.hash = "";
      right.hash = "";
      return left.toString() === right.toString();
    } catch {
      return String(a) === String(b);
    }
  };

  try {
    const started = Date.now();
    while (Date.now() - started < 30000) {
      const cards = [...document.querySelectorAll(".card-body")];
      for (const card of cards) {
        const targetLinks = [...card.querySelectorAll('a[href^="http"]')].filter((a) => !a.href.includes("s.feji.io"));
        const hasTarget = targetLinks.some((a) => sameUrl(a.href, dailyLink));
        if (!hasTarget) continue;

        const copy = card.querySelector(`a.js_copy[data-copy^="https://${domain}/"]`)
          || card.querySelector("a.js_copy[data-copy]");
        if (copy?.dataset.copy) {
          return { ok: true, value: copy.dataset.copy };
        }
      }
      await sleep(500);
    }

    return { ok: false, error: "Không tìm thấy short link Feji theo Daily link vừa tạo" };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}
