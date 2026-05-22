import WebSocket from 'ws';

const ws = new WebSocket('wss://ws.derivws.com/websockets/v3?app_id=1089');

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
