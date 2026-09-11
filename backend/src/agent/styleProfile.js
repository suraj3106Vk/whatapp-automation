/**
 * Contact Style Profiles
 * 
 * Tracks conversation patterns per contact to adapt personality.
 * Learns from real interactions, not AI-generated messages.
 */

const fs = require('fs-extra');
const path = require('path');

const STYLE_PROFILES_PATH = path.join(__dirname, '../../data/style-profiles.json');

let profiles = {};

/**
 * Load style profiles from disk
 */
async function loadProfiles() {
  try {
    if (await fs.pathExists(STYLE_PROFILES_PATH)) {
      profiles = await fs.readJSON(STYLE_PROFILES_PATH);
    }
  } catch (err) {
    console.error('[StyleProfile] Failed to load profiles:', err.message);
    profiles = {};
  }
}

/**
 * Save style profiles to disk
 */
async function saveProfiles() {
  try {
    await fs.ensureDir(path.dirname(STYLE_PROFILES_PATH));
    await fs.writeJSON(STYLE_PROFILES_PATH, profiles, { spaces: 2 });
  } catch (err) {
    console.error('[StyleProfile] Failed to save profiles:', err.message);
  }
}

/**
 * Get or create profile for contact
 */
function getProfile(chatId, senderName = 'Unknown') {
  if (!profiles[chatId]) {
    profiles[chatId] = {
      name: senderName,
      preferredLanguage: 'mixed', // roman-marathi, hindi, english, mixed
      formality: 'casual', // casual, normal, formal
      emojiFrequency: 'medium', // low, medium, high
      teasingLevel: 'medium', // low, medium, high
      averageReplyLength: 'short', // tiny, short, medium, long
      commonWords: [],
      relationshipTone: 'normal', // close-friend, sibling, normal, formal, business
      messageCount: 0,
      lastUpdated: Date.now(),
    };
  }
  
  return profiles[chatId];
}

/**
 * Update profile based on message patterns
 * Only learn from OWNER messages (not AI-generated)
 */
function updateFromOwnerMessage(chatId, messageText) {
  const profile = getProfile(chatId);
  
  // Count emojis
  const emojiCount = (messageText.match(/[\p{Emoji}]/gu) || []).length;
  if (emojiCount > 3) {
    profile.emojiFrequency = 'high';
  } else if (emojiCount === 0 && messageText.length > 20) {
    profile.emojiFrequency = 'low';
  }
  
  // Detect teasing
  if (/\b(pgl|pagal|veda|bewakoof|idiot|stupid)\b/i.test(messageText)) {
    profile.teasingLevel = 'high';
  }
  
  // Detect language preference
  const hasMarathi = /\b(मी|तू|काय|कसा|कसे|आहे|होत|ahe|ahes|kay|kasa|kase|na|mg|br)\b/i.test(messageText);
  const hasHindi = /\b(मैं|तुम|क्या|कैसा|है|था|main|tu|tum|kya|hai|tha|hoon)\b/i.test(messageText);
  const hasEnglish = /\b(what|how|when|where|why|doing|going|come|went)\b/i.test(messageText);
  
  if (hasMarathi && !hasHindi && !hasEnglish) {
    profile.preferredLanguage = 'roman-marathi';
  } else if (hasHindi && !hasMarathi) {
    profile.preferredLanguage = 'hindi';
  } else if (hasEnglish && !hasMarathi && !hasHindi) {
    profile.preferredLanguage = 'english';
  } else {
    profile.preferredLanguage = 'mixed';
  }
  
  // Track word length
  const wordCount = messageText.split(/\s+/).length;
  if (wordCount <= 3) {
    profile.averageReplyLength = 'tiny';
  } else if (wordCount <= 10) {
    profile.averageReplyLength = 'short';
  } else if (wordCount <= 25) {
    profile.averageReplyLength = 'medium';
  } else {
    profile.averageReplyLength = 'long';
  }
  
  profile.lastUpdated = Date.now();
  
  saveProfiles().catch(err => {
    console.error('[StyleProfile] Save failed:', err);
  });
}

/**
 * Update profile based on contact message
 */
function updateFromContactMessage(chatId, senderName, messageText) {
  const profile = getProfile(chatId, senderName);
  
  // Update name if changed
  if (senderName && senderName !== 'Unknown') {
    profile.name = senderName;
  }
  
  profile.messageCount += 1;
  
  // Extract common words (simple approach)
  const words = messageText.toLowerCase().match(/[a-z0-9]+/gi) || [];
  const meaningful = words.filter(w => w.length > 3 && w.length < 15);
  
  for (const word of meaningful) {
    if (!profile.commonWords.includes(word)) {
      profile.commonWords.push(word);
      if (profile.commonWords.length > 50) {
        profile.commonWords = profile.commonWords.slice(-50);
      }
    }
  }
  
  profile.lastUpdated = Date.now();
  
  saveProfiles().catch(err => {
    console.error('[StyleProfile] Save failed:', err);
  });
}

/**
 * Set relationship tone manually
 */
function setRelationshipTone(chatId, tone) {
  const profile = getProfile(chatId);
  profile.relationshipTone = tone;
  saveProfiles();
}

/**
 * Get all profiles
 */
function getAllProfiles() {
  return { ...profiles };
}

/**
 * Clear profile
 */
function clearProfile(chatId) {
  delete profiles[chatId];
  saveProfiles();
}

// Initialize on load
loadProfiles().catch(err => {
  console.error('[StyleProfile] Failed to initialize:', err);
});

module.exports = {
  getProfile,
  updateFromOwnerMessage,
  updateFromContactMessage,
  setRelationshipTone,
  getAllProfiles,
  clearProfile,
};
