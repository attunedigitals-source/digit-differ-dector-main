import WebSocket from 'ws';
import fs from 'fs';

const ws = new WebSocket('wss://api.derivws.com/trading/v1/options/ws/public');

ws.on('open', () => {
    ws.send(JSON.stringify({
        active_symbols: "brief"
    }));
});

ws.on('message', (data) => {
    const json = JSON.parse(data.toString());
    if (json.msg_type === 'active_symbols') {
        fs.writeFileSync('scratch/symbols.json', JSON.stringify(json.active_symbols, null, 2));
        console.log("Written to scratch/symbols.json");
        ws.close();
    }
});
