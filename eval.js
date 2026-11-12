// Evaluate keyword and semantic retrieval using MRR and Recall@10.
// Run with: node eval.js
const fs = require('fs');

// test-set.csv has a header row, then: query,correct_post_ids.
// correct_post_ids may be a semicolon list, e.g. "1024;1025".
function loadTestSet(path) {
  const lines = fs.readFileSync(path, 'utf8').trim().split('\n').slice(1);
  return lines.map(line => {
    const [query, ids] = line.split(',');
    return { query, correctIds: ids.split(';').map(Number) };
  });
}

const testSet = loadTestSet('test-set.csv');
const results = JSON.parse(fs.readFileSync('search-results.json', 'utf8'));

// Return 1 / rank of the first correct id, or 0 when none is found.
function reciprocalRank(rankedIds, correctIds) {
  const correct = new Set(correctIds);
  const index = rankedIds.findIndex(id => correct.has(Number(id)));
  return index === -1 ? 0 : 1 / (index + 1);
}

// Return the 1-based rank of the first correct id, or null for a miss.
function rankOf(rankedIds, correctIds) {
  const correct = new Set(correctIds);
  const index = rankedIds.findIndex(id => correct.has(Number(id)));
  return index === -1 ? null : index + 1;
}

const keywordRRs = [];
const semanticRRs = [];
let keywordHits = 0;
let semanticHits = 0;
const rows = [];

for (const { query, correctIds } of testSet) {
  const queryResults = results[query];
  if (!queryResults) {
    throw new Error(`Missing search results for query: ${query}`);
  }

  const keywordIds = queryResults.keyword.slice(0, 10);
  const semanticIds = queryResults.semantic.slice(0, 10);
  const keywordRR = reciprocalRank(keywordIds, correctIds);
  const semanticRR = reciprocalRank(semanticIds, correctIds);

  keywordRRs.push(keywordRR);
  semanticRRs.push(semanticRR);
  if (keywordRR > 0) keywordHits += 1;
  if (semanticRR > 0) semanticHits += 1;

  rows.push({
    query,
    keywordRank: rankOf(keywordIds, correctIds),
    semanticRank: rankOf(semanticIds, correctIds),
  });
}

const mean = values => values.reduce((sum, value) => sum + value, 0) / values.length;
const keywordMRR = mean(keywordRRs);
const semanticMRR = mean(semanticRRs);
const keywordRecall = keywordHits / testSet.length;
const semanticRecall = semanticHits / testSet.length;
const format = value => value.toFixed(2);
const displayRank = rank => rank === null ? 'miss' : rank;

console.log('| Query | Keyword rank | Semantic rank |');
console.log('|---|---|---|');
for (const row of rows) {
  console.log(`| ${row.query} | ${displayRank(row.keywordRank)} | ${displayRank(row.semanticRank)} |`);
}
console.log(`| **Summary** | **MRR ${format(keywordMRR)} · Recall@10 ${format(keywordRecall)}** | **MRR ${format(semanticMRR)} · Recall@10 ${format(semanticRecall)}** |`);
