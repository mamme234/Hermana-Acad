// server.js - Hermana Academy Backend Server
// Run with: npm install express cors sqlite3 multer bcryptjs jsonwebtoken
// Then: node server.js

const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static('uploads'));

// Create uploads directory if not exists
if (!fs.existsSync('./uploads')) {
    fs.mkdirSync('./uploads');
}

// File upload configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, './uploads');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage, limits: { fileSize: 5 * 1024 * 1024 } });

// JWT Secret
const JWT_SECRET = 'hermana_academy_secret_key_2026';

// ==================== DATABASE SETUP ====================
const db = new sqlite3.Database('./hermana_academy.db', (err) => {
    if (err) {
        console.error('Database connection error:', err);
    } else {
        console.log('Connected to SQLite database');
        createTables();
    }
});

function createTables() {
    // Students table
    db.run(`CREATE TABLE IF NOT EXISTS students (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fullName TEXT NOT NULL,
        ethiopianId TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE,
        password TEXT NOT NULL,
        grade TEXT NOT NULL,
        fromGrade TEXT NOT NULL,
        toGrade TEXT NOT NULL,
        examPercent INTEGER DEFAULT 0,
        examViolations INTEGER DEFAULT 0,
        photoUrl TEXT,
        registration_paid INTEGER DEFAULT 0,
        term1_paid INTEGER DEFAULT 0,
        term2_paid INTEGER DEFAULT 0,
        term3_paid INTEGER DEFAULT 0,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Teachers table
    db.run(`CREATE TABLE IF NOT EXISTS teachers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fullName TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        phone TEXT NOT NULL,
        educationDoc TEXT,
        teachingGrades TEXT,
        reason TEXT,
        status TEXT DEFAULT 'pending',
        appliedDate DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Payments table
    db.run(`CREATE TABLE IF NOT EXISTS payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        transactionId TEXT UNIQUE NOT NULL,
        studentId INTEGER NOT NULL,
        studentName TEXT NOT NULL,
        paymentType TEXT NOT NULL,
        amount INTEGER NOT NULL,
        status TEXT DEFAULT 'completed',
        date DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (studentId) REFERENCES students(id)
    )`);

    // Exam results table
    db.run(`CREATE TABLE IF NOT EXISTS exam_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        studentId INTEGER NOT NULL,
        score INTEGER NOT NULL,
        percentage INTEGER NOT NULL,
        violations INTEGER DEFAULT 0,
        passed INTEGER DEFAULT 0,
        date DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (studentId) REFERENCES students(id)
    )`);

    // Feedback table
    db.run(`CREATE TABLE IF NOT EXISTS feedbacks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        rating INTEGER NOT NULL,
        comment TEXT,
        date DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Insert demo data if tables are empty
    db.get(`SELECT COUNT(*) as count FROM students`, (err, row) => {
        if (err) return;
        if (row.count === 0) {
            // Insert demo student
            bcrypt.hash('student123', 10, (err, hash) => {
                if (!err) {
                    db.run(`INSERT INTO students (fullName, ethiopianId, email, password, grade, fromGrade, toGrade, examPercent, photoUrl) 
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        ['Demo Student', 'ET999999', 'demo@hermana.edu', hash, 'Grade 10', 'Grade 5', 'Grade 12', 0, 'https://randomuser.me/api/portraits/men/1.jpg']
                    );
                }
            });
        }
    });

    db.get(`SELECT COUNT(*) as count FROM teachers`, (err, row) => {
        if (err) return;
        if (row.count === 0) {
            bcrypt.hash('teacher123', 10, (err, hash) => {
                if (!err) {
                    db.run(`INSERT INTO teachers (fullName, email, password, phone, teachingGrades, reason, status) 
                            VALUES (?, ?, ?, ?, ?, ?, ?)`,
                        ['Demo Teacher', 'teacher@hermana.edu', hash, '+251-911-000000', 'Grade 1,Grade 2', 'Passionate about teaching', 'approved']
                    );
                }
            });
        }
    });
}

// ==================== HELPER FUNCTIONS ====================
function generateToken(userId, role, email) {
    return jwt.sign({ id: userId, role: role, email: email }, JWT_SECRET, { expiresIn: '7d' });
}

function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (err) {
        return null;
    }
}

// Middleware to authenticate token
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }
    
    const decoded = verifyToken(token);
    if (!decoded) {
        return res.status(403).json({ error: 'Invalid or expired token' });
    }
    
    req.user = decoded;
    next();
}

// ==================== API ROUTES ====================

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// ==================== STUDENT ROUTES ====================

// Student Registration
app.post('/api/auth/student/register', upload.single('photo'), async (req, res) => {
    try {
        const { fullName, ethiopianId, email, password, fromGrade, toGrade } = req.body;
        
        // Check if student exists
        db.get(`SELECT id FROM students WHERE ethiopianId = ? OR email = ?`, [ethiopianId, email], async (err, existing) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            if (existing) {
                return res.status(400).json({ error: 'Student already exists with this Ethiopian ID or email' });
            }
            
            const hashedPassword = await bcrypt.hash(password || 'default123', 10);
            const photoUrl = req.file ? `/uploads/${req.file.filename}` : null;
            
            db.run(`INSERT INTO students (fullName, ethiopianId, email, password, grade, fromGrade, toGrade, photoUrl)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [fullName, ethiopianId, email || `${ethiopianId}@hermana.edu`, hashedPassword, fromGrade, fromGrade, toGrade, photoUrl],
                function(err) {
                    if (err) {
                        return res.status(500).json({ error: err.message });
                    }
                    const token = generateToken(this.lastID, 'student', email);
                    res.status(201).json({ 
                        success: true, 
                        token, 
                        student: { id: this.lastID, fullName, ethiopianId, email: email || `${ethiopianId}@hermana.edu` }
                    });
                }
            );
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Student Login
app.post('/api/auth/student/login', async (req, res) => {
    try {
        const { identifier, password } = req.body;
        
        db.get(`SELECT * FROM students WHERE ethiopianId = ? OR email = ?`, [identifier, identifier], async (err, student) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            if (!student) {
                return res.status(401).json({ error: 'Student not found' });
            }
            
            const validPassword = await bcrypt.compare(password, student.password);
            if (!validPassword) {
                return res.status(401).json({ error: 'Invalid password' });
            }
            
            const token = generateToken(student.id, 'student', student.email);
            res.json({ 
                success: true, 
                token, 
                student: { 
                    id: student.id, 
                    fullName: student.fullName, 
                    ethiopianId: student.ethiopianId, 
                    grade: student.grade,
                    examPercent: student.examPercent,
                    payments: {
                        registration: student.registration_paid === 1,
                        term1Bus: student.term1_paid === 1,
                        term2Bus: student.term2_paid === 1,
                        term3Bus: student.term3_paid === 1
                    }
                }
            });
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get Student Dashboard Data
app.get('/api/student/:id', authenticateToken, (req, res) => {
    if (req.user.role !== 'student' && req.user.id != req.params.id) {
        return res.status(403).json({ error: 'Unauthorized' });
    }
    
    db.get(`SELECT * FROM students WHERE id = ?`, [req.params.id], (err, student) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (!student) {
            return res.status(404).json({ error: 'Student not found' });
        }
        
        res.json({
            id: student.id,
            fullName: student.fullName,
            ethiopianId: student.ethiopianId,
            email: student.email,
            grade: student.grade,
            fromGrade: student.fromGrade,
            toGrade: student.toGrade,
            examPercent: student.examPercent,
            examViolations: student.examViolations,
            photoUrl: student.photoUrl,
            payments: {
                registration: student.registration_paid === 1,
                term1Bus: student.term1_paid === 1,
                term2Bus: student.term2_paid === 1,
                term3Bus: student.term3_paid === 1
            }
        });
    });
});

// Submit Exam Result
app.post('/api/student/:id/exam', authenticateToken, (req, res) => {
    if (req.user.role !== 'student' && req.user.id != req.params.id) {
        return res.status(403).json({ error: 'Unauthorized' });
    }
    
    const { score, percentage, violations, passed } = req.body;
    
    db.run(`INSERT INTO exam_results (studentId, score, percentage, violations, passed) VALUES (?, ?, ?, ?, ?)`,
        [req.params.id, score, percentage, violations, passed ? 1 : 0],
        (err) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            
            db.run(`UPDATE students SET examPercent = ?, examViolations = ? WHERE id = ?`,
                [percentage, violations, req.params.id],
                (err) => {
                    if (err) {
                        return res.status(500).json({ error: err.message });
                    }
                    res.json({ success: true, percentage, passed });
                }
            );
        }
    );
});

// Make Payment
app.post('/api/student/:id/payment', authenticateToken, (req, res) => {
    if (req.user.role !== 'student' && req.user.id != req.params.id) {
        return res.status(403).json({ error: 'Unauthorized' });
    }
    
    const { paymentType, amount } = req.body;
    let columnName = '';
    
    if (paymentType === 'registration') columnName = 'registration_paid';
    else if (paymentType === 'term1Bus') columnName = 'term1_paid';
    else if (paymentType === 'term2Bus') columnName = 'term2_paid';
    else if (paymentType === 'term3Bus') columnName = 'term3_paid';
    else return res.status(400).json({ error: 'Invalid payment type' });
    
    const transactionId = 'TXN-' + Date.now();
    
    db.run(`UPDATE students SET ${columnName} = 1 WHERE id = ?`, [req.params.id], (err) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        
        db.get(`SELECT fullName FROM students WHERE id = ?`, [req.params.id], (err, student) => {
            if (err) return;
            
            db.run(`INSERT INTO payments (transactionId, studentId, studentName, paymentType, amount) VALUES (?, ?, ?, ?, ?)`,
                [transactionId, req.params.id, student.fullName, paymentType, amount],
                (err) => {
                    if (err) {
                        return res.status(500).json({ error: err.message });
                    }
                    res.json({ success: true, transactionId });
                }
            );
        });
    });
});

// Get Payment History
app.get('/api/student/:id/payments', authenticateToken, (req, res) => {
    db.all(`SELECT * FROM payments WHERE studentId = ? ORDER BY date DESC`, [req.params.id], (err, payments) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(payments);
    });
});

// ==================== TEACHER ROUTES ====================

// Teacher Registration
app.post('/api/auth/teacher/register', upload.single('document'), async (req, res) => {
    try {
        const { fullName, email, password, phone, teachingGrades, reason } = req.body;
        
        db.get(`SELECT id FROM teachers WHERE email = ?`, [email], async (err, existing) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            if (existing) {
                return res.status(400).json({ error: 'Teacher already registered with this email' });
            }
            
            const hashedPassword = await bcrypt.hash(password, 10);
            const docUrl = req.file ? `/uploads/${req.file.filename}` : null;
            
            db.run(`INSERT INTO teachers (fullName, email, password, phone, educationDoc, teachingGrades, reason, status)
                    VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
                [fullName, email, hashedPassword, phone, docUrl, teachingGrades, reason],
                function(err) {
                    if (err) {
                        return res.status(500).json({ error: err.message });
                    }
                    res.status(201).json({ success: true, message: 'Application submitted successfully', teacherId: this.lastID });
                }
            );
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Teacher Login
app.post('/api/auth/teacher/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        db.get(`SELECT * FROM teachers WHERE email = ?`, [email], async (err, teacher) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            if (!teacher) {
                return res.status(401).json({ error: 'Teacher not found' });
            }
            
            const validPassword = await bcrypt.compare(password, teacher.password);
            if (!validPassword) {
                return res.status(401).json({ error: 'Invalid password' });
            }
            
            if (teacher.status !== 'approved') {
                return res.status(403).json({ error: `Application status: ${teacher.status}. Please wait for approval.` });
            }
            
            const token = generateToken(teacher.id, 'teacher', teacher.email);
            res.json({ success: true, token, teacher: { id: teacher.id, fullName: teacher.fullName, email: teacher.email, status: teacher.status } });
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get all teachers (Board only)
app.get('/api/teachers', authenticateToken, (req, res) => {
    if (req.user.role !== 'board') {
        return res.status(403).json({ error: 'Unauthorized' });
    }
    
    db.all(`SELECT id, fullName, email, phone, teachingGrades, reason, status, appliedDate FROM teachers ORDER BY appliedDate DESC`, (err, teachers) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(teachers);
    });
});

// Review teacher application (Board only)
app.put('/api/teacher/:id/review', authenticateToken, (req, res) => {
    if (req.user.role !== 'board') {
        return res.status(403).json({ error: 'Only board members can review applications' });
    }
    
    const { status } = req.body;
    
    db.run(`UPDATE teachers SET status = ? WHERE id = ?`, [status, req.params.id], (err) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ success: true, status });
    });
});

// ==================== BOARD/DIRECTOR ROUTES ====================

// Get all students (Board/Director only)
app.get('/api/students', authenticateToken, (req, res) => {
    if (req.user.role !== 'board' && req.user.role !== 'director') {
        return res.status(403).json({ error: 'Unauthorized' });
    }
    
    db.all(`SELECT id, fullName, ethiopianId, email, grade, examPercent, examViolations, registration_paid, term1_paid, term2_paid, term3_paid, createdAt FROM students`, (err, students) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(students);
    });
});

// Get statistics (Board/Director only)
app.get('/api/statistics', authenticateToken, (req, res) => {
    if (req.user.role !== 'board' && req.user.role !== 'director') {
        return res.status(403).json({ error: 'Unauthorized' });
    }
    
    db.get(`SELECT COUNT(*) as totalStudents FROM students`, (err, studentCount) => {
        db.get(`SELECT COUNT(*) as totalTeachers FROM teachers`, (err, teacherCount) => {
            db.get(`SELECT COUNT(*) as approvedTeachers FROM teachers WHERE status = 'approved'`, (err, approvedCount) => {
                db.get(`SELECT COUNT(*) as pendingTeachers FROM teachers WHERE status = 'pending'`, (err, pendingCount) => {
                    db.get(`SELECT SUM(amount) as totalRevenue FROM payments`, (err, revenue) => {
                        res.json({
                            totalStudents: studentCount.totalStudents,
                            totalTeachers: teacherCount.totalTeachers,
                            approvedTeachers: approvedCount.approvedTeachers,
                            pendingTeachers: pendingCount.pendingTeachers,
                            totalRevenue: revenue.totalRevenue || 0
                        });
                    });
                });
            });
        });
    });
});

// ==================== PARENT ROUTES ====================

// Parent view student data
app.post('/api/auth/parent/login', async (req, res) => {
    try {
        const { identifier, password } = req.body;
        
        db.get(`SELECT * FROM students WHERE ethiopianId = ? OR email = ?`, [identifier, identifier], async (err, student) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            if (!student) {
                return res.status(401).json({ error: 'Student not found' });
            }
            
            const validPassword = await bcrypt.compare(password, student.password);
            if (!validPassword) {
                return res.status(401).json({ error: 'Invalid password' });
            }
            
            const token = generateToken(student.id, 'parent', student.email);
            res.json({ 
                success: true, 
                token, 
                student: { 
                    id: student.id, 
                    fullName: student.fullName, 
                    ethiopianId: student.ethiopianId, 
                    grade: student.grade,
                    examPercent: student.examPercent,
                    fromGrade: student.fromGrade,
                    toGrade: student.toGrade,
                    payments: {
                        registration: student.registration_paid === 1,
                        term1Bus: student.term1_paid === 1,
                        term2Bus: student.term2_paid === 1,
                        term3Bus: student.term3_paid === 1
                    }
                }
            });
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== FEEDBACK ROUTES ====================

app.post('/api/feedback', (req, res) => {
    const { rating, comment } = req.body;
    
    db.run(`INSERT INTO feedbacks (rating, comment) VALUES (?, ?)`, [rating, comment], (err) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ success: true, message: 'Thank you for your feedback!' });
    });
});

app.get('/api/feedbacks', authenticateToken, (req, res) => {
    if (req.user.role !== 'board' && req.user.role !== 'director') {
        return res.status(403).json({ error: 'Unauthorized' });
    }
    
    db.all(`SELECT * FROM feedbacks ORDER BY date DESC`, (err, feedbacks) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(feedbacks);
    });
});

// ==================== BOARD LOGIN (Demo) ====================
app.post('/api/auth/board/login', (req, res) => {
    const { email, password } = req.body;
    if (email === 'board@hermana.edu' && password === 'board123') {
        const token = generateToken(1, 'board', email);
        res.json({ success: true, token, role: 'board' });
    } else {
        res.status(401).json({ error: 'Invalid credentials' });
    }
});

// ==================== DIRECTOR LOGIN (Demo) ====================
app.post('/api/auth/director/login', (req, res) => {
    const { email, password } = req.body;
    if (email === 'director@hermana.edu' && password === 'director123') {
        const token = generateToken(1, 'director', email);
        res.json({ success: true, token, role: 'director' });
    } else {
        res.status(401).json({ error: 'Invalid credentials' });
    }
});

// ==================== START SERVER ====================
app.listen(PORT, () => {
    console.log(`
    ╔══════════════════════════════════════════════════════╗
    ║     Hermana Academy Backend Server Running!          ║
    ╠══════════════════════════════════════════════════════╣
    ║  Server: http://localhost:${PORT}                      ║
    ║  API Base: http://localhost:${PORT}/api               ║
    ║                                                        ║
    ║  Demo Credentials:                                    ║
    ║  Student: ET999999 / student123                       ║
    ║  Teacher: teacher@hermana.edu / teacher123            ║
    ║  Director: director@hermana.edu / director123         ║
    ║  Board: board@hermana.edu / board123                  ║
    ╚══════════════════════════════════════════════════════╝
    `);
});
