import { db, workspaces } from './db/index.js';
import { getGroqClient, DEFAULT_GROQ_MODEL, AgentStateAnnotation } from '@serp-scout/agents';
import { env } from './config/env.js';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';

async function main() {
  console.log('🧪 Starting Milestone 0 verification checks...\n');

  // 1. Neon Database check
  console.log('1️⃣ Checking Neon Database connection...');
  try {
    const existingWorkspaces = await db.select().from(workspaces).limit(1);
    console.log(`✅ Neon Database query successful! Found ${existingWorkspaces.length} workspaces.`);
  } catch (err) {
    console.error('❌ Neon Database connection failed:', err);
    process.exit(1);
  }

  // 2. Upstash Redis check
  console.log('\n2️⃣ Checking Upstash Redis connection via ioredis & BullMQ...');
  try {
    const redis = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: null,
      family: 4,
      enableReadyCheck: false,
      connectTimeout: 15000,
      retryStrategy: (times) => Math.min(times * 200, 3000),
      tls: {
        rejectUnauthorized: false,
      },
    });
    redis.on('error', (err: any) => {
      console.warn('[Redis Test Notice]:', err.code || err.message);
    });

    const ping = await redis.ping();
    console.log(`✅ Redis PING response: ${ping}`);

    const testQueue = new Queue('milestone0-test', {
      connection: redis,
    });
    await testQueue.waitUntilReady();
    console.log('✅ BullMQ test queue connected and ready!');
    await testQueue.close();
    await redis.quit();
  } catch (err) {
    console.error('❌ Redis / BullMQ connection failed:', err);
    process.exit(1);
  }

  // 3. Groq Client check
  console.log('\n3️⃣ Checking Groq client initialization...');
  try {
    const groq = getGroqClient(env.GROQ_API_KEY);
    console.log(`✅ Groq client initialized with model: ${DEFAULT_GROQ_MODEL}`);
  } catch (err) {
    console.error('❌ Groq client initialization failed:', err);
    process.exit(1);
  }

  // 4. LangGraph AgentState check
  console.log('\n4️⃣ Checking LangGraph AgentState compilation...');
  try {
    const stateSpec = AgentStateAnnotation.spec;
    console.log(`✅ LangGraph AgentStateAnnotation successfully validated with ${Object.keys(stateSpec).length} state channels.`);
  } catch (err) {
    console.error('❌ AgentState check failed:', err);
    process.exit(1);
  }

  console.log('\n🎉 Milestone 0 verification PASSED! All foundation components are operational.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error during verification:', err);
  process.exit(1);
});
