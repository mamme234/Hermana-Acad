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
  // Users table (students, directors, teachers, parents)
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fullName TEXT NOT NULL,
      email TEXT UNIQUE,
      ethiopianId TEXT UNIQUE,
      idPhotoUrl TEXT,
      password TEXT,
      role TEXT CHECK(role IN ('student', 'director', 'teacher', 'parent', 'board')) DEFAULT 'student',
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
      registrationDate DATETIME DEFAULT CURRENT_TIMESTAMP,
      isActive BOOLEAN DEFAULT 1
    )
  `);

  // Payments table
  db.run(`
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      studentId INTEGER NOT NULL,
      paymentType TEXT CHECK(paymentType IN ('registration', 'term1Bus', 'term2Bus', 'term3Bus')),
      amount INTEGER NOT NULL,
      transactionId TEXT UNIQUE NOT NULL,
      status TEXT DEFAULT 'completed',
      paymentDate DATETIME DEFAULT CURRENT_TIMESTAMP,
      receipt TEXT,
      FOREIGN KEY (studentId) REFERENCES users(id)
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
      type TEXT CHECK(type IN ('alert', 'info', 'event', 'ban', 'announcement')),
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

  // Insert default director if not exists
  db.get("SELECT * FROM users WHERE role = 'director'", (err, row) => {
    if (!row && !err) {
      const hashedPassword = bcrypt.hashSync('director123', 10);
      db.run(`
        INSERT INTO users (fullName, email, password, role, isActive)
        VALUES (?, ?, ?, ?, ?)
      `, ['Dr. Alemu Bekele', 'director@hermana.edu', hashedPassword, 'director', 1]);
      console.log('✅ Default director created: director@hermana.edu / director123');
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
      console.log('✅ Default board member created: board@hermana.edu / board123');
    }
  });

  // Insert default teacher for demo
  db.get("SELECT * FROM users WHERE role = 'teacher' AND email = 'teacher@hermana.edu'", (err, row) => {
    if (!row && !err) {
      const hashedPassword = bcrypt.hashSync('teacher123', 10);
      db.run(`
        INSERT INTO users (fullName, email, password, role, phone, teacherStatus, isActive)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, ['Demo Teacher', 'teacher@hermana.edu', hashedPassword, 'teacher', '+251-911-000000', 'approved', 1]);
      console.log('✅ Demo teacher created: teacher@hermana.edu / teacher123');
    }
  });

  // Insert sample updates
  db.get("SELECT * FROM updates LIMIT 1", (err, row) => {
    if (!row && !err) {
      const sampleUpdates = [
        { title: '🚨 Student Conduct Notice', description: 'John Demissie has been banned for 3 days due to bullying incident. Parents please discuss school rules with your children.', type: 'ban' },
        { title: '📢 Mid-Term Examination Schedule', description: 'Mid-term exams will begin on April 5th. All students must prepare well. Exam timetable has been posted.', type: 'info' },
        { title: '🎓 Parent-Teacher Conference', description: 'Parent-Teacher meeting will be held on March 30th at 9:00 AM in the main auditorium. All parents are encouraged to attend.', type: 'event' },
        { title: '🏆 Academic Excellence Award', description: 'Congratulations to students who scored above 90% in the preliminary exams! Award ceremony on Friday.', type: 'announcement' }
      ];
      sampleUpdates.forEach(update => {
        db.run(`INSERT INTO updates (title, description, type) VALUES (?, ?, ?)`,
          [update.title, update.description, update.type]);
      });
      console.log('✅ Sample updates created');
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
      { id: 2, text: "የኢትዮጵያ ዋና ከተማ ማንነው?", options: ["ጎንደር", "አዲስ አበባ", "ሀዋሳ", "ባህርዳር"], correct: 1 },
      { id: 3, text: "5 × 3 = ?", options: ["12", "15", "18", "20"], correct: 1 },
      { id: 4, text: "Which animal is known as 'King of the Jungle'?", options: ["Elephant", "Tiger", "Lion", "Giraffe"], correct: 2 },
      { id: 5, text: "What color are bananas when ripe?", options: ["Red", "Green", "Yellow", "Blue"], correct: 2 }
    ];
  } else if (gradeNum <= 8) {
    return [
      { id: 1, text: "144 ÷ 12 = ?", options: ["10", "12", "14", "16"], correct: 1 },
      { id: 2, text: "Capital of Ethiopia?", options: ["Adama", "Addis Ababa", "Harar", "Jimma"], correct: 1 },
      { id: 3, text: "60 km/h for 2.5 hours = ? km", options: ["120", "150", "180", "100"], correct: 1 },
      { id: 4, text: "በኢትዮጵያ ውስጥ ትልቁ ወንዝ?", options: ["አዋሽ", "አባይ", "ተከዜ", "ጊቤ"], correct: 1 },
      { id: 5, text: "What is 25% of 200?", options: ["25", "50", "75", "100"], correct: 1 }
    ];
  } else {
    return [
      { id: 1, text: "Solve: 3x - 7 = 11, x = ?", options: ["4", "5", "6", "7"], correct: 2 },
      { id: 2, text: "Which Ethiopian region is known for coffee origin?", options: ["Tigray", "Amhara", "Oromia (Kaffa)", "Somali"], correct: 2 },
      { id: 3, text: "Oxygen atomic number?", options: ["6", "7", "8", "9"], correct: 2 },
      { id: 4, text: "Who wrote 'Fikir Eske Mekabir'?", options: ["Baalu Girma", "Haddis Alemayehu", "Tsegaye Gabre-Medhin", "Mengistu Lemma"], correct: 1 },
      { id: 5, text: "What is √169?", options: ["11", "12", "13", "14"], correct: 2 },
      { id: 6, text: "If a train covers 240 km in 4 hours, speed?", options: ["40 km/h", "50 km/h", "60 km/h", "70 km/h"], correct: 2 }
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
    
    // Check if Ethiopian ID already exists
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
    
    // Check if email already exists
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

// Submit exam answers with timer and violations
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

// Make payment
app.post('/api/payment', authenticate, (req, res) => {
  const { studentId, paymentType } = req.body;
  
  if (!paymentPrices[paymentType]) {
    return res.status(400).json({ error: 'Invalid payment type' });
  }
  
  const amount = paymentPrices[paymentType];
  const transactionId = 'HMTX-' + uuidv4().substr(0, 8).toUpperCase() + '-' + Date.now();
  
  // Check if payment already exists
  db.get(`
    SELECT id FROM payments WHERE studentId = ? AND paymentType = ?
  `, [studentId, paymentType], (err, existing) => {
    if (existing) {
      return res.status(400).json({ error: 'Payment already made for this type' });
    }
    
    db.run(`
      INSERT INTO payments (studentId, paymentType, amount, transactionId, status)
      VALUES (?, ?, ?, ?, 'completed')
    `, [studentId, paymentType, amount, transactionId], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      
      const receipt = {
        receiptId: this.lastID,
        studentId: studentId,
        paymentType: paymentType,
        amount: amount,
        transactionId: transactionId,
        date: new Date().toISOString(),
        academy: "Hermana Academy"
      };
      
      res.json({ 
        success: true, 
        receipt, 
        message: `Payment of ${amount} ETB successful!`
      });
    });
  });
});

// Get student payment status
app.get('/api/payments/student/:studentId', authenticate, (req, res) => {
  const studentId = req.params.studentId;
  
  db.all(`
    SELECT paymentType, amount, transactionId, paymentDate 
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
      paymentStatus[payment.paymentType] = true;
    });
    
    res.json({ payments, paymentStatus });
  });
});

// Get receipt by transaction ID
app.get('/api/receipt/:transactionId', authenticate, (req, res) => {
  const transactionId = req.params.transactionId;
  
  db.get(`
    SELECT p.*, u.fullName, u.ethiopianId, u.grade, u.studentIdNumber
    FROM payments p
    JOIN users u ON p.studentId = u.id
    WHERE p.transactionId = ?
  `, [transactionId], (err, receipt) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!receipt) return res.status(404).json({ error: 'Receipt not found' });
    res.json(receipt);
  });
});

// ==================== TEACHER ROUTES ====================

// Get teacher profile
app.get('/api/teachers/:id', authenticate, (req, res) => {
  const teacherId = req.params.id;
  
  db.get(`
    SELECT id, fullName, email, phone, teachingGrades, applicationReason, teacherStatus, registrationDate
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

// Get all students (director only)
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
    
    // Get payment status for each student
    const promises = students.map(student => {
      return new Promise((resolve) => {
        db.all("SELECT paymentType FROM payments WHERE studentId = ?", [student.id], (err, payments) => {
          const paymentStatus = {
            registration: false, term1Bus: false, term2Bus: false, term3Bus: false
          };
          payments.forEach(p => { paymentStatus[p.paymentType] = true; });
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

// Get students grouped by grade
app.get('/api/director/students/by-grade', authenticate, authorize('director'), (req, res) => {
  db.all(`
    SELECT grade, COUNT(*) as count, 
           SUM(CASE WHEN examPercent >= 70 THEN 1 ELSE 0 END) as passedExam,
           SUM(CASE WHEN examCompleted = 1 THEN 1 ELSE 0 END) as completedExam
    FROM users WHERE role = 'student' 
    GROUP BY grade
  `, (err, grades) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(grades);
  });
});

// Get all teachers for director
app.get('/api/director/teachers', authenticate, authorize('director'), (req, res) => {
  db.all(`
    SELECT id, fullName, email, phone, teachingGrades, teacherStatus, registrationDate
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

// Get all pending teacher applications (board only)
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

// Review teacher application (approve/reject)
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

// Get all students for board
app.get('/api/board/students', authenticate, authorize('board'), (req, res) => {
  db.all(`
    SELECT id, fullName, ethiopianId, grade, examPercent, studentIdNumber, registrationDate
    FROM users WHERE role = 'student'
  `, (err, students) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(students);
  });
});

// Get all teachers for board
app.get('/api/board/teachers', authenticate, authorize('board'), (req, res) => {
  db.all(`
    SELECT id, fullName, email, phone, teachingGrades, teacherStatus, registrationDate
    FROM users WHERE role = 'teacher'
  `, (err, teachers) => {
    if (err) return res.status(500).json({ error: err.message });
    teachers.forEach(t => {
      if (t.teachingGrades) t.teachingGrades = JSON.parse(t.teachingGrades);
    });
    res.json(teachers);
  });
});

// Get payment statistics for board
app.get('/api/board/statistics', authenticate, authorize('board'), (req, res) => {
  db.get("SELECT COUNT(*) as totalStudents FROM users WHERE role = 'student'", (err, studentCount) => {
    db.get("SELECT COUNT(*) as totalTeachers FROM users WHERE role = 'teacher'", (err, teacherCount) => {
      db.get("SELECT SUM(amount) as totalFees FROM payments", (err, fees) => {
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

// Get school updates for parents
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

// Get student by ID for parent
app.get('/api/parent/student/:id', authenticate, (req, res) => {
  const studentId = req.params.id;
  
  db.get(`
    SELECT id, fullName, ethiopianId, grade, examPercent, studentIdNumber, fromGrade, toGrade
    FROM users WHERE id = ? AND role = 'student'
  `, [studentId], (err, student) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!student) return res.status(404).json({ error: 'Student not found' });
    
    db.all("SELECT paymentType, amount, paymentDate FROM payments WHERE studentId = ?", [studentId], (err, payments) => {
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

// Get all feedback (director/board only)
app.get('/api/feedback', authenticate, authorize('director', 'board'), (req, res) => {
  db.all(`
    SELECT * FROM feedback ORDER BY createdAt DESC
  `, (err, feedback) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(feedback);
  });
});

// ==================== UPDATES ROUTES ====================

// Create school update (director only)
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
    endpoints: {
      auth: '/api/auth/register, /api/auth/login',
      exam: '/api/exam/:studentId, /api/exam/submit',
      payment: '/api/payment, /api/payments/student/:studentId',
      director: '/api/director/students, /api/director/students/by-grade',
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
  ╠═══════════════════════════════════════════════════════════════════╣
  ║  📍 Server running on: http://localhost:${PORT}                     ║
  ║  ✅ Status: Online                                                 ║
  ║  📝 API ready for requests                                         ║
  ╠═══════════════════════════════════════════════════════════════════╣
  ║  🔐 Default Login Credentials:                                     ║
  ║  👨‍🎓 Student: ET999999 / student123                                 ║
  ║  👨‍🏫 Teacher: teacher@hermana.edu / teacher123                      ║
  ║  📊 Director: director@hermana.edu / director123                   ║
  ║  🎯 Board: board@hermana.edu / board123                            ║
  ╚═══════════════════════════════════════════════════════════════════╝
  `);
});

module.exports = { app, db };
