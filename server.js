// server.js - Hermana Academy Backend with MongoDB
// Run: npm install && node server.js

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static('uploads'));

// Create uploads directory
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
const JWT_SECRET = process.env.JWT_SECRET || 'hermana_academy_secret_2026';

// ==================== MONGODB SCHEMAS ====================

// Student Schema
const studentSchema = new mongoose.Schema({
    fullName: { type: String, required: true },
    ethiopianId: { type: String, unique: true, required: true },
    email: { type: String, unique: true, sparse: true },
    password: { type: String, required: true },
    grade: { type: String, required: true },
    fromGrade: { type: String, required: true },
    toGrade: { type: String, required: true },
    examPercent: { type: Number, default: 0 },
    examViolations: { type: Number, default: 0 },
    examPhoto: { type: String },
    photoUrl: { type: String },
    registration_paid: { type: Boolean, default: false },
    term1_paid: { type: Boolean, default: false },
    term2_paid: { type: Boolean, default: false },
    term3_paid: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
});

// Teacher Schema
const teacherSchema = new mongoose.Schema({
    fullName: { type: String, required: true },
    email: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    phone: { type: String, required: true },
    educationDoc: { type: String },
    teachingGrades: { type: String },
    reason: { type: String },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    appliedDate: { type: Date, default: Date.now }
});

// Payment Schema
const paymentSchema = new mongoose.Schema({
    transactionId: { type: String, unique: true, required: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    studentName: { type: String, required: true },
    paymentType: { type: String, enum: ['registration', 'term1Bus', 'term2Bus', 'term3Bus'], required: true },
    amount: { type: Number, required: true },
    status: { type: String, default: 'completed' },
    date: { type: Date, default: Date.now }
});

// Exam Result Schema
const examResultSchema = new mongoose.Schema({
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    score: { type: Number, required: true },
    percentage: { type: Number, required: true },
    violations: { type: Number, default: 0 },
    passed: { type: Boolean, default: false },
    date: { type: Date, default: Date.now }
});

// Feedback Schema
const feedbackSchema = new mongoose.Schema({
    rating: { type: Number, required: true },
    comment: { type: String, required: true },
    date: { type: Date, default: Date.now }
});

// Create Models
const Student = mongoose.model('Student', studentSchema);
const Teacher = mongoose.model('Teacher', teacherSchema);
const Payment = mongoose.model('Payment', paymentSchema);
const ExamResult = mongoose.model('ExamResult', examResultSchema);
const Feedback = mongoose.model('Feedback', feedbackSchema);

// ==================== CONNECT TO MONGODB ====================
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/hermana_academy', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('✅ MongoDB Connected Successfully!');
    initializeDemoData();
}).catch(err => {
    console.error('❌ MongoDB Connection Error:', err);
});

// ==================== DEMO DATA INITIALIZATION ====================
async function initializeDemoData() {
    // Check if demo student exists
    const demoStudent = await Student.findOne({ ethiopianId: 'ET999999' });
    if (!demoStudent) {
        const hashedPassword = await bcrypt.hash('student123', 10);
        await Student.create({
            fullName: 'Demo Student',
            ethiopianId: 'ET999999',
            email: 'demo@hermana.edu',
            password: hashedPassword,
            grade: 'Grade 10',
            fromGrade: 'Grade 5',
            toGrade: 'Grade 12',
            examPercent: 0,
            photoUrl: 'https://randomuser.me/api/portraits/men/1.jpg'
        });
        console.log('✅ Demo student created');
    }

    // Check if demo teacher exists
    const demoTeacher = await Teacher.findOne({ email: 'teacher@hermana.edu' });
    if (!demoTeacher) {
        const hashedPassword = await bcrypt.hash('teacher123', 10);
        await Teacher.create({
            fullName: 'Demo Teacher',
            email: 'teacher@hermana.edu',
            password: hashedPassword,
            phone: '+251-911-000000',
            teachingGrades: 'Grade 1,Grade 2,Grade 3',
            reason: 'Passionate about teaching Ethiopian students',
            status: 'approved'
        });
        console.log('✅ Demo teacher created');
    }
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
    res.json({ status: 'OK', timestamp: new Date().toISOString(), database: 'MongoDB' });
});

// ==================== STUDENT ROUTES ====================

// Student Registration
app.post('/api/auth/student/register', upload.single('photo'), async (req, res) => {
    try {
        const { fullName, ethiopianId, email, password, fromGrade, toGrade } = req.body;
        
        // Check if student exists
        const existingStudent = await Student.findOne({ $or: [{ ethiopianId }, { email }] });
        if (existingStudent) {
            return res.status(400).json({ error: 'Student already exists with this Ethiopian ID or email' });
        }
        
        const hashedPassword = await bcrypt.hash(password || 'default123', 10);
        const photoUrl = req.file ? `/uploads/${req.file.filename}` : null;
        
        const student = await Student.create({
            fullName,
            ethiopianId,
            email: email || `${ethiopianId}@hermana.edu`,
            password: hashedPassword,
            grade: fromGrade,
            fromGrade,
            toGrade,
            photoUrl
        });
        
        const token = generateToken(student._id, 'student', student.email);
        res.status(201).json({ 
            success: true, 
            token, 
            student: { id: student._id, fullName, ethiopianId, email: student.email }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Student Login
app.post('/api/auth/student/login', async (req, res) => {
    try {
        const { identifier, password } = req.body;
        
        const student = await Student.findOne({ $or: [{ ethiopianId: identifier }, { email: identifier }] });
        if (!student) {
            return res.status(401).json({ error: 'Student not found' });
        }
        
        const validPassword = await bcrypt.compare(password, student.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid password' });
        }
        
        const token = generateToken(student._id, 'student', student.email);
        res.json({ 
            success: true, 
            token, 
            student: { 
                id: student._id, 
                fullName: student.fullName, 
                ethiopianId: student.ethiopianId, 
                grade: student.grade,
                examPercent: student.examPercent,
                payments: {
                    registration: student.registration_paid,
                    term1Bus: student.term1_paid,
                    term2Bus: student.term2_paid,
                    term3Bus: student.term3_paid
                }
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get Student Data
app.get('/api/student/:id', authenticateToken, async (req, res) => {
    try {
        const student = await Student.findById(req.params.id);
        if (!student) {
            return res.status(404).json({ error: 'Student not found' });
        }
        
        res.json({
            id: student._id,
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
                registration: student.registration_paid,
                term1Bus: student.term1_paid,
                term2Bus: student.term2_paid,
                term3Bus: student.term3_paid
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Submit Exam Result
app.post('/api/student/:id/exam', authenticateToken, async (req, res) => {
    try {
        const { score, percentage, violations, passed } = req.body;
        
        await ExamResult.create({
            studentId: req.params.id,
            score,
            percentage,
            violations,
            passed
        });
        
        await Student.findByIdAndUpdate(req.params.id, {
            examPercent: percentage,
            examViolations: violations
        });
        
        res.json({ success: true, percentage, passed });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Make Payment
app.post('/api/student/:id/payment', authenticateToken, async (req, res) => {
    try {
        const { paymentType, amount } = req.body;
        let updateField = {};
        
        if (paymentType === 'registration') updateField = { registration_paid: true };
        else if (paymentType === 'term1Bus') updateField = { term1_paid: true };
        else if (paymentType === 'term2Bus') updateField = { term2_paid: true };
        else if (paymentType === 'term3Bus') updateField = { term3_paid: true };
        else return res.status(400).json({ error: 'Invalid payment type' });
        
        const student = await Student.findByIdAndUpdate(req.params.id, updateField, { new: true });
        const transactionId = 'TXN-' + Date.now();
        
        await Payment.create({
            transactionId,
            studentId: req.params.id,
            studentName: student.fullName,
            paymentType,
            amount
        });
        
        res.json({ success: true, transactionId });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get Payment History
app.get('/api/student/:id/payments', authenticateToken, async (req, res) => {
    try {
        const payments = await Payment.find({ studentId: req.params.id }).sort({ date: -1 });
        res.json(payments);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== TEACHER ROUTES ====================

// Teacher Registration
app.post('/api/auth/teacher/register', upload.single('document'), async (req, res) => {
    try {
        const { fullName, email, password, phone, teachingGrades, reason } = req.body;
        
        const existingTeacher = await Teacher.findOne({ email });
        if (existingTeacher) {
            return res.status(400).json({ error: 'Teacher already registered with this email' });
        }
        
        const hashedPassword = await bcrypt.hash(password, 10);
        const docUrl = req.file ? `/uploads/${req.file.filename}` : null;
        
        const teacher = await Teacher.create({
            fullName,
            email,
            password: hashedPassword,
            phone,
            educationDoc: docUrl,
            teachingGrades,
            reason,
            status: 'pending'
        });
        
        res.status(201).json({ success: true, message: 'Application submitted successfully', teacherId: teacher._id });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Teacher Login
app.post('/api/auth/teacher/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        const teacher = await Teacher.findOne({ email });
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
        
        const token = generateToken(teacher._id, 'teacher', teacher.email);
        res.json({ success: true, token, teacher: { id: teacher._id, fullName: teacher.fullName, email: teacher.email, status: teacher.status } });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get all teachers (Board only)
app.get('/api/teachers', authenticateToken, async (req, res) => {
    if (req.user.role !== 'board') {
        return res.status(403).json({ error: 'Unauthorized' });
    }
    
    const teachers = await Teacher.find({}).sort({ appliedDate: -1 });
    res.json(teachers);
});

// Review teacher application (Board only)
app.put('/api/teacher/:id/review', authenticateToken, async (req, res) => {
    if (req.user.role !== 'board') {
        return res.status(403).json({ error: 'Only board members can review applications' });
    }
    
    const { status } = req.body;
    await Teacher.findByIdAndUpdate(req.params.id, { status });
    res.json({ success: true, status });
});

// ==================== BOARD/DIRECTOR ROUTES ====================

// Get all students
app.get('/api/students', authenticateToken, async (req, res) => {
    if (req.user.role !== 'board' && req.user.role !== 'director') {
        return res.status(403).json({ error: 'Unauthorized' });
    }
    
    const students = await Student.find({}).select('-password');
    res.json(students);
});

// Get statistics
app.get('/api/statistics', authenticateToken, async (req, res) => {
    if (req.user.role !== 'board' && req.user.role !== 'director') {
        return res.status(403).json({ error: 'Unauthorized' });
    }
    
    const totalStudents = await Student.countDocuments();
    const totalTeachers = await Teacher.countDocuments();
    const approvedTeachers = await Teacher.countDocuments({ status: 'approved' });
    const pendingTeachers = await Teacher.countDocuments({ status: 'pending' });
    const payments = await Payment.aggregate([{ $group: { _id: null, total: { $sum: '$amount' } } }]);
    const totalRevenue = payments[0]?.total || 0;
    
    res.json({
        totalStudents,
        totalTeachers,
        approvedTeachers,
        pendingTeachers,
        totalRevenue
    });
});

// ==================== PARENT ROUTES ====================

app.post('/api/auth/parent/login', async (req, res) => {
    try {
        const { identifier, password } = req.body;
        
        const student = await Student.findOne({ $or: [{ ethiopianId: identifier }, { email: identifier }] });
        if (!student) {
            return res.status(401).json({ error: 'Student not found' });
        }
        
        const validPassword = await bcrypt.compare(password, student.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid password' });
        }
        
        const token = generateToken(student._id, 'parent', student.email);
        res.json({ 
            success: true, 
            token, 
            student: { 
                id: student._id, 
                fullName: student.fullName, 
                ethiopianId: student.ethiopianId, 
                grade: student.grade,
                examPercent: student.examPercent,
                fromGrade: student.fromGrade,
                toGrade: student.toGrade,
                payments: {
                    registration: student.registration_paid,
                    term1Bus: student.term1_paid,
                    term2Bus: student.term2_paid,
                    term3Bus: student.term3_paid
                }
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== FEEDBACK ROUTES ====================

app.post('/api/feedback', async (req, res) => {
    try {
        const { rating, comment } = req.body;
        await Feedback.create({ rating, comment });
        res.json({ success: true, message: 'Thank you for your feedback!' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/feedbacks', authenticateToken, async (req, res) => {
    if (req.user.role !== 'board' && req.user.role !== 'director') {
        return res.status(403).json({ error: 'Unauthorized' });
    }
    
    const feedbacks = await Feedback.find({}).sort({ date: -1 });
    res.json(feedbacks);
});

// ==================== DEMO LOGINS ====================

app.post('/api/auth/board/login', (req, res) => {
    const { email, password } = req.body;
    if (email === 'board@hermana.edu' && password === 'board123') {
        const token = generateToken('board', 'board', email);
        res.json({ success: true, token, role: 'board' });
    } else {
        res.status(401).json({ error: 'Invalid credentials' });
    }
});

app.post('/api/auth/director/login', (req, res) => {
    const { email, password } = req.body;
    if (email === 'director@hermana.edu' && password === 'director123') {
        const token = generateToken('director', 'director', email);
        res.json({ success: true, token, role: 'director' });
    } else {
        res.status(401).json({ error: 'Invalid credentials' });
    }
});

// ==================== START SERVER ====================
app.listen(PORT, () => {
    console.log(`
    ╔══════════════════════════════════════════════════════════╗
    ║     Hermana Academy Backend Server Running!              ║
    ╠══════════════════════════════════════════════════════════╣
    ║  Server: http://localhost:${PORT}                          ║
    ║  API Base: http://localhost:${PORT}/api                   ║
    ║  Database: MongoDB                                        ║
    ║                                                            ║
    ║  Demo Credentials:                                        ║
    ║  Student: ET999999 / student123                           ║
    ║  Teacher: teacher@hermana.edu / teacher123                ║
    ║  Director: director@hermana.edu / director123             ║
    ║  Board: board@hermana.edu / board123                      ║
    ╚══════════════════════════════════════════════════════════╝
    `);
});
