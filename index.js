import makeWASocket, { useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys'
import QRCode from 'qrcode'

async function start() {
    const { state, saveCreds } = await useMultiFileAuthState('./auth')

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        browser: ['Window', 'Chrome', '1.0.0'],
    })

    sock.ev.on('creds.update', saveCreds)

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update

        if (qr) console.log(await QRCode.toString(qr, { type: 'terminal' }))

        if (connection === 'open') console.log('🟢 Conectado a WhatsApp')

        if (connection === 'close') {
            const code = lastDisconnect?.error?.output?.statusCode

            console.log('🔴 Desconectado con código:', code)

            if (code === DisconnectReason.badSession) {
                console.log('❌ Sesión dañada. Borrando y pidiendo nuevo QR')
                await fs.promises.rm('./auth', { recursive: true, force: true })
                return start()
            }

            // Reintentar todo menos invalid session (401)
            if (code !== 401) {
                console.log('🔄 Reintentando conexión...')
                start()
            } else {
                console.log('❌ Sesión expirada. Escanear nuevo QR.')
            }
        }
    })

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return

        const msg = messages[0]

        // Remitente
        const from = {
            name: msg.pushName,
            meta: msg.key
        }

        // Texto legible
        const text = msg.message?.conversation 
                || msg.message?.extendedTextMessage?.text 
                || null

        console.log('📩 Mensaje recibido de: ', from)
        console.log('💬 Texto:', text)
    })

}

start()