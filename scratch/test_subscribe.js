import WebSocket from 'ws';

const ws = new WebSocket('wss://api.derivws.com/trading/v1/options/ws/public');

ws.on('open', () => {
    ws.send(JSON.stringify({
        ticks: "1HZ15V",
        subscribe: 1
    }));
});

ws.on('message', (data) => {
    const json = JSON.parse(data.toString());
    console.log(json);
    ws.close();
});
