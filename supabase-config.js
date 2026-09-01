// ===============================================
// NITR CAMPUSCARE — SELF-HOSTED CLIENT INITIALIZER
// ===============================================

// Supabase compatibility bridge to self-hosted Node.js + SQLite backend
let supabaseClient = window.supabaseClient || null;

if (!supabaseClient && typeof window !== 'undefined') {
    if (window.CampusCareAPI) {
        supabaseClient = window.supabaseClient;
    } else {
        console.log('CampusCare Self-Hosted API Client initializing...');
    }
}
