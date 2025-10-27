PRAGMA foreign_keys = ON;

-- სად ინახება თითო სერვის ჩანაწერის მიმაგრებული ფაილები (PDF ან ფოტოები)
CREATE TABLE IF NOT EXISTS service_files (
  id TEXT PRIMARY KEY,          -- UUID
  service_id TEXT NOT NULL,     -- service_records.id (UUID)
  kind TEXT NOT NULL,           -- 'pdf' | 'image'
  filename TEXT NOT NULL,       -- ორიგინალი სახელი (მაგ: invoice.pdf, photo.jpg)
  r2_key TEXT NOT NULL,         -- R2 შიგნით უნიკალური key (მაგ: services/<sid>/<uuid>.pdf)
  size_bytes INTEGER,           -- ზომა ბაიტებში (სურვილისამებრ)
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (service_id) REFERENCES service_records(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_service_files_by_service ON service_files(service_id);
