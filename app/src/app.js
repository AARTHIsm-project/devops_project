const express = require('express');
const path = require('path');
const session = require('express-session');

const app = express();
app.use(express.json());

app.use(session({
  secret: process.env.SESSION_SECRET || 'devops-demo-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 } // 1 hour
}));

// Serve CSS/JS assets, but don't auto-serve index.html — auth routes control pages
app.use(express.static(path.join(__dirname, '..', 'public'), { index: false }));

// ---- In-memory "database" (resets whenever the server restarts) ----
let tasks = [
  { id: 1, title: 'Set up Jenkins', done: true },
  { id: 2, title: 'Write Dockerfile', done: true },
  { id: 3, title: 'Wire up CI/CD pipeline', done: false }
];
let nextTaskId = 4;

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
    service: 'devops-demo-app',
    message: 'Jenkins + Docker + GitHub CI/CD demo is running',
    version: process.env.APP_VERSION || 'dev'
  });
});

// Used by Docker HEALTHCHECK and load balancers / k8s probes — intentionally not auth-protected
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'UP' });
});

// ---- Task CRUD API (all protected — must be logged in) ----
app.get('/api/tasks', requireApiAuth, (req, res) => {
  res.status(200).json(tasks);
});

app.get('/api/tasks/:id', requireApiAuth, (req, res) => {
  const task = tasks.find((t) => t.id === parseInt(req.params.id, 10));
  if (!task) return res.status(404).json({ error: 'Task not found' });
  res.status(200).json(task);
});

app.post('/api/tasks', requireApiAuth, (req, res) => {
  const { title } = req.body || {};
  if (!title || typeof title !== 'string') {
    return res.status(400).json({ error: 'title is required and must be a string' });
  }
  const newTask = { id: nextTaskId++, title, done: false };
  tasks.push(newTask);
  res.status(201).json(newTask);
});

app.put('/api/tasks/:id', requireApiAuth, (req, res) => {
  const task = tasks.find((t) => t.id === parseInt(req.params.id, 10));
  if (!task) return res.status(404).json({ error: 'Task not found' });

  const { title, done } = req.body || {};

  if (title !== undefined) {
    if (typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ error: 'title must be a non-empty string' });
    }
    task.title = title;
  }

  if (done !== undefined) {
    if (typeof done !== 'boolean') {
      return res.status(400).json({ error: 'done must be a boolean' });
    }
    task.done = done;
  }

  res.status(200).json(task);
});

app.delete('/api/tasks/:id', requireApiAuth, (req, res) => {
  const index = tasks.findIndex((t) => t.id === parseInt(req.params.id, 10));
  if (index === -1) return res.status(404).json({ error: 'Task not found' });
  const [deleted] = tasks.splice(index, 1);
  res.status(200).json(deleted);
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

module.exports = app;
