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

// School Bank Account Information
const SCHOOL_BANK = {
  accountNumber: "100045326789431",
  bankName: "Commercial Bank of Ethiopia (CBE)",
  accountName: "Hermana Academy",
  branch: "Bole Branch, Addis Ababa",
  swiftCode: "CBETETAA"
};

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
  // Users table with photo storage
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fullName TEXT NOT NULL,
      email TEXT UNIQUE,
      ethiopianId TEXT UNIQUE,
      idPhotoUrl TEXT,
      studentPhotoUrl TEXT,
      password TEXT,
      role TEXT DEFAULT 'student',
      grade TEXT,
      examScore INTEGER DEFAULT 0,
      examPercent INTEGER DEFAULT 0,
      examCompleted BOOLEAN DEFAULT 0,
      examViolations INTEGER DEFAULT 0,
      studentIdNumber TEXT,
      studentIdCardUrl TEXT,
      fromGrade TEXT,
      toGrade TEXT,
      phone TEXT,
      teacherStatus TEXT DEFAULT 'pending',
      registrationDate DATETIME DEFAULT CURRENT_TIMESTAMP,
      isActive BOOLEAN DEFAULT 1
    )
  `);

  // Payments table with bank transaction tracking
  db.run(`
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      studentId INTEGER NOT NULL,
      studentName TEXT,
      studentEthiopianId TEXT,
      paymentType TEXT,
      amount INTEGER NOT NULL,
      transactionId TEXT UNIQUE NOT NULL,
      bankAccountNumber TEXT,
      bankName TEXT,
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

  // Insert test student with photo
  db.get("SELECT * FROM users WHERE ethiopianId = 'ET999999'", (err, row) => {
    if (!row && !err) {
      const hashedPassword = bcrypt.hashSync('student123', 10);
      db.run(`
        INSERT INTO users (fullName, email, ethiopianId, password, grade, role, studentIdNumber, studentPhotoUrl, isActive)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, ['Test Student', 'test@hermana.edu', 'ET999999', hashedPassword, 'Grade 10', 'student', 'HA20240001', '/uploads/default-student.jpg', 1]);
      console.log('✅ Demo student created');
    }
  });
});

// ==================== HELPER FUNCTIONS ====================
const generateExamQuestions = (grade) => {
  const gradeNum = parseInt(grade.match(/\d+/)?.[0] || 5);
  if (grade === "Nursery" || grade === "Lower KG" || grade === "Upper KG") {
    return [
      { id: 1, text: "What color is the sun?", options: ["Red", "Yellow", "Blue", "Green"], correct: 1 },
      { id: 2, text: "Which animal says 'Moo'?", options: ["Cat", "Dog", "Cow", "Lion"], correct: 2 },
      { id: 3, text: "What is 1 + 1?", options: ["1", "2", "3", "4"], correct: 1 }
    ];
  }
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

const generateStudentIdCard = (student) => {
  const studentId = student.studentIdNumber || generateStudentIdNumber();
  const expiryDate = new Date();
  expiryDate.setFullYear(expiryDate.getFullYear() + 1);
  
  return {
    studentId: studentId,
    fullName: student.fullName,
    ethiopianId: student.ethiopianId,
    grade: student.grade,
    fromGrade: student.fromGrade,
    toGrade: student.toGrade,
    issuedDate: new Date().toISOString(),
    expiryDate: expiryDate.toISOString(),
    photoUrl: student.studentPhotoUrl
  };
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

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden: Insufficient permissions.' });
    }
    next();
  };
};

// Multer configuration for file uploads (student photo and ID photo)
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

// ==================== BANK INFO ROUTE ====================
app.get('/api/bank-info', (req, res) => {
  res.json({
    success: true,
    bank: SCHOOL_BANK
  });
});

// ==================== AUTHENTICATION ROUTES ====================

// Register new student with photo
app.post('/api/auth/register', upload.fields([
  { name: 'idPhoto', maxCount: 1 },
  { name: 'studentPhoto', maxCount: 1 }
]), async (req, res) => {
  try {
    const { fullName, ethiopianId, grade, password, email, fromGrade, toGrade } = req.body;
    const idPhotoUrl = req.files?.idPhoto ? `/uploads/${req.files.idPhoto[0].filename}` : null;
    const studentPhotoUrl = req.files?.studentPhoto ? `/uploads/${req.files.studentPhoto[0].filename}` : null;
    
    if (!fullName || !ethiopianId || !grade) {
      return res.status(400).json({ error: 'Full name, Ethiopian ID, and grade are required' });
    }
    
    if (!studentPhotoUrl) {
      return res.status(400).json({ error: 'Student photo is required for ID card' });
    }
    
    db.get("SELECT id FROM users WHERE ethiopianId = ?", [ethiopianId], async (err, existing) => {
      if (err) return res.status(500).json({ error: err.message });
      if (existing) return res.status(400).json({ error: 'Ethiopian ID already registered' });
      
      const hashedPassword = password ? await bcrypt.hash(password, 10) : await bcrypt.hash('default', 10);
      
      db.run(`
        INSERT INTO users (fullName, email, ethiopianId, idPhotoUrl, studentPhotoUrl, password, grade, role, fromGrade, toGrade)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'student', ?, ?)
      `, [fullName, email || null, ethiopianId, idPhotoUrl, studentPhotoUrl, hashedPassword, grade, fromGrade || grade, toGrade || grade], function(err) {
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
        studentPhotoUrl: user.studentPhotoUrl,
        idPhotoUrl: user.idPhotoUrl
      }
    });
  });
});

// ==================== EXAM ROUTES ====================

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
    let studentIdNumber = null;
    let studentIdCard = null;
    
    if (passed) {
      studentIdNumber = generateStudentIdNumber();
      studentIdCard = `/uploads/id_cards/${studentIdNumber}.png`;
    }
    
    db.run(`
      UPDATE users SET 
        examScore = ?, 
        examPercent = ?, 
        examCompleted = ?, 
        examViolations = ?,
        studentIdNumber = COALESCE(?, studentIdNumber),
        studentIdCardUrl = COALESCE(?, studentIdCardUrl)
      WHERE id = ?
    `, [correct, percentage, true, violations || 0, studentIdNumber, studentIdCard, studentId], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      
      db.run(`
        INSERT INTO exams (studentId, grade, questions, answers, score, percentage, timeSpent, violations)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [studentId, student.grade, JSON.stringify(questions), JSON.stringify(answers), correct, percentage, timeSpent, violations || 0]);
      
      // Get updated student info for ID card
      db.get("SELECT * FROM users WHERE id = ?", [studentId], (err, updatedStudent) => {
        const idCard = passed ? generateStudentIdCard(updatedStudent) : null;
        
        res.json({ 
          score: correct, 
          total: questions.length, 
          percentage,
          passed,
          studentIdNumber: studentIdNumber,
          studentIdCard: idCard,
          message: passed ? '🎉 Congratulations! You passed the exam. Your Student ID Card has been generated!' : '❌ Sorry, you did not pass. Please retake the exam.'
        });
      });
    });
  });
});

// ==================== STUDENT ROUTES ====================

app.get('/api/students/:id', authenticate, (req, res) => {
  const studentId = req.params.id;
  
  db.get(`
    SELECT id, fullName, ethiopianId, idPhotoUrl, studentPhotoUrl, grade, examScore, examPercent, examCompleted, 
           examViolations, studentIdNumber, studentIdCardUrl, fromGrade, toGrade, registrationDate
    FROM users WHERE id = ? AND role = 'student'
  `, [studentId], (err, student) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!student) return res.status(404).json({ error: 'Student not found' });
    
    // Generate ID card if student has passed but no card URL
    if (student.examCompleted && student.examPercent >= 50 && !student.studentIdCardUrl) {
      const idCard = generateStudentIdCard(student);
      student.studentIdCard = idCard;
    }
    
    res.json(student);
  });
});

// Get student ID card
app.get('/api/students/:id/id-card', authenticate, (req, res) => {
  const studentId = req.params.id;
  
  db.get(`
    SELECT id, fullName, ethiopianId, studentPhotoUrl, grade, studentIdNumber, fromGrade, toGrade, examPercent
    FROM users WHERE id = ? AND role = 'student'
  `, [studentId], (err, student) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!student) return res.status(404).json({ error: 'Student not found' });
    
    if (student.examPercent < 50) {
      return res.status(403).json({ error: 'ID Card available only after passing the exam (50% or higher)' });
    }
    
    const idCard = generateStudentIdCard(student);
    res.json(idCard);
  });
});

// ==================== PAYMENT ROUTES ====================

const paymentPrices = {
  registration: 1000,
  term1Bus: 3500,
  term2Bus: 3500,
  term3Bus: 3500
};

// Get bank info for payment
app.get('/api/payment/bank-info', (req, res) => {
  res.json({
    success: true,
    bank: SCHOOL_BANK,
    instructions: [
      "1. Transfer the exact amount to the school bank account",
      "2. Use your Student ID (or Ethiopian ID) as payment reference",
      "3. Upload the bank receipt/transaction screenshot below",
      "4. Wait for finance team verification (within 24 hours)"
    ]
  });
});

// Student submits payment receipt
app.post('/api/payment/submit-receipt', authenticate, upload.single('receiptImage'), (req, res) => {
  const { studentId, paymentType, amount, notes, transactionReference } = req.body;
  const receiptImage = req.file ? `/uploads/${req.file.filename}` : null;
  
  if (!receiptImage) {
    return res.status(400).json({ error: 'Payment receipt image is required' });
  }
  
  const transactionId = 'RCPT-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6).toUpperCase();
  
  db.get("SELECT fullName, ethiopianId FROM users WHERE id = ?", [studentId], (err, student) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!student) return res.status(404).json({ error: 'Student not found' });
    
    db.run(`
      INSERT INTO payments (studentId, studentName, studentEthiopianId, paymentType, amount, transactionId, bankAccountNumber, bankName, receiptImage, status, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
    `, [studentId, student.fullName, student.ethiopianId, paymentType, amount || paymentPrices[paymentType], transactionId, SCHOOL_BANK.accountNumber, SCHOOL_BANK.bankName, receiptImage, notes || `Reference: ${transactionReference || student.ethiopianId}`], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ 
        success: true, 
        message: 'Payment receipt submitted! Finance team will verify within 24 hours.',
        transactionId: transactionId,
        status: 'pending',
        bankAccount: SCHOOL_BANK.accountNumber
      });
    });
  });
});

// Get student payment status
app.get('/api/payments/student/:studentId', authenticate, (req, res) => {
  const studentId = req.params.studentId;
  
  db.all(`
    SELECT paymentType, amount, transactionId, paymentDate, status, receiptImage, bankAccountNumber
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
    
    res.json({ 
      payments, 
      paymentStatus,
      schoolBankAccount: SCHOOL_BANK.accountNumber
    });
  });
});

// ==================== DIRECTOR ROUTES ====================

app.get('/api/director/students', authenticate, authorize('director'), (req, res) => {
  db.all(`
    SELECT id, fullName, ethiopianId, grade, examPercent, examCompleted, studentIdNumber, studentPhotoUrl, registrationDate 
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

// ==================== PARENT ROUTES ====================

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

app.get('/api/parent/student/:id', authenticate, (req, res) => {
  const studentId = req.params.id;
  
  db.get(`
    SELECT id, fullName, ethiopianId, grade, examPercent, studentIdNumber, studentPhotoUrl, fromGrade, toGrade
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

// ==================== UPDATES ROUTES ====================

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
    purpose: 'To digitize Ethiopian education - making registration, payments, exams, and ID card generation easy and accessible.',
    schoolBankAccount: SCHOOL_BANK.accountNumber,
    endpoints: {
      auth: '/api/auth/register, /api/auth/login',
      exam: '/api/exam/:studentId, /api/exam/submit',
      payment: '/api/payment/bank-info, /api/payment/submit-receipt, /api/payments/student/:studentId',
      director: '/api/director/students',
      parent: '/api/parent/updates, /api/parent/student/:id',
      feedback: '/api/feedback',
      idCard: '/api/students/:id/id-card',
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
  ║  🏦 SCHOOL BANK ACCOUNT:                                           ║
  ║     Account Number: ${SCHOOL_BANK.accountNumber}                     ║
  ║     Bank Name: ${SCHOOL_BANK.bankName}                              ║
  ║     Account Name: ${SCHOOL_BANK.accountName}                        ║
  ╠═══════════════════════════════════════════════════════════════════╣
  ║  🔐 Default Login Credentials:                                     ║
  ║  👨‍🎓 Student: ET999999 / student123                                 ║
  ║  📊 Director: director@hermana.edu / director123                   ║
  ╠═══════════════════════════════════════════════════════════════════╣
  ║  📝 Features:                                                      ║
  ║  ✅ Student Registration with Photo                                ║
  ║  ✅ Timed Exam (1 minute)                                          ║
  ║  ✅ Automatic ID Card Generation after Passing                     ║
  ║  ✅ Bank Payment Integration                                       ║
  ║  ✅ Receipt Upload & Verification                                  ║
  ╚═══════════════════════════════════════════════════════════════════╝
  `);
});

module.exports = { app, db };
