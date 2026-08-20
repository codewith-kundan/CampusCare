// ===============================
// NITR CAMPUSCARE — LANDING PAGE
// ===============================

document.addEventListener("DOMContentLoaded", () => {


    // ========================================
    // HERO 3D / NETWORK VISUAL
    // ========================================

    const heroCanvas = document.querySelector("[data-hero-canvas]");

    if (heroCanvas && window.CampusCare) {
        window.CampusCare.initHeroVisual(heroCanvas);
    }


    // ========================================
    // FAQ ACCORDION
    // ========================================

    document.querySelectorAll(".faq-item").forEach(item => {

        const question = item.querySelector(".faq-question");

        question.addEventListener("click", () => {

            const isOpen = item.classList.contains("is-open");

            document.querySelectorAll(".faq-item.is-open").forEach(open => {
                if (open !== item) open.classList.remove("is-open");
            });

            item.classList.toggle("is-open", !isOpen);
        });
    });


    // ========================================
    // LITE VIDEO EMBED
    // (loads the YouTube iframe only once clicked)
    // ========================================

    const playVideoBtn = document.getElementById("playVideoBtn");
    const videoFrame = document.getElementById("videoFrame");

    if (playVideoBtn && videoFrame) {

        playVideoBtn.addEventListener("click", () => {

            const iframe = document.createElement("iframe");

            iframe.src = "https://www.youtube.com/embed/W1uMJ794q2g?autoplay=1&rel=0";
            iframe.title = "NIT Rourkela Campus Tour";
            iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
            iframe.allowFullscreen = true;

            videoFrame.innerHTML = "";
            videoFrame.appendChild(iframe);
        });
    }


    // ========================================
    // AUTH-AWARE ROUTING
    // "Report an issue" / "Track complaint" need
    // a signed-in student, so check session first
    // instead of showing a dead-end alert.
    // ========================================

    async function isSignedIn() {

        if (typeof supabaseClient === "undefined") return false;

        try {

            const { data: { user } } = await supabaseClient.auth.getUser();
            return !!user;

        } catch (error) {

            console.error("Session check failed:", error);
            return false;
        }
    }

    async function goToRegister() {

        if (await isSignedIn()) {
            window.location.href = "register-complaint.html";
            return;
        }

        CampusCare.toast("Please sign in first to register a complaint.", "info");

        setTimeout(() => { window.location.href = "login.html"; }, 900);
    }

    async function goToTrack(rawId) {

        const signedIn = await isSignedIn();

        if (!signedIn) {
            CampusCare.toast("Sign in to track your complaints.", "info");
            setTimeout(() => { window.location.href = "login.html"; }, 900);
            return;
        }

        const id = (rawId || "").trim();

        if (id) {
            window.location.href = "complaint-details.html?id=" + encodeURIComponent(id);
        } else {
            window.location.href = "my-complaints.html";
        }
    }

    const reportIssueBtn = document.getElementById("reportIssueBtn");
    const registerNavBtn = document.getElementById("registerNavBtn");
    const ctaRegisterBtn = document.getElementById("ctaRegisterBtn");
    const footerReportLink = document.getElementById("footerReportLink");

    [reportIssueBtn, registerNavBtn, ctaRegisterBtn, footerReportLink].forEach(btn => {
        if (btn) btn.addEventListener("click", (e) => { e.preventDefault(); goToRegister(); });
    });

    const trackHeroBtn = document.getElementById("trackHeroBtn");
    const footerTrackLink = document.getElementById("footerTrackLink");
    const trackForm = document.getElementById("trackForm");
    const trackInput = document.getElementById("trackInput");

    if (trackHeroBtn) {
        trackHeroBtn.addEventListener("click", () => goToTrack(trackInput ? trackInput.value : ""));
    }

    if (footerTrackLink) {
        footerTrackLink.addEventListener("click", (e) => { e.preventDefault(); goToTrack(""); });
    }

    if (trackForm) {
        trackForm.addEventListener("submit", (e) => {
            e.preventDefault();
            goToTrack(trackInput ? trackInput.value : "");
        });
    }

    const footerFaqLink = document.getElementById("footerFaqLink");
    if (footerFaqLink) {
        footerFaqLink.addEventListener("click", (e) => {
            e.preventDefault();
            document.querySelector(".faq")?.scrollIntoView({ behavior: "smooth" });
        });
    }

});
