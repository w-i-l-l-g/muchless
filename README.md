# Kindle-Friendly Web App with AWS Cognito

A simple Express.js web application designed for Kindle's built-in web browser, featuring AWS Cognito authentication with username/password only.

## Features

- Extremely simple, Kindle-compatible UI
- Server-side rendering with minimal HTML and vanilla JS
- AWS Cognito authentication (username/password only)
- Session management
- Responsive design optimized for e-ink displays

## Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure AWS Cognito

1. Create a Cognito User Pool in AWS Console
2. Create an App Client (with or without client secret)
3. Update the `.env` file with your Cognito configuration:

```env
AWS_REGION=us-east-1
COGNITO_USER_POOL_ID=your_user_pool_id_here
COGNITO_CLIENT_ID=your_client_id_here
COGNITO_CLIENT_SECRET=your_client_secret_here  # Optional
SESSION_SECRET=your_random_session_secret_here
# Required for encrypted notes and letters - must be exactly 32 characters
ENCRYPTION_KEY=your-32-char-encryption-key-here
PORT=3000
```

### 3. AWS Credentials

Make sure your AWS credentials are configured via:
- AWS CLI (`aws configure`)
- Environment variables (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`)
- IAM roles (if running on EC2)

### 4. Run the Application

Development mode:
```bash
npm run dev
```

Production mode:
```bash
npm start
```

## Routes

- `/` - Redirects to `/home`
- `/home` - Main page (requires authentication)
- `/login` - Login page
- `/signup` - Registration page
- `/logout` - Logout (POST only)

## Kindle Optimization

- Simple serif fonts for better readability
- High contrast black/white design
- Large touch targets (buttons/links)
- Minimal JavaScript
- Server-side processing preferred
- Fast loading times

## Notes

- User passwords must be at least 8 characters
- No email verification required (username/password only)
- Sessions expire after 24 hours
- Designed for simplicity and Kindle compatibility
