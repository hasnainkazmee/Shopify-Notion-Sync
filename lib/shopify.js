import supabase from './supabase';

async function getShopifyToken(shop) {
  const { data, error } = await supabase
    .from('shopify_stores')
    .select('access_token')
    .eq('shop_domain', shop)
    .single();

  if (error || !data) {
    throw new Error('Shop not connected. Please authenticate first.');
  }

  return data.access_token;
}

async function shopifyRequest(shop, endpoint, method = 'GET', body = null) {
  const token = await getShopifyToken(shop);
  
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': token,
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const url = `https://${shop}/admin/api/2024-01/${endpoint}`;
  console.log(`📡 Shopify API Request: ${method} ${url}`);

  const response = await fetch(url, options);

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Shopify API error: ${error}`);
  }

  return response.json();
}

export async function getShopifyProducts(shop) {
  console.log(`📦 Fetching all products from Shopify: ${shop}`);
  
  let allProducts = [];
  let pageCount = 0;
  let nextPageUrl = null;

  try {
    let url = `https://${shop}/admin/api/2024-01/products.json?limit=250&fields=id,title,status,body_html,product_type,vendor,tags,variants,image`;

    while (url) {
      pageCount++;
      console.log(`📄 Fetching page ${pageCount}...`);

      const token = await getShopifyToken(shop);
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': token,
        },
      });

      if (!response.ok) {
        throw new Error(`Shopify API error: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.products && data.products.length > 0) {
        allProducts = allProducts.concat(data.products);
        console.log(`  ✅ Page ${pageCount}: ${data.products.length} products (total: ${allProducts.length})`);
      }

      const linkHeader = response.headers.get('link');
      nextPageUrl = null;
      
      if (linkHeader) {
        const links = linkHeader.split(',');
        for (const link of links) {
          if (link.includes('rel="next"')) {
            const match = link.match(/<([^>]+)>/);
            if (match) {
              nextPageUrl = match[1];
              break;
            }
          }
        }
      }

      url = nextPageUrl;
    }
  } catch (error) {
    console.error('❌ Error fetching products:', error);
    throw error;
  }

  console.log(`✅ Found ${allProducts.length} total products in Shopify`);
  return allProducts;
}

export async function createShopifyProduct(shop, product) {
  console.log(`📝 Creating product in Shopify: ${product.title}`);
  
  const shopifyProduct = {
    product: {
      title: product.title,
      body_html: product.description || '',
      vendor: product.vendor || 'Notion Sync',
      product_type: product.category || '',
      tags: product.tags || '',
      status: product.status === 'Active' ? 'active' : 'draft',
      variants: [
        {
          price: product.price.toString(),
          sku: product.sku || '',
          inventory_quantity: product.inventory || 0,
          weight: product.shippingWeight || 0,
          inventory_management: 'shopify',
        },
      ],
    },
  };

  if (product.imageUrl) {
    shopifyProduct.product.images = [{ src: product.imageUrl }];
  }

  const data = await shopifyRequest(shop, 'products.json', 'POST', shopifyProduct);
  const createdProduct = data.product;

  console.log(`✅ Created product in Shopify with ID: ${data.product.id}`);
  return createdProduct;
}

export async function updateShopifyProduct(shop, shopifyId, updates) {
  console.log(`📝 Updating Shopify product: ${shopifyId}`);
  
  const shopifyProduct = { product: {} };

  if (updates.title) shopifyProduct.product.title = updates.title;
  if (updates.description) shopifyProduct.product.body_html = updates.description;
  if (updates.category) shopifyProduct.product.product_type = updates.category;
  if (updates.vendor) shopifyProduct.product.vendor = updates.vendor;
  if (updates.tags) shopifyProduct.product.tags = updates.tags;
  if (updates.status) {
    shopifyProduct.product.status = updates.status === 'Active' ? 'active' : 'draft';
  }

  if (updates.price !== undefined || updates.inventory !== undefined || updates.sku !== undefined || updates.shippingWeight !== undefined) {
    const productData = await shopifyRequest(shop, `products/${shopifyId}.json`);
    const variantId = productData.product.variants[0].id;

    const variantUpdates = { variant: {} };
    if (updates.price !== undefined) variantUpdates.variant.price = updates.price.toString();
    if (updates.sku !== undefined) variantUpdates.variant.sku = updates.sku;
    if (updates.inventory !== undefined) {
      variantUpdates.variant.inventory_quantity = updates.inventory;
    }
    if (updates.shippingWeight !== undefined) {
      variantUpdates.variant.weight = updates.shippingWeight;
    }

    await shopifyRequest(
      shop,
      `variants/${variantId}.json`,
      'PUT',
      variantUpdates
    );
    
    console.log(`✅ Updated variant ${variantId} for product ${shopifyId}`);
  }

  if (Object.keys(shopifyProduct.product).length > 0) {
    const data = await shopifyRequest(
      shop,
      `products/${shopifyId}.json`,
      'PUT',
      shopifyProduct
    );
    console.log(`✅ Updated Shopify product: ${shopifyId}`);
    return data.product;
  }

  return null;
}

export async function getProductCollections(shop, productId) {
  console.log(`📦 Fetching collections for product: ${productId}`);
  
  try {
    const data = await shopifyRequest(shop, `products/${productId}/collections.json`);
    return data.collections.map(c => c.title).join(', ');
  } catch (error) {
    console.error('❌ Error fetching collections:', error);
    return '';
  }
}

export async function getProductMetafield(shop, productId, namespace, key) {
  console.log(`📦 Fetching metafield ${namespace}.${key} for product: ${productId}`);
  
  try {
    const data = await shopifyRequest(shop, `products/${productId}/metafields.json?namespace=${namespace}&key=${key}`);
    return data.metafields.length > 0 ? data.metafields[0].value : '';
  } catch (error) {
    console.error('❌ Error fetching metafield:', error);
    return '';
  }
}

export async function setProductMetafield(shop, productId, namespace, key, value, type = 'single_line_text_field') {
  console.log(`📝 Setting metafield ${namespace}.${key} for product: ${productId}`);
  
  try {
    const metafieldData = {
      metafield: {
        namespace: namespace,
        key: key,
        value: value,
        type: type,
      },
    };

    const data = await shopifyRequest(shop, `products/${productId}/metafields.json`, 'POST', metafieldData);
    console.log(`✅ Set metafield: ${namespace}.${key}`);
    return data.metafield;
  } catch (error) {
    console.error('❌ Error setting metafield:', error);
    throw error;
  }
}

module.exports = {
  getShopifyProducts,
  createShopifyProduct,
  updateShopifyProduct,
  getShopifyToken,
  getProductMetafield,
  setProductMetafield,
};