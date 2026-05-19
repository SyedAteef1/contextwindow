import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Registration from '@/models/Registration';

export async function POST(req: Request) {
  try {
    await dbConnect();
    const body = await req.json();
    const registration = await Registration.create(body);
    return NextResponse.json({ success: true, data: registration }, { status: 201 });
  } catch (error: any) {
    console.error('Registration error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
