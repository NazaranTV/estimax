// Preview Page JavaScript

const urlParams = new URLSearchParams(window.location.search);
const documentId = urlParams.get('id');

let currentDoc = null;

const currency = (value) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value || 0));

const loadDocument = async () => {
  const loadingState = document.getElementById('loadingState');
  const errorState = document.getElementById('errorState');
  const previewContent = document.getElementById('previewContent');

  try {
    if (!documentId) {
      throw new Error('No document ID provided');
    }

    const res = await fetch(`/api/documents/${documentId}`);

    if (!res.ok) {
      throw new Error('Document not found');
    }

    currentDoc = await res.json();

    // Hide loading, show content
    loadingState.style.display = 'none';
    previewContent.style.display = 'block';

    // Render the document
    renderDocument();
  } catch (err) {
    console.error('Error loading document:', err);
    loadingState.style.display = 'none';
    errorState.style.display = 'flex';
    errorState.textContent = err.message || 'Failed to load document';
  }
};

const renderDocument = () => {
  const doc = currentDoc;

  // Update title
  const previewTitle = document.getElementById('previewTitle');
  previewTitle.textContent = `${doc.type === 'estimate' ? 'Estimate' : 'Invoice'} Preview - Contractor View`;

  // Date label
  const dateLabel =
    doc.type === 'estimate'
      ? doc.validUntil
        ? `Valid until ${new Date(doc.validUntil).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`
        : ''
      : doc.dueDate
      ? `Due Date: ${new Date(doc.dueDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`
      : '';

  // Calculate total with materials cost
  let calculatedTotal = 0;

  const lineItemsHtml = (doc.lineItems || []).map((li) => {
    // Calculate materials cost
    let materialsCost = 0;
    if (li.materials && Array.isArray(li.materials) && li.materials.length > 0) {
      materialsCost = li.materials.reduce((sum, m) => {
        const baseCost = (Number(m.qty) || 0) * (Number(m.rate) || 0);
        const markupPercent = (Number(m.markup) || 0) / 100;
        return sum + (baseCost * (1 + markupPercent));
      }, 0);
    }

    // Calculate line item total: (qty * rate) + markup% + materials
    const baseTotal = (li.qty || 0) * (li.rate || 0);
    const markup = Number(li.markup) || 0;
    const markupAmount = baseTotal * (markup / 100);
    const lineItemTotal = baseTotal + markupAmount;
    const total = lineItemTotal + materialsCost;
    calculatedTotal += total;

    // Generate materials HTML if any exist for this line item
    const materialsHtml = (li.materials && li.materials.length > 0) ? `
      <div class="preview-materials">
        <div class="preview-materials__label">Materials:</div>
        <div class="preview-materials__header">
          <div>Name</div>
          <div>Qty</div>
          <div>Cost</div>
          <div>Total</div>
        </div>
        ${li.materials.map(mat => {
          const matQty = Number(mat.qty) || 0;
          const matRate = Number(mat.rate) || 0;
          const matMarkup = Number(mat.markup) || 0;
          const matBaseCost = matQty * matRate;
          const matTotal = matBaseCost * (1 + matMarkup / 100);
          return `<div class="preview-materials__row">
            <div>${mat.name || 'Unnamed'}</div>
            <div>${matQty}</div>
            <div>${currency(matRate)}</div>
            <div>${currency(matTotal)}</div>
          </div>`;
        }).join('')}
        <div class="preview-materials__subtotal">
          Subtotal: ${currency(materialsCost)}
        </div>
      </div>
    ` : '';

    return `
      <tr>
        <td>
          <div class="item-description">${li.description || 'Untitled Item'}</div>
          ${li.notes ? `<div class="item-notes">${li.notes}</div>` : ''}
          ${materialsHtml}
        </td>
        <td>${currency(li.rate || 0)}</td>
        <td>${li.qty || 0}</td>
        <td>${currency(total)}</td>
      </tr>
    `;
  }).join('');

  const previewContent = document.getElementById('previewContent');
  previewContent.innerHTML = `
    <div class="preview-info-grid">
      <div class="preview-info-section">
        <h4>Bill To</h4>
        <p><strong>${doc.clientName}</strong></p>
        ${doc.clientEmail ? `<p class="muted">${doc.clientEmail}</p>` : ''}
        ${doc.clientPhone ? `<p class="muted">${doc.clientPhone}</p>` : ''}
        ${doc.clientBillingAddress ? `<p class="muted" style="margin-top: 6px; line-height: 1.4;">${doc.clientBillingAddress}</p>` : ''}
      </div>
      <div class="preview-info-section" style="text-align: right;">
        <h4>Document Info</h4>
        <p><span class="muted">${doc.type === 'estimate' ? 'Estimate #' : 'Invoice #'}</span> <strong>${doc.poNumber || '—'}</strong></p>
        ${dateLabel ? `<p class="muted">${dateLabel}</p>` : ''}
        ${doc.projectName ? `<p class="muted" style="margin-top: 6px;">Project: ${doc.projectName}</p>` : ''}
        ${doc.serviceAddress ? `<p class="muted" style="margin-top: 3px;">Service: ${doc.serviceAddress}</p>` : ''}
      </div>
    </div>

    <table class="preview-table">
      <thead>
        <tr>
          <th>Description</th>
          <th style="width: 100px;">Rate</th>
          <th style="width: 60px;">Qty</th>
          <th style="width: 100px;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${lineItemsHtml}
      </tbody>
    </table>

    <div class="preview-totals">
      <div class="preview-totals__row">
        <div class="preview-totals__label">Subtotal</div>
        <div class="preview-totals__value">${currency(doc.subtotal)}</div>
      </div>
      <div class="preview-totals__row total">
        <div class="preview-totals__label">Total</div>
        <div class="preview-totals__value">${currency(doc.total)}</div>
      </div>
    </div>

    ${doc.notes ? `
      <div class="preview-notes">
        <h4>Notes</h4>
        <p>${doc.notes}</p>
      </div>
    ` : ''}
  `;
};

// Button handlers
document.getElementById('closeBtn').addEventListener('click', () => {
  window.close();
  // Fallback if window.close() doesn't work (opened via direct navigation)
  setTimeout(() => {
    window.location.href = '/';
  }, 100);
});

document.getElementById('editBtn').addEventListener('click', () => {
  if (currentDoc) {
    window.location.href = `/${currentDoc.type}-form.html?id=${currentDoc.id}`;
  }
});

document.getElementById('shareBtn').addEventListener('click', async () => {
  if (!currentDoc) return;

  try {
    // Generate share token if not exists
    let shareToken = currentDoc.shareToken;
    if (!shareToken) {
      const res = await fetch(`/api/documents/${currentDoc.id}/share-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (res.ok) {
        const data = await res.json();
        shareToken = data.shareToken;
        currentDoc.shareToken = shareToken;
      }
    }

    if (shareToken) {
      const shareUrl = `${window.location.origin}/estimate-public.html?token=${shareToken}`;
      navigator.clipboard.writeText(shareUrl);
      alert('Share link copied to clipboard!');
    }
  } catch (err) {
    console.error('Error generating share link:', err);
    alert('Failed to generate share link');
  }
});

// Load document on page load
loadDocument();
