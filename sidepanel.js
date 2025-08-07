// ZonGrabber 侧边栏脚本

class ZonGrabberPanel {
    constructor() {
        this.currentProductData = null;
        this.currentPageType = 'unknown';
        this.pageCheckInterval = null;
        console.log('ZonGrabber: 面板初始化');
        this.init();

        // 页面卸载时清理
        window.addEventListener('beforeunload', () => {
            this.cleanup();
        });
    }

    init() {
        this.bindEvents();
        this.loadAffiliateTag(); // 加载保存的联盟标识
        this.loadMinEarnings(); // 加载保存的最低销售佣金设置
        this.loadMinRating(); // 加载保存的最低评分设置
        this.loadListSettings(); // 加载列表采集设置
        this.setupPageChangeListener(); // 设置页面变化监听
        this.checkPageStatus();
    }

    bindEvents() {
        // 采集按钮 - 根据页面类型调用不同功能
        document.getElementById('extractBtn').addEventListener('click', () => {
            this.handleExtractClick();
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

        // 列表设置相关按钮
        document.getElementById('saveMinSalesBtn').addEventListener('click', () => {
            this.saveMinSales();
        });

        document.getElementById('saveMinListRatingBtn').addEventListener('click', () => {
            this.saveMinListRating();
        });

        document.getElementById('saveMinReviewsBtn').addEventListener('click', () => {
            this.saveMinReviews();
        });

        document.getElementById('saveBrandFilterBtn').addEventListener('click', () => {
            this.saveBrandFilter();
        });

        document.getElementById('saveSortByBtn').addEventListener('click', () => {
            this.saveSortBy();
        });

        // 列表设置折叠功能
        document.getElementById('listCollapseBtn').addEventListener('click', () => {
            this.toggleListSettings();
        });

        // 导出按钮 - 根据页面类型调用不同功能
        document.getElementById('exportBtn').addEventListener('click', () => {
            this.handleExportClick();
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

            console.log('ZonGrabber: 开始检查页面状态，URL =', currentTab.url);

            const pageType = this.getPageType(currentTab.url);
            this.handlePageTypeChanged(pageType, currentTab.url);
        } catch (error) {
            console.error('ZonGrabber: 检查页面状态失败:', error);
            this.updateStatus('error', '无法检查页面状态');
        }
    }

    isAmazonProductPage(url) {
        return url && url.includes('amazon.') && url.includes('/dp/');
    }

    // 获取页面类型
    getPageType(url) {
        console.log('ZonGrabber: 检测页面URL =', url);

        if (!url || !url.includes('amazon.')) {
            console.log('ZonGrabber: 非亚马逊页面');
            return 'unknown';
        }

        if (url.includes('/dp/') || url.includes('/gp/product/')) {
            console.log('ZonGrabber: 检测到商品详情页');
            return 'product';
        }
        if (url.includes('/s?') || url.includes('/gp/search/')) {
            console.log('ZonGrabber: 检测到搜索结果页');
            return 'search';
        }
        if (url.includes('/b/')) {
            console.log('ZonGrabber: 检测到分类页面');
            return 'category';
        }
        if (url.includes('/stores/')) {
            console.log('ZonGrabber: 检测到品牌店铺页');
            return 'store';
        }

        console.log('ZonGrabber: 未知的亚马逊页面类型');
        return 'unknown';
    }

    // 根据页面类型更新UI
    updateUIForPageType(pageType) {
        console.log('ZonGrabber: 更新UI，页面类型 =', pageType);

        // 存储当前页面类型
        this.currentPageType = pageType;

        const extractBtn = document.getElementById('extractBtn');
        const extractBtnIcon = document.getElementById('extractBtnIcon');
        const extractBtnText = document.getElementById('extractBtnText');
        const exportBtn = document.getElementById('exportBtn');
        const exportBtnIcon = document.getElementById('exportBtnIcon');
        const exportBtnText = document.getElementById('exportBtnText');
        const listSettings = document.getElementById('listSettingsSection');

        if (pageType === 'product') {
            // 商品详情页：显示单品采集功能
            console.log('ZonGrabber: 🔄 切换到商品详情页模式');
            extractBtn.style.display = 'block';
            extractBtnIcon.textContent = '📊';
            extractBtnText.textContent = '采集单品';
            exportBtn.style.display = 'block';
            exportBtnIcon.textContent = '📥';
            exportBtnText.textContent = '导出单品';
            listSettings.style.display = 'none';
        } else if (['search', 'category', 'store'].includes(pageType)) {
            // 列表页：显示列表采集功能
            console.log('ZonGrabber: 🔄 切换到列表页模式');
            extractBtn.style.display = 'block';
            extractBtnIcon.textContent = '📋';
            extractBtnText.textContent = '采集列表';
            exportBtn.style.display = 'block';
            exportBtnIcon.textContent = '📋';
            exportBtnText.textContent = '导出列表';
            listSettings.style.display = 'block';
        } else {
            // 其他页面：隐藏功能
            console.log('ZonGrabber: ❌ 非亚马逊页面，隐藏功能');
            extractBtn.style.display = 'none';
            exportBtn.style.display = 'none';
            listSettings.style.display = 'none';
        }
    }

    updateStatus(type, message) {
        const indicator = document.getElementById('statusIndicator');
        const dot = indicator.querySelector('.status-dot');
        const text = indicator.querySelector('.status-text');
        
        dot.className = `status-dot ${type}`;
        text.textContent = message;
    }

    // 处理采集按钮点击
    handleExtractClick() {
        console.log('ZonGrabber: 采集按钮被点击，当前页面类型 =', this.currentPageType);

        if (this.currentPageType === 'product') {
            console.log('ZonGrabber: 执行单品采集');
            this.extractProductData();
        } else if (['search', 'category', 'store'].includes(this.currentPageType)) {
            console.log('ZonGrabber: 执行列表采集');
            this.extractListProducts();
        } else {
            this.showMessage('请在亚马逊页面使用此功能', 'error');
        }
    }

    // 处理导出按钮点击
    handleExportClick() {
        console.log('ZonGrabber: 导出按钮被点击，当前页面类型 =', this.currentPageType);

        if (this.currentPageType === 'product') {
            console.log('ZonGrabber: 执行单品导出');
            this.exportData('json');
        } else if (['search', 'category', 'store'].includes(this.currentPageType)) {
            console.log('ZonGrabber: 执行列表导出');
            this.exportListData();
        } else {
            this.showMessage('没有可导出的数据', 'warning');
        }
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

            const pageType = this.getPageType(currentTab.url);
            if (pageType !== 'product') {
                throw new Error('请在亚马逊商品详情页面使用此功能');
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

    // 列表商品采集函数
    async extractListProducts() {
        try {
            this.showLoading(true);
            this.updateStatus('active', '正在采集列表商品...');

            // 获取当前活动标签页
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            const currentTab = tabs[0];

            if (!currentTab) {
                throw new Error('无法获取当前标签页');
            }

            const pageType = this.getPageType(currentTab.url);
            if (!['search', 'category', 'store'].includes(pageType)) {
                throw new Error('请在亚马逊列表页面使用此功能');
            }

            // 获取过滤条件
            const filters = await this.getListFilters();
            console.log('使用过滤条件:', filters);

            // 首先检查content script是否已加载
            try {
                await chrome.tabs.sendMessage(currentTab.id, { action: 'ping' });
            } catch (error) {
                console.log('重新注入content script...');
                await chrome.scripting.executeScript({
                    target: { tabId: currentTab.id },
                    files: ['content.js']
                });
                await new Promise(resolve => setTimeout(resolve, 2000));
            }

            // 设置超时保护
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => {
                    reject(new Error('列表商品采集超时，请刷新页面后重试'));
                }, 60000); // 60秒超时
            });

            // 发送消息给background script请求列表数据
            const dataPromise = chrome.runtime.sendMessage({
                action: 'getListProducts',
                filters: filters
            });

            // 使用Promise.race来实现超时
            const response = await Promise.race([dataPromise, timeoutPromise]);

            if (response && response.success) {
                this.currentProductData = response.data;
                this.displayListProductsData(response.data);
                this.updateStatus('ready', '列表采集完成');
                this.showMessage(`成功采集 ${response.data.totalFiltered} 个商品！`, 'success');
            } else {
                throw new Error(response?.error || '列表商品采集失败');
            }
        } catch (error) {
            console.error('采集列表商品失败:', error);
            this.updateStatus('error', '列表采集失败');

            let errorMessage = error.message;
            if (error.message.includes('超时')) {
                errorMessage += '\n\n建议：\n1. 刷新页面后重试\n2. 确保页面完全加载\n3. 减少过滤条件';
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
            const earnings = result.minEarnings || 2.00;
            document.getElementById('minEarnings').value = earnings;
            console.log('已加载最低销售佣金设置:', earnings);
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
            // 推荐商品 - 绿色，分行显示
            statusElement.className = 'earnings-status good';
            statusElement.innerHTML = `
                <div><span class="status-icon">✅</span><strong>推荐</strong></div>
                <div>💰 $${checks.earnings.toFixed(2)} | ⭐ ${checks.rating} | 💬 ${checks.reviewCount}</div>
            `;
        } else {
            // 不推荐商品 - 红色
            statusElement.className = 'earnings-status bad';
            let reasons = [];

            if (!checks.earningsOk && checks.minEarnings > 0) {
                reasons.push(`💰 $${checks.earnings.toFixed(2)}<$${checks.minEarnings.toFixed(2)}`);
            }
            if (!checks.reviewsOk) {
                reasons.push('💬 无评论');
            }
            if (!checks.ratingOk) {
                const minRating = await this.getMinRating();
                reasons.push(`⭐ ${checks.rating}<${minRating}`);
            }

            statusElement.innerHTML = `
                <div><span class="status-icon">❌</span><strong>不推荐</strong></div>
                <div>${reasons.join(' | ')}</div>
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
                resolve(result.minEarnings || 2.00);
            });
        });
    }

    // 加载最低评分设置
    loadMinRating() {
        chrome.storage.local.get(['minRating'], (result) => {
            const rating = result.minRating || 3.5;
            document.getElementById('minRating').value = rating;
            console.log('已加载最低评分设置:', rating);
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

    // ==================== 列表采集相关函数 ====================

    // 获取列表过滤条件
    async getListFilters() {
        return {
            minSales: parseInt(document.getElementById('minSales').value) || 0,
            minRating: parseFloat(document.getElementById('minListRating').value) || 0,
            minReviews: parseInt(document.getElementById('minReviews').value) || 0,
            brandFilter: document.getElementById('brandFilter').value.trim(),
            sortBy: document.getElementById('sortBy').value || 'sales'
        };
    }

    // 显示列表商品数据
    displayListProductsData(data) {
        console.log('显示列表商品数据:', data);

        // 隐藏单品预览，显示列表结果
        document.getElementById('productPreview').style.display = 'none';

        // 更新数据详情区域
        const dataDetails = document.getElementById('dataDetails');
        dataDetails.style.display = 'block';

        // 切换到原始数据标签页显示列表结果
        this.switchTab('raw');

        // 在原始数据区域显示格式化的列表结果
        const rawDataText = document.getElementById('rawDataText');
        rawDataText.value = JSON.stringify(data, null, 2);

        // 在基础信息标签页显示汇总信息
        this.displayListSummary(data);
    }

    // 显示列表汇总信息
    displayListSummary(data) {
        // 更新基础信息标签页显示汇总
        document.getElementById('detailASIN').textContent = `共 ${data.totalFiltered} 个商品`;
        document.getElementById('detailBrand').textContent = data.filters.brandFilter || '无品牌筛选';
        document.getElementById('detailCurrentPrice').textContent = `最低销量: ${data.filters.minSales}`;
        document.getElementById('detailOriginalPrice').textContent = `最低评分: ${data.filters.minRating}`;
        document.getElementById('detailRating').textContent = `最低评论数: ${data.filters.minReviews}`;
        document.getElementById('detailReviewCount').textContent = `排序方式: ${this.getSortByText(data.filters.sortBy)}`;
        document.getElementById('detailStockStatus').textContent = `总找到: ${data.totalFound} 个`;
        document.getElementById('detailCategory').textContent = `采集时间: ${new Date(data.extractedAt).toLocaleString()}`;
    }

    // 获取排序方式文本
    getSortByText(sortBy) {
        const sortTexts = {
            'sales': '按销量排序',
            'rating': '按评分排序',
            'price': '按价格排序(低到高)',
            'priceDesc': '按价格排序(高到低)'
        };
        return sortTexts[sortBy] || sortBy;
    }

    // 加载列表设置
    loadListSettings() {
        chrome.storage.local.get([
            'minSales', 'minListRating', 'minReviews',
            'brandFilter', 'sortBy'
        ], (result) => {
            if (result.minSales !== undefined) {
                document.getElementById('minSales').value = result.minSales;
            }
            if (result.minListRating !== undefined) {
                document.getElementById('minListRating').value = result.minListRating;
            }
            if (result.minReviews !== undefined) {
                document.getElementById('minReviews').value = result.minReviews;
            }
            if (result.brandFilter !== undefined) {
                document.getElementById('brandFilter').value = result.brandFilter;
            }
            if (result.sortBy !== undefined) {
                document.getElementById('sortBy').value = result.sortBy;
            }
        });
    }

    // 保存最低销量设置
    saveMinSales() {
        const minSales = document.getElementById('minSales').value;
        chrome.storage.local.set({ minSales: parseInt(minSales) || 0 }, () => {
            this.showMessage('最低销量设置已保存', 'success');
        });
    }

    // 保存最低评分设置（列表用）
    saveMinListRating() {
        const minListRating = document.getElementById('minListRating').value;
        chrome.storage.local.set({ minListRating: parseFloat(minListRating) || 0 }, () => {
            this.showMessage('最低评分设置已保存', 'success');
        });
    }

    // 保存最低评论数设置
    saveMinReviews() {
        const minReviews = document.getElementById('minReviews').value;
        chrome.storage.local.set({ minReviews: parseInt(minReviews) || 0 }, () => {
            this.showMessage('最低评论数设置已保存', 'success');
        });
    }

    // 保存品牌筛选设置
    saveBrandFilter() {
        const brandFilter = document.getElementById('brandFilter').value.trim();
        chrome.storage.local.set({ brandFilter: brandFilter }, () => {
            this.showMessage('品牌筛选设置已保存', 'success');
        });
    }

    // 保存排序方式设置
    saveSortBy() {
        const sortBy = document.getElementById('sortBy').value;
        chrome.storage.local.set({ sortBy: sortBy }, () => {
            this.showMessage('排序方式设置已保存', 'success');
        });
    }

    // 切换列表设置显示
    toggleListSettings() {
        const content = document.getElementById('listSettingsContent');
        const btn = document.getElementById('listCollapseBtn');

        if (content.style.display === 'none') {
            content.style.display = 'block';
            btn.textContent = '▼';
        } else {
            content.style.display = 'none';
            btn.textContent = '▶';
        }
    }

    // 导出列表数据
    async exportListData() {
        try {
            if (!this.currentProductData || !this.currentProductData.products) {
                this.showMessage('没有可导出的列表数据，请先采集列表商品', 'warning');
                return;
            }

            // 清理列表数据，只保留有ASIN的商品
            const validProducts = this.currentProductData.products.filter(product => {
                return product.asin && product.asin.trim() !== '';
            });

            if (validProducts.length === 0) {
                this.showMessage('没有有效的商品数据可导出（需要包含ASIN）', 'warning');
                return;
            }

            // 清理每个商品的数据
            const cleanedProducts = validProducts.map(product => this.cleanListProductData(product));

            // 直接导出商品数组，不包含summary
            const jsonData = JSON.stringify(cleanedProducts, null, 2);

            // 生成文件名
            const brandFilter = this.currentProductData.filters?.brandFilter || '';
            const fileIdentifier = brandFilter ? brandFilter.replace(/[^a-zA-Z0-9]/g, '_') : 'list';
            const filename = `amazon_list_${fileIdentifier}_${this.getDateString()}.json`;

            // 创建下载链接
            const blob = new Blob([jsonData], { type: 'application/json' });
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

            this.showMessage(`成功导出 ${cleanedProducts.length} 个有效商品数据`, 'success');

        } catch (error) {
            console.error('导出列表数据失败:', error);
            this.showMessage('导出列表数据失败: ' + error.message, 'error');
        }
    }

    // 清理单个列表商品数据
    cleanListProductData(product) {
        const cleanData = {};

        // 必需字段
        if (product.asin) cleanData.asin = product.asin;
        if (product.title) cleanData.title = product.title;

        // 基础信息
        if (product.brand) cleanData.brand = product.brand;
        if (product.price) cleanData.price = product.price;
        if (product.rating) cleanData.rating = product.rating;
        if (product.reviewCount) cleanData.reviewCount = product.reviewCount;

        // 链接信息 - 添加联盟标识
        if (product.url) {
            cleanData.url = this.addAffiliateTagToUrl(product.url);
        }

        // 图片
        if (product.image) cleanData.image = product.image;

        // 标识
        if (product.isPrime !== undefined) cleanData.isPrime = product.isPrime;
        if (product.isBestSeller !== undefined) cleanData.isBestSeller = product.isBestSeller;

        // 元数据
        if (product.extractedAt) cleanData.extractedAt = product.extractedAt;
        if (product.sourceIndex !== undefined) cleanData.sourceIndex = product.sourceIndex;

        return cleanData;
    }

    // 添加联盟标识到URL
    addAffiliateTagToUrl(url) {
        try {
            const affiliateTag = document.getElementById('affiliateTag').value.trim();
            if (affiliateTag && url) {
                const urlObj = new URL(url);
                urlObj.searchParams.set('tag', affiliateTag);
                return urlObj.toString();
            }
            return url;
        } catch (error) {
            console.warn('添加联盟标识失败:', error);
            return url;
        }
    }

    // 设置页面变化监听
    setupPageChangeListener() {
        console.log('ZonGrabber: 设置页面变化监听');

        // 监听来自background的页面变化通知
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (message.action === 'pageTypeChanged') {
                console.log('ZonGrabber: 收到页面变化通知', message);
                this.handlePageTypeChanged(message.pageType, message.url);
            }
        });

        // 定期检查页面变化（备用方案）
        this.pageCheckInterval = setInterval(() => {
            this.checkPageStatusSilently();
        }, 2000); // 每2秒检查一次
    }

    // 处理页面类型变化
    handlePageTypeChanged(newPageType, newUrl) {
        console.log('ZonGrabber: 处理页面类型变化', {
            from: this.currentPageType,
            to: newPageType,
            url: newUrl
        });

        if (this.currentPageType !== newPageType) {
            this.currentPageType = newPageType;
            this.updateUIForPageType(newPageType);
            this.updateStatusForPageType(newPageType);
        }
    }

    // 静默检查页面状态（不显示错误）
    async checkPageStatusSilently() {
        try {
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            const currentTab = tabs[0];

            if (!currentTab) return;

            const pageType = this.getPageType(currentTab.url);

            // 只在页面类型真正改变时更新UI
            if (this.currentPageType !== pageType) {
                console.log('ZonGrabber: 检测到页面类型变化', {
                    from: this.currentPageType,
                    to: pageType,
                    url: currentTab.url
                });

                this.handlePageTypeChanged(pageType, currentTab.url);
            }
        } catch (error) {
            // 静默处理错误，不显示给用户
            console.log('ZonGrabber: 静默页面检查失败', error);
        }
    }

    // 根据页面类型更新状态文字
    updateStatusForPageType(pageType) {
        if (pageType === 'product') {
            this.updateStatus('ready', '准备采集单品');
        } else if (['search', 'category', 'store'].includes(pageType)) {
            this.updateStatus('ready', '准备采集列表');
        } else if (pageType === 'unknown') {
            this.updateStatus('error', '请打开亚马逊页面');
        }
    }

    // 清理资源
    cleanup() {
        console.log('ZonGrabber: 清理资源');
        if (this.pageCheckInterval) {
            clearInterval(this.pageCheckInterval);
            this.pageCheckInterval = null;
        }
    }
}

// 初始化面板
document.addEventListener('DOMContentLoaded', () => {
    new ZonGrabberPanel();
});
