/**
 * AutoReels Scroll - Server-side Cryptographic License Key Generator
 * Generates non-sequential, cryptographically secure keys in format:
 * ARS-XXXX-XXXX-XXXX
 * Uses an unambiguous alphabet excluding characters (0, O, 1, I) that cause user confusion.
 */

import crypto from 'crypto';

// 32-character unambiguous charset
export const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

/**
 * Generate a secure, non-sequential license key.
 * @param {string} [prefix='ARS'] Key prefix (default: ARS)
 * @returns {string} Formatted license key (e.g., ARS-7K4P-92XM-8QZT)
 */
export function generateLicenseKey(prefix = 'ARS') {
  const parts = [];
  for (let p = 0; p < 3; p++) {
    let chunk = '';
    const randomBytes = crypto.randomBytes(4);
    for (let i = 0; i < 4; i++) {
      chunk += ALPHABET[randomBytes[i] % ALPHABET.length];
    }
    parts.push(chunk);
  }
  return `${prefix}-${parts.join('-')}`;
}

/**
 * Validate that a license key adheres to acceptable format patterns.
 * Accepts standard production keys (ARS-XXXX-XXXX-XXXX) and test keys (TEST-ARS-...).
 * @param {string} key
 * @returns {boolean}
 */
export function isValidLicenseKeyFormat(key) {
  if (!key || typeof key !== 'string') return false;
  const cleanKey = key.trim().toUpperCase();
  const prodRegex = /^ARS-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/;
  const testRegex = /^TEST-ARS-[A-Z0-9-]+$/;
  return prodRegex.test(cleanKey) || testRegex.test(cleanKey);
}

/**
 * Sanitize and normalize license key input (trim, uppercase, remove accidental whitespace).
 * @param {string} key
 * @returns {string}
 */
export function normalizeLicenseKey(key) {
  if (!key || typeof key !== 'string') return '';
  return key.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
}
