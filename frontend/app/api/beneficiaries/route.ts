//app/api/beneficiaries/route.ts
import { NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI!;
const client = new MongoClient(uri);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { 
      ownerAddress, 
      beneAddress, 
      allocation, 
      walletAddress,
      inactivityDuration,
      inactivityUnit
    } = body;

    // Validate required fields
    if (!ownerAddress || !beneAddress || !allocation || !walletAddress) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate inactivity period
    if (typeof inactivityDuration !== 'number' || inactivityDuration <= 0 ||
        !['minutes', 'hours', 'days'].includes(inactivityUnit)) {
      return NextResponse.json(
        { success: false, error: 'Invalid inactivity period' },
        { status: 400 }
      );
    }

    await client.connect();
    const db = client.db(process.env.MONGODB_DB);
    const collection = db.collection('beneficiaries');

    const result = await collection.insertOne({
      ownerAddress,
      beneAddress,
      allocation,
      walletAddress,
      inactivityDuration,
      inactivityUnit,
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

export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const { ownerAddress, beneAddress, walletAddress } = body;

    if (!ownerAddress || (!beneAddress && !walletAddress)) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    await client.connect();
    const db = client.db(process.env.MONGODB_DB);
    const collection = db.collection('beneficiaries');

    const query: any = { ownerAddress };
    if (beneAddress) query.beneAddress = beneAddress;
    if (walletAddress) query.walletAddress = walletAddress;

    const result = await collection.deleteMany(query);

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

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const ownerAddress = searchParams.get('ownerAddress');
    
    if (!ownerAddress) {
      return NextResponse.json(
        { success: false, error: 'Missing owner address' },
        { status: 400 }
      );
    }

    await client.connect();
    const db = client.db(process.env.MONGODB_DB);
    const collection = db.collection('beneficiaries');

    const beneficiaries = await collection.find({ ownerAddress }).toArray();

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

export async function PUT(request: Request) {
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

    const result = await collection.updateOne(
      { ownerAddress, beneAddress },
      { $set: { timestamp_checkin: new Date() } }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json(
        { success: false, error: 'Beneficiary not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      updatedCount: result.modifiedCount
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