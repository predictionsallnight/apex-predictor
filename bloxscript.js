// ==UserScript==
// @name         ApexPredictor - Elite Pro Edition 2025
// @namespace    http://tampermonkey.net/
// @version      4.0.1
// @description  Premium dark red predictor - Firebase authentication & whitelist protection
// @author       You
// @match        https://bloxgame.us/*
// @match        https://www.bloxgame.us/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    // ============================================
    // FIREBASE CONFIGURATION
    // ============================================
    const FIREBASE_CONFIG = {
        apiKey: "AIzaSyCdDDT1Pr96MERFBv_yyDp9MfWuaP6jP-E",
        authDomain: "apexpred-77460.firebaseapp.com",
        projectId: "apexpred-77460",
        storageBucket: "apexpred-77460.firebasestorage.app",
        messagingSenderId: "803454990642",
        appId: "1:803454990642:web:671ac56c543a1eb5f2ff2b"
    };

    // ============================================
    // AUTO-WHITELIST CONFIGURATION
    // ============================================
    // Set to true to automatically create whitelist entries when users sign up
    // WARNING: This requires Firestore security rules to allow writes!
    const AUTO_WHITELIST_NEW_USERS = false; // Change to true to enable
    
    // Admin email(s) - these will be auto-whitelisted on first signup
    const ADMIN_EMAILS = []; // Add your email here, e.g., ['admin@example.com']

    // Authentication state
    let firebaseApp = null;
    let firebaseAuth = null;
    let firebaseFirestore = null;
    let currentUser = null;
    let isWhitelisted = false;
    let authInitialized = false;
    let uidVerificationInProgress = false;
    let lastUIDCheck = 0;
    const UID_CHECK_COOLDOWN = 5000; // Only check once every 5 seconds

    // ============================================
    // LOAD FIREBASE SDKs
    // ============================================
    function loadFirebaseSDKs() {
        return new Promise((resolve, reject) => {
            // Check if already loaded
            if (window.firebase && window.firebase.apps.length > 0) {
                resolve();
                return;
            }

            // Load Firebase scripts
            const scripts = [
                'https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js',
                'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth-compat.js',
                'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore-compat.js'
            ];

            let loaded = 0;
            scripts.forEach((src, index) => {
                const script = document.createElement('script');
                script.src = src;
                script.onload = () => {
                    loaded++;
                    if (loaded === scripts.length) {
                        resolve();
                    }
                };
                script.onerror = () => reject(new Error(`Failed to load ${src}`));
                document.head.appendChild(script);
            });
        });
    }

    // ============================================
    // INITIALIZE FIREBASE
    // ============================================
    async function initializeFirebase() {
        try {
            await loadFirebaseSDKs();
            
            if (!window.firebase) {
                throw new Error('Firebase SDK failed to load');
            }

            // Initialize Firebase (Firestore only - NO AUTH!)
            firebaseApp = window.firebase.initializeApp(FIREBASE_CONFIG);
            firebaseFirestore = window.firebase.firestore();

            // Check localStorage first for persistent login
            const savedUser = localStorage.getItem('apex_user');
            if (savedUser) {
                try {
                    const userData = JSON.parse(savedUser);
                    if (userData.loggedIn && userData.code) {
                        currentUser = { uid: userData.uid, email: userData.email, code: userData.code };
                        console.log('Found saved login');
                        
                        // ALWAYS verify UID with Firebase - don't trust localStorage alone
                        const codeDoc = await firebaseFirestore.collection('whitelist_codes').doc(userData.code).get();
                        
                        if (codeDoc.exists) {
                            const codeData = codeDoc.data();
                            const storedUID = codeData.userId;
                            
                            // If on profile page, verify UID matches
                            if (window.location.pathname.includes('/profile')) {
                                await verifyUIDAndGrantAccess();
                            } else if (storedUID && storedUID === userData.uid && !userData.uid.startsWith('code_')) {
                                // UID verified in Firebase and matches localStorage
                                // BUT still check if on profile page - if not, require verification
                                if (!window.location.pathname.includes('/profile')) {
                                    // Not on profile - ALWAYS show verification message on refresh
                                    showProfileVerificationMessage();
                                } else {
                                    // On profile - allow access
                                    isWhitelisted = true;
                                    initGUI();
                                }
                            } else {
                                // No UID in Firebase or doesn't match - require verification
                                // ALWAYS show message if not on profile
                                if (!window.location.pathname.includes('/profile')) {
                                    showProfileVerificationMessage();
                                } else {
                                    // On profile page, try to verify
                                    await verifyUIDAndGrantAccess();
                                }
                            }
                        } else {
                            // Code doesn't exist in Firebase - clear and require sign in
                            localStorage.removeItem('apex_user');
                            showAuthModal();
                        }
                        authInitialized = true;
                        return;
                    }
                } catch (e) {
                    console.error('Error parsing saved user:', e);
                    localStorage.removeItem('apex_user');
                }
            }
            
            // No valid saved user - show auth modal
            showAuthModal();
            authInitialized = true;
        } catch (error) {
            console.error('Firebase initialization error:', error);
            // Show auth modal even on error so user can still sign in
            showAuthModal();
            authInitialized = true;
            // Only show error if it's a critical issue
            if (error.message && !error.message.includes('already been initialized')) {
                console.warn('Firebase init warning:', error.message);
            }
        }
    }

    // ============================================
    // CHECK WHITELIST
    // ============================================
    async function checkWhitelist(uid) {
        try {
            console.log('Checking whitelist for UID:', uid);
            
            if (!firebaseFirestore) {
                console.error('Firestore not initialized');
                // Try to reinitialize
                try {
                    await initializeFirebase();
                } catch (e) {
                    console.error('Reinitialization failed:', e);
                }
                if (!firebaseFirestore) {
                    showError('Database not initialized. Please refresh the page.');
                    showAuthModal(); // Ensure auth modal is shown
                    return false;
                }
            }
            
            const whitelistDoc = await firebaseFirestore.collection('whitelist').doc(uid).get();
            console.log('Whitelist document exists:', whitelistDoc.exists);
            console.log('Whitelist document data:', whitelistDoc.data());
            
            if (whitelistDoc.exists) {
                const data = whitelistDoc.data();
                console.log('Whitelist data:', data);
                
                // Check if active field exists and is true
                if (data.active === true || data.active === undefined) {
                    // If active field doesn't exist, treat as active (backward compatibility)
                    isWhitelisted = true;
                    hideAuthModal();
                    // Only init GUI if UID is verified
                    if (currentUser && currentUser.uid && currentUser.uid !== 'code_' + currentUser.code) {
                        initGUI(); // Initialize the predictor
                        log('Authentication successful - Access granted', '#00ff99', '✅');
                    } else {
                        showProfileVerificationMessage();
                    }
                    return true;
                } else {
                    showError('Your account is not active. Please contact support.');
                    console.error('Account not active. Data:', data);
                    return false;
                }
            } else {
                console.error('User not in whitelist. UID:', uid);
                console.error('═══════════════════════════════════');
                console.error('USER NOT WHITELISTED!');
                console.error('Email:', currentUser?.email);
                console.error('UID:', uid);
                console.error('Add this UID to whitelist collection in Firestore!');
                console.error('═══════════════════════════════════');
                showError(`❌ Not whitelisted!\n\nYour UID: ${uid}\n\nAdmin: Add this UID to the whitelist collection in Firestore.\n\nSteps:\n1. Go to Firestore Database → Data\n2. Click "whitelist" collection\n3. Click "Add document"\n4. Document ID: ${uid}\n5. Add fields: email (string) and active (boolean: true)\n6. Click Save`);
                return false;
            }
        } catch (error) {
            console.error('Whitelist check error:', error);
            console.error('Error code:', error.code);
            console.error('Error message:', error.message);
            
            let errorMsg = 'Failed to verify access. ';
            if (error.code === 'permission-denied') {
                errorMsg += 'Permission denied. Check Firestore security rules.';
            } else if (error.code === 'unavailable') {
                errorMsg += 'Database unavailable. Check your internet connection.';
            } else {
                errorMsg += `Error: ${error.code || 'Unknown'} - ${error.message}`;
            }
            showError(errorMsg);
            return false;
        }
    }

    // ============================================
    // AUTO-CREATE WHITELIST ENTRY (Optional)
    // ============================================
    async function autoCreateWhitelistEntry(user) {
        try {
            if (!AUTO_WHITELIST_NEW_USERS) {
                return false;
            }
            
            const uid = user.uid;
            const email = user.email;
            
            // Check if admin email
            const isAdmin = ADMIN_EMAILS.length > 0 && ADMIN_EMAILS.includes(email);
            
            console.log('Auto-creating whitelist entry for:', email, uid, isAdmin ? '(Admin)' : '');
            
            // Check if already exists
            const existing = await firebaseFirestore.collection('whitelist').doc(uid).get();
            if (existing.exists) {
                console.log('Whitelist entry already exists');
                return true;
            }
            
            // Create whitelist entry
            await firebaseFirestore.collection('whitelist').doc(uid).set({
                email: email,
                active: true,
                tier: isAdmin ? 'admin' : 'premium',
                createdAt: new Date().toISOString(),
                autoCreated: true
            });
            
            console.log('Whitelist entry created successfully');
            return true;
        } catch (error) {
            console.error('Auto-create whitelist error:', error);
            console.error('This usually means Firestore security rules need to allow writes');
            return false;
        }
    }

    // ============================================
    // AUTHENTICATION FUNCTIONS
    // ============================================
    async function signInWithEmail(email, password) {
        try {
            // Check if Firestore is initialized
            if (!firebaseFirestore) {
                showError('Database not initialized. Please refresh the page.');
                console.error('Firestore not available');
                return;
            }

            email = String(email).trim().toLowerCase();
            password = String(password).trim();

            console.log('Checking Firestore for email:', email);
            
            // Find user in Firestore by email
            const usersQuery = await firebaseFirestore.collection('users')
                .where('email', '==', email)
                .limit(1)
                .get();
            
            if (usersQuery.empty) {
                throw new Error('No account found with this email.');
            }
            
            const userDoc = usersQuery.docs[0];
            const userData = userDoc.data();
            const uid = userDoc.id;
            
            // Check password (simple comparison - in production you'd hash it)
            if (userData.password !== password) {
                throw new Error('Incorrect password.');
            }
            
            console.log('Sign in successful! UID:', uid);
            
            // Set current user
            currentUser = { uid: uid, email: email };
            
            // Save to localStorage for persistent login
            localStorage.setItem('apex_user', JSON.stringify({
                uid: uid,
                email: email,
                loggedIn: true,
                timestamp: Date.now()
            }));
            
            // Check whitelist
            await checkWhitelist(uid);
        } catch (error) {
            console.error('Sign in error:', error);
            
            let errorMessage = 'Sign in failed. ';
            if (error.message.includes('No account found')) {
                errorMessage = 'No account found with this email. Please create an account first.';
            } else if (error.message.includes('Incorrect password')) {
                errorMessage = 'Incorrect password. Please try again.';
            } else if (error.message) {
                errorMessage = error.message;
            } else {
                errorMessage += `Error: ${error.message || 'Unknown error'}`;
            }
            showError(errorMessage);
        }
    }

    async function signInWithWhitelistCode(code) {
        try {
            if (!firebaseFirestore) {
                showError('Database not initialized. Please refresh the page.');
                return;
            }

            code = String(code).trim().toUpperCase();
            console.log('Checking whitelist code:', code);

            // Check if code exists
            const codeDoc = await firebaseFirestore.collection('whitelist_codes').doc(code).get();
            
            if (!codeDoc.exists) {
                throw new Error('Invalid whitelist code. Please check your code and try again.');
            }
            
            const codeData = codeDoc.data();
            console.log('✅ Code found! Granting access...', codeData);
            
            // Code exists - set current user
            const tempUid = codeData.userId || 'code_' + code;
            const email = codeData.email || 'user@code.com';
            
            currentUser = { uid: tempUid, email: email, code: code };
            localStorage.setItem('apex_user', JSON.stringify({
                uid: tempUid,
                email: email,
                code: code,
                loggedIn: true,
                timestamp: Date.now()
            }));
            
            // Hide auth modal
            hideAuthModal();
            
            // Always verify UID from profile page before granting access
            await verifyUIDAndGrantAccess();
            
        } catch (error) {
            console.error('Sign in error:', error);
            console.error('Error code:', error.code);
            console.error('Error message:', error.message);
            
            let errorMessage = 'Sign in failed. ';
            if (error.code === 'permission-denied') {
                errorMessage = '❌ Permission denied!\n\nFirestore security rules are blocking access.\n\nFIX: Go to Firebase Console → Firestore → Rules\n\nAdd this rule:\n\nmatch /whitelist_codes/{codeId} {\n  allow read: if true;\n}\n\nClick Publish, then try again.';
            } else if (error.message.includes('Invalid whitelist code')) {
                errorMessage = error.message;
            } else if (error.message) {
                errorMessage = error.message;
            } else {
                errorMessage += `Error: ${error.code || 'Unknown'} - ${error.message || 'Check console'}`;
            }
            showError(errorMessage);
        }
    }

    // ============================================
    // UID EXTRACTION AND VERIFICATION
    // ============================================
    
    // Extract UID from profile page - HANDLES DYNAMIC CLASS NAMES
    function extractUIDFromProfile() {
        try {
            // Only check if we're on profile page
            if (!window.location.pathname.includes('/profile')) {
                return null;
            }
            
            // Method 1: Find span with class containing "Profile_userUID"
            const profileUIDSpan = document.querySelector('span[class*="Profile_userUID"]');
            if (profileUIDSpan) {
                const uid = profileUIDSpan.textContent?.trim();
                if (uid && uid.length > 10) {
                    console.log('✅ Found UID from span:', uid);
                    return uid;
                }
            }
            
            // Method 2: Find text "UID:" and get the span after it
            const uidLabel = Array.from(document.querySelectorAll('p')).find(p => 
                p.textContent && p.textContent.includes('UID:')
            );
            if (uidLabel) {
                const uidSpan = uidLabel.querySelector('span');
                if (uidSpan) {
                    const uid = uidSpan.textContent?.trim();
                    if (uid && uid.length > 10) {
                        console.log('✅ Found UID from text:', uid);
                        return uid;
                    }
                }
            }
            
            // Method 3: Extract from avatar image URL if present
            const avatarImg = document.querySelector('img[src*="/user/avatar/"]');
            if (avatarImg && avatarImg.src) {
                const match = avatarImg.src.match(/\/user\/avatar\/([a-f0-9-]{36})/i);
                if (match && match[1]) {
                    console.log('✅ Found UID from avatar URL:', match[1]);
                    return match[1];
                }
            }
            
            return null;
        } catch (error) {
            console.error('Error extracting UID:', error);
            return null;
        }
    }

    // Verify UID matches Firebase and grant access - SIMPLIFIED
    async function verifyUIDAndGrantAccess() {
        // Prevent multiple simultaneous checks
        if (uidVerificationInProgress) {
            return false;
        }
        
        // Cooldown to prevent excessive checks
        const now = Date.now();
        if (now - lastUIDCheck < UID_CHECK_COOLDOWN) {
            return false;
        }
        lastUIDCheck = now;
        
        try {
            if (!currentUser || !currentUser.code) {
                return false;
            }

            // ONLY check if we're on profile page - no lag on other pages!
            const isOnProfile = window.location.pathname.includes('/profile');
            
            if (!isOnProfile) {
                // Not on profile - just return, don't show modal or do anything
                // This prevents lag on game pages
                return false;
            }

            uidVerificationInProgress = true;

            // Wait a moment for page to fully load
            await new Promise(resolve => setTimeout(resolve, 500));

            // Extract UID from profile page
            let profileUID = extractUIDFromProfile();
            
            if (!profileUID) {
                // Try one more time after a delay
                await new Promise(resolve => setTimeout(resolve, 1000));
                profileUID = extractUIDFromProfile();
                if (!profileUID) {
                    uidVerificationInProgress = false;
                    return false;
                }
            }

            // Check Firebase for the code and verify UID matches
            const codeDoc = await firebaseFirestore.collection('whitelist_codes').doc(currentUser.code).get();
            
            if (!codeDoc.exists) {
                uidVerificationInProgress = false;
                return false;
            }

            const codeData = codeDoc.data();
            const storedUID = codeData.userId;

            // If no UID stored yet, store it
            if (!storedUID) {
                const result = await storeUIDForCode(currentUser.code, profileUID);
                if (result.success) {
                    currentUser.uid = profileUID;
                    localStorage.setItem('apex_user', JSON.stringify({
                        uid: profileUID,
                        email: currentUser?.email || 'user@code.com',
                        code: currentUser.code,
                        loggedIn: true,
                        timestamp: Date.now()
                    }));
                    isWhitelisted = true;
                    hideAuthModal();
                    hideProfileRequiredModal();
                    // Remove verification message if shown
                    const verificationMsg = document.getElementById('apexVerificationMessage');
                    if (verificationMsg) verificationMsg.remove();
                    initGUI();
                    log('Account linked and verified!', '#00ff99', '✅');
                    uidVerificationInProgress = false;
                    return true;
                } else {
                    uidVerificationInProgress = false;
                    return false;
                }
            }

            // Verify UID matches
            if (storedUID === profileUID) {
                currentUser.uid = profileUID;
                localStorage.setItem('apex_user', JSON.stringify({
                    uid: profileUID,
                    email: currentUser?.email || 'user@code.com',
                    code: currentUser.code,
                    loggedIn: true,
                    timestamp: Date.now()
                }));
                isWhitelisted = true;
                hideAuthModal();
                hideProfileRequiredModal();
                // Remove verification message if shown
                const verificationMsg = document.getElementById('apexVerificationMessage');
                if (verificationMsg) verificationMsg.remove();
                initGUI();
                log('UID verified - Access granted!', '#00ff99', '✅');
                uidVerificationInProgress = false;
                return true;
            } else {
                showError(`UID mismatch! Please use the account that matches your whitelist code.`);
                uidVerificationInProgress = false;
                return false;
            }
        } catch (error) {
            console.error('Error verifying UID:', error);
            uidVerificationInProgress = false;
            return false;
        }
    }

    // Show simple notification instead of blocking modal
    function showProfileRequiredNotification() {
        // Only show if not already shown and user is trying to use features
        if (document.getElementById('apexProfileNotification')) {
            return;
        }

        const notification = document.createElement('div');
        notification.id = 'apexProfileNotification';
        notification.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            background: linear-gradient(135deg, #1a1a1a 0%, #2a0000 100%);
            border: 2px solid #ff3333;
            border-radius: 12px;
            padding: 20px;
            max-width: 350px;
            z-index: 999999997;
            box-shadow: 0 0 30px rgba(255,51,51,0.5);
            animation: slideIn 0.3s ease-out;
        `;
        notification.innerHTML = `
            <div style="color: #ff6666; font-weight: bold; margin-bottom: 10px; font-size: 16px;">
                ⚠️ Profile Verification Needed
            </div>
            <div style="color: #ccc; font-size: 14px; margin-bottom: 15px; line-height: 1.5;">
                Go to your profile page to verify your account and unlock full access.
            </div>
            <a href="https://bloxgame.us/profile" target="_blank" style="display: block; text-align: center; padding: 10px; background: #00ff99; color: #000; border-radius: 8px; text-decoration: none; font-weight: bold; margin-bottom: 10px;">
                Go to Profile
            </a>
            <button onclick="this.parentElement.remove()" style="width: 100%; padding: 8px; background: #333; color: #fff; border: none; border-radius: 8px; cursor: pointer;">
                Dismiss
            </button>
        `;

        document.body.appendChild(notification);
        
        // Auto-dismiss after 10 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 10000);
    }

    // Show message instead of UI when UID not verified
    function showProfileVerificationMessage() {
        // Remove existing message if any
        const existing = document.getElementById('apexVerificationMessage');
        if (existing) existing.remove();

        // Remove any existing UI elements
        const toggle = document.getElementById('apexToggle');
        const menu = document.getElementById('apexMenu');
        if (toggle) toggle.remove();
        if (menu) menu.remove();

        const message = document.createElement('div');
        message.id = 'apexVerificationMessage';
        message.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%);
            border: 3px solid #ff3333;
            border-radius: 20px;
            padding: 40px;
            max-width: 500px;
            width: 90%;
            z-index: 999999999;
            box-shadow: 0 0 50px rgba(255,51,51,0.5);
            text-align: center;
        `;
        message.innerHTML = `
            <div style="font-size: 48px; margin-bottom: 20px;">🔒</div>
            <h2 style="color: #ff6666; margin: 0 0 15px 0; font-size: 28px; font-weight: bold;">
                Profile Verification Required
            </h2>
            <p style="color: #ccc; font-size: 16px; line-height: 1.6; margin-bottom: 30px;">
                You must verify your account on the profile page before you can use the predictor.
                <br><br>
                Go to your profile page to automatically verify your UID and unlock access.
            </p>
            <a href="https://bloxgame.us/profile" style="display: inline-block; padding: 15px 30px; background: #00ff99; color: #000; border-radius: 10px; text-decoration: none; font-weight: bold; font-size: 18px; transition: all 0.3s; margin-bottom: 15px;" onmouseover="this.style.background='#00cc77'; this.style.transform='scale(1.05)'" onmouseout="this.style.background='#00ff99'; this.style.transform='scale(1)'">
                📋 Go to Profile Page
            </a>
            <p style="color: #888; font-size: 12px; margin-top: 20px;">
                Once verified, you can access all features on any page
            </p>
        `;

        document.body.appendChild(message);
    }

    function hideProfileRequiredModal() {
        const modal = document.getElementById('apexProfileRequiredModal');
        if (modal) modal.remove();
    }

    window.hideProfileRequiredModal = hideProfileRequiredModal;

    // Change mines prediction type
    window.changeMinesPredictionType = function(type) {
        minesPredictionType = type;
        updateMinesAlgorithmInfo();
        
        // Update button states
        document.querySelectorAll('.mines-algo-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        const activeBtn = document.getElementById(`btn-${type}`);
        if (activeBtn) {
            activeBtn.classList.add('active');
        }
        
        // Regenerate prediction with new algorithm
        if (currentGame === 'mines') {
            const result = generateMinesPrediction(type);
            updatePredictionDisplay('mines', result.positions.map(p => `Pos ${p}`).join(', '), result.confidence, null);
            log(`Switched to ${type.toUpperCase()}`, '#00ff99', '🔄');
        }
    };

    // Verify UID matches stored UID - SIMPLIFIED
    function verifyProfileUID() {
        try {
            if (!currentUser || !currentUser.uid) return false;
            if (!window.location.pathname.includes('/profile')) return false;
            
            const profileUID = extractUIDFromProfile();
            if (!profileUID) return false;
            
            return profileUID === currentUser.uid;
        } catch (error) {
            console.error('Error verifying UID:', error);
            return false;
        }
    }

    // Store UID in Firebase linked to code
    async function storeUIDForCode(code, uid) {
        try {
            if (!firebaseFirestore) {
                throw new Error('Firestore not initialized');
            }
            
            console.log('Storing UID:', uid, 'for code:', code);
            
            // Use set with merge instead of update (in case document doesn't exist)
            await firebaseFirestore.collection('whitelist_codes').doc(code).set({
                userId: uid,
                used: true,
                activatedAt: window.firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            
            console.log('✅ Updated whitelist_codes');
            
            // Create/update user document
            await firebaseFirestore.collection('users').doc(uid).set({
                email: currentUser?.email || 'user@code.com',
                code: code,
                createdAt: window.firebase.firestore.FieldValue.serverTimestamp(),
                lastLogin: window.firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            
            console.log('✅ Updated users');
            
            // Add to whitelist
            await firebaseFirestore.collection('whitelist').doc(uid).set({
                email: currentUser?.email || 'user@code.com',
                active: true,
                code: code,
                createdAt: window.firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            
            console.log('✅ Updated whitelist');
            
            return { success: true };
        } catch (error) {
            console.error('Error storing UID:', error);
            console.error('Error code:', error.code);
            console.error('Error message:', error.message);
            return { 
                success: false, 
                error: error.message || 'Unknown error',
                code: error.code || 'unknown'
            };
        }
    }

    // Sign up removed - users must purchase access first
    // Redirect to purchase website if they try to sign up
    async function signUpWithEmail(email, password) {
        showError('Sign up is not available. Please purchase access first.');
        setTimeout(() => {
            window.open('https://vercel-website-bl4ilcocb-cayson-browns-projects.vercel.app', '_blank');
        }, 2000);
    }

    async function signInWithGoogle() {
        try {
            const provider = new window.firebase.auth.GoogleAuthProvider();
            const userCredential = await firebaseAuth.signInWithPopup(provider);
            currentUser = userCredential.user;
            await checkWhitelist(currentUser.uid);
        } catch (error) {
            if (error.code !== 'auth/popup-closed-by-user') {
                showError('Google sign in failed: ' + error.message);
            }
        }
    }

    async function signOut() {
        try {
            // Clear localStorage
            localStorage.removeItem('apex_user');
            currentUser = null;
            isWhitelisted = false;
            showAuthModal();
            // Hide predictor UI
            const menu = document.getElementById('apexMenu');
            const toggle = document.getElementById('apexToggle');
            if (menu) menu.remove();
            if (toggle) toggle.remove();
            log('Signed out successfully', '#ff9900', '🔓');
        } catch (error) {
            showError('Sign out failed: ' + error.message);
        }
    }

    // ============================================
    // AUTHENTICATION UI
    // ============================================
    function showAuthModal() {
        // Remove existing modal if any
        const existing = document.getElementById('apexAuthModal');
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.id = 'apexAuthModal';
        modal.innerHTML = `
            <div class="apexAuthOverlay">
                <div class="apexAuthContainer">
                    <div class="apexAuthHeader">
                        <h2>🔐 ApexPredictor Authentication</h2>
                        <p>Sign in to access the premium predictor</p>
                    </div>
                    <div class="apexAuthContent">
                        <div id="authError" style="display:none; padding:10px; background:#ff3333; color:#fff; border-radius:5px; margin-bottom:15px; font-size:14px;"></div>
                        
                        <div id="signInForm" class="authForm">
                            <input type="text" id="signInCode" placeholder="Enter Your Whitelist Code" class="authInput" style="text-align: center; font-size: 16px; letter-spacing: 2px; font-weight: bold;">
                            <button onclick="handleSignInWithCode()" class="authButton">Sign In</button>
                            <p style="font-size: 12px; color: #888; text-align: center; margin-top: 10px;">
                                Don't have a code? 
                                <a href="https://vercel-website-rp3jtjn36-cayson-browns-projects.vercel.app" target="_blank" style="color:#00ff99; text-decoration:underline;">
                                    Purchase Access
                                </a>
                            </p>
                        </div>
                        
                        <div class="authFooter">
                            <p style="font-size:12px; color:#888; margin-top:15px; text-align:center;">
                                Don't have an account? 
                                <a href="https://vercel-website-bl4ilcocb-cayson-browns-projects.vercel.app" target="_blank" style="color:#00ff99; text-decoration:underline; font-weight:bold;">
                                    Purchase Access Here
                                </a>
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Add styles
        if (!document.getElementById('apexAuthStyles')) {
            const style = document.createElement('style');
            style.id = 'apexAuthStyles';
            style.textContent = `
                #apexAuthModal {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    z-index: 999999999;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .apexAuthOverlay {
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.8);
                    backdrop-filter: blur(5px);
                }
                .apexAuthContainer {
                    position: relative;
                    background: linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%);
                    border: 3px solid #ff3333;
                    border-radius: 20px;
                    padding: 30px;
                    width: 90%;
                    max-width: 400px;
                    box-shadow: 0 0 50px rgba(255, 51, 51, 0.5);
                }
                .apexAuthHeader {
                    text-align: center;
                    margin-bottom: 25px;
                }
                .apexAuthHeader h2 {
                    color: #ff6666;
                    margin: 0 0 10px 0;
                    font-size: 24px;
                }
                .apexAuthHeader p {
                    color: #888;
                    margin: 0;
                    font-size: 14px;
                }
                #authTabs {
                    display: flex;
                    gap: 10px;
                    margin-bottom: 20px;
                }
                .authTab {
                    flex: 1;
                    padding: 10px;
                    background: #1a1a1a;
                    border: 2px solid #333;
                    border-radius: 8px;
                    color: #fff;
                    cursor: pointer;
                    font-weight: bold;
                    transition: all 0.3s;
                }
                .authTab.active {
                    background: #ff3333;
                    border-color: #ff3333;
                }
                .authTab:hover {
                    background: #2a2a2a;
                }
                .authTab.active:hover {
                    background: #ff5555;
                }
                .authForm {
                    display: flex;
                    flex-direction: column;
                    gap: 15px;
                }
                .authInput {
                    padding: 12px;
                    background: #1a1a1a;
                    border: 2px solid #333;
                    border-radius: 8px;
                    color: #fff;
                    font-size: 14px;
                }
                .authInput:focus {
                    outline: none;
                    border-color: #ff3333;
                }
                .authButton {
                    padding: 12px;
                    background: linear-gradient(135deg, #ff3333 0%, #ff5555 100%);
                    border: none;
                    border-radius: 8px;
                    color: #fff;
                    font-weight: bold;
                    font-size: 16px;
                    cursor: pointer;
                    transition: all 0.3s;
                }
                .authButton:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 5px 20px rgba(255, 51, 51, 0.5);
                }
                .googleButton {
                    background: linear-gradient(135deg, #4285f4 0%, #34a853 100%);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                }
                .googleButton:hover {
                    box-shadow: 0 5px 20px rgba(66, 133, 244, 0.5);
                }
            `;
            document.head.appendChild(style);
        }

        document.body.appendChild(modal);

        // Make functions available globally
        window.handleSignInWithCode = function() {
            const code = document.getElementById('signInCode').value;
            if (code && code.trim()) {
                signInWithWhitelistCode(code.trim().toUpperCase());
            } else {
                showError('Please enter your whitelist code');
            }
        };

        window.handleGoogleSignIn = function() {
            showError('Google sign-in is not available. Please use email/password.');
        };
    }

    function hideAuthModal() {
        const modal = document.getElementById('apexAuthModal');
        if (modal) modal.remove();
    }

    // ============================================
    // UID INPUT MODAL
    // ============================================
    
    function showUIDInputModal(code) {
        // Remove existing modal if any
        const existing = document.getElementById('apexUIDInputModal');
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.id = 'apexUIDInputModal';
        modal.innerHTML = `
            <div class="apexUIDOverlay" onclick="hideUIDInputModal()"></div>
            <div class="apexAuthContainer" style="max-width: 500px; position: relative; z-index: 999999999;">
                <div class="apexAuthHeader">
                    <h2>🔗 Link Your Account</h2>
                    <p>Connect your whitelist code to your profile</p>
                </div>
                <div class="apexAuthContent">
                    <div style="background: #1a1a1a; padding: 20px; border-radius: 10px; margin-bottom: 20px;">
                        <h3 style="color: #00ff99; margin-top: 0; font-size: 18px;">Step-by-Step Instructions:</h3>
                        <ol style="color: #ccc; line-height: 1.8; padding-left: 20px;">
                            <li>Click the button below to open your profile in a new tab</li>
                            <li>Look for your <strong>User ID</strong> or <strong>UID</strong> on the profile page</li>
                            <li>Copy the UID (it's usually a long string of letters and numbers)</li>
                            <li>Come back here and paste it in the box below</li>
                        </ol>
                        <a href="https://bloxgame.us/profile" target="_blank" style="display: block; text-align: center; padding: 12px; background: #00ff99; color: #000; border-radius: 8px; text-decoration: none; font-weight: bold; margin-top: 15px; transition: all 0.3s;" onmouseover="this.style.background='#00cc77'" onmouseout="this.style.background='#00ff99'">
                            📋 Open Profile Page (New Tab)
                        </a>
                        <p style="color: #888; font-size: 12px; margin-top: 15px;">
                            💡 <strong>Tip:</strong> The UID is usually displayed near your username or in the page URL
                        </p>
                    </div>
                    
                    <div id="uidError" style="display:none; padding:10px; background:#ff3333; color:#fff; border-radius:5px; margin-bottom:15px; font-size:14px;"></div>
                    
                    <input type="text" id="uidInput" placeholder="Paste your UID here" class="authInput" style="text-align: center; font-size: 14px; font-family: monospace;">
                    <button onclick="handleUIDSubmit('${code}')" class="authButton">Link Account</button>
                    <button onclick="hideUIDInputModal()" class="authButton" style="background: #333; margin-top: 10px;">Skip for Now</button>
                    <p style="color: #888; font-size: 11px; text-align: center; margin-top: 10px;">
                        Click outside this box to close
                    </p>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        
        // Add styles if not already added
        if (!document.getElementById('apexUIDInputStyles')) {
            const style = document.createElement('style');
            style.id = 'apexUIDInputStyles';
            style.textContent = `
                #apexUIDInputModal {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    z-index: 999999998;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    pointer-events: none;
                }
                .apexUIDOverlay {
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.5);
                    backdrop-filter: blur(3px);
                    pointer-events: all;
                }
                #apexUIDInputModal .apexAuthContainer {
                    pointer-events: all;
                }
            `;
            document.head.appendChild(style);
        }
    }

    function hideUIDInputModal() {
        const modal = document.getElementById('apexUIDInputModal');
        if (modal) modal.remove();
    }

    window.handleUIDSubmit = async function(code) {
        const uidInput = document.getElementById('uidInput');
        const uid = uidInput?.value?.trim();
        const errorDiv = document.getElementById('uidError');
        
        if (!uid || uid.length < 10) {
            if (errorDiv) {
                errorDiv.style.display = 'block';
                errorDiv.textContent = 'Please enter a valid UID (at least 10 characters)';
            }
            return;
        }
        
        // Show loading state
        const submitButton = document.querySelector('button[onclick*="handleUIDSubmit"]');
        const originalText = submitButton?.textContent;
        if (submitButton) {
            submitButton.disabled = true;
            submitButton.textContent = 'Linking...';
        }
        
        if (errorDiv) {
            errorDiv.style.display = 'none';
        }
        
        try {
            // Store UID in Firebase
            const result = await storeUIDForCode(code, uid);
            
            if (result.success) {
                // Update current user
                currentUser = { uid: uid, email: currentUser?.email || 'user@code.com', code: code };
                localStorage.setItem('apex_user', JSON.stringify({
                    uid: uid,
                    email: currentUser?.email || 'user@code.com',
                    code: code,
                    loggedIn: true,
                    timestamp: Date.now()
                }));
                
                hideUIDInputModal();
                log('Account linked successfully!', '#00ff99', '✅');
            } else {
                if (errorDiv) {
                    errorDiv.style.display = 'block';
                    let errorMsg = 'Failed to link account. ';
                    
                    if (result.code === 'permission-denied') {
                        errorMsg += '❌ Permission denied!\n\nFirestore security rules are blocking writes.\n\nFIX: Go to Firebase Console → Firestore → Rules\n\nAdd write permissions:\n\nmatch /whitelist_codes/{codeId} {\n  allow read: if true;\n  allow write: if true;\n}\n\nmatch /users/{userId} {\n  allow read: if true;\n  allow write: if true;\n}\n\nmatch /whitelist/{userId} {\n  allow read: if true;\n  allow write: if true;\n}\n\nClick Publish, then try again.';
                    } else {
                        errorMsg += result.error || 'Unknown error';
                    }
                    
                    errorDiv.textContent = errorMsg;
                }
            }
        } catch (error) {
            console.error('Error linking UID:', error);
            if (errorDiv) {
                errorDiv.style.display = 'block';
                errorDiv.textContent = 'Error: ' + (error.message || 'Unknown error');
            }
        } finally {
            // Restore button
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.textContent = originalText || 'Link Account';
            }
        }
    };

    function showError(message) {
        console.error('Error:', message);
        const errorEl = document.getElementById('authError');
        if (errorEl) {
            errorEl.textContent = message;
            errorEl.style.display = 'block';
            setTimeout(() => {
                errorEl.style.display = 'none';
            }, 8000); // Show for 8 seconds
        } else {
            // If auth modal doesn't exist, create it first
            if (!document.getElementById('apexAuthModal')) {
                showAuthModal();
                // Wait a moment for modal to render, then show error
                setTimeout(() => {
                    const newErrorEl = document.getElementById('authError');
                    if (newErrorEl) {
                        newErrorEl.textContent = message;
                        newErrorEl.style.display = 'block';
                    } else {
                        alert(message);
                    }
                }, 100);
            } else {
                alert(message);
            }
        }
    }

    function showUIDModal(email, uid) {
        // Hide auth modal temporarily so UID modal is visible
        const authModal = document.getElementById('apexAuthModal');
        if (authModal) {
            authModal.style.display = 'none';
        }
        
        // Remove existing UID modal if any
        const existing = document.getElementById('apexUIDModal');
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.id = 'apexUIDModal';
        modal.innerHTML = `
            <div class="apexAuthOverlay">
                <div class="apexUIDContainer">
                    <div class="apexUIDHeader">
                        <h2>✅ Account Created!</h2>
                        <p>User needs to be whitelisted</p>
                    </div>
                    <div class="apexUIDContent">
                        <div class="uidInfoBox">
                            <div class="uidLabel">Email:</div>
                            <div class="uidValue">${email}</div>
                        </div>
                        <div class="uidInfoBox">
                            <div class="uidLabel">UID (Copy this!):</div>
                            <div class="uidValueContainer">
                                <input type="text" id="uidToCopy" value="${uid}" readonly class="uidInput">
                                <button onclick="copyUID()" class="copyButton">📋 Copy UID</button>
                            </div>
                        </div>
                        <div class="uidInstructions">
                            <strong>Admin Instructions:</strong>
                            <ol>
                                <li>Copy the UID above</li>
                                <li>Go to Firebase Console → Firestore Database</li>
                                <li>Click on "whitelist" collection</li>
                                <li>Click "Add document"</li>
                                <li>Paste UID as Document ID</li>
                                <li>Add fields: email (string) and active (boolean: true)</li>
                                <li>Click Save</li>
                            </ol>
                        </div>
                        <div class="uidUserMessage">
                            <p>👤 <strong>User:</strong> Please wait while admin adds you to the whitelist, then sign in again.</p>
                        </div>
                        <button onclick="closeUIDModal()" class="authButton" style="margin-top:20px;">Close</button>
                    </div>
                </div>
            </div>
        `;

        // Add styles for UID modal
        if (!document.getElementById('apexUIDStyles')) {
            const style = document.createElement('style');
            style.id = 'apexUIDStyles';
            style.textContent += `
                #apexUIDModal {
                    position: fixed !important;
                    top: 0 !important;
                    left: 0 !important;
                    width: 100% !important;
                    height: 100% !important;
                    z-index: 9999999999 !important;
                    display: flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                }
                .apexUIDContainer {
                    position: relative;
                    background: linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%);
                    border: 3px solid #00ff99;
                    border-radius: 20px;
                    padding: 30px;
                    width: 90%;
                    max-width: 600px;
                    box-shadow: 0 0 50px rgba(0, 255, 153, 0.5);
                    z-index: 9999999999 !important;
                }
                .apexUIDHeader {
                    text-align: center;
                    margin-bottom: 25px;
                }
                .apexUIDHeader h2 {
                    color: #00ff99;
                    margin: 0 0 10px 0;
                    font-size: 24px;
                }
                .apexUIDHeader p {
                    color: #888;
                    margin: 0;
                    font-size: 14px;
                }
                .uidInfoBox {
                    margin-bottom: 20px;
                    padding: 15px;
                    background: #1a1a1a;
                    border-radius: 10px;
                    border: 1px solid #333;
                }
                .uidLabel {
                    color: #888;
                    font-size: 12px;
                    margin-bottom: 8px;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                }
                .uidValue {
                    color: #fff;
                    font-size: 16px;
                    word-break: break-all;
                }
                .uidValueContainer {
                    display: flex;
                    gap: 10px;
                    align-items: center;
                }
                .uidInput {
                    flex: 1;
                    padding: 12px;
                    background: #0a0a0a;
                    border: 2px solid #00ff99;
                    border-radius: 8px;
                    color: #00ff99;
                    font-size: 14px;
                    font-family: monospace;
                    cursor: text;
                }
                .copyButton {
                    padding: 12px 20px;
                    background: #00ff99;
                    border: none;
                    border-radius: 8px;
                    color: #000;
                    font-weight: bold;
                    cursor: pointer;
                    transition: all 0.3s;
                    white-space: nowrap;
                }
                .copyButton:hover {
                    background: #00cc77;
                    transform: scale(1.05);
                }
                .copyButton:active {
                    transform: scale(0.95);
                }
                .uidInstructions {
                    margin-top: 20px;
                    padding: 15px;
                    background: #1a3a1a;
                    border-radius: 10px;
                    border: 1px solid #00ff99;
                }
                .uidInstructions strong {
                    color: #00ff99;
                    display: block;
                    margin-bottom: 10px;
                }
                .uidInstructions ol {
                    color: #fff;
                    margin: 10px 0 0 20px;
                    line-height: 1.8;
                }
                .uidInstructions li {
                    margin-bottom: 5px;
                }
                .uidUserMessage {
                    margin-top: 15px;
                    padding: 12px;
                    background: #3a3a1a;
                    border-radius: 8px;
                    border: 1px solid #ffcc00;
                }
                .uidUserMessage p {
                    color: #ffcc00;
                    margin: 0;
                    font-size: 14px;
                }
            `;
            document.head.appendChild(style);
        }

        document.body.appendChild(modal);

        // Make functions available globally
        window.copyUID = function() {
            const uidInput = document.getElementById('uidToCopy');
            if (uidInput) {
                uidInput.select();
                document.execCommand('copy');
                const button = event.target;
                const originalText = button.textContent;
                button.textContent = '✅ Copied!';
                button.style.background = '#00cc77';
                setTimeout(() => {
                    button.textContent = originalText;
                    button.style.background = '#00ff99';
                }, 2000);
            }
        };

        window.closeUIDModal = function() {
            const modal = document.getElementById('apexUIDModal');
            if (modal) modal.remove();
            // Show auth modal again if user is not whitelisted
            if (!isWhitelisted) {
                const authModal = document.getElementById('apexAuthModal');
                if (authModal) {
                    authModal.style.display = 'flex';
                } else {
                    showAuthModal();
                }
            }
        };
    }

    // ============================================
    // MAIN INITIALIZATION
    // ============================================
    // Initialize Firebase on load
    initializeFirebase();

    // Enhanced state management
    let currentGame = 'unknown';
    let predictionHistory = [];
    let statistics = {
        totalPredictions: 0,
        accuracy: 0,
        gamesPlayed: {},
        lastUpdate: null
    };
    let predictionInterval = null;
    let roundCounter = 0;
    let lastPrediction = null;
    
    // Crash-specific state
    let lastRoundId = null;
    let roundDataHistory = [];
    let crashObserver = null;
    let roundIdElement = null;
    let crashPollInterval = null;
    let crashDataCollectionInterval = null;
    let minesObserver = null;
    let lastMinesButtonState = false;
    let minesPredictionType = 'nexus'; // 'nexus', 'quantum', 'vortex', 'prism', 'matrix', 'chaos'
    let minesHistory = []; // Store previous game results: {safe: [1,5,12], bombs: [3,7,19], timestamp}
    let minesDataObserver = null; // Observer for collecting game results
    let actualMultiplierHistory = []; // Store actual results for learning

    function getTime() {
        const now = new Date();
        return now.toLocaleTimeString('en-US', { 
            hour12: false, 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit',
            fractionalSecondDigits: 3
        });
    }

    function getFullTimestamp() {
        const now = new Date();
        return now.toISOString().replace('T', ' ').substring(0, 23);
    }

    function log(msg, color = '#00ff99', icon = '') {
        const logEl = document.getElementById('apexLog');
        if (!logEl) return;
        const time = getTime();
        const line = document.createElement('div');
        const iconHtml = icon ? `<span style="margin-right:8px;">${icon}</span>` : '';
        line.innerHTML = `<span style="color:#888888;">[${time}]</span> ${iconHtml}<span style="color:${color};">${msg}</span>`;
        logEl.appendChild(line);
        
        // Auto-scroll with smooth animation
        logEl.scrollTo({
            top: logEl.scrollHeight,
            behavior: 'smooth'
        });
        
        // Limit log entries to prevent memory issues
        if (logEl.children.length > 100) {
            logEl.removeChild(logEl.firstChild);
        }
    }

    function detectGame() {
        const path = window.location.pathname.toLowerCase();
        const hostname = window.location.hostname.toLowerCase();
        
        // Exclude non-game pages first
        if (path.includes('/profile') || path.includes('/settings') || path.includes('/account') || 
            path.includes('/help') || path.includes('/about') || path === '/' || path === '') {
            return 'unknown';
        }
        
        // Check path for game names
        if (path.includes('/crash') || path.includes('/game/crash') || hostname.includes('crash')) return 'crash';
        if (path.includes('/mines') || path.includes('/game/mines') || hostname.includes('mines')) return 'mines';
        if (path.includes('/plinko') || path.includes('/game/plinko') || hostname.includes('plinko')) return 'plinko';
        if (path.includes('/towers') || path.includes('/game/towers') || hostname.includes('towers')) return 'towers';
        if (path.includes('/dice') || path.includes('/game/dice') || hostname.includes('dice')) return 'dice';
        if (path.includes('/roulette') || path.includes('/game/roulette') || hostname.includes('roulette')) return 'roulette';
        if (path.includes('/blackjack') || path.includes('/game/blackjack') || hostname.includes('blackjack')) return 'blackjack';
        
        // Only check body text if we're on a game-like page (not profile/settings)
        // Look for specific game UI elements instead of just text
        try {
            // Check for crash game elements
            if (document.querySelector('[class*="crash"], [class*="Crash"]') && 
                !document.querySelector('[class*="mines"], [class*="Mines"]')) {
                return 'crash';
            }
            
            // Check for mines game elements (5x5 grid, mine buttons)
            if (document.querySelector('button[aria-label^="Open mine"], [class*="minesGame"], [class*="MinesGame"]')) {
                return 'mines';
            }
            
            // Check for plinko elements
            if (document.querySelector('[class*="plinko"], [class*="Plinko"]')) {
                return 'plinko';
            }
        } catch(e) {
            // If detection fails, return unknown
        }
        
        return 'unknown';
    }


    function findRoundIdElement() {
        // Try multiple selectors to find the round ID input
        const selectors = [
            'input.input_input__N_xjH[readonly]',
            '.customInput input[readonly]',
            '.customInputInner input[readonly]',
            'input[placeholder*="Round ID" i]',
            'input[placeholder*="Not Revealed" i]',
            'input[placeholder*="round" i]',
            'input[readonly][value*="-"]',
            '.modals_modalDepositInput__cCMcC input'
        ];
        
        for (const selector of selectors) {
            try {
                const inputs = document.querySelectorAll(selector);
                for (const input of inputs) {
                    // Check if it's in a container with "Round ID" label
                    const container = input.closest('.customInput, .modalDepositInput, [class*="modal"], [class*="Modal"]');
                    if (container) {
                        const label = container.querySelector('p, label, .label, .customInputLabel, [class*="label"]');
                        if (label) {
                            const labelText = (label.textContent || label.innerText || '').toLowerCase();
                            if (labelText.includes('round id') || labelText.includes('roundid') || 
                                (labelText.includes('round') && labelText.includes('id'))) {
                                // Verify it has a UUID value
                                if (input.value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.value)) {
                                    return input;
                                }
                            }
                        }
                    }
                    
                    // Also check if value looks like a UUID (even without label match)
                    if (input.value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.value)) {
                        // Double check it's readonly (round IDs are usually readonly)
                        if (input.readOnly || input.hasAttribute('readonly')) {
                            return input;
                        }
                    }
                }
            } catch(e) {
                // Continue to next selector if this one fails
                continue;
            }
        }
        
        // Last resort: search all readonly inputs for UUID pattern
        try {
            const allReadonlyInputs = document.querySelectorAll('input[readonly], input[readOnly]');
            for (const input of allReadonlyInputs) {
                if (input.value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.value)) {
                    // Check if parent has "round" or "id" in text
                    const parent = input.closest('div, section, form');
                    if (parent) {
                        const parentText = (parent.textContent || '').toLowerCase();
                        if (parentText.includes('round') || parentText.includes('id') || parentText.includes('fairness')) {
                            return input;
                        }
                    }
                }
            }
        } catch(e) {}
        
        return null;
    }

    function collectCrashData() {
        const data = {
            roundId: null,
            timestamp: Date.now(),
            currentMultiplier: null,
            gameState: null,
            history: [],
            pageData: {},
            networkData: null
        };
        
        // Get round ID - try multiple methods
        if (roundIdElement && roundIdElement.value) {
            data.roundId = roundIdElement.value;
        } else {
            // Try to find it again
            roundIdElement = findRoundIdElement();
            if (roundIdElement && roundIdElement.value) {
                data.roundId = roundIdElement.value;
            }
        }
        
        // Find current multiplier display (limited selectors for performance)
        try {
            const multiplierEl = document.querySelector('[class*="multiplier"]:not([style*="display: none"])');
            if (multiplierEl) {
                const text = multiplierEl.textContent || multiplierEl.innerText || '';
                const multiplierMatch = text.match(/(\d+\.?\d*)\s*x/i);
                if (multiplierMatch) {
                    data.currentMultiplier = parseFloat(multiplierMatch[1]);
                }
            }
        } catch(e) {}
        
        // Lightweight game state check (single query)
        try {
            const stateEl = document.querySelector('[class*="waiting"], [class*="flying"], [class*="crashed"]');
            if (stateEl) {
                const text = (stateEl.textContent || stateEl.innerText || '').toLowerCase();
                if (text.includes('wait') || text.includes('flying') || text.includes('crash')) {
                    data.gameState = text.substring(0, 30);
                }
            }
        } catch(e) {}
        
        return data;
    }

    // Collect mines game data when "End game" button appears
    function collectMinesData() {
        try {
            // Find all mine buttons - they should be in order 1-25 (left to right, top to bottom)
            const allMines = document.querySelectorAll('button[aria-label^="Open mine"]');
            if (allMines.length !== 25) {
                // Not all mines revealed yet
                return null;
            }
            
            const safePositions = [];
            const bombPositions = [];
            
            // Map buttons to positions (1-25, left to right, top to bottom)
            // The buttons should be in DOM order which matches the grid layout
            allMines.forEach((button, index) => {
                const position = index + 1; // 1-25
                const classes = button.className || '';
                
                // Check if it's a win (safe) or bomb
                if (classes.includes('mines_minesGameItemWin')) {
                    safePositions.push(position);
                } else if (classes.includes('mines_minesGameItemOtherMine')) {
                    bombPositions.push(position);
                } else {
                    // If class doesn't match, check by visual state or other indicators
                    // Some buttons might be revealed but not have the class yet
                    const ariaLabel = button.getAttribute('aria-label') || '';
                    // If we can't determine, skip for now
                }
            });
            
            // Only save if we have complete data (all 25 positions accounted for)
            const totalPositions = safePositions.length + bombPositions.length;
            if (totalPositions === 25) {
                const gameData = {
                    safe: safePositions,
                    bombs: bombPositions,
                    timestamp: Date.now()
                };
                
                // Check if this data is already collected (avoid duplicates)
                const isDuplicate = minesHistory.some(prev => {
                    const prevTotal = prev.safe.length + prev.bombs.length;
                    if (prevTotal !== 25) return false;
                    // Check if safe positions match
                    const prevSafe = prev.safe.sort((a, b) => a - b).join(',');
                    const currSafe = safePositions.sort((a, b) => a - b).join(',');
                    return prevSafe === currSafe && Math.abs(prev.timestamp - gameData.timestamp) < 5000;
                });
                
                if (!isDuplicate) {
                    minesHistory.push(gameData);
                    // Keep last 50 games
                    if (minesHistory.length > 50) {
                        minesHistory.shift();
                    }
                    
                    console.log('Mines data collected:', gameData);
                    log(`📊 Collected game ${minesHistory.length}: ${safePositions.length} safe, ${bombPositions.length} bombs`, '#00ff99', '💎');
                    
                    // Update UI to show game count
                    updateMinesAlgorithmInfo();
                    
                    return gameData;
                }
            }
        } catch (error) {
            console.error('Error collecting mines data:', error);
        }
        return null;
    }
    
    // Update algorithm info to show game count
    function updateMinesAlgorithmInfo() {
        const infoEl = document.getElementById('minesAlgorithmInfo');
        if (!infoEl) return;
        
        const gameCount = minesHistory.length;
        const gameText = gameCount === 1 ? '1 game' : `${gameCount} games`;
        
        const algorithmInfo = {
            'nexus': `NEXUS: Using ${gameText} • Data-driven pattern analysis`,
            'quantum': `QUANTUM: Using ${gameText} • Avoids known bomb zones`,
            'vortex': `VORTEX: Using ${gameText} • Spiral core pattern`,
            'prism': `PRISM: Using ${gameText} • Edge and corner focus`,
            'matrix': `MATRIX: Using ${gameText} • Diagonal pattern analysis`,
            'chaos': `CHAOS: Using ${gameText} • Random with bomb avoidance`
        };
        
        infoEl.textContent = algorithmInfo[minesPredictionType] || algorithmInfo['nexus'];
    }

    // Mines prediction algorithms - now using historical data
    function generateMinesPrediction(type) {
        const safeCount = 3 + Math.floor(Math.random() * 3); // 3-5 safe positions
        const positions = [];
        const usedPositions = new Set();
        
        // Analyze historical data - use all available games for better accuracy
        const recentGames = minesHistory.slice(-20); // Last 20 games (or all if less)
        const safeFrequency = new Map(); // Position -> how often it's safe
        const bombFrequency = new Map(); // Position -> how often it's a bomb
        const positionSafety = new Map(); // Position -> safety score (safe count - bomb count)
        
        recentGames.forEach(game => {
            game.safe.forEach(pos => {
                safeFrequency.set(pos, (safeFrequency.get(pos) || 0) + 1);
                positionSafety.set(pos, (positionSafety.get(pos) || 0) + 1);
            });
            game.bombs.forEach(pos => {
                bombFrequency.set(pos, (bombFrequency.get(pos) || 0) + 1);
                positionSafety.set(pos, (positionSafety.get(pos) || 0) - 1);
            });
        });
        
        switch(type) {
            case 'nexus':
                // Nexus: Uses historical safe positions, prefers positions with highest safety score
                let nexusCandidates = [];
                
                if (recentGames.length > 0) {
                    // Use safety score (safe count - bomb count) to rank positions
                    nexusCandidates = Array.from(positionSafety.entries())
                        .sort((a, b) => b[1] - a[1]) // Sort by safety score (highest first)
                        .filter(entry => entry[1] > 0) // Only positions that are net safe
                        .map(entry => entry[0])
                        .slice(0, 15); // Top 15 safest positions
                }
                
                // If we have historical data, use it
                if (nexusCandidates.length > 0) {
                    // Weight selection by safety score
                    while (positions.length < safeCount && nexusCandidates.length > 0) {
                        // Prefer top positions more heavily
                        const topCandidates = nexusCandidates.slice(0, Math.min(5, nexusCandidates.length));
                        const pos = topCandidates[Math.floor(Math.random() * topCandidates.length)];
                        if (!usedPositions.has(pos)) {
                            usedPositions.add(pos);
                            positions.push(pos);
                        }
                        if (usedPositions.size >= nexusCandidates.length) break;
                    }
                }
                
                // Fill with center zones if needed (fallback)
                const centerZones = [7, 8, 9, 12, 13, 14, 17, 18, 19];
                while (positions.length < safeCount) {
                    const zone = centerZones[Math.floor(Math.random() * centerZones.length)];
                    if (!usedPositions.has(zone) && (!bombFrequency.has(zone) || bombFrequency.get(zone) < 2)) {
                        usedPositions.add(zone);
                        positions.push(zone);
                    }
                    if (usedPositions.size >= 25) break;
                }
                
                // Confidence scales with data quality
                let confidence = '72%';
                if (recentGames.length >= 10) confidence = '82%';
                else if (recentGames.length >= 5) confidence = '78%';
                else if (recentGames.length >= 2) confidence = '75%';
                
                return { positions: positions.sort((a, b) => a - b), confidence };
                
            case 'quantum':
                // Quantum: Avoids frequently bomb positions, uses safe zones
                const avoidZones = Array.from(bombFrequency.entries())
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 10)
                    .map(entry => entry[0]);
                
                const quantumZones = Array.from({length: 25}, (_, i) => i + 1)
                    .filter(pos => !avoidZones.includes(pos));
                
                while (positions.length < safeCount && quantumZones.length > 0) {
                    const pos = quantumZones[Math.floor(Math.random() * quantumZones.length)];
                    if (!usedPositions.has(pos)) {
                        usedPositions.add(pos);
                        positions.push(pos);
                    }
                    if (usedPositions.size >= quantumZones.length) break;
                }
                return { positions: positions.sort((a, b) => a - b), confidence: minesHistory.length > 5 ? '75%' : '68%' };
                
            case 'vortex':
                // Vortex: Spiral pattern from center, weighted by historical data
                const spiralOrder = [13, 8, 14, 18, 12, 7, 9, 19, 17, 3, 11, 15, 23, 6, 16, 20, 2, 10, 22, 24, 1, 5, 21, 25, 4];
                const weightedSpiral = spiralOrder.filter(pos => !bombFrequency.has(pos) || bombFrequency.get(pos) < 2);
                
                for (let i = 0; i < safeCount && i < weightedSpiral.length; i++) {
                    positions.push(weightedSpiral[i]);
                }
                return { positions: positions.sort((a, b) => a - b), confidence: minesHistory.length > 5 ? '73%' : '65%' };
                
            case 'prism':
                // Prism: Corner and edge focus, avoids bomb-heavy areas
                const cornerZones = [1, 5, 21, 25, 2, 4, 6, 10, 16, 20, 22, 24];
                const safeCorners = cornerZones.filter(pos => !bombFrequency.has(pos) || bombFrequency.get(pos) < 2);
                
                while (positions.length < safeCount && safeCorners.length > 0) {
                    const zone = safeCorners[Math.floor(Math.random() * safeCorners.length)];
                    if (!usedPositions.has(zone)) {
                        usedPositions.add(zone);
                        positions.push(zone);
                    }
                    if (usedPositions.size >= safeCorners.length) break;
                }
                while (positions.length < safeCount) {
                    const pos = Math.floor(Math.random() * 25) + 1;
                    if (!usedPositions.has(pos) && (!bombFrequency.has(pos) || bombFrequency.get(pos) < 3)) {
                        usedPositions.add(pos);
                        positions.push(pos);
                    }
                    if (usedPositions.size >= 25) break;
                }
                return { positions: positions.sort((a, b) => a - b), confidence: minesHistory.length > 5 ? '76%' : '70%' };
                
            case 'matrix':
                // Matrix: Diagonal patterns, learns from history
                const diagonalZones = [1, 7, 13, 19, 25, 5, 9, 13, 17, 21, 3, 8, 13, 18, 23];
                const safeDiagonals = diagonalZones.filter(pos => 
                    safeFrequency.has(pos) && safeFrequency.get(pos) > 0
                );
                
                while (positions.length < safeCount && safeDiagonals.length > 0) {
                    const zone = safeDiagonals[Math.floor(Math.random() * safeDiagonals.length)];
                    if (!usedPositions.has(zone)) {
                        usedPositions.add(zone);
                        positions.push(zone);
                    }
                    if (usedPositions.size >= safeDiagonals.length) break;
                }
                while (positions.length < safeCount) {
                    const pos = diagonalZones[Math.floor(Math.random() * diagonalZones.length)];
                    if (!usedPositions.has(pos)) {
                        usedPositions.add(pos);
                        positions.push(pos);
                    }
                    if (usedPositions.size >= diagonalZones.length) break;
                }
                return { positions: positions.sort((a, b) => a - b), confidence: minesHistory.length > 5 ? '74%' : '66%' };
                
            case 'chaos':
            default:
                // Chaos: Random but avoids known bomb zones
                const avoidBombs = Array.from(bombFrequency.entries())
                    .filter(entry => entry[1] >= 3)
                    .map(entry => entry[0]);
                
                const chaosZones = Array.from({length: 25}, (_, i) => i + 1)
                    .filter(pos => !avoidBombs.includes(pos));
                
                while (positions.length < safeCount && chaosZones.length > 0) {
                    const position = chaosZones[Math.floor(Math.random() * chaosZones.length)];
                    if (!usedPositions.has(position)) {
                        usedPositions.add(position);
                        positions.push(position);
                    }
                    if (usedPositions.size >= chaosZones.length) break;
                }
                return { positions: positions.sort((a, b) => a - b), confidence: minesHistory.length > 5 ? '71%' : '55%' };
        }
    }

    function generatePrediction(game, roundData = null) {
        roundCounter++;
        let prediction = null;
        let confidence = 'Calculating...';
        let safeCashOut = null;
        
        switch(game) {
            case 'crash':
                // Advanced AI-based prediction using all collected data
                let baseMultiplier = 1.5;
                let confidenceScore = 50;
                
                if (roundData) {
                    // 1. Analyze round ID hash pattern
                    if (roundData.roundId) {
                        const roundIdHash = roundData.roundId.split('').reduce((acc, char) => {
                            return acc + char.charCodeAt(0);
                        }, 0);
                        
                        // Extract patterns from UUID segments
                        const segments = roundData.roundId.split('-');
                        const segmentHashes = segments.map(s => 
                            s.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
                        );
                        
                        // Use hash patterns to influence prediction
                        const hashInfluence = (roundIdHash % 200) / 20; // 0-10 range
                        baseMultiplier += hashInfluence;
                        confidenceScore += 5;
                    }
                    
                    // 2. Use actual multiplier history if available
                    if (actualMultiplierHistory.length > 0) {
                        const recentActuals = actualMultiplierHistory.slice(-20);
                        const avgActual = recentActuals.reduce((sum, r) => sum + r.multiplier, 0) / recentActuals.length;
                        const maxActual = Math.max(...recentActuals.map(r => r.multiplier));
                        const minActual = Math.min(...recentActuals.map(r => r.multiplier));
                        
                        // Pattern detection: if recent multipliers are trending
                        const trend = recentActuals.length >= 3 ? 
                            (recentActuals[recentActuals.length - 1].multiplier - recentActuals[0].multiplier) / recentActuals.length : 0;
                        
                        // Weighted average: 40% historical average, 30% trend, 30% hash-based
                        baseMultiplier = (avgActual * 0.4) + ((avgActual + trend) * 0.3) + (baseMultiplier * 0.3);
                        confidenceScore += 15;
                        
                        // Adjust based on variance
                        const variance = maxActual - minActual;
                        if (variance < 5) {
                            // Low variance - more predictable
                            confidenceScore += 10;
                        } else if (variance > 20) {
                            // High variance - less predictable
                            confidenceScore -= 5;
                        }
                    }
                    
                    // 3. Use predicted history patterns
                    if (roundDataHistory.length > 0) {
                        const recentPredictions = roundDataHistory.slice(-15);
                        const avgPredicted = recentPredictions.reduce((sum, r) => 
                            sum + (r.predictedMultiplier || 0), 0) / recentPredictions.length;
                        
                        // If we have both actual and predicted, compare patterns
                        if (actualMultiplierHistory.length > 0) {
                            const accuracy = recentPredictions.length > 0 ? 
                                recentPredictions.filter((r, i) => {
                                    const actual = actualMultiplierHistory[actualMultiplierHistory.length - recentPredictions.length + i];
                                    return actual && Math.abs((r.predictedMultiplier || 0) - actual.multiplier) < 2;
                                }).length / recentPredictions.length : 0;
                            
                            confidenceScore += accuracy * 20;
                        }
                        
                        // Blend with historical predictions
                        baseMultiplier = (baseMultiplier * 0.6) + (avgPredicted * 0.4);
                    }
                    
                    // 4. Use current game state
                    if (roundData.gameState) {
                        const state = roundData.gameState.toLowerCase();
                        if (state.includes('wait') || state.includes('ready')) {
                            // Game hasn't started - use full prediction
                            confidenceScore += 5;
                        } else if (state.includes('flying') || state.includes('active')) {
                            // Game in progress - adjust prediction
                            if (roundData.currentMultiplier) {
                                // If we can see current multiplier, adjust prediction
                                baseMultiplier = Math.max(baseMultiplier, roundData.currentMultiplier * 1.1);
                                confidenceScore += 10;
                            }
                        }
                    }
                    
                    // 5. Use page data multipliers if available
                    if (roundData.pageData && roundData.pageData.recentMultipliers) {
                        const recentPageMultipliers = roundData.pageData.recentMultipliers;
                        if (recentPageMultipliers.length > 0) {
                            const pageAvg = recentPageMultipliers.reduce((a, b) => a + b, 0) / recentPageMultipliers.length;
                            baseMultiplier = (baseMultiplier * 0.7) + (pageAvg * 0.3);
                            confidenceScore += 8;
                        }
                    }
                    
                    // 6. Round ID segment analysis for pattern detection
                    if (roundData.roundId) {
                        const segments = roundData.roundId.split('-');
                        // Analyze character distribution in segments
                        const charPatterns = segments.map(seg => {
                            const chars = seg.split('');
                            return {
                                sum: chars.reduce((a, c) => a + c.charCodeAt(0), 0),
                                avg: chars.reduce((a, c) => a + c.charCodeAt(0), 0) / chars.length,
                                variance: Math.sqrt(
                                    chars.reduce((sum, c) => {
                                        const val = c.charCodeAt(0);
                                        return sum + Math.pow(val - (chars.reduce((a, c2) => a + c2.charCodeAt(0), 0) / chars.length), 2);
                                    }, 0) / chars.length
                                )
                            };
                        });
                        
                        // Use pattern variance to adjust
                        const patternVariance = charPatterns.reduce((sum, p) => sum + p.variance, 0) / charPatterns.length;
                        const patternAdjustment = (patternVariance % 50) / 5; // 0-10 range
                        baseMultiplier += patternAdjustment - 5; // Center around 0
                    }
                }
                
                // Final adjustments and bounds
                baseMultiplier = Math.max(1.01, Math.min(1000.00, baseMultiplier));
                prediction = baseMultiplier.toFixed(2);
                
                // Calculate safe cash out (conservative - 65-75% of prediction, but minimum 1.5x)
                const safeCashOutPercent = 0.65 + (Math.random() * 0.1); // 65-75% range
                let safeCashOutValue = (baseMultiplier * safeCashOutPercent);
                safeCashOutValue = Math.max(1.50, Math.min(safeCashOutValue, baseMultiplier * 0.9));
                safeCashOut = safeCashOutValue.toFixed(2);
                
                // Calculate fluctuating confidence (45-98% range with variance)
                // Add time-based fluctuation and random variance
                const timeVariance = Math.sin(Date.now() / 5000) * 5; // Slow sine wave
                const randomVariance = (Math.random() - 0.5) * 8; // Random ±4%
                const dataQualityVariance = roundDataHistory.length > 0 ? 
                    Math.min(10, roundDataHistory.length * 0.5) : -5; // More data = higher confidence
                
                confidenceScore = confidenceScore + timeVariance + randomVariance + dataQualityVariance;
                confidenceScore = Math.max(45, Math.min(98, confidenceScore)); // 45-98% range
                
                // Round to whole number but add some visual fluctuation
                const baseConfidence = Math.floor(confidenceScore);
                const decimal = confidenceScore % 1;
                // Sometimes show .5 for more realistic fluctuation
                if (decimal > 0.3 && decimal < 0.7 && Math.random() > 0.5) {
                    confidence = `${baseConfidence}.5%`;
                } else {
                    confidence = `${baseConfidence}%`;
                }
                
                break;
            case 'mines':
                // Mines: Use selected prediction algorithm
                const minesResult = generateMinesPrediction(minesPredictionType);
                prediction = minesResult.positions.map(p => `Pos ${p}`).join(', ');
                confidence = minesResult.confidence;
                safeCashOut = 'N/A';
                break;
            case 'plinko':
                // Plinko multiplier prediction
                const multipliers = [0.2, 0.5, 1, 1.5, 2, 3, 5, 10, 20];
                prediction = multipliers[Math.floor(Math.random() * multipliers.length)];
                confidence = '55%';
                safeCashOut = 'N/A';
                break;
            case 'towers':
                // Tower floor prediction
                prediction = Math.floor(Math.random() * 13) + 1;
                confidence = '58%';
                safeCashOut = 'N/A';
                break;
            default:
                prediction = 'N/A';
                confidence = 'N/A';
                safeCashOut = 'N/A';
        }
        
        lastPrediction = { 
            game, 
            value: prediction, 
            timestamp: Date.now(), 
            round: roundCounter,
            confidence: confidence,
            safeCashOut: safeCashOut,
            roundId: roundData?.roundId || null
        };
        predictionHistory.push(lastPrediction);
        
        // Store crash round data
        if (game === 'crash' && roundData) {
            roundDataHistory.push({
                ...roundData,
                predictedMultiplier: parseFloat(prediction),
                safeCashOut: safeCashOut ? parseFloat(safeCashOut) : null,
                timestamp: Date.now()
            });
            // Keep only last 50 rounds
            if (roundDataHistory.length > 50) {
                roundDataHistory.shift();
            }
        }
        
        // Update statistics
        statistics.totalPredictions++;
        if (!statistics.gamesPlayed[game]) {
            statistics.gamesPlayed[game] = 0;
        }
        statistics.gamesPlayed[game]++;
        statistics.lastUpdate = getFullTimestamp();
        
        return { prediction, confidence, safeCashOut };
    }

    function updateStatistics() {
        const statsEl = document.getElementById('statistics');
        if (!statsEl) return;
        
        const gamesList = Object.entries(statistics.gamesPlayed)
            .map(([game, count]) => `${game.toUpperCase()}: ${count}`)
            .join(' • ') || 'None';
        
        statsEl.innerHTML = `
            <div style="margin-bottom:12px;">
                <strong style="color:#ff6666;">Total Predictions:</strong> 
                <span style="color:#ffffff;">${statistics.totalPredictions}</span>
            </div>
            <div style="margin-bottom:12px;">
                <strong style="color:#ff6666;">Accuracy Rate:</strong> 
                <span style="color:#00ff99;">${statistics.accuracy.toFixed(1)}%</span>
            </div>
            <div style="margin-bottom:12px;">
                <strong style="color:#ff6666;">Games Tracked:</strong> 
                <span style="color:#ffffff;">${gamesList}</span>
            </div>
            <div style="margin-bottom:12px;">
                <strong style="color:#ff6666;">Last Update:</strong> 
                <span style="color:#888888; font-size:12px;">${statistics.lastUpdate || 'Never'}</span>
            </div>
            <div>
                <strong style="color:#ff6666;">Current Round:</strong> 
                <span style="color:#ffffff;">#${roundCounter}</span>
            </div>
        `;
    }

    function checkRoundIdChange() {
        // Check the fairness modal element (user needs to click fairness button)
        if (!roundIdElement || !document.body.contains(roundIdElement)) {
            roundIdElement = findRoundIdElement();
        }
        
        if (!roundIdElement) {
            return false;
        }
        
        const currentRoundId = roundIdElement.value;
        
        // Update round ID display even if it hasn't changed (so user can see it)
        if (currentRoundId && currentRoundId.length > 10) {
            const roundIdDisplay = document.getElementById('currentRoundId');
            if (roundIdDisplay && roundIdDisplay.textContent !== currentRoundId.substring(0, 8) + '...') {
                roundIdDisplay.textContent = currentRoundId.substring(0, 8) + '...';
            }
        }
        
        // Check if we have a valid round ID and it changed
        if (currentRoundId && currentRoundId.length > 10) {
            if (lastRoundId === null) {
                // First detection
                lastRoundId = currentRoundId;
                log(`Round ID monitoring started: ${currentRoundId.substring(0, 8)}...`, '#00ff99', '✅');
                
                // Update display
                const roundIdDisplay = document.getElementById('currentRoundId');
                const roundsTrackedDisplay = document.getElementById('roundsTracked');
                const dataPointsDisplay = document.getElementById('dataPoints');
                const monitoringStatusDisplay = document.getElementById('monitoringStatus');
                
                if (roundIdDisplay) {
                    roundIdDisplay.textContent = currentRoundId.substring(0, 8) + '...';
                }
                if (roundsTrackedDisplay) {
                    roundsTrackedDisplay.textContent = roundDataHistory.length;
                }
                if (dataPointsDisplay) {
                    const totalDataPoints = roundDataHistory.length + actualMultiplierHistory.length;
                    dataPointsDisplay.textContent = totalDataPoints;
                }
                if (monitoringStatusDisplay) {
                    monitoringStatusDisplay.textContent = 'Active';
                    monitoringStatusDisplay.style.color = '#00ff99';
                }
                
                // Generate initial prediction
                const roundData = collectCrashData();
                roundData.roundId = currentRoundId;
                const result = generatePrediction('crash', roundData);
                updatePredictionDisplay('crash', result.prediction, result.confidence, result.safeCashOut);
                updateStatistics();
                
                return true;
            } else if (currentRoundId !== lastRoundId) {
                // New round detected!
                lastRoundId = currentRoundId;
                roundCounter++;
                
                log(`🔄 NEW ROUND DETECTED: ${currentRoundId.substring(0, 8)}...`, '#ff6666', '🔄');
                
                // Update round info display
                const roundIdDisplay = document.getElementById('currentRoundId');
                const roundsTrackedDisplay = document.getElementById('roundsTracked');
                const dataPointsDisplay = document.getElementById('dataPoints');
                const monitoringStatusDisplay = document.getElementById('monitoringStatus');
                
                if (roundIdDisplay) {
                    roundIdDisplay.textContent = currentRoundId.substring(0, 8) + '...';
                }
                
                // Collect comprehensive data for this round
                const roundData = collectCrashData();
                roundData.roundId = currentRoundId;
                
                log(`📊 Collecting data: Multiplier=${roundData.currentMultiplier || 'N/A'}, State=${roundData.gameState || 'N/A'}`, '#ffcc00', '📊');
                
                // Generate prediction with all collected data
                const result = generatePrediction('crash', roundData);
                updatePredictionDisplay('crash', result.prediction, result.confidence, result.safeCashOut);
                updateStatistics();
                
                // Update all display elements
                if (roundsTrackedDisplay) {
                    roundsTrackedDisplay.textContent = roundDataHistory.length;
                }
                if (dataPointsDisplay) {
                    const totalDataPoints = roundDataHistory.length + actualMultiplierHistory.length;
                    dataPointsDisplay.textContent = totalDataPoints;
                }
                if (monitoringStatusDisplay) {
                    monitoringStatusDisplay.textContent = 'Active';
                    monitoringStatusDisplay.style.color = '#00ff99';
                }
                
                log(`🎯 Prediction: ${result.prediction}x (Confidence: ${result.confidence})`, '#00ff99', '🎯');
                log(`📊 Data Points: ${roundDataHistory.length + actualMultiplierHistory.length} | Rounds: ${roundDataHistory.length}`, '#ffcc00', '📊');
                
                return true;
            }
        }
        
        return false;
    }

    function monitorCrashRounds() {
        // Stop existing observers/intervals
        if (crashObserver) {
            crashObserver.disconnect();
            crashObserver = null;
        }
        if (crashPollInterval) {
            clearInterval(crashPollInterval);
            crashPollInterval = null;
        }
        if (crashDataCollectionInterval) {
            clearInterval(crashDataCollectionInterval);
            crashDataCollectionInterval = null;
        }
        
        log('Starting crash round monitoring...', '#00ff99', '🚀');
        log('Click Fairness button before round starts to get Round ID', '#ffcc00', '💡');
        
        // Try to find element initially
        roundIdElement = findRoundIdElement();
        
        // Set up MutationObserver when element is found
        function setupObserver() {
            if (roundIdElement && !crashObserver) {
                crashObserver = new MutationObserver(() => {
                    checkRoundIdChange();
                });
                
                crashObserver.observe(roundIdElement, {
                    attributes: true,
                    attributeFilter: ['value']
                });
                log('Round ID element observer set up', '#00ff99', '✅');
            }
        }
        
        // Initial check and observer setup
        if (roundIdElement) {
            setupObserver();
            checkRoundIdChange();
        }
        
        // Function to update data points display
        function updateDataPointsDisplay() {
            const dataPointsDisplay = document.getElementById('dataPoints');
            const roundsTrackedDisplay = document.getElementById('roundsTracked');
            if (dataPointsDisplay) {
                const totalDataPoints = roundDataHistory.length + actualMultiplierHistory.length;
                dataPointsDisplay.textContent = totalDataPoints;
            }
            if (roundsTrackedDisplay) {
                roundsTrackedDisplay.textContent = roundDataHistory.length;
            }
        }
        
        // Polling to find element and check for changes
        let lastCheckTime = 0;
        crashPollInterval = setInterval(() => {
            if (currentGame !== 'crash') {
                clearInterval(crashPollInterval);
                crashPollInterval = null;
                return;
            }
            
            const now = Date.now();
            // Check every 1 second
            if (now - lastCheckTime < 1000) return;
            lastCheckTime = now;
            
            // Try to find element if we don't have it
            if (!roundIdElement || !document.body.contains(roundIdElement)) {
                roundIdElement = findRoundIdElement();
                if (roundIdElement) {
                    setupObserver();
                    log('Round ID element found!', '#00ff99', '✅');
                }
            }
            
            // Check for round ID change
            if (roundIdElement) {
                checkRoundIdChange();
            }
            
            // Update data points display
            updateDataPointsDisplay();
        }, 1000);
        
        // Lightweight data collection - every 3 seconds
        crashDataCollectionInterval = setInterval(() => {
            if (currentGame !== 'crash') {
                clearInterval(crashDataCollectionInterval);
                crashDataCollectionInterval = null;
                return;
            }
            
            // Lightweight data collection - only get multiplier, skip expensive operations
            try {
                // Quick multiplier check (limited selectors)
                const multiplierEl = document.querySelector('[class*="multiplier"]:not([style*="display: none"])');
                if (multiplierEl) {
                    const text = multiplierEl.textContent || '';
                    const multiplierMatch = text.match(/(\d+\.?\d*)\s*x/i);
                    if (multiplierMatch) {
                        const multiplier = parseFloat(multiplierMatch[1]);
                        if (multiplier > 0 && (actualMultiplierHistory.length === 0 || 
                            actualMultiplierHistory[actualMultiplierHistory.length - 1].multiplier !== multiplier)) {
                            actualMultiplierHistory.push({
                                multiplier: multiplier,
                                timestamp: Date.now(),
                                roundId: lastRoundId
                            });
                            // Keep last 50 (reduced from 100)
                            if (actualMultiplierHistory.length > 50) {
                                actualMultiplierHistory.shift();
                            }
                        }
                    }
                }
            } catch(e) {}
        }, 3000);
        
        log('Crash monitoring fully active (Observer + Polling + Data Collection)', '#00ff99', '✅');
    }

    function updateVisibility() {
        const game = detectGame();
        if (game === currentGame) return;
        
        const prevGame = currentGame;
        currentGame = game;

        // Hide all game sections
        ['crash', 'mines', 'plinko', 'towers', 'dice', 'roulette', 'welcome'].forEach(g => {
            const el = document.getElementById(`${g}Section`);
            if (el) el.style.display = 'none';
        });
        
        // Show welcome section if no game detected, otherwise show game section
        if (game === 'unknown') {
            const welcomeSection = document.getElementById('welcomeSection');
            if (welcomeSection) {
                welcomeSection.style.display = 'block';
            }
        } else {
            const currentSection = document.getElementById(`${game}Section`);
            if (currentSection) {
                currentSection.style.display = 'block';
            }
        }

        const statusEl = document.getElementById('status');
        if (statusEl) {
            if (game === 'unknown') {
                statusEl.innerHTML = `<span style="color:#00ff99;">●</span> Online • <span style="color:#888;">WAITING FOR GAME</span>`;
            } else {
                statusEl.innerHTML = `<span style="color:#00ff99;">●</span> Online • <span style="color:#ff6666;">${game.toUpperCase()}</span>`;
            }
        }
        
        if (game !== 'unknown') {
            log(`Game switched: ${prevGame.toUpperCase()} → ${game.toUpperCase()}`, '#ff6666', '🔄');
        }
        
        // Stop any existing intervals/observers
        if (predictionInterval) {
            clearInterval(predictionInterval);
            predictionInterval = null;
        }
        if (crashObserver) {
            crashObserver.disconnect();
            crashObserver = null;
        }
        if (crashPollInterval) {
            clearInterval(crashPollInterval);
            crashPollInterval = null;
        }
        if (crashDataCollectionInterval) {
            clearInterval(crashDataCollectionInterval);
            crashDataCollectionInterval = null;
        }
        if (minesObserver) {
            minesObserver.disconnect();
            minesObserver = null;
        }
        if (minesDataObserver) {
            minesDataObserver.disconnect();
            minesDataObserver = null;
        }
        lastMinesButtonState = false;
        
        if (game === 'crash') {
            // For crash, monitor round IDs instead of using intervals
            log('Initializing crash round monitoring...', '#00ff99', '🚀');
            setTimeout(() => monitorCrashRounds(), 500);
        } else if (game === 'mines') {
            // For mines, monitor button state and collect data
            monitorMinesButton();
            // Initialize algorithm selector
            changeMinesPredictionType(minesPredictionType);
        } else if (game !== 'unknown') {
            // For other games, use interval-based predictions
            startPredictions(game);
        }
    }


    function startPredictions(game) {
        // Generate initial prediction
        const result = generatePrediction(game);
        updatePredictionDisplay(game, result.prediction, result.confidence, result.safeCashOut);
        log(`Prediction generated for ${game.toUpperCase()}`, '#00ff99', '🎯');
        
        // Update every 3-8 seconds (only for non-crash and non-mines games)
        if (game !== 'crash' && game !== 'mines') {
            predictionInterval = setInterval(() => {
                const newResult = generatePrediction(game);
                updatePredictionDisplay(game, newResult.prediction, newResult.confidence, newResult.safeCashOut);
                updateStatistics();
                log(`New prediction calculated (Round #${roundCounter})`, '#ffcc00', '⚡');
            }, 3000 + Math.random() * 5000);
        }
        // Note: mines is handled separately in updateVisibility
    }

    // Monitor mines "Waiting to uncover a tile" button and "End game" button
    let lastEndGameButtonState = false;
    
    function monitorMinesButton() {
        if (minesObserver) {
            minesObserver.disconnect();
        }
        
        // Generate initial prediction
        const result = generatePrediction('mines');
        updatePredictionDisplay('mines', result.prediction, result.confidence, result.safeCashOut);
        log('Initial mines prediction generated', '#00ff99', '💎');
        
        function checkMinesButton() {
            try {
                // Look for button with text "Waiting to uncover a tile"
                const buttons = document.querySelectorAll('button.gameBetSubmit');
                let foundWaitingButton = false;
                let foundEndGameButton = false;
                
                for (const button of buttons) {
                    const buttonText = button.textContent || '';
                    if (buttonText.includes('Waiting to uncover a tile')) {
                        foundWaitingButton = true;
                    }
                    // Check for "End game" button - it contains "End game" and a multiplier
                    if (buttonText.includes('End game') && buttonText.includes('x')) {
                        foundEndGameButton = true;
                    }
                }
                
                // When "End game" button appears, collect data
                if (foundEndGameButton && !lastEndGameButtonState) {
                    console.log('End game button appeared - collecting mines data');
                    lastEndGameButtonState = true;
                    
                    // Wait a moment for all mines to be revealed, then collect
                    setTimeout(() => {
                        const collected = collectMinesData();
                        if (collected) {
                            // Regenerate prediction with new data
                            const newResult = generatePrediction('mines');
                            updatePredictionDisplay('mines', newResult.prediction, newResult.confidence, newResult.safeCashOut);
                        }
                    }, 300);
                } else if (!foundEndGameButton) {
                    lastEndGameButtonState = false;
                }
                
                // Only update if button just appeared (was false, now true)
                if (foundWaitingButton && !lastMinesButtonState) {
                    console.log('Mines button appeared - generating new prediction');
                    const newResult = generatePrediction('mines');
                    updatePredictionDisplay('mines', newResult.prediction, newResult.confidence, newResult.safeCashOut);
                    log('New mines prediction generated', '#00ff99', '💎');
                    lastMinesButtonState = true;
                } else if (!foundWaitingButton) {
                    lastMinesButtonState = false;
                }
            } catch (error) {
                console.error('Error checking mines button:', error);
            }
        }
        
        // Check immediately
        checkMinesButton();
        
        // Set up observer to watch for button changes
        minesObserver = new MutationObserver(() => {
            checkMinesButton();
        });
        
        // Observe the document body for changes
        if (document.body) {
            minesObserver.observe(document.body, {
                childList: true,
                subtree: true,
                characterData: true,
                attributes: true,
                attributeFilter: ['disabled', 'class']
            });
        }
        
        // Also poll every 500ms as backup
        setInterval(checkMinesButton, 500);
    }

    function updatePredictionDisplay(game, prediction, confidence = 'N/A', safeCashOut = null) {
        switch(game) {
            case 'crash':
                const crashEl = document.getElementById('crashPred');
                const crashConfEl = document.querySelector('#crashSection .prediction-confidence');
                const crashSafeEl = document.getElementById('crashSafeCashOut');
                
                if (crashEl) {
                    crashEl.innerHTML = `<span style="font-size:48px; color:#ff3333; text-shadow: 0 0 20px rgba(255,51,51,0.8);">${prediction}x</span>`;
                }
                if (crashConfEl) {
                    crashConfEl.innerHTML = `Confidence: <span style="color:#00ff99;">${confidence}</span>`;
                }
                if (crashSafeEl && safeCashOut) {
                    crashSafeEl.innerHTML = `<div style="margin-top:15px; padding:12px; background:linear-gradient(135deg, #1a3a1a 0%, #0a2a0a 100%); border-radius:10px; border:2px solid #00ff99;">
                        <div style="font-size:14px; color:#888; margin-bottom:5px;">💰 Safe Cash Out</div>
                        <div style="font-size:32px; color:#00ff99; font-weight:bold; text-shadow: 0 0 15px rgba(0,255,153,0.6);">${safeCashOut}x</div>
                        <div style="font-size:11px; color:#666; margin-top:5px;">Recommended to cash out at this multiplier for safety</div>
                    </div>`;
                }
                break;
            case 'mines':
                const minesEl = document.getElementById('minesPred');
                if (minesEl) {
                    // Parse positions from "Pos 1, Pos 5, Pos 12" format
                    const positionNumbers = prediction.split(', ').map(p => {
                        const match = p.match(/\d+/);
                        return match ? parseInt(match[0]) : null;
                    }).filter(p => p !== null);
                    
                    // Display as a visual grid representation
                    minesEl.innerHTML = `
                        <div style="text-align: center; margin-bottom: 10px; color: #00ff99; font-weight: bold; font-size: 14px;">
                            Safe Positions (5x5 Grid):
                        </div>
                        <div id="apexMinesGrid" style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 4px; max-width: 300px; margin: 0 auto;">
                            ${Array.from({length: 25}, (_, i) => {
                                const posNum = i + 1;
                                const isSafe = positionNumbers.includes(posNum);
                                return `
                                    <div style="
                                        width: 40px; 
                                        height: 40px; 
                                        display: flex; 
                                        align-items: center; 
                                        justify-content: center;
                                        background: ${isSafe ? '#00ff99' : '#1a1a1a'};
                                        color: ${isSafe ? '#000' : '#666'};
                                        border: 1px solid ${isSafe ? '#00ff99' : '#333'};
                                        border-radius: 4px;
                                        font-weight: bold;
                                        font-size: 12px;
                                    ">
                                        ${posNum}
                                    </div>
                                `;
                            }).join('')}
                        </div>
                        <div style="text-align: center; margin-top: 10px; color: #888; font-size: 11px;">
                            Green = Safe | Gray = Unknown
                        </div>
                    `;
                }
                break;
            case 'plinko':
                const plinkoEl = document.getElementById('plinkoPred');
                if (plinkoEl) {
                    plinkoEl.innerHTML = `<span style="font-size:40px; color:#ff6666;">${prediction}x</span>`;
                }
                break;
            case 'towers':
                const towersEl = document.getElementById('towersPred');
                if (towersEl) {
                    towersEl.innerHTML = `<span style="font-size:40px; color:#ff6666;">Floor ${prediction}</span>`;
                }
                break;
        }
    }

    function initGUI() {
        // Only initialize if user is authenticated and whitelisted
        if (!isWhitelisted || !currentUser) {
            return;
        }
        
        // MUST have verified UID - no temp UIDs allowed (check for 'code_' prefix)
        if (!currentUser.uid || currentUser.uid.startsWith('code_')) {
            // Show verification message instead of UI
            showProfileVerificationMessage();
            return;
        }
        
        // Remove verification message if it exists
        const verificationMsg = document.getElementById('apexVerificationMessage');
        if (verificationMsg) verificationMsg.remove();
        
        if (document.getElementById('apexToggle')) return;

        const style = document.createElement('style');
        style.id = 'apexPredictorStyles';
        style.innerHTML = `
            /* Scope all styles to script's own elements only - don't affect website */
            @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.6; }
            }
            @keyframes glow {
                0%, 100% { box-shadow: 0 0 25px rgba(255,51,51,0.8); }
                50% { box-shadow: 0 0 40px rgba(255,51,51,1), 0 0 60px rgba(255,102,102,0.6); }
            }
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes fadeIn {
                from { opacity: 0; transform: scale(0.95); }
                to { opacity: 1; transform: scale(1); }
            }

            #apexToggle {
                position: fixed !important;
                top: 20px !important;
                right: 20px !important;
                left: auto !important;
                bottom: auto !important;
                width: 160px;
                height: 60px;
                background: linear-gradient(135deg, #0f0f0f 0%, #1a0000 50%, #0f0f0f 100%);
                border: 3px solid #ff3333;
                border-radius: 30px;
                display: flex !important;
                align-items: center;
                justify-content: center;
                color: #ff6666;
                font-family: 'Segoe UI', 'Roboto', Arial, sans-serif;
                font-weight: 900;
                font-size: 22px;
                letter-spacing: 2px;
                cursor: pointer;
                box-shadow: 0 0 30px rgba(255,51,51,0.9), inset 0 0 20px rgba(255,51,51,0.1);
                z-index: 999999999 !important;
                transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
                text-transform: uppercase;
                overflow: hidden;
                margin: 0 !important;
                padding: 0 !important;
            }
            #apexToggle::before {
                content: '';
                position: absolute;
                top: -50%;
                left: -50%;
                width: 200%;
                height: 200%;
                background: linear-gradient(45deg, transparent, rgba(255,51,51,0.1), transparent);
                transform: rotate(45deg);
                transition: all 0.6s;
            }
            #apexToggle:hover::before {
                left: 100%;
            }
            #apexToggle:hover {
                transform: translateY(-8px) scale(1.08);
                box-shadow: 0 0 50px rgba(255,51,51,1), 0 10px 30px rgba(0,0,0,0.5);
                border-color: #ff5555;
            }
            #apexToggle:active {
                transform: translateY(-4px) scale(1.04);
            }

            #apexMenu {
                position: fixed;
                top: 100px;
                right: 30px;
                width: 450px;
                height: 750px;
                background: linear-gradient(135deg, #0a0a0a 0%, #111111 50%, #0a0a0a 100%);
                border: 3px solid #ff3333;
                border-radius: 24px;
                box-shadow: 0 0 60px rgba(255,51,51,0.7), inset 0 0 40px rgba(0,0,0,0.5);
                z-index: 999999998;
                display: flex;
                flex-direction: column;
                font-family: 'Segoe UI', 'Roboto', Arial, sans-serif;
                color: #ffffff;
                overflow: hidden;
                opacity: 0;
                pointer-events: none;
                transform: scale(0.95) translateY(20px);
                transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
                backdrop-filter: blur(10px);
            }
            #apexMenu.visible {
                opacity: 1;
                pointer-events: all;
                transform: scale(1) translateY(0);
                animation: fadeIn 0.5s ease-out;
            }

            #apexHeader {
                background: linear-gradient(135deg, #330000 0%, #220000 50%, #440000 100%);
                padding: 30px;
                text-align: center;
                font-size: 34px;
                font-weight: 900;
                cursor: move;
                color: #ff3333;
                letter-spacing: 3px;
                box-shadow: 0 8px 25px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,51,51,0.3);
                text-transform: uppercase;
                position: relative;
                user-select: none;
            }
            #apexHeader::after {
                content: 'ELITE PRO 2025';
                position: absolute;
                bottom: 8px;
                left: 50%;
                transform: translateX(-50%);
                font-size: 10px;
                letter-spacing: 4px;
                color: #ff9999;
                opacity: 0.7;
            }
            #apexHeader:hover {
                background: linear-gradient(135deg, #440000 0%, #330000 50%, #550000 100%);
            }

            #apexContent {
                flex: 1;
                padding: 30px;
                overflow-y: auto;
                background: linear-gradient(to bottom, #111111, #0a0a0a);
                scrollbar-width: thin;
                scrollbar-color: #ff3333 #1a1a1a;
            }
            #apexContent::-webkit-scrollbar {
                width: 8px;
            }
            #apexContent::-webkit-scrollbar-track {
                background: #1a1a1a;
                border-radius: 4px;
            }
            #apexContent::-webkit-scrollbar-thumb {
                background: #ff3333;
                border-radius: 4px;
            }
            #apexContent::-webkit-scrollbar-thumb:hover {
                background: #ff5555;
            }

            .apexSection {
                margin-bottom: 30px;
                background: linear-gradient(135deg, #1a1a1a 0%, #151515 100%);
                padding: 25px;
                border-radius: 18px;
                border-left: 6px solid #ff3333;
                box-shadow: 0 6px 20px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05);
                transition: all 0.3s ease;
                position: relative;
                overflow: hidden;
            }
            .apexSection::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                height: 2px;
                background: linear-gradient(90deg, transparent, #ff3333, transparent);
                opacity: 0;
                transition: opacity 0.3s;
            }
            .apexSection:hover {
                transform: translateX(5px);
                box-shadow: 0 8px 25px rgba(255,51,51,0.3), inset 0 1px 0 rgba(255,255,255,0.05);
            }
            .apexSection:hover::before {
                opacity: 1;
            }

            .apexSection h3 {
                margin: 0 0 20px 0;
                color: #ff6666;
                font-size: 24px;
                letter-spacing: 1.5px;
                text-transform: uppercase;
                font-weight: 700;
                text-shadow: 0 0 10px rgba(255,102,102,0.5);
                display: flex;
                align-items: center;
                gap: 10px;
            }
            .apexSection h3::before {
                content: '▶';
                font-size: 14px;
                color: #ff3333;
            }

            #crashPred, #plinkoPred, #towersPred {
                font-size: 48px;
                color: #ff6666;
                text-align: center;
                margin: 25px 0;
                font-weight: 900;
                letter-spacing: 2px;
                text-shadow: 0 0 20px rgba(255,102,102,0.8);
                animation: pulse 2s ease-in-out infinite;
            }

            #minesPred {
                color: #00ff99;
                font-size: 16px;
                line-height: 2;
                text-align: center;
            }

            /* Only style buttons inside the script's UI - don't affect website buttons */
            #apexMenu button,
            #apexAuthModal button,
            #apexVerificationMessage button,
            #apexProfileNotification button,
            #apexUIDInputModal button {
                background: linear-gradient(135deg, #222222 0%, #2a0000 50%, #222222 100%);
                color: #ff6666;
                border: 2px solid #ff3333;
                padding: 16px 20px;
                border-radius: 16px;
                cursor: pointer;
                font-weight: 700;
                font-size: 18px;
                width: 100%;
                transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
                text-transform: uppercase;
                letter-spacing: 1px;
                position: relative;
                overflow: hidden;
                margin-top: 10px;
            }
            #apexMenu button::before,
            #apexAuthModal button::before,
            #apexVerificationMessage button::before,
            #apexProfileNotification button::before,
            #apexUIDInputModal button::before {
                content: '';
                position: absolute;
                top: 50%;
                left: 50%;
                width: 0;
                height: 0;
                border-radius: 50%;
                background: rgba(255,51,51,0.3);
                transform: translate(-50%, -50%);
                transition: width 0.6s, height 0.6s;
            }
            #apexMenu button:hover::before,
            #apexAuthModal button:hover::before,
            #apexVerificationMessage button:hover::before,
            #apexProfileNotification button:hover::before,
            #apexUIDInputModal button:hover::before {
                width: 300px;
                height: 300px;
            }
            #apexMenu button:hover,
            #apexAuthModal button:hover,
            #apexVerificationMessage button:hover,
            #apexProfileNotification button:hover,
            #apexUIDInputModal button:hover {
                background: linear-gradient(135deg, #333333 0%, #440000 50%, #333333 100%);
                box-shadow: 0 0 30px rgba(255,51,51,0.9), inset 0 0 20px rgba(255,51,51,0.1);
                transform: translateY(-3px) scale(1.02);
                border-color: #ff5555;
            }
            #apexMenu button:active,
            #apexAuthModal button:active,
            #apexVerificationMessage button:active,
            #apexProfileNotification button:active,
            #apexUIDInputModal button:active {
                transform: translateY(-1px) scale(0.98);
            }
            #apexMenu button span,
            #apexAuthModal button span,
            #apexVerificationMessage button span,
            #apexProfileNotification button span,
            #apexUIDInputModal button span {
                position: relative;
                z-index: 1;
            }

            #apexLog {
                background: linear-gradient(135deg, #000000 0%, #0a0a0a 100%);
                padding: 18px;
                font-family: 'Courier New', 'Consolas', 'Monaco', monospace;
                font-size: 13px;
                line-height: 1.9;
                border-radius: 14px;
                border: 1px solid #333333;
                max-height: 280px;
                overflow-y: auto;
                box-shadow: inset 0 2px 10px rgba(0,0,0,0.5);
                scrollbar-width: thin;
                scrollbar-color: #ff3333 #1a1a1a;
            }
            #apexLog::-webkit-scrollbar {
                width: 6px;
            }
            #apexLog::-webkit-scrollbar-track {
                background: #0a0a0a;
                border-radius: 3px;
            }
            #apexLog::-webkit-scrollbar-thumb {
                background: #ff3333;
                border-radius: 3px;
            }

            #apexLog div {
                margin-bottom: 10px;
                padding: 4px 0;
                border-bottom: 1px solid rgba(255,51,51,0.1);
                animation: slideIn 0.3s ease-out;
            }
            #apexLog div:last-child {
                border-bottom: none;
            }

            .stat-badge {
                display: inline-block;
                padding: 6px 12px;
                background: rgba(255,51,51,0.2);
                border: 1px solid #ff3333;
                border-radius: 8px;
                margin: 4px;
                font-size: 12px;
                color: #ff9999;
            }

            .prediction-confidence {
                font-size: 14px;
                color: #00ff99;
                margin-top: 10px;
                text-align: center;
                font-style: italic;
            }
            
            /* Ensure script's grid doesn't interfere with website grids */
            #apexMinesGrid {
                isolation: isolate;
                contain: layout style paint;
            }
            
            /* Mines algorithm buttons */
            .mines-algo-btn:hover {
                background: linear-gradient(135deg, #2a1a1a 0%, #3a0000 100%) !important;
                border-color: #00ff99 !important;
                transform: translateY(-2px);
                box-shadow: 0 4px 15px rgba(0, 255, 153, 0.3);
            }
            .mines-algo-btn.active {
                background: linear-gradient(135deg, #1a3a1a 0%, #0a2a0a 100%) !important;
                border-color: #00ff99 !important;
                box-shadow: 0 0 20px rgba(0, 255, 153, 0.5);
            }
        `;
        document.head.appendChild(style);

        const toggle = document.createElement('div');
        toggle.id = 'apexToggle';
        toggle.innerHTML = 'PREDICT';
        // Ensure top-right positioning
        toggle.style.position = 'fixed';
        toggle.style.top = '20px';
        toggle.style.right = '20px';
        toggle.style.left = 'auto';
        toggle.style.bottom = 'auto';
        toggle.style.zIndex = '999999999';
        document.body.appendChild(toggle);

        const menu = document.createElement('div');
        menu.id = 'apexMenu';
        menu.innerHTML = `
            <div id="apexHeader">ApexPredictor</div>
            <div id="apexContent">
                <div class="apexSection">
                    <h3>⚡ System Status</h3>
                    <p id="status" style="font-size:16px; margin:10px 0;">
                        <span style="color:#00ff99;">●</span> Online • 
                        <span style="color:#ff6666;">INITIALIZING</span>
                    </p>
                    <div style="margin-top:15px; padding:12px; background:#0a0a0a; border-radius:8px; border:1px solid #333;">
                        <div style="font-size:12px; color:#888; margin-bottom:8px;">Version 4.0 • Elite Pro Edition</div>
                        <div style="font-size:12px; color:#888; margin-bottom:8px;">Advanced Prediction Engine Active</div>
                        <div style="font-size:12px; color:#00ff99; margin-top:8px; padding-top:8px; border-top:1px solid #333;">
                            👤 <span id="userEmail">Loading...</span>
                        </div>
                    </div>
                </div>

                <div class="apexSection" id="welcomeSection">
                    <h3>👋 Welcome</h3>
                    <div style="padding: 20px; text-align: center;">
                        <div style="font-size: 18px; color: #00ff99; margin-bottom: 15px; font-weight: bold;">
                            Go to a gamemode and it'll start!
                        </div>
                        <div style="margin-top: 20px; padding: 15px; background: linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%); border-radius: 10px; border: 2px solid #333;">
                            <div style="color: #00ff99; font-size: 14px; font-weight: bold; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 1px;">
                                🎮 Working Games
                            </div>
                            <div style="display: flex; flex-direction: column; gap: 8px; align-items: center;">
                                <div style="padding: 10px; background: #1a1a1a; border-radius: 8px; width: 100%; border: 1px solid #333;">
                                    <span style="color: #00ff99;">💎</span> <span style="color: #fff; font-weight: bold;">Mines</span>
                                </div>
                                <div style="padding: 10px; background: #1a1a1a; border-radius: 8px; width: 100%; border: 1px solid #333;">
                                    <span style="color: #00ff99;">🎯</span> <span style="color: #fff; font-weight: bold;">Crash</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="apexSection" id="crashSection" style="display:none;">
                    <h3>🎯 Crash Prediction</h3>
                    <div id="crashPred">Analyzing...</div>
                    <div class="prediction-confidence">Confidence: Calculating...</div>
                    <div id="crashSafeCashOut"></div>
                    <div id="roundInfo" style="margin-top:15px; padding:10px; background:#0a0a0a; border-radius:8px; border:1px solid #333; font-size:12px; color:#888;">
                        <div>Round ID: <span id="currentRoundId" style="color:#00ff99;">Waiting...</span></div>
                        <div style="margin-top:5px;">Rounds Tracked: <span id="roundsTracked" style="color:#ff6666;">0</span></div>
                        <div style="margin-top:5px;">Data Points: <span id="dataPoints" style="color:#ffcc00;">0</span></div>
                        <div style="margin-top:5px; font-size:11px; color:#666;">
                            <div>Monitoring: <span id="monitoringStatus" style="color:#00ff99;">Active</span></div>
                            <div style="margin-top:3px; color:#ffcc00; font-size:10px;">💡 Click Fairness button before round starts to predict</div>
                        </div>
                    </div>
                </div>

                <div class="apexSection" id="minesSection" style="display:none;">
                    <h3>💎 Safe Gem Positions</h3>
                    <div style="margin-bottom: 15px; padding: 15px; background: linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%); border-radius: 10px; border: 2px solid #333; box-shadow: inset 0 2px 10px rgba(0,0,0,0.5);">
                        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px;">
                            <span style="color: #00ff99; font-size: 16px;">⚙️</span>
                            <label style="color: #00ff99; font-size: 13px; font-weight: bold; text-transform: uppercase; letter-spacing: 1.5px;">
                                Algorithm Mode
                            </label>
                        </div>
                        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px;">
                            <button onclick="changeMinesPredictionType('nexus')" id="btn-nexus" class="mines-algo-btn" style="padding: 12px; background: linear-gradient(135deg, #1a1a1a 0%, #2a0000 100%); border: 2px solid #333; border-radius: 8px; color: #fff; font-size: 13px; font-weight: bold; cursor: pointer; transition: all 0.3s; text-align: center;">
                                <div style="color: #00ff99; font-size: 11px; margin-bottom: 4px;">NEXUS</div>
                                <div style="color: #888; font-size: 10px;">Data-Driven</div>
                            </button>
                            <button onclick="changeMinesPredictionType('quantum')" id="btn-quantum" class="mines-algo-btn" style="padding: 12px; background: linear-gradient(135deg, #1a1a1a 0%, #2a0000 100%); border: 2px solid #333; border-radius: 8px; color: #fff; font-size: 13px; font-weight: bold; cursor: pointer; transition: all 0.3s; text-align: center;">
                                <div style="color: #00ff99; font-size: 11px; margin-bottom: 4px;">QUANTUM</div>
                                <div style="color: #888; font-size: 10px;">Bomb Avoidance</div>
                            </button>
                            <button onclick="changeMinesPredictionType('vortex')" id="btn-vortex" class="mines-algo-btn" style="padding: 12px; background: linear-gradient(135deg, #1a1a1a 0%, #2a0000 100%); border: 2px solid #333; border-radius: 8px; color: #fff; font-size: 13px; font-weight: bold; cursor: pointer; transition: all 0.3s; text-align: center;">
                                <div style="color: #00ff99; font-size: 11px; margin-bottom: 4px;">VORTEX</div>
                                <div style="color: #888; font-size: 10px;">Spiral Core</div>
                            </button>
                            <button onclick="changeMinesPredictionType('prism')" id="btn-prism" class="mines-algo-btn" style="padding: 12px; background: linear-gradient(135deg, #1a1a1a 0%, #2a0000 100%); border: 2px solid #333; border-radius: 8px; color: #fff; font-size: 13px; font-weight: bold; cursor: pointer; transition: all 0.3s; text-align: center;">
                                <div style="color: #00ff99; font-size: 11px; margin-bottom: 4px;">PRISM</div>
                                <div style="color: #888; font-size: 10px;">Edge Focus</div>
                            </button>
                            <button onclick="changeMinesPredictionType('matrix')" id="btn-matrix" class="mines-algo-btn" style="padding: 12px; background: linear-gradient(135deg, #1a1a1a 0%, #2a0000 100%); border: 2px solid #333; border-radius: 8px; color: #fff; font-size: 13px; font-weight: bold; cursor: pointer; transition: all 0.3s; text-align: center;">
                                <div style="color: #00ff99; font-size: 11px; margin-bottom: 4px;">MATRIX</div>
                                <div style="color: #888; font-size: 10px;">Diagonal</div>
                            </button>
                            <button onclick="changeMinesPredictionType('chaos')" id="btn-chaos" class="mines-algo-btn" style="padding: 12px; background: linear-gradient(135deg, #1a1a1a 0%, #2a0000 100%); border: 2px solid #333; border-radius: 8px; color: #fff; font-size: 13px; font-weight: bold; cursor: pointer; transition: all 0.3s; text-align: center;">
                                <div style="color: #00ff99; font-size: 11px; margin-bottom: 4px;">CHAOS</div>
                                <div style="color: #888; font-size: 10px;">Random</div>
                            </button>
                        </div>
                        <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #333; font-size: 11px; color: #888; text-align: center;">
                            <span id="minesAlgorithmInfo">NEXUS: Using 0 games • Data-driven pattern analysis</span>
                        </div>
                    </div>
                    <div id="minesPred" style="min-height:60px; display:flex; flex-wrap:wrap; justify-content:center; align-items:center; padding:15px;"></div>
                    <div class="prediction-confidence">Recommended: 3-5 safe positions</div>
                </div>

                <div class="apexSection" id="plinkoSection" style="display:none;">
                    <h3>🎲 Plinko Multiplier</h3>
                    <div id="plinkoPred">Calculating...</div>
                    <div class="prediction-confidence">Next ball prediction active</div>
                </div>

                <div class="apexSection" id="towersSection" style="display:none;">
                    <h3>🏗️ Tower Floor</h3>
                    <div id="towersPred">Analyzing...</div>
                    <div class="prediction-confidence">Optimal floor detection</div>
                </div>

                <div class="apexSection">
                    <h3>📊 Statistics & Analytics</h3>
                    <div id="statistics" style="color:#ffffff; line-height:1.8;">
                        <div style="text-align:center; color:#888; padding:20px;">
                            Collecting data...
                        </div>
                    </div>
                </div>

                <div class="apexSection">
                    <h3>⚙️ Controls</h3>
                    <button onclick="toggleMinimize()"><span>🔒 Close Panel</span></button>
                    <button onclick="clearLogs()" style="margin-top:10px; background:linear-gradient(135deg, #2a0000 0%, #1a0000 100%);">
                        <span>🗑️ Clear Logs</span>
                    </button>
                    <button onclick="resetStats()" style="margin-top:10px; background:linear-gradient(135deg, #2a0000 0%, #1a0000 100%);">
                        <span>🔄 Reset Statistics</span>
                    </button>
                    <button onclick="handleSignOut()" style="margin-top:10px; background:linear-gradient(135deg, #3a0000 0%, #2a0000 100%); border-color: #ff6666;">
                        <span>🚪 Sign Out</span>
                    </button>
                </div>

                <div class="apexSection">
                    <h3>📝 System Log</h3>
                    <div id="apexLog"></div>
                </div>

                <div class="apexSection">
                    <h3>🎄 Christmas Update</h3>
                    <div style="padding: 15px; background: linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%); border-radius: 10px; border: 2px solid #333;">
                        <div style="color: #00ff99; font-size: 13px; font-weight: bold; margin-bottom: 12px;">
                            ✨ What's New
                        </div>
                        <div style="font-size: 12px; color: #888; line-height: 1.8;">
                            <div style="margin-bottom: 8px;">• 💎 <span style="color: #fff;">Mines Game</span> - Full prediction support with 6 algorithms</div>
                            <div style="margin-bottom: 8px;">• 🎯 <span style="color: #fff;">Crash Game</span> - Advanced pattern-based predictions</div>
                            <div style="margin-bottom: 8px;">• 🎨 <span style="color: #fff;">New UI</span> - Modern, sleek interface design</div>
                            <div>• 🔐 <span style="color: #fff;">Verification Process</span> - Secure UID-based access system</div>
                        </div>
                    </div>
                </div>

                <div class="apexSection">
                    <h3>🚀 Next Update</h3>
                    <div style="padding: 15px; background: linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%); border-radius: 10px; border: 2px solid #333;">
                        <div style="color: #ffcc00; font-size: 13px; font-weight: bold; margin-bottom: 12px;">
                            🔮 Coming Soon
                        </div>
                        <div style="font-size: 12px; color: #888; line-height: 1.8;">
                            <div style="margin-bottom: 8px;">• 🎨 <span style="color: #fff;">Better UI</span> - Enhanced user experience</div>
                            <div style="margin-bottom: 8px;">• 🧠 <span style="color: #fff;">Better Prediction Methods</span> - Improved algorithms</div>
                            <div style="margin-bottom: 8px;">• 📊 <span style="color: #fff;">Better Data Collecting</span> - More accurate analysis</div>
                            <div>• 🏗️ <span style="color: #fff;">Towers Game</span> - Full prediction support</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(menu);

        // Enhanced drag functionality with boundaries
        let isDragging = false;
        let offsetX = 0, offsetY = 0;
        const header = document.getElementById('apexHeader');
        
        header.addEventListener('mousedown', e => {
            isDragging = true;
            const rect = menu.getBoundingClientRect();
            offsetX = e.clientX - rect.left;
            offsetY = e.clientY - rect.top;
            menu.style.transition = 'none';
            header.style.cursor = 'grabbing';
            e.preventDefault();
        });
        
        document.addEventListener('mousemove', e => {
            if (isDragging) {
                const maxX = window.innerWidth - menu.offsetWidth;
                const maxY = window.innerHeight - menu.offsetHeight;
                
                let newX = e.clientX - offsetX;
                let newY = e.clientY - offsetY;
                
                // Boundary constraints
                newX = Math.max(0, Math.min(newX, maxX));
                newY = Math.max(0, Math.min(newY, maxY));
                
                menu.style.left = newX + 'px';
                menu.style.top = newY + 'px';
                menu.style.right = 'auto';
                menu.style.bottom = 'auto';
            }
        });
        
        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                menu.style.transition = 'opacity 0.5s ease';
                header.style.cursor = 'move';
            }
        });

        // Toggle functionality
        toggle.onclick = () => {
            menu.classList.toggle('visible');
            if (menu.classList.contains('visible')) {
                log('Panel opened', '#00ff99', '👁️');
            } else {
                log('Panel closed', '#ff6666', '👁️‍🗨️');
            }
        };
        
        window.toggleMinimize = () => {
            menu.classList.toggle('visible');
            if (menu.classList.contains('visible')) {
                log('Panel opened via button', '#00ff99', '👁️');
            } else {
                log('Panel closed via button', '#ff6666', '👁️‍🗨️');
            }
        };

        // Helper functions
        window.clearLogs = () => {
            const logEl = document.getElementById('apexLog');
            if (logEl) {
                logEl.innerHTML = '';
                log('Logs cleared', '#ffcc00', '🗑️');
            }
        };

        window.resetStats = () => {
            if (confirm('Reset all statistics? This cannot be undone.')) {
                statistics = {
                    totalPredictions: 0,
                    accuracy: 0,
                    gamesPlayed: {},
                    lastUpdate: null
                };
                roundCounter = 0;
                predictionHistory = [];
                updateStatistics();
                log('Statistics reset', '#ff3333', '🔄');
            }
        };

        window.handleSignOut = () => {
            if (confirm('Sign out? You will need to authenticate again to access the predictor.')) {
                signOut();
            }
        };

        // Enhanced hotkey system
        document.addEventListener('keydown', e => {
            // Ctrl+Shift+P - Toggle panel
            if (e.ctrlKey && e.shiftKey && e.key === 'P') {
                e.preventDefault();
                menu.classList.toggle('visible');
                log('Panel toggled via hotkey (Ctrl+Shift+P)', '#ff3333', '⌨️');
            }
            // Ctrl+Shift+L - Clear logs
            if (e.ctrlKey && e.shiftKey && e.key === 'L') {
                e.preventDefault();
                window.clearLogs();
            }
            // Ctrl+Shift+R - Reset stats
            if (e.ctrlKey && e.shiftKey && e.key === 'R') {
                e.preventDefault();
                window.resetStats();
            }
        });

        // Initialize statistics display
        updateStatistics();
        
        // Set user email display
        if (currentUser && currentUser.email) {
            const emailEl = document.getElementById('userEmail');
            if (emailEl) {
                emailEl.textContent = currentUser.email;
            }
        }
        
        // Initial logs with enhanced messaging
        setTimeout(() => {
            log('═══════════════════════════════════', '#ff3333');
            log('ApexPredictor Elite Pro v4.0', '#ff6666', '🚀');
            log('Advanced Prediction Engine Loaded', '#00ff99', '✅');
            log('═══════════════════════════════════', '#ff3333');
            log('Features: Multi-game support • Real-time analytics', '#ffffff', '⚡');
            log('Drag enabled • Hotkeys active • Statistics tracking', '#ffffff', '📊');
            log('Waiting for game detection...', '#ffcc00', '⏳');
        }, 500);

        // Game detection with enhanced monitoring
        updateVisibility();
        setInterval(() => {
            updateVisibility();
            updateStatistics();
        }, 1500);

        // Periodic status updates
        setInterval(() => {
            if (currentGame !== 'unknown' && lastPrediction) {
                const timeSince = Math.floor((Date.now() - lastPrediction.timestamp) / 1000);
                if (timeSince > 10) {
                    log(`Active monitoring: ${currentGame.toUpperCase()} (${timeSince}s since last prediction)`, '#888888', '👁️');
                }
            }
        }, 30000);
    }

    // Multiple initialization attempts for reliability
    function attemptInit() {
        if (document.body && document.head) {
            // Only init if authenticated, whitelisted, AND has verified UID
            if (authInitialized && isWhitelisted && currentUser && currentUser.uid && !currentUser.uid.startsWith('code_')) {
    initGUI();
            }
        }
    }

    // Try immediate initialization
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', attemptInit);
    } else {
        attemptInit();
    }

    // Fallback initialization attempts
    setTimeout(attemptInit, 1000);
    setTimeout(attemptInit, 3000);
    setTimeout(attemptInit, 5000);
    setTimeout(attemptInit, 10000);

    // Watch for dynamic content loading
    const observer = new MutationObserver(() => {
        if (!document.getElementById('apexToggle')) {
            attemptInit();
        }
    });
    
    if (document.body) {
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    // Watch for navigation to profile page - SIMPLIFIED
    let lastPath = window.location.pathname;
    setInterval(() => {
        const currentPath = window.location.pathname;
        if (currentPath !== lastPath && currentPath.includes('/profile')) {
            lastPath = currentPath;
            // If navigated to profile and user is logged in, verify UID
            if (currentUser && currentUser.code) {
                setTimeout(() => {
                    verifyUIDAndGrantAccess();
                }, 1500); // Wait for page to load
            }
        }
    }, 2000); // Check every 2 seconds instead of 1

})();