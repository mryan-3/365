// ---------------------------------------------------------
// Configuration & State
// ---------------------------------------------------------
const STORAGE_KEY = '365_saver_data_v1';
const CURRENT_YEAR = new Date().getFullYear();
const MS_PER_DAY = 1000 * 60 * 60 * 24;

// We assume the challenge starts Jan 1st of the current year.
const START_DATE = new Date(CURRENT_YEAR, 0, 1);

// State object
let state = {
  savedDays: [], // Array of day numbers (1-366) that are marked as saved
  currency: 'KES' // Default
};

// ---------------------------------------------------------
// Helpers
// ---------------------------------------------------------

/**
 * Get day of year (1 - 366) from a specific Date object
 */
function getDayOfYear(date) {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date - start;
  return Math.floor(diff / MS_PER_DAY);
}

/**
 * Get the Date object from day number of year (1-366)
 */
function getDateFromDayNum(dayNum) {
  const date = new Date(CURRENT_YEAR, 0, dayNum);
  return date;
}

/**
 * Format currency
 */
function formatMoney(amount) {
  try {
    return new Intl.NumberFormat('en-US', { 
      style: 'decimal', 
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  } catch (e) {
    return amount.toLocaleString();
  }
}

// ---------------------------------------------------------
// Core Logic
// ---------------------------------------------------------

function loadState() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      state = { ...state, ...parsed }; // Merge to ensure new keys exist
    } catch (e) {
      console.error('Failed to parse storage', e);
    }
  } else {
    // First time load: Try to auto-detect currency
    try {
      const detected = new Intl.NumberFormat().resolvedOptions().currency;
      if (detected) state.currency = detected;
    } catch (e) {
      console.log('Could not detect currency');
    }
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  updateUI();
}

/**
 * Calculates due amount based on "Strict Mode"
 * Sum of all day numbers <= today that are NOT in savedDays
 */
function calculateDue() {
  const todayNum = getDayOfYear(new Date());
  let due = 0;
  let missingDays = [];

  // Loop from Day 1 to Today
  for (let i = 1; i <= todayNum; i++) {
    if (!state.savedDays.includes(i)) {
      due += i;
      missingDays.push(i);
    }
  }
  
  return { due, missingDays };
}

function getTotalSaved() {
  return state.savedDays.reduce((a, b) => a + b, 0);
}

// ---------------------------------------------------------
// UI Rendering
// ---------------------------------------------------------

// Current view for Calendar
let viewMonth = new Date().getMonth(); 
let viewYear = CURRENT_YEAR;

const elDueAmount = document.getElementById('due-amount');
const elHeroSub = document.getElementById('hero-sub');
const elBtnPay = document.getElementById('btn-pay');
const elTotalSaved = document.getElementById('total-saved');
const elDaysCompleted = document.getElementById('days-completed');
const elMonthTitle = document.getElementById('month-title');
const elCalendarBody = document.getElementById('calendar-body');
const elToast = document.getElementById('toast');
const elCurrencyLabel = document.getElementById('currency-label');
const elCurrencySelect = document.getElementById('currency-select');

function showToast(msg) {
  elToast.textContent = msg;
  elToast.classList.add('show');
  setTimeout(() => elToast.classList.remove('show'), 3000);
}

function renderHeader() {
  const { due, missingDays } = calculateDue();
  const totalSaved = getTotalSaved();
  
  // Update Currency UI
  elCurrencyLabel.textContent = state.currency;
  elCurrencySelect.value = state.currency;

  elTotalSaved.textContent = formatMoney(totalSaved);
  elDaysCompleted.textContent = `${state.savedDays.length}/365`;

  if (due === 0) {
    elDueAmount.textContent = "0";
    elHeroSub.textContent = "You are all caught up!";
    elBtnPay.textContent = "All Caught Up";
    elBtnPay.disabled = true;
  } else {
    elDueAmount.textContent = formatMoney(due);
    // If just one day missing, say "Day X", else "Catch up"
    if (missingDays.length === 1) {
      elHeroSub.textContent = `For Day ${missingDays[0]}`;
    } else {
      elHeroSub.textContent = `${missingDays.length} days overdue`;
    }
    elBtnPay.textContent = "Mark Saved";
    elBtnPay.disabled = false;
  }
}

function renderCalendar() {
  elCalendarBody.innerHTML = '';
  
  // Update Title
  const monthName = new Date(viewYear, viewMonth).toLocaleString('default', { month: 'long' });
  elMonthTitle.textContent = `${monthName} ${viewYear}`;

  // Logic to fill grid
  const firstDayOfMonth = new Date(viewYear, viewMonth, 1);
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const startDayOfWeek = firstDayOfMonth.getDay(); // 0 (Sun) to 6 (Sat)
  
  const todayNum = getDayOfYear(new Date());

  // Empty cells for previous month days
  for (let i = 0; i < startDayOfWeek; i++) {
    const cell = document.createElement('div');
    cell.className = 'day-cell empty';
    elCalendarBody.appendChild(cell);
  }

  // Days
  for (let d = 1; d <= daysInMonth; d++) {
    const currentLoopDate = new Date(viewYear, viewMonth, d);
    const dayNum = getDayOfYear(currentLoopDate);
    
    const cell = document.createElement('div');
    cell.className = 'day-cell';
    
    // Add number
    const dateSpan = document.createElement('span');
    dateSpan.textContent = d;
    cell.appendChild(dateSpan);
    
    // Add value (small)
    const valSpan = document.createElement('span');
    valSpan.className = 'day-val';
    valSpan.textContent = dayNum;
    cell.appendChild(valSpan);

    // Styling Logic
    if (state.savedDays.includes(dayNum)) {
      cell.classList.add('saved');
    } else if (dayNum < todayNum) {
      // Past and not saved
      cell.classList.add('overdue');
      // Make clickable to toggle manual save (optional advanced feature, 
      // but for strict mode let's keep it simple: clicking overdue toggles it?)
      // Let's allow clicking any day <= today to toggle status
      cell.onclick = () => toggleDay(dayNum);
    } else if (dayNum === todayNum) {
       // Today
       cell.style.borderColor = 'var(--text)';
       cell.onclick = () => toggleDay(dayNum);
    } else {
      // Future
      cell.classList.add('future');
    }
    
    elCalendarBody.appendChild(cell);
  }
}

function updateUI() {
  renderHeader();
  renderCalendar();
}

// ---------------------------------------------------------
// Actions
// ---------------------------------------------------------

function toggleDay(dayNum) {
  const index = state.savedDays.indexOf(dayNum);
  if (index > -1) {
    state.savedDays.splice(index, 1);
  } else {
    state.savedDays.push(dayNum);
    showToast(`Day ${dayNum} Saved!`);
  }
  // Sort for cleanliness
  state.savedDays.sort((a, b) => a - b);
  saveState();
}

function markAllDueAsSaved() {
  const { missingDays } = calculateDue();
  if (missingDays.length === 0) return;

  // Add all missing to saved
  state.savedDays = [...state.savedDays, ...missingDays];
  state.savedDays.sort((a, b) => a - b);
  
  saveState();
  showToast('Caught up successfully!');
}

// ---------------------------------------------------------
// Event Listeners
// ---------------------------------------------------------

elBtnPay.addEventListener('click', markAllDueAsSaved);

// Currency Change
elCurrencySelect.addEventListener('change', (e) => {
  state.currency = e.target.value;
  saveState();
});

document.getElementById('prev-month').addEventListener('click', () => {
  viewMonth--;
  if(viewMonth < 0) {
    viewMonth = 11;
    viewYear--;
  }
  renderCalendar();
});

document.getElementById('next-month').addEventListener('click', () => {
  viewMonth++;
  if(viewMonth > 11) {
    viewMonth = 0;
    viewYear++;
  }
  renderCalendar();
});

// Export Data
document.getElementById('btn-export').addEventListener('click', () => {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state));
  const downloadAnchorNode = document.createElement('a');
  downloadAnchorNode.setAttribute("href", dataStr);
  downloadAnchorNode.setAttribute("download", "365_saver_backup.json");
  document.body.appendChild(downloadAnchorNode);
  downloadAnchorNode.click();
  downloadAnchorNode.remove();
});

// Import Data
const elFileImport = document.getElementById('file-import');
document.getElementById('btn-import').addEventListener('click', () => {
  elFileImport.click();
});

elFileImport.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const importedState = JSON.parse(event.target.result);
      if (importedState && Array.isArray(importedState.savedDays)) {
        state = importedState;
        saveState(); // Save to local storage
        updateUI();  // Refresh UI
        showToast('Data imported successfully!');
      } else {
        alert('Invalid data file format.');
      }
    } catch (err) {
      console.error(err);
      alert('Error reading data file.');
    }
    // Reset input so same file can be selected again if needed
    elFileImport.value = '';
  };
  reader.readAsText(file);
});

// Calendar Reminder (ICS)
document.getElementById('btn-reminder').addEventListener('click', () => {
  const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//365Saver//PWA//EN
BEGIN:VEVENT
UID:365saver-${Date.now()}
DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z
DTSTART:${CURRENT_YEAR}0101T180000
RRULE:FREQ=DAILY
SUMMARY:Save Money (365 Challenge)
DESCRIPTION:Open the 365 Saver app and mark today's savings!
END:VEVENT
END:VCALENDAR`;

  const blob = new Blob([icsContent], { type: 'text/calendar' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = '365_reminder.ics';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
});

// ---------------------------------------------------------
// Init
// ---------------------------------------------------------

// Register Service Worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js')
    .then(() => console.log('SW Registered'));
}

// Boot
loadState();
updateUI();
