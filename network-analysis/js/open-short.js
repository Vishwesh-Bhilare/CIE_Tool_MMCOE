// network-analysis/js/open-short.js

const canvas = document.getElementById('circuitCanvas');
const ctx = canvas.getContext('2d');

const btnToggle = document.getElementById('btn-toggle');
const inputAnswer = document.getElementById('input-answer');
const btnSubmit = document.getElementById('btn-submit');
const btnHint = document.getElementById('btn-hint');
const feedbackPanel = document.getElementById('feedback-panel');

let isShortCircuit = false;
let z1 = 100, z2 = 100, z3 = 100; // Hidden internal parameters
let targetAnswer = 0;
let currentLevel = 1;

const scoreSys = new ScoreSystem('open_short');
let hintSys = new HintSystem([
    "Z11 is the Open-Circuit Input Impedance: Z11 = V1 / I1.",
    "Make sure the switch is set to OPEN CIRCUIT to measure Z11.",
    "Z12 is the Open-Circuit Transfer Impedance: Z12 = V2 / I1.",
    "Z11(SC) or input impedance with output shorted is V1 / I1 when SHORT CIRCUIT."
]);
const engine = new GameEngine(120, () => handleTimeout());

function initCanvas() {
    canvas.width = canvas.parentElement.offsetWidth;
    canvas.height = canvas.parentElement.offsetHeight;
}

function randomizeNetwork() {
    // Generate random hidden Z values (10 to 500 ohms, multiples of 10)
    z1 = Math.floor(Math.random() * 50 + 1) * 10;
    z2 = Math.floor(Math.random() * 50 + 1) * 10;
    z3 = Math.floor(Math.random() * 50 + 1) * 10;
}

function calculateReadings() {
    let V1 = 100; // Fixed 100V source
    let I1, V2, I2;

    if (!isShortCircuit) { // OPEN CIRCUIT
        I1 = V1 / (z1 + z3);
        V2 = I1 * z3;
        I2 = 0;
    } else { // SHORT CIRCUIT
        let zParallel = (z2 * z3) / (z2 + z3);
        I1 = V1 / (z1 + zParallel);
        V2 = 0;
        I2 = I1 * (z3 / (z2 + z3)); 
    }
    return { V1, I1, V2, I2 };
}

function drawCircuit() {
    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    let vals = calculateReadings();

    ctx.strokeStyle = 'var(--accent)';
    ctx.lineWidth = 3;

    // Draw generic black box
    let bx = W/2 - 80, by = H/2 - 50;
    ctx.fillStyle = 'rgba(0, 255, 136, 0.05)';
    ctx.fillRect(bx, by, 160, 100);
    ctx.strokeRect(bx, by, 160, 100);
    ctx.fillStyle = 'var(--accent)';
    ctx.font = '16px Orbitron';
    ctx.textAlign = 'center';
    ctx.fillText("UNKNOWN", W/2, H/2 - 10);
    ctx.fillText("T-NETWORK", W/2, H/2 + 15);

    // Port 1 Lines
    ctx.beginPath();
    ctx.moveTo(bx - 100, by + 20); ctx.lineTo(bx, by + 20); // Top
    ctx.moveTo(bx - 100, by + 80); ctx.lineTo(bx, by + 80); // Bottom
    ctx.stroke();

    // Port 2 Lines
    ctx.beginPath();
    ctx.moveTo(bx + 160, by + 20); ctx.lineTo(bx + 260, by + 20); // Top
    ctx.moveTo(bx + 160, by + 80); ctx.lineTo(bx + 260, by + 80); // Bottom
    ctx.stroke();

    // Port 1 Source
    ctx.fillStyle = 'rgba(0, 255, 136, 0.2)';
    ctx.beginPath();
    ctx.arc(bx - 100, by + 50, 30, 0, Math.PI*2);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = '14px Space Mono';
    ctx.fillText("V1 = 100V", bx - 100, by + 55);

    // Meters for Port 1
    ctx.fillStyle = 'var(--text)';
    ctx.fillText(`I1 = ${vals.I1.toFixed(3)} A`, bx - 50, by + 10);

    // Port 2
    if (isShortCircuit) {
        ctx.strokeStyle = '#ff3366';
        ctx.beginPath();
        ctx.moveTo(bx + 260, by + 20);
        ctx.lineTo(bx + 260, by + 80);
        ctx.stroke();
        ctx.fillStyle = '#ff3366';
        ctx.fillText(`I2 = ${vals.I2.toFixed(3)} A`, bx + 210, by + 10);
        ctx.fillText(`V2 = 0 V (SHORT)`, bx + 210, by + 100);
    } else {
        ctx.fillStyle = 'var(--accent)';
        ctx.fillText(`I2 = 0 A (OPEN)`, bx + 210, by + 10);
        ctx.fillText(`V2 = ${vals.V2.toFixed(1)} V`, bx + 210, by + 100);
    }
}

btnToggle.addEventListener('click', () => {
    isShortCircuit = !isShortCircuit;
    btnToggle.textContent = isShortCircuit ? "CURRENT: SHORT CIRCUIT" : "CURRENT: OPEN CIRCUIT";
    btnToggle.style.backgroundColor = isShortCircuit ? "rgba(255,51,102,0.2)" : "rgba(0,255,136,0.2)";
    btnToggle.style.color = isShortCircuit ? "#ff3366" : "#00ff88";
    drawCircuit();
});

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
    let ans = parseFloat(inputAnswer.value);
    if (isNaN(ans)) return;

    let result = diagnoseError(targetAnswer, ans);
    
    if (result.state === 'success') {
        engine.stopTimer();
        scoreSys.recordAttempt(true, result.magnitude);
        document.getElementById('hud-score').textContent = scoreSys.currentScore;
        
        let html = `
            <div class="stat"><span>Target Parameter:</span> <span>${targetAnswer.toFixed(1)} Ω</span></div>
            <div class="stat"><span>Your Calculation:</span> <span>${ans.toFixed(1)} Ω</span></div>
            <div class="stat"><span>Score Earned:</span> <span>+${scoreSys.currentScore} XP</span></div>
            <button class="btn btn-primary" onclick="startLevel(${currentLevel + 1})" style="margin-top:15px; width:100%;">NEXT LEVEL</button>
        `;
        showFeedback('feedback-panel', "✓ CALCULATION CORRECT", html, "success");
        btnSubmit.disabled = true;
        btnHint.disabled = true;
    } else {
        scoreSys.recordAttempt(false, result.magnitude);
        let html = `
            <div class="stat"><span>Error:</span> <span>${result.errorPercent > 0 ? '+' : ''}${result.errorPercent.toFixed(1)}%</span></div>
            <p style="margin-top:10px;">Calculation incorrect. Did you configure the circuit properly? ${result.diagnosis}</p>
        `;
        showFeedback('feedback-panel', result.state === 'warning' ? "⚠ CHECK MATH" : "❌ CALCULATION ERROR", html, result.state);
    }
});

function startLevel(level) {
    currentLevel = level;
    document.getElementById('hud-level').textContent = level;
    btnSubmit.disabled = false;
    btnHint.disabled = false;
    inputAnswer.value = "";
    feedbackPanel.className = 'feedback-panel'; 
    
    randomizeNetwork();

    if (level === 1) {
        targetAnswer = z1 + z3; // Z11
        document.getElementById('mission-text').innerHTML = `Configure for <strong>Open Circuit</strong> test and calculate <strong>Z₁₁</strong>.`;
    } else if (level === 2) {
        targetAnswer = z3; // Z12
        document.getElementById('mission-text').innerHTML = `Calculate the Open-Circuit Transfer Impedance <strong>Z₁₂</strong>.`;
    } else {
        let zP = (z2 * z3) / (z2 + z3);
        targetAnswer = z1 + zP; // Short circuit input impedance
        document.getElementById('mission-text').innerHTML = `Configure for <strong>Short Circuit</strong> and calculate Input Impedance <strong>Z_in(sc)</strong>.`;
    }
    
    scoreSys.reset();
    hintSys.reset();
    engine.resetTimer(120);
    engine.startTimer();
    
    isShortCircuit = false;
    btnToggle.textContent = "CURRENT: OPEN CIRCUIT";
    btnToggle.style.backgroundColor = "rgba(0,255,136,0.2)";
    btnToggle.style.color = "#00ff88";

    drawCircuit();
}

window.addEventListener('resize', () => { initCanvas(); drawCircuit(); });

initCanvas();
startLevel(1);
