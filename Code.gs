/* ══════════════════════════════════════════════════════════
   PRIMA — Google Apps Script  v2.0
   Backend untuk Machine Asset Intelligence System
   
   SHEETS YANG DIBUTUHKAN:
   1. LaporanKerusakan   — data laporan dari Requestor
   2. BreakdownMaintenance — data perbaikan dari Teknisi
   3. PreventiveMaintenance — data PM dari Teknisi
   4. Sparepart          — data sparepart
   ══════════════════════════════════════════════════════════ */

const SPREADSHEET_ID = '1CiGCiP52A3olcmtkwnSl7JdmPDCTzwnbJXoQ8wf32HA'; // <<< GANTI DENGAN ID SPREADSHEET ANDA
const ALLOWED_ORIGINS = '*'; // Atau ganti dengan domain spesifik Anda

/* ── Konfigurasi Bot Telegram ── */
const TELEGRAM_BOT_TOKEN = '8936495041:AAFVjbBYZCB5zHulytSJs3mFVDjwqAS3LQw';
const TELEGRAM_CHAT_ID   = '-5259556843'; // Grup: Adha Kaizer and PRIMA

/* ── Header masing-masing sheet ── */
const SHEET_HEADERS = {
  LaporanKerusakan: [
    'Timestamp', 'Nomor WR', 'Nama Mesin',
    'Jenis Kerusakan', 'Deskripsi', 'Sejak Kapan',
    'Nama Pelapor', 'Keterangan', 'Status'
  ],
  BreakdownMaintenance: [
    'Timestamp', 'Nomor WR', 'Nama Mesin',
    'Jenis Kerusakan', 'Durasi Downtime (jam)',
    'Deskripsi Tindakan', 'Sparepart Diganti', 'Nama Teknisi', 'Status', 'Keterangan'
  ],
  PreventiveMaintenance: [
    'Timestamp', 'Nama Mesin',
    'Waktu Mulai', 'Waktu Selesai',
    'Hasil Prosedur', 'Nama Teknisi', 'Status'
  ],
  Sparepart: [
    'Nama Sparepart', 'Nama Mesin',
    'Lifetime (hari)', 'Tanggal Penggantian Terakhir',
    'Tanggal Penggantian Berikutnya', 'Status', 'Sisa Life (%)',
    'Countdown (Hari)', 'Timestamp Dibuat'
  ],
  ProsedurPM: [
    'Timestamp', 'Nama Mesin', 'Tipe Perawatan',
    'Judul Prosedur PM', 'Prosedur PM', 'Urutan PM'
  ],
  JadwalPM: [
    'Timestamp', 'Nama Mesin', 'Tipe Perawatan',
    'Tanggal Jadwal', 'Prosedur PM', 'Status'
  ]
};

/* ══════════════════════════════════════════════════════════
   CORS HELPER
   ══════════════════════════════════════════════════════════ */
function createCorsResponse(data) {
  const output = ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
  return output;
}

/* ══════════════════════════════════════════════════════════
   GET — Baca data dari sheet
   ══════════════════════════════════════════════════════════ */
function doGet(e) {
  try {
    const sheet = e.parameter.sheet;
    const callback = e.parameter.callback; // untuk JSONP support

    // Ping test
    if (e.parameter.test === 'ping') {
      return createResponse({ status: 'ok', message: 'PRIMA GAS connected' }, callback);
    }

    // Serve HTML page jika tidak ada parameter API (akses langsung ke Web App URL)
    if (!sheet && !e.parameter.action) {
      return HtmlService.createHtmlOutputFromFile('index')
        .setTitle('PRIMA — Machine Asset Intelligence')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    }

    if (!sheet) {
      return createResponse({ status: 'error', message: 'Parameter sheet diperlukan' }, callback);
    }

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

    /* ─────────────────────────────────────────────────────────────
       ACTION (GET): updateStatus
       Dipanggil oleh teknisi setelah submit BD (via GET agar tidak
       ada CORS preflight). Update kolom "Status" (kolom I) pada
       sheet LaporanKerusakan dari "Menunggu" → "Selesai" berdasarkan
       Nomor WR.
       ───────────────────────────────────────────────────────────── */
    if (e.parameter.action === 'updateStatus') {
      const nomorWR   = e.parameter.nomorWR;
      const newStatus = e.parameter.newStatus;

      if (!sheet || !nomorWR || !newStatus) {
        return createResponse({ status: 'error', message: 'Parameter sheet, nomorWR, dan newStatus diperlukan' }, callback);
      }

      const targetSheet = ss.getSheetByName(sheet);
      if (!targetSheet) {
        return createResponse({ status: 'error', message: 'Sheet ' + sheet + ' tidak ditemukan' }, callback);
      }

      const data      = targetSheet.getDataRange().getValues();
      const headers   = data[0];
      const colWR     = headers.indexOf('Nomor WR');

      // Update kolom "Status" (untuk semua sheet, termasuk LaporanKerusakan)
      const targetColName = 'Status';
      const colTarget     = headers.indexOf(targetColName);

      if (colWR === -1 || colTarget === -1) {
        return createResponse({
          status: 'error',
          message: 'Kolom Nomor WR atau ' + targetColName + ' tidak ditemukan di sheet ' + sheet
        }, callback);
      }

      let updated = false;
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][colWR]).trim() === String(nomorWR).trim()) {
          targetSheet.getRange(i + 1, colTarget + 1).setValue(newStatus);
          updated = true;
          break;
        }
      }

      return createResponse({
        status:  updated ? 'ok' : 'not_found',
        message: updated
          ? targetColName + ' WR "' + nomorWR + '" diubah menjadi "' + newStatus + '"'
          : 'Nomor WR "' + nomorWR + '" tidak ditemukan di sheet ' + sheet
      }, callback);
    }

    // Tindakan khusus: ambil ringkasan pergantian sparepart dari BreakdownMaintenance
    if (sheet === 'BreakdownMaintenance' && e.parameter.action === 'sparepartHistory') {
      const bdSheet = ss.getSheetByName('BreakdownMaintenance');
      if (!bdSheet || bdSheet.getLastRow() <= 1) {
        return createResponse({ status: 'ok', data: [] }, callback);
      }
      const bdData    = bdSheet.getDataRange().getValues();
      const bdHeaders = bdData[0];
      const colSpPart = bdHeaders.indexOf('Sparepart Diganti');
      const colMesin  = bdHeaders.indexOf('Nama Mesin');
      const colTs     = bdHeaders.indexOf('Timestamp');
      const colWR     = bdHeaders.indexOf('Nomor WR');

      if (colSpPart === -1) {
        return createResponse({ status: 'ok', data: [], message: 'Kolom Sparepart Diganti belum ada di sheet BreakdownMaintenance' }, callback);
      }

      const rows = [];
      for (var i = 1; i < bdData.length; i++) {
        const spVal = String(bdData[i][colSpPart] || '').trim();
        if (!spVal) continue;
        rows.push({
          timestamp:        bdData[i][colTs]    || '',
          nomorWR:          bdData[i][colWR]     || '',
          namaMesin:        bdData[i][colMesin]  || '',
          sparepartDiganti: spVal,
        });
      }
      return createResponse({ status: 'ok', data: rows }, callback);
    }

    ensureSheetExists(ss, sheet);
    const sheetObj = ss.getSheetByName(sheet);
    const lastRow = sheetObj.getLastRow();

    if (lastRow <= 1) {
      return createResponse({ status: 'ok', data: [] }, callback);
    }

    const data = sheetObj.getRange(2, 1, lastRow - 1, sheetObj.getLastColumn()).getValues();
    const headers = sheetObj.getRange(1, 1, 1, sheetObj.getLastColumn()).getValues()[0];

    const rows = data.map(row => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = row[i]; });
      return obj;
    });

    return createResponse({ status: 'ok', data: rows }, callback);

  } catch (err) {
    return createResponse({ status: 'error', message: err.toString() }, null);
  }
}

/* Helper response — support JSON biasa dan JSONP (via callback param) */
function createResponse(data, callback) {
  const json = JSON.stringify(data);
  if (callback) {
    // JSONP: bungkus dengan nama fungsi callback
    return ContentService
      .createTextOutput(callback + '(' + json + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return createCorsResponse(data);
}

/* ══════════════════════════════════════════════════════════
   POST — Tulis / update / hapus data di sheet
   Payload wajib selalu menyertakan field "sheet".
   Field "action" menentukan operasi:
     (kosong)        → append baris baru (row[] wajib)
     "delete"        → hapus baris berdasarkan id sparepart
     "updateStatus"  → ubah kolom Status berdasarkan Nomor WR
   ══════════════════════════════════════════════════════════ */
function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const { sheet, row, action, id, nomorWR, newStatus } = payload;

    if (!sheet) {
      return createCorsResponse({ status: 'error', message: 'Parameter sheet diperlukan' });
    }

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    ensureSheetExists(ss, sheet);
    const sheetObj = ss.getSheetByName(sheet);

    /* ──────────────────────────────────────────────────────
       ACTION: deleteProsedur
       Hapus semua baris di ProsedurPM yang cocok dengan
       Nama Mesin + Tipe Perawatan + Judul Prosedur PM (untuk update/replace).
       ────────────────────────────────────────────────────── */
    if (action === 'deleteProsedur') {
      const { machineName, tipe, judul } = payload;
      if (!machineName || !tipe) {
        return createCorsResponse({ status: 'error', message: 'Parameter machineName dan tipe diperlukan' });
      }

      const data    = sheetObj.getDataRange().getValues();
      const headers = data[0];
      const colMach  = headers.indexOf('Nama Mesin');
      const colTipe  = headers.indexOf('Tipe Perawatan');
      const colJudul = headers.indexOf('Judul Prosedur PM');

      if (colMach === -1 || colTipe === -1 || colJudul === -1) {
        return createCorsResponse({ status: 'error', message: 'Kolom Nama Mesin, Tipe Perawatan, atau Judul Prosedur PM tidak ditemukan' });
      }

      // Kumpulkan index baris yang cocok (dari belakang agar delete tidak geser index)
      const toDelete = [];
      for (let i = 1; i < data.length; i++) {
        const matchMach  = String(data[i][colMach]).trim()  === String(machineName).trim();
        const matchTipe  = String(data[i][colTipe]).trim()  === String(tipe).trim();
        // Jika judul dikirim, cocokkan juga judul; jika tidak dikirim, hanya cocokkan mesin+tipe
        const matchJudul = !judul || String(data[i][colJudul]).trim() === String(judul).trim();
        if (matchMach && matchTipe && matchJudul) {
          toDelete.push(i + 1); // 1-based sheet row
        }
      }
      // Hapus dari baris paling bawah supaya indeks tidak bergeser
      toDelete.reverse().forEach(rowNum => sheetObj.deleteRow(rowNum));

      return createCorsResponse({
        status: 'ok',
        message: `${toDelete.length} baris prosedur "${judul || tipe}" dihapus`
      });
    }

    /* ──────────────────────────────────────────────────────
       ACTION: updateSparepartReplace
       Catat pergantian sparepart dari Breakdown Maintenance:
       - Jika sparepart sudah ada di sheet Sparepart → update
         Tanggal Penggantian Terakhir, Tanggal Berikutnya,
         Status, Sisa Life (%), dan Countdown (Hari).
       - Jika belum ada → tambahkan baris baru otomatis.
       - Data pergantian juga dicatat di sheet BreakdownMaintenance (kolom Sparepart Diganti)
         melalui row yang dikirim terpisah dari frontend.
       ────────────────────────────────────────────────────── */
    if (action === 'updateSparepartReplace') {
      const { sparepartName, machineName: mName, lifetimeDays: ltDays,
              newLastReplace, newNextReplace, nomorWR: wrNum } = payload;

      if (!sparepartName || !mName || !newLastReplace) {
        return createCorsResponse({ status: 'error', message: 'Parameter sparepartName, machineName, dan newLastReplace diperlukan' });
      }

      const spSS     = SpreadsheetApp.openById(SPREADSHEET_ID);
      const spSheet  = spSS.getSheetByName('Sparepart');
      if (!spSheet) {
        return createCorsResponse({ status: 'error', message: 'Sheet Sparepart tidak ditemukan' });
      }

      const spData    = spSheet.getDataRange().getValues();
      const spHeaders = spData[0];

      // Cari kolom yang dibutuhkan
      var idxNamaSp   = spHeaders.indexOf('Nama Sparepart');
      var idxNamaMes  = spHeaders.indexOf('Nama Mesin');
      var idxLifetime = spHeaders.indexOf('Lifetime (hari)');
      var idxLastRep  = spHeaders.indexOf('Tanggal Penggantian Terakhir');
      var idxNextRep  = spHeaders.indexOf('Tanggal Penggantian Berikutnya');
      var idxStatus   = spHeaders.indexOf('Status');
      var idxSisaLife = spHeaders.indexOf('Sisa Life (%)');
      var idxCdown    = spHeaders.indexOf('Countdown (Hari)');

      // Hitung nilai-nilai baru berdasarkan tanggal penggantian hari ini
      var lifetimeDaysInt = parseInt(ltDays) || 365;
      var nowWIBStr = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd');
      var daysPassed = daysBetween(newLastReplace, nowWIBStr);
      // Tepat hari penggantian: daysPassed === 0 → sisa = lifetimeDays
      var sisaHari   = Math.max(0, lifetimeDaysInt - daysPassed);
      var sisaLifePct = Math.min(100, Math.max(0, Math.round((sisaHari / lifetimeDaysInt) * 100)));
      var spStatus    = sisaLifePct <= 30 ? 'Perlu Perhatian' : 'Baik';

      // Hitung Tanggal Penggantian Berikutnya jika tidak dikirim
      var computedNextReplace = newNextReplace;
      if (!computedNextReplace) {
        var parts  = newLastReplace.split('-').map(Number);
        var nxtDt  = new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0);
        nxtDt.setDate(nxtDt.getDate() + lifetimeDaysInt);
        computedNextReplace = Utilities.formatDate(nxtDt, 'Asia/Jakarta', 'yyyy-MM-dd');
      }

      // Cari baris yang cocok (Nama Sparepart + Nama Mesin)
      var foundRow = -1;
      for (var i = 1; i < spData.length; i++) {
        var rowSpName  = String(spData[i][idxNamaSp]  || '').trim().toLowerCase();
        var rowMesName = String(spData[i][idxNamaMes] || '').trim().toLowerCase();
        if (rowSpName  === String(sparepartName).trim().toLowerCase() &&
            rowMesName === String(mName).trim().toLowerCase()) {
          foundRow = i + 1; // 1-based
          break;
        }
      }

      if (foundRow !== -1) {
        // UPDATE baris yang sudah ada
        if (idxLastRep  !== -1) spSheet.getRange(foundRow, idxLastRep  + 1).setValue(newLastReplace);
        if (idxNextRep  !== -1) spSheet.getRange(foundRow, idxNextRep  + 1).setValue(computedNextReplace);
        if (idxStatus   !== -1) spSheet.getRange(foundRow, idxStatus   + 1).setValue(spStatus);
        if (idxSisaLife !== -1) spSheet.getRange(foundRow, idxSisaLife + 1).setValue(sisaLifePct);
        if (idxCdown    !== -1) spSheet.getRange(foundRow, idxCdown    + 1).setValue(sisaHari);

        var timestamp = new Date().toLocaleString('id-ID', {
          day: '2-digit', month: '2-digit', year: 'numeric',
          hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta'
        });

        return createCorsResponse({
          status: 'ok',
          message: 'Sparepart "' + sparepartName + '" di mesin "' + mName + '" berhasil diupdate (WR: ' + (wrNum || '-') + ')',
          action: 'updated',
          row: foundRow
        });
      } else {
        // INSERT baris baru
        var timestamp = new Date().toLocaleString('id-ID', {
          day: '2-digit', month: '2-digit', year: 'numeric',
          hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta'
        });

        var newRow = buildSparepartRow([
          sparepartName,
          mName,
          lifetimeDaysInt,
          newLastReplace,
          computedNextReplace,
          spStatus,
          sisaLifePct
        ]);
        spSheet.appendRow(newRow);
        formatTimestampColumn(spSheet);
        var insertedRowNum = spSheet.getLastRow();
        spSheet.getRange(insertedRowNum, 4).setNumberFormat('dd/MM/yyyy');
        spSheet.getRange(insertedRowNum, 5).setNumberFormat('dd/MM/yyyy');

        return createCorsResponse({
          status: 'ok',
          message: 'Sparepart "' + sparepartName + '" di mesin "' + mName + '" ditambahkan ke sheet (WR: ' + (wrNum || '-') + ')',
          action: 'inserted',
          row: insertedRowNum
        });
      }
    }

    /* ──────────────────────────────────────────────────────
       ACTION: delete
       Hapus baris sparepart berdasarkan id (format "NamaSparepart_NamaMesin")
       atau kecocokan kolom Nama Sparepart saja sebagai fallback.
       ────────────────────────────────────────────────────── */
    if (action === 'delete') {
      if (!id) {
        return createCorsResponse({ status: 'error', message: 'Parameter id diperlukan untuk action delete' });
      }

      const data    = sheetObj.getDataRange().getValues();
      const headers = data[0];
      const colName = headers.indexOf('Nama Sparepart');
      const colMach = headers.indexOf('Nama Mesin');

      if (colName === -1) {
        return createCorsResponse({ status: 'error', message: 'Kolom Nama Sparepart tidak ditemukan di sheet ' + sheet });
      }

      let deletedRow = -1;
      for (let i = 1; i < data.length; i++) {
        const spName  = String(data[i][colName] || '');
        const spMach  = colMach !== -1 ? String(data[i][colMach] || '') : '';
        const rowId   = spName + '_' + spMach;        // cocokkan format id frontend
        if (rowId === id || spName === id) {
          deletedRow = i + 1;                         // +1 karena baris sheet 1-based
          break;
        }
      }

      if (deletedRow === -1) {
        return createCorsResponse({ status: 'not_found', message: 'Sparepart dengan id "' + id + '" tidak ditemukan' });
      }

      sheetObj.deleteRow(deletedRow);
      return createCorsResponse({ status: 'ok', message: 'Sparepart berhasil dihapus dari sheet ' + sheet });
    }

    /* ──────────────────────────────────────────────────────
       ACTION: updateStatus
       Untuk sheet LaporanKerusakan: ubah kolom "Status" (kolom I)
       berdasarkan Nomor WR (misal: "Menunggu" → "Selesai").
       Untuk sheet lain: ubah kolom "Status" juga.
       ────────────────────────────────────────────────────── */
    if (action === 'updateStatus') {
      if (!nomorWR || !newStatus) {
        return createCorsResponse({ status: 'error', message: 'Parameter nomorWR dan newStatus diperlukan' });
      }

      const data    = sheetObj.getDataRange().getValues();
      const headers = data[0];
      const colWR   = headers.indexOf('Nomor WR');

      // Update kolom "Status" (untuk semua sheet, termasuk LaporanKerusakan)
      const targetColName = 'Status';
      const colTarget     = headers.indexOf(targetColName);

      if (colWR === -1 || colTarget === -1) {
        return createCorsResponse({
          status: 'error',
          message: 'Kolom Nomor WR atau ' + targetColName + ' tidak ditemukan di sheet ' + sheet
        });
      }

      let updated = false;
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][colWR]).trim() === String(nomorWR).trim()) {
          sheetObj.getRange(i + 1, colTarget + 1).setValue(newStatus);
          updated = true;
          break;
        }
      }

      return createCorsResponse({
        status:  updated ? 'ok' : 'not_found',
        message: updated
          ? targetColName + ' WR "' + nomorWR + '" diubah menjadi "' + newStatus + '"'
          : 'Nomor WR "' + nomorWR + '" tidak ditemukan di sheet ' + sheet
      });
    }

    /* ──────────────────────────────────────────────────────
       ACTION: updateJadwalStatus
       Ubah kolom Status pada sheet JadwalPM berdasarkan
       Nama Mesin + Tipe Perawatan + Tanggal Jadwal.
       ────────────────────────────────────────────────────── */
    if (action === 'updateJadwalStatus') {
      const { machineName: mName, tipe: tipeVal, tanggal: tanggalVal, newStatus: newSt } = payload;
      if (!mName || !tipeVal || !newSt) {
        return createCorsResponse({ status: 'error', message: 'Parameter machineName, tipe, dan newStatus diperlukan' });
      }

      const data    = sheetObj.getDataRange().getValues();
      const headers = data[0];
      const colMach = headers.indexOf('Nama Mesin');
      const colTipe = headers.indexOf('Tipe Perawatan');
      const colTgl  = headers.indexOf('Tanggal Jadwal');
      const colSt   = headers.indexOf('Status');

      if (colMach === -1 || colTipe === -1 || colSt === -1) {
        return createCorsResponse({ status: 'error', message: 'Kolom yang diperlukan tidak ditemukan di sheet JadwalPM' });
      }

      // Normalize tanggal dari payload ke yyyy-MM-dd
      let normTanggalVal = tanggalVal ? String(tanggalVal).trim() : '';
      if (/^\d{4}-\d{2}-\d{2}T/.test(normTanggalVal)) normTanggalVal = normTanggalVal.split('T')[0];

      // Normalisasi nama mesin & tipe dari payload (trim + lowercase untuk perbandingan)
      const normMName = String(mName).trim().toLowerCase();
      const normTipe  = String(tipeVal).trim().toLowerCase();

      // Normalkan nilai status yang diterima:
      // Teknisi mengirim 'Selesai' atau 'Finish' → simpan sebagai 'Selesai' di sheet
      var finalStatus = newSt;
      if (String(newSt).trim().toLowerCase() === 'finish') finalStatus = 'Selesai';

      let updatedCount = 0;
      let debugRows = [];

      for (let i = 1; i < data.length; i++) {
        // Skip baris yang sudah "Selesai" atau "Finish" agar tidak menimpa data lain
        const currentStatus = String(data[i][colSt] || '').trim().toLowerCase();
        if (currentStatus === 'selesai' || currentStatus === 'finish') continue;

        const rowMach = String(data[i][colMach] || '').trim().toLowerCase();
        const rowTipe = String(data[i][colTipe] || '').trim().toLowerCase();

        // Normalize tanggal dari sheet: bisa berupa Date object, ISO string, teks yyyy-MM-dd, atau dd/MM/yyyy
        let rawTgl = data[i][colTgl] !== undefined ? data[i][colTgl] : '';
        let rowTgl = '';
        if (rawTgl instanceof Date) {
          rowTgl = Utilities.formatDate(rawTgl, 'Asia/Jakarta', 'yyyy-MM-dd');
        } else {
          rowTgl = String(rawTgl || '').trim();
          if (/^\d{4}-\d{2}-\d{2}T/.test(rowTgl)) rowTgl = rowTgl.split('T')[0];
          // dd/MM/yyyy → yyyy-MM-dd
          var dmyMatch = rowTgl.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
          if (dmyMatch) rowTgl = dmyMatch[3] + '-' + dmyMatch[2] + '-' + dmyMatch[1];
        }

        debugRows.push({ i: i+1, rowMach, rowTipe, rowTgl, currentStatus });

        // Cocokkan Nama Mesin + Tipe (wajib), Tanggal (opsional jika tidak dikirim)
        const matchMach = rowMach === normMName;
        const matchTipe = rowTipe === normTipe;
        const matchTgl  = !normTanggalVal || rowTgl === normTanggalVal;

        if (matchMach && matchTipe && matchTgl) {
          sheetObj.getRange(i + 1, colSt + 1).setValue(finalStatus);
          updatedCount++;
          // Hanya update baris pertama yang cocok agar tidak terjadi multi-update
          break;
        }
      }

      Logger.log('updateJadwalStatus debug: payload=' + JSON.stringify({mName, tipeVal, tanggalVal: normTanggalVal, newSt, finalStatus}));
      Logger.log('updateJadwalStatus rows checked: ' + JSON.stringify(debugRows));
      Logger.log('updateJadwalStatus updated: ' + updatedCount);

      return createCorsResponse({
        status:  updatedCount > 0 ? 'ok' : 'not_found',
        message: updatedCount > 0
          ? 'Status JadwalPM "' + tipeVal + ' — ' + mName + '" berhasil diubah menjadi "' + finalStatus + '"'
          : 'Jadwal "' + tipeVal + ' — ' + mName + '" tidak ditemukan atau sudah berstatus Selesai di sheet JadwalPM',
        debug: { normMName, normTipe, normTanggalVal, rowsChecked: debugRows.length }
      });
    }

    /* ──────────────────────────────────────────────────────
       DEFAULT: append baris baru
       ────────────────────────────────────────────────────── */
    if (!row) {
      return createCorsResponse({ status: 'error', message: 'Parameter row diperlukan' });
    }

    let finalRow;
    if (sheet === 'Sparepart') {
      finalRow = buildSparepartRow(row);
    } else {
      finalRow = [...row];
    }

    sheetObj.appendRow(finalRow);
    formatTimestampColumn(sheetObj);

    // Kirim notifikasi Telegram khusus untuk laporan kerusakan baru
    if (sheet === 'LaporanKerusakan') {
      sendTelegramNotification(finalRow);
    }

    if (sheet === 'Sparepart') {
      const newRowNum = sheetObj.getLastRow();
      sheetObj.getRange(newRowNum, 4).setNumberFormat('dd/MM/yyyy');
      sheetObj.getRange(newRowNum, 5).setNumberFormat('dd/MM/yyyy');
    }

    // Untuk JadwalPM: pastikan kolom Tanggal Jadwal (kolom 4) disimpan sebagai teks
    // agar Google Sheets tidak mengkonversi ke Date object yang menyebabkan timezone shift
    if (sheet === 'JadwalPM') {
      const newRowNum = sheetObj.getLastRow();
      const headers = SHEET_HEADERS['JadwalPM'];
      const colTanggal = headers.indexOf('Tanggal Jadwal') + 1; // 1-based
      if (colTanggal > 0) {
        const cellRange = sheetObj.getRange(newRowNum, colTanggal);
        cellRange.setNumberFormat('@'); // Format teks agar tidak dikonversi ke Date
        cellRange.setValue(finalRow[colTanggal - 1]); // Tulis ulang sebagai string
      }
    }

    return createCorsResponse({ status: 'ok', message: 'Data berhasil disimpan ke sheet ' + sheet });

  } catch (err) {
    return createCorsResponse({ status: 'error', message: err.toString() });
  }
}

/* ══════════════════════════════════════════════════════════
   HELPER: Normalisasi tanggal ke string "yyyy-MM-dd" WIB
   Menerima Date object, serial number GAS, atau string.
   ══════════════════════════════════════════════════════════ */
function toDateStringWIB(dateInput) {
  var d;
  if (dateInput instanceof Date) {
    d = dateInput;
  } else if (typeof dateInput === 'number') {
    // Serial date Google Sheets (hari sejak 30 Des 1899)
    d = new Date(1899, 11, 30);
    d.setDate(d.getDate() + dateInput);
  } else if (typeof dateInput === 'string' && dateInput) {
    var dmy = dateInput.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (dmy) {
      d = new Date(+dmy[3], +dmy[2] - 1, +dmy[1], 0, 0, 0, 0);
    } else {
      d = new Date(dateInput);
    }
  } else {
    return null;
  }
  if (isNaN(d.getTime())) return null;
  return Utilities.formatDate(d, 'Asia/Jakarta', 'yyyy-MM-dd');
}

/* ── Hitung selisih hari kalender antar dua string "yyyy-MM-dd" ── */
function daysBetween(fromDateStr, toDateStr) {
  var f = fromDateStr.split('-').map(Number);
  var t = toDateStr.split('-').map(Number);
  var from = new Date(f[0], f[1] - 1, f[2], 0, 0, 0, 0);
  var to   = new Date(t[0], t[1] - 1, t[2], 0, 0, 0, 0);
  return Math.round((to - from) / 86400000);
}

/* ══════════════════════════════════════════════════════════
   HELPER: Build row untuk sheet Sparepart dengan countdown
   ══════════════════════════════════════════════════════════ */
function buildSparepartRow(row) {
  var namaSp       = row[0] || '';
  var namaMesin    = row[1] || '';
  var lifetimeDays = parseInt(row[2]) || 1;
  var lastReplaceRaw = row[3] || '';
  var status       = row[5] || 'Baik';
  var sisaLifePct  = row[6] || 0;

  var nowWIB   = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd');
  var lastWIB  = toDateStringWIB(lastReplaceRaw) || nowWIB;

  // Hitung daysPassed dari tanggal kalender — bebas timezone
  var daysPassed = daysBetween(lastWIB, nowWIB);

  // Overdue hanya saat MELEWATI hari jadwal (strictly >)
  // Tepat di hari-H (daysPassed === lifetimeDays) → belum overdue
  var isOverdue  = daysPassed > lifetimeDays;
  var sisaHari   = isOverdue ? 0 : lifetimeDays - daysPassed;

  // Tanggal penggantian berikutnya
  var parts    = lastWIB.split('-').map(Number);
  var nextDate = new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0);
  nextDate.setDate(nextDate.getDate() + lifetimeDays);
  var nextReplaceStr = isOverdue
    ? 'OVERDUE'
    : Utilities.formatDate(nextDate, 'Asia/Jakarta', 'yyyy-MM-dd');

  var timestamp = new Date().toLocaleString('id-ID', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta'
  });

  return [
    namaSp,          // Nama Sparepart
    namaMesin,       // Nama Mesin
    lifetimeDays,    // Lifetime (hari)
    lastWIB,         // Tanggal Penggantian Terakhir (yyyy-MM-dd)
    nextReplaceStr,  // Tanggal Penggantian Berikutnya
    status,          // Status
    sisaLifePct,     // Sisa Life (%)
    sisaHari,        // Countdown (Hari)
    timestamp,       // Timestamp Dibuat
  ];
}

/* ══════════════════════════════════════════════════════════
   HELPER: Pastikan sheet dan header ada
   ══════════════════════════════════════════════════════════ */
function ensureSheetExists(ss, sheetName) {
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    const headers = SHEET_HEADERS[sheetName];
    if (headers) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      // Style header row
      const headerRange = sheet.getRange(1, 1, 1, headers.length);
      headerRange.setBackground('#1a1d2e');
      headerRange.setFontColor('#ffffff');
      headerRange.setFontWeight('bold');
      headerRange.setFontSize(10);
      sheet.setFrozenRows(1);
    }
  }
  return sheet;
}

/* ══════════════════════════════════════════════════════════
   HELPER: Format kolom timestamp agar terbaca
   ══════════════════════════════════════════════════════════ */
function formatTimestampColumn(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    // Kolom timestamp ada di kolom 1 (index A)
    sheet.getRange(2, 1, lastRow - 1, 1)
      .setNumberFormat('dd/MM/yyyy HH:mm:ss');
  }
}

/* ══════════════════════════════════════════════════════════
   UPDATE STATUS — Ubah status laporan
   ══════════════════════════════════════════════════════════ */
function updateStatus(sheetName, id, newStatus) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return false;

  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === id) {
      // Status column is last column
      const lastCol = sheet.getLastColumn();
      sheet.getRange(i + 1, lastCol).setValue(newStatus);
      return true;
    }
  }
  return false;
}

/* ══════════════════════════════════════════════════════════
   SETUP AWAL — Jalankan sekali untuk inisialisasi semua sheet
   Buka Apps Script Editor → Jalankan fungsi setupSheets()
   ══════════════════════════════════════════════════════════ */
function setupSheets() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  Object.keys(SHEET_HEADERS).forEach(sheetName => {
    ensureSheetExists(ss, sheetName);
  });

  SpreadsheetApp.getUi().alert(
    '✅ Setup Berhasil!\n\nSheet yang dibuat:\n• LaporanKerusakan\n• BreakdownMaintenance\n• PreventiveMaintenance\n• Sparepart\n• ProsedurPM\n• JadwalPM\n\nDeploy sebagai Web App untuk menghubungkan ke website PRIMA.'
  );
}

/* ══════════════════════════════════════════════════════════
   UPDATE COUNTDOWN SPAREPART — Jalankan otomatis tiap hari
   atau manual dari Apps Script Editor
   ══════════════════════════════════════════════════════════ */
function updateSparepartCountdowns() {
  var ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('Sparepart');
  if (!sheet) return;

  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return;

  var data    = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  var colIdx = {};
  headers.forEach(function(h, i) { colIdx[h] = i; });

  // "Hari ini" sebagai string yyyy-MM-dd dalam timezone WIB
  var nowWIB = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd');

  data.forEach(function(row, rowIndex) {
    var lifetimeDays   = parseInt(row[colIdx['Lifetime (hari)']]) || 1;
    var lastReplaceVal = row[colIdx['Tanggal Penggantian Terakhir']];

    var lastWIB = toDateStringWIB(lastReplaceVal);
    if (!lastWIB) return; // skip baris dengan tanggal tidak valid

    // Selisih hari kalender — tidak terpengaruh jam atau timezone
    var daysPassed = daysBetween(lastWIB, nowWIB);

    // Overdue hanya saat MELEWATI hari jadwal (strictly >)
    var isOverdue   = daysPassed > lifetimeDays;
    var sisaHari    = isOverdue ? 0 : lifetimeDays - daysPassed;
    var sisaLifePct = Math.min(100, Math.max(0,
      Math.round(((lifetimeDays - daysPassed) / lifetimeDays) * 100)
    ));

    var parts    = lastWIB.split('-').map(Number);
    var nextDate = new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0);
    nextDate.setDate(nextDate.getDate() + lifetimeDays);
    var nextReplace = isOverdue
      ? 'OVERDUE'
      : Utilities.formatDate(nextDate, 'Asia/Jakarta', 'yyyy-MM-dd');

    var statusStr = isOverdue
      ? 'Kritis'
      : (sisaLifePct <= 30 ? 'Perlu Perhatian' : 'Baik');

    var sheetRow = rowIndex + 2;

    if (colIdx['Tanggal Penggantian Berikutnya'] !== undefined)
      sheet.getRange(sheetRow, colIdx['Tanggal Penggantian Berikutnya'] + 1).setValue(nextReplace);
    if (colIdx['Status'] !== undefined)
      sheet.getRange(sheetRow, colIdx['Status'] + 1).setValue(statusStr);
    if (colIdx['Sisa Life (%)'] !== undefined)
      sheet.getRange(sheetRow, colIdx['Sisa Life (%)'] + 1).setValue(sisaLifePct);
    if (colIdx['Countdown (Hari)'] !== undefined)
      sheet.getRange(sheetRow, colIdx['Countdown (Hari)'] + 1).setValue(sisaHari);

    var rowRange = sheet.getRange(sheetRow, 1, 1, sheet.getLastColumn());
    if (isOverdue)           rowRange.setBackground('#3d1515');
    else if (sisaLifePct <= 30) rowRange.setBackground('#3d2e00');
    else                     rowRange.setBackground(null);
  });

  Logger.log('✅ Countdown sparepart berhasil diupdate: ' + new Date().toLocaleString());
}

/* ══════════════════════════════════════════════════════════
   TRIGGER: Setup trigger harian untuk update countdown
   & trigger onEdit untuk notifikasi
   Jalankan setupTriggers() SEKALI dari Apps Script Editor
   ══════════════════════════════════════════════════════════ */
function setupTriggers() {
  // Hapus trigger lama
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));

  // Trigger saat spreadsheet diedit
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  ScriptApp.newTrigger('onSheetEdit')
    .forSpreadsheet(ss)
    .onEdit()
    .create();

  // Trigger harian pukul 00:00 WIB untuk update countdown sparepart
  ScriptApp.newTrigger('updateSparepartCountdowns')
    .timeBased()
    .atHour(0)
    .everyDays(1)
    .inTimezone('Asia/Jakarta')
    .create();

  // Trigger harian pukul 07:00 WIB untuk notifikasi sparepart habis & jadwal PM hari ini
  ScriptApp.newTrigger('checkSparepartAndJadwalPM')
    .timeBased()
    .atHour(7)
    .everyDays(1)
    .inTimezone('Asia/Jakarta')
    .create();

  Logger.log('✅ Triggers berhasil dibuat:\n• onSheetEdit (on edit)\n• updateSparepartCountdowns (daily 00:00 WIB)\n• checkSparepartAndJadwalPM (daily 07:00 WIB)');
}

function onSheetEdit(e) {
  const sheet = e.source.getActiveSheet();
  const sheetName = sheet.getName();

  // Kirim notifikasi hanya untuk sheet LaporanKerusakan
  if (sheetName === 'LaporanKerusakan') {
    const range = e.range;
    if (range.getRow() > 1 && range.getColumn() === 1) {
      // Baris baru ditambahkan
      const row = sheet.getRange(range.getRow(), 1, 1, sheet.getLastColumn()).getValues()[0];
      // Uncomment dan isi email jika ingin notifikasi:
      // sendNotificationEmail(row);
    }
  }
}

/* Opsional: Kirim email notifikasi */
/*
function sendNotificationEmail(row) {
  const TO_EMAIL = 'supervisor@perusahaan.com'; // <<< Ganti dengan email supervisor
  const subject = `[PRIMA] Laporan Kerusakan Baru: ${row[2]}`;
  const body = `
    Ada laporan kerusakan mesin baru yang masuk:
    
    Nomor WR: ${row[1]}
    Waktu: ${row[0]}
    Mesin: ${row[2]}
    Jenis Kerusakan: ${row[3]}
    Deskripsi: ${row[4]}
    Pelapor: ${row[6]}
    
    Silakan cek dashboard PRIMA untuk tindak lanjut.
  `;
  MailApp.sendEmail(TO_EMAIL, subject, body);
}
*/

/* ══════════════════════════════════════════════════════════
   HELPER: Format berbagai bentuk waktu → "10 Jun 2026, 09:26"
   Menerima: ISO string "2026-06-10T09:26", Date object,
             string "dd/MM/yyyy HH:mm:ss", atau teks biasa.
   ══════════════════════════════════════════════════════════ */
function formatWaktu(raw) {
  if (!raw) return '-';
  var d;
  if (raw instanceof Date) {
    d = raw;
  } else {
    var s = String(raw).trim();
    // Sudah dalam format "dd/MM/yyyy HH:mm:ss" (Timestamp dari GAS)
    var dmyHms = s.match(/^(\d{2})\/(\d{2})\/(\d{4})[,\s]+(\d{2}):(\d{2})/);
    if (dmyHms) {
      d = new Date(+dmyHms[3], +dmyHms[2]-1, +dmyHms[1], +dmyHms[4], +dmyHms[5]);
    } else {
      d = new Date(s); // handles ISO "2026-06-10T09:26" and others
    }
  }
  if (isNaN(d.getTime())) return String(raw); // fallback: kembalikan apa adanya
  return Utilities.formatDate(d, 'Asia/Jakarta', 'dd MMM yyyy, HH:mm');
}

/* ══════════════════════════════════════════════════════════
   NOTIFIKASI TELEGRAM — Laporan Kerusakan Baru
   ══════════════════════════════════════════════════════════ */
function sendTelegramNotification(rowData) {
  try {
    const url = 'https://api.telegram.org/bot' + TELEGRAM_BOT_TOKEN + '/sendMessage';

    // Urutan rowData mengikuti SHEET_HEADERS.LaporanKerusakan (setelah tukar kolom):
    // [Timestamp, Nomor WR, Nama Mesin, Jenis Kerusakan, Deskripsi, Sejak Kapan, Nama Pelapor, Keterangan, Status]
    const message =
      '🔧 *Laporan Kerusakan Baru — PRIMA*\n\n' +
      '🕒 Waktu: ' + formatWaktu(rowData[0]) + '\n' +
      '📋 No. WR: ' + (rowData[1] || '-') + '\n' +
      '🏭 Mesin: ' + (rowData[2] || '-') + '\n' +
      '⚠️ Jenis: ' + (rowData[3] || '-') + '\n' +
      '📝 Deskripsi: ' + (rowData[4] || '-') + '\n' +
      '🕐 Sejak: ' + formatWaktu(rowData[5]) + '\n' +
      '👤 Pelapor: ' + (rowData[6] || '-') + '\n' +
      '🏷 Keterangan: ' + (rowData[7] || '-') + '\n' +
      '📌 Status: ' + (rowData[8] || '-');

    const payload = {
      chat_id: TELEGRAM_CHAT_ID,
      text: message,
      parse_mode: 'Markdown'
    };

    const options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(url, options);
    Logger.log('Telegram response: ' + response.getContentText());
  } catch (err) {
    Logger.log('Gagal mengirim notifikasi Telegram: ' + err.toString());
  }
}

/* Fungsi tes — jalankan manual dari editor untuk memastikan
   token & chat ID sudah benar sebelum dipakai di doPost */
function testTelegramNotification() {
  sendTelegramNotification([
    new Date(), 'WR-TEST-001', 'Mesin Pulper #1',
    'Mekanikal', 'Ini pesan tes dari PRIMA', '2026-06-10',
    'Adha (Tes)', '-', 'Menunggu'  // Keterangan dulu, lalu Status
  ]);
}

/* ══════════════════════════════════════════════════════════
   NOTIFIKASI TELEGRAM — Sparepart Lifetime Habis
   Dipanggil oleh trigger harian checkSparepartAndJadwalPM()
   ══════════════════════════════════════════════════════════ */
function sendTelegramNotificationSparepartHabis(namaSp, namaMesin, countdown, status) {
  try {
    const url = 'https://api.telegram.org/bot' + TELEGRAM_BOT_TOKEN + '/sendMessage';

    const message =
      '🔴 *Peringatan Sparepart — PRIMA*\n\n' +
      '🔩 Sparepart: '   + namaSp    + '\n' +
      '🏭 Mesin: '       + namaMesin + '\n' +
      '⏱️ Countdown: '  + countdown + ' hari\n' +
      '📌 Status: '      + status    + '\n\n' +
      '_Segera lakukan penggantian sparepart._';

    const payload = {
      chat_id: TELEGRAM_CHAT_ID,
      text: message,
      parse_mode: 'Markdown'
    };

    const options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    UrlFetchApp.fetch(url, options);
  } catch (err) {
    Logger.log('Gagal notifikasi sparepart: ' + err.toString());
  }
}

/* ══════════════════════════════════════════════════════════
   NOTIFIKASI TELEGRAM — Jadwal PM Hari Ini
   Dipanggil oleh trigger harian checkSparepartAndJadwalPM()
   ══════════════════════════════════════════════════════════ */
function sendTelegramNotificationJadwalPMHariIni(namaMesin, tipe, tanggal, prosedur) {
  try {
    const url = 'https://api.telegram.org/bot' + TELEGRAM_BOT_TOKEN + '/sendMessage';

    const message =
      '📅 *Jadwal PM Hari Ini — PRIMA*\n\n' +
      '🏭 Mesin: '          + namaMesin + '\n' +
      '🔧 Tipe Perawatan: ' + tipe      + '\n' +
      '📆 Tanggal: '        + tanggal   + '\n' +
      '📋 Prosedur: '       + prosedur  + '\n\n' +
      '_Harap segera laksanakan PM sesuai jadwal._';

    const payload = {
      chat_id: TELEGRAM_CHAT_ID,
      text: message,
      parse_mode: 'Markdown'
    };

    const options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    UrlFetchApp.fetch(url, options);
  } catch (err) {
    Logger.log('Gagal notifikasi jadwal PM: ' + err.toString());
  }
}

/* ══════════════════════════════════════════════════════════
   CEK HARIAN — Sparepart habis & Jadwal PM hari ini
   Dijalankan otomatis tiap pagi oleh trigger harian.
   Daftarkan sekali via setupTriggers().
   ══════════════════════════════════════════════════════════ */
function checkSparepartAndJadwalPM() {
  var ss      = SpreadsheetApp.openById(SPREADSHEET_ID);
  var nowWIB  = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd');

  /* ── 1. Cek Sparepart yang lifetime-nya sudah habis (Countdown = 0 atau OVERDUE) ── */
  var spSheet = ss.getSheetByName('Sparepart');
  if (spSheet && spSheet.getLastRow() > 1) {
    var spData    = spSheet.getDataRange().getValues();
    var spHeaders = spData[0];

    var idxNamaSp   = spHeaders.indexOf('Nama Sparepart');
    var idxNamaMes  = spHeaders.indexOf('Nama Mesin');
    var idxCdown    = spHeaders.indexOf('Countdown (Hari)');
    var idxStatus   = spHeaders.indexOf('Status');
    var idxNextRep  = spHeaders.indexOf('Tanggal Penggantian Berikutnya');

    for (var i = 1; i < spData.length; i++) {
      var namaSp    = String(spData[i][idxNamaSp]  || '').trim();
      var namaMesin = String(spData[i][idxNamaMes] || '').trim();
      var countdown = idxCdown  !== -1 ? spData[i][idxCdown]  : null;
      var status    = idxStatus !== -1 ? String(spData[i][idxStatus] || '').trim() : '';
      var nextRep   = idxNextRep !== -1 ? String(spData[i][idxNextRep] || '').trim() : '';

      // Kirim notifikasi jika: Countdown = 0, atau status Kritis, atau nextRep = OVERDUE
      var countdownNum = parseInt(countdown);
      var isHabis = countdownNum === 0 || nextRep === 'OVERDUE' ||
                    status.toLowerCase() === 'kritis';

      if (namaSp && isHabis) {
        var countdownLabel = nextRep === 'OVERDUE' ? 'OVERDUE' : String(countdownNum);
        sendTelegramNotificationSparepartHabis(namaSp, namaMesin, countdownLabel, status);
      }
    }
  }

  /* ── 2. Cek Jadwal PM yang jatuh tempo hari ini & belum Selesai ── */
  var jadwalSheet = ss.getSheetByName('JadwalPM');
  if (jadwalSheet && jadwalSheet.getLastRow() > 1) {
    var jData    = jadwalSheet.getDataRange().getValues();
    var jHeaders = jData[0];

    var jIdxMesin   = jHeaders.indexOf('Nama Mesin');
    var jIdxTipe    = jHeaders.indexOf('Tipe Perawatan');
    var jIdxTanggal = jHeaders.indexOf('Tanggal Jadwal');
    var jIdxProsedur= jHeaders.indexOf('Prosedur PM');
    var jIdxStatus  = jHeaders.indexOf('Status');

    for (var j = 1; j < jData.length; j++) {
      var jStatus = String(jData[j][jIdxStatus] || '').trim().toLowerCase();
      // Lewati yang sudah selesai
      if (jStatus === 'selesai' || jStatus === 'finish') continue;

      // Normalize tanggal jadwal ke yyyy-MM-dd
      var rawTgl = jData[j][jIdxTanggal];
      var rowTgl = '';
      if (rawTgl instanceof Date) {
        rowTgl = Utilities.formatDate(rawTgl, 'Asia/Jakarta', 'yyyy-MM-dd');
      } else {
        rowTgl = String(rawTgl || '').trim();
        if (/^\d{4}-\d{2}-\d{2}T/.test(rowTgl)) rowTgl = rowTgl.split('T')[0];
        var dmyMatch = rowTgl.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
        if (dmyMatch) rowTgl = dmyMatch[3] + '-' + dmyMatch[2] + '-' + dmyMatch[1];
      }

      if (rowTgl === nowWIB) {
        var jMesin    = String(jData[j][jIdxMesin]    || '-').trim();
        var jTipe     = String(jData[j][jIdxTipe]     || '-').trim();
        var jProsedur = jIdxProsedur !== -1 ? String(jData[j][jIdxProsedur] || '-').trim() : '-';
        sendTelegramNotificationJadwalPMHariIni(jMesin, jTipe, rowTgl, jProsedur);
      }
    }
  }

  Logger.log('✅ checkSparepartAndJadwalPM selesai: ' + nowWIB);
}

/* ══════════════════════════════════════════════════════════
   FUNGSI TES — Jalankan manual dari Apps Script Editor
   ══════════════════════════════════════════════════════════ */
function testNotifikasiLaporan() {
  sendTelegramNotification([
    new Date(), 'WR-TEST-001', 'Mesin Pulper #1',
    'Mekanikal', 'Ini pesan tes dari PRIMA', '2026-06-10',
    'Adha (Tes)', 'Menunggu', '-'
  ]);
}

function testNotifikasiSparepartHabis() {
  sendTelegramNotificationSparepartHabis('Bearing 6205', 'Mesin Pulper #1', 'OVERDUE', 'Kritis');
}

function testNotifikasiJadwalPM() {
  sendTelegramNotificationJadwalPMHariIni(
    'Mesin Conveyor #2', 'PM Bulanan',
    Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd'),
    'Pelumasan, pengecekan belt, ganti oli'
  );
}
