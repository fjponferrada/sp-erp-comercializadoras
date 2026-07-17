export const formatDateUTC = (val: any): string => {
  if (!val) return '-';
  
  let d: Date;
  
  try {
    if (val instanceof Date) {
      d = val;
    } else if (typeof val === 'string') {
      const str = val.trim();
      if (str.includes('T')) {
        d = new Date(str);
      } else {
        const parts = str.split(/[\/\-]/);
        if (parts.length === 3) {
          if (parts[0].length === 4) {
            d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
          } else if (parts[2].length === 4) {
            d = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
          } else {
            d = new Date(str);
          }
        } else {
          d = new Date(str);
        }
      }
    } else if (typeof val === 'number') {
      d = new Date(val);
    } else {
      d = new Date(val as any);
    }
    
    if (!d || typeof d.getTime !== 'function' || isNaN(d.getTime())) return '-';
    
    return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch (e) {
    return '-';
  }
};
