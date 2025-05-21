// app/api/claimlist/route.ts
import { NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI!;
const client = new MongoClient(uri);

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

    const beneficiaries = await collection.find({ 
      beneAddress,
      inactivityDuration: { $exists: true },
      inactivityUnit: { $exists: true }
    }).project({
      ownerAddress: 1,
      walletAddress: 1,
      allocation: 1,
      inactivityDuration: 1,
      inactivityUnit: 1,
      timestamp_checkin: 1,
      timestamp_created: 1
    }).toArray();

    return NextResponse.json(beneficiaries, { status: 200 });

  } catch (error: any) {
    console.error('Database error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  } finally {
    await client.close();
  }
}

export async function DELETE(request: Request) {
  try {
    const { walletAddress, beneAddress } = await request.json();
    
    if (!walletAddress || !beneAddress) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    await client.connect();
    const db = client.db(process.env.MONGODB_DB);
    const collection = db.collection('beneficiaries');

    // Delete the specific beneficiary entry
    const result = await collection.deleteOne({
      walletAddress,
      beneAddress
    });

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { success: false, error: 'Document not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { success: true, message: 'Beneficiary deleted' },
      { status: 200 }
    );

  } catch (error: any) {
    console.error('Database error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  } finally {
    await client.close();
  }
}