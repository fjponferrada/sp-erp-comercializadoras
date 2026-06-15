const { Pool } = require('pg');

const connectionString = "prisma+postgres://accelerate.prisma-data.net/?api_key=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqd3RfaWQiOjEsInNlY3VyZV9rZXkiOiJza19BVkc5YXh6YmM3cTFoOEplUENrWDEiLCJhcGlfa2V5IjoiMDFLVFNGU1lYMVYxOTRWQUI4TUJUOTFXMUgiLCJ0ZW5hbnRfaWQiOiI2NmVhYzU3OWUxZDlhMWM3NDZmNTdlYzdkMmU4ZjY2MzY1Nzc5NjI1YTE0MDFiNzdhNzdmYmUyY2UwNmJjZmFhIiwiaW50ZXJuYWxfc2VjcmV0IjoiMDNlMmJmYmYtOTNlYi00YjM2LTljMzMtYjIwYmVmY2E0OWY5In0.w63dNH9ZoB_Ncs_qDwDrMkC8Ve2Pi2gtIg--sBWFEpo";
const pool = new Pool({ connectionString });

pool.query("SELECT 1 as val")
  .then(res => console.log(res.rows))
  .catch(console.error)
  .finally(() => pool.end());
