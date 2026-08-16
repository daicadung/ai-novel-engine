import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { validateEnv, resetEnv } from '../env';

describe('Environment Validation', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    resetEnv();
    vi.stubGlobal('window', undefined); // Simulate server
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env = originalEnv;
  });

  it('validates a complete valid server environment', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'test-pub-key';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
    
    const result = validateEnv();
    expect(result.NEXT_PUBLIC_SUPABASE_URL).toBe('https://example.supabase.co');
    expect(result.SUPABASE_SERVICE_ROLE_KEY).toBe('test-service-key');
  });

  it('fails if client env is missing', () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    
    expect(() => validateEnv()).toThrowError(/Invalid client environment variables/);
  });

  it('skips server env validation if running on client', () => {
    vi.stubGlobal('window', {}); // Simulate client
    
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'test-pub-key';
    
    const result = validateEnv();
    expect(result.NEXT_PUBLIC_SUPABASE_URL).toBe('https://example.supabase.co');
    expect((result as any).SUPABASE_SERVICE_ROLE_KEY).toBeUndefined();
  });
});
