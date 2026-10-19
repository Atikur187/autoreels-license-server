const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');
const os = require('os');

async function run() {
  const port = 9678;
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const tmpDir = path.join(os.tmpdir(), 'chrome_3tier_test_' + Date.now());
  fs.mkdirSync(tmpDir, { recursive: true });

  const chrome = spawn(chromePath, [
    '--headless=new',
    '--no-sandbox',
    '--remote-debugging-port=' + port,
    '--user-data-dir=' + tmpDir,
    '--no-first-run',
    '--disable-gpu',
    'about:blank'
  ]);

  try {
    await new Promise(r => setTimeout(r, 2000));
    let wsUrl = null;
    for (let i = 0; i < 20; i++) {
      try {
        const data = await new Promise((res, rej) => {
          http.get('http://127.0.0.1:' + port + '/json/version', r => {
            let b = ''; r.on('data', c => b += c); r.on('end', () => res(b));
          }).on('error', rej);
        });
        wsUrl = JSON.parse(data).webSocketDebuggerUrl;
        if (wsUrl) break;
      } catch(e) {
        await new Promise(r => setTimeout(r, 300));
      }
    }

    if (!wsUrl) throw new Error('Failed to get WebSocket Debugger URL from Chrome');

    const browserWs = new WebSocket(wsUrl);
    await new Promise(r => browserWs.onopen = r);

    let id = 1;
    const send = (ws, method, params = {}) => {
      const curId = id++;
      return new Promise((resolve, reject) => {
        const handler = (event) => {
          const msg = JSON.parse(event.data);
          if (msg.id === curId) {
            ws.removeEventListener('message', handler);
            if (msg.error) reject(msg.error);
            else resolve(msg.result);
          }
        };
        ws.addEventListener('message', handler);
        ws.send(JSON.stringify({ id: curId, method, params }));
      });
    };

    const { targetId } = await send(browserWs, 'Target.createTarget', { url: 'http://localhost:3500/pricing' });
    const { sessionId } = await send(browserWs, 'Target.attachToTarget', { targetId, flatten: true });

    const sendSession = (method, params = {}) => {
      const curId = id++;
      return new Promise((resolve, reject) => {
        const handler = (event) => {
          const msg = JSON.parse(event.data);
          if (msg.id === curId) {
            browserWs.removeEventListener('message', handler);
            if (msg.error) reject(msg.error);
            else resolve(msg.result);
          }
        };
        browserWs.addEventListener('message', handler);
        browserWs.send(JSON.stringify({ id: curId, sessionId, method, params }));
      });
    };

    await sendSession('Page.enable');
    await sendSession('Runtime.enable');

    const consoleLogs = [];
    browserWs.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data);
      if (msg.method === 'Runtime.consoleAPICalled') {
        const text = msg.params.args.map(a => a.value || JSON.stringify(a)).join(' ');
        consoleLogs.push(text);
      }
    });

    console.log('[Test] Waiting for page load and Paddle.PricePreview() response...');
    await new Promise(r => setTimeout(r, 4000));

    // Evaluate prices rendered in DOM
    const priceCheck = await sendSession('Runtime.evaluate', {
      expression: `
        (() => {
          const starter = document.querySelector('#tier-card-starter .tier-price-amount')?.textContent?.trim();
          const pro = document.querySelector('#tier-card-pro .tier-price-amount')?.textContent?.trim();
          const advanced = document.querySelector('#tier-card-advanced .tier-price-amount')?.textContent?.trim();
          const toggleMonthlyActive = document.querySelector('#billing-monthly-toggle')?.classList.contains('active');
          return { starter, pro, advanced, toggleMonthlyActive };
        })()
      `,
      returnByValue: true
    });

    console.log('[Test] Monthly Prices (Paddle PricePreview):', priceCheck.result.value);

    // Toggle Yearly
    console.log('[Test] Clicking Yearly Billing toggle...');
    await sendSession('Runtime.evaluate', {
      expression: `document.querySelector('#billing-yearly-toggle')?.click()`
    });

    await new Promise(r => setTimeout(r, 3000));

    const yearlyPriceCheck = await sendSession('Runtime.evaluate', {
      expression: `
        (() => {
          const starter = document.querySelector('#tier-card-starter .tier-price-amount')?.textContent?.trim();
          const pro = document.querySelector('#tier-card-pro .tier-price-amount')?.textContent?.trim();
          const advanced = document.querySelector('#tier-card-advanced .tier-price-amount')?.textContent?.trim();
          const toggleYearlyActive = document.querySelector('#billing-yearly-toggle')?.classList.contains('active');
          return { starter, pro, advanced, toggleYearlyActive };
        })()
      `,
      returnByValue: true
    });

    console.log('[Test] Yearly Prices (Paddle PricePreview):', yearlyPriceCheck.result.value);

    // Click Subscribe button for Starter
    console.log('[Test] Clicking Subscribe to Starter button...');
    await sendSession('Runtime.evaluate', {
      expression: `document.querySelector('#subscribe-btn-starter')?.click()`
    });

    await new Promise(r => setTimeout(r, 4000));

    // Check Paddle iframe or overlay in DOM
    const checkoutOverlayCheck = await sendSession('Runtime.evaluate', {
      expression: `
        (() => {
          const paddleFrame = document.querySelector('iframe[name^="paddle"]') || document.querySelector('.paddle-frame-overlay');
          const btnText = document.querySelector('#subscribe-btn-starter')?.textContent?.trim();
          return { hasPaddleFrame: !!paddleFrame, btnText };
        })()
      `,
      returnByValue: true
    });

    console.log('[Test] Checkout Overlay result:', checkoutOverlayCheck.result.value);
    console.log('[Test] Captured Console Messages:', consoleLogs.slice(-5));

  } finally {
    try { chrome.kill(); } catch {}
  }
}

run().catch(console.error);
