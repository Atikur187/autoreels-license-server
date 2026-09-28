/**
 * 3-Tier Pricing Configuration for AutoReels Scroll
 * 
 * Easy to edit: add/modify tier details, features, or price IDs here.
 * Monthly and yearly price IDs default to active Paddle sandbox prices
 * and can be overridden via environment variables.
 */

export interface Tier {
  name: 'Starter' | 'Pro' | 'Advanced';
  description: string;
  features: string[];
  priceId: { month: string; year: string };
  badge?: string;
  popular?: boolean;
}

export const TIERS: Tier[] = [
  {
    name: 'Starter',
    description: 'Essential hands-free scrolling tools for casual video viewers.',
    features: [
      'Auto-scroll on YouTube Shorts & TikTok',
      'Configurable playback speed (1.0x - 2.0x)',
      'Basic keyboard shortcut navigation',
      '1 active browser session',
      'Community support'
    ],
    priceId: {
      month: process.env.NEXT_PUBLIC_PADDLE_PRICE_STARTER_MONTH || process.env.PADDLE_PRICE_STARTER_MONTH || 'pri_01m3krv8q2m1yp4mvvsjj2adpx',
      year: process.env.NEXT_PUBLIC_PADDLE_PRICE_STARTER_YEAR || process.env.PADDLE_PRICE_STARTER_YEAR || 'pri_01m3krv92b9ngrx7rj68nmyyn3'
    }
  },
  {
    name: 'Pro',
    description: 'Ultimate hands-free automation with smart filters across all short platforms.',
    features: [
      'Everything in Starter',
      'Full Instagram Reels & Facebook Reels support',
      'AI Smart Skip for sponsored & reposted clips',
      'Up to 3 simultaneous browser sessions',
      'Priority customer email support',
      'Custom shortcut binds & timing triggers'
    ],
    badge: 'Most Popular',
    popular: true,
    priceId: {
      month: process.env.NEXT_PUBLIC_PADDLE_PRICE_PRO_MONTH || process.env.PADDLE_PRICE_PRO_MONTH || 'pri_01m3krva4ka3ab53adp54rsc4r',
      year: process.env.NEXT_PUBLIC_PADDLE_PRICE_PRO_YEAR || process.env.PADDLE_PRICE_PRO_YEAR || 'pri_01m3krvafsq1rwwjgf8zxh3cf7'
    }
  },
  {
    name: 'Advanced',
    description: 'Maximal throughput, VIP priority, and infinite device freedom for power users.',
    features: [
      'Everything in Pro',
      'Unlimited devices & browser instances',
      'Custom regex hashtag & caption filters',
      'VIP Discord access & experimental beta features',
      'Dedicated 1-on-1 onboarding & troubleshooting',
      'Lifetime feature updates guarantee'
    ],
    badge: 'Best Value',
    priceId: {
      month: process.env.NEXT_PUBLIC_PADDLE_PRICE_ADVANCED_MONTH || process.env.PADDLE_PRICE_ADVANCED_MONTH || 'pri_01m3krvasrk01az4yxkw0fvhcs',
      year: process.env.NEXT_PUBLIC_PADDLE_PRICE_ADVANCED_YEAR || process.env.PADDLE_PRICE_ADVANCED_YEAR || 'pri_01m3krvb49jjhfed3dn470cy3c'
    }
  }
];
