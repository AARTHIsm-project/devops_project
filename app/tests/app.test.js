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

  it('blocks GET /api/students with 401 when not authenticated', async () => {
    const res = await request(app).get('/api/students');
    expect(res.statusCode).toBe(401);
  });

  it('blocks GET /api/stats with 401 when not authenticated', async () => {
    const res = await request(app).get('/api/stats');
    expect(res.statusCode).toBe(401);
  });
});

describe('Login', () => {
  it('rejects invalid credentials with 401', async () => {
    const res = await request(app).post('/api/login').send({ username: 'admin', password: 'wrong' });
    expect(res.statusCode).toBe(401);
  });

  it('accepts valid credentials', async () => {
    const res = await request(app).post('/api/login').send({ username: 'admin', password: 'admin123' });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
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
    expect(res.body.service).toBe('student-management-system');
  });
});

describe('Authenticated session', () => {
  const agent = request.agent(app);

  beforeAll(async () => {
    await agent.post('/api/login').send({ username: 'admin', password: 'admin123' });
  });

  it('reports authenticated true after login', async () => {
    const res = await agent.get('/api/me');
    expect(res.body.authenticated).toBe(true);
  });

  it('serves the dashboard once logged in', async () => {
    const res = await agent.get('/dashboard');
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toMatch(/html/);
  });

  it('redirects /login to /dashboard once already logged in', async () => {
    const res = await agent.get('/login');
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe('/dashboard');
  });

  describe('Stats', () => {
    it('returns dashboard stats with expected shape', async () => {
      const res = await agent.get('/api/stats');
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('totalStudents');
      expect(res.body).toHaveProperty('activeStudents');
      expect(res.body).toHaveProperty('inactiveStudents');
      expect(res.body).toHaveProperty('averageMarks');
      expect(res.body.totalStudents).toBeGreaterThanOrEqual(4);
    });
  });

  describe('Student listing, search, and filters', () => {
    it('lists the seeded students', async () => {
      const res = await agent.get('/api/students');
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(4);
    });

    it('gets a single student by id', async () => {
      const res = await agent.get('/api/students/1');
      expect(res.statusCode).toBe(200);
      expect(res.body.id).toBe(1);
    });

    it('returns 404 for a student id that does not exist', async () => {
      const res = await agent.get('/api/students/9999');
      expect(res.statusCode).toBe(404);
    });

    it('filters by search term (name)', async () => {
      const res = await agent.get('/api/students?search=Aarthi');
      expect(res.statusCode).toBe(200);
      expect(res.body.every((s) => s.name.toLowerCase().includes('aarthi'))).toBe(true);
    });

    it('filters by status', async () => {
      const res = await agent.get('/api/students?status=inactive');
      expect(res.statusCode).toBe(200);
      expect(res.body.every((s) => s.status === 'inactive')).toBe(true);
    });

    it('filters by className', async () => {
      const res = await agent.get('/api/students?className=10th A');
      expect(res.statusCode).toBe(200);
      expect(res.body.every((s) => s.className === '10th A')).toBe(true);
    });
  });

  describe('Student CRUD', () => {
    let createdId;

    it('creates a new student (CREATE)', async () => {
      const res = await agent.post('/api/students').send({
        name: 'Priya V',
        rollNumber: 'R100',
        className: '9th A',
        email: 'priya.v@example.com',
        phone: '9999999999',
        marks: 88,
        status: 'active'
      });
      expect(res.statusCode).toBe(201);
      expect(res.body.name).toBe('Priya V');
      createdId = res.body.id;
    });

    it('rejects creating a student with missing required fields', async () => {
      const res = await agent.post('/api/students').send({ name: 'No Roll' });
      expect(res.statusCode).toBe(400);
    });

    it('rejects a duplicate rollNumber', async () => {
      const res = await agent.post('/api/students').send({
        name: 'Duplicate Roll',
        rollNumber: 'R100',
        className: '9th A'
      });
      expect(res.statusCode).toBe(409);
    });

    it('rejects invalid marks (out of range)', async () => {
      const res = await agent.post('/api/students').send({
        name: 'Bad Marks',
        rollNumber: 'R101',
        className: '9th A',
        marks: 150
      });
      expect(res.statusCode).toBe(400);
    });

    it('rejects invalid email format', async () => {
      const res = await agent.post('/api/students').send({
        name: 'Bad Email',
        rollNumber: 'R102',
        className: '9th A',
        email: 'not-an-email'
      });
      expect(res.statusCode).toBe(400);
    });

    it('updates a student (UPDATE)', async () => {
      const res = await agent.put(`/api/students/${createdId}`).send({ marks: 95 });
      expect(res.statusCode).toBe(200);
      expect(res.body.marks).toBe(95);
    });

    it('rejects update with invalid status', async () => {
      const res = await agent.put(`/api/students/${createdId}`).send({ status: 'graduated' });
      expect(res.statusCode).toBe(400);
    });

    it('returns 404 updating a student that does not exist', async () => {
      const res = await agent.put('/api/students/9999').send({ marks: 50 });
      expect(res.statusCode).toBe(404);
    });

    it('deletes a student (DELETE)', async () => {
      const res = await agent.delete(`/api/students/${createdId}`);
      expect(res.statusCode).toBe(200);
      expect(res.body.id).toBe(createdId);
    });

    it('returns 404 deleting a student that no longer exists', async () => {
      const res = await agent.delete(`/api/students/${createdId}`);
      expect(res.statusCode).toBe(404);
    });
  });

  it('logs out and blocks further API access', async () => {
    const logoutRes = await agent.post('/api/logout');
    expect(logoutRes.statusCode).toBe(200);

    const res = await agent.get('/api/students');
    expect(res.statusCode).toBe(401);
  });
});

describe('Unknown route', () => {
  it('returns 404 for undefined routes', async () => {
    const res = await request(app).get('/nope');
    expect(res.statusCode).toBe(404);
  });
});
