import { format, parseISO, isValid } from 'date-fns';

export const formatDate = (dateStr: string | undefined | null): string => {
  if (!dateStr) return 'N/A';
  try {
    const date = parseISO(dateStr);
    if (!isValid(date)) return dateStr;
    return format(date, 'dd/MM/yyyy');
  } catch (e) {
    return dateStr;
  }
};

export const formatMonth = (monthStr: string | undefined | null): string => {
  if (!monthStr) return 'N/A';
  // monthStr is usually yyyy-MM
  try {
    const [year, month] = monthStr.split('-');
    if (year && month) {
      return `${month}/${year}`;
    }
    return monthStr;
  } catch (e) {
    return monthStr;
  }
};
