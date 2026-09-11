/**
 * Dialect Memory
 * 
 * Stores contact-specific dialect phrases and their meanings.
 * Handles Banjari/Banjara/local Marathi/Hindi mixed speech.
 */

const fs = require('fs-extra');
const path = require('path');

const DIALECT_PATH = path.join(__dirname, '../../data/dialect-memory.json');

let dialectData = {};

/**
 * Load dialect memory from disk
 */
async function loadDialectMemory() {
  try {
    if (await fs.pathExists(DIALECT_PATH)) {
      dialectData = await fs.readJSON(DIALECT_PATH);
    }
  } catch (err) {
    console.error('[DialectMemory] Failed to load:', err.message);
    dialectData = {};
  }
}

/**
 * Save dialect memory to disk
 */
async function saveDialectMemory() {
  try {
    await fs.ensureDir(path.dirname(DIALECT_PATH));
    await fs.writeJSON(DIALECT_PATH, dialectData, { spaces: 2 });
  } catch (err) {
    console.error('[DialectMemory] Failed to save:', err.message);
  }
}

/**
 * Common dialect phrases (base knowledge)
 */
const BASE_DIALECT = {
  global: {
    // Banjari/local food references
    'bati khaldo': { meaning: 'jevan kela ka / did you eat?', confidence: 1.0, source: 'base' },
    'bati khaldo kai': { meaning: 'jevan kela ka / did you eat?', confidence: 1.0, source: 'base' },
    'khaldo': { meaning: 'khalla / ate', confidence: 1.0, source: 'base' },
    'khaldi': { meaning: 'khalli / ate (feminine)', confidence: 1.0, source: 'base' },
    'bati': { meaning: 'food / jevan (context: eating)', confidence: 0.9, source: 'base' },
    
    // Common conversational
    'manje': { meaning: 'meaning / what do you mean', confidence: 1.0, source: 'base' },
    'kay': { meaning: 'what', confidence: 1.0, source: 'base' },
    'kuth': { meaning: 'where', confidence: 1.0, source: 'base' },
    'mg': { meaning: 'then / so', confidence: 1.0, source: 'base' },
    'br': { meaning: 'ok / correct / barobar', confidence: 1.0, source: 'base' },
    'brr': { meaning: 'ok / correct / barobar', confidence: 1.0, source: 'base' },
    
    // Acknowledgements
    'ho na': { meaning: 'yes exactly', confidence: 1.0, source: 'base' },
    'ho mg': { meaning: 'yes then / ok so', confidence: 1.0, source: 'base' },
    'nh': { meaning: 'no / nahi', confidence: 1.0, source: 'base' },
    
    // Common expressions
    'pgl': { meaning: 'pagal / mad / crazy', confidence: 1.0, source: 'base' },
    'are': { meaning: 'hey / exclamation', confidence: 1.0, source: 'base' },
    'tu re': { meaning: 'you (emphatic)', confidence: 1.0, source: 'base' },
    'nh tu': { meaning: 'no you', confidence: 1.0, source: 'base' },
  }
};

/**
 * Get dialect phrases for a contact
 */
function getDialectForContact(chatId) {
  const contactDialect = dialectData[chatId] || {};
  return {
    ...BASE_DIALECT.global,
    ...contactDialect.phrases || {},
  };
}

/**
 * Add or update dialect phrase for contact
 */
function addDialectPhrase(chatId, phrase, meaning, source = 'owner_correction') {
  if (!dialectData[chatId]) {
    dialectData[chatId] = {
      phrases: {},
      lastUpdated: Date.now(),
    };
  }
  
  const normalized = phrase.toLowerCase().trim();
  
  dialectData[chatId].phrases[normalized] = {
    meaning,
    confidence: source === 'owner_correction' ? 0.95 : 0.7,
    source,
    addedAt: Date.now(),
  };
  
  dialectData[chatId].lastUpdated = Date.now();
  
  saveDialectMemory().catch(err => {
    console.error('[DialectMemory] Save failed:', err);
  });
}

/**
 * Look up phrase meaning
 */
function lookupPhrase(chatId, phrase) {
  const normalized = phrase.toLowerCase().trim();
  const contactDialect = getDialectForContact(chatId);
  
  return contactDialect[normalized] || null;
}

/**
 * Normalize message using dialect knowledge
 */
function normalizeWithDialect(chatId, messageText) {
  const dialect = getDialectForContact(chatId);
  let normalized = messageText;
  
  // Sort phrases by length (longer first) to avoid partial matches
  const phrases = Object.keys(dialect).sort((a, b) => b.length - a.length);
  
  for (const phrase of phrases) {
    const data = dialect[phrase];
    const regex = new RegExp(`\\b${phrase}\\b`, 'gi');
    
    if (regex.test(normalized)) {
      // Add meaning as hint (not replacement)
      normalized = normalized.replace(regex, `${phrase} [=${data.meaning}]`);
    }
  }
  
  return normalized;
}

/**
 * Get all dialect data
 */
function getAllDialect() {
  return {
    base: BASE_DIALECT.global,
    contacts: dialectData,
  };
}

/**
 * Clear contact dialect
 */
function clearContactDialect(chatId) {
  delete dialectData[chatId];
  saveDialectMemory();
}

// Initialize on load
loadDialectMemory().catch(err => {
  console.error('[DialectMemory] Failed to initialize:', err);
});

module.exports = {
  getDialectForContact,
  addDialectPhrase,
  lookupPhrase,
  normalizeWithDialect,
  getAllDialect,
  clearContactDialect,
};
