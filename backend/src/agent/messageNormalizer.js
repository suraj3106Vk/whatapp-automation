const REPLACEMENTS = [
  ['pathvin', 'pathavto'],
  ['pathvlin', 'pathavlin'],
  ['pathvte', 'pathavte'],
  ['takaych', 'takaychi'],
  ['sagn', 'sang'],
  ['smjt', 'samajt'],
  ['mnte', 'mhante'],
  ['kont', 'konta'],
  ['srv', 'sarv'],
  ['sagl', 'sagla'],
  ['jvl', 'javal'],
  ['clg', 'college'],
  ['collg', 'college'],
  ['qestion', 'question'],
  ['grj', 'garaj'],
  ['kra', 'kara'],
  ['kel', 'kele'],
  ['pahin', 'pahen'],
  ['pathv', 'pathav'],
  ['pahije', 'pahije'],
  ['ky', 'kay'],
  ['ks', 'kase'],
  ['pn', 'pan'],
  ['tr', 'tar'],
  ['mg', 'mag'],
  ['ntr', 'nantar'],
  ['ata', 'atta'],
  ['aata', 'atta'],
  ['mla', 'mala'],
  ['tula', 'tula'],
  ['tuz', 'tujha'],
  ['maz', 'maza'],
  ['tak', 'tak'],
  ['kr', 'kar'],
  ['krte', 'karte'],
  ['bg', 'bagh'],
  ['de', 'de'],
  ['det', 'de'],
  ['baro', 'barobar'],
  ['brobr', 'barobar'],
  ['bolva', 'bolav'],
  ['kuth', 'kuthe'],
  ['tele', 'tyala'],
];

const replacementMap = new Map(REPLACEMENTS);
const tokenPattern = new RegExp(`\\b(${[...replacementMap.keys()].sort((a, b) => b.length - a.length).join('|')})\\b`, 'gi');

function normalizeForReasoning(text) {
  return String(text || '').replace(tokenPattern, token => replacementMap.get(token.toLowerCase()) || token);
}

function isRomanText(text) {
  return /[a-z]/i.test(text) && !/[\u0900-\u097f]/.test(text);
}

function hasDevanagari(text) {
  return /[\u0900-\u097f]/.test(text);
}

function mergeMessages(messages) {
  return messages.map(message => String(message || '').trim()).filter(Boolean).join(' ');
}

module.exports = { normalizeForReasoning, isRomanText, hasDevanagari, mergeMessages };
