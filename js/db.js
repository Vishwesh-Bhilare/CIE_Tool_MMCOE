// js/db.js

const firebaseConfig = {
  apiKey: "AIzaSyArfKVgOBd3kR9NsVNhoMyDN7w-USTopR4",
  authDomain: "physics-game-lab.firebaseapp.com",
  projectId: "physics-game-lab",
  storageBucket: "physics-game-lab.firebasestorage.app",
  messagingSenderId: "304152151581",
  appId: "1:304152151581:web:ec85068fccf55fe5d568f4",
  measurementId: "G-4GTX4C8ZD0"
};

// Initialize Firebase using compat mode so it works cleanly in static HTML
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

window.db = db; // Make global

// Helper to record a student login session
window.registerStudentSession = async function(name, rollId, email) {
    try {
        const docRef = await db.collection("students").add({
            name: name,
            rollId: rollId,
            email: email,
            loginTime: firebase.firestore.FieldValue.serverTimestamp()
        });
        return docRef.id; 
    } catch (e) {
        console.error("Error adding student: ", e);
        return null;
    }
}

// Helper to record a game score
window.saveGameScore = async function(gameName, score, details = {}) {
    const studentDocId = localStorage.getItem('studentDbId');
    if (!studentDocId) {
        console.warn("No active student session in DB. Cannot save score to cloud.");
        return;
    }
    
    try {
        // CHECK IF EXAM IS LOCKED
        const configDoc = await db.collection('config').doc('global').get();
        if (configDoc.exists && configDoc.data().acceptingResponses === false) {
            alert("âš ï¸ The time limit for this exam has ended. Submissions are closed.");
            return;
        }
        
        // Save under the student's subcollection
        await db.collection("students").doc(studentDocId).collection("scores").add({
            game: gameName,
            score: score,
            details: details,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Also save to a flat global leaderboard collection for easy viewing in the Admin Dashboard
        const lbRef = await db.collection("leaderboard").add({
            studentDbId: studentDocId,
            studentName: localStorage.getItem('studentName'),
            studentEmail: localStorage.getItem('studentEmail') || "unknown",
            rollId: localStorage.getItem('studentId'),
            game: gameName,
            score: score,
            details: details,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        window.lastLeaderboardDocId = lbRef.id;
        
        console.log(`Successfully saved ${score} XP to cloud for ${gameName}`);
    } catch (e) {
        console.error("Error saving score to cloud: ", e);
    }
}

// ==========================================
// PHOTO UPLOAD & COMPRESSION SYSTEM
// ==========================================
window.promptCalculationUpload = function(gameName, btnElement) {
    if (!window.lastLeaderboardDocId) {
        alert("Wait for the score to save first before uploading!");
        return;
    }

    // Create an invisible file input
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = function(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        btnElement.textContent = "⏳ COMPRESSING...";
        btnElement.style.background = "#ffaa00";

        const reader = new FileReader();
        reader.onload = function(event) {
            const img = new Image();
            img.onload = function() {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 1000;
                let width = img.width;
                let height = img.height;
                
                if (width > MAX_WIDTH) {
                    height = Math.round((height * MAX_WIDTH) / width);
                    width = MAX_WIDTH;
                }
                canvas.width = width;
                canvas.height = height;
                
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                // Compress to Base64 JPEG
                const compressedData = canvas.toDataURL('image/jpeg', 0.6);
                
                btnElement.textContent = "☁️ UPLOADING...";
                
                // Save to Firestore
                db.collection("leaderboard").doc(window.lastLeaderboardDocId).update({
                    calculationImage: compressedData
                }).then(() => {
                    btnElement.textContent = "✅ UPLOADED!";
                    btnElement.style.background = "var(--success)";
                    btnElement.disabled = true;
                }).catch(err => {
                    console.error(err);
                    btnElement.textContent = "❌ ERROR";
                    btnElement.style.background = "#ff3366";
                });
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    };
    input.click();
};



// ==========================================
// GLOBAL EXAM TIMER UI INJECTION (FOR GAMES)
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname.toLowerCase();
    const isGamePage = !path.includes('admin') && !path.includes('index') && !path.includes('login') && path.length > 1 && !path.endsWith('/');
    
    if (isGamePage) {
        const timerUI = document.createElement('div');
        timerUI.style.position = 'fixed';
        timerUI.style.top = '15px';
        timerUI.style.left = '50%';
        timerUI.style.transform = 'translateX(-50%)';
        timerUI.style.background = 'rgba(10, 20, 36, 0.9)';
        timerUI.style.color = '#fff';
        timerUI.style.padding = '8px 20px';
        timerUI.style.borderRadius = '30px';
        timerUI.style.border = '2px solid #00ff88';
        timerUI.style.fontFamily = "'Space Mono', monospace";
        timerUI.style.fontSize = '1.3rem';
        timerUI.style.fontWeight = 'bold';
        timerUI.style.zIndex = '9999';
        timerUI.style.boxShadow = '0 0 20px rgba(0,255,136,0.4)';
        timerUI.style.display = 'none'; // hidden by default
        timerUI.style.backdropFilter = 'blur(5px)';
        timerUI.innerHTML = 'EXAM TIME: <span id="global-exam-timer">--:--</span>';
        document.body.appendChild(timerUI);

        let studentCountdownInterval;

        db.collection('config').doc('global').onSnapshot(doc => {
            if (doc.exists) {
                const data = doc.data();
                const isAccepting = data.acceptingResponses;
                const endTime = data.examEndTime;
                
                clearInterval(studentCountdownInterval);
                const span = document.getElementById('global-exam-timer');
                if (!span) return;
                
                if (isAccepting && endTime && endTime > Date.now()) {
                    timerUI.style.display = 'block';
                    timerUI.style.border = '2px solid #00ff88';
                    timerUI.style.boxShadow = '0 0 20px rgba(0,255,136,0.4)';
                    
                    studentCountdownInterval = setInterval(() => {
                        const remaining = endTime - Date.now();
                        
                        if (remaining <= 0) {
                            clearInterval(studentCountdownInterval);
                            span.textContent = "ENDED";
                            span.style.color = "#ff3366";
                            timerUI.style.borderColor = "#ff3366";
                            timerUI.style.boxShadow = '0 0 20px rgba(255,51,102,0.5)';
                        } else {
                            const m = Math.floor(remaining / 60000);
                            const s = Math.floor((remaining % 60000) / 1000);
                            span.textContent = m + ":" + s.toString().padStart(2, '0');
                            
                            // Yellow pulse in last 60 seconds
                            if (remaining < 60000) {
                                span.style.color = "#ffaa00";
                                timerUI.style.borderColor = "#ffaa00";
                                timerUI.style.boxShadow = '0 0 20px rgba(255,170,0,0.5)';
                            } else {
                                span.style.color = "#00ff88";
                            }
                        }
                    }, 1000);
                } else if (!isAccepting || (endTime && endTime <= Date.now())) {
                    // Show ENDED state if test is locked manually or time ran out
                    if (endTime || !isAccepting) {
                        timerUI.style.display = 'block';
                        span.textContent = "CLOSED";
                        span.style.color = "#ff3366";
                        timerUI.style.borderColor = "#ff3366";
                        timerUI.style.boxShadow = '0 0 20px rgba(255,51,102,0.5)';
                    }
                } else {
                    timerUI.style.display = 'none'; // Not in exam mode
                }
            }
        });
    }
});
