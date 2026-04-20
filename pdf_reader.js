const fs = require('fs');
const pdf = require('./node_modules/pdf-parse/index.js');
let dataBuffer = fs.readFileSync('Claude conversation ecole 2.pdf');
pdf(dataBuffer).then(function(data) {
    fs.writeFileSync('claude_conversation_text.txt', data.text);
    console.log('Parsed text length:', data.text.length);
}).catch(console.error);
