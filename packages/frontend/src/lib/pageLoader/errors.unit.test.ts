import { z } from 'zod';
import { ContentError } from '../content/errors';
import { normalizePageProblem } from './errors';

describe('normalizePageProblem', () => {
  it('preserves safe upstream metadata', () => {
    const problem = normalizePageProblem(
      Object.assign(new Error('backend unavailable'), {
        status: 'CUSTOM_ERROR',
        code: 'BACKEND_UNAVAILABLE',
        requestId: 'request-1',
        retryable: true,
      }),
      { source: 'loom' },
    );

    expect(problem).toMatchObject({
      source: 'loom',
      status: 503,
      code: 'BACKEND_UNAVAILABLE',
      requestId: 'request-1',
      retryable: true,
      message: 'backend unavailable',
    });
  });

  it('redacts bearer credentials from browser-safe messages', () => {
    const problem = normalizePageProblem(
      new Error('request failed for Bearer very.secret.token'),
      { source: 'internal' },
    );
    expect(problem.message).toBe('request failed for Bearer [redacted]');
  });

  it('omits undefined optional properties for Next.js serialization', () => {
    const problem = normalizePageProblem(new Error('request failed'), {
      source: 'internal',
    });

    expect(problem).toStrictEqual({
      severity: 'error',
      source: 'internal',
      status: 502,
      message: 'request failed',
      retryable: true,
    });
  });

  it('maps content errors without exposing their causes', () => {
    const problem = normalizePageProblem(
      new ContentError('not found', {
        kind: 'http',
        status: 404,
        requestId: 'request-2',
        cause: new Error('private detail'),
      }),
      { source: 'gecko' },
    );
    expect(problem).toEqual({
      severity: 'error',
      source: 'gecko',
      status: 404,
      message: 'not found',
      requestId: 'request-2',
      retryable: false,
    });
  });

  it('returns exact Zod issue paths', () => {
    const result = z.object({ nested: z.object({ value: z.string() }) }).safeParse({
      nested: { value: 1 },
    });
    if (result.success) throw new Error('expected invalid fixture');

    expect(
      normalizePageProblem(result.error, {
        source: 'config',
        configPath: 'cbds/example.json',
      }).issues,
    ).toEqual([
      {
        path: '$.nested.value',
        message: 'Invalid input: expected string, received number',
      },
    ]);
  });

  it('normalizes semantic configuration errors', () => {
    const error = Object.assign(new Error('Invalid Query configuration'), {
      name: 'QueryConfigurationError',
      issues: [{ path: 'modes.0.endpoint', message: 'Unknown endpoint' }],
    });
    expect(normalizePageProblem(error, { source: 'content' })).toMatchObject({
      source: 'config',
      status: 500,
      retryable: false,
      issues: [{ path: '$.modes.0.endpoint', message: 'Unknown endpoint' }],
    });
  });
});
