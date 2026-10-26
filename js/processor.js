var ERProcessor = (function () {

    function classifyFile(headers) {
        var h = headers.map(function (s) { return s.trim(); });
        if (h.indexOf('SSBXLST_MAX_ENRL') !== -1) return 'crosslist';
        if (h.indexOf('WAITING_LIST_COUNT') !== -1) return 'enrollment';
        return null;
    }

    function detectTerm(rows) {
        for (var i = 0; i < rows.length; i++) {
            var row = rows[i];
            var crn = String(row.CRN || '').trim();
            if (!crn || crn.length < 5) continue;
            var prefix = crn[0];
            var startDate = (row.START_DATE_ASGN || '').trim();
            if (!startDate) continue;
            var parts = startDate.split('/');
            if (parts.length !== 3) continue;
            var year = parts[2];
            var map = {
                '1': { suffix: '10', label: 'Winter', type: 'winter' },
                '3': { suffix: '30', label: 'Spring', type: 'spring' },
                '5': { suffix: '50', label: 'Summer', type: 'summer' },
                '7': { suffix: '70', label: 'Fall', type: 'fall' },
                '8': { suffix: '70', label: 'Fall', type: 'fall' }
            };
            var info = map[prefix];
            if (!info) continue;
            return { code: year + info.suffix, label: info.label + ' ' + year, type: info.type };
        }
        return null;
    }

    function parseDate(str) {
        if (!str || typeof str !== 'string') return null;
        var s = str.trim();
        if (!s) return null;
        var p = s.split('/');
        if (p.length !== 3) return null;
        return new Date(parseInt(p[2]), parseInt(p[0]) - 1, parseInt(p[1]));
    }

    function num(val) {
        if (val === '' || val === null || val === undefined) return null;
        var n = Number(val);
        return isNaN(n) ? null : n;
    }

    function str(val) { return (val === null || val === undefined) ? '' : String(val); }

    function transformEnrollment(row) {
        var max = num(row.ENROLL_COUNT_SECTION_MAX);
        var enrolled = num(row.ENROLL_COUNT_SECTION);
        return {
            crn: num(row.CRN),
            sub: str(row.SUBJECT_CODE).trim(),
            courseNum: str(row.COURSE_NUMBER).trim(),
            max: max,
            enrolled: enrolled,
            waiting: num(row.WAITING_LIST_COUNT),
            mt: str(row.MEETING_SCHED_TYPE_CODE).trim(),
            sec: row.SECTION_SEQ !== undefined ? row.SECTION_SEQ : '',
            days: str(row.MEETING_DAYS_ASGN),
            sTime: str(row.BEGIN_TIME_AM_PM_ASGN),
            eTime: str(row.END_TIME_AM_PM_ASGN),
            sDate: parseDate(str(row.START_DATE_ASGN)),
            eDate: parseDate(str(row.END_DATE_ASGN)),
            faculty: str(row.NAME_LAST_FIRST_MI_ABBR).trim(),
            div: str(row.DIVISION_CODE).trim(),
            dpt: str(row.DEPARTMENT_CODE).trim(),
            ses: num(row.SESSION_IND),
            x: row.CROSSLIST_GROUP_CODE !== undefined ? row.CROSSLIST_GROUP_CODE : '',
            bldg: str(row.BUILDING).trim(),
            rm: row.ROOM !== undefined ? row.ROOM : '',
            _fillRate: (max != null && max !== 0 && enrolled != null) ? enrolled / max : null
        };
    }

    function transformCrosslist(row) {
        return {
            faculty: str(row.NAME_LAST_FIRST_MI_ABBR).trim(),
            crn: num(row.CRN),
            div: str(row.DIVISION_CODE).trim(),
            sub: str(row.SUBJECT_CODE).trim(),
            courseNum: str(row.COURSE_NUMBER).trim(),
            title: str(row.SECTION_TITLE).trim(),
            sec: row.SECTION_SEQ !== undefined ? row.SECTION_SEQ : '',
            days: str(row.MEETING_DAYS_ASGN),
            sTime: str(row.BEGIN_TIME_AM_PM_ASGN),
            eTime: str(row.END_TIME_AM_PM_ASGN),
            ses: num(row.SESSION_IND),
            crosslist: row.CROSSLIST_GROUP_CODE !== undefined ? row.CROSSLIST_GROUP_CODE : '',
            bldg: str(row.BUILDING).trim(),
            rm: row.ROOM !== undefined ? row.ROOM : '',
            sDate: parseDate(str(row.START_DATE_ASGN)),
            eDate: parseDate(str(row.END_DATE_ASGN)),
            max: num(row.ENROLL_COUNT_SECTION_MAX),
            enrolled: num(row.ENROLL_COUNT_SECTION),
            xMax: num(row.SSBXLST_MAX_ENRL)
        };
    }

    function compareMixed(a, b) {
        var sa = String(a == null ? '' : a);
        var sb = String(b == null ? '' : b);
        var na = parseInt(sa);
        var nb = parseInt(sb);
        var ha = !isNaN(na);
        var hb = !isNaN(nb);
        if (ha && hb) {
            if (na !== nb) return na - nb;
            return sa.localeCompare(sb);
        }
        if (ha) return -1;
        if (hb) return 1;
        return sa.localeCompare(sb);
    }

    function cmpStr(a, b) { return String(a || '').localeCompare(String(b || '')); }

    function cmpNum(a, b) {
        var x = (a == null) ? Infinity : a;
        var y = (b == null) ? Infinity : b;
        return x - y;
    }

    function sortAllLocations(rows) {
        return rows.slice().sort(function (a, b) {
            return cmpStr(a.div, b.div) || cmpStr(a.sub, b.sub) ||
                compareMixed(a.courseNum, b.courseNum) || compareMixed(a.sec, b.sec) ||
                cmpNum(a.ses, b.ses);
        });
    }

    function sortByFillRate(rows) {
        return rows.slice().sort(function (a, b) {
            var fa = a._fillRate == null ? Infinity : a._fillRate;
            var fb = b._fillRate == null ? Infinity : b._fillRate;
            return fa - fb;
        });
    }

    function sortCrosslisted(rows) {
        return rows.slice().sort(function (a, b) {
            return compareMixed(a.crosslist, b.crosslist) || cmpStr(a.sub, b.sub) ||
                compareMixed(a.courseNum, b.courseNum) || compareMixed(a.sec, b.sec);
        });
    }

    function sortByWaitlist(rows) {
        return rows.slice().sort(function (a, b) {
            return cmpStr(a.div, b.div) || cmpStr(a.dpt, b.dpt) ||
                cmpStr(a.sub + a.courseNum, b.sub + b.courseNum) ||
                compareMixed(a.sec, b.sec);
        });
    }

    function calculateLateStartDate(rows, termType) {
        var counts = {};
        rows.forEach(function (r) {
            if (r.sDate) {
                var k = r.sDate.getTime();
                counts[k] = (counts[k] || 0) + 1;
            }
        });
        var best = null, bestCount = 0;
        for (var k in counts) {
            if (counts[k] > bestCount) {
                bestCount = counts[k];
                best = parseInt(k);
            }
        }
        if (!best) return null;

        var primary = new Date(best);
        var dow = primary.getDay();
        var mondayOffset = dow === 0 ? -6 : 1 - dow;
        var week1 = new Date(primary.getTime());
        week1.setDate(week1.getDate() + mondayOffset);

        var weeksToAdd = (termType === 'spring') ? 9 : 8;
        var cutoff = new Date(week1.getTime());
        cutoff.setDate(cutoff.getDate() + weeksToAdd * 7);
        return cutoff;
    }

    function groupBy(rows, keyFn) {
        var groups = [], map = {};
        rows.forEach(function (r) {
            var k = keyFn(r);
            if (!(k in map)) {
                map[k] = { key: k, rows: [] };
                groups.push(map[k]);
            }
            map[k].rows.push(r);
        });
        return groups;
    }

    function processTerm(enrollmentRows, crosslistRows, termInfo) {
        var enrollment = enrollmentRows.map(transformEnrollment);
        var crosslist = crosslistRows.map(transformCrosslist);

        var allLocations = sortAllLocations(enrollment);
        var byFillRate = sortByFillRate(enrollment);
        var hasLateStart = termInfo.type === 'spring' || termInfo.type === 'fall';
        var waitlisted = enrollment.filter(function (r) { return r.waiting != null && r.waiting >= 1; });

        var lateStartRows = null;
        if (hasLateStart) {
            var cutoff = calculateLateStartDate(enrollment, termInfo.type);
            if (cutoff) {
                var filtered = enrollment.filter(function (r) { return r.sDate && r.sDate >= cutoff; });
                lateStartRows = sortAllLocations(filtered);
            }
        }

        var waitlistData = null;
        if (waitlisted.length > 0) {
            var sorted = sortByWaitlist(waitlisted);
            waitlistData = groupBy(sorted, function (r) { return r.sub + r.courseNum; });
        }

        return {
            termInfo: termInfo,
            allLocations: allLocations,
            palmdale: allLocations.filter(function (r) { return r.bldg === 'PALMDL' || r.bldg === 'PTC'; }),
            crosslisted: groupBy(sortCrosslisted(crosslist), function (r) { return String(r.crosslist); }),
            byFillRate: byFillRate,
            f2f: byFillRate.filter(function (r) { return r.mt !== 'I'; }),
            distanceEd: byFillRate.filter(function (r) { return r.mt === 'I'; }),
            lateStart: lateStartRows,
            byWaitlist: waitlistData
        };
    }

    function matchFiles(files) {
        var terms = {}, errors = [];
        files.forEach(function (f) {
            if (!f.term) {
                errors.push('"' + f.name + '": could not detect term');
                return;
            }
            var key = f.term.code;
            if (!terms[key]) terms[key] = { term: f.term, enrollment: null, crosslist: null };

            if (f.type === 'enrollment') {
                if (terms[key].enrollment) errors.push(f.term.label + ': duplicate enrollment file');
                else terms[key].enrollment = f;
            } else {
                if (terms[key].crosslist) errors.push(f.term.label + ': duplicate crosslist file');
                else terms[key].crosslist = f;
            }
        });

        var matched = {};
        for (var key in terms) {
            var t = terms[key];
            if (!t.enrollment) errors.push(t.term.label + ': missing enrollment file');
            else if (!t.crosslist) errors.push(t.term.label + ': missing crosslist file');
            else matched[key] = t;
        }

        return { matched: matched, incomplete: terms, errors: errors };
    }

    return {
        classifyFile: classifyFile,
        detectTerm: detectTerm,
        matchFiles: matchFiles,
        processTerm: processTerm
    };
})();
