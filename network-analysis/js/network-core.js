// network-analysis/js/network-core.js

class GameEngine {
    constructor(timeLimitSeconds, onTimeUp) {
        this.timeLimit = timeLimitSeconds;
        this.timeLeft = timeLimitSeconds;
        this.timerInterval = null;
        this.onTimeUp = onTimeUp;
        
        this.hudTimerEl = document.getElementById('hud-timer');
        if (this.hudTimerEl) this.updateTimerDisplay();
    }

    startTimer() {
        if (this.timerInterval) clearInterval(this.timerInterval);
        this.timerInterval = setInterval(() => {
            this.timeLeft--;
            this.updateTimerDisplay();
            
            if (this.timeLeft <= 0) {
                this.stopTimer();
                if (this.onTimeUp) this.onTimeUp();
            }
        }, 1000);
    }

    stopTimer() {
        if (this.timerInterval) clearInterval(this.timerInterval);
    }

    resetTimer(newTime = null) {
        this.stopTimer();
        if (newTime !== null) this.timeLimit = newTime;
        this.timeLeft = this.timeLimit;
        this.updateTimerDisplay();
    }

    updateTimerDisplay() {
        if (!this.hudTimerEl) return;
        let m = Math.floor(this.timeLeft / 60).toString().padStart(2, '0');
        let s = (this.timeLeft % 60).toString().padStart(2, '0');
        this.hudTimerEl.textContent = `${m}:${s}`;
        
        if (this.timeLeft <= 10) {
            this.hudTimerEl.style.color = 'var(--accent-red)';
        } else {
            this.hudTimerEl.style.color = 'var(--accent-yellow)';
        }
    }
}

// UI Helpers
function showFeedback(panelId, title, htmlDetails, stateClass) {
    const p = document.getElementById(panelId);
    if (!p) return;
    p.className = `feedback-panel active ${stateClass}`;
    
    let btnHtml = "";
    if (stateClass === 'success') {
        const gameName = document.title.split('-')[0].trim() || 'Network Analysis';
        btnHtml = `<button onclick="window.promptCalculationUpload('${gameName}', this)" class="btn btn-primary" style="margin-top:15px; width:100%; background:var(--accent); color:#000; border:none; cursor:pointer; font-weight:bold;">📷 UPLOAD CALCULATIONS (PHOTO)</button>`;
    }
    
    p.innerHTML = `<div class="feedback-title">${title}</div><div class="feedback-details">${htmlDetails}${btnHtml}</div>`;
}

window.GameEngine = GameEngine;
window.showFeedback = showFeedback;

// Global step value function for number inputs
window.stepInputValue = function(inputId, direction) {
    const input = document.getElementById(inputId);
    if (input) {
        if (direction > 0) {
            input.stepUp();
        } else {
            input.stepDown();
        }
        // Trigger the input event so standard logic runs
        input.dispatchEvent(new Event('input'));
    }
};

