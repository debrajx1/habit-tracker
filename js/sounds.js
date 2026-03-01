/* ========================================
   Habit Tracker Pro — Sound Effects Module
   Web Audio API synthesized sounds
   ======================================== */

let audioCtx = null;
function getCtx() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    return audioCtx;
}

function playTone(freq, duration = 0.15, type = 'sine', vol = 0.2, delay = 0) {
    const ctx = getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
    gain.gain.setValueAtTime(vol, ctx.currentTime + delay);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime + delay);
    osc.stop(ctx.currentTime + delay + duration + 0.05);
}

export function playCheckinSound() {
    [523, 659, 784].forEach((f, i) => playTone(f, 0.12, 'sine', 0.15, i * 0.07));
}

export function playAchievementSound() {
    [523, 659, 784, 1047].forEach((f, i) => playTone(f, 0.18, 'triangle', 0.12, i * 0.1));
}

export function playLevelUpSound() {
    [392, 440, 523, 587, 659, 784].forEach((f, i) => playTone(f, 0.15, 'sine', 0.12, i * 0.08));
}

export function playUncheckinSound() {
    [523, 440].forEach((f, i) => playTone(f, 0.15, 'triangle', 0.12, i * 0.1));
}

export function playTimerDoneSound() {
    [784, 659, 784, 1047].forEach((f, i) => playTone(f, 0.25, 'sine', 0.18, i * 0.15));
    setTimeout(() => {
        [784, 659, 784, 1047].forEach((f, i) => playTone(f, 0.25, 'sine', 0.18, i * 0.15));
    }, 800);
}
