import { NextResponse } from 'next/server';
import { syncNewProductsToShopify } from '@/lib/sync';

export async function POST(request) {
  try {
    const { shop } = await request.json();

    if (!shop) {
      return NextResponse.json(
        { error: 'Missing shop parameter' },
        { status: 400 }
      );
    }

    console.log(`🆕 Starting new products sync for: ${shop}`);

    const results = await syncNewProductsToShopify(shop);

    return NextResponse.json({
      success: true,
      message: `Created ${results.created} new products in Shopify`,
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