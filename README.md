# Jisho Quick Lookup (Edge Extension)

A Browser extension that gives you instant Japanese dictionary previews and one-click Jisho searches for Japanese texts.

## Features

- Floating mini preview when you select text on a page
- Inline definition preview (top dictionary entries) without leaving the page
- Polished popup with branded UI and dictionary result cards
- Auto-prefill popup input from currently selected text
- Right-click context menu: `Search Jisho for "..."`
- Keyboard shortcut: `Ctrl+Shift+J`

## Load in Microsoft Edge

1. Open Edge or Chrome and go to `edge://extensions`.
2. Turn on **Developer mode**.
3. Click **Load unpacked**.
4. Select the project folder:

## How to use

- Select Japanese text on a page to open the floating preview card.
- Use **Open** in the floating card to jump to full Jisho results.
- Select text on a page and right-click to search on Jisho.
- Click the extension icon and use **Preview** to fetch quick definitions in-popup.
- Use **Open Jisho** in popup to open full results in a new tab.
- Use `Ctrl+Shift+J` to search selected text directly.

## Notes

- Script injection is blocked on special pages like `edge://` or browser internal tabs.
- If no text is selected, type manually in the popup input.
- Dictionary preview uses Jisho's public API endpoint: `https://jisho.org/api/v1/search/words`.
