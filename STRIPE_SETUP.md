# Stripe Integration Setup

## Overview

This project integrates Stripe for credit purchases. Users can buy credits through the Upgrade modal, and credits are added to their account after successful payment.

## Setup Steps

### 1. Install Stripe Dependencies

```bash
npm install stripe @stripe/stripe-js
```

### 2. Get Stripe API Keys

1. Go to [Stripe Dashboard](https://dashboard.stripe.com/)
2. Navigate to **Developers** → **API keys**
3. Copy your **Secret key** (starts with `sk_`)
4. Copy your **Publishable key** (starts with `pk_`)

### 3. Configure Environment Variables

Add to `.env.local`:

```bash
# Stripe Keys
STRIPE_SECRET_KEY=sk_test_...  # Your Stripe secret key
STRIPE_PUBLISHABLE_KEY=pk_test_...  # Your Stripe publishable key
STRIPE_WEBHOOK_SECRET=whsec_...  # Webhook secret (see step 4)
```

### 4. Set Up Webhook

1. Go to [Stripe Dashboard](https://dashboard.stripe.com/) → **Developers** → **Webhooks**
2. Click **Add endpoint**
3. Set endpoint URL to: `https://your-domain.com/api/stripe/webhook`
4. Select events to listen for:
   - `checkout.session.completed`
5. Copy the **Signing secret** (starts with `whsec_`) and add to `.env.local`

### 5. Update Credit Storage

The webhook handler (`app/api/stripe/webhook/route.ts`) currently logs successful payments. You need to:

1. Set up a database or storage system to track user credits
2. Update the webhook handler to save credits to the database
3. Update `lib/trialLimits.ts` to check purchased credits

## Credit Plans

Current credit plans (defined in `app/components/UpgradeModal.tsx`):

- **30 Credits**: $18.00 ($0.60 per credit)
- **100 Credits**: $50.00 ($0.50 per credit) - Popular
- **250 Credits**: $100.00 ($0.40 per credit)
- **500 Credits**: $175.00 ($0.35 per credit)

## Implementation Notes

### Trial Users
- Trial users have 0 credits
- They can purchase credits through the Upgrade modal
- After purchase, credits are added to their account

### Master Users
- Master users have unlimited credits (Infinity)
- They don't see the Upgrade modal

### Paid Users
- Credits are tracked per user (by trialToken or email)
- Credits never expire
- Credits are deducted when:
  - Generating topics (1 credit per run)
  - Generating articles (1 credit per article)
  - Generating images (1 credit per image)

## Testing

### Test Mode
1. Use Stripe test keys (start with `sk_test_` and `pk_test_`)
2. Use test card numbers from [Stripe Testing](https://stripe.com/docs/testing)
3. Test webhook locally using [Stripe CLI](https://stripe.com/docs/stripe-cli)

### Production
1. Switch to live keys (start with `sk_live_` and `pk_live_`)
2. Update webhook URL to production domain
3. Test with real payment (small amount)

## Next Steps

1. ✅ Component created (`UpgradeModal.tsx`)
2. ✅ API endpoints created (`/api/stripe/create-checkout`, `/api/stripe/webhook`)
3. ⏳ Install Stripe dependencies
4. ⏳ Configure environment variables
5. ⏳ Set up webhook
6. ⏳ Implement credit storage system
7. ⏳ Update `lib/trialLimits.ts` to use purchased credits
8. ⏳ Update `app/api/trial-usage/route.ts` to return purchased credits
