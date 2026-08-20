// ========================================
// NITR CAMPUSCARE DASHBOARD
// ========================================

let currentUser = null;


// ========================================
// OPEN REGISTER COMPLAINT PAGE
// ========================================

function openComplaintPage() {

    console.log("Register Complaint clicked");

    window.location.href = "register-complaint.html";

}


// ========================================
// LOAD USER
// ========================================

async function loadDashboard() {

    try {

        const {
            data: { user },
            error
        } = await supabaseClient.auth.getUser();


        // User is not logged in
        if (error || !user) {

            window.location.href = "login.html";

            return;

        }


        console.log("Logged in user:", user);

        currentUser = user;


        // ========================================
        // USER METADATA
        // ========================================

        const metadata =
            user.user_metadata || {};

        const name =
            metadata.full_name || "Student";

        const rollNumber =
            metadata.roll_number || "Not available";


        // ========================================
        // DISPLAY USER
        // ========================================

        const userName =
            document.getElementById("userName");

        const welcomeName =
            document.getElementById("welcomeName");

        const profileName =
            document.getElementById("profileName");

        const profileEmail =
            document.getElementById("profileEmail");

        const profileRoll =
            document.getElementById("profileRoll");


        if (userName) {

            userName.textContent = name;

        }


        if (welcomeName) {

            welcomeName.textContent =
                name.split(" ")[0];

        }


        if (profileName) {

            profileName.textContent = name;

        }


        if (profileEmail) {

            profileEmail.textContent =
                user.email || "";

        }


        if (profileRoll) {

            profileRoll.textContent =
                rollNumber;

        }


        // ========================================
        // LOAD COMPLAINTS
        // ========================================

        await loadComplaints(user);


        // ========================================
        // LIVE UPDATES
        // ========================================

        subscribeToComplaintChanges(user.id);


    }

    catch (error) {

        console.error(
            "Dashboard error:",
            error
        );

    }

}


// ========================================
// LOAD COMPLAINTS
// ========================================

async function loadComplaints(user) {

    try {

        const {
            data: complaints,
            error
        } = await supabaseClient
            .from("complaints")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", {
                ascending: false
            });


        if (error) {

            console.error(
                "Complaint loading error:",
                error
            );

            if (window.CampusCare) {
                CampusCare.toast("Couldn't load your complaints. Please refresh.", "error");
            }

            return;

        }


        const complaintData =
            complaints || [];


        // ========================================
        // COUNTERS
        // ========================================

        const total =
            complaintData.length;


        const pending =
            complaintData.filter(
                complaint =>
                    String(complaint.status)
                        .toLowerCase() === "pending"
            ).length;


        const progress =
            complaintData.filter(
                complaint =>
                    String(complaint.status)
                        .toLowerCase() === "in progress"
            ).length;


        const completed =
            complaintData.filter(
                complaint => {

                    const status =
                        String(
                            complaint.status
                        ).toLowerCase();

                    return (
                        status === "completed" ||
                        status === "resolved"
                    );

                }
            ).length;


        // ========================================
        // UPDATE COUNTERS
        // ========================================

        const totalElement =
            document.getElementById(
                "totalComplaints"
            );

        const pendingElement =
            document.getElementById(
                "pendingComplaints"
            );

        const progressElement =
            document.getElementById(
                "progressComplaints"
            );

        const completedElement =
            document.getElementById(
                "completedComplaints"
            );


        if (totalElement)
            totalElement.textContent = total;

        if (pendingElement)
            pendingElement.textContent = pending;

        if (progressElement)
            progressElement.textContent = progress;

        if (completedElement)
            completedElement.textContent = completed;


        // ========================================
        // DISPLAY RECENT COMPLAINTS
        // ========================================

        displayComplaints(
            complaintData
        );

    }

    catch (error) {

        console.error(
            "Complaint error:",
            error
        );

    }

}


// ========================================
// DISPLAY COMPLAINTS
// ========================================

function displayComplaints(complaints) {

    const list =
        document.getElementById(
            "complaintsList"
        );


    if (!list) return;


    // ========================================
    // NO COMPLAINTS
    // ========================================

    if (complaints.length === 0) {

        list.innerHTML = `

            <div class="empty-state">

                <div class="empty-icon">
                    <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 2h6a1 1 0 0 1 1 1v2H8V3a1 1 0 0 1 1-1Z"/><path d="M8 4H6a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2"/></svg>
                </div>

                <h3>
                    No complaints yet
                </h3>

                <p>
                    Your submitted complaints will appear here.
                </p>

                <button
                    type="button"
                    class="primary-btn"
                    id="emptyComplaintBtn">

                    Register Your First Complaint

                </button>

            </div>

        `;


        const button =
            document.getElementById(
                "emptyComplaintBtn"
            );


        if (button) {

            button.addEventListener(
                "click",
                openComplaintPage
            );

        }


        return;

    }


    // ========================================
    // RECENT 5 COMPLAINTS
    // ========================================

    const recent =
        complaints.slice(0, 5);


    list.innerHTML =
        recent.map(
            complaint => {

                const status =
                    complaint.status ||
                    "Pending";


                let statusClass =
                    "status-pending";


                if (
                    status.toLowerCase() ===
                    "in progress"
                ) {

                    statusClass =
                        "status-progress";

                }


                if (
                    status.toLowerCase() ===
                    "completed" ||
                    status.toLowerCase() ===
                    "resolved"
                ) {

                    statusClass =
                        "status-completed";

                }


                return `

                    <div class="complaint-item" data-id="${escapeHTML(complaint.id)}">

                        <div class="complaint-info">

                            <span class="complaint-category">

                                ${escapeHTML(
                                    complaint.category ||
                                    "General"
                                )}

                            </span>

                            <h3>

                                ${escapeHTML(
                                    complaint.title ||
                                    "Untitled Complaint"
                                )}

                            </h3>

                            <p>

                                ${formatDate(
                                    complaint.created_at
                                )}

                            </p>

                        </div>

                        <span
                            class="complaint-status ${statusClass}">

                            ${escapeHTML(status)}

                        </span>

                    </div>

                `;

            }
        ).join("");


    list.querySelectorAll(".complaint-item").forEach(item => {

        item.addEventListener("click", () => {

            const id = item.dataset.id;

            if (id) {
                window.location.href = "complaint-details.html?id=" + encodeURIComponent(id);
            }
        });
    });

}


// ========================================
// LIVE UPDATES (Supabase Realtime)
// Requires Realtime to be enabled for the
// "complaints" table on this Supabase project —
// silently does nothing otherwise.
// ========================================

function subscribeToComplaintChanges(userId) {

    try {

        supabaseClient
            .channel("dashboard-complaints-" + userId)
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "complaints",
                    filter: "user_id=eq." + userId
                },
                () => {
                    loadComplaints({ id: userId });
                }
            )
            .subscribe();

    } catch (error) {

        console.warn("Realtime subscription unavailable:", error);
    }

}


// ========================================
// PROFILE MODAL
// ========================================

function openProfileModal() {

    if (!currentUser) return;

    const metadata = currentUser.user_metadata || {};

    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";

    overlay.innerHTML = `
        <div class="modal-box" role="dialog" aria-modal="true">
            <h3>Your Profile</h3>
            <div style="margin-top:18px; display:flex; flex-direction:column; gap:14px;">
                <div style="display:flex; justify-content:space-between; border-bottom:1px solid var(--line); padding-bottom:12px;">
                    <span style="color:var(--slate); font-size:13px;">Full Name</span>
                    <strong style="font-size:13px;">${escapeHTML(metadata.full_name || "Student")}</strong>
                </div>
                <div style="display:flex; justify-content:space-between; border-bottom:1px solid var(--line); padding-bottom:12px;">
                    <span style="color:var(--slate); font-size:13px;">Email</span>
                    <strong style="font-size:13px; word-break:break-all; text-align:right;">${escapeHTML(currentUser.email || "—")}</strong>
                </div>
                <div style="display:flex; justify-content:space-between; border-bottom:1px solid var(--line); padding-bottom:12px;">
                    <span style="color:var(--slate); font-size:13px;">Roll Number</span>
                    <strong class="mono" style="font-size:13px;">${escapeHTML(metadata.roll_number || "—")}</strong>
                </div>
                <div style="display:flex; justify-content:space-between;">
                    <span style="color:var(--slate); font-size:13px;">Member Since</span>
                    <strong style="font-size:13px;">${formatDate(currentUser.created_at)}</strong>
                </div>
            </div>
            <div class="modal-actions">
                <button type="button" class="btn btn-primary" data-act="confirm">Close</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);
    document.body.classList.add("nav-locked");

    requestAnimationFrame(() => overlay.classList.add("is-in"));

    function close() {
        overlay.classList.remove("is-in");
        document.body.classList.remove("nav-locked");
        setTimeout(() => overlay.remove(), 250);
    }

    overlay.addEventListener("click", (e) => {
        if (e.target === overlay || e.target.closest("[data-act]")) close();
    });
}


// ========================================
// LOGOUT
// ========================================

async function logout() {

    if (window.CampusCare) {

        const confirmed = await CampusCare.confirmDialog({
            title: "Log out?",
            message: "You'll need to sign in again to access your dashboard.",
            confirmLabel: "Log out",
            cancelLabel: "Stay signed in"
        });

        if (!confirmed) return;
    }

    try {

        const {
            error
        } =
            await supabaseClient.auth.signOut();


        if (error) {

            console.error(
                "Logout error:",
                error
            );

            return;

        }


        window.location.href =
            "login.html";

    }

    catch (error) {

        console.error(
            "Logout error:",
            error
        );

    }

}


// ========================================
// FORMAT DATE
// ========================================

function formatDate(dateString) {

    if (!dateString) {

        return "";

    }


    return new Date(
        dateString
    ).toLocaleDateString(
        "en-IN",
        {
            day: "numeric",
            month: "short",
            year: "numeric"
        }
    );

}


// ========================================
// ESCAPE HTML
// ========================================

function escapeHTML(value) {

    const div =
        document.createElement("div");

    div.textContent =
        String(value);

    return div.innerHTML;

}


// ========================================
// BUTTON EVENTS
// ========================================

document.addEventListener(
    "DOMContentLoaded",
    () => {


        // Register complaint
        const newComplaintBtn =
            document.getElementById(
                "newComplaintBtn"
            );


        if (newComplaintBtn) {

            newComplaintBtn.addEventListener(
                "click",
                openComplaintPage
            );

        }


        // Logout
        const logoutBtn =
            document.getElementById(
                "logoutBtn"
            );


        if (logoutBtn) {

            logoutBtn.addEventListener(
                "click",
                logout
            );

        }


        // View all
        const viewAllBtn =
            document.getElementById(
                "viewAllBtn"
            );


        if (viewAllBtn) {

            viewAllBtn.addEventListener(
                "click",
                () => {

                    window.location.href =
                "my-complaints.html";

                }
            );

        }


        // Profile modal
        const profileBtn =
            document.getElementById("profileBtn");

        if (profileBtn) {
            profileBtn.addEventListener("click", openProfileModal);
        }

    }
);


// ========================================
// START
// ========================================

loadDashboard();
