const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const sqlite3 = require('sqlite3').verbose();
require('dotenv').config();

// ==================== INITIALIZATION ====================
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Create uploads directory if not exists
if (!fs.existsSync('./uploads')) {
  fs.mkdirSync('./uploads');
}

// ==================== DATABASE SETUP ====================
const db = new sqlite3.Database(path.join(__dirname, 'hermana.db'));

db.serialize(() => {
  // Users table
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fullName TEXT NOT NULL,
      email TEXT UNIQUE,
      ethiopianId TEXT UNIQUE,
      idPhotoUrl TEXT,
      password TEXT,
      role TEXT DEFAULT 'student',
      grade TEXT,
      examScore INTEGER DEFAULT 0,
      examPercent INTEGER DEFAULT 0,
      examCompleted BOOLEAN DEFAULT 0,
      examViolations INTEGER DEFAULT 0,
      studentIdNumber TEXT,
      fromGrade TEXT,
      toGrade TEXT,
      phone TEXT,
      teacherStatus TEXT DEFAULT 'pending',
      registrationDate DATETIME DEFAULT CURRENT_TIMESTAMP,
      isActive BOOLEAN DEFAULT 1
    )
  `);

  // Payments table
  db.run(`
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      studentId INTEGER NOT NULL,
      studentName TEXT,
      paymentType TEXT,
      amount INTEGER NOT NULL,
      transactionId TEXT UNIQUE NOT NULL,
      receiptImage TEXT,
      status TEXT DEFAULT 'pending',
      verifiedBy INTEGER,
      verifiedAt DATETIME,
      paymentDate DATETIME DEFAULT CURRENT_TIMESTAMP,
      notes TEXT
    )
  `);

  // Exams table
  db.run(`
    CREATE TABLE IF NOT EXISTS exams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      studentId INTEGER NOT NULL,
      grade TEXT NOT NULL,
      questions TEXT,
      answers TEXT,
      score INTEGER,
      percentage INTEGER,
      timeSpent INTEGER,
      violations INTEGER,
      completedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Updates table
  db.run(`
    CREATE TABLE IF NOT EXISTS updates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      type TEXT,
      createdBy INTEGER,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Feedback table
  db.run(`
    CREATE TABLE IF NOT EXISTS feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT,
      role TEXT,
      rating INTEGER,
      message TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Insert default director
  db.get("SELECT * FROM users WHERE role = 'director'", (err, row) => {
    if (!row && !err) {
      const hashedPassword = bcrypt.hashSync('director123', 10);
      db.run(`
        INSERT INTO users (fullName, email, password, role, isActive)
        VALUES (?, ?, ?, ?, ?)
      `, ['Dr. Alemu Bekele', 'director@hermana.edu', hashedPassword, 'director', 1]);
      console.log('✅ Default director created');
    }
  });

  // Insert test student
  db.get("SELECT * FROM users WHERE ethiopianId = 'ET999999'", (err, row) => {
    if (!row && !err) {
      const hashedPassword = bcrypt.hashSync('student123', 10);
      db.run(`
        INSERT INTO users (fullName, email, ethiopianId, password, grade, role, studentIdNumber, isActive)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, ['Test Student', 'test@hermana.edu', 'ET999999', hashedPassword, 'Grade 10', 'student', 'HA20240001', 1]);
      console.log('✅ Demo student created');
    }
  });
});

// ==================== HELPER FUNCTIONS ====================
const generateExamQuestions = (grade) => {
  const gradeNum = parseInt(grade.match(/\d+/)?.[0] || 5);
  if (gradeNum <= 4) {
    return [
      { id: 1, text: "What is 12 + 7?", options: ["18", "19", "20", "21"], correct: 1 },
      { id: 2, text: "የኢትዮጵያ ዋና ከተማ ማንነው?", options: ["ጎንደር", "አዲስ አበባ", "ሀዋሳ", "ባህርዳር"], correct: 1 },
      { id: 3, text: "5 × 3 = ?", options: ["12", "15", "18", "20"], correct: 1 }
    ];
  } else if (gradeNum <= 8) {
    return [
      { id: 1, text: "144 ÷ 12 = ?", options: ["10", "12", "14", "16"], correct: 1 },
      { id: 2, text: "Capital of Ethiopia?", options: ["Adama", "Addis Ababa", "Harar", "Jimma"], correct: 1 },
      { id: 3, text: "60 km/h for 2.5 hours = ? km", options: ["120", "150", "180", "100"], correct: 1 }
    ];
  } else {
    return [
      { id: 1, text: "Solve: 3x - 7 = 11, x = ?", options: ["4", "5", "6", "7"], correct: 2 },
      { id: 2, text: "Oxygen atomic number?", options: ["6", "7", "8", "9"], correct: 2 },
      { id: 3, text: "What is √169?", options: ["11", "12", "13", "14"], correct: 2 }
    ];
  }
};

const generateStudentIdNumber = () => {
  const year = new Date().getFullYear();
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `HA${year}${random}`;
};

// Authentication middleware
const authenticate = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'hermana_secret_key');
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token.' });
  }
};

// Role authorization middleware
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden: Insufficient permissions.' });
    }
    next();
  };
};

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, './uploads');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});
const upload = multer({ 
  storage, 
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/gif'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// ==================== AUTHENTICATION ROUTES ====================

// Register new student
app.post('/api/auth/register', upload.single('idPhoto'), async (req, res) => {
  try {
    const { fullName, ethiopianId, grade, password, email, fromGrade, toGrade } = req.body;
    const idPhotoUrl = req.file ? `/uploads/${req.file.filename}` : null;
    
    if (!fullName || !ethiopianId || !grade) {
      return res.status(400).json({ error: 'Full name, Ethiopian ID, and grade are required' });
    }
    
    db.get("SELECT id FROM users WHERE ethiopianId = ?", [ethiopianId], async (err, existing) => {
      if (err) return res.status(500).json({ error: err.message });
      if (existing) return res.status(400).json({ error: 'Ethiopian ID already registered' });
      
      const hashedPassword = password ? await bcrypt.hash(password, 10) : await bcrypt.hash('default', 10);
      
      db.run(`
        INSERT INTO users (fullName, email, ethiopianId, idPhotoUrl, password, grade, role, fromGrade, toGrade)
        VALUES (?, ?, ?, ?, ?, ?, 'student', ?, ?)
      `, [fullName, email || null, ethiopianId, idPhotoUrl, hashedPassword, grade, fromGrade || grade, toGrade || grade], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ 
          message: 'Registration successful! Please login to continue.',
          studentId: this.lastID 
        });
      });
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Login
app.post('/api/auth/login', (req, res) => {
  const { identifier, password } = req.body;
  
  if (!identifier) {
    return res.status(400).json({ error: 'Email or Ethiopian ID required' });
  }
  
  db.get(`
    SELECT * FROM users WHERE email = ? OR ethiopianId = ?
  `, [identifier, identifier], async (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    
    let validPassword = false;
    if (user.password) {
      validPassword = await bcrypt.compare(password, user.password);
    } else {
      validPassword = password === 'default';
    }
    
    if (!validPassword) return res.status(401).json({ error: 'Invalid credentials' });
    
    const token = jwt.sign(
      { id: user.id, role: user.role, name: user.fullName, grade: user.grade },
      process.env.JWT_SECRET || 'hermana_secret_key',
      { expiresIn: '7d' }
    );
    
    res.json({
      token,
      user: {
        id: user.id,
        name: user.fullName,
        email: user.email,
        ethiopianId: user.ethiopianId,
        role: user.role,
        grade: user.grade,
        examPercent: user.examPercent,
        examCompleted: user.examCompleted,
        studentIdNumber: user.studentIdNumber,
        idPhotoUrl: user.idPhotoUrl
      }
    });
  });
});

// ==================== EXAM ROUTES ====================

// Get exam questions for student
app.get('/api/exam/:studentId', authenticate, (req, res) => {
  const studentId = req.params.studentId;
  
  if (req.user.role !== 'student' && req.user.id !== parseInt(studentId)) {
    return res.status(403).json({ error: 'Access denied' });
  }
  
  db.get("SELECT grade FROM users WHERE id = ? AND role = 'student'", [studentId], (err, student) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!student) return res.status(404).json({ error: 'Student not found' });
    
    const questions = generateExamQuestions(student.grade);
    res.json({ questions, grade: student.grade });
  });
});

// Submit exam answers
app.post('/api/exam/submit', authenticate, (req, res) => {
  const { studentId, answers, timeSpent, violations } = req.body;
  
  db.get("SELECT grade FROM users WHERE id = ?", [studentId], (err, student) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!student) return res.status(404).json({ error: 'Student not found' });
    
    const questions = generateExamQuestions(student.grade);
    let correct = 0;
    
    answers.forEach((answer, index) => {
      if (answer === questions[index].correct) correct++;
    });
    
    const percentage = Math.round((correct / questions.length) * 100);
    const passed = percentage >= 50;
    const studentIdNumber = passed ? generateStudentIdNumber() : null;
    
    db.run(`
      UPDATE users SET 
        examScore = ?, 
        examPercent = ?, 
        examCompleted = ?, 
        examViolations = ?,
        studentIdNumber = COALESCE(?, studentIdNumber)
      WHERE id = ?
    `, [correct, percentage, true, violations || 0, studentIdNumber, studentId], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      
      db.run(`
        INSERT INTO exams (studentId, grade, questions, answers, score, percentage, timeSpent, violations)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [studentId, student.grade, JSON.stringify(questions), JSON.stringify(answers), correct, percentage, timeSpent, violations || 0]);
      
      res.json({ 
        score: correct, 
        total: questions.length, 
        percentage,
        passed,
        studentIdNumber,
        message: passed ? 'Congratulations! You passed the exam.' : 'Sorry, you did not pass. Please retake the exam.'
      });
    });
  });
});

// ==================== STUDENT ROUTES ====================

// Get student profile
app.get('/api/students/:id', authenticate, (req, res) => {
  const studentId = req.params.id;
  
  db.get(`
    SELECT id, fullName, ethiopianId, idPhotoUrl, grade, examScore, examPercent, examCompleted, 
           examViolations, studentIdNumber, fromGrade, toGrade, registrationDate
    FROM users WHERE id = ? AND role = 'student'
  `, [studentId], (err, student) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!student) return res.status(404).json({ error: 'Student not found' });
    res.json(student);
  });
});

// ==================== PAYMENT ROUTES ====================

const paymentPrices = {
  registration: 1000,
  term1Bus: 3500,
  term2Bus: 3500,
  term3Bus: 3500
};

// Student submits payment receipt
app.post('/api/payment/submit-receipt', authenticate, upload.single('receiptImage'), (req, res) => {
  const { studentId, paymentType, amount, notes } = req.body;
  const receiptImage = req.file ? `/uploads/${req.file.filename}` : null;
  
  if (!receiptImage) {
    return res.status(400).json({ error: 'Receipt image is required' });
  }
  
  const transactionId = 'RCPT-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6).toUpperCase();
  
  db.get("SELECT fullName, ethiopianId FROM users WHERE id = ?", [studentId], (err, student) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!student) return res.status(404).json({ error: 'Student not found' });
    
    db.run(`
      INSERT INTO payments (studentId, studentName, studentEthiopianId, paymentType, amount, transactionId, receiptImage, status, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)
    `, [studentId, student.fullName, student.ethiopianId, paymentType, amount || paymentPrices[paymentType], transactionId, receiptImage, notes], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ 
        success: true, 
        message: 'Receipt submitted to finance department for verification',
        transactionId: transactionId,
        status: 'pending'
      });
    });
  });
});

// Get student payment status
app.get('/api/payments/student/:studentId', authenticate, (req, res) => {
  const studentId = req.params.studentId;
  
  db.all(`
    SELECT paymentType, amount, transactionId, paymentDate, status, receiptImage
    FROM payments WHERE studentId = ?
  `, [studentId], (err, payments) => {
    if (err) return res.status(500).json({ error: err.message });
    
    const paymentStatus = {
      registration: false,
      term1Bus: false,
      term2Bus: false,
      term3Bus: false
    };
    
    payments.forEach(payment => {
      if (payment.status === 'verified') {
        paymentStatus[payment.paymentType] = true;
      }
    });
    
    res.json({ payments, paymentStatus });
  });
});

// ==================== DIRECTOR ROUTES ====================

// Get all students
app.get('/api/director/students', authenticate, authorize('director'), (req, res) => {
  db.all(`
    SELECT id, fullName, ethiopianId, grade, examPercent, examCompleted, studentIdNumber, registrationDate 
    FROM users WHERE role = 'student'
  `, (err, students) => {
    if (err) return res.status(500).json({ error: err.message });
    
    const promises = students.map(student => {
      return new Promise((resolve) => {
        db.all("SELECT paymentType, status FROM payments WHERE studentId = ?", [student.id], (err, payments) => {
          const paymentStatus = {
            registration: false, term1Bus: false, term2Bus: false, term3Bus: false
          };
          payments.forEach(p => { 
            if (p.status === 'verified') {
              paymentStatus[p.paymentType] = true;
            }
          });
          student.paymentStatus = paymentStatus;
          resolve(student);
        });
      });
    });
    
    Promise.all(promises).then(results => {
      res.json(results);
    });
  });
});

// Get all teachers
app.get('/api/director/teachers', authenticate, authorize('director'), (req, res) => {
  db.all(`
    SELECT id, fullName, email, phone, teacherStatus, registrationDate
    FROM users WHERE role = 'teacher'
  `, (err, teachers) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(teachers);
  });
});

// ==================== PARENT ROUTES ====================

// Get school updates
app.get('/api/parent/updates', authenticate, (req, res) => {
  db.all(`
    SELECT * FROM updates 
    ORDER BY createdAt DESC 
    LIMIT 50
  `, (err, updates) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(updates || []);
  });
});

// Get student by ID for parent
app.get('/api/parent/student/:id', authenticate, (req, res) => {
  const studentId = req.params.id;
  
  db.get(`
    SELECT id, fullName, ethiopianId, grade, examPercent, studentIdNumber, fromGrade, toGrade
    FROM users WHERE id = ? AND role = 'student'
  `, [studentId], (err, student) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!student) return res.status(404).json({ error: 'Student not found' });
    
    db.all("SELECT paymentType, amount, paymentDate, status FROM payments WHERE studentId = ?", [studentId], (err, payments) => {
      student.payments = payments;
      res.json(student);
    });
  });
});

// ==================== FEEDBACK ROUTES ====================

// Submit feedback
app.post('/api/feedback', (req, res) => {
  const { name, email, role, rating, message } = req.body;
  
  if (!name || !message) {
    return res.status(400).json({ error: 'Name and message are required' });
  }
  
  db.run(`
    INSERT INTO feedback (name, email, role, rating, message)
    VALUES (?, ?, ?, ?, ?)
  `, [name, email || null, role || null, rating || null, message], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Feedback submitted successfully!', id: this.lastID });
  });
});

// Get all feedback (director only)
app.get('/api/feedback', authenticate, authorize('director'), (req, res) => {
  db.all(`
    SELECT * FROM feedback ORDER BY createdAt DESC
  `, (err, feedback) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(feedback);
  });
});

// ==================== UPDATES ROUTES ====================

// Create school update
app.post('/api/updates', authenticate, authorize('director'), (req, res) => {
  const { title, description, type } = req.body;
  
  if (!title || !description) {
    return res.status(400).json({ error: 'Title and description are required' });
  }
  
  db.run(`
    INSERT INTO updates (title, description, type, createdBy)
    VALUES (?, ?, ?, ?)
  `, [title, description, type || 'announcement', req.user.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Update posted successfully!', updateId: this.lastID });
  });
});

// Get all updates
app.get('/api/updates', (req, res) => {
  db.all(`
    SELECT * FROM updates ORDER BY createdAt DESC LIMIT 20
  `, (err, updates) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(updates);
  });
});

// ==================== HEALTH CHECK ====================
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Hermana Academy Backend is running',
    timestamp: new Date().toISOString(),
    version: '2.0.0'
  });
});

// Root route
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    message: 'Hermana Academy API is running!',
    version: '2.0.0',
    developer: 'Muhammad Ilyas',
    purpose: 'To digitize Ethiopian education - making registration, payments, exams, and financial management easy and accessible.',
    endpoints: {
      auth: '/api/auth/register, /api/auth/login',
      exam: '/api/exam/:studentId, /api/exam/submit',
      payment: '/api/payment/submit-receipt, /api/payments/student/:studentId',
      director: '/api/director/students, /api/director/teachers',
      parent: '/api/parent/updates, /api/parent/student/:id',
      feedback: '/api/feedback',
      health: '/api/health'
    }
  });
});

// ==================== ERROR HANDLER ====================
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!', message: err.message });
});

// ==================== START SERVER ====================
app.listen(PORT, () => {
  console.log(`
  ╔═══════════════════════════════════════════════════════════════════╗
  ║                    🏫 HERMANA ACADEMY BACKEND                      ║
  ║                         Version 2.0.0                              ║
  ║                    Developed by: Muhammad Ilyas                    ║
  ╠═══════════════════════════════════════════════════════════════════╣
  ║  📍 Server running on: http://localhost:${PORT}                     ║
  ║  ✅ Status: Online                                                 ║
  ╠═══════════════════════════════════════════════════════════════════╣
  ║  🔐 Default Login Credentials:                                     ║
  ║  👨‍🎓 Student: ET999999 / student123                                 ║
  ║  📊 Director: director@hermana.edu / director123                   ║
  ╠═══════════════════════════════════════════════════════════════════╣
  ║  📝 API Endpoints:                                                 ║
  ║  POST   /api/auth/register                                         ║
  ║  POST   /api/auth/login                                            ║
  ║  GET    /api/exam/:studentId                                       ║
  ║  POST   /api/exam/submit                                           ║
  ║  POST   /api/payment/submit-receipt                                ║
  ║  GET    /api/payments/student/:studentId                           ║
  ║  GET    /api/director/students                                     ║
  ║  GET    /api/parent/updates                                        ║
  ║  POST   /api/feedback                                              ║
  ╚═══════════════════════════════════════════════════════════════════╝
  `);
});

module.exports = { app, db };
