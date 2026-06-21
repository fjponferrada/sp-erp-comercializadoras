const fs = require('fs');
const pdf = require('pdf-parse');

let dataBuffer = fs.readFileSync(process.argv[2]);

pdf(dataBuffer).then(function(data) {
    fs.writeFileSync('flujogramas.txt', data.text);
    console.log("PDF extracted to flujogramas.txt");
});
