# Fix "Failed to Verify Access" Error

## Quick Checklist

When you get "failed to verify access", check these things:

### 1. Is the User in the Whitelist Collection?

1. Go to Firebase Console → Firestore Database → Data
2. Click on **"whitelist"** collection
3. Look for a document with the user's **UID** as the Document ID
4. **NOT their email** - it must be their UID!

### 2. Is the Document ID Correct?

- **WRONG:** Using email as Document ID
- **CORRECT:** Using UID as Document ID

**How to get the UID:**
- Check browser console (F12) - it will show the UID
- Or go to Firebase Console → Authentication → Users → Find their email → Copy the UID

### 3. Does the Document Have the Right Fields?

The document should have:
- `email` (string): their email address
- `active` (boolean): must be `true` (checked box)

### 4. Check Firestore Security Rules

1. Go to Firestore Database → Rules
2. Make sure rules allow reading:
   ```javascript
   allow read: if request.auth != null && request.auth.uid == userId;
   ```
3. Click "Publish" if you made changes

### 5. Check Browser Console

1. Press F12 to open console
2. Try to sign in
3. Look for error messages
4. You'll see:
   - "Checking whitelist for UID: [uid]"
   - "Whitelist document exists: true/false"
   - Any error codes

## Common Issues

### Issue: "Permission denied"
**Fix:** Update Firestore security rules (see Step 4 above)

### Issue: Document doesn't exist
**Fix:** Create the document with UID as Document ID (not email!)

### Issue: Document exists but still fails
**Fix:** Check that `active` field is set to `true` (boolean, checked box)

### Issue: Can't find the UID
**Fix:** 
- Check browser console (F12) when user signs up
- Or go to Authentication → Users in Firebase Console
- The UID is the long random code next to their email

## Step-by-Step: Adding User to Whitelist

1. **Get their UID:**
   - User signs up → Check browser console (F12) → Look for "UID: [code]"
   - OR go to Firebase → Authentication → Users → Find email → Copy UID

2. **Create document:**
   - Firestore → Data → whitelist collection
   - Click "Add document"
   - **Document ID:** Paste the UID (NOT email!)
   - Add field: `email` (string) = their email
   - Add field: `active` (boolean) = true (check box)
   - Click "Save"

3. **Test:**
   - User signs in again
   - Should work now!

## Still Not Working?

The script now shows detailed error messages. Check:
1. Browser console (F12) for exact error
2. Error message in the login modal
3. Make sure you're using UID as Document ID, not email!

