// background.js - YoAvatar Depo
// Handles maintenance tasks (future: context menus, alarms). For now just a ping listener.

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === 'PING') {
    sendResponse({ ok: true, ts: Date.now(), version: chrome.runtime.getManifest().version });
    return true;
  }
  if (msg?.type === 'DELETE_REMOTE') {
    // Placeholder: remote delete via stored delete_url if needed later.
    sendResponse({ ok: false, reason: 'Not implemented yet' });
    return true;
  }
});
