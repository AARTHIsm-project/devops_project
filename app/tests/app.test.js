const request = require('supertest');
const app = require('../src/app');

describe('GET /', () => {
  it('returns service info with 200', async () => {
    const res = await request(app).get('/');
    expect(res.statusCode).toBe(200);
    expect(res.body.service).toBe('devops-demo-app');
  });
});

describe('GET /health', () => {
  it('returns UP status for health checks', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('UP');
  });
});

describe('GET /api/tasks', () => {
  it('returns the seeded list of tasks', async () => {
    const res = await request(app).get('/api/tasks');
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(3);
  });
});

describe('GET /api/tasks/:id', () => {
  it('returns a single task when it exists', async () => {
    const res = await request(app).get('/api/tasks/1');
    expect(res.statusCode).toBe(200);
    expect(res.body.id).toBe(1);
  });

  it('returns 404 when the task does not exist', async () => {
    const res = await request(app).get('/api/tasks/999');
    expect(res.statusCode).toBe(404);
  });
});

describe('POST /api/tasks', () => {
  it('creates a new task with valid input', async () => {
    const res = await request(app).post('/api/tasks').send({ title: 'Add monitoring' });
    expect(res.statusCode).toBe(201);
    expect(res.body.title).toBe('Add monitoring');
    expect(res.body.done).toBe(false);
  });

  it('rejects a request with no title', async () => {
    const res = await request(app).post('/api/tasks').send({});
    expect(res.statusCode).toBe(400);
  });
});

describe('Unknown route', () => {
  it('returns 404 for undefined routes', async () => {
    const res = await request(app).get('/nope');
    expect(res.statusCode).toBe(404);
  });
});
