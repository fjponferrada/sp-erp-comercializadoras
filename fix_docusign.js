const fs = require('fs');
let code = fs.readFileSync('src/app/actions/contractActions.ts', 'utf8');
code = code.replace("    const docusign = require('docusign-esign');\r\n    const apiClient = new docusign.ApiClient();", "    const apiClient = new docusign.ApiClient();");
code = code.replace("    const docusign = require('docusign-esign');\n    const apiClient = new docusign.ApiClient();", "    const apiClient = new docusign.ApiClient();");
code = code.replace("  const docusign = require('docusign-esign');\r\n  const apiClient = new docusign.ApiClient();", "  const apiClient = new docusign.ApiClient();");
code = code.replace("  const docusign = require('docusign-esign');\n  const apiClient = new docusign.ApiClient();", "  const apiClient = new docusign.ApiClient();");
fs.writeFileSync('src/app/actions/contractActions.ts', code);
console.log('Fixed contractActions.ts');
