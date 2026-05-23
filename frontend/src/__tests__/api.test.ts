// Unit-тесты для api/client.ts
// Проверяет: заголовки, credentials, обработку ошибок, методы

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { api } from '../api/client';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function makeResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: () => Promise.resolve(body),
  };
}

describe('api client', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe('GET запросы', () => {
    it('отправляет GET на правильный URL', async () => {
      mockFetch.mockResolvedValue(makeResponse({ user: { id: '1' } }));

      await api.get('/auth/me');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/auth/me',
        expect.objectContaining({ method: 'GET' })
      );
    });

    it('отправляет запрос с credentials: include', async () => {
      mockFetch.mockResolvedValue(makeResponse({}));

      await api.get('/auth/me');

      const [, options] = mockFetch.mock.calls[0];
      expect(options.credentials).toBe('include');
    });

    it('не добавляет Authorization заголовок', async () => {
      mockFetch.mockResolvedValue(makeResponse({}));

      await api.get('/auth/me');

      const [, options] = mockFetch.mock.calls[0];
      expect(options.headers['Authorization']).toBeUndefined();
    });

    it('возвращает распарсенный JSON', async () => {
      mockFetch.mockResolvedValue(makeResponse({ scores: [{ skill: 'communication', score: 80 }] }));

      const result = await api.get('/test/results');

      expect(result.scores[0].score).toBe(80);
    });
  });

  describe('POST запросы', () => {
    it('сериализует тело в JSON', async () => {
      mockFetch.mockResolvedValue(makeResponse({ user: { id: '1' } }, true, 201));

      await api.post('/auth/register', { email: 'a@b.com', password: '123456' });

      const [, options] = mockFetch.mock.calls[0];
      expect(options.method).toBe('POST');
      expect(JSON.parse(options.body)).toEqual({ email: 'a@b.com', password: '123456' });
    });

    it('устанавливает Content-Type: application/json', async () => {
      mockFetch.mockResolvedValue(makeResponse({}));

      await api.post('/auth/login', { email: 'a@b.com', password: 'pass' });

      const [, options] = mockFetch.mock.calls[0];
      expect(options.headers['Content-Type']).toBe('application/json');
    });
  });

  describe('PATCH запросы', () => {
    it('отправляет PATCH с телом', async () => {
      mockFetch.mockResolvedValue(makeResponse({ user: { name: 'Иван' } }));

      await api.patch('/auth/profile', { name: 'Иван' });

      const [, options] = mockFetch.mock.calls[0];
      expect(options.method).toBe('PATCH');
      expect(options.credentials).toBe('include');
    });
  });

  describe('DELETE запросы', () => {
    it('отправляет DELETE без тела', async () => {
      mockFetch.mockResolvedValue(makeResponse({ ok: true }));

      await api.delete('/auth/avatar');

      const [, options] = mockFetch.mock.calls[0];
      expect(options.method).toBe('DELETE');
      expect(options.body).toBeUndefined();
    });
  });

  describe('Обработка ошибок', () => {
    it('бросает Error с текстом из поля error если !res.ok', async () => {
      mockFetch.mockResolvedValue(makeResponse({ error: 'Неверный email или пароль' }, false, 401));

      await expect(api.post('/auth/login', {})).rejects.toThrow('Неверный email или пароль');
    });

    it('бросает "Ошибка запроса" если поля error нет', async () => {
      mockFetch.mockResolvedValue(makeResponse({}, false, 500));

      await expect(api.get('/broken')).rejects.toThrow('Ошибка запроса');
    });
  });
});
