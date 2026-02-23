-- CreateTable
CREATE TABLE "FeishuUser" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "openId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeishuUser_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FeishuUser_name_key" ON "FeishuUser"("name");
