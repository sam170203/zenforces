# Zenforces — Focus on problem solving, not rating

A minimal Chrome extension that removes rating distractions from Codeforces so you can focus on what actually matters: solving problems.

---

## Why

Rating numbers create anxiety. Seeing your rank fluctuate, watching others' colours, obsessing over Elo deltas — none of that makes you a better competitive programmer. Zenforces strips it away so the site feels calm and the problems feel like puzzles again.

> *Fall in love with problem solving, not rating.*

---

## Features

| Feature | What it does |
|---------|-------------|
| **Hide Ratings & Ranks** | Removes all rating numbers, rank labels, and colour badges sitewide |
| **Neutral Username Colors** | Replaces rank-coded username colours with a single neutral colour of your choice |
| **Clean UI** | Hides distracting sidebar widgets (top users, recent actions, etc.) |
| **Themes** | Five polished dark/light themes: Zen Dark, Deep Blue, Soft Light, Warm Minimal, Midnight Pro |
| **Submission Toasts** | Optional toast notifications for verdict results |
| **Master Toggle** | Disable the entire extension with one click and restore the default site |

---

## Installation

Zenforces is not on the Chrome Web Store — install it directly from source in under a minute.

### Steps

1. **Download** — Clone or [download this repository as a ZIP](../../archive/refs/heads/master.zip) and unzip it.

2. **Open Chrome extensions** — Navigate to `chrome://extensions`

3. **Enable Developer Mode** — Toggle the switch in the top-right corner.

4. **Load the extension** — Click **Load unpacked**, then select the unzipped `codeforce-extension` folder.

5. **Done** — The Zenforces icon appears in your toolbar. Pin it for easy access.

> Works on any Chromium-based browser (Chrome, Edge, Brave, Arc).

---

## Usage

Click the toolbar icon to open the popup. Toggle features on or off — changes apply instantly without reloading the page.

- **Extension Enabled** — master on/off switch
- **Hide Ratings & Ranks** — hides all Codeforces rating data
- **Neutral Username Colors** — pick any colour for usernames
- **Theme** — choose a theme from the dropdown
- **Submission Toasts** — enable/disable verdict pop-ups

---

## Screenshots

> *Screenshots coming soon.*

---

## File Structure

```
codeforce-extension/
├── manifest.json          # Chrome MV3 manifest
├── content.js             # Main coordinator (boots modules, handles navigation)
├── styles.css             # All theme CSS variables + rating hider rules
├── modules/
│   ├── utils.js           # Shared utilities (ZF namespace, debounce, style injection)
│   ├── selectors.js       # CSS selector constants
│   ├── ratingHider.js     # Hides rating elements via CSS + DOM text scan
│   ├── colorNeutralizer.js# Neutralizes username colours
│   ├── cleanUI.js         # Removes sidebar clutter
│   └── submissionFeedback.js # Submission verdict toasts
├── popup/
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
└── icons/
    ├── icon16.png
    ├── icon32.png
    ├── icon48.png
    └── icon128.png
```

---

## Philosophy

Competitive programming is a craft. The goal is to get better at thinking — not to watch a number go up. Rating is a lagging indicator; problem-solving ability is the real thing.

Zenforces is built on one idea: **the site should feel like a library, not a leaderboard.** Hide the noise, sit with the problem, and let the solve be its own reward.

---

## License

MIT
