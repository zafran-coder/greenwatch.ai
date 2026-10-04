async function main() {
  const { runReportPipeline } = await import("../server/src/agents/pipeline.js");
  const result = await runReportPipeline({
    description: "Garbage dumped near a public park",
    location: { address: "Public Park, Islamabad", area: "Islamabad", lat: 33.6844, lng: 73.0479 },
    photos: [],
    workOrderRef: "WO-1234"
  });

  console.log("=== Pipeline Evaluation Result ===");
  console.log("Input: \"Garbage dumped near a public park\"");
  console.log("Category:    ", result.category);
  console.log("Priority/Sev:", result.priority);
  console.log("Department:  ", result.department);
  console.log("Reason:      ", result.ai?.reason);
  console.log("Work Order:  ", result.workOrder);
}

main().catch(console.error);
