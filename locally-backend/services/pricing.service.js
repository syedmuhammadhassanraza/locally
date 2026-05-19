const calculatePrice = (serviceType, distance, urgencyScore) => {
  let baseFee = 500;
  
  const type = serviceType.toLowerCase();
  if (type.includes('plumb')) {
    baseFee = 800;
  } else if (type.includes('electr') || type.includes('wire')) {
    baseFee = 1000;
  } else if (type.includes('clean') || type.includes('wash')) {
    baseFee = 600;
  } else if (type.includes('ac') || type.includes('cool')) {
    baseFee = 1200;
  }

  // Travel fee: Rs 50 per km, rounded
  const travelFee = Math.round(distance * 50);

  // Surge fee for urgency score above 7.0 (Rs 100 per score point above 7)
  const surgeFee = urgencyScore > 7.0 ? Math.round((urgencyScore - 7.0) * 100) : 0;

  const totalEstimate = baseFee + travelFee + surgeFee;

  return {
    baseFee,
    travelFee,
    surgeFee,
    totalEstimate
  };
};

module.exports = { calculatePrice };
