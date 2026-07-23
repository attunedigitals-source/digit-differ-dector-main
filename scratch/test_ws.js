import WebSocket from 'ws';

const ws = new WebSocket('wss://api.derivws.com/trading/v1/options/ws/public');

ws.on('open', () => {
    ws.send(JSON.stringify({
        ticks_history: 'R_10',
        adjust_start_time: 1,
        count: 5,
        end: 'latest',
        start: 1,
        style: 'ticks',
        req_id: 1
    }));
    ws.send(JSON.stringify({
        ticks: 'R_10',
        subscribe: 1,
        req_id: 2
    }));
});

ws.on('message', (data) => {
    console.log(data.toString());
    const json = JSON.parse(data.toString());
    if (json.msg_type === 'tick') {
        ws.close();
    }
});
