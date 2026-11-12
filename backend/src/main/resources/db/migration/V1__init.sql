-- Open CRM initial schema
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ========== USERS & AUTH ==========
CREATE TABLE users (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email               VARCHAR(255) NOT NULL UNIQUE,
    password_hash       VARCHAR(100) NOT NULL,
    full_name           VARCHAR(150) NOT NULL,
    phone               VARCHAR(30),
    role                VARCHAR(20)  NOT NULL CHECK (role IN ('ADMIN','SUPPORT_AGENT','FIELD_STAFF')),
    preferred_language  VARCHAR(5)   NOT NULL DEFAULT 'en' CHECK (preferred_language IN ('en','te')),
    active              BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE refresh_tokens (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash   VARCHAR(64) NOT NULL UNIQUE,
    device_name  VARCHAR(100),
    expires_at   TIMESTAMPTZ NOT NULL,
    revoked_at   TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);

-- ========== CUSTOMERS ==========
CREATE TABLE customers (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          VARCHAR(150) NOT NULL,
    company       VARCHAR(150),
    email         VARCHAR(255),
    phone         VARCHAR(30),
    address_line  VARCHAR(255),
    city          VARCHAR(100),
    state         VARCHAR(100),
    postal_code   VARCHAR(20),
    country       VARCHAR(100) DEFAULT 'India',
    latitude      NUMERIC(9,6) CHECK (latitude  BETWEEN -90  AND 90),
    longitude     NUMERIC(9,6) CHECK (longitude BETWEEN -180 AND 180),
    location      GEOGRAPHY(Point, 4326) GENERATED ALWAYS AS (
                    CASE WHEN latitude IS NOT NULL AND longitude IS NOT NULL
                         THEN ST_SetSRID(ST_MakePoint(longitude::float8, latitude::float8), 4326)::geography
                    END) STORED,
    notes         TEXT,
    owner_id      UUID REFERENCES users(id) ON DELETE SET NULL,
    created_by    UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at    TIMESTAMPTZ,
    version       BIGINT NOT NULL DEFAULT 0,
    CHECK ((latitude IS NULL) = (longitude IS NULL))
);
CREATE INDEX idx_customers_location   ON customers USING GIST (location);
CREATE INDEX idx_customers_name_trgm  ON customers USING GIN (lower(name) gin_trgm_ops);
CREATE INDEX idx_customers_phone      ON customers(phone);
CREATE INDEX idx_customers_updated_at ON customers(updated_at);
CREATE INDEX idx_customers_owner      ON customers(owner_id);

-- ========== LEADS & DEALS ==========
CREATE TABLE leads (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                   VARCHAR(150) NOT NULL,
    company                VARCHAR(150),
    email                  VARCHAR(255),
    phone                  VARCHAR(30),
    source                 VARCHAR(30) CHECK (source IN ('WEBSITE','REFERRAL','WALK_IN','PHONE','CAMPAIGN','OTHER')),
    status                 VARCHAR(20) NOT NULL DEFAULT 'NEW'
                             CHECK (status IN ('NEW','CONTACTED','QUALIFIED','UNQUALIFIED','CONVERTED')),
    converted_customer_id  UUID REFERENCES customers(id) ON DELETE SET NULL,
    owner_id               UUID REFERENCES users(id) ON DELETE SET NULL,
    notes                  TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ,
    version    BIGINT NOT NULL DEFAULT 0
);
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_owner  ON leads(owner_id);

CREATE TABLE deals (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id          UUID NOT NULL REFERENCES customers(id),
    title                VARCHAR(200) NOT NULL,
    amount               NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
    currency             VARCHAR(3) NOT NULL DEFAULT 'INR',
    stage                VARCHAR(20) NOT NULL DEFAULT 'PROSPECTING'
                           CHECK (stage IN ('PROSPECTING','PROPOSAL','NEGOTIATION','WON','LOST')),
    expected_close_date  DATE,
    closed_at            TIMESTAMPTZ,
    owner_id             UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ,
    version    BIGINT NOT NULL DEFAULT 0
);
CREATE INDEX idx_deals_customer ON deals(customer_id);
CREATE INDEX idx_deals_stage    ON deals(stage);

-- ========== FOLLOW-UP REMINDERS ==========
CREATE TABLE reminders (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title         VARCHAR(200) NOT NULL,
    description   TEXT,
    due_at        TIMESTAMPTZ NOT NULL,
    status        VARCHAR(15) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','DONE','CANCELLED')),
    assigned_to   UUID NOT NULL REFERENCES users(id),
    customer_id   UUID REFERENCES customers(id) ON DELETE CASCADE,
    lead_id       UUID REFERENCES leads(id)     ON DELETE CASCADE,
    deal_id       UUID REFERENCES deals(id)     ON DELETE CASCADE,
    completed_at  TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ,
    version    BIGINT NOT NULL DEFAULT 0,
    CHECK (num_nonnulls(customer_id, lead_id, deal_id) <= 1)
);
CREATE INDEX idx_reminders_due ON reminders(assigned_to, status, due_at);

-- ========== SUPPORT TICKETS ==========
CREATE TABLE tickets (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_number  BIGINT GENERATED ALWAYS AS IDENTITY UNIQUE,
    customer_id    UUID NOT NULL REFERENCES customers(id),
    subject        VARCHAR(200) NOT NULL,
    description    TEXT,
    status         VARCHAR(15) NOT NULL DEFAULT 'OPEN'
                     CHECK (status IN ('OPEN','IN_PROGRESS','ON_HOLD','RESOLVED','CLOSED')),
    priority       VARCHAR(10) NOT NULL DEFAULT 'MEDIUM' CHECK (priority IN ('LOW','MEDIUM','HIGH','URGENT')),
    assigned_to    UUID REFERENCES users(id) ON DELETE SET NULL,
    created_by     UUID REFERENCES users(id) ON DELETE SET NULL,
    resolved_at    TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ,
    version    BIGINT NOT NULL DEFAULT 0
);
CREATE INDEX idx_tickets_status   ON tickets(status, priority);
CREATE INDEX idx_tickets_assignee ON tickets(assigned_to);
CREATE INDEX idx_tickets_customer ON tickets(customer_id);

CREATE TABLE ticket_comments (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id   UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    author_id   UUID REFERENCES users(id) ON DELETE SET NULL,
    body        TEXT NOT NULL,
    internal    BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ticket_comments_ticket ON ticket_comments(ticket_id);

CREATE TABLE ticket_status_history (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ticket_id    UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    from_status  VARCHAR(15),
    to_status    VARCHAR(15) NOT NULL,
    changed_by   UUID REFERENCES users(id) ON DELETE SET NULL,
    changed_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ticket_history_ticket ON ticket_status_history(ticket_id);

-- ========== FIELD VISITS (offline-first) ==========
CREATE TABLE field_visits (
    id           UUID PRIMARY KEY,
    customer_id  UUID NOT NULL REFERENCES customers(id),
    user_id      UUID NOT NULL REFERENCES users(id),
    visited_at   TIMESTAMPTZ NOT NULL,
    latitude     NUMERIC(9,6),
    longitude    NUMERIC(9,6),
    outcome      VARCHAR(20) CHECK (outcome IN ('MET','NOT_AVAILABLE','RESCHEDULED','ORDER_TAKEN','ISSUE_REPORTED')),
    notes        TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at   TIMESTAMPTZ,
    version      BIGINT NOT NULL DEFAULT 0
);
CREATE INDEX idx_visits_user_time ON field_visits(user_id, visited_at DESC);
CREATE INDEX idx_visits_customer  ON field_visits(customer_id);

-- ========== OFFLINE SYNC SAFETY ==========
CREATE TABLE processed_mutations (
    mutation_id   UUID PRIMARY KEY,
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    entity_type   VARCHAR(30) NOT NULL,
    entity_id     UUID NOT NULL,
    processed_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
