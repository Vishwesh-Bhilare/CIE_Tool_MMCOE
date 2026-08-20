// network-analysis/js/symmetrical.js

const canvas = document.getElementById('balanceCanvas');
const ctx = canvas.getContext('2d');

const sZ1 = document.getElementById('slider-z1');
const sZ2 = document.getElementById('slider-z2');
const sZ3 = document.getElementById('slider-z3');

const lZ1 = document.getElementById('lbl-z1');
const lZ2 = document.getElementById('lbl-z2');
const lZ3 = document.getElementById('lbl-z3');
const vZ1 = document.getElementById('val-z1');
const vZ2 = document.getElementById('val-z2');
const vZ3 = document.getElementById('val-z3');

const pZ1 = document.getElementById('path-z1');
const pZ2 = document.getElementById('path-z2');

const btnSubmit = document.getElementById('btn-submit');
const btnHint = document.getElementById('btn-hint');
const feedbackPanel = document.getElementById('feedback-panel');

let targetZ0 = 500;
let currentZ1 = 100, currentZ2 = 200, currentZ3 = 100;

const scoreSys = new ScoreSystem('symmetrical');
let hintSys = new HintSystem([
    "Rule 1: A T-network is symmetrical only if the series arms are equal (Z1 = Z2).",
    "Rule 2: Characteristic impedance Z0 = sqrt(Z1^2 + 2*Z1*Z3).",
    "Try making Z1 = Z2 first. Then adjust all values proportionally to hit the target Z0."
]);
const engine = new GameEngine(120, () => handleTimeout());

function initCanvas() {
    canvas.width = canvas.parentElement.offsetWidth;
    canvas.height = canvas.parentElement.offsetHeight;
}

function updateValues() {
    currentZ1 = parseFloat(sZ1.value);
    currentZ2 = parseFloat(sZ2.value);
    currentZ3 = parseFloat(sZ3.value);

    lZ1.textContent = currentZ1;
    lZ2.textContent = currentZ2;
    lZ3.textContent = currentZ3;
    vZ1.textContent = `${currentZ1} Ω`;
    vZ2.textContent = `${currentZ2} Ω`;
    vZ3.textContent = `${currentZ3} Ω`;

    // Highlight symmetry on SVG
    if (currentZ1 !== currentZ2) {
        pZ1.setAttribute('stroke', 'rgba(255, 51, 102, 0.8)');
        pZ2.setAttribute('stroke', 'rgba(255, 51, 102, 0.8)');
    } else {
        pZ1.setAttribute('stroke', 'rgba(0, 255, 136, 0.8)');
        pZ2.setAttribute('stroke', 'rgba(0, 255, 136, 0.8)');
    }

    drawBalance();
}

function drawBalance() {
    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    // Draw a visual balance scale
    let cx = W / 2;
    let cy = H - 50;

    // Base
    ctx.fillStyle = 'var(--muted)';
    ctx.beginPath();
    ctx.moveTo(cx - 20, cy + 30);
    ctx.lineTo(cx + 20, cy + 30);
    ctx.lineTo(cx, cy - 20);
    ctx.fill();

    // Beam tilt based on Z1 vs Z2
    let diff = currentZ2 - currentZ1;
    // max diff is 990. scale angle.
    let angle = (diff / 1000) * (Math.PI / 4);

    ctx.save();
    ctx.translate(cx, cy - 20);
    ctx.rotate(angle);

    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-100, 0);
    ctx.lineTo(100, 0);
    ctx.stroke();

    // Pans
    ctx.fillStyle = 'rgba(0, 255, 136, 0.2)';
    ctx.fillRect(-120, 0, 40, 40);
    ctx.fillRect(80, 0, 40, 40);
    
    ctx.fillStyle = '#fff';
    ctx.font = '12px Space Mono';
    ctx.textAlign = 'center';
    ctx.fillText("Z1", -100, 25);
    ctx.fillText("Z2", 100, 25);

    ctx.restore();

    // Display Z0 calculation
    let currentZ0 = 0;
    let isSym = (currentZ1 === currentZ2);
    
    ctx.font = '24px Orbitron';
    ctx.textAlign = 'center';
    if (isSym) {
        currentZ0 = Math.sqrt(currentZ1 * currentZ1 + 2 * currentZ1 * currentZ3);
        ctx.fillStyle = 'var(--accent)';
        ctx.fillText(`Current Z₀ = ${currentZ0.toFixed(1)} Ω`, W / 2, 60);
    } else {
        ctx.fillStyle = 'var(--accent-red)';
        ctx.fillText(`NETWORK ASYMMETRICAL`, W / 2, 60);
    }
    
    ctx.font = '14px Space Mono';
    ctx.fillStyle = 'var(--accent-yellow)';
    ctx.fillText(`TARGET Z₀ = ${targetZ0} Ω`, W / 2, 90);
}

function handleTimeout() {
    scoreSys.recordAttempt(false, 100, true);
    showFeedback('feedback-panel', "⏱ TIME'S UP", `
        <p style="color:var(--accent-red);">Time expired! Resetting challenge.</p>
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
    if (currentZ1 !== currentZ2) {
        scoreSys.recordAttempt(false, 100);
        showFeedback('feedback-panel', "❌ ASYMMETRY ERROR", `
            <p>Z1 and Z2 are not equal. A symmetrical T-network requires identical series arms.</p>
        `, "error");
        return;
    }

    let currentZ0 = Math.sqrt(currentZ1 * currentZ1 + 2 * currentZ1 * currentZ3);
    let result = diagnoseError(targetZ0, currentZ0);
    
    if (result.state === 'success') {
        engine.stopTimer();
        scoreSys.recordAttempt(true, result.magnitude);
        document.getElementById('hud-score').textContent = scoreSys.currentScore;
        
        let html = `
            <div class="stat"><span>Target Z₀:</span> <span>${targetZ0} Ω</span></div>
            <div class="stat"><span>Actual Z₀:</span> <span>${currentZ0.toFixed(1)} Ω</span></div>
            <div class="stat"><span>Accuracy:</span> <span>${(100 - result.magnitude).toFixed(2)}%</span></div>
            <div class="stat"><span>Score Earned:</span> <span>+${scoreSys.currentScore} XP</span></div>
            <button class="btn btn-primary" onclick="startLevel(2)" style="margin-top:15px; width:100%;">NEXT LEVEL</button>
        `;
        showFeedback('feedback-panel', "✓ SYMMETRICAL NETWORK ACHIEVED", html, "success");
        btnSubmit.disabled = true;
        btnHint.disabled = true;
    } else {
        scoreSys.recordAttempt(false, result.magnitude);
        let html = `
            <div class="stat"><span>Target Z₀:</span> <span>${targetZ0} Ω</span></div>
            <div class="stat"><span>Actual Z₀:</span> <span>${currentZ0.toFixed(1)} Ω</span></div>
            <div class="stat"><span>Error:</span> <span>${result.errorPercent > 0 ? '+' : ''}${result.errorPercent.toFixed(1)}%</span></div>
            <p style="margin-top:10px;">Network is symmetrical, but Z₀ is incorrect. ${result.diagnosis}</p>
        `;
        showFeedback('feedback-panel', result.state === 'warning' ? "⚠ ALMOST THERE" : "❌ DESIGN ERROR", html, result.state);
    }
});

function startLevel(level) {
    document.getElementById('hud-level').textContent = level;
    btnSubmit.disabled = false;
    btnHint.disabled = false;
    feedbackPanel.className = 'feedback-panel'; 
    
    if (level === 1) targetZ0 = 500;
    if (level === 2) targetZ0 = 300;
    if (level === 3) targetZ0 = 600;
    
    document.getElementById('mission-text').innerHTML = `Make the network <strong>symmetrical</strong> and achieve a characteristic impedance (Z₀) of <strong>${targetZ0} Ω</strong>.`;
    
    scoreSys.reset();
    hintSys.reset();
    engine.resetTimer(120);
    engine.startTimer();
    updateValues();
}

sZ1.addEventListener('input', updateValues);
sZ2.addEventListener('input', updateValues);
sZ3.addEventListener('input', updateValues);
window.addEventListener('resize', () => { initCanvas(); drawBalance(); });

initCanvas();
startLevel(1);
