# Fix "Failed to Sign Up" Error

## Most Common Issue: Email/Password Not Enabled

**If users get "failed to sign up" or "operation not allowed" errors, this is usually because Email/Password authentication isn't enabled in Firebase.**

### Quick Fix:

1. **Go to Firebase Console**
   - https://console.firebase.google.com/
   - Click your project

2. **Enable Email/Password Authentication**
   - Click **"Authentication"** in left menu
   - Click **"Sign-in method"** tab (at the top)
   - Find **"Email/Password"** in the list
   - Click on it
   - Toggle **"Enable"** to ON
   - Click **"Save"**

3. **Done!** ✅
   - Users should now be able to sign up!

---

## Other Common Issues & Fixes

### Error: "Network request failed"
- **Fix**: Check internet connection
- **Fix**: Check if Firebase is blocked by firewall/adblocker

### Error: "Invalid email"
- **Fix**: Make sure email format is correct (user@example.com)

### Error: "Weak password"
- **Fix**: Password must be at least 6 characters

### Error: "Email already in use"
- **Fix**: User should sign in instead of signing up
- **Fix**: Or they can use "Forgot password" to reset

### Error: "Firebase not initialized"
- **Fix**: Refresh the page
- **Fix**: Check browser console (F12) for errors
- **Fix**: Make sure Firebase config is correct in script

---

## How to Check if Email/Password is Enabled

1. Firebase Console → Authentication → Sign-in method
2. Look for "Email/Password" in the list
3. It should show "Enabled" (green)
4. If it shows "Disabled" → Click it → Enable → Save

---

## Debugging Steps

If sign-up still doesn't work:

1. **Open browser console** (Press F12)
2. **Try to sign up**
3. **Look for error messages** in the console
4. **Check for these specific errors:**
   - `auth/operation-not-allowed` → Email/Password not enabled
   - `auth/network-request-failed` → Connection issue
   - `auth/invalid-api-key` → Wrong Firebase config
   - `auth/domain-not-authorized` → Domain not added to authorized domains

5. **Share the error code** with support (it will help debug)

---

## Testing After Fix

1. Go to bloxgame.us
2. Try to sign up with a test email
3. Check Firebase Console → Authentication → Users
4. You should see the new user appear!
5. Copy their UID and add to whitelist

---

## Still Not Working?

1. **Check browser console** (F12) for detailed errors
2. **Verify Email/Password is enabled** (most common issue!)
3. **Check authorized domains** (bloxgame.us should be added)
4. **Verify Firebase config** in script is correct
5. **Try refreshing the page**

The script now shows more detailed error messages - check what it says and follow the fix above!

