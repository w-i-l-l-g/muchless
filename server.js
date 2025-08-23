const express = require('express');
const session = require('express-session');
const FileStore = require('session-file-store')(session);
const cookieParser = require('cookie-parser');
const path = require('path');
const CognitoAuth = require('./cognito');
require('dotenv').config();

const cognitoAuth = new CognitoAuth();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
app.use(session({
  store: new FileStore({
    path: './sessions',
    ttl: 365 * 24 * 60 * 60, // 1 year in seconds
    reapInterval: 24 * 60 * 60 // Clean up expired sessions daily
  }),
  secret: process.env.SESSION_SECRET || 'fallback-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: false, // Set to true if using HTTPS
    maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
    httpOnly: true // Prevent XSS attacks
  }
}));

// Serve static files
app.use(express.static('public'));

// Simple authentication middleware
function requireAuth(req, res, next) {
  if (req.session && req.session.userId) {
    return next();
  } else {
    // Store the original URL for redirect after login
    req.session.returnTo = req.originalUrl;
    return res.redirect('/login');
  }
}

// Routes
app.get('/home', requireAuth, (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Home</title>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        body { 
          font-family: serif; 
          font-size: 18px; 
          margin: 20px; 
          background: white; 
          color: black; 
          display: flex;
          flex-direction: column;
          min-height: calc(100vh - 40px);
        }
        .container { 
          max-width: 600px; 
          margin: 0 auto; 
          text-align: center; 
          flex-grow: 1;
          display: flex;
          flex-direction: column;
          padding-top: 40px;
        }
        h1 {
          margin: 0 0 0px 0;
          flex-shrink: 0;
        }
        .content-area {
          flex-grow: 1;
          display: flex;
          flex-direction: column;
          justify-content: center;
          min-height: 0;
        }
        .button-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          max-width: 400px;
          margin: 0 auto 40px auto;
        }
        .app-button {
          padding: 30px 20px;
          font-size: 18px;
          font-family: serif;
          background: #f0f0f0;
          border: 2px solid #333;
          cursor: pointer;
          text-decoration: none;
          color: black;
          display: block;
          min-height: 80px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .app-button:hover {
          background: #e0e0e0;
        }
        .logout-link {
          margin-top: auto;
          padding: 20px 0;
          text-align: center;
        }
        .logout-link a {
          color: #666;
          text-decoration: underline;
          font-size: 14px;
          cursor: pointer;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Hello!</h1>
        <div class="content-area">
          <div class="button-grid">
            <a href="/jotpad" class="app-button">Jot Pad</a>
            <a href="/letterbox" class="app-button">Letterbox</a>
            <a href="/notes" class="app-button">Notes</a>
            <a href="/settings" class="app-button">Settings</a>
          </div>
        </div>
      </div>
      <div class="logout-link">
        <a href="#" onclick="document.getElementById('logout-form').submit(); return false;">Logout</a>
        <form id="logout-form" method="POST" action="/logout" style="display: none;"></form>
      </div>
    </body>
    </html>
  `);
});

app.get('/login', (req, res) => {
  // Preserve returnTo parameter if passed from signup
  if (req.query.returnTo && !req.session.returnTo) {
    req.session.returnTo = req.query.returnTo;
  }
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Login</title>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        body { 
          font-family: serif; 
          font-size: 18px; 
          margin: 20px; 
          background: white; 
          color: black; 
        }
        .container { 
          max-width: 400px; 
          margin: 0 auto; 
        }
        input, button { 
          width: 100%; 
          padding: 10px; 
          margin: 10px 0; 
          font-size: 16px; 
          border: 2px solid #333; 
          box-sizing: border-box; 
        }
        button { 
          background: #f0f0f0; 
          cursor: pointer; 
        }
        .error { 
          color: red; 
          margin: 10px 0; 
        }
        .success { 
          color: green; 
          margin: 10px 0; 
        }
        .password-container {
          position: relative;
          display: inline-block;
          width: 100%;
        }
        .password-container input {
          padding-right: 50px;
        }
        .toggle-password {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          background: transparent;
          border: none;
          font-size: 12px;
          cursor: pointer;
          width: auto;
          padding: 0;
          margin: 0;
          color: #666;
          text-decoration: underline;
          z-index: 10;
          pointer-events: auto;
        }
        .link { 
          text-align: center; 
          margin: 20px 0; 
        }
        a { 
          color: blue; 
          text-decoration: underline; 
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Login</h1>
        ${req.query.error ? '<div class="error">' + decodeURIComponent(req.query.error) + '</div>' : ''}
        ${req.query.message ? '<div class="success">' + decodeURIComponent(req.query.message) + '</div>' : ''}
        <form method="POST" action="/login">
          <input type="text" name="username" placeholder="Username" required>
          <div class="password-container">
            <input type="text" id="password" name="password" placeholder="Password" required>
            <button type="button" class="toggle-password" onclick="togglePassword()" title="Toggle password visibility">Hide</button>
          </div>
          <button type="submit">Login</button>
        </form>
        <script>
          function togglePassword() {
            const passwordField = document.getElementById('password');
            const toggleButton = document.querySelector('.toggle-password');
            
            if (passwordField.type === 'password') {
              passwordField.type = 'text';
              toggleButton.textContent = 'Hide';
              toggleButton.title = 'Hide password';
            } else {
              passwordField.type = 'password';
              toggleButton.textContent = 'Show';
              toggleButton.title = 'Show password';
            }
          }
        </script>
        <div class="link">
          <a href="/signup">Don't have an account? Sign up</a>
        </div>
      </div>
    </body>
    </html>
  `);
});

app.get('/signup', (req, res) => {
  const username = req.query.username || '';
  const email = req.query.email || '';
  
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Sign Up</title>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        body { 
          font-family: serif; 
          font-size: 18px; 
          margin: 20px; 
          background: white; 
          color: black; 
        }
        .container { 
          max-width: 400px; 
          margin: 0 auto; 
        }
        input, button { 
          width: 100%; 
          padding: 10px; 
          margin: 10px 0; 
          font-size: 16px; 
          border: 2px solid #333; 
          box-sizing: border-box; 
        }
        button { 
          background: #f0f0f0; 
          cursor: pointer; 
        }
        .error { 
          color: red; 
          margin: 10px 0; 
        }
        .password-container {
          position: relative;
          display: inline-block;
          width: 100%;
        }
        .password-container input {
          padding-right: 50px;
        }
        .toggle-password {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          background: transparent;
          border: none;
          font-size: 12px;
          cursor: pointer;
          width: auto;
          padding: 0;
          margin: 0;
          color: #666;
          text-decoration: underline;
          z-index: 10;
          pointer-events: auto;
        }
        .link { 
          text-align: center; 
          margin: 20px 0; 
        }
        a { 
          color: blue; 
          text-decoration: underline; 
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Sign Up</h1>
        ${req.query.error ? '<div class="error">' + decodeURIComponent(req.query.error) + '</div>' : ''}
        <form method="POST" action="/signup">
          <input type="text" name="username" placeholder="Username" value="${username}" required>
          <input type="email" name="email" placeholder="Email" value="${email}" required>
          <div class="password-container">
            <input type="text" id="signup-password" name="password" placeholder="Password" required>
            <button type="button" class="toggle-password" onclick="toggleSignupPassword()" title="Hide password">Hide</button>
          </div>
          <button type="submit">Sign Up</button>
        </form>
        <script>
          function toggleSignupPassword() {
            const passwordField = document.getElementById('signup-password');
            const toggleButton = document.querySelector('.toggle-password');
            
            if (passwordField.type === 'password') {
              passwordField.type = 'text';
              toggleButton.textContent = 'Hide';
              toggleButton.title = 'Hide password';
            } else {
              passwordField.type = 'password';
              toggleButton.textContent = 'Show';
              toggleButton.title = 'Show password';
            }
          }
        </script>
        <div class="link">
          <a href="/login">Already have an account? Login</a>
        </div>
      </div>
    </body>
    </html>
  `);
});

// Redirect root to home
app.get('/', (req, res) => {
  res.redirect('/home');
});

// Authentication routes with Cognito
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.redirect('/login?error=Please enter username and password');
  }

  try {
    const result = await cognitoAuth.signIn(username, password);
    
    if (result.success) {
      req.session.userId = result.username;
      req.session.username = username;
      req.session.accessToken = result.tokens.AccessToken;
      
      // Redirect to original page or default to /home
      const redirectTo = req.session.returnTo || '/home';
      delete req.session.returnTo; // Clear the stored URL
      res.redirect(redirectTo);
    } else {
      res.redirect('/login?error=' + encodeURIComponent(result.error));
    }
  } catch (error) {
    console.error('Login error:', error);
    res.redirect('/login?error=Login failed');
  }
});

app.post('/signup', async (req, res) => {
  const { username, email, password } = req.body;
  
  if (!username || !email || !password) {
    return res.redirect('/signup?error=' + encodeURIComponent('Please enter username, email and password') + 
                       '&username=' + encodeURIComponent(username || '') + 
                       '&email=' + encodeURIComponent(email || ''));
  }

  if (password.length < 8) {
    return res.redirect('/signup?error=' + encodeURIComponent('Password must be at least 8 characters') + 
                       '&username=' + encodeURIComponent(username) + 
                       '&email=' + encodeURIComponent(email));
  }

  try {
    const result = await cognitoAuth.signUp(username, password, email);
    
    if (result.success) {
      // Preserve the returnTo URL for after login
      const returnToParam = req.session.returnTo ? '&returnTo=' + encodeURIComponent(req.session.returnTo) : '';
      res.redirect('/login?message=Account created successfully. Please login.' + returnToParam);
    } else {
      res.redirect('/signup?error=' + encodeURIComponent(result.error) + 
                   '&username=' + encodeURIComponent(username) + 
                   '&email=' + encodeURIComponent(email));
    }
  } catch (error) {
    console.error('Signup error:', error);
    res.redirect('/signup?error=Registration failed');
  }
});

app.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Error destroying session:', err);
    }
    res.redirect('/login');
  });
});

// Jot Pad route
// Letterbox route
app.get('/letterbox', requireAuth, (req, res) => {
  // Mock data for now - will be replaced with real data
  const mockEmails = Array.from({length: 25}, (_, i) => ({
    id: i + 1,
    from: 'user' + (i % 5 + 1) + '@example.com',
    date: new Date(Date.now() - i * 3600000).toLocaleDateString(),
    read: i > 2 // First 3 emails will be unread
  }));

  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Letterbox</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
      font-family: serif;
    }
    
    body {
      background: white;
      color: black;
      max-width: 100%;
      margin: 0;
      padding: 0;
      height: 100vh;
      display: flex;
      flex-direction: column;
    }
    
    .header {
      display: flex;
      justify-content: flex-end;
      padding: 15px 20px;
      background: white;
      position: sticky;
      top: 0;
      z-index: 100;
      flex-shrink: 0;
    }
    
    .btn {
      padding: 8px 12px;
      margin-left: 10px;
      background: white;
      border: 1px solid #333;
      border-radius: 15px;
      cursor: pointer;
      font-size: 14px;
    }
    
    .email-list {
      list-style: none;
      margin: 0;
      padding: 0 20px 20px 20px;
      flex: 1;
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
    }
    
    .email-item {
      padding: 12px 0;
      cursor: pointer;
    }

    .email-from {
      margin-bottom: 4px;
    }
    
    .email-date {
      color: #666;
      font-size: 0.9em;
    }
    
    .pagination {
      display: flex;
      justify-content: center;
      padding: 15px 0;
      background: white;
      border-top: 1px solid #eee;
      flex-shrink: 0;
    }
    
    .pagination button {
      margin: 0 5px;
      padding: 5px 10px;
      background: white;
      border: 1px solid #333;
      cursor: pointer;
    }
    
    .pagination button:disabled {
      opacity: 0.5;
      cursor: default;
    }
    
    .home-link {
      display: block;
      text-align: center;
      margin-top: 20px;
      color: #333;
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="header">
    <button class="btn" id="draftsBtn">Drafts</button>
    <button class="btn" id="composeBtn">Compose</button>
  </div>
  
  <ul class="email-list" id="emailList">
    ${mockEmails.map(email => 
      '<li class="email-item" data-id="' + email.id + '">' +
      '<div class="email-from">' + email.from + '</div>' +
      '<div class="email-date">' + email.date + '</div>' +
      '</li>'
    ).join('')}
  </ul>
  
  <div class="pagination">
    <button id="prevPage" disabled>Previous</button>
    <span id="pageInfo">Page 1</span>
    <button id="nextPage">Next</button>
  </div>
  
  <a href="/home" class="home-link">Back to Home</a>
  
  <script>
    // Simple pagination
    let currentPage = 1;
    const itemsPerPage = 10;
    const emailItems = document.querySelectorAll('.email-item');
    const totalPages = Math.ceil(emailItems.length / itemsPerPage);
    
    function updatePagination() {
      document.getElementById('pageInfo').textContent = 'Page ' + currentPage + ' of ' + totalPages;
      document.getElementById('prevPage').disabled = currentPage === 1;
      document.getElementById('nextPage').disabled = currentPage === totalPages;
      
      const startIdx = (currentPage - 1) * itemsPerPage;
      const endIdx = startIdx + itemsPerPage;
      
      emailItems.forEach((item, index) => {
        item.style.display = (index >= startIdx && index < endIdx) ? 'block' : 'none';
      });
    }
    
    // Event listeners
    document.getElementById('prevPage').addEventListener('click', () => {
      if (currentPage > 1) {
        currentPage--;
        updatePagination();
      }
    });
    
    document.getElementById('nextPage').addEventListener('click', () => {
      if (currentPage < totalPages) {
        currentPage++;
        updatePagination();
      }
    });
    
    // Email click handler
    document.querySelectorAll('.email-item').forEach(item => {
      item.addEventListener('click', () => {
        const emailId = item.getAttribute('data-id');
        // Will be implemented later
        console.log('Viewing email:', emailId);
      });
    });
    
    // Compose button - navigate to compose screen
    document.getElementById('composeBtn').addEventListener('click', () => {
      window.location.href = '/compose';
    });
    
    // Drafts button
    document.getElementById('draftsBtn').addEventListener('click', () => {
      // Will be implemented later
      console.log('View drafts');
    });
    
    // Initialize
    updatePagination();
  </script>
</body>
</html>`);
});

// Compose email route
app.get('/compose', requireAuth, (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Compose Email</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
      font-family: serif;
    }
    
    body {
      background: white;
      color: black;
      height: 100vh;
      display: flex;
      flex-direction: column;
    }
    
    .header {
      display: flex;
      align-items: center;
      padding: 15px 20px;
      background: white;
      position: sticky;
      top: 0;
      z-index: 100;
      flex-shrink: 0;
    }
    
    .back-btn {
      font-size: 24px;
      background: none;
      border: none;
      cursor: pointer;
      padding: 5px 10px;
      margin-right: 10px;
    }
    
    .compose-container {
      flex: 1;
      display: flex;
      flex-direction: column;
      padding: 0 20px;
      margin-top: 20vh; /* Position about 1/3 down the page */
    }
    
    .input-group {
      margin-bottom: 20px;
      position: relative;
    }
    
    label {
      display: block;
      margin-bottom: 5px;
      font-size: 16px;
    }
    
    .write-btn {
      position: absolute;
      right: 0;
      top: 100%;
      margin-top: 10px;
      padding: 8px 16px;
      background: white;
      border: 1px solid #333;
      border-radius: 15px;
      cursor: pointer;
      font-size: 14px;
    }
    
    input[type="text"] {
      width: 100%;
      padding: 10px;
      font-size: 16px;
      border: 1px solid #333;
      border-radius: 4px;
    }
  </style>
</head>
<body>
  <div class="header">
    <button class="back-btn" onclick="window.location.href='/letterbox'">←</button>
  </div>
  
  <div class="compose-container">
    <div class="input-group">
      <label for="to">To:</label>
      <input type="text" id="to" name="to" autocomplete="off">
      <button class="write-btn" id="writeBtn">Write</button>
    </div>
  </div>
  
  <script>
    document.getElementById('writeBtn').addEventListener('click', function() {
      const to = document.getElementById('to').value.trim();
      if (to) {
        window.location.href = '/compose/editor?to=' + encodeURIComponent(to);
      } else {
        window.location.href = '/compose/editor';
      }
    });
  </script>
</body>
</html>`);
});

// Email editor route (exact clone of jotpad)
app.get('/compose/editor', requireAuth, (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Compose Letters</title>
    <link rel="stylesheet" href="/email-editor.css">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: serif;
            background: white;
            height: 100vh;
            overflow: hidden;
        }
        
        .controls {
            position: fixed;
            top: 10px;
            right: 10px;
            z-index: 10;
            display: flex;
            flex-direction: column;
            gap: 5px;
        }
        
        .btn {
            width: 40px;
            height: 40px;
            border: 2px solid #333;
            background: white;
            font-size: 20px;
            font-weight: bold;
            cursor: pointer;
            border-radius: 4px;
        }
        
        .btn:active {
            background: #eee;
        }
        
        #notes {
            width: 100%;
            height: 100vh;
            border: none;
            outline: none;
            padding: 20px;
            padding-bottom: 100vh;
            font-size: 16px;
            font-family: serif;
            line-height: 1.4;
            resize: none;
            background: white;
        }
        
        .comma-btn {
            position: fixed;
            right: 10px;
            bottom: 0px;
            width: 50px;
            height: 40px;
            border: 2px solid #333;
            background: white;
            font-size: 24px;
            font-weight: bold;
            cursor: pointer;
            border-radius: 4px;
            z-index: 10;
        }
        
        .comma-btn:active {
            background: #eee;
        }
    </style>
</head>
<body>
    <div class="controls">
        <a href="/compose" class="btn" style="text-decoration: none; color: black; display: flex; align-items: center; justify-content: center; padding: 0;">←</a>
        <button class="btn" onclick="changeFontSize(3)">+</button>
        <button class="btn" onclick="changeFontSize(-3)">-</button>
        <button class="btn" onclick="hideKeyboard()">⌨</button>
        <button class="checkmark-btn" id="sendCheckmark" onclick="event.stopPropagation(); toggleSendPopup()">✓</button>
    </div>
    
    <div class="send-popup" id="sendPopup">
        <p id="recipientDisplay">To: </p>
        <button class="send-btn" onclick="sendEmail()">Send</button>
    </div>
    
    <textarea id="notes" placeholder="Start writing your letter here..."></textarea>
    
    <button id="commaBtn" class="comma-btn" onclick="insertComma()" style="display: none;">,</button>
    
    <script>
        let fontSize = 19;
        const textarea = document.getElementById('notes');
        
        function changeFontSize(delta) {
            fontSize += delta;
            if (fontSize < 8) fontSize = 8;
            if (fontSize > 48) fontSize = 48;
            textarea.style.fontSize = fontSize + 'px';
            localStorage.setItem('fontSize', fontSize);
        }
        
        function hideKeyboard() {
            textarea.blur();
            document.getElementById('commaBtn').style.display = 'none';
        }
        
        function insertComma() {
            const cursorPos = textarea.selectionStart;
            const textBefore = textarea.value.substring(0, cursorPos);
            const textAfter = textarea.value.substring(cursorPos);
            textarea.value = textBefore + ',' + textAfter;
            textarea.setSelectionRange(cursorPos + 1, cursorPos + 1);
            textarea.focus();
            localStorage.setItem('emailDraft', textarea.value);
        }
        
        // Show comma button when typing
        textarea.addEventListener('input', function() {
            document.getElementById('commaBtn').style.display = 'block';
            localStorage.setItem('emailDraft', this.value);
        });
        
        // Initialize
        const savedNotes = localStorage.getItem('emailDraft');
        if (savedNotes) {
            textarea.value = savedNotes;
        }
        
        const savedFontSize = localStorage.getItem('fontSize');
        if (savedFontSize) {
            fontSize = parseInt(savedFontSize);
            textarea.style.fontSize = fontSize + 'px';
        } else {
            textarea.style.fontSize = fontSize + 'px';
        }
        
        // Handle keyboard show/hide on mobile
        textarea.addEventListener('focus', function() {
            document.getElementById('commaBtn').style.display = 'block';
        });
        
        textarea.addEventListener('blur', function() {
            setTimeout(() => {
                if (!document.activeElement || document.activeElement.id !== 'commaBtn') {
                    document.getElementById('commaBtn').style.display = 'none';
                }
            }, 200);
        });
        
        // Get URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        const recipient = urlParams.get('to') || '';
        const sendPopup = document.getElementById('sendPopup');
        const recipientDisplay = document.getElementById('recipientDisplay');
        
        // Set recipient in display
        if (recipient) {
            recipientDisplay.textContent = 'To: ' + decodeURIComponent(recipient);
        } else {
            // If no recipient, go back to compose screen
            window.location.href = '/compose';
        }
        
        // Toggle send popup
        window.toggleSendPopup = function(event) {
            if (event) event.stopPropagation();
            if (sendPopup.style.display === 'block') {
                sendPopup.style.display = 'none';
            } else {
                sendPopup.style.display = 'block';
            }
        };
        
        // Send email function
        window.sendEmail = function() {
            // For now, just clear the editor and go back to letterbox
            localStorage.removeItem('emailDraft');
            window.location.href = '/letterbox';
        };
        
        // Close popup when clicking outside
        document.addEventListener('click', function() {
            sendPopup.style.display = 'none';
        });
        
        // Stop propagation for popup clicks
        sendPopup.addEventListener('click', function(event) {
            event.stopPropagation();
        });
    </script>
</body>
</html>`);
});

app.get('/jotpad', requireAuth, (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Notes</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: serif;
            background: white;
            height: 100vh;
            overflow: hidden;
        }
        
        .controls {
            position: fixed;
            top: 10px;
            right: 10px;
            z-index: 10;
            display: flex;
            flex-direction: column;
            gap: 5px;
        }
        
        .btn {
            width: 40px;
            height: 40px;
            border: 2px solid #333;
            background: white;
            font-size: 20px;
            font-weight: bold;
            cursor: pointer;
            border-radius: 4px;
        }
        
        .btn:active {
            background: #eee;
        }
        
        #notes {
            width: 100%;
            height: 100vh;
            border: none;
            outline: none;
            padding: 20px;
            padding-bottom: 100vh; /* Add space so first lines can scroll */
            font-size: 16px;
            font-family: serif;
            line-height: 1.4;
            resize: none;
            background: white;
        }
        
        .comma-btn {
            position: fixed;
            right: 10px;
            bottom: 0px;
            width: 50px;
            height: 40px;
            border: 2px solid #333;
            background: white;
            font-size: 24px;
            font-weight: bold;
            cursor: pointer;
            border-radius: 4px;
            z-index: 10;
        }
        
        .comma-btn:active {
            background: #eee;
        }
    </style>
</head>
<body>
    <div class="controls">
        <a href="/home" class="btn" style="text-decoration: none; color: black; display: flex; align-items: center; justify-content: center; padding: 0;">⌂</a>
        <button class="btn" onclick="changeFontSize(3)">+</button>
        <button class="btn" onclick="changeFontSize(-3)">-</button>
        <button class="btn" onclick="hideKeyboard()">⌨</button>
    </div>
    
    <textarea id="notes" placeholder="Start typing your notes..."></textarea>
    
    <button id="commaBtn" class="comma-btn" onclick="insertComma()" style="display: none;">,</button>
    
    <script>
        let fontSize = 19;
        const textarea = document.getElementById('notes');
        
        function changeFontSize(delta) {
            fontSize += delta;
            if (fontSize < 8) fontSize = 8;
            if (fontSize > 48) fontSize = 48;
            textarea.style.fontSize = fontSize + 'px';
            localStorage.setItem('fontSize', fontSize);
        }
        
        function hideKeyboard() {
            textarea.blur(); // Remove focus to hide keyboard
            textarea.style.marginTop = '0px'; // Clear any margin padding
            document.getElementById('commaBtn').style.display = 'none'; // Hide comma button
        }
        
        function insertComma() {
            const cursorPos = textarea.selectionStart;
            const textBefore = textarea.value.substring(0, cursorPos);
            const textAfter = textarea.value.substring(cursorPos);
            textarea.value = textBefore + ',' + textAfter;
            textarea.setSelectionRange(cursorPos + 1, cursorPos + 1); // Move cursor after comma
            textarea.focus(); // Keep focus on textarea
            localStorage.setItem('notes', textarea.value); // Save to localStorage
        }
        
        function showCommaButton() {
            document.getElementById('commaBtn').style.display = 'block';
        }
        
        // Auto-save to localStorage
        textarea.addEventListener('input', function() {
            localStorage.setItem('notes', this.value);
            snapToKeyboard();
            showCommaButton(); // Show comma button after first keystroke
        });
        
        
        // Simple: snap cursor line to bottom of viewport when typing
        function snapToKeyboard() {
            const cursorPosition = textarea.selectionStart;
            const textBeforeCursor = textarea.value.substring(0, cursorPosition);
            const lines = textBeforeCursor.split('\\n');
            const currentLine = lines.length;
            
            // Calculate how much space we need above to position cursor line at bottom
            const lineHeight = parseInt(getComputedStyle(textarea).lineHeight);
            const linesNeededToFillScreen = Math.ceil(window.innerHeight / lineHeight);
            
            if (currentLine < linesNeededToFillScreen) {
                // Add margin-top to push content down so cursor line appears at bottom
                const marginNeeded = window.innerHeight - (currentLine * lineHeight);
                textarea.style.marginTop = Math.max(0, marginNeeded) + 'px';
            } else {
                // Remove margin and use normal scrolling for longer content
                textarea.style.marginTop = '0px';
                const cursorY = (currentLine - 1) * lineHeight + 20;
                const targetY = cursorY - window.innerHeight + lineHeight;
                textarea.scrollTop = targetY;
            }
        }
        
        // Load saved notes and font size
        const saved = localStorage.getItem('notes');
        if (saved) {
            textarea.value = saved;
        }
        
        const savedFontSize = localStorage.getItem('fontSize');
        if (savedFontSize) {
            fontSize = parseInt(savedFontSize);
            textarea.style.fontSize = fontSize + 'px';
        }
        
        // Focus the textarea on load
        textarea.focus();
    </script>
</body>
</html>`);
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log('Note: AWS Cognito integration needs to be configured');
});
