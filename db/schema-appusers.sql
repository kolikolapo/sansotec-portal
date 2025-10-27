PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS appusers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,      -- კლიენტის username = customers.ident_code
  password_hash TEXT NOT NULL,        -- bcrypt ჰაში
  role TEXT NOT NULL,                 -- 'customer' (შემდგომში admin/technician/viewer)
  customer_id TEXT,                   -- customers.id, მხოლოდ კლიენტისთვის
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_appusers_role ON appusers(role);
CREATE INDEX IF NOT EXISTS idx_appusers_customer ON appusers(customer_id);
