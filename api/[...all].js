export default async function handler(req, res) {
  try {
    const matchedPath = req.headers["x-matched-path"] || req.headers["x-vercel-matched-path"];
    if (matchedPath && matchedPath.startsWith("/api")) {
      req.url = matchedPath;
    } else if (req.url && !req.url.startsWith("/api")) {
      req.url = `/api${req.url.startsWith("/") ? "" : "/"}${req.url}`;
    }

    const { app } = await import("../server/src/app.js");
    return app(req, res);
  } catch (err) {
    console.error("[Vercel Serverless Error]:", err);
    return res.status(500).json({
      error: {
        code: "SERVERLESS_FUNCTION_ERROR",
        message: err.message || "Serverless Function Execution Failed",
        stack: err.stack,
      },
    });
  }
}
