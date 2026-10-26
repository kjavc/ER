(function () {
    var dropzone = document.getElementById('dropzone');
    var fileInput = document.getElementById('file-input');
    var fileListEl = document.getElementById('file-list');
    var dropPrompt = document.getElementById('dropzone-prompt');
    var termArea = document.getElementById('term-status-area');
    var errorArea = document.getElementById('error-area');
    var generateBtn = document.getElementById('generate-btn');
    var clearBtn = document.getElementById('clear-btn');
    var progressArea = document.getElementById('progress-area');
    var progressFill = document.getElementById('progress-fill');
    var progressText = document.getElementById('progress-text');
    var downloadsArea = document.getElementById('downloads-area');

    var files = [];

    dropzone.addEventListener('click', function () { fileInput.click(); });
    fileInput.addEventListener('change', function () {
        addFiles(fileInput.files);
        fileInput.value = '';
    });
    dropzone.addEventListener('dragover', function (e) {
        e.preventDefault();
        dropzone.classList.add('drag-over');
    });
    dropzone.addEventListener('dragleave', function () {
        dropzone.classList.remove('drag-over');
    });
    dropzone.addEventListener('drop', function (e) {
        e.preventDefault();
        dropzone.classList.remove('drag-over');
        addFiles(e.dataTransfer.files);
    });
    clearBtn.addEventListener('click', clearAll);
    generateBtn.addEventListener('click', generate);

    function addFiles(fileObjs) {
        var promises = [];
        for (var i = 0; i < fileObjs.length; i++) {
            promises.push(readFile(fileObjs[i]));
        }
        Promise.all(promises).then(function (results) {
            results.forEach(function (r) { if (r) files.push(r); });
            updateUI();
        });
    }

    function readFile(file) {
        return new Promise(function (resolve) {
            var reader = new FileReader();
            reader.onload = function (e) {
                var content = e.target.result;
                var parsed = Papa.parse(content, {
                    header: true,
                    dynamicTyping: true,
                    skipEmptyLines: true,
                    transformHeader: function (h) { return h.trim(); }
                });
                if (!parsed.data || parsed.data.length === 0) {
                    resolve(null);
                    return;
                }
                var type = ERProcessor.classifyFile(parsed.meta.fields);
                if (!type) {
                    resolve({ name: file.name, type: null, term: null, rows: null, error: 'Unrecognized file format' });
                    return;
                }
                var term = ERProcessor.detectTerm(parsed.data);
                resolve({ name: file.name, type: type, term: term, rows: parsed.data, error: null });
            };
            reader.onerror = function () { resolve(null); };
            reader.readAsText(file);
        });
    }

    function updateUI() {
        renderFileList();
        var result = ERProcessor.matchFiles(files.filter(function (f) { return f.type && f.term; }));
        renderTermStatus(result);
        renderErrors(result.errors, files.filter(function (f) { return f.error; }));
        var hasComplete = Object.keys(result.matched).length > 0;
        generateBtn.disabled = !hasComplete;
        clearBtn.classList.toggle('hidden', files.length === 0);
        downloadsArea.classList.add('hidden');
        progressArea.classList.add('hidden');
    }

    function renderFileList() {
        if (files.length === 0) {
            fileListEl.classList.add('hidden');
            dropPrompt.style.display = '';
            return;
        }
        dropPrompt.style.display = 'none';
        fileListEl.classList.remove('hidden');
        while (fileListEl.firstChild) fileListEl.removeChild(fileListEl.firstChild);

        files.forEach(function (f, idx) {
            var item = document.createElement('div');
            item.className = 'file-item';

            var icon = document.createElement('span');
            icon.className = 'file-icon';
            icon.textContent = f.error ? '✗' : '✓';
            if (f.error) icon.style.color = 'var(--error)';

            var name = document.createElement('span');
            name.className = 'file-name';
            name.textContent = f.name;

            item.appendChild(icon);
            item.appendChild(name);

            if (f.type) {
                var badge = document.createElement('span');
                badge.className = 'file-badge';
                badge.textContent = f.type === 'enrollment' ? 'Enrollment' : 'Crosslist';
                item.appendChild(badge);
            }
            if (f.term) {
                var termBadge = document.createElement('span');
                termBadge.className = 'file-badge';
                termBadge.textContent = f.term.label;
                item.appendChild(termBadge);
            }

            var removeBtn = document.createElement('button');
            removeBtn.className = 'file-remove';
            removeBtn.textContent = '×';
            removeBtn.setAttribute('data-idx', String(idx));
            removeBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                files.splice(parseInt(this.getAttribute('data-idx')), 1);
                updateUI();
            });
            item.appendChild(removeBtn);
            fileListEl.appendChild(item);
        });
    }

    function renderTermStatus(result) {
        var allTerms = result.incomplete;
        var keys = Object.keys(allTerms);
        if (keys.length === 0) {
            termArea.classList.add('hidden');
            return;
        }
        termArea.classList.remove('hidden');
        while (termArea.firstChild) termArea.removeChild(termArea.firstChild);

        keys.sort();
        keys.forEach(function (key) {
            var t = allTerms[key];
            var complete = t.enrollment && t.crosslist;
            var div = document.createElement('div');
            div.className = 'term-status ' + (complete ? 'complete' : 'incomplete');

            var icon = document.createElement('span');
            icon.className = 'term-icon';
            icon.textContent = complete ? '✓' : '⚠';

            var label = document.createElement('span');
            label.className = 'term-label';
            label.textContent = t.term.label;

            var detail = document.createElement('span');
            detail.className = 'term-detail';
            if (complete) {
                detail.textContent = 'Ready';
            } else {
                var missing = [];
                if (!t.enrollment) missing.push('enrollment');
                if (!t.crosslist) missing.push('crosslist');
                detail.textContent = 'Missing: ' + missing.join(', ');
            }

            div.appendChild(icon);
            div.appendChild(label);
            div.appendChild(detail);
            termArea.appendChild(div);
        });
    }

    function renderErrors(matchErrors, badFiles) {
        var msgs = [];
        badFiles.forEach(function (f) { msgs.push(f.name + ': ' + f.error); });
        matchErrors.forEach(function (e) { msgs.push(e); });
        var realErrors = msgs.filter(function (m) { return m.indexOf('missing') === -1; });
        if (realErrors.length === 0) {
            errorArea.classList.add('hidden');
            return;
        }
        errorArea.classList.remove('hidden');
        while (errorArea.firstChild) errorArea.removeChild(errorArea.firstChild);
        realErrors.forEach(function (msg) {
            var p = document.createElement('p');
            p.textContent = msg;
            errorArea.appendChild(p);
        });
    }

    function clearAll() {
        files = [];
        updateUI();
    }

    async function generate() {
        var validFiles = files.filter(function (f) { return f.type && f.term; });
        var result = ERProcessor.matchFiles(validFiles);
        var matched = result.matched;
        var keys = Object.keys(matched).sort();
        if (keys.length === 0) return;

        generateBtn.disabled = true;
        progressArea.classList.remove('hidden');
        downloadsArea.classList.add('hidden');
        while (downloadsArea.firstChild) downloadsArea.removeChild(downloadsArea.firstChild);

        var outputs = [];
        var step = 0;
        var totalSteps = keys.length * 2 + 1;

        for (var i = 0; i < keys.length; i++) {
            var key = keys[i];
            var pair = matched[key];
            setProgress(++step, totalSteps, 'Processing ' + pair.term.label + '...');
            await delay(10);

            var data = ERProcessor.processTerm(pair.enrollment.rows, pair.crosslist.rows, pair.term);

            setProgress(++step, totalSteps, 'Generating ' + pair.term.label + ' workbook...');
            await delay(10);

            var wb = ERGenerator.generateWorkbook(data);
            var blob = await ERGenerator.workbookToBlob(wb);
            var filename = ERGenerator.generateFilename(pair.term.code);
            outputs.push({ filename: filename, blob: blob, term: pair.term });
        }

        setProgress(totalSteps, totalSteps, 'Complete');
        await delay(200);
        progressArea.classList.add('hidden');
        showDownloads(outputs);
        generateBtn.disabled = false;
    }

    function setProgress(step, total, text) {
        var pct = Math.round((step / total) * 100);
        progressFill.style.width = pct + '%';
        progressText.textContent = text;
    }

    function delay(ms) {
        return new Promise(function (r) { setTimeout(r, ms); });
    }

    function formatSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    function showDownloads(outputs) {
        downloadsArea.classList.remove('hidden');
        while (downloadsArea.firstChild) downloadsArea.removeChild(downloadsArea.firstChild);

        outputs.forEach(function (o) {
            var url = URL.createObjectURL(o.blob);
            var item = document.createElement('div');
            item.className = 'download-item';

            var icon = document.createElement('span');
            icon.className = 'dl-icon';
            icon.textContent = '⬇';

            var link = document.createElement('a');
            link.href = url;
            link.download = o.filename;
            link.textContent = o.filename;

            var size = document.createElement('span');
            size.className = 'dl-size';
            size.textContent = formatSize(o.blob.size);

            item.appendChild(icon);
            item.appendChild(link);
            item.appendChild(size);
            downloadsArea.appendChild(item);
        });

        if (outputs.length > 1) {
            var zipBtn = document.createElement('a');
            zipBtn.className = 'download-all';
            zipBtn.textContent = 'Download All (.zip)';
            zipBtn.href = '#';
            zipBtn.addEventListener('click', function (e) {
                e.preventDefault();
                buildZip(outputs);
            });
            downloadsArea.appendChild(zipBtn);
        }
    }

    async function buildZip(outputs) {
        var zip = new JSZip();
        outputs.forEach(function (o) {
            zip.file(o.filename, o.blob);
        });
        var content = await zip.generateAsync({ type: 'blob' });
        var url = URL.createObjectURL(content);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'enrollment-reports.zip';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }
})();
