const express = require('express');
const { pool } = require('../db');
const { hashPassword, verifyPassword, generateTokenWithExpiry, validatePassword, validateEmail } = require('../auth');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../email');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({ error: passwordValidation.error });
    }

    // Check if user exists
    const normalizedEmail = email.toLowerCase().trim();
    const { rows: existing } = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [normalizedEmail]
    );

    if (existing.length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Generate verification token
    const { token: verificationToken, expires: verificationExpires } = generateTokenWithExpiry(24);

    // Create user
    const { rows } = await pool.query(
      `INSERT INTO users (email, password_hash, email_verification_token, email_verification_expires)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, created_at`,
      [normalizedEmail, passwordHash, verificationToken, verificationExpires]
    );

    const user = rows[0];

    // Send verification email
    try {
      await sendVerificationEmail(normalizedEmail, verificationToken);
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError);
      // Don't fail registration if email fails
    }

    res.status(201).json({
      message: 'Registration successful. Please check your email to verify your account.',
      userId: user.id,
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password, rememberMe } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Get user
    const { rows } = await pool.query(
      'SELECT id, email, password_hash, email_verified FROM users WHERE email = $1',
      [normalizedEmail]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = rows[0];

    // Verify password
    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Update last login
    await pool.query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);

    // Create session
    req.session.userId = user.id;
    req.session.email = user.email;
    req.session.emailVerified = user.email_verified;

    // Set cookie expiration based on "remember me"
    if (rememberMe) {
      req.session.cookie.maxAge = parseInt(process.env.SESSION_REMEMBER_ME_AGE) || 30 * 24 * 60 * 60 * 1000;
    }

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        emailVerified: user.email_verified,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// POST /api/auth/logout
router.post('/logout', requireAuth, async (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.clearCookie('connect.sid');
    res.json({ message: 'Logout successful' });
  });
});

// GET /api/auth/verify-email
router.get('/verify-email', async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({ error: 'Verification token required' });
    }

    const { rows } = await pool.query(
      `SELECT id, email FROM users
       WHERE email_verification_token = $1
       AND email_verification_expires > NOW()
       AND email_verified = false`,
      [token]
    );

    if (rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired verification token' });
    }

    const user = rows[0];

    // Mark email as verified
    await pool.query(
      `UPDATE users
       SET email_verified = true,
           email_verification_token = NULL,
           email_verification_expires = NULL,
           updated_at = NOW()
       WHERE id = $1`,
      [user.id]
    );

    // Update session if user is logged in
    if (req.session && req.session.userId === user.id) {
      req.session.emailVerified = true;
    }

    res.json({ message: 'Email verified successfully' });
  } catch (err) {
    console.error('Email verification error:', err);
    res.status(500).json({ error: 'Verification failed' });
  }
});

// POST /api/auth/resend-verification
router.post('/resend-verification', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;

    const { rows } = await pool.query(
      'SELECT email, email_verified FROM users WHERE id = $1',
      [userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = rows[0];

    if (user.email_verified) {
      return res.status(400).json({ error: 'Email already verified' });
    }

    // Generate new token
    const { token: verificationToken, expires: verificationExpires } = generateTokenWithExpiry(24);

    await pool.query(
      `UPDATE users
       SET email_verification_token = $1,
           email_verification_expires = $2,
           updated_at = NOW()
       WHERE id = $3`,
      [verificationToken, verificationExpires, userId]
    );

    try {
      await sendVerificationEmail(user.email, verificationToken);
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError);
      return res.status(500).json({ error: 'Failed to send email' });
    }

    res.json({ message: 'Verification email sent' });
  } catch (err) {
    console.error('Resend verification error:', err);
    res.status(500).json({ error: 'Failed to resend verification' });
  }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const { rows } = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [normalizedEmail]
    );

    // Always return success (security: don't reveal if email exists)
    if (rows.length === 0) {
      return res.json({ message: 'If that email exists, a reset link has been sent' });
    }

    const user = rows[0];

    // Generate reset token (1 hour expiry)
    const { token: resetToken, expires: resetExpires } = generateTokenWithExpiry(1);

    await pool.query(
      `UPDATE users
       SET reset_token = $1,
           reset_token_expires = $2,
           updated_at = NOW()
       WHERE id = $3`,
      [resetToken, resetExpires, user.id]
    );

    try {
      await sendPasswordResetEmail(normalizedEmail, resetToken);
    } catch (emailError) {
      console.error('Failed to send password reset email:', emailError);
      // Still return success to not reveal if email exists
    }

    res.json({ message: 'If that email exists, a reset link has been sent' });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Failed to process request' });
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token and new password are required' });
    }

    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.valid) {
      return res.status(400).json({ error: passwordValidation.error });
    }

    const { rows } = await pool.query(
      `SELECT id FROM users
       WHERE reset_token = $1
       AND reset_token_expires > NOW()`,
      [token]
    );

    if (rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    const user = rows[0];

    // Hash new password
    const passwordHash = await hashPassword(newPassword);

    // Update password and clear reset token
    await pool.query(
      `UPDATE users
       SET password_hash = $1,
           reset_token = NULL,
           reset_token_expires = NULL,
           updated_at = NOW()
       WHERE id = $2`,
      [passwordHash, user.id]
    );

    res.json({ message: 'Password reset successful' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// GET /api/auth/me (get current user)
router.get('/me', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, email, email_verified, created_at, last_login_at FROM users WHERE id = $1',
      [req.session.userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: rows[0] });
  } catch (err) {
    console.error('Get user error:', err);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

module.exports = router;
