// ===============================================
// NITR CAMPUSCARE — RESET PASSWORD SCRIPT
// ===============================================

let recoverySessionReady = false;

document.addEventListener("DOMContentLoaded", async () => {

    const resetForm = document.getElementById("resetForm");
    const resetMessage = document.getElementById("resetMessage");
    const resetSubmit = document.getElementById("resetSubmit");
    const recoveryStatus = document.getElementById("recoveryStatus");

    const newPasswordInput = document.getElementById("newPassword");
    const confirmPasswordInput = document.getElementById("confirmPassword");
    const passwordStrength = document.getElementById("passwordStrength");
    const toggleNewPassword = document.getElementById("toggleNewPassword");

    // ========================================
    // PASSWORD TOGGLE
    // ========================================
    if (toggleNewPassword && newPasswordInput) {
        toggleNewPassword.addEventListener("click", () => {
            const isText = newPasswordInput.type === "text";
            newPasswordInput.type = isText ? "password" : "text";

            const eyeShow = toggleNewPassword.querySelector(".eye-show");
            const eyeHide = toggleNewPassword.querySelector(".eye-hide");
            if (eyeShow && eyeHide) {
                eyeShow.style.display = isText ? "block" : "none";
                eyeHide.style.display = isText ? "none" : "block";
            }
        });
    }

    // ========================================
    // PASSWORD STRENGTH METER
    // ========================================
    if (newPasswordInput && passwordStrength) {
        newPasswordInput.addEventListener("input", () => {
            const val = newPasswordInput.value;
            let score = 0;
            if (val.length >= 6) score++;
            if (val.length >= 10) score++;
            if (/[A-Z]/.test(val) && /[0-9]/.test(val)) score++;
            if (/[^A-Za-z0-9]/.test(val)) score++;

            passwordStrength.dataset.level = val.length === 0 ? "0" : Math.max(1, score);
        });
    }

    // ========================================
    // URL HASH ERROR CHECK
    // ========================================
    const hash = window.location.hash;
    if (hash.includes("error_description=") || hash.includes("error=")) {
        const params = new URLSearchParams(hash.substring(1));
        const errorMsg = params.get("error_description") || "The password reset link is invalid or has expired.";
        if (recoveryStatus) {
            recoveryStatus.innerHTML = `
                <svg class="icon-sm" style="flex:none; color: var(--status-error-text);" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                <span>${decodeURIComponent(errorMsg.replace(/\+/g, ' '))}</span>
            `;
            recoveryStatus.style.background = "#FEE2E2";
            recoveryStatus.style.borderColor = "#FECACA";
            recoveryStatus.style.color = "#991B1B";
            recoveryStatus.classList.add("is-visible");
        }
        if (resetSubmit) resetSubmit.disabled = true;
        return;
    }

    // ========================================
    // RECOVERY SESSION DETECTION
    // ========================================
    if (supabaseClient) {
        supabaseClient.auth.onAuthStateChange((event, session) => {
            if (event === "PASSWORD_RECOVERY" || session) {
                recoverySessionReady = true;
                if (recoveryStatus) recoveryStatus.classList.remove("is-visible");
            }
        });

        try {
            const { data: { session } } = await supabaseClient.auth.getSession();
            if (session) {
                recoverySessionReady = true;
            }
        } catch (e) {
            console.warn("Session retrieval failed:", e);
        }
    }

    setTimeout(() => {
        if (!recoverySessionReady && recoveryStatus && !hash.includes("access_token")) {
            recoveryStatus.innerHTML = `
                <svg class="icon-sm" style="flex:none;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                <span>Notice: Make sure you opened this page from the email reset link.</span>
            `;
            recoveryStatus.classList.add("is-visible");
        }
    }, 2000);

    // ========================================
    // FORM SUBMISSION
    // ========================================
    if (resetForm) {
        resetForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            if (!supabaseClient) return;

            const newPassword = newPasswordInput?.value;
            const confirmPassword = confirmPasswordInput?.value;

            if (!newPassword || newPassword.length < 6) {
                if (resetMessage) {
                    resetMessage.textContent = "Password must be at least 6 characters long.";
                    resetMessage.className = "message text-red";
                }
                return;
            }

            if (newPassword !== confirmPassword) {
                if (resetMessage) {
                    resetMessage.textContent = "Passwords do not match.";
                    resetMessage.className = "message text-red";
                }
                return;
            }

            resetSubmit.disabled = true;
            resetSubmit.classList.add("is-loading");
            if (resetMessage) {
                resetMessage.textContent = "Updating password...";
                resetMessage.className = "message text-slate";
            }

            try {
                const { error } = await supabaseClient.auth.updateUser({
                    password: newPassword
                });

                if (error) throw error;

                if (resetMessage) {
                    resetMessage.textContent = "Password successfully updated! Redirecting...";
                    resetMessage.className = "message text-green font-bold";
                }

                if (window.CampusCare) {
                    CampusCare.toast("Password updated successfully.", "success");
                }

                setTimeout(() => {
                    window.location.href = "dashboard.html";
                }, 1000);

            } catch (err) {
                console.error("Password update error:", err);
                if (resetMessage) {
                    resetMessage.textContent = err.message || "Failed to update password.";
                    resetMessage.className = "message text-red";
                }
                if (window.CampusCare) CampusCare.toast(err.message || "Update failed.", "error");
            } finally {
                resetSubmit.disabled = false;
                resetSubmit.classList.remove("is-loading");
            }
        });
    }

});
