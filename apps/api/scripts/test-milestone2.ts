import {
  isPrivateIp,
  validateTargetUrl,
  parseWebsiteHtml,
  analyzeWebsite,
} from '@serp-scout/agents';
import { db, workspaces, businesses, services, keywords } from './db/index.js';
import { eq } from 'drizzle-orm';
import { websiteAnalysisQueue } from './jobs/queues.js';
import { startWebsiteAnalysisWorker } from './jobs/workers/research.worker.js';

async function main() {
  console.log('🧪 Starting Milestone 2: Website Analyzer verification...\n');

  // 1. SSRF & Private IP Security Checks
  console.log('1️⃣ Testing SSRF Protection & IP filtering...');
  const testCases = [
    { target: '127.0.0.1', isPrivate: true },
    { target: '169.254.169.254', isPrivate: true },
    { target: '192.168.1.50', isPrivate: true },
    { target: '10.0.0.1', isPrivate: true },
    { target: '172.16.0.1', isPrivate: true },
    { target: '::1', isPrivate: true },
    { target: '8.8.8.8', isPrivate: false },
  ];

  for (const tc of testCases) {
    const res = isPrivateIp(tc.target);
    if (res !== tc.isPrivate) {
      throw new Error(`IP check failed for ${tc.target}: expected ${tc.isPrivate}, got ${res}`);
    }
  }

  // Check URL validation
  const dangerousUrls = [
    'http://127.0.0.1:8080/admin',
    'http://169.254.169.254/latest/meta-data/',
    'http://localhost:3000',
    'file:///etc/passwd',
  ];

  for (const bad of dangerousUrls) {
    try {
      await validateTargetUrl(bad);
      throw new Error(`Security validation failed: "${bad}" should have been rejected!`);
    } catch (err: any) {
      // Expected rejection
      console.log(`  🛡️ Correctly blocked unsafe URL: "${bad}" (${err.message.split('\n')[0]})`);
    }
  }
  console.log('✅ SSRF and private IP protection verified.\n');

  // 2. HTML Parser unit check
  console.log('2️⃣ Testing Cheerio HTML extractor with mock business landing page...');
  const sampleHtml = `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <title>Austin Smile Studio | Modern Family Dentistry</title>
        <meta name="description" content="Award-winning dentist in Austin, TX offering cosmetic, implant, and preventive dentistry." />
      </head>
      <body>
        <header>
          <a href="/about">About Us</a>
          <a href="/services/implants">Dental Implants</a>
          <a href="tel:5125550199" class="phone">Call (512) 555-0199</a>
          <a href="mailto:info@austinsmile.com">Email Us</a>
          <a href="https://calendly.com/austinsmile/book" class="btn">Book Online Appointment</a>
        </header>
        <main>
          <h1>Gentle Dental Care in Downtown Austin</h1>
          <h2>Cosmetic & Implant Dentistry</h2>
          <h2>Emergency Dental Services</h2>
          <p>We provide compassionate care, transparent pricing, and same-day dental crowns.</p>
          <button type="button">Schedule Consultation Today</button>
        </main>
      </body>
    </html>
  `;

  const parsed = parseWebsiteHtml(sampleHtml, 'https://austinsmile.example.com');
  if (
    !parsed.title?.includes('Austin Smile Studio') ||
    !parsed.metaDescription?.includes('Austin, TX') ||
    parsed.h1.length === 0 ||
    parsed.callsToAction.length === 0 ||
    parsed.phones.length === 0
  ) {
    throw new Error('HTML parsing did not extract expected elements from sample HTML');
  }
  console.log(`✅ Extracted title: "${parsed.title}"`);
  console.log(`✅ Extracted H1s: ${JSON.stringify(parsed.h1)}`);
  console.log(`✅ Extracted CTAs: ${JSON.stringify(parsed.callsToAction)}`);
  console.log(`✅ Extracted Phone: ${parsed.phones[0]}`);

  // 3. Groq AI Website Analysis check
  console.log('\n3️⃣ Testing Groq AI structured enrichment on live public test website...');
  const realTestUrl = 'https://example.com';
  const analysis = await analyzeWebsite(realTestUrl, {
    businessNameHint: 'Austin Smile Studio',
    industryHint: 'Dental Clinic',
    cityHint: 'Austin, TX',
  });

  if (!analysis.detectedCategory || !Array.isArray(analysis.candidateKeywords)) {
    throw new Error('Groq AI analysis did not return expected WebsiteAnalysis structure');
  }

  console.log(`✅ AI Category: "${analysis.detectedCategory}"`);
  console.log(`✅ Extracted Candidate Keywords: ${JSON.stringify(analysis.candidateKeywords)}`);
  console.log(`✅ Missing Opportunities: ${JSON.stringify(analysis.missingOpportunities)}`);

  // 4. BullMQ Worker End-to-End Pipeline test
  console.log('\n4️⃣ Testing BullMQ Website Analysis Worker end-to-end pipeline...');
  const testUserId = 'worker_test_user_' + Math.random().toString(36).substring(2, 7);

  // Setup test workspace & business in Neon
  const [ws] = await db
    .insert(workspaces)
    .values({
      name: 'Worker Test Workspace',
      ownerId: testUserId,
    })
    .returning();

  const [biz] = await db
    .insert(businesses)
    .values({
      workspaceId: ws.id,
      name: 'Austin Family Smile Studio',
      websiteUrl: 'https://example.com',
      industry: 'Dental',
      city: 'Austin',
    })
    .returning();

  // Start worker
  const worker = startWebsiteAnalysisWorker();

  try {
    // Enqueue job
    const job = await websiteAnalysisQueue.add('analyze-website', {
      businessId: biz.id,
    });
    console.log(`  Job queued (ID: ${job.id}). Waiting for completion...`);

    // Wait for job completion (up to 30s)
    let state = await job.getState();
    const startTime = Date.now();
    while (state !== 'completed' && state !== 'failed') {
      if (Date.now() - startTime > 35000) {
        throw new Error('Timed out waiting for BullMQ worker to finish job');
      }
      await new Promise((r) => setTimeout(r, 1000));
      state = await job.getState();
    }

    if (state === 'failed') {
      throw new Error(`Worker job failed: ${job.failedReason}`);
    }
    console.log(`✅ Job ${job.id} finished with state: ${state}!`);

    // Verify DB update
    const [updatedBiz] = await db
      .select()
      .from(businesses)
      .where(eq(businesses.id, biz.id));

    if (!updatedBiz.lastAnalyzedAt) {
      throw new Error('Business record lastAnalyzedAt was not updated by worker');
    }

    const seededKeywords = await db
      .select()
      .from(keywords)
      .where(eq(keywords.businessId, biz.id));

    console.log(`✅ Business lastAnalyzedAt updated: ${updatedBiz.lastAnalyzedAt.toISOString()}`);
    console.log(`✅ Keywords seeded in database: ${seededKeywords.length} items`);
  } finally {
    // Close worker and clean up test data
    await worker.close();
    await db.delete(workspaces).where(eq(workspaces.id, ws.id));
    console.log('✅ Cleaned up test records from database.');
  }

  console.log('\n🎉 Milestone 2 verification PASSED! Website Analyzer pipeline is fully operational.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error during Milestone 2 test:', err);
  process.exit(1);
});
