// network-analysis/js/twin-t.js

const canvas = document.getElementById('bodeCanvas');
const ctx = canvas.getContext('2d');

const sR = document.getElementById('slider-R');
const sC = document.getElementById('slider-C');
const vR = document.getElementById('val-R');
const vC = document.getElementById('val-C');
const vFn = document.getElementById('val-fn');

const btnSubmit = document.getElementById('btn-submit');
const btnHint = document.getElementById('btn-hint');
const feedbackPanel = document.getElementById('feedback-panel');

let targetFn = 1000;
let currentFn = 1591.5;

const scoreSys = new ScoreSystem('twin_t');
let hintSys = new HintSystem([
    "The notch frequency for a balanced Twin-T network is fn = 1 / (2 * π * R * C).",
    "If your notch is too high on the graph, you need to INCREASE Resistance or Capacitance.",
    "Calculate carefully. For 1000 Hz, what R and C combinations work? Try R ≈ 1600 Ω and C ≈ 0.1 µF."
]);
const engine = new GameEngine(90, () => handleTimeout());

function initCanvas() {
    canvas.width = canvas.parentElement.offsetWidth;
    canvas.height = canvas.parentElement.offsetHeight;
}

function updateValues() {
    let R = parseFloat(sR.value); // ohms
    let C_uF = parseFloat(sC.value); // uF
    let C = C_uF * 1e-6; // Farads

    vR.textContent = `${R} Ω`;
    vC.textContent = `${C_uF} µF`;

    currentFn = 1 / (2 * Math.PI * R * C);
    vFn.textContent = currentFn.toFixed(1);

    drawBodePlot();
}

function drawBodePlot() {
    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    // Grid
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for(let i = 1; i <= 4; i++) {
        let x = i * (W/4); ctx.moveTo(x, 0); ctx.lineTo(x, H);
        let y = i * (H/4); ctx.moveTo(0, y); ctx.lineTo(W, y);
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

    // Target Line
    let targetX = mapFreqToX(targetFn, W);
    ctx.strokeStyle = 'rgba(255,204,0,0.4)';
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(targetX, 0); ctx.lineTo(targetX, H - 30);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(255,204,0,0.8)';
    ctx.fillText("TARGET", targetX + 5, 30);

    // Actual Plot
    ctx.strokeStyle = 'var(--accent)';
    ctx.lineWidth = 3;
    ctx.shadowColor = 'rgba(0, 255, 136, 0.5)';
    ctx.shadowBlur = 10;
    ctx.beginPath();

    let points = [];
    for(let x = 40; x < W; x++) {
        let f = mapXToFreq(x, W);
        let fn2 = currentFn * currentFn;
        let f2 = f * f;
        
        // H(jw) = |fn^2 - f^2| / sqrt((fn^2 - f^2)^2 + (4*f*fn)^2)
        let num = Math.abs(fn2 - f2);
        let den = Math.sqrt(Math.pow(fn2 - f2, 2) + Math.pow(4 * f * currentFn, 2));
        let gain = num / den;
        
        let gainDb = 20 * Math.log10(gain + 1e-6); // prevent log(0)
        gainDb = Math.max(-60, gainDb); // cap floor at -60dB
        
        let y = mapGainToY(gainDb, H);
        if (x === 40) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Actual Notch Marker
    let notchX = mapFreqToX(currentFn, W);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(notchX, H-30, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'var(--accent)';
    ctx.fillText(currentFn.toFixed(0) + "Hz", notchX + 8, H - 40);
}

function mapFreqToX(f, W) {
    let minF = 10, maxF = 100000;
    let logMin = Math.log10(minF), logMax = Math.log10(maxF);
    return 40 + ((Math.log10(f) - logMin) / (logMax - logMin)) * (W - 40);
}
function mapXToFreq(x, W) {
    let minF = 10, maxF = 100000;
    let logMin = Math.log10(minF), logMax = Math.log10(maxF);
    return Math.pow(10, logMin + ((x - 40) / (W - 40)) * (logMax - logMin));
}
function mapGainToY(gainDb, H) {
    let minG = -60, maxG = 5;
    let p = (gainDb - minG) / (maxG - minG);
    return (H - 30) - p * (H - 30);
}

function handleTimeout() {
    scoreSys.recordAttempt(false, 100, true);
    showFeedback('feedback-panel', "⏱ TIME'S UP", `
        <div class="stat"><span>Target:</span> <span>${targetFn} Hz</span></div>
        <div class="stat"><span>Your Result:</span> <span>${currentFn.toFixed(1)} Hz</span></div>
        <p style="margin-top:10px; color:var(--accent-red);">Time expired!</p>
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
    let result = diagnoseError(targetFn, currentFn);
    
    if (result.state === 'success') {
        engine.stopTimer();
        scoreSys.recordAttempt(true, result.magnitude);
        document.getElementById('hud-score').textContent = scoreSys.currentScore;
        
        let html = `
            <div class="stat"><span>Target:</span> <span>${targetFn} Hz</span></div>
            <div class="stat"><span>Actual:</span> <span>${currentFn.toFixed(1)} Hz</span></div>
            <div class="stat"><span>Accuracy:</span> <span>${(100 - result.magnitude).toFixed(2)}%</span></div>
            <div class="stat"><span>Score Earned:</span> <span>+${scoreSys.currentScore} XP</span></div>
            <button class="btn btn-primary" onclick="startLevel(2)" style="margin-top:15px; width:100%;">NEXT LEVEL</button>
        `;
        showFeedback('feedback-panel', "✓ NOTCH ACHIEVED", html, "success");
        btnSubmit.disabled = true;
        btnHint.disabled = true;
    } else {
        scoreSys.recordAttempt(false, result.magnitude);
        let html = `
            <div class="stat"><span>Target:</span> <span>${targetFn} Hz</span></div>
            <div class="stat"><span>Actual:</span> <span>${currentFn.toFixed(1)} Hz</span></div>
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
    feedbackPanel.className = 'feedback-panel'; 
    
    if (level === 1) targetFn = 1000;
    if (level === 2) targetFn = 60; // Common powerline notch
    if (level === 3) targetFn = 25000;
    
    document.getElementById('mission-text').innerHTML = `Design a notch filter to reject exactly <strong>${targetFn} Hz</strong> interference.`;
    
    scoreSys.reset();
    hintSys.reset();
    engine.resetTimer(90);
    engine.startTimer();
    updateValues();
}

sR.addEventListener('input', updateValues);
sC.addEventListener('input', updateValues);
window.addEventListener('resize', () => { initCanvas(); drawBodePlot(); });

initCanvas();
startLevel(1);
