PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS service_records (
  id TEXT PRIMARY KEY,                 -- UUID
  customer_id TEXT NOT NULL,           -- customers.id
  date_iso TEXT NOT NULL,              -- YYYY-MM-DD
  purpose TEXT NOT NULL,               -- cleaning | diagnostics | head_repair | device_repair | filters | other
  price_gel REAL DEFAULT 0,
  technician TEXT,                     -- Niko | Vakho | Niko/Vakho
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_service_records_customer ON service_records(customer_id);
CREATE INDEX IF NOT EXISTS idx_service_records_date ON service_records(date_iso DESC);
