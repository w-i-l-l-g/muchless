const AWS = require('aws-sdk');
const { CognitoIdentityServiceProvider } = AWS;

// Configure AWS
AWS.config.update({
  region: process.env.AWS_REGION || 'us-east-1'
});

const cognito = new CognitoIdentityServiceProvider();

class CognitoAuth {
  constructor() {
    this.userPoolId = process.env.COGNITO_USER_POOL_ID;
    this.clientId = process.env.COGNITO_CLIENT_ID;
    this.clientSecret = process.env.COGNITO_CLIENT_SECRET;
  }

  // Helper to calculate secret hash if client secret is provided
  calculateSecretHash(username) {
    if (!this.clientSecret) return undefined;
    
    const crypto = require('crypto');
    const message = username + this.clientId;
    const hash = crypto.createHmac('SHA256', this.clientSecret)
                      .update(message)
                      .digest('base64');
    return hash;
  }

  async signUp(username, password, email) {
    try {
      const params = {
        ClientId: this.clientId,
        Username: username,
        Password: password,
        UserAttributes: [
          {
            Name: 'email',
            Value: email
          }
        ],
        SecretHash: this.calculateSecretHash(username)
      };

      const result = await cognito.signUp(params).promise();
      return { success: true, data: result };
    } catch (error) {
      console.error('SignUp error:', error);
      return { success: false, error: error.message };
    }
  }

  async signIn(username, password) {
    try {
      const params = {
        AuthFlow: 'USER_PASSWORD_AUTH',
        ClientId: this.clientId,
        AuthParameters: {
          USERNAME: username,
          PASSWORD: password,
          SECRET_HASH: this.calculateSecretHash(username)
        }
      };

      const result = await cognito.initiateAuth(params).promise();
      
      if (result.AuthenticationResult) {
        return { 
          success: true, 
          tokens: result.AuthenticationResult,
          username: username
        };
      } else {
        return { success: false, error: 'Authentication failed' };
      }
    } catch (error) {
      console.error('SignIn error:', error);
      return { success: false, error: error.message };
    }
  }

  async confirmSignUp(username, confirmationCode) {
    try {
      const params = {
        ClientId: this.clientId,
        Username: username,
        ConfirmationCode: confirmationCode,
        SecretHash: this.calculateSecretHash(username)
      };

      await cognito.confirmSignUp(params).promise();
      return { success: true };
    } catch (error) {
      console.error('ConfirmSignUp error:', error);
      return { success: false, error: error.message };
    }
  }

  async getUser(accessToken) {
    try {
      const params = {
        AccessToken: accessToken
      };

      const result = await cognito.getUser(params).promise();
      return { success: true, user: result };
    } catch (error) {
      console.error('GetUser error:', error);
      return { success: false, error: error.message };
    }
  }

  async adminConfirmSignUp(username) {
    try {
      const params = {
        UserPoolId: this.userPoolId,
        Username: username
      };

      await cognito.adminConfirmSignUp(params).promise();
      return { success: true };
    } catch (error) {
      console.error('AdminConfirmSignUp error:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = CognitoAuth;
