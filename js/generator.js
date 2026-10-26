var ERGenerator = (function () {

    var ENROLL_HEADERS = ['CRN','sub','#','max','enrolled','waiting','fill rate','mt','sec','days','s time','e time','s date','e date','faculty','div','dpt','ses #','x','bldg','rm'];
    var CROSS_HEADERS = ['faculty','CRN','div','sub','#','title','sec','days','s time','e time','ses #','crosslist','bldg','rm','s date','e date','max','enrolled','x max','fill rate'];
    var WAIT_HEADERS = ['CRN','sub','#','sub/#','max','enrolled','waiting','fill rate','mt','sec','days','s time','e time','s date','e date','faculty','div','dpt','ses #','x','bldg','rm'];

    var LIGHT_GOLD = 'FFFFF2CC';
    var LIGHT_GREEN = 'FFE2EFDA';
    var GRAY = 'FFC8C8C8';
    var HEADER_BG = 'FFD9E2F3';

    function enrollRow(r) {
        return [r.crn, r.sub, r.courseNum, r.max, r.enrolled, r.waiting, null,
            r.mt, r.sec, r.days, r.sTime, r.eTime, r.sDate, r.eDate,
            r.faculty, r.div, r.dpt, r.ses, r.x, r.bldg, r.rm];
    }

    function crossRow(r) {
        return [r.faculty, r.crn, r.div, r.sub, r.courseNum, r.title, r.sec,
            r.days, r.sTime, r.eTime, r.ses, r.crosslist, r.bldg, r.rm,
            r.sDate, r.eDate, r.max, r.enrolled, r.xMax, null];
    }

    function waitRow(r) {
        return [r.crn, r.sub, r.courseNum, r.sub + r.courseNum, r.max, r.enrolled,
            r.waiting, null, r.mt, r.sec, r.days, r.sTime, r.eTime,
            r.sDate, r.eDate, r.faculty, r.div, r.dpt, r.ses, r.x, r.bldg, r.rm];
    }

    function setupSheet(ws, headers) {
        var headerRow = ws.addRow(headers);
        headerRow.eachCell(function (cell) {
            cell.alignment = { horizontal: 'center' };
            cell.font = { bold: true };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_BG } };
        });
        ws.views = [{ state: 'frozen', ySplit: 1 }];
    }

    function autoFitColumns(ws) {
        ws.columns.forEach(function (col) {
            var maxLen = 0;
            col.eachCell({ includeEmpty: false }, function (cell) {
                var val = cell.value;
                if (val === null || val === undefined) return;
                var len;
                if (val instanceof Date) {
                    len = 10;
                } else if (typeof val === 'object' && val.formula) {
                    len = 8;
                } else {
                    len = String(val).length;
                }
                if (cell.font && cell.font.size && cell.font.size > 11) {
                    len = Math.ceil(len * cell.font.size / 11);
                }
                if (len > maxLen) maxLen = len;
            });
            col.width = Math.max(maxLen + 2, 4);
        });
    }

    function setDateFmt(ws, row, cols) {
        cols.forEach(function (c) {
            var cell = ws.getCell(row, c);
            if (cell.value instanceof Date) cell.numFmt = 'm/d/yyyy';
        });
    }

    function addTrafficLights(ws, col, startRow, endRow) {
        if (startRow > endRow) return;
        ws.addConditionalFormatting({
            ref: col + startRow + ':' + col + endRow,
            rules: [{
                type: 'iconSet',
                iconSet: '3TrafficLights1',
                showValue: true,
                reverse: false,
                cfvo: [
                    { type: 'percent', value: 0 },
                    { type: 'num', value: 0.5 },
                    { type: 'num', value: 0.8 }
                ]
            }]
        });
    }

    function addArrows(ws, col, startRow, endRow) {
        if (startRow > endRow) return;
        ws.addConditionalFormatting({
            ref: col + startRow + ':' + col + endRow,
            rules: [{
                type: 'iconSet',
                iconSet: '3Arrows',
                showValue: true,
                reverse: false,
                cfvo: [
                    { type: 'percent', value: 0 },
                    { type: 'num', value: 10 },
                    { type: 'num', value: 20 }
                ]
            }]
        });
    }

    function writeEnrollmentSheet(wb, name, rows) {
        var ws = wb.addWorksheet(name);
        setupSheet(ws, ENROLL_HEADERS);
        rows.forEach(function (r) {
            var xlRow = ws.addRow(enrollRow(r));
            var n = xlRow.number;
            ws.getCell('G' + n).value = { formula: 'IFERROR(E' + n + '/D' + n + ',"")' };
            ws.getCell('G' + n).numFmt = '0%';
            setDateFmt(ws, n, [13, 14]);
        });
        if (rows.length > 0) addTrafficLights(ws, 'G', 2, rows.length + 1);
        autoFitColumns(ws);
        return ws;
    }

    function writeCrosslistedSheet(wb, groups) {
        var ws = wb.addWorksheet('Crosslisted');
        setupSheet(ws, CROSS_HEADERS);

        var subtotalCells = [];

        groups.forEach(function (group) {
            var startRow = ws.rowCount + 1;
            group.rows.forEach(function (r) {
                var xlRow = ws.addRow(crossRow(r));
                setDateFmt(ws, xlRow.number, [15, 16]);
            });
            var endRow = ws.rowCount;

            var subRow = ws.addRow(new Array(20).fill(null));
            var sn = subRow.number;
            ws.getCell('R' + sn).value = { formula: 'SUBTOTAL(9,R' + startRow + ':R' + endRow + ')' };
            ws.getCell('T' + sn).value = { formula: 'R' + sn + '/S' + endRow };
            ws.getCell('T' + sn).numFmt = '0%';
            for (var c = 1; c <= 20; c++) {
                ws.getCell(sn, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRAY } };
                ws.getCell(sn, c).font = { bold: true, size: 14 };
            }
            subtotalCells.push('T' + sn);
        });

        subtotalCells.forEach(function (ref) {
            ws.addConditionalFormatting({
                ref: ref,
                rules: [{
                    type: 'iconSet',
                    iconSet: '3TrafficLights1',
                    showValue: true,
                    reverse: false,
                    cfvo: [
                        { type: 'percent', value: 0 },
                        { type: 'num', value: 0.5 },
                        { type: 'num', value: 0.8 }
                    ]
                }]
            });
        });

        autoFitColumns(ws);
        return ws;
    }

    function writeWaitlistSheet(wb, groups) {
        var ws = wb.addWorksheet('By waitlist');
        setupSheet(ws, WAIT_HEADERS);

        var prevDiv = null;
        var colorIndex = -1;
        var colors = [LIGHT_GOLD, LIGHT_GREEN];
        var allWaitingRefs = [];
        var firstDataRow = 2;

        groups.forEach(function (group) {
            var startRow = ws.rowCount + 1;
            var groupDiv = group.rows[0].div;

            if (groupDiv !== prevDiv) {
                colorIndex++;
                prevDiv = groupDiv;
            }
            var bgColor = colors[colorIndex % 2];

            group.rows.forEach(function (r) {
                var xlRow = ws.addRow(waitRow(r));
                var n = xlRow.number;
                ws.getCell('H' + n).value = { formula: 'IFERROR(F' + n + '/E' + n + ',"")' };
                ws.getCell('H' + n).numFmt = '0%';
                setDateFmt(ws, n, [14, 15]);
            });
            var endRow = ws.rowCount;

            var subRow = ws.addRow(new Array(22).fill(null));
            var sn = subRow.number;
            var label = group.key + ' Total';
            ws.getCell('D' + sn).value = label;
            ws.getCell('G' + sn).value = { formula: 'SUBTOTAL(9,G' + startRow + ':G' + endRow + ')' };

            for (var c = 1; c <= 22; c++) {
                ws.getCell(sn, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
                ws.getCell(sn, c).font = { bold: true, size: 14 };
            }

            allWaitingRefs.push({ start: startRow, end: endRow });
        });

        var lastDataRow = ws.rowCount;

        var grandRow = ws.addRow(new Array(22).fill(null));
        var gn = grandRow.number;
        ws.getCell('D' + gn).value = 'Grand Total';
        ws.getCell('G' + gn).value = { formula: 'SUBTOTAL(9,G' + firstDataRow + ':G' + lastDataRow + ')' };
        for (var c = 1; c <= 22; c++) {
            ws.getCell(gn, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRAY } };
            ws.getCell(gn, c).font = { bold: true };
        }

        if (lastDataRow >= 2) {
            addTrafficLights(ws, 'H', 2, lastDataRow);
            addArrows(ws, 'G', 2, lastDataRow);
        }

        autoFitColumns(ws);
        return ws;
    }

    function generateFilename(termCode) {
        var now = new Date();
        var m = now.getMonth() + 1;
        var d = now.getDate();
        var y = String(now.getFullYear()).slice(2);
        return termCode + ' ' + m + '-' + d + '-' + y + '.xlsx';
    }

    function generateWorkbook(data) {
        var wb = new ExcelJS.Workbook();

        writeEnrollmentSheet(wb, 'All locations', data.allLocations);
        writeEnrollmentSheet(wb, 'Palmdale', data.palmdale);
        writeCrosslistedSheet(wb, data.crosslisted);
        writeEnrollmentSheet(wb, 'By fill rate', data.byFillRate);
        writeEnrollmentSheet(wb, 'F2F', data.f2f);
        writeEnrollmentSheet(wb, 'Distance ed.', data.distanceEd);

        if (data.lateStart) {
            writeEnrollmentSheet(wb, 'Late-start', data.lateStart);
        }
        if (data.byWaitlist) {
            writeWaitlistSheet(wb, data.byWaitlist);
        }

        return wb;
    }

    async function workbookToBlob(wb) {
        var buffer = await wb.xlsx.writeBuffer();
        return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    }

    return {
        generateWorkbook: generateWorkbook,
        generateFilename: generateFilename,
        workbookToBlob: workbookToBlob
    };
})();
