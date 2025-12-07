const { OAuth2Client } = require('google-auth-library');

// Validate required environment variables
const requiredEnvVars = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0 && process.env.NODE_ENV !== 'test') {
    console.error(`Missing required environment variables: ${missingVars.join(', ')}`);
    if (process.env.NODE_ENV === 'production') {
        process.exit(1);
    }
}

const googleOAuthConfig = {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectUri: process.env.NODE_ENV === 'production' 
        ? (process.env.GOOGLE_REDIRECT_URI_PROD || "https://kare-bus-management-system.onrender.com/auth/google/callback")
        : process.env.GOOGLE_REDIRECT_URI || "http://localhost:3000/auth/google/callback",
    authUri: "https://accounts.google.com/o/oauth2/auth",
    tokenUri: "https://oauth2.googleapis.com/token",
    scopes: [
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile'
    ]
};

const oAuth2Client = new OAuth2Client(
    googleOAuthConfig.clientId,
    googleOAuthConfig.clientSecret,
    googleOAuthConfig.redirectUri
);

// Generate Google OAuth URL
const getAuthUrl = () => {
    return oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: googleOAuthConfig.scopes,
        prompt: 'consent'
    });
};

// Get user info from Google
const getUserInfo = async (code) => {
    try {
        const { tokens } = await oAuth2Client.getToken(code);
        oAuth2Client.setCredentials(tokens);
        
        // Get user info directly using the access token instead of ID token verification
        const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: {
                'Authorization': `Bearer ${tokens.access_token}`
            }
        });
        
        if (!response.ok) {
            throw new Error(`Failed to fetch user info: ${response.statusText}`);
        }
        
        const userData = await response.json();
        
        return {
            googleId: userData.id,
            email: userData.email,
            name: userData.name,
            picture: userData.picture
        };
    } catch (error) {
        console.error('Error getting user info from Google:', error);
        throw error;
    }
};

module.exports = {
    googleOAuthConfig,
    oAuth2Client,
    getAuthUrl,
    getUserInfo
};
