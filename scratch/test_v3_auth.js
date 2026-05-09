import WebSocket from 'ws';

const ws = new WebSocket('wss://ws.derivws.com/websockets/v3?app_id=1089');

ws.on('open', () => {
    ws.send(JSON.stringify({
        authorize: "fake_jwt_token_123"
    }));
});

ws.on('message', (data) => {
    console.log(data.toString());
    ws.close();
});
