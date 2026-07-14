const fs = require('fs');

const FILE_PATH = 'src/app/(app)/leads/LeadsClient.tsx';
let content = fs.readFileSync(FILE_PATH, 'utf8');

const regex = /import \{([^}]+), Search\} from 'lucide-react';/;
content = content.replace(regex, "import {$1} from 'lucide-react';");

fs.writeFileSync(FILE_PATH, content, 'utf8');
console.log('Fixed LeadsClient.tsx Search import.');
