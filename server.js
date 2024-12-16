const express = require('express');
const Bluetooth = require('node-bluetooth');
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');

const app = express();
const port = 3000;

const device = new Bluetooth.DeviceINQ();

let serialPort = null;

app.use(express.json());

app.get('/discover', (req, res) => {
    device.listPairedDevices((devices) => {
        const pairedDevices = devices.map(d => ({
            name: d.name,
            address: d.address,
        }));
        res.json(pairedDevices);
    });
});

app.post('/connect', (req, res) => {
    const { address } = req.body;

    if (!address) {
        return res.status(400).send('Bluetooth address is required.');
    }

    connectToPrinter(address)
        .then(() => {
            res.send(`Successfully connected to printer at ${address}`);
        })
        .catch((err) => {
            console.error('Failed to connect:', err);
            res.status(500).send('Failed to connect to printer.');
        });
});

app.post('/print', (req, res) => {
    const { data } = req.body;

    if (!data) {
        return res.status(400).send('No print data provided.');
    }

    if (!serialPort) {
        return res.status(400).send('No serial port connected.');
    }

    serialPort.write(data, (err) => {
        if (err) {
            console.error('Error writing to serial port:', err);
            return res.status(500).send('Failed to print data.');
        }

        console.log('Data sent to printer:', data);
        res.send('Data sent to printer.');
    });
});

function connectToPrinter(address) {
    return new Promise((resolve, reject) => {
        const portNumber = 1;

        const connection = new Bluetooth.SerialPortClient();

        connection.connect(address, portNumber, () => {
            console.log(`Connected to printer: ${address}`);

            serialPort = new SerialPort({
                path: connection._socket._fd,
                baudRate: 9600,
            });

            const parser = serialPort.pipe(new ReadlineParser({ delimiter: '\r\n' }));

            parser.on('data', (data) => {
                console.log(`Printer response: ${data}`);
            });

            resolve();
        });

        connection.on('failure', (err) => {
            reject(`Failed to connect to printer: ${err}`);
        });
    });
}

app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Bluetooth Printer</title>
        </head>
        <body>
            <h1>Bluetooth Printer</h1>
            <button onclick="connectPrinter()">Connect Printer</button>
            <p id="status"></p>

            <script>
                async function connectPrinter() {
                    const status = document.getElementById('status');
                    status.textContent = 'Connecting to printer...';

                    try {
                        const address = '66:22:C7:47:AF:10';
                        const response = await fetch('/connect', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ address })
                        });

                        if (response.ok) {
                            status.textContent = 'Successfully connected to printer!';
                        } else {
                            status.textContent = 'Failed to connect to printer.';
                        }
                    } catch (error) {
                        console.error('Error:', error);
                        status.textContent = 'Error connecting to printer.';
                    }
                }
            </script>
        </body>
        </html>
    `);
});

app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
