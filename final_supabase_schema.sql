-- ============================================================
--  GARMENT ERP — Complete Unified Supabase Schema
--  Paste this entire file into Supabase SQL Editor and run it.
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── 1. Core / Base Tables ──────────────────────────────────
-- Parties
CREATE TABLE IF NOT EXISTS parties (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name           TEXT NOT NULL,
  type           TEXT NOT NULL CHECK (type IN ('mill', 'embroidery', 'handwork', 'khatli', 'stitching', 'other')),
  contact_person TEXT,
  phone          TEXT,
  address        TEXT,
  notes          TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Gray Fabrics
CREATE TABLE IF NOT EXISTS gray_fabrics (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lot_number       TEXT UNIQUE NOT NULL,
  fabric_name      TEXT NOT NULL,
  total_meters     NUMERIC(10,2) NOT NULL CHECK (total_meters > 0),
  available_meters NUMERIC(10,2) NOT NULL CHECK (available_meters >= 0),
  construction_notes TEXT,
  date             DATE,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Buyers
CREATE TABLE IF NOT EXISTS buyers (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name           TEXT NOT NULL,
  contact_person TEXT,
  phone          TEXT,
  email          TEXT,
  address        TEXT,
  gst_number     TEXT,
  notes          TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ── 2. Fabric Processing (Mill Dispatches & Receipts) ───────
CREATE TABLE IF NOT EXISTS mill_dispatches (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fabric_id     UUID NOT NULL REFERENCES gray_fabrics(id),
  party_id      UUID NOT NULL REFERENCES parties(id),
  quantity_sent NUMERIC(10,2) NOT NULL CHECK (quantity_sent > 0),
  quality       TEXT,
  dispatch_date DATE,
  notes         TEXT,
  status        TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'partial', 'completed')),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fabric_receipts (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dispatch_id       UUID NOT NULL REFERENCES mill_dispatches(id) ON DELETE CASCADE,
  received_quantity NUMERIC(10,2) NOT NULL CHECK (received_quantity > 0),
  available_quantity NUMERIC(10,2),
  quality_notes     TEXT,
  received_date     DATE,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS receipt_colors (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  receipt_id UUID NOT NULL REFERENCES fabric_receipts(id) ON DELETE CASCADE,
  color_name TEXT NOT NULL,
  quantity   NUMERIC(10,2) NOT NULL CHECK (quantity > 0),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 3. Sampling & Design ──────────────────────────────────
CREATE TABLE IF NOT EXISTS designs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  design_code     TEXT UNIQUE NOT NULL,
  design_name     TEXT NOT NULL,
  fabric_id       UUID REFERENCES gray_fabrics(id),
  description     TEXT,
  category        TEXT,
  season          TEXT,
  sample_date     DATE,
  status          TEXT NOT NULL DEFAULT 'sampling' CHECK (status IN ('sampling', 'approved', 'rejected', 'production')),
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS design_work (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  design_id   UUID NOT NULL REFERENCES designs(id) ON DELETE CASCADE,
  work_type   TEXT NOT NULL CHECK (work_type IN ('embroidery', 'khatli', 'handwork', 'printing', 'dyeing', 'other')),
  party_id    UUID REFERENCES parties(id),
  rate        NUMERIC(10,2),
  quantity    NUMERIC(10,2),
  unit        TEXT DEFAULT 'piece',
  status      TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'received', 'completed')),
  sent_date   DATE,
  recv_date   DATE,
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS samples (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sample_number     TEXT UNIQUE NOT NULL,
  sample_date       DATE NOT NULL,
  fabric_receipt_id UUID REFERENCES fabric_receipts(id),
  fabric_id         UUID REFERENCES gray_fabrics(id),
  meters            NUMERIC(10,2),
  colors            TEXT,
  color_breakdown   JSONB DEFAULT '[]'::jsonb,
  category          TEXT,
  has_work          BOOLEAN NOT NULL DEFAULT FALSE,
  work_types        TEXT[] DEFAULT '{}',
  work_party_ids    JSONB  DEFAULT '{}',
  photo_url         TEXT,
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ── 4. Production & Costing ───────────────────────────────
CREATE TABLE IF NOT EXISTS production_lots (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lot_number      TEXT UNIQUE NOT NULL,
  design_id       UUID REFERENCES designs(id),
  fabric_id       UUID REFERENCES gray_fabrics(id),
  total_pieces    INTEGER NOT NULL CHECK (total_pieces > 0),
  status          TEXT NOT NULL DEFAULT 'cutting' CHECK (status IN ('cutting', 'stitching', 'finishing', 'qc', 'completed')),
  start_date      DATE,
  target_date     DATE,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS production_stages (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lot_id          UUID NOT NULL REFERENCES production_lots(id) ON DELETE CASCADE,
  stage           TEXT NOT NULL CHECK (stage IN ('cutting', 'stitching', 'finishing', 'qc')),
  party_id        UUID REFERENCES parties(id),
  pieces_in       INTEGER,
  pieces_out      INTEGER,
  pieces_rejected INTEGER DEFAULT 0,
  start_date      DATE,
  end_date        DATE,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lot_costing (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lot_id              UUID NOT NULL REFERENCES production_lots(id) ON DELETE CASCADE,
  fabric_cost_per_m   NUMERIC(10,2),
  fabric_meters_used  NUMERIC(10,2),
  embroidery_cost     NUMERIC(10,2) DEFAULT 0,
  stitching_cost      NUMERIC(10,2) DEFAULT 0,
  finishing_cost      NUMERIC(10,2) DEFAULT 0,
  other_cost          NUMERIC(10,2) DEFAULT 0,
  overhead_pct        NUMERIC(5,2) DEFAULT 10,
  selling_price_avg   NUMERIC(10,2),
  notes               TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS finished_goods (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  design_id   UUID REFERENCES designs(id),
  lot_id      UUID REFERENCES production_lots(id),
  sku         TEXT,
  color       TEXT NOT NULL,
  size        TEXT NOT NULL CHECK (size IN ('XS','S','M','L','XL','XXL','3XL','Free')),
  quantity    INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  mrp         NUMERIC(10,2),
  cost_price  NUMERIC(10,2),
  location    TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── 5. Orders & Challans ──────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_number    TEXT UNIQUE NOT NULL,
  buyer_id        UUID REFERENCES buyers(id),
  order_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  delivery_date   DATE,
  status          TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('draft','confirmed','in_production','ready','dispatched','completed','cancelled')),
  total_amount    NUMERIC(12,2),
  advance_paid    NUMERIC(12,2) DEFAULT 0,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_items (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id    UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  design_id   UUID REFERENCES designs(id),
  color       TEXT,
  size        TEXT,
  quantity    INTEGER NOT NULL,
  rate        NUMERIC(10,2) NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS challans (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  challan_number  TEXT UNIQUE NOT NULL,
  challan_type    TEXT NOT NULL DEFAULT 'dispatch' CHECK (challan_type IN ('dispatch','receipt','return')),
  dispatch_id     UUID REFERENCES mill_dispatches(id),
  order_id        UUID REFERENCES orders(id),
  party_id        UUID REFERENCES parties(id),
  buyer_id        UUID REFERENCES buyers(id),
  challan_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  vehicle_number  TEXT,
  driver_name     TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS challan_items (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  challan_id  UUID NOT NULL REFERENCES challans(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity    NUMERIC(10,2) NOT NULL,
  unit        TEXT DEFAULT 'meters',
  rate        NUMERIC(10,2),
  amount      NUMERIC(10,2),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Indexes ───────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_dispatches_fabric ON mill_dispatches(fabric_id);
CREATE INDEX IF NOT EXISTS idx_dispatches_party  ON mill_dispatches(party_id);
CREATE INDEX IF NOT EXISTS idx_dispatches_status ON mill_dispatches(status);
CREATE INDEX IF NOT EXISTS idx_receipts_dispatch ON fabric_receipts(dispatch_id);
CREATE INDEX IF NOT EXISTS idx_colors_receipt    ON receipt_colors(receipt_id);
CREATE INDEX IF NOT EXISTS idx_design_work_design   ON design_work(design_id);
CREATE INDEX IF NOT EXISTS idx_design_work_party    ON design_work(party_id);
CREATE INDEX IF NOT EXISTS idx_samples_receipt      ON samples(fabric_receipt_id);
CREATE INDEX IF NOT EXISTS idx_prod_stages_lot      ON production_stages(lot_id);
CREATE INDEX IF NOT EXISTS idx_finished_design      ON finished_goods(design_id);
CREATE INDEX IF NOT EXISTS idx_finished_lot         ON finished_goods(lot_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order    ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_lot_costing_lot      ON lot_costing(lot_id);
CREATE INDEX IF NOT EXISTS idx_challans_dispatch    ON challans(dispatch_id);
CREATE INDEX IF NOT EXISTS idx_challans_order       ON challans(order_id);
CREATE INDEX IF NOT EXISTS idx_challan_items_ch     ON challan_items(challan_id);

-- ── Updated_at Function ───────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

-- ── Updated_at Triggers ───────────────────────────────────
CREATE TRIGGER trg_fabrics_updated    BEFORE UPDATE ON gray_fabrics    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_dispatches_updated BEFORE UPDATE ON mill_dispatches FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_designs_updated         BEFORE UPDATE ON designs           FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_samples_updated         BEFORE UPDATE ON samples           FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_prod_lots_updated       BEFORE UPDATE ON production_lots   FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_finished_goods_updated  BEFORE UPDATE ON finished_goods    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_orders_updated          BEFORE UPDATE ON orders            FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_lot_costing_updated     BEFORE UPDATE ON lot_costing       FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── RLS (Row Level Security) ──────────────────────────────
ALTER TABLE gray_fabrics    ENABLE ROW LEVEL SECURITY;
ALTER TABLE parties         ENABLE ROW LEVEL SECURITY;
ALTER TABLE mill_dispatches ENABLE ROW LEVEL SECURITY;
ALTER TABLE fabric_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipt_colors  ENABLE ROW LEVEL SECURITY;
ALTER TABLE designs             ENABLE ROW LEVEL SECURITY;
ALTER TABLE design_work         ENABLE ROW LEVEL SECURITY;
ALTER TABLE samples             ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_lots     ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_stages   ENABLE ROW LEVEL SECURITY;
ALTER TABLE finished_goods      ENABLE ROW LEVEL SECURITY;
ALTER TABLE buyers              ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders              ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items         ENABLE ROW LEVEL SECURITY;
ALTER TABLE lot_costing         ENABLE ROW LEVEL SECURITY;
ALTER TABLE challans            ENABLE ROW LEVEL SECURITY;
ALTER TABLE challan_items       ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all_gray_fabrics"    ON gray_fabrics    FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_parties"         ON parties         FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_dispatches"      ON mill_dispatches FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_receipts"        ON fabric_receipts FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_receipt_colors"  ON receipt_colors  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_designs"          ON designs           FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_design_work"      ON design_work       FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_samples"          ON samples           FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_prod_lots"        ON production_lots   FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_prod_stages"      ON production_stages FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_finished_goods"   ON finished_goods    FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_buyers"           ON buyers            FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_orders"           ON orders            FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_order_items"      ON order_items       FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_lot_costing"      ON lot_costing       FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_challans"         ON challans          FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_challan_items"    ON challan_items     FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── Storage Bucket for Sample Photos ───────────────────────
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('sample-photos', 'sample-photos', true)
-- ON CONFLICT (id) DO NOTHING;

-- Storage RLS Policies
-- CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'sample-photos');
-- CREATE POLICY "Auth Upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'sample-photos');
-- CREATE POLICY "Auth Update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'sample-photos');
-- CREATE POLICY "Auth Delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'sample-photos');

-- ============================================================
-- DONE!
-- ============================================================
