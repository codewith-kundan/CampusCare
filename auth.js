// ===============================================
// NITR CAMPUSCARE — AUTHENTICATION SCRIPT
// ===============================================

document.addEventListener("DOMContentLoaded", () => {

    // ========================================
    // HERO VISUAL (Lightweight Canvas Background)
    // ========================================
    const canvas = document.querySelector("[data-hero-canvas]");
    if (canvas && window.CampusCare && typeof window.CampusCare.initHeroVisual === 'function') {
        window.CampusCare.initHeroVisual(canvas, { force2D: true });
    }

    // ========================================
    // REMEMBERED EMAIL RESTORE
    // ========================================
    const emailInput = document.getElementById("email");
    const rememberCheckbox = document.getElementById("remember");

    try {
        const savedEmail = localStorage.getItem("campuscare_remembered_email");
        if (savedEmail && emailInput) {
            emailInput.value = savedEmail;
            if (rememberCheckbox) rememberCheckbox.checked = true;
        }
    } catch (e) {
        console.warn("Storage access not available:", e);
    }

    // ========================================
    // PASSWORD VISIBILITY TOGGLE
    // ========================================
    const togglePassword = document.getElementById("togglePassword");
    const passwordInput = document.getElementById("password");

    if (togglePassword && passwordInput) {
        togglePassword.addEventListener("click", () => {
            const isText = passwordInput.type === "text";
            passwordInput.type = isText ? "password" : "text";

            const eyeShow = togglePassword.querySelector(".eye-show");
            const eyeHide = togglePassword.querySelector(".eye-hide");
            if (eyeShow && eyeHide) {
                eyeShow.style.display = isText ? "block" : "none";
                eyeHide.style.display = isText ? "none" : "block";
            }
            togglePassword.setAttribute("aria-label", isText ? "Show password" : "Hide password");
        });
    }

    // ========================================
    // PASSWORD STRENGTH METER
    // ========================================
    const registerPasswordInput = document.getElementById("registerPassword");
    const passwordStrength = document.getElementById("passwordStrength");

    if (registerPasswordInput && passwordStrength) {
        registerPasswordInput.addEventListener("input", () => {
            const val = registerPasswordInput.value;
            let score = 0;
            if (val.length >= 6) score++;
            if (val.length >= 10) score++;
            if (/[A-Z]/.test(val) && /[0-9]/.test(val)) score++;
            if (/[^A-Za-z0-9]/.test(val)) score++;

            passwordStrength.dataset.level = val.length === 0 ? "0" : Math.max(1, score);
        });
    }

    // ========================================
    // FORM SWITCHING (LOGIN <-> REGISTER)
    // ========================================
    const showRegisterBtn = document.getElementById("showRegister");
    const showLoginBtn = document.getElementById("showLogin");
    const loginSection = document.getElementById("loginSection");
    const registerSection = document.getElementById("registerSection");

    if (showRegisterBtn && showLoginBtn && loginSection && registerSection) {
        showRegisterBtn.addEventListener("click", () => {
            loginSection.classList.add("hidden");
            registerSection.classList.remove("hidden");
        });

        showLoginBtn.addEventListener("click", () => {
            registerSection.classList.add("hidden");
            loginSection.classList.remove("hidden");
        });
    }

    // ========================================
    // SIGN IN SUBMISSION
    // ========================================
    const loginForm = document.getElementById("loginForm");
    const loginSubmitBtn = document.getElementById("loginSubmit");
    const loginMessage = document.getElementById("loginMessage");

    if (loginForm) {
        loginForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            if (!supabaseClient) {
                if (window.CampusCare) CampusCare.toast("Authentication service unavailable.", "error");
                return;
            }

            const email = emailInput?.value.trim();
            const password = passwordInput?.value;

            if (!email || !password) {
                if (loginMessage) {
                    loginMessage.textContent = "Please enter both email and password.";
                    loginMessage.className = "message text-red";
                }
                return;
            }

            // Save or clear remembered email
            try {
                if (rememberCheckbox?.checked) {
                    localStorage.setItem("campuscare_remembered_email", email);
                } else {
                    localStorage.removeItem("campuscare_remembered_email");
                }
            } catch (err) {}

            loginSubmitBtn.disabled = true;
            loginSubmitBtn.classList.add("is-loading");
            if (loginMessage) {
                loginMessage.textContent = "Signing in...";
                loginMessage.className = "message text-slate";
            }

            try {
                const { data, error } = await supabaseClient.auth.signInWithPassword({
                    email: email,
                    password: password
                });

                if (error) {
                    throw error;
                }

                if (loginMessage) {
                    loginMessage.textContent = "Login successful! Redirecting...";
                    loginMessage.className = "message text-green font-bold";
                }

                if (window.CampusCare) CampusCare.toast("Signed in successfully!", "success");

                setTimeout(() => {
                    const role = data.user?.user_metadata?.role;
                    if (role === 'admin' || role === 'teacher') {
                        window.location.href = "teacher-dashboard.html";
                    } else {
                        window.location.href = "dashboard.html";
                    }
                }, 600);

            } catch (err) {
                console.error("Login failed:", err);
                const msg = err.message || "Failed to sign in. Please check credentials.";
                if (loginMessage) {
                    loginMessage.textContent = msg;
                    loginMessage.className = "message text-red";
                }
                if (window.CampusCare) CampusCare.toast(msg, "error");
            } finally {
                loginSubmitBtn.disabled = false;
                loginSubmitBtn.classList.remove("is-loading");
            }
        });
    }

    // ========================================
    // SIGN UP SUBMISSION
    // ========================================
    const registerForm = document.getElementById("registerForm");
    const registerSubmitBtn = document.getElementById("registerSubmit");
    const registerMessage = document.getElementById("registerMessage");

    if (registerForm) {
        registerForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            if (!supabaseClient) return;

            const name = document.getElementById("registerName")?.value.trim();
            const email = document.getElementById("registerEmail")?.value.trim();
            const rollNumber = document.getElementById("rollNumber")?.value.trim();
            const password = registerPasswordInput?.value;

            if (!name || !email || !rollNumber || !password) {
                if (registerMessage) {
                    registerMessage.textContent = "Please fill in all fields.";
                    registerMessage.className = "message text-red";
                }
                return;
            }

            if (!email.toLowerCase().endsWith("@nitrkl.ac.in")) {
                if (registerMessage) {
                    registerMessage.textContent = "Please use your official @nitrkl.ac.in email address.";
                    registerMessage.className = "message text-red";
                }
                if (window.CampusCare) CampusCare.toast("Official @nitrkl.ac.in email required.", "warning");
                return;
            }

            if (password.length < 6) {
                if (registerMessage) {
                    registerMessage.textContent = "Password must be at least 6 characters long.";
                    registerMessage.className = "message text-red";
                }
                return;
            }

            registerSubmitBtn.disabled = true;
            registerSubmitBtn.classList.add("is-loading");
            if (registerMessage) {
                registerMessage.textContent = "Creating your account...";
                registerMessage.className = "message text-slate";
            }

            try {
                const { data, error } = await supabaseClient.auth.signUp({
                    email: email,
                    password: password,
                    options: {
                        data: {
                            full_name: name,
                            roll_number: rollNumber,
                            role: 'student'
                        }
                    }
                });

                if (error) throw error;

                if (registerMessage) {
                    registerMessage.textContent = "Account created! Check your email to verify and sign in.";
                    registerMessage.className = "message text-green font-bold";
                }

                if (window.CampusCare) {
                    CampusCare.toast("Account created! Please check your email to verify.", "success", 5000);
                }

                registerForm.reset();
                if (passwordStrength) passwordStrength.dataset.level = "0";

            } catch (err) {
                console.error("Sign up failed:", err);
                const msg = err.message || "Failed to create account.";
                if (registerMessage) {
                    registerMessage.textContent = msg;
                    registerMessage.className = "message text-red";
                }
                if (window.CampusCare) CampusCare.toast(msg, "error");
            } finally {
                registerSubmitBtn.disabled = false;
                registerSubmitBtn.classList.remove("is-loading");
            }
        });
    }

    // ========================================
    // FORGOT PASSWORD
    // ========================================
    const forgotPasswordBtn = document.getElementById("forgotPassword");
    if (forgotPasswordBtn) {
        forgotPasswordBtn.addEventListener("click", async (e) => {
            e.preventDefault();
            const email = emailInput?.value.trim();

            if (!email) {
                if (window.CampusCare) {
                    CampusCare.toast("Please enter your email in the field above first.", "info");
                }
                emailInput?.focus();
                return;
            }

            try {
                const redirectUrl = window.location.origin + "/reset-password.html";
                const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
                    redirectTo: redirectUrl
                });

                if (error) throw error;

                if (window.CampusCare) {
                    CampusCare.toast("Password reset instructions sent to your email.", "success", 5000);
                }
            } catch (err) {
                console.error("Password reset error:", err);
                if (window.CampusCare) {
                    CampusCare.toast(err.message || "Could not send reset instructions.", "error");
                }
            }
        });
    }

});
