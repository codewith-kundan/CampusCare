// ===============================================
// NITR CAMPUSCARE — CREATE ADMIN CLI SCRIPT
// ===============================================
// Usage: node create-admin.js <email> <password> [fullName] [employeeId]
// Example: node create-admin.js warden@nitrkl.ac.in mySecretPass "Chief Warden" "FAC-1001"

const db = require('./database');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const args = process.argv.slice(2);

if (args.length < 2) {
    console.log(`
=====================================================
  🏛️  CampusCare Admin Account Creator
=====================================================
  Usage:
    node create-admin.js <email> <password> [fullName] [employeeId]

  Example:
    node create-admin.js warden@nitrkl.ac.in Pass@123 "Prof. A. K. Ray" "FAC-901"
=====================================================
`);
    process.exit(1);
}

const email = args[0].toLowerCase().trim();
const password = args[1];
const fullName = args[2] || 'Faculty Admin';
const employeeId = args[3] || 'FAC-ADMIN';

if (password.length < 4) {
    console.error('❌ Error: Password must be at least 4 characters long.');
    process.exit(1);
}

const existing = db.prepare('SELECT id, email, role FROM users WHERE email = ?').get(email);

if (existing) {
    // If user exists, promote to admin/teacher and update password
    const hash = bcrypt.hashSync(password, 10);
    db.prepare(`
        UPDATE users 
        SET role = 'teacher', password_hash = ?, full_name = ?, roll_number = ?
        WHERE id = ?
    `).run(hash, fullName, employeeId, existing.id);

    console.log(`✅ Existing user '${email}' was promoted to Faculty/Admin role with updated password.`);
} else {
    // Create new admin user
    const userId = crypto.randomUUID();
    const hash = bcrypt.hashSync(password, 10);

    db.prepare(`
        INSERT INTO users (id, email, password_hash, full_name, roll_number, role)
        VALUES (?, ?, ?, ?, ?, 'teacher')
    `).run(userId, email, hash, fullName, employeeId);

    console.log(`✅ New Faculty/Admin account created successfully:
   • Email:    ${email}
   • Role:     Faculty/Teacher (Admin)
   • Name:     ${fullName}
   • Emp ID:   ${employeeId}
`);
}

process.exit(0);
