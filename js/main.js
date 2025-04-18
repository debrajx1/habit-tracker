import { scheduleReminder } from './remainder.js';
import {
  addHabit,
  loadHabits,
  exportHabits,
  importHabits,
  deleteHabit,
  calculateCompletionRate,
  calculateWeeklyConsistency,
  calculateLongestStreak
} from './tracker.js';

const addHabitBtn = document.getElementById('add-habit');
const themeToggle = document.getElementById('theme-toggle');
const exportBtn = document.getElementById('export-data');
const importInput = document.getElementById('import-data');
const habitsList = document.getElementById('habits-list');

// Add new habit
addHabitBtn.addEventListener('click', () => {
  const name = document.getElementById('habit-name').value.trim();
  const category = document.getElementById('habit-category').value.trim();
  const difficulty = document.getElementById('habit-difficulty').value;
  const reminder = document.getElementById('habit-reminder').value;
  const mute = document.getElementById('habit-mute').checked;

  if (name === '') return alert('Please enter a habit name.');

  const habit = {
    name,
    category,
    difficulty,
    reminder,
    mute,
    createdAt: new Date().toISOString(),
    history: []
  };

  addHabit(habit);

  if (!mute && reminder) {
    scheduleReminder(habit);
  }

  renderCharts();
});

// Delete habit
habitsList.addEventListener('click', (e) => {
  if (e.target.classList.contains('delete-btn')) {
    const index = e.target.dataset.index;
    deleteHabit(index);
    renderCharts();
  }
});

// Theme toggle
themeToggle.addEventListener('click', () => {
  document.body.classList.toggle('dark');
});

// Export and import
exportBtn.addEventListener('click', exportHabits);
importInput.addEventListener('change', (e) => {
  importHabits(e);
  setTimeout(renderCharts, 200); // slight delay to allow habits to load
});

// Chart rendering
function renderCharts() {
  const canvasIds = ['progress-chart','completion-rate-chart', 'weekly-consistency-chart', 'longest-streak-chart'];
  canvasIds.forEach(id => {
    const old = document.getElementById(id);
    const newCanvas = old.cloneNode(true);
    old.parentNode.replaceChild(newCanvas, old);
  });

  const stored = localStorage.getItem('habits');
  if (!stored) return;
  const habits = JSON.parse(stored);

  const completionRate = calculateCompletionRate(habits);
  const weeklyData = calculateWeeklyConsistency(habits);
  const longestStreak = Math.max(...habits.map(calculateLongestStreak));

  new Chart(document.getElementById('progress-chart'), {
    type: 'line',
    data: {
      labels: ['6d ago', '5d ago', '4d ago', '3d ago', '2d ago', 'Yesterday', 'Today'],
      datasets: [{
        label: 'Overall Progress',
        data: habits.map(h => h.history.length), // or a better metric if available
        fill: false,
        borderColor: '#673ab7',
        tension: 0.1
      }]
    },
    options: {
      plugins: {
        title: {
          display: true,
          text: 'Overall Progress'
        }
      }
    }
  });


  new Chart(document.getElementById('completion-rate-chart'), {
    type: 'doughnut',
    data: {
      labels: ['Completed', 'Missed'],
      datasets: [{
        data: [completionRate, 100 - completionRate],
        backgroundColor: ['#4caf50', '#f44336']
      }]
    },
    options: {
      plugins: {
        title: {
          display: true,
          text: 'Completion Rate (%)'
        }
      }
    }
  });

  new Chart(document.getElementById('weekly-consistency-chart'), {
    type: 'bar',
    data: {
      labels: ['6d ago', '5d ago', '4d ago', '3d ago', '2d ago', 'Yesterday', 'Today'],
      datasets: [{
        label: 'Habits Completed',
        data: weeklyData,
        backgroundColor: '#2196f3'
      }]
    },
    options: {
      plugins: {
        title: {
          display: true,
          text: 'Weekly Consistency'
        }
      }
    }
  });

  new Chart(document.getElementById('longest-streak-chart'), {
    type: 'bar',
    data: {
      labels: ['Longest Streak'],
      datasets: [{
        label: 'Days',
        data: [longestStreak],
        backgroundColor: '#ff9800'
      }]
    },
    options: {
      plugins: {
        title: {
          display: true,
          text: 'Longest Streak'
        }
      }
    }
  });
}

// Initial load
window.addEventListener('DOMContentLoaded', () => {
  loadHabits();
  renderCharts();
});
