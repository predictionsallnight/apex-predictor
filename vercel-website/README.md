# ApexPredictor Payment Website

Auto-generates whitelist codes on payment confirmation.

## Setup

1. **Add Firebase Service Account to Vercel:**
   - Vercel Dashboard → Settings → Environment Variables
   - Name: `FIREBASE_SERVICE_ACCOUNT`
   - Value: Paste your Firebase service account JSON
   - Save

2. **Update Stripe Success URL:**
   - Stripe Dashboard → Payment Links → Settings
   - Success URL: `https://your-vercel-url.vercel.app/confirm?session_id={CHECKOUT_SESSION_ID}`
   - (Stripe automatically adds session_id)

## How It Works

1. User buys → Stripe redirects with `session_id`
2. Code auto-generated → Saved to Firestore
3. User creates account → Code activated
4. User can sign in on bloxgame.us with code or email/password

## Files

- `index.html` - Purchase page
- `confirm.html` - Account activation (auto-generates code)
- `api/activate-account.js` - Creates account
- `api/verify-code.js` - Verifies code
- `api/generate-code-from-payment.js` - Auto-generates codes

## Deploy

```bash
vercel --prod
```
