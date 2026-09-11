/**
 * Social Intent Classifier
 * 
 * Determines the SOCIAL MEANING of a message before generating a response.
 * This is the first step in understanding conversation context.
 */

/**
 * Social intent types
 */
const SocialIntent = {
  // No response needed
  NO_REPLY_NEEDED: 'NO_REPLY_NEEDED',
  
  // Simple acknowledgements
  ACK: 'ACK',
  FILLER: 'FILLER',
  
  // Social interactions
  JOKE: 'JOKE',
  TEASE: 'TEASE',
  SARCASM: 'SARCASM',
  
  // Questions
  CASUAL_QUESTION: 'CASUAL_QUESTION',
  FACTUAL_QUESTION: 'FACTUAL_QUESTION',
  CLARIFICATION: 'CLARIFICATION',
  
  // Emotional
  EMOTIONAL_REACTION: 'EMOTIONAL_REACTION',
  EXCITEMENT: 'EXCITEMENT',
  FRUSTRATION: 'FRUSTRATION',
  
  // Conversation flow
  CONTINUATION: 'CONTINUATION',
  TOPIC_CHANGE: 'TOPIC_CHANGE',
  CONVERSATION_ENDING: 'CONVERSATION_ENDING',
  
  // Actions
  TASK_REQUEST: 'TASK_REQUEST',
  INFO_REQUEST: 'INFO_REQUEST',
  
  // Other
  GREETING: 'GREETING',
  UNKNOWN: 'UNKNOWN',
};

/**
 * Patterns for quick classification
 */
const Patterns = {
  // Very short acknowledgements
  shortAck: /^(br+|ok+|ha+|ho+|hmm+|k|👍|👌|✅|barobar|thik|theek|acha|accha)[\s!.]*$/i,
  
  // Fillers that don't need response
  filler: /^(hmm|hm|uh|uhh|um|umm|ahem|are|arre)[\s.]*$/i,
  
  // Emoji only
  emojiOnly: /^[\p{Emoji}\s]+$/u,
  
  // Greetings
  greeting: /^(hi+|hello|hey|hlo|hii|namaste|namaskar|salaam|good\s+(morning|evening|afternoon|night))[\s!.,]*$/i,
  
  // Conversation enders
  conversationEnder: /^(bye|tata|chalo|ok\s+bye|barobar\s+bye|theek\s+hai|\.\.+|night|good\s*night)[\s!.]*$/i,
  
  // Question indicators
  questionIndicators: /[?]|\b(kadhi|konta|konte|kasa|kase|kay|ka|kuthe|which|what|when|how|why|where|kya|kaise|kab|kahan|kaun)\b/i,
  
  // Teasing/playful
  teasing: /\b(pgl|pagal|mad|veda|stupid|idiot|bewakoof)\b|[😂🤣😜😝😛🙄]/i,
  
  // Emotional words
  emotional: /[😢😭💔😤😡🥺😔]|\b(sad|upset|angry|mad|khup|bahut|jast|problem|tension|stress|worried|काय\s+झाल)\b/i,
  
  // Excitement
  excitement: /[🎉🥳😍🤩✨💯]|\b(wow|amazing|great|awesome|mast|ekdum|bahut\s+acha|zabardast|barobar|bhariiii|nice)\b/i,
  
  // Task/action requests
  taskRequest: /\b(remind|schedule|send|share|bhej|pathav|yaad|dila|note|task|alarm|kar|karo|please|plz)\b/i,
  
  // Correction signals
  correction: /\b(no|nahi|nai|nh|wrong|galat|chukicha|chukich|not\s+that|arre\s+nai)\b/i,
  
  // Continuation words
  continuation: /\b(and|ani|aani|then|mag|maga|nantar|also|pn|pan|but|पण|मग)\b/i,
};

/**
 * Classify message into social intent
 */
function classifySocialIntent(message, context = {}) {
  const text = String(message || '').trim();
  
  if (!text) {
    return {
      intent: SocialIntent.NO_REPLY_NEEDED,
      confidence: 1.0,
      shouldReply: false,
    };
  }
  
  const { previousMessage, previousSenderRole, messageCount } = context;
  
  // Very short acknowledgements → NO REPLY
  if (Patterns.shortAck.test(text)) {
    return {
      intent: SocialIntent.ACK,
      confidence: 0.95,
      shouldReply: false,
      replyMode: 'NO_REPLY',
    };
  }
  
  // Fillers → NO REPLY
  if (Patterns.filler.test(text)) {
    return {
      intent: SocialIntent.FILLER,
      confidence: 0.9,
      shouldReply: false,
      replyMode: 'NO_REPLY',
    };
  }
  
  // Conversation enders → NO REPLY or very brief
  if (Patterns.conversationEnder.test(text)) {
    return {
      intent: SocialIntent.CONVERSATION_ENDING,
      confidence: 0.85,
      shouldReply: false,
      replyMode: 'BRIEF_ACK_OR_NONE',
    };
  }
  
  // Emoji only messages
  if (Patterns.emojiOnly.test(text)) {
    // Check if emoji is emotional
    if (/[😢😭💔😤😡]/.test(text)) {
      return {
        intent: SocialIntent.EMOTIONAL_REACTION,
        confidence: 0.8,
        shouldReply: true,
        replyMode: 'EMOJI_OR_SHORT',
      };
    }
    
    // Most emojis don't need reply
    return {
      intent: SocialIntent.NO_REPLY_NEEDED,
      confidence: 0.7,
      shouldReply: false,
      replyMode: 'EMOJI_OR_NONE',
    };
  }
  
  // Greetings
  if (Patterns.greeting.test(text)) {
    return {
      intent: SocialIntent.GREETING,
      confidence: 0.9,
      shouldReply: true,
      replyMode: 'BRIEF_FRIENDLY',
    };
  }
  
  // Excitement
  if (Patterns.excitement.test(text)) {
    return {
      intent: SocialIntent.EXCITEMENT,
      confidence: 0.75,
      shouldReply: true,
      replyMode: 'PLAYFUL',
    };
  }
  
  // Emotional distress
  if (Patterns.emotional.test(text)) {
    return {
      intent: SocialIntent.EMOTIONAL_REACTION,
      confidence: 0.8,
      shouldReply: true,
      replyMode: 'EMPATHETIC',
    };
  }
  
  // Teasing/playful
  if (Patterns.teasing.test(text)) {
    return {
      intent: SocialIntent.TEASE,
      confidence: 0.75,
      shouldReply: true,
      replyMode: 'PLAYFUL',
    };
  }
  
  // Task requests
  if (Patterns.taskRequest.test(text) && text.length > 10) {
    return {
      intent: SocialIntent.TASK_REQUEST,
      confidence: 0.8,
      shouldReply: true,
      replyMode: 'TASK',
    };
  }
  
  // Questions
  if (Patterns.questionIndicators.test(text)) {
    // Check if it's a factual question or casual
    const isShort = text.length < 20;
    const hasContext = previousMessage && previousMessage.length > 10;
    
    if (isShort && hasContext) {
      return {
        intent: SocialIntent.CLARIFICATION,
        confidence: 0.7,
        shouldReply: true,
        replyMode: 'CLARIFY_PREVIOUS',
      };
    }
    
    if (/\b(time|date|when|kadhi|kab|kitne\s+baje)\b/i.test(text)) {
      return {
        intent: SocialIntent.FACTUAL_QUESTION,
        confidence: 0.85,
        shouldReply: true,
        replyMode: 'FACTUAL',
      };
    }
    
    return {
      intent: SocialIntent.CASUAL_QUESTION,
      confidence: 0.75,
      shouldReply: true,
      replyMode: 'CASUAL',
    };
  }
  
  // Correction of previous AI message
  if (Patterns.correction.test(text) && previousSenderRole === 'assistant') {
    return {
      intent: SocialIntent.CLARIFICATION,
      confidence: 0.8,
      shouldReply: true,
      replyMode: 'ACKNOWLEDGE_CORRECTION',
    };
  }
  
  // Continuation
  if (Patterns.continuation.test(text) || (messageCount > 2 && text.length < 50)) {
    return {
      intent: SocialIntent.CONTINUATION,
      confidence: 0.65,
      shouldReply: true,
      replyMode: 'CASUAL',
    };
  }
  
  // Default: casual conversation
  return {
    intent: SocialIntent.CONTINUATION,
    confidence: 0.5,
    shouldReply: true,
    replyMode: 'CASUAL',
  };
}

/**
 * Determine if reply is needed based on social intent
 */
function shouldReply(socialIntentResult) {
  return socialIntentResult.shouldReply === true;
}

/**
 * Get suggested reply mode
 */
function getReplyMode(socialIntentResult) {
  return socialIntentResult.replyMode || 'CASUAL';
}

module.exports = {
  SocialIntent,
  classifySocialIntent,
  shouldReply,
  getReplyMode,
};
