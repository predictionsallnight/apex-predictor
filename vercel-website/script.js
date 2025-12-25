// Stripe payment link
const STRIPE_PAYMENT_LINK = 'https://buy.stripe.com/test_00wdRb2Si6w9bTJ7la8k800';

// Handle purchase button click
document.getElementById('purchaseBtn').addEventListener('click', function() {
    // Redirect to Stripe payment page
    window.location.href = STRIPE_PAYMENT_LINK;
});

