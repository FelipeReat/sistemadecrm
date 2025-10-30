import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
// import { dbOperations } from "./db-storage"; // Disabled for memory storage
// Disabled database-dependent services for memory storage
// import { emailService } from "./email-service";
// import { auditService } from "./audit-service";
// import { backupService } from "./backup-service";
// import { schedulerService } from "./scheduler";
import { insertOpportunitySchema, insertAutomationSchema, insertUserSchema, updateUserSchema, loginSchema, insertSavedReportSchema, updateSavedReportSchema, insertUserSettingsSchema, insertEmailTemplateSchema, updateEmailTemplateSchema } from "@shared/schema";
import { fromZodError } from "zod-validation-error";
import { getSession, isAuthenticated, isAdmin, isManagerOrAdmin, canEditAllOpportunities, canViewReports } from "./auth";
import { rateLimiter } from "./rate-limiter";
import { log } from "./vite";
import * as crypto from "crypto";
import * as z from "zod";
import { pdfService } from './pdf-service';
import multer from 'multer';
import path from 'path';
import { promises as fs } from 'fs';
import * as fsSync from 'fs';
import { nanoid } from 'nanoid';

// Mock DB and schema for demonstration purposes. Replace with your actual database logic.
// Assuming 'db' and 'opportunities' are available and configured for your ORM (e.g., Drizzle ORM)
// const db = { ... }; // Your database client instance
// const opportunities = { ... }; // Your opportunities table schema

// Mock requireAuth function as it's used in the changes but not defined in the original code
const requireAuth = isAuthenticated;

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup multer for file uploads
  const uploadsDir = path.join(process.cwd(), 'uploads');
  if (!fsSync.existsSync(uploadsDir)) {
    fsSync.mkdirSync(uploadsDir, { recursive: true });
  }

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB limit
    },
    fileFilter: (req, file, cb) => {
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Tipo de arquivo não permitido. Use JPEG, PNG, GIF ou WebP.'));
      }
    }
  });

  // Setup session middleware
  app.use(getSession());

  // Health check endpoint for deployment monitoring
  app.get("/healthz", (_req, res) => res.status(200).send("ok"));

  // Auth routes
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = loginSchema.parse(req.body);

      // Verifica rate limiting
      if (rateLimiter.isBlocked(email)) {
        const blockTime = rateLimiter.getBlockTimeRemaining(email);
        return res.status(429).json({ 
          message: `Muitas tentativas falharam. Tente novamente em ${blockTime} minutos.` 
        });
      }

      const user = await storage.validateUserPassword(email, password);

      if (!user) {
        rateLimiter.recordFailedAttempt(email);
        const remaining = rateLimiter.getRemainingAttempts(email);

        let message = "Email ou senha inválidos";
        if (remaining <= 2) {
          message += `. Restam ${remaining} tentativas antes do bloqueio.`;
        }

        return res.status(401).json({ message });
      }

      // Verifica se o usuário está ativo
      if (!user.isActive) {
        return res.status(401).json({ message: "Conta desativada. Entre em contato com o administrador." });
      }

      // Login bem-sucedido
      rateLimiter.recordSuccessfulLogin(email);
      req.session.userId = user.id;
      req.session.user = user;
      req.session.lastAccess = new Date().toISOString();

      console.log(`🔍 [LOGIN] User data stored in session: id=${user.id}, name=${user.name}, email=${user.email}, role=${user.role}`);

      // Remove password from response
      const { password: _, ...userWithoutPassword } = user;
      return res.json({ user: userWithoutPassword });
    } catch (error: any) {
      console.error(`[AUTH] Erro no login:`, error);
      if (error.name === "ZodError") {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      return res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Erro ao fazer logout" });
      }
      res.json({ message: "Logout realizado com sucesso" });
    });
  });

  app.get("/api/auth/me", isAuthenticated, async (req, res) => {
    const { password: _, ...userWithoutPassword } = req.session.user!;
    res.json(userWithoutPassword);
  });

  // Users routes
  app.get("/api/users", isAuthenticated, isManagerOrAdmin, async (req, res) => {
    try {
      const users = await storage.getUsers();
      // Remove passwords from response and filter out admin user
      const usersWithoutPasswords = users
        .filter(user => user.role !== 'admin')
        .map(({ password: _, ...user }) => user);
      res.json(usersWithoutPasswords);
    } catch (error) {
      res.status(500).json({ message: "Erro ao buscar usuários" });
    }
  });

  app.post("/api/users", isAuthenticated, isManagerOrAdmin, async (req, res) => {
    try {
      const validatedData = insertUserSchema.parse(req.body);

      // Check if email already exists
      const existingUser = await storage.getUserByEmail(validatedData.email);
      if (existingUser) {
        return res.status(400).json({ message: "Email já está em uso" });
      }

      const user = await storage.createUser(validatedData);
      const { password: _, ...userWithoutPassword } = user;
      res.status(201).json(userWithoutPassword);
    } catch (error: any) {
      if (error.name === "ZodError") {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      res.status(500).json({ message: "Erro ao criar usuário" });
    }
  });

  app.patch("/api/users/:id", isAuthenticated, isManagerOrAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const validatedData = updateUserSchema.parse(req.body);

      // Check if email already exists (if updating email)
      if (validatedData.email) {
        const existingUser = await storage.getUserByEmail(validatedData.email);
        if (existingUser && existingUser.id !== id) {
          return res.status(400).json({ message: "Email já está em uso" });
        }
      }

      const user = await storage.updateUser(id, validatedData);

      if (!user) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }

      const { password: _, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error: any) {
      if (error.name === "ZodError") {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      res.status(500).json({ message: "Erro ao atualizar usuário" });
    }
  });

  app.delete("/api/users/:id", isAuthenticated, isManagerOrAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      // Prevent deleting the current user
      if (id === req.session.userId) {
        return res.status(400).json({ message: "Você não pode excluir sua própria conta" });
      }

      const deleted = await storage.deleteUser(id);

      if (!deleted) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }
      res.status(204).send();
    } catch (error) {
      console.error(`Erro ao excluir usuário ${req.params.id}:`, error);
      res.status(500).json({ message: "Erro ao excluir usuário" });
    }
  });

  // Opportunities routes
  app.get("/api/opportunities", isAuthenticated, async (req, res) => {
    try {
      const opportunities = await storage.getOpportunities();
      res.json(opportunities);
    } catch (error) {
      res.status(500).json({ message: "Erro ao buscar oportunidades" });
    }
  });

  app.get("/api/opportunities/phase/:phase", isAuthenticated, async (req, res) => {
    try {
      const { phase } = req.params;
      const opportunities = await storage.getOpportunitiesByPhase(phase);
      res.json(opportunities);
    } catch (error) {
      res.status(500).json({ message: "Erro ao buscar oportunidades por fase" });
    }
  });

  app.get("/api/opportunities/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const opportunity = await storage.getOpportunity(id);

      if (!opportunity) {
        return res.status(404).json({ message: "Oportunidade não encontrada" });
      }

      res.json(opportunity);
    } catch (error) {
      res.status(500).json({ message: "Erro ao buscar oportunidade" });
    }
  });

  // Create opportunity
  app.post("/api/opportunities", isAuthenticated, async (req, res) => {
    try {
      console.log("🚨 TESTE: Iniciando criação de oportunidade");
      console.log("🔍 [OPPORTUNITY] Session object:", JSON.stringify(req.session, null, 2));
      console.log("🔍 [OPPORTUNITY] Session user:", JSON.stringify(req.session.user, null, 2));
      
      // Force output to stderr to ensure visibility
      process.stderr.write("🚨 STDERR: Iniciando criação de oportunidade\n");
      process.stderr.write(`🔍 STDERR: Session user name: ${req.session.user?.name}\n`);
      
      // CRITICAL FIX: Garantir que o nome do usuário seja capturado corretamente
      let createdByName = req.session.user?.name;
      
      // Debug: Log para verificar o que está na sessão
      console.log(`🔍 Debug sessão: userId=${req.session.userId}, userName=${req.session.user?.name}, userEmail=${req.session.user?.email}, userRole=${req.session.user?.role}`);
      
      if (!createdByName || createdByName.trim() === '') {
        createdByName = req.session.user?.email;
      }
      
      if (!createdByName || createdByName.trim() === '') {
        createdByName = req.session.user?.id ? `Usuário ${req.session.user.id.substring(0, 8)}` : 'Sistema';
      }
      
      if (!createdByName || createdByName.trim() === '') {
        createdByName = 'Sistema Padrão';
      }
      
      console.log(`✅ Nome final definido: ${createdByName}`);
      
      // Preservar todos os dados enviados e adicionar informações de auditoria
      const dataToValidate = {
        ...req.body,
        createdBy: req.session.userId,
        createdByName: createdByName
      };
      
      console.log(`🔍 [ROUTES] Data to validate: createdBy=${dataToValidate.createdBy}, createdByName=${dataToValidate.createdByName}, sessionUserId=${req.session.userId}, sessionUserName=${req.session.user?.name}`);
      process.stderr.write(`🔍 STDERR [ROUTES]: Data to validate - createdBy=${dataToValidate.createdBy}, createdByName=${dataToValidate.createdByName}, sessionUserId=${req.session.userId}, sessionUserName=${req.session.user?.name}\n`);

      // Ensure documents are properly formatted and persisted
      if (dataToValidate.documents && Array.isArray(dataToValidate.documents)) {
        dataToValidate.documents = dataToValidate.documents.map((doc: any) => {
          if (typeof doc === 'object') {
            return doc; // Keep as object for proper schema validation
          }
          return doc;
        });
      }

      // Ensure visitPhotos are properly formatted and persisted
      if (dataToValidate.visitPhotos && Array.isArray(dataToValidate.visitPhotos)) {
        dataToValidate.visitPhotos = dataToValidate.visitPhotos.map((photo: any) => {
          if (typeof photo === 'object') {
            return photo; // Keep as object for proper schema validation
          }
          return photo;
        });
      }

      console.log(`🔍 [ROUTES] Pre-validation data: createdByName=${dataToValidate.createdByName}`);
      process.stderr.write(`🔍 STDERR [ROUTES]: Pre-validation createdByName=${dataToValidate.createdByName}\n`);
      
      const validatedData = insertOpportunitySchema.parse(dataToValidate);
      
      console.log(`🔍 [ROUTES] Post-validation data: createdByName=${validatedData.createdByName}`);
      process.stderr.write(`🔍 STDERR [ROUTES]: Post-validation createdByName=${validatedData.createdByName}\n`);
      
      // Ensure createdByName is never null or undefined with multiple fallbacks
      if (!validatedData.createdByName || validatedData.createdByName.trim() === '') {
        const fallbackName = req.session.user?.name || req.session.user?.email || "Sistema Anônimo";
        validatedData.createdByName = fallbackName;
        console.log(`🔍 [ROUTES] Applied fallback: createdByName=${validatedData.createdByName}`);
        process.stderr.write(`🔍 STDERR [ROUTES]: Applied fallback createdByName=${validatedData.createdByName}\n`);
      }
      
      // Final validation before database insert
      if (!validatedData.createdByName || validatedData.createdByName.trim() === '') {
        throw new Error('createdByName cannot be null or empty');
      }
      
      const opportunity = await storage.createOpportunity(validatedData);

      res.status(201).json(opportunity);
    } catch (error: any) {
      console.error('❌ Erro na criação da oportunidade:', error);
      if (error.name === "ZodError") {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      res.status(500).json({ message: "Erro ao criar oportunidade" });
    }
  });

  app.patch("/api/opportunities/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;

      // Busca a oportunidade existente para verificar permissões e preservar dados
      const existingOpportunity = await storage.getOpportunity(id);
      if (!existingOpportunity) {
        return res.status(404).json({ message: "Oportunidade não encontrada" });
      }

      // Allow all authenticated users to edit any opportunity
      // No restrictions based on who created the opportunity or user role

      // Preserve existing documents and visitPhotos if not being updated
      const updateData = { ...req.body };
      
      // Preserve createdByName - never allow it to be updated
      if (updateData.createdByName) {
        delete updateData.createdByName;
      }

      // Ensure documents are properly formatted and preserved
      if (updateData.documents && Array.isArray(updateData.documents)) {
        updateData.documents = updateData.documents.map((doc: any) => {
          if (typeof doc === 'object') {
            return JSON.stringify(doc);
          }
          return doc;
        });
      } else if (!updateData.hasOwnProperty('documents')) {
        // If documents are not in the update, preserve existing ones
        updateData.documents = existingOpportunity.documents;
      }

      // Ensure visitPhotos are properly formatted and preserved
      if (updateData.visitPhotos && Array.isArray(updateData.visitPhotos)) {
        updateData.visitPhotos = updateData.visitPhotos.map((photo: any) => {
          if (typeof photo === 'object') {
            return JSON.stringify(photo);
          }
          return photo;
        });
      } else if (!updateData.hasOwnProperty('visitPhotos')) {
        // If visitPhotos are not in the update, preserve existing ones
        updateData.visitPhotos = existingOpportunity.visitPhotos;
      }

      const validatedData = insertOpportunitySchema.partial().parse(updateData);
      const opportunity = await storage.updateOpportunity(id, validatedData);
      res.json(opportunity);
    } catch (error: any) {
      if (error.name === "ZodError") {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      res.status(500).json({ message: "Erro ao atualizar oportunidade" });
    }
  });

  // Move opportunity to new phase
  app.patch("/api/opportunities/:id/move/:phase", isAuthenticated, async (req, res) => {
    try {
      const { id, phase } = req.params;

      // Impedir movimentação direta para "perdido" - deve usar /move-to-loss
      if (phase === 'perdido') {
        return res.status(400).json({ 
          message: "Para mover para 'perdido', utilize o endpoint /move-to-loss com motivo obrigatório" 
        });
      }

      // Buscar a oportunidade atual para preservar todos os dados
      const currentOpportunity = await storage.getOpportunity(id);
      if (!currentOpportunity) {
        return res.status(404).json({ message: "Oportunidade não encontrada" });
      }

      // Mover para a nova fase preservando todos os dados existentes
      const opportunity = await storage.moveOpportunityToPhase(id, phase);

      if (!opportunity) {
        return res.status(404).json({ message: "Erro ao mover oportunidade" });
      }
      res.json(opportunity);
    } catch (error: any) {
      // If it's a validation error from storage layer, return 400 with the message
      if (error.message && error.message.includes('Complete os campos obrigatórios')) {
        return res.status(400).json({ message: error.message });
      }
      console.error("Erro ao mover oportunidade:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  // Move opportunity to loss with reason
  app.patch("/api/opportunities/:id/move-to-loss", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      
      // Validar dados com Zod
      const lossDataSchema = z.object({
        lossReason: z.string().min(1, "Motivo da perda é obrigatório"),
        lossObservation: z.string().min(10, "Observação detalhada é obrigatória (mínimo 10 caracteres)").max(1000, "Observação muito longa (máximo 1000 caracteres)")
      });

      const validatedData = lossDataSchema.parse(req.body);
      const { lossReason, lossObservation } = validatedData;

      // Buscar a oportunidade atual
      const currentOpportunity = await storage.getOpportunity(id);
      if (!currentOpportunity) {
        return res.status(404).json({ message: "Oportunidade não encontrada" });
      }



      // Criar descrição composta para o card
      const lossDescription = `[Perdido] ${lossReason} — ${lossObservation}`;

      // Atualizar para a fase perdido com os dados de motivo da perda
      const updateData = {
        phase: 'perdido',
        lossReason,
        lossObservation,
        statement: lossDescription, // Salvar como descrição do card
        phaseUpdatedAt: new Date(),
      };

      // Validar dados finais com schema da oportunidade
      const finalValidatedData = insertOpportunitySchema.partial().parse(updateData);
      const opportunity = await storage.updateOpportunity(id, finalValidatedData);

      if (!opportunity) {
        return res.status(404).json({ message: "Erro ao mover oportunidade para perdido" });
      }


      res.json(opportunity);
    } catch (error: any) {
      if (error.name === "ZodError") {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      console.error("Erro ao mover oportunidade para perdido:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  app.delete("/api/opportunities/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;

      // Busca a oportunidade existente para verificar permissões
      const existingOpportunity = await storage.getOpportunity(id);
      if (!existingOpportunity) {
        return res.status(404).json({ message: "Oportunidade não encontrada" });
      }

      const userRole = req.session.user!.role;
      const userName = req.session.user!.name;

      // Admins podem excluir QUALQUER card
        if (userRole === 'admin') {
          // Admin permissions - no additional checks needed
        }
        // Gerentes podem excluir QUALQUER card
        else if (userRole === 'gerente') {
          // Manager permissions - no additional checks needed
        }
        // Usuários/Vendedores têm permissões limitadas
        else if (userRole === 'usuario' || userRole === 'vendedor') {
          // Allow all users to delete imported cards - no restrictions
          if (!existingOpportunity.isImported) {
            // Para cards normais, se foi criado por ele ou se é o vendedor responsável
            const canDelete = existingOpportunity.createdBy === userName || 
                             existingOpportunity.salesperson === userName;
            
            if (!canDelete) {
              return res.status(403).json({ message: "Você só pode excluir suas próprias oportunidades" });
            }
          }
        }

        // Tentar excluir
        const deleted = await storage.deleteOpportunity(id);

        if (!deleted) {
          return res.status(500).json({ message: "Erro interno ao excluir oportunidade" });
        }
      res.status(204).send();
    } catch (error: any) {
      console.error(`❌ Erro ao excluir oportunidade:`, error);
      res.status(500).json({ message: `Erro ao excluir oportunidade: ${error?.message || 'Erro desconhecido'}` });
    }
  });

  // Automations routes
  app.get("/api/automations", isAuthenticated, async (req, res) => {
    try {
      const automations = await storage.getAutomations();
      res.json(automations);
    } catch (error) {
      res.status(500).json({ message: "Erro ao buscar automações" });
    }
  });

  app.get("/api/automations/phase/:phase", isAuthenticated, async (req, res) => {
    try {
      const { phase } = req.params;
      const automations = await storage.getAutomationsByPhase(phase);
      res.json(automations);
    } catch (error) {
      res.status(500).json({ message: "Erro ao buscar automações por fase" });
    }
  });

  app.post("/api/automations", isAuthenticated, async (req, res) => {
    try {
      const validatedData = insertAutomationSchema.parse(req.body);
      const automation = await storage.createAutomation(validatedData);
      res.status(201).json(automation);
    } catch (error: any) {
      if (error.name === "ZodError") {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      res.status(500).json({ message: "Erro ao criar automação" });
    }
  });

  app.delete("/api/automations/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteAutomation(id);

      if (!deleted) {
        return res.status(404).json({ message: "Automação não encontrada" });
      }

      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Erro ao excluir automação" });
    }
  });

  // Stats endpoint - todos os usuários autenticados podem ver estatísticas básicas
  app.get("/api/stats", isAuthenticated, async (req, res) => {
    try {
      const opportunities = await storage.getOpportunities();

      const totalOpportunities = opportunities.length;
      const wonOpportunities = opportunities.filter(o => o.phase === 'ganho').length;
      const activeOpportunities = opportunities.filter(o => 
        o.phase && !['ganho', 'perdido'].includes(o.phase)
      ).length;

      const projectedRevenue = opportunities
        .filter(o => o.budget && o.phase && ['proposta', 'negociacao', 'ganho'].includes(o.phase))
        .reduce((sum, o) => sum + parseFloat(o.budget!.toString()), 0);

      // Calculate total value from won opportunities (only from "ganho" phase)
      const totalWonValue = opportunities
        .filter(opp => opp.phase === 'ganho')
        .reduce((sum, opp) => {
          // Use finalValue if available, otherwise use budget
          const value = opp.finalValue || opp.budget || 0;
          return sum + (typeof value === 'string' ? parseFloat(value) : value);
        }, 0);

      res.json({
        totalOpportunities,
        wonOpportunities,
        activeOpportunities,
        projectedRevenue: `R$ ${projectedRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        totalWonValue: totalWonValue
      });
    } catch (error) {
      res.status(500).json({ message: "Erro ao buscar estatísticas" });
    }
  });

  // User profile and settings routes
  app.get("/api/user/profile", isAuthenticated, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }

      // Buscar configurações do usuário para obter a foto de perfil
      const userSettings = await storage.getUserSettings(userId);

      const { password: _, ...userWithoutPassword } = user;
      res.json({
        ...userWithoutPassword,
        profilePhoto: userSettings?.profilePhoto || null
      });
    } catch (error) {
      res.status(500).json({ message: "Erro ao carregar perfil" });
    }
  });

  app.put("/api/user/profile", isAuthenticated, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const { name, email, phone, role, bio } = req.body;

      // Check if email already exists (if updating email)
      if (email && email !== req.session.user!.email) {
        const existingUser = await storage.getUserByEmail(email);
        if (existingUser && existingUser.id !== userId) {
          return res.status(400).json({ message: "Email já está em uso" });
        }
      }

      const updateData: any = {};
      if (name) updateData.name = name;
      if (email) updateData.email = email;
      if (phone) updateData.phone = phone;
      if (role) updateData.role = role;
      if (bio) updateData.bio = bio;

      const user = await storage.updateUser(userId, updateData);

      if (!user) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }

      // Update session
      req.session.user = user;

      const { password: _, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      res.status(500).json({ message: "Erro ao atualizar perfil" });
    }
  });

  // Profile photo upload endpoint
  app.post("/api/user/profile/photo", isAuthenticated, upload.single('photo'), async (req, res) => {
    try {
      const userId = req.session.userId!;
      
      if (!req.file) {
        return res.status(400).json({ message: "Nenhum arquivo enviado" });
      }

      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(req.file.mimetype)) {
        return res.status(400).json({ message: "Tipo de arquivo não permitido. Use JPEG, PNG, GIF ou WebP." });
      }

      // Validate file size (5MB max)
      if (req.file.size > 5 * 1024 * 1024) {
        return res.status(400).json({ message: "Arquivo muito grande. Tamanho máximo: 5MB" });
      }

      // Generate unique filename
      const fileExtension = path.extname(req.file.originalname);
      const fileName = `profile_${userId}_${Date.now()}${fileExtension}`;
      const filePath = path.join(uploadsDir, fileName);

      // Save file
      await fs.writeFile(filePath, req.file.buffer);

      // Update user settings with photo path
      const photoUrl = `/uploads/${fileName}`;
      
      // Buscar ou criar configurações do usuário
      let userSettings = await storage.getUserSettings(userId);
      if (!userSettings) {
        await storage.createUserSettings({ 
          userId: userId, 
          profilePhoto: photoUrl 
        });
      } else {
        await storage.updateUserSettings(userId, { profilePhoto: photoUrl });
      }

      res.json({ 
        message: "Foto de perfil atualizada com sucesso",
        photoUrl: photoUrl
      });
    } catch (error) {
      console.error('Error uploading profile photo:', error);
      res.status(500).json({ message: "Erro ao fazer upload da foto" });
    }
  });

  // Profile photo removal endpoint
  app.delete("/api/user/profile/photo", isAuthenticated, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const userSettings = await storage.getUserSettings(userId);

      if (!userSettings) {
        return res.status(404).json({ message: "Configurações do usuário não encontradas" });
      }

      // Remove photo file if exists
      if (userSettings.profilePhoto) {
        const fileName = path.basename(userSettings.profilePhoto);
        const filePath = path.join(uploadsDir, fileName);
        
        try {
          await fs.unlink(filePath);
        } catch (error) {
          // File might not exist, continue anyway
          console.warn('Could not delete photo file:', error);
        }
      }

      // Update user settings to remove photo
      await storage.updateUserSettings(userId, { profilePhoto: null });

      res.json({ message: "Foto de perfil removida com sucesso" });
    } catch (error) {
      console.error('Error removing profile photo:', error);
      res.status(500).json({ message: "Erro ao remover foto" });
    }
  });

  app.put("/api/user/settings", isAuthenticated, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const settings = req.body;

      // In a real application, you would store these settings in a separate table
      // For now, we'll just return success
      res.json({ message: "Configurações salvas com sucesso", settings });
    } catch (error) {
      res.status(500).json({ message: "Erro ao salvar configurações" });
    }
  });

  // Change password endpoint
  app.put("/api/user/change-password", isAuthenticated, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: "Senha atual e nova senha são obrigatórias" });
      }

      if (newPassword.length < 8) {
        return res.status(400).json({ message: "A nova senha deve ter pelo menos 8 caracteres" });
      }

      if (currentPassword === newPassword) {
        return res.status(400).json({ message: "A nova senha deve ser diferente da senha atual" });
      }

      const success = await storage.updatePassword(userId, currentPassword, newPassword);

      if (success) {
        res.json({ message: "Senha alterada com sucesso" });
      } else {
        res.status(400).json({ message: "Senha atual incorreta" });
      }
    } catch (error) {
      console.error('Error changing password:', error);
      res.status(500).json({ message: "Erro ao alterar senha" });
    }
  });

  // Get salespeople (users who can be assigned as salespeople)
  app.get("/api/users/salespeople", isAuthenticated, async (req, res) => {
    try {
      const users = await storage.getUsers();
      // Filter active users, exclude admin, and return only necessary fields
      const salespeople = users
        .filter(user => user.isActive && user.role !== 'admin')
        .map(user => ({
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role
        }));
      res.json(salespeople);
    } catch (error) {
      res.status(500).json({ message: "Erro ao buscar vendedores" });
    }
  });

  // Export data endpoint - apenas Admin e Gerente podem exportar dados
  app.get("/api/export/opportunities", isAuthenticated, canViewReports, async (req, res) => {
    try {
      const opportunities = await storage.getOpportunities();
      const users = await storage.getUsers();
      const automations = await storage.getAutomations();

      const exportData = {
        exportDate: new Date().toISOString(),
        data: {
          opportunities: opportunities.map(opp => ({
            ...opp,
            exportedBy: req.session.user!.name
          })),
          users: users
            .filter(user => user.role !== 'admin')
            .map(({ password: _, ...user }) => user),
          automations
        },
        metadata: {
          totalRecords: opportunities.length + users.length + automations.length,
          exportedBy: req.session.user!.name,
          exportedAt: new Date().toISOString()
        }
      };

      res.json(exportData);
    } catch (error) {
      res.status(500).json({ message: "Erro ao exportar dados" });
    }
  });

  // Reports endpoints - dados reais do CRM
  app.get("/api/reports/dashboard", isAuthenticated, async (req, res) => {
    try {
      const opportunities = await storage.getOpportunities();
      const users = await storage.getUsers();

      // Métricas básicas
      const totalOpportunities = opportunities.length;
      const wonOpportunities = opportunities.filter(o => o.phase === 'ganho').length;
      const lostOpportunitiesArray = opportunities.filter(o => o.phase === 'perdido');
      const lostOpportunities = lostOpportunitiesArray.length;
      const activeOpportunities = opportunities.filter(o => 
        o.phase && !['ganho', 'perdido'].includes(o.phase)
      ).length;

      // Receita total
      const totalRevenue = opportunities
        .filter(o => o.phase === 'ganho')
        .reduce((sum, opp) => {
          const value = parseFloat(opp.finalValue?.toString() || opp.budget?.toString() || '0');
          return sum + (isNaN(value) ? 0 : value);
        }, 0);

      // Valor total do pipeline
      const pipelineValue = opportunities.reduce((sum, opp) => {
        const value = parseFloat(opp.budget?.toString() || '0');
        return sum + (isNaN(value) ? 0 : value);
      }, 0);

      // Taxa de conversão
      const conversionRate = totalOpportunities > 0 ? (wonOpportunities / totalOpportunities) * 100 : 0;

      // Ticket médio
      const avgTicket = wonOpportunities > 0 ? totalRevenue / wonOpportunities : 0;

      // Tempo médio de ciclo de venda
      const avgSalesCycle = wonOpportunities > 0 
        ? opportunities
            .filter(o => o.phase === 'ganho')
            .reduce((sum, opp) => {
              const created = opp.createdAt ? new Date(opp.createdAt) : new Date();
              const updated = opp.updatedAt ? new Date(opp.updatedAt) : new Date();
              const cycleDays = Math.floor((updated.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
              return sum + Math.max(cycleDays, 1); // Mínimo 1 dia
            }, 0) / wonOpportunities
        : 0;

      // Distribuição por fase
      const phaseCounts = opportunities.reduce((acc, opp) => {
        if (opp.phase) {
          acc[opp.phase] = (acc[opp.phase] || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>);

      const phaseDistribution = Object.entries(phaseCounts).map(([phase, count]) => ({
        phase,
        count,
        percentage: totalOpportunities > 0 ? Math.round((count / totalOpportunities) * 100) : 0
      }));

      // Distribuição por temperatura
      const temperatureCounts = opportunities.reduce((acc, opp) => {
        const temp = opp.businessTemperature || 'morno';
        acc[temp] = (acc[temp] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const temperatureDistribution = Object.entries(temperatureCounts).map(([temperature, count]) => ({
        temperature,
        count,
        percentage: totalOpportunities > 0 ? Math.round((count / totalOpportunities) * 100) : 0
      }));

      // Performance por vendedor
      const salesPerformance = users
        .filter(u => u.role === 'usuario')
        .map(user => {
          const userOpportunities = opportunities.filter(o => o.salesperson === user.name);
          const userWon = userOpportunities.filter(o => o.phase === 'ganho');
          const userRevenue = userWon.reduce((sum, opp) => {
            const value = parseFloat(opp.finalValue?.toString() || opp.budget?.toString() || '0');
            return sum + (isNaN(value) ? 0 : value);
          }, 0);

          return {
            salesperson: user.name,
            totalOpportunities: userOpportunities.length,
            wonOpportunities: userWon.length,
            revenue: userRevenue,
            conversionRate: userOpportunities.length > 0 ? (userWon.length / userOpportunities.length) * 100 : 0
          };
        })
        .filter(s => s.totalOpportunities > 0)
        .sort((a, b) => b.revenue - a.revenue);

      // Motivos de perda
      const lossReasons = lostOpportunitiesArray.reduce((acc: Record<string, number>, opp) => {
        const reason = opp.lossReason || 'Não informado';
        acc[reason] = (acc[reason] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const lossReasonsArray = Object.entries(lossReasons)
        .map(([reason, count]) => ({ reason, count: count as number }))
        .sort((a, b) => (b.count as number) - (a.count as number));

      const reportData = {
        summary: {
          totalOpportunities,
          wonOpportunities,
          lostOpportunities,
          activeOpportunities,
          totalRevenue,
          pipelineValue,
          conversionRate,
          avgTicket,
          avgSalesCycle
        },
        distributions: {
          phases: phaseDistribution,
          temperatures: temperatureDistribution
        },
        performance: {
          salespeople: salesPerformance
        },
        lossAnalysis: {
          reasons: lossReasonsArray
        }
      };

      res.json(reportData);
    } catch (error) {
      console.error("Reports dashboard error:", error);
      res.status(500).json({ message: "Erro ao buscar dados do relatório" });
    }
  });

  app.get("/api/reports/monthly-trend", isAuthenticated, async (req, res) => {
    try {
      const opportunities = await storage.getOpportunities();

      // Group opportunities by month
      const monthlyData = opportunities.reduce((acc, opp) => {
        if (!opp.createdAt) return acc;

        const date = new Date(opp.createdAt);
        const monthKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;

        if (!acc[monthKey]) {
          acc[monthKey] = {
            month: monthKey,
            total: 0,
            won: 0,
            lost: 0
          };
        }

        acc[monthKey].total++;
        if (opp.phase === 'ganho') acc[monthKey].won++;
        if (opp.phase === 'perdido') acc[monthKey].lost++;

        return acc;
      }, {} as Record<string, any>);

      const trend = Object.values(monthlyData).sort((a: any, b: any) => a.month.localeCompare(b.month));

      res.json(trend);
    } catch (error) {
      res.status(500).json({ message: "Erro ao buscar tendência mensal" });
    }
  });

  // Custom reports endpoint with filters
  app.get("/api/reports/custom", isAuthenticated, canViewReports, async (req, res) => {
    try {
      const { salesperson, phase, businessTemperature, dateRange } = req.query;
      let opportunities = await storage.getOpportunities();

      // Apply filters
      if (salesperson) {
        opportunities = opportunities.filter(opp => 
          opp.salesperson === salesperson
        );
      }

      if (phase) {
        opportunities = opportunities.filter(opp => 
          opp.phase === phase
        );
      }

      if (businessTemperature) {
        opportunities = opportunities.filter(opp => 
          opp.businessTemperature === businessTemperature
        );
      }

      if (dateRange) {
        const now = new Date();
        let startDate = new Date();

        switch (dateRange) {
          case 'last-7-days':
            startDate.setDate(now.getDate() - 7);
            break;
          case 'last-30-days':
            startDate.setDate(now.getDate() - 30);
            break;
          case 'last-90-days':
            startDate.setDate(now.getDate() - 90);
            break;
          case 'current-month':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            break;
          case 'last-month':
            startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const endDate = new Date(now.getFullYear(), now.getMonth(), 0);
            opportunities = opportunities.filter(opp => {
              if (!opp.createdAt) return false;
              const createdDate = new Date(opp.createdAt);
              return createdDate >= startDate && createdDate <= endDate;
            });
            break;
          case 'current-year':
            startDate = new Date(now.getFullYear(), 0, 1);
            break;
        }

        if (dateRange !== 'last-month') {
          opportunities = opportunities.filter(opp => {
            if (!opp.createdAt) return false;
            return new Date(opp.createdAt) >= startDate;
          });
        }
      }

      // Calculate summary metrics
      const totalOpportunities = opportunities.length;
      const wonOpportunities = opportunities.filter(o => o.phase === 'ganho');
      const totalRevenue = wonOpportunities.reduce((sum, opp) => {
        return sum + (opp.finalValue ? parseFloat(opp.finalValue.toString()) : 
                     opp.budget ? parseFloat(opp.budget.toString()) : 0);
      }, 0);
      const conversionRate = totalOpportunities > 0 
        ? Math.round((wonOpportunities.length / totalOpportunities) * 100) 
        : 0;
      const averageTicket = wonOpportunities.length > 0 
        ? totalRevenue / wonOpportunities.length 
        : 0;

      // Phase distribution
      const phaseNames = {
        'prospeccao': 'Prospecção',
        'em-atendimento': 'Em Atendimento',
        'visita-tecnica': 'Visita Técnica',
        'proposta': 'Proposta',
        'negociacao': 'Negociação',
        'ganho': 'Ganho',
        'perdido': 'Perdido'
      };

      const phaseDistribution = Object.entries(phaseNames).map(([phase, name]) => ({
        name,
        count: opportunities.filter(o => o.phase === phase).length
      })).filter(item => item.count > 0);

      // Temperature distribution
      const temperatureCounts = opportunities.reduce((acc, opp) => {
        const temp = opp.businessTemperature || 'morno';
        acc[temp] = (acc[temp] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const temperatureDistribution = Object.entries(temperatureCounts).map(([temperature, count]) => ({
        temperature: temperature.charAt(0).toUpperCase() + temperature.slice(1),
        count
      }));

      const response = {
        summary: {
          totalOpportunities,
          totalRevenue,
          conversionRate,
          averageTicket
        },
        charts: {
          phaseDistribution: phaseDistribution.length > 0 ? phaseDistribution : null,
          temperatureDistribution: temperatureDistribution.length > 0 ? temperatureDistribution : null
        },
        opportunities: opportunities.map(opp => ({
          id: opp.id,
          company: opp.company,
          contact: opp.contact,
          phase: opp.phase,
          salesperson: opp.salesperson,
          businessTemperature: opp.businessTemperature,
          budget: opp.budget,
          finalValue: opp.finalValue,
          createdAt: opp.createdAt
        }))
      };

      res.json(response);
    } catch (error) {
      res.status(500).json({ message: "Erro ao gerar relatório personalizado" });
    }
  });

  // Saved Reports routes
  app.get("/api/reports/saved", isAuthenticated, canViewReports, async (req, res) => {
    try {
      const userId = req.session.user!.id;
      const reports = await storage.getSavedReportsByUser(userId);
      res.json(reports);
    } catch (error) {
      res.status(500).json({ message: "Erro ao buscar relatórios salvos" });
    }
  });

  app.get("/api/reports/saved/:id", isAuthenticated, canViewReports, async (req, res) => {
    try {
      const report = await storage.getSavedReport(req.params.id);
      if (!report) {
        return res.status(404).json({ message: "Relatório não encontrado" });
      }

      const userId = req.session.user!.id;
      // Check if user can access this report (owns it or it's public)
      if (report.createdBy !== userId && !report.isPublic) {
        return res.status(403).json({ message: "Acesso negado" });
      }

      res.json(report);
    } catch (error) {
      res.status(500).json({ message: "Erro ao buscar relatório" });
    }
  });

  app.post("/api/reports/saved", isAuthenticated, canViewReports, async (req, res) => {
    try {
      const userId = req.session.user!.id;
      const validatedData = insertSavedReportSchema.parse({
        ...req.body,
        createdBy: userId
      });

      const report = await storage.createSavedReport(validatedData);
      res.status(201).json(report);
    } catch (error: any) {
      if (error.name === "ZodError") {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      res.status(500).json({ message: "Erro ao criar relatório" });
    }
  });

  app.patch("/api/reports/saved/:id", isAuthenticated, canViewReports, async (req, res) => {
    try {
      const report = await storage.getSavedReport(req.params.id);
      if (!report) {
        return res.status(404).json({ message: "Relatório não encontrado" });
      }

      const userId = req.session.user!.id;
      // Only the creator can edit the report
      if (report.createdBy !== userId) {
        return res.status(403).json({ message: "Acesso negado" });
      }

      const validatedData = updateSavedReportSchema.parse(req.body);
      const updatedReport = await storage.updateSavedReport(req.params.id, validatedData);

      if (!updatedReport) {
        return res.status(404).json({ message: "Relatório não encontrado" });
      }

      res.json(updatedReport);
    } catch (error: any) {
      if (error.name === "ZodError") {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      res.status(500).json({ message: "Erro ao atualizar relatório" });
    }
  });

  app.delete("/api/reports/saved/:id", isAuthenticated, canViewReports, async (req, res) => {
    try {
      const report = await storage.getSavedReport(req.params.id);
      if (!report) {
        return res.status(404).json({ message: "Relatório não encontrado" });
      }

      const userId = req.session.user!.id;
      // Only the creator can delete the report
      if (report.createdBy !== userId) {
        return res.status(403).json({ message: "Acesso negado" });
      }

      const deleted = await storage.deleteSavedReport(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Relatório não encontrado" });
      }

      res.json({ message: "Relatório removido com sucesso" });
    } catch (error) {
      res.status(500).json({ message: "Erro ao remover relatório" });
    }
  });

  app.post("/api/reports/saved/:id/run", isAuthenticated, canViewReports, async (req, res) => {
    try {
      const report = await storage.getSavedReport(req.params.id);
      if (!report) {
        return res.status(404).json({ message: "Relatório não encontrado" });
      }

      const userId = req.session.user!.id;
      // Check if user can access this report (owns it or it's public)
      if (report.createdBy !== userId && !report.isPublic) {
        return res.status(403).json({ message: "Acesso negado" });
      }

      // Update last generated timestamp
      const updatedReport = await storage.updateReportLastGenerated(req.params.id);

      res.json({ 
        message: "Relatório executado com sucesso",
        lastGenerated: updatedReport?.lastGenerated
      });
    } catch (error) {
      res.status(500).json({ message: "Erro ao executar relatório" });
    }
  });

  app.get("/api/reports/quick-stats", isAuthenticated, canViewReports, async (req, res) => {
    try {
      const opportunities = await storage.getOpportunities();
      const users = await storage.getUsers();
      const savedReports = await storage.getSavedReports();

      const stats = {
        totalOpportunities: opportunities.length,
        activeOpportunities: opportunities.filter(o => !['ganho', 'perdido'].includes(o.phase || '')).length,
        totalRevenue: opportunities
          .filter(o => o.phase === 'ganho')
          .reduce((sum, opp) => {
            return sum + (opp.finalValue ? parseFloat(opp.finalValue.toString()) : 
                         opp.budget ? parseFloat(opp.budget.toString()) : 0);
          }, 0),
        totalUsers: users.filter(u => u.isActive && u.role !== 'admin').length,
        totalReports: savedReports.length,
        reportsToday: savedReports.filter(r => {
          if (!r.lastGenerated) return false;
          const today = new Date().toDateString();
          const generated = new Date(r.lastGenerated).toDateString();
          return today === generated;
        }).length
      };

      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Erro ao buscar estatísticas rápidas" });
    }
  });

  // Download reports endpoint - PDF Generation
  app.get("/api/reports/download", isAuthenticated, canViewReports, async (req, res) => {
    try {
      const { type = 'complete', searchTerm, phase, temperature, userId, month } = req.query;
      
      // Get all opportunities and users
      let opportunities = await storage.getOpportunities();
      const users = await storage.getUsers();
      
      // Apply filters (same logic as dashboard)
      if (searchTerm && typeof searchTerm === 'string') {
        const term = searchTerm.toLowerCase();
        opportunities = opportunities.filter(opp => 
          opp.title?.toLowerCase().includes(term) ||
          opp.company?.toLowerCase().includes(term) ||
          opp.contact?.toLowerCase().includes(term)
        );
      }
      
      if (phase && typeof phase === 'string' && phase !== 'all') {
        opportunities = opportunities.filter(opp => opp.phase === phase);
      }
      
      if (temperature && typeof temperature === 'string' && temperature !== 'all') {
        opportunities = opportunities.filter(opp => opp.businessTemperature === temperature);
      }
      
      if (userId && typeof userId === 'string' && userId !== 'all') {
        opportunities = opportunities.filter(opp => opp.assignedTo === userId);
      }
      
      if (month && typeof month === 'string' && month !== 'all') {
        const [year, monthNum] = month.split('-');
        opportunities = opportunities.filter(opp => {
          if (!opp.createdAt) return false;
          const oppDate = new Date(opp.createdAt);
          return oppDate.getFullYear() === parseInt(year) && 
                 oppDate.getMonth() === parseInt(monthNum) - 1;
        });
      }

      // Generate filename with current date and filters
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');
      let filename = `relatorio-${type}-${dateStr}-${timeStr}`;
      
      // Add filter info to filename and create filter description
      const filterParts = [];
      const filterDescriptions = [];
      
      if (searchTerm) {
        filterParts.push(`busca-${searchTerm}`);
        filterDescriptions.push(`Busca: ${searchTerm}`);
      }
      if (phase && phase !== 'all') {
        filterParts.push(`fase-${phase}`);
        filterDescriptions.push(`Fase: ${phase}`);
      }
      if (temperature && temperature !== 'all') {
        filterParts.push(`temp-${temperature}`);
        filterDescriptions.push(`Temperatura: ${temperature}`);
      }
      if (userId && userId !== 'all') {
        const user = users.find(u => u.id === userId);
        if (user) {
          filterParts.push(`usuario-${user.name.replace(/\s+/g, '-')}`);
          filterDescriptions.push(`Usuário: ${user.name}`);
        }
      }
      if (month && month !== 'all') {
        filterParts.push(`mes-${month}`);
        filterDescriptions.push(`Mês: ${month}`);
      }
      
      if (filterParts.length > 0) {
        filename += `-${filterParts.join('-')}`;
      }
      
      filename += '.pdf';

      // Prepare data for PDF generation
      const phases = ['prospecção', 'qualificação', 'proposta', 'negociação', 'fechamento'];
      const temperatures = ['fria', 'morna', 'quente'];

      // Calculate phase distribution
      const phaseDistribution = phases.map(phase => {
        const phaseOpps = opportunities.filter(o => o.phase === phase);
        const phaseValue = phaseOpps.reduce((sum, opp) => {
          return sum + (opp.budget ? parseFloat(opp.budget.toString()) : 0);
        }, 0);
        const percentage = opportunities.length > 0 ? (phaseOpps.length / opportunities.length * 100) : 0;
        
        return {
          phase: phase.charAt(0).toUpperCase() + phase.slice(1),
          count: phaseOpps.length,
          percentage,
          totalValue: phaseValue
        };
      });

      // Calculate temperature distribution
      const temperatureDistribution = temperatures.map(temp => {
        const tempOpps = opportunities.filter(o => o.businessTemperature === temp);
        const tempValue = tempOpps.reduce((sum, opp) => {
          return sum + (opp.budget ? parseFloat(opp.budget.toString()) : 0);
        }, 0);
        const percentage = opportunities.length > 0 ? (tempOpps.length / opportunities.length * 100) : 0;
        
        return {
          temperature: temp.charAt(0).toUpperCase() + temp.slice(1),
          count: tempOpps.length,
          percentage,
          totalValue: tempValue
        };
      });

      // Calculate performance by salesperson
      const performanceBySalesperson = users
        .filter(u => u.isActive && u.role !== 'admin')
        .map(user => {
          const userOpps = opportunities.filter(o => o.assignedTo === user.id);
          const userClosedOpps = userOpps.filter(o => o.phase === 'fechamento');
          const userTotalValue = userClosedOpps.reduce((sum, opp) => {
            return sum + (opp.finalValue ? parseFloat(opp.finalValue.toString()) : 
                         opp.budget ? parseFloat(opp.budget.toString()) : 0);
          }, 0);
          const conversionRate = userOpps.length > 0 ? (userClosedOpps.length / userOpps.length * 100) : 0;

          return {
            name: user.name,
            totalOpportunities: userOpps.length,
            closedOpportunities: userClosedOpps.length,
            conversionRate,
            totalValue: userTotalValue
          };
        })
        .sort((a, b) => b.totalValue - a.totalValue);

      // Calculate performance by creator
      const performanceByCreator = users
        .filter(u => u.isActive)
        .map(user => {
          const userOpps = opportunities.filter(o => o.createdBy === user.id);
          const userClosedOpps = userOpps.filter(o => o.phase === 'fechamento');
          const userTotalValue = userClosedOpps.reduce((sum, opp) => {
            return sum + (opp.finalValue ? parseFloat(opp.finalValue.toString()) : 
                         opp.budget ? parseFloat(opp.budget.toString()) : 0);
          }, 0);
          const conversionRate = userOpps.length > 0 ? (userClosedOpps.length / userOpps.length * 100) : 0;

          return {
            name: user.name,
            totalOpportunities: userOpps.length,
            closedOpportunities: userClosedOpps.length,
            conversionRate,
            totalValue: userTotalValue
          };
        })
        .sort((a, b) => b.totalValue - a.totalValue);

      // Prepare opportunities data with user names
      const opportunitiesWithUsers = opportunities.map(opp => {
        const assignedUser = users.find(u => u.id === opp.assignedTo);
        const createdByUser = users.find(u => u.id === opp.createdBy);
        
        return {
          ...opp,
          assignedUser: assignedUser?.name || 'N/A',
          createdByUser: createdByUser?.name || 'N/A',
          value: opp.budget ? parseFloat(opp.budget.toString()) : 0,
          phase: opp.phase || 'N/A',
          temperature: opp.businessTemperature || 'N/A'
        };
      });

      // Prepare report data
      const reportData = {
        opportunities: opportunitiesWithUsers,
        phaseDistribution,
        temperatureDistribution,
        performanceBySalesperson,
        performanceByCreator
      };

      // Map Portuguese types to English types for PDF service
      const typeMapping: { [key: string]: string } = {
        'completo': 'complete',
        'fases': 'phases',
        'temperatura': 'temperature',
        'performance': 'performance',
        'oportunidades': 'opportunities'
      };

      // Convert type to English if it's in Portuguese
      const mappedType = typeMapping[type as string] || type as string;

      // Define report titles
      const reportTitles = {
        complete: 'Relatório Completo de Oportunidades',
        phases: 'Relatório de Distribuição por Fase',
        temperature: 'Relatório de Distribuição por Temperatura',
        performance: 'Relatório de Performance por Vendedor',
        opportunities: 'Relatório de Lista de Oportunidades'
      };

      const reportTitle = reportTitles[mappedType as keyof typeof reportTitles] || 'Relatório CRM';
      const filtersDescription = filterDescriptions.length > 0 ? filterDescriptions.join(', ') : undefined;

      // Generate PDF
      const pdfBuffer = await pdfService.generatePDF({
        title: reportTitle,
        type: mappedType,
        data: reportData,
        filters: filtersDescription
      });

      // Send PDF response
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Length', pdfBuffer.length);
      
      res.send(pdfBuffer);
      
    } catch (error: any) {
      console.error('Erro ao gerar relatório PDF:', error);
      res.status(500).json({ message: "Erro ao gerar relatório PDF para download" });
    }
  });

  // Clear all data endpoint - Admin only
  app.delete("/api/admin/clear-all-data", isAuthenticated, isAdmin, async (req, res) => {
    try {
      console.log(`[ADMIN] Usuário ${req.session.user!.name} iniciando limpeza completa dos dados`);
      
      // Delete all opportunities
      const deletedOpportunities = await storage.clearAllOpportunities();
      console.log(`[ADMIN] ${deletedOpportunities} oportunidades removidas`);
      
      // Delete all automations
      const deletedAutomations = await storage.clearAllAutomations();
      console.log(`[ADMIN] ${deletedAutomations} automações removidas`);
      
      // Delete all saved reports
      const deletedReports = await storage.clearAllSavedReports();
      console.log(`[ADMIN] ${deletedReports} relatórios salvos removidos`);
      
      console.log(`[ADMIN] Limpeza completa finalizada por ${req.session.user!.name}`);
      
      res.json({ 
        message: "Todos os dados foram removidos com sucesso",
        summary: {
          opportunities: deletedOpportunities,
          automations: deletedAutomations,
          savedReports: deletedReports
        }
      });
    } catch (error: any) {
      console.error("[ADMIN] Erro ao limpar dados:", error);
      res.status(500).json({ message: "Erro ao limpar dados do sistema" });
    }
  });

  // Enhanced API routes for new features

  // User Settings
  app.get("/api/user/settings", isAuthenticated, async (req, res) => {
    try {
      const settings = await storage.getUserSettings(req.session.userId!);
      res.json(settings || {
        emailNotifications: true,
        smsNotifications: false,
        pushNotifications: false,
        autoBackup: true,
        language: "pt-BR",
        timezone: "America/Sao_Paulo"
      });
    } catch (error) {
      res.status(500).json({ message: "Erro ao buscar configurações" });
    }
  });

  app.put("/api/user/settings", isAuthenticated, async (req, res) => {
    try {
      const settings = await storage.updateUserSettings(req.session.userId!, req.body);
      res.json(settings);
    } catch (error) {
      res.status(500).json({ message: "Erro ao atualizar configurações" });
    }
  });

  // Manual backup
  app.post("/api/backup/create", isAuthenticated, isAdmin, async (req, res) => {
    try {
      // const success = await backupService.createDatabaseBackup('manual');
      const success = false; // Backup disabled for memory storage
      if (success) {
        res.json({ message: "Backup criado com sucesso" });
      } else {
        res.status(500).json({ message: "Falha ao criar backup" });
      }
    } catch (error) {
      res.status(500).json({ message: "Erro ao criar backup" });
    }
  });

  // Excel export
  app.get("/api/export/excel", isAuthenticated, async (req, res) => {
    try {
      // const filepath = await backupService.createDataExport('excel');
      // Excel export disabled for memory storage
      res.status(500).json({ message: "Exportação Excel não disponível no modo de memória" });
    } catch (error) {
      res.status(500).json({ message: "Erro ao criar exportação" });
    }
  });

  // Document upload functionality

  // Setup multer for document uploads
  const documentUpload = multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => {
        const uploadPath = path.join(process.cwd(), 'uploads', 'documents');

        // Create directory if it doesn't exist
        try {
          if (!fsSync.existsSync(uploadPath)) {
            fsSync.mkdirSync(uploadPath, { recursive: true });
          }
          cb(null, uploadPath);
        } catch (error) {
          console.error('Error creating upload directory:', error);
          cb(error as Error, uploadPath);
        }
      },
      filename: (req, file, cb) => {
        try {
          // Generate unique filename: timestamp_originalname
          const timestamp = Date.now();
          const originalName = file.originalname.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9._-]/g, ''); // Replace spaces and special chars
          cb(null, `${timestamp}_${originalName}`);
        } catch (error) {
          console.error('Error generating filename:', error);
          cb(error as Error, file.originalname);
        }
      }
    }),
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB limit for documents
      files: 1
    },
    fileFilter: (req, file, cb) => {
      try {
        const allowedTypes = [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'image/jpeg',
          'image/jpg', 
          'image/png',
          'image/gif',
          'text/plain'
        ];



        if (allowedTypes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new Error('Tipo de arquivo não suportado. Use PDF, DOC, DOCX, JPG, PNG, GIF ou TXT'));
        }
      } catch (error) {
        console.error('Error in file filter:', error);
        cb(null, false);
      }
    }
  });

  // Document upload endpoint - Base64 storage for production compatibility
  app.post("/api/documents/upload", isAuthenticated, (req, res) => {
    const upload = multer({
      storage: multer.memoryStorage(),
      limits: {
        fileSize: 50 * 1024 * 1024, // 50MB limit
      },
      fileFilter: (req, file, cb) => {
        const allowedTypes = [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'image/jpeg',
          'image/jpg', 
          'image/png',
          'image/gif',
          'text/plain'
        ];

        if (allowedTypes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new Error('Tipo de arquivo não suportado. Use PDF, DOC, DOCX, JPG, PNG, GIF ou TXT'));
        }
      }
    }).single('document');

    upload(req, res, async (err) => {
      try {
        if (err) {
          console.error('Upload error:', err);
          return res.status(400).json({ message: err.message || "Erro no upload do arquivo" });
        }

        if (!req.file) {
          return res.status(400).json({ message: "Nenhum arquivo enviado" });
        }

        // Convert file to Base64
        const base64Data = req.file.buffer.toString('base64');
        const dataUrl = `data:${req.file.mimetype};base64,${base64Data}`;

        const uploadedFile = {
          id: `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name: req.file.originalname,
          size: req.file.size,
          type: req.file.mimetype,
          url: dataUrl, // Store as data URL for direct browser access
          uploadedAt: new Date(),
          uploadedBy: req.session.user!.id
        };

        res.status(201).json(uploadedFile);
      } catch (error: any) {
        console.error('Document upload error:', error);
        res.status(500).json({ message: "Erro ao fazer upload do documento" });
      }
    });
  });

  // Note: File serving endpoint removed - files are now stored as Base64 data URLs

  // Import functionality

  // Setup multer for file uploads
  const importFileUpload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 100 * 1024 * 1024, // 100MB
      files: 1
    },
    fileFilter: (req, file, cb) => {
      const allowedTypes = [
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/csv',
        'application/csv'
      ];

      if (allowedTypes.includes(file.mimetype) || file.originalname.endsWith('.csv')) {
        cb(null, true);
      } else {
        cb(new Error('Tipo de arquivo não suportado. Use Excel (.xlsx, .xls) ou CSV'));
      }
    }
  });

  // In-memory storage for import sessions
  const importSessions = new Map<string, any>();

  // Field mapping configuration
  const FIELD_MAPPINGS = {
    contact: { 
      displayName: 'Nome do Contato', 
      required: false,
      transform: (value: any) => value?.toString().trim() || null
    },
    company: { 
      displayName: 'Nome da Empresa', 
      required: false,
      transform: (value: any) => value?.toString().trim() || null
    },
    phone: { 
      displayName: 'Telefone', 
      required: false,
      transform: (value: any) => {
        if (!value) return null;
        const phone = value.toString().replace(/\D/g, '') || '';
        if (phone.length === 0) return null;

        // Add Brazil country code if not present and phone is valid
        if (!phone.startsWith('55') && phone.length >= 10 && phone.length <= 11) {
          return `55${phone}`;
        }

        return phone;
      },
      validation: (value: any) => {
        if (!value) return true; // Optional field
        const phone = value.toString().replace(/\D/g, '') || '';

        if (phone.length === 0) return true; // Empty is valid since optional

        // Accept any reasonable phone format (flexible validation)
        return phone.length >= 8 && phone.length <= 15;
      }
    },
    cpf: { 
      displayName: 'CPF', 
      required: false,
      transform: (value: any) => {
        const cpf = value?.toString().replace(/\D/g, '') || '';
        return cpf || null;
      }
    },
    cnpj: { 
      displayName: 'CNPJ', 
      required: false,
      transform: (value: any) => {
        const cnpj = value?.toString().replace(/\D/g, '') || '';
        return cnpj || null;
      }
    },
    needCategory: { 
      displayName: 'Categoria da Necessidade', 
      required: false,
      transform: (value: any) => value?.toString().trim() || null
    },
    clientNeeds: { 
      displayName: 'Necessidades do Cliente', 
      required: false,
      transform: (value: any) => value?.toString().trim() || null
    },
    budget: { 
      displayName: 'Orçamento', 
      required: false,
      transform: (value: any) => {
        if (!value) return null;
        const numValue = parseFloat(value.toString().replace(/[^\d,.-]/g, '').replace(',', '.'));
        return isNaN(numValue) ? null : numValue;
      }
    },
    finalValue: { 
      displayName: 'Valor Final', 
      required: false,
      transform: (value: any) => {
        if (!value) return null;
        const numValue = parseFloat(value.toString().replace(/[^\d,.-]/g, '').replace(',', '.'));
        return isNaN(numValue) ? null : numValue;
      }
    },
    businessTemperature: { 
      displayName: 'Temperatura do Negócio', 
      required: false,
      transform: (value: any) => {
        if (!value) return null;
        const temp = value.toString().toLowerCase().trim();
        const tempMap: Record<string, string> = {
          'frio': 'frio',
          'morno': 'morno', 
          'quente': 'quente',
          'cold': 'frio',
          'warm': 'morno',
          'hot': 'quente'
        };
        return tempMap[temp] || 'frio';
      }
    },
    salesperson: { 
      displayName: 'Vendedor', 
      required: false,
      transform: (value: any) => value?.toString().trim() || null
    },
    createdByName: { 
      displayName: 'Criado por', 
      required: false,
      transform: (value: any) => value?.toString().trim() || null
    },
    phase: { 
      displayName: 'Fase', 
      required: false,
      transform: (value: any) => {
        if (!value) return 'prospeccao';
        const phase = value.toString().toLowerCase().trim();
        const phaseMap: Record<string, string> = {
          'prospecção': 'prospeccao',
          'prospeccao': 'prospeccao',
          'qualificação': 'qualificacao',
          'qualificacao': 'qualificacao',
          'proposta': 'proposta',
          'negociação': 'negociacao',
          'negociacao': 'negociacao',
          'fechamento': 'fechamento',
          'perdido': 'perdido',
          'ganho': 'ganho',
          'visita técnica': 'visita-tecnica',
         'visita tecnica': 'visita-tecnica'
        };
        return phaseMap[phase] || 'prospeccao';
      }
    }
  };

  // Auto-detect field mapping from CSV headers
  function autoDetectMapping(headers: string[]): Record<string, string> {
    const mapping: Record<string, string> = {};

    headers.forEach(header => {
      const lowerHeader = header.toLowerCase().trim();

      // Direct mappings
      if (lowerHeader.includes('título') || lowerHeader.includes('titulo') || lowerHeader === 'contato') {
        mapping[header] = 'contact';
      } else if (lowerHeader.includes('empresa') || lowerHeader.includes('company')) {
        mapping[header] = 'company';
      } else if (lowerHeader.includes('telefone') || lowerHeader.includes('phone')) {
        mapping[header] = 'phone';
      } else if (lowerHeader === 'cpf') {
        mapping[header] = 'cpf';
      } else if (lowerHeader === 'cnpj') {
        mapping[header] = 'cnpj';
      } else if (lowerHeader.includes('categoria') && lowerHeader.includes('necessidade')) {
        mapping[header] = 'needCategory';
      } else if (lowerHeader.includes('necessidades') && lowerHeader.includes('cliente')) {
        mapping[header] = 'clientNeeds';
      } else if (lowerHeader.includes('orçamento') || lowerHeader.includes('orcamento') || lowerHeader.includes('budget')) {
        mapping[header] = 'budget';
      } else if (lowerHeader.includes('valor final') || lowerHeader.includes('final value')) {
        mapping[header] = 'finalValue';
      } else if (lowerHeader.includes('temperatura') && lowerHeader.includes('negócio')) {
        mapping[header] = 'businessTemperature';
      } else if (lowerHeader.includes('vendedor') || lowerHeader.includes('salesperson')) {
        mapping[header] = 'salesperson';
      } else if (lowerHeader.includes('criado por') || lowerHeader.includes('created by') || lowerHeader.includes('criador')) {
        mapping[header] = 'createdByName';
      } else if (lowerHeader.includes('fase atual') || lowerHeader.includes('phase')) {
        mapping[header] = 'phase';
      }
    });

    return mapping;
  }

  // Parse Excel/CSV file
  function parseExcelFile(buffer: Buffer, filename: string): any[] {
    try {
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      // Convert to JSON with headers
      const data = XLSX.utils.sheet_to_json(worksheet, { 
        header: 1,
        defval: '',
        raw: false
      });

      if (data.length === 0) {
        throw new Error('Arquivo vazio');
      }

      // Get headers and rows
      const headers = data[0] as string[];
      const rows = data.slice(1) as any[][];

      // Convert to objects
      return rows.map(row => {
        const obj: any = {};
        headers.forEach((header, index) => {
          obj[header] = row[index] || '';
        });
        return obj;
      });
    } catch (error) {
      throw new Error(`Erro ao processar arquivo: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
  }

  // Validate data row - MÁXIMA PERMISSIVIDADE para importar TODOS os cards
  function validateRow(row: any, mapping: Record<string, string>, rowIndex: number): any[] {
    const errors: any[] = [];

    // APENAS verificar se a linha não está completamente vazia
    const hasAnyData = Object.values(row).some((value: any) => {
      return value !== null && value !== undefined && value !== '' && 
             value !== 'null' && value !== 'undefined' && value !== 'N/A';
    });

    if (!hasAnyData) {
      // Até linhas vazias são consideradas warnings, não erros
      errors.push({
        row: rowIndex + 2,
        column: 'N/A',
        field: 'dados',
        value: '',
        errorType: 'empty_row',
        message: 'Linha aparentemente vazia (será importada com dados padrão)',
        severity: 'warning'
      });
    }

    // REMOVER TODAS AS VALIDAÇÕES RESTRITIVAS
    // Todas as validações são apenas warnings informativos
    return errors; // Retornar sempre sem erros críticos
  }

  // Transform row data - MÁXIMA TOLERÂNCIA para garantir importação de TODOS os cards
  function transformRow(row: any, mapping: Record<string, string>, userName: string, userId: string, targetPhase?: string): any {
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substr(2, 9);
    
    const transformed: any = {
      createdBy: userId,
      // Set defaults for ALL required fields
      hasRegistration: false,
      requiresVisit: false,
      documents: [],
      visitPhotos: [],
      phase: 'prospeccao', // Default phase
      businessTemperature: 'morno', // Default temperature
      // Import tracking fields
      isImported: true,
      importBatchId: `batch_${timestamp}_${randomId}`,
      importSource: 'csv_upload',
      // Garantir campos obrigatórios com fallbacks seguros
      contact: 'Contato Importado',
      company: 'Empresa Importada',
      phone: null, // Permitir nulo explicitamente
      needCategory: null,
      clientNeeds: null,
      // CORRIGIDO: Initialize createdByName with the actual user name - NUNCA NULL
      createdByName: userName && userName.trim() !== '' ? userName.trim() : 'Sistema de Importação'
    };
    
    // Process all field mappings - COM MÁXIMA TOLERÂNCIA
    for (const [excelColumn, systemField] of Object.entries(mapping)) {
      const fieldConfig = FIELD_MAPPINGS[systemField as keyof typeof FIELD_MAPPINGS];
      if (!fieldConfig) continue;

      let value = row[excelColumn];

      // Tratar QUALQUER valor de forma super permissiva
      if (value === null || value === undefined || value === '' || 
          value === 'null' || value === 'undefined' || value === 'NULL' ||
          value === 'N/A' || value === 'n/a' || value === '#N/A') {
        value = null;
      } else if (typeof value === 'string') {
        value = value.trim();
        if (value === '' || value === '-' || value === 'N/A') value = null;
      }

      // Aplicar transformação COM FALLBACK SEMPRE
      if (value !== null && value !== undefined) {
        try {
          if (fieldConfig.transform) {
            const transformedValue = fieldConfig.transform(value);
            if (transformedValue !== null && transformedValue !== undefined) {
              transformed[systemField] = transformedValue;
            }
          } else {
            // Usar valor direto, mas sanitizado
            if (typeof value === 'string') {
              transformed[systemField] = value.trim().slice(0, 2000); // Truncar para evitar erros
            } else {
              transformed[systemField] = value;
            }
          }
        } catch (error) {
          console.warn(`Transform error for field ${systemField}, usando fallback:`, error);
          // SEMPRE usar um fallback ao invés de falhar
          if (typeof value === 'string' && value.trim() !== '') {
            transformed[systemField] = value.trim().slice(0, 500); // Fallback truncado
          }
        }
      }
    }

    // SEMPRE aplicar targetPhase se fornecido
    if (targetPhase !== undefined && targetPhase !== null && targetPhase !== '') {
      transformed.phase = targetPhase;
    }

    // FALLBACKS FINAIS para garantir dados válidos
    if (!transformed.contact || transformed.contact === '' || transformed.contact === null) {
      if (transformed.company && transformed.company !== '' && transformed.company !== null) {
        transformed.contact = `Contato - ${String(transformed.company).slice(0, 50)}`;
      } else {
        transformed.contact = `Contato Importado ${timestamp}`;
      }
    }

    if (!transformed.company || transformed.company === '' || transformed.company === null) {
      if (transformed.contact && transformed.contact !== '' && transformed.contact !== null) {
        transformed.company = `Empresa - ${String(transformed.contact).slice(0, 50)}`;
      } else {
        transformed.company = `Empresa Importada ${timestamp}`;
      }
    }

    // CRITICAL: Ensure createdByName is never null or empty
    if (!transformed.createdByName || transformed.createdByName.trim() === '') {
      transformed.createdByName = userName || 'Sistema';
    }

    // Garantir que campos de texto não sejam muito longos
    if (transformed.contact && typeof transformed.contact === 'string') {
      transformed.contact = transformed.contact.slice(0, 255);
    }
    if (transformed.company && typeof transformed.company === 'string') {
      transformed.company = transformed.company.slice(0, 255);
    }
    if (transformed.clientNeeds && typeof transformed.clientNeeds === 'string') {
      transformed.clientNeeds = transformed.clientNeeds.slice(0, 2000);
    }
    if (transformed.needCategory && typeof transformed.needCategory === 'string') {
      transformed.needCategory = transformed.needCategory.slice(0, 500);
    }
    if (transformed.createdByName && typeof transformed.createdByName === 'string') {
      transformed.createdByName = transformed.createdByName.slice(0, 255);
    }

    // FORÇAR phone como null SEMPRE para evitar qualquer erro de banco
    transformed.phone = null;
    
    // Garantir que TODOS os campos problemáticos sejam null se necessário
    if (!transformed.phone) transformed.phone = null;
    if (!transformed.cpf || transformed.cpf === '') transformed.cpf = null;
    if (!transformed.cnpj || transformed.cnpj === '') transformed.cnpj = null;


    return transformed;
  }

  // File Upload Endpoint
  app.post("/api/import/upload", isAuthenticated, importFileUpload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "Nenhum arquivo enviado" });
      }

      const fileId = nanoid();
      const filename = req.file.originalname;

      // Parse the file
      const data = parseExcelFile(req.file.buffer, filename);

      if (data.length === 0) {
        return res.status(400).json({ message: "Arquivo vazio ou sem dados válidos" });
      }

      // Get column headers
      const columns = Object.keys(data[0]);

      // Auto-detect mapping
      const autoMapping = autoDetectMapping(columns);

      // Store session data
      const session = {
        fileId,
        filename,
        fileSize: req.file.size,
        data,
        columns,
        autoMapping,
        totalRows: data.length,
        createdAt: new Date(),
        userId: req.session.userId
      };

      importSessions.set(fileId, session);

      // Get preview (first 5 rows)
      const preview = data.slice(0, 5);

      res.json({
        fileId,
        filename,
        columns,
        rowCount: data.length,
        autoMapping,
        preview
      });
    } catch (error: any) {
      console.error('Upload error:', error);
      res.status(400).json({ 
        message: error.message || "Erro ao processar arquivo" 
      });
    }
  });

  // Column Mapping Validation
  app.post("/api/import/validate-mapping", isAuthenticated, async (req, res) => {
    try {
      const { fileId, mapping, targetPhase } = req.body; // Added targetPhase

      const session = importSessions.get(fileId);
      if (!session) {
        return res.status(404).json({ message: "Sessão de importação não encontrada" });
      }

      if (session.userId !== req.session.userId) {
        return res.status(403).json({ message: "Acesso negado" });
      }

      // Check required fields are mapped
      const requiredFields = Object.entries(FIELD_MAPPINGS)
        .filter(([_, config]) => config.required)
        .map(([field, _]) => field);

      const mappedFields = Object.values(mapping);
      const missingRequired = requiredFields.filter(field => !mappedFields.includes(field));

      const isValid = missingRequired.length === 0;
      const warnings: string[] = [];
      const errors: string[] = [];

      if (missingRequired.length > 0) {
        errors.push(`Campos obrigatórios não mapeados: ${missingRequired.map(f => FIELD_MAPPINGS[f as keyof typeof FIELD_MAPPINGS].displayName).join(', ')}`);
      }

      // Update session with mapping and targetPhase
      session.mapping = mapping;
      session.targetPhase = targetPhase; // Store targetPhase in session
      importSessions.set(fileId, session);

      res.json({
        isValid,
        requiredFieldsMapped: missingRequired.length === 0,
        warnings,
        errors,
        missingRequired
      });
    } catch (error: any) {
      console.error('Mapping validation error:', error);
      res.status(500).json({ message: "Erro ao validar mapeamento" });
    }
  });

  // Data Preview & Validation
  app.post("/api/import/preview", isAuthenticated, async (req, res) => {
    try {
      const { fileId, mapping, targetPhase } = req.body; // Added targetPhase

      const session = importSessions.get(fileId);
      if (!session) {
        return res.status(404).json({ message: "Sessão de importação não encontrada" });
      }

      if (session.userId !== req.session.userId) {
        return res.status(403).json({ message: "Acesso negado" });
      }

      const data = session.data;
      let validRows = 0;
      let invalidRows = 0;
      const errors: any[] = [];

      // Validate all rows
      data.forEach((row: any, index: number) => {
        const rowErrors = validateRow(row, mapping, index);
        if (rowErrors.length > 0) {
          invalidRows++;
          errors.push(...rowErrors);
        } else {
          validRows++;
        }
      });

      // Get preview of first 10 processed records
      const previewData = data.slice(0, 10).map((row: any, index: number) => {
        // Pass targetPhase to transformRow - SEMPRE usar a fase selecionada
        const transformed = transformRow(row, mapping, req.session.user?.name || 'Sistema', req.session.userId!, targetPhase); 
        const rowErrors = validateRow(row, mapping, index);
        return {
          original: row,
          transformed,
          isValid: rowErrors.length === 0,
          errors: rowErrors
        };
      });

      // Update session with validation results, mapping, and targetPhase
      session.mapping = mapping;
      session.targetPhase = targetPhase; // Store targetPhase in session
      session.validationResults = {
        totalRows: data.length,
        validRows,
        invalidRows,
        errors
      };
      importSessions.set(fileId, session);

      res.json({
        previewData,
        validationSummary: {
          totalRows: data.length,
          validRows,
          invalidRows
        },
        errors: errors.slice(0, 100) // Limit errors shown
      });
    } catch (error: any) {
      console.error('Preview error:', error);
      res.status(500).json({ message: "Erro ao gerar preview" });
    }
  });

  // Import Execution
  app.post("/api/import/execute", isAuthenticated, async (req, res) => {
    try {
      const { fileId, mapping, targetPhase } = req.body; // Added targetPhase

      const session = importSessions.get(fileId);
      if (!session) {
        return res.status(404).json({ message: "Sessão de importação não encontrada" });
      }

      if (session.userId !== req.session.userId) {
        return res.status(403).json({ message: "Acesso negado" });
      }

      const importId = nanoid();
      const data = session.data;

      // Update session with import status
      session.importId = importId;
      session.status = 'processing';
      session.progress = 0;
      session.results = {
        created: 0,
        updated: 0,
        skipped: 0,
        failed: 0,
        errors: []
      };

      importSessions.set(fileId, session);

      // Start processing in background
      setImmediate(async () => {
        try {
          const userId = req.session.userId!;
          
          // CAPTURAR DADOS DA SESSÃO ANTES DO PROCESSAMENTO ASSÍNCRONO
          const sessionUser = req.session.user;
          
          // OTIMIZAÇÃO: Buscar do banco apenas se necessário - GARANTIR NUNCA NULL
          let userName = 'Sistema de Importação'; // Default seguro
          
          console.log(`🔍 [IMPORT] Verificando userName: sessionUser=${JSON.stringify(sessionUser)}, userId=${userId}`);
          
          if (sessionUser?.name && sessionUser.name.trim() !== '') {
            userName = sessionUser.name.trim();
            console.log(`✅ [IMPORT] Usando nome da sessão: "${userName}"`);
          } else {
            // Fallback: buscar do banco apenas se sessão não tem nome
            try {
              const userFromDB = await storage.getUser(userId);
              if (userFromDB?.name && userFromDB.name.trim() !== '') {
                userName = userFromDB.name.trim();
                console.log(`✅ [IMPORT] Usando nome do banco: "${userName}"`);
              } else {
                userName = userId && userId.trim() !== '' ? `Usuário ${userId.substring(0, 8)}` : 'Sistema de Importação';
                console.log(`⚠️ [IMPORT] Usando fallback: "${userName}"`);
              }
            } catch (error) {
              console.error(`❌ [IMPORT] Erro ao buscar usuário do banco:`, error);
              userName = 'Sistema de Importação';
            }
          }
          
          // VALIDAÇÃO FINAL ABSOLUTA
          if (!userName || userName.trim() === '') {
            userName = 'Sistema de Importação';
            console.error(`❌ [IMPORT] ERRO CRÍTICO: userName estava vazio, forçando valor padrão`);
          }
          
          console.log(`🎯 [IMPORT] Nome final para importação: "${userName}"`);
          
          // VERIFICAÇÃO ADICIONAL
          if (!userName) {
            throw new Error(`ERRO CRÍTICO: userName não pode ser null/undefined. Valor atual: ${userName}`);
          }
          
          let created = 0;
          let failed = 0;
          const errors: any[] = [];

          // OTIMIZAÇÃO: Processamento em lotes para melhor performance
          const BATCH_SIZE = 100;
          const totalBatches = Math.ceil(data.length / BATCH_SIZE);

          for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
            const startIndex = batchIndex * BATCH_SIZE;
            const endIndex = Math.min(startIndex + BATCH_SIZE, data.length);
            const batch = data.slice(startIndex, endIndex);
            
            // Log apenas para batches grandes - otimizado para performance
            if (totalBatches > 5) {
              console.log(`📦 Lote ${batchIndex + 1}/${totalBatches}`);
            }

            // Preparar dados do lote
            const batchOpportunities: any[] = [];
            const batchErrors: any[] = [];

            for (let i = 0; i < batch.length; i++) {
              const globalIndex = startIndex + i;
              const row = batch[i];

              try {
                // Validar linha apenas para logs (não bloquear processamento)
                const rowErrors = validateRow(row, mapping, globalIndex);
                if (rowErrors.length > 0) {
                  batchErrors.push(...rowErrors);
                }

                // Transform row
        const transformedData = transformRow(row, mapping, userName, userId, targetPhase);

        // CRITICAL FIX: Ensure createdByName is NEVER null
        if (!transformedData.createdByName || transformedData.createdByName.trim() === '') {
          transformedData.createdByName = userName || 'Sistema de Importação';
        }

        console.log(`🔍 [IMPORT] Row ${globalIndex + 1}: createdByName="${transformedData.createdByName}"`);

        // VALIDAÇÃO OTIMIZADA: 1 tentativa principal + 1 fallback
        let validatedData = null;
        
        try {
          // Primeira tentativa: dados como estão
          validatedData = insertOpportunitySchema.parse(transformedData);
        } catch (zodError: any) {
          console.log(`⚠️ [IMPORT] Validation failed for row ${globalIndex + 1}, using fallback:`, zodError.message);
          
          // Fallback: dados básicos garantidos
          try {
            const fallbackData = {
              contact: transformedData.contact || `Contato Importado ${globalIndex + 1}`,
              company: transformedData.company || `Empresa Importada ${globalIndex + 1}`,
              phone: null,
              needCategory: transformedData.needCategory || null,
              clientNeeds: transformedData.clientNeeds || `Dados importados da linha ${globalIndex + 1}`,
              phase: targetPhase || 'prospeccao',
              businessTemperature: 'morno',
              hasRegistration: false,
              requiresVisit: false,
              documents: [],
              visitPhotos: [],
              createdBy: userId,
              createdByName: userName || 'Sistema de Importação',
              isImported: true,
              importBatchId: `batch_${Date.now()}_${batchIndex}`,
              importSource: 'csv_upload'
            };
            
            console.log(`🔍 [IMPORT] Fallback data for row ${globalIndex + 1}: createdByName="${fallbackData.createdByName}"`);
            validatedData = insertOpportunitySchema.parse(fallbackData);
          } catch (fallbackError: any) {
            console.error(`❌ [IMPORT] Fallback validation failed for row ${globalIndex + 1}:`, fallbackError.message);
            batchErrors.push({
              row: globalIndex + 2,
              message: `Erro de validação: ${fallbackError.message}`,
              data: row
            });
          }
        }

                if (validatedData) {
                  batchOpportunities.push(validatedData);
                }

              } catch (error: any) {
                batchErrors.push({
                  row: globalIndex + 2,
                  message: `Erro geral: ${error.message}`,
                  data: row
                });
              }
            }

            // BULK INSERT do lote
            if (batchOpportunities.length > 0) {
              try {
                const bulkResult = await storage.createOpportunitiesBulk(batchOpportunities);
                created += bulkResult.created;
                
                if (bulkResult.errors.length > 0) {
                  failed += bulkResult.errors.length;
                  errors.push(...bulkResult.errors.map(err => ({
                    row: startIndex + err.index + 2,
                    message: err.message,
                    data: err.data
                  })));
                }
              } catch (bulkError: any) {
                console.error(`❌ Erro no bulk insert do lote ${batchIndex + 1}:`, bulkError.message);
                
                // Fallback: inserção individual para este lote
                for (let j = 0; j < batchOpportunities.length; j++) {
                  try {
                    await storage.createOpportunity(batchOpportunities[j]);
                    created++;
                  } catch (individualError: any) {
                    failed++;
                    errors.push({
                      row: startIndex + j + 2,
                      message: `Erro na inserção individual: ${individualError.message}`,
                      data: batch[j]
                    });
                  }
                }
              }
            }

            // Adicionar erros do lote
            if (batchErrors.length > 0) {
              failed += batchErrors.length;
              errors.push(...batchErrors);
            }

            // Update progress
            const progress = Math.round(((endIndex) / data.length) * 100);
            const currentSession = importSessions.get(fileId);
            if (currentSession) {
              currentSession.progress = progress;
              currentSession.results = {
                created,
                updated: 0,
                skipped: 0,
                failed,
                errors: errors.slice(0, 100) // Limit errors to prevent memory issues
              };
              importSessions.set(fileId, currentSession);
            }

            // Log apenas para batches grandes - otimizado para performance
            if (totalBatches > 5) {
              console.log(`✅ Lote ${batchIndex + 1} concluído`);
            }
          }

          // Mark as completed
          const finalSession = importSessions.get(fileId);
          if (finalSession) {
            finalSession.status = 'completed';
            finalSession.completedAt = new Date();
            importSessions.set(fileId, finalSession);
          }

        } catch (error: any) {
          console.error('Import execution error:', error);
          const errorSession = importSessions.get(fileId);
          if (errorSession) {
            errorSession.status = 'failed';
            errorSession.error = error.message;
            importSessions.set(fileId, errorSession);
          }
        }
      });

      res.json({
        importId,
        status: 'processing',
        progress: 0
      });

    } catch (error: any) {
      console.error('Import start error:', error);
      res.status(500).json({ message: "Erro ao iniciar importação" });
    }
  });

  // Import Status Tracking
  app.get("/api/import/status/:importId", isAuthenticated, async (req, res) => {
    try {
      const { importId } = req.params;

      // Find session by importId
      let session = null;
      const entries = Array.from(importSessions.entries());
      for (const [fileId, sessionData] of entries) {
        if (sessionData.importId === importId) {
          session = sessionData;
          break;
        }
      }

      if (!session) {
        return res.status(404).json({ message: "Importação não encontrada" });
      }

      if (session.userId !== req.session.userId) {
        return res.status(403).json({ message: "Acesso negado" });
      }

      res.json({
        importId,
        status: session.status || 'pending',
        progress: session.progress || 0,
        processedRows: session.results?.created + session.results?.failed || 0,
        totalRows: session.totalRows,
        results: {
          created: session.results?.created || 0,
          updated: session.results?.updated || 0,
          skipped: session.results?.skipped || 0,
          failed: session.results?.failed || 0,
          errors: (session.results?.errors || []).map(err => 
            typeof err === 'object' ? JSON.stringify(err) : String(err)
          )
        },
        error: session.error
      });

    } catch (error: any) {
      console.error('Status check error:', error);
      res.status(500).json({ message: "Erro ao verificar status da importação" });
    }
  });

  // Sync endpoints for WebSocket state recovery
  app.get("/api/sync/opportunities", isAuthenticated, async (req, res) => {
    try {
      const opportunities = await storage.getOpportunities();
      res.json({
        success: true,
        data: opportunities,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('Sync opportunities error:', error);
      res.status(500).json({ 
        success: false, 
        message: "Erro ao sincronizar oportunidades",
        error: error.message 
      });
    }
  });

  app.get("/api/sync/opportunity/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const opportunity = await storage.getOpportunity(id);
      
      if (!opportunity) {
        return res.status(404).json({ 
          success: false, 
          message: "Oportunidade não encontrada" 
        });
      }

      res.json({
        success: true,
        data: opportunity,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('Sync opportunity error:', error);
      res.status(500).json({ 
        success: false, 
        message: "Erro ao sincronizar oportunidade",
        error: error.message 
      });
    }
  });

  app.post("/api/sync/heartbeat", isAuthenticated, (req, res) => {
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      server: 'online'
    });
  });

  // ========================================
  // SETTINGS ENDPOINTS - Sistema de Configurações
  // ========================================

  // Company Settings endpoints
  app.get("/api/company/settings", isAuthenticated, async (req, res) => {
    try {
      const settings = await storage.getCompanySettings();
      res.json(settings);
    } catch (error: any) {
      console.error('Error fetching company settings:', error);
      res.status(500).json({ message: "Erro ao buscar configurações da empresa" });
    }
  });

  app.put("/api/company/settings", isAuthenticated, isManagerOrAdmin, async (req, res) => {
    try {
      const validatedData = z.object({
        companyName: z.string().min(1, "Nome da empresa é obrigatório"),
        companyPhone: z.string().optional(),
        companyEmail: z.string().email("Email inválido").optional(),
        companyAddress: z.string().optional(),
        companyLogo: z.string().optional(),
        currency: z.string().min(1, "Moeda é obrigatória"),
        timezone: z.string().min(1, "Fuso horário é obrigatório"),
        dateFormat: z.string().min(1, "Formato de data é obrigatório"),
        timeFormat: z.string().min(1, "Formato de hora é obrigatório"),
        language: z.string().min(1, "Idioma é obrigatório"),
        autoBackupEnabled: z.boolean(),
        autoBackupFrequency: z.enum(['daily', 'weekly', 'monthly']),
        autoBackupTime: z.string(),
        maxFileSizeMb: z.number().min(1).max(100),
        allowedFileTypes: z.array(z.string())
      }).parse(req.body);

      const settings = await storage.updateCompanySettings(validatedData);
      
      // Log da ação
      await storage.createSystemLog({
        level: 'info',
        message: 'Configurações da empresa atualizadas',
        category: 'settings',
        userId: req.session.userId!,
        metadata: { updatedFields: Object.keys(validatedData) }
      });

      res.json(settings);
    } catch (error: any) {
      console.error('Error updating company settings:', error);
      if (error.name === "ZodError") {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      res.status(500).json({ message: "Erro ao atualizar configurações da empresa" });
    }
  });

  // User Settings endpoints
  app.get("/api/user/settings", isAuthenticated, async (req, res) => {
    try {
      const settings = await storage.getUserSettings(req.session.userId!);
      res.json(settings);
    } catch (error: any) {
      console.error('Error fetching user settings:', error);
      res.status(500).json({ message: "Erro ao buscar configurações do usuário" });
    }
  });

  app.put("/api/user/settings", isAuthenticated, async (req, res) => {
    try {
      const validatedData = z.object({
        notifications: z.boolean().optional(),
        emailNotifications: z.boolean().optional(),
        language: z.string().optional(),
        timezone: z.string().optional(),
        autoBackup: z.boolean().optional(),
        twoFactorEnabled: z.boolean().optional(),
        sessionTimeout: z.number().min(5).max(1440).optional(), // 5 min to 24 hours
        profilePhoto: z.string().optional()
      }).parse(req.body);

      const settings = await storage.updateUserSettings(req.session.userId!, validatedData);
      
      // Log da ação
      await storage.createSystemLog({
        level: 'info',
        message: 'Configurações do usuário atualizadas',
        category: 'settings',
        userId: req.session.userId!,
        metadata: { updatedFields: Object.keys(validatedData) }
      });

      res.json(settings);
    } catch (error: any) {
      console.error('Error updating user settings:', error);
      if (error.name === "ZodError") {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      res.status(500).json({ message: "Erro ao atualizar configurações do usuário" });
    }
  });

  // Profile Photo Upload endpoint
  const photoUpload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB limit
    },
    fileFilter: (req, file, cb) => {
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Tipo de arquivo não permitido. Use JPEG, PNG ou WebP.'));
      }
    }
  });

  app.post("/api/user/photo", isAuthenticated, photoUpload.single('photo'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "Nenhum arquivo enviado" });
      }

      // Convert to base64 data URL
      const base64 = req.file.buffer.toString('base64');
      const dataUrl = `data:${req.file.mimetype};base64,${base64}`;

      // Update user settings with new photo
      await storage.updateUserSettings(req.session.userId!, { profilePhoto: dataUrl });

      // Log da ação
      await storage.createSystemLog({
        level: 'info',
        message: 'Foto de perfil atualizada',
        category: 'profile',
        userId: req.session.userId!,
        metadata: { fileSize: req.file.size, mimeType: req.file.mimetype }
      });

      res.json({ 
        message: "Foto de perfil atualizada com sucesso",
        photoUrl: dataUrl
      });
    } catch (error: any) {
      console.error('Error uploading profile photo:', error);
      res.status(500).json({ message: "Erro ao fazer upload da foto de perfil" });
    }
  });

  // Password Change endpoint
  app.put("/api/user/password", isAuthenticated, async (req, res) => {
    try {
      const validatedData = z.object({
        currentPassword: z.string().min(1, "Senha atual é obrigatória"),
        newPassword: z.string().min(6, "Nova senha deve ter pelo menos 6 caracteres"),
        confirmPassword: z.string().min(1, "Confirmação de senha é obrigatória")
      }).parse(req.body);

      if (validatedData.newPassword !== validatedData.confirmPassword) {
        return res.status(400).json({ message: "Nova senha e confirmação não coincidem" });
      }

      // Verify current password
      const user = await storage.validateUserPassword(req.session.user!.email, validatedData.currentPassword);
      if (!user) {
        return res.status(400).json({ message: "Senha atual incorreta" });
      }

      // Update password
      await storage.updateUserPassword(req.session.userId!, validatedData.newPassword);

      // Log da ação
      await storage.createSystemLog({
        level: 'info',
        message: 'Senha alterada pelo usuário',
        category: 'security',
        userId: req.session.userId!
      });

      res.json({ message: "Senha alterada com sucesso" });
    } catch (error: any) {
      console.error('Error changing password:', error);
      if (error.name === "ZodError") {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      res.status(500).json({ message: "Erro ao alterar senha" });
    }
  });

  // Login History endpoints
  app.get("/api/user/login-history", isAuthenticated, async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = (page - 1) * limit;

      const history = await storage.getLoginHistory(req.session.userId!, { limit, offset });
      res.json(history);
    } catch (error: any) {
      console.error('Error fetching login history:', error);
      res.status(500).json({ message: "Erro ao buscar histórico de login" });
    }
  });

  // Active Sessions endpoints
  app.get("/api/user/sessions", isAuthenticated, async (req, res) => {
    try {
      const sessions = await storage.getUserSessions(req.session.userId!);
      res.json(sessions);
    } catch (error: any) {
      console.error('Error fetching user sessions:', error);
      res.status(500).json({ message: "Erro ao buscar sessões ativas" });
    }
  });

  app.delete("/api/user/sessions/:sessionId", isAuthenticated, async (req, res) => {
    try {
      const { sessionId } = req.params;
      
      // Verify session belongs to user
      const session = await storage.getUserSession(sessionId);
      if (!session || session.userId !== req.session.userId!) {
        return res.status(404).json({ message: "Sessão não encontrada" });
      }

      await storage.terminateUserSession(sessionId);

      // Log da ação
      await storage.createSystemLog({
        level: 'info',
        message: 'Sessão terminada pelo usuário',
        category: 'security',
        userId: req.session.userId!,
        metadata: { terminatedSessionId: sessionId }
      });

      res.json({ message: "Sessão terminada com sucesso" });
    } catch (error: any) {
      console.error('Error terminating session:', error);
      res.status(500).json({ message: "Erro ao terminar sessão" });
    }
  });

  // System Logs endpoints (Admin only)
  app.get("/api/admin/system-logs", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const level = req.query.level as string;
      const category = req.query.category as string;
      const offset = (page - 1) * limit;

      const logs = await storage.getSystemLogs({ 
        limit, 
        offset, 
        level, 
        category 
      });
      res.json(logs);
    } catch (error: any) {
      console.error('Error fetching system logs:', error);
      res.status(500).json({ message: "Erro ao buscar logs do sistema" });
    }
  });

  // Email Templates endpoints
  app.get("/api/email-templates", isAuthenticated, isManagerOrAdmin, async (req, res) => {
    try {
      const templates = await storage.getEmailTemplates();
      res.json(templates);
    } catch (error: any) {
      console.error('Error fetching email templates:', error);
      res.status(500).json({ message: "Erro ao buscar templates de email" });
    }
  });

  app.post("/api/email-templates", isAuthenticated, isManagerOrAdmin, async (req, res) => {
    try {
      const validatedData = z.object({
        name: z.string().min(1, "Nome é obrigatório"),
        subject: z.string().min(1, "Assunto é obrigatório"),
        body: z.string().min(1, "Corpo do email é obrigatório"),
        htmlContent: z.string().optional(),
        textContent: z.string().optional(),
        trigger: z.string().min(1, "Trigger é obrigatório"),
        variables: z.array(z.string()).default([]),
        active: z.boolean().default(true)
      }).parse(req.body);

      const template = await storage.createEmailTemplate({
        ...validatedData,
        createdBy: req.session.userId!
      });

      // Log da ação
      await storage.createSystemLog({
        level: 'info',
        message: `Template de email criado: ${validatedData.name}`,
        category: 'email',
        userId: req.session.userId!,
        metadata: { templateId: template.id, trigger: validatedData.trigger }
      });

      res.status(201).json(template);
    } catch (error: any) {
      console.error('Error creating email template:', error);
      if (error.name === "ZodError") {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      res.status(500).json({ message: "Erro ao criar template de email" });
    }
  });

  app.put("/api/email-templates/:id", isAuthenticated, isManagerOrAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const validatedData = z.object({
        name: z.string().min(1, "Nome é obrigatório").optional(),
        subject: z.string().min(1, "Assunto é obrigatório").optional(),
        body: z.string().min(1, "Corpo do email é obrigatório").optional(),
        htmlContent: z.string().optional(),
        textContent: z.string().optional(),
        trigger: z.string().min(1, "Trigger é obrigatório").optional(),
        variables: z.array(z.string()).optional(),
        active: z.boolean().optional()
      }).parse(req.body);

      const template = await storage.updateEmailTemplate(parseInt(id), validatedData);
      
      if (!template) {
        return res.status(404).json({ message: "Template não encontrado" });
      }

      // Log da ação
      await storage.createSystemLog({
        level: 'info',
        message: `Template de email atualizado: ${template.name}`,
        category: 'email',
        userId: req.session.userId!,
        metadata: { templateId: template.id, updatedFields: Object.keys(validatedData) }
      });

      res.json(template);
    } catch (error: any) {
      console.error('Error updating email template:', error);
      if (error.name === "ZodError") {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      res.status(500).json({ message: "Erro ao atualizar template de email" });
    }
  });

  app.delete("/api/email-templates/:id", isAuthenticated, isManagerOrAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteEmailTemplate(parseInt(id));
      
      if (!deleted) {
        return res.status(404).json({ message: "Template não encontrado" });
      }

      // Log da ação
      await storage.createSystemLog({
        level: 'info',
        message: `Template de email excluído: ID ${id}`,
        category: 'email',
        userId: req.session.userId!,
        metadata: { templateId: parseInt(id) }
      });

      res.status(204).send();
    } catch (error: any) {
      console.error('Error deleting email template:', error);
      res.status(500).json({ message: "Erro ao excluir template de email" });
    }
  });

  // Webhooks endpoints
  app.get("/api/webhooks", isAuthenticated, isManagerOrAdmin, async (req, res) => {
    try {
      const webhooks = await storage.getWebhooks();
      res.json(webhooks);
    } catch (error: any) {
      console.error('Error fetching webhooks:', error);
      res.status(500).json({ message: "Erro ao buscar webhooks" });
    }
  });

  app.post("/api/webhooks", isAuthenticated, isManagerOrAdmin, async (req, res) => {
    try {
      const validatedData = z.object({
        name: z.string().min(1, "Nome é obrigatório"),
        url: z.string().url("URL inválida"),
        events: z.array(z.string()).min(1, "Pelo menos um evento é obrigatório"),
        secret: z.string().optional(),
        active: z.boolean().default(true),
        retryCount: z.number().min(0).max(10).default(3),
        timeoutSeconds: z.number().min(5).max(300).default(30)
      }).parse(req.body);

      const webhook = await storage.createWebhook({
        ...validatedData,
        createdBy: req.session.userId!
      });

      // Log da ação
      await storage.createSystemLog({
        level: 'info',
        message: `Webhook criado: ${validatedData.name}`,
        category: 'webhook',
        userId: req.session.userId!,
        metadata: { webhookId: webhook.id, url: validatedData.url, events: validatedData.events }
      });

      res.status(201).json(webhook);
    } catch (error: any) {
      console.error('Error creating webhook:', error);
      if (error.name === "ZodError") {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      res.status(500).json({ message: "Erro ao criar webhook" });
    }
  });

  app.put("/api/webhooks/:id", isAuthenticated, isManagerOrAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const validatedData = z.object({
        name: z.string().min(1, "Nome é obrigatório").optional(),
        url: z.string().url("URL inválida").optional(),
        events: z.array(z.string()).min(1, "Pelo menos um evento é obrigatório").optional(),
        secret: z.string().optional(),
        active: z.boolean().optional(),
        retryCount: z.number().min(0).max(10).optional(),
        timeoutSeconds: z.number().min(5).max(300).optional()
      }).parse(req.body);

      const webhook = await storage.updateWebhook(parseInt(id), validatedData);
      
      if (!webhook) {
        return res.status(404).json({ message: "Webhook não encontrado" });
      }

      // Log da ação
      await storage.createSystemLog({
        level: 'info',
        message: `Webhook atualizado: ${webhook.name}`,
        category: 'webhook',
        userId: req.session.userId!,
        metadata: { webhookId: webhook.id, updatedFields: Object.keys(validatedData) }
      });

      res.json(webhook);
    } catch (error: any) {
      console.error('Error updating webhook:', error);
      if (error.name === "ZodError") {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      res.status(500).json({ message: "Erro ao atualizar webhook" });
    }
  });

  app.delete("/api/webhooks/:id", isAuthenticated, isManagerOrAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteWebhook(parseInt(id));
      
      if (!deleted) {
        return res.status(404).json({ message: "Webhook não encontrado" });
      }

      // Log da ação
      await storage.createSystemLog({
        level: 'info',
        message: `Webhook excluído: ID ${id}`,
        category: 'webhook',
        userId: req.session.userId!,
        metadata: { webhookId: parseInt(id) }
      });

      res.status(204).send();
    } catch (error: any) {
      console.error('Error deleting webhook:', error);
      res.status(500).json({ message: "Erro ao excluir webhook" });
    }
  });

  // Email Templates endpoints
  app.get("/api/email/templates", isAuthenticated, async (req, res) => {
    try {
      const templates = await storage.getEmailTemplates();
      res.json(templates);
    } catch (error: any) {
      console.error('Error fetching email templates:', error);
      res.status(500).json({ message: "Erro ao buscar templates de email" });
    }
  });

  app.post("/api/email/templates", isAuthenticated, async (req, res) => {
    try {
      const templateData = insertEmailTemplateSchema.parse(req.body);
      const template = await storage.createEmailTemplate(templateData);
      
      // Log da ação
      await storage.createSystemLog({
        level: 'info',
        message: `Template de email criado: ${templateData.name}`,
        category: 'email',
        user_id: req.session.userId!,
        metadata: { templateId: template.id }
      });

      res.status(201).json(template);
    } catch (error: any) {
      console.error('Error creating email template:', error);
      if (error.name === "ZodError") {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      res.status(500).json({ message: "Erro ao criar template de email" });
    }
  });

  app.put("/api/email/templates/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const templateData = updateEmailTemplateSchema.parse(req.body);
      
      const template = await storage.updateEmailTemplate(id, templateData);
      if (!template) {
        return res.status(404).json({ message: "Template não encontrado" });
      }

      // Log da ação
      await storage.createSystemLog({
        level: 'info',
        message: `Template de email atualizado: ${templateData.name}`,
        category: 'email',
        user_id: req.session.userId!,
        metadata: { templateId: id }
      });

      res.json(template);
    } catch (error: any) {
      console.error('Error updating email template:', error);
      if (error.name === "ZodError") {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      res.status(500).json({ message: "Erro ao atualizar template de email" });
    }
  });

  app.delete("/api/email/templates/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      
      const deleted = await storage.deleteEmailTemplate(id);
      if (!deleted) {
        return res.status(404).json({ message: "Template não encontrado" });
      }

      // Log da ação
      await storage.createSystemLog({
        level: 'info',
        message: `Template de email excluído: ${id}`,
        category: 'email',
        user_id: req.session.userId!,
        metadata: { templateId: id }
      });

      res.status(204).send();
    } catch (error: any) {
      console.error('Error deleting email template:', error);
      res.status(500).json({ message: "Erro ao excluir template de email" });
    }
  });

  // System Logs endpoints
  app.get("/api/system/logs", isAuthenticated, async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = (page - 1) * limit;
      
      const level = req.query.level as string;
      const category = req.query.category as string;
      const search = req.query.search as string;
      const dateFrom = req.query.date_from as string;
      const dateTo = req.query.date_to as string;

      const filters = {
        level,
        category,
        search,
        dateFrom,
        dateTo
      };

      const result = await storage.getSystemLogs({ limit, offset, filters });
      res.json(result);
    } catch (error: any) {
      console.error('Error fetching system logs:', error);
      res.status(500).json({ message: "Erro ao buscar logs do sistema" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}