/* ========================================
   Habit Tracker Pro — Analytics Module
   ======================================== */

import {
    getWeeklyData, getWeekLabels, getCategoryData,
    getMonthlyData, getCompletionRate, getHeatmapData, getMoodData
} from './tracker.js';

const chartInstances = {};
function getOrCreateChart(canvasId, config) {
    if (chartInstances[canvasId]) chartInstances[canvasId].destroy();
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx) return null;
    const dark = document.body.classList.contains('dark');
    const textColor = dark ? '#9a9ab0' : '#636e72';
    const gridColor = dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
    const defaults = {
        responsive: true, maintainAspectRatio: true,
        plugins: { legend: { labels: { color: textColor, font: { family: "'Inter',sans-serif", size: 11 } } } },
        scales: config.type !== 'pie' && config.type !== 'doughnut' ? {
            x: { ticks: { color: textColor, font: { size: 10 } }, grid: { color: gridColor } },
            y: { ticks: { color: textColor, font: { size: 10 } }, grid: { color: gridColor } }
        } : undefined
    };
    config.options = { ...defaults, ...config.options };
    if (config.options.scales && !config.options.scales.x) delete config.options.scales;
    chartInstances[canvasId] = new Chart(ctx, config);
    return chartInstances[canvasId];
}

export function renderWeeklyChart(habits) {
    const data = getWeeklyData(habits);
    const labels = getWeekLabels();
    getOrCreateChart('weekly-chart', {
        type: 'bar', data: {
            labels, datasets: [{ label: 'Completed', data, backgroundColor: 'rgba(108,92,231,0.7)', borderRadius: 6, borderSkipped: false }]
        }, options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }
    });
}

export function renderCompletionChart(habits, days = 30) {
    const rate = getCompletionRate(habits, days);
    getOrCreateChart('completion-chart', {
        type: 'doughnut', data: {
            labels: ['Completed', 'Remaining'],
            datasets: [{ data: [rate, 100 - rate], backgroundColor: ['#00b894', 'rgba(150,150,150,0.15)'], borderWidth: 0, cutout: '72%' }]
        }, options: {
            plugins: {
                legend: { position: 'bottom' },
                tooltip: { callbacks: { label: c => c.label + ': ' + c.raw + '%' } }
            }
        }
    });
    // Center text
    const canvas = document.getElementById('completion-chart');
    if (canvas) {
        const chart = chartInstances['completion-chart'];
        const centerText = {
            id: 'centerText', afterDraw(c) {
                const { ctx, width, height } = c;
                ctx.save();
                ctx.font = 'bold 1.5rem Inter, sans-serif';
                ctx.fillStyle = document.body.classList.contains('dark') ? '#eaeaea' : '#2d3436';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(rate + '%', width / 2, height / 2 - 6);
                ctx.font = '0.65rem Inter, sans-serif';
                ctx.fillStyle = '#636e72';
                ctx.fillText(`Last ${days}d`, width / 2, height / 2 + 14);
                ctx.restore();
            }
        };
        if (chart) { chart.config.plugins = [centerText]; chart.update(); }
    }
}

export function renderCategoryChart(habits) {
    const data = getCategoryData(habits);
    const colors = ['#6c5ce7', '#00b894', '#e17055', '#0984e3', '#fdcb6e', '#e84393', '#00cec9', '#fd79a8'];
    getOrCreateChart('category-chart', {
        type: 'pie', data: {
            labels: Object.keys(data), datasets: [{ data: Object.values(data), backgroundColor: colors.slice(0, Object.keys(data).length), borderWidth: 0 }]
        }, options: { plugins: { legend: { position: 'bottom' } } }
    });
}

export function renderStreakChart(habits) {
    const active = habits.filter(h => !h.archived && (h.streak || 0) > 0);
    const labels = active.map(h => h.emoji + ' ' + h.name);
    const current = active.map(h => h.streak || 0);
    const longest = active.map(h => h.longestStreak || 0);
    getOrCreateChart('streak-chart', {
        type: 'bar', data: {
            labels, datasets: [
                { label: 'Current', data: current, backgroundColor: 'rgba(0,184,148,0.7)', borderRadius: 4 },
                { label: 'Longest', data: longest, backgroundColor: 'rgba(253,203,110,0.7)', borderRadius: 4 }
            ]
        }, options: { indexAxis: 'y', scales: { x: { beginAtZero: true, ticks: { stepSize: 1 } } } }
    });
}

export function renderMonthlyChart(habits, days = 30) {
    const { labels, data } = getMonthlyData(habits, days);
    getOrCreateChart('monthly-chart', {
        type: 'line', data: {
            labels, datasets: [{
                label: 'Completions', data, borderColor: '#6c5ce7', backgroundColor: 'rgba(108,92,231,0.1)',
                fill: true, tension: 0.4, pointRadius: 2, pointHoverRadius: 5, borderWidth: 2
            }]
        }, options: { scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } }, x: { ticks: { maxTicksLimit: 10 } } } }
    });
}

export function renderMoodChart(days = 30) {
    const { labels, data } = getMoodData(days);
    const filtered = data.map((v, i) => v !== null ? v : NaN);
    const moodLabels = { 1: 'Awful', 2: 'Bad', 3: 'Okay', 4: 'Good', 5: 'Amazing' };
    getOrCreateChart('mood-chart', {
        type: 'line', data: {
            labels, datasets: [{
                label: 'Mood', data: filtered, borderColor: '#e84393', backgroundColor: 'rgba(232,67,147,0.08)',
                fill: true, tension: 0.4, pointRadius: 3, pointHoverRadius: 6, borderWidth: 2, spanGaps: true,
                pointBackgroundColor: filtered.map(v => {
                    if (v >= 4) return '#00b894';
                    if (v === 3) return '#fdcb6e';
                    return '#d63031';
                })
            }]
        }, options: {
            scales: {
                y: { min: 0.5, max: 5.5, ticks: { stepSize: 1, callback: v => moodLabels[v] || '' } },
                x: { ticks: { maxTicksLimit: 10 } }
            },
            plugins: { legend: { display: false } }
        }
    });
}
