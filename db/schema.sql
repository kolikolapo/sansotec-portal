PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,           -- ხელით ჩაწერადი, მხოლოდ ციფრები
  name TEXT NOT NULL,            -- დასახელება
  ident_code TEXT NOT NULL,      -- საიდენტიფიკაციო (კლიენტის username)
  salon_name TEXT,
  address TEXT,
  phone TEXT,
  contact_person TEXT,
  device TEXT,
  device_sn TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_ident ON customers(ident_code);
