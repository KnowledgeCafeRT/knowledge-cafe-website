// Minimal POS logic reusing the existing product catalog structure and queue format

(function() {
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
      { id: 'syrup-vanilla', name: 'Vanilla Syrup', priceStudent: 0.30, priceStaff: 0.30 },
      { id: 'pfand', name: 'Pfand Cup', priceStudent: 2.00, priceStaff: 2.00 }
    ]}
  ];

  const PFAND_DEPOSIT = 2.00;
  const TAX_RATE = 0.00; // Taxes disabled on POS

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
    
    // Listen for new orders from checkout page
    window.addEventListener('storage', (e) => {
      if (e.key === 'kcafe_order_queue') {
        const active = document.querySelector('.pos-tab.active')?.getAttribute('data-tab');
        if (active === 'queue') {
          renderQueue();
          // Show notification for new order
          showNewOrderNotification();
        }
      }
    });
    
    // Also listen for same-tab storage events (for testing)
    window.addEventListener('kcafe_new_order', () => {
      const active = document.querySelector('.pos-tab.active')?.getAttribute('data-tab');
      if (active === 'queue') {
        renderQueue();
        showNewOrderNotification();
      }
    });
    
    // auto-refresh queue every 5s when on queue tab
    setInterval(() => {
      const active = document.querySelector('.pos-tab.active')?.getAttribute('data-tab');
      if (active === 'queue') renderQueue();
    }, 5000);
  }

  function showNewOrderNotification() {
    // Create a temporary notification
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #10b981;
      color: white;
      padding: 15px 20px;
      border-radius: 10px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      z-index: 10000;
      font-weight: 600;
      animation: slideInRight 0.3s ease;
    `;
    notification.innerHTML = '<i class="fas fa-bell"></i> New order received!';
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.style.animation = 'slideOutRight 0.3s ease';
      setTimeout(() => notification.remove(), 300);
    }, 3000);
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

  let pendingCoffeeItem = null;
  let pendingCoffeePrice = null;

  function isCoffeeItem(item) {
    // Tea should not show milk selection
    if (item.id === 'tea') return false;
    const coffeeCategory = PRODUCT_CATALOG.find(cat => cat.id === 'coffee');
    return coffeeCategory && coffeeCategory.items.some(coffee => coffee.id === item.id);
  }

  function showMilkModal(item, unitPrice) {
    const modal = document.getElementById('milkModal');
    const title = document.getElementById('milkModalTitle');
    if (!modal || !title) return;
    
    pendingCoffeeItem = item;
    pendingCoffeePrice = unitPrice;
    title.textContent = `Choose Milk for ${item.name}`;
    modal.style.display = 'flex';
    
    // Close modal handlers
    const closeBtn = document.getElementById('milkModalClose');
    if (closeBtn) {
      closeBtn.onclick = () => {
        modal.style.display = 'none';
        pendingCoffeeItem = null;
        pendingCoffeePrice = null;
      };
    }
    
    // Milk option handlers
    const milkOptions = document.querySelectorAll('.milk-option');
    milkOptions.forEach(option => {
      option.onclick = () => {
        const milkType = option.getAttribute('data-milk');
        addCoffeeToCart(item, unitPrice, milkType);
        modal.style.display = 'none';
        pendingCoffeeItem = null;
        pendingCoffeePrice = null;
      };
    });
  }

  function addCoffeeToCart(item, unitPrice, milkType) {
    const milkLabel = milkType === 'none' ? '' : milkType === 'cow' ? ' (Cow Milk)' : ' (Oat Milk)';
    const cartKey = `${item.id}_${milkType}`;
    
    if (!cart[cartKey]) {
      cart[cartKey] = { 
        id: item.id, 
        name: item.name + milkLabel, 
        price: unitPrice, 
        qty: 0, 
        pfand: false,
        milk: milkType
      };
    }
    cart[cartKey].qty += 1;
    renderCart();
  }

  function addToCart(item, unitPrice) {
    // Check if it's a coffee item - show milk selection modal
    if (isCoffeeItem(item)) {
      showMilkModal(item, unitPrice);
      return;
    }
    
    // For non-coffee items, add directly
    const key = item.id;
    if (!cart[key]) {
      cart[key] = { id: item.id, name: item.name, price: unitPrice, qty: 0, pfand: item.id === 'pfand' };
    }
    cart[key].qty += 1;
    renderCart();
  }

  function renderCart() {
    const list = document.getElementById('cartList');
    if (!list) return;
    list.innerHTML = '';
    let subtotal = 0;
    let pfand = 0;
    Object.values(cart).forEach(line => {
      const lineTotal = line.price * line.qty;
      if (line.id === 'pfand' || line.pfand) {
        pfand += lineTotal;
      } else {
        subtotal += lineTotal;
      }
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
    const taxes = 0;
    const total = subtotal + pfand;
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
      const lineTotal = line.price * line.qty;
      if (line.id === 'pfand' || line.pfand) {
        pfandTotal += lineTotal;
      } else {
        subtotal += lineTotal;
      }
    });
    const taxes = 0;
    const total = subtotal + pfandTotal;

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

  function updateOrderStatus(orderId, newStatus) {
    const queue = JSON.parse(localStorage.getItem('kcafe_order_queue')) || [];
    const orderIndex = queue.findIndex(o => o.id === orderId);
    if (orderIndex !== -1) {
      const order = queue[orderIndex];
      const wasCompleted = order.status === 'completed';
      order.status = newStatus;
      order.updatedAt = new Date().toISOString();
      localStorage.setItem('kcafe_order_queue', JSON.stringify(queue));
      
      // Track sales when walk-in order is marked as completed
      if (newStatus === 'completed' && !wasCompleted && order.source === 'in_person') {
        trackSale(order);
      }
      
      renderQueue();
    }
  }

  // Sales tracking functions
  function trackSale(order) {
    const salesKey = 'kcafe_daily_sales';
    const sales = JSON.parse(localStorage.getItem(salesKey)) || {};
    
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    if (!sales[today]) {
      sales[today] = [];
    }
    
    // Add sale record
    sales[today].push({
      orderId: order.id,
      timestamp: order.updatedAt || new Date().toISOString(),
      items: order.items || [],
      total: order.total || 0,
      customerName: order.customer?.name || '',
      customerEmail: order.customer?.email || ''
    });
    
    localStorage.setItem(salesKey, JSON.stringify(sales));
  }

  function getDailySales(date) {
    const salesKey = 'kcafe_daily_sales';
    const sales = JSON.parse(localStorage.getItem(salesKey)) || {};
    return sales[date] || [];
  }

  function aggregateDailySales(date) {
    const sales = getDailySales(date);
    const aggregated = {};
    let totalRevenue = 0;
    
    sales.forEach(sale => {
      totalRevenue += sale.total || 0;
      sale.items.forEach(item => {
        // Use item name as key to properly track milk variations
        // (e.g., "Americano (Oat Milk)" vs "Americano (Cow Milk)")
        const key = item.name;
        if (!aggregated[key]) {
          aggregated[key] = {
            id: item.id,
            name: item.name,
            quantity: 0,
            revenue: 0,
            unitPrice: item.price || 0
          };
        }
        aggregated[key].quantity += item.quantity || 0;
        aggregated[key].revenue += (item.price || 0) * (item.quantity || 0);
      });
    });
    
    return {
      date,
      items: Object.values(aggregated),
      totalRevenue,
      totalOrders: sales.length
    };
  }

  function exportSalesToCSV(date) {
    const data = aggregateDailySales(date);
    const sales = getDailySales(date);
    
    // Sort items by revenue (descending)
    const sortedItems = [...data.items].sort((a, b) => b.revenue - a.revenue);
    
    // Helper function to escape CSV fields
    function escapeCSV(field) {
      if (field === null || field === undefined) return '';
      const str = String(field);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    }
    
    // Create CSV content with proper Excel formatting
    let csv = '';
    
    // Header section
    csv += `Knowledge Cafe - Daily Sales Report\n`;
    csv += `Date,${date}\n`;
    csv += `Total Orders,${data.totalOrders}\n`;
    csv += `Total Revenue,${data.totalRevenue.toFixed(2)}\n`;
    csv += `\n`;
    
    // Sales by item summary
    csv += `ITEM SALES SUMMARY\n`;
    csv += `Item Name,Quantity,Unit Price,Total Revenue\n`;
    sortedItems.forEach(item => {
      csv += `${escapeCSV(item.name)},${item.quantity},${item.unitPrice.toFixed(2)},${item.revenue.toFixed(2)}\n`;
    });
    // Add totals row
    csv += `TOTAL,,,${data.totalRevenue.toFixed(2)}\n`;
    csv += `\n`;
    
    // Detailed order list
    csv += `DETAILED ORDER LIST\n`;
    csv += `Order ID,Date,Time,Customer Name,Customer Email,Items,Total\n`;
    sales.forEach(sale => {
      const saleDate = new Date(sale.timestamp);
      const dateStr = saleDate.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
      const timeStr = saleDate.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
      const itemsList = sale.items.map(i => `${i.name} (x${i.quantity})`).join('; ');
      csv += `${sale.orderId},${escapeCSV(dateStr)},${escapeCSV(timeStr)},${escapeCSV(sale.customerName || '')},${escapeCSV(sale.customerEmail || '')},${escapeCSV(itemsList)},${sale.total.toFixed(2)}\n`;
    });
    
    // Add BOM for Excel UTF-8 compatibility
    const BOM = '\uFEFF';
    const csvWithBOM = BOM + csv;
    
    // Create download
    const blob = new Blob([csvWithBOM], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `knowledge-cafe-sales-${date}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function showSalesExportModal() {
    const today = new Date().toISOString().split('T')[0];
    const sales = getDailySales(today);
    
    if (sales.length === 0) {
      alert('No sales data for today yet.');
      return;
    }
    
    // Ask for date
    const dateInput = prompt(`Enter date to export (YYYY-MM-DD)\nLeave empty for today (${today}):`, today);
    if (dateInput === null) return; // User cancelled
    
    const exportDate = dateInput.trim() || today;
    const exportSales = getDailySales(exportDate);
    
    if (exportSales.length === 0) {
      alert(`No sales data found for ${exportDate}.`);
      return;
    }
    
    exportSalesToCSV(exportDate);
    alert(`Sales report for ${exportDate} exported successfully!`);
  }

  function getStatusColor(status) {
    const colors = {
      'pending': '#f59e0b', // orange
      'preparing': '#3b82f6', // blue
      'ready': '#10b981', // green
      'completed': '#6b7280' // gray
    };
    return colors[status] || '#d4a574';
  }

  function getStatusIcon(status) {
    const icons = {
      'pending': 'fa-clock',
      'preparing': 'fa-coffee',
      'ready': 'fa-check-circle',
      'completed': 'fa-check-double'
    };
    return icons[status] || 'fa-circle';
  }

  function getNextStatus(currentStatus) {
    const flow = {
      'pending': 'preparing',
      'preparing': 'ready',
      'ready': 'completed',
      'completed': 'completed' // Can't go further
    };
    return flow[currentStatus] || 'pending';
  }

  function renderQueue() {
    const list = document.getElementById('queueList');
    if (!list) return;
    const queue = JSON.parse(localStorage.getItem('kcafe_order_queue')) || [];
    // Sort by status priority, then by newest first
    const statusOrder = { 'pending': 0, 'preparing': 1, 'ready': 2, 'completed': 3 };
    queue.sort((a, b) => {
      const aStatus = statusOrder[a.status] ?? 4;
      const bStatus = statusOrder[b.status] ?? 4;
      if (aStatus !== bStatus) return aStatus - bStatus;
      return (b.id || 0) - (a.id || 0);
    });
    list.innerHTML = '';
    
    if (queue.length === 0) {
      list.innerHTML = '<div style="text-align:center;padding:40px;color:#5c4033;"><i class="fas fa-inbox" style="font-size:3rem;opacity:0.3;margin-bottom:10px;"></i><p>No orders in queue</p></div>';
      return;
    }

    queue.forEach(o => {
      const div = document.createElement('div');
      div.className = 'queue-card';
      const status = o.status || 'pending';
      const statusColor = getStatusColor(status);
      const statusIcon = getStatusIcon(status);
      const nextStatus = getNextStatus(status);
      const who = o.customer?.name || o.customer?.email || 'Guest';
      const src = o.source || 'online';
      
      div.style.borderLeftColor = statusColor;
      
      // Build status button text
      let statusButtonText = '';
      let statusButtonClass = 'btn-status';
      if (status === 'pending') {
        statusButtonText = '<i class="fas fa-coffee"></i> Start Making';
        statusButtonClass = 'btn-status btn-status-primary';
      } else if (status === 'preparing') {
        statusButtonText = '<i class="fas fa-check-circle"></i> Mark Ready';
        statusButtonClass = 'btn-status btn-status-success';
      } else if (status === 'ready') {
        statusButtonText = '<i class="fas fa-check-double"></i> Mark Completed';
        statusButtonClass = 'btn-status btn-status-complete';
      } else {
        statusButtonText = '<i class="fas fa-check-double"></i> Completed';
        statusButtonClass = 'btn-status btn-status-disabled';
      }

      div.innerHTML = `
        <div class="queue-header">
          <div class="queue-meta">
            <span><strong>#${o.id}</strong> • ${who}</span>
            <span class="status-badge" style="background:${statusColor}20;color:${statusColor};border:1px solid ${statusColor}40;">
              <i class="fas ${statusIcon}"></i> ${status.charAt(0).toUpperCase() + status.slice(1)}
            </span>
          </div>
          <div class="queue-source" style="color:#5c4033;font-size:0.85rem;margin-top:4px;">
            ${src === 'in_person' ? '<i class="fas fa-walk"></i> Walk-in' : '<i class="fas fa-globe"></i> Online'} • ${new Date(o.createdAt).toLocaleTimeString()}
          </div>
        </div>
        <div class="queue-items">
          ${o.items.map(i => `<span class="queue-item">${i.name} × ${i.quantity}</span>`).join('')}
        </div>
        <div class="queue-footer">
          <div class="queue-total">
            <strong>${formatPrice(o.total || 0)}</strong>
          </div>
          <button class="${statusButtonClass}" onclick="window.updateOrderStatus(${o.id}, '${nextStatus}')" ${status === 'completed' ? 'disabled' : ''}>
            ${statusButtonText}
          </button>
        </div>
      `;
      list.appendChild(div);
    });
  }

  // Make updateOrderStatus available globally for onclick handlers
  window.updateOrderStatus = updateOrderStatus;

  function setupTabs() {
    const tabs = Array.from(document.querySelectorAll('.pos-tab[data-tab]'));
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
    const btn = document.getElementById('priceModeBtn');
    if (!btn) return;
    
    // Update button text based on current mode
    function updateButtonText() {
      const icon = priceMode === 'student' ? '<i class="fas fa-graduation-cap"></i>' : '<i class="fas fa-user-tie"></i>';
      const text = priceMode === 'student' ? 'Student Prices' : 'Staff Prices';
      btn.innerHTML = `${icon} ${text}`;
    }
    
    updateButtonText();
    
    btn.addEventListener('click', () => {
      // Toggle between student and staff
      priceMode = priceMode === 'student' ? 'staff' : 'student';
      localStorage.setItem('kcafe_pos_price_mode', priceMode);
      updateButtonText();
      // re-render current category
      const first = PRODUCT_CATALOG[0]?.id || 'coffee';
      renderItems(first);
    });
  }

  function setupButtons() {
    document.getElementById('clearCart')?.addEventListener('click', clearCart);
    document.getElementById('submitOrder')?.addEventListener('click', submitOrder);
    document.getElementById('exportSalesBtn')?.addEventListener('click', showSalesExportModal);
  }

  function init() {
    gateWithPin();
  }

  document.addEventListener('DOMContentLoaded', init);
})();


