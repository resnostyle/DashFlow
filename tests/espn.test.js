import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
import { EventEmitter } from 'events';
import path from 'path';

const require = createRequire(import.meta.url);
const https = require('https');
const espnPath = require.resolve('../src/services/espn');

function createMockResponse(statusCode, body) {
  const res = new EventEmitter();
  res.statusCode = statusCode;
  res.resume = vi.fn();
  process.nextTick(() => {
    if (statusCode >= 200 && statusCode < 300) {
      res.emit('data', typeof body === 'string' ? body : JSON.stringify(body));
    }
    res.emit('end');
  });
  return res;
}

describe('ESPN service', () => {
  let espn;
  let getSpy;

  beforeEach(() => {
    delete require.cache[espnPath];
    getSpy = vi.spyOn(https, 'get');
    espn = require('../src/services/espn');
  });

  afterEach(() => {
    getSpy.mockRestore();
  });

  describe('fetch with HTTP status checks', () => {
    it('resolves with parsed JSON on 200', async () => {
      const payload = { team: { id: 1, name: 'Duke' } };
      const mockReq = new EventEmitter();
      getSpy.mockImplementation((_url, _opts, cb) => {
        cb(createMockResponse(200, payload));
        return mockReq;
      });

      const result = await espn.getTeam('mens', 150);
      expect(result).toEqual(payload);
    });

    it('rejects with descriptive error on HTTP 404', async () => {
      const mockReq = new EventEmitter();
      getSpy.mockImplementation((_url, _opts, cb) => {
        const res = new EventEmitter();
        res.statusCode = 404;
        res.resume = vi.fn();
        process.nextTick(() => cb(res));
        return mockReq;
      });

      await expect(espn.getTeam('mens', 99999)).rejects.toThrow(
        'ESPN API returned HTTP 404',
      );
    });

    it('rejects with descriptive error on HTTP 500', async () => {
      const mockReq = new EventEmitter();
      getSpy.mockImplementation((_url, _opts, cb) => {
        const res = new EventEmitter();
        res.statusCode = 500;
        res.resume = vi.fn();
        process.nextTick(() => cb(res));
        return mockReq;
      });

      await expect(espn.getTeam('mens', 150)).rejects.toThrow(
        'ESPN API returned HTTP 500',
      );
    });

    it('rejects with descriptive error on HTTP 503', async () => {
      const mockReq = new EventEmitter();
      getSpy.mockImplementation((_url, _opts, cb) => {
        const res = new EventEmitter();
        res.statusCode = 503;
        res.resume = vi.fn();
        process.nextTick(() => cb(res));
        return mockReq;
      });

      await expect(espn.getScoreboard('mens')).rejects.toThrow(
        'ESPN API returned HTTP 503',
      );
    });

    it('drains the response body on non-2xx to prevent socket leaks', async () => {
      const mockReq = new EventEmitter();
      const mockRes = new EventEmitter();
      mockRes.statusCode = 502;
      mockRes.resume = vi.fn();

      getSpy.mockImplementation((_url, _opts, cb) => {
        process.nextTick(() => cb(mockRes));
        return mockReq;
      });

      await expect(espn.getTeam('mens', 150)).rejects.toThrow();
      expect(mockRes.resume).toHaveBeenCalled();
    });
  });

  describe('fetch with invalid JSON', () => {
    it('rejects with descriptive error when response is not valid JSON', async () => {
      const mockReq = new EventEmitter();
      let mockCalled = false;
      getSpy.mockImplementation((_url, _opts, cb) => {
        mockCalled = true;
        const res = new EventEmitter();
        res.statusCode = 200;
        res.resume = vi.fn();
        cb(res);
        process.nextTick(() => {
          res.emit('data', '<html>Not JSON</html>');
          res.emit('end');
        });
        return mockReq;
      });

      const promise = espn.getTeam('mens', 150);
      expect(mockCalled).toBe(true);
      await expect(promise).rejects.toThrow(
        'ESPN API returned invalid JSON (HTTP 200)',
      );
    });
  });

  describe('fetch with timeout', () => {
    it('rejects when the request times out', async () => {
      const mockReq = new EventEmitter();
      mockReq.destroy = vi.fn();

      getSpy.mockImplementation(() => mockReq);

      const promise = espn.getTeam('mens', 150);
      mockReq.emit('timeout');

      await expect(promise).rejects.toThrow('ESPN API request timed out');
      expect(mockReq.destroy).toHaveBeenCalled();
    });

    it('passes timeout option to https.get', () => {
      const mockReq = new EventEmitter();
      mockReq.destroy = vi.fn();
      getSpy.mockImplementation(() => mockReq);

      espn.getTeam('mens', 150).catch(() => {});

      expect(getSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ timeout: 10_000 }),
        expect.any(Function),
      );

      mockReq.emit('error', new Error('abort'));
    });
  });

  describe('fetch with network error', () => {
    it('rejects on DNS/network failure', async () => {
      const mockReq = new EventEmitter();
      mockReq.destroy = vi.fn();
      getSpy.mockImplementation(() => {
        process.nextTick(() => mockReq.emit('error', new Error('getaddrinfo ENOTFOUND')));
        return mockReq;
      });

      await expect(espn.getTeam('mens', 150)).rejects.toThrow('getaddrinfo ENOTFOUND');
    });
  });

  describe('getCached with fetch errors', () => {
    it('does not cache failed responses', async () => {
      const mockReq = new EventEmitter();
      let callCount = 0;

      getSpy.mockImplementation((_url, _opts, cb) => {
        callCount++;
        if (callCount === 1) {
          const res = new EventEmitter();
          res.statusCode = 500;
          res.resume = vi.fn();
          process.nextTick(() => cb(res));
        } else {
          cb(createMockResponse(200, { team: 'Duke' }));
        }
        return mockReq;
      });

      await expect(espn.getTeam('mens', 150)).rejects.toThrow('HTTP 500');

      const result = await espn.getTeam('mens', 150);
      expect(result).toEqual({ team: 'Duke' });
      expect(callCount).toBe(2);
    });

    it('returns cached data on subsequent calls within TTL', async () => {
      const mockReq = new EventEmitter();
      const payload = { events: [] };

      getSpy.mockImplementation((_url, _opts, cb) => {
        cb(createMockResponse(200, payload));
        return mockReq;
      });

      const first = await espn.getScoreboard('mens');
      const second = await espn.getScoreboard('mens');

      expect(first).toEqual(payload);
      expect(second).toEqual(payload);
      expect(getSpy).toHaveBeenCalledTimes(1);
    });
  });
});
