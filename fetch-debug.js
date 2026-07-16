const http = require('http');

http.get('http://localhost:3000/api/debug-ars', (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    console.log(JSON.parse(data));
  });
}).on('error', (err) => console.log('Error: ', err.message));
