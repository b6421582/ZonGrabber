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







// 工具函数
function isAmazonPage(url) {
  return url && url.includes('amazon.') && url.includes('/dp/');
}




