let habits = [];

export function addHabit(habit) {
  habits.push(habit);
  localStorage.setItem('habits', JSON.stringify(habits));
  renderHabits();
}

export function loadHabits() {
  const stored = localStorage.getItem('habits');
  if (stored) {
    habits = JSON.parse(stored);
    renderHabits();
  }
}

export function renderHabits() {
  const list = document.getElementById('habits-list');
  list.innerHTML = '';

  habits.forEach((habit, index) => {
    updateHabitStreak(habit);
    const card = document.createElement('div');
    card.className = 'habit';
    card.innerHTML = `
      <h3>${habit.name}</h3>
      <p>Category: ${habit.category}</p>
      <p>Difficulty: ${habit.difficulty}</p>
      <p>Reminder: ${habit.reminder || 'None'}</p>
      <p class="streak">🔥 ${habit.streak || 0} day streak</p>
      <button class="delete-btn" data-index="${index}">Delete</button>
    `;
    list.appendChild(card);
  });

  localStorage.setItem('habits', JSON.stringify(habits));

  // Update achievements section
  updateAchievements(habits);
}

export function deleteHabit(index) {
  habits.splice(index, 1);
  localStorage.setItem('habits', JSON.stringify(habits));
  renderHabits();
}

export function exportHabits() {
  const blob = new Blob([JSON.stringify(habits, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'habits.json';
  a.click();
  URL.revokeObjectURL(url);
}

export function importHabits(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = e => {
    try {
      habits = JSON.parse(e.target.result);
      localStorage.setItem('habits', JSON.stringify(habits));
      renderHabits();
    } catch (err) {
      alert('Invalid file format');
    }
  };
  reader.readAsText(file);
}

export function updateHabitStreak(habit) {
  const today = new Date().toISOString().split('T')[0];

  if (!habit.history) habit.history = [];

  if (!habit.history.includes(today)) {
    habit.history.push(today);
    habit.streak = calculateStreak(habit.history);
  }

  return habit;
}

function calculateStreak(dates) {
  const sorted = dates.map(d => new Date(d)).sort((a, b) => b - a);
  let streak = 0;
  let current = new Date();

  for (let date of sorted) {
    if (date.toDateString() === current.toDateString()) {
      streak++;
    } else if (
      date.toDateString() === new Date(current.setDate(current.getDate() - 1)).toDateString()
    ) {
      streak++;
    } else {
      break;
    }
    current = new Date(date);
  }

  return streak;
}

// --- Analytics Functions ---

export function calculateCompletionRate(habits) {
  const total = habits.length;
  const today = new Date().toISOString().split('T')[0];
  const completed = habits.filter(h => h.history?.includes(today)).length;
  return total ? (completed / total) * 100 : 0;
}

export function calculateWeeklyConsistency(habits) {
  const week = Array(7).fill(0);
  const now = new Date();

  habits.forEach(habit => {
    habit.history?.forEach(date => {
      const d = new Date(date);
      const diff = Math.floor((now - d) / (1000 * 60 * 60 * 24));
      if (diff < 7) {
        week[6 - diff]++;
      }
    });
  });

  return week;
}

export function calculateLongestStreak(habit) {
  if (!habit.history) return 0;
  const sorted = habit.history.map(d => new Date(d)).sort((a, b) => a - b);

  let maxStreak = 1;
  let currentStreak = 1;

  for (let i = 1; i < sorted.length; i++) {
    const diff = (sorted[i] - sorted[i - 1]) / (1000 * 60 * 60 * 24);
    if (diff === 1) {
      currentStreak++;
    } else {
      maxStreak = Math.max(maxStreak, currentStreak);
      currentStreak = 1;
    }
  }

  return Math.max(maxStreak, currentStreak);
}

// --- Achievement Badges ---

const milestoneConditions = [
  {
    id: 'first-habit',
    title: 'First Habit',
    description: 'Created your first habit',
    check: (habits) => habits.length >= 1,
  },
  {
    id: '7-day-streak',
    title: '7-Day Streak',
    description: 'Maintain a 7-day streak on any habit',
    check: (habits) => habits.some(h => h.streak >= 7),
  },
  {
    id: '30-day-streak',
    title: '30-Day Streak',
    description: 'Maintain a 30-day streak on any habit',
    check: (habits) => habits.some(h => h.streak >= 30),
  },
  {
    id: '3-habits',
    title: 'Triple Tracker',
    description: 'Track at least 3 different habits',
    check: (habits) => habits.length >= 3,
  },
  {
    id: 'perfect-week',
    title: 'Perfect Week',
    description: 'Completed a habit every day for 7 days',
    check: (habits) => habits.some(h => calculateStreak(h.history || []) >= 7),
  },
  {
    id: 'habit-master',
    title: 'Habit Master',
    description: 'Track habits from at least 5 different categories',
    check: (habits) => {
      const categories = new Set(habits.map(h => h.category));
      return categories.size >= 5;
    },
  },
];

function updateAchievements(habits) {
  const container = document.getElementById("achievements");
  if (!container) return; // if no achievements section exists

  container.innerHTML = "";

  milestoneConditions.forEach(milestone => {
    const unlocked = milestone.check(habits);
    const div = document.createElement("div");
    div.className = "achievement" + (unlocked ? "" : " locked");

    div.innerHTML = `
      <h3>${milestone.title}</h3>
      <p>${milestone.description}</p>
    `;
    container.appendChild(div);
  });
}
