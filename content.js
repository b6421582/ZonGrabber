// ZonGrabber Content Script
// 负责从亚马逊页面提取商品数据

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
  // 方法1: 从data-asin属性
  const asinElement = document.querySelector('[data-asin]');
  if (asinElement) {
    return asinElement.getAttribute('data-asin');
  }
  
  // 方法2: 从URL
  const urlMatch = window.location.href.match(/\/dp\/([A-Z0-9]{10})/);
  if (urlMatch) {
    return urlMatch[1];
  }
  
  // 方法3: 从隐藏输入框
  const hiddenInput = document.querySelector('input[name="ASIN"]');
  if (hiddenInput) {
    return hiddenInput.value;
  }
  
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
      console.log('SiteStripe不可用');
      return affiliateInfo;
    }

    affiliateInfo.siteStripeAvailable = true;
    console.log('SiteStripe可用');

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
