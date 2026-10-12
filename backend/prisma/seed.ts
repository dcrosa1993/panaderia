import "dotenv/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required to seed the Panadería database.");
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const units = [
  { code: "g", name: "gramo", dimension: "MASS" as const, conversionFactor: "1.0000000000", isCanonical: true },
  { code: "kg", name: "kilogramo", dimension: "MASS" as const, conversionFactor: "1000.0000000000", isCanonical: false },
  { code: "mg", name: "miligramo", dimension: "MASS" as const, conversionFactor: "0.0010000000", isCanonical: false },
  { code: "ml", name: "mililitro", dimension: "VOLUME" as const, conversionFactor: "1.0000000000", isCanonical: true },
  { code: "l", name: "litro", dimension: "VOLUME" as const, conversionFactor: "1000.0000000000", isCanonical: false },
  { code: "pc", name: "pieza/unidad", dimension: "COUNT" as const, conversionFactor: "1.0000000000", isCanonical: true },
  { code: "min", name: "minuto", dimension: "TIME" as const, conversionFactor: "1.0000000000", isCanonical: true },
  { code: "h", name: "hora", dimension: "TIME" as const, conversionFactor: "60.0000000000", isCanonical: false },
  { code: "kWh", name: "kilovatio-hora", dimension: "ENERGY" as const, conversionFactor: "1.0000000000", isCanonical: true },
] as const;

async function main(): Promise<void> {
  for (const unit of units) {
    await prisma.measurementUnit.upsert({
      where: { code: unit.code },
      create: unit,
      update: {
        name: unit.name,
        dimension: unit.dimension,
        conversionFactor: unit.conversionFactor,
        isCanonical: unit.isCanonical,
        isActive: true,
      },
    });
  }

  // These are configurable planning assumptions, not verified legal rules.
  // No BakeryTaxRule assignments are created and both versions remain pending.
  const salesRule = await prisma.taxRule.upsert({
    where: { code: "TCP_NET_SALES_ESTIMATE" },
    create: {
      code: "TCP_NET_SALES_ESTIMATE",
      name: "TCP — escenario estimado sobre ventas netas (supuesto por validar)",
      category: "SALES",
      isSystem: true,
    },
    update: {},
  });

  await prisma.taxRuleVersion.upsert({
    where: {
      taxRuleId_versionNumber: {
        taxRuleId: salesRule.id,
        versionNumber: 1,
      },
    },
    create: {
      taxRuleId: salesRule.id,
      versionNumber: 1,
      calculationMethod: "PERCENT_OF_BASE",
      taxBase: "NET_SALES",
      rate: "0.100000",
      effectiveFrom: null,
      effectiveTo: null,
      verificationStatus: "PENDING_VALIDATION",
      notes: "Supuesto solicitado para simulaciones; verificar la norma cubana aplicable antes de activarlo como regla fiscal.",
    },
    update: {},
  });

  const profitRule = await prisma.taxRule.upsert({
    where: { code: "TCP_PROFIT_ESTIMATE" },
    create: {
      code: "TCP_PROFIT_ESTIMATE",
      name: "TCP — escenario estimado sobre utilidades (supuesto por validar)",
      category: "PROFIT_OR_INCOME",
      isSystem: true,
    },
    update: {},
  });

  await prisma.taxRuleVersion.upsert({
    where: {
      taxRuleId_versionNumber: {
        taxRuleId: profitRule.id,
        versionNumber: 1,
      },
    },
    create: {
      taxRuleId: profitRule.id,
      versionNumber: 1,
      calculationMethod: "PERCENT_OF_BASE",
      taxBase: "PROFIT_BEFORE_PROFIT_TAX",
      rate: "0.050000",
      effectiveFrom: null,
      effectiveTo: null,
      verificationStatus: "PENDING_VALIDATION",
      notes: "Supuesto solicitado para simulaciones; verificar la norma cubana aplicable antes de activarlo como regla fiscal.",
    },
    update: {},
  });

  console.log(`Seed completed: ${units.length} measurement units and 2 pending tax-rule templates.`);
}

main()
  .catch((error: unknown) => {
    console.error("Panadería database seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
