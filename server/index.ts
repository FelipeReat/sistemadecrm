import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { schedulerService } from "./scheduler";
import { RealtimeService } from "./realtime-service";

const app = express();
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: false, limit: "50mb" }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  // Inicializar serviço de tempo real
  let realtimeService: RealtimeService | null = null;
  try {
    // Determinar qual variável de ambiente usar baseado no NODE_ENV
    const isProduction = process.env.NODE_ENV === "production";
    const dbUrl = isProduction 
      ? process.env.PROD_DATABASE_URL 
      : process.env.DEV_DATABASE_URL || process.env.DATABASE_URL;
    
    if (dbUrl) {
      log("🚀 Inicializando serviço de tempo real...");
      realtimeService = new RealtimeService(server, dbUrl);
      await realtimeService.initialize();
      log("✅ Serviço de tempo real ativo");
    } else {
      log("⚠️ URL do banco não configurada, serviço de tempo real desabilitado");
    }
  } catch (error) {
    log("❌ Erro ao inicializar serviço de tempo real:", String(error));
    log("⚠️ Continuando sem funcionalidades de tempo real");
  }

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    // Evitar múltiplas respostas
    if (res.headersSent) {
      return _next(err);
    }

    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    log(`Error ${status}: ${message}`);
    res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  // Detect production mode from NODE_ENV
  const isProduction = process.env.NODE_ENV === "production";

  if (!isProduction) {
    log("Setting up Vite development server");
    await setupVite(app, server);
  } else {
    log("Setting up static file serving for production");
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000 in Replit
  // Replit requires port 5000 for webview applications
  // this serves both the API and the client.
  const port = parseInt(process.env.PORT || "5000", 10);
  log("Using fixed PORT:", port.toString());

  // Use configurable host binding with safe default
  // Default to 0.0.0.0 for accessibility in cloud environments like Replit
  // Can be overridden with HOST environment variable if needed
  const host = process.env.HOST || "0.0.0.0";

  server.listen(
    {
      port,
      host,
    },
    () => {
      log(`serving on host ${host} port ${port}`);
      if (realtimeService) {
        const protocol = process.env.NODE_ENV === "production" ? "wss" : "ws";
        log(`🔌 WebSocket disponível em ${protocol}://${host}:${port}/ws`);
        
        // Log adicional para debug
        const status = realtimeService.getStatus();
        log(`📊 Status do serviço realtime:`, JSON.stringify(status, null, 2));
      }
    },
  );

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    log('🔌 Recebido SIGTERM, desligando servidor...');
    if (realtimeService) {
      await realtimeService.shutdown();
    }
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    log('🔌 Recebido SIGINT, desligando servidor...');
    if (realtimeService) {
      await realtimeService.shutdown();
    }
    process.exit(0);
  });
})();
