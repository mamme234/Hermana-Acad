// server.js - Hermana Academy Backend API
// Run with: node server.js

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const { Server } = require('socket.io');
const http = require('http');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static('uploads'));

// File upload configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = './uploads';
        if (!fs.existsSync(dir)) fs.mkdirSync(dir);
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage, limits: { fileSize: 5 * 1024 * 1024 } });

// JWT Secret
const JWT_SECRET = 'hermana_academy_secure_key_2026';
const JWT_REFRESH_SECRET = 'hermana_academy_refresh_key_2026';

// Email configuration (using ethereal.email for testing, replace with real SMTP)
const transporter = nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false,
    auth: {
        user: 'your_test_user@ethereal.email', // Replace with actual credentials
        pass: 'your_test_password'
    }
});

// In-memory storage (will be replaced with database in production)
let students = [];
let teachers = [];
let payments = [];
let examResults = [];
let feedbacks = [];
let liveMessages = [];
let activeSessions = new Map();

// Helper functions
const hashPassword = async (password) => await bcrypt.hash(password, 10);
const comparePassword = async (password, hash) => await bcrypt.compare(password, hash);
const generateToken = (user) => jwt.sign(user, JWT_SECRET, { expiresIn: '7d' });
const verifyToken = (token) => jwt.verify(token, JWT_SECRET);

// Initialize demo data
function initializeDemoData() {
    // Demo students
    const kgGrades = ["Nursery", "Lower KG", "Upper KG"];
    kgGrades.forEach((kg, idx) => {
        for (let i = 1; i <= (idx === 0 ? 25 : 30); i++) {
            students.push({
                id: 1000 + idx * 100 + i,
                fullName: `${kg} Student ${i}`,
                ethiopianId: `ET${100000 + idx * 100 + i}`,
                email: `student${1000 + idx * 100 + i}@hermana.edu`,
                password: hashPasswordSync('default123'),
                grade: kg,
                fromGrade: kg,
                toGrade: kg === "Nursery" ? "Upper KG" : (kg === "Lower KG" ? "Grade 2" : "Grade 4"),
                examPercent: Math.floor(Math.random() * 100),
                examViolations: 0,
                photoUrl: `https://randomuser.me/api/portraits/${i % 2 === 0 ? 'women' : 'men'}/${i % 70}.jpg`,
                payments: { registration: i <= 20, term1Bus: i <= 15, term2Bus: i <= 10, term3Bus: i <= 8 },
                createdAt: new Date().toISOString()
            });
        }
    });
    
    students.push({
        id: 999999,
        fullName: "Demo Student",
        ethiopianId: "ET999999",
        email: "demo@hermana.edu",
        password: hashPasswordSync('student123'),
        grade: "Grade 10",
        fromGrade: "Grade 5",
        toGrade: "Grade 12",
        examPercent: 0,
        examViolations: 0,
        photoUrl: "https://randomuser.me/api/portraits/men/1.jpg",
        payments: { registration: false, term1Bus: false, term2Bus: false, term3Bus: false },
        createdAt: new Date().toISOString()
    });
    
    // Demo teacher
    teachers.push({
        id: 1,
        fullName: "Demo Teacher",
        email: "teacher@hermana.edu",
        password: hashPasswordSync('teacher123'),
        phone: "+251-911-000000",
        teachingGrades: ["Grade 1", "Grade 2", "Grade 3"],
        status: "approved",
        appliedDate: new Date().toISOString(),
        reason: "Passionate about education",
        createdAt: new Date().toISOString()
    });
}

function hashPasswordSync(password) {
    return bcrypt.hashSync(password, 10);
}

// ==================== API ROUTES ====================

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// ==================== AUTHENTICATION ROUTES ====================

// Student Registration
app.post('/api/auth/student/register', upload.single('photo'), async (req, res) => {
    try {
        const { fullName, ethiopianId, email, password, fromGrade, toGrade } = req.body;
        
        // Check if student already exists
        const existingStudent = students.find(s => s.ethiopianId === ethiopianId || s.email === email);
        if (existingStudent) {
            return res.status(400).json({ error: 'Student already exists with this Ethiopian ID or email' });
        }
        
        const newStudent = {
            id: Date.now(),
            fullName,
            ethiopianId,
            email: email || `${ethiopianId}@hermana.edu`,
            password: await hashPassword(password || 'default123'),
            grade: fromGrade,
            fromGrade,
            toGrade,
            examPercent: 0,
            examViolations: 0,
            photoUrl: req.file ? `/uploads/${req.file.filename}` : null,
            payments: { registration: false, term1Bus: false, term2Bus: false, term3Bus: false },
            createdAt: new Date().toISOString()
        };
        
        students.push(newStudent);
        
        // Send welcome email
        await transporter.sendMail({
            from: '"Hermana Academy" <noreply@hermana.edu>',
            to: newStudent.email,
            subject: 'Welcome to Hermana Academy!',
            html: `<h2>Welcome ${fullName}!</h2><p>Your registration is successful. Your Ethiopian ID is: ${ethiopianId}</p><p>Please login to complete your profile and take the entrance exam.</p>`
        }).catch(err => console.log('Email error:', err));
        
        const token = generateToken({ id: newStudent.id, role: 'student', email: newStudent.email });
        res.status(201).json({ success: true, token, student: { id: newStudent.id, fullName, ethiopianId, email: newStudent.email } });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Student Login
app.post('/api/auth/student/login', async (req, res) => {
    try {
        const { identifier, password } = req.body;
        const student = students.find(s => s.ethiopianId === identifier || s.email === identifier);
        
        if (!student || !await comparePassword(password, student.password)) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        const token = generateToken({ id: student.id, role: 'student', email: student.email });
        res.json({ success: true, token, student: { id: student.id, fullName: student.fullName, ethiopianId: student.ethiopianId, grade: student.grade } });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Teacher Registration
app.post('/api/auth/teacher/register', upload.single('document'), async (req, res) => {
    try {
        const { fullName, email, password, phone, teachingGrades, reason } = req.body;
        
        const existingTeacher = teachers.find(t => t.email === email);
        if (existingTeacher) {
            return res.status(400).json({ error: 'Teacher already registered with this email' });
        }
        
        const newTeacher = {
            id: Date.now(),
            fullName,
            email,
            password: await hashPassword(password),
            phone,
            teachingGrades: JSON.parse(teachingGrades),
            educationDoc: req.file ? `/uploads/${req.file.filename}` : null,
            reason,
            status: 'pending',
            appliedDate: new Date().toISOString(),
            createdAt: new Date().toISOString()
        };
        
        teachers.push(newTeacher);
        
        // Send application confirmation
        await transporter.sendMail({
            from: '"Hermana Academy" <noreply@hermana.edu>',
            to: email,
            subject: 'Teacher Application Received',
            html: `<h2>Thank you ${fullName}</h2><p>Your application has been submitted. The board will review it within 3-5 business days.</p><p>You will receive an email once a decision is made.</p>`
        }).catch(err => console.log('Email error:', err));
        
        res.status(201).json({ success: true, message: 'Application submitted successfully', teacherId: newTeacher.id });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Teacher Login
app.post('/api/auth/teacher/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const teacher = teachers.find(t => t.email === email);
        
        if (!teacher || !await comparePassword(password, teacher.password)) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        if (teacher.status !== 'approved') {
            return res.status(403).json({ error: `Application status: ${teacher.status}. Please wait for approval.` });
        }
        
        const token = generateToken({ id: teacher.id, role: 'teacher', email: teacher.email });
        res.json({ success: true, token, teacher: { id: teacher.id, fullName: teacher.fullName, email: teacher.email, status: teacher.status } });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Board Login
app.post('/api/auth/board/login', async (req, res) => {
    const { email, password } = req.body;
    if (email === 'board@hermana.edu' && password === 'board123') {
        const token = generateToken({ role: 'board', email });
        res.json({ success: true, token, role: 'board' });
    } else {
        res.status(401).json({ error: 'Invalid credentials' });
    }
});

// Director Login
app.post('/api/auth/director/login', async (req, res) => {
    const { email, password } = req.body;
    if (email === 'director@hermana.edu' && password === 'director123') {
        const token = generateToken({ role: 'director', email });
        res.json({ success: true, token, role: 'director' });
    } else {
        res.status(401).json({ error: 'Invalid credentials' });
    }
});

// Parent Login (view student data)
app.post('/api/auth/parent/login', async (req, res) => {
    try {
        const { identifier, password } = req.body;
        const student = students.find(s => s.ethiopianId === identifier || s.email === identifier);
        
        if (!student || !await comparePassword(password, student.password)) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        const token = generateToken({ id: student.id, role: 'parent', studentId: student.id });
        res.json({ success: true, token, student: { id: student.id, fullName: student.fullName, ethiopianId: student.ethiopianId, grade: student.grade } });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== STUDENT ROUTES ====================

// Get student dashboard data
app.get('/api/student/:id', authenticateToken, (req, res) => {
    const student = students.find(s => s.id === parseInt(req.params.id));
    if (!student) return res.status(404).json({ error: 'Student not found' });
    res.json(student);
});

// Submit exam
app.post('/api/student/:id/exam', authenticateToken, async (req, res) => {
    try {
        const { answers, questions, violations } = req.body;
        const student = students.find(s => s.id === parseInt(req.params.id));
        
        if (!student) return res.status(404).json({ error: 'Student not found' });
        
        let correct = 0;
        answers.forEach((ans, i) => { if (ans === questions[i].correct) correct++; });
        const percentage = Math.round((correct / questions.length) * 100);
        
        const examResult = {
            id: Date.now(),
            studentId: student.id,
            score: correct,
            percentage,
            violations,
            passed: percentage >= 50,
            date: new Date().toISOString()
        };
        
        examResults.push(examResult);
        student.examPercent = percentage;
        student.examViolations = violations;
        
        res.json({ success: true, percentage, passed: percentage >= 50, violations });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Make payment
app.post('/api/student/:id/payment', authenticateToken, async (req, res) => {
    try {
        const { paymentType, amount } = req.body;
        const student = students.find(s => s.id === parseInt(req.params.id));
        
        if (!student) return res.status(404).json({ error: 'Student not found' });
        
        student.payments[paymentType] = true;
        
        const payment = {
            id: Date.now(),
            transactionId: `TXN-${Date.now()}`,
            studentId: student.id,
            studentName: student.fullName,
            paymentType,
            amount,
            status: 'completed',
            date: new Date().toISOString()
        };
        
        payments.push(payment);
        
        res.json({ success: true, payment });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== TEACHER ROUTES ====================

// Get all teachers (for board)
app.get('/api/teachers', authenticateToken, (req, res) => {
    if (req.user.role !== 'board' && req.user.role !== 'director') {
        return res.status(403).json({ error: 'Unauthorized' });
    }
    res.json(teachers);
});

// Review teacher application (board only)
app.put('/api/teacher/:id/review', authenticateToken, async (req, res) => {
    if (req.user.role !== 'board') {
        return res.status(403).json({ error: 'Only board members can review applications' });
    }
    
    const { status } = req.body;
    const teacher = teachers.find(t => t.id === parseInt(req.params.id));
    
    if (!teacher) return res.status(404).json({ error: 'Teacher not found' });
    
    teacher.status = status;
    
    // Send email notification
    await transporter.sendMail({
        from: '"Hermana Academy Board" <board@hermana.edu>',
        to: teacher.email,
        subject: `Teacher Application ${status.toUpperCase()}`,
        html: `<h2>Dear ${teacher.fullName},</h2><p>Your application has been ${status}.</p>${status === 'approved' ? '<p>Welcome to Hermana Academy! Please login to access your dashboard.</p>' : '<p>Thank you for your interest. We encourage you to reapply in the future.</p>'}`
    }).catch(err => console.log('Email error:', err));
    
    res.json({ success: true, status });
});

// ==================== BOARD ROUTES ====================

// Get statistics
app.get('/api/statistics', authenticateToken, (req, res) => {
    if (req.user.role !== 'board' && req.user.role !== 'director') {
        return res.status(403).json({ error: 'Unauthorized' });
    }
    
    const stats = {
        totalStudents: students.length,
        totalTeachers: teachers.length,
        approvedTeachers: teachers.filter(t => t.status === 'approved').length,
        pendingTeachers: teachers.filter(t => t.status === 'pending').length,
        totalRegistrationFees: students.filter(s => s.payments.registration).length * 1000,
        totalTermFees: students.filter(s => s.payments.term1Bus).length * 3500,
        examPassRate: examResults.length > 0 ? (examResults.filter(e => e.passed).length / examResults.length * 100).toFixed(2) : 0,
        totalPayments: payments.length
    };
    
    res.json(stats);
});

// Get all students
app.get('/api/students', authenticateToken, (req, res) => {
    if (req.user.role !== 'board' && req.user.role !== 'director') {
        return res.status(403).json({ error: 'Unauthorized' });
    }
    res.json(students);
});

// Get students by grade
app.get('/api/students/grade/:grade', authenticateToken, (req, res) => {
    const gradeStudents = students.filter(s => s.grade === req.params.grade);
    res.json(gradeStudents);
});

// ==================== FEEDBACK ROUTES ====================

// Submit feedback
app.post('/api/feedback', authenticateToken, async (req, res) => {
    try {
        const { rating, text } = req.body;
        const feedback = {
            id: Date.now(),
            userId: req.user.id,
            userRole: req.user.role,
            rating: parseInt(rating),
            text,
            date: new Date().toISOString()
        };
        
        feedbacks.push(feedback);
        res.json({ success: true, feedback });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get all feedbacks (board/director only)
app.get('/api/feedbacks', authenticateToken, (req, res) => {
    if (req.user.role !== 'board' && req.user.role !== 'director') {
        return res.status(403).json({ error: 'Unauthorized' });
    }
    res.json(feedbacks);
});

// ==================== ID CARD GENERATION ====================

app.get('/api/student/:id/idcard', authenticateToken, (req, res) => {
    const student = students.find(s => s.id === parseInt(req.params.id));
    if (!student) return res.status(404).json({ error: 'Student not found' });
    
    const idCard = {
        studentId: `HA${student.id}${new Date().getFullYear()}`,
        fullName: student.fullName,
        ethiopianId: student.ethiopianId,
        grade: student.grade,
        fromGrade: student.fromGrade,
        toGrade: student.toGrade,
        issuedDate: new Date().toISOString(),
        validUntil: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString(),
        photoUrl: student.photoUrl
    };
    
    res.json(idCard);
});

// ==================== REAL-TIME CHAT (Socket.IO) ====================

io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (token) {
        try {
            const decoded = verifyToken(token);
            socket.user = decoded;
            next();
        } catch (err) {
            next(new Error('Authentication error'));
        }
    } else {
        next(new Error('Authentication required'));
    }
});

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.user?.email || 'unknown'}`);
    
    socket.on('join', (room) => {
        socket.join(room);
        console.log(`${socket.user?.email} joined ${room}`);
    });
    
    socket.on('send_message', (data) => {
        const message = {
            id: Date.now(),
            userId: socket.user?.id,
            userName: socket.user?.email,
            message: data.message,
            room: data.room,
            timestamp: new Date().toISOString()
        };
        
        liveMessages.push(message);
        io.to(data.room).emit('receive_message', message);
    });
    
    socket.on('typing', (data) => {
        socket.to(data.room).emit('user_typing', { user: socket.user?.email });
    });
    
    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.user?.email}`);
    });
});

// ==================== MIDDLEWARE ====================

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }
    
    try {
        const decoded = verifyToken(token);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(403).json({ error: 'Invalid or expired token' });
    }
}

// ==================== SERVER STARTUP ====================

initializeDemoData();

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`
    ╔════════════════════════════════════════╗
    ║     Hermana Academy Server Started     ║
    ╠════════════════════════════════════════╣
    ║  Server: http://localhost:${PORT}        ║
    ║  WebSocket: ws://localhost:${PORT}       ║
    ║  API Ready! 🚀                         ║
    ╚════════════════════════════════════════╝
    `);
    
    console.log('\n📋 Demo Credentials:');
    console.log('   Student: ET999999 / student123');
    console.log('   Teacher: teacher@hermana.edu / teacher123');
    console.log('   Director: director@hermana.edu / director123');
    console.log('   Board: board@hermana.edu / board123\n');
});

// Error handling
process.on('unhandledRejection', (error) => {
    console.error('Unhandled Rejection:', error);
});

// Export for testing
module.exports = { app, server, io };
