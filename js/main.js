/* ========================================
   Habit Tracker Pro — Main App Controller
   ======================================== */

import {
  getHabits, addHabit, updateHabit, deleteHabit,
  archiveHabit, restoreHabit, checkinHabit, uncheckinHabit,
  getXPData, getLevel, getXPProgress,
  isTodayScheduled, getTodayProgress, calculateStreaks, getCompletionRate,
  getWeeklyData, getWeekLabels, getCategoryData, getMonthlyData, getHeatmapData,
  getCategories, ACHIEVEMENTS, checkAchievements, getUnlockedAchievements, getXPForCheckin,
  exportData, importData, clearAllData,
  saveMood, getTodayMood, getMoodData,
  getJournalEntries, saveJournalEntry, deleteJournalEntry,
  HABIT_TEMPLATES, getTemplateCategories,
  getStreakFreezes, useStreakFreeze, getDailyQuote,
  getHabitCalendar, getWeeklyReview
} from './tracker.js';
import { playCheckinSound, playAchievementSound, playLevelUpSound, playUncheckinSound } from './sounds.js';
import { requestNotificationPermission, scheduleAllReminders } from './remainder.js';

// --- Settings ---
function getSettings() {
  try {
    const s = JSON.parse(localStorage.getItem('habitpro_settings')) || {};
    return { darkMode: s.darkMode || false, notifications: s.notifications || false, sounds: s.sounds !== false, name: s.name || 'Debraj', ...s };
  } catch { return { darkMode: false, notifications: false, sounds: true, name: '' }; }
}
function saveSettings(s) { localStorage.setItem('habitpro_settings', JSON.stringify(s)); }

// --- State ---
let currentView = 'dashboard';
let editingHabitId = null;
let searchQuery = '';
let activeCategory = 'all';
let activeTemplateCategory = 'All';
const settings = getSettings();

// Timer state
let timerInterval = null;
let timerMode = 'focus';
let timerSeconds = 25 * 60;
let timerTotalSeconds = 25 * 60;
let timerRunning = false;
let timerSessions = parseInt(localStorage.getItem('habitpro_timer_sessions') || '0');
const TIMER_DURATIONS = { focus: 25 * 60, short: 5 * 60, long: 15 * 60 };

// --- Init ---
window.addEventListener('DOMContentLoaded', () => {
  // Check onboarding
  if (!localStorage.getItem('habitpro_onboarded')) {
    document.getElementById('onboarding-screen').classList.remove('hidden');
  } else {
    document.getElementById('onboarding-screen').classList.add('hidden');
  }

  applyTheme();
  setGreeting();
  setQuote();
  setupEventListeners();
  renderCurrentView();
  updateSidebar();

  // Init settings toggles
  const darkToggle = document.getElementById('setting-darkmode');
  const notiToggle = document.getElementById('setting-notifications');
  const soundToggle = document.getElementById('setting-sounds');
  const nameInput = document.getElementById('setting-name');
  if (darkToggle) darkToggle.checked = settings.darkMode;
  if (notiToggle) notiToggle.checked = settings.notifications;
  if (soundToggle) soundToggle.checked = settings.sounds;
  if (nameInput) nameInput.value = settings.name || '';

  // Set mood if already selected
  const todayMood = getTodayMood();
  if (todayMood) {
    document.querySelectorAll('.mood-btn').forEach(b => {
      b.classList.toggle('selected', b.dataset.mood === todayMood);
    });
  }

  // Update profile
  updateProfile();

  // Freeze count
  updateFreezeCount();

  // Timer sessions
  updateTimerSessions();

  // Offline
  window.addEventListener('online', () => document.getElementById('offline-banner').classList.remove('visible'));
  window.addEventListener('offline', () => document.getElementById('offline-banner').classList.add('visible'));

  // PWA Install
  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredPrompt = e;
    document.getElementById('install-banner').classList.add('visible');
  });
  document.getElementById('install-btn')?.addEventListener('click', async () => {
    if (deferredPrompt) { deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt = null; }
    document.getElementById('install-banner').classList.remove('visible');
  });
  document.getElementById('install-dismiss')?.addEventListener('click', () => {
    document.getElementById('install-banner').classList.remove('visible');
  });
});

function setGreeting() {
  const h = new Date().getHours();
  const name = settings.name ? `, ${settings.name}` : '';
  let greet = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  document.getElementById('greeting-text').textContent = `${greet}${name}! 👋`;
  document.getElementById('greeting-date').textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function setQuote() {
  const q = getDailyQuote();
  document.getElementById('quote-text').textContent = `"${q.text}"`;
  document.getElementById('quote-author').textContent = `— ${q.author}`;
}

function updateProfile() {
  const el = document.getElementById('profile-name');
  if (el) el.textContent = settings.name || 'User';
}

function updateFreezeCount() {
  const el = document.getElementById('freeze-count');
  if (el) el.textContent = getStreakFreezes();
}

// --- Theme ---
function applyTheme() {
  if (settings.darkMode) {
    document.body.classList.add('dark');
  } else {
    document.body.classList.remove('dark');
  }
  updateThemeIcon();
}
function toggleTheme() {
  settings.darkMode = !settings.darkMode;
  saveSettings(settings);
  applyTheme();
  // Re-render analytics if visible
  if (currentView === 'analytics') renderAnalyticsView();
}
function updateThemeIcon() {
  const el = document.getElementById('theme-icon');
  if (el) el.textContent = settings.darkMode ? '☀️' : '🌙';
}

// --- Navigation ---
function switchView(view) {
  currentView = view;
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const target = document.getElementById(`view-${view}`);
  if (target) target.classList.add('active');
  // Update nav items
  document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.view === view));
  document.querySelectorAll('.bottom-nav-item[data-view]').forEach(n => n.classList.toggle('active', n.dataset.view === view));
  renderCurrentView();
  closeSidebar();
}

function renderCurrentView() {
  switch (currentView) {
    case 'dashboard': renderDashboard(); break;
    case 'habits': renderHabitsView(); break;
    case 'templates': renderTemplates(); break;
    case 'analytics': renderAnalyticsView(); break;
    case 'journal': renderJournal(); break;
    case 'timer': renderTimer(); break;
    case 'achievements': renderAchievementsView(); break;
    case 'settings': break;
  }
}

// --- Sidebar ---
function openSidebar() { document.getElementById('sidebar').classList.add('active'); document.getElementById('sidebar-overlay').classList.add('active'); }
function closeSidebar() { document.getElementById('sidebar').classList.remove('active'); document.getElementById('sidebar-overlay').classList.remove('active'); }
function updateSidebar() {
  const xp = getXPData();
  const level = getLevel(xp.totalXP);
  const progress = getXPProgress(xp.totalXP) * 100;
  const nextXP = level * 100;
  document.getElementById('sidebar-level').textContent = level;
  document.getElementById('sidebar-xp-bar').style.width = progress + '%';
  document.getElementById('sidebar-xp').textContent = xp.totalXP;
  document.getElementById('sidebar-xp-next').textContent = nextXP;
}

// --- Toast ---
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => { toast.classList.add('hide'); setTimeout(() => toast.remove(), 500); }, 3000);
}

// --- Confetti ---
function triggerConfetti() {
  const canvas = document.getElementById('confetti-canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const particles = [];
  const colors = ['#6c5ce7', '#00b894', '#e17055', '#0984e3', '#fdcb6e', '#e84393', '#00cec9', '#ff6b6b'];
  for (let i = 0; i < 120; i++) {
    particles.push({
      x: Math.random() * canvas.width, y: -10 - Math.random() * 100,
      vx: (Math.random() - 0.5) * 8, vy: Math.random() * 4 + 2,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: Math.random() * 6 + 3, rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 10, life: 1
    });
  }
  let frame = 0;
  function animate() {
    if (frame > 150) { ctx.clearRect(0, 0, canvas.width, canvas.height); return; }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => {
      p.x += p.vx; p.y += p.vy; p.vy += 0.1; p.rotation += p.rotationSpeed;
      p.life -= 0.005;
      if (p.life <= 0) return;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation * Math.PI / 180);
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      ctx.restore();
    });
    frame++;
    requestAnimationFrame(animate);
  }
  animate();
}

// === DASHBOARD ===
function renderDashboard() {
  const habits = getHabits();
  const active = habits.filter(h => !h.archived);
  const xp = getXPData();
  const todayScheduled = active.filter(isTodayScheduled);
  const todayDone = todayScheduled.filter(h => getTodayProgress(h).done).length;
  const todayRate = todayScheduled.length > 0 ? Math.round((todayDone / todayScheduled.length) * 100) : 0;
  const activeStreaks = active.filter(h => (h.streak || 0) > 0).length;

  // Stats
  document.getElementById('stat-total').textContent = active.length;
  document.getElementById('stat-streaks').textContent = activeStreaks;
  document.getElementById('stat-completion').textContent = todayRate + '%';
  document.getElementById('stat-xp').textContent = 'Lv ' + getLevel(xp.totalXP);

  // Best streak fire
  let best = 0;
  active.forEach(h => { best = Math.max(best, h.streak || 0); });
  document.getElementById('best-streak-count').textContent = best;

  // Progress bar
  document.getElementById('today-progress-fill').style.width = todayRate + '%';

  // Category tabs
  renderCategoryTabs(active);

  // Today's habits
  let filtered = todayScheduled;
  if (searchQuery) filtered = filtered.filter(h => h.name.toLowerCase().includes(searchQuery.toLowerCase()));
  if (activeCategory !== 'all') filtered = filtered.filter(h => h.category === activeCategory);

  // Sort
  const sortBy = document.getElementById('habit-sort')?.value || 'default';
  filtered = sortHabits(filtered, sortBy);

  renderTodayHabits(filtered);

  // Heatmap
  renderHeatmap(habits);

  // Weekly review
  renderWeeklyReview(habits);

  // Update sidebar
  updateSidebar();
}

function sortHabits(habits, sortBy) {
  const prioMap = { high: 3, medium: 2, low: 1 };
  switch (sortBy) {
    case 'name': return [...habits].sort((a, b) => a.name.localeCompare(b.name));
    case 'priority': return [...habits].sort((a, b) => (prioMap[b.priority] || 2) - (prioMap[a.priority] || 2));
    case 'streak': return [...habits].sort((a, b) => (b.streak || 0) - (a.streak || 0));
    case 'incomplete':
      return [...habits].sort((a, b) => {
        const aDone = getTodayProgress(a).done ? 1 : 0;
        const bDone = getTodayProgress(b).done ? 1 : 0;
        return aDone - bDone;
      });
    default: return habits;
  }
}

function renderCategoryTabs(habits) {
  const tabs = document.getElementById('category-tabs');
  if (!tabs) return;
  const cats = getCategories(habits);
  tabs.innerHTML = `<button class="filter-tab ${activeCategory === 'all' ? 'active' : ''}" data-category="all">All</button>`;
  cats.forEach(c => {
    tabs.innerHTML += `<button class="filter-tab ${activeCategory === c ? 'active' : ''}" data-category="${c}">${c}</button>`;
  });
}

function renderTodayHabits(habits) {
  const container = document.getElementById('today-habits');
  if (!habits.length) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">🎯</div><h3>No habits yet!</h3><p>Click the + button to create your first habit.</p></div>`;
    return;
  }
  container.innerHTML = habits.map((h, idx) => {
    const prog = getTodayProgress(h);
    const isDone = prog.done;
    const streaks = h.streak || 0;
    const circumference = 2 * Math.PI * 16;
    const pct = prog.goal > 0 ? (prog.count / prog.goal) : 0;
    const offset = circumference * (1 - Math.min(pct, 1));
    const prioColors = { high: '#d63031', medium: '#fdcb6e', low: '#00b894' };
    return `
      <div class="habit-today-card ${isDone ? 'completed' : ''}" data-id="${h.id}" style="animation-delay:${idx * 0.05}s; border-left: 3px solid ${h.color || '#6c5ce7'};">
        <button class="habit-check-btn" data-action="checkin" data-id="${h.id}" title="${isDone ? 'Undo' : 'Check in'}">${isDone ? '✓' : ''}</button>
        <div class="habit-today-info">
          <div class="habit-today-name">${h.emoji || '💪'} ${h.name}</div>
          <div class="habit-today-meta">
            <span class="priority-dot" style="background:${prioColors[h.priority] || '#fdcb6e'}"></span>
            <span>${h.category || 'General'}</span>
            <span>·</span>
            <span>${prog.count}/${prog.goal}</span>
            ${streaks > 0 ? `<span class="streak-badge">🔥 ${streaks}d</span>` : ''}
          </div>
        </div>
        <div class="progress-ring-container">
          <svg class="progress-ring" viewBox="0 0 36 36">
            <circle class="progress-ring-bg" cx="18" cy="18" r="16" />
            <circle class="progress-ring-fill" cx="18" cy="18" r="16" style="stroke:${h.color || '#6c5ce7'}; stroke-dasharray:${circumference}; stroke-dashoffset:${offset};" />
          </svg>
          <span class="progress-ring-text">${Math.round(pct * 100)}%</span>
        </div>
      </div>`;
  }).join('');
}

function renderHeatmap(habits) {
  const data = getHeatmapData(habits);
  const grid = document.getElementById('heatmap-grid');
  const months = document.getElementById('heatmap-months');
  if (!grid || !months) return;

  const maxCount = Math.max(1, ...data.map(d => d.count));
  grid.innerHTML = data.map(d => {
    let level = 0;
    if (d.count > 0) level = Math.min(4, Math.ceil((d.count / maxCount) * 4));
    return `<div class="heatmap-cell level-${level}" title="${d.date}: ${d.count} habits"></div>`;
  }).join('');

  // Month labels
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const positions = {};
  data.forEach((d, i) => {
    const m = new Date(d.date).getMonth();
    if (!positions[m]) positions[m] = i;
  });
  months.innerHTML = '';
  Object.entries(positions).forEach(([m, pos]) => {
    const weekIdx = Math.floor(pos / 7);
    const span = document.createElement('span');
    span.textContent = monthNames[m];
    span.style.position = 'absolute';
    span.style.left = weekIdx * 14 + 'px';
    months.appendChild(span);
  });
}

function renderWeeklyReview(habits) {
  const review = getWeeklyReview(habits);
  document.getElementById('week-range').textContent = review.range;
  document.getElementById('weekly-review-stats').innerHTML = `
    <div class="review-stat"><div class="review-stat-value">${review.completedCheckins}</div><div class="review-stat-label">Completed</div></div>
    <div class="review-stat"><div class="review-stat-value">${review.totalCheckins}</div><div class="review-stat-label">Total Tasks</div></div>
    <div class="review-stat"><div class="review-stat-value">${review.completionRate}%</div><div class="review-stat-label">Completion</div></div>
    <div class="review-stat"><div class="review-stat-value">🔥 ${review.bestStreak}</div><div class="review-stat-label">Best Streak</div></div>
  `;
}

// === HABITS VIEW ===
function renderHabitsView() {
  const habits = getHabits();
  const active = habits.filter(h => !h.archived);
  const archived = habits.filter(h => h.archived);
  renderHabitCards(active, 'habits-list');
  if (archived.length > 0) {
    renderHabitCards(archived, 'archived-list', true);
  }
}

function renderHabitCards(habits, containerId, isArchived = false) {
  const container = document.getElementById(containerId);
  if (!container) return;
  if (!habits.length) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">📋</div><h3>${isArchived ? 'No archived habits' : 'No habits yet'}</h3><p>${isArchived ? '' : 'Create your first habit to get started!'}</p></div>`;
    return;
  }
  container.innerHTML = habits.map((h, i) => {
    const streaks = calculateStreaks(h);
    return `
      <div class="habit-card ${isArchived ? 'archived' : ''}" data-id="${h.id}" style="animation-delay:${i * 0.05}s">
        <div style="position:absolute;top:0;left:0;right:0;height:3px;background:${h.color}"></div>
        <div class="habit-card-header">
          <div class="habit-card-title">
            <span class="habit-emoji">${h.emoji}</span>
            <span class="habit-name">${h.name}</span>
          </div>
          <div class="habit-card-actions">
            ${isArchived
        ? `<button class="habit-action-btn" data-action="restore" data-id="${h.id}" title="Restore">↩</button>`
        : `<button class="habit-action-btn" data-action="edit" data-id="${h.id}" title="Edit">✏️</button>
                 <button class="habit-action-btn" data-action="archive" data-id="${h.id}" title="Archive">📦</button>`}
            <button class="habit-action-btn delete" data-action="delete" data-id="${h.id}" title="Delete">🗑️</button>
          </div>
        </div>
        <div class="habit-card-body">
          <span class="habit-tag">${h.category || 'General'}</span>
          <span class="habit-tag">${h.difficulty}</span>
          <span class="habit-tag">${h.frequency}</span>
          <span class="habit-tag">${h.priority} priority</span>
        </div>
        <div class="habit-card-stats">
          <div class="habit-stat"><div class="habit-stat-value">${streaks.current}</div><div class="habit-stat-label">Streak</div></div>
          <div class="habit-stat"><div class="habit-stat-value">${streaks.longest}</div><div class="habit-stat-label">Longest</div></div>
          <div class="habit-stat"><div class="habit-stat-value">${h.totalCompletions || 0}</div><div class="habit-stat-label">Total</div></div>
        </div>
        ${h.notes ? `<div class="habit-notes-preview">${h.notes}</div>` : ''}
      </div>`;
  }).join('');
}

// === TEMPLATES ===
function renderTemplates() {
  const catContainer = document.getElementById('template-categories');
  const gridContainer = document.getElementById('templates-grid');
  if (!catContainer || !gridContainer) return;

  const cats = getTemplateCategories();
  catContainer.innerHTML = `<button class="template-cat-btn ${activeTemplateCategory === 'All' ? 'active' : ''}" data-tcat="All">All</button>` +
    cats.map(c => `<button class="template-cat-btn ${activeTemplateCategory === c ? 'active' : ''}" data-tcat="${c}">${c}</button>`).join('');

  const filtered = activeTemplateCategory === 'All' ? HABIT_TEMPLATES : HABIT_TEMPLATES.filter(t => t.category === activeTemplateCategory);
  gridContainer.innerHTML = filtered.map((t, i) => `
    <div class="template-card" style="animation-delay:${i * 0.04}s">
      <div class="template-emoji">${t.emoji}</div>
      <div class="template-name">${t.name}</div>
      <div class="template-desc">${t.category} · ${t.difficulty}${t.goal > 1 ? ` · Goal: ${t.goal}` : ''}</div>
      <button class="template-add-btn" data-template-idx="${HABIT_TEMPLATES.indexOf(t)}">+ Add Habit</button>
    </div>
  `).join('');
}

// === ANALYTICS ===
function renderAnalyticsView() {
  const habits = getHabits().filter(h => !h.archived);
  const range = parseInt(document.getElementById('analytics-range')?.value || '30');
  import('./analytics.js').then(mod => {
    mod.renderWeeklyChart(habits);
    mod.renderCompletionChart(habits, range);
    mod.renderCategoryChart(habits);
    mod.renderStreakChart(habits);
    mod.renderMonthlyChart(habits, range);
    mod.renderMoodChart(range);
  });
}

// === JOURNAL ===
function renderJournal() {
  const entries = getJournalEntries();
  const container = document.getElementById('journal-entries');
  if (!container) return;
  const moodEmojis = { amazing: '😄', good: '🙂', okay: '😐', bad: '😔', awful: '😢' };
  if (!entries.length) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">📝</div><h3>No journal entries yet</h3><p>Start writing to track your thoughts and progress.</p></div>`;
    return;
  }
  container.innerHTML = entries.map((e, i) => `
    <div class="journal-entry-card" style="animation-delay:${i * 0.04}s">
      <div class="journal-entry-header">
        <span class="journal-entry-date">${new Date(e.date).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}</span>
        <div style="display:flex;align-items:center;gap:0.5rem">
          ${e.mood ? `<span class="journal-entry-mood">${moodEmojis[e.mood] || ''}</span>` : ''}
          <button class="journal-delete-btn" data-journal-delete="${e.id}">🗑️</button>
        </div>
      </div>
      <div class="journal-entry-text">${e.text}</div>
    </div>
  `).join('');
}

// === FOCUS TIMER ===
function renderTimer() {
  updateTimerDisplay();
  updateTimerSessions();
  // Populate habit selector
  const select = document.getElementById('timer-habit');
  if (select) {
    const habits = getHabits().filter(h => !h.archived);
    select.innerHTML = '<option value="">None</option>' + habits.map(h => `<option value="${h.id}">${h.emoji} ${h.name}</option>`).join('');
  }
}

function startTimer() {
  if (timerRunning) return;
  timerRunning = true;
  document.getElementById('timer-start').style.display = 'none';
  document.getElementById('timer-pause').style.display = '';
  timerInterval = setInterval(() => {
    timerSeconds--;
    updateTimerDisplay();
    if (timerSeconds <= 0) {
      clearInterval(timerInterval);
      timerRunning = false;
      document.getElementById('timer-start').style.display = '';
      document.getElementById('timer-pause').style.display = 'none';
      if (timerMode === 'focus') {
        timerSessions++;
        localStorage.setItem('habitpro_timer_sessions', timerSessions);
        updateTimerSessions();
        showToast('🎉 Focus session complete! Take a break.', 'success');
        if (settings.sounds) playAchievementSound();
        // Auto check-in linked habit
        const linkedHabit = document.getElementById('timer-habit')?.value;
        if (linkedHabit) { handleCheckin(linkedHabit); }
        triggerConfetti();
      } else {
        showToast('Break over! Ready to focus? 💪', 'info');
      }
      resetTimer();
    }
  }, 1000);
}

function pauseTimer() {
  clearInterval(timerInterval);
  timerRunning = false;
  document.getElementById('timer-start').style.display = '';
  document.getElementById('timer-pause').style.display = 'none';
}

function resetTimer() {
  clearInterval(timerInterval);
  timerRunning = false;
  timerSeconds = TIMER_DURATIONS[timerMode];
  timerTotalSeconds = timerSeconds;
  document.getElementById('timer-start').style.display = '';
  document.getElementById('timer-pause').style.display = 'none';
  updateTimerDisplay();
}

function setTimerMode(mode) {
  timerMode = mode;
  document.querySelectorAll('.timer-mode-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
  const labels = { focus: 'Focus Time', short: 'Short Break', long: 'Long Break' };
  document.getElementById('timer-label').textContent = labels[mode] || 'Focus Time';
  resetTimer();
}

function updateTimerDisplay() {
  const m = Math.floor(timerSeconds / 60);
  const s = timerSeconds % 60;
  document.getElementById('timer-time').textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  // Update ring
  const circumference = 2 * Math.PI * 90;
  const progress = timerTotalSeconds > 0 ? (1 - timerSeconds / timerTotalSeconds) : 0;
  const offset = circumference * progress;
  const ring = document.getElementById('timer-ring-fill');
  if (ring) ring.style.strokeDashoffset = circumference - offset;
}

function updateTimerSessions() {
  const el = document.getElementById('timer-session-count');
  if (el) el.textContent = timerSessions;
}

// === ACHIEVEMENTS ===
function renderAchievementsView() {
  const unlocked = getUnlockedAchievements();
  const container = document.getElementById('achievements-grid');
  const countEl = document.getElementById('achievements-count');
  if (!container) return;
  if (countEl) countEl.textContent = `${unlocked.length} / ${ACHIEVEMENTS.length} Unlocked`;
  container.innerHTML = ACHIEVEMENTS.map(a => {
    const isUnlocked = unlocked.includes(a.id);
    return `
      <div class="achievement-card ${isUnlocked ? 'unlocked' : 'locked'}">
        <div class="achievement-icon">${a.icon}</div>
        <div class="achievement-title">${a.title}</div>
        <div class="achievement-desc">${a.desc}</div>
        <div class="achievement-xp">+${a.xp} XP</div>
      </div>`;
  }).join('');
}

// === HABIT DETAIL MODAL ===
function openHabitDetail(habitId) {
  const habits = getHabits();
  const h = habits.find(x => x.id === habitId);
  if (!h) return;
  const modal = document.getElementById('habit-detail-modal');
  const body = document.getElementById('detail-body');
  const title = document.getElementById('detail-title');
  title.textContent = `${h.emoji} ${h.name}`;

  const streaks = calculateStreaks(h);
  const prog = getTodayProgress(h);
  const now = new Date();
  const cal = getHabitCalendar(h, now.getFullYear(), now.getMonth());
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  body.innerHTML = `
    <div class="detail-header">
      <div class="detail-emoji">${h.emoji}</div>
      <div class="detail-info">
        <h3>${h.name}</h3>
        <p>${h.category || 'General'} · ${h.difficulty} · ${h.frequency}</p>
      </div>
    </div>
    <div class="detail-stats-grid">
      <div class="detail-stat"><div class="detail-stat-value">${streaks.current}</div><div class="detail-stat-label">Current Streak</div></div>
      <div class="detail-stat"><div class="detail-stat-value">${streaks.longest}</div><div class="detail-stat-label">Longest Streak</div></div>
      <div class="detail-stat"><div class="detail-stat-value">${h.totalCompletions || 0}</div><div class="detail-stat-label">Total Done</div></div>
      <div class="detail-stat"><div class="detail-stat-value">${prog.count}/${prog.goal}</div><div class="detail-stat-label">Today</div></div>
    </div>
    <div class="detail-calendar">
      <h4>📅 ${monthNames[now.getMonth()]} ${now.getFullYear()}</h4>
      <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;text-align:center;margin-bottom:4px;">
        <small style="color:var(--text-muted)">Su</small><small style="color:var(--text-muted)">Mo</small><small style="color:var(--text-muted)">Tu</small><small style="color:var(--text-muted)">We</small><small style="color:var(--text-muted)">Th</small><small style="color:var(--text-muted)">Fr</small><small style="color:var(--text-muted)">Sa</small>
      </div>
      <div class="detail-cal-grid">
        ${cal.map(c => {
    if (c.type === 'empty') return '<div class="detail-cal-day empty"></div>';
    return `<div class="detail-cal-day ${c.done ? 'done' : 'missed'} ${c.isToday ? 'today' : ''}">${c.day}</div>`;
  }).join('')}
      </div>
    </div>
    ${h.notes ? `<h4 style="font-size:0.85rem;margin-bottom:0.4rem;">📝 Notes</h4><div class="detail-notes">${h.notes}</div>` : ''}
  `;
  modal.classList.add('active');
}

// === MODAL (Add/Edit) ===
function openModal(habit = null) {
  editingHabitId = habit ? habit.id : null;
  document.getElementById('modal-title').textContent = habit ? 'Edit Habit' : 'New Habit';
  document.getElementById('modal-save').textContent = habit ? 'Save Changes' : 'Create Habit';
  document.getElementById('habit-name').value = habit?.name || '';
  document.getElementById('habit-category').value = habit?.category || '';
  document.getElementById('habit-difficulty').value = habit?.difficulty || 'Medium';
  document.getElementById('habit-frequency').value = habit?.frequency || 'daily';
  document.getElementById('habit-goal').value = habit?.goal || 1;
  document.getElementById('habit-reminder').value = habit?.reminder || '';
  document.getElementById('habit-notes').value = habit?.notes || '';

  // Emoji
  document.querySelectorAll('.emoji-option').forEach(e => e.classList.toggle('selected', e.dataset.emoji === (habit?.emoji || '💪')));
  // Color
  document.querySelectorAll('.color-option').forEach(c => c.classList.toggle('selected', c.dataset.color === (habit?.color || '#6c5ce7')));
  // Priority
  document.querySelectorAll('.priority-option').forEach(p => p.classList.toggle('selected', p.dataset.priority === (habit?.priority || 'medium')));

  // Custom days
  const freq = habit?.frequency || 'daily';
  document.getElementById('custom-days').style.display = freq === 'custom' ? 'flex' : 'none';
  if (habit?.customDays) {
    document.querySelectorAll('#custom-days input').forEach(i => { i.checked = habit.customDays.includes(parseInt(i.value)); });
  } else {
    document.querySelectorAll('#custom-days input').forEach(i => { i.checked = false; });
  }

  document.getElementById('habit-modal').classList.add('active');
  document.getElementById('habit-name').focus();
}

function closeModal() { document.getElementById('habit-modal').classList.remove('active'); editingHabitId = null; }

function saveHabitFromModal() {
  const name = document.getElementById('habit-name').value.trim();
  if (!name) { showToast('Please enter a habit name!', 'error'); return; }
  const emoji = document.querySelector('.emoji-option.selected')?.dataset.emoji || '💪';
  const color = document.querySelector('.color-option.selected')?.dataset.color || '#6c5ce7';
  const category = document.getElementById('habit-category').value.trim() || 'General';
  const difficulty = document.getElementById('habit-difficulty').value;
  const frequency = document.getElementById('habit-frequency').value;
  const goal = parseInt(document.getElementById('habit-goal').value) || 1;
  const reminder = document.getElementById('habit-reminder').value;
  const priority = document.querySelector('.priority-option.selected')?.dataset.priority || 'medium';
  const notes = document.getElementById('habit-notes').value.trim();
  const customDays = frequency === 'custom' ? [...document.querySelectorAll('#custom-days input:checked')].map(i => parseInt(i.value)) : [];

  const data = { name, emoji, color, category, difficulty, frequency, customDays, goal, reminder, priority, notes };

  if (editingHabitId) {
    updateHabit(editingHabitId, data);
    showToast('✏️ Habit updated!', 'success');
  } else {
    addHabit(data);
    showToast('🎉 Habit created!', 'success');
    const habits = getHabits();
    const result = checkAchievements(habits);
    handleNewAchievements(result.newlyUnlocked);
  }

  closeModal();
  renderCurrentView();
  if (reminder) scheduleAllReminders();
}

// === CHECK-IN ===
function handleCheckin(habitId) {
  const prog = getTodayProgress(getHabits().find(h => h.id === habitId));
  if (prog && prog.done) {
    uncheckinHabit(habitId);
    showToast('↩ Check-in undone', 'warning');
    if (settings.sounds) playUncheckinSound();
  } else {
    const result = checkinHabit(habitId);
    if (!result) return;
    if (result.alreadyComplete) { showToast('Already complete today!', 'info'); return; }
    const xpE = result.xpEarned || 0;
    showToast(`✅ Habit completed! +${xpE} XP`, 'success');
    if (settings.sounds) playCheckinSound();
    if (result.completed) triggerConfetti();
    if (result.leveledUp) {
      showToast(`🎊 Level Up! You're now Level ${result.newLevel}!`, 'info');
      if (settings.sounds) playLevelUpSound();
      triggerConfetti();
    }
    const habits = getHabits();
    const ach = checkAchievements(habits);
    handleNewAchievements(ach.newlyUnlocked);
  }
  renderCurrentView();
}

function handleNewAchievements(list) {
  list.forEach(a => {
    showToast(`🏆 Achievement Unlocked: ${a.title} (+${a.xp} XP)`, 'info');
    if (settings.sounds) playAchievementSound();
  });
}

// === ONBOARDING ===
function setupOnboarding() {
  let currentSlide = 0;
  const slides = document.querySelectorAll('.onboarding-slide');
  const dots = document.querySelectorAll('.onboarding-dots .dot');
  const nextBtn = document.getElementById('onboarding-next');
  const skipBtn = document.getElementById('onboarding-skip');

  function goToSlide(n) {
    currentSlide = n;
    slides.forEach(s => s.classList.remove('active'));
    dots.forEach(d => d.classList.remove('active'));
    slides[n]?.classList.add('active');
    dots[n]?.classList.add('active');
    nextBtn.textContent = n === slides.length - 1 ? "Let's Go!" : 'Next';
  }

  nextBtn?.addEventListener('click', () => {
    if (currentSlide === slides.length - 1) {
      finishOnboarding();
    } else {
      goToSlide(currentSlide + 1);
    }
  });

  skipBtn?.addEventListener('click', finishOnboarding);
}

function finishOnboarding() {
  const name = document.getElementById('onboarding-username')?.value.trim();
  if (name) {
    settings.name = name;
    saveSettings(settings);
    updateProfile();
    setGreeting();
    document.getElementById('setting-name').value = name;
  }
  localStorage.setItem('habitpro_onboarded', 'true');
  document.getElementById('onboarding-screen').classList.add('hidden');
  showToast('🎉 Welcome to Habit Tracker Pro!', 'success');
}

// === EVENT LISTENERS ===
function setupEventListeners() {
  // Onboarding
  setupOnboarding();

  // Menu
  document.getElementById('menu-toggle')?.addEventListener('click', openSidebar);
  document.getElementById('sidebar-close')?.addEventListener('click', closeSidebar);
  document.getElementById('sidebar-overlay')?.addEventListener('click', closeSidebar);

  // Nav
  document.querySelectorAll('.nav-item').forEach(n => n.addEventListener('click', () => switchView(n.dataset.view)));
  document.querySelectorAll('.bottom-nav-item[data-view]').forEach(n => n.addEventListener('click', () => switchView(n.dataset.view)));

  // Bottom add
  document.getElementById('bottom-add-btn')?.addEventListener('click', () => openModal());

  // Theme
  document.getElementById('theme-toggle')?.addEventListener('click', toggleTheme);

  // Add habit
  document.getElementById('add-habit-btn')?.addEventListener('click', () => openModal());

  // Modal
  document.getElementById('modal-close')?.addEventListener('click', closeModal);
  document.getElementById('modal-cancel')?.addEventListener('click', closeModal);
  document.getElementById('modal-save')?.addEventListener('click', saveHabitFromModal);

  // Detail modal
  document.getElementById('detail-close')?.addEventListener('click', () => document.getElementById('habit-detail-modal').classList.remove('active'));

  // Modal overlay clicks
  document.getElementById('habit-modal')?.addEventListener('click', e => { if (e.target.id === 'habit-modal') closeModal(); });
  document.getElementById('habit-detail-modal')?.addEventListener('click', e => { if (e.target.id === 'habit-detail-modal') e.target.classList.remove('active'); });

  // Emoji picker
  document.getElementById('emoji-picker')?.addEventListener('click', e => {
    const btn = e.target.closest('.emoji-option');
    if (!btn) return;
    document.querySelectorAll('.emoji-option').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
  });

  // Color picker
  document.getElementById('color-picker')?.addEventListener('click', e => {
    const btn = e.target.closest('.color-option');
    if (!btn) return;
    document.querySelectorAll('.color-option').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
  });

  // Priority picker
  document.getElementById('priority-picker')?.addEventListener('click', e => {
    const btn = e.target.closest('.priority-option');
    if (!btn) return;
    document.querySelectorAll('.priority-option').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
  });

  // Frequency change
  document.getElementById('habit-frequency')?.addEventListener('change', e => {
    document.getElementById('custom-days').style.display = e.target.value === 'custom' ? 'flex' : 'none';
  });

  // Search
  document.getElementById('search-input')?.addEventListener('input', e => {
    searchQuery = e.target.value;
    renderCurrentView();
  });

  // Sort
  document.getElementById('habit-sort')?.addEventListener('change', () => renderDashboard());

  // Category tabs
  document.getElementById('category-tabs')?.addEventListener('click', e => {
    const btn = e.target.closest('.filter-tab');
    if (!btn) return;
    activeCategory = btn.dataset.category;
    renderDashboard();
  });

  // Mood
  document.getElementById('mood-picker')?.addEventListener('click', e => {
    const btn = e.target.closest('.mood-btn');
    if (!btn) return;
    const mood = btn.dataset.mood;
    const today = new Date().toISOString().split('T')[0];
    saveMood(today, mood);
    document.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    showToast(`😊 Mood logged: ${mood}`, 'success');
  });

  // Today's habits card clicks (checkin, detail)
  document.getElementById('today-habits')?.addEventListener('click', e => {
    const checkBtn = e.target.closest('[data-action="checkin"]');
    if (checkBtn) { e.stopPropagation(); handleCheckin(checkBtn.dataset.id); return; }
    const card = e.target.closest('.habit-today-card');
    if (card && !checkBtn) openHabitDetail(card.dataset.id);
  });

  // Habit cards in My Habits
  document.getElementById('habits-list')?.addEventListener('click', handleHabitCardClick);
  document.getElementById('archived-list')?.addEventListener('click', handleHabitCardClick);

  // Show archived
  document.getElementById('show-archived')?.addEventListener('click', () => {
    const sec = document.getElementById('archived-section');
    sec.style.display = sec.style.display === 'none' ? 'block' : 'none';
  });

  // Templates
  document.getElementById('template-categories')?.addEventListener('click', e => {
    const btn = e.target.closest('.template-cat-btn');
    if (!btn) return;
    activeTemplateCategory = btn.dataset.tcat;
    renderTemplates();
  });
  document.getElementById('templates-grid')?.addEventListener('click', e => {
    const btn = e.target.closest('.template-add-btn');
    if (!btn) return;
    const idx = parseInt(btn.dataset.templateIdx);
    const tmpl = HABIT_TEMPLATES[idx];
    if (!tmpl) return;
    addHabit({ ...tmpl, frequency: 'daily', priority: 'medium' });
    showToast(`🎉 ${tmpl.name} added!`, 'success');
    const habits = getHabits();
    const ach = checkAchievements(habits);
    handleNewAchievements(ach.newlyUnlocked);
    renderTemplates();
  });

  // Journal
  document.getElementById('new-journal-btn')?.addEventListener('click', () => {
    const editor = document.getElementById('journal-editor');
    editor.style.display = editor.style.display === 'none' ? 'block' : 'none';
    document.getElementById('journal-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('journal-text').value = '';
  });
  document.getElementById('journal-cancel')?.addEventListener('click', () => {
    document.getElementById('journal-editor').style.display = 'none';
  });
  document.getElementById('journal-save')?.addEventListener('click', () => {
    const text = document.getElementById('journal-text').value.trim();
    if (!text) { showToast('Please write something!', 'error'); return; }
    const date = document.getElementById('journal-date').value;
    const mood = document.getElementById('journal-mood').value;
    saveJournalEntry({ date, text, mood });
    document.getElementById('journal-editor').style.display = 'none';
    showToast('📝 Journal entry saved!', 'success');
    renderJournal();
    // Check achievements
    const ach = checkAchievements(getHabits());
    handleNewAchievements(ach.newlyUnlocked);
  });
  document.getElementById('journal-entries')?.addEventListener('click', e => {
    const btn = e.target.closest('[data-journal-delete]');
    if (!btn) return;
    if (confirm('Delete this journal entry?')) {
      deleteJournalEntry(btn.dataset.journalDelete);
      showToast('Journal entry deleted', 'warning');
      renderJournal();
    }
  });

  // Timer
  document.getElementById('timer-start')?.addEventListener('click', startTimer);
  document.getElementById('timer-pause')?.addEventListener('click', pauseTimer);
  document.getElementById('timer-reset')?.addEventListener('click', resetTimer);
  document.querySelectorAll('.timer-mode-btn').forEach(b => b.addEventListener('click', () => setTimerMode(b.dataset.mode)));

  // Analytics range
  document.getElementById('analytics-range')?.addEventListener('change', () => renderAnalyticsView());

  // Settings
  document.getElementById('setting-darkmode')?.addEventListener('change', e => {
    settings.darkMode = e.target.checked;
    saveSettings(settings);
    applyTheme();
  });
  document.getElementById('setting-notifications')?.addEventListener('change', async e => {
    settings.notifications = e.target.checked;
    saveSettings(settings);
    if (e.target.checked) {
      const granted = await requestNotificationPermission();
      if (granted) { scheduleAllReminders(); showToast('🔔 Notifications enabled!', 'success'); }
      else { e.target.checked = false; settings.notifications = false; saveSettings(settings); showToast('Notification permission denied', 'error'); }
    }
  });
  document.getElementById('setting-sounds')?.addEventListener('change', e => {
    settings.sounds = e.target.checked;
    saveSettings(settings);
  });
  document.getElementById('setting-name')?.addEventListener('change', e => {
    settings.name = e.target.value.trim();
    saveSettings(settings);
    updateProfile();
    setGreeting();
    showToast('👤 Name updated!', 'success');
  });
  document.getElementById('use-freeze')?.addEventListener('click', () => {
    if (useStreakFreeze()) {
      updateFreezeCount();
      showToast('❄️ Streak freeze used!', 'info');
    } else {
      showToast('No streak freezes remaining!', 'error');
    }
  });

  // Data
  document.getElementById('export-data')?.addEventListener('click', () => { exportData(); showToast('📦 Data exported!', 'success'); });
  document.getElementById('import-data')?.addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    try { await importData(file); showToast('✅ Data imported!', 'success'); renderCurrentView(); } catch { showToast('❌ Invalid file!', 'error'); }
  });
  document.getElementById('clear-data')?.addEventListener('click', () => {
    if (confirm('Are you sure you want to delete ALL data? This cannot be undone!')) {
      clearAllData();
      showToast('🗑️ All data cleared.', 'warning');
      location.reload();
    }
  });

  // Keyboard
  document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
    if (e.key === 'Escape') { closeModal(); document.getElementById('habit-detail-modal')?.classList.remove('active'); closeSidebar(); }
    if (e.key === 'n' || e.key === 'N') openModal();
    if (e.key === '1') switchView('dashboard');
    if (e.key === '2') switchView('habits');
    if (e.key === '3') switchView('analytics');
    if (e.key === '4') switchView('achievements');
    if (e.key === '5') switchView('settings');
  });
}

function handleHabitCardClick(e) {
  const action = e.target.closest('[data-action]');
  if (action) {
    const id = action.dataset.id;
    const act = action.dataset.action;
    e.stopPropagation();
    switch (act) {
      case 'edit': openModal(getHabits().find(h => h.id === id)); break;
      case 'archive': archiveHabit(id); showToast('📦 Habit archived', 'info'); renderHabitsView(); break;
      case 'restore': restoreHabit(id); showToast('↩ Habit restored', 'success'); renderHabitsView(); break;
      case 'delete':
        if (confirm('Delete this habit permanently?')) { deleteHabit(id); showToast('🗑️ Habit deleted', 'warning'); renderHabitsView(); }
        break;
    }
    return;
  }
  const card = e.target.closest('.habit-card');
  if (card) openHabitDetail(card.dataset.id);
}
