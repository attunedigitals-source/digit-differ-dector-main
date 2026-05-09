import WebSocket from 'ws';

const ws = new WebSocket('wss://ws.derivws.com/websockets/v3?app_id=1089');

ws.on('open', () => {
    ws.send(JSON.stringify({
        contracts_for: "1HZ15V"
    }));
});

ws.on('message', (data) => {
    const json = JSON.parse(data.toString());
    if (json.msg_type === 'contracts_for') {
        const contracts = json.contracts_for.available.filter(c => c.contract_category === 'digits' || c.contract_category_display === 'Digits');
        console.log(JSON.stringify(contracts, null, 2));
        ws.close();
    } else if (json.error) {
        console.error(json.error);
        ws.close();
    }
});
