const $ = (s) => document.querySelector(s);
const config = window.ARENA_CONFIG || {};
const els = {
  apiUrl: $('#api-url'), adminKey: $('#admin-key'), connect: $('#connect-button'), connection: $('#connection-status'),
  setup: $('#setup-panel'), dashboard: $('#dashboard'), list: $('#collection-list'), global: $('#global-message'),
  refresh: $('#refresh-button'), add: $('#new-button'), logout: $('#logout-button'), editor: $('#editor'), editorTitle: $('#editor-title'),
  closeEditor: $('#close-editor'), cancel: $('#cancel-button'), form: $('#collection-form'), save: $('#save-button'), saveStatus: $('#save-status'),
  id: $('#item-id'), title: $('#title'), category: $('#category'), description: $('#description'), url: $('#url'),
  cta: $('#cta'), duration: $('#duration'), level: $('#level'), tags: $('#tags'), imageUrl: $('#image-url'), imageFile: $('#image-file')
};
let items = [];
let reorderBusy = false;
let draggedId = null;

const savedApi = localStorage.getItem('arena_api_url') || config.apiBaseUrl || '';
els.apiUrl.value = savedApi;
els.adminKey.value = sessionStorage.getItem('arena_admin_key') || '';

function apiBase(){ return els.apiUrl.value.trim().replace(/\/+$/, ''); }
function adminKey(){ return els.adminKey.value.trim(); }
function headers(){ return {'Content-Type':'application/json','X-Admin-Key':adminKey()}; }
function showMessage(text, type='ok'){
  els.global.textContent = text; els.global.className = `message ${type}`; els.global.hidden = false;
  setTimeout(()=>{ els.global.hidden = true; }, 5500);
}
function escapeHtml(v=''){ return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function imageForAdmin(src=''){ return String(src).startsWith('./') ? '../' + String(src).slice(2) : String(src); }

async function api(path, options={}){
  const base = apiBase();
  if(!/^https:\/\//i.test(base)) throw new Error('URL Worker harus diawali https://');
  const response = await fetch(base + path, {...options, headers:{...headers(), ...(options.headers||{})}});
  const data = await response.json().catch(()=>({}));
  if(!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}

async function connect(){
  els.connect.disabled = true; els.connection.textContent = 'Memeriksa…';
  try{
    localStorage.setItem('arena_api_url', apiBase());
    sessionStorage.setItem('arena_admin_key', adminKey());
    await loadItems();
    els.connection.textContent = 'Terhubung';
    els.setup.hidden = true; els.dashboard.hidden = false;
  }catch(err){ els.connection.textContent = err.message; }
  finally{ els.connect.disabled = false; }
}

async function loadItems(){
  const data = await api('/api/koleksi');
  items = Array.isArray(data.items) ? data.items : [];
  renderList();
}

function renderList(){
  if(!items.length){ els.list.innerHTML = '<div class="empty-list">Belum ada koleksi. Klik <strong>+ Tambah koleksi</strong>.</div>'; return; }
  els.list.innerHTML = items.map((item, index) => `
    <article class="collection-row" draggable="true" data-row-id="${escapeHtml(item.id)}">
      <div class="position-box" title="Posisi koleksi"><span>#${index + 1}</span><button type="button" class="drag-handle" aria-label="Seret untuk mengubah posisi" title="Seret untuk mengubah posisi">⠿</button></div>
      ${item.image ? `<img class="thumb" src="${escapeHtml(imageForAdmin(item.image))}" alt="">` : '<div class="thumb thumb-placeholder">✦</div>'}
      <div class="row-main">
        <strong>${escapeHtml(item.title)}</strong>
        <div class="meta"><span class="chip">${escapeHtml(item.category)}</span><span>${escapeHtml(item.level||'')}</span><span>${escapeHtml(item.date||'')}</span></div>
      </div>
      <div class="row-actions">
        <div class="order-actions" aria-label="Atur posisi ${escapeHtml(item.title)}">
          <button class="button order-button" data-move="top" data-id="${escapeHtml(item.id)}" title="Paling atas" ${index===0?'disabled':''}>⇈</button>
          <button class="button order-button" data-move="up" data-id="${escapeHtml(item.id)}" title="Naik satu" ${index===0?'disabled':''}>↑</button>
          <button class="button order-button" data-move="down" data-id="${escapeHtml(item.id)}" title="Turun satu" ${index===items.length-1?'disabled':''}>↓</button>
          <button class="button order-button" data-move="bottom" data-id="${escapeHtml(item.id)}" title="Paling bawah" ${index===items.length-1?'disabled':''}>⇊</button>
        </div>
        <button class="button" data-edit="${escapeHtml(item.id)}">Edit</button>
        <button class="button danger-ghost" data-delete="${escapeHtml(item.id)}">Hapus</button>
      </div>
    </article>`).join('');

  els.list.querySelectorAll('[data-edit]').forEach(b=>b.addEventListener('click',()=>openEditor(b.dataset.edit)));
  els.list.querySelectorAll('[data-delete]').forEach(b=>b.addEventListener('click',()=>removeItem(b.dataset.delete)));
  els.list.querySelectorAll('[data-move]').forEach(b=>b.addEventListener('click',()=>moveItem(b.dataset.id,b.dataset.move)));
  setupDragAndDrop();
}

function reorderedCopy(id, direction){
  const next = [...items];
  const index = next.findIndex(x=>String(x.id)===String(id));
  if(index < 0) return next;
  let target = index;
  if(direction==='top') target = 0;
  if(direction==='up') target = Math.max(0,index-1);
  if(direction==='down') target = Math.min(next.length-1,index+1);
  if(direction==='bottom') target = next.length-1;
  if(target===index) return next;
  const [item] = next.splice(index,1);
  next.splice(target,0,item);
  return next;
}

async function persistOrder(nextItems, message='Urutan koleksi diperbarui.'){
  if(reorderBusy) return;
  const before = items;
  reorderBusy = true;
  items = nextItems;
  renderList();
  els.list.classList.add('is-saving-order');
  try{
    const orderedIds = items.map(x=>String(x.id));
    const result = await api('/api/koleksi/reorder', {method:'POST', body:JSON.stringify({orderedIds})});
    showMessage(result.message || message);
    if(Array.isArray(result.items)) items = result.items;
  }catch(err){
    items = before;
    showMessage(err.message,'error');
  }finally{
    reorderBusy = false;
    renderList();
    els.list.classList.remove('is-saving-order');
  }
}

async function moveItem(id, direction){
  const next = reorderedCopy(id,direction);
  if(next.every((x,i)=>x===items[i])) return;
  await persistOrder(next);
}

function setupDragAndDrop(){
  els.list.querySelectorAll('.collection-row').forEach(row=>{
    row.addEventListener('dragstart', event=>{
      if(reorderBusy){ event.preventDefault(); return; }
      draggedId = row.dataset.rowId;
      row.classList.add('is-dragging');
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', draggedId);
    });
    row.addEventListener('dragend', ()=>{
      draggedId = null;
      els.list.querySelectorAll('.collection-row').forEach(r=>r.classList.remove('is-dragging','drag-over'));
    });
    row.addEventListener('dragover', event=>{
      if(!draggedId || row.dataset.rowId===draggedId) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      els.list.querySelectorAll('.collection-row').forEach(r=>r.classList.remove('drag-over'));
      row.classList.add('drag-over');
    });
    row.addEventListener('drop', async event=>{
      event.preventDefault();
      const sourceId = draggedId || event.dataTransfer.getData('text/plain');
      const targetId = row.dataset.rowId;
      if(!sourceId || !targetId || sourceId===targetId) return;
      const next = [...items];
      const from = next.findIndex(x=>String(x.id)===String(sourceId));
      const to = next.findIndex(x=>String(x.id)===String(targetId));
      if(from<0 || to<0) return;
      const [moved] = next.splice(from,1);
      next.splice(to,0,moved);
      draggedId = null;
      await persistOrder(next);
    });
  });
}

function openEditor(id=''){
  const item = items.find(x=>String(x.id)===String(id));
  els.form.reset();
  els.id.value = item?.id || '';
  els.editorTitle.textContent = item ? 'Edit koleksi' : 'Tambah koleksi';
  els.title.value = item?.title || '';
  els.category.value = item?.category || 'Worksheet';
  els.description.value = item?.description || '';
  els.url.value = item?.url || '';
  els.cta.value = item?.cta || 'Mulai misi';
  els.duration.value = item?.duration || 'Belajar mandiri';
  els.level.value = item?.level || 'SMP';
  els.tags.value = (item?.tags || []).join(', ');
  els.imageUrl.value = item?.image || '';
  els.imageFile.value = '';
  els.saveStatus.textContent = item?.image ? 'Gambar lama dipertahankan jika tidak memilih file baru.' : '';
  els.editor.hidden = false;
  els.title.focus();
  els.editor.scrollIntoView({behavior:'smooth',block:'start'});
}
function closeEditor(){ els.editor.hidden = true; els.form.reset(); }

function fileToDataUrl(file){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader(); reader.onload=()=>resolve(reader.result); reader.onerror=()=>reject(reader.error); reader.readAsDataURL(file);
  });
}

els.form.addEventListener('submit', async (event)=>{
  event.preventDefault();
  els.save.disabled=true; els.saveStatus.textContent='Mengirim ke GitHub…';
  try{
    const file = els.imageFile.files[0];
    if(file && file.size > 5*1024*1024) throw new Error('Ukuran gambar maksimal 5 MB.');
    const item = {
      title: els.title.value.trim(), category: els.category.value, description: els.description.value.trim(), url: els.url.value.trim(),
      cta: els.cta.value.trim() || 'Mulai misi', duration: els.duration.value.trim(), level: els.level.value.trim(),
      tags: els.tags.value.split(',').map(x=>x.trim()).filter(Boolean), image: els.imageUrl.value.trim(), date: new Date().toISOString().slice(0,10)
    };
    const payload = {item};
    if(file){ payload.imageData = await fileToDataUrl(file); payload.imageName = file.name; }
    const id = els.id.value;
    const result = id
      ? await api(`/api/koleksi/${encodeURIComponent(id)}`, {method:'PUT',body:JSON.stringify(payload)})
      : await api('/api/koleksi', {method:'POST',body:JSON.stringify(payload)});
    showMessage(result.message || 'Perubahan berhasil di-commit ke GitHub.');
    closeEditor(); await loadItems();
  }catch(err){ els.saveStatus.textContent = err.message; }
  finally{ els.save.disabled=false; }
});

async function removeItem(id){
  const item=items.find(x=>String(x.id)===String(id));
  if(!item || !confirm(`Hapus “${item.title}” dari koleksi?\n\nFile gambar di repository tidak dihapus otomatis.`)) return;
  try{
    const result=await api(`/api/koleksi/${encodeURIComponent(id)}`, {method:'DELETE'});
    showMessage(result.message || 'Koleksi dihapus dan GitHub sudah diperbarui.');
    await loadItems();
  }catch(err){ showMessage(err.message,'error'); }
}

els.connect.addEventListener('click',connect);
els.refresh.addEventListener('click',()=>loadItems().then(()=>showMessage('Data terbaru sudah dimuat.')).catch(e=>showMessage(e.message,'error')));
els.add.addEventListener('click',()=>openEditor());
els.logout.addEventListener('click',()=>{sessionStorage.removeItem('arena_admin_key');els.adminKey.value='';els.dashboard.hidden=true;els.setup.hidden=false;els.connection.textContent='Sesi ditutup';});
els.closeEditor.addEventListener('click',closeEditor); els.cancel.addEventListener('click',closeEditor);
if(els.apiUrl.value && els.adminKey.value) connect();
