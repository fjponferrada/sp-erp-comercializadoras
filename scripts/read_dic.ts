import * as xlsx from 'xlsx';
import path from 'path';

function readDic() {
    const file = path.resolve(process.cwd(), 'docs', 'diccionario_canales.xlsx');
    const workbook = xlsx.readFile(file);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = xlsx.utils.sheet_to_json(sheet);
    console.log(JSON.stringify(data, null, 2));
}

readDic();
