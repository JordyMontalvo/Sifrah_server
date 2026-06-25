/**
 * Período canónico al aprobar una orden (activación, afiliación, canje, etc.).
 */
async function resolvePeriodAtApproval(Period, approvedAt) {
  const allPeriods = await Period.find({});
  if (!allPeriods || !allPeriods.length) return null;

  const openAtApproval = allPeriods.filter((p) => {
    const createdAt = p.createdAt ? new Date(p.createdAt) : null;
    if (!createdAt || isNaN(createdAt)) return false;
    if (createdAt > approvedAt) return false;
    if (p.status === "open") return true;
    if (p.closedAt) {
      const closedAt = new Date(p.closedAt);
      return approvedAt <= closedAt;
    }
    return false;
  });

  if (openAtApproval.length > 0) {
    openAtApproval.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return openAtApproval[0];
  }

  const openPeriods = allPeriods.filter((p) => p.status === "open");
  if (openPeriods.length > 0) {
    openPeriods.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return openPeriods[0];
  }

  const withClosedAt = allPeriods
    .filter((p) => p.closedAt && new Date(p.closedAt) >= approvedAt)
    .sort((a, b) => new Date(b.closedAt) - new Date(a.closedAt));
  if (withClosedAt.length > 0) return withClosedAt[0];

  return null;
}

module.exports = { resolvePeriodAtApproval };
