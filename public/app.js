// Authentication check - redirect to login if not authenticated
let currentUser = null;

async function checkAuth() {
  try {
    const res = await fetch('/api/auth/me', {
      credentials: 'include' // Include cookies in the request
    });

    if (!res.ok) {
      // Not authenticated - redirect to login
      window.location.href = '/login.html';
      return false;
    }

    const { user } = await res.json();
    currentUser = user;

    // Check if email is verified (optional - you can remove this if you want to allow unverified users)
    // if (!user.emailVerified) {
    //   alert('Please verify your email address. Check your inbox for the verification link.');
    // }

    return true;
  } catch (err) {
    console.error('Auth check failed:', err);
    window.location.href = '/login.html';
    return false;
  }
}

// Run auth check before initializing app
(async () => {
  const isAuthenticated = await checkAuth();
  if (!isAuthenticated) return;

  // Continue with app initialization below
  initApp();
})();

function initApp() {
  // Original app.js code starts here
const docForm = document.getElementById('docForm');
const lineItemsEl = document.getElementById('lineItems');
const subtotalEl = document.getElementById('subtotal');
const totalEl = document.getElementById('total');
const formStatus = document.getElementById('formStatus');
const formTitle = document.getElementById('formTitle');
const recentList = document.getElementById('recentList');
const filters = document.querySelector('.filters');
const listEl = document.getElementById('list');
const submitBtn = document.getElementById('submitBtn');
const workspace = document.getElementById('workspace');
const overviewView = document.getElementById('overviewView');
const placeholder = document.getElementById('placeholder');
const placeholderTitle = document.getElementById('placeholderTitle');
const placeholderLabel = document.getElementById('placeholderLabel');
const topNav = document.getElementById('topNav');
const clientsView = document.getElementById('clientsView');
const materialsView = document.getElementById('materialsView');
const itemsView = document.getElementById('itemsView');
const settingsView = document.getElementById('settingsView');
const aiView = document.getElementById('aiView');
const typeList = document.getElementById('typeList');
const searchDocs = document.getElementById('searchDocs');
const newDocBtn = document.getElementById('newDocBtn');
const listEyebrow = document.getElementById('listEyebrow');
const listTitle = document.getElementById('listTitle');
const addMaterialFromViewBtn = document.getElementById('addMaterialFromView');
const addItemFromViewBtn = document.getElementById('addItemFromView');
const itemsList = document.getElementById('itemsList');
const materialsPickerList = document.getElementById('materialsPickerList');
const materialsListView = document.getElementById('materialsList');
const itemsListView = document.getElementById('itemsListView');
const searchItemsInput = document.getElementById('searchItems');
const searchMaterialsInput = document.getElementById('searchMaterials');
const itemModal = document.getElementById('itemModal');
const materialModal = document.getElementById('materialModal');
const itemCreateModal = document.getElementById('itemCreateModal');
const materialCreateModal = document.getElementById('materialCreateModal');
const itemStatus = document.getElementById('itemStatus');
const materialStatus = document.getElementById('materialStatus');
const contractorModal = document.getElementById('contractorModal');
const clientViewModal = document.getElementById('clientViewModal');
const clientViewBody = document.getElementById('clientViewBody');
const closeContractorModalBtn = document.getElementById('closeContractorModal');
const closeClientViewModalBtn = document.getElementById('closeClientViewModal');
const sendModal = document.getElementById('sendModal');
const closeSendModalBtn = document.getElementById('closeSendModal');
const sendStatus = document.getElementById('sendStatus');
const statusFilters = document.getElementById('statusFilters');

let documents = [];
let activeType = 'estimate';
let filterType = 'all';
let editingId = null;
let activeView = 'overview';
let clients = [];
let clientPickerSelection = '';
let searchTerm = '';
let items = [];
let materials = [];
let viewMode = 'contractor';
let currentSendId = null;
let activeStatusFilter = 'all';
let notifications = [];
let showUnreadOnly = false;
let unreadCount = 0;

// Status filter options
const estimateStatuses = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Sent' },
  { value: 'approved', label: 'Approved' },
  { value: 'declined', label: 'Declined' }
];

const invoiceStatuses = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Sent' },
  { value: 'viewed', label: 'Viewed' }
];
const debugLogEl = document.getElementById('debugLog');
const debugPane = document.getElementById('debugPane');
const toggleDebugBtn = document.getElementById('toggleDebug');

const logDebug = (msg) => {
  // Debug logging disabled in production
  // const time = new Date().toLocaleTimeString();
  // const line = `[${time}] ${msg}\n`;
  // if (debugLogEl) {
  //   debugLogEl.textContent = line + debugLogEl.textContent;
  // }
  // console.debug('DEBUG:', msg);
};

window.addEventListener('error', (e) => {
  logDebug(`Error: ${e.message}`);
});
window.addEventListener('unhandledrejection', (e) => {
  logDebug(`Promise rejection: ${e.reason}`);
});

const currency = (value) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value || 0));

// Modal functions (defined early to avoid initialization errors)
let currentLineForPicker = null;
let currentLineForMaterials = null;

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

// Define view/send/modal functions early (before renderTypeList uses them)
const openClientView = (doc) => {
  const dateLabel =
    doc.type === 'estimate'
      ? doc.validUntil
        ? `Valid until ${new Date(doc.validUntil).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`
        : ''
      : doc.dueDate
      ? `Due Date: ${new Date(doc.dueDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`
      : '';

  const lineItemsHtml = (doc.lineItems || []).map((li) => {
    const markup = Number(li.markup) || 0;
    const total = ((li.qty || 0) * (li.rate || 0)) + markup;
    return `
      <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.1);">
        <td style="padding: 12px 4px; vertical-align: top; word-wrap: break-word; overflow-wrap: break-word;">
          <div style="font-weight: 600; margin-bottom: 4px; font-size: 14px; word-wrap: break-word;">${li.description || 'Untitled Item'}</div>
          ${li.notes ? `<div style="font-size: 12px; color: var(--muted); line-height: 1.5; word-wrap: break-word;">${li.notes}</div>` : ''}
        </td>
        <td style="padding: 12px 4px; text-align: center; color: var(--muted); font-size: 13px; vertical-align: top;">${currency(li.rate || 0)}</td>
        <td style="padding: 12px 4px; text-align: center; color: var(--muted); font-size: 13px; vertical-align: top;">${li.qty || 0}</td>
        <td style="padding: 12px 4px; text-align: right; font-weight: 600; font-size: 14px; vertical-align: top;">${currency(total)}</td>
      </tr>
    `;
  }).join('');

  clientViewBody.innerHTML = `
    <div style="display: block;">
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; padding-bottom: 20px; border-bottom: 2px solid rgba(255, 255, 255, 0.1);">
        <div>
          <h4 style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: var(--muted); margin-bottom: 10px;">Bill To</h4>
        <p style="font-size: 14px; font-weight: 600; margin-bottom: 3px;">${doc.clientName}</p>
        ${doc.clientEmail ? `<p style="font-size: 13px; color: var(--muted);">${doc.clientEmail}</p>` : ''}
        ${doc.clientPhone ? `<p style="font-size: 13px; color: var(--muted);">${doc.clientPhone}</p>` : ''}
        ${doc.clientBillingAddress ? `<p style="font-size: 12px; color: var(--muted); margin-top: 6px; line-height: 1.4;">${doc.clientBillingAddress}</p>` : ''}
      </div>
      <div style="text-align: right;">
        <h4 style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: var(--muted); margin-bottom: 10px;">Document Info</h4>
        <p style="font-size: 13px; margin-bottom: 3px;"><span style="color: var(--muted);">${doc.type === 'estimate' ? 'Estimate #' : 'Invoice #'}</span> <strong>${doc.poNumber || '—'}</strong></p>
        ${dateLabel ? `<p style="font-size: 13px; color: var(--muted);">${dateLabel}</p>` : ''}
        ${doc.projectName ? `<p style="font-size: 12px; color: var(--muted); margin-top: 6px;">Project: ${doc.projectName}</p>` : ''}
        ${doc.serviceAddress ? `<p style="font-size: 12px; color: var(--muted); margin-top: 3px;">Service: ${doc.serviceAddress}</p>` : ''}
        </div>
      </div>

      <div style="margin-bottom: 24px;">
        <table style="width: 100%; border-collapse: collapse; table-layout: fixed;">
          <thead style="border-bottom: 2px solid rgba(255, 255, 255, 0.2);">
            <tr>
              <th style="padding: 10px 4px; text-align: left; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Description</th>
              <th style="padding: 10px 4px; text-align: center; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; width: 70px;">Rate</th>
              <th style="padding: 10px 4px; text-align: center; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; width: 45px;">Qty</th>
              <th style="padding: 10px 4px; text-align: right; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; width: 85px;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${lineItemsHtml}
          </tbody>
        </table>
      </div>

      <div style="border-top: 2px solid rgba(255, 255, 255, 0.2); padding-top: 16px; margin-bottom: 20px;">
        <div style="display: flex; justify-content: flex-end;">
          <div style="display: flex; justify-content: space-between; padding: 12px 0; font-size: 16px; font-weight: 700; min-width: 200px;">
            <span>TOTAL</span>
            <span>${currency(doc.total)}</span>
          </div>
        </div>
      </div>

      ${doc.notes ? `
      <div style="background: rgba(255, 255, 255, 0.05); padding: 16px; border-radius: 8px; border-left: 4px solid var(--accent);">
        <h4 style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: var(--muted); margin-bottom: 10px;">Notes</h4>
        <p style="font-size: 13px; line-height: 1.6; white-space: pre-wrap; word-wrap: break-word;">${doc.notes}</p>
      </div>
      ` : ''}
    </div>
  `;
  clientViewTitle.textContent = `${doc.type.charAt(0).toUpperCase() + doc.type.slice(1)} Preview`;
  clientViewModal.classList.remove('hidden');
  logDebug(`Opened client preview for ${doc.type} #${doc.id}`);
};

const closeClientViewModal = () => clientViewModal.classList.add('hidden');

const openSend = (doc) => {
  currentSendId = doc.id;
  sendStatus.textContent = '';
  sendModal.classList.remove('hidden');
  logDebug(`Send modal opened for doc ${doc.id}`);
};

const closeSendModal = () => {
  currentSendId = null;
  sendModal.classList.add('hidden');
  logDebug('Send modal closed');
};

const createInvoiceFromEstimate = async (estimate, cardElement) => {
  try {
    logDebug(`Creating invoice from estimate ${estimate.id}`);

    const payload = {
      type: 'invoice',
      clientId: estimate.clientId,
      clientName: estimate.clientName,
      clientEmail: estimate.clientEmail,
      clientPhone: estimate.clientPhone,
      clientBillingEmail: estimate.clientBillingEmail,
      clientBillingAddress: estimate.clientBillingAddress,
      projectName: estimate.projectName,
      lineItems: estimate.lineItems,
      taxRate: estimate.taxRate || 0,
      notes: estimate.notes || '',
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days from now
      convertedFromEstimate: true, // Flag to track conversion
    };

    const res = await fetch('/api/documents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text();
      logDebug(`Invoice creation failed: ${res.status} ${res.statusText} - ${errText}`);
      throw new Error('Failed to create invoice');
    }

    const invoice = await res.json();
    logDebug(`Invoice created: ${invoice.poNumber}`);

    // Delete the estimate
    await fetch(`/api/documents/${estimate.id}`, { method: 'DELETE' });

    // Show inline notification
    if (cardElement) {
      cardElement.innerHTML = `
        <div style="padding: 20px; text-align: center; color: var(--accent);">
          Estimate ${estimate.poNumber} converted to Invoice ${invoice.poNumber}
        </div>
      `;
      cardElement.style.transition = 'opacity 1s';
      setTimeout(() => {
        cardElement.style.opacity = '0';
        setTimeout(async () => {
          await loadDocuments();
          switchView('invoices');
        }, 1000);
      }, 1500);
    } else {
      await loadDocuments();
      switchView('invoices');
    }
  } catch (err) {
    console.error(err);
    alert('Could not create invoice. Please try again.');
  }
};

const createEstimateFromInvoice = async (invoice, cardElement) => {
  try {
    logDebug(`Converting invoice ${invoice.id} back to estimate`);

    const payload = {
      type: 'estimate',
      clientId: invoice.clientId,
      clientName: invoice.clientName,
      clientEmail: invoice.clientEmail,
      clientPhone: invoice.clientPhone,
      clientBillingEmail: invoice.clientBillingEmail,
      clientBillingAddress: invoice.clientBillingAddress,
      projectName: invoice.projectName,
      lineItems: invoice.lineItems,
      taxRate: invoice.taxRate || 0,
      notes: invoice.notes || '',
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days from now
    };

    const res = await fetch('/api/documents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text();
      logDebug(`Estimate creation failed: ${res.status} ${res.statusText} - ${errText}`);
      throw new Error('Failed to create estimate');
    }

    const estimate = await res.json();
    logDebug(`Estimate created: ${estimate.poNumber}`);

    // Delete the invoice
    await fetch(`/api/documents/${invoice.id}`, { method: 'DELETE' });

    // Show inline notification
    if (cardElement) {
      cardElement.innerHTML = `
        <div style="padding: 20px; text-align: center; color: var(--accent);">
          Invoice ${invoice.poNumber} converted to Estimate ${estimate.poNumber}
        </div>
      `;
      cardElement.style.transition = 'opacity 1s';
      setTimeout(() => {
        cardElement.style.opacity = '0';
        setTimeout(async () => {
          await loadDocuments();
          switchView('estimates');
        }, 1000);
      }, 1500);
    } else {
      await loadDocuments();
      switchView('estimates');
    }
  } catch (err) {
    console.error(err);
    alert('Could not convert to estimate. Please try again.');
  }
};

function openContractorModal() {
  if (!contractorModal) return alert('Contractor form missing from page.');
  if (!clients.length) loadClients();
  contractorModal.classList.remove('hidden');
  viewMode = 'contractor';
  document.querySelectorAll('.materials-list').forEach((el) => (el.style.display = 'block'));
  logDebug('Contractor modal opened');
}

function closeContractorModal() {
  contractorModal.classList.add('hidden');
  logDebug('Contractor modal closed');
}

let deleteDocumentPending = null;

const deleteDocument = (id, type) => {
  deleteDocumentPending = { id, type };
  const modal = document.getElementById('deleteConfirmModal');
  const text = document.getElementById('deleteConfirmText');
  text.textContent = `Are you sure you want to delete this ${type}? This action cannot be undone.`;
  modal.classList.remove('hidden');
};

const confirmDeleteDocument = async () => {
  if (!deleteDocumentPending) return;
  try {
    await fetch(`/api/documents/${deleteDocumentPending.id}`, { method: 'DELETE' });
    await loadDocuments();
    closeDeleteModal();
  } catch (err) {
    console.error(err);
    alert('Failed to delete document');
  }
};

const closeDeleteModal = () => {
  deleteDocumentPending = null;
  document.getElementById('deleteConfirmModal').classList.add('hidden');
};

const copyDocument = async (doc) => {
  try {
    logDebug(`Copying ${doc.type} ${doc.id}`);

    const payload = {
      type: doc.type,
      clientId: doc.clientId,
      clientName: doc.clientName,
      clientEmail: doc.clientEmail,
      clientPhone: doc.clientPhone,
      clientBillingEmail: doc.clientBillingEmail,
      clientBillingAddress: doc.clientBillingAddress,
      projectName: doc.projectName ? `${doc.projectName} (Copy)` : '',
      serviceAddress: doc.serviceAddress || '',
      lineItems: doc.lineItems || [],
      taxRate: doc.taxRate || 0,
      notes: doc.notes || '',
      dueDate: doc.dueDate || null,
      validUntil: doc.validUntil || null,
      poNumber: null, // Always generate a new PO number for copies
    };

    const res = await fetch('/api/documents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text();
      logDebug(`Copy failed: ${res.status} ${res.statusText} - ${errText}`);
      throw new Error('Failed to copy');
    }

    const newDoc = await res.json();
    logDebug(`Copy created: ${newDoc.poNumber}`);

    await loadDocuments();
    alert(`${doc.type.charAt(0).toUpperCase() + doc.type.slice(1)} copied as ${newDoc.poNumber}`);
  } catch (err) {
    console.error(err);
    alert('Could not copy document. Please try again.');
  }
};

let currentPaymentDoc = null;
const openPaymentsModal = (doc) => {
  currentPaymentDoc = doc;
  const modal = document.getElementById('paymentsModal');
  modal.classList.remove('hidden');

  // Set invoice info
  document.getElementById('paymentsInvoiceInfo').textContent = `${doc.poNumber || 'N/A'} • ${doc.clientName}`;

  // Set default payment date to today
  const today = new Date().toISOString().split('T')[0];
  document.querySelector('[name="paymentDate"]').value = today;

  // Load existing payments for this document
  loadPaymentsHistory(doc.id);
  updatePaymentsSummary(doc);
  logDebug(`Payments modal opened for ${doc.type} #${doc.id}`);
};

const closePaymentsModal = () => {
  const modal = document.getElementById('paymentsModal');
  modal.classList.add('hidden');
  document.getElementById('paymentsForm').reset();
  currentPaymentDoc = null;
};

const updatePaymentsSummary = (doc) => {
  const totalPaid = doc.totalPaid || 0;
  const balance = doc.remainingBalance || doc.total;
  const percentage = doc.total > 0 ? (totalPaid / doc.total) * 100 : 0;

  document.getElementById('paymentsInvoiceTotal').textContent = currency(doc.total);
  document.getElementById('paymentsTotalPaid').textContent = currency(totalPaid);
  document.getElementById('paymentsBalance').textContent = currency(balance);
  document.getElementById('paymentsProgressBar').style.width = `${Math.min(percentage, 100)}%`;
};

const loadPaymentsHistory = async (docId) => {
  try {
    const res = await fetch(`/api/documents/${docId}/payments`);
    const payments = await res.json();
    const list = document.getElementById('paymentsList');

    if (!payments || !payments.length) {
      list.innerHTML = `
        <div style="padding: 32px; text-align: center; background: rgba(255, 255, 255, 0.02); border: 1px dashed var(--border); border-radius: 12px;">
          <p class="muted">No payments recorded yet.</p>
          <p class="muted" style="font-size: 13px; margin-top: 4px;">Record your first payment above to get started.</p>
        </div>
      `;
      return;
    }

    // Sort payments by date (newest first)
    payments.sort((a, b) => new Date(b.paymentDate) - new Date(a.paymentDate));

    list.innerHTML = payments.map((p, index) => `
      <div style="padding: 16px; background: ${index % 2 === 0 ? 'rgba(255, 255, 255, 0.02)' : 'transparent'}; border: 1px solid var(--border); border-radius: 8px; margin-bottom: 8px;">
        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 6px;">
          <div>
            <h4 style="margin: 0; color: var(--accent);">${currency(p.amount)}</h4>
            <p class="meta" style="margin-top: 4px;">
              <span style="text-transform: capitalize;">${p.paymentMethod.replace('_', ' ')}</span>
              ${p.checkNumber ? ` • Check #${p.checkNumber}` : ''}
            </p>
          </div>
          <div style="text-align: right;">
            <p class="eyebrow" style="margin-bottom: 2px;">Payment Date</p>
            <p style="font-weight: 600; font-size: 14px;">${new Date(p.paymentDate).toLocaleDateString()}</p>
          </div>
        </div>
        ${p.notes ? `<p class="muted" style="margin-top: 8px; font-size: 13px; font-style: italic;">"${p.notes}"</p>` : ''}
      </div>
    `).join('');
  } catch (err) {
    console.error(err);
    document.getElementById('paymentsList').innerHTML = '<p class="muted">Could not load payments.</p>';
  }
};

const setDefaultValidUntil = () => {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  const formatted = date.toISOString().split('T')[0];
  if (!docForm.validUntil.value) docForm.validUntil.value = formatted;
};

const setFormType = (type) => {
  activeType = type;
  formTitle.textContent = `Create ${type}`;
  const estFields = document.querySelector('.date-estimate');
  const invFields = document.querySelector('.date-invoice');
  if (type === 'estimate') {
    estFields.style.display = 'block';
    invFields.style.display = 'none';
    setDefaultValidUntil();
  } else {
    estFields.style.display = 'none';
    invFields.style.display = 'block';
    if (!docForm.dueDate.value) {
      docForm.dueDate.value = '';
    }
  }
};

const renderMaterialsSection = (row) => {
  let materialsWrap = row.querySelector('.materials-list');
  if (!materialsWrap) {
    materialsWrap = document.createElement('div');
    materialsWrap.className = 'materials-list';
    row.appendChild(materialsWrap);
  }
  if (viewMode === 'client') {
    materialsWrap.style.display = 'none';
    return;
  }
  materialsWrap.style.display = 'block';
  materialsWrap.innerHTML = '';
  const addBtn = document.createElement('button');
  addBtn.className = 'btn small';
  addBtn.textContent = 'Add material';
  addBtn.type = 'button';
  addBtn.onclick = () => openMaterialModal(row);
  materialsWrap.appendChild(addBtn);
  if (!row.materialsData || !row.materialsData.length) {
    const empty = document.createElement('p');
    empty.className = 'muted';
    empty.textContent = 'No materials added';
    materialsWrap.appendChild(empty);
    return;
  }
  row.materialsData.forEach((m, idx) => {
    const mRow = document.createElement('div');
    mRow.className = 'material-row';
    mRow.innerHTML = `
      <input value="${m.name || ''}" placeholder="Material" data-field="m-name">
      <input type="number" step="1" value="${m.qty ?? ''}" placeholder="Qty" data-field="m-qty">
      <input type="number" step="0.01" value="${m.rate ?? ''}" placeholder="Rate" data-field="m-rate">
      <input type="number" step="1" value="${m.markup ?? ''}" placeholder="Markup %" data-field="m-markup">
      <button type="button">Remove</button>
    `;
    const sync = () => {
      row.materialsData[idx] = {
        name: mRow.querySelector('[data-field="m-name"]').value,
        qty: Number(mRow.querySelector('[data-field="m-qty"]').value) || 0,
        rate: Number(mRow.querySelector('[data-field="m-rate"]').value) || 0,
        markup: Number(mRow.querySelector('[data-field="m-markup"]').value) || 0,
      };
      recalcTotals();
    };
    mRow.querySelectorAll('input').forEach((input) => input.addEventListener('input', sync));
    mRow.querySelector('button').onclick = () => {
      row.materialsData.splice(idx, 1);
      renderMaterialsSection(row);
      recalcTotals();
    };
    materialsWrap.appendChild(mRow);
  });
};

const addLineItemRow = (item = {}) => {
  const row = document.createElement('div');
  row.className = 'line-item';
  row.materialsData = item.materials || [];
  if (item.photoData) row.dataset.photo = item.photoData;
  row.innerHTML = `
    <div class="line-item__content">
      <div class="line-item__row">
        <button type="button" class="btn-remove" data-action="remove" title="Remove line item">−</button>
        <input placeholder="Item Name" value="${item.description || ''}" data-field="description" class="line-item__description">
        <button type="button" data-action="choose-item" class="btn-item-list">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="2" y="3" width="12" height="2" rx="1" fill="currentColor"/>
            <rect x="2" y="7" width="12" height="2" rx="1" fill="currentColor"/>
            <rect x="2" y="11" width="12" height="2" rx="1" fill="currentColor"/>
          </svg>
          Item List
        </button>
        <input type="number" step="0.01" placeholder="Price" value="${item.rate ?? ''}" data-field="rate" class="line-item__rate">
        <input type="number" step="1" placeholder="QTY" value="${item.qty ?? ''}" data-field="qty" class="line-item__qty">
        <input type="number" step="0.01" placeholder="Markup" value="${item.markup ?? ''}" data-field="markup" class="line-item__markup">
        <button type="button" data-action="photo" class="btn-upload-photo" title="Upload photos">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="2" y="2" width="16" height="16" rx="2" stroke="currentColor" stroke-width="1.5"/>
            <path d="M3 14L7 10L10 13L15 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            <circle cx="6.5" cy="6.5" r="1.5" fill="currentColor"/>
            <path d="M10 10L10 10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
          <span class="plus-icon">+</span>
        </button>
        <div class="line-total" data-field="lineTotal">${currency((item.qty || 0) * (item.rate || 0))}</div>
        <button type="button" class="btn-drag-handle" title="Drag to reorder" draggable="true">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="16" height="2" rx="1" fill="currentColor"/>
            <rect y="7" width="16" height="2" rx="1" fill="currentColor"/>
            <rect y="14" width="16" height="2" rx="1" fill="currentColor"/>
          </svg>
        </button>
      </div>
      <textarea placeholder="Item description" data-field="notes" class="line-item__notes" rows="3">${item.notes || ''}</textarea>
    </div>
  `;
  const updateLineTotal = () => {
    const qty = Number(row.querySelector('[data-field="qty"]').value) || 0;
    const rate = Number(row.querySelector('[data-field="rate"]').value) || 0;
    const markup = Number(row.querySelector('[data-field="markup"]')?.value) || 0;
    const total = (qty * rate) + markup;
    row.querySelector('[data-field="lineTotal"]').textContent = currency(total);
  };

  row.querySelectorAll('input, textarea').forEach((input) =>
    input.addEventListener('input', () => {
      recalcTotals();
      updateLineTotal();
    }),
  );
  row.querySelector('[data-action="remove"]').addEventListener('click', () => {
    row.remove();
    recalcTotals();
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
      };
      reader.readAsDataURL(file);
    };
    input.click();
  });

  if (item.photoData) {
    row.dataset.photo = item.photoData;
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
    }
  });

  updateLineTotal();
  lineItemsEl.appendChild(row);
};

document.getElementById('addLineItem').addEventListener('click', () => addLineItemRow());
document.getElementById('resetForm').addEventListener('click', () => resetForm());

const readLineItems = () => {
  const rows = [...lineItemsEl.querySelectorAll('.line-item')];
  return rows
    .map((row) => {
      const description = row.querySelector('[data-field="description"]').value.trim();
      const qty = Number(row.querySelector('[data-field="qty"]').value) || 0;
      const rate = Number(row.querySelector('[data-field="rate"]').value) || 0;
      const markup = Number(row.querySelector('[data-field="markup"]')?.value) || 0;
      const notes = row.querySelector('[data-field="notes"]')?.value?.trim() || '';
      const photoData = row.dataset.photo || '';
      return { description, qty, rate, markup, notes, photoData };
    })
    .filter((item) => item.description || item.qty || item.rate);
};

const recalcTotals = () => {
  const items = readLineItems();
  const subtotal = items.reduce((sum, item) => {
    const markup = item.markup || 0;
    return sum + ((item.qty * item.rate) + markup);
  }, 0);
  const total = subtotal;
  subtotalEl.textContent = currency(subtotal);
  totalEl.textContent = currency(total);
};

docForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  formStatus.textContent = editingId ? 'Updating...' : 'Saving...';
  try {
    const payload = {
      type: activeType,
      clientId: clientPickerSelection ? Number(clientPickerSelection) : null,
      clientName: docForm.clientName.value.trim(),
      clientEmail: docForm.clientEmail.value.trim(),
      clientPhone: docForm.clientPhone.value.trim(),
      clientBillingEmail: docForm.clientBillingEmail.value.trim(),
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
    logDebug(`Save failed: ${res.status} ${res.statusText} - ${errText}`);
    throw new Error('Failed to save');
  }
  await loadDocuments();
  formStatus.textContent = editingId ? 'Updated' : 'Saved';
  editingId = null;
  submitBtn.textContent = 'Save';
    formTitle.textContent = `Create ${activeType}`;
    setTimeout(() => {
      formStatus.textContent = '';
      closeContractorModal();
    }, 800);
  } catch (err) {
    console.error(err);
    formStatus.textContent = 'Could not save. Confirm the server/DB are running.';
  }
});

const resetForm = () => {
  docForm.reset();
  lineItemsEl.innerHTML = '';
  addLineItemRow();
  recalcTotals();
  editingId = null;
  submitBtn.textContent = 'Save';
  setFormType(activeType);
  clientPickerSelection = '';
  populateClientPicker();
  setDefaultValidUntil();
};

const renderSummary = () => {
  const drafts = documents.filter((d) => d.status === 'draft').length;
  const sentThisWeek = documents.filter((d) => {
    if (!d.sentAt) return false;
    const sent = new Date(d.sentAt);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return sent >= weekAgo;
  }).length;
  const outstanding = documents
    .filter((d) => d.status !== 'paid')
    .reduce((sum, d) => sum + Number(d.total || 0), 0);
  const unpaidInvoices = documents
    .filter((d) => d.type === 'invoice' && d.status !== 'paid')
    .reduce((sum, d) => sum + Number(d.total || 0), 0);

  document.getElementById('draftCount').textContent = drafts;
  document.getElementById('sentCount').textContent = sentThisWeek;
  document.getElementById('outstandingCount').textContent = currency(outstanding);
  const unpaidEl = document.getElementById('unpaidCount');
  if (unpaidEl) unpaidEl.textContent = currency(unpaidInvoices);
};

const renderRecent = () => {
  recentList.innerHTML = '';
  documents.slice(0, 4).forEach((doc) => {
    const item = document.createElement('li');
    item.className = 'panel__item';
    item.innerHTML = `
      <div>
        <p class="eyebrow">${doc.type} · PO ${doc.poNumber || '—'}</p>
        <strong>${doc.clientName}</strong>
        <p class="meta">${doc.projectName || 'No project'}</p>
      </div>
      <div class="value">${currency(doc.total)}</div>
    `;
    recentList.appendChild(item);
  });
};

const statusPill = (doc) => {
  const wrapper = document.createElement('div');
  wrapper.className = 'status-pills-wrapper';
  wrapper.style.display = 'flex';
  wrapper.style.gap = '8px';

  // For invoices, show ONE pill: delivery status (Draft/Sent/Viewed)
  // For estimates, show ONE pill: delivery status (with approval options)

  // DELIVERY STATUS PILL (Draft/Sent/Viewed for all, + Approved/Declined for estimates)
  const deliveryContainer = document.createElement('div');
  deliveryContainer.className = 'status-dropdown-container';

  const deliveryPill = document.createElement('button');
  const deliveryStatus = doc.status || 'draft';
  deliveryPill.className = 'pill ' + (deliveryStatus === 'sent' ? 'success' : deliveryStatus === 'viewed' ? 'info' : deliveryStatus === 'approved' ? 'success' : deliveryStatus === 'declined' ? 'warn' : 'warn');
  deliveryPill.textContent = deliveryStatus;
  deliveryPill.title = 'Click to change delivery status';

  const deliveryMenu = document.createElement('div');
  deliveryMenu.className = 'status-dropdown-menu hidden';

  // Delivery statuses
  const deliveryStatuses = doc.type === 'estimate'
    ? ['draft', 'sent', 'viewed', 'approved', 'declined']
    : ['draft', 'sent', 'viewed'];

  deliveryStatuses.forEach(status => {
    const btn = document.createElement('button');
    btn.className = 'status-dropdown-item';
    btn.textContent = status;
    btn.onclick = async (e) => {
      e.stopPropagation();
      deliveryMenu.classList.add('hidden');
      await updateStatus(doc.id, status, 'delivery');
    };
    deliveryMenu.appendChild(btn);
  });

  deliveryPill.onclick = (e) => {
    e.stopPropagation();
    document.querySelectorAll('.status-dropdown-menu, .dropdown-menu').forEach(m => {
      if (m !== deliveryMenu) m.classList.add('hidden');
    });
    deliveryMenu.classList.toggle('hidden');

    if (!deliveryMenu.classList.contains('hidden')) {
      const rect = deliveryPill.getBoundingClientRect();
      const menuHeight = deliveryMenu.offsetHeight;
      const viewportHeight = window.innerHeight;
      const spaceBelow = viewportHeight - rect.bottom;

      if (spaceBelow < menuHeight + 20) {
        deliveryMenu.style.top = 'auto';
        deliveryMenu.style.bottom = 'calc(100% + 4px)';
      } else {
        deliveryMenu.style.top = 'calc(100% + 4px)';
        deliveryMenu.style.bottom = 'auto';
      }
    }
  };

  document.addEventListener('click', (e) => {
    if (!deliveryContainer.contains(e.target)) {
      deliveryMenu.classList.add('hidden');
    }
  });

  deliveryContainer.appendChild(deliveryPill);
  deliveryContainer.appendChild(deliveryMenu);
  wrapper.appendChild(deliveryContainer);

  return wrapper;
};

const renderList = () => {
  listEl.innerHTML = '';
  const filtered =
    filterType === 'all' ? documents : documents.filter((doc) => doc.type === filterType);

  if (!filtered.length) {
    listEl.innerHTML = '<p class="muted">No documents yet. Save one to see it here.</p>';
    return;
  }

  filtered.forEach((doc) => {
    const card = document.createElement('div');
    card.className = 'doc-card';
    const dateLabel =
      doc.type === 'estimate'
        ? doc.validUntil
          ? `Valid until ${new Date(doc.validUntil).toLocaleDateString()}`
          : 'No valid until'
        : doc.dueDate
        ? `Due ${new Date(doc.dueDate).toLocaleDateString()}`
        : 'No due date';
    card.innerHTML = `
      <div class="doc-card-clickable">
        <p class="eyebrow">${doc.type}</p>
        <h4>${doc.clientName}</h4>
        <p class="meta">PO ${doc.poNumber || '—'} · ${doc.projectName || 'No project'}</p>
      </div>
      <div class="value">${currency(doc.total)}</div>
      <div class="actions"></div>
    `;

    // Make the card clickable to open view
    card.querySelector('.doc-card-clickable').onclick = () => openClientView(doc);

    const actions = card.querySelector('.actions');
    actions.appendChild(statusPill(doc));
    if (doc.status !== 'sent') {
      const sendBtn = document.createElement('button');
      sendBtn.className = 'btn small';
      sendBtn.textContent = 'Send';
      sendBtn.onclick = (e) => {
        e.stopPropagation();
        markSent(doc.id);
      };
      actions.appendChild(sendBtn);
    }
    if (doc.status !== 'paid') {
      const paidBtn = document.createElement('button');
      paidBtn.className = 'btn small ghost';
      paidBtn.textContent = 'Mark paid';
      paidBtn.onclick = (e) => {
        e.stopPropagation();
        updateStatus(doc.id, 'paid');
      };
      actions.appendChild(paidBtn);
    }
    const loadBtn = document.createElement('button');
    loadBtn.className = 'btn small ghost';
    loadBtn.textContent = 'Edit';
    loadBtn.onclick = (e) => {
      e.stopPropagation();
      window.location.href = `/${doc.type}-form.html?id=${doc.id}`;
    };
    actions.appendChild(loadBtn);

    listEl.appendChild(card);
  });
};

const matchesSearch = (doc) => {
  if (!searchTerm) return true;
  const term = searchTerm.toLowerCase();
  const fields = [
    doc.poNumber,
    doc.clientName,
    doc.clientEmail,
    doc.clientPhone,
    doc.projectName,
    doc.clientBillingEmail,
    doc.clientBillingAddress,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return fields.includes(term);
};

const renderStatusFilters = () => {
  if (!statusFilters) return;

  const statuses = activeType === 'estimate' ? estimateStatuses : invoiceStatuses;
  statusFilters.innerHTML = statuses.map(status =>
    `<button class="${activeStatusFilter === status.value ? 'active' : ''}" data-status="${status.value}">${status.label}</button>`
  ).join('');

  // Add click handlers
  statusFilters.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      activeStatusFilter = btn.dataset.status;
      renderStatusFilters();
      renderTypeList();
    });
  });
};

const matchesStatusFilter = (doc) => {
  if (activeStatusFilter === 'all') return true;

  // For estimates, match directly
  if (doc.type === 'estimate') {
    return doc.status === activeStatusFilter;
  }

  // For invoices, handle special cases
  if (doc.type === 'invoice') {
    if (activeStatusFilter === 'unpaid') {
      return doc.status === 'unpaid' || (!doc.totalPaid || doc.totalPaid === 0);
    }
    if (activeStatusFilter === 'partial') {
      return doc.status === 'partial' || (doc.totalPaid > 0 && doc.remainingBalance > 0);
    }
    if (activeStatusFilter === 'paid') {
      return doc.status === 'paid' || doc.remainingBalance <= 0;
    }
    return doc.status === activeStatusFilter;
  }

  return true;
};

const renderTypeList = () => {
  typeList.innerHTML = '';
  const filtered = documents
    .filter((doc) => doc.type === activeType && matchesSearch(doc) && matchesStatusFilter(doc))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)); // Sort by newest first
  if (!filtered.length) {
    typeList.innerHTML = '<p class="muted">No records yet. Add one to see it here.</p>';
    return;
  }
    filtered.forEach((doc) => {
      const card = document.createElement('div');
      card.className = 'doc-card';
    const dateLabel =
      doc.type === 'estimate'
        ? doc.validUntil
          ? `Valid until ${new Date(doc.validUntil).toLocaleDateString()}`
          : 'No valid until'
        : doc.dueDate
        ? `Due ${new Date(doc.dueDate).toLocaleDateString()}`
        : 'No due date';
    const createdDate = doc.createdAt ? new Date(doc.createdAt).toLocaleDateString() : '';

    // Show remaining balance for invoices with payments
    let amountDisplay = currency(doc.total);
    if (doc.type === 'invoice' && doc.totalPaid > 0) {
      amountDisplay = `
        <div style="text-align: right;">
          <div style="font-size: 12px; color: var(--muted);">Paid: ${currency(doc.totalPaid)}</div>
          <div style="font-weight: 700; color: ${doc.remainingBalance <= 0 ? 'var(--accent)' : '#e8f5d6'};">
            Balance: ${currency(doc.remainingBalance)}
          </div>
        </div>
      `;
    }

    card.innerHTML = `
      <div class="doc-card-clickable">
        <p class="eyebrow">${doc.type} ${createdDate ? `· Created ${createdDate}` : ''}</p>
        <h4>${doc.clientName}</h4>
        <p class="meta">PO ${doc.poNumber || '—'} · ${doc.projectName || 'No project'} · ${dateLabel}</p>
      </div>
      <div class="value">${amountDisplay}</div>
      <div class="actions"></div>
    `;

    // Make the card clickable to open view
    card.querySelector('.doc-card-clickable').onclick = () => openClientView(doc);

    const actions = card.querySelector('.actions');

    // Add Invoice button for estimates
    if (doc.type === 'estimate') {
      const invoiceBtn = document.createElement('button');
      invoiceBtn.className = 'btn small';
      invoiceBtn.textContent = 'Invoice';
      invoiceBtn.onclick = (e) => {
        e.stopPropagation();
        createInvoiceFromEstimate(doc, card);
      };
      actions.appendChild(invoiceBtn);
    }

    // Add Payments button for invoices
    if (doc.type === 'invoice') {
      const paymentsBtn = document.createElement('button');
      paymentsBtn.className = 'btn small ghost';
      paymentsBtn.textContent = 'Payments';
      paymentsBtn.onclick = (e) => {
        e.stopPropagation();
        openPaymentsModal(doc);
      };
      actions.appendChild(paymentsBtn);

      // Add "Convert to Estimate" button for invoices that were converted from estimates
      if (doc.convertedFromEstimate) {
        const convertBtn = document.createElement('button');
        convertBtn.className = 'btn small ghost';
        convertBtn.textContent = 'Convert to Estimate';
        convertBtn.onclick = (e) => {
          e.stopPropagation();
          const card = e.target.closest('.doc-card');
          createEstimateFromInvoice(doc, card);
        };
        actions.appendChild(convertBtn);
      }
    }

    const sendBtn = document.createElement('div');
    sendBtn.className = 'dropdown-container';
    sendBtn.innerHTML = `
      <button class="btn small ghost dropdown-trigger">Share ▼</button>
      <div class="dropdown-menu hidden">
        <button class="dropdown-item" data-action="view">View</button>
        <button class="dropdown-item" data-action="print">Print</button>
        <button class="dropdown-item" data-action="email">Email</button>
        <button class="dropdown-item" data-action="sms">SMS</button>
      </div>
    `;

    const trigger = sendBtn.querySelector('.dropdown-trigger');
    const menu = sendBtn.querySelector('.dropdown-menu');

    trigger.onclick = (e) => {
      e.stopPropagation();
      // Close all other dropdown menus (both regular and status)
      document.querySelectorAll('.dropdown-menu, .status-dropdown-menu').forEach(m => {
        if (m !== menu) {
          m.classList.add('hidden');
        }
      });
      // Toggle current menu
      menu.classList.toggle('hidden');

      // Position dropdown to avoid going off-screen
      if (!menu.classList.contains('hidden')) {
        const rect = trigger.getBoundingClientRect();
        const menuHeight = menu.offsetHeight;
        const viewportHeight = window.innerHeight;
        const spaceBelow = viewportHeight - rect.bottom;

        if (spaceBelow < menuHeight + 20) {
          // Not enough space below, position above
          menu.style.top = 'auto';
          menu.style.bottom = 'calc(100% + 4px)';
        } else {
          // Enough space below, position normally
          menu.style.top = 'calc(100% + 4px)';
          menu.style.bottom = 'auto';
        }
      }
    };

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!sendBtn.contains(e.target)) {
        menu.classList.add('hidden');
      }
    });

    // Handle dropdown actions
    sendBtn.querySelectorAll('[data-action]').forEach(btn => {
      btn.onclick = async (e) => {
        e.stopPropagation();
        menu.classList.add('hidden');
        const action = btn.dataset.action;

        if (action === 'view') {
          // Open client view in new tab
          if (doc.shareToken) {
            window.open(`/view/${doc.shareToken}`, '_blank');
          } else {
            alert('No share link available for this document');
          }
        } else if (action === 'print') {
          printDocument(doc);
        } else if (action === 'email') {
          // Send via email
          try {
            const response = await fetch(`/api/documents/${doc.id}/send`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ sendMethod: 'email' }),
            });

            if (!response.ok) {
              const error = await response.json();
              throw new Error(error.error || 'Failed to send email');
            }

            alert(`Email sent successfully to ${doc.clientEmail || 'client'}!`);
            await loadDocuments();
          } catch (error) {
            console.error('Email error:', error);
            alert(`Failed to send email: ${error.message}`);
          }
        } else {
          // SMS - just mark as sent
          await markSent(doc.id);
          alert(`Prepared to ${action}`);
          await loadDocuments();
        }
      };
    });

    actions.appendChild(sendBtn);

    const editBtn = document.createElement('button');
    editBtn.className = 'btn small ghost';
    editBtn.textContent = 'Edit';
    editBtn.onclick = (e) => {
      e.stopPropagation();
      window.location.href = `/${doc.type}-form.html?id=${doc.id}`;
    };
    actions.appendChild(editBtn);

    const copyBtn = document.createElement('button');
    copyBtn.className = 'btn small ghost';
    copyBtn.textContent = 'Copy';
    copyBtn.onclick = (e) => {
      e.stopPropagation();
      copyDocument(doc);
    };
    actions.appendChild(copyBtn);

    actions.appendChild(statusPill(doc));

    // Add delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn-remove';
    deleteBtn.textContent = '−';
    deleteBtn.title = 'Delete';
    deleteBtn.onclick = (e) => {
      e.stopPropagation();
      deleteDocument(doc.id, doc.type);
    };
    actions.appendChild(deleteBtn);

    typeList.appendChild(card);
  });
};

filters.addEventListener('click', (e) => {
  if (!e.target.dataset.filter) return;
  filterType = e.target.dataset.filter;
  filters.querySelectorAll('button').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.filter === filterType);
  });
  renderList();
});

searchDocs.addEventListener('input', (e) => {
  searchTerm = e.target.value;
  renderTypeList();
});

if (newDocBtn) {
  newDocBtn.addEventListener('click', () => {
    const type = activeView === 'invoices' ? 'invoice' : 'estimate';
    logDebug(`New clicked on view ${activeView}`);
    window.location.href = `/${type}-form.html`;
  });
} else {
  logDebug('newDocBtn not found');
}

const switchView = (view) => {
  activeView = view;
  topNav.querySelectorAll('button').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.view === view);
  });

  if (view === 'overview') {
    overviewView.classList.remove('hidden');
    workspace.classList.add('hidden');
    placeholder.classList.add('hidden');
    clientsView.classList.add('hidden');
    materialsView.classList.add('hidden');
    itemsView.classList.add('hidden');
    settingsView.classList.add('hidden');
    aiView.classList.add('hidden');
    document.getElementById('notificationsView').classList.add('hidden');
    filterType = 'all';
    filters.querySelectorAll('button').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.filter === filterType);
    });
    renderList();
  } else if (view === 'estimates' || view === 'invoices') {
    overviewView.classList.add('hidden');
    workspace.classList.remove('hidden');
    placeholder.classList.add('hidden');
    clientsView.classList.add('hidden');
    materialsView.classList.add('hidden');
    itemsView.classList.add('hidden');
    settingsView.classList.add('hidden');
    aiView.classList.add('hidden');
    document.getElementById('notificationsView').classList.add('hidden');
    setFormType(view === 'estimates' ? 'estimate' : 'invoice');
    listEyebrow.textContent = view === 'estimates' ? 'Estimates' : 'Invoices';
    listTitle.textContent = view === 'estimates' ? 'All estimates' : 'All invoices';
    document.getElementById('newDocBtn').textContent = view === 'estimates' ? 'Create Estimate' : 'Create Invoice';
    searchDocs.value = '';
    searchTerm = '';
    activeStatusFilter = 'all';
    renderStatusFilters();
    renderTypeList();
  } else if (view === 'clients') {
    overviewView.classList.add('hidden');
    workspace.classList.add('hidden');
    placeholder.classList.add('hidden');
    clientsView.classList.remove('hidden');
    materialsView.classList.add('hidden');
    itemsView.classList.add('hidden');
    settingsView.classList.add('hidden');
    aiView.classList.add('hidden');
    document.getElementById('notificationsView').classList.add('hidden');
    if (!clients.length) loadClients();
  } else if (view === 'materials') {
    overviewView.classList.add('hidden');
    workspace.classList.add('hidden');
    clientsView.classList.add('hidden');
    itemsView.classList.add('hidden');
    settingsView.classList.add('hidden');
    placeholder.classList.add('hidden');
    materialsView.classList.remove('hidden');
    aiView.classList.add('hidden');
    document.getElementById('notificationsView').classList.add('hidden');
    if (!materials.length) loadMaterials();
  } else if (view === 'items') {
    overviewView.classList.add('hidden');
    workspace.classList.add('hidden');
    clientsView.classList.add('hidden');
    materialsView.classList.add('hidden');
    settingsView.classList.add('hidden');
    placeholder.classList.add('hidden');
    itemsView.classList.remove('hidden');
    aiView.classList.add('hidden');
    document.getElementById('notificationsView').classList.add('hidden');
    if (!items.length) loadItems();
    renderItemsView();
  } else if (view === 'notifications') {
    overviewView.classList.add('hidden');
    workspace.classList.add('hidden');
    clientsView.classList.add('hidden');
    materialsView.classList.add('hidden');
    itemsView.classList.add('hidden');
    settingsView.classList.add('hidden');
    placeholder.classList.add('hidden');
    aiView.classList.add('hidden');
    document.getElementById('notificationsView').classList.remove('hidden');
    loadNotifications();
  } else if (view === 'settings') {
    overviewView.classList.add('hidden');
    workspace.classList.add('hidden');
    clientsView.classList.add('hidden');
    materialsView.classList.add('hidden');
    itemsView.classList.add('hidden');
    placeholder.classList.add('hidden');
    aiView.classList.add('hidden');
    document.getElementById('notificationsView').classList.add('hidden');
    settingsView.classList.remove('hidden');
  } else if (view === 'ai') {
    overviewView.classList.add('hidden');
    workspace.classList.add('hidden');
    clientsView.classList.add('hidden');
    materialsView.classList.add('hidden');
    itemsView.classList.add('hidden');
    settingsView.classList.add('hidden');
    placeholder.classList.add('hidden');
    document.getElementById('notificationsView').classList.add('hidden');
    aiView.classList.remove('hidden');
  } else {
    overviewView.classList.add('hidden');
    workspace.classList.add('hidden');
    clientsView.classList.add('hidden');
    materialsView.classList.add('hidden');
    itemsView.classList.add('hidden');
    settingsView.classList.add('hidden');
    aiView.classList.add('hidden');
    document.getElementById('notificationsView').classList.add('hidden');
    placeholder.classList.remove('hidden');
    placeholderLabel.textContent = 'Coming soon';
    placeholderTitle.textContent =
      view.charAt(0).toUpperCase() + view.slice(1) + ' view';
  }
};

topNav.addEventListener('click', (e) => {
  if (!e.target.dataset.view) return;
  switchView(e.target.dataset.view);
});

const fillForm = (doc) => {
  editingId = doc.id;
  setFormType(doc.type);
  docForm.clientName.value = doc.clientName || '';
  docForm.clientEmail.value = doc.clientEmail || '';
  docForm.clientPhone.value = doc.clientPhone || '';
  docForm.clientBillingEmail.value = doc.clientBillingEmail || '';
  docForm.clientBillingAddress.value = doc.clientBillingAddress || '';
  docForm.poNumber.value = doc.poNumber || '';
  clientPickerSelection = doc.clientId ? String(doc.clientId) : '';
  populateClientPicker();
  document.getElementById('clientPicker').value = clientPickerSelection;
  docForm.projectName.value = doc.projectName || '';
  docForm.serviceAddress.value = doc.serviceAddress || '';
  docForm.dueDate.value = doc.dueDate ? doc.dueDate.split('T')[0] : '';
  docForm.validUntil.value = doc.validUntil ? doc.validUntil.split('T')[0] : '';
  docForm.notes.value = doc.notes || '';
  submitBtn.textContent = 'Update';
  formTitle.textContent = `Update ${doc.type}`;
  lineItemsEl.innerHTML = '';
  (doc.lineItems || []).forEach((item) => addLineItemRow(item));
  if (!lineItemsEl.children.length) addLineItemRow();
  recalcTotals();
  openContractorModal();
};

const markSent = async (id) => {
  try {
    await fetch(`/api/documents/${id}/send`, { method: 'POST' });
    await loadDocuments();
  } catch (err) {
    console.error(err);
  }
};

const updateStatus = async (id, status, statusType = 'delivery') => {
  try {
    const payload = statusType === 'payment'
      ? { paymentStatus: status }
      : { status };

    await fetch(`/api/documents/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    await loadDocuments();
  } catch (err) {
    console.error(err);
  }
};

const loadDocuments = async () => {
  try {
    const res = await fetch('/api/documents', { credentials: 'include' });
    if (!res.ok) {
      throw new Error(`Failed to fetch documents: ${res.status}`);
    }
    documents = await res.json();

    // Load payments for each invoice
    for (const doc of documents) {
      if (doc.type === 'invoice') {
        try {
          const paymentsRes = await fetch(`/api/documents/${doc.id}/payments`);
          if (paymentsRes.ok) {
            const payments = await paymentsRes.json();
            const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);
            doc.totalPaid = totalPaid;
            doc.remainingBalance = doc.total - totalPaid;

            // Auto-update payment status based on payment amount
            let expectedPaymentStatus;
            if (totalPaid === 0) {
              expectedPaymentStatus = 'unpaid';
            } else if (doc.remainingBalance > 0) {
              expectedPaymentStatus = 'partial';
            } else {
              expectedPaymentStatus = 'paid';
            }

            // Update payment status if it doesn't match expected status
            if (doc.paymentStatus !== expectedPaymentStatus) {
              await fetch(`/api/documents/${doc.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ paymentStatus: expectedPaymentStatus }),
              });
              doc.paymentStatus = expectedPaymentStatus;
            }
          } else {
            doc.totalPaid = 0;
            doc.remainingBalance = doc.total;
          }
        } catch (err) {
          console.error(`Error loading payments for document ${doc.id}:`, err);
          doc.totalPaid = 0;
          doc.remainingBalance = doc.total;
        }
      }
    }

    // Render functions with individual error handling
    try {
      renderSummary();
    } catch (err) {
      console.error('Error rendering summary:', err);
    }

    try {
      renderRecent();
    } catch (err) {
      console.error('Error rendering recent:', err);
    }

    try {
      renderList();
    } catch (err) {
      console.error('Error rendering list:', err);
    }

    try {
      renderTypeList();
    } catch (err) {
      console.error('Error rendering type list:', err);
    }
  } catch (err) {
    console.error('Error loading documents:', err);
    listEl.innerHTML =
      '<p class="muted">Could not load data. Ensure Postgres is reachable and the server is running.</p>';
    typeList.innerHTML =
      '<p class="muted">Could not load data. Ensure Postgres is reachable and the server is running.</p>';
  }
};

const loadClients = async () => {
  try {
    const res = await fetch('/api/clients', { credentials: 'include' });
    clients = await res.json();
  renderClients();
  populateClientPicker();
  renderItemsList();
  renderMaterialsList();
  renderItemsView();
  renderMaterialsView();
  } catch (err) {
    console.error(err);
  }
};

const loadItems = async () => {
  try {
    const res = await fetch('/api/items', { credentials: 'include' });
    items = await res.json();
    renderItemsList();
    renderItemsView();
  } catch (err) {
    console.error(err);
  }
};

const loadMaterials = async () => {
  try {
    const res = await fetch('/api/materials', { credentials: 'include' });
    materials = await res.json();
    renderMaterialsList();
    renderMaterialsView();
  } catch (err) {
    console.error(err);
  }
};

// Notifications functions
const loadNotifications = async () => {
  try {
    const url = showUnreadOnly
      ? '/api/notifications?unreadOnly=true'
      : '/api/notifications';
    const res = await fetch(url);
    notifications = await res.json();
    renderNotifications();
    logDebug(`Loaded ${notifications.length} notifications`);
  } catch (err) {
    console.error('Failed to load notifications:', err);
  }
};

const loadUnreadCount = async () => {
  try {
    const res = await fetch('/api/notifications/unread-count', { credentials: 'include' });
    const data = await res.json();
    unreadCount = data.count;
    updateNotificationsBadge();
  } catch (err) {
    console.error('Failed to load unread count:', err);
  }
};

const updateNotificationsBadge = () => {
  const badge = document.getElementById('notificationsBadge');
  if (unreadCount > 0) {
    badge.textContent = unreadCount;
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
};

const renderNotifications = () => {
  const list = document.getElementById('notificationsList');

  if (!notifications.length) {
    list.innerHTML = `
      <div style="padding: 60px 20px; text-align: center;">
        <p class="muted" style="font-size: 16px;">No notifications yet</p>
        <p class="meta" style="margin-top: 8px;">You'll see updates here when clients view your documents</p>
      </div>
    `;
    return;
  }

  list.innerHTML = notifications.map(notification => {
    const timestamp = new Date(notification.createdAt);
    const relativeTime = getRelativeTime(timestamp);

    return `
      <div class="notification-card ${notification.isRead ? 'read' : 'unread'}" data-id="${notification.id}">
        <div class="notification-icon ${notification.type}">
          ${notification.type === 'document_viewed' ? '👁️' : '📄'}
        </div>
        <div class="notification-content">
          <h4>${notification.title}</h4>
          <p class="meta">${notification.message}</p>
          <p class="meta" style="margin-top: 4px; font-size: 12px;">${relativeTime}</p>
        </div>
        <div class="notification-actions">
          ${!notification.isRead ? `
            <button class="btn small ghost" onclick="markNotificationRead(${notification.id}, true)">
              Mark as read
            </button>
          ` : `
            <button class="btn small ghost" onclick="markNotificationRead(${notification.id}, false)">
              Mark as unread
            </button>
          `}
          ${notification.documentId ? `
            <button class="btn small" onclick="viewDocumentFromNotification(${notification.documentId})">
              View document
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
};

const getRelativeTime = (date) => {
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  return date.toLocaleDateString();
};

const markNotificationRead = async (id, isRead) => {
  try {
    await fetch(`/api/notifications/${id}/read`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isRead })
    });
    await loadNotifications();
    await loadUnreadCount();
  } catch (err) {
    console.error('Failed to update notification:', err);
  }
};

const markAllNotificationsRead = async () => {
  try {
    await fetch('/api/notifications/mark-all-read', { method: 'PUT', credentials: 'include' });
    await loadNotifications();
    await loadUnreadCount();
  } catch (err) {
    console.error('Failed to mark all as read:', err);
  }
};

const viewDocumentFromNotification = async (docId) => {
  try {
    const res = await fetch(`/api/documents/${docId}`);
    const doc = await res.json();
    openClientView(doc);
  } catch (err) {
    console.error('Failed to load document:', err);
    alert('Document not found');
  }
};

const populateClientPicker = () => {
  const picker = document.getElementById('clientPicker');
  picker.innerHTML = '<option value="">Select saved client</option>';
  clients.forEach((c) => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.name + (c.company ? ` — ${c.company}` : '');
    picker.appendChild(opt);
  });
  if (clientPickerSelection) picker.value = clientPickerSelection;
};

const renderClients = () => {
  const container = document.getElementById('clientsList');
  const searchInput = document.getElementById('clientsSearchInput');
  const searchTerm = searchInput?.value.toLowerCase() || '';

  if (!clients.length) {
    container.innerHTML = '<p class="muted">No clients yet. Add one to reuse across estimates and invoices.</p>';
    return;
  }

  // Filter clients based on search term
  const filteredClients = clients.filter((c) => {
    if (!searchTerm) return true;
    return (
      c.name?.toLowerCase().includes(searchTerm) ||
      c.company?.toLowerCase().includes(searchTerm) ||
      c.email?.toLowerCase().includes(searchTerm) ||
      c.phone?.toLowerCase().includes(searchTerm)
    );
  });

  if (filteredClients.length === 0) {
    container.innerHTML = '<p class="muted">No clients match your search.</p>';
    return;
  }

  container.innerHTML = '';
  filteredClients.forEach((c) => {
    const card = document.createElement('div');
    card.className = 'client-card';

    // Build contact items in order: phone, email, billing address
    const contactItems = [];
    if (c.phone) contactItems.push(`<div class="client-card__contact-item client-card__contact-item--phone">📞 ${c.phone}</div>`);
    if (c.email) contactItems.push(`<div class="client-card__contact-item client-card__contact-item--email">✉️ ${c.email}</div>`);
    if (c.billingAddress) contactItems.push(`<div class="client-card__contact-item client-card__contact-item--address">📍 ${c.billingAddress}</div>`);

    card.innerHTML = `
      <div class="client-card__header">
        <div class="client-card__name">${c.name}</div>
        ${c.company ? `<div class="client-card__company">${c.company}</div>` : ''}
      </div>

      ${contactItems.length > 0 ? `
        <div class="client-card__contact">
          ${contactItems.join('')}
        </div>
      ` : ''}

      ${c.notes ? `<div class="client-card__notes">${c.notes}</div>` : ''}

      <div class="client-card__actions">
        <button class="btn small" data-action="edit">Edit</button>
        <button class="btn small ghost" data-action="delete" style="color: #ef4444;">Delete</button>
      </div>
    `;

    card.querySelector('[data-action="edit"]').onclick = () => editClient(c);
    card.querySelector('[data-action="delete"]').onclick = () => deleteClient(c.id);
    container.appendChild(card);
  });
};

let currentClientEdit = null;

const editClient = (client) => {
  currentClientEdit = client;
  const form = document.getElementById('clientForm');
  form.name.value = client.name || '';
  form.email.value = client.email || '';
  form.phone.value = client.phone || '';
  form.company.value = client.company || '';
  form.billingAddress.value = client.billingAddress || '';
  form.notes.value = client.notes || '';
  openClientModal();
};

const deleteClient = async (id) => {
  if (!confirm('Are you sure you want to delete this client?')) return;
  try {
    await fetch(`/api/clients/${id}`, { method: 'DELETE' });
    await loadClients();
  } catch (err) {
    console.error(err);
    alert('Failed to delete client');
  }
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
          <p class="meta">Qty ${m.defaultQty || 1} · Rate ${currency(m.defaultRate || 0)} · Markup ${currency(m.defaultMarkup || 0)}</p>
        </div>
        <button class="btn small ghost" data-material-id="${m.id}">Use</button>
      `;
      card.querySelector('button').onclick = () => {
        if (currentLineForMaterials) {
          currentLineForMaterials.materialsData = currentLineForMaterials.materialsData || [];
          currentLineForMaterials.materialsData.push({
            name: m.name,
            qty: m.defaultQty || 1,
            rate: m.defaultRate || 0,
            markup: m.defaultMarkup || 0,
          });
          renderMaterialsSection(currentLineForMaterials);
          recalcTotals();
          closeMaterialModal();
        }
      };
      materialsPickerList.appendChild(card);
    });
};

const renderMaterialsView = () => {
  const container = document.getElementById('materialsListView');
  if (!container) return;
  const searchTerm = (document.getElementById('materialsSearchInput')?.value || '').toLowerCase();
  container.innerHTML = '';

  const filteredMaterials = materials.filter(m =>
    m.name.toLowerCase().includes(searchTerm) ||
    (m.description || '').toLowerCase().includes(searchTerm)
  );

  if (!filteredMaterials.length) {
    container.innerHTML = searchTerm
      ? '<p class="muted">No materials match your search.</p>'
      : '<p class="muted">No materials yet.</p>';
    return;
  }

  filteredMaterials.forEach((m) => {
    const card = document.createElement('div');
    card.className = 'client-card';
    card.innerHTML = `
      <div>
        <h4>${m.name}</h4>
        <p class="meta">${m.description || 'No description'}</p>
        <p class="meta">Qty ${m.defaultQty || 1} · Rate ${currency(m.defaultRate || 0)} · Markup ${m.defaultMarkup || 0}%</p>
      </div>
      <div class="card-actions">
        <button class="btn small ghost" data-action="edit" data-id="${m.id}">Edit</button>
        <button class="btn small ghost" data-action="duplicate" data-id="${m.id}">Duplicate</button>
        <button class="btn small ghost" data-action="delete" data-id="${m.id}" style="color: #ef4444; border-color: rgba(239, 68, 68, 0.3);">Delete</button>
      </div>
    `;

    // Add event listeners for action buttons
    card.querySelector('[data-action="edit"]').addEventListener('click', () => editMaterial(m));
    card.querySelector('[data-action="duplicate"]').addEventListener('click', () => duplicateMaterial(m));
    card.querySelector('[data-action="delete"]').addEventListener('click', () => deleteMaterial(m.id));

    container.appendChild(card);
  });
};

const renderItemsView = () => {
  const searchTerm = (document.getElementById('itemsSearchInput')?.value || '').toLowerCase();
  itemsListView.innerHTML = '';

  const filteredItems = items.filter(i =>
    i.name.toLowerCase().includes(searchTerm) ||
    (i.description || '').toLowerCase().includes(searchTerm)
  );

  if (!filteredItems.length) {
    itemsListView.innerHTML = searchTerm
      ? '<p class="muted">No items match your search.</p>'
      : '<p class="muted">No items yet.</p>';
    return;
  }

  filteredItems.forEach((i) => {
    const card = document.createElement('div');
    card.className = 'client-card';
    card.innerHTML = `
      <div>
        <h4>${i.name}</h4>
        <p class="meta">${i.description || 'No description'}</p>
        <p class="meta">Qty ${i.defaultQty || 1} · Rate ${currency(i.defaultRate || 0)} · Markup ${i.defaultMarkup || 0}%</p>
      </div>
      <div class="card-actions">
        <button class="btn small ghost" data-action="edit" data-id="${i.id}">Edit</button>
        <button class="btn small ghost" data-action="duplicate" data-id="${i.id}">Duplicate</button>
        <button class="btn small ghost" data-action="delete" data-id="${i.id}" style="color: #ef4444; border-color: rgba(239, 68, 68, 0.3);">Delete</button>
      </div>
    `;

    // Add event listeners for action buttons
    card.querySelector('[data-action="edit"]').addEventListener('click', () => editItem(i));
    card.querySelector('[data-action="duplicate"]').addEventListener('click', () => duplicateItem(i));
    card.querySelector('[data-action="delete"]').addEventListener('click', () => deleteItem(i.id));

    itemsListView.appendChild(card);
  });
};

const applyClientToForm = (id) => {
  const client = clients.find((c) => c.id === id);
  if (!client) return;
  clientPickerSelection = String(id);
  populateClientPicker();
  document.getElementById('clientPicker').value = clientPickerSelection;
  docForm.clientName.value = client.name || '';
  docForm.clientEmail.value = client.email || '';
  docForm.clientPhone.value = client.phone || '';
  docForm.clientBillingEmail.value = client.billingEmail || '';
  docForm.clientBillingAddress.value = client.billingAddress || '';
};

const openClientModal = () => {
  document.getElementById('clientModal').classList.remove('hidden');
};

const closeClientModal = () => {
  document.getElementById('clientModal').classList.add('hidden');
  document.getElementById('clientForm').reset();
  document.getElementById('clientStatus').textContent = '';
  currentClientEdit = null;
};

// Formatting helper functions
const formatPhoneNumber = (phone) => {
  // Remove all non-numeric characters
  const cleaned = phone.replace(/\D/g, '');

  // Format as XXX-XXX-XXXX
  if (cleaned.length === 10) {
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  } else if (cleaned.length === 11 && cleaned[0] === '1') {
    // Handle 1-XXX-XXX-XXXX format
    return `1-${cleaned.slice(1, 4)}-${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }

  // Return as-is if not 10 or 11 digits
  return phone;
};

const formatAddress = (address) => {
  if (!address) return '';

  // Split by comma or newline
  const parts = address.split(/[,\n]+/).map(part => part.trim()).filter(Boolean);

  // Title case each part
  const titleCase = (str) => {
    return str.toLowerCase().replace(/\b\w/g, char => char.toUpperCase());
  };

  // Format each part with proper capitalization
  const formatted = parts.map(part => {
    // Skip state abbreviations and ZIP codes
    if (/^[A-Z]{2}$/.test(part.trim()) || /^\d{5}(-\d{4})?$/.test(part.trim())) {
      return part.toUpperCase();
    }
    return titleCase(part);
  });

  return formatted.join(', ');
};

const titleCase = (text) => {
  if (!text) return '';
  return text.toLowerCase().replace(/\b\w/g, char => char.toUpperCase());
};

document.getElementById('closeClientModal').addEventListener('click', closeClientModal);
document.getElementById('addClientFromForm').addEventListener('click', openClientModal);
document.getElementById('addClientFromClients').addEventListener('click', openClientModal);
addMaterialFromViewBtn.addEventListener('click', () => openMaterialCreateModal());
addItemFromViewBtn.addEventListener('click', () => openItemCreateModal());
document.getElementById('clientPicker').addEventListener('change', (e) => {
  clientPickerSelection = e.target.value;
  const id = Number(e.target.value);
  if (id) applyClientToForm(id);
});

// Add auto-formatting to phone input
const phoneInput = document.querySelector('#clientForm input[name="phone"]');
phoneInput.addEventListener('blur', (e) => {
  e.target.value = formatPhoneNumber(e.target.value);
});

// Add auto-formatting to billing address
const addressInput = document.querySelector('#clientForm textarea[name="billingAddress"]');
addressInput.addEventListener('blur', (e) => {
  e.target.value = formatAddress(e.target.value);
});

// Add auto-formatting to name (title case)
const nameInput = document.querySelector('#clientForm input[name="name"]');
nameInput.addEventListener('blur', (e) => {
  e.target.value = titleCase(e.target.value);
});

// Add auto-formatting to company (title case)
const companyInput = document.querySelector('#clientForm input[name="company"]');
companyInput.addEventListener('blur', (e) => {
  e.target.value = titleCase(e.target.value);
});

document.getElementById('clientForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const status = document.getElementById('clientStatus');
  status.textContent = 'Saving...';
  const form = e.target;

  // Format data before saving
  const payload = {
    name: titleCase(form.name.value.trim()),
    email: form.email.value.trim().toLowerCase(),
    phone: formatPhoneNumber(form.phone.value.trim()),
    company: titleCase(form.company.value.trim()),
    billingAddress: formatAddress(form.billingAddress.value.trim()),
    notes: form.notes.value.trim(),
  };
  try {
    const isEdit = currentClientEdit !== null;
    const url = isEdit ? `/api/clients/${currentClientEdit.id}` : '/api/clients';
    const method = isEdit ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Failed to save client');
    const savedClient = await res.json();
    await loadClients();
    if (savedClient && savedClient.id) {
      applyClientToForm(savedClient.id);
    }
    closeClientModal();
    status.textContent = '';
  } catch (err) {
    console.error(err);
    status.textContent = 'Could not save client.';
  }
});

closeContractorModalBtn.addEventListener('click', closeContractorModal);
closeClientViewModalBtn.addEventListener('click', closeClientViewModal);
closeSendModalBtn.addEventListener('click', closeSendModal);
sendModal.querySelectorAll('[data-send]').forEach((btn) => {
  btn.addEventListener('click', async () => {
    if (!currentSendId) return;

    const action = btn.dataset.send;
    const currentDoc = documents.find(d => d.id === currentSendId);

    if (action === 'print') {
      // Print functionality
      printDocument(currentDoc);
      logDebug(`Print initiated for doc ${currentSendId}`);
    } else if (action === 'pdf') {
      // Save as PDF functionality
      await saveAsPDF(currentDoc);
      logDebug(`PDF generation initiated for doc ${currentSendId}`);
    } else {
      // Email/SMS - just mark as sent
      await markSent(currentSendId);
      sendStatus.textContent = `Prepared to ${action}`;
      logDebug(`Send action chosen: ${action} for ${currentSendId}`);
    }

    closeSendModal();
  });
});

// Print Document Function
async function printDocument(doc) {
  console.log('Print document called with:', doc);

  if (!doc) {
    alert('No document selected');
    console.error('No document provided to printDocument');
    return;
  }

  try {
    const printWindow = window.open('', '_blank', 'width=800,height=900');

    if (!printWindow) {
      alert('Please allow popups for this site to print documents');
      return;
    }

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
  };

  // Group and format line items
  const lineItemsHtml = (doc.lineItems || []).map((li, idx) => {
    const markup = Number(li.markup) || 0;
    const total = ((li.qty || 0) * (li.rate || 0)) + markup;

    const notesHtml = li.notes ? `
      <div class="line-item-details">
        ${li.notes}
      </div>
    ` : '';

    return `
      <div class="line-item">
        <div class="line-item-header">
          <span class="line-item-title">${li.description || 'Line item'}</span>
          <span class="line-item-price">$${total.toFixed(2)}</span>
        </div>
        ${notesHtml}
      </div>
    `;
  }).join('');

  const paymentMethodsHtml = doc.type === 'invoice' && paymentMethods.length > 0 ? `
    <div class="payment-methods">
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 40px; max-width: 100%;">
        ${paymentMethods.map(method => `
          <div class="payment-method-item">
            <div class="payment-method-name">${method.methodName}</div>
            <img src="${method.qrCodeUrl}" alt="${method.methodName} QR Code" class="payment-qr">
            ${method.displayUrl ? `<div class="payment-url">${method.displayUrl}</div>` : ''}
          </div>
        `).join('')}
      </div>
    </div>
  ` : '';

  const companyInfo = await getCompanyInfo();

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${doc.type.toUpperCase()} ${doc.poNumber}</title>
        <style>
          * { box-sizing: border-box; }
          body {
            font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif;
            padding: 48px 64px;
            color: #1a1a1a;
            line-height: 1.6;
            max-width: 8.5in;
            margin: 0 auto;
            background: white;
          }
          h1, h2, h3, h4 { margin: 0; font-weight: 600; }
          .header-section {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 48px;
            position: relative;
            padding-bottom: 32px;
            border-bottom: 1px solid #e0e0e0;
          }
          .doc-type {
            position: absolute;
            top: -24px;
            left: 50%;
            transform: translateX(-50%);
            color: #a0a0a0;
            font-size: 28px;
            font-weight: 200;
            letter-spacing: 4px;
            text-transform: uppercase;
          }
          .left-section {
            flex: 0 0 auto;
            padding-right: 40px;
          }
          .right-section {
            display: flex;
            gap: 64px;
            margin-top: 0;
            flex: 1;
            justify-content: flex-end;
          }
          .address-box {
            min-width: 180px;
          }
          .address-box h4 {
            font-size: 11px;
            font-weight: 700;
            margin-bottom: 10px;
            text-transform: uppercase;
            letter-spacing: 1px;
            color: #666;
          }
          .address-box p {
            margin: 3px 0;
            font-size: 13px;
            line-height: 1.5;
            color: #333;
          }
          .address-box p strong {
            font-weight: 600;
            color: #1a1a1a;
          }
          .company-info {
            margin-top: 48px;
            padding-top: 24px;
            border-top: 2px solid #1a1a1a;
            display: grid;
            grid-template-columns: 1fr auto;
            gap: 80px;
            align-items: flex-start;
          }
          .company-name {
            font-size: 20px;
            font-weight: 700;
            margin-bottom: 10px;
            color: #1a1a1a;
          }
          .company-details {
            font-size: 13px;
            line-height: 1.7;
            color: #555;
          }
          .company-left {
            max-width: 50%;
          }
          .estimate-info {
            text-align: right;
            min-width: 280px;
            flex-shrink: 0;
          }
          .estimate-info-row {
            display: flex;
            justify-content: space-between;
            gap: 32px;
            margin: 6px 0;
            font-size: 13px;
            align-items: baseline;
          }
          .estimate-info-row strong {
            font-weight: 600;
            color: #666;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .estimate-info-row span {
            font-weight: 600;
            color: #1a1a1a;
            font-size: 14px;
          }
          .description-header {
            font-size: 14px;
            font-weight: 700;
            padding: 14px 0;
            border-bottom: 2px solid #1a1a1a;
            margin: 48px 0 24px 0;
            text-transform: uppercase;
            letter-spacing: 1px;
            color: #1a1a1a;
          }
          .line-item {
            margin-bottom: 28px;
            page-break-inside: avoid;
          }
          .line-item-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 14px 24px;
            background: #f5f5f5;
            margin-bottom: 0;
            border-left: 4px solid #1a1a1a;
          }
          .line-item-title {
            font-size: 15px;
            font-weight: 600;
            color: #1a1a1a;
          }
          .line-item-price {
            font-size: 16px;
            font-weight: 700;
            color: #1a1a1a;
          }
          .line-item-details {
            padding: 12px 24px 16px 28px;
            font-size: 13px;
            line-height: 1.7;
            color: #555;
            background: #fafafa;
          }
          .total-section {
            margin-top: 48px;
            padding-top: 24px;
            border-top: 3px solid #1a1a1a;
            text-align: right;
          }
          .total-amount {
            font-size: 28px;
            font-weight: 700;
            color: #1a1a1a;
            letter-spacing: -0.5px;
          }
          .notes-section {
            margin-top: 48px;
            padding: 24px;
            background: #f9f9f9;
            border-left: 4px solid #1a1a1a;
          }
          .notes-section h4 {
            margin-bottom: 12px;
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 1px;
            color: #666;
          }
          .notes-section p {
            white-space: pre-wrap;
            margin: 0;
            font-size: 13px;
            line-height: 1.7;
            color: #555;
          }
          .payment-methods {
            margin-top: 56px;
            padding-top: 32px;
            border-top: 1px solid #e0e0e0;
          }
          .payment-method-item {
            text-align: center;
            display: flex;
            flex-direction: column;
            align-items: center;
          }
          .payment-method-name {
            font-weight: 700;
            margin-bottom: 14px;
            font-size: 13px;
            text-transform: uppercase;
            letter-spacing: 1px;
            color: #1a1a1a;
          }
          .payment-qr {
            width: 160px;
            height: 160px;
            border: 2px solid #1a1a1a;
            padding: 10px;
            background: white;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          }
          .payment-url {
            margin-top: 10px;
            font-size: 11px;
            color: #666;
            word-break: break-all;
          }
          .footer {
            margin-top: 64px;
            padding-top: 24px;
            border-top: 1px solid #e0e0e0;
            text-align: center;
            font-size: 11px;
            color: #999;
            letter-spacing: 0.5px;
          }
          @media print {
            body { padding: 0.5in; }
            .page-break { page-break-before: always; }
            .payment-qr { box-shadow: none; }
            @page {
              margin: 0.5in;
            }
          }
          /* Hide browser print headers/footers */
          @page {
            margin-top: 0.5in;
            margin-bottom: 0.5in;
          }
        </style>
      </head>
      <body>
        <div class="doc-type">${doc.type.toUpperCase()}</div>

        <div class="header-section">
          <div class="left-section">
            <!-- Company Logo -->
            ${companyInfo.logo ? `
              <img src="${companyInfo.logo}" alt="Company Logo" style="max-width: 200px; max-height: 200px; object-fit: contain;">
            ` : `
              <div style="width: 120px; height: 120px; border: 2px solid #000; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 18px;">
                LOGO
              </div>
            `}
          </div>

          <div class="right-section">
            ${doc.serviceAddress ? `
              <div class="address-box">
                <h4>Service Address</h4>
                <p style="white-space: pre-line;">${doc.serviceAddress}</p>
              </div>
            ` : ''}

            <div class="address-box">
              <h4>Prepared For</h4>
              <p><strong>${doc.clientName || 'No Client'}</strong></p>
              ${doc.clientBillingAddress ? `<p style="white-space: pre-line;">${doc.clientBillingAddress}</p>` : ''}
              ${doc.clientPhone ? `<p>${doc.clientPhone}</p>` : ''}
              ${doc.clientEmail ? `<p>${doc.clientEmail}</p>` : ''}
            </div>
          </div>
        </div>

        <div class="company-info">
          <div class="company-left">
            <div class="company-name">${companyInfo.name}</div>
            <div class="company-details">
              ${companyInfo.address.replace(/\n/g, '<br>')}<br>
              Phone: ${companyInfo.phone}<br>
              Email: ${companyInfo.email}
            </div>
          </div>

          <div class="estimate-info">
              <div class="estimate-info-row">
                <strong>${doc.type === 'estimate' ? 'Estimate #' : 'Invoice #'}</strong>
                <span>${doc.poNumber || '—'}</span>
              </div>
              <div class="estimate-info-row">
                <strong>Date</strong>
                <span>${formatDate(doc.createdAt) || formatDate(new Date())}</span>
              </div>
              ${doc.type === 'estimate' && doc.validUntil ? `
                <div class="estimate-info-row">
                  <strong>Valid Until</strong>
                  <span>${formatDate(doc.validUntil)}</span>
                </div>
              ` : ''}
              ${doc.type === 'invoice' && doc.dueDate ? `
                <div class="estimate-info-row">
                  <strong>Due Date</strong>
                  <span>${formatDate(doc.dueDate)}</span>
                </div>
              ` : ''}
          </div>
        </div>

        <div class="description-header">Description</div>

        <div class="line-items-section">
          ${lineItemsHtml}
        </div>

        <div class="total-section">
          <div class="total-amount">Total: $${(Number(doc.total) || 0).toFixed(2)}</div>
        </div>

        ${doc.notes ? `
          <div class="notes-section">
            <h4>Notes</h4>
            <p>${doc.notes}</p>
          </div>
        ` : ''}

        ${paymentMethodsHtml}

        <div class="footer">
          Page 1 of 1
        </div>
      </body>
      </html>
    `;

    console.log('Writing HTML to print window');
    printWindow.document.write(htmlContent);
    printWindow.document.close();

    // Wait for images to load before printing
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 500);

  } catch (error) {
    console.error('Error in printDocument:', error);
    alert('Error generating print document: ' + error.message);
  }
}

// Save as PDF Function (uses print to PDF browser feature)
async function saveAsPDF(doc) {
  if (!doc) {
    alert('No document selected');
    return;
  }
  // Open print dialog with print-to-PDF hint
  printDocument(doc);
  if (sendStatus) {
    sendStatus.textContent = 'Use your browser\'s Print to PDF feature to save';
  }
}

// Modal event listeners

document.getElementById('closeItemModal').addEventListener('click', closeItemModal);
document.getElementById('closeMaterialModal').addEventListener('click', closeMaterialModal);
document.getElementById('closeItemCreateModal').addEventListener('click', closeItemCreateModal);
document.getElementById('closeMaterialCreateModal').addEventListener('click', closeMaterialCreateModal);
searchItemsInput.addEventListener('input', renderItemsList);
searchMaterialsInput.addEventListener('input', renderMaterialsList);

// Payment modal event listeners
document.getElementById('closePaymentsModal').addEventListener('click', closePaymentsModal);
document.getElementById('paymentAmountType').addEventListener('change', (e) => {
  const isDollars = e.target.value === 'dollars';
  document.getElementById('dollarAmountField').style.display = isDollars ? 'block' : 'none';
  document.getElementById('percentageAmountField').style.display = isDollars ? 'none' : 'block';
});
document.getElementById('paymentMethod').addEventListener('change', (e) => {
  const isCheck = e.target.value === 'check';
  document.getElementById('checkNumberField').style.display = isCheck ? 'block' : 'none';
});

document.getElementById('paymentsForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const status = document.getElementById('paymentStatus');
  status.textContent = 'Recording...';
  const form = e.target;

  const amountType = document.getElementById('paymentAmountType').value;
  let amount;
  if (amountType === 'dollars') {
    amount = Number(form.dollarAmount.value) || 0;
  } else {
    const percentage = Number(form.percentageAmount.value) || 0;
    amount = (currentPaymentDoc.total * percentage) / 100;
  }

  const payload = {
    amount,
    paymentMethod: form.paymentMethod.value,
    checkNumber: form.checkNumber?.value || null,
    paymentDate: form.paymentDate.value,
    notes: form.paymentNotes.value.trim(),
  };

  try {
    const res = await fetch(`/api/documents/${currentPaymentDoc.id}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Failed to record payment');

    // Get updated payment totals
    const paymentsRes = await fetch(`/api/documents/${currentPaymentDoc.id}/payments`);
    const payments = await paymentsRes.json();
    const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);
    const remainingBalance = currentPaymentDoc.total - totalPaid;

    // Determine new status based on payment amount
    let newStatus;
    if (totalPaid === 0) {
      newStatus = 'unpaid';
    } else if (remainingBalance > 0) {
      newStatus = 'partial';
    } else {
      newStatus = 'paid';
    }

    // Update invoice status
    await fetch(`/api/documents/${currentPaymentDoc.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });

    // Update the current document object with new payment info
    currentPaymentDoc.totalPaid = totalPaid;
    currentPaymentDoc.remainingBalance = remainingBalance;
    currentPaymentDoc.status = newStatus;

    form.reset();
    const today = new Date().toISOString().split('T')[0];
    document.querySelector('[name="paymentDate"]').value = today;

    status.textContent = 'Payment recorded!';
    setTimeout(() => (status.textContent = ''), 2000);

    loadPaymentsHistory(currentPaymentDoc.id);
    updatePaymentsSummary(currentPaymentDoc);
    await loadDocuments();
  } catch (err) {
    console.error(err);
    status.textContent = 'Could not record payment.';
  }
});

// Add backdrop click handlers to close modals
const clientModal = document.getElementById('clientModal');
const paymentsModal = document.getElementById('paymentsModal');
[itemModal, materialModal, itemCreateModal, materialCreateModal, contractorModal, clientViewModal, sendModal, clientModal, paymentsModal].forEach(modal => {
  if (modal) {
    const backdrop = modal.querySelector('.modal__backdrop');
    if (backdrop) {
      backdrop.addEventListener('click', () => {
        if (modal === itemModal) closeItemModal();
        else if (modal === materialModal) closeMaterialModal();
        else if (modal === itemCreateModal) closeItemCreateModal();
        else if (modal === materialCreateModal) closeMaterialCreateModal();
        else if (modal === contractorModal) closeContractorModal();
        else if (modal === clientViewModal) closeClientViewModal();
        else if (modal === sendModal) closeSendModal();
        else if (modal === clientModal) closeClientModal();
        else if (modal === paymentsModal) closePaymentsModal();
      });
    }
  }
});

document.getElementById('itemForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  itemStatus.textContent = 'Saving...';
  const form = e.target;
  const editId = form.dataset.editId;
  const payload = {
    name: form.name.value.trim(),
    description: form.description.value.trim(),
    defaultQty: Number(form.defaultQty.value) || 1,
    defaultRate: Number(form.defaultRate.value) || 0,
    defaultMarkup: Number(form.defaultMarkup.value) || 0,
  };
  try {
    const url = editId ? `/api/items/${editId}` : '/api/items';
    const method = editId ? 'PUT' : 'POST';
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Failed to save item');
    await loadItems();
    itemStatus.textContent = '';
    delete form.dataset.editId;
    form.querySelector('button[type="submit"]').textContent = 'Save item';
    closeItemCreateModal();
  } catch (err) {
    console.error(err);
    itemStatus.textContent = 'Could not save item';
  }
});

document.getElementById('materialForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  materialStatus.textContent = 'Saving...';
  const form = e.target;
  const editId = form.dataset.editId;
  const payload = {
    name: form.name.value.trim(),
    description: form.description.value.trim(),
    defaultQty: Number(form.defaultQty.value) || 1,
    defaultRate: Number(form.defaultRate.value) || 0,
    defaultMarkup: Number(form.defaultMarkup.value) || 0,
  };
  try {
    const url = editId ? `/api/materials/${editId}` : '/api/materials';
    const method = editId ? 'PUT' : 'POST';
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Failed to save material');
    await loadMaterials();
    materialStatus.textContent = '';
    delete form.dataset.editId;
    form.querySelector('button[type="submit"]').textContent = 'Save material';
    closeMaterialCreateModal();
  } catch (err) {
    console.error(err);
    materialStatus.textContent = 'Could not save material';
  }
});

// Item and Material Action Functions
const editItem = (item) => {
  const form = document.getElementById('itemForm');
  form.name.value = item.name;
  form.description.value = item.description || '';
  form.defaultQty.value = item.defaultQty || 1;
  form.defaultRate.value = item.defaultRate || 0;
  form.defaultMarkup.value = item.defaultMarkup || 0;

  // Store the ID for updating
  form.dataset.editId = item.id;

  // Change button text
  const submitBtn = form.querySelector('button[type="submit"]');
  submitBtn.textContent = 'Update item';

  openItemCreateModal();
};

const editMaterial = (material) => {
  const form = document.getElementById('materialForm');
  form.name.value = material.name;
  form.description.value = material.description || '';
  form.defaultQty.value = material.defaultQty || 1;
  form.defaultRate.value = material.defaultRate || 0;
  form.defaultMarkup.value = material.defaultMarkup || 0;

  // Store the ID for updating
  form.dataset.editId = material.id;

  // Change button text
  const submitBtn = form.querySelector('button[type="submit"]');
  submitBtn.textContent = 'Update material';

  openMaterialCreateModal();
};

const duplicateItem = async (item) => {
  const payload = {
    name: `${item.name} (copy)`,
    description: item.description || '',
    defaultQty: item.defaultQty || 1,
    defaultRate: item.defaultRate || 0,
    defaultMarkup: item.defaultMarkup || 0,
  };
  try {
    const res = await fetch('/api/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Failed to duplicate item');
    await loadItems();
    logDebug(`Item duplicated: ${item.name}`);
  } catch (err) {
    console.error(err);
    alert('Failed to duplicate item');
  }
};

const duplicateMaterial = async (material) => {
  const payload = {
    name: `${material.name} (copy)`,
    description: material.description || '',
    defaultQty: material.defaultQty || 1,
    defaultRate: material.defaultRate || 0,
    defaultMarkup: material.defaultMarkup || 0,
  };
  try {
    const res = await fetch('/api/materials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Failed to duplicate material');
    await loadMaterials();
    logDebug(`Material duplicated: ${material.name}`);
  } catch (err) {
    console.error(err);
    alert('Failed to duplicate material');
  }
};

const deleteItem = async (id) => {
  if (!confirm('Are you sure you want to delete this item?')) return;

  try {
    const res = await fetch(`/api/items/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete item');
    await loadItems();
    logDebug(`Item deleted: ${id}`);
  } catch (err) {
    console.error(err);
    alert('Failed to delete item');
  }
};

const deleteMaterial = async (id) => {
  if (!confirm('Are you sure you want to delete this material?')) return;

  try {
    const res = await fetch(`/api/materials/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete material');
    await loadMaterials();
    logDebug(`Material deleted: ${id}`);
  } catch (err) {
    console.error(err);
    alert('Failed to delete material');
  }
};

// Search event listeners
document.getElementById('itemsSearchInput')?.addEventListener('input', renderItemsView);
document.getElementById('materialsSearchInput')?.addEventListener('input', renderMaterialsView);
document.getElementById('clientsSearchInput')?.addEventListener('input', renderClients);

// bootstrap UI
addLineItemRow();
recalcTotals();
loadDocuments();
loadClients();
loadItems();
loadMaterials();
switchView('overview');
setDefaultValidUntil();
logDebug('App initialized');

// Debug toggle
toggleDebugBtn?.addEventListener('click', () => {
  if (!debugPane) return;
  const isCollapsed = debugPane.classList.toggle('collapsed');
  debugPane.style.display = 'block';
  toggleDebugBtn.textContent = isCollapsed ? 'Show' : 'Hide';
  logDebug(`Debug pane toggled: ${isCollapsed ? 'collapsed' : 'expanded'}`);
});
// Fallback if toggle button was not wired
if (!toggleDebugBtn) {
  console.warn('toggleDebugBtn not found');
} else {
  logDebug('Debug toggle wired');
}

// Theme toggle
const themeSelect = document.getElementById('themeSelect');
const applyTheme = (theme) => {
  document.body.classList.toggle('light-mode', theme === 'light');
  localStorage.setItem('theme', theme);
};

if (themeSelect) {
  // Load saved theme
  const savedTheme = localStorage.getItem('theme') || 'dark';
  themeSelect.value = savedTheme;
  applyTheme(savedTheme);

  themeSelect.addEventListener('change', (e) => {
    applyTheme(e.target.value);
  });
}

// Company Information Management
const loadCompanyInfo = async () => {
  try {
    const res = await fetch('/api/company-settings', { credentials: 'include' });
    if (res.ok) {
      const info = await res.json();
      document.getElementById('companyName').value = info.name || '';
      document.getElementById('companyAddress').value = info.address || '';
      document.getElementById('companyPhone').value = info.phone || '';
      document.getElementById('companyEmail').value = info.email || '';

      if (info.logo) {
        document.getElementById('logoPreview').style.display = 'block';
        document.getElementById('logoPreviewImage').src = info.logo;
      }
    }
  } catch (err) {
    console.error('Failed to load company info:', err);
  }
};

const saveCompanyInfo = async () => {
  const logoImg = document.getElementById('logoPreviewImage');
  const logoSrc = logoImg && logoImg.src && !logoImg.src.includes('about:blank') ? logoImg.src : null;

  const info = {
    name: document.getElementById('companyName').value.trim(),
    address: document.getElementById('companyAddress').value.trim(),
    phone: document.getElementById('companyPhone').value.trim(),
    email: document.getElementById('companyEmail').value.trim(),
    logo: logoSrc
  };

  try {
    const res = await fetch('/api/company-settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(info)
    });

    if (res.ok) {
      alert('Company information saved successfully!');
    } else {
      alert('Failed to save company information');
    }
  } catch (err) {
    console.error('Failed to save company info:', err);
    alert('Failed to save company information');
  }
};

const getCompanyInfo = async () => {
  try {
    const res = await fetch('/api/company-settings', { credentials: 'include' });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.error('Failed to get company info:', err);
  }

  // Return defaults if fetch fails
  return {
    name: 'Your Company Name',
    address: '123 Business Street\nCity, State 12345',
    phone: '(555) 123-4567',
    email: 'info@yourcompany.com',
    logo: null
  };
};

// Company logo upload handler
const companyLogoInput = document.getElementById('companyLogo');
if (companyLogoInput) {
  companyLogoInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const logoPreview = document.getElementById('logoPreview');
        const logoPreviewImage = document.getElementById('logoPreviewImage');
        logoPreviewImage.src = event.target.result;
        logoPreview.style.display = 'block';
      };
      reader.readAsDataURL(file);
    }
  });
}

// Save company info button
const saveCompanyInfoBtn = document.getElementById('saveCompanyInfo');
if (saveCompanyInfoBtn) {
  saveCompanyInfoBtn.addEventListener('click', saveCompanyInfo);
}

// Load company info on page load
loadCompanyInfo();

// Payment Methods Management
let paymentMethods = [];
let editingPaymentMethodId = null;

const loadPaymentMethods = async () => {
  try {
    const res = await fetch('/api/payment-methods', { credentials: 'include' });
    if (res.ok) {
      paymentMethods = await res.json();
      renderPaymentMethods();
    }
  } catch (err) {
    console.error('Failed to load payment methods:', err);
  }
};

const renderPaymentMethods = () => {
  const list = document.getElementById('paymentMethodsList');
  if (!list) return;

  if (paymentMethods.length === 0) {
    list.innerHTML = '<p class="meta" style="text-align: center; padding: 20px;">No payment methods configured</p>';
    return;
  }

  list.innerHTML = paymentMethods
    .map(
      (method) => `
    <div class="client-card">
      <div>
        <h4>${method.methodName}</h4>
        <p class="meta">${method.qrCodeUrl ? 'QR Code uploaded' : 'Text-only method'}</p>
      </div>
      <div class="client-actions">
        <button class="btn small ghost" onclick="editPaymentMethod(${method.id})">Edit</button>
        <button class="btn small ghost" style="color: #ef4444;" onclick="deletePaymentMethod(${method.id})">Delete</button>
      </div>
    </div>
  `
    )
    .join('');
};

const openPaymentMethodModal = () => {
  editingPaymentMethodId = null;
  document.getElementById('paymentMethodModalTitle').textContent = 'Add Payment Method';
  document.getElementById('paymentMethodForm').reset();
  document.getElementById('qrPreview').style.display = 'none';
  document.getElementById('qrCodeUrlHidden').value = '';
  document.getElementById('paymentMethodModal').classList.remove('hidden');
};

const editPaymentMethod = (id) => {
  editingPaymentMethodId = id;
  const method = paymentMethods.find(m => m.id === id);
  document.getElementById('paymentMethodModalTitle').textContent = 'Edit Payment Method';
  const form = document.getElementById('paymentMethodForm');
  form.methodName.value = method.methodName;
  form.paymentUrl.value = method.paymentUrl || '';
  document.getElementById('qrCodeUrlHidden').value = method.qrCodeUrl || '';

  // Show QR preview if available
  if (method.qrCodeUrl) {
    document.getElementById('qrPreviewImg').src = method.qrCodeUrl;
    document.getElementById('qrPreview').style.display = 'block';
  }

  document.getElementById('paymentMethodModal').classList.remove('hidden');
};

const deletePaymentMethod = async (id) => {
  if (confirm('Are you sure you want to delete this payment method?')) {
    try {
      const res = await fetch(`/api/payment-methods/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (res.ok) {
        await loadPaymentMethods();
      } else {
        alert('Failed to delete payment method');
      }
    } catch (err) {
      console.error('Failed to delete payment method:', err);
      alert('Failed to delete payment method');
    }
  }
};

const closePaymentMethodModal = () => {
  document.getElementById('paymentMethodModal').classList.add('hidden');
  editingPaymentMethodId = null;
};

// QR Code Generation
document.getElementById('generateQrBtn')?.addEventListener('click', () => {
  const paymentUrl = document.getElementById('paymentMethodForm').paymentUrl.value.trim();

  if (!paymentUrl) {
    alert('Please enter a payment URL first');
    return;
  }

  // Create temporary container for QR code
  const tempDiv = document.createElement('div');
  tempDiv.style.display = 'none';
  document.body.appendChild(tempDiv);

  // Generate QR code
  new QRCode(tempDiv, {
    text: paymentUrl,
    width: 512,
    height: 512,
    colorDark: '#000000',
    colorLight: '#ffffff',
    correctLevel: QRCode.CorrectLevel.H
  });

  // Wait for QR code to be generated, then extract as data URL
  setTimeout(() => {
    const canvas = tempDiv.querySelector('canvas');
    if (canvas) {
      const dataUrl = canvas.toDataURL('image/png');
      document.getElementById('qrCodeUrlHidden').value = dataUrl;
      document.getElementById('qrPreviewImg').src = dataUrl;
      document.getElementById('qrPreview').style.display = 'block';
    }
    document.body.removeChild(tempDiv);
  }, 100);
});

// QR Code Upload
document.getElementById('uploadQrBtn')?.addEventListener('click', () => {
  document.getElementById('qrImageUpload').click();
});

document.getElementById('qrImageUpload')?.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    const dataUrl = event.target.result;
    document.getElementById('qrCodeUrlHidden').value = dataUrl;
    document.getElementById('qrPreviewImg').src = dataUrl;
    document.getElementById('qrPreview').style.display = 'block';
  };
  reader.readAsDataURL(file);
});

// Payment Method Form Submit
document.getElementById('paymentMethodForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const formData = new FormData(e.target);
  const qrCodeUrl = document.getElementById('qrCodeUrlHidden').value;

  const method = {
    methodName: formData.get('methodName'),
    paymentUrl: formData.get('paymentUrl') || '',
    qrCodeUrl: qrCodeUrl || null,
    displayUrl: '',
  };

  try {
    let res;
    if (editingPaymentMethodId !== null) {
      res = await fetch(`/api/payment-methods/${editingPaymentMethodId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(method)
      });
    } else {
      res = await fetch('/api/payment-methods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(method)
      });
    }

    if (res.ok) {
      await loadPaymentMethods();
      closePaymentMethodModal();
    } else {
      alert('Failed to save payment method');
    }
  } catch (err) {
    console.error('Failed to save payment method:', err);
    alert('Failed to save payment method');
  }
});

// Payment Method Modal Event Listeners
document.getElementById('addPaymentMethod').addEventListener('click', openPaymentMethodModal);
document.getElementById('closePaymentMethodModal').addEventListener('click', closePaymentMethodModal);
document.getElementById('cancelPaymentMethodBtn').addEventListener('click', closePaymentMethodModal);
document.querySelector('#paymentMethodModal .modal__backdrop').addEventListener('click', closePaymentMethodModal);

// Initialize payment methods
loadPaymentMethods();

// Make functions global for inline onclick handlers
window.editPaymentMethod = editPaymentMethod;
window.deletePaymentMethod = deletePaymentMethod;

// Delete confirmation modal handlers
document.getElementById('confirmDelete').addEventListener('click', confirmDeleteDocument);
document.getElementById('cancelDelete').addEventListener('click', closeDeleteModal);
const deleteModal = document.getElementById('deleteConfirmModal');
if (deleteModal) {
  const backdrop = deleteModal.querySelector('.modal__backdrop');
  if (backdrop) {
    backdrop.addEventListener('click', closeDeleteModal);
  }
}

// AI Integration
let generatedMaterialsData = [];
let generatedEstimateData = null;

// API Key Management
const saveApiKeyBtn = document.getElementById('saveApiKey');
const apiKeyInput = document.getElementById('chatgptApiKey');

if (saveApiKeyBtn && apiKeyInput) {
  // Load saved API key
  const savedKey = localStorage.getItem('chatgptApiKey');
  if (savedKey) {
    apiKeyInput.value = savedKey;
  }

  saveApiKeyBtn.addEventListener('click', () => {
    const key = apiKeyInput.value.trim();
    if (key) {
      localStorage.setItem('chatgptApiKey', key);
      alert('API key saved successfully!');
    } else {
      alert('Please enter an API key');
    }
  });
}

// Helper function to call OpenAI API
async function callOpenAI(messages, temperature = 0.7) {
  const apiKey = localStorage.getItem('chatgptApiKey');
  if (!apiKey) {
    throw new Error('Please configure your ChatGPT API key in Settings first');
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: messages,
      temperature: temperature
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'API request failed');
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

// Helper function to read file as text or base64
async function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = reject;

    if (file.type.startsWith('image/')) {
      reader.readAsDataURL(file);
    } else {
      reader.readAsText(file);
    }
  });
}

// Material Generator
const priceMaterialsBtn = document.getElementById('priceMaterials');
const materialsInput = document.getElementById('aiMaterialsInput');
const materialsStatus = document.getElementById('aiMaterialsStatus');
const materialsPreview = document.getElementById('generatedMaterialsPreview');
const materialsList = document.getElementById('generatedMaterialsList');

if (priceMaterialsBtn) {
  priceMaterialsBtn.addEventListener('click', async () => {
    const text = materialsInput.value.trim();

    if (!text) {
      materialsStatus.innerHTML = '<p style="color: #ef4444;">Please enter materials to price</p>';
      return;
    }

    // Parse materials list (split by newlines or commas)
    const materials = text
      .split(/[\n,]+/)
      .map(m => m.trim())
      .filter(m => m.length > 0);

    if (materials.length === 0) {
      materialsStatus.innerHTML = '<p style="color: #ef4444;">No valid materials found</p>';
      return;
    }

    materialsStatus.innerHTML = `<p style="color: var(--accent);">🔍 Searching Google Shopping for ${materials.length} material(s)... This may take a minute.</p>`;
    priceMaterialsBtn.disabled = true;

    try {
      // Call our scraping endpoint
      const response = await fetch('/api/scrape-prices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ materials })
      });

      if (!response.ok) {
        throw new Error('Failed to fetch prices from server');
      }

      const data = await response.json();
      const { results } = data;

      // Use scraped data directly (no AI needed!)
      generatedMaterialsData = results.map((result) => {
        return {
          name: result.name,  // Use EXACT name from input
          description: result.description || `${result.name}`,
          defaultQty: 1,
          defaultRate: result.price,
          defaultMarkup: 0  // Standard markup in dollars
        };
      });

      // Render preview with editable fields
      renderMaterialsPreview(generatedMaterialsData);

      materialsPreview.style.display = 'block';

      const successCount = results.filter(r => r.success).length;
      const failCount = results.length - successCount;

      let statusMsg = `<p style="color: var(--accent);">✓ Found prices for ${successCount} material(s)`;
      if (failCount > 0) {
        statusMsg += ` (${failCount} not found - set to $0.00)`;
      }
      statusMsg += `</p>`;

      materialsStatus.innerHTML = statusMsg;
    } catch (err) {
      console.error(err);
      materialsStatus.innerHTML = `<p style="color: #ef4444;">Error: ${err.message}</p>`;
    } finally {
      priceMaterialsBtn.disabled = false;
    }
  });
}

// Helper function to render materials preview
function renderMaterialsPreview(materials) {
  materialsList.innerHTML = materials.map((m, idx) => `
    <div class="generated-material-card" data-index="${idx}" style="padding: 16px; border: 1px solid var(--border); border-radius: 12px; margin-bottom: 12px; background: rgba(255, 255, 255, 0.02);">
      <div style="display: grid; gap: 12px;">
        <div style="display: grid; grid-template-columns: 1fr auto; gap: 12px; align-items: start;">
          <div style="flex: 1;">
            <label style="display: block; font-size: 12px; color: var(--muted); margin-bottom: 4px;">Material Name</label>
            <input type="text" class="material-edit-field" data-field="name" value="${m.name || ''}"
                   style="width: 100%; padding: 8px 12px; border-radius: 8px; background: rgba(255, 255, 255, 0.05); border: 1px solid var(--border); color: inherit; font-family: inherit; font-size: 14px; font-weight: 600;">
          </div>
          <div style="padding-top: 24px;">
            <button type="button" class="btn-remove" onclick="removeMaterialPreview(${idx})" title="Remove material" style="font-size: 24px; padding: 4px 12px; line-height: 1; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 8px; cursor: pointer; color: #ef4444; transition: all 0.2s;">×</button>
          </div>
        </div>

        <div>
          <label style="display: block; font-size: 12px; color: var(--muted); margin-bottom: 4px;">Description</label>
          <textarea class="material-edit-field" data-field="description" rows="2"
                    style="width: 100%; padding: 8px 12px; border-radius: 8px; background: rgba(255, 255, 255, 0.05); border: 1px solid var(--border); color: inherit; font-family: inherit; font-size: 13px; resize: vertical;">${m.description || ''}</textarea>
        </div>

        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px;">
          <div>
            <label style="display: block; font-size: 12px; color: var(--muted); margin-bottom: 4px;">Quantity</label>
            <input type="number" step="1" class="material-edit-field" data-field="defaultQty" value="${m.defaultQty || 1}"
                   style="width: 100%; padding: 8px 12px; border-radius: 8px; background: rgba(255, 255, 255, 0.05); border: 1px solid var(--border); color: inherit; font-family: inherit; font-size: 13px;">
          </div>
          <div>
            <label style="display: block; font-size: 12px; color: var(--muted); margin-bottom: 4px;">Rate ($)</label>
            <input type="number" step="0.01" class="material-edit-field" data-field="defaultRate" value="${m.defaultRate || 0}"
                   style="width: 100%; padding: 8px 12px; border-radius: 8px; background: rgba(255, 255, 255, 0.05); border: 1px solid var(--border); color: inherit; font-family: inherit; font-size: 13px;">
          </div>
          <div>
            <label style="display: block; font-size: 12px; color: var(--muted); margin-bottom: 4px;">Markup (%)</label>
            <input type="number" step="1" class="material-edit-field" data-field="defaultMarkup" value="${m.defaultMarkup || 0}"
                   style="width: 100%; padding: 8px 12px; border-radius: 8px; background: rgba(255, 255, 255, 0.05); border: 1px solid var(--border); color: inherit; font-family: inherit; font-size: 13px;">
          </div>
        </div>
      </div>
    </div>
  `).join('');
}

// Function to remove material from preview
window.removeMaterialPreview = (index) => {
  generatedMaterialsData.splice(index, 1);

  if (generatedMaterialsData.length === 0) {
    materialsPreview.style.display = 'none';
    materialsStatus.innerHTML = '<p style="color: var(--muted);">All materials removed</p>';
    return;
  }

  // Re-render the preview with updated indices
  renderMaterialsPreview(generatedMaterialsData);

  materialsStatus.innerHTML = `<p style="color: var(--accent);">${generatedMaterialsData.length} material(s) remaining</p>`;
};

// Confirm generated materials
document.getElementById('confirmGeneratedMaterials')?.addEventListener('click', async () => {
  try {
    materialsStatus.innerHTML = '<p style="color: var(--accent);">Adding materials...</p>';

    // Read edited values from the input fields
    const materialCards = document.querySelectorAll('.generated-material-card');
    const editedMaterials = [];

    materialCards.forEach((card, idx) => {
      const material = {
        name: card.querySelector('[data-field="name"]').value.trim(),
        description: card.querySelector('[data-field="description"]').value.trim(),
        defaultQty: Number(card.querySelector('[data-field="defaultQty"]').value) || 1,
        defaultRate: Number(card.querySelector('[data-field="defaultRate"]').value) || 0,
        defaultMarkup: Number(card.querySelector('[data-field="defaultMarkup"]').value) || 0
      };

      editedMaterials.push(material);
    });

    // Save edited materials
    for (const material of editedMaterials) {
      await fetch('/api/materials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(material)
      });
    }

    materialsStatus.innerHTML = `<p style="color: var(--accent);">Successfully added ${editedMaterials.length} materials!</p>`;
    materialsPreview.style.display = 'none';
    materialsInput.value = '';
    generatedMaterialsData = [];

    // Reload materials
    await loadMaterials();

    setTimeout(() => {
      materialsStatus.innerHTML = '';
    }, 3000);
  } catch (err) {
    console.error(err);
    materialsStatus.innerHTML = `<p style="color: #ef4444;">Error adding materials: ${err.message}</p>`;
  }
});

document.getElementById('cancelGeneratedMaterials')?.addEventListener('click', () => {
  materialsPreview.style.display = 'none';
  generatedMaterialsData = [];
  materialsInput.value = '';
  materialsStatus.innerHTML = '';
});

// Estimate Generator
const generateEstimateBtn = document.getElementById('generateEstimate');
const estimateFile = document.getElementById('aiEstimateFile');
const estimateText = document.getElementById('aiEstimateText');
const estimateStatus = document.getElementById('aiEstimateStatus');
const estimatePreview = document.getElementById('generatedEstimatePreview');
const estimateDetails = document.getElementById('generatedEstimateDetails');

if (generateEstimateBtn) {
  generateEstimateBtn.addEventListener('click', async () => {
    const file = estimateFile.files[0];
    const text = estimateText.value.trim();

    if (!file && !text) {
      estimateStatus.innerHTML = '<p style="color: #ef4444;">Please upload a file or enter text</p>';
      return;
    }

    estimateStatus.innerHTML = '<p style="color: var(--accent);">Generating estimate...</p>';
    generateEstimateBtn.disabled = true;

    try {
      let content = text;
      let messages = [];

      if (file) {
        estimateStatus.innerHTML = '<p style="color: var(--accent);">Reading file...</p>';
        const fileContent = await readFile(file);

        if (file.type.startsWith('image/')) {
          // Vision API for images
          messages = [{
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Analyze this image and create a construction/contracting estimate. Extract all work items, materials, and costs you can identify.'
              },
              {
                type: 'image_url',
                image_url: { url: fileContent }
              }
            ]
          }];
        } else {
          content = fileContent;
        }
      }

      if (!messages.length) {
        const prompt = `Create a construction/contracting estimate from the following project description. Return ONLY a valid JSON object with this structure:
{
  "clientName": "Client name if mentioned",
  "projectName": "Project title",
  "serviceAddress": "Location if mentioned",
  "lineItems": [
    {
      "description": "Work item description",
      "qty": numeric_quantity,
      "rate": numeric_rate_per_unit,
      "materials": []
    }
  ],
  "notes": "Any additional notes or observations",
  "taxRate": suggested_tax_rate_percentage
}

Input:
${content}`;

        messages = [{role: 'user', content: prompt}];
      }

      const response = await callOpenAI(messages, 0.5);

      // Parse JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Could not parse estimate from AI response');
      }

      generatedEstimateData = JSON.parse(jsonMatch[0]);

      // Render preview
      const subtotal = (generatedEstimateData.lineItems || []).reduce((sum, item) => {
        return sum + (item.qty * item.rate);
      }, 0);

      estimateDetails.innerHTML = `
        <div style="margin-bottom: 16px;">
          <p><strong>Client:</strong> ${generatedEstimateData.clientName || 'Not specified'}</p>
          <p><strong>Project:</strong> ${generatedEstimateData.projectName || 'Not specified'}</p>
          ${generatedEstimateData.serviceAddress ? `<p><strong>Location:</strong> ${generatedEstimateData.serviceAddress}</p>` : ''}
        </div>
        <h4 style="margin-bottom: 8px;">Line Items:</h4>
        ${(generatedEstimateData.lineItems || []).map(item => `
          <div style="padding: 12px; border: 1px solid var(--border); border-radius: 8px; margin-bottom: 8px;">
            <div style="display: flex; justify-content: space-between;">
              <span>${item.description}</span>
              <span><strong>$${(item.qty * item.rate).toFixed(2)}</strong></span>
            </div>
            <p class="meta">Qty: ${item.qty} × Rate: $${item.rate}</p>
          </div>
        `).join('')}
        <div style="text-align: right; margin-top: 16px; padding: 12px; background: var(--accent-soft); border-radius: 8px;">
          <strong>Subtotal: $${subtotal.toFixed(2)}</strong>
        </div>
        ${generatedEstimateData.notes ? `
          <div style="margin-top: 16px; padding: 12px; background: rgba(255, 255, 255, 0.02); border-radius: 8px;">
            <p class="eyebrow">Notes</p>
            <p style="margin-top: 8px;">${generatedEstimateData.notes}</p>
          </div>
        ` : ''}
      `;

      estimatePreview.style.display = 'block';
      estimateStatus.innerHTML = '<p style="color: var(--accent);">Estimate generated successfully!</p>';
    } catch (err) {
      console.error(err);
      estimateStatus.innerHTML = `<p style="color: #ef4444;">Error: ${err.message}</p>`;
    } finally {
      generateEstimateBtn.disabled = false;
    }
  });
}

// Confirm generated estimate
document.getElementById('confirmGeneratedEstimate')?.addEventListener('click', async () => {
  if (!generatedEstimateData) return;

  // Switch to estimates view and open the create form
  switchView('estimates');
  openEstimateForm();

  // Pre-fill the form
  const form = document.getElementById('docForm');
  if (generatedEstimateData.clientName) {
    form.clientName.value = generatedEstimateData.clientName;
  }
  if (generatedEstimateData.projectName) {
    form.projectName.value = generatedEstimateData.projectName;
  }
  if (generatedEstimateData.serviceAddress) {
    form.serviceAddress.value = generatedEstimateData.serviceAddress;
  }
  if (generatedEstimateData.taxRate) {
    form.taxRate.value = generatedEstimateData.taxRate;
  }
  if (generatedEstimateData.notes) {
    form.notes.value = generatedEstimateData.notes;
  }

  // Add line items
  currentLines = generatedEstimateData.lineItems || [];
  renderLineItems();

  estimateStatus.innerHTML = '<p style="color: var(--accent);">Estimate loaded into form!</p>';
  estimatePreview.style.display = 'none';
  estimateFile.value = '';
  estimateText.value = '';
  generatedEstimateData = null;
});

document.getElementById('cancelGeneratedEstimate')?.addEventListener('click', () => {
  estimatePreview.style.display = 'none';
  generatedEstimateData = null;
});

// Notifications event listeners
const markAllReadBtn = document.getElementById('markAllReadBtn');
const filterUnreadBtn = document.getElementById('filterUnreadBtn');

if (markAllReadBtn) {
  markAllReadBtn.addEventListener('click', markAllNotificationsRead);
}

if (filterUnreadBtn) {
  filterUnreadBtn.addEventListener('click', () => {
    showUnreadOnly = !showUnreadOnly;
    filterUnreadBtn.textContent = showUnreadOnly ? 'Show all' : 'Show unread only';
    loadNotifications();
  });
}

// Poll for new notifications every 30 seconds
setInterval(loadUnreadCount, 30000);

// Load unread count on page load
loadUnreadCount();

// Logout button handler
const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
  logoutBtn.addEventListener('click', async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
      window.location.href = '/login.html';
    } catch (err) {
      console.error('Logout error:', err);
      // Force redirect anyway
      window.location.href = '/login.html';
    }
  });
}

} // End of initApp function
