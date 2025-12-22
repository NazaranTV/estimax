// Utility functions
function showError(message) {
  const errorEl = document.getElementById('errorMessage');
  if (errorEl) {
    errorEl.textContent = message;
    errorEl.classList.add('show');
    setTimeout(() => errorEl.classList.remove('show'), 5000);
  }
}

function showSuccess(message) {
  const successEl = document.getElementById('successMessage');
  if (successEl) {
    successEl.textContent = message;
    successEl.classList.add('show');
  }
}

function hideMessages() {
  const errorEl = document.getElementById('errorMessage');
  const successEl = document.getElementById('successMessage');
  if (errorEl) errorEl.classList.remove('show');
  if (successEl) successEl.classList.remove('show');
}

function disableSubmit(disabled = true) {
  const submitBtn = document.getElementById('submitBtn');
  if (submitBtn) {
    submitBtn.disabled = disabled;
    submitBtn.textContent = disabled ? 'Processing...' : submitBtn.getAttribute('data-original-text') || 'Submit';
  }
}

// Login form handler
const loginForm = document.getElementById('loginForm');
if (loginForm) {
  const submitBtn = document.getElementById('submitBtn');
  if (submitBtn) submitBtn.setAttribute('data-original-text', submitBtn.textContent);

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideMessages();
    disableSubmit(true);

    const formData = new FormData(loginForm);
    const data = {
      email: formData.get('email'),
      password: formData.get('password'),
      rememberMe: formData.get('rememberMe') === 'on',
    };

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = await res.json();

      if (!res.ok) {
        showError(result.error || 'Login failed');
        disableSubmit(false);
        return;
      }

      // Redirect to dashboard
      window.location.href = '/';
    } catch (err) {
      showError('Network error. Please try again.');
      disableSubmit(false);
    }
  });
}

// Register form handler
const registerForm = document.getElementById('registerForm');
if (registerForm) {
  const submitBtn = document.getElementById('submitBtn');
  if (submitBtn) submitBtn.setAttribute('data-original-text', submitBtn.textContent);

  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideMessages();

    const formData = new FormData(registerForm);
    const password = formData.get('password');
    const confirmPassword = formData.get('confirmPassword');

    if (password !== confirmPassword) {
      showError('Passwords do not match');
      return;
    }

    disableSubmit(true);

    const data = {
      email: formData.get('email'),
      password: password,
    };

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = await res.json();

      if (!res.ok) {
        showError(result.error || 'Registration failed');
        disableSubmit(false);
        return;
      }

      // Hide form and show success message
      registerForm.style.display = 'none';
      showSuccess('Registration successful! Please check your email to verify your account before logging in.');
    } catch (err) {
      showError('Network error. Please try again.');
      disableSubmit(false);
    }
  });
}

// Forgot password form handler
const forgotPasswordForm = document.getElementById('forgotPasswordForm');
if (forgotPasswordForm) {
  const submitBtn = document.getElementById('submitBtn');
  if (submitBtn) submitBtn.setAttribute('data-original-text', submitBtn.textContent);

  forgotPasswordForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideMessages();
    disableSubmit(true);

    const formData = new FormData(forgotPasswordForm);
    const data = {
      email: formData.get('email'),
    };

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = await res.json();

      if (!res.ok) {
        showError(result.error || 'Request failed');
        disableSubmit(false);
        return;
      }

      // Hide form and show success message
      forgotPasswordForm.style.display = 'none';
      showSuccess('If that email exists in our system, a password reset link has been sent. Please check your email.');
    } catch (err) {
      showError('Network error. Please try again.');
      disableSubmit(false);
    }
  });
}

// Reset password form handler
const resetPasswordForm = document.getElementById('resetPasswordForm');
if (resetPasswordForm) {
  const submitBtn = document.getElementById('submitBtn');
  if (submitBtn) submitBtn.setAttribute('data-original-text', submitBtn.textContent);

  // Get token from URL
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');

  if (!token) {
    showError('Invalid or missing reset token');
    disableSubmit(true);
  } else {
    resetPasswordForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideMessages();

      const formData = new FormData(resetPasswordForm);
      const newPassword = formData.get('newPassword');
      const confirmPassword = formData.get('confirmPassword');

      if (newPassword !== confirmPassword) {
        showError('Passwords do not match');
        return;
      }

      disableSubmit(true);

      const data = {
        token: token,
        newPassword: newPassword,
      };

      try {
        const res = await fetch('/api/auth/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });

        const result = await res.json();

        if (!res.ok) {
          showError(result.error || 'Password reset failed');
          disableSubmit(false);
          return;
        }

        // Hide form and show success message
        resetPasswordForm.style.display = 'none';
        showSuccess('Password reset successful! You can now log in with your new password.');

        // Redirect to login after 2 seconds
        setTimeout(() => {
          window.location.href = '/login.html';
        }, 2000);
      } catch (err) {
        showError('Network error. Please try again.');
        disableSubmit(false);
      }
    });
  }
}

// Verify email handler (auto-verify on page load)
if (window.location.pathname.includes('verify-email.html')) {
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');

  const loading = document.getElementById('loading');
  const result = document.getElementById('result');
  const errorMessage = document.getElementById('errorMessage');
  const successMessage = document.getElementById('successMessage');
  const continueBtn = document.getElementById('continueBtn');

  if (!token) {
    loading.style.display = 'none';
    result.style.display = 'block';
    errorMessage.textContent = 'Invalid or missing verification token';
    errorMessage.classList.add('show');
  } else {
    // Auto-verify
    (async () => {
      try {
        const res = await fetch(`/api/auth/verify-email?token=${token}`);
        const data = await res.json();

        loading.style.display = 'none';
        result.style.display = 'block';

        if (!res.ok) {
          errorMessage.textContent = data.error || 'Email verification failed';
          errorMessage.classList.add('show');
        } else {
          successMessage.textContent = 'Email verified successfully! You can now log in.';
          successMessage.classList.add('show');
          continueBtn.style.display = 'inline-block';
        }
      } catch (err) {
        loading.style.display = 'none';
        result.style.display = 'block';
        errorMessage.textContent = 'Network error. Please try again.';
        errorMessage.classList.add('show');
      }
    })();
  }
}
