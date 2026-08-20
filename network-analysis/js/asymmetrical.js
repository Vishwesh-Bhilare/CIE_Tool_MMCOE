// network-analysis/js/asymmetrical.js

const canvas = document.getElementById('balanceCanvas');
const ctx = canvas.getContext('2d');

const sZA = document.getElementById('slider-za');
const sZB = document.getElementById('slider-zb');
const sZC = document.getElementById('slider-zc');

const lZA = document.getElementById('lbl-za');
const lZB = document.getElementById('lbl-zb');
const lZC = document.getElementById('lbl-zc');
const vZA = document.getElementById('val-za');
const vZB = document.getElementById('val-zb');
const vZC = document.getElementById('val-zc');

const pZA = document.getElementById('path-za');
const pZC = document.getElementById('path-zc');

const btnSubmit = document.getElementById('btn-submit');
const btnHint = document.getElementById('btn-hint');
const feedbackPanel = document.getElementById('feedback-panel');

let targetZ0 = 300;
let currentZA = 100, currentZB = 200, currentZC = 300;
let currentLevel = 1;

const scoreSys = new ScoreSystem('asymmetrical');
let hintSys = new HintSystem([
    "A Pi-network is symmetrical when the input shunt and output shunt are equal (Z_A = Z_C).",
    "First, make Z_A = Z_C. Then adjust Z_B to change the overall Z0.",
    "Z0 for a Pi-network is approx sqrt(Z_oc * Z_sc). Play with the sliders once Z_A = Z_C."
]);
const engine = new GameEngine(120, () => handleTimeout());

function initCanvas() {
    canvas.width = canvas.parentElement.offsetWidth;
    canvas.height = canvas.parentElement.offsetHeight;
}

function calcZ0() {
    let zoc = (currentZA * (currentZB + currentZC)) / (currentZA + currentZB + currentZC);
    let zsc = (currentZA * currentZB) / (currentZA + currentZB);
    return Math.sqrt(zoc * zsc);
}

function updateValues() {
    currentZA = parseFloat(sZA.value);
    currentZB = parseFloat(sZB.value);
    currentZC = parseFloat(sZC.value);

    lZA.textContent = currentZA;
    lZB.textContent = currentZB;
    lZC.textContent = currentZC;
    vZA.textContent = `${currentZA} Ω`;
    vZB.textContent = `${currentZB} Ω`;
    vZC.textContent = `${currentZC} Ω`;

    if (currentZA !== currentZC) {
        pZA.setAttribute('stroke', 'rgba(255, 51, 102, 0.8)');
        pZC.setAttribute('stroke', 'rgba(255, 51, 102, 0.8)');
    } else {
        pZA.setAttribute('stroke', 'rgba(0, 255, 136, 0.8)');
        pZC.setAttribute('stroke', 'rgba(0, 255, 136, 0.8)');
    }

    drawBalance();
}

function drawBalance() {
    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    // Pi-Network visual balance indicator
    let cx = W / 2;
    let cy = H / 2 - 20;
    
    // Draw columns for ZA and ZC to visually show asymmetry
    let maxZ = 1000;
    let hA = (currentZA / maxZ) * 80;
    let hC = (currentZC / maxZ) * 80;
    
    ctx.fillStyle = 'rgba(0,255,136,0.2)';
    ctx.fillRect(cx - 100, cy + 40 - hA, 40, hA);
    ctx.fillRect(cx + 60, cy + 40 - hC, 40, hC);
    
    ctx.strokeStyle = 'var(--text)';
    ctx.lineWidth = 2;
    ctx.strokeRect(cx - 100, cy + 40 - hA, 40, hA);
    ctx.strokeRect(cx + 60, cy + 40 - hC, 40, hC);
    
    ctx.fillStyle = '#fff';
    ctx.font = '12px Space Mono';
    ctx.textAlign = 'center';
    ctx.fillText("ZA", cx - 80, cy + 55);
    ctx.fillText("ZC", cx + 80, cy + 55);
    
    // Line connecting them (ZB represents the slope)
    ctx.strokeStyle = (currentZA === currentZC) ? 'var(--accent)' : 'var(--accent-red)';
    ctx.beginPath();
    ctx.moveTo(cx - 80, cy + 40 - hA);
    ctx.lineTo(cx + 80, cy + 40 - hC);
    ctx.stroke();

    let isSym = (currentZA === currentZC);
    
    ctx.font = '20px Orbitron';
    ctx.textAlign = 'center';
    if (isSym) {
        let z0 = calcZ0();
        ctx.fillStyle = 'var(--accent)';
        ctx.fillText(`Current Z₀ = ${z0.toFixed(1)} Ω`, W / 2, H - 40);
    } else {
        ctx.fillStyle = 'var(--accent-red)';
        ctx.fillText(`NETWORK ASYMMETRICAL`, W / 2, H - 40);
    }
    
    ctx.font = '14px Space Mono';
    ctx.fillStyle = 'var(--accent-yellow)';
    ctx.fillText(`TARGET Z₀ = ${targetZ0} Ω`, W / 2, H - 15);
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
    if (currentZA !== currentZC) {
        scoreSys.recordAttempt(false, 100);
        showFeedback('feedback-panel', "❌ ASYMMETRY ERROR", `
            <p>ZA and ZC must be equal for a Pi-network to be symmetrical.</p>
        `, "error");
        return;
    }

    let currentZ0 = calcZ0();
    let result = diagnoseError(targetZ0, currentZ0);
    
    if (result.state === 'success') {
        engine.stopTimer();
        scoreSys.recordAttempt(true, result.magnitude);
        document.getElementById('hud-score').textContent = scoreSys.currentScore;
        
        let html = `
            <div class="stat"><span>Target Z₀:</span> <span>${targetZ0} Ω</span></div>
            <div class="stat"><span>Actual Z₀:</span> <span>${currentZ0.toFixed(1)} Ω</span></div>
            <div class="stat"><span>Score Earned:</span> <span>+${scoreSys.currentScore} XP</span></div>
            <button class="btn btn-primary" onclick="startLevel(${currentLevel + 1})" style="margin-top:15px; width:100%;">NEXT LEVEL</button>
        `;
        showFeedback('feedback-panel', "✓ PI-NETWORK BALANCED", html, "success");
        btnSubmit.disabled = true;
        btnHint.disabled = true;
    } else {
        scoreSys.recordAttempt(false, result.magnitude);
        let html = `
            <div class="stat"><span>Error:</span> <span>${result.errorPercent > 0 ? '+' : ''}${result.errorPercent.toFixed(1)}%</span></div>
            <p style="margin-top:10px;">Network is symmetrical, but Z₀ is wrong. Adjust ZB to change Z₀.</p>
        `;
        showFeedback('feedback-panel', result.state === 'warning' ? "⚠ ALMOST THERE" : "❌ DESIGN ERROR", html, result.state);
    }
});

function startLevel(level) {
    currentLevel = level;
    document.getElementById('hud-level').textContent = level;
    btnSubmit.disabled = false;
    btnHint.disabled = false;
    feedbackPanel.className = 'feedback-panel'; 
    
    if (level === 1) targetZ0 = 300;
    if (level === 2) targetZ0 = 150;
    if (level === 3) targetZ0 = 500;
    
    document.getElementById('mission-text').innerHTML = `Transform the asymmetrical Pi-Network into a <strong>symmetrical</strong> one with Z₀ = <strong>${targetZ0} Ω</strong>.`;
    
    scoreSys.reset();
    hintSys.reset();
    engine.resetTimer(120);
    engine.startTimer();
    updateValues();
}

sZA.addEventListener('input', updateValues);
sZB.addEventListener('input', updateValues);
sZC.addEventListener('input', updateValues);
window.addEventListener('resize', () => { initCanvas(); drawBalance(); });

initCanvas();
startLevel(1);
