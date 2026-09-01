// ===============================================
// NITR CAMPUSCARE — SELF-HOSTED EXPRESS SERVER
// ===============================================

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');

const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'nitr_campuscare_secret_jwt_2026';

// Ensure uploads folder exists
const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Multer Storage for Evidence Photos
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOADS_DIR),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        const baseName = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
        cb(null, `${Date.now()}_${baseName}${ext}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (req, file, cb) => {
        if (/image\/(jpeg|png|webp|jpg)/i.test(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Only JPEG, PNG, and WebP images are allowed.'));
        }
    }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve Static Uploads and Frontend Files
app.use('/uploads', express.static(UPLOADS_DIR));
app.use(express.static(__dirname));

// ===============================================
// REALTIME / SERVER-SENT EVENTS (SSE)
// ===============================================
const sseClients = new Set();

app.get('/api/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    sseClients.add(res);

    req.on('close', () => {
        sseClients.delete(res);
    });
});

function broadcastEvent(eventType, payload) {
    const data = JSON.stringify({ type: eventType, payload, timestamp: new Date().toISOString() });
    for (const client of sseClients) {
        client.write(`data: ${data}\n\n`);
    }
}

// ===============================================
// AUTHENTICATION MIDDLEWARE
// ===============================================
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Authentication required. Please sign in.' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = db.prepare('SELECT id, email, full_name, roll_number, role, created_at FROM users WHERE id = ?').get(decoded.id);
        
        if (!user) {
            return res.status(401).json({ error: 'User no longer exists.' });
        }

        req.user = {
            id: user.id,
            email: user.email,
            role: user.role,
            user_metadata: {
                full_name: user.full_name,
                roll_number: user.roll_number,
                role: user.role
            }
        };
        next();
    } catch (err) {
        return res.status(403).json({ error: 'Invalid or expired session. Please sign in again.' });
    }
}

// Optional Auth (Doesn't fail if token absent)
function optionalAuth(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        req.user = null;
        return next();
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = db.prepare('SELECT id, email, full_name, roll_number, role FROM users WHERE id = ?').get(decoded.id);
        if (user) {
            req.user = {
                id: user.id,
                email: user.email,
                role: user.role,
                user_metadata: {
                    full_name: user.full_name,
                    roll_number: user.roll_number,
                    role: user.role
                }
            };
        }
    } catch (e) {}
    next();
}

// ===============================================
// AUTH ROUTES
// ===============================================

// POST /api/auth/register
app.post('/api/auth/register', (req, res) => {
    try {
        const { email, password, full_name, roll_number, role } = req.body;

        if (!email || !password || !full_name) {
            return res.status(400).json({ error: 'Full name, email, and password are required.' });
        }

        if (password.length < 4) {
            return res.status(400).json({ error: 'Password must be at least 4 characters long.' });
        }

        const normalizedEmail = email.toLowerCase().trim();
        const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail);
        if (existing) {
            return res.status(409).json({ error: 'An account with this email address already exists.' });
        }

        const userId = crypto.randomUUID();
        const passwordHash = bcrypt.hashSync(password, 10);
        const userRole = (role === 'teacher' || role === 'admin') ? role : 'student';

        db.prepare(`
            INSERT INTO users (id, email, password_hash, full_name, roll_number, role)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(userId, normalizedEmail, passwordHash, full_name.trim(), roll_number?.trim() || '', userRole);

        const token = jwt.sign({ id: userId, email: normalizedEmail, role: userRole }, JWT_SECRET, { expiresIn: '7d' });

        const user = {
            id: userId,
            email: normalizedEmail,
            role: userRole,
            user_metadata: {
                full_name: full_name.trim(),
                roll_number: roll_number?.trim() || '',
                role: userRole
            }
        };

        return res.status(201).json({ token, user, message: 'Account registered successfully.' });

    } catch (err) {
        console.error('Register error:', err);
        return res.status(500).json({ error: 'Failed to create account.' });
    }
});

// POST /api/auth/login
app.post('/api/auth/login', (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Please provide both email and password.' });
        }

        const normalizedEmail = email.toLowerCase().trim();
        const user = db.prepare('SELECT * FROM users WHERE email = ?').get(normalizedEmail);

        if (!user || !bcrypt.compareSync(password, user.password_hash)) {
            return res.status(401).json({ error: 'Invalid login credentials.' });
        }

        const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });

        const userData = {
            id: user.id,
            email: user.email,
            role: user.role,
            user_metadata: {
                full_name: user.full_name,
                roll_number: user.roll_number,
                role: user.role
            }
        };

        return res.json({ token, user: userData, message: 'Login successful.' });

    } catch (err) {
        console.error('Login error:', err);
        return res.status(500).json({ error: 'Server error during login.' });
    }
});

// GET /api/auth/me
app.get('/api/auth/me', authenticateToken, (req, res) => {
    return res.json({ user: req.user });
});

// POST /api/auth/forgot-password
app.post('/api/auth/forgot-password', (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required.' });

    const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase().trim());
    if (!user) {
        // Return success even if not found to prevent email enumeration
        return res.json({ message: 'If that email is registered, a password reset link has been dispatched.' });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const expires = Date.now() + 3600000; // 1 hour
    db.prepare('UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?').run(resetToken, expires, user.id);

    return res.json({ message: 'Password reset link sent successfully.', resetToken });
});

// POST /api/auth/reset-password
app.post('/api/auth/reset-password', (req, res) => {
    const { token, password, email } = req.body;
    if (!password || password.length < 4) {
        return res.status(400).json({ error: 'Password must be at least 4 characters long.' });
    }

    let user = null;
    if (token) {
        user = db.prepare('SELECT id FROM users WHERE reset_token = ? AND reset_token_expires > ?').get(token, Date.now());
    } else if (email) {
        user = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase().trim());
    }

    if (!user) {
        return res.status(400).json({ error: 'Invalid or expired password reset request.' });
    }

    const passwordHash = bcrypt.hashSync(password, 10);
    db.prepare('UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?').run(passwordHash, user.id);

    return res.json({ message: 'Password updated successfully. You may now sign in.' });
});

// ===============================================
// COMPLAINTS ROUTES
// ===============================================

// GET /api/complaints
app.get('/api/complaints', authenticateToken, (req, res) => {
    try {
        const { search, status, category, priority, sort, page, limit } = req.query;
        const isStaff = (req.user.role === 'teacher' || req.user.role === 'admin');

        let sql = 'SELECT * FROM complaints WHERE 1=1';
        const params = [];

        // Students can only see their own complaints
        if (!isStaff) {
            sql += ' AND user_id = ?';
            params.push(req.user.id);
        }

        if (status && status !== 'all') {
            if (status.toLowerCase() === 'completed' || status.toLowerCase() === 'resolved') {
                sql += " AND status IN ('Resolved', 'Completed')";
            } else if (status.toLowerCase() === 'pending' || status.toLowerCase() === 'submitted') {
                sql += " AND status IN ('Submitted', 'Pending')";
            } else {
                sql += ' AND status = ?';
                params.push(status);
            }
        }

        if (category && category !== 'all') {
            sql += ' AND LOWER(category) = LOWER(?)';
            params.push(category);
        }

        if (priority && priority !== 'all') {
            sql += ' AND LOWER(priority) = LOWER(?)';
            params.push(priority);
        }

        if (search) {
            sql += ' AND (title LIKE ? OR description LIKE ? OR student_name LIKE ? OR id LIKE ? OR location LIKE ?)';
            const term = `%${search}%`;
            params.push(term, term, term, term, term);
        }

        // Sorting
        if (sort === 'oldest') {
            sql += ' ORDER BY created_at ASC';
        } else {
            sql += ' ORDER BY created_at DESC';
        }

        // Pagination
        if (limit) {
            const l = parseInt(limit, 10) || 15;
            const p = parseInt(page, 10) || 0;
            sql += ' LIMIT ? OFFSET ?';
            params.push(l, p * l);
        }

        const complaints = db.prepare(sql).all(...params);
        return res.json(complaints);

    } catch (err) {
        console.error('Fetch complaints error:', err);
        return res.status(500).json({ error: 'Failed to fetch complaints.' });
    }
});

// POST /api/complaints (File upload supported)
app.post('/api/complaints', authenticateToken, upload.single('evidence'), (req, res) => {
    try {
        const { title, description, category, priority, location } = req.body;

        if (!title || !description || !category) {
            return res.status(400).json({ error: 'Title, description, and category are required.' });
        }

        const complaintId = crypto.randomUUID();
        const studentName = req.user.user_metadata?.full_name || req.user.email.split('@')[0] || 'Student';
        const evidencePath = req.file ? `/uploads/${req.file.filename}` : (req.body.evidence_path || null);
        const resolvedPriority = priority || 'Medium';

        db.prepare(`
            INSERT INTO complaints (id, user_id, student_name, title, description, category, priority, status, location, evidence_path)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'Submitted', ?, ?)
        `).run(
            complaintId,
            req.user.id,
            studentName,
            title.trim(),
            description.trim(),
            category.trim(),
            resolvedPriority,
            location?.trim() || null,
            evidencePath
        );

        // Audit Trail entry
        db.prepare(`
            INSERT INTO complaint_status_history (id, complaint_id, status, note, changed_by)
            VALUES (?, ?, 'Submitted', 'Complaint initially filed by student.', ?)
        `).run(crypto.randomUUID(), complaintId, req.user.id);

        const newComplaint = db.prepare('SELECT * FROM complaints WHERE id = ?').get(complaintId);

        broadcastEvent('new_complaint', newComplaint);

        return res.status(201).json({ data: newComplaint, message: 'Complaint filed successfully.' });

    } catch (err) {
        console.error('Submit complaint error:', err);
        return res.status(500).json({ error: 'Failed to record grievance.' });
    }
});

// GET /api/complaints/:id
app.get('/api/complaints/:id', authenticateToken, (req, res) => {
    try {
        const rawId = req.params.id;
        const isStaff = (req.user.role === 'teacher' || req.user.role === 'admin');

        // Look up by full ID or prefix match
        let complaint = null;
        if (rawId.length >= 32 || rawId.includes('-')) {
            complaint = db.prepare('SELECT * FROM complaints WHERE id = ?').get(rawId);
        } else {
            complaint = db.prepare('SELECT * FROM complaints WHERE id LIKE ?').get(`${rawId}%`);
        }

        if (!complaint) {
            return res.status(404).json({ error: 'Grievance not found.' });
        }

        if (!isStaff && complaint.user_id !== req.user.id) {
            return res.status(403).json({ error: 'You are not authorized to view this complaint.' });
        }

        const history = db.prepare(`
            SELECT h.*, u.full_name as changer_name, u.role as changer_role
            FROM complaint_status_history h
            LEFT JOIN users u ON h.changed_by = u.id
            WHERE h.complaint_id = ?
            ORDER BY h.created_at ASC
        `).all(complaint.id);

        return res.json({ complaint, history });

    } catch (err) {
        console.error('Fetch complaint details error:', err);
        return res.status(500).json({ error: 'Failed to fetch complaint details.' });
    }
});

// PATCH /api/complaints/:id/status
app.patch('/api/complaints/:id/status', authenticateToken, (req, res) => {
    try {
        const isStaff = (req.user.role === 'teacher' || req.user.role === 'admin');
        if (!isStaff) {
            return res.status(403).json({ error: 'Staff credentials required to update grievance status.' });
        }

        const complaintId = req.params.id;
        const { status, note, teacher_notes } = req.body;

        if (!status) {
            return res.status(400).json({ error: 'Status is required.' });
        }

        const complaint = db.prepare('SELECT * FROM complaints WHERE id = ?').get(complaintId);
        if (!complaint) {
            return res.status(404).json({ error: 'Complaint not found.' });
        }

        const notesToSave = teacher_notes !== undefined ? teacher_notes : complaint.teacher_notes;

        db.prepare(`
            UPDATE complaints
            SET status = ?, teacher_notes = ?, updated_at = datetime('now')
            WHERE id = ?
        `).run(status, notesToSave, complaintId);

        // Audit Trail Entry
        db.prepare(`
            INSERT INTO complaint_status_history (id, complaint_id, status, note, changed_by)
            VALUES (?, ?, ?, ?, ?)
        `).run(
            crypto.randomUUID(),
            complaintId,
            status,
            note || `Status transitioned to ${status}.`,
            req.user.id
        );

        const updated = db.prepare('SELECT * FROM complaints WHERE id = ?').get(complaintId);
        broadcastEvent('status_update', updated);

        return res.json({ data: updated, message: `Status updated to ${status}.` });

    } catch (err) {
        console.error('Update status error:', err);
        return res.status(500).json({ error: 'Failed to update status.' });
    }
});

// PATCH /api/complaints/:id/notes
app.patch('/api/complaints/:id/notes', authenticateToken, (req, res) => {
    try {
        const isStaff = (req.user.role === 'teacher' || req.user.role === 'admin');
        if (!isStaff) {
            return res.status(403).json({ error: 'Staff access required.' });
        }

        const complaintId = req.params.id;
        const { teacher_notes } = req.body;

        db.prepare(`
            UPDATE complaints
            SET teacher_notes = ?, updated_at = datetime('now')
            WHERE id = ?
        `).run(teacher_notes || '', complaintId);

        const updated = db.prepare('SELECT * FROM complaints WHERE id = ?').get(complaintId);
        return res.json({ data: updated, message: 'Notes saved.' });

    } catch (err) {
        console.error('Save notes error:', err);
        return res.status(500).json({ error: 'Failed to save notes.' });
    }
});

// POST /api/complaints/bulk-status
app.post('/api/complaints/bulk-status', authenticateToken, (req, res) => {
    try {
        const isStaff = (req.user.role === 'teacher' || req.user.role === 'admin');
        if (!isStaff) {
            return res.status(403).json({ error: 'Staff access required.' });
        }

        const { ids, status, note } = req.body;
        if (!Array.isArray(ids) || ids.length === 0 || !status) {
            return res.status(400).json({ error: 'Provide valid complaint IDs and status.' });
        }

        const placeholders = ids.map(() => '?').join(',');
        db.prepare(`
            UPDATE complaints
            SET status = ?, updated_at = datetime('now')
            WHERE id IN (${placeholders})
        `).run(status, ...ids);

        const insertHistory = db.prepare(`
            INSERT INTO complaint_status_history (id, complaint_id, status, note, changed_by)
            VALUES (?, ?, ?, ?, ?)
        `);

        for (const id of ids) {
            insertHistory.run(crypto.randomUUID(), id, status, note || `Bulk status update to ${status}`, req.user.id);
        }

        broadcastEvent('bulk_status_update', { ids, status });

        return res.json({ message: `Successfully updated ${ids.length} complaints to ${status}.` });

    } catch (err) {
        console.error('Bulk update error:', err);
        return res.status(500).json({ error: 'Failed to perform bulk update.' });
    }
});

// GET /api/analytics
app.get('/api/analytics', (req, res) => {
    try {
        const total = db.prepare('SELECT COUNT(*) as count FROM complaints').get().count;
        const pending = db.prepare("SELECT COUNT(*) as count FROM complaints WHERE status IN ('Pending', 'Submitted')").get().count;
        const inProgress = db.prepare("SELECT COUNT(*) as count FROM complaints WHERE status = 'In Progress'").get().count;
        const resolved = db.prepare("SELECT COUNT(*) as count FROM complaints WHERE status IN ('Resolved', 'Completed')").get().count;

        return res.json({
            total: { count: total },
            pending: { count: pending },
            inProgress: { count: inProgress },
            resolved: { count: resolved }
        });
    } catch (err) {
        console.error('Analytics error:', err);
        return res.status(500).json({ error: 'Failed to calculate analytics.' });
    }
});

// POST /api/upload (Standalone Upload)
app.post('/api/upload', authenticateToken, upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded.' });
    }
    const publicUrl = `/uploads/${req.file.filename}`;
    return res.json({ path: publicUrl, url: publicUrl });
});

function startServer(port) {
    const server = app.listen(port, () => {
        console.log(`
======================================================
  🏛️  NIT ROURKELA CAMPUSCARE — SELF-HOSTED PORTAL
======================================================
  🚀 Server running at: http://localhost:${port}
  📁 Database:           ${path.join(__dirname, 'campuscare.db')}
  📸 Evidence Uploads:   ${UPLOADS_DIR}
  
  🔑 Default Test Logins:
     • Student:  student@nitrkl.ac.in   (pass: student123)
     • Student:  1234@gmail.com         (pass: 1234)
     • Faculty:  admin@nitrkl.ac.in     (pass: admin123)
======================================================
`);
    });

    server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.log(`⚠️ Port ${port} is in use, trying port ${port + 1}...`);
            startServer(port + 1);
        } else {
            console.error('Server error:', err);
        }
    });
}

startServer(process.env.PORT ? parseInt(process.env.PORT, 10) : 4000);

