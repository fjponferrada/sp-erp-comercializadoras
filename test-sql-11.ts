const m0End = new Date('2026-06-30T23:59:59.999Z');
const startCalculo = new Date('2025-03-05T00:00:00.000Z');

const getDaysInPeriod = (pStart: Date, pEnd: Date) => {
  const overlapStart = startCalculo > pStart ? startCalculo : pStart;
  const overlapEnd = m0End < pEnd ? m0End : pEnd;
  if (overlapEnd < overlapStart) return 0;
  return Math.floor((overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24)) + 1; // inclusive
};

console.log('Total:', getDaysInPeriod(startCalculo, m0End));
