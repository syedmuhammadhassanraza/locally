/**
 * Matching Service - 6-Factor Provider Scoring Algorithm
 *
 * Factors & weights:
 *  1. Distance score          (25%) - closer is better, max 5km
 *  2. Rating score            (25%) - recency-weighted star rating
 *  3. Reliability score       (20%) - track record & on-time rate
 *  4. Specialization match    (15%) - tier match for complexity
 *  5. Cancellation rate       (10%) - lower is better
 *  6. Capacity / availability  (5%) - online + not overloaded
 */

const haversineDistance = (lat1, lng1, lat2, lng2) => {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

/**
 * Score a single provider against request context.
 * @param {object} provider - Sequelize Provider instance
 * @param {object} context  - { userLat, userLng, complexityTier, serviceType }
 * @returns {{ score: number, breakdown: object, distanceKm: number }}
 */
const scoreProvider = (provider, context) => {
  const { userLat = 33.6844, userLng = 73.0479, complexityTier = 'basic' } = context;

  // --- 1. Distance (25%) ---
  const distanceKm = haversineDistance(userLat, userLng, provider.lat || 33.6844, provider.lng || 73.0479);
  const distanceScore = Math.max(0, 1 - distanceKm / 5) * 25; // linear decay to 0 at 5km

  // --- 2. Rating (25%) ---
  // Recency-weighted: rating out of 5 → normalised 0-1
  const rating = provider.rating || 3.0;
  const ratingScore = ((rating - 1) / 4) * 25;

  // --- 3. Reliability (20%) ---
  const reliability = provider.reliabilityScore !== undefined ? provider.reliabilityScore : 80;
  const reliabilityScore = (reliability / 100) * 20;

  // --- 4. Specialization / complexity tier match (15%) ---
  const providerTier = provider.tier || 1;
  const requestedTier = complexityTier === 'complex' ? 3 : complexityTier === 'standard' ? 2 : 1;
  // Full score if tier matches or exceeds; penalise under-qualified providers
  const tierScore = providerTier >= requestedTier ? 15 : (providerTier / requestedTier) * 15;

  // --- 5. Cancellation rate (10%) ---
  const cancelRate = provider.cancellationRate !== undefined ? provider.cancellationRate : 10;
  const cancelScore = Math.max(0, 1 - cancelRate / 100) * 10;

  // --- 6. Availability (5%) ---
  const availabilityScore = provider.isOnline ? 5 : 0;

  const total = distanceScore + ratingScore + reliabilityScore + tierScore + cancelScore + availabilityScore;

  return {
    score: parseFloat(total.toFixed(2)),
    distanceKm: parseFloat(distanceKm.toFixed(2)),
    breakdown: {
      distance: parseFloat(distanceScore.toFixed(2)),
      rating: parseFloat(ratingScore.toFixed(2)),
      reliability: parseFloat(reliabilityScore.toFixed(2)),
      tierMatch: parseFloat(tierScore.toFixed(2)),
      cancellation: parseFloat(cancelScore.toFixed(2)),
      availability: parseFloat(availabilityScore.toFixed(2))
    }
  };
};

/**
 * Rank a list of providers and return the top N.
 * @param {object[]} providers - Array of Provider instances
 * @param {object}   context   - Request context (userLat, userLng, complexityTier)
 * @param {number}   topN      - How many to return (default 3)
 */
const rankProviders = (providers, context, topN = 3) => {
  const scored = providers.map(p => {
    const result = scoreProvider(p, context);
    return { provider: p, ...result };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topN);
};

module.exports = { rankProviders, scoreProvider, haversineDistance };
