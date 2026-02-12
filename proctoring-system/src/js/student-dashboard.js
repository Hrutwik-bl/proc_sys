// Auth guard - ONLY allow student role
(function auth(){
    const cur = localStorage.getItem('currentUser');
    if (!cur) { 
        location.href = '../login.html'; 
        return; 
    }
    const user = JSON.parse(cur);
    if (user.role !== 'student') { 
        location.href = '../login.html'; 
    }
})();

const REFLECTION_KEY = 'studentReflectionEntries';
const INTERNAL_MARKS_KEY = 'internalMarks';
const EXTERNAL_SYNC_KEY = 'externalResults';
const REFLECTION_FIELDS = [
    { id: 'studentStrengths', previewId: 'strengthsPreview', limit: 400 },
    { id: 'studentWeaknesses', previewId: 'weaknessesPreview', limit: 400 },
    { id: 'studentAbout', previewId: 'aboutPreview', limit: 500 }
];
let performanceChart = null;
let profileChart = null;
let externalSyncInProgress = false;

function logout(e){
    if (e) e.preventDefault();
    localStorage.removeItem('currentUser');
    location.href = '../login.html';
}

function getCurrentStudentRecord(){
    const cur = localStorage.getItem('currentUser');
    if (!cur) return null;
    const user = JSON.parse(cur);
    const students = JSON.parse(localStorage.getItem('students') || '[]');

    console.log('Current User:', user);
    console.log('Looking for student with USN/Email:', user.usn || user.email);

    // 1) Prefer explicit saved usn from login
    if (user.usn) {
        const byUsn = students.find(s => s.usn && s.usn.toLowerCase() === user.usn.toLowerCase());
        if (byUsn) {
            console.log('Found by USN:', byUsn);
            return byUsn;
        }
    }

    // 2) Try matching by email (gsuite) or by USN in the stored email field
    const emailLower = (user.email || '').toLowerCase();
    if (emailLower) {
        const byEmail = students.find(s =>
            (s.gsuite && s.gsuite.toLowerCase() === emailLower) ||
            (s.usn && s.usn.toLowerCase() === emailLower)
        );
        if (byEmail) {
            console.log('Found by email/usn:', byEmail);
            return byEmail;
        }
    }

    // 3) As a last resort try matching using studentCredentials mapping
    const creds = JSON.parse(localStorage.getItem('studentCredentials') || '[]');
    const cred = creds.find(c => 
        (c.email && c.email.toLowerCase() === emailLower) || 
        (c.usn && c.usn.toLowerCase() === emailLower)
    );
    if (cred) {
        const found = students.find(s => s.usn === cred.usn);
        if (found) {
            console.log('Found by credentials:', found);
            return found;
        }
    }

    console.error('Student not found!');
    return null;
}

function renderStudentProfile(){
    const s = getCurrentStudentRecord();
    if (!s) {
        console.error('Student profile not found');
        alert('Student profile not found. Please contact admin.');
        localStorage.removeItem('currentUser');
        location.href = '../login.html';
        return;
    }

    console.log('Rendering profile for:', s);

    const welcome = document.getElementById('welcomeText');
    if (welcome && s.fullName) {
        welcome.textContent = `Welcome, ${s.fullName}!`;
    }
}

function renderExamResults(){
    const s = getCurrentStudentRecord();
    if (!s) return [];
    
    const allResults = JSON.parse(localStorage.getItem('examResults') || '[]');
    const results = allResults.filter(r => r.usn === s.usn);
    const tbody = document.querySelector('#resultsTable tbody');
    
    if (!tbody) return results;

    tbody.innerHTML = '';
    if (results.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No exam results available</td></tr>';
        return results;
    }

    results.forEach(r => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${r.examName || r.examId || '--'}</td>
                        <td>${r.date || '--'}</td>
                        <td>${r.score != null ? r.score + '%' : '--'}</td>
                        <td>${(r.score != null) ? (r.score >= 40 ? 'Pass' : 'Fail') : '--'}</td>
                        <td>${r.remarks || '--'}</td>
                        <td>${r.invigilator || '--'}</td>`;
        tbody.appendChild(tr);
    });

    return results;
}

function renderPerformanceChart(results){
    const canvas = document.getElementById('performanceChart');
    const emptyMessage = document.getElementById('chartEmptyMessage');
    if (!canvas) return;

    const series = buildPerformanceSeries(results);
    if (series.length === 0 || typeof Chart === 'undefined') {
        if (performanceChart) {
            performanceChart.destroy();
            performanceChart = null;
        }
        if (emptyMessage) emptyMessage.style.display = 'flex';
        canvas.classList.add('hidden');
        return;
    }

    const labels = series.map(item => item.label);
    const scores = series.map(item => item.score);

    if (performanceChart) performanceChart.destroy();

    performanceChart = new Chart(canvas, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'Score %',
                data: scores,
                fill: true,
                tension: 0.35,
                borderColor: '#667eea',
                backgroundColor: 'rgba(102, 126, 234, 0.15)',
                pointBackgroundColor: '#fff',
                pointBorderColor: '#667eea',
                pointRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    ticks: {
                        callback: value => `${value}%`
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                }
            }
        }
    });

    canvas.classList.remove('hidden');
    if (emptyMessage) emptyMessage.style.display = 'none';
}

function getInternalMarksStore(){
    return JSON.parse(localStorage.getItem(INTERNAL_MARKS_KEY) || '[]');
}

function buildPerformanceSeries(results){
    const prioritized = (results || [])
        .map(item => {
            const rawScore = Number(item.score);
            if (!Number.isFinite(rawScore)) return null;
            const label = item.examName || item.examId || 'Exam';
            return {
                label,
                score: Math.max(0, Math.min(Math.round(rawScore), 100))
            };
        })
        .filter(Boolean);

    if (prioritized.length > 0) {
        return prioritized;
    }

    const student = getCurrentStudentRecord();
    if (!student) return [];
    return getInternalMarksStore()
        .filter(entry => entry.usn === student.usn)
        .map(entry => {
            const marks = Number(entry.marks);
            const max = Number(entry.maxMarks) || 50;
            if (!Number.isFinite(marks) || max <= 0) return null;
            const percent = Math.round((marks / max) * 100);
            return {
                label: `${entry.examName || entry.examId || 'Internal'} • ${entry.component}`,
                score: Math.max(0, Math.min(percent, 100))
            };
        })
        .filter(Boolean);
}

function renderInternalMarks(){
    const student = getCurrentStudentRecord();
    if (!student) return;
    const tbody = document.querySelector('#internalMarksTable tbody');
    const avgChip = document.getElementById('internalMarksAverage');
    if (!tbody) return;

    const records = getInternalMarksStore()
        .filter(entry => entry.usn === student.usn)
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    if (records.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">No internal marks published yet</td></tr>';
        if (avgChip) avgChip.textContent = 'Avg --';
        return;
    }

    const avg = records.reduce((sum, entry) => sum + Number(entry.marks || 0), 0) / records.length;
    if (avgChip) avgChip.textContent = `Avg ${avg.toFixed(1)}`;

    const formatDate = iso => new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

    tbody.innerHTML = '';
    records.forEach(entry => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${entry.examName || entry.examId}</td>
            <td>${entry.component}</td>
            <td>${entry.marks}/${entry.maxMarks || 50}</td>
            <td>${formatDate(entry.updatedAt)}</td>
        `;
        tbody.appendChild(tr);
    });
}

function getExternalResultsStore(){
    return JSON.parse(localStorage.getItem(EXTERNAL_SYNC_KEY) || '{}');
}

function setExternalResultsStore(store){
    localStorage.setItem(EXTERNAL_SYNC_KEY, JSON.stringify(store));
}

function renderExternalResults(records, syncedAt){
    const tbody = document.querySelector('#externalResultsTable tbody');
    const statusEl = document.getElementById('externalSyncStatus');
    if (!tbody) return;

    if (!records || records.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Sync to fetch latest external results</td></tr>';
        if (statusEl) statusEl.textContent = 'Last synced: --';
        return;
    }

    tbody.innerHTML = '';
    records.forEach(row => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${row.course}</td>
            <td>${row.score}</td>
            <td>${row.grade}</td>
            <td>${row.credits}</td>
        `;
        tbody.appendChild(tr);
    });

    if (statusEl) {
        if (syncedAt) {
            const pretty = new Date(syncedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
            statusEl.textContent = `Last synced: ${pretty}`;
        } else {
            statusEl.textContent = 'Last synced: --';
        }
    }
}

function mockVtuFetch(usn){
    const subjects = [
        { code: 'BCS501', name: 'Software Engineering and project management' },
        { code: 'BCS502', name: 'Computer networks' },
        { code: 'BCS503', name: 'Theory of computation' },
        { code: 'BCSL504', name: 'Web technology Lab' },
        { code: 'BCS515B', name: 'Artificial Inteligence' }
    ];
    const safeUsn = (usn || 'STUDENT');
    return new Promise(resolve => {
        setTimeout(() => {
            const payload = subjects.map((subject, idx) => {
                const seed = (safeUsn.charCodeAt(idx % safeUsn.length) + idx * 7) % 35;
                const score = 55 + seed;
                const grade = score >= 90 ? 'S' : score >= 80 ? 'A' : score >= 70 ? 'B' : score >= 60 ? 'C' : score >= 50 ? 'D' : 'F';
                return {
                    course: `${subject.code} - ${subject.name}`,
                    score,
                    grade,
                    credits: subject.code.endsWith('L') ? 2 : 4
                };
            });
            resolve(payload);
        }, 1400);
    });
}

function syncExternalResults({ auto = false } = {}){
    const student = getCurrentStudentRecord();
    if (!student || externalSyncInProgress) return;
    const button = document.getElementById('syncExternalBtn');
    const statusEl = document.getElementById('externalSyncStatus');

    externalSyncInProgress = true;
    if (button) {
        button.disabled = true;
        button.textContent = 'Syncing...';
    }
    if (statusEl) {
        statusEl.textContent = auto ? 'Syncing with VTU...' : 'Fetching latest VTU results...';
    }

    mockVtuFetch(student.usn)
        .then(records => {
            const store = getExternalResultsStore();
            store[student.usn] = {
                syncedAt: new Date().toISOString(),
                records
            };
            setExternalResultsStore(store);
            renderExternalResults(records, store[student.usn].syncedAt);
        })
        .catch(() => {
            if (statusEl) statusEl.textContent = 'Sync failed. Try again in a moment.';
        })
        .finally(() => {
            externalSyncInProgress = false;
            if (button) {
                button.disabled = false;
                button.textContent = 'Sync Now';
            }
        });
}

function autoSyncExternalResults(){
    const student = getCurrentStudentRecord();
    if (!student) return;
    const store = getExternalResultsStore();
    const entry = store[student.usn];
    if (!entry) {
        syncExternalResults({ auto: true });
        return;
    }
    renderExternalResults(entry.records, entry.syncedAt);
    const lastSync = new Date(entry.syncedAt).getTime();
    const twelveHours = 1000 * 60 * 60 * 12;
    if (Date.now() - lastSync > twelveHours) {
        syncExternalResults({ auto: true });
    }
}

function renderProfilePerformance(results){
    const canvas = document.getElementById('profilePerformanceChart');
    const emptyMessage = document.getElementById('profileChartEmpty');
    const valueEl = document.getElementById('profileChartValue');
    const completedEl = document.getElementById('profileCompleted');
    const passEl = document.getElementById('profilePassRate');
    const bestEl = document.getElementById('profileBest');
    if (!canvas) return;

    const hasChartLib = typeof Chart !== 'undefined';
    const series = buildPerformanceSeries(results);
    if (series.length === 0 || !hasChartLib) {
        if (profileChart) {
            profileChart.destroy();
            profileChart = null;
        }
        canvas.classList.add('hidden');
        if (emptyMessage) emptyMessage.style.display = 'flex';
        if (valueEl) valueEl.textContent = '--';
        if (completedEl) completedEl.textContent = '0';
        if (passEl) passEl.textContent = '0/0';
        if (bestEl) bestEl.textContent = '--';
        return;
    }

    const numericScores = series.map(item => item.score);
    const total = numericScores.reduce((sum, val) => sum + val, 0);
    const avg = Math.round(total / numericScores.length);
    const best = Math.max(...numericScores);
    const passCount = numericScores.filter(score => score >= 40).length;

    if (profileChart) profileChart.destroy();

    profileChart = new Chart(canvas, {
        type: 'doughnut',
        data: {
            labels: ['Average', 'Gap'],
            datasets: [{
                data: [avg, Math.max(0, 100 - avg)],
                backgroundColor: ['#34d399', '#1e293b'],
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '70%',
            plugins: { legend: { display: false } }
        }
    });

    canvas.classList.remove('hidden');
    if (emptyMessage) emptyMessage.style.display = 'none';
    if (valueEl) valueEl.textContent = `${avg}%`;
    if (completedEl) completedEl.textContent = `${series.length}`;
    if (passEl) passEl.textContent = `${passCount}/${series.length}`;
    if (bestEl) bestEl.textContent = `${best}%`;
}

function getReflectionStore(){
    return JSON.parse(localStorage.getItem(REFLECTION_KEY) || '{}');
}

function loadReflectionData(form){
    const student = getCurrentStudentRecord();
    if (!student) return;
    const store = getReflectionStore();
    const entry = store[student.usn] || {};
    form.studentStrengths.value = entry.strengths || '';
    form.studentWeaknesses.value = entry.weaknesses || '';
    form.studentAbout.value = entry.about || '';
    updateReflectionVisuals();
}

function handleReflectionSubmit(event, form, statusEl){
    event.preventDefault();
    const student = getCurrentStudentRecord();
    if (!student) return;
    const store = getReflectionStore();
    store[student.usn] = {
        strengths: form.studentStrengths.value.trim(),
        weaknesses: form.studentWeaknesses.value.trim(),
        about: form.studentAbout.value.trim()
    };
    localStorage.setItem(REFLECTION_KEY, JSON.stringify(store));
    updateReflectionVisuals();
    if (statusEl) {
        statusEl.textContent = 'Saved just now';
        statusEl.classList.add('success');
        setTimeout(() => {
            statusEl.textContent = '';
            statusEl.classList.remove('success');
        }, 3000);
    }
}

function updateReflectionVisuals(){
    REFLECTION_FIELDS.forEach(updateSingleReflectionField);
}

function updateSingleReflectionField(cfg){
    const field = document.getElementById(cfg.id);
    if (!field) return;
    const preview = document.getElementById(cfg.previewId);
    const value = field.value.trim();
    if (preview) {
        const emptyMessage = preview.dataset.empty || 'Nothing saved yet.';
        preview.textContent = value || emptyMessage;
        preview.classList.toggle('muted', !value);
    }

    const counter = document.querySelector(`.char-count[data-for="${cfg.id}"]`);
    if (counter && cfg.limit) {
        counter.textContent = `${field.value.length}/${cfg.limit}`;
    }
}

function setupReflectionForm(){
    const form = document.getElementById('studentReflectionForm');
    const statusEl = document.getElementById('reflectionStatus');
    if (!form) return;
    loadReflectionData(form);
    form.addEventListener('submit', event => handleReflectionSubmit(event, form, statusEl));
    REFLECTION_FIELDS.forEach(cfg => {
        const field = document.getElementById(cfg.id);
        if (!field) return;
        field.addEventListener('input', () => {
            updateSingleReflectionField(cfg);
            if (statusEl) {
                statusEl.textContent = '';
                statusEl.classList.remove('success');
            }
        });
    });
}

function parseExamDateTime(exam){
    if (!exam || !exam.date) return null;
    const datePart = exam.date.trim();
    const timePart = (exam.time || '09:00').trim();
    const isoCandidate = new Date(`${datePart}T${timePart}`);
    if (!Number.isNaN(isoCandidate.getTime())) {
        return isoCandidate;
    }
    const fallback = new Date(`${datePart} ${timePart}`);
    return Number.isNaN(fallback.getTime()) ? null : fallback;
}

function formatTimeUntil(dateObj){
    if (!dateObj) return 'TBA';
    const diffMs = dateObj.getTime() - Date.now();
    if (diffMs <= 0) return 'Today';
    const minutes = Math.floor(diffMs / 60000);
    if (minutes < 60) return `in ${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `in ${hours}h`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `in ${days}d`;
    const months = Math.floor(days / 30);
    return `in ${months}mo`;
}

function renderUpcomingNotifications(){
    const container = document.getElementById('upcomingNotifications');
    if (!container) return;
    const exams = JSON.parse(localStorage.getItem('exams') || '[]');
    const upcoming = exams
        .map(exam => ({ ...exam, dateObj: parseExamDateTime(exam) }))
        .filter(item => !item.dateObj || item.dateObj.getTime() >= Date.now())
        .sort((a, b) => {
            if (!a.dateObj && !b.dateObj) return 0;
            if (!a.dateObj) return 1;
            if (!b.dateObj) return -1;
            return a.dateObj.getTime() - b.dateObj.getTime();
        })
        .slice(0, 5);

    if (upcoming.length === 0) {
        container.innerHTML = '<p class="notification-empty">No upcoming exams scheduled yet.</p>';
        return;
    }

    container.innerHTML = '';
    upcoming.forEach(item => {
        const card = document.createElement('article');
        card.className = 'notification-card';
        const course = item.course || item.subject || 'Exam';
        const title = item.name || item.title || 'Untitled Exam';
        const description = item.description || 'Stay prepped and arrive 10 minutes early.';
        const relative = formatTimeUntil(item.dateObj);
        const dateLabel = item.date || 'Date TBA';
        const timeLabel = item.time || 'Time TBA';
        const durationLabel = item.duration ? `${item.duration} mins` : 'Duration TBA';
        card.innerHTML = `
            <div class="notification-header">
                <div>
                    <p class="eyebrow">${course}</p>
                    <h4 class="notification-title">${title}</h4>
                </div>
                <span class="notification-time">${relative}</span>
            </div>
            <p class="notification-body">${description}</p>
            <div class="notification-meta">
                <span class="pill">${dateLabel}</span>
                <span>${timeLabel}</span>
                <span>${durationLabel}</span>
            </div>
        `;
        container.appendChild(card);
    });
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function(){
    console.log('Student Dashboard loaded');
    renderStudentProfile();
    const results = renderExamResults();
    renderPerformanceChart(results);
    renderProfilePerformance(results);
    renderUpcomingNotifications();
    setupReflectionForm();
    renderInternalMarks();
    autoSyncExternalResults();
    const syncBtn = document.getElementById('syncExternalBtn');
    if (syncBtn) {
        syncBtn.addEventListener('click', () => syncExternalResults());
    }
});