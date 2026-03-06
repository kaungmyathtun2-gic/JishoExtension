const MENU_ID = "jisho-search-selection";
const JISHO_API_URL = "https://jisho.org/api/v1/search/words?keyword=";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_ID,
      title: "Search Jisho for \"%s\"",
      contexts: ["selection"]
    });
  });
});

chrome.contextMenus.onClicked.addListener(async (info) => {
  if (info.menuItemId !== MENU_ID || !info.selectionText) {
    return;
  }

  const query = encodeURIComponent(info.selectionText.trim());
  if (!query) {
    return;
  }

  chrome.tabs.create({
    url: `https://jisho.org/search/${query}`
  });
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "open-jisho-from-selection") {
    return;
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || typeof tab.id !== "number") {
    return;
  }

  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => window.getSelection()?.toString().trim() || ""
    });

    if (!result) {
      return;
    }

    const query = encodeURIComponent(result);
    chrome.tabs.create({ url: `https://jisho.org/search/${query}` });
  } catch (error) {
    // Some pages (for example edge:// pages) block injected scripts.
    console.error("Could not read selection for Jisho lookup", error);
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || message.type !== "lookup-jisho") {
    return false;
  }

  const query = String(message.query || "").trim();
  if (!query) {
    sendResponse({ ok: false, error: "Empty query." });
    return false;
  }

  void fetch(`${JISHO_API_URL}${encodeURIComponent(query)}`)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Jisho API request failed with status ${response.status}`);
      }
      return response.json();
    })
    .then((payload) => {
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

      sendResponse({ ok: true, query, entries: compact });
    })
    .catch((error) => {
      console.error("Jisho lookup failed", error);
      sendResponse({ ok: false, error: "Could not fetch dictionary results." });
    });

  return true;
});
