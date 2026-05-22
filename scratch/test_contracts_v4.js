import WebSocket from 'ws';

const ws = new WebSocket('wss://api.derivws.com/trading/v1/options/ws/public');

ws.on('open', () => {
    ws.send(JSON.stringify({
        contracts_for: "1HZ15V"
    }));
});

ws.on('message', (data) => {
    const json = JSON.parse(data.toString());
    console.log(JSON.stringify(json, null, 2));
    ws.close();
});
