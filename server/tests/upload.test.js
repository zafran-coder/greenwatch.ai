import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import sharp from "sharp";
import fs from "fs";
import path from "path";
import { app } from "../src/app.js";
import { inMemoryDb } from "../src/db/client.js";
import { setStorageDriver, LocalDiskStorage, getStorageDriver } from "../src/services/storage/index.js";

const TEST_UPLOADS_DIR = path.join(process.cwd(), "test-uploads");

describe("Evidence Photo Upload & Storage Engine (Prompt 3)", () => {
  let diskStorage;
  let testPngBuffer;
  let testJpegBuffer;
  let largeBuffer;

  beforeEach(async () => {
    inMemoryDb.reset();

    // Use LocalDiskStorage for fast, isolated, deterministic unit tests
    diskStorage = new LocalDiskStorage({ baseDir: TEST_UPLOADS_DIR });
    setStorageDriver(diskStorage);

    // Generate valid test PNG (2000x1200 - will be resized to <= 1600px)
    testPngBuffer = await sharp({
      create: {
        width: 2000,
        height: 1200,
        channels: 3,
        background: { r: 34, g: 139, b: 34 },
      },
    })
      .png()
      .toBuffer();

    // Generate valid test JPEG (800x600)
    testJpegBuffer = await sharp({
      create: {
        width: 800,
        height: 600,
        channels: 3,
        background: { r: 70, g: 130, b: 180 },
      },
    })
      .jpeg()
      .toBuffer();

    // Generate oversize buffer (> 5MB)
    // 5.2 MB buffer
    largeBuffer = Buffer.alloc(5.2 * 1024 * 1024, 0xaa);
  });

  afterEach(async () => {
    // Clean up test-uploads directory
    try {
      await fs.promises.rm(TEST_UPLOADS_DIR, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error
    }
  });

  // 1. ACCEPTANCE: Valid upload via POST /api/reports/:id/photos
  it("POST /api/reports/:id/photos - successfully uploads, validates magic bytes, auto-rotates, converts to WebP, resizes to <=1600px, creates 400px thumb, and stores in Photo table", async () => {
    // Pick an existing report from seed
    const reportId = "r1";

    const res = await request(app)
      .post(`/api/reports/${reportId}/photos`)
      .attach("photos", testPngBuffer, "pothole_evidence.png");

    expect(res.status).toBe(201);
    expect(res.body.data).toBeDefined();
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBe(1);

    const photo = res.body.data[0];
    expect(photo.id).toBeDefined();
    expect(photo.reportId).toBe(reportId);
    expect(photo.path).toMatch(/^reports\/r1\/[a-f0-9-]+\.webp$/);
    expect(photo.url).toBeDefined();
    expect(photo.thumbnailPath).toMatch(/^reports\/r1\/[a-f0-9-]+_thumb\.webp$/);
    expect(photo.thumbnailUrl).toBeDefined();
    expect(photo.size).toBeGreaterThan(0);

    // Resized to <= 1600px
    expect(photo.width).toBeLessThanOrEqual(1600);
    expect(photo.height).toBeLessThanOrEqual(1600);
    expect(photo.width).toBe(1600); // 2000x1200 proportionally scaled down
    expect(photo.height).toBe(960);

    // Evidence analysis metadata populated
    expect(photo.evidenceAnalysis).toBeDefined();
    expect(photo.evidenceAnalysis.evidence).toBe("Good");
    expect(photo.evidenceAnalysis.clarity).toBe("High Resolution");
    expect(photo.evidenceAnalysis.status).toBe("verified_visual_evidence");

    // Verify stored files on disk/storage
    const mainExists = await diskStorage.exists(photo.path);
    const thumbExists = await diskStorage.exists(photo.thumbnailPath);
    expect(mainExists).toBe(true);
    expect(thumbExists).toBe(true);

    // Verify WebP format of stored files
    const mainBytes = await diskStorage.getBuffer(photo.path);
    const thumbBytes = await diskStorage.getBuffer(photo.thumbnailPath);
    expect(mainBytes.toString("ascii", 0, 4)).toBe("RIFF");
    expect(mainBytes.toString("ascii", 8, 12)).toBe("WEBP");
    expect(thumbBytes.toString("ascii", 0, 4)).toBe("RIFF");
    expect(thumbBytes.toString("ascii", 8, 12)).toBe("WEBP");

    // Verify thumbnail dimensions <= 400px
    const thumbMeta = await sharp(thumbBytes).metadata();
    expect(thumbMeta.width).toBeLessThanOrEqual(400);
    expect(thumbMeta.height).toBeLessThanOrEqual(400);
    expect(thumbMeta.width).toBe(400);
    expect(thumbMeta.height).toBe(240);

    // Verify report photos array updated
    const getReportRes = await request(app).get(`/api/reports/${reportId}`);
    expect(getReportRes.status).toBe(200);
    expect(getReportRes.body.data.photos).toContain(photo.url);

    // Verify GET /api/reports/:id/photos lists the photo
    const getPhotosRes = await request(app).get(`/api/reports/${reportId}/photos`);
    expect(getPhotosRes.status).toBe(200);
    expect(getPhotosRes.body.data.some((p) => p.id === photo.id)).toBe(true);
  });

  // 2. ACCEPTANCE: Oversize (> 5MB)
  it("POST /api/reports/:id/photos - rejects file exceeding 5MB with 400 Bad Request", async () => {
    const res = await request(app)
      .post("/api/reports/r1/photos")
      .attach("photos", largeBuffer, "huge_photo.jpg");

    expect(res.status).toBe(400);
    const msg = res.body.error?.message || String(res.body.error);
    expect(msg).toMatch(/5MB/i);
  });

  // 3. ACCEPTANCE: Wrong type (e.g. text/plain, pdf, non-image)
  it("POST /api/reports/:id/photos - rejects wrong file type (e.g. text file) with 400 Bad Request", async () => {
    const textBuffer = Buffer.from("Hello, this is just plain text content, not an image!");

    const res = await request(app)
      .post("/api/reports/r1/photos")
      .attach("photos", textBuffer, "notes.txt");

    expect(res.status).toBe(400);
    const msg = res.body.error?.message || String(res.body.error);
    expect(msg).toMatch(/invalid image format/i);
  });

  // 4. ACCEPTANCE: Renamed .exe disguised as an image
  it("POST /api/reports/:id/photos - rejects renamed .exe file with magic bytes 'MZ' disguised as .jpg", async () => {
    // Create fake executable with PE/DOS magic bytes MZ (0x4D, 0x5A)
    const exeBuffer = Buffer.from([
      0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00,
      0x04, 0x00, 0x00, 0x00, 0xff, 0xff, 0x00, 0x00,
      0xb8, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    ]);

    const res = await request(app)
      .post("/api/reports/r1/photos")
      .attach("photos", exeBuffer, "cute_cat.jpg");

    expect(res.status).toBe(400);
    const msg = res.body.error?.message || String(res.body.error);
    expect(msg).toMatch(/invalid image format/i);
  });

  // 5. ACCEPTANCE: Path-traversal filename sanitization & random filenames only
  it("POST /api/reports/:id/photos - sanitizes path traversal filename, using random filenames only", async () => {
    const traversalFilenames = [
      "../../../../etc/passwd.png",
      "..\\..\\..\\windows\\system32\\cmd.exe.png",
      "/var/log/syslog.png",
    ];

    for (const badName of traversalFilenames) {
      const res = await request(app)
        .post("/api/reports/r1/photos")
        .attach("photos", testJpegBuffer, badName);

      expect(res.status).toBe(201);
      const photo = res.body.data[0];

      // Filename must NOT contain any path traversal segments
      expect(photo.path).not.toContain("..");
      expect(photo.path).not.toContain("etc");
      expect(photo.path).not.toContain("passwd");
      expect(photo.path).not.toContain("system32");

      // Path must adhere strictly to random UUID format
      expect(photo.path).toMatch(/^reports\/r1\/[a-f0-9-]+\.webp$/);
      expect(photo.thumbnailPath).toMatch(/^reports\/r1\/[a-f0-9-]+_thumb\.webp$/);

      // Verify file is safely within designated storage directory
      const exists = await diskStorage.exists(photo.path);
      expect(exists).toBe(true);
    }
  });

  // 6. Max 4 images validation
  it("POST /api/reports/:id/photos - rejects requests with more than 4 images", async () => {
    const req = request(app).post("/api/reports/r1/photos");

    // Attach 5 images
    for (let i = 1; i <= 5; i++) {
      req.attach("photos", testJpegBuffer, `photo_${i}.jpg`);
    }

    const res = await req;
    expect(res.status).toBe(400);
    const msg = res.body.error?.message || String(res.body.error);
    expect(msg).toMatch(/maximum 4 photos/i);
  });

  // 7. ACCEPTANCE: Accept photos inside report creation (POST /api/reports)
  it("POST /api/reports - accepts multipart form with photos during report creation", async () => {
    const res = await request(app)
      .post("/api/reports")
      .field("description", "Large fallen tree limb blocking pedestrian pathway and wheelchair ramp.")
      .field("location[address]", "Oak Avenue near Central Library")
      .field("location[area]", "Central District")
      .attach("photos", testPngBuffer, "tree_hazard.png")
      .attach("photos", testJpegBuffer, "ramp_blocked.jpg");

    expect(res.status).toBe(201);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.ref).toMatch(/^GW-\d{4}$/);
    expect(res.body.data.category).toBe("tree");

    // Photos created and stored
    expect(res.body.photos).toBeDefined();
    expect(res.body.photos.length).toBe(2);

    const firstPhoto = res.body.photos[0];
    expect(firstPhoto.path).toMatch(/^reports\/r[a-z0-9]+\/[a-f0-9-]+\.webp$/);
    expect(firstPhoto.evidenceAnalysis.evidence).toBe("Good");

    // AI steps show evidence verification
    expect(res.body.steps).toBeDefined();
    const evidenceStep = res.body.steps.find((s) => s.key === "evidence");
    expect(evidenceStep).toBeDefined();
    expect(evidenceStep.detail).toMatch(/2 photos verified/i);
  });

  // 8. ACCEPTANCE: Deleting a report deletes its files
  it("DELETE /api/reports/:id - deletes the report and purges its photo files from storage", async () => {
    // 1. Create a report with photos
    const createRes = await request(app)
      .post("/api/reports")
      .field("description", "Illegal toxic waste barrels dumped behind old warehouse.")
      .field("location[address]", "Industrial Way 45")
      .attach("photos", testJpegBuffer, "barrels.jpg");

    expect(createRes.status).toBe(201);
    const reportId = createRes.body.data.id;
    const photo = createRes.body.photos[0];

    // Verify files exist in storage before deletion
    expect(await diskStorage.exists(photo.path)).toBe(true);
    expect(await diskStorage.exists(photo.thumbnailPath)).toBe(true);

    // 2. Delete the report
    const delRes = await request(app).delete(`/api/reports/${reportId}`);
    expect(delRes.status).toBe(200);
    expect(delRes.body.success).toBe(true);
    expect(delRes.body.deletedFilesCount).toBe(2); // Main + thumbnail

    // 3. Verify files are completely purged from storage
    expect(await diskStorage.exists(photo.path)).toBe(false);
    expect(await diskStorage.exists(photo.thumbnailPath)).toBe(false);

    // 4. Verify report is gone from database
    const getRes = await request(app).get(`/api/reports/${reportId}`);
    expect(getRes.status).toBe(404);
  });
});
