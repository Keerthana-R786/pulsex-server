let counters = {};

function generateId(prefix, referralId) {
  if (!counters[prefix]) counters[prefix] = 0;
  counters[prefix]++;
  const num = String(counters[prefix]).padStart(3, '0');
  return `${prefix}-${referralId}-${num}`;
}

function generateReferralId() {
  const num = Math.floor(10000 + Math.random() * 90000);
  return `RF-${num}`;
}

function generateOrderId() {
  const num = Math.floor(100000 + Math.random() * 900000);
  return `ORD-${num}`;
}

function generateCoverageId(memberId) {
  return `COV-${memberId}`;
}

function generateContactVerificationId() {
  const num = Math.floor(10000 + Math.random() * 90000);
  return `CV-${num}`;
}

module.exports = {
  generateId,
  generateReferralId,
  generateOrderId,
  generateCoverageId,
  generateContactVerificationId,
};
