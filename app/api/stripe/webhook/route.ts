import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { headers } from 'next/headers';

export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET is not set');
    return NextResponse.json(
      { error: 'Webhook secret not configured' },
      { status: 500 }
    );
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json(
      { error: 'Stripe is not configured. Please set STRIPE_SECRET_KEY in environment variables.' },
      { status: 500 }
    );
  }

  // Initialize Stripe only when needed
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2025-02-24.acacia',
  });

  const body = await request.text();
  const headersList = await headers();
  const signature = headersList.get('stripe-signature');

  if (!signature) {
    return NextResponse.json(
      { error: 'No signature provided' },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json(
      { error: 'Invalid signature' },
      { status: 400 }
    );
  }

  // Handle the event
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    
    // Extract metadata
    const credits = parseInt(session.metadata?.credits || '0', 10);
    const trialToken = session.metadata?.trialToken || '';
    const customerEmail = session.customer_email || session.customer_details?.email || '';

    if (credits > 0) {
      // TODO: Add credits to user's account
      // This should update the database or storage system
      // For now, we'll log it
      console.log('Payment successful:', {
        sessionId: session.id,
        credits,
        trialToken,
        customerEmail,
        amountTotal: session.amount_total,
      });

      // In production, you would:
      // 1. Identify the user (by trialToken or email)
      // 2. Add credits to their account in your database
      // 3. Update the trialLimits system to track purchased credits
      
      // Example: Update credits in your storage system
      // await addCreditsToUser(trialToken || customerEmail, credits);
    }
  }

  return NextResponse.json({ received: true });
}
