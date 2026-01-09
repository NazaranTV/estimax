// Form.js - Shared logic for estimate and invoice forms

// Determine document type from URL
const urlParams = new URLSearchParams(window.location.search);
const editingId = urlParams.get('id') ? Number(urlParams.get('id')) : null;
const docType = window.location.pathname.includes('invoice') ? 'invoice' : 'estimate';

// DOM Elements
const docForm = document.getElementById('docForm');
const lineItemsEl = document.getElementById('lineItems');
const subtotalEl = document.getElementById('subtotal');
const totalEl = document.getElementById('total');
const formStatus = document.getElementById('formStatus');
const formTitle = document.getElementById('formTitle');
const submitBtn = document.getElementById('submitBtn');
const closeBtn = document.getElementById('closeBtn');
const clientModal = document.getElementById('clientModal');
const clientForm = document.getElementById('clientForm');
const clientStatus = document.getElementById('clientStatus');
const clientSelectorModal = document.getElementById('clientSelectorModal');
const clientSelectorList = document.getElementById('clientSelectorList');
const searchClientsInput = document.getElementById('searchClients');
const selectedClientNameEl = document.getElementById('selectedClientName');
const itemModal = document.getElementById('itemModal');
const materialModal = document.getElementById('materialModal');
const itemCreateModal = document.getElementById('itemCreateModal');
const materialCreateModal = document.getElementById('materialCreateModal');
const itemStatus = document.getElementById('itemStatus');
const materialStatus = document.getElementById('materialStatus');
const itemsList = document.getElementById('itemsList');
const materialsPickerList = document.getElementById('materialsPickerList');
const searchItemsInput = document.getElementById('searchItems');
const searchMaterialsInput = document.getElementById('searchMaterials');

// State
let clients = [];
let clientPickerSelection = '';
let items = [];
let materials = [];
let currentLineForPicker = null;
let currentLineForMaterials = null;
let viewMode = 'contractor';
let hasUnsavedChanges = false;
let formSubmitted = false;
let isInitialLoad = true;

// Utility functions
const currency = (value) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value || 0));

// Modal functions
function openItemModal(row) {
  currentLineForPicker = row;
  itemModal.classList.remove('hidden');
  renderItemsList();
}

function closeItemModal() {
  currentLineForPicker = null;
  itemModal.classList.add('hidden');
}

function openMaterialModal(row) {
  currentLineForMaterials = row;
  materialModal.classList.remove('hidden');
  renderMaterialsList();
}

function closeMaterialModal() {
  currentLineForMaterials = null;
  materialModal.classList.add('hidden');
}

function openItemCreateModal() {
  itemCreateModal.classList.remove('hidden');
}

function closeItemCreateModal() {
  itemCreateModal.classList.add('hidden');
}

function openMaterialCreateModal() {
  materialCreateModal.classList.remove('hidden');
}

function closeMaterialCreateModal() {
  materialCreateModal.classList.add('hidden');
}

function openClientModal() {
  clientModal.classList.remove('hidden');
}

function closeClientModal() {
  clientModal.classList.add('hidden');
  clientForm.reset();
  clientStatus.textContent = '';
}

function openClientSelectorModal() {
  clientSelectorModal.classList.remove('hidden');
  renderClientSelectorList();
  searchClientsInput.focus();
}

function closeClientSelectorModal() {
  clientSelectorModal.classList.add('hidden');
  searchClientsInput.value = '';
}

// Date defaults
const setDefaultValidUntil = () => {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  const formatted = date.toISOString().split('T')[0];
  if (!docForm.validUntil.value) docForm.validUntil.value = formatted;
};

// Materials section
const renderMaterialsSection = (row) => {
  console.log('renderMaterialsSection called', { row, viewMode });
  const contentDiv = row.querySelector('.line-item__content');
  if (!contentDiv) {
    console.error('No line-item__content found!');
    return;
  }

  let materialsWrap = row.querySelector('.materials-list');
  if (!materialsWrap) {
    materialsWrap = document.createElement('div');
    materialsWrap.className = 'materials-list';
    materialsWrap.style.cssText = 'display: block !important; margin-top: 8px; padding: 8px 12px; background: rgba(124, 58, 237, 0.05); border-radius: 6px; border-left: 3px solid rgba(124, 58, 237, 0.5);';
    contentDiv.appendChild(materialsWrap);
    console.log('Created new materials section', materialsWrap);
  }
  if (viewMode === 'client') {
    materialsWrap.style.display = 'none';
    return;
  }
  materialsWrap.style.setProperty('display', 'block', 'important');
  materialsWrap.innerHTML = '';

  // Single header row with column headers and Add button
  const headerRow = document.createElement('div');
  headerRow.style.cssText = 'display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; padding-bottom: 4px; border-bottom: 1px solid rgba(124, 58, 237, 0.2);';

  const columnsRow = document.createElement('div');
  columnsRow.style.cssText = 'display: grid; grid-template-columns: 2fr 70px 70px 70px 70px 60px; gap: 6px; flex: 1;';
  columnsRow.innerHTML = `
    <span style="font-size: 10px; font-weight: 600; text-transform: uppercase; color: rgba(124, 58, 237, 0.7); letter-spacing: 0.5px;">Material</span>
    <span style="font-size: 10px; font-weight: 600; text-transform: uppercase; color: rgba(124, 58, 237, 0.7); letter-spacing: 0.5px;">Quantity</span>
    <span style="font-size: 10px; font-weight: 600; text-transform: uppercase; color: rgba(124, 58, 237, 0.7); letter-spacing: 0.5px;">Price</span>
    <span style="font-size: 10px; font-weight: 600; text-transform: uppercase; color: rgba(124, 58, 237, 0.7); letter-spacing: 0.5px;">Markup</span>
    <span style="font-size: 10px; font-weight: 600; text-transform: uppercase; color: rgba(124, 58, 237, 0.7); letter-spacing: 0.5px;">Total</span>
    <span></span>
  `;

  const addBtn = document.createElement('button');
  addBtn.className = 'btn small';
  addBtn.textContent = '+ Add';
  addBtn.type = 'button';
  addBtn.style.cssText = 'padding: 4px 10px; font-size: 12px; margin-left: 8px;';
  addBtn.onclick = () => openMaterialModal(row);

  headerRow.appendChild(columnsRow);
  headerRow.appendChild(addBtn);

  if (!row.materialsData || !row.materialsData.length) {
    materialsWrap.appendChild(headerRow);
    const empty = document.createElement('p');
    empty.className = 'muted';
    empty.style.cssText = 'font-size: 12px; margin: 0; opacity: 0.6;';
    empty.textContent = 'No materials';
    materialsWrap.appendChild(empty);
    return;
  }

  materialsWrap.appendChild(headerRow);

  const materialsTable = document.createElement('div');
  materialsTable.style.cssText = 'display: flex; flex-direction: column; gap: 4px; margin-top: 4px;';

  row.materialsData.forEach((m, idx) => {
    const baseCost = (Number(m.qty) || 0) * (Number(m.rate) || 0);
    const markupPercent = (Number(m.markup) || 0) / 100;
    const materialTotal = baseCost * (1 + markupPercent);
    const mRow = document.createElement('div');
    mRow.className = 'material-row';
    mRow.style.cssText = 'display: grid; grid-template-columns: 2fr 70px 70px 70px 70px 60px; gap: 6px; align-items: center; padding: 4px; background: rgba(0, 0, 0, 0.1); border-radius: 4px;';
    mRow.innerHTML = `
      <input value="${m.name || ''}" placeholder="Material" data-field="m-name" style="padding: 4px 6px; font-size: 12px; background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 3px;">
      <input type="number" step="1" value="${m.qty ?? ''}" placeholder="0" data-field="m-qty" style="padding: 4px 6px; font-size: 12px; background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 3px;">
      <div style="position: relative; display: flex; align-items: center;">
        <span style="position: absolute; left: 6px; font-size: 12px; color: rgba(255, 255, 255, 0.5); pointer-events: none;">$</span>
        <input type="number" step="0.01" value="${m.rate ?? ''}" placeholder="0.00" data-field="m-rate" style="padding: 4px 6px 4px 14px; font-size: 12px; background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 3px; width: 100%;">
      </div>
      <div style="position: relative; display: flex; align-items: center;">
        <input type="number" step="1" value="${m.markup ?? ''}" placeholder="0" data-field="m-markup" style="padding: 4px 16px 4px 6px; font-size: 12px; background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 3px; width: 100%;">
        <span style="position: absolute; right: 6px; font-size: 12px; color: rgba(255, 255, 255, 0.5); pointer-events: none;">%</span>
      </div>
      <div data-field="m-total" style="padding: 4px 6px; font-size: 12px; color: var(--text-secondary); font-weight: 500;">$${materialTotal.toFixed(2)}</div>
      <button type="button" class="btn small ghost" style="padding: 4px 6px; font-size: 11px; color: #ef4444;">✕</button>
    `;
    mRow.querySelectorAll('input:not([type="hidden"])').forEach((input) => {
      input.addEventListener('input', () => {
        const name = mRow.querySelector('[data-field="m-name"]').value;
        const qty = Number(mRow.querySelector('[data-field="m-qty"]').value) || 0;
        const rate = Number(mRow.querySelector('[data-field="m-rate"]').value) || 0;
        const markup = Number(mRow.querySelector('[data-field="m-markup"]').value) || 0;
        row.materialsData[idx] = { name, qty, rate, markup };

        // Update the total display (markup is percentage)
        const baseCost = qty * rate;
        const markupPercent = markup / 100;
        const newTotal = baseCost * (1 + markupPercent);
        mRow.querySelector('[data-field="m-total"]').textContent = `$${newTotal.toFixed(2)}`;

        // Update line total first, then recalc totals
        updateLineTotal(row);
        recalcTotals();
        markFormAsChanged();
      });
    });
    mRow.querySelector('button').addEventListener('click', () => {
      row.materialsData.splice(idx, 1);
      renderMaterialsSection(row);
      recalcTotals();
      updateLineTotal(row);
      markFormAsChanged();
    });
    materialsTable.appendChild(mRow);
  });

  materialsWrap.appendChild(materialsTable);
};

const updatePhotoDisplay = (row) => {
  const photoData = row.dataset.photo;
  let photoContainer = row.querySelector('.line-item__photo-display');

  if (!photoData) {
    if (photoContainer) photoContainer.remove();
    return;
  }

  if (!photoContainer) {
    photoContainer = document.createElement('div');
    photoContainer.className = 'line-item__photo-display';
    photoContainer.style.cssText = 'margin-top: 12px; padding: 12px; background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 8px;';

    const contentDiv = row.querySelector('.line-item__content');
    contentDiv.appendChild(photoContainer);
  }

  photoContainer.innerHTML = `
    <div style="display: flex; align-items: center; gap: 12px;">
      <img src="${photoData}" alt="Line item photo" style="max-width: 150px; max-height: 150px; border-radius: 6px; border: 1px solid rgba(255, 255, 255, 0.1);">
      <button type="button" class="btn small ghost" data-action="remove-photo" style="color: #ef4444;">Remove Photo</button>
    </div>
  `;

  photoContainer.querySelector('[data-action="remove-photo"]').addEventListener('click', () => {
    delete row.dataset.photo;
    updatePhotoDisplay(row);
    markFormAsChanged();
  });
};

const checkItemDuplicate = (row) => {
  const saveBtn = row.querySelector('[data-action="save-as-item"]');
  if (!saveBtn) return;

  const description = row.querySelector('[data-field="description"]').value.trim();

  if (!description) {
    saveBtn.disabled = false;
    saveBtn.style.opacity = '1';
    saveBtn.querySelector('span').textContent = 'Save to Items';
    return;
  }

  // Check if item with same name exists (case-insensitive)
  const isDuplicate = items.some(item =>
    item.name.toLowerCase() === description.toLowerCase()
  );

  if (isDuplicate) {
    saveBtn.disabled = true;
    saveBtn.style.opacity = '0.5';
    saveBtn.style.cursor = 'not-allowed';
    saveBtn.querySelector('span').textContent = 'Already in Items';
  } else {
    saveBtn.disabled = false;
    saveBtn.style.opacity = '1';
    saveBtn.style.cursor = 'pointer';
    saveBtn.querySelector('span').textContent = 'Save to Items';
  }
};

const updateLineTotal = (row) => {
  const qty = Number(row.querySelector('[data-field="qty"]').value) || 0;
  const rate = Number(row.querySelector('[data-field="rate"]').value) || 0;

  // Base line item total (no markup on line items)
  let total = qty * rate;

  // Add all material costs (materials use markup as percentage)
  if (row.materialsData && row.materialsData.length > 0) {
    const materialsCost = row.materialsData.reduce((sum, m) => {
      const mQty = Number(m.qty) || 0;
      const mRate = Number(m.rate) || 0;
      const mMarkup = Number(m.markup) || 0;
      const baseCost = mQty * mRate;
      const markupPercent = mMarkup / 100;
      const materialTotal = baseCost * (1 + markupPercent);
      return Number(sum) + materialTotal;
    }, 0);
    total = Number(total) + Number(materialsCost);
  }

  row.querySelector('[data-field="lineTotal"]').textContent = currency(total);
};

// Line items
const addLineItemRow = (item = {}) => {
  const row = document.createElement('div');
  row.className = 'line-item';
  row.materialsData = item.materials || [];
  if (item.photoData) row.dataset.photo = item.photoData;
  row.innerHTML = `
    <div class="line-item__content">
      <!-- Row 1: Main Controls -->
      <div class="line-item__header">
        <button type="button" class="btn-drag-handle" title="Drag to reorder" draggable="true">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="16" height="2" rx="1" fill="currentColor"/>
            <rect y="7" width="16" height="2" rx="1" fill="currentColor"/>
            <rect y="14" width="16" height="2" rx="1" fill="currentColor"/>
          </svg>
        </button>
        <input placeholder="Item description" value="${item.description || ''}" data-field="description" class="line-item__description">
        <button type="button" data-action="choose-item" class="btn-item-list">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="2" y="3" width="12" height="2" rx="1" fill="currentColor"/>
            <rect x="2" y="7" width="12" height="2" rx="1" fill="currentColor"/>
            <rect x="2" y="11" width="12" height="2" rx="1" fill="currentColor"/>
          </svg>
          <span>Item List</span>
        </button>
        <button type="button" class="btn-remove" data-action="remove" title="Remove line item">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>
      </div>

      <!-- Row 2: Pricing Grid with Labels -->
      <div class="line-item__pricing">
        <div class="line-item__field">
          <label class="line-item__label">Price</label>
          <div style="position: relative;">
            <span style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); font-size: 14px; color: rgba(255, 255, 255, 0.5); pointer-events: none;">$</span>
            <input type="number" step="0.01" placeholder="0.00" value="${item.rate ?? ''}" data-field="rate" style="padding-left: 24px;">
          </div>
        </div>
        <div class="line-item__field">
          <label class="line-item__label">Quantity</label>
          <input type="number" step="1" placeholder="1" value="${item.qty ?? ''}" data-field="qty">
        </div>
        <div class="line-item__field">
          <label class="line-item__label">Photo</label>
          <button type="button" data-action="photo" class="btn-upload-photo">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="2" y="2" width="12" height="12" rx="1.5" stroke="currentColor" stroke-width="1.5"/>
              <path d="M2 11L5 8L7 10L11 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              <circle cx="5" cy="5" r="1" fill="currentColor"/>
            </svg>
            <span>Add Photo</span>
          </button>
        </div>
        <div class="line-item__field">
          <label class="line-item__label">Total</label>
          <div class="line-total" data-field="lineTotal">${currency((item.qty || 0) * (item.rate || 0))}</div>
        </div>
      </div>

      <!-- Row 3: Notes and Actions -->
      <div class="line-item__footer">
        <textarea placeholder="Additional notes or details" data-field="notes" class="line-item__notes" rows="2">${item.notes || ''}</textarea>
        <button type="button" data-action="save-as-item" class="btn-save-item">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M7 2V12M2 7H12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
          <span>Save to Items</span>
        </button>
      </div>
    </div>
  `;

  row.querySelectorAll('input, textarea').forEach((input) =>
    input.addEventListener('input', () => {
      recalcTotals();
      updateLineTotal(row);
      markFormAsChanged();
      if (input.dataset.field === 'description') {
        checkItemDuplicate(row);
      }
    }),
  );

  row.querySelector('[data-action="remove"]').addEventListener('click', () => {
    row.remove();
    recalcTotals();
    markFormAsChanged();
  });

  row.querySelector('[data-action="choose-item"]').addEventListener('click', () => openItemModal(row));

  row.querySelector('[data-action="photo"]').addEventListener('click', async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        row.dataset.photo = reader.result;
        updatePhotoDisplay(row);
        markFormAsChanged();
      };
      reader.readAsDataURL(file);
    };
    input.click();
  });

  row.querySelector('[data-action="save-as-item"]').addEventListener('click', async () => {
    // Get current line item data
    const description = row.querySelector('[data-field="description"]').value.trim();
    const notes = row.querySelector('[data-field="notes"]')?.value?.trim() || '';
    const qty = Number(row.querySelector('[data-field="qty"]').value) || 1;
    const rate = Number(row.querySelector('[data-field="rate"]').value) || 0;
    const markup = Number(row.querySelector('[data-field="markup"]')?.value) || 0;

    // Validate required fields
    if (!description) {
      alert('Please enter an item name before saving.');
      return;
    }

    // Show saving feedback
    const btn = row.querySelector('[data-action="save-as-item"]');
    const originalHTML = btn.innerHTML;
    btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M13 4L6 11L3 8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    btn.disabled = true;

    // Create new item
    const payload = {
      name: description,
      description: notes,
      defaultQty: qty,
      defaultRate: rate,
      defaultMarkup: markup,
    };

    try {
      const res = await fetch('/api/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error('Failed to save item');

      // Reload items list
      await loadItems();

      // Show success feedback
      setTimeout(() => {
        btn.innerHTML = originalHTML;
        btn.disabled = false;
      }, 1500);
    } catch (err) {
      console.error(err);
      alert('Could not save item. Please try again.');
      btn.innerHTML = originalHTML;
      btn.disabled = false;
    }
  });

  if (item.photoData) {
    row.dataset.photo = item.photoData;
    updatePhotoDisplay(row);
  }

  // Add drag and drop functionality
  const dragHandle = row.querySelector('.btn-drag-handle');
  dragHandle.addEventListener('dragstart', (e) => {
    row.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', row.innerHTML);
  });

  dragHandle.addEventListener('dragend', () => {
    row.classList.remove('dragging');
  });

  row.addEventListener('dragover', (e) => {
    e.preventDefault();
    const dragging = lineItemsEl.querySelector('.dragging');
    if (dragging && dragging !== row) {
      const rect = row.getBoundingClientRect();
      const midpoint = rect.top + rect.height / 2;
      if (e.clientY < midpoint) {
        row.parentNode.insertBefore(dragging, row);
      } else {
        row.parentNode.insertBefore(dragging, row.nextSibling);
      }
      markFormAsChanged();
    }
  });

  updateLineTotal(row);
  checkItemDuplicate(row);
  lineItemsEl.appendChild(row);
  renderMaterialsSection(row);
};

const readLineItems = () => {
  const rows = [...lineItemsEl.querySelectorAll('.line-item')];
  return rows
    .map((row) => {
      const description = row.querySelector('[data-field="description"]').value.trim();
      const qty = Number(row.querySelector('[data-field="qty"]').value) || 0;
      const rate = Number(row.querySelector('[data-field="rate"]').value) || 0;
      const notes = row.querySelector('[data-field="notes"]')?.value?.trim() || '';
      const photoData = row.dataset.photo || '';
      const materials = row.materialsData || [];
      return { description, qty, rate, notes, photoData, materials };
    })
    .filter((item) => item.description || item.qty || item.rate);
};

const recalcTotals = () => {
  const items = readLineItems();
  const subtotal = items.reduce((sum, item) => {
    // Calculate base item cost
    let itemTotal = item.qty * item.rate;

    // Add materials costs (materials have markup as percentage, line items don't)
    if (item.materials && item.materials.length > 0) {
      const materialsCost = item.materials.reduce((mSum, m) => {
        const baseCost = m.qty * m.rate;
        const markupPercent = (m.markup || 0) / 100;
        return mSum + (baseCost * (1 + markupPercent));
      }, 0);
      itemTotal += materialsCost;
    }

    return sum + itemTotal;
  }, 0);
  const total = subtotal;
  subtotalEl.textContent = currency(subtotal);
  totalEl.textContent = currency(total);
};

const resetForm = () => {
  docForm.reset();
  lineItemsEl.innerHTML = '';
  addLineItemRow();
  recalcTotals();
  clientPickerSelection = '';
  updateSelectedClientDisplay();
  if (docType === 'estimate') {
    setDefaultValidUntil();
  }
};

// Form submission
docForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  formStatus.textContent = editingId ? 'Updating...' : 'Saving...';
  try {
    const payload = {
      type: docType,
      clientId: clientPickerSelection ? Number(clientPickerSelection) : null,
      clientName: docForm.clientName.value.trim(),
      clientEmail: docForm.clientEmail.value.trim(),
      clientPhone: docForm.clientPhone.value.trim(),
      clientBillingAddress: docForm.clientBillingAddress.value.trim(),
      poNumber: docForm.poNumber.value.trim(),
      projectName: docForm.projectName.value.trim(),
      serviceAddress: docForm.serviceAddress.value.trim(),
      dueDate: docForm.dueDate.value || null,
      validUntil: docForm.validUntil.value || null,
      taxRate: 0,
      notes: docForm.notes.value.trim(),
      lineItems: readLineItems(),
    };
    const url = editingId ? `/api/documents/${editingId}` : '/api/documents';
    const res = await fetch(url, {
      method: editingId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error('Failed to save');
    }
    formStatus.textContent = editingId ? 'Updated' : 'Saved';
    formSubmitted = true; // Mark as submitted to prevent warning
    hasUnsavedChanges = false;
    setTimeout(() => {
      window.location.href = '/';
    }, 800);
  } catch (err) {
    console.error(err);
    formStatus.textContent = 'Could not save. Confirm the server/DB are running.';
  }
});

// Load data
const loadClients = async () => {
  try {
    const res = await fetch('/api/clients');
    clients = await res.json();
    populateClientPicker();
  } catch (err) {
    console.error(err);
  }
};

const populateClientPicker = () => {
  const picker = document.getElementById('clientPicker');
  if (!picker) return;
  picker.innerHTML = '<option value="">Select saved client</option>';
  clients.forEach((c) => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.name + (c.company ? ` — ${c.company}` : '');
    picker.appendChild(opt);
  });
  if (clientPickerSelection) picker.value = clientPickerSelection;
};

const loadItems = async () => {
  try {
    const res = await fetch('/api/items');
    items = await res.json();

    // Re-check all line items for duplicates
    document.querySelectorAll('.line-item').forEach(row => {
      checkItemDuplicate(row);
    });
  } catch (err) {
    console.error(err);
  }
};

const loadMaterials = async () => {
  try {
    const res = await fetch('/api/materials');
    materials = await res.json();
  } catch (err) {
    console.error(err);
  }
};

const renderClientSelectorList = () => {
  const term = (searchClientsInput.value || '').toLowerCase();
  clientSelectorList.innerHTML = '';

  const filteredClients = clients.filter((c) =>
    (c.name || '').toLowerCase().includes(term) ||
    (c.email || '').toLowerCase().includes(term) ||
    (c.company || '').toLowerCase().includes(term)
  );

  if (filteredClients.length === 0) {
    clientSelectorList.innerHTML = '<p class="muted" style="text-align:center;padding:20px;">No clients found</p>';
    return;
  }

  filteredClients.forEach((c) => {
    const card = document.createElement('div');
    card.className = 'client-card';
    card.innerHTML = `
      <div>
        <h4>${c.name || 'Unnamed Client'}</h4>
        <p class="meta">${c.company ? c.company + ' • ' : ''}${c.email || 'No email'}</p>
        ${c.phone ? `<p class="meta">${c.phone}</p>` : ''}
      </div>
      <button class="btn small primary" data-client-id="${c.id}">Select</button>
    `;
    card.querySelector('button').onclick = () => {
      applyClientToForm(c.id);
      closeClientSelectorModal();
    };
    clientSelectorList.appendChild(card);
  });
};

const updateSelectedClientDisplay = () => {
  if (clientPickerSelection) {
    const client = clients.find((c) => c.id === Number(clientPickerSelection));
    if (client) {
      selectedClientNameEl.textContent = client.name + (client.company ? ` — ${client.company}` : '');
    } else {
      selectedClientNameEl.textContent = 'Select saved client';
    }
  } else {
    selectedClientNameEl.textContent = 'Select saved client';
  }
};

const applyClientToForm = (id) => {
  const client = clients.find((c) => c.id === id);
  if (!client) return;
  clientPickerSelection = String(id);
  updateSelectedClientDisplay();
  docForm.clientName.value = client.name || '';
  docForm.clientEmail.value = client.email || '';
  docForm.clientPhone.value = client.phone || '';
  docForm.clientBillingAddress.value = client.billingAddress || '';
  markFormAsChanged();
};

const renderItemsList = () => {
  const term = (searchItemsInput.value || '').toLowerCase();
  itemsList.innerHTML = '';
  items
    .filter((i) => i.name.toLowerCase().includes(term) || (i.description || '').toLowerCase().includes(term))
    .forEach((i) => {
      const card = document.createElement('div');
      card.className = 'client-card';
      card.innerHTML = `
        <div>
          <h4>${i.name}</h4>
          <p class="meta">${i.description || 'No description'}</p>
          <p class="meta">Qty ${i.defaultQty || 1} · Rate ${currency(i.defaultRate || 0)} · Markup ${currency(i.defaultMarkup || 0)}</p>
        </div>
        <button class="btn small ghost" data-item-id="${i.id}">Use</button>
      `;
      card.querySelector('button').onclick = () => {
        if (currentLineForPicker) {
          currentLineForPicker.querySelector('[data-field="description"]').value = i.name;
          currentLineForPicker.querySelector('[data-field="notes"]').value = i.description || '';
          currentLineForPicker.querySelector('[data-field="qty"]').value = i.defaultQty || 1;
          currentLineForPicker.querySelector('[data-field="rate"]').value = i.defaultRate || 0;
          currentLineForPicker.materialsData = currentLineForPicker.materialsData || [];
          // Trigger input event to update line total
          currentLineForPicker.querySelector('[data-field="rate"]').dispatchEvent(new Event('input'));
          markFormAsChanged();
          closeItemModal();
        }
      };
      itemsList.appendChild(card);
    });
};

const renderMaterialsList = () => {
  const term = (searchMaterialsInput.value || '').toLowerCase();
  materialsPickerList.innerHTML = '';
  materials
    .filter(
      (m) =>
        m.name.toLowerCase().includes(term) ||
        (m.description || '').toLowerCase().includes(term),
    )
    .forEach((m) => {
      const card = document.createElement('div');
      card.className = 'client-card';
      card.innerHTML = `
        <div>
          <h4>${m.name}</h4>
          <p class="meta">${m.description || 'No description'}</p>
          <p class="meta">Qty ${m.defaultQty || 1} · Rate ${currency(m.defaultRate || 0)} · Markup ${m.defaultMarkup || 0}%</p>
        </div>
        <button class="btn small ghost" data-material-id="${m.id}">Use</button>
      `;
      card.querySelector('button').onclick = () => {
        if (currentLineForMaterials) {
          currentLineForMaterials.materialsData = currentLineForMaterials.materialsData || [];

          // If material has a default quantity, calculate unit rate (markup is percentage, not divided)
          const defaultQty = m.defaultQty || 1;
          const unitRate = defaultQty > 1 ? Math.round(((m.defaultRate || 0) / defaultQty) * 100) / 100 : (m.defaultRate || 0);

          currentLineForMaterials.materialsData.push({
            name: m.name,
            qty: 1,  // Always default to quantity of 1
            rate: unitRate,
            markup: Math.round(m.defaultMarkup || 0),  // Markup is percentage, round to whole number
          });
          renderMaterialsSection(currentLineForMaterials);
          recalcTotals();
          markFormAsChanged();
          closeMaterialModal();
        }
      };
      materialsPickerList.appendChild(card);
    });
};

// Load document if editing
const loadDocument = async () => {
  if (!editingId) return;
  try {
    const res = await fetch(`/api/documents/${editingId}`);
    if (!res.ok) throw new Error('Document not found');
    const doc = await res.json();

    formTitle.textContent = `Update ${docType}`;
    submitBtn.textContent = 'Update';

    docForm.clientName.value = doc.clientName || '';
    docForm.clientEmail.value = doc.clientEmail || '';
    docForm.clientPhone.value = doc.clientPhone || '';
    docForm.clientBillingAddress.value = doc.clientBillingAddress || '';
    docForm.poNumber.value = doc.poNumber || '';
    clientPickerSelection = doc.clientId ? String(doc.clientId) : '';
    updateSelectedClientDisplay();
    docForm.projectName.value = doc.projectName || '';
    docForm.serviceAddress.value = doc.serviceAddress || '';
    docForm.dueDate.value = doc.dueDate ? doc.dueDate.split('T')[0] : '';
    docForm.validUntil.value = doc.validUntil ? doc.validUntil.split('T')[0] : '';
    docForm.notes.value = doc.notes || '';

    lineItemsEl.innerHTML = '';
    (doc.lineItems || []).forEach((item) => addLineItemRow(item));
    if (!lineItemsEl.children.length) addLineItemRow();
    recalcTotals();
  } catch (err) {
    console.error(err);
    alert('Failed to load document');
    window.location.href = '/';
  }
};

// Track form changes
const markFormAsChanged = () => {
  if (!isInitialLoad) {
    hasUnsavedChanges = true;
  }
};

// Warn before leaving with unsaved changes
window.addEventListener('beforeunload', (e) => {
  if (hasUnsavedChanges && !formSubmitted) {
    e.preventDefault();
    e.returnValue = ''; // Chrome requires returnValue to be set
  }
});

// Navigation pill handling
const topNav = document.getElementById('topNav');
if (topNav) {
  topNav.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn || !btn.dataset.view) return;

    if (hasUnsavedChanges && !formSubmitted) {
      const confirmLeave = confirm('You have unsaved changes. Are you sure you want to leave this page?');
      if (!confirmLeave) return;
    }

    const view = btn.dataset.view;
    if (view === 'estimates' || view === 'invoices' || view === 'overview') {
      window.location.href = '/';
    } else {
      window.location.href = `/#${view}`;
    }
  });
}

// Event listeners
closeBtn.addEventListener('click', () => {
  if (hasUnsavedChanges && !formSubmitted) {
    const confirmLeave = confirm('You have unsaved changes. Are you sure you want to leave this page?');
    if (!confirmLeave) return;
  }
  window.location.href = '/';
});

document.getElementById('addLineItem').addEventListener('click', () => {
  addLineItemRow();
  markFormAsChanged();
});

document.getElementById('resetForm').addEventListener('click', () => {
  const confirmReset = confirm('Are you sure you want to clear the form? This will remove all unsaved data.');
  if (confirmReset) {
    resetForm();
    hasUnsavedChanges = false;
  }
});

// Track changes on all form inputs
docForm.addEventListener('input', markFormAsChanged);
docForm.addEventListener('change', markFormAsChanged);

// Client modal
document.getElementById('closeClientModal').addEventListener('click', closeClientModal);
const addClientBtn = document.getElementById('addClientFromForm');
if (addClientBtn) {
  addClientBtn.addEventListener('click', openClientModal);
}

clientForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  clientStatus.textContent = 'Saving...';
  const payload = {
    name: clientForm.name.value.trim(),
    email: clientForm.email.value.trim(),
    phone: clientForm.phone.value.trim(),
    company: clientForm.company.value.trim(),
    billingEmail: clientForm.billingEmail.value.trim(),
    billingAddress: clientForm.billingAddress.value.trim(),
    notes: clientForm.notes.value.trim(),
  };
  try {
    const res = await fetch('/api/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Failed to save client');
    const newClient = await res.json();
    await loadClients();
    if (newClient && newClient.id) {
      applyClientToForm(newClient.id);
    }
    closeClientModal();
    clientStatus.textContent = '';
  } catch (err) {
    console.error(err);
    clientStatus.textContent = 'Could not save client.';
  }
});

// Client selector modal
document.getElementById('openClientSelectorBtn').addEventListener('click', openClientSelectorModal);
document.getElementById('closeClientSelectorModal').addEventListener('click', closeClientSelectorModal);
searchClientsInput.addEventListener('input', renderClientSelectorList);

// Save as New Client button
const saveAsNewClientBtn = document.getElementById('saveAsNewClient');
if (saveAsNewClientBtn) {
  saveAsNewClientBtn.addEventListener('click', async () => {
    // Gather current form data
    const clientName = docForm.clientName.value.trim();
    const clientEmail = docForm.clientEmail.value.trim();
    const clientPhone = docForm.clientPhone.value.trim();
    const clientBillingAddress = docForm.clientBillingAddress.value.trim();

    // Validate required fields
    if (!clientName) {
      alert('Please enter a client name before saving.');
      return;
    }

    // Show saving status
    const originalText = saveAsNewClientBtn.textContent;
    saveAsNewClientBtn.textContent = 'Saving...';
    saveAsNewClientBtn.disabled = true;

    // Create new client
    const payload = {
      name: clientName,
      email: clientEmail,
      phone: clientPhone,
      billingAddress: clientBillingAddress,
      company: '',
      notes: '',
    };

    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error('Failed to save client');

      const newClient = await res.json();

      // Reload clients list and select the new client
      await loadClients();

      if (newClient && newClient.id) {
        clientPickerSelection = String(newClient.id);
        updateSelectedClientDisplay();
      }

      // Show success feedback
      saveAsNewClientBtn.textContent = 'Saved!';
      setTimeout(() => {
        saveAsNewClientBtn.textContent = originalText;
        saveAsNewClientBtn.disabled = false;
      }, 2000);
    } catch (err) {
      console.error(err);
      alert('Could not save client. Please try again.');
      saveAsNewClientBtn.textContent = originalText;
      saveAsNewClientBtn.disabled = false;
    }
  });
}

// Item modal
document.getElementById('closeItemModal').addEventListener('click', closeItemModal);
document.getElementById('closeItemCreateModal').addEventListener('click', closeItemCreateModal);

searchItemsInput.addEventListener('input', renderItemsList);

document.getElementById('itemForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  itemStatus.textContent = 'Saving...';
  const form = e.target;
  const payload = {
    name: form.name.value.trim(),
    description: form.description.value.trim(),
    defaultQty: Number(form.defaultQty.value) || 1,
    defaultRate: Number(form.defaultRate.value) || 0,
    defaultMarkup: Number(form.defaultMarkup.value) || 0,
  };
  try {
    const res = await fetch('/api/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Failed to save item');
    await loadItems();
    itemStatus.textContent = '';
    closeItemCreateModal();
  } catch (err) {
    console.error(err);
    itemStatus.textContent = 'Could not save item';
  }
});

// Material modal
document.getElementById('closeMaterialModal').addEventListener('click', closeMaterialModal);
document.getElementById('closeMaterialCreateModal').addEventListener('click', closeMaterialCreateModal);

searchMaterialsInput.addEventListener('input', renderMaterialsList);

document.getElementById('materialForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  materialStatus.textContent = 'Saving...';
  const form = e.target;
  const payload = {
    name: form.name.value.trim(),
    description: form.description.value.trim(),
    defaultQty: Number(form.defaultQty.value) || 1,
    defaultRate: Number(form.defaultRate.value) || 0,
    defaultMarkup: Number(form.defaultMarkup.value) || 0,
  };
  try {
    const res = await fetch('/api/materials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Failed to save material');
    await loadMaterials();
    materialStatus.textContent = '';
    closeMaterialCreateModal();
  } catch (err) {
    console.error(err);
    materialStatus.textContent = 'Could not save material';
  }
});

// Modal backdrop clicks
[itemModal, materialModal, itemCreateModal, materialCreateModal, clientModal, clientSelectorModal].forEach(modal => {
  modal.querySelector('.modal__backdrop')?.addEventListener('click', () => {
    if (modal === itemModal) closeItemModal();
    else if (modal === materialModal) closeMaterialModal();
    else if (modal === itemCreateModal) closeItemCreateModal();
    else if (modal === materialCreateModal) closeMaterialCreateModal();
    else if (modal === clientModal) closeClientModal();
    else if (modal === clientSelectorModal) closeClientSelectorModal();
  });
});

// Initialize
(async () => {
  formTitle.textContent = editingId ? `Update ${docType}` : `Create ${docType}`;
  await loadClients();
  await loadItems();
  await loadMaterials();

  if (editingId) {
    await loadDocument();
  } else {
    addLineItemRow();
    if (docType === 'estimate') {
      setDefaultValidUntil();
    }
  }

  recalcTotals();

  // Enable change tracking after initial load
  setTimeout(() => {
    isInitialLoad = false;
  }, 100);
})();
