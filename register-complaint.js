// ========================================
// NITR CAMPUSCARE - REGISTER COMPLAINT
// ========================================

const EVIDENCE_BUCKET = "complaint-evidence";

let currentUser = null;
let selectedFile = null;


// ========================================
// MAKE SURE USER IS LOGGED IN
// ========================================

async function checkUser() {

    const {
        data: { user },
        error
    } = await supabaseClient.auth.getUser();

    if (error || !user) {
        window.location.href = "login.html";
        return null;
    }

    return user;
}


// ========================================
// LOAD USER INFORMATION
// ========================================

async function loadUserInfo() {

    const user = await checkUser();

    if (!user) return;

    currentUser = user;

    const metadata = user.user_metadata || {};
    const name = metadata.full_name || "Student";
    const rollNumber = metadata.roll_number || "";

    const nameDisplay = document.getElementById("studentNameDisplay");
    const metaDisplay = document.getElementById("studentMetaDisplay");

    if (nameDisplay) nameDisplay.textContent = name;

    if (metaDisplay) {
        metaDisplay.textContent = [user.email, rollNumber].filter(Boolean).join(" • ");
    }

}


// ========================================
// CATEGORY TILES
// ========================================

const categoryGrid = document.getElementById("categoryGrid");
const categoryInput = document.getElementById("category");

if (categoryGrid) {

    categoryGrid.querySelectorAll(".category-tile").forEach(tile => {

        tile.addEventListener("click", () => {

            categoryGrid.querySelectorAll(".category-tile").forEach(t => {
                t.classList.remove("is-selected", "field-invalid");
            });

            tile.classList.add("is-selected");
            categoryInput.value = tile.dataset.value;
        });
    });
}


// ========================================
// PRIORITY PILLS
// ========================================

const priorityGroup = document.getElementById("priorityGroup");
const priorityInput = document.getElementById("priority");

if (priorityGroup) {

    priorityGroup.querySelectorAll(".priority-pill").forEach(pill => {

        pill.addEventListener("click", () => {

            priorityGroup.querySelectorAll(".priority-pill").forEach(p => p.classList.remove("is-selected"));

            pill.classList.add("is-selected");
            priorityInput.value = pill.dataset.value;
        });
    });
}


// ========================================
// CHARACTER COUNTER
// ========================================

const descriptionInput = document.getElementById("description");
const descCount = document.getElementById("descCount");

if (descriptionInput && descCount) {

    descriptionInput.addEventListener("input", () => {
        descCount.textContent = descriptionInput.value.length;
    });
}


// ========================================
// EVIDENCE UPLOAD (drag & drop + browse)
// ========================================

const uploadBox = document.getElementById("uploadBox");
const evidenceInput = document.getElementById("evidence");
const previewContainer = document.getElementById("previewContainer");
const imagePreview = document.getElementById("imagePreview");
const fileNameLabel = document.getElementById("fileName");
const removeFileBtn = document.getElementById("removeFile");

const MAX_FILE_SIZE = 5 * 1024 * 1024;

function handleFile(file) {

    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
        if (window.CampusCare) CampusCare.toast("Please upload a JPG, PNG or WEBP image.", "error");
        return;
    }

    if (file.size > MAX_FILE_SIZE) {
        if (window.CampusCare) CampusCare.toast("Image must be smaller than 5 MB.", "error");
        return;
    }

    selectedFile = file;

    const reader = new FileReader();

    reader.onload = (e) => {
        imagePreview.src = e.target.result;
        fileNameLabel.textContent = file.name;
        uploadBox.classList.add("has-file");
        previewContainer.classList.add("is-visible");
    };

    reader.readAsDataURL(file);
}

if (uploadBox && evidenceInput) {

    uploadBox.addEventListener("click", () => evidenceInput.click());

    evidenceInput.addEventListener("change", () => {
        handleFile(evidenceInput.files[0]);
    });

    ["dragenter", "dragover"].forEach(evt => {
        uploadBox.addEventListener(evt, (e) => {
            e.preventDefault();
            uploadBox.classList.add("is-dragover");
        });
    });

    ["dragleave", "drop"].forEach(evt => {
        uploadBox.addEventListener(evt, (e) => {
            e.preventDefault();
            uploadBox.classList.remove("is-dragover");
        });
    });

    uploadBox.addEventListener("drop", (e) => {
        const file = e.dataTransfer.files[0];
        if (file) handleFile(file);
    });
}

if (removeFileBtn) {

    removeFileBtn.addEventListener("click", (e) => {

        e.stopPropagation();

        selectedFile = null;
        evidenceInput.value = "";
        uploadBox.classList.remove("has-file");
        previewContainer.classList.remove("is-visible");
    });
}


// ========================================
// VALIDATION HELPERS
// ========================================

function markInvalid(el) {
    if (!el) return;
    el.classList.add("field-invalid");
    el.addEventListener("animationend", () => el.classList.remove("field-invalid"), { once: true });
}


// ========================================
// RESILIENT INSERT
// Some fields (location / priority / evidence_path)
// may not exist as columns on every deployment of
// this table — attempt the full insert, and if
// Postgres reports a specific missing column, drop
// just that field and retry rather than failing
// the whole submission.
// ========================================

async function insertComplaintResilient(basePayload, optionalFields) {

    const payload = Object.assign({}, basePayload);

    Object.keys(optionalFields).forEach(key => {
        const value = optionalFields[key];
        if (value !== undefined && value !== null && value !== "") {
            payload[key] = value;
        }
    });

    for (let attempt = 0; attempt < 4; attempt++) {

        const { data, error } =
            await supabaseClient.from("complaints").insert([payload]).select().single();

        if (!error) return { data, error: null };

        const msg = (error.message || "").toLowerCase();

        const missingField = Object.keys(optionalFields)
            .find(key => payload.hasOwnProperty(key) && msg.includes(key.toLowerCase()));

        if (missingField) {
            console.warn(`"${missingField}" isn't a column on complaints yet — retrying without it.`);
            delete payload[missingField];
            continue;
        }

        return { data: null, error };
    }

    return await supabaseClient.from("complaints").insert([payload]).select().single();
}


// ========================================
// FORM SUBMISSION
// ========================================

const complaintForm = document.getElementById("complaintForm");


if (complaintForm) {

    complaintForm.addEventListener("submit", async function (event) {

        event.preventDefault();


        const { data: { user }, error: userError } = await supabaseClient.auth.getUser();

        if (userError || !user) {
            if (window.CampusCare) CampusCare.toast("Please login again.", "error");
            window.location.href = "login.html";
            return;
        }


        // ========================================
        // GET FORM VALUES
        // ========================================

        const category = categoryInput?.value.trim();
        const title = document.getElementById("title")?.value.trim();
        const description = document.getElementById("description")?.value.trim();
        const location = document.getElementById("location")?.value.trim();
        const priority = priorityInput?.value || "Medium";

        const studentName = user.user_metadata?.full_name || "Student";

        const messageEl = document.getElementById("formMessage");
        messageEl.textContent = "";


        // ========================================
        // VALIDATION
        // ========================================

        let firstInvalid = null;
        const problems = [];

        if (!category) {
            problems.push("select a complaint category");
            markInvalid(categoryGrid);
            firstInvalid = firstInvalid || categoryGrid;
        }

        const titleInput = document.getElementById("title");
        if (!title) {
            problems.push("enter a complaint title");
            markInvalid(titleInput);
            firstInvalid = firstInvalid || titleInput;
        }

        if (!description) {
            problems.push("describe your complaint");
            markInvalid(descriptionInput);
            firstInvalid = firstInvalid || descriptionInput;
        }

        if (problems.length) {

            const message = "Please " + problems.join(", ") + ".";

            messageEl.textContent = message;
            messageEl.style.color = "#dc2626";

            if (window.CampusCare) CampusCare.toast(message, "error");

            firstInvalid?.scrollIntoView({ behavior: "smooth", block: "center" });

            return;
        }


        // ========================================
        // SUBMIT BUTTON LOADING STATE
        // ========================================

        const submitButton = document.getElementById("submitBtn");

        if (submitButton) {
            submitButton.disabled = true;
            submitButton.classList.add("is-loading");
        }


        try {

            // ========================================
            // UPLOAD EVIDENCE (best-effort)
            // ========================================

            let evidencePath = null;

            if (selectedFile) {

                const safeName = selectedFile.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
                const filePath = `${user.id}/${Date.now()}_${safeName}`;

                const { data: uploadData, error: uploadError } =
                    await supabaseClient.storage
                        .from(EVIDENCE_BUCKET)
                        .upload(filePath, selectedFile, { cacheControl: "3600", upsert: false });

                if (uploadError) {

                    console.warn("Evidence upload skipped:", uploadError.message);

                    if (window.CampusCare) {
                        CampusCare.toast("Couldn't attach the photo, but your complaint will still be submitted.", "info");
                    }

                } else {

                    evidencePath = uploadData?.path || filePath;
                }
            }


            // ========================================
            // INSERT COMPLAINT
            // ========================================

            const { data, error } = await insertComplaintResilient(
                {
                    user_id: user.id,
                    student_name: studentName,
                    category: category,
                    title: title,
                    description: description,
                    status: "Submitted"
                },
                {
                    location: location || null,
                    priority: priority,
                    evidence_path: evidencePath
                }
            );


            if (error) {

                console.error("Complaint submission error:", error);

                messageEl.textContent = "Could not submit complaint: " + error.message;
                messageEl.style.color = "#dc2626";

                if (window.CampusCare) CampusCare.toast("Could not submit your complaint.", "error");

                return;
            }


            // ========================================
            // SUCCESS
            // ========================================

            console.log("Complaint created:", data);

            if (window.CampusCare) {
                CampusCare.toast("Complaint submitted successfully!", "success");
            }

            messageEl.textContent = "Complaint submitted successfully! Redirecting...";
            messageEl.style.color = "#16a34a";

            setTimeout(() => {
                window.location.href = "dashboard.html";
            }, 700);


        } catch (error) {

            console.error("Unexpected error:", error);

            messageEl.textContent = "Something went wrong while submitting the complaint.";
            messageEl.style.color = "#dc2626";

            if (window.CampusCare) CampusCare.toast("Something went wrong. Please try again.", "error");

        } finally {

            if (submitButton) {
                submitButton.disabled = false;
                submitButton.classList.remove("is-loading");
            }
        }

    });

}


// ========================================
// INITIALIZE
// ========================================

loadUserInfo();
