const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
if (!STRIPE_SECRET_KEY) {
    console.error("❌ Error: STRIPE_SECRET_KEY environment variable is not defined.");
    process.exit(1);
}
const stripe = require('stripe')(STRIPE_SECRET_KEY);

async function listIntents() {
    console.log('🔍 Listing last 50 Stripe Payment Intents (Correct Account)...');

    try {
        const intents = await stripe.paymentIntents.list({
            limit: 50,
        });

        console.log(`📋 Total intents found: ${intents.data.length}`);

        intents.data.forEach(pi => {
            console.log(`- ID: ${pi.id}, Amt: $${pi.amount / 100}, Status: ${pi.status}, Date: ${new Date(pi.created * 1000).toLocaleString()}`);
            if (pi.status === 'requires_capture') {
                console.log(`   [!!!] STALE HOLD FOUND: ${pi.id} - Metadata: ${JSON.stringify(pi.metadata)}`);
            }
        });
    } catch (err) {
        console.error('❌ Stripe Error:', err.message);
    }
}

listIntents().catch(console.error);
