export function describeDbError(error: unknown): string {
  if (!error || typeof error !== 'object') {
    return String(error);
  }

  const record = error as Record<string, unknown>;
  return JSON.stringify({
    message: record.message,
    code: record.code,
    errno: record.errno,
    syscall: record.syscall,
    address: record.address,
    port: record.port
  });
}
