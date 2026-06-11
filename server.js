// server.js - Hermana Academy Complete Backend with Telegram
// Run: npm install express cors mongoose multer dotenv
// Then: node server.js

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 3000;

// ==================== DEBUG ENVIRONMENT VARIABLES ====================
console.log('========================================');
console.log('📧 ENVIRONMENT VARIABLES CHECK:');
console.log('   TELEGRAM_BOT_TOKEN:', process.env.TELEGRAM_BOT_TOKEN ? '✅ SET' : '❌ MISSING');
console.log('   ADMIN_CHAT_ID:', process.env.ADMIN_CHAT_ID ? '✅ SET' : '❌ MISSING');
console.log('   MONGODB_URI:', process.env.MONGODB_URI ? '✅ SET' : '❌ MISSING');
console.log('========================================');

// ==================== MIDDLEWARE ====================
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
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

// Function to send Telegram message
function sendTelegramMessage(chatId, message) {
    return new Promise((resolve) => {
        if (!TELEGRAM_BOT_TOKEN || !chatId) {
            console.log('⚠️ Telegram not configured - missing token or chatId');
            resolve(false);
            return;
        }
        
        const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
        const postData = JSON.stringify({
            chat_id: chatId,
            text: message,
            parse_mode: 'HTML'
        });
        
        const options = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };
        
        const req = https.request(url, options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (json.ok) {
                        console.log('✅ Telegram message sent to:', chatId);
                        resolve(true);
                    } else {
                        console.log('❌ Telegram error to', chatId, ':', json.description);
                        resolve(false);
                    }
                } catch(e) {
                    console.log('❌ Telegram parse error:', e.message);
                    resolve(false);
                }
            });
        });
        
        req.on('error', (error) => {
            console.log('❌ Telegram request error:', error.message);
            resolve(false);
        });
        
        req.write(postData);
        req.end();
    });
}

// Function to check if user has started a chat with the bot
function checkUserExists(telegramUsername) {
    return new Promise((resolve) => {
        if (!TELEGRAM_BOT_TOKEN || !telegramUsername) {
            resolve(false);
            return;
        }
        
        const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates`;
        
        const req = https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (json.ok && json.result) {
                        // Check if the username exists in updates
                        const userExists = json.result.some(update => {
                            const username = update.message?.from?.username || update.message?.chat?.username;
                            return username && username.toLowerCase() === telegramUsername.toLowerCase();
                        });
                        resolve(userExists);
                    } else {
                        resolve(false);
                    }
                } catch(e) {
                    resolve(false);
                }
            });
        });
        
        req.on('error', () => resolve(false));
        req.end();
    });
}

// Function to send photo to Telegram
function sendTelegramPhoto(chatId, photoBase64, caption) {
    return new Promise((resolve) => {
        if (!TELEGRAM_BOT_TOKEN || !chatId || !photoBase64) {
            resolve(false);
            return;
        }
        
        let base64Data = photoBase64;
        if (photoBase64.includes(',')) {
            base64Data = photoBase64.split(',')[1];
        }
        
        const photoBuffer = Buffer.from(base64Data, 'base64');
        const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
        
        let postData = '';
        postData += `--${boundary}\r\n`;
        postData += `Content-Disposition: form-data; name="chat_id"\r\n\r\n`;
        postData += `${chatId}\r\n`;
        postData += `--${boundary}\r\n`;
        postData += `Content-Disposition: form-data; name="photo"; filename="photo.jpg"\r\n`;
        postData += `Content-Type: image/jpeg\r\n\r\n`;
        
        const bufferHeader = Buffer.from(postData, 'utf8');
        
        if (caption) {
            const captionData = `\r\n--${boundary}\r\nContent-Disposition: form-data; name="caption"\r\n\r\n${caption}\r\n--${boundary}--\r\n`;
            const finalBuffer = Buffer.concat([bufferHeader, photoBuffer, Buffer.from(captionData, 'utf8')]);
            
            const options = {
                method: 'POST',
                headers: {
                    'Content-Type': `multipart/form-data; boundary=${boundary}`,
                    'Content-Length': finalBuffer.length
                }
            };
            
            const req = https.request(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`, options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const json = JSON.parse(data);
                        if (json.ok) {
                            console.log('✅ Telegram photo sent to:', chatId);
                            resolve(true);
                        } else {
                            console.log('❌ Telegram photo error:', json.description);
                            resolve(false);
                        }
                    } catch(e) {
                        resolve(false);
                    }
                });
            });
            
            req.on('error', (error) => {
                console.log('❌ Telegram photo request error:', error.message);
                resolve(false);
            });
            
            req.write(finalBuffer);
            req.end();
        } else {
            const bufferFooter = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8');
            const finalBuffer = Buffer.concat([bufferHeader, photoBuffer, bufferFooter]);
            
            const options = {
                method: 'POST',
                headers: {
                    'Content-Type': `multipart/form-data; boundary=${boundary}`,
                    'Content-Length': finalBuffer.length
                }
            };
            
            const req = https.request(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`, options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const json = JSON.parse(data);
                        if (json.ok) {
                            console.log('✅ Telegram photo sent to:', chatId);
                            resolve(true);
                        } else {
                            console.log('❌ Telegram photo error:', json.description);
                            resolve(false);
                        }
                    } catch(e) {
                        resolve(false);
                    }
                });
            });
            
            req.on('error', (error) => {
                console.log('❌ Telegram photo request error:', error.message);
                resolve(false);
            });
            
            req.write(finalBuffer);
            req.end();
        }
    });
}

// Send startup notification
if (TELEGRAM_BOT_TOKEN && ADMIN_CHAT_ID) {
    setTimeout(() => {
        sendTelegramMessage(ADMIN_CHAT_ID, '🤖 *Hermana Academy Bot Started!*\n\nServer is online and ready.');
    }, 3000);
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
        adminChat: ADMIN_CHAT_ID ? '✅ Configured' : '❌ Not Configured'
    });
});

// ==================== HEALTH CHECK ====================
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        telegram: TELEGRAM_BOT_TOKEN ? 'configured' : 'not configured',
        adminChat: ADMIN_CHAT_ID ? 'configured' : 'not configured',
        database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
    });
});

// ==================== CHECK IF USER EXISTS IN TELEGRAM ====================
app.get('/api/telegram/check-user/:username', async (req, res) => {
    const { username } = req.params;
    const exists = await checkUserExists(username);
    res.json({ username, exists });
});

// ==================== TEST TELEGRAM ENDPOINT ====================
app.get('/api/test-telegram', async (req, res) => {
    if (!TELEGRAM_BOT_TOKEN || !ADMIN_CHAT_ID) {
        return res.json({
            success: false,
            error: 'Telegram not configured',
            tokenConfigured: !!TELEGRAM_BOT_TOKEN,
            chatIdConfigured: !!ADMIN_CHAT_ID
        });
    }
    
    const result = await sendTelegramMessage(ADMIN_CHAT_ID, '✅ Test message from Hermana Academy! Your bot is working perfectly.');
    res.json({
        success: result,
        tokenConfigured: true,
        chatIdConfigured: true,
        messageSent: result
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
        res.status(500).json({ error: 'Failed to send Telegram message. Make sure the user has started a chat with the bot.' });
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
        
        console.log('📝 Registering student:', fullName, 'Telegram username:', telegram);
        
        const studentId = generateStudentId();
        const photoUrl = req.file ? `/uploads/${req.file.filename}` : null;
        let photoBase64 = null;
        
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
            const adminMessage = `🎓 <b>NEW STUDENT REGISTERED!</b>\n\n👤 <b>Name:</b> ${fullName}\n🆔 <b>Student ID:</b> ${studentId}\n📚 <b>Grade:</b> ${grade}\n📧 <b>Email:</b> ${email}\n🤖 <b>Telegram:</b> ${telegram || 'Not provided'}\n📊 <b>Exam Score:</b> ${examScore}%`;
            
            await sendTelegramMessage(ADMIN_CHAT_ID, adminMessage);
            
            if (photoBase64) {
                await sendTelegramPhoto(ADMIN_CHAT_ID, photoBase64, `📸 Student: ${fullName} (${studentId})`);
            }
        }
        
        // Send ID to STUDENT via Telegram
        let studentMessageSent = false;
        let studentMessageError = null;
        
        if (telegram && TELEGRAM_BOT_TOKEN) {
            // Remove @ if present
            let cleanTelegram = telegram;
            if (telegram.startsWith('@')) {
                cleanTelegram = telegram.substring(1);
            }
            
            console.log('📱 Attempting to send Telegram to student:', cleanTelegram);
            
            // First check if user exists
            const userExists = await checkUserExists(cleanTelegram);
            
            if (!userExists) {
                studentMessageError = 'User has not started a chat with the bot';
                console.log('⚠️ Student has NOT started a chat with the bot. Please ask them to send /start to @Hermana_Acadamey_bot');
            } else {
                const studentMessage = `🎉 <b>Welcome to Hermana Academy, ${fullName}!</b>\n\n🆔 <b>Your Student ID:</b> ${studentId}\n📚 <b>Grade:</b> ${grade}\n📊 <b>Exam Score:</b> ${examScore}%\n\n🔐 <b>Login with:</b>\n   Student ID: ${studentId}\n   Full Name: ${fullName}\n\n📱 <b>Parent Access:</b> Same Student ID\n\nThank you for choosing Hermana Academy! 🇪🇹`;
                
                const sent = await sendTelegramMessage(cleanTelegram, studentMessage);
                
                if (sent) {
                    console.log('✅ Student ID message sent to Telegram user:', cleanTelegram);
                    studentMessageSent = true;
                } else {
                    studentMessageError = 'Failed to send message';
                    console.log('⚠️ Failed to send message to student');
                }
            }
        } else {
            studentMessageError = 'No Telegram username provided';
            console.log('⚠️ No Telegram username provided for student:', fullName);
        }
        
        res.status(201).json({ 
            success: true, 
            studentId, 
            student,
            telegramSent: studentMessageSent,
            telegramError: studentMessageError,
            telegramNote: studentMessageSent ? 'ID sent to Telegram' : 'Could not send Telegram. Please make sure you have started a chat with @Hermana_Acadamey_bot first!'
        });
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
        
        if (ADMIN_CHAT_ID && TELEGRAM_BOT_TOKEN) {
            const message = `💰 <b>PAYMENT RECEIVED!</b>\n\n👤 <b>Student:</b> ${student.fullName}\n🆔 <b>ID:</b> ${student.studentId}\n💵 <b>Amount:</b> ${amount} ETB\n📋 <b>Type:</b> ${type}`;
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
        
        if (ADMIN_CHAT_ID && TELEGRAM_BOT_TOKEN) {
            const adminMessage = `👨‍🏫 <b>NEW TEACHER APPLICATION!</b>\n\n👤 <b>Name:</b> ${fullName}\n📧 <b>Email:</b> ${email}\n🤖 <b>Telegram:</b> ${telegram || 'Not provided'}\n📚 <b>Grade Level:</b> ${gradeLevel}\n📊 <b>Exam Score:</b> ${examScore}%\n🔑 <b>Approval Code:</b> ${approvalCode}`;
            await sendTelegramMessage(ADMIN_CHAT_ID, adminMessage);
            
            if (photoBase64) {
                await sendTelegramPhoto(ADMIN_CHAT_ID, photoBase64, `📸 Teacher: ${fullName}`);
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
        
        if (ADMIN_CHAT_ID && TELEGRAM_BOT_TOKEN) {
            const adminMessage = `✅ <b>TEACHER APPROVED!</b>\n\n👤 <b>Name:</b> ${teacher.fullName}\n🆔 <b>Teacher ID:</b> ${teacher.teacherId}`;
            await sendTelegramMessage(ADMIN_CHAT_ID, adminMessage);
        }
        
        if (teacher.telegram && TELEGRAM_BOT_TOKEN) {
            let cleanTelegram = teacher.telegram;
            if (teacher.telegram.startsWith('@')) {
                cleanTelegram = teacher.telegram.substring(1);
            }
            
            // Check if user exists first
            const userExists = await checkUserExists(cleanTelegram);
            
            if (userExists) {
                const teacherMessage = `✅ <b>Congratulations ${teacher.fullName}!</b>\n\nYour teacher application has been <b>APPROVED</b>!\n\n🆔 <b>Teacher ID:</b> ${teacher.teacherId}\n🔑 <b>Approval Code:</b> ${teacher.approvalCode}\n\nWelcome to Hermana Academy! 🎉`;
                await sendTelegramMessage(cleanTelegram, teacherMessage);
            } else {
                console.log('⚠️ Teacher has not started chat with bot. Cannot send approval message.');
            }
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
        
        if (teacher.telegram && TELEGRAM_BOT_TOKEN) {
            let cleanTelegram = teacher.telegram;
            if (teacher.telegram.startsWith('@')) {
                cleanTelegram = teacher.telegram.substring(1);
            }
            
            const userExists = await checkUserExists(cleanTelegram);
            
            if (userExists) {
                const teacherMessage = `❌ <b>Dear ${teacher.fullName},</b>\n\nThank you for your interest in Hermana Academy.\n\nAfter careful review, we regret to inform you that your application has not been accepted at this time.\n\nBest regards,\nHermana Academy Board`;
                await sendTelegramMessage(cleanTelegram, teacherMessage);
            }
        }
        
        if (ADMIN_CHAT_ID && TELEGRAM_BOT_TOKEN) {
            const adminMessage = `❌ <b>TEACHER REJECTED!</b>\n\n👤 <b>Name:</b> ${teacher.fullName}`;
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
    ║  ⚠️ IMPORTANT FOR STUDENTS:                                       ║
    ║     Students MUST start a chat with the bot FIRST!                ║
    ║     1. Open Telegram                                              ║
    ║     2. Search for: @Hermana_Acadamey_bot                          ║
    ║     3. Click START button                                         ║
    ║     4. Send any message (say "Hello")                             ║
    ║     5. THEN register on the website                               ║
    ║                                                                    ║
    ║  🔑 Demo Accounts:                                                ║
    ║     Board: board@hermana.edu / board123                           ║
    ║     Director: kg123 / elem123 / high123                           ║
    ╚═══════════════════════════════════════════════════════════════════╝
    `);
});
