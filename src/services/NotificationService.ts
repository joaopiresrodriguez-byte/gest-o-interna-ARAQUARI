
import { ChecklistItem } from './SupabaseService';

const CONTACTS = {
    whatsapp: '554734817549',
    email: '16_22sgt@cbm.sc.gov.br'
};

export const NotificationService = {
    /**
     * Generates a deep link to open WhatsApp Web/App with a message
     */
    openWhatsApp: (text: string) => {
        const encoded = encodeURIComponent(text);
        window.open(`https://wa.me/${CONTACTS.whatsapp}?text=${encoded}`, '_blank');
    },

    /**
     * Generates a mailto link to open default email client
     */
    openEmail: (subject: string, body: string) => {
        const encodedSubject = encodeURIComponent(subject);
        const encodedBody = encodeURIComponent(body);
        window.open(`mailto:${CONTACTS.email}?subject=${encodedSubject}&body=${encodedBody}`, '_blank');
    },

    /**
     * Formats the message for a new product receipt
     */
    sendReceiptNotification: (receipt: { nf: string, obs: string, photoUrl: string, user: string }) => {
        // WhatsApp Message
        const waText = `🚨 *Novo Recebimento Registrado*\n\n` +
            `📝 *NF:* ${receipt.nf}\n` +
            `👤 *Responsável:* ${receipt.user}\n` +
            `💬 *Obs:* ${receipt.obs || 'Sem observações'}\n\n` +
            `📷 *Foto:* ${receipt.photoUrl}`;

        // Email Body
        const emailSubject = `[CBMSC] Novo Recebimento - NF ${receipt.nf}`;
        const emailBody = `Novo recebimento registrado no sistema.\n\n` +
            `Nota Fiscal: ${receipt.nf}\n` +
            `Responsável: ${receipt.user}\n` +
            `Observações: ${receipt.obs || 'N/A'}\n\n` +
            `Acesse a foto aqui: ${receipt.photoUrl}`;

        // Trigger both
        NotificationService.openWhatsApp(waText);
        setTimeout(() => NotificationService.openEmail(emailSubject, emailBody), 1000); // Small delay to prevent browser block
    },

    /**
     * Formats the message for a daily conference
     */
    sendConferenceNotification: (data: {
        responsible: string,
        viatura?: string,
        items: ChecklistItem[],
        statuses: Record<string, { status: 'ok' | 'faltante', obs: string }>
    }) => {
        const date = new Date().toLocaleDateString('pt-BR');
        const time = new Date().toLocaleTimeString('pt-BR');

        const pendingItems = data.items.filter(item => data.statuses[item.id]?.status === 'faltante');

        // Header
        let message = `🚒 *Conferência Diária Finalizada*\n` +
            `📅 ${date} às ${time}\n` +
            `👤 *Resp:* ${data.responsible}\n` +
            `🚔 *Viatura:* ${data.viatura || 'Geral/Todas'}\n\n`;

        // Body
        if (pendingItems.length === 0) {
            message += `✅ *STATUS: TUDO QAP (OK)*\nTodos os itens conferidos e operacionais.`;
        } else {
            message += `⚠️ *PENDÊNCIAS ENCONTRADAS:*\n`;
            pendingItems.forEach(item => {
                const obs = data.statuses[item.id].obs;
                message += `\n🔴 *${item.item_name}*`;
                if (obs) message += `\n   Obs: ${obs}`;
            });
            message += `\n\n✅ *Demais itens conferidos e OK.*`;
        }

        // WhatsApp
        NotificationService.openWhatsApp(message);

        // Email
        const emailSubject = `[CBMSC] Relatório de Conferência - ${date}`;
        const emailBody = message.replace(/\*/g, '').replace(/⚠️/g, '[!]').replace(/✅/g, '[OK]'); // Simple clean up for email

        setTimeout(() => NotificationService.openEmail(emailSubject, emailBody), 1000);
    }
};
