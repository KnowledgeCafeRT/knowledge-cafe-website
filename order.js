const PRODUCT_CATALOG = [
  { id: 'coffee', title: 'Coffee', items: [
    { id: 'americano', name: 'Americano', priceStudent: 1.50, priceStaff: 2.00 },
    { id: 'espresso', name: 'Espresso', priceStudent: 1.30, priceStaff: 1.80 },
    { id: 'espresso-doppio', name: 'Espresso Doppio', priceStudent: 1.70, priceStaff: 2.20 },
    { id: 'cappuccino', name: 'Cappuccino', priceStudent: 2.50, priceStaff: 3.00 },
    { id: 'latte-macchiato', name: 'Latte Macchiato', priceStudent: 2.00, priceStaff: 2.50 },
    { id: 'cafe-latte', name: 'Cafe Latte', priceStudent: 2.70, priceStaff: 3.20 },
    { id: 'tea', name: 'Tea', priceStudent: 1.00, priceStaff: 1.50 },
    { id: 'pumpkin-spice', name: 'Pumpkin Spice', priceStudent: 3.00, priceStaff: 3.50 }
  ]},
  { id: 'drinks', title: 'Drinks', items: [
    { id: 'softdrinks', name: 'Softdrinks', priceStudent: 2.00, priceStaff: 2.00 },
    { id: 'wasser', name: 'Water', priceStudent: 1.00, priceStaff: 1.00 },
    { id: 'redbull', name: 'RedBull', priceStudent: 2.00, priceStaff: 2.00 }
  ]},
  { id: 'addons', title: 'Add ons', items: [
    { id: 'togo', name: 'To Go', priceStudent: 0.20, priceStaff: 0.20 },
    { id: 'extra-shot', name: 'Extra Shot', priceStudent: 0.50, priceStaff: 0.50 },
    { id: 'syrup-pumpkin', name: 'Pumpkin Spice Syrup', priceStudent: 0.30, priceStaff: 0.30 },
    { id: 'syrup-hazelnut', name: 'Hazelnut Syrup', priceStudent: 0.30, priceStaff: 0.30 },
    { id: 'syrup-vanilla', name: 'Vanilla Syrup', priceStudent: 0.30, priceStaff: 0.30 }
  ]}
];

const CART_STORAGE_KEY = 'kcafe_cart_v1';
const ROLE_STORAGE_KEY = 'kcafe_role_v1';
const PFAND_STORAGE_KEY = 'kcafe_pfand_v1';
const PFAND_DEPOSIT = 2.00;

function getRole() {
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
  title.textContent = `Choose Milk for ${product.name}`;
  modal.style.display = 'flex';
  
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
      const milkType = option.getAttribute('data-milk');
      addCoffeeToCart(product, milkType);
      modal.style.display = 'none';
      pendingCoffeeItem = null;
    };
  });
}

function addCoffeeToCart(product, milkType) {
  const cart = loadCart();
  const role = getRole();
  const usePfand = getPfandSetting();
  const unitPrice = priceFor(product, role);
  
  // Create unique key for coffee with milk selection
  const cartKey = `${product.id}_${milkType}`;
  
  if (!cart[cartKey]) {
    const milkLabel = milkType === 'cow' ? ' (Cow Milk)' : ' (Oat Milk)';
    cart[cartKey] = { 
      id: product.id,
      name: product.name + milkLabel, 
      price: unitPrice, 
      qty: 0,
      pfand: usePfand,
      milk: milkType
    };
  }
  
  cart[cartKey].price = unitPrice;
  cart[cartKey].pfand = usePfand;
  cart[cartKey].qty += 1; 
  
  saveCart(cart); 
  renderCart();
  
  const pfandText = usePfand ? ' (with Pfand)' : '';
  const milkText = milkType === 'cow' ? ' with Cow Milk' : ' with Oat Milk';
  showToast(`${product.name}${milkText} added (${role === 'student' ? 'Student' : 'Staff'} price)${pfandText}`);
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

function renderCategories() {
  const container = document.getElementById('categories'); if (!container) return; container.innerHTML = '';
  PRODUCT_CATALOG.forEach(cat => {
    const section = document.createElement('section'); section.className = 'order-category';
    section.innerHTML = `<h3>${cat.title}</h3><div class="order-items"></div>`;
    const itemsWrap = section.querySelector('.order-items');
    const role = getRole();
    cat.items.forEach(item => {
      const el = document.createElement('button'); el.className = 'order-item'; el.type = 'button';
      const studentPrice = priceFor(item, 'student');
      const staffPrice = priceFor(item, 'staff');
      const main = role === 'student' ? studentPrice : staffPrice;
      const sub = role === 'student' ? staffPrice : studentPrice;
      const subLabel = role === 'student' ? 'Staff' : 'Student';
      el.innerHTML = `
        <span class="order-item-name">${item.name}</span>
        <span style="display:flex;flex-direction:column;align-items:flex-end;gap:2px;">
          <span class="order-item-price">${formatPrice(main)}</span>
          <span class="order-item-subprice">${subLabel}: ${formatPrice(sub)}</span>
        </span>`;
      el.addEventListener('click', () => addToCart(item)); itemsWrap.appendChild(el);
    });
    container.appendChild(section);
  });
  
  // Add heart icons to menu items
  addHeartIcons();
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


