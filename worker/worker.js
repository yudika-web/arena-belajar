const GITHUB_API = 'https://api.github.com';
const API_VERSION = '2026-03-10';
const DATA_PATH = 'data/koleksi.json';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = corsHeaders(request, env);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (url.pathname === '/api/health') return json({ ok: true, repo: `${env.GITHUB_OWNER}/${env.GITHUB_REPO}` }, 200, cors);
    if (!url.pathname.startsWith('/api/')) return json({ error: 'Not found' }, 404, cors);
    if (!isAllowedOrigin(request, env)) return json({ error: 'Origin tidak diizinkan.' }, 403, cors);
    if (!env.ADMIN_KEY || request.headers.get('X-Admin-Key') !== env.ADMIN_KEY) return json({ error: 'ADMIN_KEY salah.' }, 401, cors);

    try {
      if (url.pathname === '/api/koleksi' && request.method === 'GET') {
        const { items } = await readCollection(env);
        return json({ items }, 200, cors);
      }
      if (url.pathname === '/api/koleksi' && request.method === 'POST') {
        const body = await readBody(request);
        const state = await readCollection(env);
        const item = normalizeItem(body.item || {});
        item.id = crypto.randomUUID();
        if (body.imageData) item.image = await uploadImage(env, body.imageData, body.imageName || item.title, item.title);
        state.items.unshift(item);
        await writeCollection(env, state.items, state.sha, `Tambah koleksi: ${item.title}`);
        return json({ ok: true, item, message: `“${item.title}” ditambahkan dan di-commit ke GitHub.` }, 201, cors);
      }
      if (url.pathname === '/api/koleksi/reorder' && request.method === 'POST') {
        const body = await readBody(request);
        const state = await readCollection(env);
        const orderedIds = Array.isArray(body.orderedIds) ? body.orderedIds.map(String) : [];
        const currentIds = state.items.map(x => String(x.id));
        const uniqueIds = new Set(orderedIds);
        if (orderedIds.length !== currentIds.length || uniqueIds.size !== currentIds.length || currentIds.some(id => !uniqueIds.has(id))) {
          throw httpError(409, 'Daftar koleksi berubah. Muat ulang Admin lalu atur posisi kembali.');
        }
        const byId = new Map(state.items.map(item => [String(item.id), item]));
        const next = orderedIds.map(id => byId.get(id));
        await writeCollection(env, next, state.sha, 'Atur ulang posisi koleksi');
        return json({ ok: true, items: next, message: 'Urutan koleksi diperbarui dan di-commit ke GitHub.' }, 200, cors);
      }

      const match = url.pathname.match(/^\/api\/koleksi\/([^/]+)$/);
      if (match && request.method === 'PUT') {
        const id = decodeURIComponent(match[1]);
        const body = await readBody(request);
        const state = await readCollection(env);
        const index = state.items.findIndex(x => String(x.id) === String(id));
        if (index < 0) return json({ error: 'Koleksi tidak ditemukan.' }, 404, cors);
        const old = state.items[index];
        const updated = { ...old, ...normalizeItem(body.item || {}, old), id: old.id };
        if (body.imageData) updated.image = await uploadImage(env, body.imageData, body.imageName || updated.title, updated.title);
        state.items[index] = updated;
        await writeCollection(env, state.items, state.sha, `Update koleksi: ${updated.title}`);
        return json({ ok: true, item: updated, message: `“${updated.title}” diperbarui dan di-commit ke GitHub.` }, 200, cors);
      }
      if (match && request.method === 'DELETE') {
        const id = decodeURIComponent(match[1]);
        const state = await readCollection(env);
        const item = state.items.find(x => String(x.id) === String(id));
        if (!item) return json({ error: 'Koleksi tidak ditemukan.' }, 404, cors);
        const next = state.items.filter(x => String(x.id) !== String(id));
        await writeCollection(env, next, state.sha, `Hapus koleksi: ${item.title}`);
        return json({ ok: true, message: `“${item.title}” dihapus dan perubahan di-commit ke GitHub.` }, 200, cors);
      }
      return json({ error: 'Endpoint tidak tersedia.' }, 404, cors);
    } catch (error) {
      console.error(error);
      return json({ error: error.message || 'Terjadi kesalahan pada server.' }, error.status || 500, cors);
    }
  }
};

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin') || '';
  const allowed = env.ALLOWED_ORIGIN || 'https://yudika-web.github.io';
  const headers = {
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,X-Admin-Key',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
  if (origin === allowed || (env.ALLOW_LOCALHOST === '1' && /^https?:\/\/localhost(?::\d+)?$/.test(origin))) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}
function isAllowedOrigin(request, env) {
  const origin = request.headers.get('Origin');
  if (!origin) return true;
  const allowed = env.ALLOWED_ORIGIN || 'https://yudika-web.github.io';
  return origin === allowed || (env.ALLOW_LOCALHOST === '1' && /^https?:\/\/localhost(?::\d+)?$/.test(origin));
}
function json(data, status=200, extra={}) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store', ...extra } });
}
async function readBody(request) {
  const type = request.headers.get('content-type') || '';
  if (!type.includes('application/json')) throw httpError(415, 'Gunakan Content-Type application/json.');
  return await request.json();
}
function httpError(status, message){ const e = new Error(message); e.status = status; return e; }

function ghHeaders(env){
  return {
    'Accept':'application/vnd.github+json',
    'Authorization':`Bearer ${env.GITHUB_TOKEN}`,
    'X-GitHub-Api-Version':API_VERSION,
    'User-Agent':'arena-belajar-worker'
  };
}
function repoBase(env){
  if(!env.GITHUB_TOKEN || !env.GITHUB_OWNER || !env.GITHUB_REPO) throw httpError(500,'Konfigurasi GitHub Worker belum lengkap.');
  return `${GITHUB_API}/repos/${encodeURIComponent(env.GITHUB_OWNER)}/${encodeURIComponent(env.GITHUB_REPO)}`;
}
async function getFile(env, path){
  const branch = env.GITHUB_BRANCH || 'main';
  const res = await fetch(`${repoBase(env)}/contents/${path.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(branch)}`, {headers:ghHeaders(env)});
  if(res.status === 404) return null;
  if(!res.ok) throw await githubError(res);
  return await res.json();
}
async function putFile(env, path, base64, message, sha){
  const body = {message, content:base64, branch:env.GITHUB_BRANCH || 'main'};
  if(sha) body.sha = sha;
  const res = await fetch(`${repoBase(env)}/contents/${path.split('/').map(encodeURIComponent).join('/')}`, {
    method:'PUT', headers:{...ghHeaders(env),'Content-Type':'application/json'}, body:JSON.stringify(body)
  });
  if(!res.ok) throw await githubError(res);
  return await res.json();
}
async function githubError(res){
  const data=await res.json().catch(()=>({}));
  const e=httpError(res.status===401||res.status===403?502:res.status, `GitHub API: ${data.message || res.statusText}`); return e;
}

async function readCollection(env){
  const file = await getFile(env, DATA_PATH);
  if(!file) return {items:[],sha:null};
  const text = decodeUtf8Base64((file.content || '').replace(/\n/g,''));
  const parsed = JSON.parse(text || '[]');
  return {items:Array.isArray(parsed)?parsed:(parsed.items||[]),sha:file.sha};
}
async function writeCollection(env, items, sha, message){
  const text = JSON.stringify(items, null, 2) + '\n';
  return putFile(env, DATA_PATH, encodeUtf8Base64(text), message, sha);
}

function normalizeItem(input, old={}){
  const title = String(input.title || old.title || '').trim();
  const description = String(input.description || old.description || '').trim();
  const url = String(input.url || old.url || '').trim();
  if(!title || !description || !url) throw httpError(400,'Judul, deskripsi, dan URL wajib diisi.');
  try { new URL(url); } catch { throw httpError(400,'URL tujuan tidak valid.'); }
  const categories = new Set(['Worksheet','MPI','Game','Lab Maya','Aplikasi','Modul Ajar']);
  const category = categories.has(input.category) ? input.category : (old.category || 'Worksheet');
  const image = String(input.image ?? old.image ?? '').trim();
  if(image){ try { new URL(image, 'https://example.com'); } catch { throw httpError(400,'URL gambar tidak valid.'); } }
  return {
    title, category, description, image, url,
    level:String(input.level ?? old.level ?? 'SMP').trim(),
    duration:String(input.duration ?? old.duration ?? 'Belajar mandiri').trim(),
    tags:Array.isArray(input.tags)?input.tags.map(x=>String(x).trim()).filter(Boolean).slice(0,20):(old.tags||[]),
    date:String(input.date || new Date().toISOString().slice(0,10)),
    cta:String(input.cta ?? old.cta ?? 'Mulai misi').trim(),
    newTab: input.newTab ?? old.newTab ?? true
  };
}
async function uploadImage(env, dataUrl, originalName, title){
  const m = String(dataUrl).match(/^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/=]+)$/);
  if(!m) throw httpError(400,'Format gambar tidak didukung. Gunakan PNG, JPG, WebP, atau GIF.');
  const mime=m[1], base64=m[2];
  const bytes=Math.floor(base64.length*3/4);
  if(bytes>5*1024*1024) throw httpError(400,'Ukuran gambar maksimal 5 MB.');
  const ext={ 'image/png':'png','image/jpeg':'jpg','image/webp':'webp','image/gif':'gif' }[mime];
  const slug=slugify(title || originalName || 'gambar');
  const path=`assets/images/${Date.now()}-${slug}.${ext}`;
  await putFile(env,path,base64,`Upload gambar: ${title || originalName || slug}`,null);
  return `../${path}`.replace('../assets/','./assets/');
}
function slugify(s){ return String(s).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,60)||'gambar'; }
function encodeUtf8Base64(text){
  const bytes=new TextEncoder().encode(text); let binary='';
  for(let i=0;i<bytes.length;i+=0x8000) binary += String.fromCharCode(...bytes.subarray(i,i+0x8000));
  return btoa(binary);
}
function decodeUtf8Base64(base64){
  const binary=atob(base64); const bytes=new Uint8Array(binary.length);
  for(let i=0;i<binary.length;i++) bytes[i]=binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}
