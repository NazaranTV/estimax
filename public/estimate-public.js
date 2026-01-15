// Public Estimate View JavaScript

const urlParams = new URLSearchParams(window.location.search);
const shareToken = urlParams.get('token');

let currentEstimate = null;

const currency = (value) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value || 0));

const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
};

const loadEstimate = async () => {
  const loading = document.getElementById('loading');
  const error = document.getElementById('error');
  const content = document.getElementById('content');

  try {
    if (!shareToken) {
      throw new Error('No share token provided');
    }

    const res = await fetch(`/api/public/estimate/${shareToken}`);

    if (!res.ok) {
      throw new Error('Estimate not found');
    }

    const data = await res.json();
    currentEstimate = data.document;

    // Hide loading, show content
    loading.classList.add('hidden');
    content.classList.remove('hidden');

    // Populate UI
    renderEstimate();
  } catch (err) {
    console.error('Error loading estimate:', err);
    loading.classList.add('hidden');
    error.classList.remove('hidden');
    error.textContent = err.message || 'Failed to load estimate';
  }
};

const renderEstimate = () => {
  const doc = currentEstimate;

  console.log('Rendering estimate, doc:', doc);
  console.log('Approval status:', doc.approvalStatus);

  // Header
  document.getElementById('poNumber').textContent = `PO: ${doc.poNumber || 'N/A'}`;

  // Status banner and action buttons
  const actionButtons = document.getElementById('actionButtons');
  const statusBanner = document.getElementById('statusBanner');

  console.log('Action buttons element:', actionButtons);
  console.log('Status banner element:', statusBanner);

  // Treat null/undefined as pending
  const approvalStatus = doc.approvalStatus || 'pending';
  console.log('Resolved approval status:', approvalStatus);

  if (approvalStatus === 'approved' || approvalStatus === 'declined') {
    console.log('Hiding buttons, showing banner');
    statusBanner.classList.remove('hidden');
    statusBanner.classList.add(approvalStatus);

    if (approvalStatus === 'approved') {
      statusBanner.textContent = '✓ This estimate has been approved';
    } else {
      statusBanner.textContent = '✗ This estimate has been declined';
    }

    // Hide action buttons
    actionButtons.classList.add('hidden');
  } else {
    console.log('Showing buttons, hiding banner');
    // Show action buttons for pending estimates
    statusBanner.classList.add('hidden');
    actionButtons.classList.remove('hidden');
  }

  // Client info
  document.getElementById('clientName').textContent = doc.clientName || '—';
  document.getElementById('clientEmail').textContent = doc.clientEmail || '—';
  document.getElementById('clientPhone').textContent = doc.clientPhone || '—';
  document.getElementById('serviceAddress').textContent = doc.serviceAddress || '—';

  // Project details
  document.getElementById('projectName').textContent = doc.projectName || '—';
  document.getElementById('validUntil').textContent = formatDate(doc.validUntil);

  const notesSection = document.getElementById('notesSection');
  if (doc.notes) {
    document.getElementById('notes').textContent = doc.notes;
    notesSection.style.display = 'block';
  } else {
    notesSection.style.display = 'none';
  }

  // Line items
  const lineItemsBody = document.getElementById('lineItemsBody');
  lineItemsBody.innerHTML = '';

  if (doc.lineItems && doc.lineItems.length > 0) {
    doc.lineItems.forEach(item => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${item.description || '—'}</td>
        <td style="text-align: right;">${item.quantity || 0}</td>
        <td style="text-align: right;">${currency(item.rate)}</td>
        <td style="text-align: right;">${currency((item.quantity || 0) * (item.rate || 0))}</td>
      `;
      lineItemsBody.appendChild(row);
    });
  } else {
    lineItemsBody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--text-secondary);">No line items</td></tr>';
  }

  // Totals
  document.getElementById('subtotal').textContent = currency(doc.subtotal);
  document.getElementById('total').textContent = currency(doc.total);
};

// Modal handling
const approveModal = document.getElementById('approveModal');
const declineModal = document.getElementById('declineModal');
const approveBtn = document.getElementById('approveBtn');
const declineBtn = document.getElementById('declineBtn');
const cancelApprove = document.getElementById('cancelApprove');
const cancelDecline = document.getElementById('cancelDecline');
const submitApprove = document.getElementById('submitApprove');
const submitDecline = document.getElementById('submitDecline');
const approveNotes = document.getElementById('approveNotes');
const declineNotes = document.getElementById('declineNotes');

approveBtn.addEventListener('click', () => {
  approveModal.classList.add('active');
});

declineBtn.addEventListener('click', () => {
  declineModal.classList.add('active');
});

cancelApprove.addEventListener('click', () => {
  approveModal.classList.remove('active');
  approveNotes.value = '';
});

cancelDecline.addEventListener('click', () => {
  declineModal.classList.remove('active');
  declineNotes.value = '';
});

// Close modals on background click
approveModal.addEventListener('click', (e) => {
  if (e.target === approveModal) {
    approveModal.classList.remove('active');
    approveNotes.value = '';
  }
});

declineModal.addEventListener('click', (e) => {
  if (e.target === declineModal) {
    declineModal.classList.remove('active');
    declineNotes.value = '';
  }
});

submitApprove.addEventListener('click', async () => {
  try {
    submitApprove.disabled = true;
    submitApprove.textContent = 'Approving...';

    const res = await fetch(`/api/public/estimate/${shareToken}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerNotes: approveNotes.value.trim()
      })
    });

    if (!res.ok) {
      throw new Error('Failed to approve estimate');
    }

    const data = await res.json();
    currentEstimate = data.document;

    // Close modal
    approveModal.classList.remove('active');
    approveNotes.value = '';

    // Re-render to show approved status
    renderEstimate();

    // If there are availability slots, redirect to scheduling
    if (currentEstimate.availabilitySlots && currentEstimate.availabilitySlots.length > 0) {
      window.location.href = `/schedule.html?token=${shareToken}`;
    }
  } catch (err) {
    console.error('Error approving estimate:', err);
    alert('Failed to approve estimate. Please try again.');
  } finally {
    submitApprove.disabled = false;
    submitApprove.textContent = 'Approve';
  }
});

submitDecline.addEventListener('click', async () => {
  try {
    submitDecline.disabled = true;
    submitDecline.textContent = 'Declining...';

    const res = await fetch(`/api/public/estimate/${shareToken}/decline`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerNotes: declineNotes.value.trim()
      })
    });

    if (!res.ok) {
      throw new Error('Failed to decline estimate');
    }

    const data = await res.json();
    currentEstimate = data.document;

    // Close modal
    declineModal.classList.remove('active');
    declineNotes.value = '';

    // Re-render to show declined status
    renderEstimate();
  } catch (err) {
    console.error('Error declining estimate:', err);
    alert('Failed to decline estimate. Please try again.');
  } finally {
    submitDecline.disabled = false;
    submitDecline.textContent = 'Decline';
  }
});

// Load estimate on page load
loadEstimate();
