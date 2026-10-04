import { haversineDistanceMeters } from "./islamabadPois.js";

const STOP_WORDS = new Set([
  "a", "about", "above", "after", "again", "against", "all", "am", "an", "and", "any", "are",
  "as", "at", "be", "because", "been", "before", "being", "below", "between", "both", "but",
  "by", "could", "did", "do", "does", "doing", "down", "during", "each", "few", "for", "from",
  "further", "had", "has", "have", "having", "he", "her", "here", "hers", "herself", "him",
  "himself", "his", "how", "i", "if", "in", "into", "is", "it", "its", "itself", "just", "me",
  "more", "most", "my", "myself", "no", "nor", "not", "of", "off", "on", "once", "only", "or",
  "other", "ought", "our", "ours", "ourselves", "out", "over", "own", "same", "she", "should",
  "so", "some", "such", "than", "that", "the", "their", "theirs", "them", "themselves", "then",
  "there", "these", "they", "this", "those", "through", "to", "too", "under", "until", "up",
  "very", "was", "we", "were", "what", "when", "where", "which", "while", "who", "whom", "why",
  "with", "would", "you", "your", "yours", "yourself", "yourselves"
]);

/**
 * Tokenize string into meaningful word tokens, stripping punctuation and stop words.
 * @param {string} text
 * @returns {Array<string>}
 */
export function tokenize(text = "") {
  if (!text || typeof text !== "string") return [];
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word));
}

/**
 * Compute Term Frequency (TF) map for a document.
 * @param {Array<string>} tokens
 * @returns {Map<string, number>}
 */
function computeTf(tokens) {
  const map = new Map();
  if (tokens.length === 0) return map;
  for (const t of tokens) {
    map.set(t, (map.get(t) || 0) + 1);
  }
  // Normalize by length
  for (const [key, val] of map.entries()) {
    map.set(key, val / tokens.length);
  }
  return map;
}

/**
 * Computes Cosine Similarity between two text strings using TF-IDF term vectors.
 * Returns a value between 0.0 (no similarity) and 1.0 (exact match).
 *
 * @param {string} textA
 * @param {string} textB
 * @returns {number}
 */
export function computeCosineSimilarity(textA = "", textB = "") {
  const tokensA = tokenize(textA);
  const tokensB = tokenize(textB);

  if (tokensA.length === 0 || tokensB.length === 0) {
    return 0;
  }

  const tfA = computeTf(tokensA);
  const tfB = computeTf(tokensB);

  // Union of all unique terms
  const allTerms = new Set([...tfA.keys(), ...tfB.keys()]);

  let dotProduct = 0;
  let magA = 0;
  let magB = 0;

  for (const term of allTerms) {
    const valA = tfA.get(term) || 0;
    const valB = tfB.get(term) || 0;

    dotProduct += valA * valB;
    magA += valA * valA;
    magB += valB * valB;
  }

  magA = Math.sqrt(magA);
  magB = Math.sqrt(magB);

  if (magA === 0 || magB === 0) return 0;

  const similarity = dotProduct / (magA * magB);
  return Math.min(1.0, Math.max(0.0, Math.round(similarity * 1000) / 1000));
}

export { haversineDistanceMeters };
