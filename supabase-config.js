// ==========================================
// NITR CAMPUSCARE — SUPABASE CONFIGURATION
// ==========================================

const SUPABASE_URL = "https://uhvdjaxkohumyerihaah.supabase.co";
const SUPABASE_KEY = "sb_publishable_hyE7HjRXJczx0tUmHZiYDQ_3StB_JRV";

let supabaseClient = null;

try {
    if (typeof window !== "undefined" && window.supabase && typeof window.supabase.createClient === "function") {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: true
            }
        });
        window.supabaseClient = supabaseClient;
    } else {
        console.warn("Supabase SDK is not loaded yet. Will attempt late binding if needed.");
    }
} catch (e) {
    console.error("Supabase client initialization error:", e);
}
