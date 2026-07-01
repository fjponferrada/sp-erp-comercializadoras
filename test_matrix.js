"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function parseReeMatrixFile(fileContent, componentName, version) {
    var lines = fileContent.split(/\r?\n/).map(function (l) { return l.trim(); }).filter(function (l) { return l.length > 0; });
    if (lines.length < 3)
        return [];
    // Line 1: Header (e.g., "Kestimado;" or "Perdidas20TD;")
    // Line 2: Year;Month;Day;Hour;Min;Sec; (e.g., "2025;11;12;11;50;38;")
    var dateParts = lines[1].split(';');
    if (dateParts.length < 2)
        return [];
    var year = parseInt(dateParts[0], 10);
    var month = parseInt(dateParts[1], 10);
    if (isNaN(year) || isNaN(month))
        return [];
    var jobs = [];
    for (var i = 2; i < lines.length; i++) {
        var cols = lines[i].split(';');
        if (cols.length < 25)
            continue;
        // e.g. "X 01" or "M 02"
        var dayStr = cols[0].split(' ')[1];
        var day = parseInt(dayStr, 10);
        if (isNaN(day))
            continue;
        var values = [];
        for (var h = 1; h <= 24; h++) {
            var val = parseFloat(cols[h].replace(',', '.'));
            values.push(isNaN(val) ? 0 : val);
        }
        var dateObj = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
        jobs.push({
            componentName: componentName,
            dateObj: dateObj,
            values: values,
            version: version
        });
    }
    return jobs;
}
var sampleKestimado = "Kestimado;\n2025;11;12;11;50;38;\nX 01;1.02085;1.03892;1.05089;1.05651;1.06130;1.02880;0.94308;0.88185;1.14088;0.93104;0.90005;0.89612;0.88472;0.88111;0.89000;1.02085;1.03892;1.05089;1.05651;1.06130;1.02880;0.94308;0.88185;1.14088;\n";
var res = parseReeMatrixFile(sampleKestimado, 'K', 'C2');
console.log(JSON.stringify(res, null, 2));
