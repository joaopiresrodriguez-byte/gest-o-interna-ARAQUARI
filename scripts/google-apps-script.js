/**
 * Google Apps Script - Webhook para Gestão Interna ARAQUARI
 * 
 * INSTRUÇÕES:
 * 1. Cole este código no Apps Script da planilha principal (Extensões → Apps Script)
 * 2. Salve e implante como Web App (Implantar → Nova implantação → App da Web)
 * 3. Garanta acesso para "Qualquer um" (Anyone)
 * 4. Configure a URL gerada no arquivo .env como VITE_GOOGLE_SHEETS_WEBHOOK_URL
 */

function doPost(e) {
    try {
        var payload = JSON.parse(e.postData.contents);
        var action = payload.action || 'sync';

        // 1. AÇÃO: CRIAR NOVA PLANILHA NO DRIVE
        if (action === 'createSpreadsheet') {
            var name = payload.name || 'Nova Planilha B3';
            var folderId = payload.folderId || '1g-Aby4GnKZUNRenTpPiXMhJj38LStWHO';
            
            var newSS = SpreadsheetApp.create(name);
            var file = DriveApp.getFileById(newSS.getId());
            
            var folder = DriveApp.getFolderById(folderId);
            folder.addFile(file);
            DriveApp.getRootFolder().removeFile(file); // remove do root

            return ContentService
                .createTextOutput(JSON.stringify({ 
                    success: true, 
                    spreadsheetId: newSS.getId(),
                    url: newSS.getUrl()
                }))
                .setMimeType(ContentService.MimeType.JSON);
        }

        // 2. AÇÃO: SINCRONIZAR/ATUALIZAR DADOS (PADRÃO)
        var sheetName = payload.sheet;
        var data = payload.data;
        var spreadsheetId = payload.spreadsheetId;
        var keyColumnIndex = payload.keyColumnIndex; // Índice 0-based
        var keyValue = payload.keyValue;
        var headers = payload.headers;

        var ss;
        if (spreadsheetId) {
            ss = SpreadsheetApp.openById(spreadsheetId);
        } else {
            ss = SpreadsheetApp.getActiveSpreadsheet();
        }

        var sheet = ss.getSheetByName(sheetName);
        if (!sheet) {
            sheet = ss.insertSheet(sheetName);
            if (headers && headers.length > 0) {
                sheet.appendRow(headers);
            }
        }

        var updated = false;
        var rowIndex = -1;

        // Se chave única informada, procura linha correspondente para atualizar
        if (keyColumnIndex !== undefined && keyColumnIndex !== null && keyValue) {
            var lastRow = sheet.getLastRow();
            if (lastRow > 1) {
                var range = sheet.getRange(2, keyColumnIndex + 1, lastRow - 1, 1);
                var values = range.getValues();
                for (var i = 0; i < values.length; i++) {
                    if (String(values[i][0]) === String(keyValue)) {
                        rowIndex = i + 2; // +2 devido à linha de cabeçalho e index 1-based
                        break;
                    }
                }
            }
        }

        if (rowIndex > 0) {
            // Atualiza linha existente
            sheet.getRange(rowIndex, 1, 1, data.length).setValues([data]);
            updated = true;
        } else {
            // Adiciona nova linha
            sheet.appendRow(data);
            rowIndex = sheet.getLastRow();
        }

        return ContentService
            .createTextOutput(JSON.stringify({ 
                success: true, 
                sheet: sheetName, 
                row: rowIndex, 
                updated: updated 
            }))
            .setMimeType(ContentService.MimeType.JSON);

    } catch (err) {
        return ContentService
            .createTextOutput(JSON.stringify({ success: false, error: err.toString() }))
            .setMimeType(ContentService.MimeType.JSON);
    }
}

function doGet() {
    return ContentService
        .createTextOutput(JSON.stringify({ status: "ok", message: "Webhook ARAQUARI Ativo" }))
        .setMimeType(ContentService.MimeType.JSON);
}
