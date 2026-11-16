/**
 * Rental price calculation. All amounts are whole Indonesian Rupiah (integers).
 *
 * Rules:
 *  - Monthly rate covers 30 days, weekly rate covers 7 days, remaining days use the daily rate.
 *  - Weekly / monthly rates are only used when they are cheaper than the equivalent
 *    days at the lower tier, so the renter always gets the best price.
 *  - The refundable security deposit is reported separately and is never part of the
 *    rental fee.
 *  - Delivery fee applies only when the renter chooses owner delivery.
 */
export interface PricingInput {
  dailyPrice: number;
  weeklyPrice?: number | null;
  monthlyPrice?: number | null;
  securityDeposit: number;
  deliveryFee: number;
  rentalDays: number;
  delivery: boolean;
}

export interface PriceBreakdown {
  rentalDays: number;
  dailyPrice: number;
  rentalSubtotal: number;
  /** Savings compared with paying the daily rate for every day. */
  discount: number;
  deliveryFee: number;
  securityDeposit: number;
  /** Rental + delivery (what the renter pays the owner, non-refundable). */
  rentalTotal: number;
  /** Everything the renter needs up front, including the refundable deposit. */
  totalDue: number;
}

export function calculateRentalSubtotal(
  days: number,
  dailyPrice: number,
  weeklyPrice?: number | null,
  monthlyPrice?: number | null,
): number {
  if (!Number.isInteger(days) || days < 1) throw new Error('rentalDays must be a positive integer');
  // best[d] = cheapest price for d days. d is bounded (max ~1 year), so DP is cheap and exact.
  const best = new Array<number>(days + 1).fill(Number.POSITIVE_INFINITY);
  best[0] = 0;
  for (let d = 1; d <= days; d++) {
    best[d] = best[d - 1] + dailyPrice;
    if (weeklyPrice && d >= 7) best[d] = Math.min(best[d], best[d - 7] + weeklyPrice);
    // Partial weeks: a weekly rate can also cover fewer than 7 remaining days when cheaper.
    if (weeklyPrice) best[d] = Math.min(best[d], best[Math.max(0, d - 7)] + weeklyPrice);
    if (monthlyPrice) best[d] = Math.min(best[d], best[Math.max(0, d - 30)] + monthlyPrice);
  }
  return best[days];
}

export function calculatePrice(input: PricingInput): PriceBreakdown {
  const { dailyPrice, weeklyPrice, monthlyPrice, securityDeposit, rentalDays, delivery } = input;
  const rentalSubtotal = calculateRentalSubtotal(rentalDays, dailyPrice, weeklyPrice, monthlyPrice);
  const deliveryFee = delivery ? input.deliveryFee : 0;
  const rentalTotal = rentalSubtotal + deliveryFee;
  return {
    rentalDays,
    dailyPrice,
    rentalSubtotal,
    discount: dailyPrice * rentalDays - rentalSubtotal,
    deliveryFee,
    securityDeposit,
    rentalTotal,
    totalDue: rentalTotal + securityDeposit,
  };
}
