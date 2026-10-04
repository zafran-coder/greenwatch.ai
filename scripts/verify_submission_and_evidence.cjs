const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

async function main() {
  console.log('================================================================');
  console.log('VERIFICATION: Submit Flow, Supabase DB Row, Evidence Bucket & Park Triage');
  console.log('================================================================\n');

  // Prepare photo from real asset
  const photoPath = path.join(__dirname, '../src/assets/garbage.jpg');
  if (!fs.existsSync(photoPath)) {
    throw new Error('Test asset not found: ' + photoPath);
  }
  const photoBuffer = fs.readFileSync(photoPath);

  // Construct multipart form data
  const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
  const locationObj = {
    address: 'Fatima Jinnah Park (F-9), Islamabad',
    area: 'Sector F-9',
    lat: 33.7011,
    lng: 73.0189,
  };

  const crlf = '\r\n';
  let bodyParts = [];

  // Description field
  bodyParts.push(Buffer.from(
    `--${boundary}${crlf}` +
    `Content-Disposition: form-data; name="description"${crlf}${crlf}` +
    `Garbage dumped near a public park with overflowing plastic waste and bad odor.${crlf}`
  ));

  // Location field
  bodyParts.push(Buffer.from(
    `--${boundary}${crlf}` +
    `Content-Disposition: form-data; name="location"${crlf}${crlf}` +
    `${JSON.stringify(locationObj)}${crlf}`
  ));

  // Photos field
  bodyParts.push(Buffer.from(
    `--${boundary}${crlf}` +
    `Content-Disposition: form-data; name="photos"; filename="park_garbage.jpg"${crlf}` +
    `Content-Type: image/jpeg${crlf}${crlf}`
  ));
  bodyParts.push(photoBuffer);
  bodyParts.push(Buffer.from(crlf));

  // End boundary
  bodyParts.push(Buffer.from(`--${boundary}--${crlf}`));
  const fullBody = Buffer.concat(bodyParts);

  console.log('1. Sending POST /api/reports to running server (http://localhost:4000)...');
  const res = await fetch('http://localhost:4000/api/reports', {
    method: 'POST',
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': String(fullBody.length),
    },
    body: fullBody,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`API returned error ${res.status}: ${errText}`);
  }

  const json = await res.json();
  const report = json.data;
  const photos = json.photos || [];
  const steps = json.steps || [];

  console.log('   Status Code:', res.status, 'Created');
  console.log('   Report ID:', report.id);
  console.log('   Reference:', report.ref);
  console.log('   Work Order:', report.workOrder);
  console.log('   Category:', report.category);
  console.log('   Priority / Severity:', report.priority);
  console.log('   Department:', report.department);
  console.log('   Status:', report.status);

  // Verification 3: Direct Supabase verification
  console.log('\n2. Verifying saved row directly from Supabase PostgreSQL database...');
  const supabaseUrl = process.env.SUPABASE_URL || 'https://kbrwjxonrllfysjorzvz.supabase.co';
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  const { data: dbRow, error: dbError } = await supabase
    .from('reports')
    .select('id, ref, category, priority, department, status, work_order_ref, photos, ai, address, area, lat, lng, created_at')
    .eq('id', report.id)
    .single();

  if (dbError) {
    console.error('   Supabase query error:', dbError.message);
  } else {
    console.log('   [CONFIRMED IN SUPABASE]:');
    console.log('   - id:            ', dbRow.id);
    console.log('   - ref:           ', dbRow.ref);
    console.log('   - work_order_ref:', dbRow.work_order_ref);
    console.log('   - category:      ', dbRow.category);
    console.log('   - priority:      ', dbRow.priority);
    console.log('   - department:    ', dbRow.department);
    console.log('   - status:        ', dbRow.status);
    console.log('   - address:       ', dbRow.address);
    console.log('   - coordinates:   ', `${dbRow.lat}, ${dbRow.lng}`);
    console.log('   - photos array:  ', JSON.stringify(dbRow.photos));
  }

  // Verification 4: Photo upload and Evidence Agent image inspection
  console.log('\n3. Verifying photo upload in "evidence" storage bucket & image analysis...');
  if (photos && photos.length > 0) {
    const photo = photos[0];
    console.log('   - Storage Bucket URL:  ', photo.url);
    console.log('   - Stored in "evidence":', photo.url.includes('/storage/v1/object/public/evidence/'));
    console.log('   - Main dimensions:     ', `${photo.width}x${photo.height}`);
    console.log('   - Main size:           ', `${photo.size} bytes`);
    console.log('   - Thumbnail URL:       ', photo.thumbnailUrl);
    console.log('   - Evidence Analysis:   ', JSON.stringify(photo.evidenceAnalysis, null, 2));
  } else if (report.photos && report.photos.length > 0) {
    console.log('   - Photo URL:           ', report.photos[0]);
    console.log('   - Stored in "evidence":', report.photos[0].includes('/evidence/'));
  }

  // Check evidence step output in AI pipeline
  const evidenceStep = steps.find(s => s.key === 'evidence');
  if (evidenceStep) {
    console.log('\n   [Evidence Agent Pipeline Step]:');
    console.log('   - Step status:         ', evidenceStep.status);
    console.log('   - Detail:              ', evidenceStep.detail);
    console.log('   - Quality:             ', evidenceStep.output.quality);
    console.log('   - Evidence Score:      ', evidenceStep.output.evidenceScore);
    console.log('   - Supports Description:', evidenceStep.output.supportsDescription);
    console.log('   - Image Details:       ', JSON.stringify(evidenceStep.output.details));
  }

  // Verification 6: Park garbage severity and routing
  console.log('\n4. Verifying "Garbage dumped near a public park" rule evaluation:');
  const triageStep = steps.find(s => s.key === 'triage');
  const priorityStep = steps.find(s => s.key === 'priority');
  const routingStep = steps.find(s => s.key === 'routing');
  console.log('   - Triage Category:     ', triageStep?.output?.category, `(${triageStep?.output?.categoryLabel})`);
  console.log('   - Priority Severity:   ', priorityStep?.output?.priority);
  console.log('   - Priority Reason:     ', priorityStep?.output?.reason);
  console.log('   - Routing Department:  ', routingStep?.output?.department);
  console.log('   - Work Order:          ', report.workOrder);

  const passed6 = (report.priority === 'High' || priorityStep?.output?.priority === 'High') &&
                  (report.department === 'Sanitation' || routingStep?.output?.department === 'Sanitation');
  console.log(`\n   >>> CRITERION 6 RESULT: ${passed6 ? 'PASSED (High + Sanitation)' : 'FAILED'}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
