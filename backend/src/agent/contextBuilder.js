const { normalizeForReasoning } = require('./messageNormalizer');
const { getOwnerConfig } = require('./personaEngine');

function roleLabel(item) {
  const ownerShort = getOwnerConfig().shortName || 'You';
  if (item.role === 'assistant' || item.role === 'owner') return `YOU (${ownerShort})`;
  return item.senderName || 'Friend';
}

//══════════════════════════════════════════════════════════════════════════════
// INTELLIGENT CONTEXT BUILDER - Provides deep memory and understanding
//══════════════════════════════════════════════════════════════════════════════

function buildConversationContext(history, state, currentMessage, currentNormalized) {
  const recent = history.slice(-14);
  
  // Analyze conversation for intelligence
  const entities = extractEntities(recent, currentMessage);
  const flow = analyzeConversationFlow(recent);
  const intent = inferUserIntent(currentMessage, recent);
  
  // Build readable conversation history
  const lines = recent.map((item, idx) => {
    const label = roleLabel(item);
    const isCurrent = idx === recent.length - 1;
    return `${label}: ${item.content}${isCurrent ? ' [← RESPOND TO THIS]' : ''}`;
  });
  
  // Build memory state
  const memoryItems = [
    entities.relationships.length && `👥 RELATIONSHIP: ${entities.relationships.join(', ')} ⚠️ IMPORTANT!`,
    entities.emotions.length && `💭 EMOTIONAL STATE: ${entities.emotions.join(', ')} ⚠️ BE EMPATHETIC!`,
    entities.topics.length && `🎯 Topics Discussed: ${entities.topics.join(', ')}`,
    entities.people.length && `👥 People Mentioned: ${entities.people.join(', ')}`,
    entities.dates.length && `📅 Times/Dates: ${entities.dates.join(', ')}`,
    entities.locations.length && `📍 Locations: ${entities.locations.join(', ')}`,
    flow.lastTopic && `💭 Last Topic: ${flow.lastTopic}`,
    state.activeTopic && `🔄 Active Discussion: ${state.activeTopic}`,
    state.lastOwnerQuestion && `❓ Your Last Question: ${state.lastOwnerQuestion}`,
    state.lastContactAnswer && `💬 Their Last Answer: ${state.lastContactAnswer}`,
  ].filter(Boolean);
  
  // Kept deliberately plain (no ASCII boxes / heavy headers) — a prompt that
  // reads like a report tends to make the model reply like one too. This is
  // just quick situational awareness for the model, not something to echo.
  return `Read this like a quick mental note before replying, don't repeat it back:
- what they seem to mean right now: ${intent}
- mood: ${flow.mood}, urgency: ${flow.urgency}
${memoryItems.length ? memoryItems.join('\n') : '- fresh conversation, no prior context'}

Recent messages (oldest to newest, last line is what you're replying to):
${lines.join('\n')}

Current message as typed: "${currentMessage}"${currentNormalized && currentNormalized !== currentMessage ? ` (cleaned up: "${currentNormalized}")` : ''}

Reply to the actual point of the last message, matching the mood above. Reference earlier context only if it's actually relevant — don't force it in.`;
}

//══════════════════════════════════════════════════════════════════════════════
// Entity Extraction - Extract meaningful information from conversation
//══════════════════════════════════════════════════════════════════════════════

function extractEntities(history, currentMsg) {
  const allText = [...history.map(h => h.content), currentMsg].join(' ');
  
  return {
    topics: extractTopics(allText),
    people: extractPeople(allText),
    dates: extractDates(allText),
    locations: extractLocations(allText),
    relationships: extractRelationships(allText, history), // NEW!
    emotions: extractEmotions(history, currentMsg), // NEW!
  };
}

// NEW: Extract relationship information
function extractRelationships(text, history) {
  const relationships = [];
  
  // Sister/brother
  if (/\b(bahin|sister|बहीण|tai|दीदी|didi)\b/i.test(text)) {
    relationships.push('SISTER');
  }
  if (/\b(भाऊ|brother|bhai|bro)\b/i.test(text)) {
    relationships.push('BROTHER');
  }
  
  // Family
  if (/\b(aai|mom|mother|आई|mummy)\b/i.test(text)) {
    relationships.push('MOTHER');
  }
  if (/\b(baba|dad|father|बाबा|papa)\b/i.test(text)) {
    relationships.push('FATHER');
  }
  
  // Close relationships
  if (/\b(friend|मित्र|mitra|dost|यार|yaar)\b/i.test(text)) {
    relationships.push('FRIEND');
  }
  if (/\b(girlfriend|gf|बायको|wife)\b/i.test(text)) {
    relationships.push('PARTNER');
  }
  
  // Detect from conversation patterns
  const recentText = history.slice(-5).map(h => h.content).join(' ');
  if (/mi\s+(tujh[ia]|aaplya)\s+(bahin|sister)/i.test(recentText)) {
    relationships.push('CONFIRMED_SISTER');
  }
  
  return [...new Set(relationships)];
}

// NEW: Extract emotional state
function extractEmotions(history, currentMsg) {
  const emotions = [];
  const recent = [...history.slice(-3).map(h => h.content), currentMsg].join(' ');
  
  // Sad/crying
  if (/😢|😭|😔|🥲|💔|😞/g.test(recent)) {
    emotions.push('SAD/CRYING');
  }
  
  // Happy/excited
  if (/😊|😄|😁|🎉|🥳|😍|❤️/g.test(recent)) {
    emotions.push('HAPPY/EXCITED');
  }
  
  // Annoyed/frustrated
  if (/😤|🙄|😑|😒/g.test(recent)) {
    emotions.push('ANNOYED/FRUSTRATED');
  }
  
  // Confused
  if (/🤔|😕|❓|🧐/g.test(recent)) {
    emotions.push('CONFUSED/THINKING');
  }
  
  // Love/affection
  if (/❤️|💕|💖|😘|wedding|शादी|लग्न/i.test(recent)) {
    emotions.push('ROMANTIC/WEDDING_CONTEXT');
  }
  
  return emotions;
}

function extractTopics(text) {
  const topics = [];
  // Education
  const edu = text.match(/\b(college|admission|course|engineering|medical|nursing|bsc|btech|mbbs|exam|merit|rank|cutoff|class|lecture|study)\b/gi);
  if (edu) topics.push(...edu);
  
  // Work
  const work = text.match(/\b(project|work|assignment|deadline|submission|meeting|presentation|interview|job)\b/gi);
  if (work) topics.push(...work);
  
  // Social
  const social = text.match(/\b(movie|game|food|travel|party|plan|weekend|friend|family)\b/gi);
  if (social) topics.push(...social);
  
  return [...new Set(topics.map(t => t.toLowerCase()))].slice(0, 8);
}

function extractPeople(text) {
  // Common Indian names
  const names = text.match(/\b(Suraj|Sai|Rahul|Priya|Amit|Rohit|Neha|Shreya|Aarti|Raj|Anjali|Vikram|Pooja)\b/gi) || [];
  // Capitalized words (potential names)
  const caps = text.match(/\b[A-Z][a-z]{2,}\b/g) || [];
  return [...new Set([...names, ...caps])].slice(0, 5);
}

function extractDates(text) {
  const dates = [];
  // Relative time
  const rel = text.match(/\b(today|tomorrow|yesterday|kal|aaj|parva|abhi|now|later|baad me)\b/gi);
  if (rel) dates.push(...rel);
  
  // Clock times
  const times = text.match(/\b(\d{1,2})\s*(am|pm|baje)\b/gi);
  if (times) dates.push(...times);
  
  // Day periods
  const periods = text.match(/\b(morning|afternoon|evening|night|subah|sham|raat|dupaar)\b/gi);
  if (periods) dates.push(...periods);
  
  return [...new Set(dates)].slice(0, 5);
}

function extractLocations(text) {
  const locs = text.match(/\b(Mumbai|Pune|Delhi|Bangalore|Hyderabad|Nagpur|college|office|home|ghar|market|mall|station|airport)\b/gi) || [];
  return [...new Set(locs)].slice(0, 5);
}

//══════════════════════════════════════════════════════════════════════════════
// Conversation Flow Analysis - Understand mood, urgency, context
//══════════════════════════════════════════════════════════════════════════════

function analyzeConversationFlow(history) {
  if (history.length === 0) {
    return { lastTopic: '', mood: 'neutral', urgency: 'normal' };
  }
  
  const lastFew = history.slice(-5);
  const allText = lastFew.map(h => h.content).join(' ').toLowerCase();
  
  // Detect mood
  let mood = 'neutral';
  if (/haha|lol|😂|😅|🤣|funny|mazaa|mast|cool|awesome/.test(allText)) mood = 'funny/playful';
  if (/urgent|jaldi|fast|turant|important|critical|deadline|help/.test(allText)) mood = 'urgent/serious';
  if (/please|madat|kara|problem|issue|tension|confused/.test(allText)) mood = 'needs help';
  if (/chill|relax|aaram|maje|enjoy|nice|good/.test(allText)) mood = 'relaxed/positive';
  if (/sad|dukh|tension|worried|problem|nahi|cant/.test(allText)) mood = 'concerned';
  
  // Detect urgency
  let urgency = 'normal';
  if (/now|abhi|turant|jaldi|urgent|asap|emergency/.test(allText)) urgency = 'high';
  if (/later|baad|nantar|whenever|no rush|chill/.test(allText)) urgency = 'low';
  
  // Extract last topic
  const lastMsg = lastFew.length > 1 ? lastFew[lastFew.length - 2].content : '';
  const lastTopic = lastMsg.slice(0, 80);
  
  return { lastTopic, mood, urgency };
}

//══════════════════════════════════════════════════════════════════════════════
// Intent Inference - What does the user want?
//══════════════════════════════════════════════════════════════════════════════

function inferUserIntent(message, history) {
  const msg = message.toLowerCase().trim();
  
  // Greeting (start of conversation)
  if (/^(hi|hey|hello|hlo|hii|namaste|bol|kasa|kase|sup|yo)\b/i.test(msg)) {
    return 'GREETING';
  }
  
  // Questions
  if (msg.includes('?') || /\b(ka|kasa|kay|kuthe|kadhi|konta|konte|what|when|where|how|why|which|who)\b/.test(msg)) {
    return 'ASKING_QUESTION';
  }
  
  // Task/Reminder creation
  if (/\b(remind|yaad|schedule|meeting|appointment|deadline|call me|message|bhej|pathav)\b/i.test(msg)) {
    return 'CREATE_TASK/REMINDER';
  }
  
  // Simple acknowledgement
  if (/^(ok|okay|ha|ho|br|brr|barobar|thik|achha|hm|hmm|👍|k|alright)\s*$/i.test(msg)) {
    return 'ACKNOWLEDGEMENT';
  }
  
  // Sharing information
  if (/\b(btw|by the way|actually|listen|suna|bata|information|news|update|FYI)\b/i.test(msg)) {
    return 'SHARING_INFO';
  }
  
  // Request for action
  if (/\b(send|share|pathav|bhej|please|kar|kara|deto|de|give|show)\b/i.test(msg)) {
    return 'REQUEST_ACTION';
  }
  
  // Continuation of previous topic
  if (history.length > 2) {
    const lastMsg = history[history.length - 1].content.toLowerCase();
    // If previous was a question and this is short, it's an answer
    if (lastMsg.includes('?') && msg.length < 50) {
      return 'ANSWERING_PREVIOUS_QUESTION';
    }
    return 'CONTINUING_CONVERSATION';
  }
  
  return 'CASUAL_CHAT';
}

//══════════════════════════════════════════════════════════════════════════════
// Response Type Suggestion - Guide the AI on how to respond
//══════════════════════════════════════════════════════════════════════════════

function suggestResponseType(intent, flow) {
  if (intent === 'GREETING') return 'Greet back warmly and casually';
  if (intent === 'ASKING_QUESTION') return 'Answer directly and helpfully';
  if (intent === 'CREATE_TASK/REMINDER') return 'Confirm and create <SK_TASK> block';
  if (intent === 'ACKNOWLEDGEMENT') return 'Brief acknowledgement or no reply';
  if (intent === 'SHARING_INFO') return 'Acknowledge and engage with the info';
  if (intent === 'REQUEST_ACTION') return 'Respond based on what they want';
  if (intent === 'ANSWERING_PREVIOUS_QUESTION') return 'Acknowledge their answer contextually';
  if (intent === 'CONTINUING_CONVERSATION') return 'Continue naturally based on context';
  return 'Natural casual chat response';
}

module.exports = { buildConversationContext };
