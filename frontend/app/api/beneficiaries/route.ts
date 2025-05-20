import { NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI!;
const client = new MongoClient(uri);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { ownerAddress, beneAddress, allocation, walletAddress } = body;

    await client.connect();
    const db = client.db(process.env.MONGODB_DB);
    const collection = db.collection('beneficiaries');

    const result = await collection.insertOne({
      ownerAddress,
      beneAddress,
      allocation,
      walletAddress,
      timestamp_checkin: new Date(),
      timestamp_created: new Date(),
    });

    return NextResponse.json({
      success: true,
      insertedId: result.insertedId
    }, { status: 200 });

  } catch (error: any) {
    console.error('Database error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Internal server error',
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  } finally {
    await client.close();
  }
}
// app/api/beneficiaries/route.ts
export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const { ownerAddress, beneAddress } = body;

    if (!ownerAddress || !beneAddress) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    await client.connect();
    const db = client.db(process.env.MONGODB_DB);
    const collection = db.collection('beneficiaries');

    const result = await collection.deleteMany({
      ownerAddress,
      beneAddress
    });

    return NextResponse.json({
      success: true,
      deletedCount: result.deletedCount
    }, { status: 200 });

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