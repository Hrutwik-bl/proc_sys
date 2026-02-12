/* ===================================================
   SKIT Proctoring System — Login Page Interactions
   =================================================== */

document.addEventListener('DOMContentLoaded', () => {

    // ─── Role tabs ─────────────────────────────────
    const roleTabs = document.querySelectorAll('.role-tab');
    const roleInput = document.getElementById('role');
    const emailInput = document.getElementById('email');

    roleTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            roleTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            roleInput.value = tab.dataset.role;

            // Update placeholder based on role
            const placeholders = {
                student: 'Enter USN or Email',
                proctor: 'Enter Proctor ID or Email',
                admin: 'Enter Admin Email'
            };
            emailInput.placeholder = placeholders[tab.dataset.role] || 'Enter USN or Email';

            // Subtle animation
            emailInput.style.transition = 'none';
            emailInput.style.transform = 'scale(0.98)';
            requestAnimationFrame(() => {
                emailInput.style.transition = 'transform .2s ease';
                emailInput.style.transform = 'scale(1)';
            });
        });
    });

    // ─── Password toggle ───────────────────────────
    const toggleBtn = document.querySelector('.toggle-password');
    const passwordInput = document.getElementById('password');
    if (toggleBtn && passwordInput) {
        toggleBtn.addEventListener('click', () => {
            const isPassword = passwordInput.type === 'password';
            passwordInput.type = isPassword ? 'text' : 'password';
            toggleBtn.innerHTML = isPassword
                ? '<i class="fa-solid fa-eye-slash"></i>'
                : '<i class="fa-solid fa-eye"></i>';
        });
    }

    // ─── Demo credentials toggle ───────────────────
    const demoToggle = document.querySelector('.demo-toggle');
    const demoBody = document.querySelector('.demo-body');

    // ─── Forgot password ───────────────────────────
    const forgotLink = document.querySelector('.forgot-link');
    if (forgotLink) {
        forgotLink.addEventListener('click', (e) => {
            e.preventDefault();
            showToast('Please contact your administrator to reset your password.', 'warning');
        });
    }

    if (demoToggle && demoBody) {
        demoToggle.addEventListener('click', () => {
            demoToggle.classList.toggle('open');
            demoBody.classList.toggle('open');
        });
    }

    // ─── Click demo item to auto-fill ──────────────
    const demoItems = document.querySelectorAll('.demo-item');
    demoItems.forEach(item => {
        item.addEventListener('click', () => {
            const email = item.dataset.email;
            const pass = item.dataset.pass;
            const role = item.dataset.role;

            if (emailInput) emailInput.value = email;
            if (passwordInput) passwordInput.value = pass;

            // Activate matching role tab
            roleTabs.forEach(t => {
                t.classList.toggle('active', t.dataset.role === role);
            });
            if (roleInput) roleInput.value = role;

            showToast('Credentials filled! Click Sign In to continue.', 'success');
        });
    });

    // ─── Toast notification helper ─────────────────
    function showToast(message, type = 'error') {
        // Remove existing toasts
        document.querySelectorAll('.toast').forEach(t => t.remove());

        const icons = {
            error: 'fa-circle-xmark',
            success: 'fa-circle-check',
            warning: 'fa-triangle-exclamation'
        };

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `<i class="fa-solid ${icons[type] || icons.error}"></i><span>${message}</span>`;
        document.body.appendChild(toast);

        requestAnimationFrame(() => {
            toast.classList.add('show');
        });

        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 400);
        }, 4000);
    }

    // ─── Form submit ───────────────────────────────
    const loginForm = document.getElementById('loginForm');
    const loginBtn = document.querySelector('.btn-login');

    loginForm.addEventListener('submit', function (e) {
        e.preventDefault();

        const input = emailInput.value.trim();
        const password = passwordInput.value;
        const role = roleInput.value;
        const remember = document.getElementById('remember').checked;

        if (!input || !password) {
            showToast('Please fill in all fields.', 'warning');
            return;
        }
        if (!role) {
            showToast('Please select a role.', 'warning');
            return;
        }

        // Show loading state
        loginBtn.classList.add('loading');
        loginBtn.disabled = true;

        // Simulate a brief delay for auth feel
        setTimeout(() => {
            let isValid = false;
            let userEmail = input;
            let userUSN = null;

            if (role === 'student') {
                const studentCreds = JSON.parse(localStorage.getItem('studentCredentials') || '[]');
                const students = JSON.parse(localStorage.getItem('students') || '[]');

                const cred = studentCreds.find(c =>
                    (c.email && c.email.toLowerCase() === input.toLowerCase()) ||
                    (c.usn && c.usn.toLowerCase() === input.toLowerCase())
                );

                if (cred && cred.password === password) {
                    const student = students.find(s => s.usn === cred.usn);
                    if (student) {
                        isValid = true;
                        userEmail = student.gsuite || input;
                        userUSN = student.usn;
                    }
                }
            } else if (role === 'proctor') {
                const proctorCreds = JSON.parse(localStorage.getItem('proctorCredentials') || '[]');
                const proctors = JSON.parse(localStorage.getItem('proctors') || '[]');

                const cred = proctorCreds.find(c =>
                    (c.email && c.email.toLowerCase() === input.toLowerCase()) ||
                    (c.id && c.id.toLowerCase() === input.toLowerCase())
                );

                if (cred && cred.password === password) {
                    const proctor = proctors.find(p => p.id === cred.id);
                    if (proctor) {
                        isValid = true;
                        userEmail = proctor.email;
                    }
                }
            } else if (role === 'admin') {
                if (input === 'admin@skit.org.in' && password === 'admin123') {
                    isValid = true;
                    userEmail = 'admin@skit.org.in';
                }
            }

            loginBtn.classList.remove('loading');
            loginBtn.disabled = false;

            if (isValid) {
                // Store user data
                const currentUserObj = {
                    email: userEmail,
                    role: role,
                    loginTime: new Date().toISOString()
                };
                if (userUSN) currentUserObj.usn = userUSN;

                localStorage.setItem('currentUser', JSON.stringify(currentUserObj));
                if (remember) localStorage.setItem('rememberEmail', input);

                showToast('Login successful! Redirecting...', 'success');

                // Add success animation to button
                loginBtn.style.background = 'linear-gradient(135deg, #10b981, #059669)';

                setTimeout(() => {
                    if (role === 'student') window.location.href = 'pages/student-dashboard.html';
                    else if (role === 'proctor') window.location.href = 'pages/proctor-dashboard.html';
                    else if (role === 'admin') window.location.href = 'pages/admin-dashboard.html';
                }, 800);
            } else {
                showToast('Invalid credentials! Please check your input and try again.', 'error');

                // Shake form
                loginForm.style.animation = 'shake .4s ease';
                setTimeout(() => loginForm.style.animation = '', 400);
            }
        }, 600);
    });

    // Shake animation (injected once)
    if (!document.getElementById('shake-style')) {
        const style = document.createElement('style');
        style.id = 'shake-style';
        style.textContent = `
            @keyframes shake {
                0%, 100% { transform: translateX(0); }
                20% { transform: translateX(-8px); }
                40% { transform: translateX(8px); }
                60% { transform: translateX(-6px); }
                80% { transform: translateX(6px); }
            }
        `;
        document.head.appendChild(style);
    }

    // ─── Pre-fill remembered email ─────────────────
    const rememberedInput = localStorage.getItem('rememberEmail');
    if (rememberedInput && emailInput) {
        emailInput.value = rememberedInput;
    }

    // ─── Input focus ripple effect ─────────────────
    document.querySelectorAll('.input-group input').forEach(input => {
        input.addEventListener('focus', () => {
            input.parentElement.classList.add('focused');
        });
        input.addEventListener('blur', () => {
            input.parentElement.classList.remove('focused');
        });
    });

});