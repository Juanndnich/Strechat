/**
 * strechat - Input & String Sanitizer
 * Prevents Cross-Site Scripting (XSS), script injection, and handles malformed strings.
 */

function escapeHtml(unsafe) {
  if (typeof unsafe !== 'string') {
    if (unsafe === null || unsafe === undefined) return '';
    return String(unsafe);
  }
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function cleanUsername(input) {
  if (typeof input !== 'string') return 'anonymous';
  // Strip control chars, trim, and remove leading '@' if present
  let clean = input.trim().replace(/^@+/, '');
  clean = clean.replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
  return clean.slice(0, 50) || 'anonymous';
}

function sanitizeComment(text) {
  if (typeof text !== 'string') return '';
  // Strip null bytes and dangerous control chars while preserving normal emojis & Unicode
  const sanitized = text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
  return escapeHtml(sanitized.slice(0, 500));
}

function sanitizeGift(gift) {
  if (!gift || typeof gift !== 'object') return null;
  return {
    giftId: Number(gift.giftId) || 0,
    giftName: escapeHtml(String(gift.giftName || 'Gift')),
    diamondCount: Math.max(0, Number(gift.diamondCount) || 0),
    repeatCount: Math.max(1, Number(gift.repeatCount) || 1),
    repeatEnd: Boolean(gift.repeatEnd),
    giftPictureUrl: typeof gift.giftPictureUrl === 'string' && gift.giftPictureUrl.startsWith('http')
      ? gift.giftPictureUrl
      : ''
  };
}

module.exports = {
  escapeHtml,
  cleanUsername,
  sanitizeComment,
  sanitizeGift
};
