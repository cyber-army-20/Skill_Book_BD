/* Skill & Book BD — catalog logic
   Handles: fetch, rendering, conditional badges, search filter,
   single-product query-param view, description toggle, share links. */

const state = {
  products: [],
  categories: [],
  selectedCategory: 'All',
  selectedPriceType: 'All',
  searchQuery: '',
};

const els = {
  grid: document.getElementById('productGrid'),
  gridView: document.getElementById('gridView'),
  singleView: document.getElementById('singleView'),
  search: document.getElementById('searchInput'),
  empty: document.getElementById('emptyState'),
  loading: document.getElementById('loadingState'),
  resultCount: document.getElementById('resultCount'),
  toast: document.getElementById('toast'),
  menuToggle: document.getElementById('menuToggle'),
  categoryPanel: document.getElementById('categoryPanel'),
  categoryListView: document.getElementById('categoryListView'),
  categoryList: document.getElementById('categoryList'),
  priceTypeView: document.getElementById('priceTypeView'),
  backToCategories: document.getElementById('backToCategories'),
  activeCategoryLabel: document.getElementById('activeCategoryLabel'),
  filterBar: document.getElementById('filterBar'),
  filterBarText: document.getElementById('filterBarText'),
  filterBarReset: document.getElementById('filterBarReset'),
};

document.getElementById('year').textContent = new Date().getFullYear();

init();

async function init() {
  try {
    const [productsRes, categoriesRes] = await Promise.all([
      fetch('products.json'),
      fetch('categories.json'),
    ]);
    if (!productsRes.ok) throw new Error('Failed to load products.json');
    state.products = await productsRes.json();
    state.categories = categoriesRes.ok ? await categoriesRes.json() : [];
    els.loading.classList.add('hidden');
    buildCategoryMenu();
    route();
  } catch (err) {
    els.loading.textContent = 'Could not load the catalog. Please refresh the page.';
    console.error(err);
  }

  els.search.addEventListener('input', onSearch);
  document.getElementById('logoLink').addEventListener('click', (e) => {
    e.preventDefault();
    resetAllFilters();
    clearProductParam();
    route();
  });

  // Hamburger menu open/close
  els.menuToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = !els.categoryPanel.classList.contains('hidden');
    if (isOpen) {
      closeCategoryPanel();
    } else {
      openCategoryPanel();
    }
  });

  // Close panel when clicking outside it
  document.addEventListener('click', (e) => {
    if (!els.categoryPanel.contains(e.target) && e.target !== els.menuToggle) {
      closeCategoryPanel();
    }
  });

  // Back button: price-type screen -> category screen
  els.backToCategories.addEventListener('click', () => {
    els.priceTypeView.classList.add('hidden');
    els.categoryListView.classList.remove('hidden');
  });

  // Price-type buttons (event delegation)
  els.priceTypeView.addEventListener('click', (e) => {
    const btn = e.target.closest('.pricetype-btn');
    if (!btn) return;
    state.selectedPriceType = btn.dataset.pricetype;
    closeCategoryPanel();
    applyFilters();
  });

  // Clear-filter button on the status bar
  els.filterBarReset.addEventListener('click', () => {
    resetAllFilters();
    applyFilters();
  });
}

/* ---------- Category menu ---------- */

function buildCategoryMenu() {
  const allCategories = ['All', ...state.categories];
  els.categoryList.innerHTML = allCategories
    .map(
      (cat) => `
      <li>
        <button data-category="${escapeAttr(cat)}"
          class="category-btn w-full text-left px-4 py-2.5 text-sm hover:bg-navy2 transition-colors">
          ${escapeHtml(cat)}
        </button>
      </li>`
    )
    .join('');

  els.categoryList.querySelectorAll('.category-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.selectedCategory = btn.dataset.category;
      state.selectedPriceType = 'All';
      els.activeCategoryLabel.textContent = state.selectedCategory;
      els.categoryListView.classList.add('hidden');
      els.priceTypeView.classList.remove('hidden');
    });
  });
}

function openCategoryPanel() {
  els.categoryPanel.classList.remove('hidden');
  els.menuToggle.setAttribute('aria-expanded', 'true');
}

function closeCategoryPanel() {
  els.categoryPanel.classList.add('hidden');
  els.menuToggle.setAttribute('aria-expanded', 'false');
  // Always reset back to the category list for the next time it's opened
  els.priceTypeView.classList.add('hidden');
  els.categoryListView.classList.remove('hidden');
}

function resetAllFilters() {
  state.selectedCategory = 'All';
  state.selectedPriceType = 'All';
  els.search.value = '';
  state.searchQuery = '';
}

/* ---------- Combined filtering ---------- */

function getFilteredProducts() {
  const q = state.searchQuery;
  return state.products.filter((p) => {
    const matchesCategory = state.selectedCategory === 'All' || p.category === state.selectedCategory;
    const matchesPriceType =
      state.selectedPriceType === 'All' ||
      (p.price_type || '').toLowerCase() === state.selectedPriceType.toLowerCase();
    const matchesSearch =
      !q ||
      (p.title || '').toLowerCase().includes(q) ||
      (p.description || '').toLowerCase().includes(q);
    return matchesCategory && matchesPriceType && matchesSearch;
  });
}

function applyFilters() {
  clearProductParam();
  els.singleView.classList.add('hidden');
  els.gridView.classList.remove('hidden');
  updateFilterBar();
  renderGrid(getFilteredProducts());
}

function updateFilterBar() {
  const parts = [];
  if (state.selectedCategory !== 'All') parts.push(state.selectedCategory);
  if (state.selectedPriceType !== 'All') parts.push(state.selectedPriceType);

  if (!parts.length) {
    els.filterBar.classList.add('hidden');
    return;
  }
  els.filterBar.classList.remove('hidden');
  els.filterBarText.textContent = parts.join(' · ');
}

/* ---------- Routing: grid vs single product ---------- */

function route() {
  const params = new URLSearchParams(window.location.search);
  const productId = params.get('product');

  if (productId) {
    const product = state.products.find((p) => String(p.id) === String(productId));
    if (product) {
      renderSingle(product);
      return;
    }
  }
  renderGrid(getFilteredProducts());
}

function clearProductParam() {
  const url = new URL(window.location.href);
  url.searchParams.delete('product');
  window.history.pushState({}, '', url);
}

/* ---------- Search ---------- */

function onSearch(e) {
  state.searchQuery = e.target.value.trim().toLowerCase();
  applyFilters();
}

/* ---------- Rendering: Grid ---------- */

function renderGrid(list) {
  els.singleView.classList.add('hidden');
  els.gridView.classList.remove('hidden');
  els.grid.innerHTML = '';

  els.resultCount.textContent = list.length
    ? `${list.length} item${list.length === 1 ? '' : 's'}`
    : '';

  if (!list.length) {
    els.empty.classList.remove('hidden');
    return;
  }
  els.empty.classList.add('hidden');

  list.forEach((product) => {
    els.grid.appendChild(buildCard(product));
  });
}

function buildCard(product) {
  const card = document.createElement('article');
  card.className = 'fade-in bg-white rounded-2xl overflow-hidden shadow-sm ring-1 ring-ink/5 flex flex-col hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200';

  const hasDiscount = isPresent(product.discounted_price);
  const hasPromo = isPresent(product.promo_code);

  card.innerHTML = `
    <div class="relative">
      <img src="${escapeAttr(product.image)}" alt="${escapeAttr(product.title)}"
           class="w-full h-44 object-cover" loading="lazy"
           onerror="this.src='https://placehold.co/600x400/132239/FBF7EE?text=Skill+%26+Book+BD'"/>
    </div>

    <div class="p-4 flex flex-col flex-1">
      <h3 class="font-display font-semibold text-base leading-snug mb-2 card-underline inline">
        ${escapeHtml(product.title)}
      </h3>

      <div class="flex items-center flex-wrap gap-2 mb-3">
        ${hasDiscount ? `
          <span class="text-lg font-bold text-teal">৳${formatPrice(product.discounted_price)}</span>
          <span class="text-sm text-ink/40 line-through">৳${formatPrice(product.original_price)}</span>
        ` : `
          <span class="text-lg font-bold text-ink">৳${formatPrice(product.original_price)}</span>
        `}
        ${hasPromo ? `
        <span class="bg-rose text-white text-[11px] font-semibold px-2.5 py-1 rounded-full tracking-wide">
          CODE: ${escapeHtml(product.promo_code)}
        </span>` : ''}
      </div>

      <div data-desc-panel class="text-sm text-ink/60 leading-relaxed mb-1">
        <p class="pb-3 border-t border-ink/10 pt-3">${escapeHtml(product.description || '')}</p>
      </div>

      <div class="mt-auto pt-3 flex items-center gap-2">
        <a href="${escapeAttr(product.affiliate_url)}" target="_blank" rel="noopener noreferrer"
           class="flex-1 text-center bg-gold hover:bg-goldSoft text-ink font-semibold text-sm rounded-full py-2 transition-colors">
          Buy Now
        </a>
        <button data-action="toggle-desc"
          class="w-9 h-9 shrink-0 rounded-full border border-ink/15 hover:border-navy hover:bg-navy hover:text-white flex items-center justify-center transition-colors" title="Description">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h16M4 18h10"/></svg>
        </button>
        <button data-action="share"
          class="w-9 h-9 shrink-0 rounded-full border border-ink/15 hover:border-navy hover:bg-navy hover:text-white flex items-center justify-center transition-colors" title="Share">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5 15.4 17.5M15.4 6.5 8.6 10.5"/></svg>
        </button>
      </div>
    </div>
  `;

  card.querySelector('h3').addEventListener('click', () => openSingle(product.id));
  card.querySelector('[data-action="toggle-desc"]').addEventListener('click', (e) => {
    e.stopPropagation();
    card.querySelector('[data-desc-panel]').classList.toggle('open');
  });
  card.querySelector('[data-action="share"]').addEventListener('click', (e) => {
    e.stopPropagation();
    shareProduct(product);
  });

  return card;
}

/* ---------- Rendering: Single product ---------- */

function renderSingle(product) {
  els.gridView.classList.add('hidden');
  els.singleView.classList.remove('hidden');

  const hasDiscount = isPresent(product.discounted_price);
  const hasPromo = isPresent(product.promo_code);

  els.singleView.innerHTML = `
    <button id="backBtn" class="flex items-center gap-2 text-sm text-navy hover:text-gold font-semibold mb-6 transition-colors">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m15 18-6-6 6-6"/></svg>
      Back to All Products
    </button>

    <div class="bg-white rounded-2xl shadow-sm ring-1 ring-ink/5 overflow-hidden grid md:grid-cols-2">
      <div class="relative">
        <img src="${escapeAttr(product.image)}" alt="${escapeAttr(product.title)}"
             class="w-full h-64 md:h-full object-cover"
             onerror="this.src='https://placehold.co/600x400/132239/FBF7EE?text=Skill+%26+Book+BD'"/>
      </div>

      <div class="p-6 sm:p-8 flex flex-col">
        <h1 class="font-display text-2xl sm:text-3xl font-semibold leading-tight mb-3">${escapeHtml(product.title)}</h1>

        <div class="flex items-center flex-wrap gap-3 mb-5">
          ${hasDiscount ? `
            <span class="text-2xl font-bold text-teal">৳${formatPrice(product.discounted_price)}</span>
            <span class="text-base text-ink/40 line-through">৳${formatPrice(product.original_price)}</span>
          ` : `
            <span class="text-2xl font-bold text-ink">৳${formatPrice(product.original_price)}</span>
          `}
          ${hasPromo ? `
          <span class="bg-rose text-white text-xs font-semibold px-3 py-1.5 rounded-full tracking-wide">
            CODE: ${escapeHtml(product.promo_code)}
          </span>` : ''}
        </div>

        <p class="text-sm text-ink/60 leading-relaxed mb-6">${escapeHtml(product.description || '')}</p>

        <div class="mt-auto flex flex-wrap items-center gap-3">
          <a href="${escapeAttr(product.affiliate_url)}" target="_blank" rel="noopener noreferrer"
             class="bg-gold hover:bg-goldSoft text-ink font-semibold text-sm rounded-full px-6 py-2.5 transition-colors">
            Buy Now
          </a>
          <button id="shareBtnSingle"
            class="flex items-center gap-2 border border-ink/15 hover:border-navy hover:bg-navy hover:text-white text-sm font-semibold rounded-full px-5 py-2.5 transition-colors">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5 15.4 17.5M15.4 6.5 8.6 10.5"/></svg>
            Share
          </button>
        </div>
      </div>
    </div>
  `;

  document.getElementById('backBtn').addEventListener('click', () => {
    clearProductParam();
    renderGrid(getFilteredProducts());
    updateFilterBar();
  });
  document.getElementById('shareBtnSingle').addEventListener('click', () => shareProduct(product));

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function openSingle(id) {
  const url = new URL(window.location.href);
  url.searchParams.set('product', id);
  window.history.pushState({}, '', url);
  route();
}

/* ---------- Share ---------- */

async function shareProduct(product) {
  const url = new URL(window.location.href);
  url.search = '';
  url.searchParams.set('product', product.id);
  const shareUrl = url.toString();

  if (navigator.share) {
    try {
      await navigator.share({ title: product.title, url: shareUrl });
      return;
    } catch (err) {
      // user cancelled or share failed — fall back to clipboard
    }
  }

  try {
    await navigator.clipboard.writeText(shareUrl);
    showToast('Link copied to clipboard!');
  } catch (err) {
    showToast(shareUrl);
  }
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.remove('hidden');
  els.toast.classList.remove('toast');
  void els.toast.offsetWidth; // restart animation
  els.toast.classList.add('toast');
  setTimeout(() => els.toast.classList.add('hidden'), 2000);
}

/* ---------- Helpers ---------- */

function isPresent(value) {
  return value !== null && value !== undefined && value !== '';
}

function formatPrice(value) {
  return Number(value).toLocaleString('en-IN');
}

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttr(str = '') {
  return String(str).replace(/"/g, '&quot;');
}

window.addEventListener('popstate', route);
