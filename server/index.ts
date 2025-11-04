import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { schedulerService } from "./scheduler";
import { RealtimeService } from "./realtime-service";

const app = express();

// Configure CORS
app.use(cors({
  origin: ['http://localhost:5500', 'http://localhost:5502'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie']
}));

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: false, limit: "50mb" }));

app.use((req, res, next) => {
  console.log(`🔍 [REQUEST] ${req.method} ${req.path} - received`);
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
    console.log(`🔍 [RESPONSE] ${req.method} ${path} ${res.statusCode} in ${duration}ms`);
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
      
      // Force flush to ensure logs appear immediately
      if (process.stdout.write) {
        process.stdout.write('');
      }
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
      log("🚀 Inicializando serviço de tempo real (async, não bloqueante)...");
      realtimeService = new RealtimeService(server, dbUrl);
      // Inicializa de forma assíncrona para não bloquear o start do servidor HTTP
      realtimeService.initialize()
        .then(() => {
          log("✅ Serviço de tempo real ativo");
        })
        .catch((error) => {
          log("❌ Erro ao inicializar serviço de tempo real:", String(error));
          log("⚠️ Continuando sem funcionalidades de tempo real");
        });
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

  // Configuração de porta para desenvolvimento local
  // Backend usa porta 5501 para alinhar com proxy do Vite e testes
  const port = parseInt(process.env.PORT || "5501", 10);
  log("Using PORT:", port.toString());

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
      log(`🚀 Backend servidor rodando em http://${host}:${port}`);
      if (realtimeService) {
        const protocol = process.env.NODE_ENV === "production" ? "wss" : "ws";
        log(`🔌 WebSocket disponível em ${protocol}://${host}:${port}/ws`);
        
        // Log adicional para debug - versão segura com timeout
        const statusTimeout = setTimeout(() => {
          log(`⏰ TIMEOUT: getStatus() demorou mais de 5 segundos - possível travamento detectado`);
        }, 5000);
        
        try {
          log(`🔍 Iniciando coleta de status do realtime service...`);
          const status = realtimeService.getStatus();
          clearTimeout(statusTimeout);
          log(`🔍 Status coletado com sucesso, serializando...`);
          const serializedStatus = JSON.stringify(status, null, 2);
          log(`📊 Status do serviço realtime:`, serializedStatus);
          log(`✅ Log de status concluído com sucesso`);
        } catch (error) {
          clearTimeout(statusTimeout);
          log(`❌ Erro ao obter/serializar status: ${error}`);
          log(`📊 Status do serviço realtime: [Erro - ${error}]`);
        }
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
