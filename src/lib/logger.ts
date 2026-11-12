/** Journalisation structurée minimale (JSON sur stdout/stderr, exploitable par Docker). */
type Level = 'info' | 'warn' | 'error';

function write(level: Level, message: string, context?: Record<string, unknown>): void {
  const line = JSON.stringify({ level, time: new Date().toISOString(), message, ...context });
  if (process.env.NODE_ENV === 'test') return;
  (level === 'error' ? console.error : console.log)(line);
}

export const logger = {
  info: (message: string, context?: Record<string, unknown>) => write('info', message, context),
  warn: (message: string, context?: Record<string, unknown>) => write('warn', message, context),
  error: (message: string, context?: Record<string, unknown>) => write('error', message, context),
};
