const TEST_DURATION_MINUTES = 45;
const TEST_QUESTION_COUNT = 2;

let currentAttempt = null;
let currentQuestions = [];
let timerInterval = null;
let submitted = false;

const $ = (id) => document.getElementById(id);
const normalizeAnswer = (value) => String(value || '').trim().toLowerCase();

function arraysEqualIgnoreOrder(left, right) {
    const a = left.map(normalizeAnswer).sort();
    const b = right.map(normalizeAnswer).sort();
    return a.length === b.length && a.every((item, index) => item === b[index]);
}

function setMessage(message, type = 'info') {
    const el = $('test-message');
    el.textContent = message;
    el.className = `test-message ${type}`;
    el.hidden = !message;
}

function shuffle(items) {
    return [...items].sort(() => Math.random() - 0.5);
}

async function loadPreviousResults() {
    const studentId = localStorage.getItem('studentDbId');
    if (!studentId) return;

    const { data, error } = await window.supabaseClient
        .from('test_attempts')
        .select('id, submitted_at, status, score, max_score, total_questions')
        .eq('student_id', studentId)
        .neq('status', 'in_progress')
        .order('submitted_at', { ascending: false })
        .limit(5);

    if (error) {
        console.error('Error loading test results:', error);
        return;
    }

    const list = $('result-list');
    if (!data?.length) {
        list.innerHTML = '<li>No submitted tests yet.</li>';
        return;
    }

    list.innerHTML = data.map((attempt) => `
        <li>
            <strong>${attempt.score}/${attempt.max_score}</strong>
            <span>${attempt.status.replace('_', ' ')} · ${new Date(attempt.submitted_at).toLocaleString()}</span>
        </li>
    `).join('');
}

async function startTest() {
    setMessage('Preparing your random questions...');
    const studentId = localStorage.getItem('studentDbId');
    if (!studentId) {
        setMessage('Student profile is still loading. Refresh and try again.', 'error');
        return;
    }

    const { data: questions, error: questionError } = await window.supabaseClient
        .from('test_questions')
        .select('id, question_text, question_type, concept_name, game_slug, options, correct_answers, points')
        .eq('is_active', true);

    if (questionError || !questions || questions.length < TEST_QUESTION_COUNT) {
        console.error(questionError);
        setMessage('At least 2 active questions are required before starting the test.', 'error');
        return;
    }

    currentQuestions = shuffle(questions).slice(0, TEST_QUESTION_COUNT);
    const expiresAt = new Date(Date.now() + TEST_DURATION_MINUTES * 60000).toISOString();
    const maxScore = currentQuestions.reduce((sum, q) => sum + Number(q.points || 1), 0);

    const { data: attempt, error: attemptError } = await window.supabaseClient
        .from('test_attempts')
        .insert({ student_id: studentId, expires_at: expiresAt, total_questions: TEST_QUESTION_COUNT, max_score: maxScore })
        .select('*')
        .single();

    if (attemptError) {
        console.error(attemptError);
        setMessage('Unable to create test attempt.', 'error');
        return;
    }

    currentAttempt = attempt;
    const rows = currentQuestions.map((q, index) => ({ attempt_id: attempt.id, question_id: q.id, position: index + 1 }));
    const { error: linkError } = await window.supabaseClient.from('test_attempt_questions').insert(rows);
    if (linkError) console.error('Error storing selected questions:', linkError);

    $('start-panel').hidden = true;
    $('test-panel').hidden = false;
    $('submit-test').disabled = false;
    renderQuestions();
    startTimer(new Date(expiresAt).getTime());
    setMessage('');
}

const SIMULATION_PAGES = {
    filters: 'filters.html',
    symmetrical: 'symmetrical.html',
    parameters: 'parameters.html',
    open_short: 'open-short.html',
    asymmetrical: 'asymmetrical.html',
    twin_t: 'twin-t.html',
    composite: 'composite.html'
};

function escapeHtml(value) {
    const div = document.createElement('div');
    div.textContent = value ?? '';
    return div.innerHTML;
}

function escapeAttribute(value) {
    return escapeHtml(value).replace(/&quot;/g, '&amp;quot;').replace(/'/g, '&#39;');
}

function getSimulationEmbed(question) {
    const page = SIMULATION_PAGES[question.game_slug];
    const concept = escapeHtml(question.concept_name || 'Network Analysis Simulation');
    const conceptAttribute = escapeAttribute(question.concept_name || 'Network Analysis Simulation');
    if (!page) {
        return `<aside class="simulation-panel simulation-panel-empty"><strong>${concept}</strong><span>No linked simulation is configured for this question yet.</span></aside>`;
    }

    return `
        <aside class="simulation-panel">
            <div class="simulation-header">
                <div>
                    <span class="simulation-label">Linked simulation</span>
                    <strong>${concept}</strong>
                </div>
                <a href="${page}" target="_blank" rel="noopener">Open full screen ↗</a>
            </div>
            <iframe title="${conceptAttribute} simulation" src="${page}?embedded=test" loading="lazy"></iframe>
        </aside>
    `;
}

function renderQuestions() {
    $('question-list').innerHTML = currentQuestions.map((q, index) => {
        const options = Array.isArray(q.options) ? q.options : [];
        const inputName = `question-${q.id}`;
        const inputs = q.question_type === 'typed_answer'
            ? `<input class="answer-input" type="text" id="${inputName}" placeholder="Type your sentence or numeric answer">`
            : options.map((opt) => {
                const safeOption = escapeHtml(opt);
                const safeValue = escapeAttribute(opt);
                return `
                <label class="answer-option">
                    <input type="${q.question_type === 'mcq' ? 'radio' : 'checkbox'}" name="${inputName}" value="${safeValue}">
                    <span>${safeOption}</span>
                </label>
              `;
            }).join('');
        return `<article class="question-card"><div class="question-kicker">Question ${index + 1} · ${escapeHtml(q.concept_name || 'Network Analysis')} · ${q.question_type.replace('_', ' ')}</div><h2>${escapeHtml(q.question_text)}</h2>${getSimulationEmbed(q)}<div class="answers">${inputs}</div></article>`;
    }).join('');
}

function startTimer(expiresAt) {
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        const remaining = expiresAt - Date.now();
        if (remaining <= 0) {
            clearInterval(timerInterval);
            $('test-timer').textContent = '00:00';
            submitTest(true);
            return;
        }
        const minutes = Math.floor(remaining / 60000);
        const seconds = Math.floor((remaining % 60000) / 1000);
        $('test-timer').textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }, 1000);
}

function collectAnswer(question) {
    const name = `question-${question.id}`;
    if (question.question_type === 'typed_answer') return [$(name)?.value || ''];
    return [...document.querySelectorAll(`input[name="${name}"]:checked`)].map(input => input.value);
}

async function submitTest(autoSubmitted = false) {
    if (submitted || !currentAttempt) return;
    submitted = true;
    $('submit-test').disabled = true;
    clearInterval(timerInterval);
    setMessage(autoSubmitted ? 'Time ended. Auto-submitting your test...' : 'Submitting your test...');

    let score = 0;
    const answerRows = currentQuestions.map((question) => {
        const answer = collectAnswer(question);
        const correct = arraysEqualIgnoreOrder(answer, question.correct_answers || []);
        const points = correct ? Number(question.points || 1) : 0;
        score += points;
        return { attempt_id: currentAttempt.id, question_id: question.id, answer, is_correct: correct, points_awarded: points };
    });

    const { error: answersError } = await window.supabaseClient.from('test_answers').insert(answerRows);
    if (answersError) console.error('Error saving answers:', answersError);

    const { error: updateError } = await window.supabaseClient
        .from('test_attempts')
        .update({ status: autoSubmitted ? 'auto_submitted' : 'submitted', submitted_at: new Date().toISOString(), score })
        .eq('id', currentAttempt.id);

    if (updateError) {
        console.error(updateError);
        setMessage('Submission saved locally but database update failed. Contact faculty.', 'error');
        return;
    }

    $('test-panel').hidden = true;
    $('score-value').textContent = `${score}/${currentAttempt.max_score}`;
    $('score-panel').hidden = false;
    setMessage(autoSubmitted ? 'Your test was auto-submitted.' : 'Your test was submitted successfully.', 'success');
    await loadPreviousResults();
}

document.addEventListener('DOMContentLoaded', () => {
    $('start-test').addEventListener('click', startTest);
    $('submit-test').addEventListener('click', () => submitTest(false));
    loadPreviousResults();
});
