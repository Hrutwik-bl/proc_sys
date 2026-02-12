// Auth guard - ONLY allow admin role
(function auth() {
    const cur = localStorage.getItem('currentUser');
    if (!cur) {
        location.href = '../login.html';
        return;
    }
    const user = JSON.parse(cur);
    if (user.role !== 'admin') {
        location.href = '../login.html';
    }
})();

function logout(e) {
    if(e) e.preventDefault();
    localStorage.removeItem('currentUser');
    location.href = '../login.html';
}

function switchAdminTab(tabName) {
    // Hide all tabs
    const tabs = document.querySelectorAll('.tab-content-admin');
    tabs.forEach(tab => tab.classList.remove('active'));
    
    // Remove active class from all buttons
    const buttons = document.querySelectorAll('.tab-btn');
    buttons.forEach(btn => btn.classList.remove('active'));
    
    // Show selected tab
    document.getElementById(tabName).classList.add('active');
    
    // Add active class to clicked button
    event.target.classList.add('active');
}

function seed() {
    if (!localStorage.getItem('students')) {
        const s = [
            { usn:'ENG2026001', fullName:'Alice Johnson', gsuite:'alice@college.edu', phone:'9876543210', parentName:'Mr. Johnson', parentPhone:'9876543200', dept:'CSE', sem:'4', sec:'A' },
            { usn:'ENG2026002', fullName:'Bob Williams', gsuite:'bob@college.edu', phone:'9876543211', parentName:'Mr. Williams', parentPhone:'9876543201', dept:'CSE', sem:'4', sec:'A' }
        ];
        localStorage.setItem('students', JSON.stringify(s));
    }
    if (!localStorage.getItem('proctors')) {
        const p = [
            { id:'EMP101', name:'Dr. Jane Smith', email:'proctor@college.edu', dept:'CSE' }
        ];
        localStorage.setItem('proctors', JSON.stringify(p));
    }
    if (!localStorage.getItem('assignments')) {
        localStorage.setItem('assignments', JSON.stringify([]));
    }
    if (!localStorage.getItem('studentCredentials')) {
        localStorage.setItem('studentCredentials', JSON.stringify([]));
    }
    if (!localStorage.getItem('proctorCredentials')) {
        localStorage.setItem('proctorCredentials', JSON.stringify([]));
    }
}

function generatePassword(length = 8) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$';
    let password = '';
    for (let i = 0; i < length; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
}

function getAssignedProctorName(usn) {
    const assignments = JSON.parse(localStorage.getItem('assignments') || '[]');
    const assignment = assignments.find(a => a.usn === usn);
    if (!assignment) return '--';
    const proctors = JSON.parse(localStorage.getItem('proctors') || '[]');
    const proctor = proctors.find(p => p.id === assignment.proctorId);
    return proctor ? proctor.name : '--';
}

function getAssignedStudentCount(proctorId) {
    const assignments = JSON.parse(localStorage.getItem('assignments') || '[]');
    return assignments.filter(a => a.proctorId === proctorId).length;
}

function render() {
    const sList = JSON.parse(localStorage.getItem('students') || '[]');
    const pList = JSON.parse(localStorage.getItem('proctors') || '[]');
    
    // Render students table
    const stBody = document.querySelector('#adminStudents tbody');
    stBody.innerHTML = '';
    sList.forEach(s => {
        const proctorName = getAssignedProctorName(s.usn);
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${s.usn}</td><td>${s.fullName}</td><td>${s.dept}</td><td>${s.sem}</td>
        <td><strong>${proctorName}</strong></td>
        <td><button class="btn" onclick="editStudent('${s.usn}')">Edit</button>
        <button class="btn btn-danger" onclick="deleteStudent('${s.usn}')">Delete</button></td>`;
        stBody.appendChild(tr);
    });
    
    // Render proctors table
    const prBody = document.querySelector('#adminProctors tbody');
    prBody.innerHTML = '';
    pList.forEach(p => {
        const count = getAssignedStudentCount(p.id);
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${p.id}</td><td>${p.name}</td><td>${p.dept}</td>
        <td><strong>${count}</strong></td>
        <td><button class="btn" onclick="editProctor('${p.id}')">Edit</button>
        <button class="btn btn-danger" onclick="deleteProctor('${p.id}')">Delete</button></td>`;
        prBody.appendChild(tr);
    });

    // Populate select dropdowns
    populateSelects();
    
    // Render assignments table
    renderAssignments();
    
    // Render credentials tables
    renderCredentials();
}

function populateSelects() {
    const sList = JSON.parse(localStorage.getItem('students') || '[]');
    const pList = JSON.parse(localStorage.getItem('proctors') || '[]');
    
    const studentSelect = document.getElementById('studentSelect');
    studentSelect.innerHTML = '<option value="">-- Choose Student --</option>';
    sList.forEach(s => {
        const option = document.createElement('option');
        option.value = s.usn;
        option.textContent = `${s.usn} - ${s.fullName}`;
        studentSelect.appendChild(option);
    });
    
    const proctorSelect = document.getElementById('proctorSelect');
    proctorSelect.innerHTML = '<option value="">-- Choose Proctor --</option>';
    pList.forEach(p => {
        const option = document.createElement('option');
        option.value = p.id;
        option.textContent = `${p.id} - ${p.name}`;
        proctorSelect.appendChild(option);
    });
}

function assignProctor() {
    const usn = document.getElementById('studentSelect').value;
    const proctorId = document.getElementById('proctorSelect').value;

    if (!usn || !proctorId) {
        alert('Please select both student and proctor!');
        return;
    }

    let assignments = JSON.parse(localStorage.getItem('assignments') || '[]');
    assignments = assignments.filter(a => a.usn !== usn);
    assignments.push({ usn, proctorId });
    
    localStorage.setItem('assignments', JSON.stringify(assignments));
    alert('Proctor assigned successfully!');
    
    document.getElementById('studentSelect').value = '';
    document.getElementById('proctorSelect').value = '';
    
    render();
}

function renderAssignments() {
    const tbody = document.querySelector('#assignmentsTable tbody');
    const assignments = JSON.parse(localStorage.getItem('assignments') || '[]');
    const students = JSON.parse(localStorage.getItem('students') || '[]');
    const proctors = JSON.parse(localStorage.getItem('proctors') || '[]');
    
    tbody.innerHTML = '';
    assignments.forEach(a => {
        const student = students.find(s => s.usn === a.usn);
        const proctor = proctors.find(p => p.id === a.proctorId);
        
        if (student && proctor) {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${student.usn}</td><td>${student.fullName}</td><td>${proctor.name}</td>
            <td><button class="btn btn-danger" onclick="removeAssignment('${a.usn}', '${a.proctorId}')">Remove</button></td>`;
            tbody.appendChild(tr);
        }
    });
    
    if (assignments.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center;">No assignments yet</td></tr>';
    }
}

function renderCredentials() {
    const students = JSON.parse(localStorage.getItem('students') || '[]');
    const proctors = JSON.parse(localStorage.getItem('proctors') || '[]');
    let studentCreds = JSON.parse(localStorage.getItem('studentCredentials') || '[]');
    let proctorCreds = JSON.parse(localStorage.getItem('proctorCredentials') || '[]');
    
    // Ensure credential entries exist but do NOT auto-generate passwords
    students.forEach(s => {
        if (!studentCreds.find(c => c.usn === s.usn)) {
            studentCreds.push({ usn: s.usn, email: s.gsuite || '', password: '' });
        }
    });
    proctors.forEach(p => {
        if (!proctorCreds.find(c => c.id === p.id)) {
            proctorCreds.push({ id: p.id, email: p.email || '', password: '' });
        }
    });

    // Render student credentials
    const stCredBody = document.querySelector('#studentCredentialsTable tbody');
    stCredBody.innerHTML = '';
    studentCreds.forEach(cred => {
        const student = students.find(s => s.usn === cred.usn) || {};
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${cred.usn}</td>
                        <td>${student.fullName || '--'}</td>
                        <td>${cred.email || '--'}</td>
                        <td><input id="pwd-st-${cred.usn}" type="text" value="${cred.password || ''}" style="width:140px;padding:6px;border:1px solid #ddd;border-radius:4px;" /></td>
                        <td>
                          <button class="btn" onclick="saveStudentPassword('${cred.usn}')">Save</button>
                          <button class="btn copy-btn" onclick="copyToClipboard(document.getElementById('pwd-st-${cred.usn}').value)">Copy</button>
                          <button class="btn btn-info" onclick="generateAndSetStudentPassword('${cred.usn}')">Generate</button>
                        </td>`;
        stCredBody.appendChild(tr);
    });
    localStorage.setItem('studentCredentials', JSON.stringify(studentCreds));
    
    // Render proctor credentials
    const prCredBody = document.querySelector('#proctorCredentialsTable tbody');
    prCredBody.innerHTML = '';
    proctorCreds.forEach(cred => {
        const proctor = proctors.find(p => p.id === cred.id) || {};
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${cred.id}</td>
                        <td>${proctor.name || '--'}</td>
                        <td>${cred.email || '--'}</td>
                        <td><input id="pwd-pr-${cred.id}" type="text" value="${cred.password || ''}" style="width:140px;padding:6px;border:1px solid #ddd;border-radius:4px;" /></td>
                        <td>
                          <button class="btn" onclick="saveProctorPassword('${cred.id}')">Save</button>
                          <button class="btn copy-btn" onclick="copyToClipboard(document.getElementById('pwd-pr-${cred.id}').value)">Copy</button>
                          <button class="btn btn-info" onclick="generateAndSetProctorPassword('${cred.id}')">Generate</button>
                        </td>`;
        prCredBody.appendChild(tr);
    });
    localStorage.setItem('proctorCredentials', JSON.stringify(proctorCreds));
}

// Save functions for admin-set passwords
function saveStudentPassword(usn) {
    const val = document.getElementById('pwd-st-' + usn).value.trim();
    if (val === '') { if (!confirm('Empty password — proceed?')) return; }
    let creds = JSON.parse(localStorage.getItem('studentCredentials') || '[]');
    const cred = creds.find(c => c.usn === usn);
    if (cred) {
        cred.password = val;
        localStorage.setItem('studentCredentials', JSON.stringify(creds));
        alert('Student password saved.');
    }
}

function saveProctorPassword(id) {
    const val = document.getElementById('pwd-pr-' + id).value.trim();
    if (val === '') { if (!confirm('Empty password — proceed?')) return; }
    let creds = JSON.parse(localStorage.getItem('proctorCredentials') || '[]');
    const cred = creds.find(c => c.id === id);
    if (cred) {
        cred.password = val;
        localStorage.setItem('proctorCredentials', JSON.stringify(creds));
        alert('Proctor password saved.');
    }
}

// Optional: admin-triggered generation (keeps ability to generate when admin wants)
function generateAndSetStudentPassword(usn) {
    const pwd = generatePassword();
    document.getElementById('pwd-st-' + usn).value = pwd;
    saveStudentPassword(usn);
}

function generateAndSetProctorPassword(id) {
    const pwd = generatePassword();
    document.getElementById('pwd-pr-' + id).value = pwd;
    saveProctorPassword(id);
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text);
    alert('Password copied to clipboard!');
}

function removeAssignment(usn, proctorId) {
    if (!confirm('Remove this assignment?')) return;
    let assignments = JSON.parse(localStorage.getItem('assignments') || '[]');
    assignments = assignments.filter(a => !(a.usn === usn && a.proctorId === proctorId));
    localStorage.setItem('assignments', JSON.stringify(assignments));
    render();
}

function editStudent(usn) {
    location.href = 'edit-student.html?usn=' + encodeURIComponent(usn);
}

function editProctor(id) {
    location.href = 'edit-proctor.html?id=' + encodeURIComponent(id);
}

function deleteStudent(usn) {
    if (!confirm('Delete student ' + usn + '?')) return;
    const list = JSON.parse(localStorage.getItem('students') || '[]').filter(x => x.usn !== usn);
    localStorage.setItem('students', JSON.stringify(list));
    
    let assignments = JSON.parse(localStorage.getItem('assignments') || '[]');
    assignments = assignments.filter(a => a.usn !== usn);
    localStorage.setItem('assignments', JSON.stringify(assignments));
    
    let creds = JSON.parse(localStorage.getItem('studentCredentials') || '[]');
    creds = creds.filter(c => c.usn !== usn);
    localStorage.setItem('studentCredentials', JSON.stringify(creds));
    
    render();
}

function deleteProctor(id) {
    if (!confirm('Delete proctor ' + id + '?')) return;
    const list = JSON.parse(localStorage.getItem('proctors') || '[]').filter(x => x.id !== id);
    localStorage.setItem('proctors', JSON.stringify(list));
    
    let assignments = JSON.parse(localStorage.getItem('assignments') || '[]');
    assignments = assignments.filter(a => a.proctorId !== id);
    localStorage.setItem('assignments', JSON.stringify(assignments));
    
    let creds = JSON.parse(localStorage.getItem('proctorCredentials') || '[]');
    creds = creds.filter(c => c.id !== id);
    localStorage.setItem('proctorCredentials', JSON.stringify(creds));
    
    render();
}

seed();
render();