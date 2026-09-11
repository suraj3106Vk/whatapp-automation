/**
 * Response Filter
 * 
 * Post-generation filters to catch and fix chatbot-like responses.
 * Validates responses before sending to WhatsApp.
 */

const { validateResponse } = require('./personaEngine');

/**
 * Filter metrics for debugging
 */
const metrics = {
  totalResponses: 0,
  filteredResponses: 0,
  filterReasons: {},
};

/**
 * Check if response has reasoning/analysis text
 */
function containsReasoningText(text) {
  if (!text) return false;
  
  const reasoningPatterns = [
    /reasoning summary/i,
    /suggested reply/i,
    /analysis:/i,
    /interpretation:/i,
    /based on the conversation/i,
    /the user appears/i,
    /the recent tone is/i,
    /^(reasoning|analysis|interpretation|suggestion):/im,
  ];
  
  return reasoningPatterns.some(pattern => pattern.test(text));
}

/**
 * Check for excessive question pattern
 */
function hasExcessiveQuestions(text) {
  if (!text) return false;
  
  const questionMarks = (text.match(/\?/g) || []).length;
  const sentences = text.split(/[.!?]+/).length;
  
  // If more than 50% of sentences are questions
  return questionMarks > 0 && (questionMarks / sentences) > 0.5;
}

/**
 * Check for generic customer support language
 */
function hasGenericSupportLanguage(text) {
  if (!text) return false;
  
  const lower = text.toLowerCase();
  
  const genericPatterns = [
    'how can i help you',
    'what can i do for you',
    'how may i assist',
    'please let me know',
    'feel free to',
    'don\'t hesitate',
    'i\'m here to help',
    'i\'m here if you need',
    'मी मदत करू शकतो',
    'तुम्हाला काही मदत पाहिजे',
  ];
  
  return genericPatterns.some(phrase => lower.includes(phrase));
}

/**
 * Check if response is overly formal
 */
function isOverlyFormal(text) {
  if (!text) return false;
  
  const formalWords = [
    'कृपया',
    'नक्कीच',
    'अवश्य',
    'certainly',
    'absolutely',
    'definitely',
    'please provide',
    'kindly',
  ];
  
  const lower = text.toLowerCase();
  const formalCount = formalWords.filter(word => lower.includes(word)).length;
  
  return formalCount >= 2;
}

/**
 * Check response length vs input
 */
function checkLengthRatio(inputText, responseText) {
  if (!inputText || !responseText) return { valid: true };
  
  const inputWords = inputText.split(/\s+/).length;
  const responseWords = responseText.split(/\s+/).length;
  
  // If input is very short (< 5 words), response should be short too
  if (inputWords < 5 && responseWords > 20) {
    return {
      valid: false,
      reason: 'Response too long for short input',
    };
  }
  
  // If input is casual (< 10 words), response shouldn't be a lecture
  if (inputWords < 10 && responseWords > 40) {
    return {
      valid: false,
      reason: 'Response too verbose for casual input',
    };
  }
  
  return { valid: true };
}

/**
 * Main filter function
 */
function filterResponse(inputText, responseText, context = {}) {
  metrics.totalResponses++;
  
  if (!responseText) {
    return {
      filtered: false,
      cleanedResponse: null,
      issues: [],
    };
  }
  
  const issues = [];
  let cleaned = responseText.trim();
  
  // Remove reasoning text if leaked
  if (containsReasoningText(cleaned)) {
    issues.push('REASONING_LEAKED');
    // Try to extract just the reply part
    const lines = cleaned.split('\n');
    const replyLines = lines.filter(line => 
      !containsReasoningText(line)
    );
    cleaned = replyLines.join('\n').trim();
  }
  
  // Check chatbot language
  if (hasGenericSupportLanguage(cleaned)) {
    issues.push('GENERIC_SUPPORT');
  }
  
  // Check excessive questions
  if (hasExcessiveQuestions(cleaned)) {
    issues.push('EXCESSIVE_QUESTIONS');
  }
  
  // Check formality
  if (isOverlyFormal(cleaned)) {
    issues.push('OVERLY_FORMAL');
  }
  
  // Check length ratio
  const lengthCheck = checkLengthRatio(inputText, cleaned);
  if (!lengthCheck.valid) {
    issues.push('LENGTH_MISMATCH');
  }
  
  // Use persona engine validation
  const validation = validateResponse(inputText, cleaned, context);
  if (!validation.valid) {
    issues.push(...validation.issues);
  }
  
  // Track metrics
  if (issues.length > 0) {
    metrics.filteredResponses++;
    issues.forEach(issue => {
      metrics.filterReasons[issue] = (metrics.filterReasons[issue] || 0) + 1;
    });
  }
  
  return {
    filtered: issues.length > 0,
    cleanedResponse: cleaned || null,
    issues,
    shouldRegenerate: issues.includes('REASONING_LEAKED') || 
                      issues.includes('GENERIC_SUPPORT') ||
                      issues.includes('EXCESSIVE_QUESTIONS'),
  };
}

/**
 * Quick validation (no regeneration suggestion)
 */
function quickValidate(inputText, responseText) {
  const result = filterResponse(inputText, responseText);
  return {
    valid: !result.filtered,
    issues: result.issues,
  };
}

/**
 * Get filter metrics
 */
function getMetrics() {
  return {
    ...metrics,
    filterRate: metrics.totalResponses > 0 
      ? (metrics.filteredResponses / metrics.totalResponses * 100).toFixed(2) + '%'
      : '0%',
  };
}

/**
 * Reset metrics
 */
function resetMetrics() {
  metrics.totalResponses = 0;
  metrics.filteredResponses = 0;
  metrics.filterReasons = {};
}

module.exports = {
  filterResponse,
  quickValidate,
  containsReasoningText,
  hasGenericSupportLanguage,
  getMetrics,
  resetMetrics,
};
