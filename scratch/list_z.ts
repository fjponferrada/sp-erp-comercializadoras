import * as fs from 'fs';

try {
  const files = fs.readdirSync('Z:\\AED\\AEAT\\560');
  console.log("Files in Z:\\AED\\AEAT\\560:");
  console.log(files);
} catch (e) {
  console.error(e);
}
