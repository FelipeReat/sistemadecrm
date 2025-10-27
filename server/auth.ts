import session from "express-session";
import type { RequestHandler } from "express";
import MemoryStore from "memorystore";
import { storage } from "./storage";
import { log } from "./vite";
import type { User } from "@shared/schema";

declare module 'express-session' {
  interface SessionData {
    userId?: string;
    user?: User;
    lastAccess?: string;
  }
}

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const MemStore = MemoryStore(session);

  const sessionStore = new MemStore({
    checkPeriod: 86400000, // prune expired entries every 24h
    ttl: sessionTtl,
  });

  return session({
    secret: process.env.SESSION_SECRET || 'fallback-secret-for-dev',
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.COOKIE_SECURE === 'true',
      sameSite: 'lax',
      maxAge: sessionTtl,
    },
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  try {
    console.log("🚨 TESTE: Middleware isAuthenticated executado");
    console.log(`🔍 Session userId: ${req.session.userId}`);
    if (!req.session.userId) {
      log("🚨 [AUTH] Sem userId na sessão - não autorizado", "auth");
      return res.status(401).json({ message: "Não autorizado" });
    }

    // OTIMIZAÇÃO: Usar dados da sessão se disponíveis e válidos
    if (req.session.user && req.session.user.isActive) {
      // Verifica se a sessão não é muito antiga (se lastAccess existe)
      if (req.session.lastAccess) {
        const sessionAge = Date.now() - new Date(req.session.lastAccess).getTime();
        const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 dias
        
        if (sessionAge > maxAge) {
          return req.session.destroy((err) => {
            if (res.headersSent) return;
            return res.status(401).json({ message: "Sessão expirada" });
          });
        }
      }

      // Atualiza último acesso sem consulta ao banco
      req.session.lastAccess = new Date().toISOString();
      
      console.log(`🔍 [AUTH] Using cached session: userId=${req.session.userId}, userName=${req.session.user?.name}, userEmail=${req.session.user?.email}, userRole=${req.session.user?.role}`);
      
      return next();
    }

    // Fallback: consulta ao banco apenas se necessário
    const user = await storage.getUser(req.session.userId);
    if (!user || !user.isActive) {
      return req.session.destroy((err) => {
        if (res.headersSent) return;
        return res.status(401).json({ message: "Usuário inválido" });
      });
    }

    // Atualiza dados da sessão
    req.session.lastAccess = new Date().toISOString();
    req.session.user = user;
    
    console.log(`🔍 [AUTH] Session updated: userId=${req.session.userId}, userName=${req.session.user?.name}, userEmail=${req.session.user?.email}, userRole=${req.session.user?.role}`);
    
    next();
  } catch (error) {
    console.error(`[AUTH] Erro na autenticação:`, error);
    if (res.headersSent) return;
    return res.status(500).json({ message: "Erro interno do servidor" });
  }
};

export const isAdmin: RequestHandler = async (req, res, next) => {
  try {
    if (!req.session.user || req.session.user.role !== 'admin') {
      if (res.headersSent) return;
      return res.status(403).json({ message: "Acesso negado - Admin necessário" });
    }
    next();
  } catch (error) {
    if (res.headersSent) return;
    return res.status(500).json({ message: "Erro interno do servidor" });
  }
};

export const isManagerOrAdmin: RequestHandler = async (req, res, next) => {
  try {
    if (!req.session.user || !['admin', 'gerente'].includes(req.session.user.role)) {
      if (res.headersSent) return;
      return res.status(403).json({ message: "Acesso negado - Gerente ou Admin necessário" });
    }
    next();
  } catch (error) {
    if (res.headersSent) return;
    return res.status(500).json({ message: "Erro interno do servidor" });
  }
};

// Middleware para verificar se pode editar oportunidades de outros usuários
export const canEditAllOpportunities: RequestHandler = async (req, res, next) => {
  try {
    if (!req.session.user || !['admin', 'gerente'].includes(req.session.user.role)) {
      if (res.headersSent) return;
      return res.status(403).json({ message: "Acesso negado - Apenas Admin e Gerente podem editar oportunidades de outros usuários" });
    }
    next();
  } catch (error) {
    if (res.headersSent) return;
    return res.status(500).json({ message: "Erro interno do servidor" });
  }
};

// Middleware para verificar se pode ver relatórios e estatísticas
export const canViewReports: RequestHandler = async (req, res, next) => {
  try {
    if (!req.session.user || !['admin', 'gerente'].includes(req.session.user.role)) {
      if (res.headersSent) return;
      return res.status(403).json({ message: "Acesso negado - Apenas Admin e Gerente podem ver relatórios" });
    }
    next();
  } catch (error) {
    if (res.headersSent) return;
    return res.status(500).json({ message: "Erro interno do servidor" });
  }
};