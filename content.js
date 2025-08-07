// ZonGrabber Content Script v1.6.0
// 负责从亚马逊页面提取商品数据

// 全局错误处理 - 忽略亚马逊广告系统的沙盒错误
window.addEventListener('error', function(event) {
    if (event.message && event.message.includes('sandboxed') && event.message.includes('amazon-adsystem')) {
        console.log('ZonGrabber: 忽略亚马逊广告系统沙盒错误');
        event.preventDefault();
        return false;
    }
}, true);

// 忽略未捕获的Promise错误（通常来自亚马逊的脚本）
window.addEventListener('unhandledrejection', function(event) {
    if (event.reason && event.reason.toString().includes('amazon-adsystem')) {
        console.log('ZonGrabber: 忽略亚马逊广告系统Promise错误');
        event.preventDefault();
        return false;
    }
});

// 配置化的选择器，支持多种页面结构
const SELECTORS = {
  // 基础商品信息
  asin: [
    '[data-asin]',
    'input[name="ASIN"]',
    'link[rel="canonical"]'
  ],
  title: [
    '#productTitle',
    '.product-title',
    'h1[data-automation-id="product-title"]',
    '.a-size-large.product-title-word-break'
  ],
  brand: [
    '#bylineInfo',
    '.a-link-normal[data-attribute="brand"]',
    '.po-brand .po-break-word',
    'a[data-attribute="brand"]'
  ],
  currentPrice: [
    '.a-price.a-text-price.a-size-medium.apexPriceToPay .a-offscreen',
    '.a-price .a-offscreen',
    '#priceblock_dealprice',
    '#priceblock_ourprice',
    '.a-price-whole'
  ],
  originalPrice: [
    '.a-price.a-text-price .a-offscreen',
    '#priceblock_listprice',
    '.a-text-strike .a-offscreen'
  ],
  rating: [
    '[data-hook="average-star-rating"] .a-icon-alt',
    '.a-icon-star .a-icon-alt',
    '#acrPopover .a-icon-alt'
  ],
  reviewCount: [
    '[data-hook="total-review-count"]',
    '#acrCustomerReviewText',
    '.a-link-normal[href*="#customerReviews"]'
  ],
  stockStatus: [
    '#availability span',
    '.a-color-success',
    '.a-color-state',
    '#outOfStock'
  ],
  images: [
    '#landingImage',
    '.a-dynamic-image',
    '#imgTagWrapperId img'
  ],
  category: [
    '#wayfinding-breadcrumbs_feature_div',
    '.a-breadcrumb',
    '#nav-subnav'
  ]
};

// 页面初始化
function initContentScript() {
  console.log('ZonGrabber content script loaded');
  console.log('Current URL:', window.location.href);
  console.log('Is product page:', isProductPage());
}

// 当页面加载完成时初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initContentScript);
} else {
  initContentScript();
}

// 监听来自background script的消息
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  console.log('Content script received message:', request.action);

  switch (request.action) {
    case 'ping':
      sendResponse({ success: true, message: 'Content script is ready' });
      break;
    case 'extractProductData':
      extractProductData().then(data => {
        console.log('Data extracted successfully:', data);
        sendResponse(data);
      }).catch(error => {
        console.error('Data extraction failed:', error);
        sendResponse({ error: error.message });
      });
      break;
    case 'extractListProducts':
      extractListProducts(request.filters || {}).then(data => {
        console.log('List products extracted successfully:', data);
        sendResponse(data);
      }).catch(error => {
        console.error('List products extraction failed:', error);
        sendResponse({ error: error.message });
      });
      break;
    case 'showNotification':
      showNotification(request.message);
      sendResponse({ success: true });
      break;
    default:
      console.log('未知消息类型:', request.action);
      sendResponse({ error: '未知消息类型' });
  }
  return true; // 保持消息通道开放
});

// 主要的数据提取函数
async function extractProductData() {
  return new Promise(async (resolve, reject) => {
    // 设置总体超时
    const timeout = setTimeout(() => {
      console.error('数据提取超时');
      reject(new Error('数据提取超时，请刷新页面后重试'));
    }, 30000); // 30秒超时

    try {
      console.log('开始数据提取...');

      // 检查是否为商品页面
      if (!isProductPage()) {
        throw new Error('当前页面不是亚马逊商品页面');
      }

      // 等待页面完全加载
      console.log('等待页面加载...');
      await waitForPageLoad();
      console.log('页面加载完成，开始提取数据...');

      const productData = {
        // 基础信息
        asin: safeExtract(() => extractASIN(), 'asin'),
        title: safeExtract(() => extractText(SELECTORS.title), 'title'),
        brand: safeExtract(() => extractBrand(), 'brand'),
        url: window.location.href, // 原始URL，联盟标识将在sidepanel中添加

        // 价格信息
        currentPrice: safeExtract(() => extractPrice(SELECTORS.currentPrice), 'currentPrice'),
        originalPrice: safeExtract(() => extractPrice(SELECTORS.originalPrice), 'originalPrice'),
        priceRange: safeExtract(() => extractPriceRange(), 'priceRange'),

        // 评价信息
        rating: safeExtract(() => extractRating(), 'rating'),
        reviewCount: safeExtract(() => extractReviewCount(), 'reviewCount'),
        bestSellerRank: safeExtract(() => extractBestSellerRank(), 'bestSellerRank'),

        // 库存和配送
        stockStatus: safeExtract(() => extractText(SELECTORS.stockStatus), 'stockStatus'),
        shippingInfo: safeExtract(() => extractShippingInfo(), 'shippingInfo'),
        primeEligible: safeExtract(() => checkPrimeEligible(), 'primeEligible'),

        // 商品详情
        category: safeExtract(() => extractCategory(), 'category'),
        features: safeExtract(() => extractFeatures(), 'features'),
        specifications: safeExtract(() => extractSpecifications(), 'specifications'),
        description: safeExtract(() => extractDescription(), 'description'),

        // 变体信息
        variants: safeExtract(() => extractVariants(), 'variants'),

        // 图片
        images: safeExtract(() => extractImages(), 'images'),

        // 评论数据
        reviews: safeExtract(() => extractReviews(), 'reviews'),



        // 联盟信息
        affiliateInfo: safeExtract(() => extractAffiliateInfo(), 'affiliateInfo'),

        // 元数据
        extractedAt: new Date().toISOString(),
        pageType: 'product'
      };

      console.log('数据提取完成:', productData);
      clearTimeout(timeout);
      resolve(productData);
    } catch (error) {
      console.error('数据提取失败:', error);
      clearTimeout(timeout);
      reject(error);
    }
  });
}

// 安全提取函数，防止单个提取函数卡住整个流程
function safeExtract(extractFunction, fieldName) {
  try {
    console.log(`提取 ${fieldName}...`);
    const startTime = Date.now();
    const result = extractFunction();
    const endTime = Date.now();
    console.log(`${fieldName} 提取完成 (${endTime - startTime}ms):`, result);
    return result;
  } catch (error) {
    console.warn(`提取 ${fieldName} 失败:`, error);
    return fieldName === 'images' ? [] :
           fieldName === 'reviews' ? [] :
           fieldName === 'features' ? [] :
           fieldName === 'variants' ? {} :
           fieldName === 'specifications' ? {} :
           fieldName === 'affiliateInfo' ? { siteStripeAvailable: false, category: '', commissionRate: '' } :
           null;
  }
}

// 工具函数：安全提取文本
function extractText(selectors, defaultValue = '') {
  if (typeof selectors === 'string') {
    selectors = [selectors];
  }
  
  for (const selector of selectors) {
    try {
      const element = document.querySelector(selector);
      if (element) {
        const text = element.textContent?.trim();
        if (text && text !== '') {
          return text;
        }
      }
    } catch (error) {
      console.warn('选择器错误:', selector, error);
    }
  }
  return defaultValue;
}

// 提取ASIN
function extractASIN() {
  console.log('开始提取ASIN...');

  // 方法1: 从data-asin属性
  const asinElement = document.querySelector('[data-asin]');
  if (asinElement && asinElement.getAttribute('data-asin')) {
    const asin = asinElement.getAttribute('data-asin');
    console.log('从data-asin属性提取到ASIN:', asin);
    return asin;
  }

  // 方法2: 从URL - 支持多种格式
  const url = window.location.href;
  console.log('当前URL:', url);

  const urlPatterns = [
    /\/dp\/([A-Z0-9]{10})/i,           // /dp/ASIN
    /\/gp\/product\/([A-Z0-9]{10})/i,  // /gp/product/ASIN
    /\/product\/([A-Z0-9]{10})/i,      // /product/ASIN
    /asin=([A-Z0-9]{10})/i,            // asin=ASIN
    /\/([A-Z0-9]{10})(?:\/|\?|$)/i     // 直接的ASIN格式
  ];

  for (const pattern of urlPatterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      console.log('从URL提取到ASIN:', match[1], '使用模式:', pattern);
      return match[1];
    }
  }

  // 方法3: 从隐藏输入框
  const hiddenInput = document.querySelector('input[name="ASIN"]');
  if (hiddenInput && hiddenInput.value) {
    const asin = hiddenInput.value;
    console.log('从隐藏输入框提取到ASIN:', asin);
    return asin;
  }

  // 方法4: 从meta标签
  const metaAsin = document.querySelector('meta[name="asin"]');
  if (metaAsin && metaAsin.getAttribute('content')) {
    const asin = metaAsin.getAttribute('content');
    console.log('从meta标签提取到ASIN:', asin);
    return asin;
  }

  // 方法5: 从页面脚本中查找
  const scripts = document.querySelectorAll('script');
  for (const script of scripts) {
    if (script.textContent) {
      const asinMatch = script.textContent.match(/"asin"\s*:\s*"([A-Z0-9]{10})"/i);
      if (asinMatch) {
        console.log('从脚本中提取到ASIN:', asinMatch[1]);
        return asinMatch[1];
      }
    }
  }

  console.warn('未能提取到ASIN');
  return '';
}

// 提取品牌信息
function extractBrand() {
  const brandText = extractText(SELECTORS.brand);
  if (brandText) {
    // 清理品牌文本
    return brandText.replace(/^(Visit the|Brand:|by)\s*/i, '').replace(/\s+Store$/, '').trim();
  }
  return '';
}

// 提取价格
function extractPrice(selectors) {
  const priceText = extractText(selectors);
  if (priceText) {
    const priceMatch = priceText.match(/[\d,]+\.?\d*/);
    return priceMatch ? priceMatch[0] : '';
  }
  return '';
}

// 提取价格区间
function extractPriceRange() {
  const rangeElement = document.querySelector('.a-price-range');
  if (rangeElement) {
    const prices = rangeElement.querySelectorAll('.a-offscreen');
    if (prices.length >= 2) {
      return {
        min: prices[0].textContent.trim(),
        max: prices[1].textContent.trim()
      };
    }
  }
  return null;
}

// 提取评分
function extractRating() {
  const ratingText = extractText(SELECTORS.rating);
  if (ratingText) {
    const ratingMatch = ratingText.match(/[\d.]+/);
    return ratingMatch ? ratingMatch[0] : '';
  }
  return '';
}

// 提取评论数量
function extractReviewCount() {
  const reviewText = extractText(SELECTORS.reviewCount);
  if (reviewText) {
    const countMatch = reviewText.match(/[\d,]+/);
    return countMatch ? countMatch[0].replace(',', '') : '';
  }
  return '';
}

// 检查是否为商品页面
function isProductPage() {
  return window.location.href.includes('/dp/') || 
         window.location.href.includes('/gp/product/') ||
         document.querySelector('#productTitle') !== null;
}

// 等待页面加载完成
function waitForPageLoad() {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      console.log('页面加载超时，继续执行...');
      resolve();
    }, 5000); // 5秒超时

    if (document.readyState === 'complete') {
      clearTimeout(timeout);
      setTimeout(resolve, 500); // 减少等待时间到0.5秒
    } else {
      const loadHandler = () => {
        clearTimeout(timeout);
        window.removeEventListener('load', loadHandler);
        setTimeout(resolve, 500);
      };
      window.addEventListener('load', loadHandler);
    }
  });
}

// 提取最佳销量排名
function extractBestSellerRank() {
  const rankElements = document.querySelectorAll('.a-badge-text, [data-hook="badge-text"]');
  for (const element of rankElements) {
    const text = element.textContent;
    if (text.includes('Best Seller') || text.includes('#1')) {
      return text.trim();
    }
  }
  return '';
}

// 提取配送信息
function extractShippingInfo() {
  const shippingSelectors = [
    '#deliveryBlockMessage',
    '.a-color-success.a-text-bold',
    '[data-feature-name="delivery"] .a-color-success'
  ];

  return extractText(shippingSelectors);
}

// 检查Prime资格
function checkPrimeEligible() {
  const primeElements = document.querySelectorAll('[aria-label*="Prime"], .a-icon-prime, [data-testid="prime-logo"]');
  return primeElements.length > 0;
}

// 提取商品分类
function extractCategory() {
  const breadcrumbs = document.querySelectorAll('#wayfinding-breadcrumbs_feature_div a, .a-breadcrumb a');
  const categories = Array.from(breadcrumbs).map(link => link.textContent.trim()).filter(text => text);
  return categories.join(' > ');
}

// 提取商品特性
function extractFeatures() {
  const features = [];

  try {
    // 多种特性选择器
    const featureSelectors = [
      '#feature-bullets ul li',
      '[data-hook="feature-bullets"] li',
      '#featurebullets_feature_div ul li',
      '.a-unordered-list.a-vertical li'
    ];

    featureSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);

      elements.forEach(element => {
        const text = cleanText(element.textContent);

        // 过滤掉无效的特性
        if (text &&
            text.length > 10 &&
            text.length < 300 &&
            !text.includes('Make sure') &&
            !text.includes('css') &&
            !text.includes('style') &&
            !text.includes('{') &&
            !text.includes('}') &&
            !features.includes(text)) {
          features.push(text);
        }
      });
    });

    console.log('提取到的特性信息:', features);
    return features.slice(0, 10); // 限制数量

  } catch (error) {
    console.warn('提取商品特性失败:', error);
    return [];
  }
}

// 提取商品规格
function extractSpecifications() {
  const specs = {};

  try {
    // 多种规格表选择器
    const specSelectors = [
      '#productDetails_techSpec_section_1 tr',
      '#productDetails_detailBullets_sections1 tr',
      '.a-keyvalue tr',
      '#detailBullets_feature_div ul li',
      '.pdTab table tr'
    ];

    specSelectors.forEach(selector => {
      const rows = document.querySelectorAll(selector);

      rows.forEach(row => {
        try {
          // 处理表格行
          const cells = row.querySelectorAll('td, th');
          if (cells.length >= 2) {
            const key = cleanText(cells[0].textContent);
            const value = cleanText(cells[1].textContent);

            if (key && value && key.length < 100 && value.length < 200) {
              specs[key] = value;
            }
          }

          // 处理列表项
          if (selector.includes('li')) {
            const text = cleanText(row.textContent);
            if (text && text.includes(':')) {
              const [key, ...valueParts] = text.split(':');
              const value = valueParts.join(':').trim();

              if (key && value && key.length < 100 && value.length < 200) {
                specs[key.trim()] = value;
              }
            }
          }
        } catch (error) {
          // 忽略单个行的错误
        }
      });
    });

    // 过滤掉无效的规格
    const filteredSpecs = {};
    Object.entries(specs).forEach(([key, value]) => {
      // 过滤掉明显无效的键值对
      if (!key.includes('css') &&
          !key.includes('style') &&
          !value.includes('{') &&
          !value.includes('}') &&
          key.length > 2 &&
          value.length > 1) {
        filteredSpecs[key] = value;
      }
    });

    console.log('提取到的规格信息:', filteredSpecs);
    return filteredSpecs;

  } catch (error) {
    console.warn('提取商品规格失败:', error);
    return {};
  }
}

// 提取商品描述
function extractDescription() {
  try {
    const descriptions = [];

    // 优先提取产品描述段落
    const productDescElements = document.querySelectorAll('#productDescription p, #productDescription div');
    productDescElements.forEach(element => {
      const text = cleanText(element.textContent);
      if (text && text.length > 10 && text.length < 1000) {
        descriptions.push(text);
      }
    });

    // 如果没有找到，尝试其他选择器
    if (descriptions.length === 0) {
      const fallbackSelectors = [
        '#feature-bullets ul li span',
        '.a-unordered-list .a-list-item',
        '#aplus_feature_div p'
      ];

      fallbackSelectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach(element => {
          const text = cleanText(element.textContent);
          if (text && text.length > 10 && text.length < 500) {
            descriptions.push(text);
          }
        });
      });
    }

    // 去重并限制数量
    const uniqueDescriptions = [...new Set(descriptions)];
    return uniqueDescriptions.slice(0, 3).join(' ');

  } catch (error) {
    console.warn('提取商品描述失败:', error);
    return '';
  }
}

// 清理文本内容，移除CSS和无关内容
function cleanText(text) {
  if (!text) return '';

  return text
    .trim()
    // 移除CSS相关内容
    .replace(/\.[\w-]+\s*\{[^}]*\}/g, '')
    .replace(/\{[^}]*\}/g, '')
    .replace(/[\w-]+:\s*[\w\s#().,%-]+;/g, '')
    // 移除HTML标签
    .replace(/<[^>]*>/g, '')
    // 移除多余的空白字符
    .replace(/\s+/g, ' ')
    // 移除特殊字符和符号
    .replace(/[^\w\s.,!?()-]/g, '')
    .trim();
}

// 添加联盟标识到URL
function addAffiliateTag(url) {
  try {
    // 您的联盟标识 - 可以在这里修改为您自己的标识
    const AFFILIATE_TAG = 'your-affiliate-tag-20'; // 请替换为您的实际联盟标识

    if (!url || !AFFILIATE_TAG) {
      return url;
    }

    const urlObj = new URL(url);

    // 检查是否已经有tag参数
    if (urlObj.searchParams.has('tag')) {
      // 替换现有的tag
      urlObj.searchParams.set('tag', AFFILIATE_TAG);
    } else {
      // 添加新的tag参数
      urlObj.searchParams.set('tag', AFFILIATE_TAG);
    }

    console.log('添加联盟标识:', AFFILIATE_TAG);
    return urlObj.toString();
  } catch (error) {
    console.warn('添加联盟标识失败:', error);
    return url;
  }
}

// 提取变体信息
function extractVariants() {
  const variants = {
    colors: [],
    sizes: [],
    styles: [],
    patterns: [],
    materials: [],
    other: []
  };

  try {
    console.log('开始提取变体信息...');

    // 提取颜色变体 - 更全面的选择器
    const colorSelectors = [
      '[data-defaultasin] img',
      '.a-button-thumbnail img',
      '#variation_color_name img',
      '[data-dp-url] img',
      '.swatchElement img',
      '.a-button-selected img',
      '.imgSwatch img'
    ];

    colorSelectors.forEach(selector => {
      const colorElements = document.querySelectorAll(selector);
      colorElements.forEach(img => {
        const alt = img.getAttribute('alt');
        const title = img.getAttribute('title');
        const colorName = alt || title;

        if (colorName && colorName.trim() && !variants.colors.includes(colorName.trim())) {
          // 过滤掉明显不是颜色的描述
          if (!colorName.includes('Click to') && !colorName.includes('选择') && colorName.length < 50) {
            variants.colors.push(colorName.trim());
          }
        }
      });
    });

    // 提取尺寸变体 - 更全面的选择器
    const sizeSelectors = [
      '#size_name_0 option',
      '#size_name_1 option',
      '.a-dropdown-item',
      '[data-dp-url*="size"]',
      '.size-option',
      '.a-button-text[data-action*="size"]',
      '#variation_size_name option'
    ];

    sizeSelectors.forEach(selector => {
      const sizeElements = document.querySelectorAll(selector);
      sizeElements.forEach(element => {
        const text = element.textContent?.trim();
        if (text &&
            text !== 'Select' &&
            text !== '选择尺寸' &&
            text !== 'Choose an option' &&
            text.length < 30 &&
            !variants.sizes.includes(text)) {
          variants.sizes.push(text);
        }
      });
    });

    // 提取样式/款式变体
    const styleSelectors = [
      '#style_name_0 option',
      '#variation_style_name option',
      '[data-dp-url*="style"]',
      '.style-option'
    ];

    styleSelectors.forEach(selector => {
      const styleElements = document.querySelectorAll(selector);
      styleElements.forEach(element => {
        const text = element.textContent?.trim();
        if (text &&
            text !== 'Select' &&
            text !== '选择样式' &&
            text.length < 50 &&
            !variants.styles.includes(text)) {
          variants.styles.push(text);
        }
      });
    });

    // 提取图案变体
    const patternSelectors = [
      '#pattern_name_0 option',
      '#variation_pattern_name option'
    ];

    patternSelectors.forEach(selector => {
      const patternElements = document.querySelectorAll(selector);
      patternElements.forEach(element => {
        const text = element.textContent?.trim();
        if (text &&
            text !== 'Select' &&
            text.length < 50 &&
            !variants.patterns.includes(text)) {
          variants.patterns.push(text);
        }
      });
    });

    // 提取材质变体
    const materialSelectors = [
      '#material_name_0 option',
      '#variation_material_name option'
    ];

    materialSelectors.forEach(selector => {
      const materialElements = document.querySelectorAll(selector);
      materialElements.forEach(element => {
        const text = element.textContent?.trim();
        if (text &&
            text !== 'Select' &&
            text.length < 50 &&
            !variants.materials.includes(text)) {
          variants.materials.push(text);
        }
      });
    });

    // 提取其他变体（通用方法）
    const otherVariationSelectors = [
      '[id*="variation_"] option',
      '[data-dp-url]:not([data-dp-url*="color"]):not([data-dp-url*="size"]):not([data-dp-url*="style"])'
    ];

    otherVariationSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(element => {
        const text = element.textContent?.trim() || element.getAttribute('title')?.trim();
        if (text &&
            text !== 'Select' &&
            text.length > 2 && text.length < 50 &&
            !variants.other.includes(text) &&
            !variants.colors.includes(text) &&
            !variants.sizes.includes(text) &&
            !variants.styles.includes(text)) {
          variants.other.push(text);
        }
      });
    });

    console.log('变体信息提取完成:', variants);
    return variants;
  } catch (error) {
    console.error('提取变体信息失败:', error);
    return variants;
  }
}

// 提取商品图片
function extractImages() {
  const images = [];

  // 需要过滤的图片模式
  const filterPatterns = [
    // Prime会员图标
    /Prime_Logo_RGB_Prime_Blue_MASTER/,
    // 360度视图图标
    /imageBlock-360-thumbnail-icon/,
    // 播放按钮图标
    /play-button-mb-image-grid/,
    // 其他营销图标
    /marketing\/prime/,
    // 小尺寸缩略图（通常是导航用的）
    /\.SS125_/,
    // 非商品图片的其他模式
    /CustomProduct/,
    /HomeCustomProduct/,
    // 小尺寸图片
    /_SR\d+,\d+_/,
    // 其他小图标
    /_PKplay-button/
  ];

  // 优先获取主图片
  const mainImage = document.querySelector('#landingImage');
  if (mainImage) {
    const mainSrc = mainImage.getAttribute('data-old-hires') ||
                   mainImage.getAttribute('src') ||
                   mainImage.getAttribute('data-src');

    if (mainSrc && isValidProductImage(mainSrc, filterPatterns)) {
      images.push(mainSrc);
    }
  }

  // 获取其他商品图片
  const imageElements = document.querySelectorAll('#altImages img, .a-dynamic-image');

  imageElements.forEach(img => {
    // 尝试多个属性获取图片URL
    const sources = [
      img.getAttribute('data-old-hires'),
      img.getAttribute('src'),
      img.getAttribute('data-src'),
      img.getAttribute('data-a-hires')
    ].filter(Boolean);

    sources.forEach(src => {
      if (src && !images.includes(src) && isValidProductImage(src, filterPatterns)) {
        images.push(src);
      }
    });
  });

  // 去重并排序（优先高分辨率图片）
  const uniqueImages = [...new Set(images)];

  // 按图片质量排序（优先选择高分辨率图片）
  uniqueImages.sort((a, b) => {
    // 优先选择包含高分辨率标识的图片
    const aIsHiRes = /_AC_SX\d+_|_AC_SY\d+_|_SL\d+_/.test(a);
    const bIsHiRes = /_AC_SX\d+_|_AC_SY\d+_|_SL\d+_/.test(b);

    if (aIsHiRes && !bIsHiRes) return -1;
    if (!aIsHiRes && bIsHiRes) return 1;

    return 0;
  });

  console.log('提取到的商品图片:', uniqueImages);
  return uniqueImages;
}

// 检查是否为有效的商品图片
function isValidProductImage(src, filterPatterns) {
  // 检查是否应该过滤此图片
  const shouldFilter = filterPatterns.some(pattern => pattern.test(src));

  if (shouldFilter) {
    return false;
  }

  // 只保留真正的商品图片（通常包含 /images/I/ 路径）
  if (src.includes('/images/I/') || src.includes('media-amazon.com/images/I/')) {
    return true;
  }

  return false;
}

// 提取评论数据
function extractReviews() {
  try {
    const reviews = [];

    // 多种评论选择器，确保能找到评论
    const reviewSelectors = [
      '[data-hook="review"]',
      '.review',
      '.cr-original-review-text',
      '.a-section.review'
    ];

    let reviewElements = [];

    // 尝试不同的选择器
    for (const selector of reviewSelectors) {
      reviewElements = document.querySelectorAll(selector);
      if (reviewElements.length > 0) {
        console.log(`使用选择器 ${selector} 找到 ${reviewElements.length} 个评论`);
        break;
      }
    }

    if (reviewElements.length === 0) {
      console.log('未找到评论元素');
      return [];
    }

    // 处理前10个评论
    const limitedElements = Array.from(reviewElements).slice(0, 10);

    limitedElements.forEach((review, index) => {
      try {
        // 多种方式提取评论数据
        const ratingElement = review.querySelector('.a-icon-star .a-icon-alt') ||
                             review.querySelector('[data-hook="review-star-rating"] .a-icon-alt') ||
                             review.querySelector('.a-icon-alt');

        const titleElement = review.querySelector('[data-hook="review-title"] span:not(.a-letter-space)') ||
                            review.querySelector('[data-hook="review-title"]') ||
                            review.querySelector('.review-title');

        const contentElement = review.querySelector('[data-hook="review-body"] span') ||
                              review.querySelector('[data-hook="review-body"]') ||
                              review.querySelector('.review-text') ||
                              review.querySelector('.cr-original-review-text');

        const authorElement = review.querySelector('.a-profile-name') ||
                             review.querySelector('[data-hook="review-author"]') ||
                             review.querySelector('.author');

        const dateElement = review.querySelector('[data-hook="review-date"]') ||
                           review.querySelector('.review-date');

        const reviewData = {
          rating: ratingElement?.textContent?.match(/[\d.]+/)?.[0] || '',
          title: titleElement?.textContent?.trim() || '',
          content: contentElement?.textContent?.trim() || '',
          author: authorElement?.textContent?.trim() || '',
          date: dateElement?.textContent?.replace(/Reviewed in|on/g, '').trim() || '',
          verified: !!review.querySelector('[data-hook="avp-badge"]'),
          helpfulVotes: review.querySelector('[data-hook="helpful-vote-statement"]')?.textContent?.match(/\d+/)?.[0] || '0'
        };

        // 验证评论数据的有效性
        if (reviewData.content &&
            reviewData.content.length > 10 &&
            reviewData.content.length < 2000 &&
            !reviewData.content.includes('font-weight') &&
            !reviewData.content.includes('color:')) {

          console.log(`提取评论 ${index + 1}:`, reviewData.title);
          reviews.push(reviewData);
        }
      } catch (error) {
        console.warn(`提取第 ${index + 1} 个评论失败:`, error);
      }
    });

    console.log(`成功提取 ${reviews.length} 条评论`);
    return reviews;
  } catch (error) {
    console.warn('提取评论失败:', error);
    return [];
  }
}



// 提取联盟信息
function extractAffiliateInfo() {
  const affiliateInfo = {
    siteStripeAvailable: false,
    category: '',
    commissionRate: '',
    trackingId: '',
    storeId: '',
    calculatedEarnings: ''
  };

  try {
    // 检查SiteStripe是否可用
    const siteStripeWrap = document.querySelector('.amzn-ss-wrap');
    if (!siteStripeWrap) {
      return affiliateInfo;
    }

    affiliateInfo.siteStripeAvailable = true;

    // 提取分类信息
    const categoryElement = document.querySelector('#amzn-ss-category-content');
    if (categoryElement) {
      affiliateInfo.category = categoryElement.textContent.trim();
      console.log('提取到分类:', affiliateInfo.category);
    }

    // 提取佣金率
    const commissionElement = document.querySelector('#amzn-ss-commission-rate-content');
    if (commissionElement) {
      affiliateInfo.commissionRate = commissionElement.textContent.trim();
      console.log('提取到佣金率:', affiliateInfo.commissionRate);
    }

    // 提取Tracking ID（用于记录，不在界面显示）
    const trackingDropdown = document.querySelector('#amzn-ss-tracking-id-dropdown-text');
    if (trackingDropdown) {
      affiliateInfo.trackingId = trackingDropdown.value;
    }

    // 提取Store ID（用于记录，不在界面显示）
    const storeDropdown = document.querySelector('#amzn-ss-store-id-dropdown-text');
    if (storeDropdown) {
      affiliateInfo.storeId = storeDropdown.value;
    }

    console.log('联盟信息提取完成:', affiliateInfo);
    return affiliateInfo;
  } catch (error) {
    console.error('提取联盟信息失败:', error);
    return affiliateInfo;
  }
}



// 显示通知
function showNotification(message) {
  // 创建通知元素
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #ff9900;
    color: white;
    padding: 12px 20px;
    border-radius: 4px;
    font-size: 14px;
    z-index: 10000;
    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
  `;
  notification.textContent = message;

  document.body.appendChild(notification);

  // 3秒后自动移除
  setTimeout(() => {
    if (notification.parentNode) {
      notification.parentNode.removeChild(notification);
    }
  }, 3000);
}

// ==================== 列表页面商品采集功能 ====================

// 列表页面商品选择器配置
const LIST_SELECTORS = {
  // 商品容器选择器 - 亚马逊的多种列表结构
  productContainers: [
    '[data-component-type="s-search-result"]',  // 主要搜索结果
    '.s-result-item',                           // 备用搜索结果
    '.s-widget-container',                      // 小部件容器
    '.a-section.a-spacing-base',                // 通用商品容器
    '[data-asin]:not([data-asin=""])',          // 包含有效ASIN的元素
    '.sg-col-inner',                            // 网格列容器
    '.s-card-container'                         // 卡片容器
  ],

  // 商品标题选择器 - 多种标题结构
  title: [
    'h2.a-size-base-plus span',                 // 标准标题结构
    'h2 a span',                                // 链接内的span
    'h2.s-size-mini span',                      // 小尺寸标题
    'h2 .a-link-normal span',                   // 普通链接span
    '.a-size-base-plus',                        // 基础大小标题
    '.a-size-mini .a-link-normal span',         // 小标题链接
    'h2[aria-label] span',                      // 带aria-label的标题
    '.s-title-instructions-style span',         // 特殊样式标题
    'h2.a-color-base span'                      // 基础颜色标题
  ],

  price: [
    '.a-price .a-offscreen',
    '.a-price-whole',
    '.a-price .a-price-symbol'
  ],

  rating: [
    '.a-icon-alt',
    '[aria-label*="stars"]'
  ],

  reviewCount: [
    '.a-size-base',
    'a[href*="#customerReviews"]'
  ],

  image: [
    '.s-image',
    '.a-dynamic-image',
    'img[data-image-latency]'
  ],

  link: [
    'h2 a',
    '.a-link-normal'
  ]
};

// 主要的列表商品提取函数 - 支持多页采集
async function extractListProducts(filters = {}) {
  return new Promise(async (resolve, reject) => {
    const timeout = setTimeout(() => {
      console.error('列表商品提取超时');
      reject(new Error('列表商品提取超时，请刷新页面后重试'));
    }, 180000); // 3分钟超时（减少超时时间）

    try {
      console.log('开始列表商品提取...', filters);

      // 添加随机延迟，模拟人类行为
      const randomDelay = Math.random() * 1000 + 500; // 500-1500ms随机延迟

      await new Promise(resolve => setTimeout(resolve, randomDelay));

      // 检查是否为列表页面
      if (!isListPage()) {
        throw new Error('当前页面不是亚马逊列表页面');
      }

      const maxPages = filters.maxPages || 1;
      const pageDelay = (filters.pageDelay || 3) * 1000; // 转换为毫秒

      console.log(`准备采集 ${maxPages} 页商品，页面延迟 ${pageDelay/1000} 秒`);

      // 检查是否支持多页采集
      if (maxPages > 1) {
        const hasNext = hasNextPage();
        if (!hasNext && maxPages > 1) {
          console.log('当前页面没有下一页，将只采集当前页');
        }
      }

      // 如果只采集1页，使用原来的逻辑
      if (maxPages === 1) {
        console.log('🔄 单页采集模式');
        return await extractCurrentPageProducts(filters, 1);
      }

      let allProducts = [];
      let currentPage = 1;
      let totalFound = 0;
      let currentDoc = document; // 当前页面的文档对象

      // 多页采集循环
      while (currentPage <= maxPages) {

        // 等待页面完全加载
        await waitForPageLoad();

        // 提取当前页商品
        const pageResult = await extractCurrentPageProducts(filters, currentPage);

        allProducts = allProducts.concat(pageResult.products);
        totalFound += pageResult.totalFound;

        // 检查是否还有下一页且未达到最大页数
        if (currentPage < maxPages && hasNextPage(currentDoc)) {
          // 页面延迟
          await new Promise(resolve => setTimeout(resolve, pageDelay));

          // 获取下一页URL
          const nextPageUrl = getNextPageUrl(currentDoc);
          if (!nextPageUrl) {
            break;
          }

          try {
            // 使用fetch获取下一页HTML
            const nextPageHTML = await fetchNextPageHTML(nextPageUrl);

            // 解析下一页的商品元素和更新文档上下文
            const parser = new DOMParser();
            const nextPageDoc = parser.parseFromString(nextPageHTML, 'text/html');
            currentDoc = nextPageDoc; // 更新当前文档上下文

            const nextPageElements = parseProductsFromHTML(nextPageHTML, currentPage + 1);

            // 提取下一页商品数据
            const nextPageProducts = [];
            for (let i = 0; i < nextPageElements.length; i++) {
              const element = nextPageElements[i];
              try {
                const product = await extractProductFromListItem(element, i);
                if (product && product.asin) {
                  // 添加页面信息
                  product.pageNumber = currentPage + 1;
                  product.positionInPage = i + 1;

                  // 应用过滤条件
                  if (passesFilters(product, filters)) {
                    nextPageProducts.push(product);
                  }
                }
              } catch (error) {
                console.warn(`第${currentPage + 1}页商品 ${i + 1} 提取失败:`, error);
              }
            }

            // 合并结果
            allProducts = allProducts.concat(nextPageProducts);
            totalFound += nextPageElements.length;

            currentPage++;
          } catch (error) {
            console.error(`第 ${currentPage + 1} 页采集失败:`, error);
            break;
          }
        } else {
          break;
        }
      }

      // 排序所有商品
      const sortedProducts = sortProducts(allProducts, filters.sortBy || 'sales');

      const result = {
        products: sortedProducts,
        totalFound: totalFound,
        totalFiltered: sortedProducts.length,
        pagesCollected: currentPage,
        maxPages: maxPages,
        filters: filters,
        extractedAt: new Date().toISOString(),
        pageType: 'list'
      };

      console.log('多页列表商品提取完成');
      clearTimeout(timeout);
      resolve(result);
    } catch (error) {
      console.error('列表商品提取失败:', error);
      clearTimeout(timeout);
      reject(error);
    }
  });
}

// 提取当前页面的商品
async function extractCurrentPageProducts(filters, pageNumber) {
  const products = [];
  const productElements = await getProductElements();

  // 分批处理商品，避免一次性处理太多
  const batchSize = 5; // 每批处理5个商品
  const totalBatches = Math.ceil(productElements.length / batchSize);

  console.log(`第${pageNumber}页共${productElements.length}个商品，分${totalBatches}批处理`);

  for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
    const startIndex = batchIndex * batchSize;
    const endIndex = Math.min(startIndex + batchSize, productElements.length);

    console.log(`处理第${batchIndex + 1}/${totalBatches}批商品 (${startIndex + 1}-${endIndex})`);

    // 处理当前批次的商品
    for (let i = startIndex; i < endIndex; i++) {
      const element = productElements[i];
      try {
        const product = await extractProductFromListItem(element, i);
        if (product && product.asin) {
          // 添加页面信息
          product.pageNumber = pageNumber;
          product.positionInPage = i + 1;

          // 应用过滤条件
          if (passesFilters(product, filters)) {
            products.push(product);
          }
        }

        // 每个商品之间添加小延迟
        if (i < endIndex - 1) {
          await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
        }

      } catch (error) {
        console.warn(`第${pageNumber}页商品 ${i + 1} 提取失败:`, error);

        // 如果是沙盒错误，继续处理下一个商品
        if (error.message && error.message.includes('sandboxed')) {
          console.log(`忽略商品 ${i + 1} 的沙盒错误，继续处理`);
          continue;
        }
      }
    }

    // 每批之间添加较长延迟，模拟人类浏览行为
    if (batchIndex < totalBatches - 1) {
      const batchDelay = 1000 + Math.random() * 1000; // 1-2秒随机延迟

      await new Promise(resolve => setTimeout(resolve, batchDelay));
    }
  }

  return {
    products: products,
    totalFound: productElements.length,
    pageNumber: pageNumber
  };
}

// 检查是否为列表页面
function isListPage() {
  const url = window.location.href;
  return url.includes('/s?') ||
         url.includes('/gp/search/') ||
         url.includes('/b/') ||
         url.includes('/stores/') ||
         document.querySelector('[data-component-type="s-search-result"]') !== null;
}

// 获取页面中的商品元素
async function getProductElements() {
  let elements = [];

  console.log('开始查找商品元素...');

  // 等待页面稳定
  const waitForStable = () => {
    return new Promise(resolve => {
      let checkCount = 0;
      const checkInterval = setInterval(() => {
        const currentElements = document.querySelectorAll('[data-component-type="s-search-result"]');
        checkCount++;

        if (currentElements.length > 0 || checkCount > 10) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 500);
    });
  };

  // 等待页面稳定后再获取元素
  return waitForStable().then(() => {
    // 尝试不同的选择器
    for (const selector of LIST_SELECTORS.productContainers) {
      elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        console.log(`使用选择器 "${selector}" 找到 ${elements.length} 个商品`);
        break;
      }
    }

    // 过滤掉无效的元素，但减少DOM操作
    const validElements = Array.from(elements).filter((element, index) => {
      // 只检查前50个元素，避免过多DOM操作
      if (index >= 50) return false;

      // 简化可见性检查
      return element.offsetHeight > 0 &&
             (element.querySelector('h2, h3, .a-size-base-plus, .a-size-medium') !== null);
    });

    console.log(`过滤后得到 ${validElements.length} 个有效商品元素`);
    return validElements;
  });
}

// 从列表项中提取单个商品数据
async function extractProductFromListItem(element, index) {
  try {
    console.log(`开始提取商品 ${index + 1}...`);

    // 模拟人类行为：随机查看元素
    if (Math.random() < 0.3) { // 30%概率模拟鼠标悬停
      element.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
      await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 100));
      element.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
    }

    const product = {
      asin: extractASINFromListElement(element),
      title: extractTextFromListElement(element, LIST_SELECTORS.title),
      brand: extractBrandFromListElement(element),
      price: extractPriceFromListElement(element),
      rating: extractRatingFromListElement(element),
      reviewCount: extractReviewCountFromListElement(element),
      image: extractImageFromListElement(element),
      url: extractUrlFromListElement(element),
      isPrime: checkPrimeFromListElement(element),
      isBestSeller: checkBestSellerFromListElement(element),
      extractedAt: new Date().toISOString(),
      sourceIndex: index
    };

    console.log(`商品 ${index + 1} 基础数据:`, {
      asin: product.asin,
      title: product.title?.substring(0, 50) + '...',
      brand: product.brand,
      price: product.price,
      rating: product.rating,
      reviewCount: product.reviewCount,
      url: product.url
    });

    return product;
  } catch (error) {
    console.error(`提取商品 ${index + 1} 失败:`, error);

    // 如果是沙盒错误，忽略并继续
    if (error.message && error.message.includes('sandboxed')) {
      console.log(`商品 ${index + 1}: 忽略沙盒错误，继续处理`);
      return null;
    }

    // 如果是网络错误，等待后重试
    if (error.message && (error.message.includes('network') || error.message.includes('fetch'))) {
      console.log(`商品 ${index + 1}: 网络错误，等待1秒后继续`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      return null;
    }

    return null;
  }
}

// 从列表元素中提取ASIN
function extractASINFromListElement(element) {
  // 方法1: 从data-asin属性
  const asin = element.getAttribute('data-asin');
  if (asin) {
    return asin;
  }

  // 方法2: 从链接URL中提取
  const link = element.querySelector('a[href*="/dp/"]');
  if (link) {
    const href = link.getAttribute('href');
    const match = href.match(/\/dp\/([A-Z0-9]{10})/i);
    if (match) {
      return match[1];
    }
  }

  // 方法3: 从其他属性中查找
  const dataUuid = element.getAttribute('data-uuid');
  if (dataUuid && dataUuid.length === 10) {
    return dataUuid;
  }

  return '';
}

// 从列表元素中提取文本（通用函数）
function extractTextFromListElement(element, selectors) {
  for (const selector of selectors) {
    try {
      const textElement = element.querySelector(selector);
      if (textElement) {
        const text = textElement.textContent?.trim();
        if (text && text !== '') {
          return text;
        }
      }
    } catch (error) {
      console.warn('选择器错误:', selector, error);
    }
  }
  return '';
}

// 从列表元素中提取品牌
function extractBrandFromListElement(element) {
  // 尝试从专门的品牌元素提取
  const brandSelectors = [
    '.a-size-base-plus[data-cy="brand-name"]',
    '.s-brand-name',
    '.a-link-normal[data-attribute="brand"]',
    '.brand-name',
    'span[data-component-type="s-brand-name"]'
  ];

  for (const selector of brandSelectors) {
    const brandElement = element.querySelector(selector);
    if (brandElement) {
      const brandText = brandElement.textContent?.trim();
      if (brandText && brandText !== '') {
        return brandText;
      }
    }
  }

  // 如果没有找到专门的品牌元素，尝试从标题中智能提取
  const title = extractTextFromListElement(element, LIST_SELECTORS.title);
  if (title) {
    // 常见品牌名称模式匹配
    const brandPatterns = [
      /^([A-Z][a-zA-Z]+)\s+/,  // 首字母大写的单词
      /^([A-Z]{2,})\s+/,       // 全大写的缩写
      /^(\w+)\s+-\s+/          // 品牌名 - 产品名格式
    ];

    for (const pattern of brandPatterns) {
      const match = title.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    // 如果没有匹配到模式，返回第一个词（但要过滤一些常见的非品牌词）
    const words = title.split(' ');
    if (words.length > 0) {
      const firstWord = words[0];
      const nonBrandWords = ['The', 'A', 'An', 'New', 'Best', 'Top', 'Premium'];
      if (!nonBrandWords.includes(firstWord)) {
        return firstWord;
      }
    }
  }

  return '';
}

// 从列表元素中提取价格
function extractPriceFromListElement(element) {
  const priceText = extractTextFromListElement(element, LIST_SELECTORS.price);
  if (priceText) {
    // 提取数字部分
    const priceMatch = priceText.match(/[\d,]+\.?\d*/);
    return priceMatch ? priceMatch[0] : '';
  }
  return '';
}

// 从列表元素中提取评分
function extractRatingFromListElement(element) {
  const ratingElement = element.querySelector('.a-icon-alt');
  if (ratingElement) {
    const ratingText = ratingElement.getAttribute('title') || ratingElement.textContent;
    if (ratingText) {
      const ratingMatch = ratingText.match(/[\d.]+/);
      return ratingMatch ? parseFloat(ratingMatch[0]) : 0;
    }
  }
  return 0;
}

// 从列表元素中提取评论数
function extractReviewCountFromListElement(element) {
  // 查找评论数链接
  const reviewLink = element.querySelector('a[href*="#customerReviews"]');
  if (reviewLink) {
    const reviewText = reviewLink.textContent;
    if (reviewText) {
      const countMatch = reviewText.match(/[\d,]+/);
      return countMatch ? parseInt(countMatch[0].replace(',', '')) : 0;
    }
  }

  // 备用方法：查找包含数字的小文本
  const smallTexts = element.querySelectorAll('.a-size-base');
  for (const text of smallTexts) {
    const content = text.textContent;
    if (content && content.match(/^\d+,?\d*$/)) {
      return parseInt(content.replace(',', ''));
    }
  }

  return 0;
}

// 从列表元素中提取图片
function extractImageFromListElement(element) {
  const img = element.querySelector('.s-image, .a-dynamic-image, img[data-image-latency]');
  if (img) {
    return img.getAttribute('src') || img.getAttribute('data-src') || '';
  }
  return '';
}

// 从列表元素中提取URL
function extractUrlFromListElement(element) {
  const linkSelectors = [
    'h2 a',
    '.a-link-normal',
    'a[href*="/dp/"]',
    '.s-title-instructions-style a'
  ];

  for (const selector of linkSelectors) {
    const link = element.querySelector(selector);
    if (link) {
      const href = link.getAttribute('href');
      if (href) {
        let fullUrl;
        // 如果是相对链接，转换为绝对链接
        if (href.startsWith('/')) {
          fullUrl = window.location.origin + href;
        } else {
          fullUrl = href;
        }

        // 清理URL，只保留到商品ID
        return cleanProductUrl(fullUrl);
      }
    }
  }
  return '';
}

// 清理商品URL，只保留基础部分
function cleanProductUrl(url) {
  try {
    const urlObj = new URL(url);

    // 提取ASIN
    const asinMatch = url.match(/\/dp\/([A-Z0-9]{10})/i);
    if (asinMatch) {
      const asin = asinMatch[1];
      // 构建清洁的URL，只保留到商品ID
      return `${urlObj.origin}/dp/${asin}/`;
    }

    return url;
  } catch (error) {
    console.warn('URL清理失败:', error);
    return url;
  }
}

// 检查是否为Prime商品
function checkPrimeFromListElement(element) {
  return element.querySelector('.a-icon-prime, [aria-label*="Prime"]') !== null;
}

// 检查是否为Best Seller
function checkBestSellerFromListElement(element) {
  const badges = element.querySelectorAll('.a-badge-text, [data-hook="badge-text"]');
  for (const badge of badges) {
    const text = badge.textContent;
    if (text && (text.includes('Best Seller') || text.includes('#1'))) {
      return true;
    }
  }
  return false;
}

// 过滤函数
function passesFilters(product, filters) {
  // 销量过滤（使用评论数作为销量指标）
  if (filters.minSales && product.reviewCount < filters.minSales) {
    console.log(`商品被销量过滤: ${product.reviewCount} < ${filters.minSales}`);
    return false;
  }

  // 评分过滤
  if (filters.minRating && product.rating < filters.minRating) {
    console.log(`商品被评分过滤: ${product.rating} < ${filters.minRating}`);
    return false;
  }

  // 评论数过滤
  if (filters.minReviews && product.reviewCount < filters.minReviews) {
    console.log(`商品被评论数过滤: ${product.reviewCount} < ${filters.minReviews}`);
    return false;
  }

  // 品牌过滤
  if (filters.brandFilter && filters.brandFilter.trim() !== '') {
    const brandFilter = filters.brandFilter.toLowerCase().trim();
    const productBrand = (product.brand || '').toLowerCase();
    const productTitle = (product.title || '').toLowerCase();

    if (!productBrand.includes(brandFilter) && !productTitle.includes(brandFilter)) {
      console.log(`商品被品牌过滤: "${product.brand}" 不包含 "${filters.brandFilter}"`);
      return false;
    }
  }

  return true;
}

// 排序函数
function sortProducts(products, sortBy = 'sales') {
  return products.sort((a, b) => {
    switch (sortBy) {
      case 'sales':
        // 按评论数排序（作为销量指标）
        return (b.reviewCount || 0) - (a.reviewCount || 0);
      case 'rating':
        // 按评分排序
        return (b.rating || 0) - (a.rating || 0);
      case 'price':
        // 按价格排序（低到高）
        const priceA = parseFloat((a.price || '0').replace(',', ''));
        const priceB = parseFloat((b.price || '0').replace(',', ''));
        return priceA - priceB;
      case 'priceDesc':
        // 按价格排序（高到低）
        const priceA2 = parseFloat((a.price || '0').replace(',', ''));
        const priceB2 = parseFloat((b.price || '0').replace(',', ''));
        return priceB2 - priceA2;
      default:
        return 0;
    }
  });
}

// ==================== 分页相关函数 ====================

// 检查是否有下一页
function hasNextPage(doc = document) {
  // 查找包含s-pagination-next类的A标签
  const nextLink = doc.querySelector('a.s-pagination-next[href*="page="]');
  return nextLink !== null;
}

// 获取下一页URL
function getNextPageUrl(doc = document) {
  // 查找包含s-pagination-next类的A标签
  const nextLink = doc.querySelector('a.s-pagination-next[href*="page="]');

  if (nextLink) {
    const href = nextLink.getAttribute('href');
    if (href) {
      // 如果是相对链接，转换为绝对链接
      return href.startsWith('/') ? window.location.origin + href : href;
    }
  }

  return null;
}

// 获取下一页的HTML内容
async function fetchNextPageHTML(nextPageUrl) {
  try {
    const response = await fetch(nextPageUrl, {
      method: 'GET',
      headers: {
        'User-Agent': navigator.userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
      credentials: 'include' // 包含cookies
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    return html;
  } catch (error) {
    console.error('获取下一页HTML失败:', error);
    throw error;
  }
}

// 从HTML字符串中解析商品数据
function parseProductsFromHTML(html, pageNumber) {
  try {
    // 创建临时DOM解析器
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // 使用相同的选择器获取商品元素
    const productElements = getProductElementsFromDoc(doc);

    return productElements;
  } catch (error) {
    console.error(`解析第${pageNumber}页HTML失败:`, error);
    return [];
  }
}

// 从文档中获取商品元素（类似getProductElements但用于解析的文档）
function getProductElementsFromDoc(doc) {
  let elements = [];

  // 尝试不同的选择器
  for (const selector of LIST_SELECTORS.productContainers) {
    elements = doc.querySelectorAll(selector);
    if (elements.length > 0) {
      break;
    }
  }

  // 过滤掉无效的元素
  return Array.from(elements).filter(element => {
    // 确保元素包含基本信息
    return element.querySelector('h2') || element.querySelector('.a-size-base-plus');
  });
}

// 获取当前页码
function getCurrentPageNumber() {
  const currentPageElement = document.querySelector('.s-pagination-selected');
  if (currentPageElement) {
    const pageText = currentPageElement.textContent.trim();
    const pageNumber = parseInt(pageText);
    return isNaN(pageNumber) ? 1 : pageNumber;
  }
  return 1;
}

// 获取总页数（如果可见）
function getTotalPages() {
  const pageLinks = document.querySelectorAll('.s-pagination-button');
  let maxPage = 1;

  pageLinks.forEach(link => {
    const pageText = link.textContent.trim();
    const pageNumber = parseInt(pageText);
    if (!isNaN(pageNumber) && pageNumber > maxPage) {
      maxPage = pageNumber;
    }
  });

  // 检查是否有省略号，表示还有更多页面
  const hasEllipsis = document.querySelector('.s-pagination-ellipsis') !== null;
  if (hasEllipsis) {
    // 如果有省略号，实际页数可能更多
    return maxPage + '+';
  }

  return maxPage;
}


