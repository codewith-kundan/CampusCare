// ==========================================
// NITR CAMPUSCARE — MY COMPLAINTS
// ==========================================

let allComplaints = [];


// ==========================================
// LOAD COMPLAINTS
// ==========================================

async function loadComplaints() {

    const container =
        document.getElementById(
            "complaintsContainer"
        );


    try {

        const {

            data: {
                user
            },

            error: userError

        } =
            await supabaseClient
                .auth
                .getUser();


        // ==========================================
        // LOGIN CHECK
        // ==========================================

        if (
            userError ||
            !user
        ) {

            window.location.href =
                "login.html";

            return;

        }


        // ==========================================
        // GET USER COMPLAINTS
        // ==========================================

        const {

            data,
            error

        } =
            await supabaseClient
                .from("complaints")
                .select("*")
                .eq(
                    "user_id",
                    user.id
                )
                .order(
                    "created_at",
                    {
                        ascending: false
                    }
                );


        if (error) {

            console.error(
                "Complaint loading error:",
                error
            );


            container.innerHTML = `

                <div class="empty">

                    <div class="empty-icon">
                        <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"/><path d="M12 9v4M12 17h.01"/></svg>
                    </div>

                    <h2>
                        Unable to load complaints
                    </h2>

                    <p>
                        ${escapeHTML(
                            error.message
                        )}
                    </p>

                </div>

            `;

            if (window.CampusCare) {
                CampusCare.toast("Couldn't load your complaints.", "error");
            }

            return;

        }


        allComplaints =
            data || [];


        renderComplaints(
            allComplaints
        );


        subscribeToComplaintChanges(user.id);

    }


    catch (error) {

        console.error(
            error
        );


        container.innerHTML = `

            <div class="empty">

                <div class="empty-icon">
                    <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"/><path d="M12 9v4M12 17h.01"/></svg>
                </div>

                <h2>
                    Something went wrong
                </h2>

                <p>
                    Please refresh the page and try again.
                </p>

            </div>

        `;

    }

}



// ==========================================
// RENDER COMPLAINTS
// ==========================================

function renderComplaints(
    complaints
) {

    const container =
        document.getElementById(
            "complaintsContainer"
        );


    // ==========================================
    // EMPTY STATE
    // ==========================================

    if (
        !complaints ||
        complaints.length === 0
    ) {

        container.innerHTML = `

            <div class="empty">

                <div class="empty-icon">
                    <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 2h6a1 1 0 0 1 1 1v2H8V3a1 1 0 0 1 1-1Z"/><path d="M8 4H6a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2"/></svg>
                </div>

                <h2>
                    No complaints found
                </h2>

                <p>
                    You haven't submitted any complaints yet.
                </p>

                <button
                    class="new-btn"
                    id="emptyNewBtn">

                    + Register a Complaint

                </button>

            </div>

        `;

        const emptyBtn = document.getElementById("emptyNewBtn");

        if (emptyBtn) {
            emptyBtn.addEventListener("click", () => {
                window.location.href = "register-complaint.html";
            });
        }

        return;

    }



    // ==========================================
    // CREATE CARDS
    // ==========================================

    container.innerHTML =
        complaints.map(
            complaint => {

                const status =
                    complaint.status ||
                    "Pending";


                const statusClass =
                    getStatusClass(
                        status
                    );


                return `

                    <article
                        class="complaint-card"
                        data-tilt
                        data-tilt-strength="3"
                        data-id="${escapeHTML(complaint.id)}">


                        <div class="complaint-top">

                            <div>

                                <div class="category">
                                    ${escapeHTML(
                                        complaint.category ||
                                        "General"
                                    )}
                                </div>

                                <h2 class="complaint-title">
                                    ${escapeHTML(
                                        complaint.title ||
                                        "Untitled Complaint"
                                    )}
                                </h2>

                                <p class="complaint-description">
                                    ${escapeHTML(
                                        complaint.description ||
                                        "No description provided."
                                    )}
                                </p>

                            </div>

                            <span class="status ${statusClass}">
                                ${escapeHTML(status)}
                            </span>

                        </div>


                        <div class="complaint-footer">

                            <span>
                                Submitted: ${formatDate(complaint.created_at)}
                            </span>

                            <span class="complaint-id">
                                #${escapeHTML(
                                    String(
                                        complaint.id ||
                                        "N/A"
                                    ).slice(0, 8)
                                )}
                                <span class="view-details">View Details →</span>
                            </span>

                        </div>

                    </article>

                `;

            }
        ).join("");


    container.querySelectorAll(".complaint-card").forEach(card => {
        card.addEventListener("click", () => openComplaint(card.dataset.id));
    });

    if (window.CampusCare) {
        CampusCare.refreshTilt();
    }

}



// ==========================================
// OPEN COMPLAINT DETAILS
// ==========================================

function openComplaint(
    id
) {

    if (!id) {

        return;

    }


    window.location.href =
        "complaint-details.html?id=" +
        encodeURIComponent(
            id
        );

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
// FILTER
// ==========================================

function filterComplaints() {

    const search =
        document
            .getElementById(
                "searchInput"
            )
            .value
            .toLowerCase()
            .trim();


    const status =
        document
            .getElementById(
                "statusFilter"
            )
            .value;


    const category =
        document
            .getElementById(
                "categoryFilter"
            )
            .value;



    const filtered =
        allComplaints.filter(
            complaint => {


                const title =
                    String(
                        complaint.title ||
                        ""
                    ).toLowerCase();


                const description =
                    String(
                        complaint.description ||
                        ""
                    ).toLowerCase();


                const complaintCategory =
                    String(
                        complaint.category ||
                        ""
                    );


                const complaintStatus =
                    String(
                        complaint.status ||
                        ""
                    );


                const matchesSearch =
                    !search ||
                    title.includes(
                        search
                    ) ||
                    description.includes(
                        search
                    );


                const matchesStatus =
                    status === "all" ||
                    complaintStatus === status;


                const matchesCategory =
                    category === "all" ||
                    complaintCategory === category;


                return (
                    matchesSearch &&
                    matchesStatus &&
                    matchesCategory
                );

            }
        );


    renderComplaints(
        filtered
    );

}



// ==========================================
// LIVE UPDATES (Supabase Realtime)
// ==========================================

function subscribeToComplaintChanges(userId) {

    try {

        supabaseClient
            .channel("my-complaints-" + userId)
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "complaints",
                    filter: "user_id=eq." + userId
                },
                async () => {

                    const { data } = await supabaseClient
                        .from("complaints")
                        .select("*")
                        .eq("user_id", userId)
                        .order("created_at", { ascending: false });

                    allComplaints = data || [];
                    filterComplaints();
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
// SECURITY
// ==========================================

function escapeHTML(
    value
) {

    const div =
        document.createElement(
            "div"
        );


    div.textContent =
        String(
            value
        );


    return div.innerHTML;

}



// ==========================================
// EVENT LISTENERS
// ==========================================

document
    .getElementById(
        "searchInput"
    )
    .addEventListener(
        "input",
        filterComplaints
    );


document
    .getElementById(
        "statusFilter"
    )
    .addEventListener(
        "change",
        filterComplaints
    );


document
    .getElementById(
        "categoryFilter"
    )
    .addEventListener(
        "change",
        filterComplaints
    );



// ==========================================
// START
// ==========================================

loadComplaints();
