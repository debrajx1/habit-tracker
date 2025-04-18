export function scheduleReminder(habit) {
    const timeParts = habit.reminder.split(':');
    const now = new Date();
    const reminderTime = new Date(now);
    reminderTime.setHours(+timeParts[0]);
    reminderTime.setMinutes(+timeParts[1]);
    reminderTime.setSeconds(0);
  
    const timeDiff = reminderTime.getTime() - now.getTime();
  
    if (timeDiff > 0) {
      setTimeout(() => {
        alert(`Reminder: It's time for your habit - ${habit.name}`);
      }, timeDiff);
    }
  }
  