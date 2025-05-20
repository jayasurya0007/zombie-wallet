//app/claimlist/route.ts
import { NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI!;
const client = new MongoClient(uri);

// GET endpoint - Get beneficiaries by beneAddress
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const beneAddress = searchParams.get('beneAddress');
    
    if (!beneAddress) {
      return NextResponse.json(
        { success: false, error: 'Missing beneficiary address' },
        { status: 400 }
      );
    }

    await client.connect();
    const db = client.db(process.env.MONGODB_DB);
    const collection = db.collection('beneficiaries');

    const beneficiaries = await collection.find({ beneAddress }).toArray();

    return NextResponse.json(beneficiaries, { status: 200 });

  } catch (error: any) {
    console.error('Database error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Internal server error'
      },
      { status: 500 }
    );
  } finally {
    await client.close();
  }
}