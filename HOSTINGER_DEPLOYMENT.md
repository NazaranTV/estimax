# Hostinger Deployment Guide for Estimax

## Issues Fixed

The build was failing due to:
1. **Missing database tables**: `company_settings` and `payment_methods` tables were referenced but not created
2. **Missing SESSION_SECRET**: Required environment variable was not documented

Both issues have been resolved.

## Pre-Deployment Checklist

Before uploading to Hostinger, ensure you have:

1. **PostgreSQL Database** set up on Hostinger
2. **Resend API Account** (for sending emails) - https://resend.com
3. **Session Secret** generated (see below)

## Step 1: Generate Session Secret

Run this command locally to generate a secure session secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the output - you'll need it for Hostinger environment variables.

## Step 2: Upload to Hostinger

1. Go to your Hostinger control panel
2. Navigate to the application deployment section
3. Upload the `estimax-hostinger-deploy.zip` file
4. Select **Express** as the framework
5. Set **Node version** to 22.x (or latest LTS)
6. Keep **Root directory** as `./`

## Step 3: Configure Environment Variables on Hostinger

In Hostinger's environment variables settings, add the following:

### Required Variables:

```env
DATABASE_URL=postgres://username:password@host:port/database_name
NODE_ENV=production
SESSION_SECRET=<paste the secret you generated>
PORT=3000
```

### Email Configuration (Required for sending invoices/estimates):

```env
RESEND_API_KEY=<your-resend-api-key>
FROM_EMAIL=<your-verified-email@yourdomain.com>
PUBLIC_URL=https://yourdomain.com
```

### Optional Variables:

```env
SESSION_MAX_AGE=86400000
SCRAPINGFISH_API_KEY=<if-you-use-price-scraping>
VALUESERP_API_KEY=<if-you-use-price-scraping>
```

## Step 4: Get Your Database URL

From Hostinger PostgreSQL settings:
1. Find your database credentials
2. Format as: `postgres://username:password@hostname:port/database_name`
3. Example: `postgres://u12345_estimax:MyP@ssw0rd@db-host.hostinger.com:5432/u12345_estimax_db`

## Step 5: Set Up Resend Email

1. Sign up at https://resend.com
2. Verify your domain (or use their test email for development)
3. Get your API key from the dashboard
4. Add a verified sender email address

**Important**:
- For testing: Use `onboarding@resend.dev` as FROM_EMAIL (only sends to your Resend signup email)
- For production: Verify your domain and use your own email address

## Step 6: Deploy

1. After uploading and configuring environment variables
2. Click "Deploy" or "Build"
3. Hostinger will:
   - Run `npm install` (installs dependencies)
   - Run `npm start` (starts the server)
   - Initialize the database tables automatically

## Step 7: First Time Setup

After successful deployment:

1. Visit your Hostinger URL
2. Click "Register" to create your first account
3. Verify your email (check spam folder)
4. Log in and start using the app

## Troubleshooting

### Build fails with database error:
- Verify DATABASE_URL is correct
- Ensure PostgreSQL database is created and accessible
- Check database user has CREATE TABLE permissions

### App starts but can't log in:
- Verify SESSION_SECRET is set
- Check that database tables were created successfully
- Look at Hostinger logs for error messages

### Emails not sending:
- Verify RESEND_API_KEY is correct
- Check FROM_EMAIL is verified in Resend dashboard
- If using test email, emails only go to your Resend signup address

### Database connection timeout:
- Ensure your Hostinger PostgreSQL allows external connections
- Verify host, port, username, and password are all correct
- Check if database requires SSL (add `?sslmode=require` to DATABASE_URL if needed)

## What's Included in the Deployment Package

- `package.json` - Dependencies and start scripts
- `src/` - All server-side code
- `public/` - All frontend files (HTML, CSS, JavaScript)
- `.env.example` - Template for environment variables
- `.gitignore` - Prevents uploading node_modules and sensitive files

## Build Commands (Hostinger Auto-Detects)

- **Install**: `npm install`
- **Start**: `npm start` (runs `node src/server.js`)

## Important Notes

1. **No node_modules needed** - Hostinger installs dependencies automatically
2. **Database auto-initializes** - Tables are created on first startup
3. **Secure cookies** - Automatically enabled in production (NODE_ENV=production)
4. **Session storage** - Uses PostgreSQL for session persistence
5. **Git repository initialized** - Project is version controlled locally

## Support

If you encounter issues:
1. Check Hostinger deployment logs
2. Verify all environment variables are set correctly
3. Ensure PostgreSQL database is accessible
4. Confirm Resend API key is valid

## Files Modified

- `src/db.js` - Added company_settings and payment_methods table definitions
- `.env.example` - Added all required environment variables with documentation
