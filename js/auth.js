// js/auth.js

document.addEventListener('DOMContentLoaded', () => {
    const isLoginPage = window.location.pathname.endsWith('login.html');
    const studentName = localStorage.getItem('studentName');
    const studentId = localStorage.getItem('studentId');

    if (!studentName || !studentId) {
        // If not logged in and not on login page, redirect to login
        if (!isLoginPage) {
            window.location.href = 'login.html';
        }
    } else {
        // If logged in and on login page, redirect to main
        if (isLoginPage) {
            window.location.href = 'index.html';
        } else {
            // Display student info in any element with class 'student-name-display'
            const nameElements = document.querySelectorAll('.student-name-display');
            nameElements.forEach(el => {
                el.textContent = `PLAYER: ${studentName.toUpperCase()} (${studentId})`;
            });
        }
    }
});

async function loginStudent(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    
    btn.innerHTML = "AUTHENTICATING...";
    btn.disabled = true;
    
    try {
        // Trigger Google Sign-In Popup
        const provider = new firebase.auth.GoogleAuthProvider();
        // Force the Google popup to prioritize the college domain
        provider.setCustomParameters({ hd: "mmcoe.edu.in" });
        
        const result = await firebase.auth().signInWithPopup(provider);
        const user = result.user;
        
        const name = user.displayName;
        const email = user.email;

        // HARD SECURITY CHECK: Verify they actually used the college email
        if (!email.endsWith('@mmcoe.edu.in')) {
            await firebase.auth().signOut(); // Log them back out
            throw new Error("ACCESS DENIED. You must use your official @mmcoe.edu.in college email.");
        }

        // AUTO-EXTRACT ROLL NUMBER from email (e.g. extracts B24ET1004 from nikhil.b24et1004@mmcoe.edu.in)
        let id = "UNKNOWN";
        const rollMatch = email.match(/[A-Za-z]\d{2}[A-Za-z]{2}\d{4}/);
        if (rollMatch) {
            id = rollMatch[0].toUpperCase();
        } else {
            // Fallback: just use whatever is before the @
            id = email.split('@')[0].toUpperCase();
        }

        // Register in Firestore
        let dbId = null;
        if (window.registerStudentSession) {
            dbId = await window.registerStudentSession(name, id, email);
        }
        
        // Save to localStorage
        localStorage.setItem('studentName', name);
        localStorage.setItem('studentEmail', email);
        localStorage.setItem('studentId', id);
        if (dbId) localStorage.setItem('studentDbId', dbId);
        
        window.location.href = 'index.html';
    } catch (error) {
        console.error(error);
        alert("Login failed: " + error.message);
        btn.innerHTML = "SIGN IN WITH GOOGLE";
        btn.disabled = false;
    }
}

function logoutStudent() {
    localStorage.removeItem('studentName');
    localStorage.removeItem('studentId');
    localStorage.removeItem('studentDbId');
    // Clear all game scores from local storage to reset for the next student
    for (let key in localStorage) {
        if (key.startsWith('score_')) {
            localStorage.removeItem(key);
        }
    }
    window.location.href = 'login.html';
}
