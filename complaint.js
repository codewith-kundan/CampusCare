// ===============================================
// NITR CAMPUSCARE — COMPLAINT DETAILS SCRIPT
// ===============================================

const EVIDENCE_BUCKET = "complaint-evidence";

const params = new URLSearchParams(window.location.search);
const rawId = params.get("id");
const complaintId = rawId ? rawId.trim().replace(/^#/, '') : null;

document.addEventListener("DOMContentLoaded", async () => {

    const loading = document.getElementById("loading");
    const content = document.getElementById("content");

    if (!complaintId) {
        showError("No complaint was selected. Please provide a valid reference ID.");
        return;
    }

    if (!supabaseClient) {
        showError("Database connection unavailable.");
        return;
    }

    try {
        const { data: { user }, error: userError } = await supabaseClient.auth.getUser();

        if (userError || !user) {
            window.location.href = "login.html";
            return;
        }

        const role = user.user_metadata?.role;
        const isAdmin = (role === 'admin' || role === 'teacher');

        // Query by ID (or prefix match if short ID used)
        let query = supabaseClient.from("complaints").select("*");

        if (complaintId.length >= 32 || complaintId.includes("-")) {
            query = query.eq("id", complaintId);
        } else {
            query = query.ilike("id", `${complaintId}%`);
        }

        if (!isAdmin) {
            query = query.eq("user_id", user.id);
        }

        const { data, error } = await query;

        if (error || !data || data.length === 0) {
            console.error("Fetch error:", error);
            showError("Complaint not found or you don't have authorization to view this grievance.");
            return;
        }

        const complaint = data[0];
        // History is attached by the bridge from the API response
        const history = complaint._history || [];

        displayComplaint(complaint);

        if (loading) loading.style.display = "none";
        if (content) content.style.display = "grid";

        // Load audit history for timeline (use pre-fetched history)
        loadComplaintHistory(complaint.id, complaint.created_at, history);

        // Realtime sync
        subscribeToComplaintChanges(complaint.id);

    } catch (err) {
        console.error("Complaint loading error:", err);
        showError("Unable to load complaint details. Please check your connection.");
    }

    const printBtn = document.getElementById("printBtn");
    if (printBtn) {
        printBtn.addEventListener("click", () => window.print());
    }
});

// ===============================================
// DISPLAY COMPLAINT DATA
// ===============================================
function displayComplaint(complaint) {
    const categoryEl = document.getElementById("category");
    const titleEl = document.getElementById("title");
    const complaintIdEl = document.getElementById("complaintId");
    const studentNameEl = document.getElementById("studentName");
    const statusEl = document.getElementById("status");
    const dateEl = document.getElementById("date");
    const priorityEl = document.getElementById("priority");
    const detailLocationEl = document.getElementById("detailLocation");
    const descriptionEl = document.getElementById("description");
    const adminNotesSection = document.getElementById("adminNotesSection");
    const adminNotesText = document.getElementById("adminNotesText");

    if (categoryEl) categoryEl.textContent = complaint.category || "General";
    if (titleEl) titleEl.textContent = complaint.title || "Untitled Complaint";
    if (complaintIdEl) complaintIdEl.textContent = `ID: #${String(complaint.id).slice(0, 8)}`;
    if (studentNameEl) studentNameEl.textContent = complaint.student_name || "Student";
    if (dateEl) dateEl.textContent = formatDate(complaint.created_at);

    const status = complaint.status || "Submitted";
    if (statusEl) {
        statusEl.textContent = status;
        statusEl.className = "status-badge " + getStatusClass(status);
    }

    const priority = complaint.priority || "Medium";
    if (priorityEl) {
        priorityEl.innerHTML = `<span class="priority-chip ${getPriorityClass(priority)}">${escapeHTML(priority)}</span>`;
    }

    if (detailLocationEl) {
        detailLocationEl.textContent = complaint.location || "NIT Rourkela Campus";
    }

    if (descriptionEl) {
        descriptionEl.textContent = complaint.description || "No description provided.";
    }

    // Teacher / Admin notes if present
    if (complaint.teacher_notes && adminNotesSection && adminNotesText) {
        adminNotesText.textContent = complaint.teacher_notes;
        adminNotesSection.style.display = "block";
    }

    // Photo Evidence
    if (complaint.evidence_path) {
        showEvidencePhoto(complaint.evidence_path);
    }

    updateTimelineState(status);
}

// ===============================================
// LOAD STATUS HISTORY TIMELINE
// ===============================================
async function loadComplaintHistory(id, createdAt, prefetchedHistory) {
    const submittedDateEl = document.getElementById("timelineDateSubmitted");
    const pendingDateEl = document.getElementById("timelineDatePending");
    const progressDateEl = document.getElementById("timelineDateProgress");
    const completedDateEl = document.getElementById("timelineDateCompleted");

    if (submittedDateEl) submittedDateEl.textContent = formatDate(createdAt);

    // Use pre-fetched history from the API response
    const history = prefetchedHistory || [];

    if (history.length > 0) {
        history.forEach(h => {
            const s = (h.status || "").toLowerCase();
            const d = formatDate(h.created_at);
            if (s === "pending" && pendingDateEl) pendingDateEl.textContent = d;
            if (s === "in progress" && progressDateEl) progressDateEl.textContent = d;
            if ((s === "completed" || s === "resolved") && completedDateEl) completedDateEl.textContent = d;
        });
    }
}

// ===============================================
// UPDATE TIMELINE VISUAL PROGRESS
// ===============================================
function updateTimelineState(status) {
    const val = String(status).toLowerCase();

    const submitted = document.getElementById("timelineSubmitted");
    const pending = document.getElementById("timelinePending");
    const progress = document.getElementById("timelineProgress");
    const completed = document.getElementById("timelineCompleted");

    if (!submitted || !pending || !progress || !completed) return;

    [submitted, pending, progress, completed].forEach(item => {
        item.classList.remove("active", "completed");
    });

    submitted.classList.add("completed");

    if (val === "submitted") {
        submitted.classList.add("active");
        submitted.classList.remove("completed");
    } else if (val === "pending") {
        pending.classList.add("active");
    } else if (val === "in progress") {
        pending.classList.add("completed");
        progress.classList.add("active");
    } else if (val === "completed" || val === "resolved") {
        pending.classList.add("completed");
        progress.classList.add("completed");
        completed.classList.add("completed", "active");
    }
}

// ===============================================
// EVIDENCE PHOTO WITH SIGNED URL FALLBACK
// ===============================================
async function showEvidencePhoto(path) {
    const section = document.getElementById("evidenceSection");
    const img = document.getElementById("evidenceImage");
    if (!section || !img || !path) return;

    try {
        // Try signed URL first for private buckets
        const { data: signed, error: signErr } = await supabaseClient.storage
            .from(EVIDENCE_BUCKET)
            .createSignedUrl(path, 3600);

        if (!signErr && signed?.signedUrl) {
            img.src = signed.signedUrl;
            section.style.display = "block";
            return;
        }

        // Fallback to public URL
        const { data } = supabaseClient.storage.from(EVIDENCE_BUCKET).getPublicUrl(path);
        if (data?.publicUrl) {
            img.src = data.publicUrl;
            section.style.display = "block";
        }
    } catch (err) {
        console.warn("Evidence photo display notice:", err);
    }
}

// ===============================================
// REALTIME SUBSCRIPTION
// ===============================================
function subscribeToComplaintChanges(id) {
    try {
        supabaseClient
            .channel("complaint-live-" + id)
            .on(
                "postgres_changes",
                { event: "UPDATE", schema: "public", table: "complaints", filter: "id=eq." + id },
                (payload) => {
                    if (payload?.new) {
                        displayComplaint(payload.new);
                        loadComplaintHistory(payload.new.id, payload.new.created_at);
                        if (window.CampusCare) CampusCare.toast("Grievance status updated by administration.", "info");
                    }
                }
            )
            .subscribe();
    } catch (e) {
        console.warn("Realtime listener notice:", e);
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
    if (!date) return "—";
    return new Date(date).toLocaleDateString("en-IN", {
        day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
    });
}

function escapeHTML(value) {
    const div = document.createElement("div");
    div.textContent = String(value);
    return div.innerHTML;
}

function showError(message) {
    const loading = document.getElementById("loading");
    if (loading) {
        loading.innerHTML = `
            <div style="text-align: center; padding: 48px 24px; background: #ffffff; border-radius: var(--r-lg); border: 1px dashed var(--line-strong);">
                <div style="color: var(--status-error-text); margin-bottom: 12px;">
                    <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin: 0 auto;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                </div>
                <h2 style="font-size: 1.25rem; font-weight: 700; margin-bottom: 8px; color: var(--navy-900);">Grievance Not Found</h2>
                <p class="text-muted text-sm mb-4" style="max-width: 440px; margin-left: auto; margin-right: auto;">${escapeHTML(message)}</p>
                <a href="my-complaints.html" class="btn btn-primary btn-sm">← Back to My Complaints</a>
            </div>
        `;
    }
}
