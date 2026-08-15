import { fetchRelevantCurrency, fetchSelectedUser } from "../data/live-data.js";

const dataUrl = process.env.GOOGLE_SHEETS_USER_DATA_URL
  ?? "https://docs.google.com/spreadsheets/d/e/2PACX-1vTOWK-CxODEnX356-osN_6SXoM0xbaIxengfFut5QPE8Kx9d81VKGcWsErHGJkqSaIp4_0nNcdD3-GI/pub?output=csv";
const rateUrl = process.env.FRANKFURTER_RATE_URL
  ?? "https://api.frankfurter.dev/v2/rate/EUR/USD";
const userId = process.env.SELECTED_USER_ID ?? process.argv[2] ?? "MF001";

try {
  const selected = await fetchSelectedUser({ dataUrl, userId });
  const currency = await fetchRelevantCurrency({ user: selected.user, rateUrl });
  console.log(JSON.stringify({ selected, currency }, null, 2));
} catch (error) {
  console.error(`Data verification failed: ${error.message}`);
  process.exitCode = 1;
}
