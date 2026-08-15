import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { app } from '../src/server.js';

describe.skip('API Integration Tests (Blocked by Missing PostgreSQL)', () => {
  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health should return status ok', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health'
    });
    expect(response.statusCode).toBe(200);
    const json = response.json();
    expect(json.service).toBe('ai-novel-engine-api');
  });

  let createdNovelId: string;

  it('POST /api/novels should create a novel', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/novels',
      payload: {
        title: 'Test Novel',
        premise: 'A test premise'
      }
    });
    expect(response.statusCode).toBe(201);
    const novel = response.json();
    expect(novel.title).toBe('Test Novel');
    createdNovelId = novel.id;
  });

  it('GET /api/novels/:id should return the created novel', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/novels/' + createdNovelId
    });
    expect(response.statusCode).toBe(200);
    const novel = response.json();
    expect(novel.id).toBe(createdNovelId);
  });

  it('DELETE /api/novels/:id should delete the novel', async () => {
    const response = await app.inject({
      method: 'DELETE',
      url: '/api/novels/' + createdNovelId
    });
    expect(response.statusCode).toBe(204);
  });
});
