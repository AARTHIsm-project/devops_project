const express = require('express');
const path = require('path');
const session = require('express-session');

const app = express();
app.use(express.json());

app.use(session({
  secret: process.env.SESSION_SECRET || 'student-mgmt-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 } // 1 hour
}));

// Serve CSS/JS assets, but don't auto-serve index.html — auth routes control pages
app.use(express.static(path.join(__dirname, '..', 'public'), { index: false }));

// ---- In-memory "database" (resets whenever the server restarts) ----
let students = [
  { id: 1, name: 'Aarthi S', rollNumber: 'R001', className: '10th A', email: 'aarthi.s@example.com', phone: '9876543210', marks: 92, status: 'active' },
  { id: 2, name: 'Karthik R', rollNumber: 'R002', className: '10th A', email: 'karthik.r@example.com', phone: '9876543211', marks: 78, status: 'active' },
  { id: 3, name: 'Divya M', rollNumber: 'R003', className: '10th B', email: 'divya.m@example.com', phone: '9876543212', marks: 85, status: 'active' },
  { id: 4, name: 'Suresh K', rollNumber: 'R004', className: '10th B', email: 'suresh.k@example.com', phone: '9876543213', marks: 64, status: 'inactive' }
];
let nextStudentId = 5;

// In-memory user store (demo only — plaintext password, not for production use)
const users = [
  { username: 'admin', password: 'admin123' }
];

function requireApiAuth(req, res, next) {
  if (req.session && req.session.user) return next();
  return res.status(401).json({ error: 'Not authenticated' });
}

function requirePageAuth(req, res, next) {
  if (req.session && req.session.user) return next();
  return res.redirect('/login');
}

function validateStudentInput(body, { partial = false } = {}) {
  const errors = [];
  const { name, rollNumber, className, email, phone, marks, status } = body || {};

  if (!partial || name !== undefined) {
    if (!name || typeof name !== 'string' || !name.trim()) errors.push('name is required');
  }
  if (!partial || rollNumber !== undefined) {
    if (!rollNumber || typeof rollNumber !== 'string' || !rollNumber.trim()) errors.push('rollNumber is required');
  }
  if (!partial || className !== undefined) {
    if (!className || typeof className !== 'string' || !className.trim()) errors.push('className is required');
  }
  if (email !== undefined && email !== '' && !/^\S+@\S+\.\S+$/.test(email)) {
    errors.push('email must be a valid email address');
  }
  if (marks !== undefined && marks !== '' && marks !== null) {
    const n = Number(marks);
    if (Number.isNaN(n) || n < 0 || n > 100) errors.push('marks must be a number between 0 and 100');
  }
  if (status !== undefined && !['active', 'inactive'].includes(status)) {
    errors.push('status must be "active" or "inactive"');
  }
  return errors;
}

// ---- Pages ----
app.get('/', (req, res) => {
  if (req.session && req.session.user) return res.redirect('/dashboard');
  return res.redirect('/login');
});

app.get('/login', (req, res) => {
  if (req.session && req.session.user) return res.redirect('/dashboard');
  res.sendFile(path.join(__dirname, '..', 'public', 'login.html'));
});

app.get('/dashboard', requirePageAuth, (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'dashboard.html'));
});

// ---- Auth API ----
app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  const user = users.find((u) => u.username === username && u.password === password);
  if (!user) return res.status(401).json({ error: 'Invalid username or password' });
  req.session.user = { username: user.username };
  res.status(200).json({ success: true, username: user.username });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => {
    res.status(200).json({ success: true });
  });
});

app.get('/api/me', (req, res) => {
  if (req.session && req.session.user) {
    return res.status(200).json({ authenticated: true, username: req.session.user.username });
  }
  res.status(200).json({ authenticated: false });
});

// ---- Misc ----
app.get('/api/info', (req, res) => {
  res.json({
    service: 'student-management-system',
    message: 'Student Management System — Jenkins + Docker + GitHub CI/CD demo',
    version: process.env.APP_VERSION || 'dev'
  });
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'UP' });
});

// ---- Dashboard stats (protected) ----
app.get('/api/stats', requireApiAuth, (req, res) => {
  const total = students.length;
  const active = students.filter((s) => s.status === 'active').length;
  const inactive = total - active;
  const avgMarks = total
    ? Math.round((students.reduce((sum, s) => sum + (Number(s.marks) || 0), 0) / total) * 10) / 10
    : 0;
  const classCounts = students.reduce((acc, s) => {
    acc[s.className] = (acc[s.className] || 0) + 1;
    return acc;
  }, {});

  res.status(200).json({
    totalStudents: total,
    activeStudents: active,
    inactiveStudents: inactive,
    averageMarks: avgMarks,
    classCounts
  });
});

// ---- Student CRUD API (all protected — must be logged in) ----
app.get('/api/students', requireApiAuth, (req, res) => {
  const { search, className, status } = req.query;
  let result = students;

  if (search) {
    const q = String(search).toLowerCase();
    result = result.filter(
      (s) => s.name.toLowerCase().includes(q) || s.rollNumber.toLowerCase().includes(q)
    );
  }
  if (className) {
    result = result.filter((s) => s.className === className);
  }
  if (status) {
    result = result.filter((s) => s.status === status);
  }

  res.status(200).json(result);
});

app.get('/api/students/:id', requireApiAuth, (req, res) => {
  const student = students.find((s) => s.id === parseInt(req.params.id, 10));
  if (!student) return res.status(404).json({ error: 'Student not found' });
  res.status(200).json(student);
});

app.post('/api/students', requireApiAuth, (req, res) => {
  const errors = validateStudentInput(req.body);
  if (errors.length) return res.status(400).json({ error: errors.join(', ') });

  const { name, rollNumber, className, email, phone, marks, status } = req.body;

  const duplicateRoll = students.some((s) => s.rollNumber === rollNumber);
  if (duplicateRoll) return res.status(409).json({ error: 'rollNumber already exists' });

  const newStudent = {
    id: nextStudentId++,
    name: name.trim(),
    rollNumber: rollNumber.trim(),
    className: className.trim(),
    email: email ? email.trim() : '',
    phone: phone ? phone.trim() : '',
    marks: marks !== undefined && marks !== '' ? Number(marks) : 0,
    status: status || 'active'
  };
  students.push(newStudent);
  res.status(201).json(newStudent);
});

app.put('/api/students/:id', requireApiAuth, (req, res) => {
  const student = students.find((s) => s.id === parseInt(req.params.id, 10));
  if (!student) return res.status(404).json({ error: 'Student not found' });

  const errors = validateStudentInput(req.body, { partial: true });
  if (errors.length) return res.status(400).json({ error: errors.join(', ') });

  const { name, rollNumber, className, email, phone, marks, status } = req.body;

  if (rollNumber !== undefined) {
    const duplicateRoll = students.some((s) => s.rollNumber === rollNumber && s.id !== student.id);
    if (duplicateRoll) return res.status(409).json({ error: 'rollNumber already exists' });
    student.rollNumber = rollNumber.trim();
  }
  if (name !== undefined) student.name = name.trim();
  if (className !== undefined) student.className = className.trim();
  if (email !== undefined) student.email = email.trim();
  if (phone !== undefined) student.phone = phone.trim();
  if (marks !== undefined) student.marks = Number(marks);
  if (status !== undefined) student.status = status;

  res.status(200).json(student);
});

app.delete('/api/students/:id', requireApiAuth, (req, res) => {
  const index = students.findIndex((s) => s.id === parseInt(req.params.id, 10));
  if (index === -1) return res.status(404).json({ error: 'Student not found' });
  const [deleted] = students.splice(index, 1);
  res.status(200).json(deleted);
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

module.exports = app;
