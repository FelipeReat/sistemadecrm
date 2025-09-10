import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { dbOperations } from "./db-storage";
import { emailService } from "./email-service";
import { auditService } from "./audit-service";
import { backupService } from "./backup-service";
import { schedulerService } from "./scheduler";
import { insertOpportunitySchema, insertAutomationSchema, insertUserSchema, updateUserSchema, loginSchema, insertSavedReportSchema, updateSavedReportSchema, insertUserSettingsSchema, insertEmailTemplateSchema } from "@shared/schema";
import { fromZodError } from "zod-validation-error";
import { getSession, isAuthenticated, isAdmin, isManagerOrAdmin, canEditAllOpportunities, canViewReports } from "./auth";
import { rateLimiter } from "./rate-limiter";
import * as crypto from "crypto";
import * as z from "zod";
import * as XLSX from 'xlsx';
import path from 'path';

// Mock DB and schema for demonstration purposes. Replace with your actual database logic.
// Assuming 'db' and 'opportunities' are available and configured for your ORM (e.g., Drizzle ORM)
// const db = { ... }; // Your database client instance
// const opportunities = { ... }; // Your opportunities table schema

// Mock requireAuth function as it's used in the changes but not defined in the original code
const requireAuth = isAuthenticated;

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup session middleware
  app.use(getSession());

  // Auth routes
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = loginSchema.parse(req.body);

      // Verifica rate limiting
      if (rateLimiter.isBlocked(email)) {
        const blockTime = rateLimiter.getBlockTimeRemaining(email);
        console.log(`[AUTH] Login bloqueado para ${email}, tempo restante: ${blockTime} minutos`);
        return res.status(429).json({ 
          message: `Muitas tentativas falharam. Tente novamente em ${blockTime} minutos.` 
        });
      }

      const user = await storage.validateUserPassword(email, password);

      if (!user) {
        rateLimiter.recordFailedAttempt(email);
        const remaining = rateLimiter.getRemainingAttempts(email);
        console.log(`[AUTH] Falha de login para ${email}, tentativas restantes: ${remaining}`);

        let message = "Email ou senha inválidos";
        if (remaining <= 2) {
          message += `. Restam ${remaining} tentativas antes do bloqueio.`;
        }

        return res.status(401).json({ message });
      }

      // Verifica se o usuário está ativo
      if (!user.isActive) {
        console.log(`[AUTH] Tentativa de login de usuário inativo: ${email}`);
        return res.status(401).json({ message: "Conta desativada. Entre em contato com o administrador." });
      }

      // Login bem-sucedido
      rateLimiter.recordSuccessfulLogin(email);
      req.session.userId = user.id;
      req.session.user = user;
      req.session.lastAccess = new Date().toISOString();

      console.log(`[AUTH] Login bem-sucedido para ${email} (${user.role})`);

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

  // Create opportunity
  app.post("/api/opportunities", isAuthenticated, async (req, res) => {
    try {
      const validatedData = insertOpportunitySchema.parse(req.body);
      // Adiciona automaticamente quem criou a oportunidade
      const opportunityData = {
        ...validatedData,
        createdBy: req.session.user!.name
      };
      const opportunity = await storage.createOpportunity(opportunityData);
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
      if (req.session.user!.role === 'usuario') {
        // Se a oportunidade foi criada por este usuário ou ainda não tem vendedor atribuído, pode editar
        const canEdit = existingOpportunity.createdBy === req.session.user!.name || 
                       existingOpportunity.salesperson === req.session.user!.name ||
                       !existingOpportunity.salesperson;

        if (!canEdit) {
          return res.status(403).json({ message: "Você só pode editar suas próprias oportunidades" });
        }
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

  // Move opportunity to new phase
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

  app.delete("/api/opportunities/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;

      // Busca a oportunidade existente para verificar permissões
      const existingOpportunity = await storage.getOpportunity(id);
      if (!existingOpportunity) {
        return res.status(404).json({ message: "Oportunidade não encontrada" });
      }

      // Usuários comuns só podem excluir suas próprias oportunidades
      if (req.session.user!.role === 'usuario') {
        // Se a oportunidade foi criada por este usuário ou ele é o vendedor responsável, pode excluir
        const canDelete = existingOpportunity.createdBy === req.session.user!.name || 
                         existingOpportunity.salesperson === req.session.user!.name;

        if (!canDelete) {
          return res.status(403).json({ message: "Você só pode excluir suas próprias oportunidades" });
        }
      }
      // Gerentes e Admins podem excluir qualquer oportunidade (sem verificação adicional)

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
        .filter(o => o.budget && ['proposta', 'negociacao', 'ganho'].includes(o.phase))
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

  // Get salespeople (users who can be assigned as salespeople)
  app.get("/api/users/salespeople", isAuthenticated, async (req, res) => {
    try {
      const users = await storage.getUsers();
      // Filter active users and return only necessary fields
      const salespeople = users
        .filter(user => user.isActive)
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

  // Reports endpoints - dados reais do CRM
  app.get("/api/reports/dashboard", isAuthenticated, async (req, res) => {
    try {
      const opportunities = await storage.getOpportunities();
      const users = await storage.getUsers();

      // Métricas básicas
      const totalOpportunities = opportunities.length;
      const wonOpportunities = opportunities.filter(o => o.phase === 'ganho').length;
      const lostOpportunities = opportunities.filter(o => o.phase === 'perdido').length;
      const activeOpportunities = opportunities.filter(o => !['ganho', 'perdido'].includes(o.phase)).length;

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
              const created = new Date(opp.createdAt);
              const updated = new Date(opp.updatedAt);
              const cycleDays = Math.floor((updated.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
              return sum + Math.max(cycleDays, 1); // Mínimo 1 dia
            }, 0) / wonOpportunities
        : 0;

      // Distribuição por fase
      const phaseCounts = opportunities.reduce((acc, opp) => {
        acc[opp.phase] = (acc[opp.phase] || 0) + 1;
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
      const lossReasons = lostOpportunities.reduce((acc, opp) => {
        const reason = opp.lossReason || 'Não informado';
        acc[reason] = (acc[reason] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const lossReasonsArray = Object.entries(lossReasons)
        .map(([reason, count]) => ({ reason, count }))
        .sort((a, b) => b.count - a.count);

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
        totalUsers: users.filter(u => u.isActive).length,
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

  // Enhanced API routes for new features

  // User Settings
  app.get("/api/user/settings", isAuthenticated, async (req, res) => {
    try {
      const settings = await dbOperations.getUserSettings(req.session.userId!);
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
      const settings = await dbOperations.updateUserSettings(req.session.userId!, req.body);
      res.json(settings);
    } catch (error) {
      res.status(500).json({ message: "Erro ao atualizar configurações" });
    }
  });

  // Manual backup
  app.post("/api/backup/create", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const success = await backupService.createDatabaseBackup('manual');
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
      const filepath = await backupService.createDataExport('excel');
      if (filepath) {
        res.download(filepath, 'crm-export.xlsx');
      } else {
        res.status(500).json({ message: "Falha ao criar exportação" });
      }
    } catch (error) {
      res.status(500).json({ message: "Erro ao criar exportação" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}