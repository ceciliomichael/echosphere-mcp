/**
 * File Reader Configuration Constants
 */

/**
 * Maximum size per file in bytes (256 KB default)
 */
export const MAX_FILE_SIZE_BYTES = parseInt(
  process.env.MAX_FILE_SIZE_BYTES || '262144',
  10
);

/**
 * Maximum total response size in bytes (2 MB default)
 */
export const MAX_RESPONSE_SIZE_BYTES = parseInt(
  process.env.MAX_RESPONSE_SIZE_BYTES || '2097152',
  10
);

/**
 * Truncation message to append when file is truncated
 */
export const TRUNCATION_MESSAGE = '\n\n[... Content truncated due to size limit ...]';

