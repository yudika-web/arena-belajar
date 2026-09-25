const state = { items: [], filter: 'Semua', query: '', sort: 'featured' };
const grid = document.querySelector('#collection-grid');
const empty = document.querySelector('#empty-state');
const search = document.querySelector('#search');
const sort = document.querySelector('#sort');
const filterButtons = [...document.querySelectorAll('[data-filter]')];

const categoryEmoji = { Worksheet: '📝', MPI: '🧩', Game: '🎮', 'Lab Maya': '🧪' };
const escapeHTML = (value='') => String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

function setFilter(category){
  state.filter = category;
  filterButtons.forEach(btn => btn.classList.toggle('is-active', btn.dataset.filter === category));
  render();
}

function filteredItems(){
  let items = state.items.filter(item => {
    const matchesCategory = state.filter === 'Semua' || item.category === state.filter;
    const haystack = `${item.title} ${item.description} ${item.category} ${(item.tags || []).join(' ')}`.toLowerCase();
    return matchesCategory && haystack.includes(state.query.toLowerCase());
  });
  if(state.sort === 'az') items.sort((a,b)=>a.title.localeCompare(b.title,'id'));
  if(state.sort === 'za') items.sort((a,b)=>b.title.localeCompare(a.title,'id'));
  if(state.sort === 'newest') items.sort((a,b)=>new Date(b.date||0)-new Date(a.date||0));
  return items;
}

function render(){
  const items = filteredItems();
  empty.hidden = items.length !== 0;
  grid.innerHTML = items.map(item => {
    const image = item.image ? `<img src="${escapeHTML(item.image)}" alt="" loading="lazy">` : '';
    const target = item.newTab === false ? '' : 'target="_blank" rel="noopener"';
    return `<article class="adventure-card">
      <div class="card-image">${image}<span class="category-chip">${categoryEmoji[item.category] || '✦'} ${escapeHTML(item.category)}</span></div>
      <div class="card-body">
        <h3>${escapeHTML(item.title)}</h3>
        <p>${escapeHTML(item.description)}</p>
        <div class="card-meta"><span>${escapeHTML(item.level || 'SMP')}</span><span>•</span><span>${escapeHTML(item.duration || 'Belajar mandiri')}</span></div>
        <a class="card-cta" href="${escapeHTML(item.url || '#')}" ${target}><span>${escapeHTML(item.cta || 'Mulai misi')}</span><span>→</span></a>
      </div>
    </article>`;
  }).join('');
}

async function loadData(){
  try{
    const response = await fetch('./data/koleksi.json', {cache:'no-store'});
    if(!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    state.items = Array.isArray(data) ? data : data.items || [];
    render();
  }catch(error){
    console.error(error);
    grid.innerHTML = '<div class="loading-card">Koleksi belum dapat dimuat. Periksa file <strong>data/koleksi.json</strong>.</div>';
  }
}

filterButtons.forEach(btn => btn.addEventListener('click', () => setFilter(btn.dataset.filter)));
document.querySelectorAll('[data-category-link]').forEach(link => link.addEventListener('click', () => setFilter(link.dataset.categoryLink)));
search.addEventListener('input', e => {state.query = e.target.value.trim(); render();});
sort.addEventListener('change', e => {state.sort = e.target.value; render();});

loadData();
