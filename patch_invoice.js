const fs = require('fs');
let f = 'src/app/(app)/facturas/[id]/InvoiceDetailClient.tsx';
let c = fs.readFileSync(f, 'utf8');

const regexPeriodRow = /const PeriodRow = \(\{.*?\}\) => \{[\s\S]*?return \([\s\S]*?<div className="grid grid-cols-7.*?">[\s\S]*?<\/div>\s*\);\s*\};/;

const newPeriodRow = `const PeriodRow = ({ label, p1, p2, p3, p4, p5, p6, formatter }: any) => {
    if ([p1, p2, p3, p4, p5, p6].every(p => p === null || p === undefined)) return null;
    return (
      <div className="flex flex-col md:grid md:grid-cols-7 gap-1 md:gap-2 md:items-center py-3 md:py-2 border-b border-[var(--border-strong)] text-sm">
        <div className="font-semibold text-[var(--lime)] md:text-gray-400 mb-1 md:mb-0">{label}</div>
        
        {/* Mobile View */}
        <div className="grid grid-cols-3 gap-2 md:hidden text-xs">
          <div><span className="text-gray-500 mr-1">P1:</span> {formatter(p1)}</div>
          <div><span className="text-gray-500 mr-1">P2:</span> {formatter(p2)}</div>
          <div><span className="text-gray-500 mr-1">P3:</span> {formatter(p3)}</div>
          {p4 !== null && p4 !== undefined && <div><span className="text-gray-500 mr-1">P4:</span> {formatter(p4)}</div>}
          {p5 !== null && p5 !== undefined && <div><span className="text-gray-500 mr-1">P5:</span> {formatter(p5)}</div>}
          {p6 !== null && p6 !== undefined && <div><span className="text-gray-500 mr-1">P6:</span> {formatter(p6)}</div>}
        </div>

        {/* Desktop View */}
        <div className="hidden md:block text-right">{formatter(p1)}</div>
        <div className="hidden md:block text-right">{formatter(p2)}</div>
        <div className="hidden md:block text-right">{formatter(p3)}</div>
        <div className="hidden md:block text-right">{p4 !== null && p4 !== undefined ? formatter(p4) : '-'}</div>
        <div className="hidden md:block text-right">{p5 !== null && p5 !== undefined ? formatter(p5) : '-'}</div>
        <div className="hidden md:block text-right">{p6 !== null && p6 !== undefined ? formatter(p6) : '-'}</div>
      </div>
    );
  };`;

c = c.replace(regexPeriodRow, newPeriodRow);

// Replace min-w-[600px]
c = c.replace(/min-w-\[600px\]/g, 'md:min-w-[600px]');

// Hide headers on mobile
c = c.replace(/className="grid grid-cols-7 gap-2 pb-2 mb-2/g, 'className="hidden md:grid grid-cols-7 gap-2 pb-2 mb-2');

fs.writeFileSync(f, c, 'utf8');
console.log('InvoiceDetailClient patched.');
