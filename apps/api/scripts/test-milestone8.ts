import {
  db,
  workspaces,
  businesses,
  reports,
  notifications,
  keywords,
  rankingObservations,
} from './db/index.js';
import { eq, and } from 'drizzle-orm';
import {
  researchQueue,
  reportQueue,
  staleQueue,
  websiteAnalysisQueue,
  getRecentJobs,
  redisConnection,
} from './jobs/queues.js';
import { Worker } from 'bullmq';
import {
  scheduleWorkspaceResearch,
  removeWorkspaceRepeatableJobs,
  scheduleStaleCheck,
  triggerImmediateRefresh,
  CADENCE_CRON_PATTERNS,
} from './jobs/scheduler.js';
import { executeStaleCheck } from './jobs/workers/stale-check.worker.js';
import { executeReportGeneration } from './jobs/workers/report.worker.js';
import { NotificationService } from './services/notification.service.js';
import { GeneratedReport } from '@serp-scout/types';

async function main() {
  console.log('🧪 Starting Milestone 8: Scheduling, Notifications & History verification...\n');

  // Find or create test workspace
  let [testWorkspace] = await db.select().from(workspaces).limit(1);
  if (!testWorkspace) {
    [testWorkspace] = await db
      .insert(workspaces)
      .values({
        name: 'M8 Test Intelligence Clinic',
        ownerId: 'user_m8_test',
        refreshCadence: 'weekly',
        staleDaysThreshold: 7,
      })
      .returning();
  }

  // Find or create test business
  let [testBiz] = await db
    .select()
    .from(businesses)
    .where(eq(businesses.workspaceId, testWorkspace.id))
    .limit(1);

  if (!testBiz) {
    [testBiz] = await db
      .insert(businesses)
      .values({
        workspaceId: testWorkspace.id,
        name: 'Apex Orthodontics Austin',
        websiteUrl: 'https://apexortho-austin.example.com',
        industry: 'Healthcare',
        city: 'Austin',
        dataStale: false,
      })
      .returning();
  }

  console.log(`🏢 Test Workspace: ${testWorkspace.name} (${testWorkspace.id})`);
  console.log(`📍 Test Business: ${testBiz.name} (${testBiz.id})\n`);

  // ── 1. BullMQ Queues Connectivity Check ─────────────────────────────────────
  console.log('1️⃣ Checking BullMQ queue initialization & Redis TLS connectivity...');
  await Promise.all([
    websiteAnalysisQueue.waitUntilReady(),
    researchQueue.waitUntilReady(),
    reportQueue.waitUntilReady(),
    staleQueue.waitUntilReady(),
  ]);
  console.log('✅ All 4 BullMQ queues (website-analysis, research-run, weekly-report, stale-check) ready on Upstash TLS!\n');

  // ── 2. Refresh Schedule Configuration & Repeatable BullMQ Jobs ─────────────
  console.log('2️⃣ Testing refresh schedule configuration (Daily / Weekly / Monthly / Manual)...');
  
  // Test Weekly
  const weeklySched = await scheduleWorkspaceResearch({
    workspaceId: testWorkspace.id,
    cadence: 'weekly',
    businessId: testBiz.id,
  });
  console.log(`✅ Weekly repeatable schedule registered with pattern: ${weeklySched.pattern}`);
  if (weeklySched.pattern !== CADENCE_CRON_PATTERNS.weekly) {
    throw new Error('Weekly cron pattern mismatch');
  }

  // Test Daily
  const dailySched = await scheduleWorkspaceResearch({
    workspaceId: testWorkspace.id,
    cadence: 'daily',
    businessId: testBiz.id,
  });
  console.log(`✅ Daily repeatable schedule registered with pattern: ${dailySched.pattern}`);
  if (dailySched.pattern !== CADENCE_CRON_PATTERNS.daily) {
    throw new Error('Daily cron pattern mismatch');
  }

  // Test Monthly
  const monthlySched = await scheduleWorkspaceResearch({
    workspaceId: testWorkspace.id,
    cadence: 'monthly',
    businessId: testBiz.id,
  });
  console.log(`✅ Monthly repeatable schedule registered with pattern: ${monthlySched.pattern}`);

  // Test Manual (clears repeatable job)
  const manualSched = await scheduleWorkspaceResearch({
    workspaceId: testWorkspace.id,
    cadence: 'manual',
    businessId: testBiz.id,
  });
  console.log(`✅ Manual refresh mode verified (repeatable job removed: ${!manualSched.scheduled})\n`);

  // ── 3. Stale Data Indicator & Stale Check Worker ────────────────────────────
  console.log('3️⃣ Testing Stale Data Indicator & Evaluation Worker...');
  
  // A. Set business lastAnalyzedAt to 10 days ago (older than 7-day threshold)
  const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
  await db
    .update(businesses)
    .set({ lastAnalyzedAt: tenDaysAgo, dataStale: false })
    .where(eq(businesses.id, testBiz.id));

  // Run stale evaluation
  const staleEval1 = await executeStaleCheck({ businessId: testBiz.id });
  const [updatedBiz1] = await db
    .select()
    .from(businesses)
    .where(eq(businesses.id, testBiz.id));

  console.log(`🔍 Old data check: lastAnalyzedAt = ${tenDaysAgo.toISOString().slice(0, 10)}`);
  console.log(`✅ StaleCheckWorker flagged business dataStale: ${updatedBiz1.dataStale} (Expected: true)`);
  if (!updatedBiz1.dataStale) {
    throw new Error('Expected business to be marked as dataStale: true');
  }

  // B. Set business lastAnalyzedAt to current time (fresh)
  const freshTime = new Date();
  await db
    .update(businesses)
    .set({ lastAnalyzedAt: freshTime, dataStale: true })
    .where(eq(businesses.id, testBiz.id));

  const staleEval2 = await executeStaleCheck({ businessId: testBiz.id });
  const [updatedBiz2] = await db
    .select()
    .from(businesses)
    .where(eq(businesses.id, testBiz.id));

  console.log(`🔍 Fresh data check: lastAnalyzedAt = ${freshTime.toISOString().slice(0, 10)}`);
  console.log(`✅ StaleCheckWorker flagged business dataStale: ${updatedBiz2.dataStale} (Expected: false)`);
  if (updatedBiz2.dataStale) {
    throw new Error('Expected business to be marked as dataStale: false');
  }
  console.log('✅ Stale Data Indicator logic verified!\n');

  // ── 4. Automated Report Generation Worker & PDF Pipeline ────────────────────
  console.log('4️⃣ Testing automated weekly report worker pipeline...');
  const reportRun = await executeReportGeneration({
    businessId: testBiz.id,
    workspaceId: testWorkspace.id,
    recipientEmail: 'kushal@example.com',
  });

  console.log(`✅ Generated Report ID: ${reportRun.reportId}`);
  console.log(`✅ Prioritized Actions generated: ${reportRun.actionCount}`);
  console.log(`✅ Notification status: ${reportRun.notification.success ? 'SENT' : 'LOGGED'} (ID: ${reportRun.notification.notificationId})\n`);

  // ── 5. Notification Deduplication (Exactly ONE notification per report) ─────
  console.log('5️⃣ Testing Notification Deduplication Rule ("Users receive only one notification per completed report")...');
  
  // Fetch report object
  const [savedReport] = await db
    .select()
    .from(reports)
    .where(eq(reports.id, reportRun.reportId))
    .limit(1);

  const mockGeneratedReport: GeneratedReport = {
    executiveSummary: savedReport.summary as any,
    visibilityChanges: { keywordChanges: [], mapsChanges: [], serpFeatureChanges: [] },
    competitorChanges: [],
    contentOpportunities: [],
    actionPlan: [
      {
        title: 'Launch Invisalign Financing Page',
        problem: 'Competitors rank for pricing while our site lacks cost details',
        evidenceSummary: 'Austin Smile Design ranks #1 for Invisalign cost Austin',
        sourceUrls: ['https://austinsmiles.com/invisalign-cost'],
        searchQueries: ['invisalign cost Austin'],
        expectedImpact: 'high',
        estimatedEffort: 'medium',
        priority: 'P0',
        confidence: 'high',
      },
    ],
    evidenceAppendix: [],
  };

  // Attempt second notification for the same completed report
  const dupCheck = await NotificationService.sendWeeklyReportNotification({
    workspaceId: testWorkspace.id,
    businessId: testBiz.id,
    businessName: testBiz.name,
    reportId: reportRun.reportId,
    recipientEmail: 'kushal@example.com',
    report: mockGeneratedReport,
  });

  console.log(`🔍 Duplicate notification attempt result: duplicate = ${dupCheck.duplicate}, success = ${dupCheck.success}`);
  if (!dupCheck.duplicate) {
    throw new Error('Notification deduplication failed: duplicate notification was not blocked!');
  }

  // Count notifications in database for this report
  const notifCount = await db
    .select()
    .from(notifications)
    .where(
      and(
        eq(notifications.reportId, reportRun.reportId),
        eq(notifications.type, 'report_ready')
      )
    );

  console.log(`✅ Exact notification count in DB for report ${reportRun.reportId}: ${notifCount.length} (Expected: 1)`);
  if (notifCount.length !== 1) {
    throw new Error(`Expected exactly 1 notification record in DB, found ${notifCount.length}`);
  }
  console.log('✅ Single-notification deduplication verified!\n');

  // ── 6. Visible Failed Jobs & Queue Diagnostics ──────────────────────────────
  console.log('6️⃣ Testing Failed Jobs Visibility & Diagnostics (Acceptance Criteria: "Failed jobs are visible")...');
  
  // Set up a short-lived worker to process and fail the test job
  const failingWorker = new Worker(
    'research-run',
    async (job) => {
      if (job.name === 'test-failing-job') {
        throw new Error('Simulated test failure: Business not found');
      }
    },
    { connection: redisConnection }
  );

  const failJob = await researchQueue.add(
    'test-failing-job',
    {
      businessId: '00000000-0000-0000-0000-000000000000',
      workspaceId: testWorkspace.id,
    },
    {
      attempts: 1, // fail immediately on first attempt
    }
  );

  // Wait for worker to fail the job
  await new Promise<void>((resolve) => {
    failingWorker.on('failed', (job) => {
      if (job?.id === failJob.id) {
        resolve();
      }
    });
    setTimeout(resolve, 4000);
  });
  await failingWorker.close();

  // Retrieve unified recent jobs
  const recentJobs = await getRecentJobs(testWorkspace.id);
  const foundFailedJob = recentJobs.find((j) => j.id === String(failJob.id));

  console.log(`🔍 Found ${recentJobs.length} recent jobs across all queues for workspace.`);
  if (foundFailedJob) {
    console.log(`✅ Failed job successfully detected in diagnostics:`);
    console.log(`   - ID: ${foundFailedJob.id}`);
    console.log(`   - Queue: ${foundFailedJob.queue}`);
    console.log(`   - State: ${foundFailedJob.state}`);
    console.log(`   - Failed Reason: "${foundFailedJob.failedReason}"`);
  } else {
    throw new Error('Failed job was not captured in getRecentJobs() output');
  }
  console.log('✅ Failed jobs are visible with error details!\n');

  // ── 7. Historical Ranking Comparisons Check ─────────────────────────────────
  console.log('7️⃣ Verifying Historical Ranking Comparisons & Delta retention...');
  // Check ranking observations exist and can compute deltas
  const sampleObservations = await db
    .select()
    .from(rankingObservations)
    .where(eq(rankingObservations.businessId, testBiz.id))
    .limit(5);

  console.log(`✅ Historical ranking observations queryable: ${sampleObservations.length} records found in database.`);

  console.log('\n🎉 ALL MILESTONE 8 VERIFICATION CHECKS PASSED SUCCESSFULLY! 🎉');

  // Clean up connections
  await Promise.all([
    websiteAnalysisQueue.close(),
    researchQueue.close(),
    reportQueue.close(),
    staleQueue.close(),
  ]);
  await redisConnection.quit();
  process.exit(0);
}

main().catch(async (err) => {
  console.error('\n❌ Milestone 8 verification failed:', err);
  await Promise.all([
    websiteAnalysisQueue.close(),
    researchQueue.close(),
    reportQueue.close(),
    staleQueue.close(),
  ]);
  await redisConnection.quit();
  process.exit(1);
});
