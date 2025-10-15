const { getNotionProducts, updateNotionProduct, getNotionPageContent } = require('./notion');
import { getShopifyProducts, createShopifyProduct, updateShopifyProduct } from './shopify';
import { getChangedProducts } from './changeDetection';

async function syncProductNotionToShopify(shop, notionProduct, notionDescription = '') {
  try {
    if (!notionProduct.shopifyId) {
      console.log(`⏭️  Skipping "${notionProduct.title}" - not linked to Shopify yet`);
      return { status: 'skipped', reason: 'not_linked' };
    }

    console.log(`🔄 Syncing "${notionProduct.title}"...`);

    await updateShopifyProduct(shop, notionProduct.shopifyId, {
      title: notionProduct.title,
      price: notionProduct.price,
      inventory: notionProduct.inventory,
      sku: notionProduct.sku,
      status: notionProduct.status,
      description: notionDescription, // Add description
    });

    console.log(`✅ Synced: ${notionProduct.title}`);
    return { status: 'synced', product: notionProduct.title };
  } catch (error) {
    console.error(`❌ Failed to sync: ${notionProduct.title}`, error.message);
    return { status: 'error', product: notionProduct.title, error: error.message };
  }
}

async function syncChangedProducts(shop) {
  try {
    console.log(`🔄 Starting smart sync for: ${shop}`);

    console.log(`📥 Fetching products from Notion...`);
    const notionProducts = await getNotionProducts();

    console.log(`📥 Fetching products from Shopify...`);
    const shopifyProducts = await getShopifyProducts(shop);

    console.log(`🔍 Detecting changes...`);
    const changedProducts = await getChangedProducts(notionProducts, shopifyProducts);

    console.log(`📊 Found ${changedProducts.length} changed products out of ${notionProducts.length} total`);

    const results = {
      total: notionProducts.length,
      changed: changedProducts.length,
      synced: 0,
      skipped: 0,
      errors: [],
    };

    for (const { notionProduct, notionDescription } of changedProducts) {
      const result = await syncProductNotionToShopify(shop, notionProduct, notionDescription);

      if (result.status === 'synced') {
        results.synced++;
      } else if (result.status === 'skipped') {
        results.skipped++;
      } else if (result.status === 'error') {
        results.errors.push({
          product: result.product,
          error: result.error,
        });
      }
    }

    console.log(`🎉 Smart sync complete! ${results.synced} synced, ${results.skipped} skipped, ${results.errors.length} errors`);

    return results;
  } catch (error) {
    console.error('❌ Sync error:', error);
    throw error;
  }
}

async function syncAllNotionToShopify(shop) {
  try {
    console.log(`🔄 Starting full Notion → Shopify sync for: ${shop}`);

    const notionProducts = await getNotionProducts();

    const results = {
      total: notionProducts.length,
      synced: 0,
      skipped: 0,
      errors: [],
    };

    for (const product of notionProducts) {
      const result = await syncProductNotionToShopify(shop, product);

      if (result.status === 'synced') {
        results.synced++;
      } else if (result.status === 'skipped') {
        results.skipped++;
      } else if (result.status === 'error') {
        results.errors.push({
          product: result.product,
          error: result.error,
        });
      }
    }

    console.log(`🎉 Full sync complete! ${results.synced} synced, ${results.skipped} skipped, ${results.errors.length} errors`);

    return results;
  } catch (error) {
    console.error('❌ Sync error:', error);
    throw error;
  }
}

async function syncNewProductsToShopify(shop) {
  try {
    console.log(`🆕 Starting new products sync for: ${shop}`);

    const notionProducts = await getNotionProducts();

    const newProducts = notionProducts.filter(product => !product.shopifyId);

    console.log(`📊 Found ${newProducts.length} new products to create in Shopify`);

    const results = {
      total: newProducts.length,
      created: 0,
      errors: [],
    };

    for (const product of newProducts) {
      try {
        console.log(`🆕 Creating new product: ${product.title}`);

        const description = await getNotionPageContent(product.notionId);

        const shopifyProduct = await createShopifyProduct(shop, {
          ...product,
          description,
        });

        await updateNotionProduct(product.notionId, {
          shopifyId: shopifyProduct.id.toString(),
        });

        results.created++;
        console.log(`✅ Created and linked: ${product.title}`);
      } catch (error) {
        console.error(`❌ Failed to create: ${product.title}`, error.message);
        results.errors.push({
          product: product.title,
          error: error.message,
        });
      }
    }

    console.log(`🎉 New products sync complete! ${results.created} created, ${results.errors.length} errors`);

    return results;
  } catch (error) {
    console.error('❌ Sync error:', error);
    throw error;
  }
}

export {
  syncProductNotionToShopify,
  syncChangedProducts,
  syncAllNotionToShopify,
  syncNewProductsToShopify,
};