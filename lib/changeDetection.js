const { getNotionPageContent } = require('./notion');

function hasProductChanged(notionProduct, shopifyProduct, notionDescription) {
  if (!shopifyProduct) {
    return true;
  }

  const variant = shopifyProduct.variants[0];
  
  const titleChanged = notionProduct.title !== shopifyProduct.title;
  const priceChanged = parseFloat(notionProduct.price) !== parseFloat(variant.price);
  const inventoryChanged = notionProduct.inventory !== variant.inventory_quantity;
  const skuChanged = notionProduct.sku !== (variant.sku || '');
  const statusChanged = (notionProduct.status === 'Active' ? 'active' : 'draft') !== shopifyProduct.status;
  const categoryChanged = notionProduct.category !== (shopifyProduct.product_type || '');
  const vendorChanged = notionProduct.vendor !== (shopifyProduct.vendor || '');
  const tagsChanged = notionProduct.tags !== (shopifyProduct.tags || '');
  
  const shopifyDescription = stripHtml(shopifyProduct.body_html || '');
  const descriptionChanged = notionDescription !== shopifyDescription;

  if (titleChanged || priceChanged || inventoryChanged || skuChanged || statusChanged || categoryChanged || vendorChanged || tagsChanged || descriptionChanged) {
    return true;
  }

  return false;
}

async function getChangedProducts(notionProducts, shopifyProducts) {
  const shopifyMap = new Map();
  shopifyProducts.forEach(p => {
    shopifyMap.set(p.id.toString(), p);
  });

  const changed = [];

  for (const notionProduct of notionProducts) {
    if (!notionProduct.shopifyId) {
      continue;
    }

    const shopifyProduct = shopifyMap.get(notionProduct.shopifyId);
    
    // Get the description from Notion page content
    let notionDescription = '';
    try {
      const pageHtml = await getNotionPageContent(notionProduct.notionId);
      notionDescription = stripHtml(pageHtml);
    } catch (error) {
      console.warn(`Could not fetch description for ${notionProduct.title}`);
    }

    if (hasProductChanged(notionProduct, shopifyProduct, notionDescription)) {
      changed.push({
        notionProduct,
        shopifyProduct,
        notionDescription,
        changeType: shopifyProduct ? 'updated' : 'new',
      });
    }
  }

  return changed;
}

function stripHtml(html) {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
}

export {
  hasProductChanged,
  getChangedProducts,
};