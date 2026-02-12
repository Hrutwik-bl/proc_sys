// Auth guard - ONLY allow proctor role
(function auth() {
    const cur = localStorage.getItem('currentUser');
    if (!cur) {
        location.href = '../login.html';
        return;
    }
    const user = JSON.parse(cur);
    if (user.role !== 'proctor') {
        location.href = '../login.html';
    }
})();

function logout(e) {
    if(e) e.preventDefault();
    localStorage.removeItem('currentUser');
    location.href = '../login.html';
}

function switchTab(tabName) {
    // Hide all tabs
    const tabs = document.querySelectorAll('.tab-content');
    tabs.forEach(tab => tab.classList.remove('active'));
    
    // Remove active class from all buttons
    const buttons = document.querySelectorAll('.tab-btn');
    buttons.forEach(btn => btn.classList.remove('active'));
    
    // Show selected tab
    document.getElementById(tabName).classList.add('active');
    
    // Add active class to clicked button
    event.target.classList.add('active');
}

function getCurrentProctorRecord() {
    const cur = localStorage.getItem('currentUser');
    if (!cur) return null;
    const user = JSON.parse(cur);
    const proctors = JSON.parse(localStorage.getItem('proctors') || '[]');
    const byEmail = proctors.find(p => p.email === user.email);
    if (byEmail) return byEmail;
    return proctors.find(p => p.id === user.id) || null;
}

function getCurrentProctorId() {
    const record = getCurrentProctorRecord();
    return record ? record.id : null;
}

const INTERNAL_MARKS_KEY = 'internalMarks';
const EXTERNAL_SYNC_KEY = 'externalResults';

function getAssignedContext() {
    const proctorId = getCurrentProctorId();
    const assignments = JSON.parse(localStorage.getItem('assignments') || '[]');
    const students = JSON.parse(localStorage.getItem('students') || '[]');
    const assignedRecords = assignments.filter(a => a.proctorId === proctorId);
    const assignedUSNs = assignedRecords.map(a => a.usn);
    const assignedStudents = students.filter(s => assignedUSNs.includes(s.usn));
    return { proctorId, assignments, students, assignedUSNs, assignedStudents };
}

function getInternalMarksStore() {
    return JSON.parse(localStorage.getItem(INTERNAL_MARKS_KEY) || '[]');
}

function setInternalMarksStore(entries) {
    localStorage.setItem(INTERNAL_MARKS_KEY, JSON.stringify(entries));
}

function calculateExamScoreFromInternals(usn, examId, internalEntries) {
    const store = internalEntries || getInternalMarksStore();
    const relevant = store.filter(entry => entry.usn === usn && entry.examId === examId);
    if (relevant.length === 0) {
        return 75;
    }
    const totals = relevant.reduce((acc, entry) => {
        acc.marks += Number(entry.marks || 0);
        acc.max += Number(entry.maxMarks || 50);
        return acc;
    }, { marks: 0, max: 0 });
    if (totals.max <= 0) {
        return 75;
    }
    const percent = Math.round((totals.marks / totals.max) * 100);
    return Math.max(0, Math.min(percent, 100));
}

function populateInternalMarksFormOptions(students) {
    const studentSelect = document.getElementById('internalStudentSelect');
    const examSelect = document.getElementById('internalExamSelect');
    const componentSelect = document.getElementById('internalComponent');
    if (!studentSelect || !examSelect || !componentSelect) return;

    studentSelect.innerHTML = '<option value="">Select student</option>';
    students.forEach(student => {
        const option = document.createElement('option');
        option.value = student.usn;
        option.textContent = `${student.fullName} (${student.usn})`;
        studentSelect.appendChild(option);
    });
    studentSelect.disabled = students.length === 0;

    const exams = JSON.parse(localStorage.getItem('exams') || '[]');
    examSelect.innerHTML = '<option value="">Select exam</option>';
    exams.forEach(exam => {
        const option = document.createElement('option');
        option.value = exam.id;
        option.textContent = exam.name;
        option.dataset.examName = exam.name;
        examSelect.appendChild(option);
    });
    examSelect.disabled = exams.length === 0;
}

function renderInternalMarksTable(presetEntries) {
    const tbody = document.querySelector('#internalMarksTable tbody');
    if (!tbody) return;
    const { assignedUSNs } = getAssignedContext();
    const entries = presetEntries || getInternalMarksStore();
    const filtered = entries
        .filter(entry => assignedUSNs.includes(entry.usn))
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No entries recorded yet</td></tr>';
        return;
    }

    const formatTime = (iso) => {
        const date = new Date(iso);
        return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
    };

    tbody.innerHTML = '';
    filtered.slice(0, 10).forEach(entry => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${entry.studentName || entry.usn}</td>
            <td>${entry.examName || entry.examId}</td>
            <td><span class="tag-pill">${entry.component}</span></td>
            <td>${entry.marks}/${entry.maxMarks || 50}</td>
            <td>${formatTime(entry.updatedAt)}</td>
        `;
        tbody.appendChild(tr);
    });
}

function setupInternalMarksForm() {
    const form = document.getElementById('internalMarksForm');
    if (!form || form.dataset.bound === 'true') return;
    form.dataset.bound = 'true';
    form.addEventListener('submit', handleInternalMarksSubmit);
}

function handleInternalMarksSubmit(event) {
    event.preventDefault();
    const studentSelect = document.getElementById('internalStudentSelect');
    const examSelect = document.getElementById('internalExamSelect');
    const componentSelect = document.getElementById('internalComponent');
    const scoreInput = document.getElementById('internalScore');
    const statusEl = document.getElementById('internalMarksStatus');
    const form = event.target;

    if (!studentSelect || !examSelect || !componentSelect || !scoreInput) return;

    const usn = studentSelect.value;
    const examId = examSelect.value;
    const component = componentSelect.value;
    const marks = Number(scoreInput.value);

    if (!usn || !examId || Number.isNaN(marks)) {
        if (statusEl) statusEl.textContent = 'Fill all fields before saving.';
        return;
    }

    const { proctorId, assignedStudents } = getAssignedContext();
    const exams = JSON.parse(localStorage.getItem('exams') || '[]');
    const student = assignedStudents.find(s => s.usn === usn);
    const exam = exams.find(e => e.id === examId);

    const entry = {
        id: crypto.randomUUID ? crypto.randomUUID() : `mark_${Date.now()}`,
        usn,
        studentName: student ? student.fullName : usn,
        examId,
        examName: exam ? exam.name : examId,
        component,
        marks,
        maxMarks: 50,
        updatedBy: proctorId,
        updatedAt: new Date().toISOString()
    };

    const store = getInternalMarksStore();
    store.unshift(entry);
    setInternalMarksStore(store);
    renderInternalMarksTable(store);

    form.reset();
    if (statusEl) {
        statusEl.textContent = 'Internal marks saved';
        statusEl.classList.add('success');
        setTimeout(() => {
            statusEl.textContent = '';
            statusEl.classList.remove('success');
        }, 2500);
    }
}

function seedIfEmpty() {
    if (!localStorage.getItem('students')) {
        const seed = [
            { usn:'ENG2026001', fullName:'Alice Johnson', gsuite:'alice@college.edu', phone:'9876543210', parentName:'Mr. Johnson', parentPhone:'9876543200', dept:'CSE', sem:'4', sec:'A' },
            { usn:'ENG2026002', fullName:'Bob Williams', gsuite:'bob@college.edu', phone:'9876543211', parentName:'Mr. Williams', parentPhone:'9876543201', dept:'CSE', sem:'4', sec:'A' },
            { usn:'ENG2026003', fullName:'Carol White', gsuite:'carol@college.edu', phone:'9876543212', parentName:'Mrs. White', parentPhone:'9876543202', dept:'CSE', sem:'4', sec:'B' }
        ];
        localStorage.setItem('students', JSON.stringify(seed));
    }
    if (!localStorage.getItem('proctors')) {
        const p = [
            { id:'EMP101', name:'Dr. Jane Smith', email:'proctor@college.edu', dept:'CSE' },
            { id:'EMP102', name:'Dr. John Wilson', email:'john@college.edu', dept:'CSE' }
        ];
        localStorage.setItem('proctors', JSON.stringify(p));
    }
    if (!localStorage.getItem('assignments')) {
        localStorage.setItem('assignments', JSON.stringify([]));
    }
    if (!localStorage.getItem('exams')) {
        const exams = [
            { id:'EX001', name:'Data Structures', date:'2026-02-15', time:'10:00 AM', duration:'2 hrs' },
            { id:'EX002', name:'Database Management', date:'2026-02-20', time:'2:00 PM', duration:'2 hrs' }
        ];
        localStorage.setItem('exams', JSON.stringify(exams));
    }
    if (!localStorage.getItem('examResults')) {
        localStorage.setItem('examResults', JSON.stringify([]));
    }
    if (!localStorage.getItem(INTERNAL_MARKS_KEY)) {
        localStorage.setItem(INTERNAL_MARKS_KEY, JSON.stringify([]));
    }
}

function renderStudents() {
    const tbody = document.querySelector('#studentsTable tbody');
    if (!tbody) return;
    
    const { proctorId, assignedStudents } = getAssignedContext();
    if (!proctorId) {
        tbody.innerHTML = '<tr><td colspan="6">Proctor not found</td></tr>';
        populateInternalMarksFormOptions([]);
        renderInternalMarksTable([]);
        return;
    }
    
    const currentProctor = getCurrentProctorRecord();
    if (currentProctor) {
        document.getElementById('proctorInfo').textContent = `Welcome, ${currentProctor.name}! (${currentProctor.dept})`;
    }
    
    tbody.innerHTML = '';
    if (assignedStudents.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">No students assigned yet</td></tr>';
        populateInternalMarksFormOptions([]);
        renderInternalMarksTable([]);
        return;
    }
    
    assignedStudents.forEach(s => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${s.usn}</td>
                        <td><a href="student-detail.html?usn=${encodeURIComponent(s.usn)}">${s.fullName}</a></td>
                        <td>${s.gsuite}</td>
                        <td>${s.dept}</td>
                        <td>${s.phone}</td>
                        <td><button class="btn" onclick="viewStudentDetail('${s.usn}')">View Profile</button></td>`;
        tbody.appendChild(tr);
    });
    
    // Update stats
    document.getElementById('totalStudents').textContent = assignedStudents.length;

    populateInternalMarksFormOptions(assignedStudents);
    renderInternalMarksTable();
}

function getExamCompletionStats(examId, assignedUSNs, examResults) {
    const studentList = assignedUSNs || [];
    if (studentList.length === 0) {
        return { completed: 0, total: 0 };
    }
    const source = examResults || JSON.parse(localStorage.getItem('examResults') || '[]');
    const completedSet = new Set(
        source
            .filter(result => result.examId === examId && studentList.includes(result.usn))
            .map(result => result.usn)
    );
    return { completed: completedSet.size, total: studentList.length };
}

function renderExams() {
    const tbody = document.querySelector('#examsTable tbody');
    if (!tbody) return;
    
    const exams = JSON.parse(localStorage.getItem('exams') || '[]');
    const { assignedUSNs } = getAssignedContext();
    const examResults = JSON.parse(localStorage.getItem('examResults') || '[]');
    
    tbody.innerHTML = '';
    exams.forEach(exam => {
        const stats = getExamCompletionStats(exam.id, assignedUSNs, examResults);
        const allDone = stats.total > 0 && stats.completed === stats.total;
        const badgeClass = allDone ? 'status-active' : 'status-pending';
        const badgeLabel = stats.total === 0
            ? 'No Students'
            : allDone
                ? 'Completed'
                : `${stats.completed}/${stats.total} Done`;
        const disableDone = stats.total === 0 || allDone;

        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${exam.name}</td>
                        <td>${exam.date}</td>
                        <td>${exam.time}</td>
                        <td>${stats.total}</td>
                        <td><span class="status-badge ${badgeClass}">${badgeLabel}</span></td>
                        <td>
                            <div class="exam-actions">
                                <button class="btn" onclick="startMonitoring('${exam.id}')">Start Monitoring</button>
                                <button class="btn btn-success" onclick="markExamDone('${exam.id}')" ${disableDone ? 'disabled' : ''}>Mark Done</button>
                            </div>
                        </td>`;
        tbody.appendChild(tr);
    });
}

function renderReports() {
    const tbody = document.querySelector('#reportsTable tbody');
    if (!tbody) return;
    
    const examResults = JSON.parse(localStorage.getItem('examResults') || '[]');
    const { assignedUSNs, assignedStudents } = getAssignedContext();
    
    tbody.innerHTML = '';
    assignedStudents.forEach(s => {
        const studentResults = examResults.filter(r => r.usn === s.usn);
        const totalExams = studentResults.length;
        const avgScore = totalExams > 0 
            ? Math.round(studentResults.reduce((sum, r) => sum + r.score, 0) / totalExams)
            : 0;
        const passCount = studentResults.filter(r => r.score >= 40).length;
        const passStatus = totalExams > 0 
            ? passCount === totalExams ? 'All Passed' : `${passCount}/${totalExams} Passed`
            : 'No Exams';
        const lastExam = totalExams > 0 ? studentResults[studentResults.length - 1].examName : '--';
        
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${s.usn}</td>
                        <td>${s.fullName}</td>
                        <td>${totalExams}</td>
                        <td>${avgScore}%</td>
                        <td><span class="status-badge ${passCount === totalExams ? 'status-active' : 'status-pending'}">${passStatus}</span></td>
                        <td>${lastExam}</td>`;
        tbody.appendChild(tr);
    });
    
    // Update statistics
    const results = examResults.filter(r => assignedUSNs.includes(r.usn));
    const avgScoreAll = results.length > 0 
        ? Math.round(results.reduce((sum, r) => sum + r.score, 0) / results.length)
        : 0;
    const passRateAll = results.length > 0 
        ? Math.round((results.filter(r => r.score >= 40).length / results.length) * 100)
        : 0;
    
    document.getElementById('avgScore').textContent = avgScoreAll + '%';
    document.getElementById('passRate').textContent = passRateAll + '%';
}

function markExamDone(examId) {
    if (!examId) return;
    const { assignedStudents } = getAssignedContext();
    if (!assignedStudents || assignedStudents.length === 0) {
        alert('No students assigned to mark for this exam.');
        return;
    }

    const exams = JSON.parse(localStorage.getItem('exams') || '[]');
    const exam = exams.find(e => e.id === examId);
    if (!exam) {
        alert('Exam not found.');
        return;
    }

    const examResults = JSON.parse(localStorage.getItem('examResults') || '[]');
    const internalEntries = getInternalMarksStore();
    const proctor = getCurrentProctorRecord();
    let createdCount = 0;

    assignedStudents.forEach(student => {
        const alreadyRecorded = examResults.some(result => result.examId === examId && result.usn === student.usn);
        if (alreadyRecorded) return;

        const score = calculateExamScoreFromInternals(student.usn, examId, internalEntries);
        const remarks = score >= 85 ? 'Excellent' : score >= 60 ? 'Keep improving' : score >= 40 ? 'Pass' : 'Needs attention';

        examResults.push({
            id: crypto.randomUUID ? crypto.randomUUID() : `result_${Date.now()}_${student.usn}`,
            usn: student.usn,
            studentName: student.fullName,
            examId: exam.id,
            examName: exam.name,
            date: exam.date || new Date().toISOString().split('T')[0],
            score,
            remarks,
            invigilator: proctor ? proctor.name : 'Assigned Proctor'
        });
        createdCount++;
    });

    if (createdCount === 0) {
        alert('All assigned students are already marked done for this exam.');
        return;
    }

    localStorage.setItem('examResults', JSON.stringify(examResults));
    renderReports();
    renderExams();
    alert(`Marked ${createdCount} student(s) as done for ${exam.name}.`);
}

function viewStudentDetail(usn) {
    location.href = 'student-detail.html?usn=' + encodeURIComponent(usn);
}

function startMonitoring(examId) {
    alert('Starting exam monitoring for exam: ' + examId);
    // In a real app, this would open a monitoring interface
}

function loadAllData() {
    renderStudents();
    renderExams();
    renderReports();
    setupInternalMarksForm();
    
    // Default stats
    document.getElementById('examsConducted').textContent = '2';
}

seedIfEmpty();
loadAllData();