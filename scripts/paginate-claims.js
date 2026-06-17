const fs = require('fs');

// 1. UPDATE CLAIMS ACTIONS
let actionsCode = fs.readFileSync('src/app/actions/claimsActions.ts', 'utf8');

actionsCode = actionsCode.replace(
  'export async function getClaimsAction(contractId?: string): Promise<{ success: true; data: ClaimSummary[] } | { success: false; error: string }> {',
  'export async function getClaimsAction(contractId?: string, page: number = 1, limit: number = 50, searchTerm: string = ""): Promise<{ success: true; data: ClaimSummary[], totalCount: number } | { success: false; error: string }> {'
);

const newReturnLogic = `
    // Sort descending by paso01 date
    claims.sort((a, b) => {
      const dateA = a.paso01?.fecha || a.paso02?.fecha || new Date(0);
      const dateB = b.paso01?.fecha || b.paso02?.fecha || new Date(0);
      return dateB.getTime() - dateA.getTime();
    });

    let finalClaims = claims;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      finalClaims = claims.filter(c => 
        c.codigoSolicitud?.toLowerCase().includes(term) ||
        c.cups?.toLowerCase().includes(term) ||
        (c.codigoReclamacion && c.codigoReclamacion.toLowerCase().includes(term))
      );
    }

    const totalCount = finalClaims.length;
    const paginatedClaims = finalClaims.slice((page - 1) * limit, page * limit);

    return { success: true, data: paginatedClaims, totalCount };
  } catch (error: any) {`;

actionsCode = actionsCode.replace(
  /    \/\/ Sort descending by paso01 date[\s\S]*?return { success: true, data: claims };\n  \} catch \(error: any\) \{/m,
  newReturnLogic
);

// Fallback in case the exact replace fails
if (actionsCode.includes('return { success: true, data: claims };')) {
  actionsCode = actionsCode.replace(
    'return { success: true, data: claims };',
    'const totalCount = claims.length; const paginatedClaims = claims.slice((page - 1) * limit, page * limit); return { success: true, data: paginatedClaims, totalCount };'
  );
}

fs.writeFileSync('src/app/actions/claimsActions.ts', actionsCode);

// 2. UPDATE PAGE
let pageCode = fs.readFileSync('src/app/(app)/reclamaciones/page.tsx', 'utf8');
pageCode = pageCode.replace(
  'const result = await getClaimsAction();',
  'const result = await getClaimsAction(undefined, 1, 50, "");'
);
pageCode = pageCode.replace(
  'const initialClaims = result.success ? result.data : [];',
  'const initialClaims = result.success ? result.data : [];\n  const initialTotalCount = result.success && "totalCount" in result ? result.totalCount : 0;'
);
pageCode = pageCode.replace(
  '<ReclamacionesClient \n      initialClaims={initialClaims as any} \n      userRole={userRole} \n    />',
  '<ReclamacionesClient \n      initialClaims={initialClaims as any} \n      initialTotalCount={initialTotalCount}\n      userRole={userRole} \n    />'
);
fs.writeFileSync('src/app/(app)/reclamaciones/page.tsx', pageCode);

// 3. UPDATE CLIENT
let clientCode = fs.readFileSync('src/app/(app)/reclamaciones/ReclamacionesClient.tsx', 'utf8');

clientCode = clientCode.replace(
  'interface ReclamacionesClientProps {\n  initialClaims: ClaimSummary[];\n  userRole: string;\n}',
  'interface ReclamacionesClientProps {\n  initialClaims: ClaimSummary[];\n  initialTotalCount: number;\n  userRole: string;\n}'
);

clientCode = clientCode.replace(
  'export default function ReclamacionesClient({\n  initialClaims,\n  userRole\n}: ReclamacionesClientProps) {',
  'export default function ReclamacionesClient({\n  initialClaims,\n  initialTotalCount,\n  userRole\n}: ReclamacionesClientProps) {'
);

clientCode = clientCode.replace(
  'const [claims, setClaims] = useState(initialClaims);\n  const [loading, setLoading] = useState(false);\n  const [searchTerm, setSearchTerm] = useState(\'\');',
  'const [claims, setClaims] = useState(initialClaims);\n  const [totalCount, setTotalCount] = useState(initialTotalCount);\n  const [loading, setLoading] = useState(false);\n  const [searchTerm, setSearchTerm] = useState(\'\');\n  const [page, setPage] = useState(1);'
);

const newFetchClaims = `const fetchClaims = async (resetPage = false, newSearchTerm = searchTerm) => {
    setLoading(true);
    const currentPage = resetPage ? 1 : page + 1;
    const result = await getClaimsAction(undefined, currentPage, 50, newSearchTerm);
    if (result.success) {
      if (resetPage) {
        setClaims(result.data);
        setPage(1);
      } else {
        setClaims([...claims, ...result.data]);
        setPage(currentPage);
      }
      if ('totalCount' in result) setTotalCount(result.totalCount);
    } else {
      toast.error('Error recargando reclamaciones');
    }
    setLoading(false);
  };`;

clientCode = clientCode.replace(
  /const fetchClaims = async \(\) => \{[\s\S]*?setLoading\(false\);\n  \};/,
  newFetchClaims
);

clientCode = clientCode.replace(
  /const filteredClaims = claims\.filter\([\s\S]*?\);\n/,
  ''
);

clientCode = clientCode.replace(
  'Total: {filteredClaims.length}',
  'Total: {totalCount}'
);

clientCode = clientCode.replace(
  'onChange={(e) => setSearchTerm(e.target.value)}',
  'onChange={(e) => { setSearchTerm(e.target.value); fetchClaims(true, e.target.value); }}'
);

clientCode = clientCode.replace(
  'onClick={fetchClaims}',
  'onClick={() => fetchClaims(true)}'
);

const loadMoreBtn = `
          {claims.length < totalCount && (
            <div className="p-4 border-t border-[var(--border)] flex justify-center bg-[rgba(255,255,255,0.01)]">
              <button
                onClick={() => fetchClaims()}
                disabled={loading}
                className="px-6 py-2.5 bg-[var(--bg-base)] border border-[var(--border)] rounded-lg text-sm font-medium hover:bg-[rgba(255,255,255,0.05)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {loading ? <RefreshCcw className="h-4 w-4 animate-spin" /> : null}
                Cargar más registros ({claims.length} de {totalCount})
              </button>
            </div>
          )}
        </div>
`;

clientCode = clientCode.replace(
  /        <\/div>\n\n      <\/div>\n    <\/div>\n  \);\n\}/,
  loadMoreBtn + '\n      </div>\n    </div>\n  );\n}'
);

clientCode = clientCode.replace(
  'filteredClaims.map((claim)',
  'claims.map((claim)'
);

fs.writeFileSync('src/app/(app)/reclamaciones/ReclamacionesClient.tsx', clientCode);
console.log("Done updating reclamaciones!");
