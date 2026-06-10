// server.js - Hermana Academy with Telegram Bot
// Run: npm install express cors mongoose multer dotenv node-fetch
// Then: node server.js

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

// ==================== MIDDLEWARE ====================
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static('uploads'));

// Create uploads directory
if (!fs.existsSync('./uploads')) {
    fs.mkdirSync('./uploads');
}

// ==================== FILE UPLOAD ====================
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, './uploads');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage, limits: { fileSize: 10 * 1024 * 1024 } });

// ==================== TELEGRAM BOT SETUP ====================
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

async function sendTelegramMessage(message) {
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
        console.log('⚠️ Telegram not configured. Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in .env');
        return false;
    }
    
    try {
        const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: TELEGRAM_CHAT_ID,
                text: message,
                parse_mode: 'HTML'
            })
        });
        const data = await response.json();
        if (data.ok) {
            console.log('✅ Telegram message sent');
            return true;
        } else {
            console.log('❌ Telegram error:', data.description);
            return false;
        }
    } catch (error) {
        console.error('❌ Telegram error:', error.message);
        return false;
    }
}

// Test Telegram on startup
if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
    sendTelegramMessage('🤖 *Hermana Academy Bot Started!*\n\nServer is online and ready to receive notifications.');
}

// ==================== MONGODB CONNECTION ====================
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('✅ MongoDB Connected');
    initializeDemoData();
}).catch(err => {
    console.error('❌ MongoDB Error:', err.message);
});

// ==================== SCHEMAS ====================
const studentSchema = new mongoose.Schema({
    studentId: { type: String, unique: true, required: true },
    fullName: { type: String, required: true },
    email: { type: String, required: true },
    phone: String,
    grade: String,
    parentName: String,
    parentPhone: String,
    address: String,
    photoUrl: String,
    examScore: Number,
    examViolations: { type: Number, default: 0 },
    registration_paid: { type: Boolean, default: false },
    term1_paid: { type: Boolean, default: false },
    term2_paid: { type: Boolean, default: false },
    term3_paid: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
});

const teacherSchema = new mongoose.Schema({
    teacherId: { type: String, unique: true },
    fullName: String,
    email: String,
    phone: String,
    gradeLevel: String,
    subject: String,
    experience: Number,
    photoUrl: String,
    documentUrl: String,
    examScore: Number,
    approvalCode: String,
    status: { type: String, default: 'pending' },
    joinedDate: Date
});

const directorSchema = new mongoose.Schema({
    type: String,
    name: String,
    password: String,
    photoUrl: String
});

const paymentSchema = new mongoose.Schema({
    studentId: String,
    studentName: String,
    amount: Number,
    type: String,
    transactionId: String,
    date: { type: Date, default: Date.now }
});

const feedbackSchema = new mongoose.Schema({
    name: String,
    rating: Number,
    message: String,
    date: { type: Date, default: Date.now }
});

const Student = mongoose.model('Student', studentSchema);
const Teacher = mongoose.model('Teacher', teacherSchema);
const Director = mongoose.model('Director', directorSchema);
const Payment = mongoose.model('Payment', paymentSchema);
const Feedback = mongoose.model('Feedback', feedbackSchema);

// ==================== INITIALIZE DEMO DATA ====================
async function initializeDemoData() {
    const directors = await Director.find();
    if (directors.length === 0) {
        await Director.create([
            { type: 'kg', name: 'KG Director', password: 'kg123' },
            { type: 'elementary', name: 'Elementary Director', password: 'elem123' },
            { type: 'high', name: 'High School Director', password: 'high123' }
        ]);
        console.log('✅ Demo directors created');
    }
}

// ==================== HELPER FUNCTIONS ====================
function generateStudentId() {
    const year = new Date().getFullYear();
    const random = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
    return `HA${year}${random}`;
}

function generateTeacherId() {
    const year = new Date().getFullYear();
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `TCH${year}${random}`;
}

function generateApprovalCode() {
    return 'AP-' + Math.random().toString(36).substring(2, 10).toUpperCase();
}

// ==================== ROOT ROUTE ====================
app.get('/', (req, res) => {
    res.json({
        success: true,
        message: '🎓 Hermana Academy API Server Running!',
        telegram: TELEGRAM_BOT_TOKEN ? '✅ Configured' : '❌ Not Configured',
        endpoints: {
            health: 'GET /api/health',
            studentRegister: 'POST /api/student/register',
            studentLogin: 'POST /api/student/login',
            teacherApply: 'POST /api/teacher/apply',
            teacherLogin: 'POST /api/teacher/login',
            boardLogin: 'POST /api/board/login',
            directorLogin: 'POST /api/director/login',
            parentLogin: 'POST /api/parent/login'
        }
    });
});

// ==================== HEALTH CHECK ====================
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        telegram: TELEGRAM_BOT_TOKEN ? 'configured' : 'not configured',
        database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
    });
});

// ==================== STUDENT REGISTRATION ====================
app.post('/api/student/register', upload.single('photo'), async (req, res) => {
    try {
        const { fullName, email, phone, grade, parentName, parentPhone, address, examScore, examViolations } = req.body;
        
        console.log('📝 Registering student:', fullName, email);
        
        const studentId = generateStudentId();
        const photoUrl = req.file ? `/uploads/${req.file.filename}` : null;
        
        const student = await Student.create({
            studentId, fullName, email, phone, grade, parentName, parentPhone, address,
            photoUrl, examScore: parseInt(examScore), examViolations: parseInt(examViolations)
        });
        
        console.log('✅ Student saved:', studentId);
        
        // Send Telegram notification
        const message = `
🎓 <b>NEW STUDENT REGISTERED!</b>

👤 <b>Name:</b> ${fullName}
🆔 <b>Student ID:</b> ${studentId}
📚 <b>Grade:</b> ${grade}
📧 <b>Email:</b> ${email}
📊 <b>Exam Score:</b> ${examScore}%
⚠️ <b>Violations:</b> ${examViolations}

🔐 <b>Login Credentials:</b>
   Student ID: ${studentId}
   Full Name: ${fullName}

📱 <b>Parent Access:</b> Same Student ID
        `;
        await sendTelegramMessage(message);
        
        res.status(201).json({ success: true, studentId, student });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ==================== STUDENT LOGIN ====================
app.post('/api/student/login', async (req, res) => {
    try {
        const { studentId, fullName } = req.body;
        const student = await Student.findOne({ studentId, fullName });
        if (!student) {
            return res.status(401).json({ error: 'Invalid Student ID or Name' });
        }
        res.json({ success: true, student });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== GET STUDENT BY ID ====================
app.get('/api/student/:studentId', async (req, res) => {
    try {
        const student = await Student.findOne({ studentId: req.params.studentId });
        if (!student) return res.status(404).json({ error: 'Student not found' });
        res.json(student);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== STUDENT PAYMENT ====================
app.post('/api/student/:studentId/payment', async (req, res) => {
    try {
        const { type, amount } = req.body;
        const student = await Student.findOne({ studentId: req.params.studentId });
        if (!student) return res.status(404).json({ error: 'Student not found' });
        
        let updateField = {};
        if (type === 'registration') updateField = { registration_paid: true };
        else if (type === 'term1') updateField = { term1_paid: true };
        else if (type === 'term2') updateField = { term2_paid: true };
        else if (type === 'term3') updateField = { term3_paid: true };
        
        await Student.updateOne({ studentId: req.params.studentId }, updateField);
        const transactionId = 'TXN-' + Date.now();
        await Payment.create({ studentId: req.params.studentId, studentName: student.fullName, amount, type, transactionId });
        
        // Send Telegram notification for payment
        const message = `
💰 <b>PAYMENT RECEIVED!</b>

👤 <b>Student:</b> ${student.fullName}
🆔 <b>ID:</b> ${student.studentId}
📚 <b>Grade:</b> ${student.grade}
💵 <b>Amount:</b> ${amount} ETB
📋 <b>Type:</b> ${type}
🆔 <b>Transaction:</b> ${transactionId}
        `;
        await sendTelegramMessage(message);
        
        res.json({ success: true, transactionId });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== TEACHER APPLICATION ====================
app.post('/api/teacher/apply', upload.fields([{ name: 'photo' }, { name: 'document' }]), async (req, res) => {
    try {
        const { fullName, email, phone, gradeLevel, subject, experience, reason, examScore } = req.body;
        const approvalCode = generateApprovalCode();
        const photoUrl = req.files['photo'] ? `/uploads/${req.files['photo'][0].filename}` : null;
        const documentUrl = req.files['document'] ? `/uploads/${req.files['document'][0].filename}` : null;
        
        await Teacher.create({
            fullName, email, phone, gradeLevel, subject, experience, photoUrl, documentUrl,
            examScore: parseInt(examScore), approvalCode, status: 'pending', joinedDate: new Date()
        });
        
        // Send Telegram notification
        const message = `
👨‍🏫 <b>NEW TEACHER APPLICATION!</b>

👤 <b>Name:</b> ${fullName}
📧 <b>Email:</b> ${email}
📚 <b>Grade Level:</b> ${gradeLevel}
📖 <b>Subject:</b> ${subject || 'Not specified'}
⭐ <b>Experience:</b> ${experience || 0} years
📊 <b>Exam Score:</b> ${examScore}%
🔑 <b>Approval Code:</b> ${approvalCode}

📝 <b>Message:</b> ${reason || 'No message'}
        `;
        await sendTelegramMessage(message);
        
        res.json({ success: true, approvalCode });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== TEACHER LOGIN ====================
app.post('/api/teacher/login', async (req, res) => {
    try {
        const { code, fullName } = req.body;
        const teacher = await Teacher.findOne({ approvalCode: code, fullName });
        if (!teacher) return res.status(401).json({ error: 'Invalid approval code' });
        if (teacher.status !== 'approved') return res.status(403).json({ error: 'Pending approval' });
        res.json({ success: true, teacher });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== GET PENDING TEACHERS ====================
app.get('/api/teachers/pending', async (req, res) => {
    const teachers = await Teacher.find({ status: 'pending' });
    res.json(teachers);
});

// ==================== GET APPROVED TEACHERS ====================
app.get('/api/teachers/approved', async (req, res) => {
    const teachers = await Teacher.find({ status: 'approved' });
    res.json(teachers);
});

// ==================== APPROVE TEACHER ====================
app.post('/api/teacher/:id/approve', async (req, res) => {
    try {
        const teacher = await Teacher.findById(req.params.id);
        if (!teacher) return res.status(404).json({ error: 'Teacher not found' });
        
        teacher.status = 'approved';
        teacher.teacherId = generateTeacherId();
        await teacher.save();
        
        // Send Telegram notification
        const message = `
✅ <b>TEACHER APPROVED!</b>

👤 <b>Name:</b> ${teacher.fullName}
🆔 <b>Teacher ID:</b> ${teacher.teacherId}
🔑 <b>Approval Code:</b> ${teacher.approvalCode}
📚 <b>Grade Level:</b> ${teacher.gradeLevel}
📖 <b>Subject:</b> ${teacher.subject || 'General'}

🎉 Welcome to Hermana Academy!
        `;
        await sendTelegramMessage(message);
        
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== REJECT TEACHER ====================
app.post('/api/teacher/:id/reject', async (req, res) => {
    try {
        const teacher = await Teacher.findByIdAndDelete(req.params.id);
        if (teacher) {
            const message = `
❌ <b>TEACHER REJECTED!</b>

👤 <b>Name:</b> ${teacher.fullName}
📧 <b>Email:</b> ${teacher.email}
📚 <b>Grade Level:</b> ${teacher.gradeLevel}

Application was not accepted at this time.
            `;
            await sendTelegramMessage(message);
        }
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== BOARD LOGIN ====================
app.post('/api/board/login', (req, res) => {
    const { email, password } = req.body;
    if (email === 'board@hermana.edu' && password === 'board123') {
        res.json({ success: true });
    } else {
        res.status(401).json({ error: 'Invalid credentials' });
    }
});

// ==================== BOARD STATS ====================
app.get('/api/board/stats', async (req, res) => {
    const students = await Student.find();
    const teachers = await Teacher.find({ status: 'approved' });
    const pendingTeachers = await Teacher.find({ status: 'pending' });
    const payments = await Payment.find();
    const totalRevenue = payments.reduce((sum, p) => sum + p.amount, 0);
    
    res.json({
        totalStudents: students.length,
        totalTeachers: teachers.length,
        pendingTeachers: pendingTeachers.length,
        totalRevenue,
        students,
        teachers,
        pendingTeachersList: pendingTeachers,
        payments
    });
});

// ==================== DIRECTOR LOGIN ====================
app.post('/api/director/login', async (req, res) => {
    const { type, password } = req.body;
    const director = await Director.findOne({ type, password });
    if (!director) return res.status(401).json({ error: 'Invalid credentials' });
    res.json({ success: true, director });
});

// ==================== DIRECTOR STATS ====================
app.get('/api/director/:type/stats', async (req, res) => {
    const { type } = req.params;
    let gradeFilter = {};
    if (type === 'kg') gradeFilter = { grade: { $in: ['Nursery', 'Lower KG', 'Upper KG'] } };
    else if (type === 'elementary') gradeFilter = { grade: { $regex: 'Grade [1-4]', $options: 'i' } };
    else if (type === 'high') gradeFilter = { grade: { $regex: 'Grade [9-12]', $options: 'i' } };
    
    const students = await Student.find(gradeFilter);
    const teachers = await Teacher.find({ gradeLevel: type === 'kg' ? 'KG' : type === 'elementary' ? 'Elementary' : 'High', status: 'approved' });
    const revenue = students.reduce((sum, s) => sum + (s.registration_paid ? 1000 : 0) + (s.term1_paid ? 3500 : 0), 0);
    res.json({ students, teachers, revenue });
});

// ==================== PARENT LOGIN ====================
app.post('/api/parent/login', async (req, res) => {
    const { studentId } = req.body;
    const student = await Student.findOne({ studentId });
    if (!student) return res.status(401).json({ error: 'Student not found' });
    res.json({ success: true, student });
});

// ==================== GET ALL STUDENTS ====================
app.get('/api/students', async (req, res) => {
    const students = await Student.find();
    res.json(students);
});

// ==================== GET STUDENTS BY GRADE ====================
app.get('/api/students/grade/:gradeLevel', async (req, res) => {
    const { gradeLevel } = req.params;
    let filter = {};
    if (gradeLevel === 'KG') filter = { grade: { $in: ['Nursery', 'Lower KG', 'Upper KG'] } };
    else if (gradeLevel === 'Elementary') filter = { grade: { $regex: 'Grade [1-4]', $options: 'i' } };
    else if (gradeLevel === 'Middle') filter = { grade: { $regex: 'Grade [5-8]', $options: 'i' } };
    else if (gradeLevel === 'High') filter = { grade: { $regex: 'Grade [9-12]', $options: 'i' } };
    const students = await Student.find(filter);
    res.json(students);
});

// ==================== FEEDBACK ====================
app.post('/api/feedback', async (req, res) => {
    const { name, rating, message } = req.body;
    await Feedback.create({ name, rating, message });
    
    // Send Telegram notification for feedback
    const feedbackMessage = `
💬 <b>NEW FEEDBACK RECEIVED!</b>

⭐ <b>Rating:</b> ${rating}/5
👤 <b>Name:</b> ${name || 'Anonymous'}
💭 <b>Message:</b> ${message}
    `;
    await sendTelegramMessage(feedbackMessage);
    
    res.json({ success: true });
});

app.get('/api/feedbacks', async (req, res) => {
    const feedbacks = await Feedback.find().sort({ date: -1 });
    res.json(feedbacks);
});

// ==================== START SERVER ====================
app.listen(PORT, () => {
    console.log(`
    ╔═══════════════════════════════════════════════════════════════════╗
    ║              HERMANA ACADEMY BACKEND WITH TELEGRAM                ║
    ╠═══════════════════════════════════════════════════════════════════╣
    ║  🚀 Server: http://localhost:${PORT}                               ║
    ║  🤖 Telegram: ${TELEGRAM_BOT_TOKEN ? 'CONFIGURED ✅' : 'NOT CONFIGURED ❌'}
    ║  🗄️  Database: ${mongoose.connection.readyState === 1 ? 'CONNECTED ✅' : 'DISCONNECTED ❌'}
    ║                                                                    ║
    ║  🔑 Demo Accounts:                                                ║
    ║     Board: board@hermana.edu / board123                           ║
    ║     Director: kg123 / elem123 / high123                           ║
    ║                                                                    ║
    ║  📱 Telegram will send notifications for:                         ║
    ║     - New student registrations                                   ║
    ║     - Teacher applications                                        ║
    ║     - Teacher approvals/rejections                                ║
    ║     - Payments                                                    ║
    ║     - Feedback submissions                                        ║
    ╚═══════════════════════════════════════════════════════════════════╝
    `);
});
