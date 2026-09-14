export function roosterCheckoutTotal(roosterPrice: number, care: 'skip' | 'monthly') {
  if (!Number.isFinite(roosterPrice) || roosterPrice <= 0) throw new Error('Invalid rooster price');
  return Math.round((roosterPrice + (care === 'monthly' ? 5000 : 0)) * 100) / 100;
}

export function roosterBundleSummary(roosterPrice: number, care: 'skip' | 'monthly') {
  return {
    total: roosterCheckoutTotal(roosterPrice, care),
    rooster_amount: roosterPrice,
    care_amount: care === 'monthly' ? 5000 : 0,
    care_preference: care,
    ...(care === 'monthly' ? { care_bundle_version: '110' } : {}),
  };
}
