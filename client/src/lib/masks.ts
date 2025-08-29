
export const masks = {
  cpf: "999.999.999-99",
  cnpj: "99.999.999/9999-99",
  phone: "(99) 99999-9999",
  cep: "99999-999",
  date: (value: string) => {
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length <= 2) return cleaned;
    if (cleaned.length <= 4) return `${cleaned.slice(0, 2)}/${cleaned.slice(2)}`;
    return `${cleaned.slice(0, 2)}/${cleaned.slice(2, 4)}/${cleaned.slice(4, 8)}`;
  },
  currency: (value: string) => {
    const numericValue = value.replace(/\D/g, '');
    if (!numericValue) return '';
    const formattedValue = (Number(numericValue) / 100).toFixed(2);
    return `R$ ${formattedValue.replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
  },
  percent: (value: string) => {
    const numericValue = value.replace(/\D/g, '');
    if (!numericValue) return '';
    const formattedValue = (Number(numericValue) / 100).toFixed(2);
    return `${formattedValue.replace('.', ',')}%`;
  },
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

export const formatters = {
  currency: (value: string) => {
    const numericValue = value.replace(/\D/g, '');
    if (!numericValue) return '';
    const formattedValue = (Number(numericValue) / 100).toFixed(2);
    return `R$ ${formattedValue.replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
  },
  
  percentage: (value: string) => {
    const numericValue = value.replace(/\D/g, '');
    if (!numericValue) return '';
    return `${numericValue}%`;
  },
  
  removeFormatting: (value: string) => {
    return value.replace(/\D/g, '');
  }
};
