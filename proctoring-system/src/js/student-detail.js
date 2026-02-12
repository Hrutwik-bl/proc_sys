// Auth guard - ensure only proctors can access
(function ensureProctor(){
    const raw = localStorage.getItem('currentUser');
    if (!raw) {
        location.href = '../login.html';
        return;
    }
    const user = JSON.parse(raw);
    if (user.role !== 'proctor') {
        location.href = '../login.html';
    }
})();

const INTERNAL_MARKS_KEY = 'internalMarks';

function getQueryUSN(){
    const params = new URLSearchParams(location.search);
    return (params.get('usn') || '').trim();
}

function getStudentRecord(usn){
    const students = JSON.parse(localStorage.getItem('students') || '[]');
    const found = students.find(s => s.usn && s.usn.toLowerCase() === usn.toLowerCase());
    return found || null;
}

function renderStudentProfile(student){
    if (!student) return;
    const setText = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value || '--';
    };
    setText('studentName', student.fullName || '--');
    setText('studentStatus', `${student.dept || '--'} • Sem ${student.sem || '--'} ${student.sec || ''}`);
    setText('studentUSN', student.usn || '--');
    setText('studentDept', student.dept || '--');
    setText('studentSem', student.sem ? `Sem ${student.sem}` : '--');
    setText('studentEmail', student.gsuite || '--');
    setText('studentPhone', student.phone || '--');
    setText('studentSec', student.sec || '--');
    setText('studentParent', student.parentName || '--');
    setText('studentParentPhone', student.parentPhone || '--');
}

function getInternalMarksStore(){
    return JSON.parse(localStorage.getItem(INTERNAL_MARKS_KEY) || '[]');
}

function setInternalMarksStore(entries){
    localStorage.setItem(INTERNAL_MARKS_KEY, JSON.stringify(entries));
}

function renderStudentMarks(usn){
    const tbody = document.querySelector('#studentMarksTable tbody');
    if (!tbody) return;
    const entries = getInternalMarksStore()
        .filter(entry => entry.usn === usn)
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    if (entries.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No internal marks recorded yet</td></tr>';
        return;
    }

    const fmt = iso => new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
    tbody.innerHTML = '';
    entries.forEach(entry => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${entry.examName || entry.examId}</td>
            <td>${entry.component}</td>
            <td>${entry.marks}/${entry.maxMarks || 50}</td>
            <td>${fmt(entry.updatedAt)}</td>
            <td>
                <div class="action-buttons">
                    <button class="btn btn-outline" data-entry="${entry.id}" data-action="edit">Edit</button>
                    <button class="btn btn-danger" data-entry="${entry.id}" data-action="delete">Delete</button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function populateExamOptions(student){
    const select = document.getElementById('marksExamSelect');
    if (!select) return;
    const exams = JSON.parse(localStorage.getItem('exams') || '[]');
    select.innerHTML = '<option value="">Select exam</option>';
    exams.forEach(exam => {
        const option = document.createElement('option');
        option.value = exam.id;
        option.textContent = exam.name;
        option.dataset.examName = exam.name;
        select.appendChild(option);
    });
    if (student && student.defaultExam && !exams.some(e => e.id === student.defaultExam)) {
        const option = document.createElement('option');
        option.value = student.defaultExam;
        option.textContent = student.defaultExam;
        select.appendChild(option);
    }
}

function bindMarksTable(usn){
    const table = document.getElementById('studentMarksTable');
    if (!table) return;
    table.addEventListener('click', event => {
        const button = event.target.closest('button[data-entry]');
        if (!button) return;
        const entryId = button.getAttribute('data-entry');
        const action = button.getAttribute('data-action') || 'edit';
        if (action === 'delete') {
            deleteEntry(entryId, usn);
            return;
        }
        startEditEntry(entryId, usn);
    });
}

function deleteEntry(entryId, usn){
    if (!entryId) return;
    if (!confirm('Delete this internal entry?')) return;
    const store = getInternalMarksStore();
    const idx = store.findIndex(entry => entry.id === entryId && entry.usn === usn);
    if (idx === -1) return;
    store.splice(idx, 1);
    setInternalMarksStore(store);
    renderStudentMarks(usn);

    const editingId = document.getElementById('marksEntryId');
    if (editingId && editingId.value === entryId) {
        resetForm();
    }

    const status = document.getElementById('marksFormStatus');
    if (status) {
        status.textContent = 'Entry deleted.';
        status.classList.remove('success');
        setTimeout(() => {
            if (status.textContent === 'Entry deleted.') {
                status.textContent = '';
            }
        }, 2000);
    }
}

function startEditEntry(entryId, usn){
    const entry = getInternalMarksStore().find(e => e.id === entryId && e.usn === usn);
    if (!entry) return;
    const form = document.getElementById('studentMarksForm');
    if (!form) return;
    document.getElementById('marksEntryId').value = entry.id;
    const examSelect = document.getElementById('marksExamSelect');
    if (examSelect) {
        if (![...examSelect.options].some(o => o.value === entry.examId)) {
            const opt = document.createElement('option');
            opt.value = entry.examId;
            opt.textContent = entry.examName || entry.examId;
            examSelect.appendChild(opt);
        }
        examSelect.value = entry.examId;
    }
    document.getElementById('marksComponent').value = entry.component;
    document.getElementById('marksScore').value = entry.marks;
    document.getElementById('marksFormTitle').textContent = 'Edit Internal Entry';
    const status = document.getElementById('marksFormStatus');
    if (status) status.textContent = `Editing record from ${new Date(entry.updatedAt).toLocaleString()}`;
}

function resetForm(){
    const form = document.getElementById('studentMarksForm');
    if (!form) return;
    form.reset();
    document.getElementById('marksEntryId').value = '';
    document.getElementById('marksFormTitle').textContent = 'Add Internal Entry';
    const status = document.getElementById('marksFormStatus');
    if (status) status.textContent = '';
}

function handleFormSubmit(event){
    event.preventDefault();
    const usn = getQueryUSN();
    if (!usn) return;
    const student = getStudentRecord(usn);
    if (!student) return;

    const entryId = document.getElementById('marksEntryId').value;
    const examSelect = document.getElementById('marksExamSelect');
    const componentSelect = document.getElementById('marksComponent');
    const scoreInput = document.getElementById('marksScore');
    const status = document.getElementById('marksFormStatus');

    const examId = examSelect.value;
    const examName = examSelect.selectedOptions[0]?.dataset.examName || examSelect.selectedOptions[0]?.textContent || examId;
    const component = componentSelect.value;
    const marks = Number(scoreInput.value);

    if (!examId || Number.isNaN(marks)) {
        if (status) status.textContent = 'Select exam and enter valid marks.';
        return;
    }

    const store = getInternalMarksStore();
    if (entryId) {
        const idx = store.findIndex(e => e.id === entryId && e.usn === usn);
        if (idx !== -1) {
            store[idx] = {
                ...store[idx],
                examId,
                examName,
                component,
                marks,
                updatedAt: new Date().toISOString()
            };
        }
    } else {
        store.unshift({
            id: crypto.randomUUID ? crypto.randomUUID() : `mark_${Date.now()}`,
            usn,
            studentName: student.fullName || usn,
            examId,
            examName,
            component,
            marks,
            maxMarks: 50,
            updatedAt: new Date().toISOString(),
            updatedBy: getCurrentProctorId()
        });
    }

    setInternalMarksStore(store);
    renderStudentMarks(usn);
    resetForm();
    if (status) {
        status.textContent = 'Marks saved successfully.';
        status.classList.add('success');
        setTimeout(() => {
            status.textContent = '';
            status.classList.remove('success');
        }, 2500);
    }
}

function getCurrentProctorId(){
    const raw = localStorage.getItem('currentUser');
    if (!raw) return null;
    const user = JSON.parse(raw);
    const proctors = JSON.parse(localStorage.getItem('proctors') || '[]');
    const proctor = proctors.find(p => p.email === user.email);
    return proctor ? proctor.id : null;
}

function initDetailPage(){
    const usn = getQueryUSN();
    if (!usn) {
        alert('No student selected.');
        location.href = 'proctor-dashboard.html';
        return;
    }
    const student = getStudentRecord(usn);
    if (!student) {
        alert('Student not found.');
        location.href = 'proctor-dashboard.html';
        return;
    }
    renderStudentProfile(student);
    populateExamOptions(student);
    renderStudentMarks(student.usn);
    bindMarksTable(student.usn);

    const form = document.getElementById('studentMarksForm');
    if (form) form.addEventListener('submit', handleFormSubmit);
    const resetBtn = document.getElementById('resetFormBtn');
    if (resetBtn) resetBtn.addEventListener('click', resetForm);
    const newBtn = document.getElementById('newEntryBtn');
    if (newBtn) newBtn.addEventListener('click', resetForm);
}

document.addEventListener('DOMContentLoaded', initDetailPage);
