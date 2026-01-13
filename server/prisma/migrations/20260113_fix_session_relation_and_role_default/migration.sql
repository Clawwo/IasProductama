-- Add missing foreign key from Session to User
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'Session'
      AND c.conname = 'Session_userId_fkey'
  ) THEN
    ALTER TABLE "Session"
    ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Ensure role has default PETUGAS
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'PETUGAS';
