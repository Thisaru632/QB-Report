import { NextResponse } from "next/server";
import Papa from "papaparse";
import clientPromise from "@/lib/mongodb";

export const runtime = "nodejs";

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
    const docs = data.map((row) => ({
      ...row,
      _uploadedAt: uploadedAt,
      _fileName: file.name,
    }));

    const client = await clientPromise;
    const result = await client.db("fleet").collection("qb_reports").insertMany(docs);
    return NextResponse.json({ inserted: result.insertedCount });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
