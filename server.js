// server.js - Hermana Academy Complete Backend
// Run: npm install express cors mongoose nodemailer bcryptjs jsonwebtoken multer
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

// ==================== EMAIL CONFIGURATION (REAL EMAIL) ====================
// For Gmail: Enable "Less secure app access" or use App Password
// For production: Use SendGrid, Mailgun, or AWS SES

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER || 'your-email@gmail.com',
        pass: process.env.EMAIL_PASS || 'your-app-password'
    }
});

// Test email configuration on startup
transporter.verify((error, success) => {
    if (error) {
        console.log('❌ Email configuration error:', error);
    } else {
        console.log('✅ Email server ready to send real emails');
    }
});

// ==================== MONGODB CONNECTION ====================
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/hermana_academy', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('✅ MongoDB Connected');
    initializeDemoData();
}).catch(err => console.error('❌ MongoDB Error:', err));

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
    salary: { type: Number, default: 0 },
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
        console.log('✅ Email sent:', info.messageId);
        return true;
    } catch (error) {
        console.error('❌ Email error:', error);
        return false;
    }
}

// ==================== HELPER FUNCTIONS ====================
function generateStudentId() {
    return 'HA' + new Date().getFullYear() + Math.floor(Math.random() * 100000).toString().padStart(5, '0');
}

function generateTeacherId() {
    return 'TCH' + new Date().getFullYear() + Math.floor(Math.random() * 10000).toString().padStart(4, '0');
}

function generateApprovalCode() {
    return 'AP-' + Math.random().toString(36).substring(2, 10).toUpperCase();
}

// ==================== API ROUTES ====================

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// ==================== STUDENT ROUTES ====================

// Register student (after exam pass)
app.post('/api/student/register', upload.single('photo'), async (req, res) => {
    try {
        const { fullName, email, phone, grade, parentName, parentPhone, address, examScore, examViolations } = req.body;
        
        const studentId = generateStudentId();
        const photoUrl = req.file ? `/uploads/${req.file.filename}` : null;
        
        const student = await Student.create({
            studentId,
            fullName,
            email,
            phone,
            grade,
            parentName,
            parentPhone,
            address,
            photoUrl,
            examScore: parseInt(examScore),
            examViolations: parseInt(examViolations)
        });
        
        // Send REAL email with student ID
        const emailHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
                <div style="text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 10px 10px 0 0;">
                    <h1 style="color: white;">🏫 Hermana Academy</h1>
                </div>
                <div style="padding: 20px;">
                    <h2>Congratulations ${fullName}! 🎉</h2>
                    <p>You have successfully passed the entrance exam with a score of <strong>${examScore}%</strong>.</p>
                    <p>Your Student ID is: <strong style="font-size: 20px; color: #667eea;">${studentId}</strong></p>
                    <p>You can now login to your dashboard using this ID and your full name.</p>
                    <hr style="margin: 20px 0;">
                    <p><strong>Grade:</strong> ${grade}</p>
                    <p><strong>Parent Name:</strong> ${parentName || 'N/A'}</p>
                    <p><strong>Parent Phone:</strong> ${parentPhone || 'N/A'}</p>
                    <hr style="margin: 20px 0;">
                    <p style="color: #666; font-size: 12px;">If you did not register for Hermana Academy, please ignore this email.</p>
                </div>
                <div style="text-align: center; padding: 15px; background: #f5f5f5; border-radius: 0 0 10px 10px;">
                    <p style="margin: 0;">&copy; 2024 Hermana Academy - Ethiopia</p>
                </div>
            </div>
        `;
        
        await sendRealEmail(email, 'Your Hermana Academy Student ID', emailHtml);
        
        res.status(201).json({ success: true, studentId, student });
    } catch (error) {
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

// Make payment
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
        const emailHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2>Payment Receipt</h2>
                <p>Dear ${student.fullName},</p>
                <p>Your payment of <strong>${amount} ETB</strong> for <strong>${type}</strong> has been received.</p>
                <p>Transaction ID: <strong>${transactionId}</strong></p>
                <p>Thank you for your payment!</p>
            </div>
        `;
        await sendRealEmail(student.email, 'Payment Receipt - Hermana Academy', emailHtml);
        
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
            fullName,
            email,
            phone,
            gradeLevel,
            subject,
            experience,
            photoUrl,
            documentUrl,
            examScore: parseInt(examScore),
            approvalCode,
            status: 'pending',
            joinedDate: new Date()
        });
        
        // Send application received email
        const emailHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2>Application Received</h2>
                <p>Dear ${fullName},</p>
                <p>Your application has been received. You passed the exam with <strong>${examScore}%</strong>.</p>
                <p>Your application is under review by the board. You will receive an approval code within 2 days.</p>
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

// Approve teacher
app.post('/api/teacher/:id/approve', async (req, res) => {
    try {
        const teacher = await Teacher.findById(req.params.id);
        if (!teacher) return res.status(404).json({ error: 'Teacher not found' });
        
        teacher.status = 'approved';
        teacher.teacherId = generateTeacherId();
        await teacher.save();
        
        // Send approval email with code
        const emailHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2>Congratulations! Your Application is Approved 🎉</h2>
                <p>Dear ${teacher.fullName},</p>
                <p>We are pleased to inform you that your application has been <strong>APPROVED</strong>.</p>
                <p>Your Teacher ID is: <strong>${teacher.teacherId}</strong></p>
                <p>Your Approval Code is: <strong>${teacher.approvalCode}</strong></p>
                <p>You can now login using this code and your full name.</p>
                <p>Welcome to Hermana Academy!</p>
            </div>
        `;
        await sendRealEmail(teacher.email, 'Teacher Application Approved - Hermana Academy', emailHtml);
        
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Reject teacher
app.post('/api/teacher/:id/reject', async (req, res) => {
    try {
        const teacher = await Teacher.findByIdAndDelete(req.params.id);
        if (teacher) {
            const emailHtml = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2>Application Update</h2>
                    <p>Dear ${teacher.fullName},</p>
                    <p>Thank you for your interest in Hermana Academy.</p>
                    <p>After careful review, we regret to inform you that your application has not been accepted at this time.</p>
                    <p>We encourage you to reapply in the future.</p>
                </div>
            `;
            await sendRealEmail(teacher.email, 'Teacher Application Update - Hermana Academy', emailHtml);
        }
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get teacher by ID
app.get('/api/teacher/:teacherId', async (req, res) => {
    const teacher = await Teacher.findOne({ teacherId: req.params.teacherId });
    res.json(teacher);
});

// Get students by grade level (for teacher)
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
    
    if (!director) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }
    
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
    const revenue = students.reduce((sum, s) => sum + (s.registration_paid ? 1000 : 0) + (s.term1_paid ? 3500 : 0) + (s.term2_paid ? 3500 : 0) + (s.term3_paid ? 3500 : 0), 0);
    
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
    const payments = await Payment.find();
    const totalRevenue = payments.reduce((sum, p) => sum + p.amount, 0);
    
    res.json({
        totalStudents: students.length,
        totalTeachers: teachers.length,
        pendingTeachers: pendingTeachers.length,
        totalRevenue,
        students,
        teachers: teachers,
        pendingTeachersList: pendingTeachers,
        payments
    });
});

// ==================== PARENT ROUTES ====================

app.post('/api/parent/login', async (req, res) => {
    const { studentId } = req.body;
    const student = await Student.findOne({ studentId });
    
    if (!student) {
        return res.status(401).json({ error: 'Student not found' });
    }
    
    res.json({ success: true, student });
});

// ==================== FEEDBACK ROUTE ====================

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
    ╔══════════════════════════════════════════════════════════╗
    ║     Hermana Academy Backend Server Running!              ║
    ╠══════════════════════════════════════════════════════════╣
    ║  Server: http://localhost:${PORT}                          ║
    ║  API Base: http://localhost:${PORT}/api                   ║
    ║                                                            ║
    ║  Email: REAL emails will be sent to provided addresses    ║
    ║  Database: MongoDB                                        ║
    ╚══════════════════════════════════════════════════════════╝
    `);
});
