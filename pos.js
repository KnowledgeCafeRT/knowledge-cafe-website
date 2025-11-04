// Minimal POS logic reusing the existing product catalog structure and queue format

(function() {
  const PRODUCT_CATALOG = [
    { id: 'coffee', title: 'Coffee', items: [
      { id: 'americano', name: 'Americano', priceStudent: 2.00, priceStaff: 2.50 },
      { id: 'espresso', name: 'Espresso', priceStudent: 1.50, priceStaff: 2.00 },
      { id: 'espresso-doppio', name: 'Espresso Doppio', priceStudent: 2.00, priceStaff: 2.50 },
      { id: 'cappuccino', name: 'Cappuccino', priceStudent: 2.00, priceStaff: 2.50 },
      { id: 'latte-macchiato', name: 'Latte Macchiato', priceStudent: 2.00, priceStaff: 2.50 }
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
      { id: 'syrup-vanilla', name: 'Vanilla Syrup', priceStudent: 0.30, priceStaff: 0.30 },
      { id: 'oat-milk', name: 'Oat Milk', priceStudent: 0.00, priceStaff: 0.00 },
      { id: 'cow-milk', name: 'Cow Milk', priceStudent: 0.00, priceStaff: 0.00 }
    ]}
  ];

  const PFAND_DEPOSIT = 2.00;
  const TAX_RATE = 0.05;

  let priceMode = localStorage.getItem('kcafe_pos_price_mode') || 'student';
  let cart = {}; // id -> { id, name, price, qty, pfand }

  function formatPrice(v) { return `€${v.toFixed(2)}`; }

  function gateWithPin() {
    const gate = document.getElementById('pinGate');
    if (!gate) {
      // No PIN gate, initialize immediately
      initializePOS();
      return;
    }
    gate.style.display = 'flex';
    const pinBtn = document.getElementById('posPinBtn');
    const pinCancel = document.getElementById('posPinCancel');
    pinBtn?.addEventListener('click', () => {
      const input = /** @type {HTMLInputElement} */ (document.getElementById('posPinInput'));
      const pin = input?.value?.trim();
      // Simple default PIN 1234 (change in production!)
      const stored = localStorage.getItem('kcafe_pos_pin') || '1234';
      if (pin === stored) {
        gate.style.display = 'none';
        const posContent = document.getElementById('posContent');
        if (posContent) posContent.style.display = '';
        // Initialize POS after unlocking
        initializePOS();
      } else {
        alert('Incorrect PIN');
        input.value = '';
      }
    });
    pinCancel?.addEventListener('click', () => { window.location.href = '/'; });
    // Allow Enter key to submit PIN
    const pinInput = document.getElementById('posPinInput');
    pinInput?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        pinBtn?.click();
      }
    });
  }

  function initializePOS() {
    renderCategories();
    renderItems(PRODUCT_CATALOG[0].id);
    renderCart();
    setupTabs();
    setupPriceMode();
    setupButtons();
    // auto-refresh queue every 5s when on queue tab
    setInterval(() => {
      const active = document.querySelector('.pos-tab.active')?.getAttribute('data-tab');
      if (active === 'queue') renderQueue();
    }, 5000);
  }

  function renderCategories() {
    const row = document.getElementById('posCategories');
    if (!row) return;
    row.innerHTML = '';
    PRODUCT_CATALOG.forEach(cat => {
      const btn = document.createElement('button');
      btn.className = 'category-btn';
      btn.textContent = cat.title;
      btn.addEventListener('click', () => renderItems(cat.id));
      row.appendChild(btn);
    });
  }

  function findCategory(catId) {
    return PRODUCT_CATALOG.find(c => c.id === catId);
  }

  function renderItems(catId) {
    const grid = document.getElementById('posItems');
    if (!grid) return;
    const cat = findCategory(catId) || PRODUCT_CATALOG[0];
    grid.innerHTML = '';
    cat.items.forEach(item => {
      const card = document.createElement('div');
      card.className = 'item-card';
      const price = priceMode === 'student' ? item.priceStudent : item.priceStaff;
      card.innerHTML = `
        <div class="item-name">${item.name}</div>
        <div class="item-price">${formatPrice(price)}</div>
      `;
      card.addEventListener('click', () => addToCart(item, price));
      grid.appendChild(card);
    });
  }

  function addToCart(item, unitPrice) {
    const key = item.id;
    if (!cart[key]) {
      cart[key] = { id: item.id, name: item.name, price: unitPrice, qty: 0, pfand: false };
    }
    cart[key].qty += 1;
    // Apply pfand setting to drink-style items (simple: apply to coffee & drinks categories, not addons)
    const isDrink = ['coffee', 'drinks'].some(catId => (findCategory(catId)?.items || []).some(i => i.id === item.id));
    if (isDrink) {
      const usePfand = document.getElementById('usePfand');
      cart[key].pfand = !!(usePfand && /** @type {HTMLInputElement} */(usePfand).checked);
    }
    renderCart();
  }

  function renderCart() {
    const list = document.getElementById('cartList');
    if (!list) return;
    list.innerHTML = '';
    let subtotal = 0;
    let pfand = 0;
    Object.values(cart).forEach(line => {
      const lineTotal = line.price * line.qty; subtotal += lineTotal;
      if (line.pfand) pfand += PFAND_DEPOSIT * line.qty;
      const row = document.createElement('div');
      row.className = 'cart-line';
      row.innerHTML = `
        <div>
          <div style="font-weight:600;color:#2c1810;">${line.name}</div>
          <div style="color:#5c4033;font-size:.9rem;">${formatPrice(line.price)} × ${line.qty}</div>
        </div>
        <div class="qty-controls">
          <button class="qty-btn" data-act="dec">-</button>
          <span>${line.qty}</span>
          <button class="qty-btn" data-act="inc">+</button>
          <button class="qty-btn" data-act="del" title="Remove"><i class="fas fa-trash"></i></button>
        </div>
      `;
      row.querySelector('[data-act="inc"]').addEventListener('click', () => { line.qty += 1; renderCart(); });
      row.querySelector('[data-act="dec"]').addEventListener('click', () => { line.qty = Math.max(0, line.qty - 1); if (line.qty === 0) delete cart[line.id]; renderCart(); });
      row.querySelector('[data-act="del"]').addEventListener('click', () => { delete cart[line.id]; renderCart(); });
      list.appendChild(row);
    });
    const taxes = subtotal * TAX_RATE;
    const total = subtotal + taxes + pfand;
    const sEl = document.getElementById('posSubtotal'); if (sEl) sEl.textContent = formatPrice(subtotal);
    const tEl = document.getElementById('posTaxes'); if (tEl) tEl.textContent = formatPrice(taxes);
    const pEl = document.getElementById('posPfand'); if (pEl) pEl.textContent = formatPrice(pfand);
    const totEl = document.getElementById('posTotal'); if (totEl) totEl.textContent = formatPrice(total);
  }

  function clearCart() { cart = {}; renderCart(); }

  function submitOrder() {
    const items = Object.values(cart).filter(l => l.qty > 0);
    if (items.length === 0) { alert('Cart is empty'); return; }

    let subtotal = 0; let pfandTotal = 0;
    items.forEach(line => {
      subtotal += line.price * line.qty;
      if (line.pfand) pfandTotal += PFAND_DEPOSIT * line.qty;
    });
    const taxes = subtotal * TAX_RATE;
    const total = subtotal + taxes + pfandTotal;

    const name = /** @type {HTMLInputElement} */(document.getElementById('posCustomerName'))?.value?.trim() || '';
    const email = /** @type {HTMLInputElement} */(document.getElementById('posCustomerEmail'))?.value?.trim() || '';

    const now = new Date().toISOString();
    const orderId = Date.now();

    const displayOrder = {
      id: orderId,
      customer: { name, email },
      items: items.map(line => ({ id: line.id, name: line.name, price: line.price, quantity: line.qty, pfand: !!line.pfand })),
      total: total,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
      userType: 'walkin',
      source: 'in_person'
    };

    const queue = JSON.parse(localStorage.getItem('kcafe_order_queue')) || [];
    queue.push(displayOrder);
    localStorage.setItem('kcafe_order_queue', JSON.stringify(queue));

    alert(`Order #${orderId} submitted! Total ${formatPrice(total)}`);
    clearCart();
    renderQueue();
  }

  function renderQueue() {
    const list = document.getElementById('queueList');
    if (!list) return;
    const queue = JSON.parse(localStorage.getItem('kcafe_order_queue')) || [];
    // show newest first
    queue.sort((a,b) => (b.id||0) - (a.id||0));
    list.innerHTML = '';
    queue.forEach(o => {
      const div = document.createElement('div');
      div.className = 'queue-card';
      const who = o.customer?.name || o.customer?.email || 'Guest';
      const src = o.source || 'online';
      div.innerHTML = `
        <div class="queue-meta">
          <span>#${o.id} • ${who}</span>
          <span>${src} • ${o.status}</span>
        </div>
        <div class="queue-items">
          ${o.items.map(i => `${i.name} × ${i.quantity}`).join(', ')}
        </div>
        <div class="queue-meta" style="margin-top:6px;">
          <span>${new Date(o.createdAt).toLocaleTimeString()}</span>
          <span><strong>${formatPrice(o.total || 0)}</strong></span>
        </div>
      `;
      list.appendChild(div);
    });
  }

  function setupTabs() {
    const tabs = Array.from(document.querySelectorAll('.pos-tab'));
    tabs.forEach(btn => btn.addEventListener('click', () => {
      tabs.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.getAttribute('data-tab');
      const newEl = document.getElementById('tabNew');
      const queueEl = document.getElementById('tabQueue');
      if (tab === 'new') { newEl.style.display = ''; queueEl.style.display = 'none'; }
      else { newEl.style.display = 'none'; queueEl.style.display = ''; renderQueue(); }
    }));
  }

  function setupPriceMode() {
    const sel = /** @type {HTMLSelectElement} */(document.getElementById('priceMode'));
    if (!sel) return;
    sel.value = priceMode;
    sel.addEventListener('change', () => {
      priceMode = sel.value;
      localStorage.setItem('kcafe_pos_price_mode', priceMode);
      // re-render current category
      const first = PRODUCT_CATALOG[0]?.id || 'coffee';
      renderItems(first);
    });
  }

  function setupButtons() {
    document.getElementById('clearCart')?.addEventListener('click', clearCart);
    document.getElementById('submitOrder')?.addEventListener('click', submitOrder);
  }

  function init() {
    gateWithPin();
  }

  document.addEventListener('DOMContentLoaded', init);
})();


