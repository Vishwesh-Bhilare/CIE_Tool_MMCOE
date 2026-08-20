// network-analysis/js/filters.js

const canvas = document.getElementById('bodeCanvas');
const ctx = canvas.getContext('2d');

const sR = document.getElementById('slider-R');
const sC = document.getElementById('slider-C');
const lR = document.getElementById('lbl-R');
const lC = document.getElementById('lbl-C');
const vR = document.getElementById('val-R');
const vC = document.getElementById('val-C');
const vFc = document.getElementById('val-fc');

const btnSubmit = document.getElementById('btn-submit');
const btnHint = document.getElementById('btn-hint');
const feedbackPanel = document.getElementById('feedback-panel');

let targetFc = 1000;
let currentFc = 1591.5;

// Initialize Systems
const scoreSys = new ScoreSystem('filters');
let hintSys = new HintSystem([
    "Think about the relationship: Cutoff frequency is inversely proportional to both Resistance and Capacitance.",
    "If you want to lower the cutoff frequency, you need to INCREASE either R or C.",
    "Formula: fc = 1 / (2 * π * R * C). Adjust your sliders to hit the target."
]);
const engine = new GameEngine(60, () => handleTimeout());

function initCanvas() {
    canvas.width = canvas.parentElement.offsetWidth;
    canvas.height = canvas.parentElement.offsetHeight;
}

function updateValues() {
    let R = parseFloat(sR.value); // ohms
    let C_uF = parseFloat(sC.value); // uF
    let C = C_uF * 1e-6; // Farads

    lR.textContent = R;
    lC.textContent = C_uF;
    vR.textContent = `${R} Ω`;
    vC.textContent = `${C_uF} µF`;

    currentFc = 1 / (2 * Math.PI * R * C);
    vFc.textContent = currentFc.toFixed(1);

    drawBodePlot();
}

function drawBodePlot() {
    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    // Draw Grid
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for(let i = 1; i <= 4; i++) {
        let x = i * (W/4);
        ctx.moveTo(x, 0); ctx.lineTo(x, H);
        let y = i * (H/4);
        ctx.moveTo(0, y); ctx.lineTo(W, y);
    }
    ctx.stroke();

    // Axes
    ctx.strokeStyle = 'rgba(0, 255, 136, 0.3)';
    ctx.beginPath();
    ctx.moveTo(0, H - 30); ctx.lineTo(W, H - 30); // X axis
    ctx.moveTo(40, 0); ctx.lineTo(40, H); // Y axis
    ctx.stroke();

    ctx.fillStyle = 'var(--muted)';
    ctx.font = '10px Space Mono';
    ctx.fillText("Frequency (Hz) →", W - 100, H - 10);
    ctx.fillText("Gain (dB)", 5, 15);

    // Draw Target Line
    let targetX = mapFreqToX(targetFc, W);
    ctx.strokeStyle = 'rgba(255,204,0,0.4)';
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(targetX, 0); ctx.lineTo(targetX, H - 30);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(255,204,0,0.8)';
    ctx.fillText("TARGET", targetX + 5, 30);

    // Draw Actual Response
    ctx.strokeStyle = 'var(--accent)';
    ctx.lineWidth = 3;
    ctx.shadowColor = 'rgba(0, 255, 136, 0.5)';
    ctx.shadowBlur = 10;
    ctx.beginPath();

    for(let x = 40; x < W; x++) {
        let f = mapXToFreq(x, W);
        // Gain calculation: |H(j\omega)| = 1 / sqrt(1 + (f/fc)^2)
        let gain = 1 / Math.sqrt(1 + Math.pow(f / currentFc, 2));
        let gainDb = 20 * Math.log10(gain);
        
        let y = mapGainToY(gainDb, H);
        if (x === 40) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Draw Cutoff Point marker
    let fcX = mapFreqToX(currentFc, W);
    let fcY = mapGainToY(-3, H); // Cutoff is at -3dB
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(fcX, fcY, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'var(--accent)';
    ctx.fillText("-3dB", fcX + 8, fcY - 8);
}

// Log scale mapping
function mapFreqToX(f, W) {
    let minF = 10;
    let maxF = 100000;
    let logMin = Math.log10(minF);
    let logMax = Math.log10(maxF);
    let logF = Math.log10(f);
    return 40 + ((logF - logMin) / (logMax - logMin)) * (W - 40);
}
function mapXToFreq(x, W) {
    let minF = 10;
    let maxF = 100000;
    let logMin = Math.log10(minF);
    let logMax = Math.log10(maxF);
    let p = (x - 40) / (W - 40);
    return Math.pow(10, logMin + p * (logMax - logMin));
}
function mapGainToY(gainDb, H) {
    // map 5dB to -45dB
    let minG = -45;
    let maxG = 5;
    let p = (gainDb - minG) / (maxG - minG);
    return (H - 30) - p * (H - 30);
}

function handleTimeout() {
    scoreSys.recordAttempt(false, 100, true);
    showFeedback('feedback-panel', "⏱ TIME'S UP", `
        <div class="stat"><span>Target:</span> <span>${targetFc} Hz</span></div>
        <div class="stat"><span>Your Result:</span> <span>${currentFc.toFixed(1)} Hz</span></div>
        <p style="margin-top:10px; color:var(--accent-red);">You ran out of time! Resetting challenge.</p>
    `, "error");
    btnSubmit.disabled = true;
    setTimeout(() => startLevel(1), 3000);
}

btnHint.addEventListener('click', () => {
    let hint = hintSys.getNextHint();
    scoreSys.hintsUsed++;
    showFeedback('feedback-panel', "💡 HINT", `<p>${hint}</p>`, "warning");
});

btnSubmit.addEventListener('click', () => {
    let result = diagnoseError(targetFc, currentFc);
    
    if (result.state === 'success') {
        engine.stopTimer();
        scoreSys.recordAttempt(true, result.magnitude);
        document.getElementById('hud-score').textContent = scoreSys.currentScore;
        
        let html = `
            <div class="stat"><span>Target:</span> <span>${targetFc} Hz</span></div>
            <div class="stat"><span>Actual:</span> <span>${currentFc.toFixed(1)} Hz</span></div>
            <div class="stat"><span>Accuracy:</span> <span>${(100 - result.magnitude).toFixed(2)}%</span></div>
            <div class="stat"><span>Score Earned:</span> <span>+${scoreSys.currentScore} XP</span></div>
            <button class="btn btn-primary" onclick="startLevel(2)" style="margin-top:15px; width:100%;">NEXT LEVEL</button>
        `;
        showFeedback('feedback-panel', "✓ MISSION COMPLETE", html, "success");
        btnSubmit.disabled = true;
        btnHint.disabled = true;
    } else {
        scoreSys.recordAttempt(false, result.magnitude);
        let html = `
            <div class="stat"><span>Target:</span> <span>${targetFc} Hz</span></div>
            <div class="stat"><span>Actual:</span> <span>${currentFc.toFixed(1)} Hz</span></div>
            <div class="stat"><span>Error:</span> <span>${result.errorPercent > 0 ? '+' : ''}${result.errorPercent.toFixed(1)}%</span></div>
            <p style="margin-top:10px;">${result.diagnosis}</p>
        `;
        showFeedback('feedback-panel', result.state === 'warning' ? "⚠ ALMOST THERE" : "❌ DESIGN ERROR", html, result.state);
    }
});

function startLevel(level) {
    document.getElementById('hud-level').textContent = level;
    btnSubmit.disabled = false;
    btnHint.disabled = false;
    feedbackPanel.className = 'feedback-panel'; // hide
    
    if (level === 1) targetFc = 1000;
    if (level === 2) targetFc = 5000;
    if (level === 3) targetFc = 150;
    
    document.getElementById('mission-text').innerHTML = `Design a low-pass filter with a cutoff frequency of <strong>${targetFc} Hz</strong>.`;
    
    scoreSys.reset();
    hintSys.reset();
    engine.resetTimer(60);
    engine.startTimer();
    updateValues();
}

// Event Listeners
sR.addEventListener('input', updateValues);
sC.addEventListener('input', updateValues);
window.addEventListener('resize', () => { initCanvas(); drawBodePlot(); });

// Boot
initCanvas();
startLevel(1);
