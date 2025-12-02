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
    { id: 'syrup-gingerbread', name: 'Gingerbread Syrup', priceStudent: 0.30, priceStaff: 0.30 },
    { id: 'extra-espresso-shot', name: 'Extra Espresso Shot', priceStudent: 0.50, priceStaff: 0.50 }
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
  const coffeeCategory = PRODUCT_CATALOG.find(cat => cat.id === 'coffee');
  return coffeeCategory && coffeeCategory.items.some(coffee => coffee.id === item.id);
}

function needsCupOptionsOnly(item) {
  // Espresso, Espresso Doppio, Americano, and Tea only need cup selection, no milk/syrup
  const cupOnlyItems = ['tea', 'espresso', 'espresso-doppio', 'americano'];
  return cupOnlyItems.includes(item.id);
}

function isColdDrink(item) {
  // Cold drinks don't need cup options
  const coldDrinkIds = ['redbull', 'wasser', 'softdrinks'];
  return coldDrinkIds.includes(item.id);
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

function addCoffeeToCart(product, milkType, syrupId = null, extraShot = false, cupType = 'togo', cupPrice = 0.20, usePfand = false) {
  const cart = loadCart();
  const role = getRole();
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
  
  // Adjust cup price based on selection
  const finalCupPrice = cupType === 'pfand' ? 2.00 : 0.20;
  const finalUsePfand = cupType === 'pfand';
  const cupLabel = cupType === 'pfand' ? ' • Normal Cup (Pfand)' : ' • To Go Cup';
  
  // Create unique key for coffee with milk, syrup, extra shot, and cup selection
  const cartKey = `${product.id}_${milkType}_${syrupId || 'none'}_${extraShot ? 'extra' : 'normal'}_${cupType}`;
  
  if (!cart[cartKey]) {
    const milkLabel = milkType === 'cow' ? ' (Cow Milk)' : ' (Oat Milk)';
    const syrupLabel = syrupName ? ` + ${syrupName}` : '';
    const extraShotLabel = extraShot ? ' + Extra Shot' : '';
    cart[cartKey] = { 
      id: product.id,
      name: product.name + milkLabel + syrupLabel + extraShotLabel + cupLabel, 
      price: unitPrice + syrupPrice + extraShotPrice + finalCupPrice,
      qty: 0,
      pfand: finalUsePfand,
      milk: milkType,
      syrup: syrupId || null,
      syrupPrice: syrupPrice,
      extraShot: extraShot,
      extraShotPrice: extraShotPrice,
      cupType: cupType,
      cupPrice: finalCupPrice
    };
  }
  
  cart[cartKey].price = unitPrice + syrupPrice + extraShotPrice + finalCupPrice;
  cart[cartKey].pfand = finalUsePfand;
  cart[cartKey].qty += 1; 
  
  saveCart(cart); 
  renderCart();
  
  const pfandText = finalUsePfand ? ' (with Pfand)' : '';
  const milkText = milkType === 'cow' ? ' with Cow Milk' : ' with Oat Milk';
  const syrupText = syrupName ? ` + ${syrupName}` : '';
  const extraShotText = extraShot ? ' + Extra Shot' : '';
  showToast(`${product.name}${milkText}${syrupText}${extraShotText}${cupLabel} added (${role === 'student' ? 'Student' : 'Staff'} price)${pfandText}`);
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
  'pumpkin-spice': 'assets/images/pumpkin-spice-latte.png',
  'cinnamon-bun-latte': 'assets/images/latte-macchiato-caramel.png',
  'hot-chocolate': 'assets/images/hot-chocolate.png',
  'extra-espresso-shot': 'assets/images/espresso.png',
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
  
  const coffeeCategory = PRODUCT_CATALOG.find(cat => cat.id === 'coffee');
  const drinksCategory = PRODUCT_CATALOG.find(cat => cat.id === 'drinks');
  const addonsCategory = PRODUCT_CATALOG.find(cat => cat.id === 'addons');
  
  // Hot & Cold Drinks Category (same as index.html structure)
  if (coffeeCategory && drinksCategory) {
    const hotColdCategoryDiv = document.createElement('div');
    hotColdCategoryDiv.className = 'menu-category';
    
    const menuGridDiv = document.createElement('div');
    menuGridDiv.className = 'menu-grid';
    
    // Define the exact order matching index.html
    const hotDrinksOrder = ['espresso', 'espresso-doppio', 'cappuccino', 'latte-macchiato', 'cafe-latte', 'americano', 'tea', 'pumpkin-spice', 'cinnamon-bun-latte', 'hot-chocolate'];
    
    // Render hot drinks in exact order
    hotDrinksOrder.forEach(itemId => {
      const item = coffeeCategory.items.find(i => i.id === itemId);
      if (!item) return;
      
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
      
      const role = getRole();
      const currentPrice = priceFor(item, role);
      const imageSrc = ITEM_IMAGES[item.id] || 'assets/images/espresso.png';
      
      // Format name with <br/> for specific items - match index.html exactly
      let nameHtml = item.name;
      if (item.id === 'cappuccino') {
        nameHtml = 'Cappucino'; // Match index.html spelling
      } else if (item.id === 'cafe-latte') {
        nameHtml = 'Cafe Latte'; // Match index.html spelling
      } else if (item.id === 'pumpkin-spice') {
        nameHtml = 'Pumpkin Spice<br/>Latte';
      } else if (item.id === 'cinnamon-bun-latte') {
        nameHtml = 'Cinnamon Bun<br/>Latte';
      }
      
      const priceHtml = `<p class="price">${currentPrice.toFixed(2)}€</p>`;
      
      menuItem.innerHTML = `
        <img src="${imageSrc}" alt="${item.name}">
        <h4>${nameHtml}</h4>
        ${priceHtml}
      `;
      
      // Add click handler - show options for coffee items
      if (isCoffeeItem(item)) {
        menuItem.addEventListener('click', () => toggleCoffeeOptions(item.id, menuItemWrapper));
        if (needsCupOptionsOnly(item)) {
          const optionsPanel = createCupOptionsPanel(item);
          menuItemWrapper.appendChild(menuItem);
          menuItemWrapper.appendChild(optionsPanel);
        } else {
          const optionsPanel = createCoffeeOptionsPanel(item);
          menuItemWrapper.appendChild(menuItem);
          menuItemWrapper.appendChild(optionsPanel);
        }
      } else if (isColdDrink(item)) {
        // Cold drinks - no options, add directly
        menuItem.addEventListener('click', () => addToCart(item));
        menuItemWrapper.appendChild(menuItem);
      } else {
        // Other items (like syrups) - add directly
        menuItem.addEventListener('click', () => addToCart(item));
        menuItemWrapper.appendChild(menuItem);
      }
      
      menuGridDiv.appendChild(menuItemWrapper);
    });
    
    // Add empty placeholders
    const placeholder1 = document.createElement('div');
    placeholder1.className = 'menu-item empty-placeholder';
    menuGridDiv.appendChild(placeholder1);
    
    const placeholder2 = document.createElement('div');
    placeholder2.className = 'menu-item empty-placeholder';
    menuGridDiv.appendChild(placeholder2);
    
    // Add cold drinks in order: redbull, water, softdrinks
    const coldDrinksOrder = ['redbull', 'wasser', 'softdrinks'];
    coldDrinksOrder.forEach(itemId => {
      const item = drinksCategory.items.find(i => i.id === itemId);
      if (!item) return;
      
      const menuItem = document.createElement('button');
      menuItem.className = 'menu-item';
      menuItem.type = 'button';
      menuItem.style.cursor = 'pointer';
      menuItem.style.border = 'none';
      menuItem.style.background = 'transparent';
      menuItem.style.padding = '0';
      
      const role = getRole();
      const currentPrice = priceFor(item, role);
      const imageSrc = ITEM_IMAGES[item.id] || 'assets/images/water.png';
      
      const priceHtml = `<p class="price">${currentPrice.toFixed(2)}€</p>`;
      
      menuItem.innerHTML = `
        <img src="${imageSrc}" alt="${item.name}">
        <h4>${item.name}</h4>
        ${priceHtml}
      `;
      
      menuItem.addEventListener('click', () => addToCart(item));
      menuGridDiv.appendChild(menuItem);
    });
    
    hotColdCategoryDiv.appendChild(menuGridDiv);
    container.appendChild(hotColdCategoryDiv);
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
          <button class="option-btn syrup-btn" data-syrup="syrup-vanilla">Vanilla (+€0.30)</button>
          <button class="option-btn syrup-btn" data-syrup="syrup-hazelnut">Hazelnut (+€0.30)</button>
          <button class="option-btn syrup-btn" data-syrup="syrup-pumpkin">Pumpkin Spice (+€0.30)</button>
          <button class="option-btn syrup-btn" data-syrup="syrup-spekuloos">Spekuloos (+€0.30)</button>
          <button class="option-btn syrup-btn" data-syrup="syrup-gingerbread">Gingerbread (+€0.30)</button>
        </div>
      </div>
      <div class="option-group">
        <h5>Extra Shot (Optional):</h5>
        <div class="option-buttons">
          <button class="option-btn extra-shot-btn" data-extra-shot="false">No</button>
          <button class="option-btn extra-shot-btn" data-extra-shot="true">Yes (+€0.50)</button>
        </div>
      </div>
      <div class="option-group">
        <h5>Choose Cup Type:</h5>
        <div class="option-buttons">
          <button class="option-btn cup-btn" data-cup="togo" data-price="0.20">To Go Cup (+€0.20)</button>
          <button class="option-btn cup-btn" data-cup="pfand" data-price="2.00">Normal Cup (Pfand) (+€2.00 refundable)</button>
        </div>
      </div>
      <button class="add-to-cart-btn" data-item-id="${item.id}">Add to Cart</button>
    </div>
  `;
  
  // Set up event handlers
  const milkBtns = panel.querySelectorAll('.milk-btn');
  const syrupBtns = panel.querySelectorAll('.syrup-btn');
  const extraShotBtns = panel.querySelectorAll('.extra-shot-btn');
  const cupBtns = panel.querySelectorAll('.cup-btn');
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
  
  cupBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      cupBtns.forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
    });
  });
  
  addBtn.addEventListener('click', () => {
    const selectedMilk = panel.querySelector('.milk-btn.selected')?.dataset.milk;
    const selectedSyrup = panel.querySelector('.syrup-btn.selected')?.dataset.syrup || '';
    const selectedExtraShot = panel.querySelector('.extra-shot-btn.selected')?.dataset.extraShot === 'true';
    const selectedCup = panel.querySelector('.cup-btn.selected')?.dataset.cup;
    
    if (!selectedMilk) {
      alert('Please select a milk type');
      return;
    }
    if (!selectedCup) {
      alert('Please select a cup type');
      return;
    }
    
    const cupPrice = parseFloat(panel.querySelector('.cup-btn.selected')?.dataset.price || '0');
    const usePfand = selectedCup === 'pfand';
    
    addCoffeeToCart(item, selectedMilk, selectedSyrup || null, selectedExtraShot, selectedCup, cupPrice, usePfand);
    toggleCoffeeOptions(item.id, panel.parentElement);
  });
  
  // Set default selections
  milkBtns[0]?.classList.add('selected');
  syrupBtns[0]?.classList.add('selected');
  extraShotBtns[0]?.classList.add('selected');
  cupBtns[0]?.classList.add('selected');
  
  return panel;
}

function createCupOptionsPanel(item) {
  const panel = document.createElement('div');
  panel.className = 'coffee-options-panel';
  panel.style.display = 'none';
  panel.dataset.itemId = item.id;
  
  const role = getRole();
  const togoPrice = role === 'student' ? 0.20 : 0.20;
  const pfandPrice = role === 'student' ? 2.00 : 2.00;
  
  panel.innerHTML = `
    <div class="coffee-options-content">
      <div class="option-group">
        <h5>Choose Cup Type:</h5>
        <div class="option-buttons">
          <button class="option-btn cup-btn" data-cup="togo" data-price="${togoPrice}">To Go Cup (+€${togoPrice.toFixed(2)})</button>
          <button class="option-btn cup-btn" data-cup="pfand" data-price="${pfandPrice}">Normal Cup (Pfand) (+€${pfandPrice.toFixed(2)} refundable)</button>
        </div>
      </div>
      <button class="add-to-cart-btn" data-item-id="${item.id}">Add to Cart</button>
    </div>
  `;
  
  // Set up event handlers
  const cupBtns = panel.querySelectorAll('.cup-btn');
  const addBtn = panel.querySelector('.add-to-cart-btn');
  
  cupBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      cupBtns.forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
    });
  });
  
  addBtn.addEventListener('click', () => {
    const selectedCup = panel.querySelector('.cup-btn.selected')?.dataset.cup;
    
    if (!selectedCup) {
      alert('Please select a cup type');
      return;
    }
    
    const cupPrice = parseFloat(panel.querySelector('.cup-btn.selected')?.dataset.price || '0');
    const usePfand = selectedCup === 'pfand';
    
    addItemWithCup(item, selectedCup, cupPrice, usePfand);
    toggleCoffeeOptions(item.id, panel.parentElement);
  });
  
  // Set default selection
  cupBtns[0]?.classList.add('selected');
  
  return panel;
}

function addItemWithCup(item, cupType, cupPrice, usePfand) {
  const cart = loadCart();
  const role = getRole();
  const unitPrice = priceFor(item, role);
  
  const cartKey = `${item.id}_${cupType}`;
  const cupLabel = cupType === 'pfand' ? ' • Normal Cup (Pfand)' : ' • To Go Cup';
  
  if (!cart[cartKey]) {
    cart[cartKey] = { 
      id: item.id,
      name: item.name + cupLabel, 
      price: unitPrice + cupPrice,
      qty: 0,
      pfand: usePfand,
      cupType: cupType,
      cupPrice: cupPrice
    };
  }
  
  cart[cartKey].price = unitPrice + cupPrice;
  cart[cartKey].pfand = usePfand;
  cart[cartKey].qty += 1; 
  
  saveCart(cart); 
  renderCart();
  
  const pfandText = usePfand ? ' (with Pfand)' : '';
  showToast(`${item.name}${cupLabel} added (${role === 'student' ? 'Student' : 'Staff'} price)${pfandText}`);
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


