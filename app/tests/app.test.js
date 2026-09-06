const request = require('supertest');
const app = require('../src/app');

describe('Unauthenticated access', () => {
  it('redirects GET / to /login', async () => {
    const res = await request(app).get('/');
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe('/login');
  });

  it('serves the login page at /login', async () => {
    const res = await request(app).get('/login');
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toMatch(/html/);
  });

  it('redirects GET /dashboard to /login when not authenticated', async () => {
    const res = await request(app).get('/dashboard');
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe('/login');
  });

  it('blocks GET /api/tasks with 401 when not authenticated', async () => {
    const res = await request(app).get('/api/tasks');
    expect(res.statusCode).toBe(401);
  });

  it('GET /api/me reports authenticated: false', async () => {
    const res = await request(app).get('/api/me');
    expect(res.statusCode).toBe(200);
    expect(res.body.authenticated).toBe(false);
  });
});

describe('Login', () => {
  it('rejects invalid credentials with 401', async () => {
    const res = await request(app)
      .post('/api/login')
      .send({ username: 'admin', password: 'wrongpassword' });
    expect(res.statusCode).toBe(401);
  });

  it('accepts valid credentials and returns success', async () => {
    const res = await request(app)
      .post('/api/login')
      .send({ username: 'admin', password: 'admin123' });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.username).toBe('admin');
  });
});

describe('Health and info (always public)', () => {
  it('GET /health returns UP', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('UP');
  });

  it('GET /api/info returns service info', async () => {
    const res = await request(app).get('/api/info');
    expect(res.statusCode).toBe(200);
    expect(res.body.service).toBe('devops-demo-app');
  });
});

describe('Authenticated session (full CRUD flow)', () => {
  const agent = request.agent(app); // persists the session cookie across requests

  beforeAll(async () => {
    await agent.post('/api/login').send({ username: 'admin', password: 'admin123' });
  });

  it('GET /api/me reports authenticated: true after login', async () => {
    const res = await agent.get('/api/me');
    expect(res.body.authenticated).toBe(true);
    expect(res.body.username).toBe('admin');
  });

  it('serves the dashboard page once logged in', async () => {
    const res = await agent.get('/dashboard');
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toMatch(/html/);
  });

  it('redirects /login to /dashboard once already logged in', async () => {
    const res = await agent.get('/login');
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe('/dashboard');
  });

  it('lists the seeded tasks', async () => {
    const res = await agent.get('/api/tasks');
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(3);
  });

  it('gets a single task by id', async () => {
    const res = await agent.get('/api/tasks/1');
    expect(res.statusCode).toBe(200);
    expect(res.body.id).toBe(1);
  });

  it('returns 404 for a task id that does not exist', async () => {
    const res = await agent.get('/api/tasks/9999');
    expect(res.statusCode).toBe(404);
  });

  let createdId;

  it('creates a new task (CREATE)', async () => {
    const res = await agent.post('/api/tasks').send({ title: 'Write CRUD tests' });
    expect(res.statusCode).toBe(201);
    expect(res.body.title).toBe('Write CRUD tests');
    expect(res.body.done).toBe(false);
    createdId = res.body.id;
  });

  it('rejects creating a task with no title', async () => {
    const res = await agent.post('/api/tasks').send({});
    expect(res.statusCode).toBe(400);
  });

  it('updates a task title (UPDATE)', async () => {
    const res = await agent.put(`/api/tasks/${createdId}`).send({ title: 'Write CRUD tests (updated)' });
    expect(res.statusCode).toBe(200);
    expect(res.body.title).toBe('Write CRUD tests (updated)');
  });

  it('toggles a task done status (UPDATE)', async () => {
    const res = await agent.put(`/api/tasks/${createdId}`).send({ done: true });
    expect(res.statusCode).toBe(200);
    expect(res.body.done).toBe(true);
  });

  it('rejects updating with an invalid title', async () => {
    const res = await agent.put(`/api/tasks/${createdId}`).send({ title: '   ' });
    expect(res.statusCode).toBe(400);
  });

  it('rejects updating with an invalid done value', async () => {
    const res = await agent.put(`/api/tasks/${createdId}`).send({ done: 'yes' });
    expect(res.statusCode).toBe(400);
  });

  it('returns 404 updating a task that does not exist', async () => {
    const res = await agent.put('/api/tasks/9999').send({ title: 'nope' });
    expect(res.statusCode).toBe(404);
  });

  it('deletes a task (DELETE)', async () => {
    const res = await agent.delete(`/api/tasks/${createdId}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.id).toBe(createdId);
  });

  it('returns 404 deleting a task that no longer exists', async () => {
    const res = await agent.delete(`/api/tasks/${createdId}`);
    expect(res.statusCode).toBe(404);
  });

  it('logs out and blocks further API access', async () => {
    const logoutRes = await agent.post('/api/logout');
    expect(logoutRes.statusCode).toBe(200);

    const res = await agent.get('/api/tasks');
    expect(res.statusCode).toBe(401);
  });
});

describe('Unknown route', () => {
  it('returns 404 for undefined routes', async () => {
    const res = await request(app).get('/nope');
    expect(res.statusCode).toBe(404);
  });
});
