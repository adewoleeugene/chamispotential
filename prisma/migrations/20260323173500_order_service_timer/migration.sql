ALTER TABLE "Order"
ADD COLUMN "serviceStartedAt" TIMESTAMP(3),
ADD COLUMN "serviceEndedAt" TIMESTAMP(3);

UPDATE "Order"
SET "serviceStartedAt" = "createdAt"
WHERE "serviceStartedAt" IS NULL
  AND "status" IN ('payment_pending_confirmation', 'pending', 'preparing', 'ready', 'served', 'completed');

UPDATE "Order"
SET "serviceEndedAt" = "updatedAt"
WHERE "serviceEndedAt" IS NULL
  AND "serviceStartedAt" IS NOT NULL
  AND (
    "paymentStatus" = 'paid'
    OR "status" IN ('completed', 'cancelled')
  );
