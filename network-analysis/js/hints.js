// network-analysis/js/hints.js
class HintSystem {
    constructor(hintsArray) {
        this.hints = hintsArray || []; // Array of strings: [Level 1, Level 2, Level 3]
        this.currentHintIndex = 0;
    }

    reset() {
        this.currentHintIndex = 0;
    }

    getNextHint() {
        if (this.currentHintIndex < this.hints.length) {
            let hint = this.hints[this.currentHintIndex];
            this.currentHintIndex++;
            return hint;
        }
        return "No more hints available! Try reviewing the concept.";
    }

    getHintsUsed() {
        return this.currentHintIndex;
    }
}

// Global utility for error diagnosis
function diagnoseError(target, actual) {
    let errorPercent = ((actual - target) / target) * 100;
    let magnitude = Math.abs(errorPercent);
    
    let diagnosis = "";
    if (errorPercent > 0) {
        diagnosis = "Your result is too HIGH.";
    } else {
        diagnosis = "Your result is too LOW.";
    }

    let state = "error";
    if (magnitude <= 2) {
        state = "success";
        diagnosis = "Perfect! Within engineering tolerance.";
    } else if (magnitude <= 15) {
        state = "warning";
        diagnosis += " But you're very close! Adjust slightly.";
    }

    return {
        errorPercent: errorPercent, // signed
        magnitude: magnitude, // absolute
        diagnosis: diagnosis,
        state: state
    };
}

window.HintSystem = HintSystem;
window.diagnoseError = diagnoseError;
