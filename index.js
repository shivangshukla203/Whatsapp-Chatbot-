import { makeWASocket, DisconnectReason, useMultiFileAuthState, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import Groq from 'groq-sdk';
import dotenv from 'dotenv';
import qrcode from 'qrcode-terminal';

dotenv.config(); // Load environment variables

// Initialize Groq instance
const groq = new Groq({ apiKey: "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" });
// In-memory message store
const messageStore = {};

// Function to query Groq and get a response
const getAnswerFromGroq = async (question) => {
    try {
        const chatCompletion = await groq.chat.completions.create({
            messages: [
                { role: "user", content: question },
            ],
            model: "llama3-8b-8192",
        });
        return chatCompletion.choices[0]?.message?.content || "No response from the model.";
    } catch (error) {
        console.error("Error fetching Groq response:", error);
        return "Sorry, I couldn't process your request.";
    }
};

// Function to set up and connect to WhatsApp
async function connectWhatsapp() {
    try {
        const { state, saveCreds } = await useMultiFileAuthState('auth');
        const { version } = await fetchLatestBaileysVersion();

        // Initialize WhatsApp socket connection
        const sock = makeWASocket({
            printQRInTerminal: false, // We'll render QR using qrcode-terminal
            auth: state,
            version,
            getMessage: (key) => messageStore[key.id]?.message || null,
        });

        // Handle connection updates
        sock.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr) {
                // Render QR code in the terminal
                qrcode.generate(qr, { small: true });
                console.log('Scan the QR code above to connect WhatsApp.');
            }

            if (connection === 'open') {
                console.log('WhatsApp bot connected successfully!');
            }

            if (connection === 'close') {
                const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
                console.log('Connection closed. Reconnecting...', shouldReconnect);
                if (shouldReconnect) connectWhatsapp();
            }
        });

        // Handle credentials update
        sock.ev.on('creds.update', saveCreds);

        // Handle incoming messages
        sock.ev.on('messages.upsert', async (msg) => {
            const message = msg.messages[0];
            if (!message.key.fromMe && message.message?.conversation) {
                const question = message.message.conversation;
                console.log('Received:', question);

                // Get response from Groq
                const answer = await getAnswerFromGroq(question);

                // Send response back to the user
                await sock.sendMessage(message.key.remoteJid, { text: answer });

                // Store the message
                messageStore[message.key.id] = message;
            }
        });

    } catch (error) {
        console.error("Error setting up WhatsApp bot:", error);
    }
}

// Start the bot
connectWhatsapp();
