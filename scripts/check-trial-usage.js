// Script to check trial usage for a specific token
// Usage: node scripts/check-trial-usage.js trial-09w33n-3143-bpckc2

const { kv } = require('@vercel/kv');

async function checkTrialUsage(token) {
  try {
    const key = `trial:usage:${token}`;
    console.log(`Checking KV key: ${key}`);
    
    const usage = await kv.get(key);
    console.log('Usage data:', usage);
    
    if (!usage) {
      console.log('No usage data found in KV - token may not have been used yet');
      return;
    }
    
    const TRIAL_LIMITS = {
      MAX_ARTICLES: 2,
      MAX_TOPIC_DISCOVERY_RUNS: 2,
      MAX_IMAGES: 1,
    };
    
    const articlesRemaining = Math.max(0, TRIAL_LIMITS.MAX_ARTICLES - usage.articlesGenerated);
    const topicDiscoveryRunsRemaining = Math.max(0, TRIAL_LIMITS.MAX_TOPIC_DISCOVERY_RUNS - usage.topicDiscoveryRuns);
    const imagesRemaining = Math.max(0, TRIAL_LIMITS.MAX_IMAGES - usage.imagesGenerated);
    
    console.log('\n=== Trial Usage Summary ===');
    console.log(`Token: ${token}`);
    console.log(`Articles Generated: ${usage.articlesGenerated}/${TRIAL_LIMITS.MAX_ARTICLES} (${articlesRemaining} remaining)`);
    console.log(`Topic Discovery Runs: ${usage.topicDiscoveryRuns}/${TRIAL_LIMITS.MAX_TOPIC_DISCOVERY_RUNS} (${topicDiscoveryRunsRemaining} remaining)`);
    console.log(`Images Generated: ${usage.imagesGenerated}/${TRIAL_LIMITS.MAX_IMAGES} (${imagesRemaining} remaining)`);
    
    const allExhausted = articlesRemaining === 0 && topicDiscoveryRunsRemaining === 0 && imagesRemaining === 0;
    const anyExhausted = articlesRemaining === 0 || topicDiscoveryRunsRemaining === 0 || imagesRemaining === 0;
    
    console.log(`\nAll credits exhausted: ${allExhausted}`);
    console.log(`Any credit exhausted: ${anyExhausted}`);
    
    if (anyExhausted) {
      console.log('\n⚠️  Widget should appear on page load!');
    }
    
  } catch (error) {
    console.error('Error checking trial usage:', error);
  }
}

const token = process.argv[2];
if (!token) {
  console.error('Usage: node scripts/check-trial-usage.js <token>');
  process.exit(1);
}

checkTrialUsage(token).then(() => process.exit(0));
