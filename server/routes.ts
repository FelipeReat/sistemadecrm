import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertOpportunitySchema, insertAutomationSchema, insertUserSchema, updateUserSchema, loginSchema } from "@shared/schema";
import { fromZodError } from "zod-validation-error";
import { getSession, isAuthenticated, isAdmin, isManagerOrAdmin, canEditAllOpportunities, canViewReports } from "./auth";

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup session middleware
  app.use(getSession());

  // Auth routes
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = loginSchema.parse(req.body);
      const user = await storage.validateUserPassword(email, password);
      
      if (!user) {
        return res.status(401).json({ message: "Email ou senha inválidos" });
      }
      
      req.session.userId = user.id;
      req.session.user = user;
      
      // Remove password from response
      const { password: _, ...userWithoutPassword } = user;
      res.json({ user: userWithoutPassword });
    } catch (error: any) {
      if (error.name === "ZodError") {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      res.status(500).json({ message: "Erro interno do servidor" });
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
      // Remove passwords from response
      const usersWithoutPasswords = users.map(({ password: _, ...user }) => user);
      res.json(usersWithoutPasswords);
    } catch (error) {
      res.status(500).json({ message: "Erro ao buscar usuários" });
    }
  });

  app.post("/api/users", isAuthenticated, isAdmin, async (req, res) => {
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

  app.patch("/api/users/:id", isAuthenticated, isAdmin, async (req, res) => {
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

  app.delete("/api/users/:id", isAuthenticated, isAdmin, async (req, res) => {
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

  app.post("/api/opportunities", isAuthenticated, async (req, res) => {
    try {
      const validatedData = insertOpportunitySchema.parse(req.body);
      const opportunity = await storage.createOpportunity(validatedData);
      res.status(201).json(opportunity);
    } catch (error: any) {
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
      const validatedData = insertOpportunitySchema.partial().parse(req.body);
      
      // Busca a oportunidade existente para verificar permissões
      const existingOpportunity = await storage.getOpportunity(id);
      if (!existingOpportunity) {
        return res.status(404).json({ message: "Oportunidade não encontrada" });
      }
      
      // Usuários comuns só podem editar suas próprias oportunidades
      if (req.session.user!.role === 'usuario' && existingOpportunity.salesperson !== req.session.user!.name) {
        return res.status(403).json({ message: "Você só pode editar suas próprias oportunidades" });
      }
      
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

  app.patch("/api/opportunities/:id/move/:phase", isAuthenticated, async (req, res) => {
    try {
      const { id, phase } = req.params;
      const opportunity = await storage.moveOpportunityToPhase(id, phase);
      
      if (!opportunity) {
        return res.status(404).json({ message: "Oportunidade não encontrada" });
      }
      
      res.json(opportunity);
    } catch (error) {
      res.status(500).json({ message: "Erro ao mover oportunidade" });
    }
  });

  app.delete("/api/opportunities/:id", isAuthenticated, canEditAllOpportunities, async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteOpportunity(id);
      
      if (!deleted) {
        return res.status(404).json({ message: "Oportunidade não encontrada" });
      }
      
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Erro ao excluir oportunidade" });
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

  // Stats endpoint - apenas Admin e Gerente podem ver estatísticas completas
  app.get("/api/stats", isAuthenticated, canViewReports, async (req, res) => {
    try {
      const opportunities = await storage.getOpportunities();
      
      const totalOpportunities = opportunities.length;
      const wonOpportunities = opportunities.filter(o => o.phase === 'ganho').length;
      const activeOpportunities = opportunities.filter(o => 
        !['ganho', 'perdido'].includes(o.phase)
      ).length;
      
      const projectedRevenue = opportunities
        .filter(o => o.budget && !['ganho', 'perdido'].includes(o.phase))
        .reduce((sum, o) => sum + parseFloat(o.budget!.toString()), 0);

      res.json({
        totalOpportunities,
        wonOpportunities,
        activeOpportunities,
        projectedRevenue: `R$ ${projectedRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
      });
    } catch (error) {
      res.status(500).json({ message: "Erro ao buscar estatísticas" });
    }
  });

  // User profile and settings routes
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
          users: users.map(({ password: _, ...user }) => user),
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

  const httpServer = createServer(app);
  return httpServer;
}
