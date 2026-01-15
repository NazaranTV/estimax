// Customer Scheduling Interface JavaScript

const urlParams = new URLSearchParams(window.location.search);
const shareToken = urlParams.get('token');

let availableSlots = [];
let selectedSlot = null;

const formatDate = (dateStr) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

const formatTime = (timeStr) => {
  if (!timeStr) return '';
  const [hours, minutes] = timeStr.split(':');
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour === 0 ? 12 : (hour > 12 ? hour - 12 : hour);
  return `${displayHour}:${minutes} ${ampm}`;
};

const loadAvailableSlots = async () => {
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
    availableSlots = data.document.availabilitySlots || [];

    // Hide loading, show content
    loading.classList.add('hidden');
    content.classList.remove('hidden');

    // Render slots
    renderSlots();
  } catch (err) {
    console.error('Error loading slots:', err);
    loading.classList.add('hidden');
    error.classList.remove('hidden');
    error.textContent = err.message || 'Failed to load available times';
  }
};

const renderSlots = () => {
  const noSlots = document.getElementById('noSlots');
  const slotsGrid = document.getElementById('slotsGrid');

  if (availableSlots.length === 0) {
    noSlots.style.display = 'block';
    slotsGrid.style.display = 'none';
    return;
  }

  noSlots.style.display = 'none';
  slotsGrid.style.display = 'grid';

  slotsGrid.innerHTML = '';

  availableSlots.forEach(slot => {
    const slotCard = document.createElement('div');
    slotCard.className = 'slot-card';
    slotCard.innerHTML = `
      <div class="slot-date">${formatDate(slot.slotDate)}</div>
      <div class="slot-time">${formatTime(slot.slotTime)}</div>
    `;

    slotCard.addEventListener('click', () => {
      selectSlot(slot);
    });

    slotsGrid.appendChild(slotCard);
  });
};

const selectSlot = (slot) => {
  selectedSlot = slot;

  // Update UI
  document.querySelectorAll('.slot-card').forEach(card => {
    card.classList.remove('selected');
  });

  event.target.closest('.slot-card').classList.add('selected');

  // Show confirmation section
  const confirmSection = document.getElementById('confirmSection');
  confirmSection.classList.add('active');

  // Update selected slot display
  document.getElementById('selectedDate').textContent = formatDate(slot.slotDate);
  document.getElementById('selectedTime').textContent = formatTime(slot.slotTime);

  // Scroll to confirmation
  confirmSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
};

const cancelBtn = document.getElementById('cancelBtn');
const scheduleBtn = document.getElementById('scheduleBtn');

cancelBtn.addEventListener('click', () => {
  // Deselect
  selectedSlot = null;
  document.querySelectorAll('.slot-card').forEach(card => {
    card.classList.remove('selected');
  });

  // Hide confirmation
  document.getElementById('confirmSection').classList.remove('active');
});

scheduleBtn.addEventListener('click', async () => {
  if (!selectedSlot) return;

  try {
    scheduleBtn.disabled = true;
    scheduleBtn.textContent = 'Scheduling...';

    const res = await fetch(`/api/public/estimate/${shareToken}/book`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slotId: selectedSlot.id
      })
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error || 'Failed to book appointment');
    }

    const data = await res.json();

    // Show success message
    document.getElementById('content').classList.add('hidden');
    const success = document.getElementById('success');
    success.classList.remove('hidden');

    const successMessage = document.getElementById('successMessage');
    successMessage.textContent = `Your appointment has been successfully scheduled for ${formatDate(selectedSlot.slotDate)} at ${formatTime(selectedSlot.slotTime)}. We look forward to seeing you!`;
  } catch (err) {
    console.error('Error booking appointment:', err);
    alert(err.message || 'Failed to book appointment. Please try again or contact us directly.');
  } finally {
    scheduleBtn.disabled = false;
    scheduleBtn.textContent = 'Confirm Appointment';
  }
});

// Load slots on page load
loadAvailableSlots();
