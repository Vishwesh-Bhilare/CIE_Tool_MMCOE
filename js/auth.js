// js/auth.js

const REQUIRED_EMAIL_DOMAIN = '@mmcoe.edu.in';

function getLoginRedirectUrl() {
    return `${window.location.origin}${window.location.pathname.replace('login.html', 'index.html')}`;
}

function validateStudentEmail(email) {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail.endsWith(REQUIRED_EMAIL_DOMAIN)) {
        throw new Error(`Please use your ${REQUIRED_EMAIL_DOMAIN} email address.`);
    }
    return normalizedEmail;
}

function setAuthMessage(message, type = 'info') {
    const messageEl = document.getElementById('authMessage');
    if (!messageEl) return;

    messageEl.textContent = message;
    messageEl.className = `auth-message ${type}`;
    messageEl.hidden = !message;
}

function setButtonLoading(button, isLoading, loadingText) {
    if (!button) return;

    if (isLoading) {
        button.dataset.originalText = button.textContent;
        button.textContent = loadingText;
        button.disabled = true;
        return;
    }

    button.textContent = button.dataset.originalText || button.textContent;
    button.disabled = false;
}

document.addEventListener('DOMContentLoaded', async () => {
    const isLoginPage = window.location.pathname.endsWith('login.html');
    const { data } = await window.supabaseClient.auth.getSession();
    const session = data?.session;

    if (!session) {
        if (!isLoginPage) window.location.href = 'login.html';
        return;
    }

    const email = session.user.email || '';
    if (!email.endsWith(REQUIRED_EMAIL_DOMAIN)) {
        await window.supabaseClient.auth.signOut();
        localStorage.clear();
        if (isLoginPage) {
            setAuthMessage(`Access is limited to ${REQUIRED_EMAIL_DOMAIN} accounts.`, 'error');
        } else {
            window.location.href = 'login.html';
        }
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
    setAuthMessage('');

    const form = e.target;
    const btn = form.querySelector('button');
    setButtonLoading(btn, true, 'AUTHENTICATING...');

    try {
        const email = validateStudentEmail(form.email.value);
        const password = form.password.value;

        const { error } = await window.supabaseClient.auth.signInWithPassword({
            email,
            password
        });

        if (error) throw error;

        window.location.href = getLoginRedirectUrl();
    } catch (error) {
        console.error(error);
        setAuthMessage(error.message || 'Login failed. Please check your credentials.', 'error');
        setButtonLoading(btn, false);
    }
}

async function signupStudent(e) {
    e.preventDefault();
    setAuthMessage('');

    const form = e.target;
    const btn = form.querySelector('button');
    setButtonLoading(btn, true, 'CREATING ACCOUNT...');

    try {
        const email = validateStudentEmail(form.email.value);
        const password = form.password.value;
        const confirmPassword = form.confirmPassword.value;
        const fullName = form.fullName.value.trim();

        if (password.length < 6) {
            throw new Error('Password must be at least 6 characters long.');
        }

        if (password !== confirmPassword) {
            throw new Error('Passwords do not match.');
        }

        const { data, error } = await window.supabaseClient.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: fullName || email.split('@')[0],
                    name: fullName || email.split('@')[0]
                },
                emailRedirectTo: getLoginRedirectUrl()
            }
        });

        if (error) throw error;

        if (data?.session) {
            window.location.href = getLoginRedirectUrl();
            return;
        }

        form.reset();
        switchAuthTab('login');
        setAuthMessage('Account created. Check your email to confirm, then log in.', 'success');
    } catch (error) {
        console.error(error);
        setAuthMessage(error.message || 'Sign up failed. Please try again.', 'error');
    } finally {
        setButtonLoading(btn, false);
    }
}

function switchAuthTab(tabName) {
    const isSignup = tabName === 'signup';
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');
    const loginTab = document.querySelector('[data-auth-tab="login"]');
    const signupTab = document.querySelector('[data-auth-tab="signup"]');

    if (!loginForm || !signupForm || !loginTab || !signupTab) return;

    loginForm.hidden = isSignup;
    signupForm.hidden = !isSignup;
    loginTab.classList.toggle('active', !isSignup);
    signupTab.classList.toggle('active', isSignup);
    loginTab.setAttribute('aria-selected', String(!isSignup));
    signupTab.setAttribute('aria-selected', String(isSignup));
    setAuthMessage('');
}

async function logoutStudent() {
    await window.supabaseClient.auth.signOut();
    localStorage.clear();
    window.location.href = 'login.html';
}
