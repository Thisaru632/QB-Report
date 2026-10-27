import { NextResponse } from "next/server";
import Papa from "papaparse";
import clientPromise from "@/lib/mongodb";

export const runtime = "nodejs";

const normKey = (k) => String(k).toLowerCase().replace(/[^a-z0-9]/g, "");

function findBookingKey(rows) {
  for (const row of rows || []) {
    for (const k of Object.keys(row || {})) {
      const nk = normKey(k);
      if (nk === "bookingid" || nk === "bookingref") {
        return k.trim();
      }
    }
  }
  return null;
}

export async function POST(request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const text = await file.text();
    const { data } = Papa.parse(text, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (h) => (h ? h.trim() : ""),
    });
    if (!data || !data.length) {
      return NextResponse.json({ error: "CSV has no rows" }, { status: 400 });
    }

    const uploadedAt = new Date();
    const bookingKey = findBookingKey(data);

    const ops = data
      .map((row) => {
        // Filter out empty headers, whitespace-only keys, and _id
        const cleanRow = {};
        for (const [key, val] of Object.entries(row || {})) {
          const trimmedKey = (key || "").trim();
          if (!trimmedKey || trimmedKey === "_id") continue;
          cleanRow[trimmedKey] = typeof val === "string" ? val.trim() : val;
        }

        if (Object.keys(cleanRow).length === 0) return null;

        const doc = {
          ...cleanRow,
          _uploadedAt: uploadedAt,
          _fileName: file.name,
        };

        if (bookingKey && cleanRow[bookingKey] !== undefined && String(cleanRow[bookingKey]).trim() !== "") {
          return {
            updateOne: {
              filter: { [bookingKey]: cleanRow[bookingKey] },
              update: { $set: doc },
              upsert: true,
            },
          };
        }

        return {
          insertOne: {
            document: doc,
          },
        };
      })
      .filter(Boolean);

    if (!ops.length) {
      return NextResponse.json({ error: "No valid rows found in CSV" }, { status: 400 });
    }

    const client = await clientPromise;
    const collection = client.db("fleet").collection("qb_reports");
    const result = await collection.bulkWrite(ops);
    const totalProcessed =
      (result.upsertedCount || 0) +
      (result.insertedCount || 0) +
      (result.modifiedCount || 0);

    return NextResponse.json({ inserted: totalProcessed || data.length });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
