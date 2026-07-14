const fs = require('fs');
let f = 'src/app/(app)/puntos-suministro/[id]/SupplyPointDetailClient.tsx';
let c = fs.readFileSync(f, 'utf8');

// Fix internal grids
c = c.replace(/className="grid grid-cols-2 gap-4"/g, 'className="grid grid-cols-1 sm:grid-cols-2 gap-4"');
c = c.replace(/className="grid grid-cols-2 gap-4 mb-4"/g, 'className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4"');
c = c.replace(/className="grid grid-cols-3 gap-2"/g, 'className="grid grid-cols-2 sm:grid-cols-3 gap-2"');
c = c.replace(/className="p-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4"/g, 'className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4"');

// Fix Contracts Table
const contractsTableReplacement = `{/* Mobile View (Cards) */}
          <div className="block md:hidden">
            {!supplyPoint.contracts || supplyPoint.contracts.length === 0 ? (
              <div className="p-8 text-center text-white/50">
                No hay contratos asociados a este punto de suministro
              </div>
            ) : (
              supplyPoint.contracts.map((contract: any) => (
                <div key={contract.id} className="p-4 border-b border-white/5 bg-white/[0.02] flex flex-col gap-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <Link href={\`/contratos/\${contract.id}\`} className="font-mono text-sm text-lime-400 hover:underline">
                        {contract.contractCode || contract.id.slice(0, 8).toUpperCase()}
                      </Link>
                      <div className="text-xs text-white/50 mt-1">{formatDate(contract.createdAt)}</div>
                    </div>
                    <span className={\`text-xs px-2 py-1 rounded-full border \${getStatusColor(contract.status)}\`}>
                      {contract.status}
                    </span>
                  </div>
                  <div className="text-sm text-white/70">
                    <strong>Producto:</strong> {contract.product?.name || 'Desconocido'}<br/>
                    <strong>Comercial:</strong> {contract.user?.name || contract.user?.email || '-'}
                  </div>
                  <div className="flex justify-end mt-2">
                    {contract.pdfUrl || contract.airtableData?.['Contrato PDF'] ? (
                      <a href={contract.pdfUrl || contract.airtableData?.['Contrato PDF']} target="_blank" rel="noopener noreferrer" className="p-2 bg-white/5 rounded-lg text-white/60 hover:text-white">
                        <FileText size={16} />
                      </a>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>
          {/* Desktop View (Table) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">`;

c = c.replace(/<div className="overflow-x-auto">\s*<table className="w-full text-left border-collapse">/, contractsTableReplacement);

// Fix SIPS table
const sipsReplacement = `{/* Mobile View */}
<div className="block md:hidden p-4 space-y-4 text-sm text-white/80">
  <div className="bg-white/5 p-3 rounded-lg border border-white/10">
    <div className="font-semibold text-lime-400 mb-2 border-b border-white/10 pb-1">Potencia Contratada (kW)</div>
    <div className="grid grid-cols-2 gap-2">
      {periodos.map(p => <div key={\`pot-m-\${p}\`}><span className="text-white/40">P{p}:</span> {psData[\`PotenciaContratadaP\${p}kW\`] || '-'}</div>)}
    </div>
  </div>
  <div className="bg-white/5 p-3 rounded-lg border border-white/10">
    <div className="font-semibold text-lime-400 mb-2 border-b border-white/10 pb-1">Consumo Anual (kWh)</div>
    <div className="grid grid-cols-2 gap-2">
      {periodos.map(p => <div key={\`cons-m-\${p}\`}><span className="text-white/40">P{p}:</span> {psData[\`ConsumoAnualP\${p}kWh\`] || '-'}</div>)}
    </div>
  </div>
</div>
{/* Desktop View */}
<div className="hidden md:block overflow-x-auto">
  <table className="w-full text-left border-collapse min-w-[500px]">`;

c = c.replace(/<div className="overflow-x-auto">\s*<table className="w-full text-left border-collapse min-w-\[500px\]">/, sipsReplacement);

fs.writeFileSync(f, c, 'utf8');
console.log('SupplyPointDetailClient patched.');
