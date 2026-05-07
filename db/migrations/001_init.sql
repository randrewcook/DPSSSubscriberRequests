CREATE TABLE IF NOT EXISTS admin_users (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subscription_requests (
  id BIGSERIAL PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('New', 'In Review', 'Complete', 'Rejected')),
  flow_type TEXT NOT NULL CHECK (flow_type IN ('existing', 'new')),
  region TEXT NOT NULL CHECK (region IN ('USA', 'Canada', 'EU', 'Australia', 'Other')),
  subscriber_id UUID NULL,
  client_id TEXT NULL,
  client_secret_masked TEXT NULL,
  company_name TEXT NULL,
  phone_number TEXT NULL,
  company_address TEXT NULL,
  first_name TEXT NULL,
  last_name TEXT NULL,
  email TEXT NULL,
  sponsor_name TEXT NULL,
  sponsor_email TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS request_product_selections (
  id BIGSERIAL PRIMARY KEY,
  request_id BIGINT NOT NULL REFERENCES subscription_requests(id) ON DELETE CASCADE,
  data_product_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS request_product_tenants (
  id BIGSERIAL PRIMARY KEY,
  request_id BIGINT NOT NULL REFERENCES subscription_requests(id) ON DELETE CASCADE,
  data_product_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS request_status_history (
  id BIGSERIAL PRIMARY KEY,
  request_id BIGINT NOT NULL REFERENCES subscription_requests(id) ON DELETE CASCADE,
  old_status TEXT NULL,
  new_status TEXT NOT NULL CHECK (new_status IN ('New', 'In Review', 'Complete', 'Rejected')),
  changed_by TEXT NOT NULL,
  notes TEXT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS data_product_exclusions (
  id BIGSERIAL PRIMARY KEY,
  data_product_id TEXT NOT NULL UNIQUE,
  reason TEXT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscription_requests_status ON subscription_requests(status);
CREATE INDEX IF NOT EXISTS idx_request_product_tenants_request_id ON request_product_tenants(request_id);
CREATE INDEX IF NOT EXISTS idx_request_status_history_request_id ON request_status_history(request_id);
