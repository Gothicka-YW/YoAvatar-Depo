// settings.js - simple wrapper around chrome.storage.sync with fallback to localStorage

const SYNC_KEYS = [ 'imgbbKey', 'theme', 'categories' ];

export async function getSettings(){
  return new Promise(resolve => {
    if(!chrome?.storage?.sync){
      const raw = localStorage.getItem('yad:settings');
      resolve(raw ? JSON.parse(raw) : {});
      return;
    }
    chrome.storage.sync.get(null, items => { resolve(items || {}); });
  });
}

export async function setSettings(patch){
  const current = await getSettings();
  const next = { ...current, ...patch };
  if(!chrome?.storage?.sync){
    localStorage.setItem('yad:settings', JSON.stringify(next));
    return next;
  }
  return new Promise(resolve => {
    const allowed = {}; Object.keys(patch).forEach(k=>{ if(SYNC_KEYS.includes(k)) allowed[k] = patch[k]; });
    chrome.storage.sync.set(allowed, () => resolve({ ...next, ...allowed }));
  });
}
