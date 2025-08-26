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

  // Reports endpoints
  app.get("/api/reports/dashboard", isAuthenticated, async (req, res) => {
    try {
      const opportunities = await storage.getOpportunities();
      
      // Calculate average sales cycle (in days)
      const wonOpportunities = opportunities.filter(o => o.phase === 'ganho' && o.createdAt);
      const avgSalesCycle = wonOpportunities.length > 0 
        ? wonOpportunities.reduce((sum, opp) => {
            const created = new Date(opp.createdAt!);
            const now = new Date();
            const daysDiff = (now.getTime() - created.getTime()) / (1000 * 3600 * 24);
            return sum + daysDiff;
          }, 0) / wonOpportunities.length
        : 0;

      // Calculate total revenue from won opportunities
      const totalRevenue = wonOpportunities.reduce((sum, opp) => {
        return sum + (opp.finalValue ? parseFloat(opp.finalValue.toString()) : 
                     opp.budget ? parseFloat(opp.budget.toString()) : 0);
      }, 0);

      // Opportunities by phase
      const phaseNames = {
        'prospeccao': 'Prospecção',
        'em-atendimento': 'Em Atendimento',
        'visita-tecnica': 'Visita Técnica',
        'proposta': 'Proposta',
        'negociacao': 'Negociação',
        'ganho': 'Ganho',
        'perdido': 'Perdido'
      };

      const opportunitiesByPhase = Object.entries(phaseNames).map(([phase, phaseName]) => ({
        phase,
        phaseName,
        count: opportunities.filter(o => o.phase === phase).length
      })).filter(item => item.count > 0);

      // Business temperatures
      const temperatureCounts = opportunities.reduce((acc, opp) => {
        const temp = opp.businessTemperature || 'morno';
        acc[temp] = (acc[temp] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const total = opportunities.length;
      const businessTemperatures = Object.entries(temperatureCounts).map(([temperature, count]) => ({
        temperature: temperature.charAt(0).toUpperCase() + temperature.slice(1),
        count,
        percentage: total > 0 ? Math.round((count / total) * 100) : 0
      }));

      // Loss reasons
      const lostOpportunities = opportunities.filter(o => o.phase === 'perdido');
      const lossReasonCounts = lostOpportunities.reduce((acc, opp) => {
        const reason = opp.lossReason || 'Não informado';
        acc[reason] = (acc[reason] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const lossReasons = Object.entries(lossReasonCounts).map(([reason, count]) => ({
        reason,
        count
      })).sort((a, b) => b.count - a.count);

      // Opportunities by salesperson
      const salespersonCounts = opportunities.reduce((acc, opp) => {
        const salesperson = opp.salesperson || 'Não atribuído';
        acc[salesperson] = (acc[salesperson] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const opportunitiesBySalesperson = Object.entries(salespersonCounts).map(([salesperson, count]) => ({
        salesperson,
        count,
        percentage: total > 0 ? Math.round((count / total) * 100) : 0
      })).sort((a, b) => b.count - a.count);

      // Monthly stats
      const monthlyStats = {
        totalOpportunities: opportunities.length,
        wonOpportunities: opportunities.filter(o => o.phase === 'ganho').length,
        lostOpportunities: opportunities.filter(o => o.phase === 'perdido').length,
        activeOpportunities: opportunities.filter(o => !['ganho', 'perdido'].includes(o.phase)).length
      };

      const reportData = {
        avgSalesCycle,
        totalRevenue,
        opportunitiesByPhase,
        businessTemperatures,
        lossReasons,
        opportunitiesBySalesperson,
        monthlyStats
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

  const httpServer = createServer(app);
  return httpServer;
}
