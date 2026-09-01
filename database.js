// ===============================================
// NITR CAMPUSCARE — SQLITE DATABASE MODULE
// ===============================================

const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'campuscare.db');
const db = new Database(DB_PATH);

// Enable WAL mode for better concurrency and foreign keys
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ===============================================
// SCHEMA INITIALIZATION
// ===============================================
function initSchema() {
    db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            full_name TEXT NOT NULL,
            roll_number TEXT,
            role TEXT DEFAULT 'student',
            reset_token TEXT,
            reset_token_expires INTEGER,
            created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS complaints (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            student_name TEXT,
            title TEXT NOT NULL,
            description TEXT NOT NULL,
            category TEXT NOT NULL,
            priority TEXT DEFAULT 'Medium',
            status TEXT DEFAULT 'Submitted',
            location TEXT,
            evidence_path TEXT,
            teacher_notes TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS complaint_status_history (
            id TEXT PRIMARY KEY,
            complaint_id TEXT NOT NULL,
            status TEXT NOT NULL,
            note TEXT,
            changed_by TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE CASCADE,
            FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE SET NULL
        );

        CREATE INDEX IF NOT EXISTS idx_complaints_user ON complaints(user_id);
        CREATE INDEX IF NOT EXISTS idx_complaints_status ON complaints(status);
        CREATE INDEX IF NOT EXISTS idx_complaints_created ON complaints(created_at);
        CREATE INDEX IF NOT EXISTS idx_history_complaint ON complaint_status_history(complaint_id);
    `);

    seedDefaultUsers();
}

// ===============================================
// SEED DEFAULT USERS & DEMO DATA
// ===============================================
function seedDefaultUsers() {
    const count = db.prepare('SELECT COUNT(*) as cnt FROM users').get().cnt;
    if (count > 0) return;

    console.log('🌱 Seeding initial CampusCare accounts...');

    const insertUser = db.prepare(`
        INSERT INTO users (id, email, password_hash, full_name, roll_number, role)
        VALUES (?, ?, ?, ?, ?, ?)
    `);

    // Student 1
    const student1Id = crypto.randomUUID();
    const student1Hash = bcrypt.hashSync('student123', 10);
    insertUser.run(student1Id, 'student@nitrkl.ac.in', student1Hash, 'Rahul Sharma', '122CS0145', 'student');

    // Student 2 (Also handles 1234@nitrkl.ac.in and 1234@gmail.com for instant testing)
    const student2Id = crypto.randomUUID();
    const student2Hash = bcrypt.hashSync('123456', 10);
    insertUser.run(student2Id, '1234@nitrkl.ac.in', student2Hash, 'Aryan Patel', '125CS0042', 'student');

    // Student 3: matching test email from screenshot
    const testId = crypto.randomUUID();
    const testHash = bcrypt.hashSync('1234', 10);
    insertUser.run(testId, '1234@gmail.com', testHash, 'Test Student', '125CS0999', 'student');

    // Faculty / Admin
    const adminId = crypto.randomUUID();
    const adminHash = bcrypt.hashSync('admin123', 10);
    insertUser.run(adminId, 'admin@nitrkl.ac.in', adminHash, 'Dr. S. K. Mahapatra', 'FAC-7821', 'teacher');

    // Seed Demo Complaints
    const insertComplaint = db.prepare(`
        INSERT INTO complaints (id, user_id, student_name, title, description, category, priority, status, location, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', ?))
    `);

    const insertHistory = db.prepare(`
        INSERT INTO complaint_status_history (id, complaint_id, status, note, created_at)
        VALUES (?, ?, ?, ?, datetime('now', ?))
    `);

    const c1Id = crypto.randomUUID();
    insertComplaint.run(
        c1Id,
        student1Id,
        'Rahul Sharma',
        'Ceiling fan non-functional in Room B-214',
        'The regulator and ceiling fan in room B-214 are completely stopped. Suspected capacitor burnout. Please arrange for electrical maintenance.',
        'Electricity',
        'High',
        'In Progress',
        'Hall of Residence 6, Room B-214',
        '-2 days'
    );
    insertHistory.run(crypto.randomUUID(), c1Id, 'Submitted', 'Grievance registered by student.', '-2 days');
    insertHistory.run(crypto.randomUUID(), c1Id, 'In Progress', 'Assigned to Electrical Maintenance Team.', '-1 day');

    const c2Id = crypto.randomUUID();
    insertComplaint.run(
        c2Id,
        student1Id,
        'Rahul Sharma',
        'Water purifier filter leakage on 2nd floor',
        'Continuous water dripping from the commercial RO unit near water cooler block 2. Floor is slippery.',
        'Water',
        'Critical',
        'Submitted',
        'SD Hall, 2nd Floor Corridor',
        '-1 day'
    );
    insertHistory.run(crypto.randomUUID(), c2Id, 'Submitted', 'Grievance registered by student.', '-1 day');

    const c3Id = crypto.randomUUID();
    insertComplaint.run(
        c3Id,
        student2Id,
        'Aryan Patel',
        'Wi-Fi Access Point frequent drops in CS Department',
        'NITR-WLAN connection drops repeatedly during online lab sessions in Lab 3. High packet loss observed.',
        'Internet',
        'Medium',
        'Resolved',
        'Department of CSE, Lab 3',
        '-5 days'
    );
    insertHistory.run(crypto.randomUUID(), c3Id, 'Submitted', 'Grievance registered by student.', '-5 days');
    insertHistory.run(crypto.randomUUID(), c3Id, 'In Progress', 'Computer Centre inspecting AP gateway.', '-4 days');
    insertHistory.run(crypto.randomUUID(), c3Id, 'Resolved', 'Access point firmware updated and channel frequency reconfigured.', '-3 days');

    console.log('✅ Default users and sample grievances seeded successfully.');
}

// Initialize database schema immediately on load
initSchema();

module.exports = db;
