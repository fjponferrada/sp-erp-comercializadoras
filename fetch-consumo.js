fetch('http://localhost:3000/api/fix-consumo', { method: 'POST' })
  .then(res => res.json())
  .then(data => console.log(data));
