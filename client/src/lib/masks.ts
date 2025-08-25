
export const masks = {
  cpf: "999.999.999-99",
  cnpj: "99.999.999/9999-99",
  phone: "(99) 99999-9999",
  cep: "99999-999",
  date: "99/99/9999",
  currency: "R$ 999.999.999,99",
  percentage: "999,99%"
};

export const formatters = {
  currency: (value: string) => {
    const numericValue = value.replace(/\D/g, '');
    const formattedValue = (Number(numericValue) / 100).toFixed(2);
    return `R$ ${formattedValue.replace('.', ',')}`;
  },
  
  percentage: (value: string) => {
    const numericValue = value.replace(/\D/g, '');
    return `${numericValue}%`;
  },
  
  removeFormatting: (value: string) => {
    return value.replace(/\D/g, '');
  }
};
