import Stripe from 'stripe';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
if (!STRIPE_SECRET_KEY) {
    console.error("❌ Error: STRIPE_SECRET_KEY environment variable is not defined.");
    console.error("Please run with STRIPE_SECRET_KEY environment variable set, or load dotenv.");
    process.exit(1);
}
const stripe = new Stripe(STRIPE_SECRET_KEY);

async function run() {
    console.log("🔍 Buscando transacciones de hoy...");
    
    // Get start of today in unix timestamp
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const gte = Math.floor(today.getTime() / 1000);

    const paymentIntents = await stripe.paymentIntents.list({
        created: { gte },
        limit: 100
    });

    console.log(`📋 Encontradas ${paymentIntents.data.length} transacciones hoy.`);

    for (const pi of paymentIntents.data) {
        const amount = pi.amount / 100;
        console.log(`- ID: ${pi.id}, Estado: ${pi.status}, Monto: $${amount}`);

        // Si es una autorización de $1 (nuestra prueba que falló por permisos)
        if (amount === 1.00 && pi.status === 'requires_capture') {
            console.log(`  ⚡ Cancelando autorización de prueba: ${pi.id}`);
            try {
                await stripe.paymentIntents.cancel(pi.id);
                console.log(`  ✅ Cancelada con éxito.`);
            } catch (e) {
                console.error(`  ❌ Error al cancelar: ${e.message}`);
            }
        }
        
        // Si fue capturada por error (aunque el usuario dice que no hay cobro, revisamos)
        if (amount === 1.00 && pi.status === 'succeeded') {
            console.log(`  ⚡ Reembolsando cobro de prueba: ${pi.id}`);
            try {
                await stripe.refunds.create({ payment_intent: pi.id });
                console.log(`  ✅ Reembolsado con éxito.`);
            } catch (e) {
                console.error(`  ❌ Error al reembolsar: ${e.message}`);
            }
        }
    }
}

run().catch(console.error);
