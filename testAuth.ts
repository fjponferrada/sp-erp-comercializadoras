async function main() {
  const res = await fetch('http://localhost:3000/api/auth/callback/credentials', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      email: 'fjponferrada@sp-energia.com',
      password: 'SpEnergia2026!',
      redirect: 'false'
    })
  });
  console.log('Status:', res.status);
  const text = await res.text();
  console.log('Response:', text.substring(0, 500));
}

main().catch(console.error);
