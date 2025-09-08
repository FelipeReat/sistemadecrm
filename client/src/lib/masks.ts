export const masks = {
  cpf: "999.999.999-99",
  cnpj: "99.999.999/9999-99",
  phone: "(99) 99999-9999",
  cep: "99999-999",

  // Máscara para data simples (dd/mm/aaaa)
  date: {
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      let value = e.target.value.replace(/\D/g, '');

      if (value.length >= 2) {
        value = value.substring(0, 2) + '/' + value.substring(2);
      }
      if (value.length >= 5) {
        value = value.substring(0, 5) + '/' + value.substring(5, 9);
      }

      e.target.value = value;
    },
    placeholder: "dd/mm/aaaa",
    mask: "99/99/9999"
  },

  // Máscara para data e hora (dd/mm/aaaa hh:mm)
  datetime: {
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      let value = e.target.value.replace(/\D/g, '');

      if (value.length >= 2) {
        value = value.substring(0, 2) + '/' + value.substring(2);
      }
      if (value.length >= 5) {
        value = value.substring(0, 5) + '/' + value.substring(5);
      }
      if (value.length >= 10) {
        value = value.substring(0, 10) + ' ' + value.substring(10);
      }
      if (value.length >= 13) {
        value = value.substring(0, 13) + ':' + value.substring(13, 15);
      }

      e.target.value = value;
    },
    placeholder: "dd/mm/aaaa hh:mm",
    mask: "99/99/9999 99:99"
  },

  // Função para formatar moeda
  currency: {
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      let value = e.target.value.replace(/\D/g, '');
      if (value === '') {
        e.target.value = '';
        return;
      }

      const numericValue = parseInt(value, 10);
      const formattedValue = (numericValue / 100).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: 2
      });

      e.target.value = formattedValue;
    },
    placeholder: "R$ 0,00"
  },

  // Função para formatar porcentagem
  percent: {
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      let value = e.target.value.replace(/\D/g, '');
      if (value === '') {
        e.target.value = '';
        return;
      }

      const numericValue = parseInt(value, 10);
      if (numericValue > 10000) return; // Limite de 100%

      const formattedValue = (numericValue / 100).toFixed(2).replace('.', ',');
      e.target.value = formattedValue + '%';
    },
    placeholder: "0,00%"
  },

  // Função para CPF ou CNPJ automático
  cnpjOrCpf: (value: string) => {
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length <= 11) {
      // CPF format
      if (cleaned.length <= 3) return cleaned;
      if (cleaned.length <= 6) return `${cleaned.slice(0, 3)}.${cleaned.slice(3)}`;
      if (cleaned.length <= 9) return `${cleaned.slice(0, 3)}.${cleaned.slice(3, 6)}.${cleaned.slice(6)}`;
      return `${cleaned.slice(0, 3)}.${cleaned.slice(3, 6)}.${cleaned.slice(6, 9)}-${cleaned.slice(9, 11)}`;
    } else {
      // CNPJ format
      if (cleaned.length <= 2) return cleaned;
      if (cleaned.length <= 5) return `${cleaned.slice(0, 2)}.${cleaned.slice(2)}`;
      if (cleaned.length <= 8) return `${cleaned.slice(0, 2)}.${cleaned.slice(2, 5)}.${cleaned.slice(5)}`;
      if (cleaned.length <= 12) return `${cleaned.slice(0, 2)}.${cleaned.slice(2, 5)}.${cleaned.slice(5, 8)}/${cleaned.slice(8)}`;
      return `${cleaned.slice(0, 2)}.${cleaned.slice(2, 5)}.${cleaned.slice(5, 8)}/${cleaned.slice(8, 12)}-${cleaned.slice(12, 14)}`;
    }
  },

  uppercase: (value: string) => value.toUpperCase()
};

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
  }
};

// Hook personalizado para máscaras
export const useMask = (type: string) => {
  const applyMask = (value: string) => {
    switch (type) {
      case 'date':
        return formatters.formatDate(value);
      case 'datetime':
        return formatters.formatDateTime(value);
      case 'currency':
        // Implementar formatação de moeda
        return value;
      default:
        return value;
    }
  };

  return { applyMask };
};