// ===============================================
// NITR CAMPUSCARE — MY COMPLAINTS SCRIPT
// ===============================================

let allComplaints = [];
let currentUserId = null;

document.addEventListener("DOMContentLoaded", () => {
    loadComplaints();

    const searchInput = document.getElementById("searchInput");
    const statusFilter = document.getElementById("statusFilter");
    const categoryFilter = document.getElementById("categoryFilter");
    const sortFilter = document.getElementById("sortFilter");

    if (searchInput) searchInput.addEventListener("input", filterComplaints);
    if (statusFilter) statusFilter.addEventListener("change", filterComplaints);
    if (categoryFilter) categoryFilter.addEventListener("change", filterComplaints);
    if (sortFilter) sortFilter.addEventListener("change", filterComplaints);
});

// ===============================================
// LOAD COMPLAINTS
// ===============================================
async function loadComplaints() {
    const container = document.getElementById("complaintsContainer");
    if (!supabaseClient) return;

    try {
        const { data: { user }, error: userError } = await supabaseClient.auth.getUser();

        if (userError || !user) {
            window.location.href = "login.html";
            return;
        }

        currentUserId = user.id;

        const { data, error } = await supabaseClient
            .from("complaints")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false });

        if (error) {
            console.error("Complaint loading error:", error);
            showEmptyState(container, "Unable to load complaints", error.message);
            if (window.CampusCare) CampusCare.toast("Couldn't load your complaints.", "error");
            return;
        }

        allComplaints = data || [];
        filterComplaints();
        subscribeToComplaintChanges(user.id);

    } catch (error) {
        console.error("Complaint fetch error:", error);
        showEmptyState(container, "Something went wrong", "Please refresh the page to try again.");
    }
}

// ===============================================
// FILTER & SORT
// ===============================================
function filterComplaints() {
    const search = (document.getElementById("searchInput")?.value || "").toLowerCase().trim();
    const status = document.getElementById("statusFilter")?.value || "all";
    const category = document.getElementById("categoryFilter")?.value || "all";
    const sort = document.getElementById("sortFilter")?.value || "newest";

    let filtered = allComplaints.filter(complaint => {
        const title = String(complaint.title || "").toLowerCase();
        const description = String(complaint.description || "").toLowerCase();
        const shortId = String(complaint.id || "").toLowerCase();
        const complaintCategory = String(complaint.category || "");
        const complaintStatus = String(complaint.status || "");

        const matchesSearch = !search ||
            title.includes(search) ||
            description.includes(search) ||
            shortId.includes(search);

        let matchesStatus = true;
        if (status !== "all") {
            if (status === "Completed") {
                matchesStatus = (complaintStatus === "Completed" || complaintStatus === "Resolved");
            } else {
                matchesStatus = (complaintStatus.toLowerCase() === status.toLowerCase());
            }
        }

        const matchesCategory = (category === "all" || complaintCategory.toLowerCase() === category.toLowerCase());

        return matchesSearch && matchesStatus && matchesCategory;
    });

    // Sorting
    filtered.sort((a, b) => {
        const dateA = new Date(a.created_at || 0).getTime();
        const dateB = new Date(b.created_at || 0).getTime();
        return sort === "oldest" ? dateA - dateB : dateB - dateA;
    });

    renderComplaints(filtered);
}

// ===============================================
// RENDER COMPLAINTS
// ===============================================
function renderComplaints(complaints) {
    const container = document.getElementById("complaintsContainer");
    if (!container) return;

    if (!complaints || complaints.length === 0) {
        showEmptyState(
            container,
            "No complaints found",
            allComplaints.length === 0
                ? "You haven't submitted any complaints yet."
                : "No complaints match your active search and filter criteria.",
            allComplaints.length === 0
        );
        return;
    }

    container.innerHTML = complaints.map(complaint => {
        const id = complaint.id;
        const shortId = String(id).slice(0, 8);
        const title = escapeHTML(complaint.title || "Untitled Complaint");
        const desc = escapeHTML(complaint.description || "No description provided.");
        const category = escapeHTML(complaint.category || "General");
        const status = complaint.status || "Submitted";
        const priority = complaint.priority || "Medium";
        const date = formatDate(complaint.created_at);
        const statusClass = getStatusClass(status);
        const priorityClass = getPriorityClass(priority);
        const location = complaint.location ? ` • 📍 ${escapeHTML(complaint.location)}` : "";

        return `
            <div class="complaint-row" data-id="${id}">
                <div class="row-main">
                    <div class="row-meta">
                        <span class="row-category">${category}</span>
                        <span class="id-badge">#${shortId}</span>
                        <span class="priority-chip ${priorityClass}">${escapeHTML(priority)}</span>
                        <span class="row-date">${date}${location}</span>
                    </div>
                    <h3 class="row-title">${title}</h3>
                    <p class="row-desc">${desc}</p>
                </div>
                
                <div class="row-status">
                    <span class="status-badge ${statusClass}">
                        ${escapeHTML(status)}
                    </span>
                    <span class="view-link-hint">View Details →</span>
                </div>
            </div>
        `;
    }).join("");

    container.querySelectorAll(".complaint-row").forEach(card => {
        card.addEventListener("click", () => {
            const id = card.dataset.id;
            if (id) window.location.href = "complaint-details.html?id=" + encodeURIComponent(id);
        });
    });
}

// ===============================================
// EMPTY STATE
// ===============================================
function showEmptyState(container, title, message, showButton = false) {
    let btnHtml = "";
    if (showButton) {
        btnHtml = `<a href="register-complaint.html" class="btn btn-primary btn-sm mt-4">+ File a Complaint</a>`;
    }

    container.innerHTML = `
        <div class="empty-state">
            <div style="color: var(--slate-light); margin-bottom: 14px;">
                <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin: 0 auto;"><path d="M9 2h6a1 1 0 0 1 1 1v2H8V3a1 1 0 0 1 1-1Z"/><path d="M8 4H6a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2"/></svg>
            </div>
            <h2 style="font-size: 1.125rem; font-weight: 700; margin-bottom: 6px; color: var(--navy-900);">${escapeHTML(title)}</h2>
            <p class="text-muted text-xs mb-2">${escapeHTML(message)}</p>
            ${btnHtml}
        </div>
    `;
}

// ===============================================
// REALTIME UPDATES
// ===============================================
function subscribeToComplaintChanges(userId) {
    try {
        supabaseClient
            .channel("my-complaints-ledger-" + userId)
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "complaints", filter: "user_id=eq." + userId },
                async () => {
                    const { data } = await supabaseClient
                        .from("complaints")
                        .select("*")
                        .eq("user_id", userId)
                        .order("created_at", { ascending: false });

                    allComplaints = data || [];
                    filterComplaints();
                    if (window.CampusCare) CampusCare.toast("Complaints ledger updated live.", "info", 2000);
                }
            )
            .subscribe();
    } catch (error) {
        console.warn("Realtime subscription error:", error);
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

function getPriorityClass(priority) {
    const p = String(priority).toLowerCase();
    if (p === "low") return "priority-low";
    if (p === "high") return "priority-high";
    if (p === "critical" || p === "urgent") return "priority-critical";
    return "priority-medium";
}

function formatDate(date) {
    if (!date) return "Unknown date";
    return new Date(date).toLocaleDateString("en-IN", {
        day: "numeric", month: "short", year: "numeric"
    });
}

function escapeHTML(value) {
    const div = document.createElement("div");
    div.textContent = String(value);
    return div.innerHTML;
}
