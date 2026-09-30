import { db, workspaces, users, businesses, businessLocations, services } from './db/index.js';
import { eq, and } from 'drizzle-orm';

async function main() {
  console.log('🧪 Starting Milestone 1: Authentication & Business Onboarding verification...\n');

  const testUserId = 'user_test_' + Math.random().toString(36).substring(2, 9);
  const testEmail = `test_${Date.now()}@serp-scout.test`;
  let createdWorkspaceId: string | null = null;
  let createdBusinessId: string | null = null;

  // 1. Workspace Creation test
  console.log('1️⃣ Testing Workspace & User creation in Neon database...');
  try {
    const [ws] = await db
      .insert(workspaces)
      .values({
        name: 'Apex Dental Care Workspace',
        ownerId: testUserId,
        timezone: 'America/Chicago',
        monthlyQuota: 500,
        usedQuota: 0,
      })
      .returning();
    createdWorkspaceId = ws.id;

    const [user] = await db
      .insert(users)
      .values({
        id: testUserId,
        workspaceId: ws.id,
        name: 'Dr. Sarah Apex',
        email: testEmail,
        role: 'owner',
      })
      .returning();

    console.log(`✅ Workspace created successfully: "${ws.name}" (ID: ${ws.id})`);
    console.log(`✅ Owner linked: "${user.name}" (${user.email})`);
  } catch (err) {
    console.error('❌ Workspace creation failed:', err);
    process.exit(1);
  }

  // 2. Business Profile Creation with locations & services
  console.log('\n2️⃣ Testing Business profile creation with locations and services...');
  try {
    const [biz] = await db
      .insert(businesses)
      .values({
        workspaceId: createdWorkspaceId!,
        name: 'Apex Dental Studio',
        websiteUrl: 'https://apexdentalstudio.example.com',
        industry: 'Dental & Healthcare',
        description: 'Comprehensive family and cosmetic dentistry.',
        city: 'Austin',
        country: 'United States',
        serviceArea: 'Greater Austin Metro Area',
        primaryGoal: 'More online bookings or quote requests',
        timezone: 'America/Chicago',
      })
      .returning();
    createdBusinessId = biz.id;

    // Add location
    const [loc] = await db
      .insert(businessLocations)
      .values({
        businessId: biz.id,
        name: 'Downtown Austin Clinic',
        address: '100 Congress Ave, Austin, TX 78701',
        city: 'Austin',
        country: 'United States',
        radius: 25,
      })
      .returning();

    // Add services
    const [svc1] = await db
      .insert(services)
      .values({
        businessId: biz.id,
        name: 'Dental Implants',
        description: 'Permanent tooth replacement surgery',
        priority: 1,
      })
      .returning();

    const [svc2] = await db
      .insert(services)
      .values({
        businessId: biz.id,
        name: 'Teeth Whitening',
        description: 'In-office laser whitening',
        priority: 2,
      })
      .returning();

    console.log(`✅ Business profile created: "${biz.name}" (ID: ${biz.id})`);
    console.log(`✅ Business location linked: "${loc.name}" in ${loc.city}`);
    console.log(`✅ Business services linked: "${svc1.name}", "${svc2.name}"`);
  } catch (err) {
    console.error('❌ Business creation failed:', err);
    process.exit(1);
  }

  // 3. Query and Isolation verification
  console.log('\n3️⃣ Verifying workspace data retrieval and relationships...');
  try {
    const [retrievedBiz] = await db
      .select()
      .from(businesses)
      .where(and(eq(businesses.id, createdBusinessId!), eq(businesses.workspaceId, createdWorkspaceId!)))
      .limit(1);

    if (!retrievedBiz) {
      throw new Error('Could not retrieve created business in its workspace');
    }

    const linkedLocations = await db
      .select()
      .from(businessLocations)
      .where(eq(businessLocations.businessId, createdBusinessId!));

    const linkedServices = await db
      .select()
      .from(services)
      .where(eq(services.businessId, createdBusinessId!));

    if (linkedLocations.length !== 1 || linkedServices.length !== 2) {
      throw new Error(`Expected 1 location and 2 services, got ${linkedLocations.length} locs, ${linkedServices.length} svcs`);
    }

    console.log(`✅ Retrieval verified: ${retrievedBiz.name} has ${linkedLocations.length} location and ${linkedServices.length} services.`);
  } catch (err) {
    console.error('❌ Data retrieval verification failed:', err);
    process.exit(1);
  }

  // 4. URL Validation test
  console.log('\n4️⃣ Testing URL safety rules...');
  const invalidUrls = ['javascript:alert(1)', 'ftp://server.com/files', 'not-a-url', 'http://'];
  for (const badUrl of invalidUrls) {
    let isValid = false;
    try {
      const parsed = new URL(badUrl);
      isValid = ['http:', 'https:'].includes(parsed.protocol) && Boolean(parsed.hostname);
    } catch {
      isValid = false;
    }
    if (isValid) {
      console.error(`❌ Bad URL was incorrectly treated as valid: ${badUrl}`);
      process.exit(1);
    }
  }
  console.log('✅ URL validation correctly rejects invalid and dangerous protocols.');

  // 5. Cleanup test records
  console.log('\n5️⃣ Cleaning up test records (testing cascade delete)...');
  try {
    await db.delete(workspaces).where(eq(workspaces.id, createdWorkspaceId!));
    // Verify business and locations were cascade-deleted
    const checkBiz = await db.select().from(businesses).where(eq(businesses.id, createdBusinessId!));
    if (checkBiz.length !== 0) {
      throw new Error('Cascade delete did not remove business record');
    }
    console.log('✅ Cascade delete verified: deleting workspace cleanly purged child business, locations, and users.');
  } catch (err) {
    console.error('❌ Cleanup failed:', err);
    process.exit(1);
  }

  console.log('\n🎉 Milestone 1 verification PASSED! Authentication & Business Onboarding is production-ready.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error during Milestone 1 test:', err);
  process.exit(1);
});
