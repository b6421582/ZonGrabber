// ZonGrabber 侧边栏脚本

class ZonGrabberPanel {
    constructor() {
        this.currentProductData = null;
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadAffiliateTag(); // 加载保存的联盟标识
        this.loadMinEarnings(); // 加载保存的最低销售佣金设置
        this.loadMinRating(); // 加载保存的最低评分设置
        this.checkPageStatus();
    }

    bindEvents() {
        // 采集按钮
        document.getElementById('extractBtn').addEventListener('click', () => {
            this.extractProductData();
        });

        // 刷新按钮
        document.getElementById('refreshBtn').addEventListener('click', () => {
            this.refreshPage();
        });

        // 保存联盟标识按钮
        document.getElementById('saveTagBtn').addEventListener('click', () => {
            this.saveAffiliateTag();
        });

        // 复制联盟链接按钮
        document.getElementById('copyUrlBtn').addEventListener('click', () => {
            this.copyAffiliateUrl();
        });

        // 设置区域折叠功能
        document.getElementById('settingsHeader').addEventListener('click', () => {
            this.toggleSettings();
        });

        // 保存销售佣金设置按钮
        document.getElementById('saveEarningsBtn').addEventListener('click', () => {
            this.saveMinEarnings();
        });

        // 保存评分设置按钮
        document.getElementById('saveRatingBtn').addEventListener('click', () => {
            this.saveMinRating();
        });



        // 导出按钮
        document.getElementById('exportJsonBtn').addEventListener('click', () => {
            this.exportData('json');
        });





        // 标签页切换
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });
    }

    async checkPageStatus() {
        try {
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            const currentTab = tabs[0];
            
            if (this.isAmazonProductPage(currentTab.url)) {
                this.updateStatus('ready', '准备采集');
            } else {
                this.updateStatus('error', '请打开亚马逊商品页面');
            }
        } catch (error) {
            console.error('检查页面状态失败:', error);
            this.updateStatus('error', '无法检查页面状态');
        }
    }

    isAmazonProductPage(url) {
        return url && url.includes('amazon.') && url.includes('/dp/');
    }

    updateStatus(type, message) {
        const indicator = document.getElementById('statusIndicator');
        const dot = indicator.querySelector('.status-dot');
        const text = indicator.querySelector('.status-text');
        
        dot.className = `status-dot ${type}`;
        text.textContent = message;
    }

    async extractProductData() {
        try {
            this.showLoading(true);
            this.updateStatus('active', '正在采集数据...');

            // 获取当前活动标签页
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            const currentTab = tabs[0];

            if (!currentTab) {
                throw new Error('无法获取当前标签页');
            }

            if (!this.isAmazonProductPage(currentTab.url)) {
                throw new Error('请在亚马逊商品页面使用此功能');
            }

            // 首先检查content script是否已加载
            try {
                await chrome.tabs.sendMessage(currentTab.id, { action: 'ping' });
            } catch (error) {
                console.log('重新注入content script...');
                // 如果content script未加载，重新注入
                await chrome.scripting.executeScript({
                    target: { tabId: currentTab.id },
                    files: ['content.js']
                });
                // 等待一下让脚本初始化
                await new Promise(resolve => setTimeout(resolve, 2000));
            }

            // 设置超时保护
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => {
                    reject(new Error('数据采集超时，请刷新页面后重试'));
                }, 35000); // 35秒超时
            });

            // 发送消息给background script请求数据
            const dataPromise = chrome.runtime.sendMessage({
                action: 'getProductData'
            });

            // 使用Promise.race来实现超时
            const response = await Promise.race([dataPromise, timeoutPromise]);

            if (response && response.success) {
                this.currentProductData = response.data;
                this.displayProductData(response.data);
                this.updateStatus('ready', '采集完成');
                this.showMessage('数据采集成功！', 'success');
            } else {
                throw new Error(response?.error || '数据采集失败');
            }
        } catch (error) {
            console.error('采集数据失败:', error);
            this.updateStatus('error', '采集失败');

            // 根据错误类型提供不同的提示
            let errorMessage = error.message;
            if (error.message.includes('超时')) {
                errorMessage += '\n\n建议：\n1. 刷新页面后重试\n2. 确保页面完全加载\n3. 检查网络连接';
            }

            this.showMessage(errorMessage, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async displayProductData(data) {
        // 如果没有ASIN，尝试从URL中提取
        if (!data.asin && data.url) {
            const extractedAsin = this.extractAsinFromUrl(data.url);
            if (extractedAsin) {
                data.asin = extractedAsin;
                data.asinSource = 'url';
                console.log('从URL中补充提取到ASIN:', extractedAsin);
            }
        }

        // 如果还是没有ASIN，尝试从当前页面URL提取
        if (!data.asin) {
            try {
                const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
                if (tabs[0] && tabs[0].url) {
                    const extractedAsin = this.extractAsinFromUrl(tabs[0].url);
                    if (extractedAsin) {
                        data.asin = extractedAsin;
                        data.asinSource = 'url';
                        console.log('从当前页面URL中补充提取到ASIN:', extractedAsin);
                    }
                }
            } catch (error) {
                console.warn('无法获取当前页面URL:', error);
            }
        }

        // 自动添加联盟标识到URL，生成精简格式
        const affiliateTag = await this.getAffiliateTag();
        if (affiliateTag && data.asin) {
            // 生成精简的联盟链接格式：https://www.amazon.com/dp/ASIN?tag=affiliate-tag
            data.url = this.generateCleanAffiliateUrl(data.asin, affiliateTag);
            console.log('已生成精简联盟链接:', data.url);

            // 同时保存原始URL（如果需要的话）
            if (!data.originalUrl) {
                data.originalUrl = data.url;
            }
        } else if (!data.asin) {
            console.warn('无法生成联盟链接：缺少ASIN');
        }

        // 显示商品预览
        this.showProductPreview(data);

        // 显示详细数据
        this.showDataDetails(data);
    }

    showProductPreview(data) {
        const preview = document.getElementById('productPreview');

        // 设置商品图片
        const img = document.getElementById('productImage');
        if (data.images && data.images.length > 0) {
            // 查找第一个有效的商品图片
            const validImage = this.findValidProductImage(data.images);
            if (validImage) {
                img.src = validImage;
                img.style.display = 'block';

                // 添加图片加载错误处理
                img.onerror = () => {
                    console.warn('图片加载失败:', validImage);
                    img.style.display = 'none';
                };
            } else {
                img.style.display = 'none';
            }
        } else {
            img.style.display = 'none';
        }

        // 设置商品信息
        document.getElementById('productTitle').textContent = data.title || '未知商品';
        document.getElementById('productBrand').textContent = data.brand || '未知品牌';
        document.getElementById('productASIN').textContent = data.asin || '未知ASIN';
        document.getElementById('currentPrice').textContent = data.currentPrice ? `$${data.currentPrice}` : '价格未知';
        document.getElementById('productRating').textContent = data.rating ? `⭐ ${data.rating}` : '无评分';

        // 检查并显示佣金状态
        this.checkAndDisplayEarningsStatus(data);

        preview.style.display = 'block';
    }

    findValidProductImage(images) {
        // 过滤模式，与content.js保持一致
        const filterPatterns = [
            /Prime_Logo_RGB_Prime_Blue_MASTER/,
            /imageBlock-360-thumbnail-icon/,
            /play-button-mb-image-grid/,
            /marketing\/prime/,
            /\.SS125_/,
            /CustomProduct/,
            /HomeCustomProduct/,
            /_SR\d+,\d+_/,
            /_PKplay-button/
        ];

        // 优先选择高分辨率图片
        const hiResImages = images.filter(image => {
            const shouldFilter = filterPatterns.some(pattern => pattern.test(image));
            const isValidPath = image.includes('/images/I/') || image.includes('media-amazon.com/images/I/');
            const isHiRes = /_AC_SX\d+_|_AC_SY\d+_|_SL\d+_/.test(image);

            return !shouldFilter && isValidPath && isHiRes;
        });

        if (hiResImages.length > 0) {
            return hiResImages[0];
        }

        // 如果没有高分辨率图片，选择任何有效的商品图片
        for (const image of images) {
            const shouldFilter = filterPatterns.some(pattern => pattern.test(image));

            if (!shouldFilter && (image.includes('/images/I/') || image.includes('media-amazon.com/images/I/'))) {
                return image;
            }
        }

        return null;
    }

    showDataDetails(data) {
        // 基础信息
        const asinElement = document.getElementById('detailASIN');
        if (data.asin) {
            asinElement.textContent = data.asin;
            // 如果ASIN是从URL提取的，添加提示
            if (data.asinSource === 'url') {
                asinElement.title = 'ASIN从URL中提取';
                asinElement.style.color = '#007bff';
            } else {
                asinElement.title = '';
                asinElement.style.color = '';
            }
        } else {
            asinElement.textContent = '-';
            asinElement.title = '';
            asinElement.style.color = '';
        }
        document.getElementById('detailBrand').textContent = data.brand || '-';
        document.getElementById('detailCurrentPrice').textContent = data.currentPrice ? `$${data.currentPrice}` : '-';
        document.getElementById('detailOriginalPrice').textContent = data.originalPrice ? `$${data.originalPrice}` : '-';
        document.getElementById('detailRating').textContent = data.rating || '-';
        document.getElementById('detailReviewCount').textContent = data.reviewCount || '-';
        document.getElementById('detailStockStatus').textContent = data.stockStatus || '-';
        document.getElementById('detailCategory').textContent = data.category || '-';

        // 显示联盟链接
        const affiliateUrlInput = document.getElementById('affiliateUrl');
        if (data.url) {
            affiliateUrlInput.value = data.url;
        } else {
            affiliateUrlInput.value = '未生成联盟链接';
        }

        // 评论数据
        this.displayReviews(data.reviews || []);

        // 变体信息
        this.displayVariants(data.variants || {});

        // 联盟信息
        this.displayAffiliateInfo(data.affiliateInfo || {});

        // 原始数据
        document.getElementById('rawDataText').value = JSON.stringify(data, null, 2);

        document.getElementById('dataDetails').style.display = 'block';
    }

    displayReviews(reviews) {
        const summaryDiv = document.getElementById('reviewsSummary');
        const listDiv = document.getElementById('reviewsList');

        if (reviews.length === 0) {
            summaryDiv.textContent = '暂无评论数据';
            listDiv.textContent = '暂无评论';
            return;
        }

        // 评论概览
        const avgRating = reviews.reduce((sum, r) => sum + parseFloat(r.rating || 0), 0) / reviews.length;
        summaryDiv.innerHTML = `
            <div>总评论数: ${reviews.length}</div>
            <div>平均评分: ${avgRating.toFixed(1)} ⭐</div>
        `;

        // 评论列表
        listDiv.innerHTML = reviews.slice(0, 3).map(review => `
            <div class="review-item">
                <div class="review-header">
                    <span>${'⭐'.repeat(parseInt(review.rating || 0))}</span>
                    <span>${review.author || '匿名'}</span>
                </div>
                <div class="review-content">${review.content || '无内容'}</div>
            </div>
        `).join('');
    }

    displayVariants(variants) {
        const variantsDiv = document.getElementById('variantsInfo');

        // 检查是否有任何变体信息
        const hasVariants = variants && (
            (variants.colors && variants.colors.length > 0) ||
            (variants.sizes && variants.sizes.length > 0) ||
            (variants.styles && variants.styles.length > 0) ||
            (variants.patterns && variants.patterns.length > 0) ||
            (variants.materials && variants.materials.length > 0) ||
            (variants.other && variants.other.length > 0)
        );

        if (!hasVariants) {
            variantsDiv.innerHTML = '<div style="color: #6c757d; text-align: center; padding: 20px;">暂无变体信息</div>';
            return;
        }

        let html = '<div class="variants-container">';

        if (variants.colors && variants.colors.length > 0) {
            html += `<div class="variant-item">
                <strong>颜色选项:</strong>
                <span class="variant-list">${variants.colors.join(', ')}</span>
            </div>`;
        }

        if (variants.sizes && variants.sizes.length > 0) {
            html += `<div class="variant-item">
                <strong>尺寸选项:</strong>
                <span class="variant-list">${variants.sizes.join(', ')}</span>
            </div>`;
        }

        if (variants.styles && variants.styles.length > 0) {
            html += `<div class="variant-item">
                <strong>样式选项:</strong>
                <span class="variant-list">${variants.styles.join(', ')}</span>
            </div>`;
        }

        if (variants.patterns && variants.patterns.length > 0) {
            html += `<div class="variant-item">
                <strong>图案选项:</strong>
                <span class="variant-list">${variants.patterns.join(', ')}</span>
            </div>`;
        }

        if (variants.materials && variants.materials.length > 0) {
            html += `<div class="variant-item">
                <strong>材质选项:</strong>
                <span class="variant-list">${variants.materials.join(', ')}</span>
            </div>`;
        }

        if (variants.other && variants.other.length > 0) {
            html += `<div class="variant-item">
                <strong>其他选项:</strong>
                <span class="variant-list">${variants.other.join(', ')}</span>
            </div>`;
        }

        html += '</div>';
        variantsDiv.innerHTML = html;
    }

    displayAffiliateInfo(affiliateInfo) {
        // 更新SiteStripe状态
        const statusElement = document.getElementById('siteStripeStatus');

        if (affiliateInfo.siteStripeAvailable) {
            statusElement.innerHTML = '<span style="color: green;">✓ 可用</span>';
        } else {
            statusElement.innerHTML = '<span style="color: red;">✗ 不可用</span>';
        }

        // 更新联盟信息
        document.getElementById('affiliateCategory').textContent = affiliateInfo.category || '-';

        // 更新佣金率并检查状态
        this.updateCommissionRateDisplay(affiliateInfo.commissionRate);

        // 计算销售佣金
        this.calculateAffiliateEarnings(affiliateInfo);
    }

    calculateAffiliateEarnings(affiliateInfo) {
        const earningsElement = document.getElementById('affiliateEarnings');

        // 获取价格信息
        let priceToUse = this.currentProductData?.currentPrice;
        const priceRange = this.currentProductData?.priceRange;
        const commissionRateText = affiliateInfo.commissionRate;

        // 如果没有当前价格但有价格区间，使用最低价格
        if (!priceToUse && priceRange && priceRange.min) {
            priceToUse = priceRange.min;
        }

        if (!priceToUse || !commissionRateText) {
            earningsElement.textContent = '-';
            return 0;
        }

        try {
            // 提取价格数字（去除货币符号和逗号）
            const priceMatch = priceToUse.toString().replace(/[,$]/g, '').match(/[\d.]+/);
            const price = priceMatch ? parseFloat(priceMatch[0]) : 0;

            // 提取佣金率数字（去除百分号）
            const rateMatch = commissionRateText.toString().replace('%', '').match(/[\d.]+/);
            const rate = rateMatch ? parseFloat(rateMatch[0]) : 0;

            if (price > 0 && rate > 0) {
                // 计算佣金：价格 × 佣金率 / 100
                const earnings = (price * rate / 100).toFixed(2);
                const earningsValue = parseFloat(earnings);
                let displayText = `<span style="color: #28a745; font-weight: 600;">$${earnings}</span>`;

                // 如果使用的是价格区间，添加说明
                if (priceRange && priceRange.min && !this.currentProductData?.currentPrice) {
                    displayText += `<br><small style="color: #6c757d;">(基于最低价格)</small>`;
                }

                earningsElement.innerHTML = displayText;
                return earningsValue;
            } else {
                earningsElement.textContent = '-';
                return 0;
            }
        } catch (error) {
            console.error('计算销售佣金失败:', error);
            earningsElement.textContent = '-';

            // 调试信息
            console.log('佣金计算详情:', {
                currentPrice: this.currentProductData?.currentPrice,
                priceRange: priceRange,
                priceUsed: priceToUse,
                commissionRate: commissionRateText,
                error: error.message
            });

            return 0;
        }
    }

    switchTab(tabName) {
        // 更新标签按钮状态
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // 更新标签页内容
        document.querySelectorAll('.tab-pane').forEach(pane => {
            pane.classList.remove('active');
        });
        document.getElementById(`${tabName}Tab`).classList.add('active');
    }



    async refreshPage() {
        try {
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            await chrome.tabs.reload(tabs[0].id);
            this.showMessage('页面已刷新', 'success');
        } catch (error) {
            console.error('刷新页面失败:', error);
            this.showMessage('刷新失败', 'error');
        }
    }

    async exportData(format) {
        try {
            if (!this.currentProductData) {
                this.showMessage('没有可导出的数据，请先采集商品信息', 'warning');
                return;
            }

            if (format !== 'json') {
                this.showMessage('仅支持JSON格式导出', 'error');
                return;
            }

            // 准备导出数据，清理空值和不需要的字段
            const rawData = { ...this.currentProductData };

            // 如果没有ASIN，尝试从URL中提取
            if (!rawData.asin && rawData.url) {
                const extractedAsin = this.extractAsinFromUrl(rawData.url);
                if (extractedAsin) {
                    rawData.asin = extractedAsin;
                    console.log('导出时从URL中补充提取到ASIN:', extractedAsin);
                }
            }

            // 确保使用简化的联盟链接
            const affiliateTag = await this.getAffiliateTag();
            if (affiliateTag && rawData.asin) {
                rawData.url = this.generateCleanAffiliateUrl(rawData.asin, affiliateTag);
                console.log('导出数据使用简化联盟链接:', rawData.url);
            }

            // 清理和优化导出数据
            const exportDataObj = this.cleanExportData(rawData);

            const exportData = JSON.stringify(exportDataObj, null, 2);
            // 生成文件名，优先使用ASIN，其次使用商品标题的一部分
            let fileIdentifier = 'unknown';
            if (this.currentProductData.asin) {
                fileIdentifier = this.currentProductData.asin;
            } else if (this.currentProductData.title) {
                // 使用标题的前20个字符作为标识符
                fileIdentifier = this.currentProductData.title
                    .replace(/[^a-zA-Z0-9\s]/g, '') // 移除特殊字符
                    .replace(/\s+/g, '_') // 空格替换为下划线
                    .substring(0, 20);
            }

            const filename = `amazon_product_${fileIdentifier}_${this.getDateString()}.json`;

            // 创建下载链接
            const blob = new Blob([exportData], { type: 'application/json' });
            const url = URL.createObjectURL(blob);

            // 创建临时下载链接
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            // 清理URL
            URL.revokeObjectURL(url);

            this.showMessage('数据导出成功', 'success');
            console.log('导出的数据:', exportDataObj);
        } catch (error) {
            console.error('导出失败:', error);
            this.showMessage(error.message, 'error');
        }
    }





    showLoading(show) {
        document.getElementById('loadingOverlay').style.display = show ? 'flex' : 'none';
    }

    showMessage(message, type = 'info') {
        const toast = document.getElementById('messageToast');
        const textElement = toast.querySelector('.message-text');

        textElement.textContent = message;
        toast.className = `message-toast ${type}`;
        toast.style.display = 'block';

        setTimeout(() => {
            toast.style.display = 'none';
        }, 3000);
    }

    getDateString() {
        return new Date().toISOString().split('T')[0];
    }

    // 加载保存的联盟标识
    loadAffiliateTag() {
        chrome.storage.local.get(['affiliateTag'], (result) => {
            if (result.affiliateTag) {
                document.getElementById('affiliateTag').value = result.affiliateTag;
                console.log('已加载联盟标识:', result.affiliateTag);
            }
        });
    }

    // 保存联盟标识
    saveAffiliateTag() {
        const tagInput = document.getElementById('affiliateTag');
        const tag = tagInput.value.trim();

        if (!tag) {
            this.showMessage('请输入联盟标识', 'warning');
            return;
        }

        // 验证联盟标识格式（通常以-20结尾）
        if (!tag.match(/^[\w-]+(-20)?$/)) {
            this.showMessage('联盟标识格式可能不正确，通常格式为：your-tag-20', 'warning');
        }

        // 保存到本地存储
        chrome.storage.local.set({ affiliateTag: tag }, () => {
            this.showMessage('联盟标识已保存', 'success');
            console.log('联盟标识已保存:', tag);

            // 如果当前有商品数据，更新URL
            if (this.currentProductData) {
                this.updateProductUrlWithTag(tag);
            }
        });
    }

    // 更新商品URL中的联盟标识
    updateProductUrlWithTag(tag) {
        if (!this.currentProductData || !this.currentProductData.asin) {
            return;
        }

        try {
            // 使用精简格式重新生成URL
            this.currentProductData.url = this.generateCleanAffiliateUrl(this.currentProductData.asin, tag);
            console.log('已更新为精简联盟链接:', this.currentProductData.url);
        } catch (error) {
            console.warn('更新URL联盟标识失败:', error);
        }
    }

    // 获取当前保存的联盟标识
    async getAffiliateTag() {
        return new Promise((resolve) => {
            chrome.storage.local.get(['affiliateTag'], (result) => {
                resolve(result.affiliateTag || '');
            });
        });
    }

    // 生成精简的联盟链接
    generateCleanAffiliateUrl(asin, affiliateTag) {
        if (!asin || !affiliateTag) {
            return '';
        }

        // 检测当前亚马逊域名
        let domain = 'amazon.com';
        try {
            // 从当前标签页获取域名
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs[0] && tabs[0].url) {
                    const url = new URL(tabs[0].url);
                    if (url.hostname.includes('amazon.')) {
                        domain = url.hostname.replace('www.', '');
                    }
                }
            });
        } catch (error) {
            // 使用默认域名
        }

        // 生成精简格式：https://www.amazon.com/dp/ASIN?tag=affiliate-tag
        const cleanUrl = `https://www.${domain}/dp/${asin}?tag=${affiliateTag}`;

        console.log('生成精简联盟链接:', {
            asin: asin,
            tag: affiliateTag,
            domain: domain,
            url: cleanUrl
        });

        return cleanUrl;
    }

    // 从任意亚马逊URL中提取ASIN
    extractAsinFromUrl(url) {
        if (!url) return '';

        console.log('从URL提取ASIN:', url);

        // 匹配各种ASIN格式
        const asinPatterns = [
            /\/dp\/([A-Z0-9]{10})/i,           // /dp/ASIN
            /\/gp\/product\/([A-Z0-9]{10})/i,  // /gp/product/ASIN
            /\/product\/([A-Z0-9]{10})/i,      // /product/ASIN
            /asin=([A-Z0-9]{10})/i,            // asin=ASIN
            /\/([A-Z0-9]{10})(?:\/|\?|$)/i,    // 直接的ASIN格式
            /\/([A-Z0-9]{10})(?:#.*)?$/i       // 末尾的ASIN
        ];

        for (const pattern of asinPatterns) {
            const match = url.match(pattern);
            if (match && match[1]) {
                console.log('成功从URL提取ASIN:', match[1], '使用模式:', pattern);
                return match[1];
            }
        }

        console.warn('无法从URL提取ASIN:', url);
        return '';
    }

    // 复制联盟链接
    async copyAffiliateUrl() {
        try {
            const urlInput = document.getElementById('affiliateUrl');
            const copyBtn = document.getElementById('copyUrlBtn');
            const url = urlInput.value;

            if (!url || url === '未生成联盟链接') {
                this.showMessage('没有可复制的联盟链接', 'warning');
                return;
            }

            await navigator.clipboard.writeText(url);

            // 更新按钮状态
            const originalText = copyBtn.textContent;
            copyBtn.textContent = '已复制!';
            copyBtn.style.background = 'linear-gradient(135deg, #28a745, #20c997)';

            this.showMessage('精简联盟链接已复制到剪贴板', 'success');

            // 选中文本以提供视觉反馈
            urlInput.select();

            // 恢复按钮状态
            setTimeout(() => {
                copyBtn.textContent = originalText;
                copyBtn.style.background = '';
                urlInput.blur();
            }, 2000);

        } catch (error) {
            console.error('复制失败:', error);
            this.showMessage('复制失败，请手动选择链接', 'error');

            // 如果复制失败，选中文本让用户手动复制
            const urlInput = document.getElementById('affiliateUrl');
            urlInput.select();
        }
    }

    // 折叠/展开设置区域
    toggleSettings() {
        const content = document.getElementById('settingsContent');
        const btn = document.getElementById('collapseBtn');

        if (content.classList.contains('collapsed')) {
            content.classList.remove('collapsed');
            btn.classList.remove('collapsed');
            btn.textContent = '▼';
        } else {
            content.classList.add('collapsed');
            btn.classList.add('collapsed');
            btn.textContent = '▶';
        }
    }

    // 加载最低销售佣金设置
    loadMinEarnings() {
        chrome.storage.local.get(['minEarnings'], (result) => {
            if (result.minEarnings) {
                document.getElementById('minEarnings').value = result.minEarnings;
                console.log('已加载最低销售佣金设置:', result.minEarnings);
            }
        });
    }

    // 保存最低销售佣金设置
    saveMinEarnings() {
        const earningsInput = document.getElementById('minEarnings');
        const earnings = parseFloat(earningsInput.value);

        if (isNaN(earnings) || earnings < 0 || earnings > 100) {
            this.showMessage('请输入有效的销售佣金 ($0-100)', 'warning');
            return;
        }

        chrome.storage.local.set({ minEarnings: earnings }, () => {
            this.showMessage('销售佣金设置已保存', 'success');
            console.log('销售佣金设置已保存:', earnings);

            // 折叠设置区域
            const content = document.getElementById('settingsContent');
            const btn = document.getElementById('collapseBtn');
            content.classList.add('collapsed');
            btn.classList.add('collapsed');
            btn.textContent = '▶';

            // 如果当前有商品数据，重新检查状态
            if (this.currentProductData) {
                this.checkAndDisplayEarningsStatus(this.currentProductData);
            }
        });
    }

    // 检查并显示商品推荐状态
    async checkAndDisplayEarningsStatus(data) {
        const statusElement = document.getElementById('earningsStatus');

        // 检查各项条件
        const checks = await this.performProductChecks(data);

        // 如果没有任何检查项，隐藏状态
        if (!checks.hasAnyCheck) {
            statusElement.style.display = 'none';
            return;
        }

        // 显示状态
        statusElement.style.display = 'block';

        // 判断是否推荐
        const isRecommended = checks.earningsOk && checks.reviewsOk && checks.ratingOk;

        if (isRecommended) {
            // 推荐商品 - 绿色
            statusElement.className = 'earnings-status good';
            statusElement.innerHTML = `
                <span class="status-icon">✅</span>
                <strong>推荐商品</strong>
                <div class="status-details">
                    💰 佣金: $${checks.earnings.toFixed(2)} | ⭐ 评分: ${checks.rating} | 💬 评论: ${checks.reviewCount}
                </div>
            `;
        } else {
            // 不推荐商品 - 红色
            statusElement.className = 'earnings-status bad';
            let reasons = [];

            if (!checks.earningsOk && checks.minEarnings > 0) {
                reasons.push(`佣金低($${checks.earnings.toFixed(2)}<$${checks.minEarnings.toFixed(2)})`);
            }
            if (!checks.reviewsOk) {
                reasons.push('无评论数据');
            }
            if (!checks.ratingOk) {
                const minRating = await this.getMinRating();
                reasons.push(`评分低(${checks.rating}<${minRating})`);
            }

            statusElement.innerHTML = `
                <span class="status-icon">❌</span>
                <strong>不推荐</strong>
                <div class="status-details">
                    ${reasons.join(' | ')}
                </div>
            `;
        }
    }

    // 执行商品检查
    async performProductChecks(data) {
        const checks = {
            hasAnyCheck: false,
            earningsOk: true,
            reviewsOk: true,
            ratingOk: true,
            earnings: 0,
            minEarnings: 0,
            rating: 0,
            reviewCount: 0
        };

        // 检查销售佣金
        if (data.affiliateInfo && data.affiliateInfo.siteStripeAvailable) {
            checks.earnings = this.calculateEarningsValue(data);
            checks.minEarnings = await this.getMinEarnings();

            if (checks.minEarnings > 0) {
                checks.hasAnyCheck = true;
                checks.earningsOk = checks.earnings >= checks.minEarnings;
            }
        }

        // 检查评论数据
        if (data.reviews) {
            checks.hasAnyCheck = true;
            checks.reviewCount = Array.isArray(data.reviews) ? data.reviews.length : 0;
            checks.reviewsOk = checks.reviewCount > 0;
        }

        // 检查评分
        if (data.rating) {
            checks.hasAnyCheck = true;
            const ratingMatch = data.rating.toString().match(/[\d.]+/);
            checks.rating = ratingMatch ? parseFloat(ratingMatch[0]) : 0;

            const minRating = await this.getMinRating();
            checks.ratingOk = checks.rating >= minRating;
        }

        return checks;
    }

    // 计算销售佣金值（不更新UI）
    calculateEarningsValue(data) {
        if (!data.affiliateInfo || !data.affiliateInfo.commissionRate) {
            return 0;
        }

        // 获取价格信息
        let priceToUse = data.currentPrice;
        const priceRange = data.priceRange;

        // 如果没有当前价格但有价格区间，使用最低价格
        if (!priceToUse && priceRange && priceRange.min) {
            priceToUse = priceRange.min;
        }

        if (!priceToUse) {
            return 0;
        }

        try {
            // 提取价格数字（去除货币符号和逗号）
            const priceMatch = priceToUse.toString().replace(/[,$]/g, '').match(/[\d.]+/);
            const price = priceMatch ? parseFloat(priceMatch[0]) : 0;

            // 提取佣金率数字（去除百分号）
            const rateMatch = data.affiliateInfo.commissionRate.toString().replace('%', '').match(/[\d.]+/);
            const rate = rateMatch ? parseFloat(rateMatch[0]) : 0;

            if (price > 0 && rate > 0) {
                // 计算佣金：价格 × 佣金率 / 100
                return price * rate / 100;
            }
        } catch (error) {
            console.error('计算销售佣金失败:', error);
        }

        return 0;
    }

    // 获取最低销售佣金设置
    async getMinEarnings() {
        return new Promise((resolve) => {
            chrome.storage.local.get(['minEarnings'], (result) => {
                resolve(result.minEarnings || 0);
            });
        });
    }

    // 加载最低评分设置
    loadMinRating() {
        chrome.storage.local.get(['minRating'], (result) => {
            if (result.minRating) {
                document.getElementById('minRating').value = result.minRating;
                console.log('已加载最低评分设置:', result.minRating);
            }
        });
    }

    // 保存最低评分设置
    saveMinRating() {
        const ratingInput = document.getElementById('minRating');
        const rating = parseFloat(ratingInput.value);

        if (isNaN(rating) || rating < 1 || rating > 5) {
            this.showMessage('请输入有效的评分 (1-5)', 'warning');
            return;
        }

        chrome.storage.local.set({ minRating: rating }, () => {
            this.showMessage('评分设置已保存', 'success');
            console.log('评分设置已保存:', rating);

            // 如果当前有商品数据，重新检查状态
            if (this.currentProductData) {
                this.checkAndDisplayEarningsStatus(this.currentProductData);
            }
        });
    }

    // 获取最低评分设置
    async getMinRating() {
        return new Promise((resolve) => {
            chrome.storage.local.get(['minRating'], (result) => {
                resolve(result.minRating || 3.5);
            });
        });
    }

    // 更新佣金率显示（简化版）
    updateCommissionRateDisplay(commissionRateText) {
        const commissionElement = document.getElementById('affiliateCommission');
        commissionElement.textContent = commissionRateText || '-';
    }

    // 清理导出数据，移除空值和不需要的字段
    cleanExportData(data) {
        const cleanData = {};

        // 基础信息 - 只保留有值的字段
        if (data.asin) cleanData.asin = data.asin;
        if (data.title) cleanData.title = data.title;
        if (data.brand) cleanData.brand = data.brand;
        if (data.url) cleanData.url = data.url;

        // 价格信息 - 只保留有值的字段
        if (data.currentPrice) cleanData.currentPrice = data.currentPrice;
        if (data.originalPrice) cleanData.originalPrice = data.originalPrice;
        // priceRange 只有在有实际数据时才保留
        if (data.priceRange && (data.priceRange.min || data.priceRange.max)) {
            cleanData.priceRange = {};
            if (data.priceRange.min) cleanData.priceRange.min = data.priceRange.min;
            if (data.priceRange.max) cleanData.priceRange.max = data.priceRange.max;
        }

        // 评价信息
        if (data.rating) cleanData.rating = data.rating;
        if (data.reviewCount) cleanData.reviewCount = data.reviewCount;
        if (data.bestSellerRank && data.bestSellerRank.trim()) cleanData.bestSellerRank = data.bestSellerRank;

        // 库存和配送
        if (data.stockStatus) cleanData.stockStatus = data.stockStatus;
        if (data.shippingInfo) cleanData.shippingInfo = data.shippingInfo;
        if (data.primeEligible !== undefined) cleanData.primeEligible = data.primeEligible;

        // 商品详情
        if (data.category) cleanData.category = data.category;

        // 特性 - 只有非空数组才保留
        if (data.features && Array.isArray(data.features) && data.features.length > 0) {
            cleanData.features = data.features;
        }

        // 规格 - 只有非空对象才保留
        if (data.specifications && typeof data.specifications === 'object' && Object.keys(data.specifications).length > 0) {
            cleanData.specifications = data.specifications;
        }

        // 描述
        if (data.description && data.description.trim()) cleanData.description = data.description;

        // 变体信息 - 只保留有数据的变体类型
        if (data.variants && typeof data.variants === 'object') {
            const cleanVariants = {};
            Object.keys(data.variants).forEach(key => {
                if (Array.isArray(data.variants[key]) && data.variants[key].length > 0) {
                    cleanVariants[key] = data.variants[key];
                }
            });
            if (Object.keys(cleanVariants).length > 0) {
                cleanData.variants = cleanVariants;
            }
        }

        // 图片 - 只有非空数组才保留
        if (data.images && Array.isArray(data.images) && data.images.length > 0) {
            cleanData.images = data.images;
        }

        // 评论 - 只有非空数组才保留
        if (data.reviews && Array.isArray(data.reviews) && data.reviews.length > 0) {
            cleanData.reviews = data.reviews;
        }

        // 联盟信息 - 简化版本，只保留核心信息
        if (data.affiliateInfo && data.affiliateInfo.siteStripeAvailable) {
            const affiliateInfo = {};

            if (data.affiliateInfo.category) affiliateInfo.category = data.affiliateInfo.category;
            if (data.affiliateInfo.commissionRate) affiliateInfo.commissionRate = data.affiliateInfo.commissionRate;

            // 添加计算的销售佣金
            const earningsElement = document.getElementById('affiliateEarnings');
            if (earningsElement && earningsElement.textContent !== '-') {
                const earningsText = earningsElement.textContent || earningsElement.innerText;
                const earningsMatch = earningsText.match(/\$[\d.]+/);
                if (earningsMatch) {
                    affiliateInfo.calculatedEarnings = earningsMatch[0];
                }
            }

            // 只有在有实际数据时才添加联盟信息
            if (Object.keys(affiliateInfo).length > 0) {
                cleanData.affiliateInfo = affiliateInfo;
            }
        }

        console.log('清理后的导出数据:', cleanData);
        return cleanData;
    }
}

// 初始化面板
document.addEventListener('DOMContentLoaded', () => {
    new ZonGrabberPanel();
});
