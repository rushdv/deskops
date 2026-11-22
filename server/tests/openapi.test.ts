import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';

describe('NFR-04 & D-1.4: OpenAPI Documentation & Health Endpoints', () => {
  it('GET /health returns 200 with service status', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.timestamp).toBeDefined();
  });

  it('GET /api/v1/health returns 200 matching standard prefix', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('GET /docs.json returns valid OpenAPI 3.0 specification JSON', async () => {
    const res = await request(app).get('/docs.json');
    expect(res.status).toBe(200);
    expect(res.body.openapi).toBe('3.0.3');
    expect(res.body.info.title).toContain('DeskOps');
    expect(res.body.paths['/tickets']).toBeDefined();
    expect(res.body.paths['/tickets/{id}/merge']).toBeDefined();
    expect(res.body.paths['/attachments/presigned-url']).toBeDefined();
  });

  it('GET /docs/ serves interactive Swagger UI HTML', async () => {
    const res = await request(app).get('/docs/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Swagger UI');
  });
});
