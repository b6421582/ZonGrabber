// ZonGrabber Background Script
// 处理插件的后台逻辑和侧边栏管理

chrome.runtime.onInstalled.addListener(() => {
  console.log('ZonGrabber 插件已安装');
});

// 监听插件图标点击事件
chrome.action.onClicked.addListener(async (tab) => {
  // 检查是否为亚马逊页面
  if (isAmazonPage(tab.url)) {
    // 打开侧边栏
    await chrome.sidePanel.open({ tabId: tab.id });
  } else {
    // 显示提示信息
    chrome.tabs.sendMessage(tab.id, {
      action: 'showNotification',
      message: '请在亚马逊商品页面使用此插件'
    });
  }
});

// 监听来自content script的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Background received message:', request.action);

  try {
    switch (request.action) {
      case 'getProductData':
        handleGetProductData(request, sender, sendResponse);
        break;
      case 'getListProducts':
        handleGetListProducts(request, sender, sendResponse);
        break;
      case 'getPageType':
        handleGetPageType(request, sender, sendResponse);
        break;
      case 'pageChanged':
        handlePageChanged(request, sender, sendResponse);
        break;
      default:
        console.log('未知消息类型:', request.action);
        sendResponse({ success: false, error: '未知消息类型' });
    }
  } catch (error) {
    console.error('Message handling error:', error);
    sendResponse({ success: false, error: error.message });
  }

  return true; // 保持消息通道开放
});

// 监听标签页激活事件
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  console.log('ZonGrabber: 标签页激活事件', activeInfo);
  notifyPageChange(activeInfo.tabId);
});

// 监听标签页更新事件（URL变化）
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.url) {
    console.log('ZonGrabber: 页面URL变化', changeInfo.url);
    notifyPageChange(tabId);
  }
});

// 处理获取商品数据请求
async function handleGetProductData(request, sender, sendResponse) {
  try {
    // 获取当前活动标签页
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const currentTab = tabs[0];

    if (!currentTab) {
      throw new Error('无法获取当前标签页');
    }

    // 向content script请求数据
    const response = await chrome.tabs.sendMessage(currentTab.id, {
      action: 'extractProductData'
    });
    sendResponse({ success: true, data: response });
  } catch (error) {
    console.error('获取商品数据失败:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// 处理获取列表商品数据请求
async function handleGetListProducts(request, sender, sendResponse) {
  try {
    // 获取当前活动标签页
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const currentTab = tabs[0];

    if (!currentTab) {
      throw new Error('无法获取当前标签页');
    }

    // 向content script请求列表数据
    const response = await chrome.tabs.sendMessage(currentTab.id, {
      action: 'extractListProducts',
      filters: request.filters || {}
    });
    sendResponse({ success: true, data: response });
  } catch (error) {
    console.error('获取列表商品数据失败:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// 处理获取页面类型请求
async function handleGetPageType(request, sender, sendResponse) {
  try {
    // 获取当前活动标签页
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const currentTab = tabs[0];

    if (!currentTab) {
      throw new Error('无法获取当前标签页');
    }

    const pageType = getPageType(currentTab.url);
    sendResponse({ success: true, pageType: pageType, url: currentTab.url });
  } catch (error) {
    console.error('获取页面类型失败:', error);
    sendResponse({ success: false, error: error.message });
  }
}







// 工具函数
function isAmazonPage(url) {
  return url && url.includes('amazon.') && (
    url.includes('/dp/') ||           // 商品详情页
    url.includes('/s?') ||            // 搜索结果页
    url.includes('/gp/search/') ||    // 搜索页面
    url.includes('/b/') ||            // 分类页面
    url.includes('/stores/')          // 品牌店铺页面
  );
}

// 获取页面类型
function getPageType(url) {
  if (!url || !url.includes('amazon.')) return 'unknown';

  if (url.includes('/dp/') || url.includes('/gp/product/')) return 'product';
  if (url.includes('/s?') || url.includes('/gp/search/')) return 'search';
  if (url.includes('/b/')) return 'category';
  if (url.includes('/stores/')) return 'store';
  return 'unknown';
}

// 通知侧边栏页面变化
async function notifyPageChange(tabId) {
  try {
    // 获取标签页信息
    const tab = await chrome.tabs.get(tabId);
    const pageType = getPageType(tab.url);

    console.log('ZonGrabber: 通知页面变化', { tabId, url: tab.url, pageType });

    // 向所有侧边栏发送页面变化通知
    chrome.runtime.sendMessage({
      action: 'pageTypeChanged',
      pageType: pageType,
      url: tab.url,
      tabId: tabId
    }).catch(() => {
      // 忽略没有接收者的错误
    });
  } catch (error) {
    console.log('ZonGrabber: 获取标签页信息失败', error);
  }
}

// 处理页面变化请求
async function handlePageChanged(request, sender, sendResponse) {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const currentTab = tabs[0];

    if (!currentTab) {
      throw new Error('无法获取当前标签页');
    }

    const pageType = getPageType(currentTab.url);
    sendResponse({ success: true, pageType: pageType, url: currentTab.url });
  } catch (error) {
    console.error('处理页面变化失败:', error);
    sendResponse({ success: false, error: error.message });
  }
}




