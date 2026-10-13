import { Prisma } from '../generated/prisma/client.js';
import { convertQuantity, money } from './costs.service.js';

const unit = (
  dimension: string,
  conversionFactor: string,
  isActive = true,
) => ({
  dimension,
  conversionFactor: new Prisma.Decimal(conversionFactor),
  isActive,
});

describe('cost calculation decimal math', () => {
  it('converts between units of the same dimension through the canonical factor', () => {
    const kilogramsToGrams = convertQuantity(
      new Prisma.Decimal('1.25'),
      unit('MASS', '1000'),
      unit('MASS', '1'),
      null,
    );

    expect(kilogramsToGrams?.toString()).toBe('1250');
  });

  it('converts mass and volume only with positive material density', () => {
    const millilitres = convertQuantity(
      new Prisma.Decimal('250'),
      unit('MASS', '1'),
      unit('VOLUME', '1'),
      new Prisma.Decimal('0.8'),
    );
    const grams = convertQuantity(
      new Prisma.Decimal('250'),
      unit('VOLUME', '1'),
      unit('MASS', '1'),
      new Prisma.Decimal('0.8'),
    );

    expect(millilitres?.toString()).toBe('312.5');
    expect(grams?.toString()).toBe('200');
    expect(convertQuantity(
      new Prisma.Decimal('250'),
      unit('MASS', '1'),
      unit('VOLUME', '1'),
      null,
    )).toBeNull();
  });

  it('rejects inactive and dimensionally incompatible units', () => {
    expect(convertQuantity(
      new Prisma.Decimal('2'),
      unit('MASS', '1', false),
      unit('MASS', '1'),
      null,
    )).toBeNull();
    expect(convertQuantity(
      new Prisma.Decimal('2'),
      unit('TIME', '1'),
      unit('COUNT', '1'),
      null,
    )).toBeNull();
  });

  it('rounds only the monetary result using HALF_UP', () => {
    expect(money(new Prisma.Decimal('3.455')).toString()).toBe('3.46');
    expect(money(new Prisma.Decimal('3.454')).toString()).toBe('3.45');
  });
});
