/* ========================================
   Habit Tracker Pro — Reminder Module
   Browser Notification API
   ======================================== */

const reminders = {};

export async function requestNotificationPermission() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

export function scheduleReminder(habit) {
  if (!habit.reminder || Notification.permission !== 'granted') return;
  if (reminders[habit.id]) clearTimeout(reminders[habit.id]);
  const [hours, minutes] = habit.reminder.split(':').map(Number);
  const now = new Date();
  const target = new Date();
  target.setHours(hours, minutes, 0, 0);
  if (target <= now) target.setDate(target.getDate() + 1);
  const delay = target - now;
  reminders[habit.id] = setTimeout(() => {
    new Notification(`${habit.emoji || '🎯'} ${habit.name}`, {
      body: `Time to check in! Don't break your ${habit.streak || 0} day streak! 🔥`,
      icon: 'icons/icon-192.png',
      badge: 'icons/icon-192.png',
      tag: `habit-${habit.id}`,
      requireInteraction: true
    });
    scheduleReminder(habit); // Reschedule for next day
  }, delay);
}

export function scheduleAllReminders() {
  try {
    const habits = JSON.parse(localStorage.getItem('habitpro_habits') || '[]');
    habits.filter(h => h.reminder && !h.archived).forEach(scheduleReminder);
  } catch (e) { console.error('Reminder scheduling failed:', e); }
}

export function cancelReminder(habitId) {
  if (reminders[habitId]) { clearTimeout(reminders[habitId]); delete reminders[habitId]; }
}