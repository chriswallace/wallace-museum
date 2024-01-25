const fs = require('fs');
const path = process.argv[2];

fs.readFile(path, 'utf8', (err, data) => {
    if (err) {
        console.error(`Error reading file: ${err}`);
        return;
    }
    try {
        JSON.parse(data);
        console.log(`JSON is valid.`);
    } catch (error) {
        console.error(`Invalid JSON: ${error}`);
    }
});