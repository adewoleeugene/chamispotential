-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "kitchenNote" TEXT;

-- CreateTable
CREATE TABLE "MenuItemExtraOption" (
    "id" TEXT NOT NULL,
    "menuItemId" TEXT NOT NULL,
    "inventoryId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "quantityUsed" DOUBLE PRECISION NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MenuItemExtraOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItemRemoval" (
    "id" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "recipeIngredientId" TEXT NOT NULL,
    "inventoryId" TEXT NOT NULL,
    "labelSnapshot" TEXT NOT NULL,
    "quantityUsed" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderItemRemoval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItemAddition" (
    "id" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "menuItemExtraOptionId" TEXT,
    "inventoryId" TEXT NOT NULL,
    "labelSnapshot" TEXT NOT NULL,
    "quantityUsed" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderItemAddition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MenuItemExtraOption_menuItemId_sortOrder_idx" ON "MenuItemExtraOption"("menuItemId", "sortOrder");

-- CreateIndex
CREATE INDEX "OrderItemRemoval_orderItemId_idx" ON "OrderItemRemoval"("orderItemId");

-- CreateIndex
CREATE INDEX "OrderItemAddition_orderItemId_idx" ON "OrderItemAddition"("orderItemId");

-- AddForeignKey
ALTER TABLE "MenuItemExtraOption" ADD CONSTRAINT "MenuItemExtraOption_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuItemExtraOption" ADD CONSTRAINT "MenuItemExtraOption_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "Inventory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItemRemoval" ADD CONSTRAINT "OrderItemRemoval_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItemRemoval" ADD CONSTRAINT "OrderItemRemoval_recipeIngredientId_fkey" FOREIGN KEY ("recipeIngredientId") REFERENCES "RecipeIngredient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItemAddition" ADD CONSTRAINT "OrderItemAddition_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItemAddition" ADD CONSTRAINT "OrderItemAddition_menuItemExtraOptionId_fkey" FOREIGN KEY ("menuItemExtraOptionId") REFERENCES "MenuItemExtraOption"("id") ON DELETE SET NULL ON UPDATE CASCADE;
