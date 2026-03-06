const queryInput = document.getElementById("query");
const statusText = document.getElementById("status");
const form = document.getElementById("lookup-form");
const resultsContainer = document.getElementById("results");
const openButton = document.getElementById("open-btn");

function setStatus(message) {
  statusText.textContent = message;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getSelectionTextInPage() {
  const selection = window.getSelection();
  return selection ? selection.toString().trim() : "";
}

function renderResults(payload) {
  if (!payload.ok) {
    resultsContainer.innerHTML = "";
    setStatus(payload.error || "Could not get results.");
    return;
  }

  if (!payload.entries.length) {
    resultsContainer.innerHTML = "";
    setStatus("No dictionary matches found.");
    return;
  }

  resultsContainer.innerHTML = payload.entries
    .map((entry) => {
      const term = escapeHtml(entry.word || entry.reading || entry.slug || "(unknown)");
      const readingText = escapeHtml(entry.reading || "");
      const reading = readingText && readingText !== term ? `<span class=\"reading\">${readingText}</span>` : "";
      const meanings = entry.meanings.length ? escapeHtml(entry.meanings.join(", ")) : "No meanings available";
      return `<article class=\"entry\"><p class=\"term\">${term}${reading}</p><p class=\"meaning\">${meanings}</p></article>`;
    })
    .join("");

  setStatus(`Previewing results for \"${payload.query}\".`);
}

async function prefillFromSelection() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab || typeof tab.id !== "number") {
    return;
  }

  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: getSelectionTextInPage
    });

    if (result) {
      queryInput.value = result;
      setStatus("Prefilled from selected text.");
    }
  } catch {
    setStatus("Could not access this page. Type a query manually.");
  }
}

function openJisho(query) {
  const encoded = encodeURIComponent(query.trim());
  if (!encoded) {
    setStatus("Please enter or select text first.");
    return;
  }

  chrome.tabs.create({ url: `https://jisho.org/search/${encoded}` });
  setStatus("Opened Jisho in a new tab.");
}

async function previewQuery(query) {
  const clean = query.trim();
  if (!clean) {
    setStatus("Please enter or select text first.");
    return;
  }

  setStatus("Looking up dictionary entries...");
  try {
    const payload = await chrome.runtime.sendMessage({ type: "lookup-jisho", query: clean });
    if (!payload) {
      setStatus("Background service not responding. Reload the extension.");
      return;
    }
    renderResults(payload);
  } catch (error) {
    console.error("Popup lookup failed", error);
    setStatus("Lookup failed. Reload extension and try again.");
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  void previewQuery(queryInput.value);
});

openButton.addEventListener("click", () => {
  openJisho(queryInput.value);
});

void prefillFromSelection();
queryInput.focus();
