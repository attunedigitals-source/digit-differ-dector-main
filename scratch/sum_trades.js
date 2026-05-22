const fs = require('fs');
const content = fs.readFileSync('C:\\Users\\Lekan\\.gemini\\antigravity\\brain\\0ea77f34-cc53-4832-a96a-8dbfdaf1d9d9\\.system_generated\\steps\\449\\output.txt', 'utf8');
const data = JSON.parse(content);
const trades = JSON.parse(data.result.split('<untrusted-data-195bd681-740f-4b11-8096-d7a7268c98d6>\n')[1].split('\n</untrusted-data-195bd681-740f-4b11-8096-d7a7268c98d6>')[0]);

let sumAll = 0;
trades.forEach(t => {
    sumAll += Number(t.profit_loss) || 0;
});

console.log("Total P/L for today (WAT):", sumAll);
