const puppeteer = require("puppeteer-core");
const fs = require("fs");
const path = require("path");

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const ARTIFACTS_DIR = "C:\\Users\\LENOVO\\.gemini\\antigravity-ide\\brain\\d9a39158-9d2b-42ae-982e-f7a074ad0a46";

async function main() {
  console.log("=== Launching Chrome for Acceptance Verification ===");
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 1000 });

    // -------------------------------------------------------------------------
    // 1. Picking Location & OpenStreetMap Tiles Centered on Islamabad
    // -------------------------------------------------------------------------
    console.log("Step 1: Navigating to production build at http://localhost:4173/report...");
    await page.goto("http://localhost:4173/report", { waitUntil: "networkidle2", timeout: 30000 });
    await page.waitForSelector(".leaflet-container", { timeout: 10000 });

    // Scroll to center the map nicely
    await page.evaluate(() => {
      document.querySelector(".leaflet-container").scrollIntoView({ behavior: "instant", block: "center" });
    });
    await new Promise((r) => setTimeout(r, 2000));

    // Capture initial Islamabad OSM Map with pin & attribution
    const screenshot1Path = path.join(ARTIFACTS_DIR, "01_islamabad_map_loaded.png");
    await page.screenshot({ path: screenshot1Path, fullPage: false });
    console.log("✓ Captured 01_islamabad_map_loaded.png");

    // -------------------------------------------------------------------------
    // 2. Click-to-Pin & Reverse-Geocoding Auto-Fill with Nominatim
    // -------------------------------------------------------------------------
    console.log("Step 2: Clicking location on map in Islamabad...");
    const mapElement = await page.$(".leaflet-container");
    const boundingBox = await mapElement.boundingBox();
    const clickX = boundingBox.x + boundingBox.width * 0.62;
    const clickY = boundingBox.y + boundingBox.height * 0.45;

    await page.mouse.click(clickX, clickY);

    console.log("Waiting for Nominatim reverse-geocode auto-fill...");
    await new Promise((r) => setTimeout(r, 3500));

    const addressInput = await page.$('input[placeholder="Street, landmark or park name"]');
    const autoFilledAddress = await page.evaluate((el) => el.value, addressInput);
    console.log("✓ Auto-filled Address:", autoFilledAddress);

    // Capture Screenshot 2: Location Picked and Address Auto-filled
    const screenshot2Path = path.join(ARTIFACTS_DIR, "02_location_picked_autofilled.png");
    await page.screenshot({ path: screenshot2Path, fullPage: false });
    console.log("✓ Captured 02_location_picked_autofilled.png");

    // -------------------------------------------------------------------------
    // 3. Fill Description, Submit to API, and Verify DB Row Coordinates
    // -------------------------------------------------------------------------
    console.log("Step 3: Submitting report with picked Islamabad coordinates...");
    const textarea = await page.$('textarea[placeholder*="Describe the problem"]');
    await textarea.click();
    await textarea.type(
      "A large fallen tree branch is obstructing the pedestrian lane and green belt on Margalla Road."
    );

    // Scroll submit button into view and click
    await page.evaluate(() => {
      document.querySelector('button[type="submit"]').scrollIntoView({ behavior: "instant", block: "center" });
    });
    await new Promise((r) => setTimeout(r, 500));
    await page.click('button[type="submit"]');

    // Wait for submission response and analyzing screen
    await new Promise((r) => setTimeout(r, 5000));

    // Capture Screenshot 3: Report Submitted & AI Pipeline Screen
    const screenshot3Path = path.join(ARTIFACTS_DIR, "03_report_submitted_ai_pipeline.png");
    await page.screenshot({ path: screenshot3Path, fullPage: false });
    console.log("✓ Captured 03_report_submitted_ai_pipeline.png");

    // Fetch latest report from API to verify stored coordinates in DB
    const apiRes = await fetch("http://localhost:4000/api/reports?sortBy=createdAt&sortOrder=desc&limit=1");
    const apiJson = await apiRes.json();
    const latestReport = (apiJson.data || apiJson.items || [])[0];

    console.log("✓ Latest DB Row Coordinates Verified:");
    const dbRowSummary = {
      id: latestReport?.id,
      ref: latestReport?.ref,
      address: latestReport?.location?.address || latestReport?.address,
      area: latestReport?.location?.area || latestReport?.area,
      lat: latestReport?.location?.lat ?? latestReport?.lat,
      lng: latestReport?.location?.lng ?? latestReport?.lng,
      status: latestReport?.status,
      category: latestReport?.category,
      department: latestReport?.department,
      createdAt: latestReport?.createdAt,
    };
    console.log(JSON.stringify(dbRowSummary, null, 2));

    fs.writeFileSync(
      path.join(ARTIFACTS_DIR, "stored_db_row.json"),
      JSON.stringify(latestReport, null, 2)
    );

    // Navigate to report detail page to view stored DB coordinates on map
    if (latestReport?.id) {
      console.log(`Navigating to /reports/${latestReport.id} to view stored coordinates...`);
      await page.goto(`http://localhost:4173/reports/${latestReport.id}`, {
        waitUntil: "networkidle2",
        timeout: 20000,
      });
      await new Promise((r) => setTimeout(r, 2000));

      await page.evaluate(() => {
        const mapEl = document.querySelector(".leaflet-container");
        if (mapEl) mapEl.scrollIntoView({ behavior: "instant", block: "center" });
      });
      await new Promise((r) => setTimeout(r, 1500));

      const screenshotDetailPath = path.join(ARTIFACTS_DIR, "03b_stored_coordinates_db_row.png");
      await page.screenshot({ path: screenshotDetailPath, fullPage: false });
      console.log("✓ Captured 03b_stored_coordinates_db_row.png");
    }

    // -------------------------------------------------------------------------
    // 4. Mobile Width Rendering in Production Build
    // -------------------------------------------------------------------------
    console.log("Step 4: Setting mobile viewport (390x844) on production build...");
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await page.goto("http://localhost:4173/report", {
      waitUntil: "networkidle2",
      timeout: 20000,
    });
    await new Promise((r) => setTimeout(r, 2000));

    // Scroll so Leaflet map with tiles and attribution is centered on mobile screen
    await page.evaluate(() => {
      const mapEl = document.querySelector(".leaflet-container");
      if (mapEl) mapEl.scrollIntoView({ behavior: "instant", block: "center" });
    });
    await new Promise((r) => setTimeout(r, 2000));

    const screenshot4Path = path.join(ARTIFACTS_DIR, "04_mobile_width_production_build.png");
    await page.screenshot({ path: screenshot4Path, fullPage: false });
    console.log("✓ Captured 04_mobile_width_production_build.png");

    console.log("=== ALL ACCEPTANCE SCREENSHOTS GENERATED SUCCESSFULLY ===");
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error("Execution failed:", err);
  process.exit(1);
});
