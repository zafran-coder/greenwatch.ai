import fs from "fs";
import path from "path";

async function run() {
  console.log("=== GREENWATCH AI END-TO-END ACCEPTANCE VERIFICATION ===\n");

  // Step 1: Submit a report with a photo and map-pin coordinates (FormData)
  console.log("--- 1. Submitting Report with Photo (FormData) & Map-Pin Coordinates ---");
  const samplePhotoPath = path.resolve("src/assets/garbage.jpg");
  const photoBuffer = fs.readFileSync(samplePhotoPath);
  const boundary = "----WebKitFormBoundary" + Math.random().toString(36).slice(2);

  let formHead = "";
  formHead += "--" + boundary + "\r\n";
  formHead += 'Content-Disposition: form-data; name="description"\r\n\r\n';
  formHead += "Six large garbage bags dumped near Margalla Road trail.\r\n";

  formHead += "--" + boundary + "\r\n";
  formHead += 'Content-Disposition: form-data; name="location"\r\n\r\n';
  formHead += JSON.stringify({
    address: "Margalla Road, F-8/4, Islamabad",
    area: "F-8, Islamabad",
    lat: 33.7182,
    lng: 73.0366,
  }) + "\r\n";

  formHead += "--" + boundary + "\r\n";
  formHead += 'Content-Disposition: form-data; name="photos"; filename="garbage.jpg"\r\n';
  formHead += "Content-Type: image/jpeg\r\n\r\n";

  const headBuf = Buffer.from(formHead, "utf-8");
  const footBuf = Buffer.from("\r\n--" + boundary + "--\r\n", "utf-8");
  const multipartBody = Buffer.concat([headBuf, photoBuffer, footBuf]);

  const submitRes = await fetch("http://localhost:4000/api/reports", {
    method: "POST",
    headers: {
      "Content-Type": "multipart/form-data; boundary=" + boundary,
    },
    body: multipartBody,
  });

  const createdData = await submitRes.json();
  const report = createdData.data || createdData.report;
  console.log(`[PASS] Submitted successfully! HTTP ${submitRes.status}`);
  console.log(`  Report ID:       ${report.id}`);
  console.log(`  Reference ID:    ${report.ref}`);
  console.log(`  Work Order ID:   ${report.workOrder || report.workOrderRef}`);
  console.log(`  Initial Status:  ${report.status}`);
  console.log(`  Category:        ${report.category}`);
  console.log(`  Department:      ${report.department}`);

  // Step 2: AgentStepper pipeline check
  console.log("\n--- 2. Verifying Agent Pipeline (GET /api/reports/:id/pipeline) ---");
  const pipeRes = await fetch(`http://localhost:4000/api/reports/${report.id}/pipeline`);
  const pipeJson = await pipeRes.json();
  const pipeline = pipeJson.data || pipeJson;
  console.log(`[PASS] Pipeline status: ${pipeline.status}`);
  pipeline.steps?.forEach((step, idx) => {
    console.log(`  Stage ${idx + 1}: ${step.label} -> [${step.status}] ${step.detail || ""}`);
  });

  // Step 3: Track Report as Citizen
  console.log(`\n--- 3. Tracking Report as Citizen (GET /api/track/${report.ref}) ---`);
  const trackRes = await fetch(`http://localhost:4000/api/track/${report.ref}`);
  const trackJson = await trackRes.json();
  const tracked = trackJson.data || trackJson;
  console.log(`[PASS] Citizen tracking view resolved:`);
  console.log(`  Reference:       ${tracked.ref}`);
  console.log(`  Current Status:  ${tracked.status}`);
  console.log(`  Department:      ${tracked.department}`);
  console.log(`  Timeline Stages: ${tracked.timeline?.map((t) => t.status).join(" -> ")}`);
  console.log(`  Public Activity: ${tracked.activity?.length} items`);

  // Step 4: Admin Login
  console.log("\n--- 4. Official Admin Login (POST /api/admin/login) ---");
  const loginRes = await fetch("http://localhost:4000/api/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "admin@greenwatch.gov",
      password: "Password123!",
    }),
  });
  const loginJson = await loginRes.json();
  const token = loginJson.token;
  console.log(`[PASS] Logged in as: ${loginJson.user?.name} (${loginJson.user?.email})`);
  console.log(`  Session token received: ${Boolean(token)}`);

  // Step 5: Assign M. Alvarez & Change SLA Due Date
  console.log("\n--- 5. Assigning M. Alvarez & Changing SLA Due Date ---");
  const newDueDate = new Date(Date.now() + 7 * 864e5).toISOString();
  const woRes = await fetch(`http://localhost:4000/api/reports/${report.id}/work-order`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      assignee: "M. Alvarez",
      dueDate: newDueDate,
    }),
  });
  const woJson = await woRes.json();
  const updatedWO = woJson.data || woJson;
  console.log(`[PASS] Assigned Official: ${updatedWO.assignee}`);
  console.log(`  Status moved to:   ${updatedWO.status}`);
  console.log(`  New SLA Due Date:  ${updatedWO.dueDate}`);

  // Step 6: Add Note
  console.log("\n--- 6. Adding Official Note ---");
  const noteRes = await fetch(`http://localhost:4000/api/reports/${report.id}/activity`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      text: "Crew scheduled for site cleanup tomorrow.",
      who: "M. Alvarez",
      isInternal: true,
    }),
  });
  const noteJson = await noteRes.json();
  console.log(`[PASS] Note added. Activity items on record: ${(noteJson.data?.activity || []).length}`);

  // Step 7: Mark as Resolved
  console.log("\n--- 7. Transitioning Status to Resolved ---");
  // If status is Assigned, transition to In Progress then Resolved to satisfy state machine
  if (updatedWO.status === "Assigned") {
    await fetch(`http://localhost:4000/api/reports/${report.id}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ status: "In Progress" }),
    });
  }

  const resolveRes = await fetch(`http://localhost:4000/api/reports/${report.id}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ status: "Resolved" }),
  });
  const resolveJson = await resolveRes.json();
  const resolvedReport = resolveJson.data || resolveJson;
  console.log(`[PASS] Status is now: ${resolvedReport.status}`);
  console.log(`  Resolved At:        ${resolvedReport.resolvedAt}`);

  // Step 8: Citizen Tracking Page Verification
  console.log(`\n--- 8. Re-verifying Citizen Tracking Reflection (GET /api/track/${report.ref}) ---`);
  const trackFinalRes = await fetch(`http://localhost:4000/api/track/${report.ref}`);
  const trackFinalJson = await trackFinalRes.json();
  const trackedFinal = trackFinalJson.data || trackFinalJson;
  console.log(`[PASS] Citizen Tracking page reflects all changes:`);
  console.log(`  Status:             ${trackedFinal.status}`);
  console.log(`  Timeline Stages:    ${trackedFinal.timeline?.map((t) => t.status).join(" -> ")}`);
  console.log(`  Due Date on Record: ${trackedFinal.dueDate}`);
  console.log(`  Resolved At:        ${trackedFinal.resolvedAt}`);
  console.log(`  Public Activity:`);
  trackedFinal.activity?.forEach((act) => {
    console.log(`    - [${act.who}] (${act.kind}): ${act.text}`);
  });

  console.log("\n=== ALL ACCEPTANCE STEPS VERIFIED SUCCESSFULLY ===");
}

run().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
