import { parseCsv } from "./csv.js";

const requiredColumns = [
  "User_ID",
  "Goal_Currency",
  "Region_Currency",
  "Last_Activity_Date",
  "Last_Nudge_Date",
];

export async function fetchSelectedUser({ dataUrl, userId }) {
  const response = await fetch(dataUrl);
  if (!response.ok) throw new Error(`Google Sheets request failed: ${response.status}`);

  const rows = parseCsv(await response.text());
  const missingColumns = requiredColumns.filter((column) => !(column in rows[0]));
  if (missingColumns.length > 0) {
    throw new Error(`Google Sheets CSV is missing: ${missingColumns.join(", ")}`);
  }

  const user = rows.find((row) => row.User_ID === userId);
  if (!user) throw new Error(`Synthetic user not found: ${userId}`);

  return {
    source: { type: "google-sheets-csv", url: dataUrl, rowsRetrieved: rows.length, fetchedAt: new Date().toISOString() },
    user,
  };
}

export async function fetchUsers({ dataUrl }) {
  const response = await fetch(dataUrl);
  if (!response.ok) throw new Error(`Google Sheets request failed: ${response.status}`);
  const rows = parseCsv(await response.text());
  const missingColumns = requiredColumns.filter((column) => !(column in rows[0]));
  if (missingColumns.length > 0) {
    throw new Error(`Google Sheets CSV is missing: ${missingColumns.join(", ")}`);
  }
  return { source: { type: "google-sheets-csv", url: dataUrl, rowsRetrieved: rows.length, fetchedAt: new Date().toISOString() }, users: rows };
}

export async function fetchRelevantCurrency({ user, rateUrl }) {
  const goalCurrency = user.Goal_Currency;
  const regionCurrency = user.Region_Currency;

  if (!goalCurrency || goalCurrency === regionCurrency) {
    return { required: false, reason: "Goal currency matches region currency or is missing" };
  }

  const url = goalCurrency === "USD" && regionCurrency === "EUR"
    ? rateUrl
    : `https://api.frankfurter.dev/v2/rate/${goalCurrency}/${regionCurrency}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Frankfurter request failed: ${response.status}`);

  return {
    required: true,
    source: { type: "frankfurter", url, fetchedAt: new Date().toISOString() },
    rate: await response.json(),
  };
}
