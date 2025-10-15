import { NextResponse } from 'next/server';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const shop = searchParams.get('shop');

  if (!shop) {
    return NextResponse.json(
      { error: 'Missing shop parameter' },
      { status: 400 }
    );
  }

  // Validate shop domain format (must be *.myshopify.com)
  const shopRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/;
  if (!shopRegex.test(shop)) {
    return NextResponse.json(
      { error: 'Invalid shop domain. Must be in format: yourstore.myshopify.com' },
      { status: 400 }
    );
  }

  const apiKey = process.env.SHOPIFY_API_KEY;
  const scopes = process.env.SHOPIFY_SCOPES;
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/shopify/callback`;

  const installUrl = `https://${shop}/admin/oauth/authorize?client_id=${apiKey}&scope=${scopes}&redirect_uri=${redirectUri}`;

  console.log(`🔗 Redirecting to Shopify OAuth for shop: ${shop}`);

  return NextResponse.redirect(installUrl);
}