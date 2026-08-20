// js/db.js
const SUPABASE_URL = window.PGL_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = window.PGL_SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('Missing Supabase configuration. Set window.PGL_SUPABASE_URL and window.PGL_SUPABASE_ANON_KEY before loading js/db.js.');
}

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
window.db = supabaseClient;
window.supabaseClient = supabaseClient;

const nowIso = () => new Date().toISOString();

window.registerStudentSession = async function(name, rollId, email) {
    const { data: userData } = await supabaseClient.auth.getUser();
    const authUserId = userData?.user?.id || null;

    const { data, error } = await supabaseClient
        .from('students')
        .upsert({
            auth_user_id: authUserId,
            name,
            roll_id: rollId,
            email,
            last_login_at: nowIso()
        }, { onConflict: 'email' })
        .select('id')
        .single();

    if (error) {
        console.error('Error registering student:', error);
        return null;
    }

    return data.id;
};

window.getExamConfig = async function() {
    const { data, error } = await supabaseClient
        .from('exam_config')
        .select('*')
        .eq('id', 1)
        .single();

    if (error) {
        console.error('Error loading exam config:', error);
        return null;
    }
    return data;
};

window.saveGameScore = async function(gameName, score, details = {}) {
    const studentId = localStorage.getItem('studentDbId');
    if (!studentId) {
        console.warn('No active student session in DB. Cannot save score to cloud.');
        return;
    }

    try {
        const config = await window.getExamConfig();
        const endTime = config?.exam_end_time ? new Date(config.exam_end_time).getTime() : null;
        if (config && (!config.accepting_responses || (endTime && endTime <= Date.now()))) {
            alert('⚠️ The time limit for this exam has ended. Submissions are closed.');
            return;
        }

        const payload = {
            student_id: studentId,
            game_slug: gameName,
            score,
            details
        };

        const { data, error } = await supabaseClient
            .from('scores')
            .insert(payload)
            .select('id')
            .single();

        if (error) throw error;
        window.lastScoreId = data.id;
        window.lastLeaderboardDocId = data.id;
        console.log(`Successfully saved ${score} XP to Supabase for ${gameName}`);
    } catch (error) {
        console.error('Error saving score to cloud:', error);
    }
};

window.promptCalculationUpload = function(gameName, btnElement) {
    if (!window.lastScoreId) {
        alert('Wait for the score to save first before uploading!');
        return;
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = function(e) {
        const file = e.target.files[0];
        if (!file) return;

        btnElement.textContent = '⏳ COMPRESSING...';
        btnElement.style.background = '#ffaa00';

        const reader = new FileReader();
        reader.onload = function(event) {
            const img = new Image();
            img.onload = async function() {
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
                const compressedData = canvas.toDataURL('image/jpeg', 0.6);

                btnElement.textContent = '☁️ UPLOADING...';
                const { error } = await supabaseClient
                    .from('scores')
                    .update({ calculation_image: compressedData })
                    .eq('id', window.lastScoreId);

                if (error) {
                    console.error(error);
                    btnElement.textContent = '❌ ERROR';
                    btnElement.style.background = '#ff3366';
                    return;
                }

                btnElement.textContent = '✅ UPLOADED!';
                btnElement.style.background = 'var(--success)';
                btnElement.disabled = true;
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    };
    input.click();
};

function renderStudentTimer(config) {
    const path = window.location.pathname.toLowerCase();
    const isGamePage = !path.includes('admin') && !path.includes('index') && !path.includes('login') && path.length > 1 && !path.endsWith('/');
    if (!isGamePage) return;

    let timerUI = document.getElementById('global-exam-timer-wrap');
    if (!timerUI) {
        timerUI = document.createElement('div');
        timerUI.id = 'global-exam-timer-wrap';
        timerUI.style.cssText = "position:fixed;top:15px;left:50%;transform:translateX(-50%);background:rgba(10,20,36,.9);color:#fff;padding:8px 20px;border-radius:30px;border:2px solid #00ff88;font-family:'Space Mono',monospace;font-size:1.3rem;font-weight:bold;z-index:9999;box-shadow:0 0 20px rgba(0,255,136,.4);display:none;backdrop-filter:blur(5px);";
        timerUI.innerHTML = 'EXAM TIME: <span id="global-exam-timer">--:--</span>';
        document.body.appendChild(timerUI);
    }

    clearInterval(window.studentCountdownInterval);
    const span = document.getElementById('global-exam-timer');
    const endTime = config?.exam_end_time ? new Date(config.exam_end_time).getTime() : null;

    if (config?.accepting_responses && endTime && endTime > Date.now()) {
        timerUI.style.display = 'block';
        window.studentCountdownInterval = setInterval(() => {
            const remaining = endTime - Date.now();
            if (remaining <= 0) {
                clearInterval(window.studentCountdownInterval);
                span.textContent = 'ENDED';
                span.style.color = '#ff3366';
                timerUI.style.borderColor = '#ff3366';
            } else {
                const m = Math.floor(remaining / 60000);
                const s = Math.floor((remaining % 60000) / 1000);
                span.textContent = `${m}:${s.toString().padStart(2, '0')}`;
                span.style.color = remaining < 60000 ? '#ffaa00' : '#00ff88';
            }
        }, 1000);
    } else if (config && (!config.accepting_responses || (endTime && endTime <= Date.now()))) {
        timerUI.style.display = 'block';
        span.textContent = 'CLOSED';
        span.style.color = '#ff3366';
        timerUI.style.borderColor = '#ff3366';
    } else {
        timerUI.style.display = 'none';
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    const config = await window.getExamConfig();
    renderStudentTimer(config);
    supabaseClient
        .channel('exam_config_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'exam_config' }, payload => renderStudentTimer(payload.new))
        .subscribe();
});
