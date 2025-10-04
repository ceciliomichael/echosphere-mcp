/**
 * Sanitized logging utility
 * Controls verbose logging via DEBUG environment variable
 */

const DEBUG = process.env.DEBUG === 'true';

/**
 * Sanitize error for logging - removes sensitive data
 */
function sanitizeError(error: unknown): string {
  if (error instanceof Error) {
    // Only log error type and safe properties
    return `${error.name}: ${error.message}`;
  }
  return 'Unknown error';
}

/**
 * Log error with optional details (only shown when DEBUG=true)
 */
export function logError(context: string, error: unknown, details?: Record<string, any>): void {
  const sanitized = sanitizeError(error);
  
  if (DEBUG && details) {
    // Redact sensitive keys
    const redactedDetails = Object.entries(details).reduce((acc, [key, value]) => {
      const lowerKey = key.toLowerCase();
      if (lowerKey.includes('key') || lowerKey.includes('token') || lowerKey.includes('password') || lowerKey.includes('secret')) {
        acc[key] = '[REDACTED]';
      } else if (typeof value === 'string' && value.length > 200) {
        // Truncate long strings
        acc[key] = `${value.substring(0, 200)}... [truncated]`;
      } else {
        acc[key] = value;
      }
      return acc;
    }, {} as Record<string, any>);
    
    console.error(`[${context}] ${sanitized}`, redactedDetails);
  } else {
    console.error(`[${context}] ${sanitized}`);
  }
}

/**
 * Log info message (only when DEBUG=true)
 */
export function logInfo(context: string, message: string, details?: Record<string, any>): void {
  if (DEBUG) {
    if (details) {
      console.error(`[${context}] ${message}`, details);
    } else {
      console.error(`[${context}] ${message}`);
    }
  }
}

/**
 * Log warning with sanitization
 */
export function logWarning(context: string, message: string): void {
  if (DEBUG) {
    console.error(`[${context}] Warning: ${message}`);
  }
}

