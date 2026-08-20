// network-analysis/js/composite.js

const canvas = document.getElementById('bodeCanvas');
const ctx = canvas.getContext('2d');

const selStage1 = document.getElementById('stage1');
const selStage2 = document.getElementById('stage2');
const vis1 = document.getElementById('block1-vis');
const vis2 = document.getElementById('block2-vis');

const btnSubmit = document.getElementById('btn-submit');
const btnHint = document.getElementById('btn-hint');
const feedbackPanel = document.getElementById('feedback-panel');

let targetCombo = ["hpf_1k", "lpf_5k"];
let currentLevel = 1;

const scoreSys = new ScoreSystem('composite');
let hintSys = new HintSystem([
    "To pass frequencies between 1 kHz and 5 kHz, you need a Bandpass filter.",
    "A Bandpass filter is created by cascading a High-Pass Filter and a Low-Pass Filter.",
    "Try setting Stage 1 to High-Pass (1 kHz) to block lows, and Stage 2 to Low-Pass (5 kHz) to block highs."
]);
const engine = new GameEngine(150, () => handleTimeout());

function initCanvas() {
    canvas.width = canvas.parentElement.offsetWidth;
    canvas.height = canvas.parentElement.offsetHeight;
}

function getGain(block, f) {
    if (block === 'bypass') return 0; // 0 dB
    if (block === 'att_10') return -10; // -10 dB
    
    let type = block.split('_')[0];
    let fc = block.split('_')[1] === '1k' ? 1000 : 5000;
    
    if (type === 'lpf') {
        let mag = 1 / Math.sqrt(1 + Math.pow(f/fc, 2));
        return 20 * Math.log10(mag);
    }
    if (type === 'hpf') {
        let mag = (f/fc) / Math.sqrt(1 + Math.pow(f/fc, 2));
        return 20 * Math.log10(mag);
    }
    return 0;
}

function updateValues() {
    let b1 = selStage1.value;
    let b2 = selStage2.value;

    vis1.textContent = selStage1.options[selStage1.selectedIndex].text;
    vis2.textContent = selStage2.options[selStage2.selectedIndex].text;

    drawBodePlot(b1, b2);
}

function drawBodePlot(b1, b2) {
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

    // Actual Plot
    ctx.strokeStyle = 'var(--accent)';
    ctx.lineWidth = 3;
    ctx.shadowColor = 'rgba(0, 255, 136, 0.5)';
    ctx.shadowBlur = 10;
    ctx.beginPath();

    for(let x = 40; x < W; x++) {
        let f = mapXToFreq(x, W);
        let g1 = getGain(b1, f);
        let g2 = getGain(b2, f);
        let totalGain = g1 + g2;
        
        totalGain = Math.max(-60, totalGain);
        let y = mapGainToY(totalGain, H);
        
        if (x === 40) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
}

function mapFreqToX(f, W) {
    let minF = 100, maxF = 100000;
    let logMin = Math.log10(minF), logMax = Math.log10(maxF);
    return 40 + ((Math.log10(f) - logMin) / (logMax - logMin)) * (W - 40);
}
function mapXToFreq(x, W) {
    let minF = 100, maxF = 100000;
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
    showFeedback('feedback-panel', "⏱ TIME'S UP", `<p style="color:var(--accent-red);">Time expired!</p>`, "error");
    btnSubmit.disabled = true;
    setTimeout(() => startLevel(currentLevel), 3000);
}

btnHint.addEventListener('click', () => {
    let hint = hintSys.getNextHint();
    scoreSys.hintsUsed++;
    showFeedback('feedback-panel', "💡 HINT", `<p>${hint}</p>`, "warning");
});

btnSubmit.addEventListener('click', () => {
    let b1 = selStage1.value;
    let b2 = selStage2.value;
    
    // Order doesn't matter for linear cascading
    let match = (b1 === targetCombo[0] && b2 === targetCombo[1]) || (b1 === targetCombo[1] && b2 === targetCombo[0]);
    
    if (match) {
        engine.stopTimer();
        scoreSys.recordAttempt(true, 0);
        document.getElementById('hud-score').textContent = scoreSys.currentScore;
        
        let html = `
            <div class="stat"><span>Target Achieved:</span> <span style="color:var(--accent)">YES</span></div>
            <div class="stat"><span>Score Earned:</span> <span>+${scoreSys.currentScore} XP</span></div>
            <button class="btn btn-primary" onclick="startLevel(${currentLevel + 1})" style="margin-top:15px; width:100%;">NEXT LEVEL</button>
        `;
        showFeedback('feedback-panel', "✓ FILTER CASCADED", html, "success");
        btnSubmit.disabled = true;
        btnHint.disabled = true;
    } else {
        scoreSys.recordAttempt(false, 50);
        showFeedback('feedback-panel', "❌ INCORRECT RESPONSE", `
            <p>The combined frequency response does not meet the mission criteria. Look at the Bode plot.</p>
        `, "error");
    }
});

function startLevel(level) {
    currentLevel = level;
    document.getElementById('hud-level').textContent = level;
    btnSubmit.disabled = false;
    btnHint.disabled = false;
    feedbackPanel.className = 'feedback-panel'; 
    
    if (level === 1) {
        targetCombo = ["hpf_1k", "lpf_5k"];
        document.getElementById('mission-text').innerHTML = `Build a <strong>Bandpass Filter</strong> passing exactly <strong>1 kHz to 5 kHz</strong>.`;
        hintSys = new HintSystem([
            "To pass frequencies between 1 kHz and 5 kHz, you need a Bandpass filter.",
            "A Bandpass filter is created by cascading a High-Pass Filter and a Low-Pass Filter."
        ]);
    } else if (level === 2) {
        targetCombo = ["lpf_1k", "att_10"];
        document.getElementById('mission-text').innerHTML = `Build a <strong>Low-Pass Filter (1 kHz)</strong> that also <strong>attenuates the entire signal by 10 dB</strong>.`;
        hintSys = new HintSystem([
            "You need a Low-Pass filter block for the cutoff.",
            "You need an Attenuator block to drop the gain across all frequencies."
        ]);
    } else {
        targetCombo = ["hpf_5k", "hpf_1k"]; // Effectively just 5k HPF but trick question
        document.getElementById('mission-text').innerHTML = `Build an overly steep <strong>High-Pass Filter (5 kHz)</strong> by combining two High-Pass stages.`;
        hintSys = new HintSystem([
            "Cascade two High-Pass filters to make the roll-off twice as steep!"
        ]);
    }
    
    scoreSys.reset();
    engine.resetTimer(150);
    engine.startTimer();
    
    selStage1.value = "bypass";
    selStage2.value = "bypass";
    updateValues();
}

selStage1.addEventListener('change', updateValues);
selStage2.addEventListener('change', updateValues);
window.addEventListener('resize', () => { initCanvas(); updateValues(); });

initCanvas();
startLevel(1);
