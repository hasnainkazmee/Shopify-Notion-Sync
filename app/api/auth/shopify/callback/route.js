import { NextResponse } from 'next/server';
import supabase from '@/lib/supabase';
import crypto from 'crypto';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const shop = searchParams.get('shop');
  const hmac = searchParams.get('hmac');

  if (!code || !shop) {
    return NextResponse.json(
      { error: 'Missing required parameters' },
      { status: 400 }
    );
  }

  // Verify HMAC (security check to ensure request came from Shopify)
  const params = new URLSearchParams(searchParams);
  params.delete('hmac');
  const message = params.toString();
  
  const generatedHash = crypto
    .createHmac('sha256', process.env.SHOPIFY_API_SECRET)
    .update(message)
    .digest('hex');

  if (generatedHash !== hmac) {
    console.error('❌ HMAC validation failed');
    return NextResponse.json(
      { error: 'Invalid request signature' },
      { status: 403 }
    );
  }

  console.log(`✅ HMAC validated for shop: ${shop}`);

  // Exchange authorization code for access token
  try {
    console.log(`🔄 Exchanging code for access token: ${shop}`);
    
    const tokenResponse = await fetch(
      `https://${shop}/admin/oauth/access_token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: process.env.SHOPIFY_API_KEY,
          client_secret: process.env.SHOPIFY_API_SECRET,
          code,
        }),
      }
    );

    const { access_token } = await tokenResponse.json();

    if (!access_token) {
      throw new Error('Failed to get access token from Shopify');
    }

    console.log(`✅ Received access token for: ${shop}`);

    // Store token in Supabase
    const { error } = await supabase
      .from('shopify_stores')
      .upsert(
        {
          shop_domain: shop,
          access_token: access_token,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'shop_domain' }
      );

    if (error) {
      console.error('❌ Error storing token in Supabase:', error);
      throw error;
    }

    console.log(`✅ Successfully stored token for: ${shop}`);

    // Redirect to dashboard with success message
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/?shop=${shop}&connected=true`
    );
  } catch (error) {
    console.error('❌ OAuth error:', error.message);
    return NextResponse.json(
      { error: 'Authentication failed', details: error.message },
      { status: 500 }
    );
  }
}