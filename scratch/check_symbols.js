import WebSocket from 'ws';

const ws = new WebSocket('wss://api.derivws.com/trading/v1/options/ws/public');

ws.on('open', () => {
    ws.send(JSON.stringify({
        active_symbols: "brief"
    }));
});

ws.on('message', (data) => {
    const json = JSON.parse(data.toString());
    if (json.msg_type === 'active_symbols') {
        const symbols = json.active_symbols.map(s => s.underlying_symbol);
        console.log("All matching 15/30/90:", symbols.filter(s => s.includes('15') || s.includes('30') || s.includes('90')));
        ws.close();
    }
});
