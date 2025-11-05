PRAGMA foreign_keys = ON;

-- appusers: მომხმარებელთა ცხრილი (ადმინი/ტექნიკოსი/კლიენტი/მნახველი)
CREATE TABLE IF NOT EXISTS appusers (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT    NOT NULL UNIQUE, -- კლიენტისთვის: customers.ident_code
  password_hash TEXT    NOT NULL,        -- bcrypt ჰეში
  role          TEXT    NOT NULL,        -- 'admin' | 'technician' | 'customer' | 'viewer'
  customer_id   TEXT,                    -- customers.id (მხოლოდ კლიენტისთვის)
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT                     -- <- საჭიროა API-ში შეცვლებისას
);

-- ხშირად გამოყენებადი ინდექსები
CREATE INDEX IF NOT EXISTS idx_appusers_role     ON appusers(role);
CREATE INDEX IF NOT EXISTS idx_appusers_customer ON appusers(customer_id);
