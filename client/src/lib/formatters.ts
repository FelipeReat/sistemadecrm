
// Funções auxiliares para formatação
export const formatters = {
  // Remove formatação para envio ao servidor
  cleanValue: (value: string) => {
    return value.replace(/\D/g, '');
  },

  // Formata data para exibição
  formatDate: (value: string) => {
    if (!value) return '';
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length >= 8) {
      return `${cleaned.slice(0, 2)}/${cleaned.slice(2, 4)}/${cleaned.slice(4, 8)}`;
    }
    return value;
  },

  // Formata data e hora para exibição
  formatDateTime: (value: string) => {
    if (!value) return '';
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length >= 12) {
      return `${cleaned.slice(0, 2)}/${cleaned.slice(2, 4)}/${cleaned.slice(4, 8)} ${cleaned.slice(8, 10)}:${cleaned.slice(10, 12)}`;
    }
    return value;
  },

  // Converte data BR para formato ISO (para input datetime-local)
  dateToISO: (dateStr: string): string => {
    if (!dateStr || dateStr.length !== 10) return '';
    const [day, month, year] = dateStr.split('/');
    // Use local timezone to avoid date shifting
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    const isoDate = date.getFullYear() + '-' +
                   String(date.getMonth() + 1).padStart(2, '0') + '-' +
                   String(date.getDate()).padStart(2, '0');
    return isoDate;
  },

  // Converte data ISO para formato BR
  dateFromISO: (isoDateStr: string): string => {
    if (!isoDateStr) return '';
    const date = new Date(isoDateStr + 'T00:00:00'); // Force local timezone
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  },

  currencyToNumber: (value: string): number => {
    if (!value) return 0;
    return parseFloat(value.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
  },

  // Converte data/hora brasileira para objeto Date
  parseDateTime: (dateTimeStr: string): Date | null => {
    if (!dateTimeStr) return null;
    
    // Formato esperado: DD/MM/AAAA HH:MM
    const regex = /^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})$/;
    const match = dateTimeStr.match(regex);
    
    if (!match) return null;
    
    const [, day, month, year, hour, minute] = match;
    return new Date(
      parseInt(year),
      parseInt(month) - 1, // mês em JS é zero-indexado
      parseInt(day),
      parseInt(hour),
      parseInt(minute)
    );
  }
};
