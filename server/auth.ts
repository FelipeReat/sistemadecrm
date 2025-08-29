import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";
import type { User } from "@shared/schema";

declare module 'express-session' {
  interface SessionData {
    userId?: string;
    user?: User;
  }
}

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  
  // Use a URL correta do banco de dados baseada no ambiente
  const dbUrl = process.env.NODE_ENV === 'production' 
    ? process.env.PROD_DATABASE_URL || process.env.DATABASE_URL
    : process.env.DATABASE_URL;
    
  const sessionStore = new pgStore({
    conString: dbUrl,
    createTableIfMissing: true,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  
  return session({
    secret: process.env.SESSION_SECRET || 'fallback-secret-for-dev',
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: sessionTtl,
    },
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Não autorizado" });
    }

    const user = await storage.getUser(req.session.userId);
    if (!user || !user.isActive) {
      return req.session.destroy((err) => {
        if (res.headersSent) return;
        return res.status(401).json({ message: "Usuário inválido" });
      });
    }

    req.session.user = user;
    next();
  } catch (error) {
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