
export const SecurityConfig = {
  // Configurações de senha
  password: {
    minLength: 8,
    maxLength: 100,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    forbiddenPasswords: [
      'password', '123456', '123456789', 'qwerty', 'abc123',
      'password123', 'admin', 'letmein', 'welcome', 'monkey'
    ]
  },

  // Configurações de sessão
  session: {
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 dias
    extendOnActivity: true,
    maxConcurrentSessions: 3
  },

  // Configurações de rate limiting
  rateLimiting: {
    maxLoginAttempts: 5,
    lockoutDuration: 15 * 60 * 1000, // 15 minutos
    resetWindow: 60 * 60 * 1000 // 1 hora
  },

  // Configurações de upload
  fileUpload: {
    maxFileSize: 50 * 1024 * 1024, // 50MB
    maxImageSize: 10 * 1024 * 1024, // 10MB
    allowedImageTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    allowedDocumentTypes: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ],
    maxFilesPerUpload: 10
  },

  // Configurações de auditoria
  audit: {
    logFailedLogins: true,
    logSuccessfulLogins: true,
    logPasswordChanges: true,
    logPermissionChanges: true,
    retentionDays: 90
  }
};

export function validatePasswordStrength(password: string): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  const config = SecurityConfig.password;

  if (password.length < config.minLength) {
    errors.push(`Senha deve ter pelo menos ${config.minLength} caracteres`);
  }

  if (password.length > config.maxLength) {
    errors.push(`Senha deve ter no máximo ${config.maxLength} caracteres`);
  }

  if (config.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Senha deve conter pelo menos uma letra maiúscula');
  }

  if (config.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Senha deve conter pelo menos uma letra minúscula');
  }

  if (config.requireNumbers && !/\d/.test(password)) {
    errors.push('Senha deve conter pelo menos um número');
  }

  if (config.requireSpecialChars && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Senha deve conter pelo menos um caractere especial');
  }

  if (config.forbiddenPasswords.includes(password.toLowerCase())) {
    errors.push('Senha muito comum, escolha uma senha mais segura');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}
