ALTER TABLE "Order"
ADD COLUMN "kitchenStartedAt" TIMESTAMP(3);

UPDATE "Order"
SET "kitchenStartedAt" = "createdAt"
WHERE "kitchenStartedAt" IS NULL
  AND "status" IN ('preparing', 'ready', 'served', 'completed');
