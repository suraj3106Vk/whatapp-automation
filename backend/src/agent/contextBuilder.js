const { normalizeForReasoning } = require('./messageNormalizer');

function roleLabel(item) {
  if (item.role === 'assistant') return 'ASSISTANT';
  if (item.role === 'owner') return 'OWNER/SURAJ';
  return 'CONTACT';
}

function buildConversationContext(history, state, currentMessage, currentNormalized) {
  const recent = history.slice(-14);
  const lines = recent.map(item => `${roleLabel(item)}: ${item.content}`);
  const known = [
    state.activeTopic && `active_topic=${state.activeTopic}`,
    state.course && `course=${state.course}`,
    state.region && `region=${state.region}`,
    state.excludedRegions.length && `exclude_regions=${state.excludedRegions.join(', ')}`,
    state.pendingLists.length && `pending_lists=${state.pendingLists.join(', ')}`,
    state.lastOwnerQuestion && `last_owner_question=${state.lastOwnerQuestion}`,
    state.lastContactAnswer && `last_contact_answer=${state.lastContactAnswer}`,
  ].filter(Boolean);

  return `STRUCTURED STATE:
${known.length ? known.join('\n') : 'No structured state yet.'}

RECENT CONVERSATION:
${lines.length ? lines.join('\n') : 'No recent conversation.'}

CURRENT CONTACT MESSAGE:
${currentMessage}
CURRENT MESSAGE FOR REASONING:
${currentNormalized || normalizeForReasoning(currentMessage)}`;
}

module.exports = { buildConversationContext };
