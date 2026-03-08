let activeQuery = "";
let inlinePreviewEnabled = true;
const INLINE_PREVIEW_KEY = "inlinePreviewEnabled";

const mini = document.createElement("section");
mini.id = "jisho-mini";
mini.innerHTML = `
  <div class="mini-head">
    <span class="mini-title">Jisho Preview</span>
    <div>
      <button class="open-btn" type="button">Open</button>
      <button class="close-btn" type="button" aria-label="Close preview">x</button>
    </div>
  </div>
  <div class="mini-content">
    <p class="mini-status">Select Japanese text to preview.</p>
  </div>
`;

document.documentElement.appendChild(mini);

const openButton = mini.querySelector(".open-btn");
const closeButton = mini.querySelector(".close-btn");
const contentArea = mini.querySelector(".mini-content");

function hideMini() {
  mini.style.display = "none";
}

function hasRuntimeContext() {
  try {
    return Boolean(chrome?.runtime?.id);
  } catch {
    return false;
  }
}

function loadInlinePreviewState() {
  chrome.storage.local.get({ [INLINE_PREVIEW_KEY]: true }, (stored) => {
    inlinePreviewEnabled = Boolean(stored[INLINE_PREVIEW_KEY]);
    if (!inlinePreviewEnabled) {
      hideMini();
    }
  });
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local" || !(INLINE_PREVIEW_KEY in changes)) {
    return;
  }

  inlinePreviewEnabled = Boolean(changes[INLINE_PREVIEW_KEY].newValue);
  if (!inlinePreviewEnabled) {
    hideMini();
  }
});

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getSelectedText() {
  const selection = window.getSelection();
  return selection ? selection.toString().trim() : "";
}

function openJishoTab(query) {
  if (!query) {
    return;
  }
  window.open(`https://jisho.org/search/${encodeURIComponent(query)}`, "_blank", "noopener,noreferrer");
}

function placeMini(x, y) {
  const left = Math.min(x + 12, window.scrollX + window.innerWidth - 340);
  const top = Math.min(y + 16, window.scrollY + window.innerHeight - 220);
  mini.style.left = `${Math.max(window.scrollX + 8, left)}px`;
  mini.style.top = `${Math.max(window.scrollY + 8, top)}px`;
}

function renderEntries(payload) {
  if (!payload.ok) {
    contentArea.innerHTML = `<p class="mini-status">${payload.error || "Could not fetch results."}</p>`;
    return;
  }

  if (!payload.entries.length) {
    contentArea.innerHTML = "<p class=\"mini-status\">No dictionary matches found.</p>";
    return;
  }

  contentArea.innerHTML = payload.entries
    .map((entry) => {
      const term = escapeHtml(entry.word || entry.reading || entry.slug || "(unknown)");
      const readingText = escapeHtml(entry.reading || "");
      const reading = readingText && readingText !== term ? `<span class=\"reading\">${readingText}</span>` : "";
      const meanings = entry.meanings.length ? escapeHtml(entry.meanings.join(", ")) : "No meanings available";
      return `<article class=\"mini-entry\"><p class=\"word\">${term}${reading}</p><p class=\"meaning\">${meanings}</p></article>`;
    })
    .join("");
}

async function fetchEntriesDirect(query) {
  const endpoint = `https://jisho.org/api/v1/search/words?keyword=${encodeURIComponent(query)}`;
  const response = await fetch(endpoint);
  if (!response.ok) {
    throw new Error(`Direct Jisho request failed with status ${response.status}`);
  }

  const payload = await response.json();
  const entries = Array.isArray(payload?.data) ? payload.data.slice(0, 3) : [];
  const compact = entries.map((entry) => {
    const japanese = Array.isArray(entry.japanese) && entry.japanese.length > 0 ? entry.japanese[0] : {};
    const senses = Array.isArray(entry.senses) && entry.senses.length > 0 ? entry.senses[0] : {};

    return {
      slug: entry.slug || "",
      word: japanese.word || "",
      reading: japanese.reading || "",
      meanings: Array.isArray(senses.english_definitions) ? senses.english_definitions.slice(0, 3) : []
    };
  });

  return { ok: true, query, entries: compact };
}

async function showForSelection() {
  const selected = getSelectedText();
  if (!selected) {
    hideMini();
    return;
  }

  activeQuery = selected;
  const selection = window.getSelection();
  const range = selection && selection.rangeCount ? selection.getRangeAt(0) : null;
  const rect = range ? range.getBoundingClientRect() : null;
  placeMini((rect ? rect.right : 16) + window.scrollX, (rect ? rect.bottom : 16) + window.scrollY);
  contentArea.innerHTML = "<p class=\"mini-status\">Loading dictionary preview...</p>";
  mini.style.display = "block";

  if (!hasRuntimeContext()) {
    contentArea.innerHTML = "<p class=\"mini-status\">Extension updated. Refresh this page.</p>";
    return;
  }

  try {
    const payload = await chrome.runtime.sendMessage({ type: "lookup-jisho", query: selected });
    if (!payload) {
      const fallback = await fetchEntriesDirect(selected);
      renderEntries(fallback);
      return;
    }
    renderEntries(payload);
  } catch (error) {
    const message = String(error?.message || "");
    if (message.includes("Extension context invalidated")) {
      contentArea.innerHTML = "<p class=\"mini-status\">Extension updated. Refresh this page.</p>";
      return;
    }

    if (message.includes("Could not establish connection") || message.includes("Receiving end does not exist")) {
      try {
        const fallback = await fetchEntriesDirect(selected);
        renderEntries(fallback);
        return;
      } catch {
        contentArea.innerHTML = "<p class=\"mini-status\">Lookup failed. Reload extension.</p>";
        return;
      }
    }

    console.error("Inline lookup failed", error);
    contentArea.innerHTML = "<p class=\"mini-status\">Lookup failed. Reload extension.</p>";
  }
}

openButton.addEventListener("click", () => openJishoTab(activeQuery));
closeButton.addEventListener("click", hideMini);

document.addEventListener("mouseup", () => {
  if (!inlinePreviewEnabled) {
    hideMini();
    return;
  }
  void showForSelection();
});

document.addEventListener("mousedown", (event) => {
  if (!mini.contains(event.target)) {
    hideMini();
  }
});

loadInlinePreviewState();
