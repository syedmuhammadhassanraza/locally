const { parseIntent } = require('../services/ai.service');
const { Provider, Chat } = require('../models');
const { calculateDistance, calculateETA } = require('../services/maps.service');
const { calculatePrice } = require('../services/pricing.service');

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

    // 2. Parse request using AI service
    const intentResult = await parseIntent(message);
    const serviceType = intentResult.serviceType;
    const urgencyScore = intentResult.urgencyScore;

    // 3. Find online providers matching the service type
    let providers = await Provider.findAll({
      where: { serviceType, isOnline: true },
      limit: 3
    });

    // Seeding mock providers if none are found in the database
    if (providers.length === 0) {
      const mockData = [
        { name: 'Usman Khan', email: `usman_${serviceType.toLowerCase().replace(/\s+/g, '_')}@example.com`, serviceType, rating: 4.9, jobsCompleted: 247, cnic: '37405-1111111-1', demoCode: 'PROV-1' },
        { name: 'Bilal Ahmed', email: `bilal_${serviceType.toLowerCase().replace(/\s+/g, '_')}@example.com`, serviceType, rating: 4.6, jobsCompleted: 112, cnic: '37405-2222222-2', demoCode: 'PROV-2' },
        { name: 'Tariq Mehmood', email: `tariq_${serviceType.toLowerCase().replace(/\s+/g, '_')}@example.com`, serviceType, rating: 4.8, jobsCompleted: 98, cnic: '37405-3333333-3', demoCode: 'PROV-2026' }
      ];
      
      providers = [];
      for (const data of mockData) {
        let p = await Provider.findOne({ where: { name: data.name, serviceType } });
        if (!p) {
          p = await Provider.create(data);
        }
        providers.push(p);
      }
    }

    // 4. Calculate quotes for each provider
    const mappedProviders = providers.map(p => {
      const distance = calculateDistance();
      const eta = calculateETA(distance);
      const pricing = calculatePrice(serviceType, distance, urgencyScore);

      return {
        id: p.id,
        name: p.name,
        serviceType: p.serviceType,
        rating: p.rating,
        jobsCompleted: p.jobsCompleted,
        distance: distance.toFixed(1) + ' km',
        eta: eta + ' mins',
        baseFee: 'Rs ' + pricing.baseFee,
        travelFee: 'Rs ' + pricing.travelFee,
        surgeFee: 'Rs ' + pricing.surgeFee,
        totalEstimate: 'Rs ' + pricing.totalEstimate
      };
    });

    const aiReply = `I've analyzed your request and identified a ${serviceType} need (Urgency level: ${urgencyScore}/10). Here are the top rated professionals nearby who can assist you immediately:`;
    
    messages.push({
      sender: 'ai',
      content: aiReply,
      intent: intentResult,
      providers: mappedProviders,
      timestamp: new Date()
    });

    // 5. Update and save chat history
    chat.messages = messages;
    await chat.save();

    return res.json({
      reply: aiReply,
      intent: intentResult,
      providers: mappedProviders
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
