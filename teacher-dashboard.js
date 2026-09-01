// ===============================================
// NITR CAMPUSCARE — FACULTY & ADMIN DASHBOARD
// ===============================================

const PAGE_SIZE = 15;
let currentPage = 0;
let loadedComplaints = [];
let searchTimeout;
let selectedIds = new Set();
let isFetching = false;
let currentAdminUser = null;

document.addEventListener("DOMContentLoaded", () => {
    init();
});

async function init() {
    if (!supabaseClient) return;

    await checkAuth();
    await fetchAnalytics();
    await loadComplaints(true);
    
    setupFilters();
    setupBulkActions();
    setupExport();
    setupRealtime();
    setupEvidenceModal();
    
    const loadMoreBtn = document.getElementById("loadMoreBtn");
    if (loadMoreBtn) {
        loadMoreBtn.addEventListener("click", () => {
            currentPage++;
            loadComplaints(false);
        });
    }
    
    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", async () => {
            if (window.CampusCare) {
                const confirm = await window.CampusCare.confirmDialog({
                    title: "Faculty Sign Out",
                    message: "Are you sure you want to sign out of the Admin portal?",
                    confirmLabel: "Sign Out",
                    cancelLabel: "Stay Signed In",
                    danger: true
                });
                if (!confirm) return;
            }
            
            await supabaseClient.auth.signOut();
            window.location.href = "login.html";
        });
    }
}

// ===============================================
// AUTHENTICATION & RBAC ENFORCEMENT
// ===============================================
async function checkAuth() {
    const { data: { user }, error } = await supabaseClient.auth.getUser();
    
    if (!user || error) {
        window.location.href = "login.html";
        return;
    }
    
    const role = user.user_metadata?.role;
    // Strict RBAC: only users with role 'admin' or 'teacher' are permitted
    if (role !== 'admin' && role !== 'teacher') {
        if (window.CampusCare) {
            window.CampusCare.toast("Access restricted. Redirecting to Student Dashboard...", "warning", 3000);
        }
        window.location.href = "dashboard.html";
        return;
    }
    
    currentAdminUser = user;

    const nameEl = document.getElementById("teacherName");
    if (nameEl) {
        nameEl.textContent = user.user_metadata?.full_name || user.email.split('@')[0] || "Faculty Admin";
    }
}

// ===============================================
// ANALYTICS COUNT QUERIES
// ===============================================
async function fetchAnalytics() {
    try {
        const p1 = supabaseClient.from('complaints').select('id', { count: 'exact', head: true });
        const p2 = supabaseClient.from('complaints').select('id', { count: 'exact', head: true }).in('status', ['Pending', 'Submitted']);
        const p3 = supabaseClient.from('complaints').select('id', { count: 'exact', head: true }).eq('status', 'In Progress');
        const p4 = supabaseClient.from('complaints').select('id', { count: 'exact', head: true }).in('status', ['Resolved', 'Completed']);
        
        const [total, pending, inProgress, resolved] = await Promise.all([p1, p2, p3, p4]);
        
        const totalEl = document.getElementById("statTotal");
        const pendingEl = document.getElementById("statPending");
        const inProgEl = document.getElementById("statInProgress");
        const resolvedEl = document.getElementById("statResolved");

        if (totalEl) totalEl.textContent = total.count ?? 0;
        if (pendingEl) pendingEl.textContent = pending.count ?? 0;
        if (inProgEl) inProgEl.textContent = inProgress.count ?? 0;
        if (resolvedEl) resolvedEl.textContent = resolved.count ?? 0;
        
    } catch (err) {
        console.warn("Analytics fetch notice:", err);
    }
}

// ===============================================
// DATA FETCHING & PAGINATION
// ===============================================
async function loadComplaints(reset = false) {
    if (isFetching || !supabaseClient) return;
    isFetching = true;
    
    const loader = document.getElementById("loadingIndicator");
    const container = document.getElementById("complaintsContainer");
    const loadMoreBtn = document.getElementById("loadMoreBtn");
    
    if (loader) loader.classList.remove("hidden");

    if (reset) {
        currentPage = 0;
        loadedComplaints = [];
        if (container) container.innerHTML = '';
        selectedIds.clear();
        updateBulkBar();
    }
    
    try {
        let query = supabaseClient.from('complaints').select('*');
        
        // Search
        const search = (document.getElementById("searchInput")?.value || "").trim();
        if (search) {
            query = query.or(`title.ilike.%${search}%,student_name.ilike.%${search}%,description.ilike.%${search}%`);
        }
        
        // Status Filter
        const status = document.getElementById("statusFilter")?.value || "all";
        if (status !== 'all') {
            if (status === "Completed") {
                query = query.in("status", ["Completed", "Resolved"]);
            } else {
                query = query.eq('status', status);
            }
        }
        
        // Priority Filter
        const priority = document.getElementById("priorityFilter")?.value || "all";
        if (priority !== 'all') query = query.eq('priority', priority);
        
        // Category Filter
        const category = document.getElementById("categoryFilter")?.value || "all";
        if (category !== 'all') query = query.eq('category', category);
        
        // Sort
        const sort = document.getElementById("sortFilter")?.value || "newest";
        query = query.order('created_at', { ascending: (sort === 'oldest') });
        
        // Range Pagination
        const from = currentPage * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;
        query = query.range(from, to);
        
        const { data, error } = await query;
        if (error) throw error;
        
        const results = data || [];

        if (loadMoreBtn) {
            if (results.length < PAGE_SIZE) {
                loadMoreBtn.classList.add("hidden");
            } else {
                loadMoreBtn.classList.remove("hidden");
            }
        }
        
        loadedComplaints.push(...results);
        renderComplaints(results, reset);
        
    } catch (err) {
        console.error("Load complaints error:", err);
        if (window.CampusCare) window.CampusCare.toast("Failed to fetch complaints list.", "error");
    } finally {
        if (loader) loader.classList.add("hidden");
        isFetching = false;
    }
}

// ===============================================
// FILTER LISTENERS
// ===============================================
function setupFilters() {
    const filterIds = ["statusFilter", "priorityFilter", "categoryFilter", "sortFilter"];
    filterIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener("change", () => loadComplaints(true));
    });
    
    const searchInput = document.getElementById("searchInput");
    if (searchInput) {
        searchInput.addEventListener("input", () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                loadComplaints(true);
            }, 300);
        });
    }
}

// ===============================================
// RENDER COMPLAINTS
// ===============================================
function renderComplaints(complaints, clearContainer) {
    const container = document.getElementById("complaintsContainer");
    if (!container) return;
    
    if (clearContainer && complaints.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <h3 style="font-size: 1.125rem; font-weight: 700; color: var(--navy-900); margin-bottom: 6px;">No matching grievances found</h3>
                <p class="text-muted text-xs">Try adjusting your filters or searching with a different term.</p>
            </div>
        `;
        return;
    }

    const html = complaints.map(complaint => {
        const id = complaint.id;
        const shortId = String(id).slice(0, 8);
        const title = escapeHTML(complaint.title || "Untitled");
        const desc = escapeHTML(complaint.description || "No description provided.");
        const category = escapeHTML(complaint.category || "General");
        const priority = complaint.priority || "Medium";
        const status = complaint.status || "Submitted";
        const student = escapeHTML(complaint.student_name || "NITR Student");
        const location = escapeHTML(complaint.location || "Campus Facility");
        const notes = escapeHTML(complaint.teacher_notes || "");
        const date = new Date(complaint.created_at).toLocaleDateString("en-IN", {
            day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
        });
        const hasEvidence = !!complaint.evidence_path;
        const isSelected = selectedIds.has(id);
        const priorityClass = getPriorityClass(priority);

        return `
            <div class="complaint-row ${isSelected ? 'is-selected' : ''}" data-id="${id}">
                
                <label class="checkbox-wrapper row-checkbox">
                    <input type="checkbox" onchange="window.toggleSelection('${id}', this.checked)" ${isSelected ? 'checked' : ''}>
                    <span class="checkmark"></span>
                </label>
                
                <div class="row-main">
                    <div class="row-meta">
                        <span class="row-category">${category}</span>
                        <span class="id-badge">#${shortId}</span>
                        <span class="priority-chip ${priorityClass}">${escapeHTML(priority)}</span>
                        <span class="text-xs text-muted font-mono">• ${date}</span>
                    </div>
                    <h3 class="row-title">${title}</h3>
                    <p class="row-desc">${desc}</p>
                    
                    <div class="row-details mb-3">
                        <span><strong>Student:</strong> ${student}</span>
                        <span><strong>Location:</strong> 📍 ${location}</span>
                        <button type="button" class="evidence-btn" ${!hasEvidence ? "disabled" : ""} onclick="window.viewEvidence('${hasEvidence ? complaint.evidence_path : ''}')">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"></path><circle cx="12" cy="13" r="3"></circle></svg>
                            ${hasEvidence ? "View Photo Evidence" : "No Photo"}
                        </button>
                    </div>
                    
                    <div class="internal-notes">
                        <label>Administrative Remark / Worker Dispatch Note</label>
                        <div class="notes-input-wrapper">
                            <textarea class="notes-input" id="note_${id}" placeholder="Type internal maintenance notes or worker assignment details...">${notes}</textarea>
                            <button class="btn btn-primary btn-sm" onclick="window.saveNote('${id}')">Save Note</button>
                        </div>
                    </div>
                </div>
                
                <div class="row-actions">
                    <div class="action-group">
                        <label>Update Status</label>
                        <select class="action-select status-select" data-val="${status}" onchange="window.updateComplaint('${id}', 'status', this.value)">
                            <option value="Submitted" ${status === 'Submitted' ? 'selected' : ''}>Submitted</option>
                            <option value="Pending" ${status === 'Pending' ? 'selected' : ''}>Pending Review</option>
                            <option value="In Progress" ${status === 'In Progress' ? 'selected' : ''}>In Progress</option>
                            <option value="Completed" ${status === 'Completed' || status === 'Resolved' ? 'selected' : ''}>Resolved / Completed</option>
                        </select>
                    </div>
                    
                    <div class="action-group">
                        <label>Update Priority</label>
                        <select class="action-select priority-select" data-val="${priority}" onchange="window.updateComplaint('${id}', 'priority', this.value)">
                            <option value="Low" ${priority === 'Low' ? 'selected' : ''}>Low</option>
                            <option value="Medium" ${priority === 'Medium' ? 'selected' : ''}>Medium</option>
                            <option value="High" ${priority === 'High' ? 'selected' : ''}>High</option>
                            <option value="Critical" ${priority === 'Critical' ? 'selected' : ''}>Critical</option>
                        </select>
                    </div>
                </div>
            </div>
        `;
    }).join("");
    
    if (clearContainer) {
        container.innerHTML = html;
    } else {
        container.insertAdjacentHTML('beforeend', html);
    }
}

// ===============================================
// STATUS & PRIORITY UPDATES + AUDIT LOGGING
// ===============================================
window.updateComplaint = async (id, field, value) => {
    try {
        const updatePayload = { [field]: value };
        const { error } = await supabaseClient.from("complaints").update(updatePayload).eq("id", id);
        if (error) throw error;
        
        // Log to complaint_status_history if status was changed
        if (field === 'status') {
            try {
                await supabaseClient.from("complaint_status_history").insert([{
                    complaint_id: id,
                    status: value,
                    note: `Status updated to ${value} by faculty/admin.`,
                    changed_by: currentAdminUser?.id || null
                }]);
            } catch (hErr) {
                console.warn("Status history insert notice:", hErr);
            }
        }

        const selectEl = document.querySelector(`.complaint-row[data-id="${id}"] select[onchange*="${field}"]`);
        if (selectEl) selectEl.setAttribute('data-val', value);
        
        if (window.CampusCare) window.CampusCare.toast(`Updated ${field} to "${value}".`, "success");
        fetchAnalytics();
    } catch (err) {
        console.error("Update error:", err);
        if (window.CampusCare) window.CampusCare.toast(`Failed to update ${field}.`, "error");
    }
};

window.saveNote = async (id) => {
    const noteEl = document.getElementById(`note_${id}`);
    const note = noteEl ? noteEl.value.trim() : "";
    try {
        const { error } = await supabaseClient.from("complaints").update({ teacher_notes: note }).eq("id", id);
        if (error) throw error;
        if (window.CampusCare) window.CampusCare.toast("Administrative note saved.", "success");
    } catch (err) {
        console.error("Save note error:", err);
        if (window.CampusCare) window.CampusCare.toast("Failed to save note.", "error");
    }
};

// ===============================================
// BULK ACTIONS
// ===============================================
window.toggleSelection = (id, isChecked) => {
    const row = document.querySelector(`.complaint-row[data-id="${id}"]`);
    if (isChecked) {
        selectedIds.add(id);
        if (row) row.classList.add("is-selected");
    } else {
        selectedIds.delete(id);
        if (row) row.classList.remove("is-selected");
    }
    updateBulkBar();
};

function setupBulkActions() {
    const selectAllCb = document.getElementById("selectAllCb");
    const bulkCancelBtn = document.getElementById("bulkCancelBtn");
    const bulkApplyBtn = document.getElementById("bulkApplyBtn");

    if (selectAllCb) {
        selectAllCb.addEventListener("change", (e) => {
            const checked = e.target.checked;
            loadedComplaints.forEach(c => window.toggleSelection(c.id, checked));
            document.querySelectorAll(".row-checkbox input").forEach(cb => {
                cb.checked = checked;
            });
        });
    }
    
    if (bulkCancelBtn) {
        bulkCancelBtn.addEventListener("click", () => {
            selectedIds.clear();
            if (selectAllCb) selectAllCb.checked = false;
            document.querySelectorAll(".row-checkbox input").forEach(cb => cb.checked = false);
            document.querySelectorAll(".complaint-row").forEach(r => r.classList.remove("is-selected"));
            updateBulkBar();
        });
    }
    
    if (bulkApplyBtn) {
        bulkApplyBtn.addEventListener("click", async () => {
            const status = document.getElementById("bulkStatusSelect")?.value;
            if (!status) {
                if (window.CampusCare) window.CampusCare.toast("Please select a target status.", "warning");
                return;
            }
            
            const count = selectedIds.size;
            if (count === 0) return;

            const confirm = await window.CampusCare.confirmDialog({
                title: "Confirm Bulk Status Update",
                message: `Update status to "${status}" for all ${count} selected grievances?`,
                confirmLabel: "Apply to All",
                cancelLabel: "Cancel"
            });
            
            if (!confirm) return;
            
            try {
                const ids = Array.from(selectedIds);
                const { error } = await supabaseClient.from("complaints").update({ status }).in("id", ids);
                if (error) throw error;
                
                // Batch insert into history
                try {
                    const historyRows = ids.map(id => ({
                        complaint_id: id,
                        status: status,
                        note: `Bulk update to ${status}`,
                        changed_by: currentAdminUser?.id || null
                    }));
                    await supabaseClient.from("complaint_status_history").insert(historyRows);
                } catch (bhErr) {}

                if (window.CampusCare) window.CampusCare.toast(`Successfully updated ${ids.length} grievances.`, "success");
                
                selectedIds.clear();
                updateBulkBar();
                loadComplaints(true);
                fetchAnalytics();
            } catch (err) {
                console.error("Bulk update error:", err);
                if (window.CampusCare) window.CampusCare.toast("Bulk update failed.", "error");
            }
        });
    }
}

function updateBulkBar() {
    const bar = document.getElementById("bulkActionBar");
    const countEl = document.getElementById("bulkCount");
    
    if (!bar || !countEl) return;

    if (selectedIds.size > 0) {
        countEl.textContent = `${selectedIds.size} grievance${selectedIds.size > 1 ? 's' : ''} selected`;
        bar.classList.remove("hidden");
    } else {
        bar.classList.add("hidden");
    }
}

// ===============================================
// CSV EXPORT
// ===============================================
function setupExport() {
    const exportBtn = document.getElementById("exportCsvBtn");
    if (!exportBtn) return;

    exportBtn.addEventListener("click", async () => {
        if (window.CampusCare) window.CampusCare.toast("Generating CSV export...", "info");
        
        try {
            let query = supabaseClient.from('complaints').select('*');
            
            const search = (document.getElementById("searchInput")?.value || "").trim();
            if (search) query = query.or(`title.ilike.%${search}%,student_name.ilike.%${search}%`);
            
            const status = document.getElementById("statusFilter")?.value || "all";
            if (status !== 'all') {
                if (status === "Completed") query = query.in("status", ["Completed", "Resolved"]);
                else query = query.eq('status', status);
            }

            const priority = document.getElementById("priorityFilter")?.value || "all";
            if (priority !== 'all') query = query.eq('priority', priority);

            const category = document.getElementById("categoryFilter")?.value || "all";
            if (category !== 'all') query = query.eq('category', category);
            
            const { data, error } = await query.order('created_at', { ascending: false });
            if (error) throw error;
            
            if (!data || data.length === 0) {
                if (window.CampusCare) window.CampusCare.toast("No grievances match export criteria.", "warning");
                return;
            }
            
            const headers = ['ID', 'Date', 'Student Name', 'Title', 'Category', 'Priority', 'Status', 'Location', 'Admin Notes'];
            const rows = data.map(c => [
                c.id, 
                c.created_at, 
                `"${(c.student_name || '').replace(/"/g, '""')}"`,
                `"${(c.title || '').replace(/"/g, '""')}"`, 
                c.category, 
                c.priority, 
                c.status, 
                `"${(c.location || '').replace(/"/g, '""')}"`,
                `"${(c.teacher_notes || '').replace(/"/g, '""')}"`
            ]);
            
            const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = `NITR_CampusCare_Ledger_${new Date().toISOString().split('T')[0]}.csv`;
            link.click();

            if (window.CampusCare) window.CampusCare.toast("CSV Ledger downloaded.", "success");
            
        } catch (err) {
            console.error("Export error:", err);
            if (window.CampusCare) window.CampusCare.toast("Failed to export data.", "error");
        }
    });
}

// ===============================================
// EVIDENCE MODAL
// ===============================================
window.viewEvidence = async (path) => {
    if (!path || path === "undefined") return;
    try {
        if (window.CampusCare) window.CampusCare.toast("Loading photo evidence...", "info", 1500);
        
        let imageUrl = null;
        const { data: signedData, error: signedError } = await supabaseClient
            .storage.from("complaint-evidence").createSignedUrl(path, 3600);
            
        if (!signedError && signedData?.signedUrl) {
            imageUrl = signedData.signedUrl;
        } else {
            const { data } = supabaseClient.storage.from("complaint-evidence").getPublicUrl(path);
            imageUrl = data?.publicUrl;
        }

        if (imageUrl) {
            const modal = document.getElementById("evidenceModal");
            const img = document.getElementById("evidenceImage");
            if (modal && img) {
                img.src = imageUrl;
                modal.classList.add("is-visible");
            }
        }
    } catch (err) {
        if (window.CampusCare) window.CampusCare.toast("Could not open photo evidence.", "error");
    }
};

function setupEvidenceModal() {
    const modal = document.getElementById("evidenceModal");
    const closeBtn = document.getElementById("closeEvidenceModal");
    
    if (closeBtn && modal) {
        closeBtn.addEventListener("click", () => {
            modal.classList.remove("is-visible");
            setTimeout(() => {
                const img = document.getElementById("evidenceImage");
                if (img) img.src = "";
            }, 250);
        });
    }

    if (modal) {
        modal.addEventListener("click", (e) => {
            if (e.target === modal) {
                modal.classList.remove("is-visible");
                setTimeout(() => {
                    const img = document.getElementById("evidenceImage");
                    if (img) img.src = "";
                }, 250);
            }
        });
    }
}

// ===============================================
// REALTIME SUBSCRIPTION
// ===============================================
function setupRealtime() {
    try {
        supabaseClient
            .channel("admin-complaints-ledger")
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "complaints" },
                () => {
                    fetchAnalytics();
                    setTimeout(() => loadComplaints(true), 1500);
                }
            )
            .subscribe();
    } catch (err) {
        console.warn("Realtime listener notice:", err);
    }
}

// ===============================================
// UTILITIES
// ===============================================
function getPriorityClass(priority) {
    const p = String(priority).toLowerCase();
    if (p === "low") return "priority-low";
    if (p === "high") return "priority-high";
    if (p === "critical" || p === "urgent") return "priority-critical";
    return "priority-medium";
}

function escapeHTML(value) {
    const div = document.createElement("div");
    div.textContent = String(value);
    return div.innerHTML;
}
