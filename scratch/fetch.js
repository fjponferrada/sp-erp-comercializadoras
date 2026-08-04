fetch('http://127.0.0.1:3000/api/test-excel')
  .then(res => res.json())
  .then(data => {
    console.log(JSON.stringify(data, null, 2));
  })
  .catch(console.error);
