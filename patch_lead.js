const fs = require('fs');
let f = 'src/app/(app)/leads/[id]/LeadDetailClient.tsx';
let c = fs.readFileSync(f, 'utf8');

c = c.replace(/<ChevronLeft size=\{16\} \/> Volver a Leads/g, '<ChevronLeft size={16} /> <span className="hidden md:inline">Volver</span>');
c = c.replace(/<FileText size=\{16\} \/>\s*Oferta Suministro/g, '<FileText size={16} /> <span className="hidden md:inline">Suministro</span>');
c = c.replace(/<FileText size=\{16\} \/>\s*Oferta Autoconsumo/g, '<FileText size={16} /> <span className="hidden md:inline">Autoconsumo</span>');
c = c.replace(/<FileCheck size=\{16\} \/>\} \s*\{isConverting \? 'Generando\.\.\.' : 'Generar Contrato'\}/g, '<FileCheck size={16} />} <span className="hidden md:inline">{isConverting ? \'Generando...\' : \'Generar Contrato\'}</span>');
c = c.replace(/<RefreshCw size=\{16\} \/>\} \s*\{isConverting \? 'Rehaciendo\.\.\.' : 'Rehacer Contrato'\}/g, '<RefreshCw size={16} />} <span className="hidden md:inline">{isConverting ? \'Rehaciendo...\' : \'Rehacer Contrato\'}</span>');
c = c.replace(/<FileText size=\{16\} \/> Ver Contrato/g, '<FileText size={16} /> <span className="hidden md:inline">Ver Contrato</span>');

// Topbar in LeadDetailClient has a very long title sometimes. We can use a truncate or flex-wrap in customActions.
// Wait, Topbar uses display:flex gap:12px.
c = c.replace(/<div className="flex gap-3 items-center">/g, '<div className="flex gap-2 md:gap-3 items-center overflow-x-auto md:overflow-visible no-scrollbar pb-1 md:pb-0">');

fs.writeFileSync(f, c, 'utf8');
console.log('LeadDetailClient patched.');

let f2 = 'src/app/(app)/contratos/[id]/ContractDetailClient.tsx';
let c2 = fs.readFileSync(f2, 'utf8');

c2 = c2.replace(/<ChevronLeft size=\{16\} \/> Volver/g, '<ChevronLeft size={16} /> <span className="hidden md:inline">Volver</span>');
c2 = c2.replace(/<FileText size=\{16\} \/>\}\s*\{isGeneratingXml \? 'Generando\.\.\.' : 'Generar XML'\}/g, '<FileText size={16} />} <span className="hidden md:inline">{isGeneratingXml ? \'Generando...\' : \'Generar XML\'}</span>');
c2 = c2.replace(/<Settings size=\{16\} \/> Modificar Contrato/g, '<Settings size={16} /> <span className="hidden md:inline">Modificar</span>');
c2 = c2.replace(/<Send size=\{16\} \/>\} \s*\{isSendingSignature \? 'Enviando\.\.\.' : 'Enviar a DocuSign'\}/g, '<Send size={16} />} <span className="hidden md:inline">{isSendingSignature ? \'Enviando...\' : \'DocuSign\'}</span>');
c2 = c2.replace(/<AlertTriangle size=\{16\} \/>\}\s*\{isDeletingVersion \? 'Eliminando\.\.\.' : 'Volver a Versión anterior'\}/g, '<AlertTriangle size={16} />} <span className="hidden md:inline">{isDeletingVersion ? \'Eliminando...\' : \'Versión anterior\'}</span>');
c2 = c2.replace(/<div className="flex gap-3 items-center">/g, '<div className="flex gap-2 md:gap-3 items-center overflow-x-auto md:overflow-visible no-scrollbar pb-1 md:pb-0">');

fs.writeFileSync(f2, c2, 'utf8');
console.log('ContractDetailClient patched (Topbar Actions).');
