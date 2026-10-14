import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error("MONGODB_URI is not set");

let clientPromise = global._mongoClientPromise;
if (!clientPromise) {
  clientPromise = new MongoClient(uri).connect();
  global._mongoClientPromise = clientPromise;
}

export default clientPromise;
