// ===============================================
// NITR CAMPUSCARE — STUDENT DASHBOARD SCRIPT
// ===============================================

let currentUser = null;

document.addEventListener("DOMContentLoaded", () => {

    async function initDashboard() {
        if (!supabaseClient) {
            console.error("Supabase client not found.");
            return;
        }

        try {
            const { data: { user }, error } = await supabaseClient.auth.getUser();

            if (error || !user) {
                window.location.href = "login.html";
                return;
            }

            const role = user.user_metadata?.role;
            if (role === 'admin' || role === 'teacher') {
                window.location.href = "teacher-dashboard.html";
                return;
            }

            currentUser = user;

            // Populate user profile info
            const metadata = user.user_metadata || {};
            const fullName = metadata.full_name || user.email.split('@')[0] || "Student";
            const rollNumber = metadata.roll_number || "NITR Student";
            const firstName = fullName.split(" ")[0];

            // Initials
            const nameParts = fullName.split(" ");
            const initials = nameParts.length > 1
                ? (nameParts[0][0] + nameParts[1][0]).toUpperCase()
                : fullName.slice(0, 2).toUpperCase();

            const userNameEl = document.getElementById("userName");
            const welcomeNameEl = document.getElementById("welcomeName");
            const profileNameEl = document.getElementById("profileName");
            const profileEmailEl = document.getElementById("profileEmail");
            const profileRollEl = document.getElementById("profileRoll");
            const profileAvatarEl = document.getElementById("profileAvatar");

            if (userNameEl) userNameEl.textContent = firstName;
            if (welcomeNameEl) welcomeNameEl.textContent = firstName;
            if (profileNameEl) profileNameEl.textContent = fullName;
            if (profileEmailEl) profileEmailEl.textContent = user.email || "";
            if (profileRollEl) profileRollEl.textContent = rollNumber;
            if (profileAvatarEl) profileAvatarEl.textContent = initials;

            // Load Complaints
            await loadComplaints(user);

            // Subscribe to realtime updates
            subscribeToComplaintChanges(user.id);

        } catch (err) {
            console.error("Dashboard init error:", err);
        }
    }

    initDashboard();

    // Logout
    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", async () => {
            if (window.CampusCare) {
                const confirmed = await CampusCare.confirmDialog({
                    title: "Sign Out",
                    message: "Are you sure you want to sign out of your CampusCare account?",
                    confirmLabel: "Sign Out",
                    cancelLabel: "Stay Signed In",
                    danger: true
                });
                if (!confirmed) return;
            }

            await supabaseClient.auth.signOut();
            window.location.href = "login.html";
        });
    }

});

// ===============================================
// LOAD COMPLAINTS & CALCULATE STATS
// ===============================================
async function loadComplaints(user) {
    try {
        const { data: complaints, error } = await supabaseClient
            .from("complaints")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false });

        if (error) {
            console.error("Complaint loading error:", error);
            if (window.CampusCare) CampusCare.toast("Couldn't load your complaints.", "error");
            return;
        }

        const complaintData = complaints || [];

        // Calculate statistics
        const stats = {
            total: complaintData.length,
            pending: 0,
            progress: 0,
            completed: 0
        };

        complaintData.forEach(c => {
            const s = (c.status || "").toLowerCase();
            if (s === "pending" || s === "submitted") stats.pending++;
            else if (s === "in progress") stats.progress++;
            else if (s === "completed" || s === "resolved") stats.completed++;
        });

        // Update DOM Counters
        const totalEl = document.getElementById("totalComplaints");
        const pendingEl = document.getElementById("pendingComplaints");
        const progressEl = document.getElementById("progressComplaints");
        const completedEl = document.getElementById("completedComplaints");

        if (totalEl) totalEl.textContent = stats.total;
        if (pendingEl) pendingEl.textContent = stats.pending;
        if (progressEl) progressEl.textContent = stats.progress;
        if (completedEl) completedEl.textContent = stats.completed;

        // Render Recent 5 Complaints
        displayRecentComplaints(complaintData.slice(0, 5));

    } catch (err) {
        console.error("Complaint error:", err);
    }
}

// ===============================================
// RENDER RECENT COMPLAINTS
// ===============================================
function displayRecentComplaints(recent) {
    const list = document.getElementById("complaintsList");
    if (!list) return;

    if (recent.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <div style="color: var(--slate-light); margin-bottom: 12px;">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin: 0 auto;"><path d="M9 2h6a1 1 0 0 1 1 1v2H8V3a1 1 0 0 1 1-1Z"/><path d="M8 4H6a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2"/></svg>
                </div>
                <h3 style="margin-bottom: 6px; font-size: 1.0625rem;">No grievances registered yet</h3>
                <p class="text-muted text-xs mb-4">When you submit maintenance issues, they will appear here with live tracking.</p>
                <a href="register-complaint.html" class="btn btn-primary btn-sm">+ File Your First Grievance</a>
            </div>
        `;
        return;
    }

    list.innerHTML = recent.map(complaint => {
        const status = complaint.status || "Submitted";
        const statusClass = getStatusClass(status);
        const shortId = String(complaint.id).slice(0, 8);

        return `
            <div class="complaint-item" onclick="window.location.href='complaint-details.html?id=${encodeURIComponent(complaint.id)}'">
                <div style="flex: 1; min-width: 0;">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px; flex-wrap: wrap;">
                        <span class="text-xs font-bold" style="color: var(--nitr-red); text-transform: uppercase; letter-spacing: 0.5px;">${escapeHTML(complaint.category || "General")}</span>
                        <span class="text-xs text-muted font-mono">#${shortId}</span>
                        <span class="text-xs text-muted">• ${formatDate(complaint.created_at)}</span>
                    </div>
                    <h3 class="truncate" style="font-size: 0.9375rem; color: var(--navy-900); font-weight: 600;">${escapeHTML(complaint.title || "Untitled Complaint")}</h3>
                </div>
                <span class="status-badge ${statusClass}">${escapeHTML(status)}</span>
            </div>
        `;
    }).join("");
}

// ===============================================
// REALTIME SUBSCRIPTION
// ===============================================
function subscribeToComplaintChanges(userId) {
    try {
        supabaseClient
            .channel("dashboard-complaints-" + userId)
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "complaints", filter: "user_id=eq." + userId },
                () => {
                    loadComplaints({ id: userId });
                    if (window.CampusCare) CampusCare.toast("Dashboard updated with live change.", "info", 2000);
                }
            )
            .subscribe();
    } catch (error) {
        console.warn("Realtime subscription unavailable:", error);
    }
}

// ===============================================
// UTILITIES
// ===============================================
function getStatusClass(status) {
    const s = String(status).toLowerCase();
    if (s === "pending") return "status-pending";
    if (s === "in progress") return "status-progress";
    if (s === "completed" || s === "resolved") return "status-resolved";
    if (s === "rejected") return "status-rejected";
    return "status-submitted";
}

function formatDate(dateString) {
    if (!dateString) return "";
    return new Date(dateString).toLocaleDateString("en-IN", {
        day: "numeric", month: "short", year: "numeric"
    });
}

function escapeHTML(value) {
    const div = document.createElement("div");
    div.textContent = String(value);
    return div.innerHTML;
}
