// ==========================================
// NITR CAMPUSCARE — COMPLAINT DETAILS
// (file kept as complaint.js to match the
// project's existing naming convention)
// ==========================================

const EVIDENCE_BUCKET = "complaint-evidence";


// ==========================================
// GET COMPLAINT ID FROM URL
// ==========================================

const params =
    new URLSearchParams(
        window.location.search
    );

const complaintId =
    params.get("id");


// ==========================================
// LOAD COMPLAINT
// ==========================================

async function loadComplaint() {

    const loading =
        document.getElementById(
            "loading"
        );

    const content =
        document.getElementById(
            "content"
        );


    if (!complaintId) {

        showError(
            "No complaint was selected."
        );

        return;

    }


    try {

        // Check logged-in user

        const {
            data: {
                user
            },

            error: userError

        } =
            await supabaseClient
                .auth
                .getUser();


        if (
            userError ||
            !user
        ) {

            window.location.href =
                "login.html";

            return;

        }


        // Get complaint

        const {

            data: complaint,

            error

        } =
            await supabaseClient
                .from("complaints")
                .select("*")
                .eq(
                    "id",
                    complaintId
                )
                .eq(
                    "user_id",
                    user.id
                )
                .single();


        if (error || !complaint) {

            console.error(error);

            showError(
                "Complaint not found or you don't have permission to view it."
            );

            return;

        }


        // Display complaint

        displayComplaint(
            complaint
        );


        loading.style.display =
            "none";

        content.style.display =
            "block";


        subscribeToComplaintChanges();

    }

    catch (error) {

        console.error(error);

        showError(
            "Unable to load the complaint."
        );

    }

}


// ==========================================
// DISPLAY
// ==========================================

function displayComplaint(
    complaint
) {

    document.getElementById(
        "category"
    ).textContent =
        complaint.category ||
        "General";


    document.getElementById(
        "detailCategory"
    ).textContent =
        complaint.category ||
        "General";


    document.getElementById(
        "title"
    ).textContent =
        complaint.title ||
        "Untitled Complaint";


    document.getElementById(
        "description"
    ).textContent =
        complaint.description ||
        "No description provided.";


    document.getElementById(
        "complaintId"
    ).textContent =
        "Complaint ID: " +
        String(
            complaint.id
        );


    const formattedDate =
        formatDate(
            complaint.created_at
        );


    document.getElementById(
        "date"
    ).textContent =
        formattedDate;


    document.getElementById(
        "timelineDate"
    ).textContent =
        formattedDate;


    const status =
        complaint.status ||
        "Pending";


    const statusElement =
        document.getElementById(
            "status"
        );


    statusElement.textContent =
        status;


    statusElement.className =
        "status " +
        getStatusClass(
            status
        );


    // ==========================================
    // PRIORITY  (previously left unwired —
    // the field always showed the static "Normal"
    // placeholder regardless of the real value)
    // ==========================================

    const priorityElement =
        document.getElementById("priority");

    if (priorityElement) {

        const priority = complaint.priority || "Medium";

        priorityElement.textContent = priority;
        priorityElement.dataset.priority = priority;
    }


    // ==========================================
    // LOCATION  (only shown if the complaint
    // actually has one on record)
    // ==========================================

    if (complaint.location) {

        const locationBox = document.getElementById("locationBox");
        const detailLocation = document.getElementById("detailLocation");

        if (locationBox && detailLocation) {
            detailLocation.textContent = complaint.location;
            locationBox.style.display = "block";
        }
    }


    // ==========================================
    // EVIDENCE PHOTO
    // ==========================================

    if (complaint.evidence_path) {
        showEvidence(complaint.evidence_path);
    }


    updateTimeline(
        status
    );

}


// ==========================================
// EVIDENCE PHOTO
// ==========================================

function showEvidence(path) {

    const section = document.getElementById("evidenceSection");
    const img = document.getElementById("evidenceImage");

    if (!section || !img) return;

    const { data } = supabaseClient.storage.from(EVIDENCE_BUCKET).getPublicUrl(path);

    const publicUrl = data?.publicUrl;

    if (!publicUrl) return;

    img.addEventListener("error", async () => {

        // Bucket may be private — try a signed URL before giving up.

        try {

            const { data: signed, error } =
                await supabaseClient.storage.from(EVIDENCE_BUCKET).createSignedUrl(path, 3600);

            if (!error && signed?.signedUrl) {
                img.src = signed.signedUrl;
                return;
            }

        } catch (err) {
            console.warn("Signed URL fallback failed:", err);
        }

        section.style.display = "none";

    }, { once: true });

    img.src = publicUrl;
    section.style.display = "block";
}


// ==========================================
// TIMELINE
// ==========================================

function updateTimeline(
    status
) {

    const value =
        String(status)
            .toLowerCase();


    const submitted =
        document.getElementById(
            "timelineSubmitted"
        );

    const review =
        document.getElementById(
            "timelineReview"
        );

    const progress =
        document.getElementById(
            "timelineProgress"
        );

    const completed =
        document.getElementById(
            "timelineCompleted"
        );


    // Reset

    [
        submitted,
        review,
        progress,
        completed
    ].forEach(item => {

        item.classList.remove(
            "active"
        );

    });


    // Submitted always active

    submitted.classList.add(
        "active"
    );


    if (
        value === "pending"
    ) {

        review.classList.add(
            "active"
        );

    }


    if (
        value === "in progress"
    ) {

        review.classList.add(
            "active"
        );

        progress.classList.add(
            "active"
        );

    }


    if (
        value === "completed" ||
        value === "resolved"
    ) {

        review.classList.add(
            "active"
        );

        progress.classList.add(
            "active"
        );

        completed.classList.add(
            "active"
        );

    }

}


// ==========================================
// STATUS CLASS
// ==========================================

function getStatusClass(
    status
) {

    const value =
        String(status)
            .toLowerCase();


    if (
        value === "pending"
    ) {

        return "pending";

    }


    if (
        value === "in progress"
    ) {

        return "progress";

    }


    if (
        value === "completed" ||
        value === "resolved"
    ) {

        return "completed";

    }


    return "unknown";

}


// ==========================================
// LIVE UPDATES (Supabase Realtime)
// ==========================================

function subscribeToComplaintChanges() {

    try {

        supabaseClient
            .channel("complaint-details-" + complaintId)
            .on(
                "postgres_changes",
                {
                    event: "UPDATE",
                    schema: "public",
                    table: "complaints",
                    filter: "id=eq." + complaintId
                },
                (payload) => {

                    if (payload?.new) {
                        displayComplaint(payload.new);

                        if (window.CampusCare) {
                            CampusCare.toast("This complaint's status just changed.", "info");
                        }
                    }
                }
            )
            .subscribe();

    } catch (error) {

        console.warn("Realtime subscription unavailable:", error);
    }

}


// ==========================================
// DATE
// ==========================================

function formatDate(
    date
) {

    if (!date) {

        return "Unknown";

    }


    return new Date(date)
        .toLocaleDateString(
            "en-IN",
            {
                day: "numeric",
                month: "short",
                year: "numeric"
            }
        );

}


// ==========================================
// ERROR
// ==========================================

function showError(
    message
) {

    document.getElementById(
        "loading"
    ).innerHTML = `

        <div class="error-box">

            <div class="error-icon">
                <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"/><path d="M12 9v4M12 17h.01"/></svg>
            </div>

            <h2>
                ${message}
            </h2>

            <p>
                Please go back and try again.
            </p>

            <a
                href="my-complaints.html"
                class="back-main-btn">

                ← My Complaints

            </a>

        </div>

    `;

}


// ==========================================
// PRINT
// ==========================================

document.addEventListener("DOMContentLoaded", () => {

    const printBtn = document.getElementById("printBtn");

    if (printBtn) {
        printBtn.addEventListener("click", () => window.print());
    }
});


// ==========================================
// START
// ==========================================

loadComplaint();
