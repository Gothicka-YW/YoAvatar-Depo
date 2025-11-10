# YoAvatar Depo (Early Prototype)

Upload, categorize, and share YoWorld avatar images. Generates forum-ready BBCode links.

## Features (MVP)
- Drag/drop/paste image upload to ImgBB (API key required).
- Category management (local, sync categories list).
- Library grid with filtering and preview.
- Replace and delete (local record delete; remote delete placeholder).
- Forum link generation + Copy to clipboard + toast.
- Theme selection (default, dark, violet, emerald).
- Data export/import (JSON).

## Planned / Future
- Remote delete using stored delete token.
- Folder hierarchy / nesting.
- Pagination or virtual scrolling for large libraries.
- Firefox (Manifest V3 parity adjustments).
- Multi-image selection + batch operations.

## Install (Chrome / Edge Dev Mode)
1. Clone repo.
2. Visit chrome://extensions (or edge://extensions).
3. Enable Developer Mode.
4. Load Unpacked → select the `YoAvatar-Depo` folder.
5. Open the extension: set ImgBB API key under Settings.

## ImgBB Key
Create an account and obtain an API key. Save it in Settings. Key is stored in chrome.storage.sync when available.

## Data Storage
- Avatar metadata stored in localStorage (id, category, URLs, timestamps, forum link).
- Categories list stored in sync storage (if available). Export regularly if valuable.

## Development Notes
- Plain JS/HTML/CSS, no build step.
- Background service worker currently only responds to PING.
- `store.js` is intentionally simple; migrate to IndexedDB if scale grows.

## License
MIT (adjust as needed).
