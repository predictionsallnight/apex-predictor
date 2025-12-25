# Fix "Website Not Authorized" Error

## Quick Fix (2 Minutes)

You're getting this error because Firebase needs to know that `bloxgame.us` is allowed to use authentication.

### Step-by-Step:

1. **Go to Firebase Console**
   - https://console.firebase.google.com/
   - Click your project

2. **Go to Authentication Settings**
   - Click **"Authentication"** in left menu
   - Click **"Settings"** tab (at the top)

3. **Add the Domain**
   - Scroll down to **"Authorized domains"** section
   - Click **"Add domain"** button
   - Type: `bloxgame.us`
   - Click **"Add"**

4. **Done!** ✅
   - Refresh the page on bloxgame.us
   - The error should be gone!

### Optional: Add www version too
- Click **"Add domain"** again
- Type: `www.bloxgame.us`
- Click **"Add"**

---

## What This Does

Firebase only allows authentication from domains you explicitly authorize. This is a security feature to prevent unauthorized websites from using your Firebase project.

By adding `bloxgame.us` to the authorized domains list, you're telling Firebase: "Yes, it's okay for this website to use my authentication."

---

## Visual Guide

```
Firebase Console
  → Authentication
    → Settings tab
      → Scroll down
        → Authorized domains
          → Click "Add domain"
            → Type: bloxgame.us
              → Click "Add"
                → Done! ✅
```

---

## Still Not Working?

- Make sure you typed `bloxgame.us` exactly (no spaces, no www, no https://)
- Try refreshing the page on bloxgame.us
- Clear your browser cache
- Check browser console (F12) for other errors

