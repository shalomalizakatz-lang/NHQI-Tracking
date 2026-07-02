// Parses a DOH NHQI CSV export (same long-format columns as the seed dataset) into
// the same dataset shape used by the app, so a facility's cut points can be refreshed
// for a new measurement year without a code change.

const MEASURE_MAP = {
  "1": "contract_staff",
  "2.2": "hprd",
  "3": "flu_vax_staff",
  "4": "pressure_ulcer",
  "5": "incontinence",
  "6.2": "pneumo_vax",
  "7.2": "flu_vax_resident",
  "8": "falls",
  "9": "depression",
  "10": "weight_loss",
  "13": "adl",
  "14": "uti",
  "14.1": "turnover",
  "15": "health_inspect",
  "16": "flu_timely",
  "18": "pah",
};

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field); field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function toNum(s) {
  const t = (s || "").trim();
  if (t === "" || t.toUpperCase() === "NA") return null;
  const n = Number(t);
  return isNaN(n) ? null : n;
}

export function parseNhqiCsv(text) {
  const rows = parseCsv(text);
  if (rows.length < 2) throw new Error("CSV appears to be empty");
  const header = rows[0];
  const idx = name => header.indexOf(name);
  const col = {
    year: idx("Measurement Year"),
    facilityName: idx("Facility Name"),
    facilityId: idx("Facility ID"),
    opcert: idx("Facility OPCERT"),
    medicare: idx("Facility Medicare Number"),
    measureId: idx("Measure ID Number"),
    q1: idx("First Quintile"), q2: idx("Second Quintile"), q3: idx("Third Quintile"),
    q4: idx("Fourth Quintile"), q5: idx("Fifth Quintile"),
    numValue: idx("Numeric Value"), charValue: idx("Character Value"),
    quintile: idx("Quintile"), points: idx("Points"),
    city: idx("City"), county: idx("County"), region: idx("Region"), location: idx("Location"),
  };
  const required = ["year", "facilityName", "facilityId", "measureId", "points"];
  for (const key of required) {
    if (col[key] === -1) throw new Error(`CSV is missing expected column for "${key}"`);
  }

  const facilities = {};
  const measureCutpoints = {};
  let year = null;

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length < 2) continue;
    const fid = row[col.facilityId];
    if (!fid) continue;
    year = year || row[col.year];
    const region = row[col.region];

    if (!facilities[fid]) {
      facilities[fid] = {
        id: fid,
        opcert: row[col.opcert] || "",
        medicareNumber: row[col.medicare] || "",
        name: row[col.facilityName],
        currentName: row[col.facilityName],
        city: row[col.city] || "",
        county: row[col.county] || "",
        region: region || "",
        location: row[col.location] || "",
        closed: false,
        jklDeficiency: false,
        actuals: {},
      };
    }
    const fac = facilities[fid];
    const mid = row[col.measureId];
    const key = MEASURE_MAP[mid];
    if (!key) continue;

    const cp = [toNum(row[col.q1]), toNum(row[col.q2]), toNum(row[col.q3]), toNum(row[col.q4]), toNum(row[col.q5])];
    const hasCp = cp.some(v => v !== null);
    const numVal = toNum(row[col.numValue]);
    const charVal = (row[col.charValue] || "").trim();
    let quintile = (row[col.quintile] || "").trim();
    quintile = quintile === "" || quintile.toUpperCase() === "NA" ? null : quintile;

    fac.actuals[key] = {
      value: numVal !== null ? numVal : (key === "flu_timely" ? charVal.toLowerCase() : (charVal || null)),
      quintile,
      points: toNum(row[col.points]),
    };

    if (hasCp) {
      measureCutpoints[key] = measureCutpoints[key] || {};
      measureCutpoints[key][region] = cp;
    }
  }

  const measures = {};
  for (const [key, regionMap] of Object.entries(measureCutpoints)) {
    const unique = new Set(Object.values(regionMap).map(v => JSON.stringify(v)));
    if (unique.size === 1) {
      measures[key] = { cutpoints: { default: JSON.parse([...unique][0]) } };
    } else {
      measures[key] = { cutpoints: regionMap };
    }
  }

  const facilityList = Object.values(facilities).sort((a, b) => a.name.localeCompare(b.name));
  if (facilityList.length === 0) throw new Error("No facility rows found in CSV");

  return {
    year: year || "unknown",
    source: "User-uploaded NY DOH NHQI dataset",
    measures,
    facilities: facilityList,
  };
}
