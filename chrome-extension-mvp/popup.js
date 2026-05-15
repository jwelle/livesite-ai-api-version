const STORAGE_KEYS = [
  "apiBaseUrl",
  "apiKey",
  "defaultChatWidgetId",
  "locationId",
  "lastSelectedSourceType",
  "lastSelectedOfferType",
];

const ENDPOINT_PATH = "/api/v1/demo-requests";
const DEFAULT_API_BASE_URL = "https://livesite-ai-api-code.vercel.app";

const elements = {
  form: document.getElementById("demo-form"),
  businessName: document.getElementById("business-name"),
  sourceUrl: document.getElementById("current-page-url"),
  websiteUrl: document.getElementById("website-url"),
  sourceType: document.getElementById("source-type"),
  offerType: document.getElementById("offer-type"),
  defaultChatWidgetId: document.getElementById("default-chat-widget-id"),
  locationId: document.getElementById("location-id"),
  apiBaseUrl: document.getElementById("api-base-url"),
  apiKey: document.getElementById("api-key"),
  saveSettings: document.getElementById("save-settings"),
  createDemo: document.getElementById("create-demo"),
  status: document.getElementById("status"),
  results: document.getElementById("results"),
  demoUrl: document.getElementById("demo-url"),
  outreachMessage: document.getElementById("outreach-message"),
  copyDemoUrl: document.getElementById("copy-demo-url"),
  copyOutreachMessage: document.getElementById("copy-outreach-message"),
  openDemo: document.getElementById("open-demo"),
};

document.addEventListener("DOMContentLoaded", initializePopup);
elements.form.addEventListener("submit", handleCreateDemo);
elements.saveSettings.addEventListener("click", handleSaveSettings);
elements.copyDemoUrl.addEventListener("click", () => copyText(elements.demoUrl.value, "Demo URL copied."));
elements.copyOutreachMessage.addEventListener("click", () => copyText(elements.outreachMessage.value, "Outreach message copied."));
elements.openDemo.addEventListener("click", handleOpenDemo);

async function initializePopup() {
  await loadSettings();
  await populateActiveTab();
}

function getStorage(keys) {
  return new Promise((resolve) => {
    chrome.storage.local.get(keys, resolve);
  });
}

function setStorage(values) {
  return new Promise((resolve) => {
    chrome.storage.local.set(values, resolve);
  });
}

async function loadSettings() {
  const saved = await getStorage(STORAGE_KEYS);
  elements.apiBaseUrl.value = saved.apiBaseUrl || DEFAULT_API_BASE_URL;
  elements.apiKey.value = saved.apiKey || "";
  elements.defaultChatWidgetId.value = saved.defaultChatWidgetId || "";
  elements.locationId.value = saved.locationId || "";
  elements.sourceType.value = saved.lastSelectedSourceType || "website";
  elements.offerType.value = saved.lastSelectedOfferType || "speed_to_lead_demo";
}

async function populateActiveTab() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const activeTab = tabs && tabs[0];
    if (!activeTab) return;

    if (!elements.sourceUrl.value && activeTab.url) {
      elements.sourceUrl.value = activeTab.url;
    }

    if (!elements.businessName.value && activeTab.title) {
      elements.businessName.value = cleanBusinessName(activeTab.title);
    }

    if (!elements.websiteUrl.value && activeTab.url && looksLikeBusinessWebsite(activeTab.url)) {
      elements.websiteUrl.value = activeTab.url;
    }
  } catch (error) {
    console.error("Unable to read active tab.", error);
    showStatus("Unable to read the current tab. You can paste the page URL manually.", "error");
  }
}

function cleanBusinessName(title) {
  return title
    .replace(/\s+[-|]\s+(Facebook|LinkedIn|Yelp|Google|Instagram).*$/i, "")
    .replace(/\s+[-|]\s+.*$/i, "")
    .trim()
    .slice(0, 120);
}

function looksLikeBusinessWebsite(url) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return ![
      "facebook.com",
      "www.facebook.com",
      "linkedin.com",
      "www.linkedin.com",
      "google.com",
      "www.google.com",
      "yelp.com",
      "www.yelp.com",
    ].includes(host);
  } catch {
    return false;
  }
}

async function handleSaveSettings() {
  await saveSettings();
  showStatus("Settings saved.", "success");
}

async function saveSettings() {
  const normalizedApiKey = normalizeApiKey(elements.apiKey.value);
  elements.apiKey.value = normalizedApiKey;

  await setStorage({
    apiBaseUrl: elements.apiBaseUrl.value.trim() || DEFAULT_API_BASE_URL,
    apiKey: normalizedApiKey,
    defaultChatWidgetId: elements.defaultChatWidgetId.value.trim(),
    locationId: elements.locationId.value.trim(),
    lastSelectedSourceType: elements.sourceType.value,
    lastSelectedOfferType: elements.offerType.value,
  });
}

async function handleCreateDemo(event) {
  event.preventDefault();
  hideResults();

  const formData = readFormData();
  const validationError = validateFormData(formData);
  if (validationError) {
    showStatus(validationError, "error");
    return;
  }

  await saveSettings();
  setLoading(true);
  showStatus("Creating demo...", "info");

  try {
    const responseJson = await createDemoRequest(formData);
    const normalized = normalizeApiResponse(responseJson, formData.businessName);

    if (!normalized.demoUrl) {
      console.error("LiveSite API response did not include a demo URL.", responseJson);
      showStatus("The API responded, but no demo URL was returned.", "error");
      return;
    }

    elements.demoUrl.value = normalized.demoUrl;
    elements.outreachMessage.value = normalized.outreachMessage;
    elements.results.hidden = false;
    showStatus("Demo created.", "success");
  } catch (error) {
    console.error("Create demo failed.", sanitizeErrorForLog(error));
    showStatus(getFriendlyError(error), "error");
  } finally {
    setLoading(false);
  }
}

function readFormData() {
  return {
    businessName: elements.businessName.value.trim(),
    sourceUrl: elements.sourceUrl.value.trim(),
    websiteUrl: elements.websiteUrl.value.trim(),
    sourceType: elements.sourceType.value,
    offerType: elements.offerType.value,
    defaultChatWidgetId: elements.defaultChatWidgetId.value.trim(),
    locationId: elements.locationId.value.trim(),
    apiBaseUrl: elements.apiBaseUrl.value.trim() || DEFAULT_API_BASE_URL,
    apiKey: normalizeApiKey(elements.apiKey.value),
  };
}

function validateFormData(data) {
  if (!data.businessName) return "Enter a business name before creating a demo.";
  if (!data.sourceUrl) return "Enter the current page URL before creating a demo.";
  if (!isValidHttpUrl(data.sourceUrl)) return "Current Page URL must be a valid http or https URL.";
  if (data.websiteUrl && !isValidHttpUrl(data.websiteUrl)) return "Website URL must be a valid http or https URL.";
  if (!data.apiBaseUrl) return "Enter your LiveSite API Base URL.";
  if (!isValidHttpUrl(data.apiBaseUrl)) return "API Base URL must be a valid http or https URL.";
  const apiEndpointError = getApiEndpointError(data.apiBaseUrl);
  if (apiEndpointError) return apiEndpointError;
  if (!data.apiKey) return "Enter your LiveSite API key.";
  if (isMaskedApiKey(data.apiKey)) return "Paste the raw lsi_ API key, not the masked key shown later in the app.";
  if (!data.locationId) return "Enter your GHL Location ID. The current LiveSite demo request API requires it.";
  return "";
}

function normalizeApiKey(value) {
  return value.trim().replace(/^Bearer\s+/i, "").trim();
}

function isMaskedApiKey(value) {
  return /^lsi_[A-Za-z0-9_-]*\.{3}[A-Za-z0-9_-]+$/.test(value);
}

function isValidHttpUrl(value) {
  try {
    const url = new URL(normalizeUrl(value));
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function normalizeUrl(value) {
  if (!/^https?:\/\//i.test(value)) {
    return `https://${value}`;
  }
  return value;
}

function getApiEndpointError(apiBaseUrl) {
  try {
    const url = new URL(normalizeUrl(apiBaseUrl));
    if (url.hostname.toLowerCase() === "livesite-ai.vercel.app") {
      return "Use the LiveSite API host, not the frontend app host. Try https://livesite-ai-api-code.vercel.app";
    }
    if (url.pathname !== "/" && !url.pathname.replace(/\/+$/, "").endsWith(ENDPOINT_PATH)) {
      return "API Base URL should be the API host or the full /api/v1/demo-requests endpoint.";
    }
  } catch {
    return "API Base URL must be a valid http or https URL.";
  }
  return "";
}

function getEndpointUrl(apiBaseUrl) {
  const url = new URL(normalizeUrl(apiBaseUrl));
  const path = url.pathname.replace(/\/+$/, "");
  if (path.endsWith(ENDPOINT_PATH)) {
    url.pathname = path;
    url.search = "";
    url.hash = "";
    return url.toString();
  }
  url.pathname = `${path}${ENDPOINT_PATH}`;
  url.search = "";
  url.hash = "";
  return url.toString();
}

async function createDemoRequest(data) {
  const effectiveWebsiteUrl = data.websiteUrl || data.sourceUrl;
  const snakePayload = {
    source_url: data.sourceUrl,
    website_url: effectiveWebsiteUrl,
    business_name: data.businessName,
    source_type: data.sourceType,
    offer_type: data.offerType,
    created_from: "chrome_extension",
  };

  if (data.defaultChatWidgetId) {
    snakePayload.chat_widget_id = data.defaultChatWidgetId;
  }

  const payload = {
    companyName: data.businessName,
    prospectName: data.businessName,
    websiteUrl: effectiveWebsiteUrl,
    locationId: data.locationId,
    source: "chrome_extension",
    notes: buildNotes(data),
    options: {
      enrich: false,
    },
    rawPayload: snakePayload,
    ...snakePayload,
  };

  const response = await fetch(getEndpointUrl(data.apiBaseUrl), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": data.apiKey,
    },
    body: JSON.stringify(payload),
  });

  let responseJson = null;
  try {
    responseJson = await response.json();
  } catch {
    responseJson = null;
  }

  if (!response.ok) {
    const error = new Error(responseJson?.message || responseJson?.error || "API request failed.");
    error.status = response.status;
    error.response = responseJson;
    throw error;
  }

  if (!responseJson || typeof responseJson !== "object") {
    throw new Error("Malformed API response.");
  }

  return responseJson;
}

function buildNotes(data) {
  return [
    `Source page: ${data.sourceUrl}`,
    `Source type: ${data.sourceType}`,
    `Offer type: ${data.offerType}`,
    data.defaultChatWidgetId ? `Requested chat widget ID: ${data.defaultChatWidgetId}` : "",
  ].filter(Boolean).join("\n");
}

function normalizeApiResponse(response, businessName) {
  const demoUrl = normalizeDemoGateUrl(response.demo_url
    || response.demoUrl
    || response.publicUrl
    || response.url
    || response.demo?.publicUrl
    || "");

  const outreachMessage = response.outreach_message
    || response.outreachMessage
    || response.message
    || buildFallbackOutreachMessage(businessName, demoUrl);

  return {
    demoUrl,
    outreachMessage,
  };
}

function normalizeDemoGateUrl(value) {
  if (!value || typeof value !== "string") return "";
  try {
    const url = new URL(value);
    url.pathname = url.pathname.replace(/(\/demo\/[^/]+)\/live\/?$/i, "$1");
    return url.toString();
  } catch {
    return value.replace(/(\/demo\/[^/]+)\/live\/?$/i, "$1");
  }
}

function buildFallbackOutreachMessage(businessName, demoUrl) {
  const intro = businessName
    ? `Hey, I came across ${businessName} and made a quick AI demo showing how you could respond faster to new leads and website visitors.`
    : "Hey, I came across your business and made a quick AI demo showing how you could respond faster to new leads and website visitors.";
  return `${intro}\n\nHere's the demo: ${demoUrl}`;
}

function getFriendlyError(error) {
  if (error.status === 401) return "Unauthorized. Confirm you are using the raw lsi_ API key and that the extension is sending it with the expected x-api-key header.";
  if (error.status === 403) return "The API rejected this request. Check account access and permissions.";
  if (error.status === 404) return error.message || "The API endpoint or GHL Location ID was not found.";
  if (error.status >= 500) return "The LiveSite API had a server error. Try again in a moment.";
  if (error.message === "Failed to fetch") return "Network error. Check your API Base URL and extension host permissions.";
  return error.message || "The demo request failed.";
}

function sanitizeErrorForLog(error) {
  return {
    name: error?.name,
    message: error?.message,
    status: error?.status,
    response: error?.response,
  };
}

function showStatus(message, type) {
  elements.status.textContent = message;
  elements.status.className = `status ${type}`;
  elements.status.hidden = false;
}

function hideResults() {
  elements.results.hidden = true;
  elements.demoUrl.value = "";
  elements.outreachMessage.value = "";
}

function setLoading(isLoading) {
  elements.createDemo.disabled = isLoading;
  elements.saveSettings.disabled = isLoading;
  elements.createDemo.textContent = isLoading ? "Creating..." : "Create Demo";
}

async function copyText(value, successMessage) {
  if (!value) return;
  try {
    await navigator.clipboard.writeText(value);
    showStatus(successMessage, "success");
  } catch (error) {
    console.error("Clipboard write failed.", error);
    showStatus("Unable to copy. Select the field text and copy manually.", "error");
  }
}

function handleOpenDemo() {
  const url = elements.demoUrl.value.trim();
  if (!url) return;
  chrome.tabs.create({ url });
}
