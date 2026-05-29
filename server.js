const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const sqlite3 = require('sqlite3').verbose();
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

if (!fs.existsSync('./uploads')) fs.mkdirSync('./uploads');

// Database setup
const db = new sqlite3.Database('./hermana.db');

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fullName TEXT NOT NULL,
    email TEXT,
    ethiopianId TEXT UNIQUE,
    idPhotoUrl TEXT,
    password TEXT,
    role TEXT DEFAULT 'student',
    grade TEXT,
    examScore INTEGER DEFAULT 0,
    examPercent INTEGER DEFAULT 0,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    studentId INTEGER,
    paymentType TEXT,
    amount INTEGER,
    transactionId TEXT,
    paymentDate DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS updates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    description TEXT,
    type TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Insert default director
  db.get("SELECT * FROM users WHERE role = 'director'", (err, row) => {
    if (!row) {
      const hashed = bcrypt.hashSync('director123', 10);
      db.run(`INSERT INTO users (fullName, email, password, role) VALUES (?, ?, ?, ?)`,
        ['Dr. Alemu Bekele', 'director@hermana.edu', hashed, 'director']);
    }
  });

  // Insert test student
  db.get("SELECT * FROM users WHERE ethiopianId = 'ET999999'", (err, row) => {
    if (!row) {
      const hashed = bcrypt.hashSync('student123', 10);
      db.run(`INSERT INTO users (fullName, email, ethiopianId, password, grade, role) VALUES (?, ?, ?, ?, ?, ?)`,
        ['Test Student', 'test@hermana.edu', 'ET999999', hashed, 'Grade 10', 'student']);
    }
  });

  // Insert sample updates
  db.get("SELECT * FROM updates LIMIT 1", (err, row) => {
    if (!row) {
      db.run(`INSERT INTO updates (title, description, type) VALUES (?, ?, ?)`,
        ['🚨 Student Conduct Notice', 'John Demissie has been banned for 3 days due to bullying. Parents please discuss school rules.', 'ban']);
      db.run(`INSERT INTO updates (title, description, type) VALUES (?, ?, ?)`,
        ['📢 Mid-Term Exams', 'Mid-term exams start on April 5th. All students must prepare well.', 'info']);
      db.run(`INSERT INTO updates (title, description, type) VALUES (?, ?, ?)`,
        ['🎓 Parent-Teacher Conference', 'Meeting on March 30th at 9:00 AM in the main hall.', 'event']);
    }
  });
});

// Helper: Generate exam questions
function getExamQuestions(grade) {
  const gradeNum = parseInt(grade.match(/\d+/)[0]);
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
}

// Middleware
const auth = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret123');
    req.user = decoded;
    next();
  } catch (e) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// ============= REGISTER =============
const upload = multer({ dest: 'uploads/' });
app.post('/api/auth/register', upload.single('idPhoto'), (req, res) => {
  const { fullName, ethiopianId, grade, password, email } = req.body;
  const idPhotoUrl = req.file ? `/uploads/${req.file.filename}` : null;
  
  db.get("SELECT id FROM users WHERE ethiopianId = ?", [ethiopianId], (err, existing) => {
    if (existing) return res.status(400).json({ error: 'Ethiopian ID already exists!' });
    
    const hashedPassword = bcrypt.hashSync(password || 'default', 10);
    db.run(`INSERT INTO users (fullName, email, ethiopianId, idPhotoUrl, password, grade) VALUES (?,?,?,?,?,?)`,
      [fullName, email, ethiopianId, idPhotoUrl, hashedPassword, grade], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Registration successful! Please login.', studentId: this.lastID });
      });
  });
});

// ============= LOGIN =============
app.post('/api/auth/login', (req, res) => {
  const { identifier, password } = req.body;
  
  db.get(`SELECT * FROM users WHERE email = ? OR ethiopianId = ?`, [identifier, identifier], (err, user) => {
    if (err || !user) return res.status(401).json({ error: 'User not found' });
    
    const valid = bcrypt.compareSync(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Wrong password' });
    
    const token = jwt.sign(
      { id: user.id, role: user.role, name: user.fullName },
      process.env.JWT_SECRET || 'secret123',
      { expiresIn: '7d' }
    );
    
    res.json({ 
      token, 
      user: { 
        id: user.id, 
        name: user.fullName, 
        role: user.role, 
        grade: user.grade,
        examPercent: user.examPercent 
      } 
    });
  });
});

// ============= GET EXAM =============
app.get('/api/exam/:studentId', auth, (req, res) => {
  db.get("SELECT grade FROM users WHERE id = ?", [req.params.studentId], (err, student) => {
    if (!student) return res.status(404).json({ error: 'Student not found' });
    const questions = getExamQuestions(student.grade);
    res.json({ questions });
  });
});

// ============= SUBMIT EXAM =============
app.post('/api/exam/submit', auth, (req, res) => {
  const { studentId, answers } = req.body;
  
  db.get("SELECT grade FROM users WHERE id = ?", [studentId], (err, student) => {
    const questions = getExamQuestions(student.grade);
    let correct = 0;
    answers.forEach((ans, i) => { if (ans === questions[i].correct) correct++; });
    const percent = Math.round((correct / questions.length) * 100);
    
    db.run(`UPDATE users SET examScore = ?, examPercent = ? WHERE id = ?`, [correct, percent, studentId]);
    res.json({ score: correct, total: questions.length, percentage: percent });
  });
});

// ============= GET STUDENT =============
app.get('/api/students/:id', auth, (req, res) => {
  db.get(`SELECT id, fullName, ethiopianId, grade, examPercent FROM users WHERE id = ?`, [req.params.id], (err, student) => {
    res.json(student);
  });
});

// ============= GET PAYMENTS =============
app.get('/api/payments/student/:studentId', auth, (req, res) => {
  db.all(`SELECT paymentType, amount, transactionId FROM payments WHERE studentId = ?`, [req.params.studentId], (err, payments) => {
    const status = { 
      registration: false, 
      term1: false, term1Bus: false,
      term2: false, term2Bus: false,
      term3: false, term3Bus: false,
      bus: false 
    };
    payments.forEach(p => { 
      status[p.paymentType] = true; 
    });
    res.json({ paymentStatus: status });
  });
});

// ============= MAKE PAYMENT (Updated: Term + Bus combined) =============
const PRICES = { 
  registration: 1000,
  term1: 2500, term1Bus: 3500,  // Term1 + Bus = 2500 + 1000
  term2: 2500, term2Bus: 3500,
  term3: 2500, term3Bus: 3500
};

app.post('/api/payment', auth, (req, res) => {
  const { studentId, paymentType } = req.body;
  const amount = PRICES[paymentType];
  
  if (!amount) return res.status(400).json({ error: 'Invalid payment type' });
  
  const transactionId = 'TXN-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6);
  
  // Check if already paid
  db.get(`SELECT id FROM payments WHERE studentId = ? AND paymentType = ?`, [studentId, paymentType], (err, existing) => {
    if (existing) return res.status(400).json({ error: 'Payment already made for this type' });
    
    db.run(`INSERT INTO payments (studentId, paymentType, amount, transactionId) VALUES (?,?,?,?)`,
      [studentId, paymentType, amount, transactionId], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, receipt: { transactionId, amount, paymentType } });
      });
  });
});

// ============= DIRECTOR: GET ALL STUDENTS =============
app.get('/api/director/students', auth, (req, res) => {
  if (req.user.role !== 'director') return res.status(403).json({ error: 'Forbidden' });
  
  db.all(`SELECT id, fullName, ethiopianId, grade, examPercent FROM users WHERE role = 'student'`, (err, students) => {
    const promises = students.map(s => {
      return new Promise((resolve) => {
        db.all(`SELECT paymentType FROM payments WHERE studentId = ?`, [s.id], (err, payments) => {
          const paidTypes = payments.map(p => p.paymentType);
          s.paidRegistration = paidTypes.includes('registration');
          s.paidTerm1 = paidTypes.includes('term1');
          s.paidTerm1Bus = paidTypes.includes('term1Bus');
          s.paidTerm2 = paidTypes.includes('term2');
          s.paidTerm2Bus = paidTypes.includes('term2Bus');
          s.paidTerm3 = paidTypes.includes('term3');
          s.paidTerm3Bus = paidTypes.includes('term3Bus');
          resolve(s);
        });
      });
    });
    Promise.all(promises).then(res.json.bind(res));
  });
});

// ============= DIRECTOR: CREATE UPDATE =============
app.post('/api/director/updates', auth, (req, res) => {
  if (req.user.role !== 'director') return res.status(403).json({ error: 'Forbidden' });
  const { title, description, type } = req.body;
  db.run(`INSERT INTO updates (title, description, type) VALUES (?,?,?)`, [title, description, type || 'alert']);
  res.json({ message: 'Update posted' });
});

// ============= PARENT: GET UPDATES =============
app.get('/api/parent/updates', auth, (req, res) => {
  db.all(`SELECT * FROM updates ORDER BY createdAt DESC`, (err, updates) => {
    res.json(updates || []);
  });
});

// ============= PARENT: GET STUDENTS =============
app.get('/api/parent/students', auth, (req, res) => {
  db.all(`SELECT id, fullName, grade FROM users WHERE role = 'student'`, (err, students) => {
    res.json(students || []);
  });
});

app.listen(PORT, () => {
  console.log(`✅ Hermana Academy Server running on port ${PORT}`);
});
