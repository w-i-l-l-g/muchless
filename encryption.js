/**
 * Encryption utilities for securing sensitive data
 * Implements AES-256-GCM encryption for data at rest
 */

const crypto = require('crypto');

// Encryption key should be stored in environment variables
// Must be 32 bytes (256 bits) for AES-256-GCM
const getEncryptionKey = () => {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    console.error('WARNING: ENCRYPTION_KEY environment variable not set. Using fallback key.');
    // Fallback key for development only - NEVER use in production
    return 'muchless-insecure-fallback-dev-key!';
  }
  return key;
};

// IV length for AES is always 16 bytes
const IV_LENGTH = 16;

/**
 * Encrypts text using AES-256-GCM
 * 
 * @param {string} text - Plain text to encrypt
 * @returns {string} - Format: iv:encryptedData:authTag
 */
function encrypt(text) {
  if (!text) return text; // Don't encrypt empty strings or null values

  try {
    // Generate a random initialization vector
    const iv = crypto.randomBytes(IV_LENGTH);
    
    // Create cipher using encryption key and IV
    const cipher = crypto.createCipheriv(
      'aes-256-gcm', 
      Buffer.from(getEncryptionKey().slice(0, 32)), // Ensure key is 32 bytes
      iv
    );
    
    // Encrypt the text
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Get authentication tag for integrity verification
    const authTag = cipher.getAuthTag().toString('hex');
    
    // Return iv:encryptedData:authTag
    return `${iv.toString('hex')}:${encrypted}:${authTag}`;
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt data');
  }
}

/**
 * Decrypts text using AES-256-GCM
 * 
 * @param {string} text - Encrypted text in format: iv:encryptedData:authTag
 * @returns {string} - Decrypted plain text
 */
function decrypt(text) {
  if (!text || !text.includes(':')) return text; // Handle empty or invalid formats
  
  try {
    // Split the components
    const parts = text.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted format');
    }
    
    const iv = Buffer.from(parts[0], 'hex');
    const encryptedText = parts[1];
    const authTag = Buffer.from(parts[2], 'hex');
    
    // Create decipher
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      Buffer.from(getEncryptionKey().slice(0, 32)), // Ensure key is 32 bytes
      iv
    );
    
    // Set auth tag for verification
    decipher.setAuthTag(authTag);
    
    // Decrypt the text
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt data');
  }
}

/**
 * Test if encryption/decryption is working properly
 */
function testEncryption() {
  try {
    const originalText = 'This is a test message for encryption';
    const encrypted = encrypt(originalText);
    const decrypted = decrypt(encrypted);
    
    const success = originalText === decrypted;
    
    console.log('Encryption test result:', success ? 'SUCCESS' : 'FAILED');
    console.log('Original:', originalText);
    console.log('Encrypted:', encrypted);
    console.log('Decrypted:', decrypted);
    
    return success;
  } catch (error) {
    console.error('Encryption test failed:', error);
    return false;
  }
}

module.exports = {
  encrypt,
  decrypt,
  testEncryption
};
