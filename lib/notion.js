const { Client } = require('@notionhq/client');

function getNotionClient() {
  return new Client({
    auth: process.env.NOTION_API_KEY,
  });
}

async function getNotionProducts() {
  try {
    console.log('📖 Reading products from Notion...');
    
    const notion = getNotionClient();
    
    let allProducts = [];
    let hasMore = true;
    let startCursor = undefined;

    while (hasMore) {
      const response = await notion.search({
        filter: {
          value: 'page',
          property: 'object'
        },
        start_cursor: startCursor,
      });

      const databaseId = process.env.NOTION_DATABASE_ID;
      const databasePages = response.results.filter(page => {
        if (!page.parent) return false;
        if (page.parent.type === 'data_source_id') {
          return page.parent.database_id === databaseId;
        }
        if (page.parent.type === 'database_id') {
          return page.parent.database_id === databaseId;
        }
        return false;
      });

      const products = databasePages.map(page => {
        const props = page.properties;
        return {
          notionId: page.id,
          title: props.Title?.title?.[0]?.text?.content || '',
          price: props.Price?.number || 0,
          inventory: props.Inventory?.number || 0,
          sku: props.SKU?.rich_text?.[0]?.text?.content || '',
          imageUrl: props['Image URL']?.url || '',
          shopifyId: props['Shopify ID']?.rich_text?.[0]?.text?.content || null,
          status: props.Status?.select?.name || 'Draft',
          category: props.Category?.rich_text?.[0]?.text?.content || '',
          tags: props.Tags?.rich_text?.[0]?.text?.content || '',
          vendor: props.Vendor?.rich_text?.[0]?.text?.content || '',
          collection: props.Collection?.rich_text?.[0]?.text?.content || '',
          shippingWeight: props['Shipping Weight']?.number || 0,
        };
      });

      allProducts = allProducts.concat(products);
      hasMore = response.has_more;
      startCursor = response.next_cursor;
    }

    console.log(`✅ Found ${allProducts.length} total products in Notion`);
    return allProducts;
  } catch (error) {
    console.error('❌ Error reading from Notion:', error);
    throw error;
  }
}

async function createNotionProduct(product) {
  try {
    console.log(`📝 Creating product in Notion: ${product.title}`);
    
    const notion = getNotionClient();
    
    const properties = {
      Title: {
        title: [{ text: { content: product.title } }],
      },
      Price: {
        number: parseFloat(product.price),
      },
      Inventory: {
        number: parseInt(product.inventory),
      },
      SKU: {
        rich_text: [{ text: { content: product.sku || '' } }],
      },
      'Image URL': {
        url: product.imageUrl || null,
      },
      'Shopify ID': {
        rich_text: [{ text: { content: product.shopifyId || '' } }],
      },
      Status: {
        select: { name: product.status || 'Draft' },
      },
    };

    if (product.category) {
      properties.Category = {
        rich_text: [{ text: { content: product.category } }],
      };
    }

    if (product.tags) {
      properties.Tags = {
        rich_text: [{ text: { content: product.tags } }],
      };
    }

    if (product.vendor) {
      properties.Vendor = {
        rich_text: [{ text: { content: product.vendor } }],
      };
    }

    if (product.collection) {
      properties.Collection = {
        rich_text: [{ text: { content: product.collection } }],
      };
    }

    if (product.shippingWeight) {
      properties['Shipping Weight'] = {
        number: product.shippingWeight,
      };
    }

    const response = await notion.pages.create({
      parent: { database_id: process.env.NOTION_DATABASE_ID },
      properties,
    });

    console.log(`✅ Created product in Notion with ID: ${response.id}`);
    return response;
  } catch (error) {
    console.error('❌ Error creating Notion product:', error);
    throw error;
  }
}

async function updateNotionProduct(notionId, updates) {
  try {
    console.log(`📝 Updating Notion product: ${notionId}`);
    
    const notion = getNotionClient();
    
    const properties = {};
    
    if (updates.title !== undefined) {
      properties.Title = { title: [{ text: { content: updates.title } }] };
    }
    if (updates.price !== undefined) {
      properties.Price = { number: parseFloat(updates.price) };
    }
    if (updates.inventory !== undefined) {
      properties.Inventory = { number: parseInt(updates.inventory) };
    }
    if (updates.shopifyId !== undefined) {
      properties['Shopify ID'] = { 
        rich_text: [{ text: { content: updates.shopifyId } }] 
      };
    }
    if (updates.category !== undefined) {
      properties.Category = { 
        rich_text: [{ text: { content: updates.category } }] 
      };
    }
    if (updates.tags !== undefined) {
      properties.Tags = { 
        rich_text: [{ text: { content: updates.tags } }] 
      };
    }
    if (updates.vendor !== undefined) {
      properties.Vendor = { 
        rich_text: [{ text: { content: updates.vendor } }] 
      };
    }
    if (updates.collection !== undefined) {
      properties.Collection = { 
        rich_text: [{ text: { content: updates.collection } }] 
      };
    }
    if (updates.shippingWeight !== undefined) {
      properties['Shipping Weight'] = { number: updates.shippingWeight };
    }

    const response = await notion.pages.update({
      page_id: notionId,
      properties,
    });

    console.log(`✅ Updated Notion product: ${notionId}`);
    return response;
  } catch (error) {
    console.error('❌ Error updating Notion product:', error);
    throw error;
  }
}

async function getNotionPageContent(pageId) {
  try {
    console.log(`📄 Fetching page content for: ${pageId}`);
    
    const notion = getNotionClient();
    
    let html = '';
    let hasMore = true;
    let startCursor = undefined;

    while (hasMore) {
      const response = await notion.blocks.children.list({
        block_id: pageId,
        start_cursor: startCursor,
      });

      for (const block of response.results) {
        html += convertBlockToHtml(block);
      }

      hasMore = response.has_more;
      startCursor = response.next_cursor;
    }

    console.log(`✅ Extracted content from page`);
    return html;
  } catch (error) {
    console.error('❌ Error fetching page content:', error);
    return '';
  }
}

function convertBlockToHtml(block) {
  let html = '';

  switch (block.type) {
    case 'paragraph':
      if (block.paragraph.rich_text.length > 0) {
        const text = block.paragraph.rich_text.map(t => {
          let formatted = t.plain_text;
          if (t.annotations.bold) formatted = `<strong>${formatted}</strong>`;
          if (t.annotations.italic) formatted = `<em>${formatted}</em>`;
          if (t.annotations.strikethrough) formatted = `<s>${formatted}</s>`;
          if (t.href) formatted = `<a href="${t.href}">${formatted}</a>`;
          return formatted;
        }).join('');
        html += `<p>${text}</p>`;
      }
      break;

    case 'heading_1':
      if (block.heading_1.rich_text.length > 0) {
        const text = block.heading_1.rich_text.map(t => t.plain_text).join('');
        html += `<h1>${text}</h1>`;
      }
      break;

    case 'heading_2':
      if (block.heading_2.rich_text.length > 0) {
        const text = block.heading_2.rich_text.map(t => t.plain_text).join('');
        html += `<h2>${text}</h2>`;
      }
      break;

    case 'heading_3':
      if (block.heading_3.rich_text.length > 0) {
        const text = block.heading_3.rich_text.map(t => t.plain_text).join('');
        html += `<h3>${text}</h3>`;
      }
      break;

    case 'bulleted_list_item':
      if (block.bulleted_list_item.rich_text.length > 0) {
        const text = block.bulleted_list_item.rich_text.map(t => t.plain_text).join('');
        html += `<li>${text}</li>`;
      }
      break;

    case 'numbered_list_item':
      if (block.numbered_list_item.rich_text.length > 0) {
        const text = block.numbered_list_item.rich_text.map(t => t.plain_text).join('');
        html += `<li>${text}</li>`;
      }
      break;

    case 'divider':
      html += `<hr>`;
      break;

    case 'quote':
      if (block.quote.rich_text.length > 0) {
        const text = block.quote.rich_text.map(t => t.plain_text).join('');
        html += `<blockquote>${text}</blockquote>`;
      }
      break;

    case 'code':
      if (block.code.rich_text.length > 0) {
        const text = block.code.rich_text.map(t => t.plain_text).join('');
        html += `<pre><code>${text}</code></pre>`;
      }
      break;

    case 'image':
      if (block.image.type === 'external') {
        html += `<img src="${block.image.external.url}" style="max-width:100%;">`;
      } else if (block.image.type === 'file') {
        html += `<img src="${block.image.file.url}" style="max-width:100%;">`;
      }
      break;

    default:
      break;
  }

  return html;
}

module.exports = {
  getNotionProducts,
  createNotionProduct,
  updateNotionProduct,
  getNotionPageContent,
};