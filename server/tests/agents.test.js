import { describe, it, expect } from "vitest";
import { runTriageAgent, runDeterministicTriage } from "../src/agents/triageAgent.js";
import { runEvidenceAgent } from "../src/agents/evidenceAgent.js";
import { runDuplicateAgent } from "../src/agents/duplicateAgent.js";
import { runPriorityAgent } from "../src/agents/priorityAgent.js";
import { runRoutingAgent } from "../src/agents/routingAgent.js";
import { runWorkOrderAgent } from "../src/agents/workOrderAgent.js";
import { evaluateFollowUp } from "../src/agents/followUpAgent.js";
import { runReportPipeline } from "../src/agents/pipeline.js";

describe("AI Agent Pipeline Unit Tests", () => {
  it("Triage Agent: classifies garbage issue accurately with deterministic heuristics", async () => {
    const res = await runTriageAgent("Massive pile of trash and rubbish bags blocking the pavement", 1);
    expect(res.category).toBe("garbage");
    expect(res.categoryLabel).toBe("Illegal Garbage Dumping");
    expect(res.confidence).toBeGreaterThan(70);
  });

  it("Triage Agent: classifies water leakage correctly", async () => {
    const res = await runTriageAgent("Clean water has been gushing from a burst pipe across the road for hours", 0);
    expect(res.category).toBe("water");
    expect(res.categoryLabel).toBe("Water Leakage / Wastage");
  });

  it("Triage Agent: classifies fallen tree branch correctly", async () => {
    const res = await runTriageAgent("Huge fallen elm tree limb snapped and fell on the sidewalk", 1);
    expect(res.category).toBe("tree");
    expect(res.categoryLabel).toBe("Fallen / Damaged Tree");
  });

  it("Evidence Agent: marks Good when photos and detailed description are provided", () => {
    const longDesc = "This is a very detailed description that clearly exceeds sixty characters in total length for proper evidence verification.";
    const res = runEvidenceAgent(longDesc, ["https://example.com/photo.jpg"]);
    expect(res.evidence).toBe("Good");
    expect(res.confidenceScore).toBe(92);
  });

  it("Evidence Agent: marks Needs more info when no photos are attached", () => {
    const res = runEvidenceAgent("Trash everywhere near the road", []);
    expect(res.evidence).toBe("Needs more info");
    expect(res.confidenceScore).toBe(65);
  });

  it("Duplicate Detection Agent: detects existing report in same category and area", () => {
    const existing = [
      {
        id: "r-mock-1",
        category: "garbage",
        status: "In Progress",
        location: { address: "Market Court", area: "Riverside District" },
      },
    ];
    const res = runDuplicateAgent("garbage", { address: "Behind Market Court", area: "Riverside District" }, existing);
    expect(res.similarCount).toBe(1);
    expect(res.similarIds).toContain("r-mock-1");
    expect(res.isDuplicate).toBe(true);
  });

  it("Priority Agent: elevates priority to High for hazards near children/schools", () => {
    const res = runPriorityAgent("tree", "Broken branch hanging over the school crossing where kids walk");
    expect(res.priority).toBe("High");
    expect(res.dueDays).toBe(1);
  });

  it("Department Routing Agent: routes water leak to Water Utility", () => {
    const res = runRoutingAgent("water");
    expect(res.department).toBe("Water Utility");
  });

  it("Work Order Agent: assigns WO-XXXX reference and valid ISO dueDate", () => {
    const res = runWorkOrderAgent("WO-9999", 3);
    expect(res.workOrderRef).toBe("WO-9999");
    expect(new Date(res.dueDate).getTime()).toBeGreaterThan(Date.now());
  });

  it("Follow-up Agent: triggers citizen confirmation for resolved reports", () => {
    const report = {
      status: "Resolved",
      resolvedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      dueDate: new Date(Date.now() - 3600000).toISOString(),
    };
    const res = evaluateFollowUp(report);
    expect(res.action).toBe("citizen_confirmation");
    expect(res.needsNotification).toBe(true);
  });

  it("Pipeline Orchestration: coordinates end-to-end report analysis with all 7 agents", async () => {
    const pipeline = await runReportPipeline({
      description: "Huge water main burst near the hospital entrance flooding the street",
      location: { address: "Hospital Road", area: "Central" },
      photos: ["https://example.com/water.jpg"],
      existingReports: [],
      workOrderRef: "WO-2001",
    });

    expect(pipeline.category).toBe("water");
    expect(pipeline.priority).toBe("High");
    expect(pipeline.department).toBe("Water Utility");
    expect(pipeline.workOrder).toBe("WO-2001");
    expect(pipeline.steps.length).toBe(6);
    expect(pipeline.activity.length).toBeGreaterThanOrEqual(4);
    expect(pipeline.ai.severity).toBe("High");
  });
});
