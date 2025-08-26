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
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
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
  if (!req.session.userId) {
    return res.status(401).json({ message: "Não autorizado" });
  }

  const user = await storage.getUser(req.session.userId);
  if (!user || !user.isActive) {
    req.session.destroy(() => {});
    return res.status(401).json({ message: "Usuário inválido" });
  }

  req.session.user = user;
  next();
};

export const isAdmin: RequestHandler = async (req, res, next) => {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.status(403).json({ message: "Acesso negado - Admin necessário" });
  }
  next();
};

export const isManagerOrAdmin: RequestHandler = async (req, res, next) => {
  if (!req.session.user || !['admin', 'gerente'].includes(req.session.user.role)) {
    return res.status(403).json({ message: "Acesso negado - Gerente ou Admin necessário" });
  }
  next();
};

// Middleware para verificar se pode editar oportunidades de outros usuários
export const canEditAllOpportunities: RequestHandler = async (req, res, next) => {
  if (!req.session.user || !['admin', 'gerente'].includes(req.session.user.role)) {
    return res.status(403).json({ message: "Acesso negado - Apenas Admin e Gerente podem editar oportunidades de outros usuários" });
  }
  next();
};

// Middleware para verificar se pode ver relatórios e estatísticas
export const canViewReports: RequestHandler = async (req, res, next) => {
  if (!req.session.user || !['admin', 'gerente'].includes(req.session.user.role)) {
    return res.status(403).json({ message: "Acesso negado - Apenas Admin e Gerente podem ver relatórios" });
  }
  next();
};