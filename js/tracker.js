/* ========================================
   Habit Tracker Pro — Core Data Module
   ======================================== */

const STORAGE_KEY = 'habitpro_habits';
const XP_KEY = 'habitpro_xp';
const MOOD_KEY = 'habitpro_moods';
const JOURNAL_KEY = 'habitpro_journal';
const SETTINGS_KEY = 'habitpro_settings';
const ACHIEVEMENTS_KEY = 'habitpro_achievements';

// --- Data Access ---
export function getHabits() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch { return []; } }
function saveHabits(h) { localStorage.setItem(STORAGE_KEY, JSON.stringify(h)); }

// --- XP System ---
const XP_PER_CHECKIN = { Easy: 10, Medium: 20, Hard: 35 };
const XP_PER_LEVEL = 100;
export function getXPData() { try { return JSON.parse(localStorage.getItem(XP_KEY)) || { totalXP: 0 }; } catch { return { totalXP: 0 }; } }
function saveXP(d) { localStorage.setItem(XP_KEY, JSON.stringify(d)); }
export function addXP(amount) { const d = getXPData(); const old = getLevel(d.totalXP); d.totalXP += amount; saveXP(d); const nw = getLevel(d.totalXP); return { totalXP: d.totalXP, leveledUp: nw > old, newLevel: nw }; }
export function getLevel(xp) { return Math.floor(xp / XP_PER_LEVEL) + 1; }
export function getXPProgress(xp) { return (xp % XP_PER_LEVEL) / XP_PER_LEVEL; }
export function getXPForCheckin(diff) { return XP_PER_CHECKIN[diff] || 15; }

// --- Habit CRUD ---
export function addHabit(data) {
  const habits = getHabits();
  const habit = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    name: data.name, emoji: data.emoji || '💪', color: data.color || '#6c5ce7',
    category: data.category || 'General', difficulty: data.difficulty || 'Medium',
    frequency: data.frequency || 'daily', customDays: data.customDays || [],
    goal: data.goal || 1, reminder: data.reminder || '',
    priority: data.priority || 'medium', notes: data.notes || '',
    archived: false, createdAt: new Date().toISOString(),
    history: {}, streak: 0, longestStreak: 0, totalCompletions: 0
  };
  habits.push(habit);
  saveHabits(habits);
  return habit;
}

export function updateHabit(id, updates) {
  const habits = getHabits();
  const i = habits.findIndex(h => h.id === id);
  if (i === -1) return null;
  habits[i] = { ...habits[i], ...updates };
  saveHabits(habits);
  return habits[i];
}

export function deleteHabit(id) { saveHabits(getHabits().filter(h => h.id !== id)); }
export function archiveHabit(id) { return updateHabit(id, { archived: true }); }
export function restoreHabit(id) { return updateHabit(id, { archived: false }); }

// --- Check-in ---
export function checkinHabit(id) {
  const habits = getHabits();
  const habit = habits.find(h => h.id === id);
  if (!habit) return null;
  const today = getTodayStr();
  if (!habit.history) habit.history = {};
  if (!habit.history[today]) habit.history[today] = { count: 0, timestamps: [] };
  const dd = habit.history[today];
  if (dd.count >= (habit.goal || 1)) return { habit, alreadyComplete: true };
  dd.count++;
  dd.timestamps.push(new Date().toISOString());
  habit.totalCompletions = (habit.totalCompletions || 0) + 1;
  const s = calculateStreaks(habit);
  habit.streak = s.current;
  habit.longestStreak = Math.max(habit.longestStreak || 0, s.longest);
  saveHabits(habits);
  const xpE = getXPForCheckin(habit.difficulty);
  const xpR = addXP(xpE);
  return { habit, alreadyComplete: false, completed: dd.count >= (habit.goal || 1), xpEarned: xpE, ...xpR };
}

export function uncheckinHabit(id) {
  const habits = getHabits();
  const habit = habits.find(h => h.id === id);
  if (!habit) return null;
  const today = getTodayStr();
  if (!habit.history?.[today] || habit.history[today].count <= 0) return null;
  habit.history[today].count--;
  if (habit.history[today].count === 0) delete habit.history[today];
  habit.totalCompletions = Math.max(0, (habit.totalCompletions || 0) - 1);
  const s = calculateStreaks(habit);
  habit.streak = s.current;
  saveHabits(habits);
  return habit;
}

// --- Streak ---
function getTodayStr() { return new Date().toISOString().split('T')[0]; }
function getDateStr(d) { return d.toISOString().split('T')[0]; }

export function calculateStreaks(habit) {
  if (!habit.history) return { current: 0, longest: 0 };
  const dates = Object.keys(habit.history).filter(d => habit.history[d].count >= (habit.goal || 1)).sort().reverse();
  if (!dates.length) return { current: 0, longest: 0 };
  let current = 0;
  const today = getTodayStr(), yesterday = getDateStr(new Date(Date.now() - 86400000));
  if (dates[0] === today || dates[0] === yesterday) {
    current = 1;
    for (let i = 1; i < dates.length; i++) {
      if ((new Date(dates[i - 1]) - new Date(dates[i])) / 86400000 === 1) current++; else break;
    }
  }
  let longest = 0, temp = 1;
  const asc = [...dates].sort();
  for (let i = 1; i < asc.length; i++) {
    if ((new Date(asc[i]) - new Date(asc[i - 1])) / 86400000 === 1) temp++; else { longest = Math.max(longest, temp); temp = 1; }
  }
  longest = Math.max(longest, temp, current);
  return { current, longest };
}

// --- Schedule ---
export function isTodayScheduled(habit) {
  const day = new Date().getDay();
  switch (habit.frequency) {
    case 'daily': return true;
    case 'weekdays': return day >= 1 && day <= 5;
    case 'weekends': return day === 0 || day === 6;
    case 'custom': return (habit.customDays || []).includes(day);
    default: return true;
  }
}

export function getTodayProgress(habit) {
  const today = getTodayStr();
  if (!habit.history?.[today]) return { count: 0, goal: habit.goal || 1, done: false };
  const c = habit.history[today].count;
  return { count: c, goal: habit.goal || 1, done: c >= (habit.goal || 1) };
}

// --- Analytics ---
export function getCompletionRate(habits, days = 7) {
  const active = habits.filter(h => !h.archived);
  if (!active.length) return 0;
  let comp = 0, total = 0;
  for (let i = 0; i < days; i++) {
    const date = getDateStr(new Date(Date.now() - i * 86400000));
    const d = new Date(date);
    active.forEach(h => {
      const day = d.getDay();
      let sched = true;
      if (h.frequency === 'weekdays') sched = day >= 1 && day <= 5;
      else if (h.frequency === 'weekends') sched = day === 0 || day === 6;
      else if (h.frequency === 'custom') sched = (h.customDays || []).includes(day);
      if (sched) { total++; if (h.history?.[date]?.count >= (h.goal || 1)) comp++; }
    });
  }
  return total > 0 ? Math.round((comp / total) * 100) : 0;
}

export function getWeeklyData(habits) {
  const data = [];
  for (let i = 6; i >= 0; i--) {
    const date = getDateStr(new Date(Date.now() - i * 86400000));
    let c = 0;
    habits.filter(h => !h.archived).forEach(h => { if (h.history?.[date]?.count >= (h.goal || 1)) c++; });
    data.push(c);
  }
  return data;
}

export function getWeekLabels() {
  const labels = [], dn = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  for (let i = 6; i >= 0; i--) labels.push(dn[new Date(Date.now() - i * 86400000).getDay()]);
  return labels;
}

export function getCategoryData(habits) {
  const c = {};
  habits.filter(h => !h.archived).forEach(h => { c[h.category || 'General'] = (c[h.category || 'General'] || 0) + 1; });
  return c;
}

export function getMonthlyData(habits, days = 30) {
  const data = [], labels = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = getDateStr(new Date(Date.now() - i * 86400000));
    labels.push(date.slice(5));
    let c = 0;
    habits.filter(h => !h.archived).forEach(h => { if (h.history?.[date]?.count >= (h.goal || 1)) c++; });
    data.push(c);
  }
  return { labels, data };
}

export function getHeatmapData(habits, weeks = 16) {
  const total = weeks * 7, data = [];
  for (let i = total - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000), date = getDateStr(d);
    let c = 0;
    habits.filter(h => !h.archived).forEach(h => { if (h.history?.[date]?.count > 0) c++; });
    data.push({ date, count: c, day: d.getDay() });
  }
  return data;
}

export function getCategories(habits) { return [...new Set(habits.map(h => h.category).filter(Boolean))]; }

// --- Mood Tracking ---
export function getMoods() { try { return JSON.parse(localStorage.getItem(MOOD_KEY)) || {}; } catch { return {}; } }
export function saveMood(date, mood) {
  const moods = getMoods();
  moods[date] = { mood, timestamp: new Date().toISOString() };
  localStorage.setItem(MOOD_KEY, JSON.stringify(moods));
}
export function getTodayMood() { return getMoods()[getTodayStr()]?.mood || null; }
export function getMoodData(days = 30) {
  const moods = getMoods(), data = [], labels = [];
  const moodValues = { amazing: 5, good: 4, okay: 3, bad: 2, awful: 1 };
  for (let i = days - 1; i >= 0; i--) {
    const date = getDateStr(new Date(Date.now() - i * 86400000));
    labels.push(date.slice(5));
    data.push(moods[date] ? moodValues[moods[date].mood] || 3 : null);
  }
  return { labels, data };
}

// --- Journal ---
export function getJournalEntries() { try { return JSON.parse(localStorage.getItem(JOURNAL_KEY)) || []; } catch { return []; } }
export function saveJournalEntry(entry) {
  const entries = getJournalEntries();
  entry.id = Date.now().toString(36);
  entries.unshift(entry);
  localStorage.setItem(JOURNAL_KEY, JSON.stringify(entries));
  return entry;
}
export function deleteJournalEntry(id) {
  const entries = getJournalEntries().filter(e => e.id !== id);
  localStorage.setItem(JOURNAL_KEY, JSON.stringify(entries));
}

// --- Streak Freeze ---
export function getStreakFreezes() {
  const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
  return s.streakFreezes ?? 2;
}
export function useStreakFreeze() {
  const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
  if ((s.streakFreezes ?? 2) <= 0) return false;
  s.streakFreezes = (s.streakFreezes ?? 2) - 1;
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  return true;
}

// --- Templates ---
export const HABIT_TEMPLATES = [
  { category: 'Health', emoji: '💧', name: 'Drink 8 glasses of water', color: '#0984e3', difficulty: 'Easy', goal: 8 },
  { category: 'Health', emoji: '🍎', name: 'Eat fruits & vegetables', color: '#00b894', difficulty: 'Easy', goal: 1 },
  { category: 'Health', emoji: '💊', name: 'Take vitamins', color: '#00cec9', difficulty: 'Easy', goal: 1 },
  { category: 'Health', emoji: '😴', name: 'Sleep 8 hours', color: '#6c5ce7', difficulty: 'Medium', goal: 1 },
  { category: 'Fitness', emoji: '🏃', name: 'Run 30 minutes', color: '#e17055', difficulty: 'Medium', goal: 1 },
  { category: 'Fitness', emoji: '🏋️', name: 'Gym workout', color: '#d63031', difficulty: 'Hard', goal: 1 },
  { category: 'Fitness', emoji: '🧘', name: 'Yoga or stretching', color: '#00cec9', difficulty: 'Easy', goal: 1 },
  { category: 'Fitness', emoji: '🚶', name: 'Walk 10,000 steps', color: '#00b894', difficulty: 'Medium', goal: 1 },
  { category: 'Mindfulness', emoji: '🧘', name: 'Meditate 10 min', color: '#a29bfe', difficulty: 'Easy', goal: 1 },
  { category: 'Mindfulness', emoji: '📝', name: 'Write in journal', color: '#fdcb6e', difficulty: 'Easy', goal: 1 },
  { category: 'Mindfulness', emoji: '🙏', name: 'Practice gratitude', color: '#fd79a8', difficulty: 'Easy', goal: 1 },
  { category: 'Learning', emoji: '📚', name: 'Read 30 minutes', color: '#0984e3', difficulty: 'Medium', goal: 1 },
  { category: 'Learning', emoji: '💻', name: 'Code for 1 hour', color: '#6c5ce7', difficulty: 'Hard', goal: 1 },
  { category: 'Learning', emoji: '🌍', name: 'Learn new language', color: '#e84393', difficulty: 'Medium', goal: 1 },
  { category: 'Productivity', emoji: '✅', name: 'Complete top 3 tasks', color: '#00b894', difficulty: 'Medium', goal: 3 },
  { category: 'Productivity', emoji: '📵', name: 'No social media 1hr', color: '#d63031', difficulty: 'Hard', goal: 1 },
  { category: 'Productivity', emoji: '🧹', name: 'Clean workspace', color: '#fdcb6e', difficulty: 'Easy', goal: 1 },
  { category: 'Finance', emoji: '💰', name: 'Track expenses', color: '#00b894', difficulty: 'Easy', goal: 1 },
  { category: 'Finance', emoji: '🏦', name: 'Save money', color: '#0984e3', difficulty: 'Medium', goal: 1 },
  { category: 'Creative', emoji: '🎨', name: 'Draw or paint', color: '#e84393', difficulty: 'Medium', goal: 1 },
  { category: 'Creative', emoji: '🎵', name: 'Practice instrument', color: '#6c5ce7', difficulty: 'Medium', goal: 1 },
  { category: 'Creative', emoji: '✍️', name: 'Write 500 words', color: '#fdcb6e', difficulty: 'Medium', goal: 1 },
];

export function getTemplateCategories() { return [...new Set(HABIT_TEMPLATES.map(t => t.category))]; }

// --- Export / Import ---
export function exportData() {
  const data = {
    habits: getHabits(), xp: getXPData(), moods: getMoods(),
    journal: getJournalEntries(), achievements: getUnlockedAchievements(),
    settings: JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'),
    exportedAt: new Date().toISOString()
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `habit-tracker-backup-${getTodayStr()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importData(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const d = JSON.parse(e.target.result);
        if (d.habits) saveHabits(d.habits);
        if (d.xp) saveXP(d.xp);
        if (d.moods) localStorage.setItem(MOOD_KEY, JSON.stringify(d.moods));
        if (d.journal) localStorage.setItem(JOURNAL_KEY, JSON.stringify(d.journal));
        if (d.achievements) localStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify(d.achievements));
        if (d.settings) localStorage.setItem(SETTINGS_KEY, JSON.stringify(d.settings));
        resolve(d);
      } catch { reject(new Error('Invalid file')); }
    };
    reader.readAsText(file);
  });
}

export function clearAllData() {
  [STORAGE_KEY, XP_KEY, MOOD_KEY, JOURNAL_KEY, SETTINGS_KEY, ACHIEVEMENTS_KEY, 'habitpro_onboarded'].forEach(k => localStorage.removeItem(k));
}

// --- Achievements ---
export const ACHIEVEMENTS = [
  { id: 'first-habit', icon: '🌟', title: 'First Steps', desc: 'Created your first habit', xp: 25, check: h => h.length >= 1 },
  { id: 'three-habits', icon: '🎯', title: 'Triple Tracker', desc: 'Track 3 habits', xp: 50, check: h => h.length >= 3 },
  { id: 'five-habits', icon: '🔥', title: 'Habit Machine', desc: 'Track 5 habits', xp: 75, check: h => h.length >= 5 },
  { id: 'first-checkin', icon: '✅', title: 'Day One', desc: 'Complete first check-in', xp: 10, check: h => h.some(x => x.totalCompletions > 0) },
  { id: '7-streak', icon: '📅', title: 'One Week!', desc: '7-day streak', xp: 100, check: h => h.some(x => (x.streak || 0) >= 7) },
  { id: '14-streak', icon: '💪', title: 'Two Weeks Strong', desc: '14-day streak', xp: 150, check: h => h.some(x => (x.streak || 0) >= 14) },
  { id: '30-streak', icon: '🏅', title: 'Monthly Master', desc: '30-day streak', xp: 250, check: h => h.some(x => (x.streak || 0) >= 30) },
  { id: '100-comp', icon: '💯', title: 'Century Club', desc: '100 total completions', xp: 200, check: h => h.reduce((s, x) => s + (x.totalCompletions || 0), 0) >= 100 },
  { id: '5-cats', icon: '🌈', title: 'Diverse Tracker', desc: 'Habits in 5+ categories', xp: 100, check: h => new Set(h.map(x => x.category)).size >= 5 },
  { id: 'hard-habit', icon: '⚡', title: 'Challenger', desc: 'Complete a Hard habit', xp: 50, check: h => h.some(x => x.difficulty === 'Hard' && (x.totalCompletions || 0) > 0) },
  {
    id: 'perfect-day', icon: '🎉', title: 'Perfect Day', desc: 'Complete all today', xp: 75, check: h => {
      const today = new Date().toISOString().split('T')[0];
      const active = h.filter(x => !x.archived);
      return active.length > 0 && active.every(x => x.history?.[today]?.count >= (x.goal || 1));
    }
  },
  { id: 'level-5', icon: '👑', title: 'Rising Star', desc: 'Reach Level 5', xp: 100, check: (h, xp) => getLevel(xp) >= 5 },
  { id: 'level-10', icon: '🏆', title: 'Habit Champion', desc: 'Reach Level 10', xp: 200, check: (h, xp) => getLevel(xp) >= 10 },
  { id: 'journaler', icon: '📝', title: 'Journaler', desc: 'Write 7 journal entries', xp: 50, check: () => getJournalEntries().length >= 7 },
  { id: 'mood-tracker', icon: '😊', title: 'Mood Aware', desc: 'Log mood 7 days', xp: 50, check: () => Object.keys(getMoods()).length >= 7 },
];

export function checkAchievements(habits) {
  const xp = getXPData().totalXP;
  const unlocked = getUnlockedAchievements();
  const newlyUnlocked = [];
  ACHIEVEMENTS.forEach(a => {
    if (!unlocked.includes(a.id) && a.check(habits, xp)) { unlocked.push(a.id); newlyUnlocked.push(a); addXP(a.xp); }
  });
  localStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify(unlocked));
  return { unlocked, newlyUnlocked };
}

export function getUnlockedAchievements() { try { return JSON.parse(localStorage.getItem(ACHIEVEMENTS_KEY)) || []; } catch { return []; } }

// --- Quotes ---
export const QUOTES = [
  { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
  { text: "We are what we repeatedly do. Excellence is not an act, but a habit.", author: "Aristotle" },
  { text: "Small daily improvements are the key to staggering long-term results.", author: "Unknown" },
  { text: "Success is the sum of small efforts repeated day in and day out.", author: "Robert Collier" },
  { text: "Motivation is what gets you started. Habit is what keeps you going.", author: "Jim Ryun" },
  { text: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
  { text: "Don't watch the clock; do what it does. Keep going.", author: "Sam Levenson" },
  { text: "It does not matter how slowly you go as long as you do not stop.", author: "Confucius" },
  { text: "A journey of a thousand miles begins with a single step.", author: "Lao Tzu" },
  { text: "The best time to start was yesterday. The next best time is now.", author: "Unknown" },
  { text: "Your future is created by what you do today, not tomorrow.", author: "Robert Kiyosaki" },
  { text: "Champions keep playing until they get it right.", author: "Billie Jean King" },
  { text: "You don't have to be extreme, just consistent.", author: "Unknown" },
  { text: "Progress, not perfection.", author: "Unknown" },
  { text: "Discipline is choosing between what you want now and what you want most.", author: "Abraham Lincoln" },
];

export function getDailyQuote() {
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
  return QUOTES[dayOfYear % QUOTES.length];
}

// --- Habit Detail Data ---
export function getHabitCalendar(habit, year, month) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = getTodayStr();
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push({ type: 'empty' });
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const done = habit.history?.[dateStr]?.count >= (habit.goal || 1);
    const isToday = dateStr === today;
    cells.push({ day: d, done, isToday, date: dateStr });
  }
  return cells;
}

// --- Weekly Review ---
export function getWeeklyReview(habits) {
  const active = habits.filter(h => !h.archived);
  let completed = 0, total = 0, bestStreak = 0;
  for (let i = 0; i < 7; i++) {
    const date = getDateStr(new Date(Date.now() - i * 86400000));
    active.forEach(h => {
      total++;
      if (h.history?.[date]?.count >= (h.goal || 1)) completed++;
    });
  }
  active.forEach(h => { bestStreak = Math.max(bestStreak, h.streak || 0); });
  const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
  const startDate = new Date(Date.now() - 6 * 86400000);
  const endDate = new Date();
  return {
    totalHabits: active.length, completedCheckins: completed, totalCheckins: total,
    completionRate: rate, bestStreak,
    range: `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
  };
}
