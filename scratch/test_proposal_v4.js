import WebSocket from 'ws';

const ws = new WebSocket('wss://api.derivws.com/trading/v1/options/ws/public');

ws.on('open', () => {
    ws.send(JSON.stringify({
        proposal: 1,
        amount: 10,
        basis: "stake",
        contract_type: "DIGITDIFF",
        currency: "USD",
        duration: 1,
        duration_unit: "t",
        underlying_symbol: "1HZ15V",
        barrier: "5"
    }));
});

ws.on('message', (data) => {
    const json = JSON.parse(data.toString());
    console.log(JSON.stringify(json, null, 2));
    ws.close();
});
