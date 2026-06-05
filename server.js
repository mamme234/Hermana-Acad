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
      role TEXT CHECK(role IN ('student', 'director', 'teacher', 'parent', 'board', 'finance')) DEFAULT 'student',
      grade TEXT,
      examScore INTEGER DEFAULT 0,
      examPercent INTEGER DEFAULT 0,
      examCompleted BOOLEAN DEFAULT 0,
      examViolations INTEGER DEFAULT 0,
      examPhoto TEXT,
      studentIdNumber TEXT,
      fromGrade TEXT,
      toGrade TEXT,
      phone TEXT,
      educationDoc TEXT,
      teachingGrades TEXT,
      applicationReason TEXT,
      teacherStatus TEXT DEFAULT 'pending',
      salary DECIMAL(10,2) DEFAULT 0,
      registrationDate DATETIME DEFAULT CURRENT_TIMESTAMP,
      isActive BOOLEAN DEFAULT 1
    )
  `);

  // Payments table (student fees)
  db.run(`
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      studentId INTEGER NOT NULL,
      studentName TEXT,
      studentEthiopianId TEXT,
      paymentType TEXT CHECK(paymentType IN ('registration', 'term1Bus', 'term2Bus', 'term3Bus')),
      amount INTEGER NOT NULL,
      transactionId TEXT UNIQUE NOT NULL,
      receiptImage TEXT,
      status TEXT DEFAULT 'pending',
      verifiedBy INTEGER,
      verifiedAt DATETIME,
      paymentDate DATETIME DEFAULT CURRENT_TIMESTAMP,
      notes TEXT,
      FOREIGN KEY (studentId) REFERENCES users(id)
    )
  `);

  // Expenses table (school expenses)
  db.run(`
    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      expenseType TEXT CHECK(expenseType IN ('salary', 'maintenance', 'utilities', 'supplies', 'equipment', 'other')),
      description TEXT,
      amount DECIMAL(10,2) NOT NULL,
      receiptImage TEXT,
      createdBy INTEGER,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      status TEXT DEFAULT 'approved'
    )
  `);

  // Salaries table
  db.run(`
    CREATE TABLE IF NOT EXISTS salaries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      teacherId INTEGER,
      teacherName TEXT,
      month TEXT,
      year INTEGER,
      baseSalary DECIMAL(10,2),
      bonus DECIMAL(10,2) DEFAULT 0,
      deduction DECIMAL(10,2) DEFAULT 0,
      netSalary DECIMAL(10,2),
      paid BOOLEAN DEFAULT 0,
      paidAt DATETIME,
      transactionId TEXT,
      FOREIGN KEY (teacherId) REFERENCES users(id)
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
      completedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (studentId) REFERENCES users(id)
    )
  `);

  // School updates table
  db.run(`
    CREATE TABLE IF NOT EXISTS updates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      type TEXT CHECK(type IN ('alert', 'info', 'event', 'ban', 'announcement', 'financial')),
      targetAudience TEXT DEFAULT 'all',
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

  // Insert default board member
  db.get("SELECT * FROM users WHERE role = 'board'", (err, row) => {
    if (!row && !err) {
      const hashedPassword = bcrypt.hashSync('board123', 10);
      db.run(`
        INSERT INTO users (fullName, email, password, role, isActive)
        VALUES (?, ?, ?, ?, ?)
      `, ['Board of Directors', 'board@hermana.edu', hashedPassword, 'board', 1]);
      console.log('✅ Default board member created');
    }
  });

  // Insert default finance officer
  db.get("SELECT * FROM users WHERE role = 'finance'", (err, row) => {
    if (!row && !err) {
      const hashedPassword = bcrypt.hashSync('finance123', 10);
      db.run(`
        INSERT INTO users (fullName, email, password, role, isActive)
        VALUES (?, ?, ?, ?, ?)
      `, ['Finance Officer', 'finance@hermana.edu', hashedPassword, 'finance', 1]);
      console.log('✅ Default finance officer created: finance@hermana.edu / finance123');
    }
  });

  // Insert default teacher for demo
  db.get("SELECT * FROM users WHERE role = 'teacher' AND email = 'teacher@hermana.edu'", (err, row) => {
    if (!row && !err) {
      const hashedPassword = bcrypt.hashSync('teacher123', 10);
      db.run(`
        INSERT INTO users (fullName, email, password, role, phone, teacherStatus, salary, isActive)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, ['Demo Teacher', 'teacher@hermana.edu', hashedPassword, 'teacher', '+251-911-000000', 'approved', 8000, 1]);
      console.log('✅ Demo teacher created');
    }
  });

  // Insert sample student
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
      { id: 2, text: "የኢትዮጵያ ዋና ከተማ?", options: ["ጎንደር", "አዲስ አበባ", "ሀዋሳ", "ባህርዳር"], correct: 1 },
      { id: 3, text: "5 × 3 = ?", options: ["12", "15", "18", "20"], correct: 1 }
    ];
  } else if (gradeNum <= 8) {
    return [
      { id: 1, text: "144 ÷ 12 = ?", options: ["10", "12", "14", "16"], correct: 1 },
      { id: 2, text: "Capital of Ethiopia?", options: ["Adama", "Addis Ababa", "Harar", "Jimma"], correct: 1 },
      { id: 3, text: "60 km/h for 2.5h = ? km", options: ["120", "150", "180", "100"], correct: 1 }
    ];
  } else {
    return [
      { id: 1, text: "3x - 7 = 11, x = ?", options: ["4", "5", "6", "7"], correct: 2 },
      { id: 2, text: "Oxygen atomic number?", options: ["6", "7", "8", "9"], correct: 2 },
      { id: 3, text: "√169 = ?", options: ["11", "12", "13", "14"], correct: 2 }
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
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/gif', 'application/pdf'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only images and PDF files are allowed'), false);
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

// Register new teacher
app.post('/api/auth/register-teacher', upload.single('educationDoc'), async (req, res) => {
  try {
    const { fullName, email, password, phone, teachingGrades, reason } = req.body;
    const educationDocUrl = req.file ? `/uploads/${req.file.filename}` : null;
    
    if (!fullName || !email || !password || !phone) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    
    db.get("SELECT id FROM users WHERE email = ?", [email], async (err, existing) => {
      if (err) return res.status(500).json({ error: err.message });
      if (existing) return res.status(400).json({ error: 'Email already registered' });
      
      const hashedPassword = await bcrypt.hash(password, 10);
      const teachingGradesStr = JSON.stringify(teachingGrades ? teachingGrades.split(',') : []);
      
      db.run(`
        INSERT INTO users (fullName, email, password, phone, educationDoc, teachingGrades, applicationReason, role, teacherStatus)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'teacher', 'pending')
      `, [fullName, email, hashedPassword, phone, educationDocUrl, teachingGradesStr, reason], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ 
          message: 'Application submitted successfully! Board will review your application.',
          teacherId: this.lastID 
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
        teacherStatus: user.teacherStatus,
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

// Finance: Get all pending receipts
app.get('/api/finance/pending-receipts', authenticate, authorize('finance'), (req, res) => {
  db.all(`
    SELECT p.*, u.fullName, u.ethiopianId, u.grade, u.studentIdNumber
    FROM payments p
    JOIN users u ON p.studentId = u.id
    WHERE p.status = 'pending'
    ORDER BY p.paymentDate DESC
  `, (err, receipts) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(receipts);
  });
});

// Finance: Get all verified receipts
app.get('/api/finance/verified-receipts', authenticate, authorize('finance'), (req, res) => {
  db.all(`
    SELECT p.*, u.fullName, u.ethiopianId, u.grade, u.studentIdNumber
    FROM payments p
    JOIN users u ON p.studentId = u.id
    WHERE p.status = 'verified'
    ORDER BY p.verifiedAt DESC
  `, (err, receipts) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(receipts);
  });
});

// Finance: Verify receipt
app.post('/api/finance/verify-receipt/:receiptId', authenticate, authorize('finance'), (req, res) => {
  const { receiptId } = req.params;
  
  db.run(`
    UPDATE payments 
    SET status = 'verified', verifiedBy = ?, verifiedAt = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [req.user.id, receiptId], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Receipt verified successfully' });
  });
});

// Finance: Reject receipt
app.post('/api/finance/reject-receipt/:receiptId', authenticate, authorize('finance'), (req, res) => {
  const { receiptId } = req.params;
  const { reason } = req.body;
  
  db.run(`
    UPDATE payments 
    SET status = 'rejected', notes = ?
    WHERE id = ?
  `, [reason || 'Payment rejected', receiptId], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Receipt rejected' });
  });
});

// Finance: Get all payments summary
app.get('/api/finance/summary', authenticate, authorize('finance'), (req, res) => {
  db.get("SELECT COUNT(*) as totalPayments, SUM(amount) as totalAmount FROM payments WHERE status = 'verified'", (err, total) => {
    db.get("SELECT COUNT(*) as pendingCount FROM payments WHERE status = 'pending'", (err, pending) => {
      db.get("SELECT SUM(amount) as pendingAmount FROM payments WHERE status = 'pending'", (err, pendingAmount) => {
        db.all(`
          SELECT paymentType, COUNT(*) as count, SUM(amount) as total 
          FROM payments WHERE status = 'verified' 
          GROUP BY paymentType
        `, (err, byType) => {
          res.json({
            totalPayments: total?.totalPayments || 0,
            totalAmount: total?.totalAmount || 0,
            pendingCount: pending?.pendingCount || 0,
            pendingAmount: pendingAmount?.pendingAmount || 0,
            paymentsByType: byType || []
          });
        });
      });
    });
  });
});

// Finance: Add expense
app.post('/api/finance/expenses', authenticate, authorize('finance'), upload.single('receiptImage'), (req, res) => {
  const { expenseType, description, amount } = req.body;
  const receiptImage = req.file ? `/uploads/${req.file.filename}` : null;
  
  db.run(`
    INSERT INTO expenses (expenseType, description, amount, receiptImage, createdBy)
    VALUES (?, ?, ?, ?, ?)
  `, [expenseType, description, amount, receiptImage, req.user.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Expense added successfully', expenseId: this.lastID });
  });
});

// Finance: Get all expenses
app.get('/api/finance/expenses', authenticate, authorize('finance'), (req, res) => {
  db.all(`
    SELECT e.*, u.fullName as createdByName
    FROM expenses e
    LEFT JOIN users u ON e.createdBy = u.id
    ORDER BY e.createdAt DESC
  `, (err, expenses) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(expenses);
  });
});

// Finance: Get expense summary
app.get('/api/finance/expenses-summary', authenticate, authorize('finance'), (req, res) => {
  db.all(`
    SELECT expenseType, SUM(amount) as total, COUNT(*) as count
    FROM expenses
    GROUP BY expenseType
  `, (err, summary) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(summary);
  });
});

// Finance: Process teacher salary
app.post('/api/finance/salaries', authenticate, authorize('finance'), (req, res) => {
  const { teacherId, month, year, baseSalary, bonus, deduction } = req.body;
  const netSalary = (baseSalary || 0) + (bonus || 0) - (deduction || 0);
  const transactionId = 'SAL-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6).toUpperCase();
  
  db.get("SELECT fullName FROM users WHERE id = ? AND role = 'teacher'", [teacherId], (err, teacher) => {
    if (err) return res.status(500).json({ error: err.message });
    
    db.run(`
      INSERT INTO salaries (teacherId, teacherName, month, year, baseSalary, bonus, deduction, netSalary, transactionId)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [teacherId, teacher.fullName, month, year, baseSalary, bonus, deduction, netSalary, transactionId], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Salary processed successfully', salaryId: this.lastID, netSalary });
    });
  });
});

// Finance: Get all salaries
app.get('/api/finance/salaries', authenticate, authorize('finance'), (req, res) => {
  db.all(`
    SELECT s.*, u.fullName, u.email, u.phone
    FROM salaries s
    JOIN users u ON s.teacherId = u.id
    ORDER BY s.year DESC, s.month DESC
  `, (err, salaries) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(salaries);
  });
});

// Finance: Mark salary as paid
app.post('/api/finance/salaries/:salaryId/pay', authenticate, authorize('finance'), (req, res) => {
  const { salaryId } = req.params;
  
  db.run(`
    UPDATE salaries SET paid = 1, paidAt = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [salaryId], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Salary marked as paid' });
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

// ==================== TEACHER ROUTES ====================

app.get('/api/teachers/:id', authenticate, (req, res) => {
  const teacherId = req.params.id;
  
  db.get(`
    SELECT id, fullName, email, phone, teachingGrades, applicationReason, teacherStatus, salary, registrationDate
    FROM users WHERE id = ? AND role = 'teacher'
  `, [teacherId], (err, teacher) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!teacher) return res.status(404).json({ error: 'Teacher not found' });
    
    if (teacher.teachingGrades) {
      teacher.teachingGrades = JSON.parse(teacher.teachingGrades);
    }
    res.json(teacher);
  });
});

// ==================== DIRECTOR ROUTES ====================

app.get('/api/director/students', authenticate, authorize('director'), (req, res) => {
  const { grade } = req.query;
  
  let query = `SELECT id, fullName, ethiopianId, grade, examPercent, examCompleted, studentIdNumber, registrationDate FROM users WHERE role = 'student'`;
  const params = [];
  
  if (grade) {
    query += ` AND grade = ?`;
    params.push(grade);
  }
  
  db.all(query, params, (err, students) => {
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

app.get('/api/director/teachers', authenticate, authorize('director'), (req, res) => {
  db.all(`
    SELECT id, fullName, email, phone, teachingGrades, teacherStatus, salary, registrationDate
    FROM users WHERE role = 'teacher'
  `, (err, teachers) => {
    if (err) return res.status(500).json({ error: err.message });
    teachers.forEach(t => {
      if (t.teachingGrades) t.teachingGrades = JSON.parse(t.teachingGrades);
    });
    res.json(teachers);
  });
});

// ==================== BOARD ROUTES ====================

app.get('/api/board/pending-teachers', authenticate, authorize('board'), (req, res) => {
  db.all(`
    SELECT id, fullName, email, phone, teachingGrades, applicationReason, educationDoc, teacherStatus, registrationDate
    FROM users WHERE role = 'teacher' AND teacherStatus = 'pending'
  `, (err, teachers) => {
    if (err) return res.status(500).json({ error: err.message });
    teachers.forEach(t => {
      if (t.teachingGrades) t.teachingGrades = JSON.parse(t.teachingGrades);
    });
    res.json(teachers);
  });
});

app.post('/api/board/review-teacher/:teacherId', authenticate, authorize('board'), (req, res) => {
  const { teacherId } = req.params;
  const { status, message } = req.body;
  
  if (!['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  
  db.run(`
    UPDATE users SET teacherStatus = ? WHERE id = ? AND role = 'teacher'
  `, [status, teacherId], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: `Teacher application ${status}`, status });
  });
});

app.get('/api/board/statistics', authenticate, authorize('board'), (req, res) => {
  db.get("SELECT COUNT(*) as totalStudents FROM users WHERE role = 'student'", (err, studentCount) => {
    db.get("SELECT COUNT(*) as totalTeachers FROM users WHERE role = 'teacher'", (err, teacherCount) => {
      db.get("SELECT SUM(amount) as totalFees FROM payments WHERE status = 'verified'", (err, fees) => {
        db.get("SELECT COUNT(*) as pendingTeachers FROM users WHERE role = 'teacher' AND teacherStatus = 'pending'", (err, pending) => {
          res.json({
            totalStudents: studentCount?.totalStudents || 0,
            totalTeachers: teacherCount?.totalTeachers || 0,
            totalFeesCollected: fees?.totalFees || 0,
            pendingTeachers: pending?.pendingTeachers || 0
          });
        });
      });
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
    res.json(updates);
  });
});

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
    SELECT u.*, u2.fullName as creatorName
    FROM updates u
    LEFT JOIN users u2 ON u.createdBy = u2.id
    ORDER BY u.createdAt DESC
    LIMIT 20
  `, (err, updates) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(updates);
  });
});

// ==================== FINANCE DASHBOARD SUMMARY ====================
app.get('/api/finance/dashboard', authenticate, authorize('finance'), (req, res) => {
  // Get total income from verified payments
  db.get("SELECT SUM(amount) as totalIncome FROM payments WHERE status = 'verified'", (err, income) => {
    // Get total expenses
    db.get("SELECT SUM(amount) as totalExpenses FROM expenses", (err, expenses) => {
      // Get pending receipts count
      db.get("SELECT COUNT(*) as pendingReceipts FROM payments WHERE status = 'pending'", (err, pending) => {
        // Get monthly income
        db.all(`
          SELECT strftime('%Y-%m', paymentDate) as month, SUM(amount) as total 
          FROM payments WHERE status = 'verified' 
          GROUP BY strftime('%Y-%m', paymentDate)
          ORDER BY month DESC LIMIT 6
        `, (err, monthlyIncome) => {
          // Get recent payments
          db.all(`
            SELECT p.*, u.fullName 
            FROM payments p
            JOIN users u ON p.studentId = u.id
            WHERE p.status = 'verified'
            ORDER BY p.paymentDate DESC LIMIT 10
          `, (err, recentPayments) => {
            res.json({
              totalIncome: income?.totalIncome || 0,
              totalExpenses: expenses?.totalExpenses || 0,
              netProfit: (income?.totalIncome || 0) - (expenses?.totalExpenses || 0),
              pendingReceipts: pending?.pendingReceipts || 0,
              monthlyIncome: monthlyIncome || [],
              recentPayments: recentPayments || []
            });
          });
        });
      });
    });
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
    purpose: 'To digitize Ethiopian education - making registration, payments, exams, and financial management easy and accessible for all students, teachers, and administrators.',
    endpoints: {
      auth: '/api/auth/register, /api/auth/login',
      exam: '/api/exam/:studentId, /api/exam/submit',
      payment: '/api/payment/submit-receipt, /api/payments/student/:studentId',
      finance: '/api/finance/pending-receipts, /api/finance/verify-receipt/:id, /api/finance/expenses, /api/finance/salaries',
      director: '/api/director/students, /api/director/teachers',
      board: '/api/board/pending-teachers, /api/board/review-teacher/:id',
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
  ║  📝 API ready for requests                                         ║
  ╠═══════════════════════════════════════════════════════════════════╣
  ║  🎯 My Purpose: To digitize Ethiopian education by providing      ║
  ║     a complete school management system with student registration,║
  ║     timed exams, ID cards, fee payments, financial management,    ║
  ║     teacher applications, and board oversight - all in one place. ║
  ╠═══════════════════════════════════════════════════════════════════╣
  ║  🔐 Default Login Credentials:                                     ║
  ║  👨‍🎓 Student: ET999999 / student123                                 ║
  ║  👨‍🏫 Teacher: teacher@hermana.edu / teacher123                      ║
  ║  📊 Director: director@hermana.edu / director123                   ║
  ║  🎯 Board: board@hermana.edu / board123                            ║
  ║  💰 Finance: finance@hermana.edu / finance123                      ║
  ╚═══════════════════════════════════════════════════════════════════╝
  `);
});

module.exports = { app, db };
