// store.js - in-memory + persisted avatar metadata store
// Each record: { id, category, url, thumb, deleteUrl, time, forum }

const KEY = 'yad:db';
let records = load();
let counter = records.reduce((m,r)=> Math.max(m, r.id), 0);

function load(){
  try{ const raw = localStorage.getItem(KEY); return raw ? JSON.parse(raw) : []; }catch(e){ return []; }
}
function persist(){ try{ localStorage.setItem(KEY, JSON.stringify(records)); }catch(e){} }

export const db = {
  add(rec){
    const id = ++counter; const full = { id, ...rec }; records.push(full); persist(); return full;
  },
  update(id, patch){ const i = records.findIndex(r=> r.id===id); if(i>=0){ records[i] = { ...records[i], ...patch }; persist(); return records[i]; } },
  remove(id){ records = records.filter(r=> r.id!==id); persist(); },
  get(id){ return records.find(r=> r.id===id); },
  all(){ return [...records]; },
  categories(){ return [...new Set(records.map(r=> r.category))]; },
  export(){ return { records, counter }; },
  import(data){ if(!data || !Array.isArray(data.records)) return; records = data.records; counter = data.counter||records.reduce((m,r)=>Math.max(m,r.id),0); persist(); }
};
