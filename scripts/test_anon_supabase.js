const url = (process.env.SUPABASE_URL || "https://kbrwjxonrllfysjorzvz.supabase.co") + "/rest/v1";
const anonKey = process.env.SUPABASE_ANON_KEY || "";

async function test(table) {
  try {
    const res = await fetch(`${url}/${table}?select=*`, {
      headers: {
        "apikey": anonKey,
        "Authorization": `Bearer ${anonKey}`,
      },
    });
    const status = res.status;
    const data = await res.json().catch(() => null);
    console.log(`Endpoint: /rest/v1/${table}`);
    console.log(`HTTP Status: ${status}`);
    console.log(`Response:`, JSON.stringify(data, null, 2));
    console.log("------------------------------------------");
  } catch (e) {
    console.error(`Error querying ${table}:`, e.message);
  }
}

async function main() {
  console.log("Testing Supabase REST endpoint with anon key:\n");
  await test("reports");
  await test("users");
  await test("work_orders");
}

main();
