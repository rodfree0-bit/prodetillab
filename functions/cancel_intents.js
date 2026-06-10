const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
if (!STRIPE_SECRET_KEY) {
    console.error("❌ Error: STRIPE_SECRET_KEY environment variable is not defined.");
    process.exit(1);
}
const stripe = require('stripe')(STRIPE_SECRET_KEY);

const intentsToCancel = [
    'pi_3T749APCM2SvaE3B01SkCgzV',
    'pi_3T7493PCM2SvaE3B1rZxoANZ'
];

async function cancelStaleIntents() {
    console.log(`🚀 Starting cancellation of ${intentsToCancel.length} stale intents...`);

    for (const id of intentsToCancel) {
        try {
            console.log(`⏳ Cancelling ${id}...`);
            const cancelled = await stripe.paymentIntents.cancel(id);
            console.log(`✅ Success: ${id} status is now ${cancelled.status}`);
        } catch (err) {
            console.error(`❌ Error cancelling ${id}:`, err.message);
        }
    }

    process.exit(0);
}

cancelStaleIntents().catch(console.error);
