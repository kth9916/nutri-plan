import "dotenv/config";
import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../server/routers";
import { createContext } from "../server/_core/context";
import { registerOAuthRoutes } from "../server/_core/oauth";

const app = express();

// Vercel rewrite workaround: Restore the original URL path and query parameters
app.use((req, res, next) => {
  if (req.query.path !== undefined) {
    const pathStr = req.query.path as string;
    const urlObj = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    
    // Restore the correct path for Express routing
    urlObj.pathname = `/api/${pathStr}`;
    // Remove the Vercel injected query parameter
    urlObj.searchParams.delete('path');
    
    req.url = urlObj.pathname + urlObj.search;
    req.originalUrl = req.url;
  }
  next();
});

// Configure body parser with larger size limit for file uploads
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// OAuth callback under /api/oauth/callback
registerOAuthRoutes(app);

// tRPC API
app.use(
  "/api/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext,
  })
);

// Export the Express app as a Vercel Serverless Function
export default app;
