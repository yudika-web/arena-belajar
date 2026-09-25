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
  els.list.innerHTML = items.map(item => `
    <article class="collection-row">
      ${item.image ? `<img class="thumb" src="${escapeHtml(imageForAdmin(item.image))}" alt="">` : '<div class="thumb thumb-placeholder">✦</div>'}
      <div class="row-main">
        <strong>${escapeHtml(item.title)}</strong>
        <div class="meta"><span class="chip">${escapeHtml(item.category)}</span><span>${escapeHtml(item.level||'')}</span><span>${escapeHtml(item.date||'')}</span></div>
      </div>
      <div class="row-actions">
        <button class="button" data-edit="${escapeHtml(item.id)}">Edit</button>
        <button class="button danger-ghost" data-delete="${escapeHtml(item.id)}">Hapus</button>
      </div>
    </article>`).join('');
  els.list.querySelectorAll('[data-edit]').forEach(b=>b.addEventListener('click',()=>openEditor(b.dataset.edit)));
  els.list.querySelectorAll('[data-delete]').forEach(b=>b.addEventListener('click',()=>removeItem(b.dataset.delete)));
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
