const fs = require('fs');
let file = fs.readFileSync('src/app/(app)/contratos/EditContractModal.tsx', 'utf8');

file = file.replace(
/  const InputField = \(\{ label, name, type = 'text', step = 'any' \}: any\) => \([\s\S]*?  \);\n/,
''
);

const newComponent = `
const InputField = ({ label, name, type = 'text', step = 'any', formData, handleChange }: any) => (
  <div>
    <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">{label}</label>
    <input 
      type={type} 
      name={name} 
      step={step}
      value={(formData && formData[name as keyof typeof formData]) as string || ''} 
      onChange={handleChange} 
      className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:border-lime-500/50 transition-all outline-none"
    />
  </div>
);
`;

file = file.replace('export default function EditContractModal', newComponent + '\nexport default function EditContractModal');
file = file.replace(/<InputField /g, '<InputField formData={formData} handleChange={handleChange} ');

fs.writeFileSync('src/app/(app)/contratos/EditContractModal.tsx', file);
