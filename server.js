// server.js - Hermana Academy Complete Backend
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

// ==================== MIDDLEWARE ====================
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static('uploads'));

// Create uploads directory
if (!fs.existsSync('./uploads')) {
    fs.mkdirSync('./uploads');
}

// ==================== FILE UPLOAD CONFIGURATION ====================
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, './uploads');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage, limits: { fileSize: 10 * 1024 * 1024 } });

// ==================== EMAIL CONFIGURATION ====================
// For Gmail: Go to https://myaccount.google.com/apppasswords to generate a 16-character password
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER || 'your-email@gmail.com',
        pass: process.env.EMAIL_PASS || 'your-16-character-app-password'
    }
});

transporter.verify((error, success) => {
    if (error) {
        console.log('❌ Email configuration error:', error.message);
        console.log('⚠️ Please check your EMAIL_USER and EMAIL_PASS in .env file');
    } else {
        console.log('✅ Email server ready to send REAL emails!');
    }
});

// ==================== MONGODB CONNECTION ====================
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/hermana_academy', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('✅ MongoDB Connected Successfully!');
    initializeDemoData();
}).catch(err => {
    console.error('❌ MongoDB Connection Error:', err.message);
    console.log('⚠️ Please make sure MongoDB is running: mongod');
});

// ==================== SCHEMAS ====================

// Student Schema
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

// Teacher Schema
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

// Director Schema
const directorSchema = new mongoose.Schema({
    type: String,
    name: String,
    password: String,
    photoUrl: String
});

// Payment Schema
const paymentSchema = new mongoose.Schema({
    studentId: String,
    studentName: String,
    amount: Number,
    type: String,
    transactionId: String,
    date: { type: Date, default: Date.now }
});

// Feedback Schema
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
    // Create demo directors
    const directors = await Director.find();
    if (directors.length === 0) {
        await Director.create([
            { type: 'kg', name: 'KG Director', password: 'kg123', photoUrl: null },
            { type: 'elementary', name: 'Elementary Director', password: 'elem123', photoUrl: null },
            { type: 'high', name: 'High School Director', password: 'high123', photoUrl: null }
        ]);
        console.log('✅ Demo directors created');
    }
    
    // Create demo student if none exists
    const studentCount = await Student.countDocuments();
    if (studentCount === 0) {
        await Student.create({
            studentId: 'HA202500001',
            fullName: 'Demo Student',
            email: 'demo@hermana.edu',
            grade: 'Grade 10',
            examScore: 85,
            registration_paid: true
        });
        console.log('✅ Demo student created');
    }
}

// ==================== EMAIL FUNCTION ====================
async function sendRealEmail(to, subject, htmlContent) {
    try {
        const info = await transporter.sendMail({
            from: `"Hermana Academy" <${process.env.EMAIL_USER || 'noreply@hermana.edu'}>`,
            to: to,
            subject: subject,
            html: htmlContent
        });
        console.log('✅ Email sent to:', to, 'Message ID:', info.messageId);
        return true;
    } catch (error) {
        console.error('❌ Email error:', error.message);
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

// ==================== ROOT ROUTE (FIXES "Cannot GET /" ERROR) ====================
app.get('/', (req, res) => {
    res.json({
        success: true,
        message: '🎓 Hermana Academy API Server is Running!',
        version: '1.0.0',
        status: 'online',
        timestamp: new Date().toISOString(),
        endpoints: {
            health: 'GET /api/health',
            student: {
                register: 'POST /api/student/register',
                login: 'POST /api/student/login',
                getById: 'GET /api/student/:studentId',
                payment: 'POST /api/student/:studentId/payment'
            },
            teacher: {
                apply: 'POST /api/teacher/apply',
                login: 'POST /api/teacher/login',
                pending: 'GET /api/teachers/pending',
                approve: 'POST /api/teacher/:id/approve',
                reject: 'POST /api/teacher/:id/reject'
            },
            director: {
                login: 'POST /api/director/login',
                stats: 'GET /api/director/:type/stats'
            },
            board: {
                login: 'POST /api/board/login',
                stats: 'GET /api/board/stats'
            },
            parent: {
                login: 'POST /api/parent/login'
            },
            feedback: {
                submit: 'POST /api/feedback',
                getAll: 'GET /api/feedbacks'
            }
        },
        demoAccounts: {
            board: { email: 'board@hermana.edu', password: 'board123' },
            director: { kg: 'kg123', elementary: 'elem123', high: 'high123' },
            student: { studentId: 'HA202500001', fullName: 'Demo Student' }
        }
    });
});

// ==================== HEALTH CHECK ROUTE ====================
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        email: process.env.EMAIL_USER ? 'configured' : 'not configured'
    });
});

// ==================== STUDENT ROUTES ====================

// Register student and send email with Student ID
app.post('/api/student/register', upload.single('photo'), async (req, res) => {
    try {
        const { fullName, email, phone, grade, parentName, parentPhone, address, examScore, examViolations } = req.body;
        
        const studentId = generateStudentId();
        const photoUrl = req.file ? `/uploads/${req.file.filename}` : null;
        
        const student = await Student.create({
            studentId, fullName, email, phone, grade, parentName, parentPhone, address,
            photoUrl, examScore: parseInt(examScore), examViolations: parseInt(examViolations)
        });
        
        // Send REAL EMAIL with Student ID
        const emailHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    body { font-family: 'Segoe UI', Arial, sans-serif; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 20px 20px 0 0; }
                    .header h1 { color: white; margin: 0; }
                    .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 20px 20px; }
                    .student-id { font-size: 28px; font-weight: bold; color: #667eea; background: white; padding: 15px; border-radius: 15px; text-align: center; margin: 20px 0; letter-spacing: 2px; }
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
                        <p style="color: rgba(255,255,255,0.9);">Ethiopia's Premier Educational Institution</p>
                    </div>
                    <div class="content">
                        <div class="flag">
                            <span class="green"></span>
                            <span class="yellow"></span>
                            <span class="red"></span>
                        </div>
                        <h2 style="color: #333; text-align: center;">Congratulations ${fullName}! 🎉</h2>
                        <p style="font-size: 16px; line-height: 1.6;">You have successfully passed the Hermana Academy entrance examination.</p>
                        
                        <div class="student-id">
                            🆔 Your Student ID: <strong>${studentId}</strong>
                        </div>
                        
                        <div style="background: #e8f0fe; padding: 20px; border-radius: 15px; margin: 20px 0;">
                            <h3 style="margin-top: 0;">📊 Exam Results</h3>
                            <p><strong>Score:</strong> ${examScore}%</p>
                            <p><strong>Grade Level:</strong> ${grade}</p>
                            <p><strong>Violations:</strong> ${examViolations}</p>
                        </div>
                        
                        <div style="background: #e8f0fe; padding: 20px; border-radius: 15px; margin: 20px 0;">
                            <h3 style="margin-top: 0;">🔐 How to Login</h3>
                            <ol style="margin-left: 20px;">
                                <li>Go to Hermana Academy website</li>
                                <li>Select <strong>"Student"</strong> role</li>
                                <li>Enter your Student ID: <strong>${studentId}</strong></li>
                                <li>Enter your Full Name: <strong>${fullName}</strong></li>
                            </ol>
                        </div>
                        
                        <div style="background: #e8f0fe; padding: 20px; border-radius: 15px; margin: 20px 0;">
                            <h3 style="margin-top: 0;">💰 Fee Structure</h3>
                            <p><strong>Registration Fee:</strong> 1,000 ETB</p>
                            <p><strong>Term 1 + Bus:</strong> 3,500 ETB</p>
                            <p><strong>Term 2 + Bus:</strong> 3,500 ETB</p>
                            <p><strong>Term 3 + Bus:</strong> 3,500 ETB</p>
                        </div>
                        
                        <p style="font-size: 14px; color: #666;">📱 Parent Access: Parents can login using the same Student ID</p>
                        <p style="font-size: 14px; color: #666;">📧 For support: support@hermanaacademy.edu.et</p>
                    </div>
                    <div class="footer">
                        <p>&copy; 2024 Hermana Academy - Ethiopia | እውቀት ብርሃን ነው</p>
                    </div>
                </div>
            </body>
            </html>
        `;
        
        await sendRealEmail(email, '🎓 Your Hermana Academy Student ID', emailHtml);
        
        res.status(201).json({ success: true, studentId, student });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Student login
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

// Get student by ID
app.get('/api/student/:studentId', async (req, res) => {
    try {
        const student = await Student.findOne({ studentId: req.params.studentId });
        if (!student) return res.status(404).json({ error: 'Student not found' });
        res.json(student);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Make payment and send receipt
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
        await Payment.create({
            studentId: req.params.studentId,
            studentName: student.fullName,
            amount,
            type,
            transactionId
        });
        
        // Send payment receipt email
        const receiptHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
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

// ==================== TEACHER ROUTES ====================

// Submit teacher application
app.post('/api/teacher/apply', upload.fields([{ name: 'photo' }, { name: 'document' }]), async (req, res) => {
    try {
        const { fullName, email, phone, gradeLevel, subject, experience, reason, examScore } = req.body;
        
        const approvalCode = generateApprovalCode();
        const photoUrl = req.files['photo'] ? `/uploads/${req.files['photo'][0].filename}` : null;
        const documentUrl = req.files['document'] ? `/uploads/${req.files['document'][0].filename}` : null;
        
        const teacher = await Teacher.create({
            fullName, email, phone, gradeLevel, subject, experience, photoUrl, documentUrl,
            examScore: parseInt(examScore), approvalCode, status: 'pending', joinedDate: new Date()
        });
        
        // Send application received email
        const emailHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #667eea;">📝 Teacher Application Received</h2>
                <p>Dear ${fullName},</p>
                <p>Your application has been received. You passed the exam with <strong>${examScore}%</strong>.</p>
                <p>Your application is under review by the board. You will receive an approval code within 2-3 business days.</p>
                <p>Your Approval Code (keep this for reference): <strong>${approvalCode}</strong></p>
                <p>Thank you for your interest in Hermana Academy!</p>
            </div>
        `;
        await sendRealEmail(email, 'Teacher Application Received - Hermana Academy', emailHtml);
        
        res.json({ success: true, message: 'Application submitted', approvalCode });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Teacher login with approval code
app.post('/api/teacher/login', async (req, res) => {
    try {
        const { code, fullName } = req.body;
        const teacher = await Teacher.findOne({ approvalCode: code, fullName });
        
        if (!teacher) {
            return res.status(401).json({ error: 'Invalid approval code or name' });
        }
        
        if (teacher.status !== 'approved') {
            return res.status(403).json({ error: `Application status: ${teacher.status}. Please wait for approval.` });
        }
        
        res.json({ success: true, teacher });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get all pending teachers (Board only)
app.get('/api/teachers/pending', async (req, res) => {
    const teachers = await Teacher.find({ status: 'pending' });
    res.json(teachers);
});

// Get all approved teachers
app.get('/api/teachers/approved', async (req, res) => {
    const teachers = await Teacher.find({ status: 'approved' });
    res.json(teachers);
});

// Approve teacher
app.post('/api/teacher/:id/approve', async (req, res) => {
    try {
        const teacher = await Teacher.findById(req.params.id);
        if (!teacher) return res.status(404).json({ error: 'Teacher not found' });
        
        teacher.status = 'approved';
        teacher.teacherId = generateTeacherId();
        await teacher.save();
        
        const emailHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
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

// Reject teacher
app.post('/api/teacher/:id/reject', async (req, res) => {
    try {
        const teacher = await Teacher.findById(req.params.id);
        if (!teacher) return res.status(404).json({ error: 'Teacher not found' });
        
        const emailHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #dc3545;">Application Update</h2>
                <p>Dear ${teacher.fullName},</p>
                <p>Thank you for your interest in Hermana Academy.</p>
                <p>After careful review, we regret to inform you that your application has not been accepted at this time.</p>
                <p>We encourage you to reapply in the future.</p>
            </div>
        `;
        await sendRealEmail(teacher.email, 'Teacher Application Update - Hermana Academy', emailHtml);
        
        await Teacher.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get students by grade for teacher
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

// ==================== DIRECTOR ROUTES ====================

app.post('/api/director/login', async (req, res) => {
    const { type, password } = req.body;
    const director = await Director.findOne({ type, password });
    if (!director) return res.status(401).json({ error: 'Invalid credentials' });
    res.json({ success: true, director });
});

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

// ==================== BOARD ROUTES ====================

app.post('/api/board/login', (req, res) => {
    const { email, password } = req.body;
    if (email === 'board@hermana.edu' && password === 'board123') {
        res.json({ success: true });
    } else {
        res.status(401).json({ error: 'Invalid credentials' });
    }
});

app.get('/api/board/stats', async (req, res) => {
    const students = await Student.find();
    const teachers = await Teacher.find({ status: 'approved' });
    const pendingTeachers = await Teacher.find({ status: 'pending' });
    const totalRevenue = students.reduce((sum, s) => sum + (s.registration_paid ? 1000 : 0) + (s.term1_paid ? 3500 : 0), 0);
    res.json({ 
        totalStudents: students.length, 
        totalTeachers: teachers.length, 
        pendingTeachers: pendingTeachers.length, 
        totalRevenue, 
        students, 
        teachers, 
        pendingTeachersList: pendingTeachers 
    });
});

// ==================== PARENT ROUTES ====================

app.post('/api/parent/login', async (req, res) => {
    const { studentId } = req.body;
    const student = await Student.findOne({ studentId });
    if (!student) return res.status(401).json({ error: 'Student not found' });
    res.json({ success: true, student });
});

// ==================== FEEDBACK ROUTES ====================

app.post('/api/feedback', async (req, res) => {
    const { name, rating, message } = req.body;
    await Feedback.create({ name, rating, message });
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
    ║                    HERMANA ACADEMY BACKEND SERVER                 ║
    ╠═══════════════════════════════════════════════════════════════════╣
    ║                                                                   ║
    ║  🚀 Server: http://localhost:${PORT}                               ║
    ║  📡 API Base: http://localhost:${PORT}/api                        ║
    ║  ✅ Status: Running                                               ║
    ║                                                                   ║
    ║  📧 Email: ${process.env.EMAIL_USER ? 'CONFIGURED ✅' : 'NOT CONFIGURED ❌'}
    ║  🗄️  Database: MongoDB ${mongoose.connection.readyState === 1 ? 'CONNECTED ✅' : 'DISCONNECTED ❌'}
    ║                                                                   ║
    ║  🧪 Test the API:                                                 ║
    ║     curl http://localhost:${PORT}/api/health                       ║
    ║                                                                   ║
    ║  🔑 Demo Accounts:                                                ║
    ║     Board: board@hermana.edu / board123                           ║
    ║     Director: kg123 / elem123 / high123                           ║
    ║     Student: HA202500001 / Demo Student                           ║
    ║                                                                   ║
    ╚═══════════════════════════════════════════════════════════════════╝
    `);
});
