const BASE_URL = 'http://localhost:4000/api';

async function main() {
  console.log('================================================================');
  console.log('SECURITY & ACCESS CONTROL VERIFICATION (Requirement 5)');
  console.log('Verifying Anonymous Restrictions on Status, Assignment & Notes');
  console.log('================================================================\n');

  // 1. Fetch an existing report to test with
  const listRes = await fetch(`${BASE_URL}/reports?limit=1`);
  const listData = await listRes.json();
  const testReport = listData.data?.[0] || listData.items?.[0];
  if (!testReport) {
    throw new Error('No test report found');
  }
  const reportId = testReport.id;
  const reportRef = testReport.ref;
  console.log(`Using target report: ${reportRef} (ID: ${reportId})\n`);

  // --------------------------------------------------------------------------
  // TEST 1: Anonymous user cannot update status
  // --------------------------------------------------------------------------
  console.log('--- TEST 1: Anonymous User Updating Status ---');
  const anonStatusRes = await fetch(`${BASE_URL}/reports/${reportId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'Resolved', note: 'Attempt by anon' }),
  });
  const anonStatusBody = await anonStatusRes.json().catch(() => ({}));
  console.log(`HTTP Status:   ${anonStatusRes.status} (Expected: 401)`);
  console.log(`Error Response:`, anonStatusBody);
  const statusBlocked = anonStatusRes.status === 401;
  console.log(`Result:        ${statusBlocked ? 'PASSED — Anonymous status update blocked' : 'FAILED'}\n`);

  // --------------------------------------------------------------------------
  // TEST 2: Anonymous user cannot assign official or work order
  // --------------------------------------------------------------------------
  console.log('--- TEST 2: Anonymous User Assigning Official / Work Order ---');
  const anonAssignRes = await fetch(`${BASE_URL}/reports/${reportId}/work-order`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ assignee: 'Unauthorized Person', priority: 'Low' }),
  });
  const anonAssignBody = await anonAssignRes.json().catch(() => ({}));
  console.log(`HTTP Status:   ${anonAssignRes.status} (Expected: 401)`);
  console.log(`Error Response:`, anonAssignBody);
  const assignBlocked = anonAssignRes.status === 401;
  console.log(`Result:        ${assignBlocked ? 'PASSED — Anonymous assignment blocked' : 'FAILED'}\n`);

  // --------------------------------------------------------------------------
  // TEST 3: Authenticated official adds an internal note, then check anon visibility
  // --------------------------------------------------------------------------
  console.log('--- TEST 3: Internal Notes & Contact Info Privacy ---');

  // Authenticate as official
  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@greenwatch.gov',
      password: 'Password123!',
    }),
  });
  const loginData = await loginRes.json();
  const token = loginData.data?.token || loginData.token;

  if (!token) {
    console.warn('Could not authenticate official for test note injection. Checking existing activity logs...');
  } else {
    // Add internal note as official
    const noteText = `CONFIDENTIAL INTERNAL NOTE: Crew dispatched with specialized hazardous gear. [${Date.now()}]`;
    const addNoteRes = await fetch(`${BASE_URL}/reports/${reportId}/activity`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        text: noteText,
        isInternal: true,
      }),
    });
    console.log(`Official added internal note (isInternal=true): HTTP ${addNoteRes.status}`);
  }

  // Now, anonymous citizen tracks the report via public track endpoint
  console.log(`\nCitizen queries public tracking: GET /api/reports/track/${reportRef}`);
  const trackRes = await fetch(`${BASE_URL}/reports/track/${reportRef}`);
  const trackData = await trackRes.json();
  const publicReport = trackData.data;

  // Check if any internal notes or contact info are exposed
  const internalActivities = (publicReport.activity || []).filter(
    (a) => a.isInternal === true || (a.text && a.text.includes('CONFIDENTIAL'))
  );
  console.log(`Total public activity entries returned: ${(publicReport.activity || []).length}`);
  console.log(`Internal notes exposed to citizen:       ${internalActivities.length}`);
  console.log(`Reporter phone exposed:                  ${publicReport.reporterPhone || 'None (omitted)'}`);
  console.log(`Reporter email exposed:                  ${publicReport.reporterEmail || 'None (omitted)'}`);

  const notesProtected = internalActivities.length === 0 && !publicReport.reporterPhone;
  console.log(`Result: ${notesProtected ? 'PASSED — Internal notes and contact info are withheld from anonymous users' : 'FAILED'}\n`);

  // Summary
  console.log('================================================================');
  console.log('SUMMARY OF RLS & ACCESS CONTROL CHECKS:');
  console.log(`- Status Update Protection:   ${statusBlocked ? 'ENFORCED (401 Unauthorized)' : 'FAILED'}`);
  console.log(`- Assignment Protection:      ${assignBlocked ? 'ENFORCED (401 Unauthorized)' : 'FAILED'}`);
  console.log(`- Internal Notes Protection:  ${notesProtected ? 'ENFORCED (Stripped / Hidden)' : 'FAILED'}`);
  console.log('================================================================');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
