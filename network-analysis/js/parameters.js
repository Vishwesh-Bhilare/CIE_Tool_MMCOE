// network-analysis/js/parameters.js

const canvas = document.getElementById('circuitCanvas');
const ctx = canvas.getContext('2d');

const sZ1 = document.getElementById('slider-z1');
const sZ2 = document.getElementById('slider-z2');
const sZ3 = document.getElementById('slider-z3');

const vZ1 = document.getElementById('val-z1');
const vZ2 = document.getElementById('val-z2');
const vZ3 = document.getElementById('val-z3');

const btnSubmit = document.getElementById('btn-submit');
const btnHint = document.getElementById('btn-hint');
const feedbackPanel = document.getElementById('feedback-panel');

let targetZ1 = 0, targetZ2 = 0, targetZ3 = 0;
let currentZ1 = 100, currentZ2 = 100, currentZ3 = 100;
let currentLevel = 1;

const scoreSys = new ScoreSystem('parameters');
let hintSys = new HintSystem([
    "Remember the Z-parameters for a T-network: Z11 = Z1 + Z3, Z22 = Z2 + Z3.",
    "Look at Z12 and Z21. For a T-network, Z12 = Z21 = Z3! This gives you Z3 immediately.",
    "Once you have Z3, use Z11 to find Z1 (Z1 = Z11 - Z3)."
]);
const engine = new GameEngine(120, () => handleTimeout());

function initCanvas() {
    canvas.width = canvas.parentElement.offsetWidth;
    canvas.height = canvas.parentElement.offsetHeight;
}

function randomizeTarget() {
    targetZ1 = Math.floor(Math.random() * 49 + 1) * 10;
    targetZ2 = Math.floor(Math.random() * 49 + 1) * 10;
    targetZ3 = Math.floor(Math.random() * 49 + 1) * 10;
    
    document.getElementById('tgt-11').textContent = targetZ1 + targetZ3;
    document.getElementById('tgt-12').textContent = targetZ3;
    document.getElementById('tgt-21').textContent = targetZ3;
    document.getElementById('tgt-22').textContent = targetZ2 + targetZ3;
}

function updateValues() {
    currentZ1 = parseInt(sZ1.value);
    currentZ2 = parseInt(sZ2.value);
    currentZ3 = parseInt(sZ3.value);

    vZ1.textContent = `${currentZ1} Ω`;
    vZ2.textContent = `${currentZ2} Ω`;
    vZ3.textContent = `${currentZ3} Ω`;

    let c11 = currentZ1 + currentZ3;
    let c12 = currentZ3;
    let c22 = currentZ2 + currentZ3;

    document.getElementById('cur-11').textContent = c11;
    document.getElementById('cur-12').textContent = c12;
    document.getElementById('cur-21').textContent = c12;
    document.getElementById('cur-22').textContent = c22;

    // Highlight matrix colors
    let okColor = "var(--accent)";
    let badColor = "var(--accent-red)";
    
    document.getElementById('cur-11').style.color = (c11 === targetZ1 + targetZ3) ? okColor : badColor;
    document.getElementById('cur-12').style.color = (c12 === targetZ3) ? okColor : badColor;
    document.getElementById('cur-21').style.color = (c12 === targetZ3) ? okColor : badColor;
    document.getElementById('cur-22').style.color = (c22 === targetZ2 + targetZ3) ? okColor : badColor;

    drawCircuit();
}

function drawCircuit() {
    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    ctx.strokeStyle = 'var(--text)';
    ctx.lineWidth = 3;

    // Draw T-Network
    let bx = W/2, by = H/2 - 20;

    // Z1
    ctx.beginPath(); ctx.moveTo(bx - 120, by); ctx.lineTo(bx - 40, by); ctx.stroke();
    ctx.fillStyle = (currentZ1 === targetZ1) ? 'var(--accent)' : 'var(--surface2)';
    ctx.fillRect(bx - 80, by - 15, 40, 30); ctx.strokeRect(bx - 80, by - 15, 40, 30);
    ctx.fillStyle = '#fff'; ctx.font = '12px Space Mono'; ctx.textAlign='center';
    ctx.fillText("Z1", bx - 60, by + 4);

    // Z2
    ctx.beginPath(); ctx.moveTo(bx + 40, by); ctx.lineTo(bx + 120, by); ctx.stroke();
    ctx.fillStyle = (currentZ2 === targetZ2) ? 'var(--accent)' : 'var(--surface2)';
    ctx.fillRect(bx + 40, by - 15, 40, 30); ctx.strokeRect(bx + 40, by - 15, 40, 30);
    ctx.fillStyle = '#fff'; ctx.fillText("Z2", bx + 60, by + 4);

    // Center connection
    ctx.beginPath(); ctx.moveTo(bx - 40, by); ctx.lineTo(bx + 40, by); ctx.stroke();

    // Z3
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx, by + 80); ctx.stroke();
    ctx.fillStyle = (currentZ3 === targetZ3) ? 'var(--accent)' : 'var(--surface2)';
    ctx.fillRect(bx - 15, by + 20, 30, 40); ctx.strokeRect(bx - 15, by + 20, 30, 40);
    ctx.fillStyle = '#fff'; ctx.fillText("Z3", bx, by + 44);

    // Ground
    ctx.beginPath(); ctx.moveTo(bx - 120, by + 80); ctx.lineTo(bx + 120, by + 80); ctx.stroke();
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
    let t11 = targetZ1 + targetZ3;
    let t22 = targetZ2 + targetZ3;
    let t12 = targetZ3;

    let c11 = currentZ1 + currentZ3;
    let c22 = currentZ2 + currentZ3;
    let c12 = currentZ3;

    let error = Math.abs(t11 - c11) + Math.abs(t22 - c22) + Math.abs(t12 - c12);
    
    if (error === 0) {
        engine.stopTimer();
        scoreSys.recordAttempt(true, 0);
        document.getElementById('hud-score').textContent = scoreSys.currentScore;
        
        let html = `
            <div class="stat"><span>Z1:</span> <span>${currentZ1} Ω</span></div>
            <div class="stat"><span>Z2:</span> <span>${currentZ2} Ω</span></div>
            <div class="stat"><span>Z3:</span> <span>${currentZ3} Ω</span></div>
            <div class="stat"><span>Score Earned:</span> <span>+${scoreSys.currentScore} XP</span></div>
            <button class="btn btn-primary" onclick="startLevel(${currentLevel + 1})" style="margin-top:15px; width:100%;">NEXT LEVEL</button>
        `;
        showFeedback('feedback-panel', "✓ MATRIX SYNTHESIZED", html, "success");
        btnSubmit.disabled = true;
        btnHint.disabled = true;
    } else {
        scoreSys.recordAttempt(false, 10);
        let html = `
            <p style="margin-top:10px;">The matrices do not match exactly. Look at the red values in YOUR MATRIX.</p>
        `;
        showFeedback('feedback-panel', "❌ MATRIX MISMATCH", html, "error");
    }
});

function startLevel(level) {
    currentLevel = level;
    document.getElementById('hud-level').textContent = level;
    btnSubmit.disabled = false;
    btnHint.disabled = false;
    feedbackPanel.className = 'feedback-panel'; 
    
    randomizeTarget();
    
    scoreSys.reset();
    hintSys.reset();
    engine.resetTimer(120);
    engine.startTimer();

    updateValues();
}

sZ1.addEventListener('input', updateValues);
sZ2.addEventListener('input', updateValues);
sZ3.addEventListener('input', updateValues);
window.addEventListener('resize', () => { initCanvas(); drawCircuit(); });

initCanvas();
startLevel(1);
