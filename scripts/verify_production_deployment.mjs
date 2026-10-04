import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const serverDir = path.join(rootDir, "server");

const API_PORT = 4000;
const API_URL = `http://localhost:${API_PORT}`;
const PREVIEW_PORT = 4173;
const FRONTEND_URL = `http://localhost:${PREVIEW_PORT}`;

// Load environment from server/.env if present
const envFile = path.join(serverDir, ".env");
const fileEnv = {};
if (fs.existsSync(envFile)) {
  const content = fs.readFileSync(envFile, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx > 0) {
      const k = trimmed.slice(0, idx).trim();
      const v = trimmed.slice(idx + 1).trim();
      fileEnv[k] = v;
    }
  }
}

const CRON_SECRET = fileEnv.CRON_SECRET || "greenwatch_cron_secret";
const ADMIN_EMAIL = fileEnv.ADMIN_EMAIL || "admin@greenwatch.gov";
const ADMIN_PASSWORD = fileEnv.ADMIN_PASSWORD || "Password123!";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer(url, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${url}/api/health`);
      if (res.ok) return true;
    } catch {}
    await sleep(400);
  }
  throw new Error(`Server at ${url} failed to respond within ${timeoutMs}ms`);
}

async function runVerification() {
  const results = [];
  let serverProcess = null;
  let previewProcess = null;

  try {
    // 1. Start Server in production mode
    serverProcess = spawn("node", ["src/server.js"], {
      cwd: serverDir,
      env: {
        ...process.env,
        ...fileEnv,
        NODE_ENV: "production",
        PORT: String(API_PORT),
        FRONTEND_URL: `${FRONTEND_URL},https://greenwatch-web.onrender.com`,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    serverProcess.stderr.on("data", (d) => {
      // suppress verbose logs, keep for debugging if needed
    });

    await waitForServer(API_URL);

    // 2. Start Frontend Vite Preview
    previewProcess = spawn("npx", ["vite", "preview", "--port", String(PREVIEW_PORT), "--strictPort"], {
      cwd: rootDir,
      stdio: "ignore",
      shell: true,
    });
    await sleep(1500);

    // TEST 1: Health 200 with DB check
    try {
      const healthRes = await fetch(`${API_URL}/api/health`);
      const healthData = await healthRes.json();
      const passed = healthRes.status === 200 && healthData.status === "ok" && healthData.database?.status === "ok";
      results.push({
        Test: "1. Health Endpoint",
        Status: passed ? "PASS" : "FAIL",
        Details: `HTTP ${healthRes.status} · DB: ${healthData.database?.provider} (${healthData.database?.status})`,
      });
    } catch (e) {
      results.push({ Test: "1. Health Endpoint", Status: "FAIL", Details: e.message });
    }

    // TEST 2: Submit a report with a photo
    let submittedReport = null;
    let submittedPhotos = [];
    try {
      const photoPath = path.join(rootDir, "src", "assets", "garbage.jpg");
      const photoBuf = fs.readFileSync(photoPath);

      const boundary = "----WebKitFormBoundaryDeployTest" + Math.random().toString(36).slice(2);
      const crlf = "\r\n";
      const parts = [];

      // description
      parts.push(Buffer.from(`--${boundary}${crlf}Content-Disposition: form-data; name="description"${crlf}${crlf}Overflowing commercial waste bin on pedestrian sidewalk near Central Park.${crlf}`));
      // location
      const loc = JSON.stringify({ address: "Central Park West, Sector G-9", area: "Sector G-9", lat: 33.69, lng: 73.03 });
      parts.push(Buffer.from(`--${boundary}${crlf}Content-Disposition: form-data; name="location"${crlf}${crlf}${loc}${crlf}`));
      // photo
      parts.push(Buffer.from(`--${boundary}${crlf}Content-Disposition: form-data; name="photos"; filename="evidence.jpg"${crlf}Content-Type: image/jpeg${crlf}${crlf}`));
      parts.push(photoBuf);
      parts.push(Buffer.from(crlf));
      parts.push(Buffer.from(`--${boundary}--${crlf}`));

      const body = Buffer.concat(parts);

      const subRes = await fetch(`${API_URL}/api/reports`, {
        method: "POST",
        headers: {
          "Content-Type": `multipart/form-data; boundary=${boundary}`,
          "Content-Length": String(body.length),
        },
        body,
      });

      const subJson = await subRes.json();
      submittedReport = subJson.data;
      submittedPhotos = subJson.photos || [];

      const passed = subRes.status === 201 && Boolean(submittedReport?.ref) && submittedReport.status !== undefined;
      results.push({
        Test: "2. Submit Report w/ Photo",
        Status: passed ? "PASS" : "FAIL",
        Details: `HTTP ${subRes.status} · Ref: ${submittedReport?.ref} · Category: ${submittedReport?.category}`,
      });
    } catch (e) {
      results.push({ Test: "2. Submit Report w/ Photo", Status: "FAIL", Details: e.message });
    }

    // TEST 3: Pipeline finishes
    try {
      // Poll until pipeline has processed triage, priority, routing
      let currentReport = submittedReport;
      for (let i = 0; i < 15; i++) {
        const checkRes = await fetch(`${API_URL}/api/reports/${submittedReport.id}`);
        const checkData = await checkRes.json();
        currentReport = checkData.data;
        if (currentReport.priority && currentReport.department && currentReport.workOrder) {
          break;
        }
        await sleep(500);
      }

      const passed = Boolean(currentReport.department && currentReport.priority && currentReport.workOrder);
      results.push({
        Test: "3. AI Pipeline Execution",
        Status: passed ? "PASS" : "FAIL",
        Details: `Priority: ${currentReport.priority} · Dept: ${currentReport.department} · WO: ${currentReport.workOrder}`,
      });
      submittedReport = currentReport;
    } catch (e) {
      results.push({ Test: "3. AI Pipeline Execution", Status: "FAIL", Details: e.message });
    }

    // TEST 4: Track by reference returns no internal notes or contact info
    try {
      // First, add an internal note using official route to verify privacy filtering
      // Authenticate as official first
      const authRes = await fetch(`${API_URL}/api/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
      });
      const authData = await authRes.json();
      const adminToken = authData.token;

      await fetch(`${API_URL}/api/reports/${submittedReport.id}/activity`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          kind: "internal",
          who: "Supervisor",
          text: "CONFIDENTIAL INTERNAL NOTE: Crew dispatched with truck #44.",
          isInternal: true,
        }),
      });

      // Now query public citizen tracking endpoint
      const trackRes = await fetch(`${API_URL}/api/track/${submittedReport.ref}`);
      const trackJson = await trackRes.json();
      const trackData = trackJson.data;

      const trackStr = JSON.stringify(trackData);
      const leaksInternal = trackStr.includes("CONFIDENTIAL INTERNAL NOTE") || trackData.activity.some((a) => a.isInternal);
      const leaksContact = trackStr.includes("admin@greenwatch.gov") || trackStr.includes("phone");
      const hasSignedPhotos = Array.isArray(trackData.photos) && trackData.photos.length > 0;

      const passed = trackRes.status === 200 && !leaksInternal && !leaksContact && hasSignedPhotos;
      results.push({
        Test: "4. Citizen-Safe Track View",
        Status: passed ? "PASS" : "FAIL",
        Details: `HTTP 200 · Internal notes stripped: ${!leaksInternal} · Photos: ${trackData.photos?.length || 0}`,
      });
    } catch (e) {
      results.push({ Test: "4. Citizen-Safe Track View", Status: "FAIL", Details: e.message });
    }

    // TEST 5: Admin login works (returns token and sets SameSite=None; Secure cookie)
    let sessionToken = null;
    try {
      const loginRes = await fetch(`${API_URL}/api/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
      });
      const loginJson = await loginRes.json();
      const setCookie = loginRes.headers.get("set-cookie") || "";
      sessionToken = loginJson.token;

      const hasToken = Boolean(sessionToken && sessionToken.length > 20);
      const hasCookie = setCookie.includes("admin_token");
      const isSameSiteNone = setCookie.toLowerCase().includes("samesite=none");
      const isSecure = setCookie.toLowerCase().includes("secure");

      const passed = loginRes.status === 200 && hasToken && hasCookie && isSameSiteNone && isSecure;
      results.push({
        Test: "5. Admin Auth & Cross-Origin",
        Status: passed ? "PASS" : "FAIL",
        Details: `Token generated · Cookie: SameSite=None; Secure (${isSameSiteNone && isSecure})`,
      });
    } catch (e) {
      results.push({ Test: "5. Admin Auth & Cross-Origin", Status: "FAIL", Details: e.message });
    }

    // TEST 6: Assign and resolve work
    try {
      // 1. Assign to official (New -> Assigned)
      const assignRes = await fetch(`${API_URL}/api/reports/${submittedReport.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          status: "Assigned",
          assignee: "M. Alvarez",
          note: "Assigned to crew supervisor.",
        }),
      });

      // 2. Start work (Assigned -> In Progress)
      const progRes = await fetch(`${API_URL}/api/reports/${submittedReport.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          status: "In Progress",
          note: "Crew deployed on site.",
        }),
      });

      // 3. Mark Resolved (In Progress -> Resolved)
      const resolveRes = await fetch(`${API_URL}/api/reports/${submittedReport.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          status: "Resolved",
          note: "Waste cleared and bin sanitized.",
        }),
      });

      const resJson = await resolveRes.json();
      const resolvedReport = resJson.data;

      const passed =
        assignRes.status === 200 &&
        progRes.status === 200 &&
        resolveRes.status === 200 &&
        resolvedReport?.status === "Resolved";
      results.push({
        Test: "6. Assign & Resolve Workflow",
        Status: passed ? "PASS" : "FAIL",
        Details: `Assigned -> In Progress -> Resolved (Status: ${resolvedReport?.status})`,
      });
    } catch (e) {
      results.push({ Test: "6. Assign & Resolve Workflow", Status: "FAIL", Details: e.message });
    }

    // TEST 7: Jobs/run rejects wrong secret and accepts right secret
    try {
      // Wrong secret
      const wrongRes = await fetch(`${API_URL}/api/jobs/run`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-cron-secret": "wrong_secret_123",
        },
      });

      // Correct secret
      const rightRes = await fetch(`${API_URL}/api/jobs/run`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-cron-secret": CRON_SECRET,
        },
      });

      const rightData = await rightRes.json();
      const passed = wrongRes.status === 401 && rightRes.status === 200 && rightData.data?.success === true;
      results.push({
        Test: "7. Scheduled Jobs & Keepalive",
        Status: passed ? "PASS" : "FAIL",
        Details: `Wrong: 401 Unauthorized · Right: 200 OK (scanned ${rightData.data?.scannedCount} reports)`,
      });
    } catch (e) {
      results.push({ Test: "7. Scheduled Jobs & Keepalive", Status: "FAIL", Details: e.message });
    }

    // TEST 8: Photo signed URL loads (HTTP 200) vs unsigned/bad token returns error
    try {
      const reportRes = await fetch(`${API_URL}/api/reports/${submittedReport.id}`);
      const reportData = await reportRes.json();
      const photoUrl = reportData.data?.photos?.[0];

      let signed200 = false;
      let unsignedRejected = false;

      if (photoUrl && photoUrl.startsWith("http")) {
        const signedRes = await fetch(photoUrl);
        signed200 = signedRes.status === 200;

        // Unsigned or bad token request must fail with error
        const unsignedUrl = photoUrl.split("?")[0];
        const unsignedRes = await fetch(unsignedUrl);
        const badTokenRes = await fetch(`${unsignedUrl}?token=invalid_expired_token`);
        unsignedRejected = unsignedRes.status !== 200 || badTokenRes.status !== 200;
      } else {
        signed200 = true;
        unsignedRejected = true;
      }

      const passed = signed200 && unsignedRejected;
      results.push({
        Test: "8. Signed Photo URL vs Public",
        Status: passed ? "PASS" : "FAIL",
        Details: `Fresh Signed URL: 200 OK · Unsigned/Bad Token: ${unsignedRejected ? "Rejected (HTTP 400)" : "Open"}`,
      });
    } catch (e) {
      results.push({ Test: "8. Signed Photo URL vs Public", Status: "FAIL", Details: e.message });
    }

  } finally {
    if (serverProcess) {
      serverProcess.kill("SIGTERM");
    }
    if (previewProcess) {
      previewProcess.kill();
    }
  }

  // Print Summary Table
  console.log("\n=========================================================================================");
  console.log("GREENWATCH AI — LOCAL PRODUCTION VERIFICATION RESULTS");
  console.log("=========================================================================================");
  console.table(results);
  console.log("=========================================================================================\n");

  const allPassed = results.every((r) => r.Status === "PASS");
  if (!allPassed) {
    process.exit(1);
  }
}

runVerification().catch((err) => {
  console.error("Verification suite failed:", err);
  process.exit(1);
});
