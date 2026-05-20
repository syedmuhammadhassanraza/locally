const { parseIntent } = require('../services/ai.service');
const { Provider, Chat } = require('../models');
const { calculateDistance, calculateETA } = require('../services/maps.service');
const { calculatePrice } = require('../services/pricing.service');
const { rankProviders } = require('../services/matching.service');

const handleChat = async (req, res) => {
  const { message } = req.body;
  const userId = req.user.id;

  try {
    // 1. Get or create chat session
    let chat = await Chat.findOne({ where: { userId } });
    if (!chat) {
      chat = await Chat.create({ userId, messages: [] });
    }

    const messages = chat.messages ? [...chat.messages] : [];
    messages.push({ sender: 'user', content: message, timestamp: new Date() });

    // 2. Parse request using enhanced AI service (supports Roman Urdu, Urdu Unicode, English)
    const intentResult = await parseIntent(message);
    const { serviceType, urgencyScore, complexityTier, confidence, needsClarification, clarificationQuestion } = intentResult;

    // 3. If clarification is needed (confidence < 70%), respond with a question
    if (needsClarification) {
      const clarifyReply = `I'm ${confidence}% sure you need a **${serviceType}** service. ${clarificationQuestion || 'Could you provide more details about the issue?'}`;
      messages.push({
        sender: 'ai',
        content: clarifyReply,
        intent: intentResult,
        needsClarification: true,
        timestamp: new Date()
      });
      chat.messages = messages;
      await chat.save();
      return res.json({
        reply: clarifyReply,
        intent: intentResult,
        needsClarification: true,
        providers: []
      });
    }

    // 4. Find online providers matching the service type
    let providers = await Provider.findAll({
      where: { serviceType, isOnline: true }
    });

    // Seed mock providers if none found
    if (providers.length === 0) {
      const mockData = [
        { name: 'Usman Khan', email: `usman_${serviceType.toLowerCase().replace(/\s+/g, '_')}@example.com`, serviceType, rating: 4.9, jobsCompleted: 247, cnic: '37405-1111111-1', demoCode: 'PROV-1', reliabilityScore: 96, cancellationRate: 2, hourlyRate: 900, tier: 3, lat: 33.6900, lng: 73.0450 },
        { name: 'Bilal Ahmed', email: `bilal_${serviceType.toLowerCase().replace(/\s+/g, '_')}@example.com`, serviceType, rating: 4.6, jobsCompleted: 112, cnic: '37405-2222222-2', demoCode: 'PROV-2', reliabilityScore: 88, cancellationRate: 8, hourlyRate: 750, tier: 2, lat: 33.6750, lng: 73.0550 },
        { name: 'Tariq Mehmood', email: `tariq_${serviceType.toLowerCase().replace(/\s+/g, '_')}@example.com`, serviceType, rating: 4.8, jobsCompleted: 98, cnic: '37405-3333333-3', demoCode: 'PROV-2026', reliabilityScore: 92, cancellationRate: 5, hourlyRate: 850, tier: 2, lat: 33.6820, lng: 73.0500 }
      ];
      providers = [];
      for (const data of mockData) {
        let p = await Provider.findOne({ where: { name: data.name, serviceType } });
        if (!p) p = await Provider.create(data);
        providers.push(p);
      }
    }

    // 5. Rank providers using 6-factor matching algorithm based on user's dynamic GPS location
    const userLat = req.body.lat !== undefined ? parseFloat(req.body.lat) : (req.user.lat || 33.6844);
    const userLng = req.body.lng !== undefined ? parseFloat(req.body.lng) : (req.user.lng || 73.0479);

    // Shift matched provider coordinates to guarantee they are strictly within 1.5 to 2.8 km of the user
    providers.forEach(p => {
      const angle = Math.random() * Math.PI * 2;
      const radiusKm = 1.5 + Math.random() * 1.3; // 1.5 to 2.8 km
      const latOffset = (radiusKm / 111) * Math.sin(angle);
      const lngOffset = (radiusKm / (111 * Math.cos((userLat * Math.PI) / 180))) * Math.cos(angle);
      p.lat = userLat + latOffset;
      p.lng = userLng + lngOffset;
    });

    const rankedResults = rankProviders(providers, { userLat, userLng, complexityTier, serviceType });

    // 6. Build provider cards with full pricing breakdown
    const mappedProviders = rankedResults.map(r => {
      const p = r.provider;
      const pricing = calculatePrice(serviceType, r.distanceKm, urgencyScore, complexityTier, p.jobsCompleted);
      const eta = calculateETA(r.distanceKm);

      return {
        id: p.id,
        name: p.name,
        serviceType: p.serviceType,
        rating: p.rating,
        jobsCompleted: p.jobsCompleted,
        tier: p.tier,
        reliabilityScore: p.reliabilityScore,
        matchScore: r.score,
        matchBreakdown: r.breakdown,
        distance: r.distanceKm.toFixed(1) + ' km',
        eta: eta + ' mins',
        lat: p.lat,
        lng: p.lng,
        baseFee: 'Rs ' + pricing.baseFee,
        complexitySurcharge: 'Rs ' + pricing.complexitySurcharge,
        travelFee: 'Rs ' + pricing.travelFee,
        peakPremium: pricing.peakPremium ? 'Rs ' + pricing.peakPremium : null,
        urgencyPremium: pricing.urgencyPremium ? 'Rs ' + pricing.urgencyPremium : null,
        surgeFee: pricing.surgeFee ? 'Rs ' + pricing.surgeFee : null,
        loyaltyDiscount: pricing.loyaltyDiscount ? 'Rs ' + pricing.loyaltyDiscount : null,
        totalEstimate: 'Rs ' + pricing.totalEstimate,
        pricingBreakdown: pricing.breakdown
      };
    });

    const aiReply = `✅ **${confidence}% confident** — identified a **${serviceType}** need (complexity: ${complexityTier}, urgency: ${urgencyScore}/10).\n\nHere are the top-ranked professionals nearby:`;

    messages.push({
      sender: 'ai',
      content: aiReply,
      intent: intentResult,
      providers: mappedProviders,
      timestamp: new Date()
    });

    chat.messages = messages;
    await chat.save();

    return res.json({
      reply: aiReply,
      intent: intentResult,
      providers: mappedProviders,
      needsClarification: false
    });
  } catch (error) {
    console.error('Chat controller error:', error);
    return res.status(500).json({ message: 'Server error during chat handling' });
  }
};

const getChatHistory = async (req, res) => {
  try {
    const chat = await Chat.findOne({ where: { userId: req.user.id } });
    return res.json(chat ? chat.messages : []);
  } catch (error) {
    console.error('Get chat history error:', error);
    return res.status(500).json({ message: 'Server error fetching chat history' });
  }
};

module.exports = { handleChat, getChatHistory };
