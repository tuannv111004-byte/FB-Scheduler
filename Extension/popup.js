const jsonInput = document.getElementById("jsonInput");
const imagePlacement = document.getElementById("imagePlacement");
const statusBadge = document.getElementById("statusBadge");
const progress = document.getElementById("progress");
const results = document.getElementById("results");
const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const copyJsonBtn = document.getElementById("copyJsonBtn");
const copyCsvBtn = document.getElementById("copyCsvBtn");
const clearBtn = document.getElementById("clearBtn");
const schedulerEnabled = document.getElementById("schedulerEnabled");
const schedulerUrl = document.getElementById("schedulerUrl");
const schedulerToken = document.getElementById("schedulerToken");
const schedulerPageId = document.getElementById("schedulerPageId");
const schedulerStatus = document.getElementById("schedulerStatus");
const schedulerStartDate = document.getElementById("schedulerStartDate");
const schedulerStartTimeSlot = document.getElementById("schedulerStartTimeSlot");
const loadSchedulerBtn = document.getElementById("loadSchedulerBtn");
const schedulerMetaStatus = document.getElementById("schedulerMetaStatus");
const facebookPublisherEnabled = document.getElementById("facebookPublisherEnabled");
const facebookAutoOpen = document.getElementById("facebookAutoOpen");
const facebookCheckBtn = document.getElementById("facebookCheckBtn");
const facebookPrepareBtn = document.getElementById("facebookPrepareBtn");
const facebookMarkPostedBtn = document.getElementById("facebookMarkPostedBtn");
const facebookPublisherStatus = document.getElementById("facebookPublisherStatus");
const facebookDuePosts = document.getElementById("facebookDuePosts");

const stateKey = "dailyFejiState";
const schedulerConfigKey = "dailyFejiSchedulerConfig";
const facebookPublisherConfigKey = "facebookPublisherConfig";
const facebookPublisherStateKey = "facebookPublisherState";
let schedulerPages = [];

function normalizeItems(raw) {
  const parsed = JSON.parse(raw);
  const items = Array.isArray(parsed) ? parsed : [parsed];
  return items.map((item, index) => {
    if (!item || typeof item !== "object") {
      throw new Error(`Item ${index + 1} khong phai object`);
    }
    if (!item.title || !item.description) {
      throw new Error(`Item ${index + 1} thieu title hoac description`);
    }
    return {
      title: String(item.title),
      description: String(item.description),
      image: item.image ? String(item.image) : "",
      descriptionImage: item.descriptionImage ? String(item.descriptionImage) : "",
      schedulerPostId: item.schedulerPostId ? String(item.schedulerPostId) : "",
      caption: item.caption ? String(item.caption) : ""
    };
  });
}

function toCsv(rows) {
  const headers = ["title", "dailyLink", "shortLink", "domain", "image", "status", "error"];
  const escape = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  return [headers.join(","), ...rows.map((row) => headers.map((key) => escape(row[key])).join(","))].join("\n");
}

function renderState(state) {
  const running = state?.status === "running";
  statusBadge.textContent = state?.status || "Idle";
  startBtn.disabled = running;
  stopBtn.disabled = !running;
  progress.textContent = state?.message || "";
  results.value = JSON.stringify(state?.results || [], null, 2);
}

async function loadState() {
  const data = await chrome.storage.local.get([
    stateKey,
    schedulerConfigKey,
    facebookPublisherConfigKey,
    facebookPublisherStateKey
  ]);
  renderState(data[stateKey] || { status: "idle", results: [] });
  renderSchedulerConfig(data[schedulerConfigKey] || {});
  renderFacebookPublisherConfig(data[facebookPublisherConfigKey] || {});
  renderFacebookPublisherState(data[facebookPublisherStateKey] || {});
}

function todayValue() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function setOptions(select, options, placeholder) {
  select.innerHTML = "";
  const placeholderOption = document.createElement("option");
  placeholderOption.value = "";
  placeholderOption.textContent = placeholder;
  select.appendChild(placeholderOption);

  options.forEach((option) => {
    const element = document.createElement("option");
    element.value = option.value;
    element.textContent = option.label;
    select.appendChild(element);
  });
}

function getSelectedSchedulerPage() {
  return schedulerPages.find((page) => page.id === schedulerPageId.value);
}

function renderSchedulerPages(selectedPageId) {
  setOptions(
    schedulerPageId,
    schedulerPages.map((page) => ({
      value: page.id,
      label: page.name ? `${page.name} (${page.id.slice(0, 8)})` : page.id
    })),
    schedulerPages.length ? "Select page" : "Load pages first"
  );

  if (selectedPageId && !schedulerPages.some((page) => page.id === selectedPageId)) {
    const manualOption = document.createElement("option");
    manualOption.value = selectedPageId;
    manualOption.textContent = `Saved page: ${selectedPageId}`;
    schedulerPageId.appendChild(manualOption);
  }

  schedulerPageId.value = selectedPageId || "";
}

function renderSchedulerTimeSlots(selectedTimeSlot) {
  const page = getSelectedSchedulerPage();
  const timeSlots = Array.isArray(page?.timeSlots) ? page.timeSlots : [];

  setOptions(
    schedulerStartTimeSlot,
    timeSlots.map((slot) => ({ value: slot, label: slot })),
    timeSlots.length ? "Select start slot" : "Select page first"
  );

  if (selectedTimeSlot && !timeSlots.includes(selectedTimeSlot)) {
    const manualOption = document.createElement("option");
    manualOption.value = selectedTimeSlot;
    manualOption.textContent = `Saved slot: ${selectedTimeSlot}`;
    schedulerStartTimeSlot.appendChild(manualOption);
  }

  schedulerStartTimeSlot.value = selectedTimeSlot || timeSlots[0] || "";
}

function renderSchedulerConfig(config) {
  schedulerPages = Array.isArray(config.pages) ? config.pages : [];
  schedulerEnabled.checked = config.enabled === true;
  schedulerUrl.value = config.schedulerUrl || "";
  schedulerToken.value = config.token || "";
  renderSchedulerPages(config.pageId || "");
  schedulerStatus.value = config.status || "draft";
  schedulerStartDate.value = config.startDate || todayValue();
  renderSchedulerTimeSlots(config.startTimeSlot || "");
}

function readSchedulerConfig() {
  return {
    enabled: schedulerEnabled.checked,
    schedulerUrl: schedulerUrl.value.trim().replace(/\/+$/, ""),
    token: schedulerToken.value.trim(),
    pageId: schedulerPageId.value.trim(),
    status: schedulerStatus.value,
    startDate: schedulerStartDate.value,
    startTimeSlot: schedulerStartTimeSlot.value,
    pages: schedulerPages
  };
}

async function saveSchedulerConfig() {
  await chrome.storage.local.set({ [schedulerConfigKey]: readSchedulerConfig() });
}

function renderFacebookPublisherConfig(config) {
  facebookPublisherEnabled.checked = config.enabled === true;
  facebookAutoOpen.checked = config.autoOpen === true;
}

function readFacebookPublisherConfig() {
  return {
    enabled: facebookPublisherEnabled.checked,
    autoOpen: facebookAutoOpen.checked
  };
}

async function saveFacebookPublisherConfig() {
  const config = readFacebookPublisherConfig();
  await chrome.storage.local.set({ [facebookPublisherConfigKey]: config });
  await chrome.runtime.sendMessage({ type: "FACEBOOK_PUBLISHER_CONFIG_CHANGED", payload: config });
}

function renderFacebookPublisherState(state) {
  const posts = Array.isArray(state.posts) ? state.posts : [];
  facebookPublisherStatus.textContent = state.message || "";
  facebookDuePosts.value = posts.length
    ? posts
        .map((post, index) => {
          const media = post.mediaUrl ? `\nmedia: ${post.mediaUrl}` : "";
          return `${index + 1}. ${post.pageName} | ${post.postDate} ${post.timeSlot} | ${post.status}\n${post.caption}${media}`;
        })
        .join("\n\n")
    : "";
}

async function loadSchedulerMetadata() {
  const schedulerUrlValue = schedulerUrl.value.trim().replace(/\/+$/, "");
  const tokenValue = schedulerToken.value.trim();

  if (!schedulerUrlValue) {
    schedulerMetaStatus.textContent = "Missing URL";
    return;
  }
  if (!tokenValue) {
    schedulerMetaStatus.textContent = "Missing token";
    return;
  }

  loadSchedulerBtn.disabled = true;
  schedulerMetaStatus.textContent = "Loading...";

  try {
    const response = await fetch(`${schedulerUrlValue}/api/extension/daily-results`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${tokenValue}`
      }
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

    schedulerPages = Array.isArray(result?.pages) ? result.pages : [];
    const previousPageId = schedulerPageId.value;
    const previousTimeSlot = schedulerStartTimeSlot.value;
    const nextPageId = schedulerPages.some((page) => page.id === previousPageId)
      ? previousPageId
      : schedulerPages[0]?.id || "";

    renderSchedulerPages(nextPageId);
    renderSchedulerTimeSlots(previousTimeSlot);
    schedulerEnabled.checked = true;
    await saveSchedulerConfig();
    schedulerMetaStatus.textContent = `${schedulerPages.length} pages loaded`;
  } catch (error) {
    schedulerMetaStatus.textContent = error.message;
  } finally {
    loadSchedulerBtn.disabled = false;
  }
}

startBtn.addEventListener("click", async () => {
  try {
    const items = normalizeItems(jsonInput.value);
    const schedulerConfig = readSchedulerConfig();
    await saveSchedulerConfig();
    await chrome.runtime.sendMessage({
      type: "START_BATCH",
      payload: {
        items,
        options: {
          imagePlacement: imagePlacement.value
        },
        scheduler: schedulerConfig
      }
    });
  } catch (error) {
    progress.textContent = error.message;
  }
});

stopBtn.addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "STOP_BATCH" });
});

loadSchedulerBtn.addEventListener("click", loadSchedulerMetadata);

schedulerPageId.addEventListener("change", async () => {
  renderSchedulerTimeSlots("");
  await saveSchedulerConfig();
});

copyJsonBtn.addEventListener("click", async () => {
  await navigator.clipboard.writeText(results.value || "[]");
});

copyCsvBtn.addEventListener("click", async () => {
  const state = (await chrome.storage.local.get(stateKey))[stateKey] || {};
  await navigator.clipboard.writeText(toCsv(state.results || []));
});

clearBtn.addEventListener("click", async () => {
  await chrome.storage.local.set({ [stateKey]: { status: "idle", message: "", results: [] } });
  await loadState();
});

facebookCheckBtn.addEventListener("click", async () => {
  facebookPublisherStatus.textContent = "Checking...";
  await saveSchedulerConfig();
  await saveFacebookPublisherConfig();
  const response = await chrome.runtime.sendMessage({ type: "FACEBOOK_CHECK_DUE_NOW" });
  if (!response?.ok) facebookPublisherStatus.textContent = response?.error || "Check failed";
});

facebookPrepareBtn.addEventListener("click", async () => {
  const response = await chrome.runtime.sendMessage({ type: "FACEBOOK_PREPARE_FIRST_DUE" });
  if (!response?.ok) facebookPublisherStatus.textContent = response?.error || "Prepare failed";
});

facebookMarkPostedBtn.addEventListener("click", async () => {
  const response = await chrome.runtime.sendMessage({ type: "FACEBOOK_MARK_FIRST_POSTED" });
  if (!response?.ok) facebookPublisherStatus.textContent = response?.error || "Mark posted failed";
});

[
  schedulerEnabled,
  schedulerUrl,
  schedulerToken,
  schedulerPageId,
  schedulerStatus,
  schedulerStartDate,
  schedulerStartTimeSlot
].forEach((element) => {
  element.addEventListener("change", saveSchedulerConfig);
  element.addEventListener("input", saveSchedulerConfig);
});

[facebookPublisherEnabled, facebookAutoOpen].forEach((element) => {
  element.addEventListener("change", saveFacebookPublisherConfig);
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes[stateKey]) {
    renderState(changes[stateKey].newValue);
  }
  if (area === "local" && changes[facebookPublisherStateKey]) {
    renderFacebookPublisherState(changes[facebookPublisherStateKey].newValue || {});
  }
});

loadState().then(async () => {
  const config = readSchedulerConfig();
  if (config.enabled && config.schedulerUrl && config.token && schedulerPages.length === 0) {
    await loadSchedulerMetadata();
  }
});
