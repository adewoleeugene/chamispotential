-- Drop the unused Shift table (no UI/API ever shipped against this model).
ALTER TABLE "Shift" DROP CONSTRAINT IF EXISTS "Shift_userId_fkey";
DROP TABLE IF EXISTS "Shift";

-- Drop the unused avatar column from User.
ALTER TABLE "User" DROP COLUMN IF EXISTS "avatar";
