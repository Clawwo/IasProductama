-- Add transaction code columns
ALTER TABLE "Inbound" ADD COLUMN IF NOT EXISTS "code" TEXT;
ALTER TABLE "Outbound" ADD COLUMN IF NOT EXISTS "code" TEXT;

-- Backfill inbound codes with daily sequence
WITH numbered AS (
  SELECT
    id,
    to_char(date, 'YYYYMMDD') AS day_key,
    ROW_NUMBER() OVER (PARTITION BY date::date ORDER BY "createdAt" NULLS LAST, id) AS rn
  FROM "Inbound"
)
UPDATE "Inbound" i
SET code = 'IN-' || n.day_key || '-' || LPAD(n.rn::text, 4, '0')
FROM numbered n
WHERE i.id = n.id AND (i.code IS NULL OR i.code = '');

-- Backfill outbound codes with daily sequence
WITH numbered AS (
  SELECT
    id,
    to_char(date, 'YYYYMMDD') AS day_key,
    ROW_NUMBER() OVER (PARTITION BY date::date ORDER BY "createdAt" NULLS LAST, id) AS rn
  FROM "Outbound"
)
UPDATE "Outbound" o
SET code = 'OUT-' || n.day_key || '-' || LPAD(n.rn::text, 4, '0')
FROM numbered n
WHERE o.id = n.id AND (o.code IS NULL OR o.code = '');

-- Enforce constraints
ALTER TABLE "Inbound" ALTER COLUMN "code" SET NOT NULL;
ALTER TABLE "Outbound" ALTER COLUMN "code" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "Inbound_code_key" ON "Inbound" ("code");
CREATE UNIQUE INDEX IF NOT EXISTS "Outbound_code_key" ON "Outbound" ("code");
