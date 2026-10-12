-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'INVITED');

-- CreateEnum
CREATE TYPE "MembershipRole" AS ENUM ('ADMIN', 'EDITOR', 'VIEWER');

-- CreateEnum
CREATE TYPE "BakeryStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "TaxpayerType" AS ENUM ('TCP', 'MIPYME', 'NON_AGRICULTURAL_COOPERATIVE', 'OTHER', 'UNCONFIRMED');

-- CreateEnum
CREATE TYPE "MeasurementDimension" AS ENUM ('MASS', 'VOLUME', 'COUNT', 'TIME', 'LENGTH', 'AREA', 'ENERGY', 'OTHER');

-- CreateEnum
CREATE TYPE "MaterialKind" AS ENUM ('INGREDIENT', 'PACKAGING', 'CONSUMABLE', 'FUEL', 'OTHER');

-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "RecipeVersionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "OverheadCategory" AS ENUM ('ELECTRICITY', 'WATER', 'FUEL', 'RENT', 'MAINTENANCE', 'DEPRECIATION', 'TRANSPORT', 'TELECOMMUNICATIONS', 'OTHER');

-- CreateEnum
CREATE TYPE "AllocationMethod" AS ENUM ('LABOR_HOURS', 'BATCHES', 'OUTPUT_QUANTITY', 'DIRECT_COST_PROPORTION');

-- CreateEnum
CREATE TYPE "TaxCategory" AS ENUM ('SALES', 'PROFIT_OR_INCOME', 'LABOR', 'PURCHASE', 'OTHER');

-- CreateEnum
CREATE TYPE "TaxCalculationMethod" AS ENUM ('PERCENT_OF_BASE', 'FIXED_AMOUNT', 'PROGRESSIVE_BRACKETS', 'EXEMPTION');

-- CreateEnum
CREATE TYPE "TaxBase" AS ENUM ('NET_SALES', 'PROFIT_BEFORE_PROFIT_TAX', 'GROSS_SALES', 'LABOR_REMUNERATION', 'TAXABLE_INCOME', 'PURCHASE_VALUE', 'OTHER');

-- CreateEnum
CREATE TYPE "TaxRuleVerificationStatus" AS ENUM ('PENDING_VALIDATION', 'VERIFIED', 'REJECTED', 'RETIRED');

-- CreateEnum
CREATE TYPE "CostCalculationStatus" AS ENUM ('COMPLETE', 'INCOMPLETE', 'FAILED');

-- CreateEnum
CREATE TYPE "CalculationLineType" AS ENUM ('MATERIAL', 'LABOR', 'OVERHEAD', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "PriceTaxTreatment" AS ENUM ('TAX_EXCLUDED_FROM_PRICE', 'TAX_INCLUDED_IN_PRICE', 'NOT_CONFIGURED');

-- CreateEnum
CREATE TYPE "PriceScenarioStatus" AS ENUM ('DRAFT', 'CALCULATED', 'INCOMPLETE', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "emailNormalized" VARCHAR(320) NOT NULL,
    "passwordHash" VARCHAR(255) NOT NULL,
    "displayName" VARCHAR(160) NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "isPlatformAdmin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bakery" (
    "id" UUID NOT NULL,
    "name" VARCHAR(180) NOT NULL,
    "status" "BakeryStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Bakery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "userId" UUID NOT NULL,
    "bakeryId" UUID NOT NULL,
    "role" "MembershipRole" NOT NULL DEFAULT 'VIEWER',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("userId","bakeryId")
);

-- CreateTable
CREATE TABLE "FiscalProfileVersion" (
    "id" UUID NOT NULL,
    "bakeryId" UUID NOT NULL,
    "taxpayerType" "TaxpayerType" NOT NULL DEFAULT 'UNCONFIRMED',
    "taxId" VARCHAR(64),
    "activityCode" VARCHAR(64),
    "legalName" VARCHAR(240),
    "province" VARCHAR(120),
    "municipality" VARCHAR(120),
    "validFrom" DATE NOT NULL,
    "validTo" DATE,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FiscalProfileVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeasurementUnit" (
    "id" UUID NOT NULL,
    "code" VARCHAR(32) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "dimension" "MeasurementDimension" NOT NULL,
    "conversionFactor" DECIMAL(20,10) NOT NULL,
    "isCanonical" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "MeasurementUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Material" (
    "id" UUID NOT NULL,
    "bakeryId" UUID NOT NULL,
    "name" VARCHAR(180) NOT NULL,
    "kind" "MaterialKind" NOT NULL DEFAULT 'INGREDIENT',
    "baseUnitId" UUID NOT NULL,
    "densityGramPerMl" DECIMAL(18,8),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Material_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialPrice" (
    "id" UUID NOT NULL,
    "bakeryId" UUID NOT NULL,
    "materialId" UUID NOT NULL,
    "packagePriceCUP" DECIMAL(18,2) NOT NULL,
    "packageQuantity" DECIMAL(18,6) NOT NULL,
    "packageUnitId" UUID NOT NULL,
    "effectiveFrom" DATE NOT NULL,
    "effectiveTo" DATE,
    "sourceNote" VARCHAR(500),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaterialPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" UUID NOT NULL,
    "bakeryId" UUID NOT NULL,
    "name" VARCHAR(180) NOT NULL,
    "description" TEXT,
    "salesUnitId" UUID NOT NULL,
    "status" "ProductStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeVersion" (
    "id" UUID NOT NULL,
    "bakeryId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "status" "RecipeVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "outputQuantity" DECIMAL(18,6) NOT NULL,
    "outputUnitId" UUID NOT NULL,
    "effectiveFrom" DATE,
    "effectiveTo" DATE,
    "preparationNotes" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "RecipeVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeMaterial" (
    "id" UUID NOT NULL,
    "bakeryId" UUID NOT NULL,
    "recipeVersionId" UUID NOT NULL,
    "materialId" UUID NOT NULL,
    "quantity" DECIMAL(18,6) NOT NULL,
    "unitId" UUID NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "notes" VARCHAR(500),

    CONSTRAINT "RecipeMaterial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LaborRole" (
    "id" UUID NOT NULL,
    "bakeryId" UUID NOT NULL,
    "name" VARCHAR(140) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "LaborRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LaborRate" (
    "id" UUID NOT NULL,
    "bakeryId" UUID NOT NULL,
    "laborRoleId" UUID NOT NULL,
    "hourlyRateCUP" DECIMAL(18,2) NOT NULL,
    "effectiveFrom" DATE NOT NULL,
    "effectiveTo" DATE,
    "notes" VARCHAR(500),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LaborRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeLaborOperation" (
    "id" UUID NOT NULL,
    "bakeryId" UUID NOT NULL,
    "recipeVersionId" UUID NOT NULL,
    "laborRoleId" UUID NOT NULL,
    "operationName" VARCHAR(160) NOT NULL,
    "durationMinutes" DECIMAL(12,4) NOT NULL,
    "workersCount" DECIMAL(10,3) NOT NULL DEFAULT 1,
    "position" INTEGER NOT NULL DEFAULT 0,
    "notes" VARCHAR(500),

    CONSTRAINT "RecipeLaborOperation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OverheadExpense" (
    "id" UUID NOT NULL,
    "bakeryId" UUID NOT NULL,
    "name" VARCHAR(180) NOT NULL,
    "category" "OverheadCategory" NOT NULL DEFAULT 'OTHER',
    "amountCUP" DECIMAL(18,2) NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "allocationMethod" "AllocationMethod" NOT NULL,
    "allocationBaseQuantity" DECIMAL(18,6),
    "allocationUnitId" UUID,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "OverheadExpense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxRule" (
    "id" UUID NOT NULL,
    "code" VARCHAR(80) NOT NULL,
    "name" VARCHAR(180) NOT NULL,
    "category" "TaxCategory" NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaxRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxRuleVersion" (
    "id" UUID NOT NULL,
    "taxRuleId" UUID NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "calculationMethod" "TaxCalculationMethod" NOT NULL,
    "taxBase" "TaxBase" NOT NULL,
    "rate" DECIMAL(9,6),
    "fixedAmountCUP" DECIMAL(18,2),
    "effectiveFrom" DATE,
    "effectiveTo" DATE,
    "verificationStatus" "TaxRuleVerificationStatus" NOT NULL DEFAULT 'PENDING_VALIDATION',
    "legalReference" VARCHAR(500),
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaxRuleVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxBracket" (
    "id" UUID NOT NULL,
    "taxRuleVersionId" UUID NOT NULL,
    "lowerBoundCUP" DECIMAL(18,2) NOT NULL,
    "upperBoundCUP" DECIMAL(18,2),
    "marginalRate" DECIMAL(9,6) NOT NULL,
    "fixedDeductionCUP" DECIMAL(18,2) NOT NULL DEFAULT 0,

    CONSTRAINT "TaxBracket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BakeryTaxRule" (
    "id" UUID NOT NULL,
    "bakeryId" UUID NOT NULL,
    "taxRuleId" UUID NOT NULL,
    "taxRuleVersionId" UUID NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "effectiveFrom" DATE,
    "effectiveTo" DATE,
    "configurationNotes" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BakeryTaxRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CostCalculation" (
    "id" UUID NOT NULL,
    "bakeryId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "recipeVersionId" UUID NOT NULL,
    "createdByUserId" UUID,
    "valuationDate" DATE NOT NULL,
    "status" "CostCalculationStatus" NOT NULL DEFAULT 'INCOMPLETE',
    "materialCostCUP" DECIMAL(18,2),
    "laborCostCUP" DECIMAL(18,2),
    "overheadCostCUP" DECIMAL(18,2),
    "totalProductionCostCUP" DECIMAL(18,2),
    "outputQuantity" DECIMAL(18,6),
    "outputUnitSnapshot" VARCHAR(32),
    "unitCostCUP" DECIMAL(18,6),
    "incompleteReasons" JSONB,
    "inputSnapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CostCalculation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalculationLine" (
    "id" UUID NOT NULL,
    "bakeryId" UUID NOT NULL,
    "calculationId" UUID NOT NULL,
    "lineType" "CalculationLineType" NOT NULL,
    "descriptionSnapshot" VARCHAR(240) NOT NULL,
    "quantity" DECIMAL(18,6),
    "unitNameSnapshot" VARCHAR(32),
    "unitCostCUP" DECIMAL(18,6),
    "totalCUP" DECIMAL(18,2),
    "detailsSnapshot" JSONB,

    CONSTRAINT "CalculationLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceScenario" (
    "id" UUID NOT NULL,
    "bakeryId" UUID NOT NULL,
    "calculationId" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "status" "PriceScenarioStatus" NOT NULL DEFAULT 'DRAFT',
    "salePriceCUP" DECIMAL(18,2) NOT NULL,
    "projectedQuantity" DECIMAL(18,6) NOT NULL,
    "salePriceTaxTreatment" "PriceTaxTreatment" NOT NULL DEFAULT 'NOT_CONFIGURED',
    "discountsReturnsCUP" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "grossSalesCUP" DECIMAL(18,2),
    "netSalesCUP" DECIMAL(18,2),
    "costOfSalesCUP" DECIMAL(18,2),
    "otherOperatingExpensesCUP" DECIMAL(18,2),
    "salesTaxCUP" DECIMAL(18,2),
    "profitBeforeProfitTaxCUP" DECIMAL(18,2),
    "profitTaxCUP" DECIMAL(18,2),
    "profitAfterTaxCUP" DECIMAL(18,2),
    "netMarginPercent" DECIMAL(9,4),
    "calculationSnapshot" JSONB,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "PriceScenario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScenarioTaxLine" (
    "id" UUID NOT NULL,
    "bakeryId" UUID NOT NULL,
    "scenarioId" UUID NOT NULL,
    "bakeryTaxRuleId" UUID NOT NULL,
    "taxRuleVersionId" UUID NOT NULL,
    "taxNameSnapshot" VARCHAR(180) NOT NULL,
    "taxBaseSnapshot" "TaxBase" NOT NULL,
    "baseAmountCUP" DECIMAL(18,2),
    "rateApplied" DECIMAL(9,6),
    "taxAmountCUP" DECIMAL(18,2),
    "verificationStatusSnapshot" "TaxRuleVerificationStatus" NOT NULL,
    "notesSnapshot" TEXT,

    CONSTRAINT "ScenarioTaxLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_emailNormalized_key" ON "User"("emailNormalized");

-- CreateIndex
CREATE INDEX "User_status_idx" ON "User"("status");

-- CreateIndex
CREATE INDEX "Bakery_status_name_idx" ON "Bakery"("status", "name");

-- CreateIndex
CREATE INDEX "Membership_bakeryId_role_status_idx" ON "Membership"("bakeryId", "role", "status");

-- CreateIndex
CREATE INDEX "FiscalProfileVersion_bakeryId_validFrom_idx" ON "FiscalProfileVersion"("bakeryId", "validFrom");

-- CreateIndex
CREATE UNIQUE INDEX "FiscalProfileVersion_id_bakeryId_key" ON "FiscalProfileVersion"("id", "bakeryId");

-- CreateIndex
CREATE UNIQUE INDEX "MeasurementUnit_code_key" ON "MeasurementUnit"("code");

-- CreateIndex
CREATE INDEX "MeasurementUnit_dimension_isActive_idx" ON "MeasurementUnit"("dimension", "isActive");

-- CreateIndex
CREATE INDEX "Material_bakeryId_isActive_name_idx" ON "Material"("bakeryId", "isActive", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Material_id_bakeryId_key" ON "Material"("id", "bakeryId");

-- CreateIndex
CREATE UNIQUE INDEX "Material_bakeryId_name_key" ON "Material"("bakeryId", "name");

-- CreateIndex
CREATE INDEX "MaterialPrice_bakeryId_materialId_effectiveFrom_idx" ON "MaterialPrice"("bakeryId", "materialId", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "MaterialPrice_id_bakeryId_key" ON "MaterialPrice"("id", "bakeryId");

-- CreateIndex
CREATE UNIQUE INDEX "MaterialPrice_bakeryId_materialId_effectiveFrom_key" ON "MaterialPrice"("bakeryId", "materialId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "Product_bakeryId_status_name_idx" ON "Product"("bakeryId", "status", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Product_id_bakeryId_key" ON "Product"("id", "bakeryId");

-- CreateIndex
CREATE UNIQUE INDEX "Product_bakeryId_name_key" ON "Product"("bakeryId", "name");

-- CreateIndex
CREATE INDEX "RecipeVersion_bakeryId_productId_status_idx" ON "RecipeVersion"("bakeryId", "productId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "RecipeVersion_id_bakeryId_key" ON "RecipeVersion"("id", "bakeryId");

-- CreateIndex
CREATE UNIQUE INDEX "RecipeVersion_bakeryId_productId_versionNumber_key" ON "RecipeVersion"("bakeryId", "productId", "versionNumber");

-- CreateIndex
CREATE INDEX "RecipeMaterial_bakeryId_recipeVersionId_position_idx" ON "RecipeMaterial"("bakeryId", "recipeVersionId", "position");

-- CreateIndex
CREATE INDEX "RecipeMaterial_bakeryId_materialId_idx" ON "RecipeMaterial"("bakeryId", "materialId");

-- CreateIndex
CREATE INDEX "LaborRole_bakeryId_isActive_idx" ON "LaborRole"("bakeryId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "LaborRole_id_bakeryId_key" ON "LaborRole"("id", "bakeryId");

-- CreateIndex
CREATE UNIQUE INDEX "LaborRole_bakeryId_name_key" ON "LaborRole"("bakeryId", "name");

-- CreateIndex
CREATE INDEX "LaborRate_bakeryId_laborRoleId_effectiveFrom_idx" ON "LaborRate"("bakeryId", "laborRoleId", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "LaborRate_id_bakeryId_key" ON "LaborRate"("id", "bakeryId");

-- CreateIndex
CREATE UNIQUE INDEX "LaborRate_bakeryId_laborRoleId_effectiveFrom_key" ON "LaborRate"("bakeryId", "laborRoleId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "RecipeLaborOperation_bakeryId_recipeVersionId_position_idx" ON "RecipeLaborOperation"("bakeryId", "recipeVersionId", "position");

-- CreateIndex
CREATE INDEX "OverheadExpense_bakeryId_periodStart_periodEnd_idx" ON "OverheadExpense"("bakeryId", "periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "OverheadExpense_bakeryId_category_idx" ON "OverheadExpense"("bakeryId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "OverheadExpense_id_bakeryId_key" ON "OverheadExpense"("id", "bakeryId");

-- CreateIndex
CREATE UNIQUE INDEX "TaxRule_code_key" ON "TaxRule"("code");

-- CreateIndex
CREATE INDEX "TaxRuleVersion_taxRuleId_verificationStatus_effectiveFrom_idx" ON "TaxRuleVersion"("taxRuleId", "verificationStatus", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "TaxRuleVersion_taxRuleId_versionNumber_key" ON "TaxRuleVersion"("taxRuleId", "versionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "TaxRuleVersion_id_taxRuleId_key" ON "TaxRuleVersion"("id", "taxRuleId");

-- CreateIndex
CREATE INDEX "TaxBracket_taxRuleVersionId_lowerBoundCUP_idx" ON "TaxBracket"("taxRuleVersionId", "lowerBoundCUP");

-- CreateIndex
CREATE UNIQUE INDEX "TaxBracket_taxRuleVersionId_lowerBoundCUP_key" ON "TaxBracket"("taxRuleVersionId", "lowerBoundCUP");

-- CreateIndex
CREATE INDEX "BakeryTaxRule_bakeryId_enabled_effectiveFrom_idx" ON "BakeryTaxRule"("bakeryId", "enabled", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "BakeryTaxRule_id_bakeryId_key" ON "BakeryTaxRule"("id", "bakeryId");

-- CreateIndex
CREATE UNIQUE INDEX "BakeryTaxRule_id_bakeryId_taxRuleVersionId_key" ON "BakeryTaxRule"("id", "bakeryId", "taxRuleVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "BakeryTaxRule_bakeryId_taxRuleId_effectiveFrom_key" ON "BakeryTaxRule"("bakeryId", "taxRuleId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "CostCalculation_bakeryId_productId_valuationDate_idx" ON "CostCalculation"("bakeryId", "productId", "valuationDate");

-- CreateIndex
CREATE INDEX "CostCalculation_bakeryId_status_createdAt_idx" ON "CostCalculation"("bakeryId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CostCalculation_id_bakeryId_key" ON "CostCalculation"("id", "bakeryId");

-- CreateIndex
CREATE INDEX "CalculationLine_bakeryId_calculationId_lineType_idx" ON "CalculationLine"("bakeryId", "calculationId", "lineType");

-- CreateIndex
CREATE INDEX "PriceScenario_bakeryId_calculationId_createdAt_idx" ON "PriceScenario"("bakeryId", "calculationId", "createdAt");

-- CreateIndex
CREATE INDEX "PriceScenario_bakeryId_status_createdAt_idx" ON "PriceScenario"("bakeryId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PriceScenario_id_bakeryId_key" ON "PriceScenario"("id", "bakeryId");

-- CreateIndex
CREATE INDEX "ScenarioTaxLine_bakeryId_scenarioId_idx" ON "ScenarioTaxLine"("bakeryId", "scenarioId");

-- CreateIndex
CREATE UNIQUE INDEX "ScenarioTaxLine_scenarioId_bakeryTaxRuleId_key" ON "ScenarioTaxLine"("scenarioId", "bakeryTaxRuleId");

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_bakeryId_fkey" FOREIGN KEY ("bakeryId") REFERENCES "Bakery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiscalProfileVersion" ADD CONSTRAINT "FiscalProfileVersion_bakeryId_fkey" FOREIGN KEY ("bakeryId") REFERENCES "Bakery"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Material" ADD CONSTRAINT "Material_bakeryId_fkey" FOREIGN KEY ("bakeryId") REFERENCES "Bakery"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Material" ADD CONSTRAINT "Material_baseUnitId_fkey" FOREIGN KEY ("baseUnitId") REFERENCES "MeasurementUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialPrice" ADD CONSTRAINT "MaterialPrice_materialId_bakeryId_fkey" FOREIGN KEY ("materialId", "bakeryId") REFERENCES "Material"("id", "bakeryId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialPrice" ADD CONSTRAINT "MaterialPrice_packageUnitId_fkey" FOREIGN KEY ("packageUnitId") REFERENCES "MeasurementUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_bakeryId_fkey" FOREIGN KEY ("bakeryId") REFERENCES "Bakery"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_salesUnitId_fkey" FOREIGN KEY ("salesUnitId") REFERENCES "MeasurementUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeVersion" ADD CONSTRAINT "RecipeVersion_productId_bakeryId_fkey" FOREIGN KEY ("productId", "bakeryId") REFERENCES "Product"("id", "bakeryId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeVersion" ADD CONSTRAINT "RecipeVersion_outputUnitId_fkey" FOREIGN KEY ("outputUnitId") REFERENCES "MeasurementUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeMaterial" ADD CONSTRAINT "RecipeMaterial_recipeVersionId_bakeryId_fkey" FOREIGN KEY ("recipeVersionId", "bakeryId") REFERENCES "RecipeVersion"("id", "bakeryId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeMaterial" ADD CONSTRAINT "RecipeMaterial_materialId_bakeryId_fkey" FOREIGN KEY ("materialId", "bakeryId") REFERENCES "Material"("id", "bakeryId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeMaterial" ADD CONSTRAINT "RecipeMaterial_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "MeasurementUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaborRole" ADD CONSTRAINT "LaborRole_bakeryId_fkey" FOREIGN KEY ("bakeryId") REFERENCES "Bakery"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaborRate" ADD CONSTRAINT "LaborRate_laborRoleId_bakeryId_fkey" FOREIGN KEY ("laborRoleId", "bakeryId") REFERENCES "LaborRole"("id", "bakeryId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeLaborOperation" ADD CONSTRAINT "RecipeLaborOperation_recipeVersionId_bakeryId_fkey" FOREIGN KEY ("recipeVersionId", "bakeryId") REFERENCES "RecipeVersion"("id", "bakeryId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeLaborOperation" ADD CONSTRAINT "RecipeLaborOperation_laborRoleId_bakeryId_fkey" FOREIGN KEY ("laborRoleId", "bakeryId") REFERENCES "LaborRole"("id", "bakeryId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OverheadExpense" ADD CONSTRAINT "OverheadExpense_bakeryId_fkey" FOREIGN KEY ("bakeryId") REFERENCES "Bakery"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OverheadExpense" ADD CONSTRAINT "OverheadExpense_allocationUnitId_fkey" FOREIGN KEY ("allocationUnitId") REFERENCES "MeasurementUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxRuleVersion" ADD CONSTRAINT "TaxRuleVersion_taxRuleId_fkey" FOREIGN KEY ("taxRuleId") REFERENCES "TaxRule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxBracket" ADD CONSTRAINT "TaxBracket_taxRuleVersionId_fkey" FOREIGN KEY ("taxRuleVersionId") REFERENCES "TaxRuleVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BakeryTaxRule" ADD CONSTRAINT "BakeryTaxRule_bakeryId_fkey" FOREIGN KEY ("bakeryId") REFERENCES "Bakery"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BakeryTaxRule" ADD CONSTRAINT "BakeryTaxRule_taxRuleId_fkey" FOREIGN KEY ("taxRuleId") REFERENCES "TaxRule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BakeryTaxRule" ADD CONSTRAINT "BakeryTaxRule_taxRuleVersionId_taxRuleId_fkey" FOREIGN KEY ("taxRuleVersionId", "taxRuleId") REFERENCES "TaxRuleVersion"("id", "taxRuleId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostCalculation" ADD CONSTRAINT "CostCalculation_bakeryId_fkey" FOREIGN KEY ("bakeryId") REFERENCES "Bakery"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostCalculation" ADD CONSTRAINT "CostCalculation_productId_bakeryId_fkey" FOREIGN KEY ("productId", "bakeryId") REFERENCES "Product"("id", "bakeryId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostCalculation" ADD CONSTRAINT "CostCalculation_recipeVersionId_bakeryId_fkey" FOREIGN KEY ("recipeVersionId", "bakeryId") REFERENCES "RecipeVersion"("id", "bakeryId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostCalculation" ADD CONSTRAINT "CostCalculation_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalculationLine" ADD CONSTRAINT "CalculationLine_calculationId_bakeryId_fkey" FOREIGN KEY ("calculationId", "bakeryId") REFERENCES "CostCalculation"("id", "bakeryId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceScenario" ADD CONSTRAINT "PriceScenario_bakeryId_fkey" FOREIGN KEY ("bakeryId") REFERENCES "Bakery"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceScenario" ADD CONSTRAINT "PriceScenario_calculationId_bakeryId_fkey" FOREIGN KEY ("calculationId", "bakeryId") REFERENCES "CostCalculation"("id", "bakeryId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScenarioTaxLine" ADD CONSTRAINT "ScenarioTaxLine_scenarioId_bakeryId_fkey" FOREIGN KEY ("scenarioId", "bakeryId") REFERENCES "PriceScenario"("id", "bakeryId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScenarioTaxLine" ADD CONSTRAINT "ScenarioTaxLine_bakeryTaxRuleId_bakeryId_taxRuleVersionId_fkey" FOREIGN KEY ("bakeryTaxRuleId", "bakeryId", "taxRuleVersionId") REFERENCES "BakeryTaxRule"("id", "bakeryId", "taxRuleVersionId") ON DELETE RESTRICT ON UPDATE CASCADE;
