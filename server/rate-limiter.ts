
interface LoginAttempt {
  email: string;
  attempts: number;
  lastAttempt: Date;
  blocked: boolean;
  blockedUntil?: Date;
}

class RateLimiter {
  private attempts: Map<string, LoginAttempt> = new Map();
  private readonly maxAttempts = 5;
  private readonly blockDuration = 15 * 60 * 1000; // 15 minutos
  private readonly resetTime = 60 * 60 * 1000; // 1 hora

  constructor() {
    // Limpa tentativas antigas a cada hora
    setInterval(() => {
      this.cleanup();
    }, this.resetTime);
  }

  private cleanup() {
    const now = new Date();
    for (const [email, attempt] of this.attempts.entries()) {
      // Remove tentativas antigas ou bloqueios expirados
      if (
        (now.getTime() - attempt.lastAttempt.getTime() > this.resetTime) ||
        (attempt.blocked && attempt.blockedUntil && now > attempt.blockedUntil)
      ) {
        this.attempts.delete(email);
      }
    }
  }

  isBlocked(email: string): boolean {
    const attempt = this.attempts.get(email.toLowerCase());
    if (!attempt) return false;

    if (attempt.blocked) {
      if (attempt.blockedUntil && new Date() > attempt.blockedUntil) {
        // Bloqueio expirado, remove da lista
        this.attempts.delete(email.toLowerCase());
        return false;
      }
      return true;
    }

    return false;
  }

  recordFailedAttempt(email: string): void {
    const normalizedEmail = email.toLowerCase();
    const now = new Date();
    const attempt = this.attempts.get(normalizedEmail);

    if (!attempt) {
      this.attempts.set(normalizedEmail, {
        email: normalizedEmail,
        attempts: 1,
        lastAttempt: now,
        blocked: false
      });
    } else {
      attempt.attempts++;
      attempt.lastAttempt = now;

      if (attempt.attempts >= this.maxAttempts) {
        attempt.blocked = true;
        attempt.blockedUntil = new Date(now.getTime() + this.blockDuration);
      }
    }
  }

  recordSuccessfulLogin(email: string): void {
    // Remove tentativas após login bem-sucedido
    this.attempts.delete(email.toLowerCase());
  }

  getRemainingAttempts(email: string): number {
    const attempt = this.attempts.get(email.toLowerCase());
    if (!attempt) return this.maxAttempts;
    return Math.max(0, this.maxAttempts - attempt.attempts);
  }

  getBlockTimeRemaining(email: string): number {
    const attempt = this.attempts.get(email.toLowerCase());
    if (!attempt || !attempt.blocked || !attempt.blockedUntil) return 0;
    
    const remaining = attempt.blockedUntil.getTime() - new Date().getTime();
    return Math.max(0, Math.ceil(remaining / 1000 / 60)); // em minutos
  }
}

export const rateLimiter = new RateLimiter();
