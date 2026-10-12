-- REVIEWED DRAFT OF POSTGRESQL CONSTRAINTS THAT PRISMA SCHEMA LANGUAGE
-- DOES NOT FULLY EXPRESS. Merge into a Prisma migration after the initial
-- migration is generated; do not run as an untracked manual production script.
-- Requires PostgreSQL's btree_gist extension for multi-column EXCLUDE.

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "FiscalProfileVersion"
  ADD CONSTRAINT "FiscalProfileVersion_valid_period"
  CHECK ("validTo" IS NULL OR "validTo" > "validFrom");

ALTER TABLE "FiscalProfileVersion"
  ADD CONSTRAINT "FiscalProfileVersion_no_overlapping_periods"
  EXCLUDE USING gist (
    "bakeryId" WITH =,
    daterange("validFrom", "validTo", '[)') WITH &&
  );

ALTER TABLE "MaterialPrice"
  ADD CONSTRAINT "MaterialPrice_valid_values"
  CHECK (
    "packagePriceCUP" >= 0 AND
    "packageQuantity" > 0 AND
    ("effectiveTo" IS NULL OR "effectiveTo" > "effectiveFrom")
  );

ALTER TABLE "MaterialPrice"
  ADD CONSTRAINT "MaterialPrice_no_overlapping_periods"
  EXCLUDE USING gist (
    "bakeryId" WITH =,
    "materialId" WITH =,
    daterange("effectiveFrom", "effectiveTo", '[)') WITH &&
  );

ALTER TABLE "LaborRate"
  ADD CONSTRAINT "LaborRate_valid_values"
  CHECK (
    "hourlyRateCUP" >= 0 AND
    ("effectiveTo" IS NULL OR "effectiveTo" > "effectiveFrom")
  );

ALTER TABLE "LaborRate"
  ADD CONSTRAINT "LaborRate_no_overlapping_periods"
  EXCLUDE USING gist (
    "bakeryId" WITH =,
    "laborRoleId" WITH =,
    daterange("effectiveFrom", "effectiveTo", '[)') WITH &&
  );

ALTER TABLE "RecipeVersion"
  ADD CONSTRAINT "RecipeVersion_valid_values"
  CHECK (
    "versionNumber" > 0 AND
    "outputQuantity" > 0 AND
    ("effectiveTo" IS NULL OR "effectiveFrom" IS NULL OR "effectiveTo" > "effectiveFrom") AND
    ("status" <> 'PUBLISHED' OR "effectiveFrom" IS NOT NULL)
  );

ALTER TABLE "RecipeVersion"
  ADD CONSTRAINT "RecipeVersion_no_overlapping_published_periods"
  EXCLUDE USING gist (
    "bakeryId" WITH =,
    "productId" WITH =,
    daterange("effectiveFrom", "effectiveTo", '[)') WITH &&
  )
  WHERE ("status" = 'PUBLISHED' AND "effectiveFrom" IS NOT NULL);

ALTER TABLE "RecipeMaterial"
  ADD CONSTRAINT "RecipeMaterial_positive_quantity"
  CHECK ("quantity" > 0);

ALTER TABLE "RecipeLaborOperation"
  ADD CONSTRAINT "RecipeLaborOperation_positive_time_and_workers"
  CHECK ("durationMinutes" > 0 AND "workersCount" > 0);

ALTER TABLE "OverheadExpense"
  ADD CONSTRAINT "OverheadExpense_valid_values"
  CHECK (
    "amountCUP" >= 0 AND
    "periodEnd" >= "periodStart" AND
    ("allocationBaseQuantity" IS NULL OR "allocationBaseQuantity" > 0) AND
    (
      ("allocationMethod" = 'DIRECT_COST_PROPORTION') OR
      ("allocationBaseQuantity" IS NOT NULL)
    )
  );

ALTER TABLE "TaxRuleVersion"
  ADD CONSTRAINT "TaxRuleVersion_valid_values"
  CHECK (
    ("rate" IS NULL OR "rate" >= 0) AND
    ("fixedAmountCUP" IS NULL OR "fixedAmountCUP" >= 0) AND
    ("effectiveFrom" IS NULL OR "effectiveTo" IS NULL OR "effectiveTo" > "effectiveFrom") AND
    ("verificationStatus" <> 'VERIFIED' OR "effectiveFrom" IS NOT NULL) AND
    ("calculationMethod" <> 'PERCENT_OF_BASE' OR "rate" IS NOT NULL) AND
    ("calculationMethod" <> 'FIXED_AMOUNT' OR "fixedAmountCUP" IS NOT NULL)
  );

ALTER TABLE "TaxRuleVersion"
  ADD CONSTRAINT "TaxRuleVersion_no_overlapping_verified_periods"
  EXCLUDE USING gist (
    "taxRuleId" WITH =,
    daterange("effectiveFrom", "effectiveTo", '[)') WITH &&
  )
  WHERE ("verificationStatus" = 'VERIFIED' AND "effectiveFrom" IS NOT NULL);

ALTER TABLE "BakeryTaxRule"
  ADD CONSTRAINT "BakeryTaxRule_valid_period"
  CHECK ("effectiveFrom" IS NULL OR "effectiveTo" IS NULL OR "effectiveTo" > "effectiveFrom");

ALTER TABLE "CostCalculation"
  ADD CONSTRAINT "CostCalculation_nonnegative_values"
  CHECK (
    ("materialCostCUP" IS NULL OR "materialCostCUP" >= 0) AND
    ("laborCostCUP" IS NULL OR "laborCostCUP" >= 0) AND
    ("overheadCostCUP" IS NULL OR "overheadCostCUP" >= 0) AND
    ("totalProductionCostCUP" IS NULL OR "totalProductionCostCUP" >= 0) AND
    ("outputQuantity" IS NULL OR "outputQuantity" > 0) AND
    ("unitCostCUP" IS NULL OR "unitCostCUP" >= 0) AND
    ("status" <> 'COMPLETE' OR (
      "materialCostCUP" IS NOT NULL AND
      "laborCostCUP" IS NOT NULL AND
      "overheadCostCUP" IS NOT NULL AND
      "totalProductionCostCUP" IS NOT NULL AND
      "outputQuantity" IS NOT NULL AND
      "unitCostCUP" IS NOT NULL
    ))
  );

ALTER TABLE "PriceScenario"
  ADD CONSTRAINT "PriceScenario_valid_inputs"
  CHECK (
    "salePriceCUP" >= 0 AND
    "projectedQuantity" > 0 AND
    "discountsReturnsCUP" >= 0
  );

ALTER TABLE "ScenarioTaxLine"
  ADD CONSTRAINT "ScenarioTaxLine_nonnegative_values"
  CHECK (
    ("baseAmountCUP" IS NULL OR "baseAmountCUP" >= 0) AND
    ("rateApplied" IS NULL OR "rateApplied" >= 0) AND
    ("taxAmountCUP" IS NULL OR "taxAmountCUP" >= 0)
  );
