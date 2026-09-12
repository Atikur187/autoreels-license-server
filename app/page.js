'use client';

import React, { useState, useEffect, useRef } from 'react';
import './globals.css';

export default function PricingLandingPage() {
  // Simulator State
  const [activePlatform, setActivePlatform] = useState('youtube');
  const [simProgress, setSimProgress] = useState(35);
  const [simAutoNext, setSimAutoNext] = useState(true);
  const [simReelCount, setSimReelCount] = useState(1);
  const [simToast, setSimToast] = useState('');

  // Pricing & Checkout State
  const [openingPlanId, setOpeningPlanId] = useState(null);
  const [pricingNotice, setPricingNotice] = useState('');

  // Paddle.js Single-Initialization and Development Diagnostic State
  const [paddleConfig, setPaddleConfig] = useState(null);
  const [paddleInitStatus, setPaddleInitStatus] = useState('loading'); // 'loading' | 'initialized' | 'error'
  const [paddleInitError, setPaddleInitError] = useState(null);
  const [lastPaddleEvent, setLastPaddleEvent] = useState(null);
  const [lastPaddleError, setLastPaddleError] = useState(null);
  const [lastPaddleWarning, setLastPaddleWarning] = useState(null);
  const [lastCheckoutRequest, setLastCheckoutRequest] = useState(null);
  const [lastCheckoutConfigSent, setLastCheckoutConfigSent] = useState(null);
  const [showDiagnostics, setShowDiagnostics] = useState(true);
  const paddleInitializedRef = useRef(false);
  const paddleInitCountRef = useRef(0);

  // FAQ Accordion State
  const [expandedFaq, setExpandedFaq] = useState(0);

  // Platform details for simulator
  const platforms = {
    youtube: { name: 'YouTube Shorts', icon: '▶️', color: '#ff0000', handle: '@tech_vibes • 1.2M views', sound: 'Original Audio - Viral Sound' },
    instagram: { name: 'Instagram Reels', icon: '📸', color: '#e1306c', handle: '@wanderlust_daily • Trending', sound: 'Trending Beats • 420k reels' },
    facebook: { name: 'Facebook Reels', icon: '👥', color: '#1877f2', handle: 'Viral Creators Hub • 850K shares', sound: 'Viral Music Track' },
    tiktok: { name: 'TikTok Web', icon: '🎵', color: '#00f2fe', handle: '@daily_hacks • For You', sound: 'Pop Sound of 2026' }
  };

  // Paddle.js Lifecycle: Strictly Single Initialization on Mount
  useEffect(() => {
    let isMounted = true;

    async function initializePaddleGateway() {
      try {
        // 1. Fetch public configuration
        const res = await fetch('/api/checkout/config');
        const config = await res.json();
        if (!isMounted) return;
        setPaddleConfig(config);

        if (!config.success || !config.clientToken) {
          setPaddleInitStatus('error');
          setPaddleInitError('No Paddle Client Token returned by server config.');
          return;
        }

        // 2. Wait for window.Paddle to be available (loaded via layout.js)
        let attempts = 0;
        while (!window.Paddle && attempts < 35) {
          await new Promise((resolve) => setTimeout(resolve, 100));
          attempts++;
        }

        // Dynamic fallback if layout script took longer
        if (!window.Paddle) {
          const script = document.createElement('script');
          script.src = 'https://cdn.paddle.com/paddle/v2/paddle.js';
          script.async = true;
          document.body.appendChild(script);
          await new Promise((resolve) => {
            script.onload = resolve;
            script.onerror = resolve;
          });
        }

        if (!window.Paddle) {
          if (!isMounted) return;
          setPaddleInitStatus('error');
          setPaddleInitError('Paddle.js script failed to load. Check ad-blocker or network.');
          return;
        }

        // 3. Strictly guarantee SINGLE initialization
        if (paddleInitializedRef.current) {
          return;
        }

        // 4. Set environment BEFORE Paddle.Initialize()
        if (config.environment === 'sandbox') {
          window.Paddle.Environment.set('sandbox');
        }

        // Helper to authoritatively extract detailed Paddle error fields from any event structure
        const extractPaddleDetails = (event) => {
          if (!event) return null;
          const d = (event.data && typeof event.data === 'object') ? event.data : {};
          const errObj = (d.error && typeof d.error === 'object')
            ? d.error
            : (Array.isArray(d.errors) && d.errors.length > 0 && typeof d.errors[0] === 'object')
            ? d.errors[0]
            : d;

          const name = event.name || event.type || d.name || 'checkout.error';
          const type = event.type || errObj.type || d.type || (typeof event.data === 'string' ? 'string_error' : 'error');
          const code = event.code || errObj.code || d.code || errObj.error_code || d.error_code || 'UNKNOWN_CODE';
          
          let detail = event.detail || errObj.detail || d.detail || 
                       event.message || errObj.message || d.message || 
                       errObj.description || d.description || 
                       errObj.error_description || d.error_description || '';
          
          if (!detail) {
            if (typeof event.data === 'string' && event.data.trim()) {
              detail = event.data;
            } else if (typeof d === 'object' && Object.keys(d).length > 0) {
              detail = JSON.stringify(d);
            } else {
              detail = 'No specific error detail provided by Paddle.';
            }
          }

          const documentation_url = event.documentation_url || errObj.documentation_url || d.documentation_url || 
                                    event.documentationUrl || errObj.documentationUrl || d.documentationUrl || 'N/A';
          const request_id = event.request_id || errObj.request_id || d.request_id || 
                             event.requestId || errObj.requestId || d.requestId || 'N/A';

          return {
            name,
            type,
            code,
            detail: String(detail),
            documentation_url,
            request_id,
            raw: event.data !== undefined ? event.data : event
          };
        };

        // 5. Initialize Paddle once with comprehensive eventCallback
        window.Paddle.Initialize({
          token: config.clientToken,
          eventCallback: function (event) {
            if (!event) return;
            const eventName = event.name || event.type || 'unknown';

            if (typeof window !== 'undefined') {
              window.__lastPaddleRawEvent = event;
            }

            if (isMounted) {
              setLastPaddleEvent({
                name: eventName,
                data: event.data,
                time: new Date().toLocaleTimeString()
              });
            }

            // Handler 1: checkout.completed
            if (eventName === 'checkout.completed') {
              console.log('[Paddle checkout.completed]:', event.data);
              const txnId = event.data?.transaction_id || event.data?.id;
              if (txnId) {
                window.location.href = `/checkout/success?transaction_id=${encodeURIComponent(txnId)}`;
              }
            }

            // Handler 2: checkout.error (Separate explicit handler)
            else if (eventName === 'checkout.error') {
              const extracted = extractPaddleDetails(event);
              if (typeof window !== 'undefined') {
                window.__lastPaddleError = extracted;
              }
              console.error('[Paddle checkout.error]:', {
                'event.name': extracted.name,
                'event.type': extracted.type,
                'event.code': extracted.code,
                'event.detail': extracted.detail,
                'event.documentation_url': extracted.documentation_url,
                'request_id': extracted.request_id,
                'raw_event': event
              });
              if (isMounted) {
                setLastPaddleError(extracted);
                setPricingNotice(`Paddle Checkout Error [${extracted.code}]: ${extracted.detail}`);
              }
            }

            // Handler 3: checkout.warning (Separate explicit handler)
            else if (eventName === 'checkout.warning') {
              const extracted = extractPaddleDetails(event);
              if (typeof window !== 'undefined') {
                window.__lastPaddleWarning = extracted;
              }
              console.warn('[Paddle checkout.warning]:', {
                'event.name': extracted.name,
                'event.type': extracted.type,
                'event.code': extracted.code,
                'event.detail': extracted.detail,
                'event.documentation_url': extracted.documentation_url,
                'request_id': extracted.request_id,
                'raw_event': event
              });
              if (isMounted) {
                setLastPaddleWarning(extracted);
              }
            }

            // Handler 4: checkout.payment.error (Separate explicit handler)
            else if (eventName === 'checkout.payment.error') {
              const extracted = extractPaddleDetails(event);
              if (typeof window !== 'undefined') {
                window.__lastPaddleError = extracted;
              }
              console.error('[Paddle checkout.payment.error]:', {
                'event.name': extracted.name,
                'event.type': extracted.type,
                'event.code': extracted.code,
                'event.detail': extracted.detail,
                'event.documentation_url': extracted.documentation_url,
                'request_id': extracted.request_id,
                'raw_event': event
              });
              if (isMounted) {
                setLastPaddleError(extracted);
                setPricingNotice(`Paddle Payment Error [${extracted.code}]: ${extracted.detail}`);
              }
            }

            // Handler 5: checkout.loaded
            else if (eventName === 'checkout.loaded') {
              console.log('[Paddle checkout.loaded]:', event.data);
            }

            // Handler 6: checkout.closed
            else if (eventName === 'checkout.closed') {
              console.log('[Paddle checkout.closed]:', event.data);
            }

            // Handler 7: General / other events
            else {
              console.log(`[Paddle Event: ${eventName}]:`, event.data);
            }
          }
        });

        paddleInitializedRef.current = true;
        paddleInitCountRef.current += 1;
        if (isMounted) {
          setPaddleInitStatus('initialized');
          console.log(`[Paddle Initialized Successfully] Env: ${config.environment}, Token: ${config.diagnostics?.tokenPrefix}... (Call count: ${paddleInitCountRef.current})`);
        }
      } catch (err) {
        console.error('[Paddle Initialization Error]:', err);
        if (isMounted) {
          setPaddleInitStatus('error');
          setPaddleInitError(err.message || 'Error initializing Paddle');
        }
      }
    }

    initializePaddleGateway();

    return () => {
      isMounted = false;
    };
  }, []);

  // Live video simulator ticker
  useEffect(() => {
    const timer = setInterval(() => {
      setSimProgress((prev) => {
        if (prev >= 100) {
          if (simAutoNext) {
            setSimReelCount((c) => c + 1);
            setSimToast('Next reel scrolling automatically... ⏭');
            setTimeout(() => setSimToast(''), 2200);
            return 0;
          }
          return 100;
        }
        return prev + 6;
      });
    }, 450);
    return () => clearInterval(timer);
  }, [simAutoNext]);

  const plans = [
    {
      id: '30day',
      title: '1 Month Pass',
      duration: '30 Days Access',
      priceUsd: '$1.49',
      priceSub: 'billed monthly',
      subtitle: 'Ultra-affordable monthly pass for casual short-form video fans.',
      features: [
        'Full access to all 4 platforms',
        'Smart HTML5 completion detection',
        '2 Devices concurrent limit',
        'Custom skip delay (0s - 5s)',
        'Standard email support'
      ],
      popular: false,
      badge: '⚡ 1 Month'
    },
    {
      id: 'yearly',
      title: '1 Year Pro',
      duration: '1 Year (365 Days)',
      priceUsd: '$9.49',
      priceSub: 'billed annually',
      subtitle: 'The most popular choice — enjoy unlimited reels all year long.',
      features: [
        'Full access to all 4 platforms',
        'Smart HTML5 completion detection',
        '3 Devices concurrent limit',
        'Custom skip delay & manual protection',
        'Priority updates & premium support',
        'Save over 50% vs monthly'
      ],
      popular: true,
      badge: '⭐ Most Popular'
    },
    {
      id: 'lifetime',
      title: 'Lifetime VIP',
      duration: 'Never Expires',
      priceUsd: '$19.99',
      priceSub: 'one-time payment',
      subtitle: 'Pay once, enjoy hands-free auto-scrolling forever.',
      features: [
        'Unlimited lifetime access',
        'Up to 5 devices simultaneously',
        'All 4 platforms + future platform updates',
        'Smart manual scroll & anti-loop shields',
        'VIP priority support forever',
        'Zero recurring subscription fees'
      ],
      popular: false,
      badge: '👑 Best Value'
    }
  ];

  const faqs = [
    {
      q: 'How does AutoReels Scroll differ from basic auto-scrollers?',
      a: 'Basic extensions rely on fixed timers that skip before long videos conclude or make you wait on shorter clips. AutoReels Scroll directly monitors the actual HTML5 video playback state, buffer completion, and loop wrap-around to advance the exact millisecond a video finishes.'
    },
    {
      q: 'Can I still scroll manually whenever I want?',
      a: 'Yes, absolutely! Our Smart Manual Scroll Protection detects any wheel, touch, or keyboard gesture, automatically pauses scheduled automation, and smoothly monitors the new video without conflicts or double skips.'
    },
    {
      q: 'How do I receive my license key after checkout?',
      a: 'Your license key (format: ARS-XXXX-XXXX-XXXX) is generated and displayed immediately on your screen. Simply click "Copy Key", open your AutoReels Scroll Chrome extension popup, and click "Activate".'
    },
    {
      q: 'Can I use one license key across multiple computers?',
      a: 'Yes! Depending on your chosen plan (2 devices for 1-Month, 3 for 1-Year Pro, and up to 5 for Lifetime VIP), you can activate multiple devices concurrently.'
    },
    {
      q: 'Is my payment and browsing data safe?',
      a: '100% secure. AutoReels Scroll operates under Chrome Manifest V3 with strict privacy sandboxing. We never track, inspect, or log your personal browsing data, viewing history, or credentials.'
    }
  ];

  const handleOpenCheckout = async (plan) => {
    // Launch official Paddle.js overlay checkout
    setOpeningPlanId(plan.id);
    setPricingNotice('');
    setLastPaddleError(null);

    try {
      // Authoritatively fetch Paddle Price ID and public client token from server
      const res = await fetch('/api/checkout/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: plan.id })
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setPricingNotice(data.error || 'Unable to initialize checkout. Please try again later.');
        setOpeningPlanId(null);
        return;
      }

      // Check if Paddle is loaded and initialized
      if (typeof window === 'undefined' || !window.Paddle || !window.Paddle.Checkout) {
        setPricingNotice('Payment gateway is still initializing. Please wait a moment and try again.');
        setOpeningPlanId(null);
        return;
      }

      // Safe Checkout Configuration Logging (Strictly token prefix only, NO full secret keys)
      const tokenPrefix = data.clientToken?.startsWith('test_')
        ? 'test_'
        : data.clientToken?.startsWith('live_')
        ? 'live_'
        : 'unknown';

      const pricePrefix = (data.priceId && typeof data.priceId === 'string' && data.priceId.startsWith('pri_'))
        ? 'pri_'
        : 'unknown';

      const checkoutConfigLog = {
        paddleEnvironment: data.environment || 'sandbox',
        paddleInitializeSucceeded: paddleInitializedRef.current,
        paddleInitialized: paddleInitializedRef.current,
        clientTokenExists: Boolean(data.clientToken),
        clientTokenPrefix: tokenPrefix, // Prefix only, never full token
        selectedPlan: plan.id,
        selectedPriceId: data.priceId,
        priceIdPrefix: pricePrefix,
        checkoutItems: [{ priceId: data.priceId, quantity: 1 }],
        time: new Date().toLocaleTimeString()
      };

      if (typeof window !== 'undefined') {
        window.__lastCheckoutConfigSent = checkoutConfigLog;
      }

      console.log('[Paddle Checkout Configuration Sent]:', checkoutConfigLog);
      setLastCheckoutConfigSent(checkoutConfigLog);
      setLastCheckoutRequest({
        plan: plan.id,
        priceId: data.priceId,
        environment: data.environment,
        time: new Date().toLocaleTimeString()
      });

      // Directly open official Paddle.js v2 overlay checkout
      // DO NOT call Paddle.Initialize() again!
      try {
        window.Paddle.Checkout.open({
          items: [{ priceId: data.priceId, quantity: 1 }],
          settings: {
            displayMode: 'overlay',
            theme: 'dark',
            locale: 'en',
            successUrl: `${window.location.origin}/checkout/success`
          },
          customData: {
            plan: plan.id
          }
        });
      } catch (paddleErr) {
        console.error('[Paddle.js Checkout.open Exception]:', paddleErr);
        const openErr = {
          name: 'checkout.open_exception',
          type: paddleErr.name || 'CheckoutOpenException',
          code: paddleErr.code || 'OPEN_EXCEPTION',
          detail: paddleErr.message || String(paddleErr),
          documentation_url: 'N/A',
          request_id: 'N/A',
          raw: paddleErr
        };
        setLastPaddleError(openErr);
        setPricingNotice('Paddle Checkout failed to open: ' + (paddleErr.message || 'Check console logs.'));
      }
    } catch (err) {
      console.error('[Checkout Connection Error]:', err);
      setPricingNotice('Connection error contacting checkout service. Please try again.');
    } finally {
      setOpeningPlanId(null);
    }
  };

  return (
    <div style={styles.container}>
      {/* Dynamic Background Glows */}
      <div style={styles.glowTopLeft}></div>
      <div style={styles.glowCenterRight}></div>

      {/* Navigation Header */}
      <header style={styles.header}>
        <div style={styles.navContainer}>
          <div style={styles.brand}>
            <div style={styles.logoBadge}>
              <span style={{ fontSize: '20px' }}>🎬</span>
            </div>
            <div>
              <div style={styles.brandTitle}>AutoReels Scroll</div>
              <div style={styles.brandSub}>Hands-Free Social Video Automation</div>
            </div>
          </div>

          <nav style={styles.navLinks}>
            <a href="#features" style={styles.navLink}>Features</a>
            <a href="#guide" style={styles.navLink}>How It Works</a>
            <a href="#pricing" style={styles.navLink}>Pricing</a>
            <a href="#faq" style={styles.navLink}>FAQ</a>
            <a href="/admin" style={styles.adminPortalBtn}>Admin Portal</a>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section style={styles.heroSection}>
        <div style={styles.heroContent}>
          <div style={styles.pillBadge}>
            <span style={styles.pillPulse}></span>
            <span>⚡ #1 Hands-Free Smart Auto-Scroller for Chrome</span>
          </div>

          <h1 style={styles.heroHeading}>
            Relax & Watch Reels.<br />
            <span style={styles.gradientText}>Never Touch Your Mouse Again.</span>
          </h1>

          <p style={styles.heroSubheading}>
            AutoReels Scroll detects the exact frame YouTube Shorts, Instagram Reels, 
            Facebook Reels, or TikTok clips finish and automatically advances to the next video. 
            Enjoy seamless, hands-free entertainment while eating, working, studying, or relaxing.
          </p>

          <div style={styles.heroCtaGroup}>
            <button
              onClick={() => {
                const el = document.getElementById('pricing');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
              style={styles.primaryBtn}
            >
              <span>👑 Get Premium License</span>
              <span style={{ fontSize: '18px' }}>→</span>
            </button>

            <button
              onClick={() => {
                const el = document.getElementById('guide');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
              style={styles.secondaryBtn}
            >
              <span>📖 How to Use (1-Min Setup)</span>
            </button>
          </div>

          <div style={styles.trustBadges}>
            <div style={styles.trustItem}>
              <span style={{ color: 'var(--success)' }}>✔</span> 4 Major Platforms
            </div>
            <div style={styles.trustItem}>
              <span style={{ color: 'var(--success)' }}>✔</span> Smart Completion Detection
            </div>
            <div style={styles.trustItem}>
              <span style={{ color: 'var(--success)' }}>✔</span> 72-Hour Offline Grace
            </div>
            <div style={styles.trustItem}>
              <span style={{ color: 'var(--success)' }}>✔</span> Instant Activation
            </div>
          </div>
        </div>

        {/* Live Simulator Widget */}
        <div style={styles.simulatorWrapper}>
          <div style={styles.simulatorCard}>
            <div style={styles.simHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#ef4444' }}></span>
                <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#f59e0b' }}></span>
                <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#10b981' }}></span>
                <span style={{ fontSize: '12px', color: 'var(--text-dim)', marginLeft: '6px' }}>Live Extension Simulator</span>
              </div>
              <div style={styles.simLiveTag}>LIVE DEMO</div>
            </div>

            {/* Platform Selector Bar */}
            <div style={styles.platformSelector}>
              {Object.entries(platforms).map(([key, p]) => (
                <button
                  key={key}
                  onClick={() => setActivePlatform(key)}
                  style={{
                    ...styles.platTab,
                    borderColor: activePlatform === key ? p.color : 'transparent',
                    backgroundColor: activePlatform === key ? 'rgba(255,255,255,0.08)' : 'transparent',
                    color: activePlatform === key ? '#fff' : 'var(--text-secondary)'
                  }}
                >
                  <span>{p.icon}</span>
                  <span>{p.name}</span>
                </button>
              ))}
            </div>

            {/* Simulated Video Viewport */}
            <div style={styles.simScreen}>
              <div style={styles.simOverlayTop}>
                <div style={styles.simCreatorBadge}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: platforms[activePlatform].color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                    {platforms[activePlatform].icon}
                  </div>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600 }}>{platforms[activePlatform].handle}</div>
                    <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)' }}>{platforms[activePlatform].sound}</div>
                  </div>
                </div>

                <div style={styles.simCounterBadge}>
                  Reel #{simReelCount}
                </div>
              </div>

              {simToast && (
                <div style={styles.simToast}>
                  {simToast}
                </div>
              )}

              {/* Center Play Icon Animation */}
              <div style={styles.simCenterGlow}>
                <div style={{ fontSize: '42px', opacity: 0.85 }}>🎬</div>
                <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.9)', fontWeight: 500, marginTop: '8px' }}>
                  Smart Completion Engine Active
                </div>
              </div>

              {/* Progress Bar */}
              <div style={styles.simProgressTrack}>
                <div
                  style={{
                    ...styles.simProgressBar,
                    width: `${simProgress}%`,
                    backgroundColor: platforms[activePlatform].color
                  }}
                ></div>
              </div>
            </div>

            {/* Simulator Controls */}
            <div style={styles.simControls}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Auto Next Video
                </span>
                <label style={styles.toggleSwitch}>
                  <input
                    type="checkbox"
                    checked={simAutoNext}
                    onChange={(e) => setSimAutoNext(e.target.checked)}
                  />
                  <span style={styles.toggleSlider}></span>
                </label>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button
                  onClick={() => setSimProgress(100)}
                  style={styles.simActionBtn}
                >
                  ⏭ Simulate Video End
                </button>
                <button
                  onClick={() => {
                    setSimProgress(0);
                    setSimToast('Manual swipe detected! Re-synced. 🛡️');
                    setTimeout(() => setSimToast(''), 2000);
                  }}
                  style={styles.simActionBtnSecondary}
                >
                  🖐️ Simulate Manual Swipe
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Key Features & Superpowers */}
      <section id="features" style={styles.section}>
        <div style={styles.sectionHeader}>
          <div style={styles.sectionEyebrow}>SUPERPOWERS & HIGHLIGHTS</div>
          <h2 style={styles.sectionTitle}>Why AutoReels Scroll Changes Everything</h2>
          <p style={styles.sectionSubtitle}>
            Forget clumsy timer-based extensions. AutoReels Scroll is engineered with smart frame-accurate HTML5 video completion detection.
          </p>
        </div>

        <div style={styles.featuresGrid}>
          <div style={styles.featureCard}>
            <div style={{ ...styles.featureIconBox, background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }}>🎯</div>
            <h3 style={styles.featureCardTitle}>Smart HTML5 Completion Detection</h3>
            <p style={styles.featureCardDesc}>
              No blind timers! The extension continuously inspects real-time playback, loop wraparound, and video element events to advance the exact millisecond the clip concludes.
            </p>
          </div>

          <div style={styles.featureCard}>
            <div style={{ ...styles.featureIconBox, background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' }}>🌐</div>
            <h3 style={styles.featureCardTitle}>4 Major Platforms in 1 Extension</h3>
            <p style={styles.featureCardDesc}>
              Seamlessly supports YouTube Shorts, Instagram Reels, Facebook Reels & Watch, and TikTok Web — custom optimized for each platform's unique player architecture.
            </p>
          </div>

          <div style={styles.featureCard}>
            <div style={{ ...styles.featureIconBox, background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>🛡️</div>
            <h3 style={styles.featureCardTitle}>Manual Scroll & Touch Protection</h3>
            <p style={styles.featureCardDesc}>
              Want to scroll yourself? The extension instantly senses your mouse wheel, arrow keys, or touchpad gesture and yields control without conflicts or double skipping.
            </p>
          </div>

          <div style={styles.featureCard}>
            <div style={{ ...styles.featureIconBox, background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}>⏱️</div>
            <h3 style={styles.featureCardTitle}>Custom Skip Delay Control</h3>
            <p style={styles.featureCardDesc}>
              Advance instantaneously (0s Instant) or set a 1s to 5s pause to let punchlines sink in before the next video starts.
            </p>
          </div>

          <div style={styles.featureCard}>
            <div style={{ ...styles.featureIconBox, background: 'rgba(168, 85, 247, 0.15)', color: '#a855f7' }}>⌨️</div>
            <h3 style={styles.featureCardTitle}>Convenient Keyboard Hotkeys</h3>
            <p style={styles.featureCardDesc}>
              Control playback without opening the popup: <code style={styles.codeTag}>Alt+Shift+A</code> (Toggle), <code style={styles.codeTag}>Alt+Shift+P</code> (Pause/Resume), and <code style={styles.codeTag}>Alt+Shift+N</code> (Skip Reel).
            </p>
          </div>

          <div style={styles.featureCard}>
            <div style={{ ...styles.featureIconBox, background: 'rgba(6, 182, 212, 0.15)', color: '#06b6d4' }}>🔒</div>
            <h3 style={styles.featureCardTitle}>100% Private & Battery Friendly</h3>
            <p style={styles.featureCardDesc}>
              Built strictly on modern Chrome Manifest V3. Zero bloat, zero background tracking, and whisper-quiet CPU & battery consumption.
            </p>
          </div>
        </div>
      </section>

      {/* Step-by-Step Guideline */}
      <section id="guide" style={styles.sectionAlt}>
        <div style={styles.sectionHeader}>
          <div style={styles.sectionEyebrow}>SIMPLE 4-STEP SETUP</div>
          <h2 style={styles.sectionTitle}>How to Use AutoReels Scroll</h2>
          <p style={styles.sectionSubtitle}>
            Get up and running in under 60 seconds with zero technical experience required.
          </p>
        </div>

        <div style={styles.stepsContainer}>
          <div style={styles.stepCard}>
            <div style={styles.stepNumberBadge}>1</div>
            <div style={styles.stepIcon}>🧩</div>
            <h3 style={styles.stepTitle}>Install & Pin Extension</h3>
            <p style={styles.stepDesc}>
              Open <code style={styles.codeTag}>chrome://extensions</code> in Chrome, enable Developer mode, click <strong>Load unpacked</strong> to add the folder, and pin (📌) the icon to your toolbar.
            </p>
          </div>

          <div style={styles.stepCard}>
            <div style={styles.stepNumberBadge}>2</div>
            <div style={styles.stepIcon}>🔑</div>
            <h3 style={styles.stepTitle}>Choose Your Access Pass</h3>
            <p style={styles.stepDesc}>
              Select your preferred pass below to unlock immediate access with the 1-Month, 1-Year, or Lifetime VIP pass.
            </p>
          </div>

          <div style={styles.stepCard}>
            <div style={styles.stepNumberBadge}>3</div>
            <div style={styles.stepIcon}>⚡</div>
            <h3 style={styles.stepTitle}>Paste Key & Activate</h3>
            <p style={styles.stepDesc}>
              Click the <strong>AutoReels Scroll</strong> toolbar icon, paste your unique key into the license field, and click <strong>Activate</strong>.
            </p>
          </div>

          <div style={styles.stepCard}>
            <div style={styles.stepNumberBadge}>4</div>
            <div style={styles.stepIcon}>🍿</div>
            <h3 style={styles.stepTitle}>Sit Back & Enjoy</h3>
            <p style={styles.stepDesc}>
              Open YouTube Shorts, Instagram Reels, Facebook, or TikTok. Videos automatically advance when finished without you touching a thing!
            </p>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" style={styles.section}>
        <div style={styles.sectionHeader}>
          <div style={styles.sectionEyebrow}>CHOOSE YOUR ACCESS PASS</div>
          <h2 style={styles.sectionTitle}>Simple, Transparent Global Pricing</h2>
          <p style={styles.sectionSubtitle}>
            No hidden fees. Instant digital delivery with 1-click activation. 100% money-back guarantee.
          </p>
        </div>

        <div style={styles.plansGrid}>
          {plans.map((p) => (
            <div
              key={p.id}
              style={{
                ...styles.planCard,
                borderColor: p.popular ? 'var(--accent)' : 'var(--border)',
                transform: p.popular ? 'scale(1.04)' : 'none',
                boxShadow: p.popular ? '0 12px 36px rgba(56, 189, 248, 0.2)' : 'none'
              }}
            >
              {p.badge && (
                <div
                  style={{
                    ...styles.planBadgeHeader,
                    backgroundColor: p.popular ? 'var(--accent)' : 'rgba(255,255,255,0.1)',
                    color: p.popular ? '#000' : 'var(--text-primary)'
                  }}
                >
                  {p.badge}
                </div>
              )}

              <h3 style={styles.planTitle}>{p.title}</h3>
              <p style={styles.planSub}>{p.subtitle}</p>

              <div style={styles.priceWrap}>
                <div style={styles.priceAmount}>{p.priceUsd}</div>
                <div style={styles.priceAlt}>{p.priceSub} • {p.duration}</div>
              </div>

              <div style={styles.planDivider}></div>

              <ul style={styles.featureList}>
                {p.features.map((f, i) => (
                  <li key={i} style={styles.featureItem}>
                    <span style={{ color: 'var(--success)', fontWeight: 'bold' }}>✓</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleOpenCheckout(p)}
                disabled={openingPlanId === p.id}
                style={{
                  ...styles.planBtn,
                  backgroundColor: p.isFree ? '#10b981' : (p.popular ? 'var(--accent)' : 'var(--bg-elevated)'),
                  color: p.isFree || p.popular ? '#000' : 'var(--text-primary)',
                  border: p.isFree || p.popular ? 'none' : '1px solid var(--border)',
                  opacity: openingPlanId === p.id ? 0.7 : 1,
                  cursor: openingPlanId === p.id ? 'wait' : 'pointer'
                }}
              >
                {openingPlanId === p.id
                  ? 'Opening Paddle Checkout...'
                  : p.id === '30day'
                  ? '⚡ Select 1 Month Pass'
                  : p.id === 'yearly'
                  ? '🔥 Get 1 Year Pro'
                  : '👑 Select Lifetime VIP'}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Customer Testimonials */}
      <section style={styles.sectionAlt}>
        <div style={styles.sectionHeader}>
          <div style={styles.sectionEyebrow}>USER REVIEWS</div>
          <h2 style={styles.sectionTitle}>Loved by Short-Form Video Fans Worldwide</h2>
        </div>

        <div style={styles.reviewsGrid}>
          <div style={styles.reviewCard}>
            <div style={styles.stars}>★★★★★</div>
            <p style={styles.reviewText}>
              "I watch shorts while eating dinner or coding on my laptop. Not having to reach over and tap my trackpad after every 20-second clip is pure bliss!"
            </p>
            <div style={styles.reviewerName}>— Alex Miller, Software Engineer (USA)</div>
          </div>

          <div style={styles.reviewCard}>
            <div style={styles.stars}>★★★★★</div>
            <p style={styles.reviewText}>
              "Unlike other timer extensions that cut off long videos midway, AutoReels actually tracks the audio and video ending perfectly. Upgrading to the annual pass was a no-brainer."
            </p>
            <div style={styles.reviewerName}>— Sarah Jenkins, Content Creator (UK)</div>
          </div>

          <div style={styles.reviewCard}>
            <div style={styles.stars}>★★★★★</div>
            <p style={styles.reviewText}>
              "Works seamlessly on both YouTube Shorts and Instagram Reels. Smooth transitions, zero lag, and instant key activation. The Lifetime VIP is an absolute steal!"
            </p>
            <div style={styles.reviewerName}>— David Kim, Digital Marketer (Canada)</div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" style={styles.section}>
        <div style={styles.sectionHeader}>
          <div style={styles.sectionEyebrow}>FREQUENTLY ASKED QUESTIONS</div>
          <h2 style={styles.sectionTitle}>Got Questions? We Have Answers.</h2>
        </div>

        <div style={styles.faqList}>
          {faqs.map((faq, idx) => (
            <div
              key={idx}
              onClick={() => setExpandedFaq(expandedFaq === idx ? -1 : idx)}
              style={styles.faqItem}
            >
              <div style={styles.faqQuestion}>
                <span>{faq.q}</span>
                <span style={{ fontSize: '18px', color: 'var(--accent)' }}>
                  {expandedFaq === idx ? '−' : '+'}
                </span>
              </div>
              {expandedFaq === idx && (
                <div style={styles.faqAnswer}>
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer style={styles.footer}>
        <div style={styles.footerInner}>
          <div>
            <div style={{ fontWeight: 'bold', fontSize: '16px', color: '#fff' }}>AutoReels Scroll</div>
            <div style={{ fontSize: '13px', color: 'var(--text-dim)', marginTop: '4px' }}>
              © 2026 AutoReels Scroll. High-performance social video automation for Chrome.
            </div>
          </div>
          <div style={styles.footerLinks}>
            <a href="#features" style={styles.footerLink}>Features</a>
            <a href="#guide" style={styles.footerLink}>Guide</a>
            <a href="#pricing" style={styles.footerLink}>Pricing</a>
            <a href="/admin" style={styles.footerLink}>Admin Login</a>
          </div>
        </div>
      </footer>

    </div>
  );
}

// Visual Styles
const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#070b14',
    color: '#f8fafc',
    position: 'relative',
    overflowX: 'hidden',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
  },
  glowTopLeft: {
    position: 'absolute',
    top: '-150px',
    left: '-150px',
    width: '600px',
    height: '600px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(56, 189, 248, 0.12) 0%, rgba(7, 11, 20, 0) 70%)',
    pointerEvents: 'none',
    zIndex: 0
  },
  glowCenterRight: {
    position: 'absolute',
    top: '30%',
    right: '-180px',
    width: '700px',
    height: '700px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(168, 85, 247, 0.1) 0%, rgba(7, 11, 20, 0) 70%)',
    pointerEvents: 'none',
    zIndex: 0
  },
  header: {
    position: 'sticky',
    top: 0,
    zIndex: 100,
    backdropFilter: 'blur(16px)',
    backgroundColor: 'rgba(7, 11, 20, 0.8)',
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
  },
  navContainer: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '16px 24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  logoBadge: {
    width: '42px',
    height: '42px',
    borderRadius: '12px',
    background: 'linear-gradient(135deg, #00f2fe 0%, #4facfe 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 4px 14px rgba(0, 242, 254, 0.3)'
  },
  brandTitle: {
    fontWeight: 800,
    fontSize: '18px',
    letterSpacing: '-0.3px',
    color: '#fff'
  },
  brandSub: {
    fontSize: '11px',
    color: 'var(--text-secondary)'
  },
  navLinks: {
    display: 'flex',
    alignItems: 'center',
    gap: '24px'
  },
  navLink: {
    color: 'var(--text-secondary)',
    textDecoration: 'none',
    fontSize: '14px',
    fontWeight: 500,
    transition: 'color 0.2s'
  },
  adminPortalBtn: {
    padding: '8px 14px',
    borderRadius: '8px',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    color: 'var(--text-primary)',
    textDecoration: 'none',
    fontSize: '13px',
    fontWeight: 600,
    transition: 'all 0.2s'
  },
  heroSection: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '80px 24px 60px',
    display: 'grid',
    gridTemplateColumns: '1.2fr 1fr',
    gap: '48px',
    alignItems: 'center',
    position: 'relative',
    zIndex: 1
  },
  heroContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px'
  },
  pillBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '6px 14px',
    borderRadius: '30px',
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    border: '1px solid rgba(56, 189, 248, 0.3)',
    color: 'var(--accent)',
    fontSize: '13px',
    fontWeight: 600,
    alignSelf: 'flex-start'
  },
  pillPulse: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: 'var(--accent)',
    boxShadow: '0 0 10px var(--accent)'
  },
  heroHeading: {
    fontSize: '44px',
    lineHeight: 1.18,
    fontWeight: 900,
    letterSpacing: '-1px'
  },
  gradientText: {
    background: 'linear-gradient(90deg, #38bdf8 0%, #818cf8 50%, #c084fc 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent'
  },
  heroSubheading: {
    fontSize: '16px',
    lineHeight: 1.6,
    color: 'var(--text-secondary)'
  },
  heroCtaGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    marginTop: '10px'
  },
  primaryBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '14px 24px',
    borderRadius: '10px',
    background: 'linear-gradient(135deg, #00f2fe 0%, #4facfe 100%)',
    color: '#070b14',
    fontWeight: 700,
    fontSize: '15px',
    boxShadow: '0 6px 20px rgba(0, 242, 254, 0.35)',
    transition: 'all 0.2s',
    cursor: 'pointer'
  },
  secondaryBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '14px 22px',
    borderRadius: '10px',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    color: '#fff',
    fontWeight: 600,
    fontSize: '14px',
    cursor: 'pointer'
  },
  trustBadges: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '16px',
    marginTop: '12px'
  },
  trustItem: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
  },
  simulatorWrapper: {
    position: 'relative'
  },
  simulatorCard: {
    backgroundColor: 'rgba(19, 27, 46, 0.8)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    borderRadius: '20px',
    padding: '18px',
    boxShadow: '0 24px 48px rgba(0, 0, 0, 0.6)',
    backdropFilter: 'blur(20px)'
  },
  simHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: '12px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.06)'
  },
  simLiveTag: {
    fontSize: '10px',
    fontWeight: 800,
    color: 'var(--success)',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    padding: '2px 8px',
    borderRadius: '20px',
    letterSpacing: '0.5px'
  },
  platformSelector: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '6px',
    margin: '12px 0'
  },
  platTab: {
    padding: '8px 4px',
    borderRadius: '8px',
    border: '1px solid transparent',
    fontSize: '11px',
    fontWeight: 600,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
    cursor: 'pointer'
  },
  simScreen: {
    height: '240px',
    borderRadius: '12px',
    background: 'linear-gradient(180deg, #111827 0%, #030712 100%)',
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    padding: '14px',
    overflow: 'hidden',
    border: '1px solid rgba(255, 255, 255, 0.08)'
  },
  simOverlayTop: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    zIndex: 2
  },
  simCreatorBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  simCounterBadge: {
    fontSize: '11px',
    fontWeight: 700,
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: '3px 8px',
    borderRadius: '6px',
    color: '#fff'
  },
  simCenterGlow: {
    alignSelf: 'center',
    textAlign: 'center',
    zIndex: 2
  },
  simToast: {
    position: 'absolute',
    top: '55px',
    left: '50%',
    transform: 'translateX(-50%)',
    backgroundColor: 'rgba(16, 185, 129, 0.95)',
    color: '#000',
    fontSize: '12px',
    fontWeight: 700,
    padding: '6px 14px',
    borderRadius: '20px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
    zIndex: 10
  },
  simProgressTrack: {
    height: '4px',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: '2px',
    overflow: 'hidden',
    zIndex: 2
  },
  simProgressBar: {
    height: '100%',
    transition: 'width 0.4s linear'
  },
  simControls: {
    marginTop: '14px',
    paddingTop: '12px',
    borderTop: '1px solid rgba(255, 255, 255, 0.06)'
  },
  toggleSwitch: {
    position: 'relative',
    display: 'inline-block',
    width: '38px',
    height: '22px'
  },
  toggleSlider: {
    position: 'absolute',
    cursor: 'pointer',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'var(--accent)',
    borderRadius: '24px',
    transition: '0.2s'
  },
  simActionBtn: {
    flex: 1,
    padding: '8px',
    borderRadius: '8px',
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    border: '1px solid rgba(56, 189, 248, 0.3)',
    color: 'var(--accent)',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer'
  },
  simActionBtnSecondary: {
    flex: 1,
    padding: '8px',
    borderRadius: '8px',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    color: 'var(--text-secondary)',
    fontSize: '12px',
    fontWeight: 500,
    cursor: 'pointer'
  },
  section: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '80px 24px'
  },
  sectionAlt: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderTop: '1px solid rgba(255, 255, 255, 0.05)',
    borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
    padding: '80px 24px'
  },
  sectionHeader: {
    textAlign: 'center',
    maxWidth: '720px',
    margin: '0 auto 48px'
  },
  sectionEyebrow: {
    fontSize: '12px',
    fontWeight: 800,
    letterSpacing: '1.2px',
    color: 'var(--accent)',
    marginBottom: '8px'
  },
  sectionTitle: {
    fontSize: '34px',
    fontWeight: 800,
    lineHeight: 1.25,
    letterSpacing: '-0.5px'
  },
  sectionSubtitle: {
    fontSize: '15px',
    color: 'var(--text-secondary)',
    marginTop: '12px',
    lineHeight: 1.6
  },
  featuresGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '24px'
  },
  featureCard: {
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: '16px',
    padding: '28px',
    transition: 'transform 0.2s',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)'
  },
  featureIconBox: {
    width: '46px',
    height: '46px',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '22px',
    marginBottom: '18px'
  },
  featureCardTitle: {
    fontSize: '18px',
    fontWeight: 700,
    marginBottom: '10px'
  },
  featureCardDesc: {
    fontSize: '14px',
    color: 'var(--text-secondary)',
    lineHeight: 1.6
  },
  codeTag: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    padding: '2px 6px',
    borderRadius: '4px',
    fontSize: '12px',
    fontFamily: 'monospace',
    color: 'var(--accent)'
  },
  stepsContainer: {
    maxWidth: '1200px',
    margin: '0 auto',
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '20px'
  },
  stepCard: {
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: '16px',
    padding: '24px',
    position: 'relative'
  },
  stepNumberBadge: {
    position: 'absolute',
    top: '-12px',
    left: '20px',
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    backgroundColor: 'var(--accent)',
    color: '#000',
    fontWeight: 800,
    fontSize: '14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  stepIcon: {
    fontSize: '32px',
    margin: '12px 0 16px'
  },
  stepTitle: {
    fontSize: '16px',
    fontWeight: 700,
    marginBottom: '10px'
  },
  stepDesc: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
    lineHeight: 1.6
  },
  plansGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: '24px',
    alignItems: 'stretch'
  },
  freeTrialNotice: {
    padding: '14px 16px',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    border: '1px solid rgba(16, 185, 129, 0.3)',
    borderRadius: '10px',
    marginBottom: '16px'
  },
  planCard: {
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: '20px',
    padding: '32px 28px',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative'
  },
  planBadgeHeader: {
    position: 'absolute',
    top: '-14px',
    right: '24px',
    padding: '4px 12px',
    borderRadius: '14px',
    fontSize: '11px',
    fontWeight: 700
  },
  planTitle: {
    fontSize: '22px',
    fontWeight: 800
  },
  planSub: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
    marginTop: '6px',
    minHeight: '38px'
  },
  priceWrap: {
    margin: '20px 0 16px'
  },
  priceAmount: {
    fontSize: '36px',
    fontWeight: 900,
    color: '#fff',
    letterSpacing: '-1px'
  },
  priceAlt: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
    marginTop: '2px'
  },
  planDivider: {
    height: '1px',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    margin: '16px 0 20px'
  },
  featureList: {
    listStyle: 'none',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    marginBottom: '28px',
    flex: 1
  },
  featureItem: {
    fontSize: '13px',
    color: 'var(--text-primary)',
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
  },
  planBtn: {
    width: '100%',
    padding: '14px',
    borderRadius: '10px',
    fontWeight: 700,
    fontSize: '14px',
    cursor: 'pointer',
    textAlign: 'center',
    transition: 'all 0.2s'
  },
  reviewsGrid: {
    maxWidth: '1200px',
    margin: '0 auto',
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '24px'
  },
  reviewCard: {
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: '16px',
    padding: '24px'
  },
  stars: {
    color: '#f59e0b',
    fontSize: '16px',
    marginBottom: '12px'
  },
  reviewText: {
    fontSize: '14px',
    color: 'var(--text-secondary)',
    lineHeight: 1.6,
    marginBottom: '16px',
    fontStyle: 'italic'
  },
  reviewerName: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#fff'
  },
  faqList: {
    maxWidth: '760px',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  faqItem: {
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    padding: '18px 22px',
    cursor: 'pointer'
  },
  faqQuestion: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    fontWeight: 600,
    fontSize: '15px'
  },
  faqAnswer: {
    fontSize: '14px',
    color: 'var(--text-secondary)',
    lineHeight: 1.6,
    marginTop: '12px',
    paddingTop: '12px',
    borderTop: '1px solid rgba(255, 255, 255, 0.06)'
  },
  footer: {
    borderTop: '1px solid rgba(255, 255, 255, 0.08)',
    padding: '40px 24px',
    backgroundColor: '#05080f'
  },
  footerInner: {
    maxWidth: '1200px',
    margin: '0 auto',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  footerLinks: {
    display: 'flex',
    gap: '20px'
  },
  footerLink: {
    color: 'var(--text-dim)',
    textDecoration: 'none',
    fontSize: '13px'
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    backdropFilter: 'blur(8px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    zIndex: 1000
  },
  modalBox: {
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: '20px',
    maxWidth: '480px',
    width: '100%',
    padding: '28px',
    boxShadow: '0 24px 60px rgba(0, 0, 0, 0.8)'
  },
  modalHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: '20px',
    paddingBottom: '14px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
  },
  modalHeading: {
    fontSize: '20px',
    fontWeight: 700
  },
  modalCloseBtn: {
    fontSize: '18px',
    color: 'var(--text-dim)',
    padding: '4px 8px',
    cursor: 'pointer'
  },
  checkoutForm: {
    display: 'flex',
    flexDirection: 'column'
  },
  inputLabel: {
    display: 'block',
    fontSize: '12px',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    marginBottom: '6px'
  },
  gatewayTabs: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '8px'
  },
  gatewayTab: {
    padding: '10px',
    borderRadius: '8px',
    border: '1px solid var(--border)',
    fontSize: '12px',
    fontWeight: 700,
    cursor: 'pointer',
    textAlign: 'center'
  },
  gatewayNotice: {
    padding: '12px 14px',
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
    border: '1px solid rgba(56, 189, 248, 0.2)',
    borderRadius: '8px',
    fontSize: '12px',
    color: 'var(--text-secondary)',
    lineHeight: 1.5,
    marginBottom: '14px'
  },
  textInput: {
    width: '100%',
    padding: '10px 14px',
    borderRadius: '8px',
    backgroundColor: 'var(--bg-primary)',
    border: '1px solid var(--border)',
    color: '#fff',
    fontSize: '14px',
    outline: 'none'
  },
  orderSummaryBox: {
    padding: '12px 14px',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid rgba(255, 255, 255, 0.06)',
    borderRadius: '8px',
    fontSize: '13px',
    margin: '14px 0 18px'
  },
  errorAlert: {
    padding: '10px 14px',
    borderRadius: '8px',
    backgroundColor: 'var(--danger-bg)',
    color: 'var(--danger)',
    fontSize: '12px',
    fontWeight: 600,
    marginBottom: '14px'
  },
  successScreen: {
    textAlign: 'center',
    padding: '10px 0'
  },
  successBadge: {
    width: '56px',
    height: '56px',
    borderRadius: '50%',
    backgroundColor: 'var(--success)',
    color: '#000',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 16px',
    fontWeight: 'bold',
    boxShadow: '0 0 24px rgba(16, 185, 129, 0.4)'
  },
  licenseKeyBox: {
    padding: '16px',
    borderRadius: '12px',
    backgroundColor: 'var(--bg-primary)',
    border: '1px dashed var(--accent)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    margin: '16px 0 20px'
  },
  keyText: {
    fontSize: '18px',
    fontFamily: 'monospace',
    fontWeight: 800,
    color: 'var(--accent)',
    letterSpacing: '1px'
  },
  copyBtn: {
    padding: '8px 14px',
    borderRadius: '8px',
    backgroundColor: 'var(--accent)',
    color: '#000',
    fontWeight: 700,
    fontSize: '12px',
    cursor: 'pointer'
  },
  quickActivationTips: {
    textAlign: 'left',
    padding: '12px 14px',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: '8px'
  },
  spinner: {
    width: '32px',
    height: '32px',
    border: '3px solid rgba(56, 189, 248, 0.2)',
    borderTopColor: '#38bdf8',
    borderRadius: '50%',
    margin: '0 auto',
    animation: 'spin 1s linear infinite'
  },
  tipBanner: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    border: '1px solid rgba(16, 185, 129, 0.3)',
    color: '#10b981',
    padding: '10px 14px',
    borderRadius: '8px',
    fontSize: '12px',
    fontWeight: 500,
    marginBottom: '14px',
    textAlign: 'center'
  },
  btnSecondarySm: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    color: 'var(--text-secondary)',
    padding: '10px 16px',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer'
  }
};
