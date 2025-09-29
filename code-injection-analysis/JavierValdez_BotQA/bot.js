const express = require('express');
const puppeteer = require('puppeteer-core');

const app = express();
const port = 3000;

app.use(express.json());

async function submitForm(page, mensajeTexto) {
    // Limpiar el formulario primero
    await page.evaluate(() => {
        const iframe = document.getElementById('message_ifr');
        const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
        iframeDoc.body.innerHTML = '';
    });

    // Input message
    await page.evaluate((mensaje) => {
        const iframe = document.getElementById('message_ifr');
        const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
        iframeDoc.body.innerHTML = mensaje;
    }, mensajeTexto);

    // Click submit and wait for navigation
    await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle0' }),
        page.click('#submit')
    ]);
}

async function ejecutarScript(mensajeTexto) {
    const browser = await puppeteer.launch({ 
        args: ['--no-sandbox'],
        headless: 'new',
        executablePath: '/usr/bin/chromium'
    });

    try {
        const page = await browser.newPage();
        let attempts = 0;
        const maxAttempts = 3;
        let formattedResponse = null;

        while (attempts < maxAttempts && !formattedResponse) {
            try {
                if (attempts === 0) {
                    await page.goto('https://cloakmy.org/', {
                        waitUntil: 'networkidle0',
                        timeout: 30000
                    });
                }

                await page.waitForSelector('#message_ifr');
                await submitForm(page, mensajeTexto);

                // Check for response
                await page.waitForSelector('.sendsecure.box', { timeout: 5000 });
                
                formattedResponse = await page.evaluate(() => {
                    const readLink = document.querySelector('a[href*="/r/"]')?.href;
                    const destroyLink = document.querySelector('a[href*="/d/"]')?.href;
                    const signature = document.querySelector('.tip')?.textContent;

                    if (!readLink || !destroyLink || !signature) {
                        return null;
                    }

                    return { readLink, destroyLink, signature };
                });

            } catch (error) {
                console.log(`Intento ${attempts + 1} fallido, reintentando envío completo...`);
                attempts++;
                if (attempts < maxAttempts) {
                    await page.reload({ waitUntil: 'networkidle0' });
                }
            }
        }

        if (!formattedResponse) {
            throw new Error('No se pudieron obtener los datos después de varios intentos');
        }

        return formattedResponse;

    } finally {
        await browser.close();
    }
}

app.post('/ejecutar', async (req, res) => {
    const { mensajeTexto } = req.body;
    if (!mensajeTexto) {
        return res.status(400).json({ error: 'Se requiere el campo mensajeTexto' });
    }

    try {
        const respuesta = await ejecutarScript(mensajeTexto);
        res.json({ respuesta });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

app.listen(port, () => {
    console.log(`Servidor escuchando en http://localhost:${port}`);
});