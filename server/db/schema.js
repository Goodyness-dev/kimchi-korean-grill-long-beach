export const schemaSql = `
  CREATE TABLE IF NOT EXISTS tenants (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    currency TEXT NOT NULL DEFAULT 'USD',
    settings_version INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS locations (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    timezone TEXT NOT NULL DEFAULT 'America/New_York',
    address TEXT NOT NULL,
    phone TEXT NOT NULL,
    pickup_instructions TEXT NOT NULL,
    opening_hours_json TEXT NOT NULL,
    is_paused INTEGER NOT NULL DEFAULT 0,
    pause_reason TEXT,
    lead_time_mins INTEGER NOT NULL DEFAULT 20,
    max_concurrent_orders INTEGER NOT NULL DEFAULT 30,
    tax_rate_bps INTEGER NOT NULL DEFAULT 825, -- 8.25% in basis points
    acceptance_window_mins INTEGER NOT NULL DEFAULT 15,
    FOREIGN KEY(tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS staff_memberships (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL, -- 'OWNER', 'MANAGER', 'KITCHEN'
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY(tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS menu_categories (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    location_id TEXT NOT NULL,
    name TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY(tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY(location_id) REFERENCES locations(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS menu_items (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    location_id TEXT NOT NULL,
    category_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    price_minor INTEGER NOT NULL, -- integer cents ($12.50 = 1250)
    image_url TEXT,
    is_available INTEGER NOT NULL DEFAULT 1,
    dietary_tags_json TEXT DEFAULT '[]',
    sort_order INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY(tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY(location_id) REFERENCES locations(id) ON DELETE CASCADE,
    FOREIGN KEY(category_id) REFERENCES menu_categories(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS modifier_groups (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    item_id TEXT NOT NULL,
    name TEXT NOT NULL,
    min_selection INTEGER NOT NULL DEFAULT 0,
    max_selection INTEGER NOT NULL DEFAULT 1,
    is_required INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY(tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY(item_id) REFERENCES menu_items(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS modifier_options (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    group_id TEXT NOT NULL,
    name TEXT NOT NULL,
    price_delta_minor INTEGER NOT NULL DEFAULT 0,
    is_available INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY(tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY(group_id) REFERENCES modifier_groups(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    location_id TEXT NOT NULL,
    public_ref TEXT NOT NULL UNIQUE,
    capability_token_hash TEXT NOT NULL,
    state TEXT NOT NULL, -- 'PENDING_ACCEPTANCE', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'CANCELLED', 'READY', 'COMPLETED'
    version INTEGER NOT NULL DEFAULT 1,
    currency TEXT NOT NULL DEFAULT 'USD',
    subtotal_minor INTEGER NOT NULL,
    tax_minor INTEGER NOT NULL,
    total_minor INTEGER NOT NULL,
    acceptance_deadline TEXT NOT NULL,
    estimated_pickup_at TEXT,
    decline_reason TEXT,
    cancel_reason TEXT,
    customer_name TEXT NOT NULL,
    customer_email TEXT NOT NULL,
    customer_phone TEXT,
    customer_notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY(tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY(location_id) REFERENCES locations(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    order_id TEXT NOT NULL,
    item_id TEXT NOT NULL,
    item_name TEXT NOT NULL,
    base_price_minor INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    subtotal_minor INTEGER NOT NULL,
    options_snapshot_json TEXT NOT NULL DEFAULT '[]',
    FOREIGN KEY(tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS order_events (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    order_id TEXT NOT NULL,
    sequence INTEGER NOT NULL,
    from_state TEXT,
    to_state TEXT NOT NULL,
    actor_type TEXT NOT NULL, -- 'CUSTOMER', 'STAFF', 'SYSTEM_SWEEPER'
    actor_id TEXT,
    reason TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY(tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE,
    UNIQUE(tenant_id, order_id, sequence)
  );

  CREATE TABLE IF NOT EXISTS idempotency_records (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    location_id TEXT NOT NULL,
    key_hash TEXT NOT NULL,
    request_hash TEXT NOT NULL,
    order_id TEXT NOT NULL,
    response_json TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL,
    FOREIGN KEY(tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY(location_id) REFERENCES locations(id) ON DELETE CASCADE,
    UNIQUE(tenant_id, location_id, key_hash)
  );

  CREATE TABLE IF NOT EXISTS outbox_jobs (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    order_id TEXT NOT NULL,
    event_version INTEGER NOT NULL,
    channel TEXT NOT NULL, -- 'EMAIL', 'TELEGRAM'
    recipient TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'PROCESSING', 'SENT', 'FAILED'
    lease_expires_at TEXT,
    attempts INTEGER NOT NULL DEFAULT 0,
    available_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_error TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY(tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS notification_attempts (
    id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL,
    channel TEXT NOT NULL,
    status TEXT NOT NULL,
    latency_ms INTEGER NOT NULL DEFAULT 0,
    error_summary TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY(job_id) REFERENCES outbox_jobs(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS audit_log (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    actor_id TEXT NOT NULL,
    actor_role TEXT NOT NULL,
    operation TEXT NOT NULL,
    target_entity TEXT NOT NULL,
    target_id TEXT,
    details_json TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY(tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
  );

  -- Recommended Indexes (Section 7)
  CREATE INDEX IF NOT EXISTS idx_orders_active_queue ON orders(tenant_id, location_id, state, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_orders_deadline_pending ON orders(acceptance_deadline, id) WHERE state = 'PENDING_ACCEPTANCE';
  CREATE INDEX IF NOT EXISTS idx_orders_public_ref ON orders(public_ref);
  CREATE INDEX IF NOT EXISTS idx_outbox_due ON outbox_jobs(status, available_at);
  CREATE INDEX IF NOT EXISTS idx_menu_items_loc ON menu_items(tenant_id, location_id, category_id);
`;
