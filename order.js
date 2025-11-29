const PRODUCT_CATALOG = [
  { id: 'coffee', title: 'Coffee', items: [
    { id: 'americano', name: 'Americano', priceStudent: 1.50, priceStaff: 2.00 },
    { id: 'espresso', name: 'Espresso', priceStudent: 1.30, priceStaff: 1.80 },
    { id: 'espresso-doppio', name: 'Espresso Doppio', priceStudent: 1.70, priceStaff: 2.20 },
    { id: 'cappuccino', name: 'Cappuccino', priceStudent: 2.50, priceStaff: 3.00 },
    { id: 'latte-macchiato', name: 'Latte Macchiato', priceStudent: 2.00, priceStaff: 2.50 },
    { id: 'cafe-latte', name: 'Cafe Latte', priceStudent: 2.70, priceStaff: 3.20 },
    { id: 'tea', name: 'Tea', priceStudent: 1.00, priceStaff: 1.50 },
    { id: 'pumpkin-spice', name: 'Pumpkin Spice Latte', priceStudent: 3.00, priceStaff: 3.50 },
    { id: 'cinnamon-bun-latte', name: 'Cinnamon Bun Latte', priceStudent: 3.00, priceStaff: 3.50 },
    { id: 'hot-chocolate', name: 'Hot Chocolate', priceStudent: 2.90, priceStaff: 3.40 }
  ]},
  { id: 'drinks', title: 'Drinks', items: [
    { id: 'softdrinks', name: 'Softdrinks', priceStudent: 1.50, priceStaff: 1.50 },
    { id: 'wasser', name: 'Water', priceStudent: 1.00, priceStaff: 1.00 },
    { id: 'redbull', name: 'RedBull', priceStudent: 2.00, priceStaff: 2.00 }
  ]},
  { id: 'addons', title: 'Add ons', items: [
    { id: 'togo', name: 'To Go', priceStudent: 0.20, priceStaff: 0.20 },
    { id: 'extra-shot', name: 'Extra Shot', priceStudent: 0.50, priceStaff: 0.50 },
    { id: 'syrup-pumpkin', name: 'Pumpkin Spice Syrup', priceStudent: 0.30, priceStaff: 0.30 },
    { id: 'syrup-hazelnut', name: 'Hazelnut Syrup', priceStudent: 0.30, priceStaff: 0.30 },
    { id: 'syrup-vanilla', name: 'Vanilla Syrup', priceStudent: 0.30, priceStaff: 0.30 },
    { id: 'syrup-spekuloos', name: 'Spekuloos Syrup', priceStudent: 0.30, priceStaff: 0.30 },
    { id: 'syrup-gingerbread', name: 'Gingerbread Syrup', priceStudent: 0.30, priceStaff: 0.30 }
  ]}
];

const CART_STORAGE_KEY = 'kcafe_cart_v1';
const ROLE_STORAGE_KEY = 'kcafe_role_v1';
const PFAND_STORAGE_KEY = 'kcafe_pfand_v1';
const PFAND_DEPOSIT = 2.00;

function getRole() {
  // Check if user is logged in via session manager
  if (window.sessionManager && window.sessionManager.isAuthenticated()) {
    return window.sessionManager.getUserType(); // Returns 'student' or 'staff'
  }
  // Fallback to localStorage
  return localStorage.getItem(ROLE_STORAGE_KEY) || 'student';
}

function setRole(role) {
  localStorage.setItem(ROLE_STORAGE_KEY, role);
}

function getPfandSetting() {
  return localStorage.getItem(PFAND_STORAGE_KEY) !== 'false';
}

function setPfandSetting(usePfand) {
  localStorage.setItem(PFAND_STORAGE_KEY, usePfand.toString());
}

function loadCart() { try { return JSON.parse(localStorage.getItem(CART_STORAGE_KEY)) || {}; } catch { return {}; } }
function saveCart(cart) { localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart)); }
function formatPrice(value) { return `€${value.toFixed(2)}`; }

function priceFor(item, role) {
  if (item.price !== undefined) return item.price; // backward compat
  return role === 'staff' ? (item.priceStaff ?? item.priceStudent) : (item.priceStudent ?? item.priceStaff);
}

let pendingCoffeeItem = null;

function isCoffeeItem(item) {
  // Tea should not show milk selection
  if (item.id === 'tea') return false;
  const coffeeCategory = PRODUCT_CATALOG.find(cat => cat.id === 'coffee');
  return coffeeCategory && coffeeCategory.items.some(coffee => coffee.id === item.id);
}

function showMilkModal(product) {
  const modal = document.getElementById('milkModal');
  const title = document.getElementById('milkModalTitle');
  if (!modal || !title) return;
  
  pendingCoffeeItem = product;
  title.textContent = `Customize ${product.name}`;
  modal.style.display = 'flex';
  
  // Reset selections
  document.querySelectorAll('.milk-option').forEach(opt => opt.classList.remove('selected'));
  document.querySelectorAll('.syrup-option').forEach(opt => opt.classList.remove('selected'));
  document.getElementById('noSyrupOption')?.classList.add('selected');
  
  // Close modal handlers
  const closeBtn = document.getElementById('milkModalClose');
  closeBtn?.addEventListener('click', () => {
    modal.style.display = 'none';
    pendingCoffeeItem = null;
  });
  
  // Milk option handlers
  const milkOptions = document.querySelectorAll('.milk-option');
  milkOptions.forEach(option => {
    option.onclick = () => {
      // Remove selected from all milk options
      milkOptions.forEach(opt => opt.classList.remove('selected'));
      // Add selected to clicked option
      option.classList.add('selected');
    };
  });
  
  // Syrup option handlers
  const syrupOptions = document.querySelectorAll('.syrup-option');
  const noSyrupOption = document.getElementById('noSyrupOption');
  
  syrupOptions.forEach(option => {
    option.onclick = () => {
      // Remove selected from all syrup options (including no syrup)
      syrupOptions.forEach(opt => opt.classList.remove('selected'));
      if (noSyrupOption) noSyrupOption.classList.remove('selected');
      // Add selected to clicked option
      option.classList.add('selected');
    };
  });
  
  if (noSyrupOption) {
    noSyrupOption.onclick = () => {
      syrupOptions.forEach(opt => opt.classList.remove('selected'));
      noSyrupOption.classList.add('selected');
    };
  }
  
  // Add to cart button handler
  const addToCartBtn = document.getElementById('addCoffeeToCartBtn');
  if (addToCartBtn) {
    addToCartBtn.onclick = () => {
      const selectedMilk = document.querySelector('.milk-option.selected')?.getAttribute('data-milk');
      const selectedSyrup = document.querySelector('.syrup-option.selected')?.getAttribute('data-syrup');
      
      if (!selectedMilk) {
        alert('Please select a milk type');
        return;
      }
      
      const syrupId = selectedSyrup || null;
      addCoffeeToCart(product, selectedMilk, syrupId);
      modal.style.display = 'none';
      pendingCoffeeItem = null;
    };
  }
}

function addCoffeeToCart(product, milkType, syrupId = null, extraShot = false) {
  const cart = loadCart();
  const role = getRole();
  const usePfand = getPfandSetting();
  const unitPrice = priceFor(product, role);
  
  // Get syrup info if selected
  let syrupPrice = 0;
  let syrupName = '';
  if (syrupId) {
    const addonsCategory = PRODUCT_CATALOG.find(cat => cat.id === 'addons');
    const syrup = addonsCategory?.items.find(item => item.id === syrupId);
    if (syrup) {
      syrupPrice = priceFor(syrup, role);
      syrupName = syrup.name;
    }
  }
  
  // Get extra shot price if selected
  let extraShotPrice = 0;
  if (extraShot) {
    const addonsCategory = PRODUCT_CATALOG.find(cat => cat.id === 'addons');
    const extraShotItem = addonsCategory?.items.find(item => item.id === 'extra-shot');
    if (extraShotItem) {
      extraShotPrice = priceFor(extraShotItem, role);
    }
  }
  
  // Create unique key for coffee with milk, syrup, and extra shot selection
  const cartKey = `${product.id}_${milkType}_${syrupId || 'none'}_${extraShot ? 'extra' : 'normal'}`;
  
  if (!cart[cartKey]) {
    const milkLabel = milkType === 'cow' ? ' (Cow Milk)' : ' (Oat Milk)';
    const syrupLabel = syrupName ? ` + ${syrupName}` : '';
    const extraShotLabel = extraShot ? ' + Extra Shot' : '';
    cart[cartKey] = { 
      id: product.id,
      name: product.name + milkLabel + syrupLabel + extraShotLabel, 
      price: unitPrice + syrupPrice + extraShotPrice,
      qty: 0,
      pfand: usePfand,
      milk: milkType,
      syrup: syrupId || null,
      syrupPrice: syrupPrice,
      extraShot: extraShot,
      extraShotPrice: extraShotPrice
    };
  }
  
  cart[cartKey].price = unitPrice + syrupPrice + extraShotPrice;
  cart[cartKey].pfand = usePfand;
  cart[cartKey].qty += 1; 
  
  saveCart(cart); 
  renderCart();
  
  const pfandText = usePfand ? ' (with Pfand)' : '';
  const milkText = milkType === 'cow' ? ' with Cow Milk' : ' with Oat Milk';
  const syrupText = syrupName ? ` + ${syrupName}` : '';
  const extraShotText = extraShot ? ' + Extra Shot' : '';
  showToast(`${product.name}${milkText}${syrupText}${extraShotText} added (${role === 'student' ? 'Student' : 'Staff'} price)${pfandText}`);
}

function addToCart(product) {
  // Check if it's a coffee item - show milk selection modal
  if (isCoffeeItem(product)) {
    showMilkModal(product);
    return;
  }
  
  // For non-coffee items, add directly
  const cart = loadCart();
  const role = getRole();
  const usePfand = getPfandSetting();
  const unitPrice = priceFor(product, role);
  
  if (!cart[product.id]) {
    cart[product.id] = { 
      name: product.name, 
      price: unitPrice, 
      qty: 0,
      pfand: usePfand
    };
  }
  
  // If role or pfand setting changed since last add, update
  cart[product.id].price = unitPrice;
  cart[product.id].pfand = usePfand;
  cart[product.id].qty += 1; 
  
  saveCart(cart); 
  renderCart();
  
  const pfandText = usePfand ? ' (with Pfand)' : '';
  showToast(`${product.name} added (${role === 'student' ? 'Student' : 'Staff'} price)${pfandText}`);
}

function clearCart() { saveCart({}); renderCart(); }

// Image mapping for menu items
const ITEM_IMAGES = {
  'americano': 'assets/images/americano.png',
  'espresso': 'assets/images/espresso.png',
  'espresso-doppio': 'assets/images/espresso-doppio.png',
  'cappuccino': 'assets/images/cappuccino.png',
  'latte-macchiato': 'assets/images/latte-macchiato.png',
  'cafe-latte': 'assets/images/caffe-latte.png',
  'tea': 'assets/images/tea.png',
  'pumpkin-spice': 'assets/images/caffe-mocha.png',
  'cinnamon-bun-latte': 'assets/images/latte-macchiato-caramel.png',
  'hot-chocolate': 'assets/images/hot-chocolate.png',
  'softdrinks': 'assets/images/softdrinks.png',
  'wasser': 'assets/images/water.png',
  'redbull': 'assets/images/redbull.png',
  'syrup-vanilla': 'assets/images/syrup-vanilla.png',
  'syrup-hazelnut': 'assets/images/syrup-hazelnut.png',
  'syrup-pumpkin': 'assets/images/syrup-pumpkin.png',
  'syrup-spekuloos': 'assets/images/syrup-spekuloos.png',
  'syrup-gingerbread': 'assets/images/syrup-gingerbread.png',
  'togo': 'assets/images/water.png', // placeholder
  'extra-shot': 'assets/images/espresso.png' // placeholder
};

function renderCategories() {
  const container = document.getElementById('categories'); 
  if (!container) return; 
  container.innerHTML = '';
  
  // Separate hot drinks and cold drinks into different categories
  const coffeeCategory = PRODUCT_CATALOG.find(cat => cat.id === 'coffee');
  const drinksCategory = PRODUCT_CATALOG.find(cat => cat.id === 'drinks');
  
  // Hot Drinks Category
  if (coffeeCategory) {
    const hotCategoryDiv = document.createElement('div');
    hotCategoryDiv.className = 'menu-category';
    
    const hotGridDiv = document.createElement('div');
    hotGridDiv.className = 'menu-grid';
    
    coffeeCategory.items.forEach(item => {
      const menuItemWrapper = document.createElement('div');
      menuItemWrapper.className = 'menu-item-wrapper';
      
      const menuItem = document.createElement('button');
      menuItem.className = 'menu-item';
      menuItem.type = 'button';
      menuItem.dataset.itemId = item.id;
      menuItem.style.cursor = 'pointer';
      menuItem.style.border = 'none';
      menuItem.style.background = 'transparent';
      menuItem.style.padding = '0';
      menuItem.style.width = '100%';
      
      const studentPrice = priceFor(item, 'student');
      const staffPrice = priceFor(item, 'staff');
      const imageSrc = ITEM_IMAGES[item.id] || 'assets/images/espresso.png';
      
      const priceHtml = `<p class="price">${studentPrice.toFixed(2)}€ (Students)<br>${staffPrice.toFixed(2)}€ (Staff)</p>`;
      
      menuItem.innerHTML = `
        <img src="${imageSrc}" alt="${item.name}">
        <h4>${item.name}</h4>
        ${priceHtml}
      `;
      
      // Add click handler - show options for coffee items, direct add for others
      if (isCoffeeItem(item)) {
        menuItem.addEventListener('click', () => toggleCoffeeOptions(item.id, menuItemWrapper));
      } else {
        menuItem.addEventListener('click', () => addToCart(item));
      }
      
      // Create options panel (initially hidden)
      if (isCoffeeItem(item)) {
        const optionsPanel = createCoffeeOptionsPanel(item);
        menuItemWrapper.appendChild(menuItem);
        menuItemWrapper.appendChild(optionsPanel);
      } else {
        menuItemWrapper.appendChild(menuItem);
      }
      
      hotGridDiv.appendChild(menuItemWrapper);
    });
    
    const hotLabelDiv = document.createElement('div');
    hotLabelDiv.className = 'category-label hot-drinks-label';
    hotLabelDiv.textContent = 'hot drinks';
    
    hotCategoryDiv.appendChild(hotGridDiv);
    hotCategoryDiv.appendChild(hotLabelDiv);
    container.appendChild(hotCategoryDiv);
  }
  
  // Cold Drinks Category
  if (drinksCategory) {
    const coldCategoryDiv = document.createElement('div');
    coldCategoryDiv.className = 'menu-category';
    
    const coldGridDiv = document.createElement('div');
    coldGridDiv.className = 'menu-grid cold-drinks';
    
    drinksCategory.items.forEach(item => {
      const menuItem = document.createElement('button');
      menuItem.className = 'menu-item';
      menuItem.type = 'button';
      menuItem.style.cursor = 'pointer';
      menuItem.style.border = 'none';
      menuItem.style.background = 'transparent';
      menuItem.style.padding = '0';
      
      const studentPrice = priceFor(item, 'student');
      const staffPrice = priceFor(item, 'staff');
      const imageSrc = ITEM_IMAGES[item.id] || 'assets/images/water.png';
      
      const priceHtml = studentPrice === staffPrice 
        ? `<p class="price">${studentPrice.toFixed(2)}€</p>`
        : `<p class="price">${studentPrice.toFixed(2)}€ (Students)<br>${staffPrice.toFixed(2)}€ (Staff)</p>`;
      
      menuItem.innerHTML = `
        <img src="${imageSrc}" alt="${item.name}">
        <h4>${item.name}</h4>
        ${priceHtml}
      `;
      
      menuItem.addEventListener('click', () => addToCart(item));
      coldGridDiv.appendChild(menuItem);
    });
    
    const coldLabelDiv = document.createElement('div');
    coldLabelDiv.className = 'category-label cold-drinks-label';
    coldLabelDiv.textContent = 'cold drinks';
    
    coldCategoryDiv.appendChild(coldGridDiv);
    coldCategoryDiv.appendChild(coldLabelDiv);
    container.appendChild(coldCategoryDiv);
  }
  
  // Add heart icons to menu items
  addHeartIcons();
}

function createCoffeeOptionsPanel(item) {
  const panel = document.createElement('div');
  panel.className = 'coffee-options-panel';
  panel.style.display = 'none';
  panel.dataset.itemId = item.id;
  
  panel.innerHTML = `
    <div class="coffee-options-content">
      <div class="option-group">
        <h5>Choose Milk:</h5>
        <div class="option-buttons">
          <button class="option-btn milk-btn" data-milk="cow">Cow Milk</button>
          <button class="option-btn milk-btn" data-milk="oat">Oat Milk</button>
        </div>
      </div>
      <div class="option-group">
        <h5>Add Syrup (Optional):</h5>
        <div class="option-buttons syrup-buttons">
          <button class="option-btn syrup-btn" data-syrup="">No Syrup</button>
          <button class="option-btn syrup-btn" data-syrup="syrup-vanilla">Vanilla</button>
          <button class="option-btn syrup-btn" data-syrup="syrup-hazelnut">Hazelnut</button>
          <button class="option-btn syrup-btn" data-syrup="syrup-pumpkin">Pumpkin Spice</button>
          <button class="option-btn syrup-btn" data-syrup="syrup-spekuloos">Spekuloos</button>
          <button class="option-btn syrup-btn" data-syrup="syrup-gingerbread">Gingerbread</button>
        </div>
      </div>
      <div class="option-group">
        <h5>Extra Shot (Optional):</h5>
        <div class="option-buttons">
          <button class="option-btn extra-shot-btn" data-extra-shot="false">No</button>
          <button class="option-btn extra-shot-btn" data-extra-shot="true">Yes (+€0.50)</button>
        </div>
      </div>
      <button class="add-to-cart-btn" data-item-id="${item.id}">Add to Cart</button>
    </div>
  `;
  
  // Set up event handlers
  const milkBtns = panel.querySelectorAll('.milk-btn');
  const syrupBtns = panel.querySelectorAll('.syrup-btn');
  const extraShotBtns = panel.querySelectorAll('.extra-shot-btn');
  const addBtn = panel.querySelector('.add-to-cart-btn');
  
  milkBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      milkBtns.forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
    });
  });
  
  syrupBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      syrupBtns.forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
    });
  });
  
  extraShotBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      extraShotBtns.forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
    });
  });
  
  addBtn.addEventListener('click', () => {
    const selectedMilk = panel.querySelector('.milk-btn.selected')?.dataset.milk;
    const selectedSyrup = panel.querySelector('.syrup-btn.selected')?.dataset.syrup || '';
    const selectedExtraShot = panel.querySelector('.extra-shot-btn.selected')?.dataset.extraShot === 'true';
    
    if (!selectedMilk) {
      alert('Please select a milk type');
      return;
    }
    
    addCoffeeToCart(item, selectedMilk, selectedSyrup || null, selectedExtraShot);
    toggleCoffeeOptions(item.id, panel.parentElement);
  });
  
  // Set default selections
  milkBtns[0]?.classList.add('selected');
  syrupBtns[0]?.classList.add('selected');
  extraShotBtns[0]?.classList.add('selected');
  
  return panel;
}

function toggleCoffeeOptions(itemId, wrapper) {
  const panel = wrapper.querySelector('.coffee-options-panel');
  if (!panel) return;
  
  // Close all other panels
  document.querySelectorAll('.coffee-options-panel').forEach(p => {
    if (p !== panel) {
      p.style.display = 'none';
    }
  });
  
  // Toggle this panel
  if (panel.style.display === 'none' || !panel.style.display) {
    panel.style.display = 'block';
  } else {
    panel.style.display = 'none';
  }
}


function renderCart() {
  const cartList = document.getElementById('cartItems'); 
  const subtotalEl = document.getElementById('subtotal');
  if (!cartList || !subtotalEl) return; 
  cartList.innerHTML = '';
  const cart = loadCart(); 
  let subtotal = 0;
  let pfandTotal = 0;
  
  Object.entries(cart).forEach(([id, line]) => {
    const lineTotal = line.price * line.qty; 
    const linePfand = line.pfand ? PFAND_DEPOSIT * line.qty : 0;
    subtotal += lineTotal;
    pfandTotal += linePfand;
    
    const li = document.createElement('li'); 
    li.className = 'cart-line';
    li.innerHTML = `
      <div class="cart-line-left">
        <span class="cart-line-name">${line.name}</span>
        <span class="cart-line-qty">× ${line.qty}</span>
        ${line.pfand ? '<span class="pfand-indicator"><i class="fas fa-recycle"></i> Pfand</span>' : ''}
      </div>
      <div class="cart-line-right">
        <span class="cart-line-price">${formatPrice(lineTotal + linePfand)}</span>
        <div class="cart-line-actions">
          <button class="qty-btn" data-action="dec" data-id="${id}">-</button>
          <button class="qty-btn" data-action="inc" data-id="${id}">+</button>
        </div>
      </div>`;
    cartList.appendChild(li);
  });
  
  // Add Pfand line if any items have Pfand
  if (pfandTotal > 0) {
    const pfandLi = document.createElement('li');
    pfandLi.className = 'cart-line pfand-line';
    pfandLi.innerHTML = `
      <div class="cart-line-left">
        <span class="cart-line-name"><i class="fas fa-recycle"></i> Cup Deposit</span>
      </div>
      <div class="cart-line-right">
        <span class="cart-line-price">${formatPrice(pfandTotal)}</span>
      </div>
    `;
    cartList.appendChild(pfandLi);
  }
  
  const total = subtotal + pfandTotal;
  subtotalEl.textContent = formatPrice(total);
  
  cartList.querySelectorAll('.qty-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id'); 
      const action = btn.getAttribute('data-action');
      const cart = loadCart(); 
      if (!cart[id]) return;
      if (action === 'inc') cart[id].qty += 1; 
      else { cart[id].qty -= 1; if (cart[id].qty <= 0) delete cart[id]; }
      saveCart(cart); 
      renderCart();
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  // Role toggle wiring
  const roleToggle = document.getElementById('roleToggle');
  const savedRole = getRole();
  if (roleToggle) {
    const inputs = roleToggle.querySelectorAll('input[name="role"]');
    inputs.forEach(i => { if (i.value === savedRole) i.checked = true; });
    roleToggle.addEventListener('change', (e) => {
      const selected = roleToggle.querySelector('input[name="role"]:checked');
      if (selected) { setRole(selected.value); renderCategories(); renderCart(); }
    });
  }

  // Pfand toggle wiring
  const pfandToggle = document.getElementById('usePfand');
  const savedPfand = getPfandSetting();
  if (pfandToggle) {
    pfandToggle.checked = savedPfand;
    pfandToggle.addEventListener('change', (e) => {
      setPfandSetting(e.target.checked);
      renderCart();
    });
  }

  // Favorites functionality
  setupFavoritesModal();
  loadFavorites();
  updateFavoritesButton();

  renderCategories(); 
  renderCart();
  const clearBtn = document.getElementById('clearCart'); if (clearBtn) clearBtn.addEventListener('click', clearCart);
});

// Simple toast
let toastEl;
function ensureToast() {
  if (!toastEl) {
    toastEl = document.createElement('div');
    toastEl.className = 'toast';
    document.body.appendChild(toastEl);
  }
}

function showToast(msg) {
  ensureToast();
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toastEl.classList.remove('show'), 1400);
}

// Favorites System
let favorites = [];

function loadFavorites() {
  const saved = localStorage.getItem('kcafe_favorites');
  favorites = saved ? JSON.parse(saved) : [];
}

function saveFavorites() {
  localStorage.setItem('kcafe_favorites', JSON.stringify(favorites));
}

function addToFavorites(item) {
  if (!favorites.find(fav => fav.id === item.id)) {
    favorites.push(item);
    saveFavorites();
    showToast('Added to favorites!');
    updateFavoritesButton();
  }
}

function removeFromFavorites(itemId) {
  favorites = favorites.filter(fav => fav.id !== itemId);
  saveFavorites();
  showToast('Removed from favorites');
  updateFavoritesButton();
  renderFavoritesList();
}

function isFavorite(itemId) {
  return favorites.some(fav => fav.id === itemId);
}

function updateFavoritesButton() {
  const btn = document.getElementById('favoritesBtn');
  if (btn) {
    const count = favorites.length;
    btn.innerHTML = `<i class="fas fa-heart"></i><span>Favorites (${count})</span>`;
  }
}

function setupFavoritesModal() {
  const modal = document.getElementById('favoritesModal');
  const openBtn = document.getElementById('favoritesBtn');
  const closeBtn = document.getElementById('closeFavoritesModal');

  if (openBtn) {
    openBtn.addEventListener('click', () => {
      modal.style.display = 'block';
      renderFavoritesList();
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      modal.style.display = 'none';
    });
  }

  // Close modal when clicking outside
  window.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.style.display = 'none';
    }
  });
}

function renderFavoritesList() {
  const container = document.getElementById('favoritesList');
  const noFavorites = document.getElementById('noFavorites');

  if (favorites.length === 0) {
    container.style.display = 'none';
    noFavorites.style.display = 'block';
    return;
  }

  container.style.display = 'block';
  noFavorites.style.display = 'none';

  container.innerHTML = favorites.map(item => `
    <div class="favorite-item">
      <div class="favorite-info">
        <h4>${item.name}</h4>
        <p>€${item.price.toFixed(2)}</p>
      </div>
      <div class="favorite-actions">
        <button class="add-to-cart-btn" onclick="addFavoriteToCart('${item.id}')">
          <i class="fas fa-plus"></i> Add to Cart
        </button>
        <button class="remove-favorite-btn" onclick="removeFromFavorites('${item.id}')">
          <i class="fas fa-heart-broken"></i>
        </button>
      </div>
    </div>
  `).join('');
}

function addFavoriteToCart(itemId) {
  const item = favorites.find(fav => fav.id === itemId);
  if (item) {
    addToCart(item);
    showToast('Added to cart!');
  }
}

// Add heart icons to menu items
function addHeartIcons() {
  const menuItems = document.querySelectorAll('.order-item');
  menuItems.forEach(item => {
    // Check if heart button already exists
    if (item.querySelector('.heart-btn')) return;
    
    const heartBtn = document.createElement('button');
    heartBtn.className = 'heart-btn';
    heartBtn.innerHTML = `<i class="fas fa-heart"></i>`;
    heartBtn.title = 'Add to favorites';
    
    // Get item data from the button's text content
    const itemName = item.querySelector('.order-item-name').textContent;
    const itemPrice = parseFloat(item.querySelector('.order-item-price').textContent.replace('€', ''));
    const itemId = itemName.toLowerCase().replace(/\s+/g, '-');
    
    if (isFavorite(itemId)) {
      heartBtn.classList.add('favorited');
    }
    
    heartBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const itemData = {
        id: itemId,
        name: itemName,
        price: itemPrice
      };
      
      if (isFavorite(itemData.id)) {
        removeFromFavorites(itemData.id);
        heartBtn.classList.remove('favorited');
      } else {
        addToFavorites(itemData);
        heartBtn.classList.add('favorited');
      }
    });
    
    item.appendChild(heartBtn);
  });
}


