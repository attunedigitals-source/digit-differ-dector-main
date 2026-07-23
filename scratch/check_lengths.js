const fs = require('fs');

const srcAuto = fs.readFileSync('src/hooks/useAutoTrader.ts', 'utf8');
const workAuto = fs.readFileSync('working-hooks/useAutoTrader.ts', 'utf8');

const srcDeriv = fs.readFileSync('src/hooks/useDerivWebSocket.ts', 'utf8');
const workDeriv = fs.readFileSync('working-hooks/useDerivWebSocket.ts', 'utf8');

console.log("useAutoTrader diff length:", srcAuto.length, workAuto.length);
console.log("useDerivWebSocket diff length:", srcDeriv.length, workDeriv.length);
