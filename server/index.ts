import express from "express";
import { createServer } from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { loadServerEnv } from "./config/loadEnv";
import { corsMiddleware } from "./middleware/corsMiddleware";

loadServerEnv();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function mountClient(app: express.Express) {
  const productionIndexPath = path.resolve(__dirname, "public", "index.html");
  const isProductionBuild =
    process.env.NODE_ENV === "production" || fs.existsSync(productionIndexPath);

  if (isProductionBuild) {
    const staticPath = path.resolve(__dirname, "public");

    app.use(express.static(staticPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(staticPath, "index.html"));
    });
    return;
  }

  const { createServer: createViteServer } = await import("vite");
  const vite = await createViteServer({
    configFile: path.resolve(__dirname, "..", "vite.config.ts"),
    server: { middlewareMode: true },
    appType: "spa",
  });

  app.use(vite.middlewares);
}

async function startServer() {
  const [{ initializeSaasPersistence }, { getHealth }, { apiRoutes }, { attachAuthContext }] = await Promise.all([
    import("../backend/src/modules/persistence/saas-persistence.repository"),
    import("./controllers/statusController"),
    import("./routes"),
    import("./middleware/authMiddleware"),
  ]);
  await initializeSaasPersistence();
  const app = express();
  const server = createServer(app);

  app.use(corsMiddleware);
  app.use(express.json());
  app.use(attachAuthContext);
  app.get("/health", getHealth);
  app.use("/api", apiRoutes);
  app.get("/risk", (_req, res) => {
    res.redirect(302, "/protect");
  });
  app.get("/stats", (_req, res) => {
    res.redirect(302, "/analytics");
  });

  await mountClient(app);

  const port = process.env.PORT || 3000;

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
