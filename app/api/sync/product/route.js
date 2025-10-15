import { NextResponse } from 'next/server';
import { syncProductNotionToShopify } from '@/lib/sync';

export async function POST(request) {
  try {
    const { shop, notionId, title, price, inventory, sku, status, shopifyId } = await request.json();

    if (!shop || !shopifyId) {
      return NextResponse.json(
        { error: 'Missing shop or shopifyId parameter' },
        { status: 400 }
      );
    }

    console.log(`🔄 Syncing product: ${title}`);

    const product = {
      notionId,
      title,
      price,
      inventory,
      sku,
      status,
      shopifyId,
    };

    const result = await syncProductNotionToShopify(shop, product);

    return NextResponse.json({
      success: result.status !== 'error',
      result,
    });
  } catch (error) {
    console.error('❌ Sync error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}