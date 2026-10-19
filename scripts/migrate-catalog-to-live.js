/**
 * AutoReels Scroll — Live Catalog Migration Utility
 * 
 * Recreates the verified 3-tier catalog (Starter, Pro, Advanced) in Paddle Live,
 * captures the Old-New ID mapping, and generates .env.production configuration.
 * 
 * Usage:
 *   node scripts/migrate-catalog-to-live.js [PADDLE_LIVE_API_KEY]
 */

import { Paddle, Environment } from '@paddle/paddle-node-sdk';
import fs from 'fs';
import path from 'path';

// Load sandbox keys
let sandboxApiKey = process.env.PADDLE_API_KEY;
try {
  const envContent = fs.readFileSync('.env.local', 'utf8');
  const match = envContent.match(/PADDLE_API_KEY=(.*)/);
  if (match) sandboxApiKey = match[1].trim();
} catch {}

const liveApiKey = process.argv[2] || process.env.PADDLE_LIVE_API_KEY;

// Authoritative Sandbox Catalog to Replicate (skipping test/junk items)
const CATALOG_SPEC = [
  {
    tier: 'Starter',
    oldProductId: 'pro_01m3krtwtsz1zwpp67h5yg563b',
    name: 'Starter',
    description: 'Essential hands-free scrolling tools for casual video viewers on YouTube Shorts & TikTok.',
    prices: [
      {
        interval: 'month',
        description: 'Starter Monthly',
        amount: '499', // $4.99
        currencyCode: 'USD',
        oldPriceId: 'pri_01m3krv8q2m1yp4mvvsjj2adpx'
      },
      {
        interval: 'year',
        description: 'Starter Yearly',
        amount: '4990', // $49.90
        currencyCode: 'USD',
        oldPriceId: 'pri_01m3krv92b9ngrx7rj68nmyyn3'
      }
    ]
  },
  {
    tier: 'Pro',
    oldProductId: 'pro_01m3krv802hnjgexept4ypx07q',
    name: 'Pro',
    description: 'Ultimate hands-free automation with smart filters across all short platforms (IG, FB, YT, TikTok).',
    prices: [
      {
        interval: 'month',
        description: 'Pro Monthly',
        amount: '999', // $9.99
        currencyCode: 'USD',
        oldPriceId: 'pri_01m3krva4ka3ab53adp54rsc4r'
      },
      {
        interval: 'year',
        description: 'Pro Yearly',
        amount: '9990', // $99.90
        currencyCode: 'USD',
        oldPriceId: 'pri_01m3krvafsq1rwwjgf8zxh3cf7'
      }
    ]
  },
  {
    tier: 'Advanced',
    oldProductId: 'pro_01m3krv8c2gn6magr15t0kpqyy',
    name: 'Advanced',
    description: 'Maximal throughput, VIP priority, and infinite device freedom for power users.',
    prices: [
      {
        interval: 'month',
        description: 'Advanced Monthly',
        amount: '1999', // $19.99
        currencyCode: 'USD',
        oldPriceId: 'pri_01m3krvasrk01az4yxkw0fvhcs'
      },
      {
        interval: 'year',
        description: 'Advanced Yearly',
        amount: '19990', // $199.90
        currencyCode: 'USD',
        oldPriceId: 'pri_01m3krvb49jjhfed3dn470cy3c'
      }
    ]
  }
];

async function main() {
  console.log('================================================================');
  console.log('      AutoReels Scroll — Live Catalog Migration Utility         ');
  console.log('================================================================\n');

  if (!liveApiKey) {
    console.log('⚠️  No live API key provided.');
    console.log('To migrate automatically via API, run:');
    console.log('   node scripts/migrate-catalog-to-live.js <pdl_live_apikey_...>\n');
    console.log('Here is the Authoritative Catalog Specification to create in vendors.paddle.com:\n');

    console.table(
      CATALOG_SPEC.flatMap((t) =>
        t.prices.map((p) => ({
          Tier: t.name,
          Cycle: p.interval,
          Amount: `$${(parseInt(p.amount) / 100).toFixed(2)} USD`,
          SandboxPriceId: p.oldPriceId,
          Description: p.description
        }))
      )
    );
    return;
  }

  if (!liveApiKey.startsWith('pdl_live_apikey_')) {
    console.error('❌ Error: Live API Key must start with "pdl_live_apikey_".');
    process.exit(1);
  }

  console.log('Connecting to Paddle Live API...');
  const paddleLive = new Paddle(liveApiKey, { environment: Environment.production });

  const mapping = [];

  for (const item of CATALOG_SPEC) {
    console.log(`\nCreating live product: ${item.name}...`);
    const liveProduct = await paddleLive.products.create({
      name: item.name,
      description: item.description,
      taxCategory: 'standard'
    });
    console.log(`  ✅ Live Product Created: ${liveProduct.name} (${liveProduct.id})`);

    for (const pr of item.prices) {
      console.log(`  Creating live price: ${pr.description} ($${(parseInt(pr.amount) / 100).toFixed(2)} / ${pr.interval})...`);
      const livePrice = await paddleLive.prices.create({
        productId: liveProduct.id,
        description: pr.description,
        unitPrice: {
          amount: pr.amount,
          currencyCode: pr.currencyCode
        },
        billingCycle: {
          interval: pr.interval,
          frequency: 1
        }
      });

      console.log(`    ✅ Live Price Created: ${livePrice.id}`);
      mapping.push({
        tier: item.name,
        cycle: pr.interval,
        sandboxProductId: item.oldProductId,
        liveProductId: liveProduct.id,
        sandboxPriceId: pr.oldPriceId,
        livePriceId: livePrice.id,
        amount: `$${(parseInt(pr.amount) / 100).toFixed(2)}`
      });
    }
  }

  console.log('\n================================================================');
  console.log('             OLD-TO-NEW CATALOG ID MAPPING TABLE                ');
  console.log('================================================================');
  console.table(mapping);

  // Write mapping JSON artifact
  fs.writeFileSync('catalog-live-mapping.json', JSON.stringify(mapping, null, 2));
  console.log('\nSaved mapping to catalog-live-mapping.json');

  // Print suggested .env.production snippet
  console.log('\nSuggested .env.production configuration:');
  console.log('----------------------------------------------------------------');
  console.log('PADDLE_ENV=production');
  console.log(`PADDLE_API_KEY=${liveApiKey}`);
  console.log('PADDLE_CLIENT_TOKEN=live_... (from Developer Tools -> Authentication)');
  console.log('PADDLE_WEBHOOK_SECRET=pdl_ntfset_... (from Developer Tools -> Notifications)');
  mapping.forEach((m) => {
    const key = `NEXT_PUBLIC_PADDLE_PRICE_${m.tier.toUpperCase()}_${m.cycle === 'month' ? 'MONTH' : 'YEAR'}`;
    console.log(`${key}=${m.livePriceId}`);
  });
  console.log('----------------------------------------------------------------\n');
}

main().catch((err) => {
  console.error('Fatal migration error:', err);
  process.exit(1);
});
