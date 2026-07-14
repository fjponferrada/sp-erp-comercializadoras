import * as fs from 'fs';

const filePath = 'src/components/gestion/EnergiaPendienteClient.tsx';
let content = fs.readFileSync(filePath, 'utf8');

const importTarget = `import { Loader2, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';`;
const newImport = `import { Loader2, TrendingUp, TrendingDown, AlertCircle, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';`;

const headerTarget = `      <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px' }}>
        Energía Pendiente de Liquidar (REE)
      </h2>`;
const newHeader = `      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)' }}>
          Energía Pendiente de Liquidar (REE)
        </h2>
        <button 
          onClick={async () => {
            const t = toast.loading('Iniciando recálculo...');
            try {
              const res = await fetch('/api/gestion/energia-pendiente/recalculate', { method: 'POST' });
              const json = await res.json();
              if (json.success) {
                toast.success(json.message, { id: t, duration: 5000 });
              } else {
                toast.error(json.error || 'Error iniciando recálculo', { id: t });
              }
            } catch (err: any) {
              toast.error(err.message, { id: t });
            }
          }}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 500, fontSize: '0.9rem' }}
        >
          <RefreshCw size={16} />
          Recalcular Ahora
        </button>
      </div>`;

content = content.replace(importTarget, newImport);
content = content.replace(headerTarget, newHeader);

fs.writeFileSync(filePath, content);
console.log('EnergiaPendienteClient.tsx updated with button.');
