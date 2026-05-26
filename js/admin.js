// ==================== admin.js - لوحة التحكم ====================

// دوال مساعدة
function debounce(func, delay) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), delay);
    };
}

// متغيرات مؤقتة لحفظ التعديلات
let tempProducts = {};
let tempAdminZones = [];
let tempPromoCodes = [];

// --- زر تسجيل الخروج ---
window.logoutAdmin = () => {
    firebase.auth().signOut().then(() => {
        localStorage.removeItem('admin_logged_in');
        closeAdminDashboard();
        showAlert("تم", "تم تسجيل الخروج بنجاح.");
    }).catch(e => {
        showAlert("خطأ", "حدث خطأ أثناء تسجيل الخروج.");
    });
};

// تبديل حالة المتجر من المفتاح
document.getElementById('admin-store-open')?.addEventListener('change', function() {
    const label = document.getElementById('store-open-label');
    label.innerText = this.checked ? 'مفتوح' : 'مغلق';
    label.className = this.checked
        ? 'mr-3 text-sm font-black text-green-600 w-12'
        : 'mr-3 text-sm font-black text-red-600 w-12';
});

// فتح/إغلاق نافذة تسجيل الدخول
window.openAdminLogin = () => {
    document.getElementById('admin-login-modal').classList.remove('hidden');
    setTimeout(() => document.getElementById('admin-login-modal').classList.remove('opacity-0'), 10);
    document.getElementById('admin-password-input').value = '';
};
window.closeAdminLogin = () => {
    document.getElementById('admin-login-modal').classList.add('opacity-0');
    setTimeout(() => document.getElementById('admin-login-modal').classList.add('hidden'), 300);
};

// --- تسجيل الدخول مع جلسة مستمرة ---
window.verifyAdminPin = () => {
    const email = document.getElementById('admin-email-input').value.trim();
    const pass = document.getElementById('admin-password-input').value.trim();
    const btn = document.querySelector('#admin-login-modal button[onclick="verifyAdminPin()"]');
    const origHtml = btn.innerHTML;

    if (!email || !pass) {
        showAlert("تنبيه", "يرجى كتابة البريد الإلكتروني وكلمة المرور.");
        return;
    }

    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري التحقق...';
    btn.disabled = true;

    firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL)
        .then(() => firebase.auth().signInWithEmailAndPassword(email, pass))
        .then((userCredential) => {
            localStorage.setItem('admin_logged_in', 'true');
            closeAdminLogin();
            openAdminDashboard();
            btn.innerHTML = origHtml;
            btn.disabled = false;
            document.getElementById('admin-password-input').value = '';
        })
        .catch((error) => {
            btn.innerHTML = origHtml;
            btn.disabled = false;
            showAlert("خطأ", "بيانات الدخول غير صحيحة، أو ليس لديك صلاحية!");
        });
};

let currentAdminTab = 'stats';
let ordersList = [];
let orderFilter = 'all';
window.dispatchOrdersList = [];

// التبديل بين التبويبات
window.switchAdminTab = (tab) => {
    currentAdminTab = tab;
    ['stats', 'store', 'products', 'orders', 'dispatch', 'delivery', 'marketing', 'advanced', 'texts'].forEach(t => {
        const panel = document.getElementById('admin-panel-' + t);
        if (panel) panel.classList.add('hidden');
        const btn = document.getElementById('admin-tab-' + t);
        if (btn) {
            btn.className = t === tab
                ? "px-4 py-2 rounded-lg font-bold text-sm bg-brand-cyanDark text-white whitespace-nowrap"
                : "px-4 py-2 rounded-lg font-bold text-sm text-gray-600 hover:bg-gray-100 whitespace-nowrap";
        }
    });
    const activePanel = document.getElementById('admin-panel-' + tab);
    if (activePanel) activePanel.classList.remove('hidden');

    if (tab === 'orders' || tab === 'dispatch') loadOrders();
    if (tab === 'products') renderAdminProducts();
    if (tab === 'stats') {
        renderTopProductsStats();
        renderAdvancedStats();
    }
};

// فتح لوحة التحكم
window.openAdminDashboard = () => {
    // حالة المتجر
    const storeToggle = document.getElementById('admin-store-open');
    storeToggle.checked = globalSettings.storeOpen !== false;
    const storeOpenLabel = document.getElementById('store-open-label');
    storeOpenLabel.innerText = storeToggle.checked ? 'مفتوح' : 'مغلق';
    storeOpenLabel.className = storeToggle.checked
        ? 'mr-3 text-sm font-black text-green-600 w-12'
        : 'mr-3 text-sm font-black text-red-600 w-12';

    // بيانات المتجر الأساسية
    document.getElementById('admin-store-name').value = globalSettings.storeName || '';
    document.getElementById('admin-store-desc').value = globalSettings.storeDesc || '';
    document.getElementById('admin-store-phone').value = globalSettings.storePhone || '';
    document.getElementById('admin-min-order').value = globalSettings.minOrder || 0;

    // التوصيل
    document.getElementById('admin-free-delivery-active').checked = globalSettings.freeDeliveryActive;
    document.getElementById('admin-free-delivery-threshold').value = globalSettings.freeDeliveryThreshold || 0;
    tempAdminZones = JSON.parse(JSON.stringify(globalDeliveryZones || []));
    renderAdminZones();

    // نظام الولاء
    document.getElementById('admin-reward-active').checked = globalSettings.rewardActive;
    document.getElementById('admin-reward-type').value = globalSettings.rewardType || 'fixed';
    document.getElementById('admin-reward-value').value = globalSettings.rewardValue || 0;
    document.getElementById('admin-reward-max-generations').value = globalSettings.rewardMaxGenerations || 0;

    // الإعلانات
    document.getElementById('admin-banner-active').checked = globalSettings.bannerActive;
    document.getElementById('admin-banner-text').value = globalSettings.bannerText || '';
    document.getElementById('admin-banner-link').value = globalSettings.bannerLink || '';
    document.getElementById('admin-banner-bgcolor').value = globalSettings.bannerBgColor || '#fef3c7';
    document.getElementById('admin-banner-textcolor').value = globalSettings.bannerTextColor || '#92400e';
    document.getElementById('admin-banner-fontsize').value = globalSettings.bannerFontSize || 16;
    document.getElementById('admin-banner-icon').value = globalSettings.bannerIcon || 'fa-solid fa-fire';
    document.getElementById('admin-banner-animated').checked = globalSettings.bannerAnimated || false;

    // الاقتراح الذكي
    document.getElementById('admin-crosssell-active').checked = globalSettings.crossSellActive;
    const csSelect = document.getElementById('admin-crosssell-product');
    csSelect.innerHTML = '';
    Object.keys(productsInfo).forEach(id => {
        csSelect.innerHTML += `<option value="${id}" ${globalSettings.crossSellProductId === id ? 'selected' : ''}>${productsInfo[id].name}</option>`;
    });

    // أكواد الخصم
    tempPromoCodes = JSON.parse(JSON.stringify(globalSettings.promoCodes || []));
    renderAdminPromos();
    document.getElementById('admin-show-promo-field').checked = globalSettings.showPromoField !== false;

    // رسالة النجاح
    document.getElementById('admin-success-title').value = globalSettings.successTitle || '';
    document.getElementById('admin-success-message').value = globalSettings.successMessage || '';

    // القوالب
    document.getElementById('admin-whatsapp-template').value = globalSettings.whatsappTemplate ||
        'السلام عليكم، أريد تأكيد حجزي:\n\n📋 *بيانات العميل:*\n{تفاصيل_العميل}\n\n🛒 *الطلبات:*\n{الطلبات}\n{الخصم}═════════════════\n📦 قيمة الطلبات: {قيمة_الطلبات} ج.م\n🚚 رسوم التوصيل: {التوصيل}\n💰 *الإجمالي النهائي: {الاجمالي} ج.م*\n\n(في انتظار تأكيد الحجز وموعد الاستلام)';
    document.getElementById('admin-batch-hashtag').value = globalSettings.batchHashtag || '';
    document.getElementById('admin-vip-whatsapp-template').value = globalSettings.vipWhatsappTemplate ||
        'السلام عليكم،\nأريد الانضمام لقائمة الـ VIP وحجز ({اسم_المنتج}) من الدفعة القادمة قبل نزولها المتجر. 👑';
    document.getElementById('admin-ticktick-template').value = globalSettings.ticktickTemplate ||
        '🧾 **تفاصيل الأوردر كاملة:**\n👤 الاسم: {اسم_العميل}\n📱 الموبايل: {الموبايل}\n📍 المنطقة: {المنطقة}\n{العنوان}\n🕒 الوقت: {الوقت}\n--------------------------------\n🛒 الطلبات:\n{تفاصيل_الطلبات}\n--------------------------------\n📦 قيمة الطلبات: {قيمة_الطلبات} ج.م\n{الخصم}🚚 رسوم التوصيل: {التوصيل}\n💰 الإجمالي النهائي: {الاجمالي} ج.م\n{ملاحظات}\n{الهاشتاجات}';
    document.getElementById('admin-dispatch-template').value = globalSettings.dispatchTemplate ||
        '📦 طلب جديد من {اسم_العميل}\n📱 {رقم_العميل}\n📍 {المنطقة} - {العنوان}\n🛒 الطلبات:\n{تفاصيل_الطلبات}\n💰 إجمالي الطلب: {إجمالي_الطلب} ج.م\n🚚 التوصيل: {التوصيل}\n⭐ الإجمالي النهائي: {الإجمالي_النهائي} ج.م';

    // قاموس النصوص
    const textsCont = document.getElementById('admin-texts-container');
    if (textsCont) {
        textsCont.innerHTML = '';
        textsConfig.forEach(t => {
            const val = (globalSettings.uiTexts && globalSettings.uiTexts[t.id]) ? globalSettings.uiTexts[t.id] : t.default;
            textsCont.innerHTML += `
                <div>
                    <label class="text-[10px] font-bold text-gray-500 block mb-1">${t.label}</label>
                    <input type="text" id="ui-txt-${t.id}" value="${val.replace(/"/g, '&quot;')}"
                        class="w-full border rounded p-2 text-xs font-bold text-brand-navy outline-none focus:border-brand-cyan">
                </div>`;
        });
    }

    // نسخ المنتجات للتعديل
    tempProducts = JSON.parse(JSON.stringify(productsInfo));
    renderAdminProducts();

    // إظهار اللوحة
    document.getElementById('admin-dashboard-modal').classList.remove('hidden');
    setTimeout(() => document.getElementById('admin-dashboard-modal').classList.remove('opacity-0'), 10);
    switchAdminTab('stats');
};

// إغلاق لوحة التحكم
window.closeAdminDashboard = () => {
    document.getElementById('admin-dashboard-modal').classList.add('opacity-0');
    setTimeout(() => document.getElementById('admin-dashboard-modal').classList.add('hidden'), 300);
};

// ==================== التحليلات المتقدمة ====================
window.renderAdvancedStats = () => {
    if (!ordersList.length) {
        document.getElementById('stat-avg-order').innerText = '0 ج.م';
        document.getElementById('stat-completed').innerText = '0';
        document.getElementById('completion-bar').style.width = '0%';
        document.getElementById('top-zones-list').innerHTML = 'لا توجد بيانات';
        return;
    }

    const zoneCount = {};
    let completedCount = 0;
    let completedSales = 0;

    ordersList.forEach(o => {
        zoneCount[o.zone] = (zoneCount[o.zone] || 0) + 1;
        if (o.status === 'completed') {
            completedCount++;
            completedSales += o.total || 0;
        }
    });

    const avgOrder = completedCount ? Math.round(completedSales / completedCount) : 0;
    document.getElementById('stat-avg-order').innerText = avgOrder + ' ج.م';
    document.getElementById('stat-completed').innerText = completedCount;

    const rate = ordersList.length ? Math.round((completedCount / ordersList.length) * 100) : 0;
    document.getElementById('completion-bar').style.width = rate + '%';

    const sortedZones = Object.entries(zoneCount).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const zonesHtml = sortedZones.map(([zone, count]) =>
        `<div class="flex justify-between"><span>${zone}</span><span class="font-black">${count} طلب</span></div>`
    ).join('') || 'لا توجد';
    document.getElementById('top-zones-list').innerHTML = zonesHtml;
};

window.renderTopProductsStats = () => {
    const container = document.getElementById('top-products-list');
    if (!container) return;

    if (globalSettings.bestSellers && globalSettings.bestSellers.length > 0) {
        container.innerHTML = globalSettings.bestSellers.map(id => {
            const p = productsInfo[id];
            return p
                ? `<div class="flex justify-between items-center bg-gray-50 p-2 rounded border">
                      <span class="font-bold text-brand-navy">${p.name}</span>
                      <span class="text-[10px] bg-brand-yellow text-brand-navy px-2 py-0.5 rounded-full font-black">🔥 الأكثر مبيعاً</span>
                   </div>`
                : '';
        }).join('');
    } else {
        container.innerHTML = '<div class="text-xs text-gray-400">لم تقم بتحديد منتجات كأكثر مبيعاً من قائمة المنتجات.</div>';
    }
};

// ==================== إدارة المنتجات ====================
window.moveProduct = (index, direction) => {
    const keys = Object.keys(tempProducts);
    if (index < 0 || index >= keys.length) return;
    const swapIndex = index + direction;
    if (swapIndex < 0 || swapIndex >= keys.length) return;

    const tempKeys = [...keys];
    [tempKeys[index], tempKeys[swapIndex]] = [tempKeys[swapIndex], tempKeys[index]];

    const newProducts = {};
    tempKeys.forEach(k => {
        newProducts[k] = tempProducts[k];
    });
    tempProducts = newProducts;
    renderAdminProducts();
};

window.renderAdminProducts = () => {
    const container = document.getElementById('admin-inputs-container');
    if (!container) return;
    container.innerHTML = '';

    Object.keys(tempProducts).forEach((id, index) => {
        const item = tempProducts[id];
        const price = globalPrices[id] || item.basePrice;
        const oldPrice = globalOldPrices[id] || '';
        const discountActive = globalDiscounts[id] || false;

        container.innerHTML += `
            <div class="bg-white border rounded-xl p-4 shadow-sm relative" data-id="${id}">
                <div class="flex justify-between items-center mb-3">
                    <div class="flex items-center gap-2">
                        <button onclick="moveProduct(${index}, -1)" class="text-gray-400 hover:text-brand-navy">▲</button>
                        <button onclick="moveProduct(${index}, 1)" class="text-gray-400 hover:text-brand-navy">▼</button>
                    </div>
                    <button onclick="deleteAdminProduct('${id}')" class="text-red-400 hover:text-red-600 bg-red-50 w-8 h-8 rounded-full"><i class="fa-solid fa-trash"></i></button>
                </div>
                <div class="grid grid-cols-2 gap-2 text-sm">
                    <div><label class="text-[10px] text-gray-500">اسم المنتج</label><input type="text" id="ap-name-${id}" value="${item.name}" class="w-full border rounded p-1.5 font-bold text-brand-navy"></div>
                    <div><label class="text-[10px] text-gray-500">الوزن</label><input type="text" id="ap-weight-${id}" value="${item.weight || ''}" class="w-full border rounded p-1.5 font-bold text-brand-navy"></div>
                    <div><label class="text-[10px] text-gray-500">السعر الأساسي</label><input type="number" id="ap-price-${id}" value="${item.basePrice}" class="w-full border rounded p-1.5 font-bold text-brand-navy"></div>
                    <div><label class="text-[10px] text-gray-500">السعر الحالي</label><input type="number" id="ap-current-price-${id}" value="${price}" class="w-full border rounded p-1.5 font-bold text-brand-navy"></div>
                    <div><label class="text-[10px] text-gray-500">السعر القديم</label><input type="number" id="ap-old-price-${id}" value="${oldPrice}" class="w-full border rounded p-1.5 font-bold text-brand-navy"></div>
                    <div>
                        <label class="text-[10px] text-gray-500">تصنيف</label>
                        <select id="ap-tag-${id}" class="w-full border rounded p-1.5 font-bold text-brand-navy">
                            <option value="">بدون</option>
                            <option value="new" ${item.tag==='new'?'selected':''}>🆕 جديد</option>
                            <option value="hot" ${item.tag==='hot'?'selected':''}>🔥 قرب يخلص</option>
                            <option value="offer" ${item.tag==='offer'?'selected':''}>⏱️ عرض محدود</option>
                        </select>
                    </div>
                    <div class="col-span-2 flex items-center gap-4 mt-2">
                        <label class="text-[10px] text-gray-500"><input type="checkbox" id="ap-extra-${id}" ${item.isExtra?'checked':''}> منتج إضافي</label>
                        <label class="text-[10px] text-gray-500"><input type="checkbox" id="ap-visible-${id}" ${item.isVisible!==false?'checked':''}> مرئي</label>
                        <label class="text-[10px] text-gray-500"><input type="checkbox" id="ap-discount-${id}" ${discountActive?'checked':''}> عرض نشط</label>
                        <label class="text-[10px] text-gray-500"><input type="checkbox" id="ap-bestseller-${id}" ${globalSettings.bestSellers?.includes(id)?'checked':''}> الأكثر طلباً</label>
                    </div>
                </div>
            </div>`;
    });
};

window.addNewAdminProduct = () => {
    const newId = Date.now().toString();
    tempProducts[newId] = {
        name: 'منتج جديد',
        basePrice: 0,
        weight: '',
        isExtra: false,
        isVisible: true,
        tag: '',
        images: []
    };
    globalPrices[newId] = 0;
    globalOldPrices[newId] = 0;
    globalDiscounts[newId] = false;
    globalStock[newId] = 0;
    renderAdminProducts();
};

window.deleteAdminProduct = (id) => {
    if (!confirm('هل أنت متأكد من حذف هذا المنتج؟')) return;
    delete tempProducts[id];
    delete globalPrices[id];
    delete globalOldPrices[id];
    delete globalDiscounts[id];
    delete globalStock[id];
    globalSettings.bestSellers = globalSettings.bestSellers.filter(b => b !== id);
    renderAdminProducts();
};

window.syncAdminProductsFromDOM = () => {
    Object.keys(tempProducts).forEach(id => {
        const nameEl = document.getElementById('ap-name-' + id);
        const weightEl = document.getElementById('ap-weight-' + id);
        const basePriceEl = document.getElementById('ap-price-' + id);
        const currentPriceEl = document.getElementById('ap-current-price-' + id);
        const oldPriceEl = document.getElementById('ap-old-price-' + id);
        const tagEl = document.getElementById('ap-tag-' + id);
        const extraEl = document.getElementById('ap-extra-' + id);
        const visibleEl = document.getElementById('ap-visible-' + id);
        const discountEl = document.getElementById('ap-discount-' + id);
        const bestEl = document.getElementById('ap-bestseller-' + id);

        if (nameEl) tempProducts[id].name = nameEl.value.trim();
        if (weightEl) tempProducts[id].weight = weightEl.value.trim();
        if (basePriceEl) tempProducts[id].basePrice = parseInt(basePriceEl.value) || 0;
        if (currentPriceEl) globalPrices[id] = parseInt(currentPriceEl.value) || 0;
        if (oldPriceEl) globalOldPrices[id] = parseInt(oldPriceEl.value) || 0;
        if (tagEl) tempProducts[id].tag = tagEl.value;
        if (extraEl) tempProducts[id].isExtra = extraEl.checked;
        if (visibleEl) tempProducts[id].isVisible = visibleEl.checked;
        if (discountEl) globalDiscounts[id] = discountEl.checked;
        if (bestEl) {
            if (bestEl.checked) {
                if (!globalSettings.bestSellers.includes(id)) globalSettings.bestSellers.push(id);
            } else {
                globalSettings.bestSellers = globalSettings.bestSellers.filter(b => b !== id);
            }
        }
    });
};

// ==================== مناطق التوصيل ====================
window.renderAdminZones = () => {
    const container = document.getElementById('admin-zones-container');
    if (!container) return;
    container.innerHTML = '';

    tempAdminZones.forEach((zone, index) => {
        container.innerHTML += `
            <div class="flex gap-2 items-center bg-gray-50 p-2 rounded border">
                <input type="text" value="${zone.name}" class="flex-1 border rounded p-1.5 text-sm font-bold text-brand-navy" placeholder="اسم المنطقة"
                    onchange="tempAdminZones[${index}].name = this.value">
                <input type="number" value="${zone.price}" class="w-20 border rounded p-1.5 text-sm font-bold text-brand-navy" placeholder="السعر"
                    onchange="tempAdminZones[${index}].price = parseInt(this.value) || 0">
                <button onclick="tempAdminZones.splice(${index},1); renderAdminZones()" class="text-red-400 hover:text-red-600"><i class="fa-solid fa-trash"></i></button>
            </div>`;
    });
};

window.addNewAdminZone = () => {
    tempAdminZones.push({ id: Date.now().toString(), name: 'منطقة جديدة', price: 0 });
    renderAdminZones();
};

// ==================== أكواد الخصم ====================
window.renderAdminPromos = () => {
    const container = document.getElementById('admin-promos-container');
    if (!container) return;
    container.innerHTML = '';

    tempPromoCodes.forEach((promo, index) => {
        container.innerHTML += `
            <div class="bg-gray-50 border rounded-lg p-3 space-y-2">
                <div class="flex justify-between items-center">
                    <span class="font-black text-brand-navy text-sm">${promo.code}</span>
                    <button onclick="tempPromoCodes.splice(${index},1); renderAdminPromos()" class="text-red-400 hover:text-red-600"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div class="grid grid-cols-2 gap-2 text-xs">
                    <div><label>الكود</label><input type="text" value="${promo.code}" class="w-full border rounded p-1 font-bold" onchange="tempPromoCodes[${index}].code = this.value"></div>
                    <div><label>النوع</label><select class="w-full border rounded p-1 font-bold" onchange="tempPromoCodes[${index}].type = this.value">
                        <option value="fixed" ${promo.type==='fixed'?'selected':''}>مبلغ</option>
                        <option value="percent" ${promo.type==='percent'?'selected':''}>نسبة</option>
                        <option value="free_delivery" ${promo.type==='free_delivery'?'selected':''}>توصيل مجاني</option>
                    </select></div>
                    <div><label>قيمة الخصم</label><input type="number" value="${promo.discount}" class="w-full border rounded p-1 font-bold" onchange="tempPromoCodes[${index}].discount = parseInt(this.value)||0"></div>
                    <div><label>الحد الأدنى للطلب</label><input type="number" value="${promo.minOrder||0}" class="w-full border rounded p-1 font-bold" onchange="tempPromoCodes[${index}].minOrder = parseInt(this.value)||0"></div>
                </div>
            </div>`;
    });
};

window.addNewPromoCode = () => {
    tempPromoCodes.push({
        code: 'كود' + Math.floor(Math.random() * 1000),
        type: 'fixed',
        discount: 10,
        usesLeft: null,
        minOrder: 0,
        maxDiscount: 0,
        expiryDate: ''
    });
    renderAdminPromos();
};

// ==================== إرسال رسائل للعملاء ====================
window.sendMessageToCustomer = (phone, orderId) => {
    const message = prompt('اكتب رسالتك للعميل:');
    if (!message) return;
    window.open(`https://wa.me/2${phone}?text=${encodeURIComponent(message)}`, '_blank');
    if (orderId) {
        db.collection("orders").doc(orderId).update({ status: 'processing' });
        loadOrders();
    }
};

window.sendRatingRequest = (phone, orderId) => {
    const msg = "شكراً لثقتك في سمان ههيا! 🌟\nلو حابب تدعمنا، تقييمك لخدمتنا هيسعدنا جداً.\nرأيك يهمنا!";
    window.open(`https://wa.me/2${phone}?text=${encodeURIComponent(msg)}`, '_blank');
};

// ==================== إدارة الطلبات ====================
window.renderOrdersList = () => {
    const container = document.getElementById('orders-list-container');
    if (!container) return;

    const searchTerm = document.getElementById('order-search')?.value.trim().toLowerCase() || '';
    let filtered = ordersList;

    if (orderFilter !== 'all') {
        filtered = filtered.filter(o => o.status === orderFilter);
    }
    if (searchTerm) {
        filtered = filtered.filter(o =>
            (o.customerName && o.customerName.toLowerCase().includes(searchTerm)) ||
            (o.customerPhone && o.customerPhone.includes(searchTerm))
        );
    }

    if (filtered.length === 0) {
        container.innerHTML = '<div class="text-center py-6 text-gray-400 font-bold">لا توجد طلبات.</div>';
        return;
    }

    container.innerHTML = filtered.map(o => {
        let itemsStr = o.items.map(i => `${i.name} ×${i.quantity}`).join('، ');
        let statusBadge = '';
        switch (o.status) {
            case 'new': statusBadge = '<span class="bg-red-100 text-red-700 px-2 py-0.5 rounded-full text-[10px] font-black">جديد</span>'; break;
            case 'processing': statusBadge = '<span class="bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full text-[10px] font-black">قيد التجهيز</span>'; break;
            case 'completed': statusBadge = '<span class="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-[10px] font-black">تم التوصيل</span>'; break;
        }
        return `
            <div class="bg-white border rounded-xl p-3 shadow-sm ${o.isRead ? 'opacity-90' : 'border-l-4 border-l-brand-cyanDark'}">
                <div class="flex justify-between items-start mb-2">
                    <div>
                        <span class="font-black text-brand-navy text-sm">${o.customerName}</span>
                        <span class="text-gray-400 mx-2">|</span>
                        <span class="text-xs text-gray-500 font-bold">${o.customerPhone}</span>
                        ${statusBadge}
                    </div>
                    <span class="text-[10px] text-gray-400">${o.orderDate} ${o.orderTime}</span>
                </div>
                <div class="text-xs text-gray-600 font-bold mb-2">${itemsStr}</div>
                <div class="flex justify-between items-center">
                    <span class="font-black text-brand-cyanDark">${o.total} ج.م</span>
                    <div class="flex gap-1">
                        <button onclick="sendMessageToCustomer('${o.customerPhone}', '${o.id}')" class="bg-green-500 text-white text-[10px] px-2 py-1 rounded"><i class="fa-brands fa-whatsapp"></i></button>
                        ${o.status !== 'completed' ? `<button onclick="updateOrderStatus('${o.id}', 'completed')" class="bg-brand-navy text-white text-[10px] px-2 py-1 rounded">✔ تم</button>` : ''}
                        <button onclick="sendRatingRequest('${o.customerPhone}', '${o.id}')" class="bg-yellow-500 text-white text-[10px] px-2 py-1 rounded"><i class="fa-solid fa-star"></i></button>
                    </div>
                </div>
            </div>`;
    }).join('');
};

window.loadOrders = () => {
    if (!hasCloud || !db) {
        ordersList = [];
        renderOrdersList();
        renderDispatchOrders();
        return;
    }
    db.collection("orders").orderBy("createdAt", "desc").onSnapshot(snapshot => {
        ordersList = [];
        snapshot.forEach(doc => {
            ordersList.push({ id: doc.id, ...doc.data() });
        });
        if (currentAdminTab === 'orders') renderOrdersList();
        if (currentAdminTab === 'dispatch') renderDispatchOrders();
        if (currentAdminTab === 'stats') renderAdvancedStats();
    });
};

window.filterOrders = (filter) => {
    orderFilter = filter;
    renderOrdersList();
};

window.updateOrderStatus = (orderId, newStatus) => {
    if (!confirm('تأكيد تغيير الحالة؟')) return;
    db.collection("orders").doc(orderId).update({ status: newStatus, isRead: true });
};

window.deleteAllOrders = () => {
    if (!confirm('سيتم مسح جميع الطلبات نهائياً. متأكد؟')) return;
    if (!hasCloud || !db) return;
    const batch = db.batch();
    ordersList.forEach(o => batch.delete(db.collection("orders").doc(o.id)));
    batch.commit().then(() => showAlert("تم", "تم مسح جميع الطلبات."));
};

window.resetStatsOnly = () => {
    if (!hasCloud || !db) return;
    db.collection('inventory').doc('stats').set({ sales: 0, orders: 0 }, { merge: true });
    showAlert("تم", "تم تصفير الإحصائيات.");
};

// ==================== إرسال الطلبات للمندوبين ====================
window.renderDispatchOrders = () => {
    const container = document.getElementById('dispatch-orders-container');
    if (!container) return;

    const zoneFilter = document.getElementById('dispatch-zone-filter');
    const zoneValue = zoneFilter ? zoneFilter.value : 'all';
    let filtered = ordersList.filter(o => o.status === 'new');

    if (zoneValue !== 'all') {
        filtered = filtered.filter(o => o.zone === zoneValue);
    }

    // ملء قائمة المناطق
    if (zoneFilter && zoneFilter.options.length === 1) {
        const zones = [...new Set(ordersList.map(o => o.zone))];
        zones.forEach(z => {
            if (z) zoneFilter.innerHTML += `<option value="${z}">${z}</option>`;
        });
    }

    window.dispatchOrdersList = filtered;
    container.innerHTML = filtered.length === 0
        ? '<p class="text-xs text-gray-400 text-center py-4">لا توجد طلبات جديدة في هذه المنطقة.</p>'
        : filtered.map(o => `
            <label class="flex items-center gap-2 bg-white p-2 rounded border cursor-pointer hover:bg-gray-50">
                <input type="checkbox" value="${o.id}" class="dispatch-checkbox" onchange="updateDispatchCount()">
                <div class="flex-1">
                    <div class="font-bold text-xs text-brand-navy">${o.customerName} (${o.customerPhone})</div>
                    <div class="text-[10px] text-gray-500">${o.items.map(i => `${i.name} ×${i.quantity}`).join('، ')} - إجمالي: ${o.total} ج.م</div>
                </div>
                <span class="text-[10px] bg-gray-100 px-2 py-0.5 rounded">${o.zone}</span>
            </label>`).join('');

    updateDispatchCount();
};

window.updateDispatchCount = () => {
    const count = document.querySelectorAll('.dispatch-checkbox:checked').length;
    document.getElementById('dispatch-selected-count').innerText = count;
};

window.toggleSelectAllDispatch = () => {
    const checkboxes = document.querySelectorAll('.dispatch-checkbox');
    const selectAll = [...checkboxes].every(cb => cb.checked) ? false : true;
    checkboxes.forEach(cb => cb.checked = selectAll);
    updateDispatchCount();
};

window.sendDispatchToDriver = () => {
    const driverPhone = document.getElementById('dispatch-driver-phone').value.replace(/\D/g, '');
    if (!driverPhone) return showAlert("تنبيه", "يرجى كتابة رقم المندوب.");

    const selectedIds = [...document.querySelectorAll('.dispatch-checkbox:checked')].map(cb => cb.value);
    if (selectedIds.length === 0) return showAlert("تنبيه", "اختر طلباً واحداً على الأقل.");

    const orders = ordersList.filter(o => selectedIds.includes(o.id));
    let fullMessage = `📦 *طلبات التوصيل* (${new Date().toLocaleDateString('ar-EG')})\n`;
    fullMessage += '━━━━━━━━━━━━━━━━\n';

    orders.forEach(o => {
        let itemsStr = o.items.map(i => `▪️ ${i.name} ×${i.quantity}`).join('\n');
        let template = globalSettings.dispatchTemplate ||
            '📦 طلب من {اسم_العميل}\n📱 {رقم_العميل}\n📍 {المنطقة} - {العنوان}\n🛒:\n{تفاصيل_الطلبات}\n💰 الإجمالي: {الإجمالي_النهائي} ج.م';
        let orderMsg = template
            .replace('{اسم_العميل}', o.customerName)
            .replace('{رقم_العميل}', o.customerPhone)
            .replace('{المنطقة}', o.zone)
            .replace('{العنوان}', o.customerAddress || 'غير محدد')
            .replace('{تفاصيل_الطلبات}', itemsStr)
            .replace('{إجمالي_الطلب}', o.subtotal || '0')
            .replace('{التوصيل}', o.deliveryFee || '0')
            .replace('{الإجمالي_النهائي}', o.total);
        fullMessage += orderMsg + '\n━━━━━━━━━━━━━━━━\n';
    });

    window.open(`https://wa.me/2${driverPhone}?text=${encodeURIComponent(fullMessage)}`, '_blank');
};

// ==================== توليد أكواد شكر جماعية ====================
window.generateBulkWhatsAppLinks = () => {
    const numbersText = document.getElementById('admin-bulk-numbers').value.trim();
    const messageTemplate = document.getElementById('admin-bulk-message').value.trim();
    const rewardType = document.getElementById('admin-bulk-reward-type').value;
    const rewardValue = parseInt(document.getElementById('admin-bulk-reward-value').value) || 0;

    if (!numbersText || !messageTemplate) return showAlert("تنبيه", "املأ الأرقام والرسالة.");

    const numbers = numbersText.split('\n').map(n => n.replace(/\D/g, '')).filter(n => n.length >= 10);
    if (numbers.length === 0) return showAlert("تنبيه", "لا توجد أرقام صالحة.");

    const container = document.getElementById('bulk-whatsapp-links');
    container.classList.remove('hidden');
    container.innerHTML = '';

    numbers.forEach(phone => {
        const code = 'VIP' + Math.floor(1000 + Math.random() * 9000);
        const newPromo = {
            code,
            type: rewardType,
            discount: rewardValue,
            isAuto: true,
            usesLeft: null,
            customerPhone: phone,
            minOrder: 0,
            maxDiscount: 0,
            expiryDate: ''
        };
        globalSettings.promoCodes.push(newPromo); // ستحفظ عند الحفظ

        const msg = messageTemplate.replace(/{الكود}/g, code);
        container.innerHTML += `
            <div class="flex justify-between items-center bg-white p-2 rounded border text-xs">
                <span class="font-bold">${phone}</span>
                <span class="text-brand-cyanDark font-black">${code}</span>
                <a href="https://wa.me/2${phone}?text=${encodeURIComponent(msg)}" target="_blank" class="bg-green-500 text-white px-2 py-1 rounded text-[10px]">إرسال</a>
            </div>`;
    });
};

// ==================== حفظ جميع التعديلات ====================
window.saveAdminData = async () => {
    syncAdminProductsFromDOM();

    let newUiTexts = {};
    textsConfig.forEach(t => {
        const el = document.getElementById(`ui-txt-${t.id}`);
        if (el) newUiTexts[t.id] = el.value.trim();
    });

    const newSettings = {
        storeOpen: document.getElementById('admin-store-open').checked,
        storeName: document.getElementById('admin-store-name').value.trim() || 'المتجر',
        storeDesc: document.getElementById('admin-store-desc').value.trim(),
        storePhone: document.getElementById('admin-store-phone').value.trim(),
        minOrder: parseInt(document.getElementById('admin-min-order').value) || 0,
        freeDeliveryActive: document.getElementById('admin-free-delivery-active').checked,
        freeDeliveryThreshold: parseInt(document.getElementById('admin-free-delivery-threshold').value) || 0,
        deliveryZones: tempAdminZones.filter(z => z.name.trim()),
        rewardActive: document.getElementById('admin-reward-active').checked,
        rewardType: document.getElementById('admin-reward-type').value,
        rewardValue: parseInt(document.getElementById('admin-reward-value').value) || 0,
        rewardMaxGenerations: parseInt(document.getElementById('admin-reward-max-generations').value) || 0,
        bannerActive: document.getElementById('admin-banner-active').checked,
        bannerText: document.getElementById('admin-banner-text').value.trim(),
        bannerBgColor: document.getElementById('admin-banner-bgcolor').value,
        bannerTextColor: document.getElementById('admin-banner-textcolor').value,
        bannerFontSize: parseInt(document.getElementById('admin-banner-fontsize').value) || 16,
        bannerIcon: document.getElementById('admin-banner-icon').value,
        bannerLink: document.getElementById('admin-banner-link').value.trim(),
        bannerAnimated: document.getElementById('admin-banner-animated').checked,
        crossSellActive: document.getElementById('admin-crosssell-active').checked,
        crossSellProductId: document.getElementById('admin-crosssell-product').value,
        promoCodes: tempPromoCodes.filter(p => p.code.trim()),
        bestSellers: globalSettings.bestSellers,
        showPromoField: document.getElementById('admin-show-promo-field').checked,
        successTitle: document.getElementById('admin-success-title').value.trim(),
        successMessage: document.getElementById('admin-success-message').value.trim(),
        productsData: tempProducts,
        whatsappTemplate: document.getElementById('admin-whatsapp-template').value.trim(),
        ticktickTemplate: document.getElementById('admin-ticktick-template').value.trim(),
        vipWhatsappTemplate: document.getElementById('admin-vip-whatsapp-template').value.trim(),
        batchHashtag: document.getElementById('admin-batch-hashtag').value.trim(),
        dispatchTemplate: document.getElementById('admin-dispatch-template').value.trim(),
        uiTexts: newUiTexts
    };

    const btn = document.querySelector('#admin-dashboard-modal button[onclick="saveAdminData()"]');
    const originalHtml = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-xl"></i> جاري الحفظ...';

    if (hasCloud && db) {
        try {
            await Promise.all([
                db.collection("inventory").doc("settings").set(newSettings),
                db.collection("inventory").doc("stock").set(globalStock),
                db.collection("inventory").doc("prices").set(globalPrices),
                db.collection("inventory").doc("old_prices").set(globalOldPrices),
                db.collection("inventory").doc("discounts_status").set(globalDiscounts)
            ]);
            btn.innerHTML = originalHtml;
            closeAdminDashboard();
            showAlert("تم بنجاح", "تم حفظ جميع التعديلات بنجاح.");
        } catch (e) {
            btn.innerHTML = originalHtml;
            showAlert("خطأ", "حدث خطأ أثناء الحفظ. تحقق من اتصالك بالإنترنت.");
        }
    } else {
        Object.assign(globalSettings, newSettings);
        productsInfo = tempProducts;
        globalDeliveryZones = newSettings.deliveryZones;
        closeAdminDashboard();
        btn.innerHTML = originalHtml;
        applySettingsToUI();
        renderDeliveryZones();
        const container = document.getElementById('products-container');
        if (container) container.innerHTML = `<div class="text-center py-10 text-brand-cyanDark"><i class="fa-solid fa-spinner fa-spin text-3xl mb-3"></i><p class="font-bold text-sm">جاري التحديث...</p></div>`;
        setTimeout(() => renderProducts(), 500);
        updateUI();
        showAlert("تم محلياً", "تم الحفظ مؤقتاً لأن المتصفح غير متصل بقاعدة البيانات.");
    }
};
