import WebSocket from 'ws';

const ws = new WebSocket('wss://ws.derivws.com/websockets/v3?app_id=1089');

ws.on('open', () => {
    ws.send(JSON.stringify({
        active_symbols: "brief",
        product_type: "basic"
    }));
});

ws.on('message', (data) => {
    const json = JSON.parse(data.toString());
    if (json.msg_type === 'active_symbols') {
        const symbols = json.active_symbols.map(s => s.symbol);
        console.log("Synthetics:", symbols.filter(s => s.includes('15') || s.includes('30') || s.includes('90')));
        ws.close();
    } else if (json.error) {
        console.error(json.error);
        ws.close();
    }
});
