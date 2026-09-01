// ===============================================
// NITR CAMPUSCARE — LANDING PAGE SCRIPT
// ===============================================

document.addEventListener("DOMContentLoaded", () => {

    // ========================================
    // HERO VISUAL (Node Network Canvas)
    // ========================================
    const heroCanvas = document.querySelector("[data-hero-canvas]");
    if (heroCanvas && window.CampusCare && typeof window.CampusCare.initHeroVisual === 'function') {
        window.CampusCare.initHeroVisual(heroCanvas);
    }

    // ========================================
    // DYNAMIC STATS FETCHING
    // ========================================
    async function loadStats() {
        if (typeof supabaseClient === "undefined" || !supabaseClient) return;

        try {
            // Count total
            const p1 = supabaseClient
                .from('complaints')
                .select('*', { count: 'exact', head: true });

            // Count pending / submitted
            const p2 = supabaseClient
                .from('complaints')
                .select('*', { count: 'exact', head: true })
                .in('status', ['Pending', 'Submitted']);

            // Count in progress
            const p3 = supabaseClient
                .from('complaints')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'In Progress');

            // Count resolved / completed
            const p4 = supabaseClient
                .from('complaints')
                .select('*', { count: 'exact', head: true })
                .in('status', ['Resolved', 'Completed']);

            const [totalRes, pendingRes, progRes, resRes] = await Promise.all([p1, p2, p3, p4]);

            const totalEl = document.getElementById('stat-registered');
            const pendingEl = document.getElementById('stat-pending');
            const progressEl = document.getElementById('stat-progress');
            const resolvedEl = document.getElementById('stat-resolved');

            if (totalEl && totalRes.count !== null) totalEl.textContent = totalRes.count || 0;
            if (pendingEl && pendingRes.count !== null) pendingEl.textContent = pendingRes.count || 0;
            if (progressEl && progRes.count !== null) progressEl.textContent = progRes.count || 0;
            if (resolvedEl && resRes.count !== null) resolvedEl.textContent = resRes.count || 0;

        } catch (error) {
            console.warn("Failed to load live stats:", error);
        }
    }

    loadStats();

    // ========================================
    // AUTH STATE & DYNAMIC ROUTING
    // ========================================
    async function checkUserSession() {
        if (typeof supabaseClient === "undefined" || !supabaseClient) return null;
        try {
            const { data: { user } } = await supabaseClient.auth.getUser();
            if (user) {
                const navLoginBtn = document.getElementById("navLoginBtn");
                if (navLoginBtn) {
                    const role = user.user_metadata?.role;
                    navLoginBtn.textContent = "Dashboard";
                    navLoginBtn.href = (role === 'admin' || role === 'teacher') ? "teacher-dashboard.html" : "dashboard.html";
                }
            }
            return user;
        } catch (e) {
            return null;
        }
    }

    checkUserSession();

    async function handleComplaintAction() {
        const user = await checkUserSession();
        if (user) {
            window.location.href = "register-complaint.html";
        } else {
            if (window.CampusCare) CampusCare.toast("Please sign in to register a complaint.", "info");
            setTimeout(() => { window.location.href = "login.html"; }, 800);
        }
    }

    const reportIssueBtn = document.getElementById("reportIssueBtn");
    const registerNavBtn = document.getElementById("registerNavBtn");
    const ctaRegisterBtn = document.getElementById("ctaRegisterBtn");

    [reportIssueBtn, registerNavBtn, ctaRegisterBtn].forEach(btn => {
        if (btn) {
            btn.addEventListener("click", (e) => {
                e.preventDefault();
                handleComplaintAction();
            });
        }
    });

    // ========================================
    // QUICK COMPLAINT TRACKER
    // ========================================
    const quickTrackForm = document.getElementById("quickTrackForm");
    const trackInput = document.getElementById("trackInput");

    if (quickTrackForm && trackInput) {
        quickTrackForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            let query = trackInput.value.trim().replace(/^#/, '');
            if (!query) return;

            const user = await checkUserSession();
            if (!user) {
                if (window.CampusCare) CampusCare.toast("Please sign in to view full complaint details.", "info");
                setTimeout(() => { window.location.href = "login.html"; }, 900);
                return;
            }

            // Redirect to complaint details
            window.location.href = `complaint-details.html?id=${encodeURIComponent(query)}`;
        });
    }

    // ========================================
    // FAQ ACCORDION
    // ========================================
    const faqItems = document.querySelectorAll(".faq-item");
    faqItems.forEach(item => {
        const questionBtn = item.querySelector(".faq-question");
        if (questionBtn) {
            questionBtn.addEventListener("click", () => {
                const isOpen = item.classList.contains("is-open");
                // Close others
                faqItems.forEach(other => other.classList.remove("is-open"));
                if (!isOpen) {
                    item.classList.add("is-open");
                }
            });
        }
    });

    // ========================================
    // CAMPUS VIDEO PLAYER
    // ========================================
    const playVideoBtn = document.getElementById("playVideoBtn");
    const videoFrame = document.querySelector(".video-frame");

    if (playVideoBtn && videoFrame) {
        playVideoBtn.addEventListener("click", () => {
            const youtubeId = "W1uMJ794q2g";
            videoFrame.innerHTML = `
                <iframe 
                    src="https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=1&rel=0" 
                    title="NIT Rourkela Campus Tour" 
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                    allowfullscreen>
                </iframe>
            `;
        });
    }

});
