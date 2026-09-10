const { normalizeForReasoning } = require('./messageNormalizer');

function roleLabel(item) {
  if (item.role === 'assistant') return 'YOU (Suraj)';
  if (item.role === 'owner') return 'YOU (Suraj)';
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
    entities.topics.length && `🎯 Topics Discussed: ${entities.topics.join(', ')}`,
    entities.people.length && `👥 People Mentioned: ${entities.people.join(', ')}`,
    entities.dates.length && `📅 Times/Dates: ${entities.dates.join(', ')}`,
    entities.locations.length && `📍 Locations: ${entities.locations.join(', ')}`,
    flow.lastTopic && `💭 Last Topic: ${flow.lastTopic}`,
    state.activeTopic && `🔄 Active Discussion: ${state.activeTopic}`,
    state.lastOwnerQuestion && `❓ Your Last Question: ${state.lastOwnerQuestion}`,
    state.lastContactAnswer && `💬 Their Last Answer: ${state.lastContactAnswer}`,
  ].filter(Boolean);
  
  return `╔══════════════════════════════════════════════════════════════════╗
║              INTELLIGENT CONTEXT & MEMORY SYSTEM               ║
╚══════════════════════════════════════════════════════════════════╝

📊 CONVERSATION INTELLIGENCE:
─────────────────────────────────────────────────────────────────
Intent Detected: ${intent}
Conversation Mood: ${flow.mood}
Urgency Level: ${flow.urgency}
Response Type Needed: ${suggestResponseType(intent, flow)}

📝 CONVERSATION MEMORY & STATE:
─────────────────────────────────────────────────────────────────
${memoryItems.length ? memoryItems.join('\n') : '✨ Fresh conversation starting'}

💬 RECENT CONVERSATION (Last ${lines.length} messages):
─────────────────────────────────────────────────────────────────
${lines.join('\n')}

🎯 CURRENT MESSAGE ANALYSIS:
─────────────────────────────────────────────────────────────────
Raw Message: ${currentMessage}
Normalized: ${currentNormalized || normalizeForReasoning(currentMessage)}

╔══════════════════════════════════════════════════════════════════╗
║                     HOW TO RESPOND SMARTLY                       ║
╚══════════════════════════════════════════════════════════════════╝

✓ CONNECT to previous conversation context above
✓ REMEMBER what was discussed (check Topics/Memory section)
✓ UNDERSTAND the relationship from chat history
✓ RESPOND naturally based on the FULL PICTURE, not just current message
✓ If follow-up question → REFERENCE what was said before
✓ If task/schedule/reminder → CREATE <SK_TASK> with proper details
✓ MATCH the mood (${flow.mood}) and energy level
✓ Use ${intent} as guide for response type
✓ Be CONTEXTUAL - connect dots between messages`;
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
  };
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
