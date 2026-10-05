'use strict';

/* Data asli tidak diubah; track adalah nomor lokal sesuai urutan sumber. */
const CATEGORIES = [
  {key:'Worksheet',name:'Worksheet',icon:'worksheet',color:'#FFD45D'},
  {key:'MPI',name:'Media Interaktif',icon:'mpi',color:'#94DDC9'},
  {key:'Game',name:'Game Edukasi',icon:'game',color:'#FFADAE'},
  {key:'Lab Maya',name:'Lab Maya',icon:'lab',color:'#B8DDA1'},
  {key:'Aplikasi',name:'Aplikasi',icon:'app',color:'#AFCFFF'},
  {key:'Modul Ajar',name:'Modul Ajar',icon:'module',color:'#D2C1EE'}
];
const FALLBACK_CATEGORY = {name:'Koleksi belajar',icon:'record',color:'#FFD45D'};
const state = {items:[],results:[],filter:'Semua',query:'',sort:'featured',active:0,status:'loading'};
const $ = selector => document.querySelector(selector);
const els = {
  search:$('#search'),sort:$('#sort'),filters:$('#filters'),reset:$('#reset-filters'),
  grid:$('#collection-grid'),carousel:$('#album-carousel'),shell:$('#carousel-shell'),
  loading:$('#loading-state'),error:$('#error-state'),empty:$('#empty-state'),
  counter:$('#carousel-counter'),previous:$('#previous-button'),next:$('#next-button'),
  dots:$('#progress-dots'),playing:$('#now-playing'),tracks:$('#tracklist-items'),
  surprise:$('#surprise-button'),toast:$('#toast'),fan:$('#hero-fan')
};
const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
let panelTimer = 0, toastTimer = 0, shuffleToken = 0, loadToken = 0;
let gesture = null, suppressClickUntil = 0, pendingHash = readAlbumHash();

// Setiap nilai data yang ditampilkan melewati escapeHTML; URL selalu divalidasi.
function escapeHTML(value=''){
  return String(value ?? '').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}
function safeURL(value){
  if(typeof value !== 'string' || !value.trim()) return '';
  try{const url = new URL(value,document.baseURI);return ['http:','https:'].includes(url.protocol) ? url.href : '';}catch{return '';}
}
const icon = name => `<svg class="icon" aria-hidden="true"><use href="#icon-${name}"/></svg>`;
const tagsOf = item => Array.isArray(item.tags) ? item.tags : [];
const titleOf = item => String(item.title || 'Koleksi tanpa judul');
const categoryOf = item => CATEGORIES.find(c=>c.key === item.category) || FALLBACK_CATEGORY;
const pad = number => String(number).padStart(2,'0');
function isNew(item){
  const date = Date.parse(item.date), age = Date.now()-date;
  return Number.isFinite(date) && age >= 0 && age <= 30*24*60*60*1000;
}
function readAlbumHash(){const match=location.hash.match(/^#album-(\d+)$/);return match ? Number(match[1]) : null;}
function saveAlbumHash(entry){
  try{history.replaceState(null,'',`${location.pathname}${location.search}#album-${entry.track}`);}catch{/* Navigasi koleksi tetap berjalan bila history dibatasi. */}
}
function scrollRack(){
  $('#koleksi').scrollIntoView({behavior:motion.matches ? 'auto':'smooth',block:'start'});
  els.fan.classList.add('is-docked');
}
function showToast(message){
  clearTimeout(toastTimer);
  els.toast.innerHTML = escapeHTML(message);
  els.toast.hidden = false;
  toastTimer = setTimeout(()=>{els.toast.hidden=true;},4800);
}
function cancelShuffle(){
  shuffleToken++;
  els.carousel.classList.remove('is-shuffling');
  els.surprise.removeAttribute('aria-busy');
  els.surprise.disabled = state.status !== 'ready' || !state.items.length;
}
function filteredItems(){
  const words = state.query.toLocaleLowerCase('id').split(/\s+/).filter(Boolean);
  const entries = state.items.filter(({item})=>{
    const text = `${item.title || ''} ${item.description || ''} ${item.category || ''} ${categoryOf(item).name} ${item.level || ''} ${tagsOf(item).join(' ')}`.toLocaleLowerCase('id');
    return (state.filter === 'Semua' || item.category === state.filter) && words.every(word=>text.includes(word));
  });
  if(state.sort==='az') entries.sort((a,b)=>titleOf(a.item).localeCompare(titleOf(b.item),'id'));
  if(state.sort==='za') entries.sort((a,b)=>titleOf(b.item).localeCompare(titleOf(a.item),'id'));
  if(state.sort==='newest') entries.sort((a,b)=>(Date.parse(b.item.date)||0)-(Date.parse(a.item.date)||0));
  return entries;
}
function renderGenres(){
  const genres = [{key:'Semua',name:'Semua wahana',icon:'record',color:'#FFD45D'},...CATEGORIES];
  els.filters.innerHTML = genres.map(category=>{
    const count = category.key==='Semua' ? state.items.length : state.items.filter(({item})=>item.category===category.key).length;
    const active = state.filter === category.key;
    const countLabel = state.status==='loading' ? '—' : count;
    const vacant = state.status==='ready' && count===0;
    return `<button class="genre-chip${active?' is-active':''}${vacant?' is-empty':''}" type="button" data-filter="${escapeHTML(category.key)}" aria-pressed="${active}" aria-label="${escapeHTML(category.name)}${state.status==='ready'?`, ${count} koleksi${vacant?', belum ada koleksi':''}`:''}" style="--genre-color:${category.color}">${icon(category.icon)}<span>${escapeHTML(category.name)}</span><span class="genre-count">${countLabel}</span></button>`;
  }).join('');
}
function generativeCover(entry,compact=false){
  const {item,track} = entry, category=categoryOf(item);
  const image = safeURL(item.image);
  return `<div class="generative-cover pattern-${category.icon}" style="--genre-color:${category.color}"><span class="cover-emblem">${icon(category.icon)}</span></div>${image?`<img class="album-image" data-image-url="${escapeHTML(image)}" alt="" loading="lazy" decoding="async" draggable="false">`:''}<span class="cover-category">${escapeHTML(category.name)}</span>${!compact && isNew(item)?'<span class="new-badge">Baru</span>':''}<span class="cover-title"><strong>${escapeHTML(titleOf(item))}</strong><span class="cover-track">Misi<br>${pad(track)}</span></span>`;
}
function armImages(container){
  container.querySelectorAll('img[data-image-url]').forEach(img=>{
    img.addEventListener('error',()=>img.remove(),{once:true});
    img.src = img.dataset.imageUrl;
    img.removeAttribute('data-image-url');
  });
}
// Maskot asli adalah elemen tetap; pemuatan data tidak mengganti gambar hero.
function renderHero(){
  els.fan.querySelectorAll('img').forEach(img=>{img.draggable=false;});
}
function renderSlides(){
  els.grid.innerHTML = state.results.map((entry,index)=>{
    const {item,track}=entry, category=categoryOf(item), url=safeURL(item.url);
    const attributes=url ? `href="${escapeHTML(url)}"${item.newTab!==false?' target="_blank" rel="noopener noreferrer"':''}` : 'type="button"';
    const tag=url?'a':'button';
    return `<div class="album-slide is-hidden" id="album-${track}" role="group" aria-roledescription="slide" aria-label="${index+1} dari ${state.results.length}" aria-hidden="true" data-index="${index}" style="--genre-color:${category.color}"><div class="vinyl-wrap" aria-hidden="true"><div class="vinyl"><span class="vinyl-label">${icon(category.icon)}</span></div></div><${tag} class="sleeve" ${attributes} tabindex="-1" aria-label="${escapeHTML(titleOf(item))}${url?', buka koleksi'+(item.newTab!==false?' di tab baru':''):', tautan belum tersedia'}" draggable="false">${generativeCover(entry)}<span class="sleeve-label" aria-hidden="true">${icon(url?'play':'record')}</span></${tag}></div>`;
  }).join('');
}
function renderTracklist(){
  els.tracks.innerHTML = state.results.map((entry,index)=>{
    const category = categoryOf(entry.item);
    return `<li><button class="track-button" type="button" data-track-index="${index}" aria-label="Pusatkan misi ${pad(entry.track)}: ${escapeHTML(titleOf(entry.item))}" aria-current="false"><span class="track-number">Misi ${pad(entry.track)}</span><span class="track-title">${escapeHTML(titleOf(entry.item))}</span><span class="track-genre">${icon(category.icon)}${escapeHTML(category.name)}</span><span class="track-duration">${escapeHTML(entry.item.duration || 'Durasi fleksibel')}</span>${icon('arrow')}</button></li>`;
  }).join('');
  $('#tracklist-count').innerHTML=state.status==='ready' ? `${state.results.length} koleksi` : '';
  const placeholder=$('#tracklist-placeholder');
  placeholder.hidden=state.results.length>0;
  if(state.status==='ready') placeholder.innerHTML=escapeHTML(state.items.length ? 'Tidak ada koleksi dalam hasil pilihan ini.' : 'Tracklist akan terisi ketika koleksi tersedia.');
}
function renderDots(){
  const total=state.results.length;
  const size=Math.min(total,7);
  const first=Math.max(0,Math.min(state.active-3,total-size));
  els.dots.hidden=total<=1;
  els.dots.innerHTML=Array.from({length:size},(_,i)=>{
    const index=first+i;
    return `<button class="progress-dot" type="button" data-dot-index="${index}" aria-label="Koleksi ${index+1} dari ${total}: ${escapeHTML(titleOf(state.results[index].item))}" aria-current="${index===state.active}"></button>`;
  }).join('');
}
function panelMarkup(entry){
  const {item,track}=entry, category=categoryOf(item), url=safeURL(item.url), external=item.newTab!==false;
  const action = url ? `<a class="button primary" id="active-cta" href="${escapeHTML(url)}"${external?' target="_blank" rel="noopener noreferrer"':''} aria-label="${escapeHTML(item.cta || 'Mainkan')}: ${escapeHTML(titleOf(item))}${external?' (tab baru)':''}">${icon('play')}<span>${escapeHTML(item.cta || 'Mainkan')}</span></a><small>${external?'Dibuka di tab baru':'Dibuka di tab ini'}</small>` : '<span class="unavailable-link">Tautan belum tersedia</span>';
  return `<div class="now-layout"><div class="now-track"><span class="now-label">PETUALANGAN PILIHANMU</span><strong>${pad(track)}</strong><span>Misi belajar</span></div><div class="now-copy"><h3 id="now-playing-title">${escapeHTML(titleOf(item))}</h3><p class="now-description">${escapeHTML(item.description || 'Deskripsi belum tersedia untuk koleksi ini.')}</p><div class="now-meta"><span><strong>Wahana:</strong> ${escapeHTML(category.name)}</span><span><strong>Tingkat:</strong> ${escapeHTML(item.level || 'Semua tingkat')}</span><span><strong>Durasi:</strong> ${escapeHTML(item.duration || 'Fleksibel')}</span></div>${tagsOf(item).length?`<div class="now-tags" aria-label="Tag koleksi">${tagsOf(item).map(tag=>`<span class="tag-sticker">${escapeHTML(tag)}</span>`).join('')}</div>`:''}</div><div class="now-action">${action}</div></div>`;
}
function renderPanel({immediate=false}={}){
  clearTimeout(panelTimer);
  const entry=state.results[state.active];
  if(!entry){els.playing.innerHTML='';els.playing.classList.remove('is-changing');return;}
  const update=()=>{els.playing.innerHTML=panelMarkup(entry);els.playing.classList.remove('is-changing');};
  if(immediate || motion.matches || !els.playing.innerHTML) update();
  else{els.playing.classList.add('is-changing');panelTimer=setTimeout(update,130);}
}
function updateActive({saveHash=true,panel=true,immediate=false}={}){
  const count=state.results.length;
  if(!count) return;
  const oldFocus=document.activeElement?.closest?.('.album-slide');
  els.grid.querySelectorAll('.album-slide').forEach((slide,index)=>{
    let offset=index-state.active;
    if(count===3){if(offset>1)offset-=3;if(offset< -1)offset+=3;}
    const distance=Math.abs(offset),active=distance===0,near=distance<=2;
    slide.style.setProperty('--offset',offset);
    slide.style.setProperty('--scale',active?'1':distance===1?'.8':'.62');
    slide.style.setProperty('--tilt',`${offset===0?0:offset>0?-32:32}deg`);
    slide.style.setProperty('--slide-opacity',active?'1':distance===1?'.78':distance===2?'.48':'0');
    slide.style.setProperty('--layer',100-distance);
    slide.classList.toggle('is-active',active);
    slide.classList.toggle('is-near',near);
    slide.classList.toggle('is-hidden',!near);
    slide.setAttribute('aria-hidden',String(!active));
    slide.querySelector('.sleeve').tabIndex=active?0:-1;
    if(near) armImages(slide);
  });
  // Pindahkan fokus dari sampul lama ke sampul aktif agar tidak terjebak pada slide tersembunyi.
  if(oldFocus && Number(oldFocus.dataset.index)!==state.active) els.grid.querySelector('.is-active .sleeve').focus({preventScroll:true});
  els.counter.innerHTML=`${pad(state.active+1)} / ${pad(count)}`;
  els.previous.hidden=count<=1;els.next.hidden=count<=1;
  els.previous.disabled=state.active===0;els.next.disabled=state.active===count-1;
  els.tracks.querySelectorAll('[data-track-index]').forEach((button,index)=>button.setAttribute('aria-current',String(index===state.active)));
  renderDots();
  if(panel) renderPanel({immediate});
  if(saveHash) saveAlbumHash(state.results[state.active]);
}
function goTo(index,{fromShuffle=false,panel=true,focus=false}={}){
  if(!state.results.length) return;
  if(!fromShuffle) cancelShuffle();
  state.active=Math.max(0,Math.min(state.results.length-1,index));
  updateActive({panel});
  if(focus) els.carousel.focus({preventScroll:true});
}
function renderView({desiredTrack=null,saveHash=true}={}){
  cancelShuffle();
  const previousTrack=desiredTrack ?? state.results[state.active]?.track;
  state.results=state.status==='ready' ? filteredItems() : [];
  const found=state.results.findIndex(entry=>entry.track===previousTrack);
  state.active=found>=0?found:0;
  const ready=state.status==='ready', hasResults=state.results.length>0;
  els.loading.hidden=state.status!=='loading';
  els.error.hidden=state.status!=='error';
  els.empty.hidden=!ready || hasResults;
  els.shell.hidden=!ready || !hasResults;
  els.grid.setAttribute('aria-busy',String(state.status==='loading'));
  els.search.disabled=!ready;els.sort.disabled=!ready;
  els.reset.disabled=!ready || (!state.query && state.filter==='Semua' && state.sort==='featured');
  els.surprise.disabled=!ready || !state.items.length;
  renderGenres();renderSlides();renderTracklist();
  $('#result-count').innerHTML=ready ? `${state.results.length} dari ${state.items.length} koleksi${state.filter==='Semua'?'':` · ${escapeHTML(CATEGORIES.find(c=>c.key===state.filter)?.name || state.filter)}`}` : '';
  if(!state.items.length && ready){
    $('#empty-title').innerHTML='Arena ini menunggu petualangan pertamanya.';
    $('#empty-text').innerHTML='Koleksi akan tampil di sini setelah tersedia.';
    $('#empty-reset').hidden=true;
  }else{
    $('#empty-title').innerHTML='Belum ada petualangan yang cocok.';
    $('#empty-text').innerHTML='Coba kata kunci lain atau buka semua wahana.';
    $('#empty-reset').hidden=false;
  }
  clearTimeout(panelTimer);
  if(hasResults) updateActive({saveHash,immediate:true});
  else{els.playing.innerHTML='';els.playing.classList.remove('is-changing');}
}
function reset({desiredTrack=null}={}){
  state.query='';state.sort='featured';state.filter='Semua';els.search.value='';els.sort.value='featured';
  renderView({desiredTrack});
}
async function loadData(){
  const token=++loadToken;
  state.status='loading';renderView({saveHash:false});
  try{
    const response=await fetch('./data/koleksi.json',{cache:'no-store'});
    if(!response.ok) throw new Error(`HTTP ${response.status}`);
    const data=await response.json();
    const items=Array.isArray(data)?data:data?.items;
    if(!Array.isArray(items)) throw new Error('Format koleksi tidak valid');
    if(token!==loadToken) return;
    state.items=items.filter(item=>item && typeof item==='object' && !Array.isArray(item)).map((item,index)=>({item,track:index+1}));
    state.status='ready';
    $('#total-collections').innerHTML=pad(state.items.length);
    $('#total-genres').innerHTML=pad(new Set(state.items.filter(({item})=>CATEGORIES.some(c=>c.key===item.category)).map(({item})=>item.category)).size);
    renderHero();
    const validHash=state.items.some(entry=>entry.track===pendingHash);
    renderView({desiredTrack:validHash?pendingHash:null,saveHash:validHash || !location.hash || pendingHash!==null});
    if(validHash) scrollRack();
    pendingHash=null;
  }catch(error){
    if(token!==loadToken) return;
    state.status='error';renderView({saveHash:false});
    $('#total-collections').innerHTML='—';$('#total-genres').innerHTML='—';
    console.error('Koleksi belum berhasil dimuat:',error);
  }
}

/* Pointer Events: pan-y mempertahankan gulir vertikal; swipe horizontal tidak membuka link. */
els.grid.addEventListener('pointerdown',event=>{
  if(!event.isPrimary || (event.pointerType==='mouse' && event.button!==0) || state.results.length<2) return;
  gesture={id:event.pointerId,x:event.clientX,y:event.clientY,dx:0,dy:0};
});
els.grid.addEventListener('pointermove',event=>{
  if(!gesture || event.pointerId!==gesture.id) return;
  gesture.dx=event.clientX-gesture.x;gesture.dy=event.clientY-gesture.y;
  if(Math.abs(gesture.dx)>Math.abs(gesture.dy) && Math.abs(gesture.dx)>12){
    if(!els.grid.hasPointerCapture?.(event.pointerId)) els.grid.setPointerCapture?.(event.pointerId);
  }
});
function finishGesture(event){
  if(!gesture || event.pointerId!==gesture.id) return;
  const dx=event.clientX-gesture.x,dy=event.clientY-gesture.y;
  if(event.type==='pointerup' && Math.abs(dx)>=40 && Math.abs(dx)>Math.abs(dy)*1.2){
    suppressClickUntil=Date.now()+400;goTo(state.active+(dx<0?1:-1));
  }
  if(els.grid.hasPointerCapture?.(event.pointerId)) els.grid.releasePointerCapture(event.pointerId);
  gesture=null;
}
els.grid.addEventListener('pointerup',finishGesture);
els.grid.addEventListener('pointercancel',finishGesture);
els.grid.addEventListener('lostpointercapture',()=>{gesture=null;});
els.grid.addEventListener('click',event=>{
  const slide=event.target.closest('.album-slide');
  if(!slide) return;
  if(Date.now()<suppressClickUntil){event.preventDefault();return;}
  const index=Number(slide.dataset.index);
  if(index!==state.active){event.preventDefault();goTo(index,{focus:true});}
  else if(!safeURL(state.results[index].item.url)){event.preventDefault();showToast('Tautan belum tersedia untuk koleksi ini.');}
});
els.grid.addEventListener('dragstart',event=>event.preventDefault());
els.carousel.addEventListener('keydown',event=>{
  if(event.altKey || event.ctrlKey || event.metaKey) return;
  const keys={ArrowLeft:state.active-1,ArrowRight:state.active+1,Home:0,End:state.results.length-1};
  if(Object.prototype.hasOwnProperty.call(keys,event.key)){event.preventDefault();goTo(keys[event.key]);}
  else if(event.key==='Enter' && event.target===els.carousel){
    event.preventDefault();const link=els.grid.querySelector('.is-active .sleeve');if(link)link.click();
  }
});
els.previous.addEventListener('click',()=>goTo(state.active-1));
els.next.addEventListener('click',()=>goTo(state.active+1));
els.dots.addEventListener('click',event=>{const button=event.target.closest('[data-dot-index]');if(button)goTo(Number(button.dataset.dotIndex),{focus:true});});
els.tracks.addEventListener('click',event=>{const button=event.target.closest('[data-track-index]');if(button){goTo(Number(button.dataset.trackIndex),{focus:true});scrollRack();}});
els.filters.addEventListener('click',event=>{const button=event.target.closest('[data-filter]');if(button && state.status==='ready'){state.filter=button.dataset.filter;renderView();els.filters.querySelector('[aria-pressed="true"]').focus({preventScroll:true});}});
els.search.addEventListener('input',()=>{state.query=els.search.value.trim();renderView();});
els.sort.addEventListener('change',()=>{state.sort=els.sort.value;renderView();});
els.reset.addEventListener('click',()=>reset());
$('#empty-reset').addEventListener('click',()=>reset());
$('#retry-button').addEventListener('click',loadData);
$('#explore-button').addEventListener('click',()=>els.fan.classList.add('is-docked'));
document.addEventListener('keydown',event=>{
  if(event.key==='/' && !event.ctrlKey && !event.metaKey && !event.altKey && !event.target.closest?.('input,textarea,select,[contenteditable]') && !els.search.disabled){event.preventDefault();els.search.focus();}
});
window.addEventListener('hashchange',()=>{
  const track=readAlbumHash();
  if(state.status!=='ready'){pendingHash=track;return;}
  if(!state.items.some(entry=>entry.track===track)) return;
  const index=state.results.findIndex(entry=>entry.track===track);
  if(index>=0)goTo(index,{focus:true});else{reset({desiredTrack:track});els.carousel.focus({preventScroll:true});}
  scrollRack();
});
const pause = ms => new Promise(resolve=>setTimeout(resolve,ms));
els.surprise.addEventListener('click',async()=>{
  if(!state.items.length) return;
  if(!state.results.length) reset();
  cancelShuffle();const token=shuffleToken;
  els.surprise.disabled=true;els.surprise.setAttribute('aria-busy','true');
  const target=Math.floor(Math.random()*state.results.length);
  scrollRack();
  if(!motion.matches && state.results.length>1){
    els.carousel.classList.add('is-shuffling');
    for(let i=0;i<8;i++){
      if(token!==shuffleToken) return;
      state.active=(state.active+1)%state.results.length;
      updateActive({saveHash:false,panel:false});
      await pause(85+i*9);
      if(motion.matches)break;
    }
  }
  if(token!==shuffleToken) return;
  state.active=target;updateActive({immediate:true});
  els.carousel.classList.remove('is-shuffling');
  els.surprise.disabled=false;els.surprise.removeAttribute('aria-busy');
  els.carousel.focus({preventScroll:true});
  showToast(`Pilihan untukmu: ${titleOf(state.results[target].item)}. Tekan Mainkan untuk membuka koleksinya.`);
});

// Observer tidak menjadi syarat akses konten; tanpa dukungan semua bagian langsung terlihat.
if('IntersectionObserver' in window && !motion.matches){
  const entrance=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('is-visible');entrance.unobserve(entry.target);}}),{threshold:.08});
  document.querySelectorAll('[data-reveal]').forEach(element=>{element.classList.add('reveal-ready');entrance.observe(element);});
  const docking=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.intersectionRatio<=.45 && entry.boundingClientRect.top<0)){els.fan.classList.add('is-docked');docking.disconnect();}},{threshold:[0,.45]});
  docking.observe($('.hero'));
}
function motionChanged(){
  if(motion.matches){
    document.querySelectorAll('.reveal-ready').forEach(element=>element.classList.add('is-visible'));
    clearTimeout(panelTimer);if(state.results.length)renderPanel({immediate:true});
  }
}
if(motion.addEventListener)motion.addEventListener('change',motionChanged);
else if(motion.addListener)motion.addListener(motionChanged);
loadData();
