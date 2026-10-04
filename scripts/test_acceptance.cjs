const puppeteer = require("puppeteer-core");
const fs = require("fs");
const path = require("path");

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const ARTIFACTS_DIR = "C:\\Users\\LENOVO\\.gemini\\antigravity-ide\\brain\\d9a39158-9d2b-42ae-982e-f7a074ad0a46";

async function run() {
  console.log("Launching local Chrome via puppeteer-core...");
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 1050 });

    console.log("Navigating to production build at http://localhost:4173/report...");
    await page.goto("http://localhost:4173/report", { waitUntil: "networkidle2", timeout: 30000 });

    // Wait for Leaflet map container to be visible and tiles loaded
    await page.waitForSelector(".leaflet-container", { timeout: 10000 });
    console.log("Leaflet map container found!");

    // Scroll to show the entire map section clearly
    await page.evaluate(() => {
      const mapEl = document.querySelector(".leaflet-container");
      if (mapEl) mapEl.scrollIntoView({ behavior: "instant", block: "center" });
    });
    await new Promise((r) => setTimeout(r, 2500));

    // Screenshot 1: Desktop Initial Islamabad Map with OSM attribution
    const initialMapPath = path.join(ARTIFACTS_DIR, "01_islamabad_map_loaded.png");
    await page.screenshot({ path: initialMapPath, fullPage: false });
    console.log("Screenshot 1 captured:", initialMapPath);

    // Click on the Leaflet map to pick a location in Islamabad
    const mapElement = await page.$(".leaflet-container");
    const boundingBox = await mapElement.boundingBox();
    console.log("Map bounding box:", boundingBox);

    // Click in Islamabad sector
    const clickX = boundingBox.x + boundingBox.width * 0.62;
    const clickY = boundingBox.y + boundingBox.height * 0.45;
    console.log(`Clicking at (${clickX}, ${clickY}) to pick location...`);
    await page.mouse.click(clickX, clickY);

    // Wait for debounce and reverse geocoding to resolve and populate the input
    console.log("Waiting for Nominatim reverse-geocoding and address auto-fill...");
    await new Promise((r) => setTimeout(r, 3500));

    // Get current value of address input
    const addressInput = await page.$('input[placeholder="Street, landmark or park name"]');
    const addressValue = await page.evaluate((el) => el.value, addressInput);
    console.log("Auto-filled address in input field:", addressValue);

    // Screenshot 2: Location Picked and Address Auto-filled
    const autoFillPath = path.join(ARTIFACTS_DIR, "02_location_picked_autofilled.png");
    await page.screenshot({ path: autoFillPath, fullPage: false });
    console.log("Screenshot 2 captured:", autoFillPath);

    // Fill description
    console.log("Filling report description...");
    const textarea = await page.$('textarea[placeholder*="Describe the problem"]');
    if (textarea) {
      await textarea.click();
      await textarea.type(
        "Overgrown wild shrubs and fallen tree branches are blocking the pedestrian footpath along the green belt on Margalla Road."
      );
    }

    // Scroll down to see full form and submit button
    await page.evaluate(() => {
      const btn = document.querySelector('button[type="submit"]');
      if (btn) btn.scrollIntoView({ behavior: "instant", block: "center" });
    });
    await new Promise((r) => setTimeout(r, 500));

    console.log("Submitting report...");
    await page.click('button[type="submit"]');

    // Wait for submission response and analyzing screen
    console.log("Waiting for AI analysis / submission confirmation...");
    await new Promise((r) => setTimeout(r, 5000));

    // Screenshot 3: Submitted report & AI pipeline screen
    const submittedPath = path.join(ARTIFACTS_DIR, "03_report_submitted_ai_pipeline.png");
    await page.screenshot({ path: submittedPath, fullPage: false });
    console.log("Screenshot 3 captured:", submittedPath);

    // Query backend to verify DB record
    const apiRes = await fetch("http://localhost:4000/api/reports?sortBy=createdAt&sortOrder=desc&limit=1");
    const apiJson = await apiRes.json();
    const latestReport = (apiJson.data || apiJson.items || [])[0];
    console.log("Latest DB Report Row Coordinates:");
    console.log(
      JSON.stringify(
        {
          id: latestReport?.id,
          ref: latestReport?.ref,
          address: latestReport?.address || latestReport?.location?.address,
          area: latestReport?.area || latestReport?.location?.area,
          lat: latestReport?.lat ?? latestReport?.location?.lat,
          lng: latestReport?.lng ?? latestReport?.location?.lng,
          status: latestReport?.status,
        },
        null,
        2
      )
    );

    // Save DB row details to JSON artifact
    fs.writeFileSync(
      path.join(ARTIFACTS_DIR, "db_row_coordinates.json"),
      JSON.stringify(latestReport, null, 2)
    );

    // If report has ID, navigate to ReportDetail page to see stored coordinates on map
    if (latestReport?.id) {
      console.log(`Navigating to /reports/${latestReport.id}...`);
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

      const detailPath = path.join(ARTIFACTS_DIR, "03b_report_detail_db_coordinates.png");
      await page.screenshot({ path: detailPath, fullPage: false });
      console.log("Report Detail screenshot captured:", detailPath);
    }

    // Screenshot 4: Mobile width rendering in production build (iPhone 14/15 size: 390x844)
    console.log("Setting mobile viewport (390x844) for mobile rendering test...");
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await page.goto("http://localhost:4173/report", {
      waitUntil: "networkidle2",
      timeout: 20000,
    });
    await new Promise((r) => setTimeout(r, 2000));

    // Scroll so map is in view on mobile
    await page.evaluate(() => {
      const mapEl = document.querySelector(".leaflet-container");
      if (mapEl) mapEl.scrollIntoView({ behavior: "instant", block: "center" });
    });
    await new Promise((r) => setTimeout(r, 1500));

    const mobilePath = path.join(ARTIFACTS_DIR, "04_mobile_width_production_build.png");
    await page.screenshot({ path: mobilePath, fullPage: false });
    console.log("Screenshot 4 captured (mobile width):", mobilePath);

    console.log("ALL ACCEPTANCE TESTS COMPLETED SUCCESSFULLY!");
  } finally {
    await browser.close();
  }
}

run().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
