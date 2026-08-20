// ========================================
// NITR CAMPUSCARE - SUPABASE AUTHENTICATION
// ========================================


// ========================================
// HERO VISUAL (lightweight 2D — this is a
// secondary page, the full 3D scene is reserved
// for the homepage hero)
// ========================================

document.addEventListener("DOMContentLoaded", () => {

    const canvas = document.querySelector("[data-hero-canvas]");

    if (canvas && window.CampusCare) {
        window.CampusCare.initHeroVisual(canvas, { force2D: true });
    }
});


// ========================================
// PASSWORD VISIBILITY
// ========================================

const togglePassword = document.getElementById("togglePassword");
const password = document.getElementById("password");

if (togglePassword && password) {

    togglePassword.addEventListener("click", () => {

        const showing = password.type === "text";

        password.type = showing ? "password" : "text";

        togglePassword.querySelector(".eye-show").style.display = showing ? "" : "none";
        togglePassword.querySelector(".eye-hide").style.display = showing ? "none" : "";

        togglePassword.setAttribute("aria-label", showing ? "Show password" : "Hide password");
    });
}


// ========================================
// PASSWORD STRENGTH METER
// ========================================

const registerPasswordInput = document.getElementById("registerPassword");
const passwordStrength = document.getElementById("passwordStrength");

if (registerPasswordInput && passwordStrength) {

    registerPasswordInput.addEventListener("input", () => {

        const value = registerPasswordInput.value;
        let score = 0;

        if (value.length >= 6) score++;
        if (value.length >= 10) score++;
        if (/[A-Z]/.test(value) && /[0-9]/.test(value)) score++;
        if (/[^A-Za-z0-9]/.test(value)) score++;

        passwordStrength.dataset.level = value.length === 0 ? "0" : Math.max(1, score);
    });
}


// ========================================
// FORM ELEMENTS
// ========================================

const showRegister = document.getElementById("showRegister");
const showLogin = document.getElementById("showLogin");

const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");

const registerBox = document.querySelector(".register-box");


// ========================================
// SWITCH TO REGISTER
// ========================================

if (showRegister) {

    showRegister.addEventListener("click", () => {

        loginForm.classList.add("hidden");
        registerBox.classList.add("hidden");
        registerForm.classList.remove("hidden");
    });
}


// ========================================
// SWITCH BACK TO LOGIN
// ========================================

if (showLogin) {

    showLogin.addEventListener("click", () => {

        registerForm.classList.add("hidden");
        loginForm.classList.remove("hidden");
        registerBox.classList.remove("hidden");
    });
}


// ========================================
// BUTTON LOADING STATE HELPER
// ========================================

function setLoading(button, loading) {

    if (!button) return;

    button.disabled = loading;
    button.classList.toggle("is-loading", loading);
}


// ========================================
// REGISTER
// ========================================

if (registerForm) {

    registerForm.addEventListener("submit", async (event) => {

        event.preventDefault();

        const message = document.getElementById("registerMessage");
        const submitBtn = document.getElementById("registerSubmit");

        const name =
            document.getElementById("registerName").value.trim();

        const email =
            document.getElementById("registerEmail").value.trim();

        const rollNumber =
            document.getElementById("rollNumber").value.trim();

        const registerPassword =
            document.getElementById("registerPassword").value;


        // Clear previous message

        message.textContent = "";
        message.style.color = "";


        // ========================================
        // NIT ROURKELA EMAIL CHECK
        // ========================================

        if (!email.toLowerCase().endsWith("@nitrkl.ac.in")) {

            message.textContent =
                "Please use your official NIT Rourkela email address.";

            message.style.color = "#dc2626";

            return;
        }


        // ========================================
        // PASSWORD CHECK
        // ========================================

        if (registerPassword.length < 6) {

            message.textContent =
                "Password must contain at least 6 characters.";

            message.style.color = "#dc2626";

            return;
        }


        // ========================================
        // ROLL NUMBER CHECK
        // ========================================

        if (rollNumber.length < 4) {

            message.textContent =
                "Please enter a valid roll number.";

            message.style.color = "#dc2626";

            return;
        }


        // ========================================
        // SHOW LOADING
        // ========================================

        setLoading(submitBtn, true);

        message.textContent = "Creating your account...";
        message.style.color = "#475569";


        try {

            // ========================================
            // SUPABASE SIGN UP
            // ========================================

            const { data, error } =
                await supabaseClient.auth.signUp({

                    email: email,

                    password: registerPassword,

                    options: {

                        data: {

                            full_name: name,

                            roll_number: rollNumber

                        }

                    }

                });


            // ========================================
            // ERROR
            // ========================================

            if (error) {

                console.error("Registration error:", error);

                message.textContent = error.message;

                message.style.color = "#dc2626";

                if (window.CampusCare) CampusCare.toast(error.message, "error");

                return;
            }


            // ========================================
            // SUCCESS
            // ========================================

            message.textContent =
                "Account created successfully! Check your email to verify your account.";

            message.style.color = "#16a34a";

            if (window.CampusCare) {
                CampusCare.toast("Account created — check your email to verify.", "success");
            }


            // Clear form

            registerForm.reset();
            if (passwordStrength) passwordStrength.dataset.level = "0";

        }

        catch (error) {

            console.error(error);

            message.textContent =
                "Something went wrong. Please try again.";

            message.style.color = "#dc2626";

        }

        finally {

            setLoading(submitBtn, false);
        }

    });

}


// ========================================
// LOGIN
// ========================================

if (loginForm) {

    loginForm.addEventListener("submit", async (event) => {

        event.preventDefault();


        const message =
            document.getElementById("loginMessage");

        const submitBtn =
            document.getElementById("loginSubmit");


        const email =
            document.getElementById("email").value.trim();


        const passwordValue =
            document.getElementById("password").value;


        setLoading(submitBtn, true);

        message.textContent =
            "Signing you in...";

        message.style.color =
            "#475569";


        try {

            // ========================================
            // SUPABASE LOGIN
            // ========================================

            const { data, error } =
                await supabaseClient.auth.signInWithPassword({

                    email: email,

                    password: passwordValue

                });


            // ========================================
            // LOGIN ERROR
            // ========================================

            if (error) {

                console.error("Login error:", error);

                message.textContent =
                    error.message;

                message.style.color =
                    "#dc2626";

                if (window.CampusCare) CampusCare.toast(error.message, "error");

                return;
            }


            // ========================================
            // LOGIN SUCCESS
            // ========================================

            message.textContent =
                "Login successful! Redirecting...";

            message.style.color =
                "#16a34a";


            console.log("Logged in user:", data.user);


            // ========================================
            // DASHBOARD REDIRECT
            // ========================================

            setTimeout(() => {

                window.location.href =
                    "dashboard.html";

            }, 800);

        }

        catch (error) {

            console.error(error);

            message.textContent =
                "Something went wrong. Please try again.";

            message.style.color =
                "#dc2626";

            setLoading(submitBtn, false);

        }

    });

}


// ========================================
// FORGOT PASSWORD
// ========================================

const forgotPassword =
    document.getElementById("forgotPassword");


if (forgotPassword) {

    forgotPassword.addEventListener("click", async (event) => {

        event.preventDefault();


        const email =
            document.getElementById("email").value.trim();


        if (!email) {

            if (window.CampusCare) {
                CampusCare.toast("Please enter your email address first.", "info");
            } else {
                alert("Please enter your email address first.");
            }

            return;
        }


        try {

            const { error } =
                await supabaseClient.auth.resetPasswordForEmail(

                    email,

                    {
                        redirectTo:
                            window.location.origin +
                            "/reset-password.html"
                    }

                );


            if (error) {

                if (window.CampusCare) CampusCare.toast(error.message, "error");
                else alert(error.message);

                return;
            }


            if (window.CampusCare) {
                CampusCare.toast("Password reset instructions sent to your email.", "success");
            } else {
                alert("Password reset instructions have been sent to your email.");
            }

        }

        catch (error) {

            console.error(error);

            if (window.CampusCare) {
                CampusCare.toast("Unable to send password reset email.", "error");
            } else {
                alert("Unable to send password reset email.");
            }

        }

    });

}
