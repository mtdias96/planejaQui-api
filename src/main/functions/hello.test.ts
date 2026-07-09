import { describe, it, expect } from 'vitest';
import { helloRoutes } from '@main/routes/hello.js';

describe('Handler Hono API - Clean Architecture', () => {
  it('deve retornar hello world padrão no GET /hello', async () => {
    const res = await helloRoutes.request('/hello');

    expect(res.status).toBe(200);
    const body = await res.json() as { message: string };
    expect(body.message).toBe('Hello World! This is the new Clean Architecture!');
  });

  it('deve retornar hello com nome enviado no POST /hello', async () => {
    const res = await helloRoutes.request('/hello', {
      method: 'POST',
      body: JSON.stringify({ name: 'Matheus' }),
      headers: {
        'content-type': 'application/json',
      },
    });

    expect(res.status).toBe(200);
    const body = await res.json() as { message: string };
    expect(body.message).toBe('Hello Matheus! This is the new Clean Architecture!');
  });

  it('deve retornar erro de validação 400 no POST /hello com corpo inválido', async () => {
    const res = await helloRoutes.request('/hello', {
      method: 'POST',
      body: JSON.stringify({ name: 123 }), // name deve ser string
      headers: {
        'content-type': 'application/json',
      },
    });

    expect(res.status).toBe(400);
    const body = await res.json() as { code: string };
    expect(body.code).toBe('VALIDATION');
  });
});
