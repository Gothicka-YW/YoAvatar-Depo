// settings.js - wrapper around chrome.storage.sync for non-sensitive settings.
// imgbbKey is stored ONLY locally (never synced) so the developer's key is not distributed.

const SYNC_KEYS = [ 'theme', 'categories' ]; // removed imgbbKey
const LOCAL_SETTINGS_KEY = 'yad:settings'; // fallback for when sync API unavailable
const LOCAL_API_KEY = 'yad:local:imgbbKey';

async function migrateSyncApiKey(items){
  // If an older version stored imgbbKey in sync, migrate it to local then remove from sync.
  if(items && items.imgbbKey){
    try { localStorage.setItem(LOCAL_API_KEY, items.imgbbKey); } catch(e){}
    try { chrome.storage.sync.remove('imgbbKey', ()=>{}); } catch(e){}
    delete items.imgbbKey;
  }
}

export async function getSettings(){
  // Base object from sync (if available)
  const syncItems = await new Promise(resolve => {
    if(!chrome?.storage?.sync){
      const raw = localStorage.getItem(LOCAL_SETTINGS_KEY);
      resolve(raw ? JSON.parse(raw) : {});
      return;
    }
    chrome.storage.sync.get(null, async items => {
      await migrateSyncApiKey(items);
      resolve(items || {});
    });
  });
  // Overlay local-only API key
  let apiKey;
  try { apiKey = localStorage.getItem(LOCAL_API_KEY) || ''; } catch(e){ apiKey=''; }
  if(apiKey) syncItems.imgbbKey = apiKey; // expose unified view
  return syncItems;
}

export async function setSettings(patch){
  const current = await getSettings();
  const next = { ...current, ...patch };

  // Handle local-only API key
  if(Object.prototype.hasOwnProperty.call(patch, 'imgbbKey')){
    const val = patch.imgbbKey || '';
    try {
      if(val) localStorage.setItem(LOCAL_API_KEY, val); else localStorage.removeItem(LOCAL_API_KEY);
    } catch(e){}
    // Remove from patch so it is not synced
    delete patch.imgbbKey;
  }

  if(!chrome?.storage?.sync){
    // Store remaining settings locally
    try { localStorage.setItem(LOCAL_SETTINGS_KEY, JSON.stringify(next)); } catch(e){}
    return next;
  }

  return new Promise(resolve => {
    const allowed = {}; Object.keys(patch).forEach(k=>{ if(SYNC_KEYS.includes(k)) allowed[k] = patch[k]; });
    if(Object.keys(allowed).length){
      chrome.storage.sync.set(allowed, () => resolve({ ...next, ...allowed }));
    } else {
      resolve(next); // nothing to sync
    }
  });
}
