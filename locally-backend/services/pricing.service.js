/**
 * Pricing Service — Multi-factor dynamic pricing for LOCALLY
 *
 * Breakdown:
 *  - Base rate        (service-type dependent)
 *  - Complexity surcharge (tier multiplier)
 *  - Travel fee       (Rs 50/km)
 *  - Peak-hour premium (09-12 & 17-20 PKT)
 *  - Urgency premium  (score > 7 → +Rs 100 per point)
 *  - Demand surge     (random 1.0 – 1.3x for demo)
 *  - Loyalty discount (based on jobsCompleted by provider)
 */

const BASE_RATES = {
  plumbing:    800,
  electrical:  1000,
  cleaning:    600,
  'ac repair': 1200,
  'ac':        1200,
  carpentry:   900,
  painting:    850,
  default:     700
};

const COMPLEXITY_MULTIPLIERS = {
  basic:    1.0,
  standard: 1.3,
  complex:  1.7
};

const isPeakHour = () => {
  const hour = new Date().getHours(); // server local time (PKT)
  return (hour >= 9 && hour < 12) || (hour >= 17 && hour < 20);
};

/**
 * Calculate full price breakdown.
 * @param {string} serviceType
 * @param {number} distanceKm
 * @param {number} urgencyScore  (1–10)
 * @param {string} complexityTier  'basic' | 'standard' | 'complex'
 * @param {number} jobsCompleted  provider's completed jobs (for loyalty)
 * @returns {{ baseFee, complexitySurcharge, travelFee, peakPremium, urgencyPremium, surgeFee, loyaltyDiscount, totalEstimate, breakdown }}
 */
const calculatePrice = (
  serviceType   = 'General Handyman',
  distanceKm    = 1.5,
  urgencyScore  = 5.0,
  complexityTier = 'basic',
  jobsCompleted = 0
) => {
  const typeKey = serviceType.toLowerCase();
  const matchedKey = Object.keys(BASE_RATES).find(k => typeKey.includes(k)) || 'default';
  const baseFee = BASE_RATES[matchedKey];

  // Complexity surcharge
  const multiplier = COMPLEXITY_MULTIPLIERS[complexityTier] || 1.0;
  const complexitySurcharge = Math.round(baseFee * (multiplier - 1));

  // Travel fee: Rs 50/km
  const travelFee = Math.round(distanceKm * 50);

  // Peak-hour premium: +15%
  const peakPremium = isPeakHour() ? Math.round(baseFee * 0.15) : 0;

  // Urgency premium: Rs 100 per point above 7.0
  const urgencyPremium = urgencyScore > 7.0 ? Math.round((urgencyScore - 7.0) * 100) : 0;

  // Demand surge: random 0–30% for demo purposes
  const surgeMultiplier = parseFloat((1.0 + Math.random() * 0.3).toFixed(2));
  const surgeFee = surgeMultiplier > 1.05 ? Math.round(baseFee * (surgeMultiplier - 1.0)) : 0;

  // Loyalty discount: 5% per 50 jobs completed, max 20%
  const loyaltyPct = Math.min(0.20, Math.floor(jobsCompleted / 50) * 0.05);
  const loyaltyDiscount = Math.round((baseFee + complexitySurcharge) * loyaltyPct);

  const totalEstimate =
    baseFee + complexitySurcharge + travelFee + peakPremium + urgencyPremium + surgeFee - loyaltyDiscount;

  return {
    baseFee,
    complexitySurcharge,
    travelFee,
    peakPremium,
    urgencyPremium,
    surgeFee,
    loyaltyDiscount,
    totalEstimate,
    surgeMultiplier,
    breakdown: `Base Rs${baseFee} + Complexity Rs${complexitySurcharge} + Travel Rs${travelFee}` +
      (peakPremium  ? ` + Peak Rs${peakPremium}`   : '') +
      (urgencyPremium ? ` + Urgency Rs${urgencyPremium}` : '') +
      (surgeFee     ? ` + Surge Rs${surgeFee}`     : '') +
      (loyaltyDiscount ? ` - Loyalty Rs${loyaltyDiscount}` : '') +
      ` = Rs${totalEstimate}`
  };
};

module.exports = { calculatePrice };
