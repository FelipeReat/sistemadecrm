
import { z } from "zod";

// Validadores para CPF e CNPJ
export const cpfValidator = z
  .string()
  .optional()
  .refine((val) => {
    if (!val || val.length === 0) return true;
    const cpf = val.replace(/\D/g, '');
    if (cpf.length !== 11) return false;
    
    // Verifica se todos os dígitos são iguais
    if (/^(\d)\1{10}$/.test(cpf)) return false;
    
    // Validação do primeiro dígito verificador
    let sum = 0;
    for (let i = 0; i < 9; i++) {
      sum += parseInt(cpf[i]) * (10 - i);
    }
    let remainder = sum % 11;
    let digit1 = remainder < 2 ? 0 : 11 - remainder;
    
    if (parseInt(cpf[9]) !== digit1) return false;
    
    // Validação do segundo dígito verificador
    sum = 0;
    for (let i = 0; i < 10; i++) {
      sum += parseInt(cpf[i]) * (11 - i);
    }
    remainder = sum % 11;
    let digit2 = remainder < 2 ? 0 : 11 - remainder;
    
    return parseInt(cpf[10]) === digit2;
  }, "CPF inválido");

export const cnpjValidator = z
  .string()
  .optional()
  .refine((val) => {
    if (!val || val.length === 0) return true;
    const cnpj = val.replace(/\D/g, '');
    if (cnpj.length !== 14) return false;
    
    // Verifica se todos os dígitos são iguais
    if (/^(\d)\1{13}$/.test(cnpj)) return false;
    
    // Validação dos dígitos verificadores
    const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      sum += parseInt(cnpj[i]) * weights1[i];
    }
    let remainder = sum % 11;
    let digit1 = remainder < 2 ? 0 : 11 - remainder;
    
    if (parseInt(cnpj[12]) !== digit1) return false;
    
    sum = 0;
    for (let i = 0; i < 13; i++) {
      sum += parseInt(cnpj[i]) * weights2[i];
    }
    remainder = sum % 11;
    let digit2 = remainder < 2 ? 0 : 11 - remainder;
    
    return parseInt(cnpj[13]) === digit2;
  }, "CNPJ inválido");

export const phoneValidator = z
  .string()
  .min(1, "Telefone é obrigatório")
  .refine((val) => {
    const phone = val.replace(/\D/g, '');
    return phone.length >= 10 && phone.length <= 11;
  }, "Telefone deve ter 10 ou 11 dígitos");

export const emailValidator = z
  .string()
  .min(1, "Email é obrigatório")
  .email("Email inválido")
  .refine((val) => {
    // Verifica se não é um email temporário comum
    const tempDomains = ['10minutemail.com', 'guerrillamail.com', 'mailinator.com'];
    const domain = val.split('@')[1]?.toLowerCase();
    return !tempDomains.includes(domain);
  }, "Email temporário não é permitido");

export const budgetValidator = z
  .string()
  .optional()
  .refine((val) => {
    if (!val || val.length === 0) return true;
    const numValue = parseFloat(val.replace(/[^\d,.-]/g, '').replace(',', '.'));
    return !isNaN(numValue) && numValue > 0;
  }, "Valor do orçamento deve ser um número positivo");

export const dateValidator = z
  .string()
  .optional()
  .refine((val) => {
    if (!val || val.length === 0) return true;
    const date = new Date(val);
    const now = new Date();
    return date > now;
  }, "Data deve ser futura");
