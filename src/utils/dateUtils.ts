/**
 * Safe, timezone-agnostic formatting of a date string "YYYY-MM-DD" or ISO string to Brazilian format "DD/MM/YYYY".
 */
export const formatLocalDate = (dateVal: string | Date | undefined | null): string => {
  if (!dateVal) return '—';
  
  let dateStr = '';
  if (dateVal instanceof Date) {
    const day = String(dateVal.getDate()).padStart(2, '0');
    const month = String(dateVal.getMonth() + 1).padStart(2, '0');
    const year = dateVal.getFullYear();
    return `${day}/${month}/${year}`;
  } else {
    dateStr = String(dateVal).trim();
  }

  if (!dateStr) return '—';

  // If it's a date-only string like "YYYY-MM-DD"
  const dateOnlyRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (dateOnlyRegex.test(dateStr)) {
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  }

  // If it contains a timezone or time component (e.g. ISO string)
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return dateStr;
  }
};

/**
 * Parses a date-only string "YYYY-MM-DD" into a local Date object, avoiding UTC timezone offsets.
 */
export const parseLocalDate = (dateVal: string | undefined | null): Date | null => {
  if (!dateVal) return null;
  const dateStr = String(dateVal).trim();
  if (!dateStr) return null;
  
  if (dateStr.includes('T') || dateStr.includes('Z')) {
    return new Date(dateStr);
  }
  
  // Use noon to avoid DST edge cases shifting dates
  return new Date(`${dateStr}T12:00:00`);
};
