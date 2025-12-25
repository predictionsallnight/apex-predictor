// Serverless function to activate account with whitelist code
// Uses Firebase Admin SDK - complete server-side control!

const admin = require('firebase-admin');

// Initialize Firebase Admin
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
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { email, password, whitelistCode } = req.body;

        // Validate inputs
        if (!email || !password || password.length < 6) {
            return res.status(400).json({ error: 'Email and password (min 6 chars) required' });
        }

        if (!whitelistCode) {
            return res.status(400).json({ error: 'Whitelist code required' });
        }

        if (!db) {
            return res.status(500).json({ error: 'Database not initialized. Please add FIREBASE_SERVICE_ACCOUNT to Vercel environment variables.' });
        }

        // Verify whitelist code
        const codeDoc = await db.collection('whitelist_codes').doc(whitelistCode).get();
        
        if (!codeDoc.exists) {
            return res.status(400).json({ error: 'Invalid whitelist code' });
        }

        const codeData = codeDoc.data();
        
        if (codeData.used === true) {
            return res.status(400).json({ error: 'This whitelist code has already been used' });
        }

        email = String(email).trim().toLowerCase();
        password = String(password).trim();

        // Check if email already exists
        const existingUsers = await db.collection('users')
            .where('email', '==', email)
            .limit(1)
            .get();
        
        if (!existingUsers.empty) {
            return res.status(400).json({ error: 'This email is already registered' });
        }

        // Generate UID
        const uid = email.replace(/[^a-z0-9]/g, '_') + '_' + Date.now();

        // Create user in Firestore
        await db.collection('users').doc(uid).set({
            email: email,
            password: password, // In production, hash this!
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            active: true,
            whitelistCode: whitelistCode
        });

        // Add to whitelist
        await db.collection('whitelist').doc(uid).set({
            email: email,
            active: true,
            tier: 'premium',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            purchased: true,
            purchaseDate: admin.firestore.FieldValue.serverTimestamp(),
            whitelistCode: whitelistCode
        });

        // Mark code as used
        await db.collection('whitelist_codes').doc(whitelistCode).update({
            used: true,
            usedAt: admin.firestore.FieldValue.serverTimestamp(),
            userId: uid,
            email: email
        });

        console.log('✅ Account activated:', uid, email);

        return res.status(200).json({ 
            success: true,
            uid: uid,
            email: email,
            message: 'Account activated successfully' 
        });

    } catch (error) {
        console.error('Error activating account:', error);
        return res.status(500).json({ 
            error: error.message || 'Failed to activate account' 
        });
    }
}

