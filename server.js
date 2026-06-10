// server.js - Hermana Academy Complete Backend with Telegram Integration
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
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;

async function sendTelegramMessage(chatId, message) {
    if (!TELEGRAM_BOT_TOKEN || !chatId) {
        console.log('⚠️ Telegram not configured. Missing BOT_TOKEN or CHAT_ID');
        return false;
    }
    
    try {
        const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: message,
                parse_mode: 'HTML'
            })
        });
        const data = await response.json();
        if (data.ok) {
            console.log('✅ Telegram message sent to:', chatId);
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

async function sendTelegramPhoto(chatId, photoBase64, caption) {
    if (!TELEGRAM_BOT_TOKEN || !chatId) {
        console.log('⚠️ Telegram not configured');
        return false;
    }
    
    try {
        // Convert base64 to buffer
        const photoBuffer = Buffer.from(photoBase64.split(',')[1], 'base64');
        
        // Create form data
        const formData = new FormData();
        formData.append('chat_id', chatId);
        formData.append('photo', photoBuffer, 'student_photo.jpg');
        if (caption) formData.append('caption', caption);
        
        const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`;
        const response = await fetch(url, {
            method: 'POST',
            body: formData
        });
        const data = await response.json();
        if (data.ok) {
            console.log('✅ Telegram photo sent to:', chatId);
            return true;
        } else {
            console.log('❌ Telegram photo error:', data.description);
            return false;
        }
    } catch (error) {
        console.error('❌ Telegram photo error:', error.message);
        return false;
    }
}

// Test Telegram on startup
if (TELEGRAM_BOT_TOKEN && ADMIN_CHAT_ID) {
    sendTelegramMessage(ADMIN_CHAT_ID, '🤖 *Hermana Academy Bot Started!*\n\nServer is online and ready to receive notifications.');
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
    telegram: { type: String },
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
    telegram: String,
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
            parentLogin: 'POST /api/parent/login',
            telegramSend: 'POST /api/telegram/send',
            telegramSendPhoto: 'POST /api/telegram/send-photo'
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

// ==================== TELEGRAM ENDPOINTS ====================
app.post('/api/telegram/send', async (req, res) => {
    const { chatId, message } = req.body;
    
    if (!chatId || !message) {
        return res.status(400).json({ error: 'chatId and message are required' });
    }
    
    const sent = await sendTelegramMessage(chatId, message);
    if (sent) {
        res.json({ success: true });
    } else {
        res.status(500).json({ error: 'Failed to send Telegram message' });
    }
});

app.post('/api/telegram/send-photo', async (req, res) => {
    const { chatId, photo, caption } = req.body;
    
    if (!chatId || !photo) {
        return res.status(400).json({ error: 'chatId and photo are required' });
    }
    
    const sent = await sendTelegramPhoto(chatId, photo, caption);
    if (sent) {
        res.json({ success: true });
    } else {
        res.status(500).json({ error: 'Failed to send Telegram photo' });
    }
});

// ==================== STUDENT REGISTRATION ====================
app.post('/api/student/register', upload.single('photo'), async (req, res) => {
    try {
        const { fullName, email, telegram, phone, grade, parentName, parentPhone, address, examScore, examViolations } = req.body;
        
        console.log('📝 Registering student:', fullName, email, 'Telegram:', telegram);
        
        const studentId = generateStudentId();
        const photoUrl = req.file ? `/uploads/${req.file.filename}` : null;
        let photoBase64 = null;
        
        // Read photo as base64 for Telegram
        if (req.file) {
            const photoPath = path.join(__dirname, req.file.path);
            const photoBuffer = fs.readFileSync(photoPath);
            photoBase64 = `data:image/jpeg;base64,${photoBuffer.toString('base64')}`;
        }
        
        const student = await Student.create({
            studentId, fullName, email, telegram, phone, grade, parentName, parentPhone, address,
            photoUrl, examScore: parseInt(examScore), examViolations: parseInt(examViolations)
        });
        
        console.log('✅ Student saved:', studentId);
        
        // Send to ADMIN Telegram with photo
        if (ADMIN_CHAT_ID && TELEGRAM_BOT_TOKEN) {
            const adminMessage = `🎓 <b>NEW STUDENT REGISTERED!</b>\n\n👤 <b>Name:</b> ${fullName}\n🆔 <b>Student ID:</b> ${studentId}\n📚 <b>Grade:</b> ${grade}\n📧 <b>Email:</b> ${email}\n🤖 <b>Telegram:</b> ${telegram || 'Not provided'}\n📊 <b>Exam Score:</b> ${examScore}%\n⚠️ <b>Violations:</b> ${examViolations}\n\n🔐 <b>Login:</b> Student ID + Full Name`;
            
            await sendTelegramMessage(ADMIN_CHAT_ID, adminMessage);
            
            if (photoBase64) {
                await sendTelegramPhoto(ADMIN_CHAT_ID, photoBase64, `📸 Student Photo: ${fullName} (${studentId})`);
            }
        }
        
        // Send ID to STUDENT via Telegram
        if (telegram && TELEGRAM_BOT_TOKEN) {
            // Remove @ if present
            const cleanTelegram = telegram.startsWith('@') ? telegram.substring(1) : telegram;
            const studentMessage = `🎉 <b>Welcome to Hermana Academy, ${fullName}!</b>\n\n🆔 <b>Your Student ID:</b> ${studentId}\n📚 <b>Grade:</b> ${grade}\n📊 <b>Exam Score:</b> ${examScore}%\n\n🔐 <b>Login with:</b>\n   Student ID: ${studentId}\n   Full Name: ${fullName}\n\n📱 <b>Parent Access:</b> Same Student ID\n\nThank you for choosing Hermana Academy! 🇪🇹`;
            
            await sendTelegramMessage(cleanTelegram, studentMessage);
        }
        
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
        
        // Send Telegram notification for payment to admin
        if (ADMIN_CHAT_ID && TELEGRAM_BOT_TOKEN) {
            const message = `💰 <b>PAYMENT RECEIVED!</b>\n\n👤 <b>Student:</b> ${student.fullName}\n🆔 <b>ID:</b> ${student.studentId}\n📚 <b>Grade:</b> ${student.grade}\n💵 <b>Amount:</b> ${amount} ETB\n📋 <b>Type:</b> ${type}\n🆔 <b>Transaction:</b> ${transactionId}`;
            await sendTelegramMessage(ADMIN_CHAT_ID, message);
        }
        
        res.json({ success: true, transactionId });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== TEACHER APPLICATION ====================
app.post('/api/teacher/apply', upload.fields([{ name: 'photo' }, { name: 'document' }]), async (req, res) => {
    try {
        const { fullName, email, telegram, phone, gradeLevel, subject, experience, reason, examScore } = req.body;
        const approvalCode = generateApprovalCode();
        const photoUrl = req.files['photo'] ? `/uploads/${req.files['photo'][0].filename}` : null;
        const documentUrl = req.files['document'] ? `/uploads/${req.files['document'][0].filename}` : null;
        
        let photoBase64 = null;
        if (req.files['photo']) {
            const photoPath = path.join(__dirname, req.files['photo'][0].path);
            const photoBuffer = fs.readFileSync(photoPath);
            photoBase64 = `data:image/jpeg;base64,${photoBuffer.toString('base64')}`;
        }
        
        await Teacher.create({
            fullName, email, telegram, phone, gradeLevel, subject, experience, photoUrl, documentUrl,
            examScore: parseInt(examScore), approvalCode, status: 'pending', joinedDate: new Date()
        });
        
        console.log('📝 Teacher application submitted:', fullName);
        
        // Send Telegram notification to admin
        if (ADMIN_CHAT_ID && TELEGRAM_BOT_TOKEN) {
            const adminMessage = `👨‍🏫 <b>NEW TEACHER APPLICATION!</b>\n\n👤 <b>Name:</b> ${fullName}\n📧 <b>Email:</b> ${email}\n🤖 <b>Telegram:</b> ${telegram || 'Not provided'}\n📚 <b>Grade Level:</b> ${gradeLevel}\n📖 <b>Subject:</b> ${subject || 'Not specified'}\n⭐ <b>Experience:</b> ${experience || 0} years\n📊 <b>Exam Score:</b> ${examScore}%\n🔑 <b>Approval Code:</b> ${approvalCode}`;
            await sendTelegramMessage(ADMIN_CHAT_ID, adminMessage);
            
            if (photoBase64) {
                await sendTelegramPhoto(ADMIN_CHAT_ID, photoBase64, `📸 Teacher Photo: ${fullName}`);
            }
        }
        
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
        
        console.log('✅ Teacher approved:', teacher.fullName);
        
        // Send Telegram notification to admin
        if (ADMIN_CHAT_ID && TELEGRAM_BOT_TOKEN) {
            const adminMessage = `✅ <b>TEACHER APPROVED!</b>\n\n👤 <b>Name:</b> ${teacher.fullName}\n🆔 <b>Teacher ID:</b> ${teacher.teacherId}\n🔑 <b>Approval Code:</b> ${teacher.approvalCode}\n📚 <b>Grade Level:</b> ${teacher.gradeLevel}\n📖 <b>Subject:</b> ${teacher.subject || 'General'}`;
            await sendTelegramMessage(ADMIN_CHAT_ID, adminMessage);
        }
        
        // Send approval notification to teacher's Telegram
        if (teacher.telegram && TELEGRAM_BOT_TOKEN) {
            const cleanTelegram = teacher.telegram.startsWith('@') ? teacher.telegram.substring(1) : teacher.telegram;
            const teacherMessage = `✅ <b>Congratulations ${teacher.fullName}!</b>\n\nYour teacher application has been <b>APPROVED</b>!\n\n🆔 <b>Teacher ID:</b> ${teacher.teacherId}\n🔑 <b>Approval Code:</b> ${teacher.approvalCode}\n\n🔐 <b>Login with:</b>\n   Approval Code: ${teacher.approvalCode}\n   Full Name: ${teacher.fullName}\n\nWelcome to Hermana Academy! 🎉`;
            await sendTelegramMessage(cleanTelegram, teacherMessage);
        }
        
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== REJECT TEACHER ====================
app.post('/api/teacher/:id/reject', async (req, res) => {
    try {
        const teacher = await Teacher.findById(req.params.id);
        if (!teacher) return res.status(404).json({ error: 'Teacher not found' });
        
        // Send rejection notification to teacher's Telegram
        if (teacher.telegram && TELEGRAM_BOT_TOKEN) {
            const cleanTelegram = teacher.telegram.startsWith('@') ? teacher.telegram.substring(1) : teacher.telegram;
            const teacherMessage = `❌ <b>Dear ${teacher.fullName},</b>\n\nThank you for your interest in Hermana Academy.\n\nAfter careful review, we regret to inform you that your teacher application has not been accepted at this time.\n\nWe encourage you to reapply in the future.\n\nBest regards,\nHermana Academy Board`;
            await sendTelegramMessage(cleanTelegram, teacherMessage);
        }
        
        // Send Telegram notification to admin
        if (ADMIN_CHAT_ID && TELEGRAM_BOT_TOKEN) {
            const adminMessage = `❌ <b>TEACHER REJECTED!</b>\n\n👤 <b>Name:</b> ${teacher.fullName}\n📧 <b>Email:</b> ${teacher.email}\n📚 <b>Grade Level:</b> ${teacher.gradeLevel}`;
            await sendTelegramMessage(ADMIN_CHAT_ID, adminMessage);
        }
        
        await Teacher.findByIdAndDelete(req.params.id);
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
    
    if (ADMIN_CHAT_ID && TELEGRAM_BOT_TOKEN) {
        const feedbackMessage = `💬 <b>NEW FEEDBACK RECEIVED!</b>\n\n⭐ <b>Rating:</b> ${rating}/5\n👤 <b>Name:</b> ${name || 'Anonymous'}\n💭 <b>Message:</b> ${message}`;
        await sendTelegramMessage(ADMIN_CHAT_ID, feedbackMessage);
    }
    
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
    ║  🤖 Telegram Bot: ${TELEGRAM_BOT_TOKEN ? 'CONFIGURED ✅' : 'NOT CONFIGURED ❌'}
    ║  👑 Admin Chat ID: ${ADMIN_CHAT_ID ? 'CONFIGURED ✅' : 'NOT CONFIGURED ❌'}
    ║  🗄️  Database: ${mongoose.connection.readyState === 1 ? 'CONNECTED ✅' : 'DISCONNECTED ❌'}
    ║                                                                    ║
    ║  🔑 Demo Accounts:                                                ║
    ║     Board: board@hermana.edu / board123                           ║
    ║     Director: kg123 / elem123 / high123                           ║
    ║                                                                    ║
    ║  📱 Telegram Notifications:                                       ║
    ║     - New student registrations (with photo)                      ║
    ║     - Student ID sent to student's Telegram                       ║
    ║     - Teacher applications (with photo)                           ║
    ║     - Teacher approvals/rejections                                ║
    ║     - Payments                                                    ║
    ║     - Feedback submissions                                        ║
    ╚═══════════════════════════════════════════════════════════════════╝
    `);
});
