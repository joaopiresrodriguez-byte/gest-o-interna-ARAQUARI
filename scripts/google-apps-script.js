/**
 * Google Apps Script - Webhook para Gestão Interna ARAQUARI
 * 
 * INSTRUÇÕES:
 * 1. Crie uma planilha no Google Sheets com 2 abas: "Efetivo" e "Patrimônio"
 * 2. Adicione os cabeçalhos na linha 1 de cada aba (veja implementation_plan.md)
 * 3. No menu da planilha: Extensões → Apps Script
 * 4. Cole este código (substituindo o conteúdo padrão)
 * 5. Salve e implante como Web App (Implantar → Nova implantação → App da Web)
 * 6. Copie a URL gerada e adicione no .env.local como VITE_GOOGLE_SHEETS_WEBHOOK_URL
 */

function doPost(e) {
    try {
        var payload = JSON.parse(e.postData.contents);
        var sheetName = payload.sheet; // "Efetivo" ou "Patrimônio"
        var data = payload.data;       // Array com os valores da linha

        var ss = SpreadsheetApp.getActiveSpreadsheet();
        var sheet = ss.getSheetByName(sheetName);

        if (!sheet) {
            return ContentService
                .createTextOutput(JSON.stringify({ success: false, error: "Aba '" + sheetName + "' não encontrada" }))
                .setMimeType(ContentService.MimeType.JSON);
        }

        // Append the row data
        sheet.appendRow(data);

        return ContentService
            .createTextOutput(JSON.stringify({ success: true, sheet: sheetName, rows: sheet.getLastRow() }))
            .setMimeType(ContentService.MimeType.JSON);

    } catch (err) {
        return ContentService
            .createTextOutput(JSON.stringify({ success: false, error: err.toString() }))
            .setMimeType(ContentService.MimeType.JSON);
    }
}

// Test endpoint (optional, for GET requests)
function doGet() {
    return ContentService
        .createTextOutput(JSON.stringify({ status: "ok", message: "Webhook Gestão Interna ARAQUARI ativo" }))
        .setMimeType(ContentService.MimeType.JSON);
}
