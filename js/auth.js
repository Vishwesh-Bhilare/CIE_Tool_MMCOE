// js/auth.js

document.addEventListener('DOMContentLoaded', async () => {
    const isLoginPage = window.location.pathname.endsWith('login.html');
    const { data } = await window.supabaseClient.auth.getSession();
    const session = data?.session;

    if (!session) {
        if (!isLoginPage) window.location.href = 'login.html';
        return;
    }

    const email = session.user.email || '';
    if (!email.endsWith('@mmcoe.edu.in')) {
        await window.supabaseClient.auth.signOut();
        localStorage.clear();
        if (!isLoginPage) window.location.href = 'login.html';
        return;
    }

    const userMeta = session.user.user_metadata || {};
    const name = userMeta.full_name || userMeta.name || email.split('@')[0];
    const rollId = extractRollId(email);

    let dbId = localStorage.getItem('studentDbId');
    if (!dbId && window.registerStudentSession) {
        dbId = await window.registerStudentSession(name, rollId, email);
    }

    localStorage.setItem('studentName', name);
    localStorage.setItem('studentEmail', email);
    localStorage.setItem('studentId', rollId);
    if (dbId) localStorage.setItem('studentDbId', dbId);

    if (isLoginPage) {
        window.location.href = 'index.html';
        return;
    }

    document.querySelectorAll('.student-name-display').forEach(el => {
        el.textContent = `PLAYER: ${name.toUpperCase()} (${rollId})`;
    });
});

function extractRollId(email) {
    const rollMatch = email.match(/[A-Za-z]\d{2}[A-Za-z]{2}\d{4}/);
    return rollMatch ? rollMatch[0].toUpperCase() : email.split('@')[0].toUpperCase();
}

async function loginStudent(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    btn.innerHTML = 'REDIRECTING...';
    btn.disabled = true;

    const { error } = await window.supabaseClient.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: `${window.location.origin}${window.location.pathname.replace('login.html', 'index.html')}`,
            queryParams: { hd: 'mmcoe.edu.in' }
        }
    });

    if (error) {
        console.error(error);
        alert('Login failed: ' + error.message);
        btn.innerHTML = 'SIGN IN WITH GOOGLE';
        btn.disabled = false;
    }
}

async function logoutStudent() {
    await window.supabaseClient.auth.signOut();
    localStorage.clear();
    window.location.href = 'login.html';
}
