/**
 * Read-only: explains how Opportunity Score is produced, verifies the formula
 * against stored values, and shows the effect of the two inputs that no caller
 * ever supplies (currentRank / bestCompetitorRank).
 */
import { db, businesses, keywords } from '../src/db/index.js';
import { computeOpportunityScore } from '@serp-scout/agents';
import { eq } from 'drizzle-orm';

/** Mirrors the heuristic branch in keyword-discovery/index.ts (no AI). */
function heuristicScore(phrase: string, city: string | null, services: string[]) {
  let relevance = 75;
  let commercial = 70;
  let localFit = city && phrase.includes(city.toLowerCase()) ? 90 : 60;

  if (phrase.includes('near me') || (city && phrase.includes(city.toLowerCase()))) {
    localFit = 90;
  } else if (phrase.includes('how') || phrase.includes('what')) {
    commercial = 35;
  } else if (phrase.includes('emergency') || phrase.includes('repair')) {
    commercial = 85;
  }
  void services;
  return computeOpportunityScore({
    businessRelevance: relevance,
    commercialIntent: commercial,
    localFit,
  }).score;
}

console.log('=== 1. stored score distribution ===');
const bizList = await db.select().from(businesses).limit(50);
for (const biz of bizList) {
  const kws = await db.select().from(keywords).where(eq(keywords.businessId, biz.id));
  if (!kws.length) continue;
  const dist: Record<string, number> = {};
  for (const k of kws) dist[String(k.opportunityScore)] = (dist[String(k.opportunityScore)] || 0) + 1;
  const flat70 = kws.filter((k) => k.opportunityScore === 70).length;
  const noCityMatch = kws.filter((k) => !(biz.city && k.phrase.includes(biz.city.toLowerCase()))).length;
  console.log(
    `  ${biz.name.trim().padEnd(24)} n=${String(kws.length).padStart(3)} distinctScores=${Object.keys(dist).length} ` +
      `score=70(exact):${flat70} phrases-not-matching-city:${noCityMatch}`
  );
  console.log(`      distribution: ${JSON.stringify(dist)}`);
}

console.log('\n=== 2. stored value vs heuristic-branch prediction (shows AI vs heuristic origin) ===');
const target = bizList.find((b) => b.name.trim() === 'Body fitness gym') || bizList[0];
const kws = await db.select().from(keywords).where(eq(keywords.businessId, target.id));
let heuristicMatches = 0;
for (const k of kws.slice(0, 14)) {
  const predicted = heuristicScore(k.phrase, target.city, []);
  const isHeuristic = Math.abs(predicted - k.opportunityScore) < 0.001;
  if (isHeuristic) heuristicMatches++;
  console.log(
    `  ${k.opportunityScore.toFixed(1).padStart(5)}  heuristicPredicts=${String(predicted).padStart(3)}  ` +
      `${isHeuristic ? 'HEURISTIC' : 'AI-judged'}  "${k.phrase.slice(0, 62)}"`
  );
}
console.log(`  ${heuristicMatches}/${Math.min(14, kws.length)} explained exactly by the heuristic branch`);

console.log('\n=== 3. what the unused inputs would do (same keyword, same relevance/intent/localFit) ===');
const base = { businessRelevance: 85, commercialIntent: 80, localFit: 90 };
const withoutRanks = computeOpportunityScore(base);
const withRanks = computeOpportunityScore({ ...base, currentRank: 6, bestCompetitorRank: 2 });
const topRanked = computeOpportunityScore({ ...base, currentRank: 1, bestCompetitorRank: 8 });
for (const [label, r] of [
  ['as called today (no rank data)', withoutRanks],
  ['if you rank #6 vs rival #2', withRanks],
  ['if you rank #1 vs rival #8', topRanked],
] as const) {
  console.log(
    `  ${label.padEnd(32)} score=${String(r.score).padStart(3)}  breakdown=${JSON.stringify(r.breakdown)}  ` +
      `rankingPotential=${r.rankingPotential} contentGap=${r.contentGap}`
  );
}

console.log('\n=== 4. the constant contribution ===');
const constantPoints = 60 * 0.2 + 50 * 0.1;
console.log(
  `  rankingPotential defaults to 60 -> ${(60 * 0.2).toFixed(1)} pts; contentGap defaults to 50 -> ${(50 * 0.1).toFixed(1)} pts; ` +
    `together ${constantPoints.toFixed(1)} of every 100 points are fixed.`
);
console.log(
  `  remaining 83 pts = 30% relevance + 25% commercial intent + 15% local fit, i.e. ` +
    `score = round(0.30*relevance + 0.25*commercial + 0.15*localFit + 17)`
);

console.log('\n=== 5. manual-add route values (hardcoded inputs) ===');
for (const intent of ['commercial', 'transactional'] as const) {
  const r = computeOpportunityScore({
    businessRelevance: 80,
    commercialIntent: intent === 'transactional' ? 90 : 75,
    localFit: 85,
  });
  console.log(`  intent=${intent.padEnd(14)} -> score=${r.score}`);
}
