// network-analysis/js/scoring.js
class ScoreSystem {
    constructor(moduleName) {
        this.moduleName = moduleName;
        this.baseScore = 100;
        this.currentScore = 0;
        this.attempts = 0;
        this.hintsUsed = 0;
        this.timeElapsed = 0;
        
        // Load best from local storage
        this.bestScore = parseInt(localStorage.getItem(`pgl_${moduleName}_best`)) || 0;
    }

    reset() {
        this.attempts = 0;
        this.hintsUsed = 0;
        this.timeElapsed = 0;
        this.currentScore = 0;
    }

    recordAttempt(isCorrect, errorPercentage, isTimeout = false) {
        this.attempts++;
        if (isCorrect) {
            this.currentScore = this.baseScore;
            
            // Bonuses
            if (this.attempts === 1) this.currentScore += 20;
            if (this.hintsUsed === 0) this.currentScore += 30;
            if (this.timeElapsed < 15) this.currentScore += 20; // Fast
            if (errorPercentage < 1.0) this.currentScore += 20; // High precision

            // Penalties
            this.currentScore -= (this.attempts - 1) * 10;
            
            // Hint penalties
            if (this.hintsUsed >= 1) this.currentScore -= 5;
            if (this.hintsUsed >= 2) this.currentScore -= 10;
            if (this.hintsUsed >= 3) this.currentScore -= 20;
            
            this.currentScore = Math.max(10, this.currentScore); // Floor at 10

            // Update best
            if (this.currentScore > this.bestScore) {
                this.bestScore = this.currentScore;
                localStorage.setItem(`pgl_${this.moduleName}_best`, this.bestScore);
            }
            
            // Save to cloud database if available
            if (window.saveGameScore) {
                window.saveGameScore(this.moduleName, this.currentScore, {
                    attempts: this.attempts,
                    hintsUsed: this.hintsUsed,
                    timeElapsed: this.timeElapsed,
                    errorPercentage: errorPercentage
                });
            }
        }
    }
}
window.ScoreSystem = ScoreSystem;
