const fs = require('fs');
const http = require('http');

http.get('http://localhost:8081/index.bundle?platform=android&dev=true', (res) => {
  const file = fs.createWriteStream('bundle.js');
  res.pipe(file);
  file.on('finish', () => {
    file.close();
    console.log('Download completed');
  });
}).on('error', (err) => {
  console.log('Error: ', err.message);
});
