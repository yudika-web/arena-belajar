'use strict';
const state = { items: [], filter: 'Semua', query: '', sort: 'featured' };
const grid = document.querySelector('#collection-grid');
const empty = document.querySelector('#empty-state');
const search = document.querySelector('#search');
const sort = document.querySelector('#sort');
const filterButtons = [...document.querySelectorAll('[data-filter]')];
const symbols = {Worksheet:'▤', MPI:'◈', Game:'✜', 'Lab Maya':'⚗', Aplikasi:'▦', 'Modul Ajar':'▥'};
const names = {MPI:'Media Interaktif', Game:'Game Edukasi'};
const escapeHTML = (value='') => String(value ?? '').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const tagsOf = item => Array.isArray(item.tags) ? item.tags : [];
function safeURL(value){
  if(!value || typeof value !== 'string') return '';
  try {const url = new URL(value,document.baseURI); return ['http:','https:'].includes(url.protocol) ? url.href : ''; } catch {return '';}
}
function setFilter(category){
  state.filter = category;
  filterButtons.forEach(button=>{const active = button.dataset.filter === category;button.classList.toggle('is-active',active);button.setAttribute('aria-pressed',String(active));});
  document.querySelectorAll('[data-category-link]').forEach(link=>link.classList.toggle('is-selected',link.dataset.categoryLink === category));
  render();
}
function filteredItems(){
  const words = state.query.toLocaleLowerCase('id').split(/\s+/).filter(Boolean);
  const items = state.items.filter(item=>{
    const haystack = `${item.title} ${item.description} ${item.category} ${names[item.category] || ''} ${item.level || ''} ${tagsOf(item).join(' ')}`.toLocaleLowerCase('id');
    return (state.filter === 'Semua' || item.category === state.filter) && words.every(word=>haystack.includes(word));
  });
  if(state.sort === 'az') items.sort((a,b)=>String(a.title).localeCompare(String(b.title),'id'));
  if(state.sort === 'za') items.sort((a,b)=>String(b.title).localeCompare(String(a.title),'id'));
  if(state.sort === 'newest') items.sort((a,b)=>(Date.parse(b.date)||0)-(Date.parse(a.date)||0));
  return items;
}
function render(){
  const items = filteredItems();
  grid.setAttribute('aria-busy','false');
  empty.hidden = items.length > 0;
  document.querySelector('#result-count').textContent = `${items.length} dari ${state.items.length} koleksi${state.filter === 'Semua' ? ' siap dijelajahi' : ' · ' + (names[state.filter] || state.filter)}`;
  document.querySelector('#reset-filters').hidden = !state.query && state.filter === 'Semua' && state.sort === 'featured';
  grid.innerHTML = items.map(item=>{
    const index = state.items.indexOf(item);
    const image = safeURL(item.image), url = safeURL(item.url);
    const external = item.newTab !== false;
    return `<article class="adventure-card" id="collection-${index}" tabindex="-1"><div class="card-image"><span class="image-symbol" aria-hidden="true">${symbols[item.category] || '✦'}</span>${image ? `<img src="${escapeHTML(image)}" alt="" loading="lazy" decoding="async">` : ''}<span class="category-chip">${symbols[item.category] || '✦'} ${escapeHTML(names[item.category] || item.category)}</span><span class="card-number">${String(index+1).padStart(2,'0')} / EXPLORE</span></div><div class="card-body"><div class="card-meta"><span>${escapeHTML(item.level || 'Semua tingkat')}</span><span aria-hidden="true">·</span><span>${escapeHTML(item.duration || 'Belajar mandiri')}</span></div><h3>${escapeHTML(item.title)}</h3><p>${escapeHTML(item.description)}</p>${tagsOf(item).length ? `<div class="card-tags">${tagsOf(item).map(tag=>`<span>${escapeHTML(tag)}</span>`).join('')}</div>` : ''}${url ? `<a class="card-cta" href="${escapeHTML(url)}" ${external ? 'target="_blank" rel="noopener noreferrer"' : ''} aria-label="${escapeHTML(item.cta || 'Mulai belajar')}: ${escapeHTML(item.title)}${external ? ' (tab baru)' : ''}"><span>${escapeHTML(item.cta || 'Mulai belajar')}</span><span aria-hidden="true">↗</span></a>` : '<span class="card-cta">Tautan belum tersedia</span>'}</div></article>`;
  }).join('');
  grid.querySelectorAll('img').forEach(img=>img.addEventListener('error',()=>img.remove(),{once:true}));
}
function reset(){state.query='';state.sort='featured';search.value='';sort.value='featured';setFilter('Semua');}
async function loadData(){
  grid.setAttribute('aria-busy','true');
  grid.innerHTML='<div class="loading-card">Memuat koleksi…</div>';
  try{
    const response = await fetch('./data/koleksi.json',{cache:'no-store'});
    if(!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const items = Array.isArray(data) ? data : data.items;
    if(!Array.isArray(items)) throw new Error('Format koleksi tidak valid');
    state.items = items.filter(item=>item && typeof item === 'object');
    document.querySelector('#total-collections').textContent=String(state.items.length).padStart(2,'0');
    document.querySelectorAll('[data-count]').forEach(el=>el.textContent=`${state.items.filter(item=>item.category === el.dataset.count).length} koleksi`);
    document.querySelector('#surprise-button').disabled = !state.items.length;
    render();
  }catch(error){
    grid.setAttribute('aria-busy','false');empty.hidden=true;
    document.querySelector('#result-count').textContent='Koleksi belum dapat dimuat.';
    grid.innerHTML='<div class="loading-card"><p>Koneksi sedang bermasalah. Coba muat koleksi kembali.</p><button type="button" class="button button-ghost" id="retry-button">Coba lagi ↻</button></div>';
    document.querySelector('#retry-button').addEventListener('click',loadData);
    console.error('Gagal memuat koleksi:',error);
  }
}
filterButtons.forEach(button=>button.addEventListener('click',()=>setFilter(button.dataset.filter)));
document.querySelectorAll('[data-category-link]').forEach(link=>link.addEventListener('click',()=>setFilter(link.dataset.categoryLink)));
search.addEventListener('input',()=>{state.query=search.value.trim();render();});
sort.addEventListener('change',()=>{state.sort=sort.value;render();});
document.querySelector('#reset-filters').addEventListener('click',reset);
document.querySelector('#empty-reset').addEventListener('click',reset);
document.addEventListener('keydown',event=>{if(event.key==='/' && !event.ctrlKey && !event.metaKey && !event.altKey && !event.target.closest?.('input,textarea,select,[contenteditable]')){event.preventDefault();search.focus();}});
let toastTimer;
document.querySelector('#surprise-button').addEventListener('click',()=>{
  if(!state.items.length) return;
  reset();
  const index = Math.floor(Math.random()*state.items.length);
  const card = document.querySelector(`#collection-${index}`);
  card.classList.add('is-highlighted');card.focus({preventScroll:true});
  card.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',block:'center'});
  const toast=document.querySelector('#toast');toast.textContent=`Pilihan untukmu: ${state.items[index].title}`;toast.hidden=false;
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>{toast.hidden=true;card.classList.remove('is-highlighted');},4500);
});
loadData();
