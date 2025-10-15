import { NextResponse } from 'next/server';
import { getNotionProducts } from '@/lib/notion';

export async function GET() {
  try {
    const products = await getNotionProducts();
    return NextResponse.json({ 
      success: true, 
      count: products.length,
      products 
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}