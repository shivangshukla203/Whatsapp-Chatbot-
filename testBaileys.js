const { default: makeWASocket, DisconnectReason, useMultiFileAuthState, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');

// Store for messages (in-memory)
const store = {};
const getMessage = (key) => {
    const { id } = key;
    if (store[id]) return store[id].message;
    return null;
};

async function connectWhatsapp() {
    // Set up authentication state
    const { state, saveCreds } = await useMultiFileAuthState('auth');
    const { version } = await fetchLatestBaileysVersion();

    // Create the WhatsApp socket connection
    const sock = makeWASocket({
        printQRInTerminal: true,
        auth: state,
        version: version,
        getMessage,
    });

    // Handle connection updates
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log('Scan this QR code to connect:');
        }

        if (connection === 'open') {
            console.log('WhatsApp bot is connected successfully!');
        }

        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Connection closed, reconnecting...', shouldReconnect);
            if (shouldReconnect) connectWhatsapp();
        }
    });

    // Handle credentials update
    sock.ev.on('creds.update', saveCreds);

    // Handle incoming messages
    sock.ev.on('messages.upsert', async (msg) => {
        const message = msg.messages[0];
        if (!message.key.fromMe && message.message?.conversation) {
            const chatText = message.message.conversation;
            console.log('Received:', chatText);

            // Echo the message back as a reply
            await sock.sendMessage(message.key.remoteJid, { text: `You said: ${chatText}` });

            // Store the message for future reference
            store[message.key.id] = message;
        }
    });
}

// Start the WhatsApp connection
connectWhatsapp();
