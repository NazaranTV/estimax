const bcrypt = require('bcrypt');
const crypto = require('crypto');

const SALT_ROUNDS = 12;

// Password hashing
async function hashPassword(password) {
  return await bcrypt.hash(password, SALT_ROUNDS);
}

async function verifyPassword(password, hash) {
  return await bcrypt.compare(password, hash);
}

// Token generation
function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function generateTokenWithExpiry(hours = 24) {
  const token = generateToken();
  const expires = new Date(Date.now() + hours * 60 * 60 * 1000);
  return { token, expires };
}

// Password validation
function validatePassword(password) {
  // Minimum 8 characters, at least one letter and one number
  const minLength = password.length >= 8;
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /\d/.test(password);

  if (!minLength) return { valid: false, error: 'Password must be at least 8 characters' };
  if (!hasLetter || !hasNumber) return { valid: false, error: 'Password must contain letters and numbers' };

  return { valid: true };
}

// Email validation
function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

module.exports = {
  hashPassword,
  verifyPassword,
  generateToken,
  generateTokenWithExpiry,
  validatePassword,
  validateEmail,
};
