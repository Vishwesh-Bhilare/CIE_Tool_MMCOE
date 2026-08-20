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
        .select('id, question_text, question_type, options, correct_answers, points')
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

function renderQuestions() {
    $('question-list').innerHTML = currentQuestions.map((q, index) => {
        const options = Array.isArray(q.options) ? q.options : [];
        const inputName = `question-${q.id}`;
        const inputs = q.question_type === 'typed_answer'
            ? `<input class="answer-input" type="text" id="${inputName}" placeholder="Type your sentence or numeric answer">`
            : options.map((opt) => `
                <label class="answer-option">
                    <input type="${q.question_type === 'mcq' ? 'radio' : 'checkbox'}" name="${inputName}" value="${opt}">
                    <span>${opt}</span>
                </label>
              `).join('');
        return `<article class="question-card"><div class="question-kicker">Question ${index + 1} · ${q.question_type.replace('_', ' ')}</div><h2>${q.question_text}</h2><div class="answers">${inputs}</div></article>`;
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
