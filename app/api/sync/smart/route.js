import { NextResponse } from 'next/server';
import { syncChangedProducts } from '@/lib/sync';

export async function POST(request) {
  try {
    const { shop } = await request.json();

    if (!shop) {
      return NextResponse.json(
        { error: 'Missing shop parameter' },
        { status: 400 }
      );
    }

    console.log(`🔄 Starting smart sync for: ${shop}`);

    const results = await syncChangedProducts(shop);

    return NextResponse.json({
      success: true,
      message: `Found ${results.changed} changed products. Synced ${results.synced}, skipped ${results.skipped}, ${results.errors.length} errors`,
      results,
    });
  } catch (error) {
    console.error('❌ Sync error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}