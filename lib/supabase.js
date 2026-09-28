/**
 * AutoReels Scroll - Database Client Helper
 * Mediates all communication with Supabase PostgreSQL using SUPABASE_SERVICE_ROLE_KEY.
 * Includes a built-in in-memory fallback store pre-populated with seed data for offline
 * local development and automated testing before live Supabase credentials are configured.
 */

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = (
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  ''
).trim();

let realSupabaseClient = null;

if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    realSupabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
    console.log('[AutoReels License Server] Connected to live Supabase database.');
  } catch (err) {
    console.warn('[AutoReels License Server] Live Supabase client unavailable (' + err.message + '). Using local in-memory fallback.');
  }
} else {
  console.log(
    '[AutoReels License Server] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not configured. Running in Local In-Memory Mode with seed data.'
  );
}

// ---------------------------------------------------------------------------
// In-Memory Fallback Database for Local Development & Automated Tests
// ---------------------------------------------------------------------------

const globalForDb = globalThis;

if (!globalForDb.__memLicenses) {
  globalForDb.__memLicenses = new Map([
  [
    'TEST-ARS-LIFETIME-001',
    {
      id: 'a0000000-0000-0000-0000-000000000001',
      license_key: 'TEST-ARS-LIFETIME-001',
      plan: 'lifetime',
      status: 'active',
      expires_at: null,
      max_devices: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  ],
  [
    'TEST-ARS-30DAY-001',
    {
      id: 'a0000000-0000-0000-0000-000000000002',
      license_key: 'TEST-ARS-30DAY-001',
      plan: '30day',
      status: 'active',
      expires_at: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
      max_devices: 2,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  ],
  [
    'TEST-ARS-7DAY-001',
    {
      id: 'a0000000-0000-0000-0000-000000000003',
      license_key: 'TEST-ARS-7DAY-001',
      plan: '7day',
      status: 'active',
      expires_at: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
      max_devices: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  ],
  [
    'TEST-ARS-YEARLY-001',
    {
      id: 'a0000000-0000-0000-0000-000000000004',
      license_key: 'TEST-ARS-YEARLY-001',
      plan: 'yearly',
      status: 'active',
      expires_at: new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString(),
      max_devices: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  ],
  [
    'TEST-ARS-EXPIRED-001',
    {
      id: 'a0000000-0000-0000-0000-000000000005',
      license_key: 'TEST-ARS-EXPIRED-001',
      plan: '30day',
      status: 'expired',
      expires_at: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
      max_devices: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  ],
  [
    'TEST-ARS-REVOKED-001',
    {
      id: 'a0000000-0000-0000-0000-000000000006',
      license_key: 'TEST-ARS-REVOKED-001',
      plan: 'lifetime',
      status: 'revoked',
      expires_at: null,
      max_devices: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  ],
  [
    'TEST-ARS-LIMIT-001',
    {
      id: 'a0000000-0000-0000-0000-000000000007',
      license_key: 'TEST-ARS-LIMIT-001',
      plan: 'lifetime',
      status: 'active',
      expires_at: null,
      max_devices: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  ]
  ]);
}

const memLicenses = globalForDb.__memLicenses;

if (!globalForDb.__memActivations) {
  globalForDb.__memActivations = [
  {
    id: 'b0000000-0000-0000-0000-000000000001',
    license_id: 'a0000000-0000-0000-0000-000000000007',
    installation_id: 'test-device-uuid-existing-001',
    status: 'active',
    activated_at: new Date().toISOString(),
    last_seen_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
  ];
}

if (!globalForDb.__memPurchases) {
  globalForDb.__memPurchases = [];
}

if (!globalForDb.__memProducts) {
  globalForDb.__memProducts = [
    {
      id: '00000000-0000-0000-0000-000000000001',
      name: '7-Day Free Trial',
      plan: '7day',
      paddle_price_id: null,
      duration_days: 7,
      is_lifetime: false,
      active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: '00000000-0000-0000-0000-000000000002',
      name: '1 Month Pass',
      plan: '30day',
      paddle_price_id: process.env.PADDLE_PRICE_MONTHLY || 'pri_01_sample_monthly_149',
      duration_days: 30,
      is_lifetime: false,
      active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: '00000000-0000-0000-0000-000000000003',
      name: '1 Year Pro',
      plan: 'yearly',
      paddle_price_id: process.env.PADDLE_PRICE_YEARLY || 'pri_02_sample_yearly_949',
      duration_days: 365,
      is_lifetime: false,
      active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: '00000000-0000-0000-0000-000000000004',
      name: 'Lifetime VIP',
      plan: 'lifetime',
      paddle_price_id: process.env.PADDLE_PRICE_LIFETIME || 'pri_03_sample_lifetime_1999',
      duration_days: null,
      is_lifetime: true,
      active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  ];
}

if (!globalForDb.__memCustomers) {
  globalForDb.__memCustomers = [];
}

if (!globalForDb.__memSubscriptions) {
  globalForDb.__memSubscriptions = [];
}

if (!globalForDb.__memWebhookEvents) {
  globalForDb.__memWebhookEvents = [];
}

if (!globalForDb.__memOrders) {
  globalForDb.__memOrders = [];
}

class MemoryQueryBuilder {
  constructor(table) {
    this.table = table;
    this.conditions = [];
    this.operation = 'select';
    this.insertPayload = null;
    this.updatePayload = null;
    this.upsertPayload = null;
    this.orderField = null;
    this.orderAsc = true;
    this.limitCount = null;
  }

  select(fields = '*') {
    if (this.operation !== 'insert' && this.operation !== 'upsert') {
      this.operation = 'select';
    }
    this.selectFields = fields;
    return this;
  }

  insert(data) {
    this.operation = 'insert';
    this.insertPayload = Array.isArray(data) ? data : [data];
    return this;
  }

  upsert(data, options = {}) {
    this.operation = 'upsert';
    this.upsertPayload = Array.isArray(data) ? data : [data];
    this.upsertOptions = options;
    return this;
  }

  update(data) {
    this.operation = 'update';
    this.updatePayload = data;
    return this;
  }

  delete() {
    this.operation = 'delete';
    return this;
  }

  eq(field, value) {
    this.conditions.push((item) => item[field] === value);
    return this;
  }

  neq(field, value) {
    this.conditions.push((item) => item[field] !== value);
    return this;
  }

  in(field, values) {
    const valSet = new Set(Array.isArray(values) ? values : [values]);
    this.conditions.push((item) => valSet.has(item[field]));
    return this;
  }

  ilike(field, pattern) {
    const p = pattern.replace(/%/g, '').toLowerCase();
    this.conditions.push((item) => (item[field] || '').toLowerCase().includes(p));
    return this;
  }

  order(field, { ascending = true } = {}) {
    this.orderField = field;
    this.orderAsc = ascending;
    return this;
  }

  limit(count) {
    this.limitCount = count;
    return this;
  }

  async single() {
    const res = await this._execute();
    if (res.error) return res;
    if (!res.data || res.data.length === 0) {
      return { data: null, error: { message: 'Row not found', code: 'PGRST116' } };
    }
    return { data: res.data[0], error: null };
  }

  then(resolve, reject) {
    return this._execute().then(resolve, reject);
  }

  async _execute() {
    try {
      if (this.table === 'licenses') {
        return this._executeLicenses();
      } else if (this.table === 'activations' || this.table === 'license_activations') {
        return this._executeActivations();
      } else if (this.table === 'purchases') {
        return this._executePurchases();
      } else if (this.table === 'orders') {
        return this._executeOrders();
      } else if (this.table === 'webhook_events') {
        return this._executeWebhookEvents();
      } else if (this.table === 'products') {
        return this._executeProducts();
      } else if (this.table === 'customers') {
        return this._executeCustomers();
      } else if (this.table === 'subscriptions') {
        return this._executeSubscriptions();
      }
      return { data: [], error: null };
    } catch (err) {
      return { data: null, error: { message: err.message } };
    }
  }

  _executeLicenses() {
    const store = globalForDb.__memLicenses;
    if (this.operation === 'insert') {
      const inserted = [];
      for (const item of this.insertPayload) {
        const full = {
          id: item.id || `lic-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ...item
        };
        store.set(full.license_key, full);
        inserted.push(full);
      }
      return { data: inserted, error: null };
    }

    let rows = Array.from(store.values());
    for (const cond of this.conditions) {
      rows = rows.filter(cond);
    }

    if (this.operation === 'update') {
      for (const row of rows) {
        Object.assign(row, this.updatePayload, { updated_at: new Date().toISOString() });
      }
      return { data: rows, error: null };
    }

    if (this.operation === 'delete') {
      for (const row of rows) {
        store.delete(row.license_key);
      }
      return { data: rows, error: null };
    }

    if (this.orderField) {
      rows.sort((a, b) => {
        if (a[this.orderField] < b[this.orderField]) return this.orderAsc ? -1 : 1;
        if (a[this.orderField] > b[this.orderField]) return this.orderAsc ? 1 : -1;
        return 0;
      });
    }

    if (this.limitCount) {
      rows = rows.slice(0, this.limitCount);
    }

    return { data: rows, error: null };
  }

  _executeActivations() {
    const store = globalForDb.__memActivations;
    if (this.operation === 'insert') {
      const inserted = [];
      for (const item of this.insertPayload) {
        const full = {
          id: item.id || `act-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          status: 'active',
          activated_at: new Date().toISOString(),
          last_seen_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ...item
        };
        store.push(full);
        inserted.push(full);
      }
      return { data: inserted, error: null };
    }

    let rows = store;
    for (const cond of this.conditions) {
      rows = rows.filter(cond);
    }

    if (this.operation === 'update') {
      for (const row of rows) {
        Object.assign(row, this.updatePayload, { updated_at: new Date().toISOString() });
      }
      return { data: rows, error: null };
    }

    if (this.operation === 'delete') {
      for (const row of rows) {
        const idx = store.indexOf(row);
        if (idx !== -1) store.splice(idx, 1);
      }
      return { data: rows, error: null };
    }

    return { data: rows, error: null };
  }

  _executePurchases() {
    const store = globalForDb.__memPurchases;
    if (this.operation === 'insert') {
      const inserted = [];
      for (const item of this.insertPayload) {
        const full = {
          id: item.id || `pur-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          status: item.status || 'completed',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ...item
        };
        store.push(full);
        inserted.push(full);
      }
      return { data: inserted, error: null };
    }

    let rows = store;
    for (const cond of this.conditions) {
      rows = rows.filter(cond);
    }

    if (this.operation === 'update') {
      for (const row of rows) {
        Object.assign(row, this.updatePayload, { updated_at: new Date().toISOString() });
      }
      return { data: rows, error: null };
    }

    if (this.operation === 'delete') {
      for (const row of rows) {
        const idx = store.indexOf(row);
        if (idx !== -1) store.splice(idx, 1);
      }
      return { data: rows, error: null };
    }

    if (this.orderField) {
      rows.sort((a, b) => {
        if (a[this.orderField] < b[this.orderField]) return this.orderAsc ? -1 : 1;
        if (a[this.orderField] > b[this.orderField]) return this.orderAsc ? 1 : -1;
        return 0;
      });
    }

    if (this.limitCount) {
      rows = rows.slice(0, this.limitCount);
    }

    return { data: rows, error: null };
  }

  _executeProducts() {
    const store = globalForDb.__memProducts;
    if (this.operation === 'insert') {
      const inserted = [];
      for (const item of this.insertPayload) {
        const full = {
          id: item.id || `prod-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          active: item.active !== false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ...item
        };
        store.push(full);
        inserted.push(full);
      }
      return { data: inserted, error: null };
    }

    let rows = store;
    for (const cond of this.conditions) {
      rows = rows.filter(cond);
    }

    if (this.operation === 'update') {
      for (const row of rows) {
        Object.assign(row, this.updatePayload, { updated_at: new Date().toISOString() });
      }
      return { data: rows, error: null };
    }

    if (this.operation === 'delete') {
      for (const row of rows) {
        const idx = store.indexOf(row);
        if (idx !== -1) store.splice(idx, 1);
      }
      return { data: rows, error: null };
    }

    return { data: rows, error: null };
  }

  _executeCustomers() {
    const store = globalForDb.__memCustomers;
    if (this.operation === 'insert' || this.operation === 'upsert') {
      const payload = this.operation === 'upsert' ? this.upsertPayload : this.insertPayload;
      const result = [];
      for (const item of payload) {
        const key = item.customer_id || item.id;
        const existingIdx = store.findIndex((c) => (c.customer_id && c.customer_id === key) || (c.id && c.id === key) || (item.email && c.email === item.email));
        if (existingIdx !== -1) {
          const updated = {
            ...store[existingIdx],
            ...item,
            updated_at: new Date().toISOString()
          };
          store[existingIdx] = updated;
          result.push(updated);
        } else {
          const full = {
            id: item.id || (item.customer_id ? item.customer_id : `cust-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`),
            customer_id: item.customer_id || item.id,
            has_trial_claimed: item.has_trial_claimed || false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            ...item
          };
          store.push(full);
          result.push(full);
        }
      }
      return { data: result, error: null };
    }

    let rows = store;
    for (const cond of this.conditions) {
      rows = rows.filter(cond);
    }

    if (this.operation === 'update') {
      for (const row of rows) {
        Object.assign(row, this.updatePayload, { updated_at: new Date().toISOString() });
      }
      return { data: rows, error: null };
    }

    return { data: rows, error: null };
  }

  _executeSubscriptions() {
    const store = globalForDb.__memSubscriptions;
    if (this.operation === 'insert' || this.operation === 'upsert') {
      const payload = this.operation === 'upsert' ? this.upsertPayload : this.insertPayload;
      const result = [];
      for (const item of payload) {
        const subId = item.subscription_id || item.id;
        const existingIdx = store.findIndex((s) => (s.subscription_id && s.subscription_id === subId) || (s.id && s.id === subId));
        if (existingIdx !== -1) {
          const updated = {
            ...store[existingIdx],
            ...item,
            updated_at: new Date().toISOString()
          };
          store[existingIdx] = updated;
          result.push(updated);
        } else {
          const full = {
            id: item.id || subId || `sub-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            subscription_id: subId,
            status: item.status || 'active',
            price_id: item.price_id || '',
            product_id: item.product_id || '',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            ...item
          };
          store.push(full);
          result.push(full);
        }
      }
      return { data: result, error: null };
    }

    let rows = store;
    for (const cond of this.conditions) {
      rows = rows.filter(cond);
    }

    if (this.operation === 'update') {
      for (const row of rows) {
        Object.assign(row, this.updatePayload, { updated_at: new Date().toISOString() });
      }
      return { data: rows, error: null };
    }

    if (this.operation === 'delete') {
      for (const row of rows) {
        const idx = store.indexOf(row);
        if (idx !== -1) store.splice(idx, 1);
      }
      return { data: rows, error: null };
    }

    return { data: rows, error: null };
  }

  _executeWebhookEvents() {
    const store = globalForDb.__memWebhookEvents;
    if (this.operation === 'insert') {
      const inserted = [];
      for (const item of this.insertPayload) {
        // Check uniqueness on event_id
        if (item.event_id && store.some((e) => e.event_id === item.event_id)) {
          return { data: null, error: { message: 'Duplicate event_id violates unique constraint', code: '23505' } };
        }
        const full = {
          id: item.id || `evt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          status: item.status || 'completed',
          processed_at: item.processed_at || new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ...item
        };
        store.push(full);
        inserted.push(full);
      }
      return { data: inserted, error: null };
    }

    let rows = store;
    for (const cond of this.conditions) {
      rows = rows.filter(cond);
    }

    if (this.operation === 'update') {
      for (const row of rows) {
        Object.assign(row, this.updatePayload, { updated_at: new Date().toISOString() });
      }
      return { data: rows, error: null };
    }

    return { data: rows, error: null };
  }

  _executeOrders() {
    const store = globalForDb.__memOrders;
    if (this.operation === 'insert') {
      const inserted = [];
      for (const item of this.insertPayload) {
        const full = {
          id: item.id || `ord-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          status: item.status || 'completed',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ...item
        };
        store.push(full);
        inserted.push(full);
      }
      return { data: inserted, error: null };
    }

    let rows = store;
    for (const cond of this.conditions) {
      rows = rows.filter(cond);
    }

    if (this.operation === 'update') {
      for (const row of rows) {
        Object.assign(row, this.updatePayload, { updated_at: new Date().toISOString() });
      }
      return { data: rows, error: null };
    }

    return { data: rows, error: null };
  }
}

const mockSupabaseClient = {
  from(table) {
    return new MemoryQueryBuilder(table);
  }
};

/**
 * Returns active database client (Live Supabase client if configured, otherwise in-memory mock).
 */
export function getDb() {
  return realSupabaseClient || mockSupabaseClient;
}

export const isLiveSupabase = () => !!realSupabaseClient;
