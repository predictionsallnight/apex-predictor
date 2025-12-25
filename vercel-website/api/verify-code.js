// Serverless function to verify whitelist code
const admin = require('firebase-admin');

let db;
if (!admin.apps.length) {
    try {
        const serviceAccount = typeof process.env.FIREBASE_SERVICE_ACCOUNT === 'string' 
            ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
            : process.env.FIREBASE_SERVICE_ACCOUNT;
        
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            projectId: 'apexpred-77460'
        });
        
        db = admin.firestore();
    } catch (error) {
        console.error('Firebase Admin init error:', error);
    }
} else {
    db = admin.firestore();
}

module.exports = async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { code } = req.query;

        if (!code) {
            return res.status(400).json({ error: 'Code required' });
        }

        if (!db) {
            return res.status(500).json({ error: 'Database not initialized' });
        }

        const codeDoc = await db.collection('whitelist_codes').doc(code).get();
        
        if (!codeDoc.exists) {
            return res.status(404).json({ error: 'Invalid code', valid: false });
        }

        const codeData = codeDoc.data();
        
        return res.status(200).json({ 
            valid: true,
            used: codeData.used === true,
            code: code
        });

    } catch (error) {
        console.error('Error verifying code:', error);
        return res.status(500).json({ 
            error: error.message || 'Failed to verify code' 
        });
    }
}

