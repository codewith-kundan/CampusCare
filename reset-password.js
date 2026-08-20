// ========================================
// NITR CAMPUSCARE — RESET PASSWORD
// ========================================

let recoverySessionReady = false;

const resetForm = document.getElementById("resetForm");
const resetMessage = document.getElementById("resetMessage");
const resetSubmit = document.getElementById("resetSubmit");
const recoveryStatus = document.getElementById("recoveryStatus");

const newPasswordInput = document.getElementById("newPassword");
const confirmPasswordInput = document.getElementById("confirmPassword");
const passwordStrength = document.getElementById("passwordStrength");


// ========================================
// PASSWORD TOGGLE
// ========================================

const toggleNewPassword = document.getElementById("toggleNewPassword");

if (toggleNewPassword && newPasswordInput) {

    toggleNewPassword.addEventListener("click", () => {

        const showing = newPasswordInput.type === "text";

        newPasswordInput.type = showing ? "password" : "text";

        toggleNewPassword.querySelector(".eye-show").style.display = showing ? "" : "none";
        toggleNewPassword.querySelector(".eye-hide").style.display = showing ? "none" : "";
    });
}


// ========================================
// PASSWORD STRENGTH
// ========================================

if (newPasswordInput && passwordStrength) {

    newPasswordInput.addEventListener("input", () => {

        const value = newPasswordInput.value;
        let score = 0;

        if (value.length >= 6) score++;
        if (value.length >= 10) score++;
        if (/[A-Z]/.test(value) && /[0-9]/.test(value)) score++;
        if (/[^A-Za-z0-9]/.test(value)) score++;

        passwordStrength.dataset.level = value.length === 0 ? "0" : Math.max(1, score);
    });
}


// ========================================
// DETECT RECOVERY SESSION
// Supabase parses the recovery token from the
// URL automatically and fires PASSWORD_RECOVERY.
// ========================================

supabaseClient.auth.onAuthStateChange((event) => {

    if (event === "PASSWORD_RECOVERY") {
        recoverySessionReady = true;
    }
});

(async function checkExistingSession() {

    try {

        const { data: { session } } = await supabaseClient.auth.getSession();

        if (session) recoverySessionReady = true;

    } catch (error) {

        console.error("Session check failed:", error);
    }

})();

// If no recovery session shows up shortly, this link is
// likely invalid or expired — let the student know instead
// of leaving them on a form that will just fail.

setTimeout(() => {

    if (!recoverySessionReady && recoveryStatus) {
        recoveryStatus.classList.add("is-visible");
    }

}, 2500);


// ========================================
// SUBMIT
// ========================================

if (resetForm) {

    resetForm.addEventListener("submit", async (event) => {

        event.preventDefault();

        resetMessage.textContent = "";

        const newPassword = newPasswordInput.value;
        const confirmPassword = confirmPasswordInput.value;


        if (newPassword.length < 6) {

            resetMessage.textContent = "Password must contain at least 6 characters.";
            resetMessage.style.color = "#dc2626";
            return;
        }

        if (newPassword !== confirmPassword) {

            resetMessage.textContent = "Passwords do not match.";
            resetMessage.style.color = "#dc2626";
            return;
        }


        resetSubmit.disabled = true;
        resetSubmit.classList.add("is-loading");

        resetMessage.textContent = "Updating your password...";
        resetMessage.style.color = "#475569";


        try {

            const { error } = await supabaseClient.auth.updateUser({
                password: newPassword
            });

            if (error) {

                console.error("Password update error:", error);

                resetMessage.textContent = error.message;
                resetMessage.style.color = "#dc2626";

                if (window.CampusCare) CampusCare.toast(error.message, "error");

                return;
            }

            resetMessage.textContent = "Password updated! Redirecting to your dashboard...";
            resetMessage.style.color = "#16a34a";

            if (window.CampusCare) {
                CampusCare.toast("Password updated successfully.", "success");
            }

            setTimeout(() => {
                window.location.href = "dashboard.html";
            }, 1200);

        } catch (error) {

            console.error(error);

            resetMessage.textContent = "Something went wrong. Please try again.";
            resetMessage.style.color = "#dc2626";

        } finally {

            resetSubmit.disabled = false;
            resetSubmit.classList.remove("is-loading");
        }

    });

}
