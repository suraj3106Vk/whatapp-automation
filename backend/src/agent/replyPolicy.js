/**
 * Reply Policy Engine
 * 
 * Determines whether SK should reply and how, based on:
 * - Social intent
 * - Contact profile
 * - Recent conversation patterns
 * - Auto-reply state
 */

const { classifySocialIntent, shouldReply: shouldReplyBySocialIntent } = require('./socialIntent');

// Auto-reply state
let autoReplyEnabled = true;
let pausedUntil = null;

/**
 * Set auto-reply state
 */
function setAutoReply(enabled) {
  autoReplyEnabled = enabled;
  
  if (!enabled) {
    console.log('[ReplyPolicy] Auto-reply DISABLED');
  } else {
    pausedUntil = null;
    console.log('[ReplyPolicy] Auto-reply ENABLED');
  }
}

/**
 * Pause auto-reply temporarily
 */
function pauseAutoReply(durationMs = 3600000) { // Default: 1 hour
  pausedUntil = Date.now() + durationMs;
  console.log(`[ReplyPolicy] Auto-reply paused for ${durationMs / 60000} minutes`);
}

/**
 * Check if auto-reply is currently active
 */
function isAutoReplyActive() {
  if (!autoReplyEnabled) return false;
  
  if (pausedUntil && Date.now() < pausedUntil) {
    return false;
  }
  
  // If pause expired, clear it
  if (pausedUntil && Date.now() >= pausedUntil) {
    pausedUntil = null;
    console.log('[ReplyPolicy] Auto-reply pause expired, resuming');
  }
  
  return true;
}

/**
 * Check if message is from owner (control message)
 */
function isOwnerControlMessage(fromNumber, ownerNumber) {
  if (!fromNumber || !ownerNumber) return false;
  
  const cleanFrom = String(fromNumber).replace(/\D/g, '');
  const cleanOwner = String(ownerNumber).replace(/\D/g, '');
  
  return cleanFrom === cleanOwner;
}

/**
 * Process owner control command
 */
function processOwnerControl(messageText) {
  const text = String(messageText || '').toLowerCase().trim();
  
  if (text === 'stop' || text === '/stop' || text === 'sk stop') {
    setAutoReply(false);
    return {
      isControl: true,
      action: 'stop',
      reply: 'SK auto-reply STOPPED. Send "start" to resume.',
    };
  }
  
  if (text === 'start' || text === '/start' || text === 'sk start') {
    setAutoReply(true);
    return {
      isControl: true,
      action: 'start',
      reply: 'SK auto-reply STARTED. Messages will be auto-replied.',
    };
  }
  
  if (text === 'status' || text === '/status' || text === 'sk status') {
    const status = isAutoReplyActive() ? 'ENABLED ✅' : 'DISABLED ❌';
    return {
      isControl: true,
      action: 'status',
      reply: `SK auto-reply status: ${status}`,
    };
  }
  
  if (text.startsWith('pause') || text.startsWith('/pause')) {
    // Extract duration if provided: "pause 30m" or "pause 2h"
    const match = text.match(/(\d+)\s*(m|h|min|hour|minute)/i);
    let durationMs = 3600000; // Default: 1 hour
    
    if (match) {
      const value = parseInt(match[1]);
      const unit = match[2].toLowerCase();
      
      if (unit.startsWith('m')) {
        durationMs = value * 60 * 1000;
      } else if (unit.startsWith('h')) {
        durationMs = value * 60 * 60 * 1000;
      }
    }
    
    pauseAutoReply(durationMs);
    const minutes = Math.round(durationMs / 60000);
    return {
      isControl: true,
      action: 'pause',
      reply: `SK auto-reply PAUSED for ${minutes} minutes. Send "start" to resume early.`,
    };
  }
  
  return {
    isControl: false,
  };
}

/**
 * Main policy decision: should SK reply to this message?
 */
function shouldReply(message, context = {}) {
  const {
    chatId,
    senderName,
    fromNumber,
    ownerNumber,
    previousMessages = [],
    contactProfile = {},
    isGroup = false,
  } = context;
  
  // Check if from owner (control messages)
  if (isOwnerControlMessage(fromNumber, ownerNumber)) {
    const control = processOwnerControl(message);
    if (control.isControl) {
      return {
        shouldReply: true,
        reason: 'OWNER_CONTROL',
        controlAction: control.action,
        reply: control.reply,
      };
    }
  }
  
  // Check auto-reply state
  if (!isAutoReplyActive()) {
    return {
      shouldReply: false,
      reason: 'AUTO_REPLY_DISABLED',
    };
  }
  
  // Group handling
  if (isGroup && contactProfile.replyToGroups === false) {
    return {
      shouldReply: false,
      reason: 'GROUP_REPLY_DISABLED',
    };
  }
  
  // Blacklist/whitelist check
  if (contactProfile.blacklisted) {
    return {
      shouldReply: false,
      reason: 'BLACKLISTED',
    };
  }
  
  if (contactProfile.whitelistedOnly && !contactProfile.whitelisted) {
    return {
      shouldReply: false,
      reason: 'NOT_WHITELISTED',
    };
  }
  
  // Promotional/broadcast detection
  if (/\b(offer|discount|sale|buy now|click here|limited time|winner|congratulations|claim now)\b/i.test(message)) {
    return {
      shouldReply: false,
      reason: 'PROMOTIONAL',
    };
  }
  
  // Social intent classification
  const previousMessage = previousMessages.length > 0 
    ? previousMessages[previousMessages.length - 1] 
    : null;
  
  const socialIntent = classifySocialIntent(message, {
    previousMessage: previousMessage?.content,
    previousSenderRole: previousMessage?.role,
    messageCount: previousMessages.length,
  });
  
  // Check if social intent suggests reply
  if (!shouldReplyBySocialIntent(socialIntent)) {
    return {
      shouldReply: false,
      reason: 'SOCIAL_NO_REPLY_NEEDED',
      socialIntent: socialIntent.intent,
      replyMode: socialIntent.replyMode,
    };
  }
  
  // Check question frequency (anti-question spam)
  const recentMessages = previousMessages.slice(-5);
  const questionCount = recentMessages.filter(m => 
    m.role === 'assistant' && m.content && m.content.includes('?')
  ).length;
  
  if (questionCount >= 3) {
    return {
      shouldReply: true,
      reason: 'NORMAL',
      socialIntent: socialIntent.intent,
      replyMode: socialIntent.replyMode,
      avoidQuestion: true, // Signal to avoid asking more questions
    };
  }
  
  // Normal reply
  return {
    shouldReply: true,
    reason: 'NORMAL',
    socialIntent: socialIntent.intent,
    replyMode: socialIntent.replyMode,
    avoidQuestion: false,
  };
}

/**
 * Get reply policy state
 */
function getState() {
  return {
    autoReplyEnabled,
    pausedUntil,
    isActive: isAutoReplyActive(),
  };
}

module.exports = {
  shouldReply,
  setAutoReply,
  pauseAutoReply,
  isAutoReplyActive,
  isOwnerControlMessage,
  processOwnerControl,
  getState,
};
