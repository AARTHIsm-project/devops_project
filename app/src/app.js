const express = require('express');

const app = express();
app.use(express.json());

// In-memory "database" just to give the app something real to do
let tasks = [
  { id: 1, title: 'Set up Jenkins', done: true },
  { id: 2, title: 'Write Dockerfile', done: true },
  { id: 3, title: 'Wire up CI/CD pipeline', done: false }
];

app.get('/', (req, res) => {
  res.json({
    service: 'devops-demo-app',
    message: 'Jenkins + Docker + GitHub CI/CD demo is running',
    version: process.env.APP_VERSION || 'dev'
  });
});

// Used by Docker HEALTHCHECK and by load balancers / k8s probes
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'UP' });
});

app.get('/api/tasks', (req, res) => {
  res.status(200).json(tasks);
});

app.get('/api/tasks/:id', (req, res) => {
  const task = tasks.find((t) => t.id === parseInt(req.params.id, 10));
  if (!task) return res.status(404).json({ error: 'Task not found' });
  res.status(200).json(task);
});

app.post('/api/tasks', (req, res) => {
  const { title } = req.body;
  if (!title || typeof title !== 'string') {
    return res.status(400).json({ error: 'title is required and must be a string' });
  }
  const newTask = { id: tasks.length + 1, title, done: false };
  tasks.push(newTask);
  res.status(201).json(newTask);
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

module.exports = app;
