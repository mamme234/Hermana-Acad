// server.js - Hermana Academy Complete Backend with Working Email
// Run: npm install express cors mongoose nodemailer bcryptjs jsonwebtoken multer dotenv
// Then: node server.js

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

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
const upload = multer({ storage: storage, limits: { fileSize: 10 * 1024 * 1024 } });

// ==================== EMAIL CONFIGURATION (WORKING) ====================
// For Gmail: You MUST use an App Password (NOT your regular password)
// Get App Password: https://myaccount.google.com/apppasswords

const emailUser = process.env.EMAIL_USER || 'your-email@gmail.com';
const emailPass = process.env.EMAIL_PASS || 'your-16-character-app-password';

console.log('📧 Email User:', emailUser);
console.log('📧 Email Password length:', emailPass ? emailPass.length : 0);

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: emailUser,
        pass: emailPass
    },
    tls: {
        rejectUnauthorized: false
    }
});

// Verify email configuration on startup
transporter.verify((error, success) => {
    if (error) {
        console.log('❌ EMAIL ERROR:', error.message);
        console.log('⚠️ Please check:');
        console.log('   1. EMAIL_USER in .env file');
        console.log('   2. EMAIL_PASS (16-character App Password)');
        console.log('   3. 2-Step Verification enabled on Gmail');
    } else {
        console.log('✅ EMAIL READY! Real emails will be sent to students');
    }
});

// ==================== MONGODB CONNECTION ====================
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/hermana_academy', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('✅ MongoDB Connected');
    initializeDemoData();
}).catch(err => console.error('❌ MongoDB Error:', err.message));

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

// ==================== EMAIL FUNCTION (WORKING) ====================
async function sendRealEmail(to, subject, htmlContent) {
    if (!to || to === 'your-email@gmail.com') {
        console.log('⚠️ Email not sent: Invalid recipient email');
        return false;
    }
    
    try {
        const mailOptions = {
            from: `"Hermana Academy" <${emailUser}>`,
            to: to,
            subject: subject,
            html: htmlContent
        };
        
        const info = await transporter.sendMail(mailOptions);
        console.log('✅ EMAIL SENT! To:', to, 'Message ID:', info.messageId);
        return true;
    } catch (error) {
        console.error('❌ EMAIL FAILED:', error.message);
        return false;
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
        message: '🎓 Hermana Academy API Server is Running!',
        status: 'online',
        endpoints: {
            health: 'GET /api/health',
            studentRegister: 'POST /api/student/register',
            studentLogin: 'POST /api/student/login',
            teacherApply: 'POST /api/teacher/apply',
            teacherLogin: 'POST /api/teacher/login',
            boardLogin: 'POST /api/board/login',
            directorLogin: 'POST /api/director/login',
            parentLogin: 'POST /api/parent/login',
            feedback: 'POST /api/feedback'
        }
    });
});

// ==================== HEALTH CHECK ====================
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        emailConfigured: emailUser !== 'your-email@gmail.com',
        database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
    });
});

// ==================== STUDENT REGISTRATION (WITH EMAIL) ====================
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
        
        console.log('✅ Student saved to database:', studentId);
        
        // ========== SEND REAL EMAIL ==========
        const emailHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    body { font-family: Arial, sans-serif; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: linear-gradient(135deg, #667eea, #764ba2); padding: 30px; text-align: center; color: white; border-radius: 20px 20px 0 0; }
                    .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 20px 20px; }
                    .student-id { font-size: 28px; font-weight: bold; color: #667eea; background: white; padding: 15px; border-radius: 15px; text-align: center; margin: 20px 0; }
                    .flag { display: flex; justify-content: center; gap: 5px; margin: 20px 0; }
                    .flag span { width: 50px; height: 30px; }
                    .green { background: #078930; }
                    .yellow { background: #fcdd09; }
                    .red { background: #da121a; }
                    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>🏫 Hermana Academy</h1>
                        <p>Ethiopia's Premier Educational Institution</p>
                    </div>
                    <div class="content">
                        <div class="flag">
                            <span class="green"></span>
                            <span class="yellow"></span>
                            <span class="red"></span>
                        </div>
                        <h2>Congratulations ${fullName}! 🎉</h2>
                        <p>You have successfully passed the Hermana Academy entrance examination.</p>
                        
                        <div class="student-id">
                            🆔 Your Student ID: <strong>${studentId}</strong>
                        </div>
                        
                        <div style="background: #e8f0fe; padding: 20px; border-radius: 15px; margin: 20px 0;">
                            <h3>📊 Exam Results</h3>
                            <p><strong>Score:</strong> ${examScore}%</p>
                            <p><strong>Grade Level:</strong> ${grade}</p>
                            <p><strong>Violations:</strong> ${examViolations}</p>
                        </div>
                        
                        <div style="background: #e8f0fe; padding: 20px; border-radius: 15px; margin: 20px 0;">
                            <h3>🔐 How to Login</h3>
                            <ol>
                                <li>Go to Hermana Academy website</li>
                                <li>Select <strong>"Student"</strong> role</li>
                                <li>Enter Student ID: <strong>${studentId}</strong></li>
                                <li>Enter Full Name: <strong>${fullName}</strong></li>
                            </ol>
                        </div>
                        
                        <div style="background: #e8f0fe; padding: 20px; border-radius: 15px; margin: 20px 0;">
                            <h3>💰 Fee Structure</h3>
                            <p><strong>Registration Fee:</strong> 1,000 ETB</p>
                            <p><strong>Term 1 + Bus:</strong> 3,500 ETB</p>
                            <p><strong>Term 2 + Bus:</strong> 3,500 ETB</p>
                            <p><strong>Term 3 + Bus:</strong> 3,500 ETB</p>
                        </div>
                        
                        <p>📱 Parents can login using the same Student ID</p>
                        <p>📧 For support: support@hermanaacademy.edu.et</p>
                    </div>
                    <div class="footer">
                        <p>&copy; 2024 Hermana Academy - Ethiopia | እውቀት ብርሃን ነው</p>
                    </div>
                </div>
            </body>
            </html>
        `;
        
        const emailSent = await sendRealEmail(email, '🎓 Your Hermana Academy Student ID', emailHtml);
        
        if (emailSent) {
            console.log('📧 Welcome email sent to:', email);
        } else {
            console.log('⚠️ Email not sent, but student was registered successfully');
        }
        
        res.status(201).json({ success: true, studentId, student, emailSent });
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
        if (!student) return res.status(401).json({ error: 'Invalid Student ID or Name' });
        res.json({ success: true, student });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== STUDENT PAYMENT (WITH EMAIL) ====================
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
        
        // Send receipt email
        const receiptHtml = `
            <div style="font-family: Arial; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #667eea;">🧾 Payment Receipt</h2>
                <p>Dear ${student.fullName},</p>
                <p>Your payment has been successfully processed.</p>
                <div style="background: #f0f0f0; padding: 15px; border-radius: 10px;">
                    <p><strong>Amount:</strong> ${amount} ETB</p>
                    <p><strong>Payment Type:</strong> ${type}</p>
                    <p><strong>Transaction ID:</strong> ${transactionId}</p>
                    <p><strong>Date:</strong> ${new Date().toLocaleString()}</p>
                </div>
                <p>Thank you for choosing Hermana Academy!</p>
            </div>
        `;
        await sendRealEmail(student.email, 'Payment Receipt - Hermana Academy', receiptHtml);
        
        res.json({ success: true, transactionId });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== TEACHER APPLICATION (WITH EMAIL) ====================
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
        
        // Send confirmation email
        const emailHtml = `
            <div style="font-family: Arial; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #667eea;">📝 Teacher Application Received</h2>
                <p>Dear ${fullName},</p>
                <p>Your application has been received. You passed the exam with <strong>${examScore}%</strong>.</p>
                <p>Your application is under review. You will receive an approval code within 2-3 business days.</p>
                <p>Your Approval Code: <strong>${approvalCode}</strong></p>
                <p>Thank you for your interest in Hermana Academy!</p>
            </div>
        `;
        await sendRealEmail(email, 'Teacher Application Received - Hermana Academy', emailHtml);
        
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

// ==================== TEACHER APPROVAL (WITH EMAIL) ====================
app.post('/api/teacher/:id/approve', async (req, res) => {
    try {
        const teacher = await Teacher.findById(req.params.id);
        if (!teacher) return res.status(404).json({ error: 'Teacher not found' });
        
        teacher.status = 'approved';
        teacher.teacherId = generateTeacherId();
        await teacher.save();
        
        const emailHtml = `
            <div style="font-family: Arial; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #28a745;">✅ Application Approved!</h2>
                <p>Dear ${teacher.fullName},</p>
                <p>Congratulations! Your application has been <strong>APPROVED</strong>.</p>
                <p><strong>Teacher ID:</strong> ${teacher.teacherId}</p>
                <p><strong>Approval Code:</strong> ${teacher.approvalCode}</p>
                <p>You can now login using your approval code and full name.</p>
                <p>Welcome to Hermana Academy!</p>
            </div>
        `;
        await sendRealEmail(teacher.email, 'Teacher Application Approved! - Hermana Academy', emailHtml);
        
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== OTHER ROUTES ====================
app.get('/api/teachers/pending', async (req, res) => {
    const teachers = await Teacher.find({ status: 'pending' });
    res.json(teachers);
});

app.get('/api/teachers/approved', async (req, res) => {
    const teachers = await Teacher.find({ status: 'approved' });
    res.json(teachers);
});

app.post('/api/director/login', async (req, res) => {
    const { type, password } = req.body;
    const director = await Director.findOne({ type, password });
    if (!director) return res.status(401).json({ error: 'Invalid credentials' });
    res.json({ success: true, director });
});

app.post('/api/board/login', (req, res) => {
    const { email, password } = req.body;
    if (email === 'board@hermana.edu' && password === 'board123') {
        res.json({ success: true });
    } else {
        res.status(401).json({ error: 'Invalid credentials' });
    }
});

app.post('/api/parent/login', async (req, res) => {
    const { studentId } = req.body;
    const student = await Student.findOne({ studentId });
    if (!student) return res.status(401).json({ error: 'Student not found' });
    res.json({ success: true, student });
});

app.post('/api/feedback', async (req, res) => {
    const { name, rating, message } = req.body;
    await Feedback.create({ name, rating, message });
    res.json({ success: true });
});

app.get('/api/board/stats', async (req, res) => {
    const students = await Student.find();
    const teachers = await Teacher.find({ status: 'approved' });
    const pendingTeachers = await Teacher.find({ status: 'pending' });
    res.json({ totalStudents: students.length, totalTeachers: teachers.length, pendingTeachers: pendingTeachers.length, students, teachers, pendingTeachersList: pendingTeachers });
});

// ==================== START SERVER ====================
app.listen(PORT, () => {
    console.log(`
    ╔═══════════════════════════════════════════════════════════════════╗
    ║                    HERMANA ACADEMY BACKEND SERVER                 ║
    ╠═══════════════════════════════════════════════════════════════════╣
    ║  🚀 Server: http://localhost:${PORT}                               ║
    ║  📡 API Base: http://localhost:${PORT}/api                        ║
    ║  ✅ Status: Running                                               ║
    ║                                                                    ║
    ║  📧 Email: ${emailUser !== 'your-email@gmail.com' ? 'CONFIGURED ✅' : 'NOT CONFIGURED ❌'}
    ║  🗄️  Database: MongoDB ${mongoose.connection.readyState === 1 ? 'CONNECTED ✅' : 'DISCONNECTED ❌'}
    ║                                                                    ║
    ║  🔑 Demo Accounts:                                                ║
    ║     Board: board@hermana.edu / board123                           ║
    ║     Director: kg123 / elem123 / high123                           ║
    ║                                                                    ║
    ╚═══════════════════════════════════════════════════════════════════╝
    `);
});
