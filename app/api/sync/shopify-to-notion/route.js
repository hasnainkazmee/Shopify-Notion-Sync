import { NextResponse } from 'next/server';
import { getShopifyProducts } from '@/lib/shopify';
const { createNotionProduct } = require('@/lib/notion');


export async function POST(request) {
  try {
    const { shop } = await request.json();

    if (!shop) {
      return NextResponse.json(
        { error: 'Missing shop parameter' },
        { status: 400 }
      );
    }

    console.log(`🔄 Starting Shopify → Notion sync for: ${shop}`);

    const shopifyProducts = await getShopifyProducts(shop);

    const results = {
      total: shopifyProducts.length,
      created: 0,
      errors: [],
    };

for (const shopifyProduct of shopifyProducts) {
  try {
    const variant = shopifyProduct.variants[0];


    const notionProduct = {
      title: shopifyProduct.title,
      price: parseFloat(variant.price),
      inventory: variant.inventory_quantity || 0,
      sku: variant.sku || '',
      imageUrl: shopifyProduct.image?.src || '',
      shopifyId: shopifyProduct.id.toString(),
      status: shopifyProduct.status === 'active' ? 'Active' : 'Draft',
      category: shopifyProduct.product_type || '',
      vendor: shopifyProduct.vendor || '',
      tags: shopifyProduct.tags || '',
      shippingWeight: variant.weight || 0,
    };

    const createdPage = await createNotionProduct(notionProduct);

    if (shopifyProduct.body_html) {
      await addDescriptionToPage(createdPage.id, shopifyProduct.body_html);
    }

    results.created++;
    console.log(`✅ Imported: ${shopifyProduct.title}`);
  } catch (error) {
    console.error(`❌ Failed to import: ${shopifyProduct.title}`, error.message);
    results.errors.push({
      product: shopifyProduct.title,
      error: error.message,
    });
  }
}

    console.log(`🎉 Import complete! Created ${results.created} of ${results.total} products`);

    return NextResponse.json({
      success: true,
      message: `Successfully imported ${results.created} of ${results.total} products`,
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

async function addDescriptionToPage(pageId, htmlDescription) {
  const { Client } = require('@notionhq/client');
  const notion = new Client({ auth: process.env.NOTION_API_KEY });

  try {
    const plainText = stripHtml(htmlDescription);

    await notion.blocks.children.append({
      block_id: pageId,
      children: [
        {
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [
              {
                type: 'text',
                text: {
                  content: plainText,
                },
              },
            ],
          },
        },
      ],
    });

    console.log(`📝 Added description to page: ${pageId}`);
  } catch (error) {
    console.error('❌ Error adding description:', error);
  }
}

function stripHtml(html) {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
}