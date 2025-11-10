import { getSettings, setSettings } from '../src/lib/settings.js';
import { uploadImage } from '../src/lib/uploader.js';
import { db } from '../src/lib/store.js';
import { makeForumLink } from '../src/lib/forum.js';

const tabs = document.querySelectorAll('nav.tabs button');
const tabSections = document.querySelectorAll('.tab');
let currentId = null; // selected avatar id in upload tab (persisted)
const SELECTED_KEY = 'yad:selectedId';
const FILTER_KEY = 'yad:filterCat';
const SCROLL_KEY_PREFIX = 'yad:scroll:'; // per-tab scroll positions
const PREVIEW_KEY = 'yad:previewDataUrl';
const UPLOAD_CAT_KEY = 'yad:lastUploadCat';

function switchTab(id){
  // Save scroll position of currently active tab before switching
  const active = document.querySelector('.tab.active');
  if(active){
    const sc = active.scrollTop;
    localStorage.setItem(SCROLL_KEY_PREFIX + active.id.replace('tab-',''), String(sc));
  }
  tabs.forEach(b=> b.classList.toggle('active', b.dataset.tab === id));
  tabSections.forEach(s=> s.classList.toggle('active', s.id === 'tab-'+id));
  localStorage.setItem('yad:lastTab', id);
  if(id==='library') renderLibrary();
  if(id==='settings') loadSettingsUI();
  // Restore scroll position for new tab
  const target = document.getElementById('tab-'+id);
  if(target){
    const saved = localStorage.getItem(SCROLL_KEY_PREFIX + id);
    if(saved){ target.scrollTop = parseInt(saved,10)||0; }
  }
}
// We'll attach tab click handlers after elements are initialized below

// Elements
const drop = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const previewCanvas = document.getElementById('preview');
const ctx = previewCanvas.getContext('2d');
const uploadBtn = document.getElementById('btn-upload');
const replaceBtn = document.getElementById('btn-replace');
const deleteBtn = document.getElementById('btn-delete');
const copyBtn = document.getElementById('btn-copy-link');
const statusEl = document.getElementById('upload-status');
const catSelect = document.getElementById('category-select');
const addCatBtn = document.getElementById('add-category');
const newCatRow = document.getElementById('new-cat-row');
const newCatName = document.getElementById('new-category-name');
const saveNewCat = document.getElementById('save-new-category');
const cancelNewCat = document.getElementById('cancel-new-category');
const toast = document.getElementById('toast');

// Library elements
const libGrid = document.getElementById('library-grid');
const libStatus = document.getElementById('library-status');
const filterCategory = document.getElementById('filter-category');
const refreshLibBtn = document.getElementById('refresh-library');

// Settings elements
const apiKeyInput = document.getElementById('api-key');
const saveKeyBtn = document.getElementById('save-key');
const keyStatus = document.getElementById('key-status');
const themeSelect = document.getElementById('theme-select');
const exportDataBtn = document.getElementById('export-data');
const importDataBtn = document.getElementById('import-data');
const importFileInput = document.getElementById('import-file');
const versionSpan = document.getElementById('app-version');

let currentImageData = null; // ImageData for upload

function showToast(msg){
  toast.textContent = msg; toast.classList.add('show');
  setTimeout(()=> toast.classList.remove('show'), 2200);
}

function setStatus(msg, color){
  statusEl.textContent = msg || ''; statusEl.style.color = color || 'var(--fg)';
}

function resetPreview(){
  ctx.clearRect(0,0,previewCanvas.width, previewCanvas.height);
  currentImageData = null; uploadBtn.disabled = true; replaceBtn.disabled = true; deleteBtn.disabled = !currentId; copyBtn.disabled = !currentId;
  localStorage.removeItem(PREVIEW_KEY);
}

function drawPreview(img){
  const W = previewCanvas.width; const H = previewCanvas.height;
  ctx.clearRect(0,0,W,H);
  const ratio = Math.min(W / img.width, H / img.height);
  const dw = img.width * ratio; const dh = img.height * ratio;
  const dx = (W - dw)/2; const dy = (H - dh)/2;
  ctx.drawImage(img, dx, dy, dw, dh);
  // store ImageData
  const off = document.createElement('canvas'); off.width = img.width; off.height = img.height; off.getContext('2d').drawImage(img,0,0);
  currentImageData = off.getContext('2d').getImageData(0,0,off.width,off.height);
  // Persist preview (DataURL, may be large; acceptable for small avatars)
  try {
    const dataURL = off.toDataURL('image/png');
    localStorage.setItem(PREVIEW_KEY, dataURL);
  } catch(e){}
  uploadBtn.disabled = false; replaceBtn.disabled = !currentId; deleteBtn.disabled = !currentId; copyBtn.disabled = !currentId;
}

async function ensureCategories(){
  const s = await getSettings();
  if(!s.categories){
    s.categories = ['Default'];
    await setSettings({ categories: s.categories });
  }
  return s.categories;
}

async function populateCategorySelect(){
  const cats = await ensureCategories();
  catSelect.innerHTML='';
  cats.forEach(c=>{
    const opt = document.createElement('option'); opt.value = c; opt.textContent = c; catSelect.appendChild(opt);
  });
  // Restore last selected upload category
  const lastCat = localStorage.getItem(UPLOAD_CAT_KEY);
  if(lastCat && cats.includes(lastCat)){
    catSelect.value = lastCat;
  } else if(cats.includes('Default')){
    catSelect.value = 'Default';
  }
}

addCatBtn.addEventListener('click', ()=>{ newCatRow.style.display='flex'; newCatName.value=''; newCatName.focus(); });
cancelNewCat.addEventListener('click', ()=>{ newCatRow.style.display='none'; localStorage.removeItem('yad:draftCat'); localStorage.removeItem('yad:draftCatVisible'); });
// Persist draft category name as user types
newCatName.addEventListener('input', ()=>{
  const val = newCatName.value; if(val) localStorage.setItem('yad:draftCat', val); else localStorage.removeItem('yad:draftCat');
});
saveNewCat.addEventListener('click', async ()=>{
  const name = newCatName.value.trim(); if(!name) return; const s = await getSettings();
  if(!s.categories) s.categories=[]; if(!s.categories.includes(name)){ s.categories.push(name); await setSettings({ categories: s.categories }); }
  newCatRow.style.display='none'; populateCategorySelect(); catSelect.value = name; localStorage.setItem(UPLOAD_CAT_KEY, name); showToast('Category added');
  localStorage.removeItem('yad:draftCat'); localStorage.removeItem('yad:draftCatVisible');
});
// Pressing Enter in the new category input saves it
newCatName.addEventListener('keydown', (e)=>{
  if(e.key === 'Enter'){
    e.preventDefault(); saveNewCat.click();
  }
});

// Drag/drop/paste
function handleFile(file){
  const url = URL.createObjectURL(file);
  const img = new Image(); img.onload = ()=>{ drawPreview(img); URL.revokeObjectURL(url); }; img.src = url;
}

// Persist upload category selection
catSelect.addEventListener('change', ()=>{
  localStorage.setItem(UPLOAD_CAT_KEY, catSelect.value || 'Default');
});

drop.addEventListener('click', ()=> fileInput.click());
drop.addEventListener('dragover', e=>{ e.preventDefault(); drop.classList.add('drag'); });
drop.addEventListener('dragleave', ()=> drop.classList.remove('drag'));
drop.addEventListener('drop', e=>{ e.preventDefault(); drop.classList.remove('drag'); const f = e.dataTransfer.files?.[0]; if(f) handleFile(f); });
fileInput.addEventListener('change', ()=>{ const f = fileInput.files?.[0]; if(f) handleFile(f); });
window.addEventListener('paste', e=>{ const item = [...(e.clipboardData?.items||[])].find(i=> i.type.startsWith('image/')); if(item){ const f = item.getAsFile(); if(f) handleFile(f); }});

async function doUpload(){
  if(!currentImageData){ setStatus('No image.', 'var(--danger)'); return; }
  const apiKey = (await getSettings()).imgbbKey; if(!apiKey){ setStatus('Set API key first.', 'var(--danger)'); return; }
  setStatus('Uploading...');
  try{
    const blob = imageDataToPngBlob(currentImageData);
    const form = new FormData(); form.append('key', apiKey); form.append('image', blob, 'avatar.png');
    const resp = await fetch('https://api.imgbb.com/1/upload', { method:'POST', body: form });
    const json = await resp.json();
    if(!json?.success){ throw new Error(json?.error?.message || 'Upload failed'); }
    const data = json.data;
    const cat = catSelect.value || 'Default';
    const record = db.add({
      category: cat,
      url: data.display_url,
      thumb: data.thumb?.url || data.display_url,
      deleteUrl: data.delete_url,
      time: Date.now(),
      forum: makeForumLink(data.display_url)
    });
    currentId = record.id;
    await renderLibrary();
    setStatus('Uploaded.'); showToast('Uploaded'); copyBtn.disabled=false; deleteBtn.disabled=false; replaceBtn.disabled=false;
  }catch(err){ console.error(err); setStatus(err.message, 'var(--danger)'); }
}

uploadBtn.addEventListener('click', doUpload);

function imageDataToPngBlob(imageData){
  const cvs = document.createElement('canvas'); cvs.width = imageData.width; cvs.height = imageData.height; cvs.getContext('2d').putImageData(imageData,0,0);
  const dataURL = cvs.toDataURL('image/png');
  const bin = atob(dataURL.split(',')[1]); const arr = new Uint8Array(bin.length); for(let i=0;i<bin.length;i++) arr[i]=bin.charCodeAt(i);
  return new Blob([arr], { type:'image/png' });
}

async function renderLibrary(){
  libGrid.innerHTML='';
  buildFilterCategories();
  // Apply saved filter before building
  const savedFilter = localStorage.getItem(FILTER_KEY);
  if(savedFilter){ filterCategory.value = savedFilter; }
  const all = db.all();
  const filter = filterCategory.value || 'ALL';
  const filtered = all.filter(r=> filter==='ALL' || r.category===filter);
  if(!filtered.length){ libStatus.textContent = 'No avatars yet.'; }
  else libStatus.textContent = `${filtered.length} avatar(s)`;
  filtered.sort((a,b)=> b.time - a.time);
  filtered.forEach(rec=>{
    const card = document.createElement('div'); card.className='card'; card.dataset.id = rec.id;
    const c = document.createElement('canvas'); c.width=100; c.height=100; const cctx=c.getContext('2d');
    const img = new Image(); img.onload=()=>{ const r=Math.min(c.width/img.width, c.height/img.height); const dw=img.width*r; const dh=img.height*r; const dx=(c.width-dw)/2; const dy=(c.height-dh)/2; cctx.clearRect(0,0,c.width,c.height); cctx.drawImage(img,dx,dy,dw,dh); }; img.src = rec.thumb;
    const meta = document.createElement('div'); meta.className='meta'; meta.innerHTML = `<strong>${rec.category}</strong><br/><span>${new Date(rec.time).toLocaleDateString()}</span>`;
    card.appendChild(c); card.appendChild(meta);
    card.addEventListener('click', ()=> selectRecord(rec.id));
    libGrid.appendChild(card);
  });
  // Reapply selection highlight if currentId is set
  // Reapply selection highlight if currentId is set
  if(currentId){
    [...libGrid.querySelectorAll('.card')].forEach(card=> card.classList.toggle('selected', card.dataset.id == currentId));
  }
}

function buildFilterCategories(){
  const cats = db.categories();
  filterCategory.innerHTML='';
  const allOpt = document.createElement('option'); allOpt.value='ALL'; allOpt.textContent='All'; filterCategory.appendChild(allOpt);
  cats.forEach(c=>{ const o=document.createElement('option'); o.value=c; o.textContent=c; filterCategory.appendChild(o); });
}

filterCategory.addEventListener('change', ()=>{
  localStorage.setItem(FILTER_KEY, filterCategory.value || 'ALL');
  renderLibrary();
});
refreshLibBtn.addEventListener('click', renderLibrary);

function selectRecord(id){
  const rec = db.get(id); if(!rec) return;
  currentId = id; localStorage.setItem(SELECTED_KEY, String(id));
  deleteBtn.disabled=false; replaceBtn.disabled= !currentImageData; copyBtn.disabled=false;
  // highlight in grid
  [...libGrid.querySelectorAll('.card')].forEach(card=> card.classList.toggle('selected', card.dataset.id == id));
  // load its image into preview (for replace convenience)
  const img = new Image(); img.onload=()=> drawPreview(img); img.crossOrigin='anonymous'; img.src = rec.url;
  // Show forum link in a toast for quick copy reference
  if(rec.forum){
    showToast('Forum link ready (tap Copy Link)');
    // Also display the forum link in library status area
    libStatus.textContent = rec.forum;
  }
  setStatus('Selected avatar.');
}

deleteBtn.addEventListener('click', async ()=>{
  if(!currentId) return; const rec = db.get(currentId); if(!rec) return;
  if(!confirm('Delete avatar?')) return;
  db.remove(currentId); currentId=null; resetPreview(); await renderLibrary(); setStatus('Deleted.'); showToast('Deleted');
});

replaceBtn.addEventListener('click', async ()=>{
  if(!currentId){ setStatus('Select an avatar first.'); return; }
  if(!currentImageData){ setStatus('Load an image to replace with.'); return; }
  const apiKey = (await getSettings()).imgbbKey; if(!apiKey){ setStatus('Set API key first.', 'var(--danger)'); return; }
  setStatus('Replacing...');
  try{
    const blob = imageDataToPngBlob(currentImageData);
    const form = new FormData(); form.append('key', apiKey); form.append('image', blob, 'avatar.png');
    const resp = await fetch('https://api.imgbb.com/1/upload', { method:'POST', body: form });
    const json = await resp.json(); if(!json?.success) throw new Error(json?.error?.message || 'Upload failed');
    const data = json.data; const rec = db.get(currentId); if(!rec) return;
    db.update(currentId, { url: data.display_url, thumb: data.thumb?.url || data.display_url, forum: makeForumLink(data.display_url), time: Date.now() });
    await renderLibrary(); setStatus('Replaced.'); showToast('Replaced');
  }catch(err){ console.error(err); setStatus(err.message, 'var(--danger)'); }
});

copyBtn.addEventListener('click', ()=>{
  if(!currentId) return; const rec = db.get(currentId); if(!rec) return;
  navigator.clipboard.writeText(rec.forum).then(()=>{ showToast('Link copied'); }).catch(()=> showToast('Copy failed'));
});

// Settings
async function loadSettingsUI(){
  const s = await getSettings();
  apiKeyInput.value = s.imgbbKey || ''; themeSelect.value = s.theme || 'default';
  document.body.className = 'theme-' + (s.theme || 'default');
  versionSpan.textContent = 'v'+ chrome.runtime.getManifest().version;
}

saveKeyBtn.addEventListener('click', async ()=>{
  const key = apiKeyInput.value.trim(); await setSettings({ imgbbKey: key }); keyStatus.textContent = key ? 'Saved' : 'Cleared'; setTimeout(()=> keyStatus.textContent='', 1500);
});

themeSelect.addEventListener('change', async ()=>{ await setSettings({ theme: themeSelect.value }); document.body.className = 'theme-'+themeSelect.value; });

exportDataBtn.addEventListener('click', ()=>{
  const data = db.export(); const blob = new Blob([JSON.stringify(data,null,2)], { type:'application/json' });
  const url = URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='yoavatar-depo-data.json'; a.click(); setTimeout(()=> URL.revokeObjectURL(url), 2000);
});

importDataBtn.addEventListener('click', ()=> importFileInput.click());
importFileInput.addEventListener('change', ()=>{
  const f = importFileInput.files?.[0]; if(!f) return; const r = new FileReader(); r.onload=()=>{ try{ const json=JSON.parse(r.result); db.import(json); showToast('Data imported'); renderLibrary(); }catch(e){ showToast('Import failed'); } }; r.readAsText(f);
});

// Basic background ping (diagnostic)
chrome.runtime.sendMessage({ type:'PING' }, res=>{ console.log('Background pong:', res); });

// Initialize
(async function init(){
  // Wire up tab switching handlers now that elements exist
  tabs.forEach(b=> b.addEventListener('click', ()=> switchTab(b.dataset.tab)));
  const last = localStorage.getItem('yad:lastTab');
  if(last) switchTab(last); else switchTab('upload');

  await populateCategorySelect();
  await renderLibrary();
  loadSettingsUI();
  // Restore draft category if present
  const draftVisible = localStorage.getItem('yad:draftCatVisible');
  const draftName = localStorage.getItem('yad:draftCat');
  if(draftVisible){ newCatRow.style.display='flex'; if(draftName){ newCatName.value = draftName; } }
  // Restore filter selection (already applied in renderLibrary after categories) ensure UI value matches
  const savedFilter = localStorage.getItem(FILTER_KEY); if(savedFilter){ filterCategory.value = savedFilter; }
  // Restore selected avatar
  const savedSelected = localStorage.getItem(SELECTED_KEY); if(savedSelected){
    const rec = db.get(parseInt(savedSelected,10)); if(rec){ selectRecord(rec.id); }
  }
  // Restore preview image if present and not replaced yet
  const prevDataUrl = localStorage.getItem(PREVIEW_KEY);
  if(prevDataUrl && !currentImageData){
    const img = new Image(); img.onload=()=> drawPreview(img); img.src = prevDataUrl;
  }
  // Restore scroll position for initial tab
  const lastTab = localStorage.getItem('yad:lastTab');
  if(lastTab){
    const sc = localStorage.getItem(SCROLL_KEY_PREFIX + lastTab);
    if(sc){ const target = document.getElementById('tab-'+lastTab); if(target){ target.scrollTop = parseInt(sc,10)||0; } }
  }
})();

// Continuously persist scroll positions while user scrolls (debounced)
const scrollTimers = {};
tabSections.forEach(sec=>{
  sec.addEventListener('scroll', ()=>{
    const id = sec.id.replace('tab-','');
    clearTimeout(scrollTimers[id]);
    scrollTimers[id] = setTimeout(()=>{
      localStorage.setItem(SCROLL_KEY_PREFIX + id, String(sec.scrollTop));
    }, 150);
  }, { passive: true });
});

// Track visibility state of draft row
const observer = new MutationObserver(()=>{
  const visible = newCatRow.style.display !== 'none';
  if(visible) localStorage.setItem('yad:draftCatVisible', '1'); else localStorage.removeItem('yad:draftCatVisible');
});
observer.observe(newCatRow, { attributes:true, attributeFilter:['style'] });
