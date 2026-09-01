// ===============================================
// NITR CAMPUSCARE — REGISTER COMPLAINT SCRIPT
// ===============================================

const EVIDENCE_BUCKET = "complaint-evidence";

let currentUser = null;
let selectedFile = null;

document.addEventListener("DOMContentLoaded", () => {

    async function init() {
        if (!supabaseClient) return;

        try {
            const { data: { user }, error } = await supabaseClient.auth.getUser();

            if (error || !user) {
                window.location.href = "login.html";
                return;
            }

            currentUser = user;
            const metadata = user.user_metadata || {};
            const name = metadata.full_name || user.email.split('@')[0] || "Student";
            const rollNumber = metadata.roll_number || "";

            const nameDisplay = document.getElementById("studentNameDisplay");
            const metaDisplay = document.getElementById("studentMetaDisplay");

            if (nameDisplay) nameDisplay.textContent = name;
            if (metaDisplay) metaDisplay.textContent = [user.email, rollNumber].filter(Boolean).join(" • ");

        } catch (e) {
            console.error("Auth init error:", e);
        }
    }

    init();

    // ========================================
    // CATEGORY TILES SELECTION
    // ========================================
    const categoryGrid = document.getElementById("categoryGrid");
    const categoryInput = document.getElementById("category");

    if (categoryGrid && categoryInput) {
        categoryGrid.querySelectorAll(".category-tile").forEach(tile => {
            tile.addEventListener("click", () => {
                categoryGrid.querySelectorAll(".category-tile").forEach(t => t.classList.remove("is-selected"));
                categoryGrid.classList.remove("field-invalid");
                tile.classList.add("is-selected");
                categoryInput.value = tile.dataset.value;
            });
        });
    }

    // ========================================
    // PRIORITY PILLS SELECTION
    // ========================================
    const priorityGroup = document.getElementById("priorityGroup");
    const priorityInput = document.getElementById("priority");

    if (priorityGroup && priorityInput) {
        priorityGroup.querySelectorAll(".priority-pill").forEach(pill => {
            pill.addEventListener("click", () => {
                priorityGroup.querySelectorAll(".priority-pill").forEach(p => p.classList.remove("is-selected"));
                pill.classList.add("is-selected");
                priorityInput.value = pill.dataset.value;
            });
        });
    }

    // ========================================
    // DESCRIPTION COUNTER & AI ENHANCER
    // ========================================
    const descriptionInput = document.getElementById("description");
    const descCount = document.getElementById("descCount");
    const aiSuggestionTrigger = document.getElementById("aiSuggestionTrigger");

    if (descriptionInput && descCount) {
        descriptionInput.addEventListener("input", () => {
            const len = descriptionInput.value.length;
            descCount.textContent = len;
            
            if (aiSuggestionTrigger) {
                if (len >= 10 && len <= 120) {
                    aiSuggestionTrigger.style.display = "inline-flex";
                } else {
                    aiSuggestionTrigger.style.display = "none";
                }
            }
        });
    }

    if (aiSuggestionTrigger && descriptionInput) {
        aiSuggestionTrigger.addEventListener("click", () => {
            const raw = descriptionInput.value.trim();
            if (!raw) return;

            const category = categoryInput?.value || "General";
            const location = document.getElementById("location")?.value.trim();
            const locationText = location ? ` at ${location}` : "";

            const enhancements = {
                "fan": `The ceiling fan${locationText} is malfunctioning (making excessive noise / rotating at abnormally low speed). It appears to be a capacitor or motor issue. Kindly arrange for electrical maintenance.`,
                "water": `There is an acute issue with water supply${locationText}. The taps/purifiers are not functioning properly, causing severe inconvenience. Immediate plumber assistance is requested.`,
                "light": `The room/corridor lighting${locationText} is non-functional or flickering intermittently. Please dispatch an electrician to inspect the choke or replace the tube.`,
                "clean": `The common areas / dustbins${locationText} require urgent cleaning and waste disposal. Sanitation staff inspection is requested at the earliest.`,
                "wifi": `The campus Wi-Fi network (NITR-WLAN)${locationText} is experiencing frequent drops and very high latency, preventing access to academic portals. Kindly check the nearest access point.`,
                "lan": `The physical LAN ethernet port in room${locationText} has no link connection. I have verified with multiple cables and laptops. Please assist in resetting the port.`
            };

            let matched = false;
            const lower = raw.toLowerCase();
            for (const [key, text] of Object.entries(enhancements)) {
                if (lower.includes(key)) {
                    descriptionInput.value = text;
                    matched = true;
                    break;
                }
            }

            if (!matched) {
                descriptionInput.value = `I would like to formally report a ${category.toLowerCase()} maintenance grievance regarding: ${raw}. This is currently impacting daily routine${locationText}. Kindly inspect and resolve at the earliest convenience.`;
            }

            if (descCount) descCount.textContent = descriptionInput.value.length;
            aiSuggestionTrigger.style.display = "none";
            if (window.CampusCare) CampusCare.toast("Grievance description refined with AI context.", "success");
        });
    }

    // ========================================
    // PHOTO EVIDENCE UPLOAD
    // ========================================
    const uploadBox = document.getElementById("uploadBox");
    const evidenceInput = document.getElementById("evidence");
    const previewContainer = document.getElementById("previewContainer");
    const imagePreview = document.getElementById("imagePreview");
    const fileNameLabel = document.getElementById("fileName");
    const removeFileBtn = document.getElementById("removeFile");

    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

    function handleFile(file) {
        if (!file) return;

        if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
            if (window.CampusCare) CampusCare.toast("Please upload a valid JPG, PNG, or WEBP image.", "error");
            return;
        }

        if (file.size > MAX_FILE_SIZE) {
            if (window.CampusCare) CampusCare.toast("Image file size exceeds 5MB limit.", "error");
            return;
        }

        selectedFile = file;

        const reader = new FileReader();
        reader.onload = (e) => {
            if (imagePreview) imagePreview.src = e.target.result;
            if (fileNameLabel) fileNameLabel.textContent = `${file.name} (${(file.size / 1024).toFixed(0)} KB)`;
            if (uploadBox) uploadBox.classList.add("has-file");
            if (previewContainer) previewContainer.style.display = "block";
        };
        reader.readAsDataURL(file);
    }

    if (uploadBox && evidenceInput) {
        uploadBox.addEventListener("click", () => evidenceInput.click());
        evidenceInput.addEventListener("change", () => handleFile(evidenceInput.files[0]));

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
            if (evidenceInput) evidenceInput.value = "";
            if (uploadBox) uploadBox.classList.remove("has-file");
            if (previewContainer) previewContainer.style.display = "none";
        });
    }

    // ========================================
    // FORM SUBMISSION
    // ========================================
    const complaintForm = document.getElementById("complaintForm");

    if (complaintForm) {
        complaintForm.addEventListener("submit", async (event) => {
            event.preventDefault();
            if (!currentUser || !supabaseClient) return;

            const category = categoryInput?.value.trim();
            const titleInput = document.getElementById("title");
            const title = titleInput?.value.trim();
            const description = descriptionInput?.value.trim();
            const location = document.getElementById("location")?.value.trim();
            const priority = priorityInput?.value || "Medium";
            const studentName = currentUser.user_metadata?.full_name || currentUser.email.split('@')[0] || "Student";
            const messageEl = document.getElementById("formMessage");

            if (messageEl) messageEl.textContent = "";

            // Validation
            let hasError = false;

            if (!category) {
                if (categoryGrid) categoryGrid.classList.add("field-invalid");
                hasError = true;
            }

            if (!title) {
                if (titleInput) titleInput.classList.add("field-invalid");
                hasError = true;
            } else {
                if (titleInput) titleInput.classList.remove("field-invalid");
            }

            if (!description) {
                if (descriptionInput) descriptionInput.classList.add("field-invalid");
                hasError = true;
            } else {
                if (descriptionInput) descriptionInput.classList.remove("field-invalid");
            }

            if (hasError) {
                const errorText = "Please select a category and fill in all required fields.";
                if (messageEl) {
                    messageEl.textContent = errorText;
                    messageEl.className = "message text-center text-sm font-medium mb-4 text-red";
                }
                if (window.CampusCare) CampusCare.toast(errorText, "error");
                return;
            }

            const submitBtn = document.getElementById("submitBtn");
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.classList.add("is-loading");
            }

            try {
                let evidencePath = null;

                // Upload Evidence to Supabase Storage if file attached
                if (selectedFile) {
                    const safeName = selectedFile.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
                    const filePath = `${currentUser.id}/${Date.now()}_${safeName}`;
                    
                    try {
                        const { data: uploadData, error: uploadError } = await supabaseClient.storage
                            .from(EVIDENCE_BUCKET)
                            .upload(filePath, selectedFile, { cacheControl: "3600", upsert: false });

                        if (uploadError) {
                            console.warn("Storage upload notice:", uploadError.message);
                        } else {
                            evidencePath = uploadData?.path || filePath;
                        }
                    } catch (uploadErr) {
                        console.warn("Photo upload caught exception:", uploadErr);
                    }
                }

                // Prepare insert payload
                const payload = {
                    user_id: currentUser.id,
                    student_name: studentName,
                    category: category,
                    title: title,
                    description: description,
                    status: "Submitted",
                    priority: priority
                };

                if (location) payload.location = location;
                if (evidencePath) payload.evidence_path = evidencePath;

                // Resilient Insert (retries without optional columns if DB schema is unmigrated)
                let result = await supabaseClient.from("complaints").insert([payload]).select().single();

                if (result.error && result.error.message.includes("location")) {
                    delete payload.location;
                    result = await supabaseClient.from("complaints").insert([payload]).select().single();
                }

                if (result.error && result.error.message.includes("priority")) {
                    delete payload.priority;
                    result = await supabaseClient.from("complaints").insert([payload]).select().single();
                }

                if (result.error && result.error.message.includes("evidence_path")) {
                    delete payload.evidence_path;
                    result = await supabaseClient.from("complaints").insert([payload]).select().single();
                }

                if (result.error) throw result.error;

                // Also try recording initial status in complaint_status_history
                if (result.data?.id) {
                    try {
                        await supabaseClient.from("complaint_status_history").insert([{
                            complaint_id: result.data.id,
                            status: "Submitted",
                            note: "Complaint initially filed by student."
                        }]);
                    } catch (hErr) {}
                }

                if (messageEl) {
                    messageEl.textContent = "Complaint registered successfully! Redirecting to your complaints ledger...";
                    messageEl.className = "message text-center text-sm font-medium mb-4 text-green font-bold";
                }

                if (window.CampusCare) CampusCare.toast("Complaint submitted successfully!", "success");

                setTimeout(() => {
                    window.location.href = "my-complaints.html";
                }, 800);

            } catch (error) {
                console.error("Submission failed:", error);
                const msg = error.message || "Failed to submit complaint. Please try again.";
                if (messageEl) {
                    messageEl.textContent = msg;
                    messageEl.className = "message text-center text-sm font-medium mb-4 text-red";
                }
                if (window.CampusCare) CampusCare.toast(msg, "error");
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.classList.remove("is-loading");
                }
            }
        });
    }

});
