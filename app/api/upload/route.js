import { NextResponse } from "next/server";
import Papa from "papaparse";
import clientPromise from "@/lib/mongodb";

export const runtime = "nodejs";

const normKey = (k) => String(k).toLowerCase().replace(/[^a-z0-9]/g, "");

function findBookingKey(row) {
  for (const k of Object.keys(row || {})) {
    const nk = normKey(k);
    if (nk === "bookingid" || nk === "bookingref") {
      if (row[k] !== undefined && String(row[k]).trim() !== "") {
        return k;
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
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
    });
    if (!data.length) {
      return NextResponse.json({ error: "CSV has no rows" }, { status: 400 });
    }

    const uploadedAt = new Date();
    const bookingKey = findBookingKey(data[0] || {});

    const ops = data.map((row) => {
      const doc = {
        ...row,
        _uploadedAt: uploadedAt,
        _fileName: file.name,
      };

      if (bookingKey && row[bookingKey] !== undefined && String(row[bookingKey]).trim() !== "") {
        return {
          updateOne: {
            filter: { [bookingKey]: row[bookingKey] },
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
    });

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
