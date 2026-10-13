// Parses a DOH NHQI CSV export (same long-format columns as the seed dataset) into
// the same dataset shape used by the app, so a facility's cut points can be refreshed
// for a new measurement year without a code change.

import { MEASURE_BY_ID } from "./scoring.js";

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

const META_MAP = {
  "19": "facility_score",
  "20": "facility_quintile_rank",
  "21": "jkl_deficiency",
  "22": "closure",
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
  const COLUMN_NAMES = {
    year: "Measurement Year", facilityName: "Facility Name", facilityId: "Facility ID",
    opcert: "Facility OPCERT", medicare: "Facility Medicare Number", measureId: "Measure ID Number",
    q1: "First Quintile", q2: "Second Quintile", q3: "Third Quintile", q4: "Fourth Quintile", q5: "Fifth Quintile",
    numValue: "Numeric Value", charValue: "Character Value", quintile: "Quintile", points: "Points",
    city: "City", county: "County", region: "Region", location: "Location",
  };
  const col = Object.fromEntries(Object.entries(COLUMN_NAMES).map(([key, name]) => [key, idx(name)]));
  const required = ["year", "facilityName", "facilityId", "measureId", "points"];
  const missingColumns = required.filter(key => col[key] === -1);
  if (missingColumns.length > 0) {
    throw new Error(`CSV is missing expected column${missingColumns.length > 1 ? "s" : ""}: ${missingColumns.map(k => `"${COLUMN_NAMES[k]}"`).join(", ")}`);
  }

  const facilities = {};
  const measureCutpoints = {};
  let year = null;
  const yearsSeen = new Set();
  const unmappedMeasureIds = new Map(); // measure id -> row count, seen in the CSV but not in MEASURE_MAP/META_MAP
  const recognizedMeasureIds = new Set(); // measure keys (e.g. "weight_loss") seen with at least one mapped row, regardless of whether that measure also had cutpoint columns
  const duplicateMeasureRows = new Set(); // "facilityId/measureId" seen more than once (later row silently wins)
  const invalidNumericValues = []; // {facilityId, measureId, column, raw} — present but not parseable as a number or "NA"
  const seenFacilityMeasure = new Set();
  let dataRowCount = 0;

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length < 2) continue;
    const fid = row[col.facilityId];
    if (!fid) continue;
    dataRowCount++;
    const rowYear = row[col.year];
    if (rowYear) yearsSeen.add(rowYear);
    year = year || rowYear;
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

    const metaKey = META_MAP[mid];
    if (metaKey) {
      if (metaKey === "facility_score") fac.totalScore = toNum(row[col.points]);
      else if (metaKey === "facility_quintile_rank") fac.overallQuintile = toNum(row[col.numValue]);
      else if (metaKey === "jkl_deficiency") fac.jklDeficiency = (row[col.charValue] || "").trim() === "Yes";
      else if (metaKey === "closure") fac.closed = (row[col.charValue] || "").trim() === "Yes";
      continue;
    }

    const key = MEASURE_MAP[mid];
    if (!key) {
      unmappedMeasureIds.set(mid, (unmappedMeasureIds.get(mid) || 0) + 1);
      continue;
    }
    recognizedMeasureIds.add(key);

    const famKey = `${fid}/${mid}`;
    if (seenFacilityMeasure.has(famKey)) duplicateMeasureRows.add(famKey);
    seenFacilityMeasure.add(famKey);

    const cpRaw = [toNum(row[col.q1]), toNum(row[col.q2]), toNum(row[col.q3]), toNum(row[col.q4]), toNum(row[col.q5])];
    const hasCp = cpRaw.some(v => v !== null);
    // DOH's 5 published quintile columns hold only 4 real boundaries — the
    // 5th slot is a non-boundary reference value (empirically always equal
    // to the sample's own ceiling, verified against 5,070 real 2023 rows
    // with 0 mismatches against DOH's own per-row Quintile/Points values).
    // Which end holds the real 4 depends on direction: for a higherIsBetter
    // measure the extra value sits in "First Quintile" (drop index 0); for
    // lowerIsBetter it sits in "Fifth Quintile" (drop index 4) — this is
    // what getQuintile() in scoring.js already assumes for both directions.
    const measureDef = MEASURE_BY_ID[key];
    const cp = measureDef?.higherIsBetter ? cpRaw.slice(1) : cpRaw.slice(0, 4);
    const rawNumValue = col.numValue !== -1 ? row[col.numValue] : "";
    const numVal = toNum(rawNumValue);
    if (numVal === null && rawNumValue && rawNumValue.trim() !== "" && rawNumValue.trim().toUpperCase() !== "NA" && rawNumValue.trim().toUpperCase() !== "SS") {
      invalidNumericValues.push({ facilityId: fid, measureId: key, column: "Numeric Value", raw: rawNumValue });
    }
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

  const mappedMeasureCount = recognizedMeasureIds.size;
  const warnings = [];
  if (yearsSeen.size > 1) {
    warnings.push(`Rows span ${yearsSeen.size} different Measurement Year values (${[...yearsSeen].join(", ")}) — using "${year}" (the first seen); mixed-year rows won't be separated out.`);
  }
  if (unmappedMeasureIds.size > 0) {
    const detail = [...unmappedMeasureIds.entries()].map(([id, n]) => `${id} (${n} row${n === 1 ? "" : "s"})`).join(", ");
    warnings.push(`${unmappedMeasureIds.size} measure ID${unmappedMeasureIds.size === 1 ? "" : "s"} in the CSV aren't recognized and were skipped entirely: ${detail}.`);
  }
  if (duplicateMeasureRows.size > 0) {
    warnings.push(`${duplicateMeasureRows.size} facility/measure pair${duplicateMeasureRows.size === 1 ? "" : "s"} appeared more than once — the last row for each won, earlier ones were silently discarded.`);
  }
  if (invalidNumericValues.length > 0) {
    warnings.push(`${invalidNumericValues.length} row${invalidNumericValues.length === 1 ? "" : "s"} had a Numeric Value that wasn't a number, "NA", or "SS" — stored as the raw text instead of a usable number.`);
  }

  return {
    year: year || "unknown",
    source: "User-uploaded NY DOH NHQI dataset",
    measures,
    facilities: facilityList,
    validation: {
      dataRowCount,
      facilityCount: facilityList.length,
      measuresRecognized: mappedMeasureCount,
      measuresTotalDefined: Object.keys(MEASURE_BY_ID).length,
      warnings,
      invalidNumericValues,
    },
  };
}

