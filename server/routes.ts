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
      // Adiciona automaticamente quem criou a oportunidade
      const dataToValidate = {
        ...req.body,
        createdBy: req.session.user!.name || req.session.user!.email || "Usuário"
      };
      const validatedData = insertOpportunitySchema.parse(dataToValidate);
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
    } catch (error: any) {
      // If it's a validation error from storage layer, return 400 with the message
      if (error.message && error.message.includes('Complete os campos obrigatórios')) {
        return res.status(400).json({ message: error.message });
      }
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
      const lostOpportunitiesArray = opportunities.filter(o => o.phase === 'perdido');
      const lostOpportunities = lostOpportunitiesArray.length;
      const activeOpportunities = opportunities.filter(o => 
        !['ganho', 'perdido'].includes(o.phase)
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

        console.log('File upload attempt:', {
          originalname: file.originalname,
          mimetype: file.mimetype,
          size: file.size
        });

        if (allowedTypes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new Error('Tipo de arquivo não suportado. Use PDF, DOC, DOCX, JPG, PNG, GIF ou TXT'));
        }
      } catch (error) {
        console.error('Error in file filter:', error);
        cb(error as Error, false);
      }
    }
  });

  // Document upload endpoint
  app.post("/api/documents/upload", isAuthenticated, (req, res) => {
    documentUpload.single('document')(req, res, async (err) => {
      try {
        if (err) {
          console.error('Multer error:', err);
          return res.status(400).json({ message: err.message || "Erro no upload do arquivo" });
        }

        if (!req.file) {
          return res.status(400).json({ message: "Nenhum arquivo enviado" });
        }

        const uploadedFile = {
          id: `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name: req.file.originalname,
          filename: req.file.filename,
          size: req.file.size,
          type: req.file.mimetype,
          url: `/uploads/documents/${req.file.filename}`,
          uploadedAt: new Date().toISOString(),
          uploadedBy: req.session.user!.id
        };

        res.status(201).json(uploadedFile);
      } catch (error: any) {
        console.error('Document upload error:', error);
        res.status(500).json({ message: "Erro ao fazer upload do documento" });
      }
    });
  });

  // Serve uploaded documents 
  app.get("/uploads/documents/:filename", isAuthenticated, (req, res) => {
    const filename = req.params.filename;
    const filepath = path.join(process.cwd(), 'uploads', 'documents', filename);
    
    // Security check - ensure filename doesn't contain path traversal
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({ message: "Nome de arquivo inválido" });
    }
    
    res.sendFile(filepath, (err) => {
      if (err) {
        console.error('Error serving file:', err);
        res.status(404).json({ message: "Arquivo não encontrado" });
      }
    });
  });

  // Import functionality

  // Setup multer for file uploads
  const importFileUpload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 50 * 1024 * 1024, // 50MB
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

  // Validate data row - muito mais permissivo
  function validateRow(row: any, mapping: Record<string, string>, rowIndex: number): any[] {
    const errors: any[] = [];

    // Verificar apenas se há pelo menos um campo com dados úteis
    const hasAnyData = Object.entries(mapping).some(([excelColumn, systemField]) => {
      const value = row[excelColumn];
      return value && value.toString().trim() !== '';
    });

    if (!hasAnyData) {
      errors.push({
        row: rowIndex + 2,
        column: 'N/A',
        field: 'dados',
        value: '',
        errorType: 'empty_row',
        message: 'Linha sem dados úteis',
        severity: 'warning'
      });
    }

    // Validações muito básicas - apenas para campos críticos
    for (const [excelColumn, systemField] of Object.entries(mapping)) {
      const fieldConfig = FIELD_MAPPINGS[systemField as keyof typeof FIELD_MAPPINGS];
      if (!fieldConfig) continue;

      const value = row[excelColumn];

      // Remover validação de campos obrigatórios durante importação
      // Apenas validar formato quando há valor
      if (value && value.toString().trim() !== '' && fieldConfig.validation && !fieldConfig.validation(value)) {
        // Converter erro para warning se possível
        errors.push({
          row: rowIndex + 2,
          column: excelColumn,
          field: systemField,
          value: value,
          errorType: 'format',
          message: `Formato possivelmente inválido para ${fieldConfig.displayName} (será limpo automaticamente)`,
          severity: 'warning'
        });
      }
    }

    return errors;
  }

  // Transform row data - mais tolerante e com fallbacks
  function transformRow(row: any, mapping: Record<string, string>, createdBy: string, targetPhase?: string): any {
    const transformed: any = {
      createdBy: createdBy,
      // Set defaults for required fields
      hasRegistration: false,
      requiresVisit: false,
      documents: [],
      visitPhotos: [],
      phase: 'prospeccao', // Default phase (will be overridden if targetPhase is provided)
      businessTemperature: 'morno' // Default temperature
    };

    // Process all field mappings first
    for (const [excelColumn, systemField] of Object.entries(mapping)) {
      const fieldConfig = FIELD_MAPPINGS[systemField as keyof typeof FIELD_MAPPINGS];
      if (!fieldConfig) continue;

      let value = row[excelColumn];

      // Tratar valores vazios/nulos de forma mais permissiva
      if (value === null || value === undefined || value === '' || 
          value === 'null' || value === 'undefined' || value === 'NULL') {
        value = null;
      } else if (typeof value === 'string') {
        value = value.trim();
        if (value === '') value = null;
      }

      // Aplicar transformação se houver valor
      if (fieldConfig.transform && value !== null) {
        try {
          const transformedValue = fieldConfig.transform(value);
          // Só usar se a transformação retornou algo útil
          if (transformedValue !== null && transformedValue !== undefined && transformedValue !== '') {
            transformed[systemField] = transformedValue;
          }
        } catch (error) {
          console.warn(`Transform error for field ${systemField}:`, error);
          // Em caso de erro, tentar usar valor original se for string
          if (typeof value === 'string' && value.trim() !== '') {
            transformed[systemField] = value.trim();
          }
        }
      } else if (value !== null && value !== undefined) {
        // Usar valor diretamente se não há transformação
        transformed[systemField] = value;
      }
    }

    // APLICAR targetPhase DEPOIS do processamento dos campos - ESTA É A CORREÇÃO PRINCIPAL
    if (targetPhase !== undefined && targetPhase !== null && targetPhase !== '') {
      transformed.phase = targetPhase;
      console.log(`🎯 OVERRIDE: Aplicando targetPhase "${targetPhase}" APÓS processamento dos campos`);
    } else {
      console.log(`📋 Usando fase do CSV ou padrão: ${transformed.phase}`);
    }
    
    // Ensure phase is set if it wasn't from mapping or targetPhase
    if (!transformed.phase) {
        transformed.phase = 'prospeccao';
    }

    // Garantir que temos pelo menos um identificador
    if (!transformed.contact || transformed.contact === '') {
      if (transformed.company && transformed.company !== '') {
        transformed.contact = `Contato - ${transformed.company}`;
      } else {
        transformed.contact = `Contato Importado ${Date.now()}`;
      }
    }

    if (!transformed.company || transformed.company === '') {
      if (transformed.contact && transformed.contact !== '') {
        transformed.company = `Empresa - ${transformed.contact}`;
      } else {
        transformed.company = `Empresa Importada ${Date.now()}`;
      }
    }

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
        console.log(`🔍 Preview - usando targetPhase: ${targetPhase} para linha ${index + 1}`);
        const transformed = transformRow(row, mapping, req.session.userId!, targetPhase); 
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
          let created = 0;
          let failed = 0;
          const errors: any[] = [];

          console.log(`Starting import for user ${userId}, processing ${data.length} rows`);
          console.log(`Mapping:`, JSON.stringify(mapping, null, 2));
          console.log(`Target Phase: ${targetPhase}`); // Log target phase
          console.log(`Fase selecionada será aplicada a TODOS os registros: ${targetPhase}`);

          for (let i = 0; i < data.length; i++) {
            const row = data[i];
            const progress = Math.round(((i + 1) / data.length) * 100);

            try {
              // Always skip invalid rows to avoid blocking the entire import
              const rowErrors = validateRow(row, mapping, i);
              if (rowErrors.length > 0) {
                failed++;
                errors.push(...rowErrors);

                // Update progress even for failed rows
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
                continue;
              }

              // Transform row, SEMPRE usando targetPhase selecionado pelo usuário
              console.log(`🚀 Antes da transformação - targetPhase recebido: "${targetPhase}" (tipo: ${typeof targetPhase})`);
              const transformedData = transformRow(row, mapping, userId, targetPhase);

              console.log(`✅ Processing row ${i + 1} - Fase aplicada: "${transformedData.phase}" (targetPhase solicitado: "${targetPhase}")`);
              
              // Verificar se a fase foi aplicada corretamente
              if (targetPhase && transformedData.phase !== targetPhase) {
                console.error(`❌ ERRO: Fase não foi aplicada corretamente! Esperado: "${targetPhase}", Aplicado: "${transformedData.phase}"`);
              }
              
              console.log(`Row ${i + 1} data:`, JSON.stringify(transformedData, null, 2));

              // Validate with Zod schema - com tratamento mais resiliente
              let validatedData;
              try {
                validatedData = insertOpportunitySchema.parse(transformedData);
              } catch (zodError: any) {
                console.error(`Zod validation error for row ${i + 1}:`, zodError.errors);

                // Tentar uma segunda vez com dados mais básicos
                try {
                  const basicData = {
                    ...transformedData,
                    // Garantir campos essenciais
                    contact: transformedData.contact || `Contato ${i + 1}`,
                    company: transformedData.company || `Empresa ${i + 1}`,
                    phase: targetPhase || 'prospeccao', // Use targetPhase or default
                    businessTemperature: 'morno',
                    hasRegistration: false,
                    requiresVisit: false,
                    documents: [],
                    visitPhotos: [],
                    createdBy: userId
                  };

                  validatedData = insertOpportunitySchema.parse(basicData);
                  console.log(`Row ${i + 1} validated with basic data fallback`);
                } catch (secondError: any) {
                  console.error(`Second validation failed for row ${i + 1}:`, secondError.errors);
                  failed++;
                  errors.push({
                    row: i + 2,
                    message: `Erro de validação persistente: ${secondError.errors.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(', ')}`,
                    data: row,
                    transformedData: transformedData
                  });
                  continue;
                }
              }

              // Insert into database
              try {
                await storage.createOpportunity(validatedData);
                created++;
              } catch (dbError: any) {
                console.error(`Database error for row ${i + 1}:`, dbError);
                failed++;
                errors.push({
                  row: i + 2,
                  message: `Erro ao salvar no banco: ${dbError.message}`,
                  data: row,
                  transformedData: transformedData
                });
              }

            } catch (error: any) {
              console.error(`Import error for row ${i + 1}:`, error);
              failed++;
              errors.push({
                row: i + 2,
                message: error.message || 'Erro ao importar linha',
                data: row,
                stack: error.stack
              });
            }

            // Update progress
            const currentSession = importSessions.get(fileId);
            if (currentSession) {
              currentSession.progress = progress;
              currentSession.results = {
                created,
                updated: 0,
                skipped: 0,
                failed,
                errors
              };
              importSessions.set(fileId, currentSession);
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
        results: session.results || {
          created: 0,
          updated: 0,
          skipped: 0,
          failed: 0,
          errors: []
        },
        error: session.error
      });

    } catch (error: any) {
      console.error('Status check error:', error);
      res.status(500).json({ message: "Erro ao verificar status da importação" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}