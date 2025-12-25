// Auto-generate whitelist code when payment is confirmed
// Called when user lands on confirm page with payment session_id

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

// Generate random code
function generateCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No confusing chars
    let code = '';
    for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { paymentSessionId } = req.body;

        if (!paymentSessionId) {
            return res.status(400).json({ error: 'Payment session ID required' });
        }

        if (!db) {
            return res.status(500).json({ error: 'Database not initialized' });
        }

        // Check if code already exists for this payment session
        const existingCodes = await db.collection('whitelist_codes')
            .where('paymentSessionId', '==', paymentSessionId)
            .where('used', '==', false)
            .limit(1)
            .get();

        if (!existingCodes.empty) {
            const existingCode = existingCodes.docs[0];
            return res.status(200).json({
                success: true,
                code: existingCode.id,
                message: 'Code already generated for this payment'
            });
        }

        // Generate unique code
        let code;
        let exists = true;
        let attempts = 0;
        
        while (exists && attempts < 20) {
            code = generateCode();
            const codeDoc = await db.collection('whitelist_codes').doc(code).get();
            exists = codeDoc.exists;
            attempts++;
        }

        if (exists) {
            return res.status(500).json({ error: 'Failed to generate unique code' });
        }

        // Create code in Firestore
        await db.collection('whitelist_codes').doc(code).set({
            code: code,
            paymentSessionId: paymentSessionId,
            created: admin.firestore.FieldValue.serverTimestamp(),
            used: false
        });

        console.log('✅ Code generated:', code, 'for payment:', paymentSessionId);

        return res.status(200).json({ 
            success: true,
            code: code,
            message: 'Whitelist code generated successfully'
        });

    } catch (error) {
        console.error('Error generating code:', error);
        return res.status(500).json({ 
            error: error.message || 'Failed to generate code' 
        });
    }
}

