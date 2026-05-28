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
      role TEXT CHECK(role IN ('student', 'director', 'parent')) DEFAULT 'student',
      grade TEXT,
      examScore INTEGER DEFAULT 0,
      examPercent INTEGER DEFAULT 0,
      registrationDate DATETIME DEFAULT CURRENT_TIMESTAMP,
      isActive BOOLEAN DEFAULT 1
    )
  `);

  // Payments table
  db.run(`
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      studentId INTEGER NOT NULL,
      paymentType TEXT CHECK(paymentType IN ('registration', 'term1', 'term2', 'term3', 'bus', 'activity', 'library', 'sports', 'exam')),
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

  // Parents table (linking parents to students)
  db.run(`
    CREATE TABLE IF NOT EXISTS parent_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      parentId INTEGER NOT NULL,
      studentId INTEGER NOT NULL,
      relationship TEXT,
      FOREIGN KEY (parentId) REFERENCES users(id),
      FOREIGN KEY (studentId) REFERENCES users(id)
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
  const gradeNum = parseInt(grade.replace(/\D/g, '')) || 5;
  
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
    const { fullName, ethiopianId, grade, password, email } = req.body;
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
        INSERT INTO users (fullName, email, ethiopianId, idPhotoUrl, password, grade, role)
        VALUES (?, ?, ?, ?, ?, ?, 'student')
      `, [fullName, email || null, ethiopianId, idPhotoUrl, hashedPassword, grade], function(err) {
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
      { expiresIn: process.env.JWT_EXPIRE || '7d' }
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
  const { studentId, answers } = req.body;
  
  db.get("SELECT grade FROM users WHERE id = ?", [studentId], (err, student) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!student) return res.status(404).json({ error: 'Student not found' });
    
    const questions = generateExamQuestions(student.grade);
    let correct = 0;
    
    answers.forEach((answer, index) => {
      if (answer === questions[index].correct) correct++;
    });
    
    const percentage = Math.round((correct / questions.length) * 100);
    
    db.run(`
      UPDATE users SET examScore = ?, examPercent = ? WHERE id = ?
    `, [correct, percentage, studentId], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      
      db.run(`
        INSERT INTO exams (studentId, grade, questions, answers, score, percentage)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [studentId, student.grade, JSON.stringify(questions), JSON.stringify(answers), correct, percentage]);
      
      res.json({ 
        score: correct, 
        total: questions.length, 
        percentage,
        message: percentage >= 50 ? 'You passed the exam!' : 'Please study more and retake the exam.'
      });
    });
  });
});

// ==================== STUDENT ROUTES ====================

// Get student profile
app.get('/api/students/:id', authenticate, (req, res) => {
  const studentId = req.params.id;
  
  db.get(`
    SELECT id, fullName, ethiopianId, idPhotoUrl, grade, examScore, examPercent, registrationDate
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
  term1: 2500,
  term2: 2500,
  term3: 2500,
  bus: 1000,
  activity: 500,
  library: 300,
  sports: 400,
  exam: 200
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
      term1: false,
      term2: false,
      term3: false,
      bus: false,
      activity: false,
      library: false,
      sports: false,
      exam: false
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
    SELECT p.*, u.fullName, u.ethiopianId, u.grade
    FROM payments p
    JOIN users u ON p.studentId = u.id
    WHERE p.transactionId = ?
  `, [transactionId], (err, receipt) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!receipt) return res.status(404).json({ error: 'Receipt not found' });
    res.json(receipt);
  });
});

// ==================== DIRECTOR ROUTES ====================

// Get all students (director only)
app.get('/api/director/students', authenticate, authorize('director'), (req, res) => {
  const { grade, paymentStatus } = req.query;
  
  let query = `SELECT id, fullName, ethiopianId, grade, examPercent, registrationDate FROM users WHERE role = 'student'`;
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
          const paymentStatusMap = {
            registration: false, term1: false, term2: false, term3: false,
            bus: false, activity: false, library: false, sports: false
          };
          payments.forEach(p => { paymentStatusMap[p.paymentType] = true; });
          student.paymentStatus = paymentStatusMap;
          
          const requiredPayments = ['registration', 'term1', 'bus'];
          const hasUnpaid = requiredPayments.some(p => !paymentStatusMap[p]);
          student.hasUnpaid = hasUnpaid;
          resolve(student);
        });
      });
    });
    
    Promise.all(promises).then(results => {
      if (paymentStatus === 'paid') {
        results = results.filter(s => !s.hasUnpaid);
      } else if (paymentStatus === 'unpaid') {
        results = results.filter(s => s.hasUnpaid);
      }
      res.json(results);
    });
  });
});

// Get students grouped by grade
app.get('/api/director/students/by-grade', authenticate, authorize('director'), (req, res) => {
  db.all(`
    SELECT grade, COUNT(*) as count, 
           SUM(CASE WHEN examPercent >= 70 THEN 1 ELSE 0 END) as passedExam
    FROM users WHERE role = 'student' 
    GROUP BY grade
  `, (err, grades) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(grades);
  });
});

// Create school update
app.post('/api/director/updates', authenticate, authorize('director'), (req, res) => {
  const { title, description, type } = req.body;
  
  if (!title || !description) {
    return res.status(400).json({ error: 'Title and description are required' });
  }
  
  db.run(`
    INSERT INTO updates (title, description, type, createdBy)
    VALUES (?, ?, ?, ?)
  `, [title, description, type || 'announcement', req.user.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ 
      message: 'Update posted successfully!', 
      updateId: this.lastID 
    });
  });
});

// Get all updates (director)
app.get('/api/director/updates', authenticate, authorize('director'), (req, res) => {
  db.all(`
    SELECT u.*, u2.fullName as creatorName
    FROM updates u
    LEFT JOIN users u2 ON u.createdBy = u2.id
    ORDER BY u.createdAt DESC
  `, (err, updates) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(updates);
  });
});

// Delete update
app.delete('/api/director/updates/:id', authenticate, authorize('director'), (req, res) => {
  db.run("DELETE FROM updates WHERE id = ?", [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Update deleted successfully' });
  });
});

// Get payment statistics
app.get('/api/director/statistics/payments', authenticate, authorize('director'), (req, res) => {
  db.all(`
    SELECT paymentType, COUNT(*) as count, SUM(amount) as totalAmount
    FROM payments
    GROUP BY paymentType
  `, (err, stats) => {
    if (err) return res.status(500).json({ error: err.message });
    
    db.get("SELECT COUNT(*) as totalStudents FROM users WHERE role = 'student'", (err, studentCount) => {
      res.json({
        paymentStats: stats,
        totalStudents: studentCount?.totalStudents || 0
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

// Get all students (for parents to view)
app.get('/api/parent/students', authenticate, (req, res) => {
  db.all(`
    SELECT id, fullName, grade, examPercent 
    FROM users 
    WHERE role = 'student'
    ORDER BY grade, fullName
  `, (err, students) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(students);
  });
});

// Get specific student details for parent
app.get('/api/parent/students/:id', authenticate, (req, res) => {
  const studentId = req.params.id;
  
  db.get(`
    SELECT id, fullName, ethiopianId, grade, examPercent, registrationDate
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

// ==================== HEALTH CHECK ====================
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Hermana Academy Backend is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
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
  ╔══════════════════════════════════════════════════╗
  ║     🏫 HERMANA ACADEMY BACKEND                    ║
  ║     📍 Running on: http://localhost:${PORT}        ║
  ║     🎓 API Ready for requests                     ║
  ║     📝 Default Director: director@hermana.edu    ║
  ║     🔑 Password: director123                      ║
  ╚══════════════════════════════════════════════════╝
  `);
});

module.exports = { app, db };
