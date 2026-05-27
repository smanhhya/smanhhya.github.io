// ==================== admin.js - لوحة التحكم الشاملة ====================

// دالة تأخير للبحث السريع
function debounce(func, delay) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), delay);
    };
}

let tempProducts = {};
let tempAdminZones = [];
let tempPromoCodes = [];
let tempDrivers = []; 
let currentAdminTab = 'stats'; 
let ordersList = []; 
let orderFilter = 'all';
window.dispatchOrdersList = [];

// تبديل حالة المتجر (تم إصلاح الخطأ البرمجي هنا)
const adminStoreOpen = document.getElementById('admin-store-open');
if (adminStoreOpen) {
    adminStoreOpen.addEventListener('change', function() {
        const label = document.getElementById('store-open-label');
        if (label) {
            label.innerText = this.checked ? 'مفتوح' : 'مغلق';
            label.className = this.checked ? 'mr-3 text-sm font-black text-green-600 w-12' : 'mr-3 text-sm font-black text-red-600 w-12';
        }
    });
}

// ==================== نظام تسجيل الدخول ====================
window.openAdminLogin = () => { 
    if(firebase.auth().currentUser) {
        openAdminDashboard();
    } else {
        const modal = document.getElementById('admin-login-modal');
        if(modal) {
            modal.classList.remove('hidden'); 
            setTimeout(() => modal.classList.remove('opacity-0'), 10); 
        }
        const pw = document.getElementById('admin-password-input');
        if(pw) pw.value = ''; 
    }
};

window.closeAdminLogin = () => { 
    const modal = document.getElementById('admin-login-modal');
    if(modal) {
        modal.classList.add('opacity-0'); 
        setTimeout(() => modal.classList.add('hidden'), 300); 
    }
};

window.verifyAdminPin = () => { 
    const email = document.getElementById('admin-email-input')?.value.trim();
    const pass = document.getElementById('admin-password-input')?.value.trim();
    const btn = document.querySelector('#admin-login-modal button[onclick="verifyAdminPin()"]');
    
    if(!email || !pass) { showAlert("تنبيه", "يرجى كتابة البريد الإلكتروني وكلمة المرور."); return; }
    
    const origHtml = btn ? btn.innerHTML : '';
    if(btn) {
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري التحقق...';
        btn.disabled = true;
    }
    
    firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL)
        .then(() => firebase.auth().signInWithEmailAndPassword(email, pass))
        .then(() => {
            closeAdminLogin(); 
            openAdminDashboard();
            if(btn) { btn.innerHTML = origHtml; btn.disabled = false; }
            if(document.getElementById('admin-password-input')) document.getElementById('admin-password-input').value = '';
        })
        .catch(() => {
            if(btn) { btn.innerHTML = origHtml; btn.disabled = false; }
            showAlert("خطأ", "بيانات الدخول غير صحيحة، أو ليس لديك صلاحية!");
        });
};

window.logoutAdmin = () => {
    firebase.auth().signOut().then(() => {
        closeAdminDashboard();
        showAlert("تم", "تم تسجيل الخروج بنجاح.");
    }).catch(() => {
        closeAdminDashboard();
    });
};

// ==================== فتح وإغلاق وتوجيه لوحة التحكم ====================
window.switchAdminTab = (tab) => {
    currentAdminTab = tab;
    ['stats','store','products','orders','dispatch','delivery','marketing','advanced','texts','theme'].forEach(t => {
        const panel = document.getElementById('admin-panel-'+t);
        if(panel) panel.classList.add('hidden');
        const btn = document.getElementById('admin-tab-'+t);
        if(btn) btn.className = t===tab ? "px-4 py-2 rounded-lg font-bold text-sm bg-brand-cyanDark text-white whitespace-nowrap shadow-inner" : "px-4 py-2 rounded-lg font-bold text-sm text-gray-600 hover:bg-gray-100 whitespace-nowrap";
    });
    
    const activePanel = document.getElementById('admin-panel-'+tab);
    if(activePanel) activePanel.classList.remove('hidden');
    
    if(tab==='orders' || tab==='dispatch') loadOrders();
    if(tab==='products') renderAdminProducts();
    if(tab==='stats') renderTopProductsStats();
};

window.openAdminDashboard = () => {
    const setVal = (id, val) => { const el = document.getElementById(id); if(el) el.value = val; };
    const setCheck = (id, val) => { const el = document.getElementById(id); if(el) el.checked = val; };

    const storeToggle = document.getElementById('admin-store-open');
    if(storeToggle) storeToggle.checked = globalSettings.storeOpen !== false;
    
    const storeOpenLabel = document.getElementById('store-open-label');
    if(storeOpenLabel && storeToggle) {
        storeOpenLabel.innerText = storeToggle.checked ? 'مفتوح' : 'مغلق';
        storeOpenLabel.className = storeToggle.checked ? 'mr-3 text-sm font-black text-green-600 w-12' : 'mr-3 text-sm font-black text-red-600 w-12';
    }

    setVal('admin-store-name', globalSettings.storeName || ''); 
    setVal('admin-store-desc', globalSettings.storeDesc || ''); 
    setVal('admin-store-phone', globalSettings.storePhone || ''); 
    setVal('admin-min-order', globalSettings.minOrder || 0);
    
    setCheck('admin-free-delivery-active', globalSettings.freeDeliveryActive); 
    setVal('admin-free-delivery-threshold', globalSettings.freeDeliveryThreshold || 0); 
    tempAdminZones = JSON.parse(JSON.stringify(globalDeliveryZones||[])); 
    renderAdminZones();
    
    tempDrivers = JSON.parse(JSON.stringify(globalSettings.drivers || []));
    renderAdminDrivers();

    setCheck('admin-reward-active', globalSettings.rewardActive); 
    setVal('admin-reward-type', globalSettings.rewardType || 'fixed'); 
    setVal('admin-reward-value', globalSettings.rewardValue || 0); 
    setVal('admin-reward-max-generations', globalSettings.rewardMaxGenerations || 0); 
    setCheck('admin-banner-active', globalSettings.bannerActive); 
    setVal('admin-banner-text', globalSettings.bannerText || ''); 
    setCheck('admin-crosssell-active', globalSettings.crossSellActive); 
    
    const csSelect = document.getElementById('admin-crosssell-product'); 
    if(csSelect) {
        csSelect.innerHTML=''; 
        Object.keys(productsInfo).forEach(id => csSelect.innerHTML += `<option value="${id}" ${globalSettings.crossSellProductId===id?'selected':''}>${productsInfo[id].name}</option>`); 
    }
    
    tempPromoCodes = JSON.parse(JSON.stringify(globalSettings.promoCodes||[])); 
    renderAdminPromos();
    setCheck('admin-show-promo-field', globalSettings.showPromoField !== false);
    
    setVal('admin-success-title', globalSettings.successTitle || ''); 
    setVal('admin-success-message', globalSettings.successMessage || ''); 

    setVal('admin-whatsapp-template', globalSettings.whatsappTemplate || 'السلام عليكم، أريد تأكيد حجزي:\n\n📋 *بيانات العميل:*\n{تفاصيل_العميل}\n\n🛒 *الطلبات:*\n{الطلبات}\n{الخصم}═════════════════\n📦 قيمة الطلبات: {قيمة_الطلبات} ج.م\n🚚 رسوم التوصيل: {التوصيل}\n💰 *الإجمالي النهائي: {الاجمالي} ج.م*\n\n(في انتظار تأكيد الحجز وموعد الاستلام)');
    setVal('admin-batch-hashtag', globalSettings.batchHashtag || '');
    setVal('admin-dispatch-template', globalSettings.dispatchTemplate || '📦 طلب جديد من {اسم_العميل}\n📱 {رقم_العميل}\n📍 {المنطقة} - {العنوان}\n🛒 الطلبات:\n{تفاصيل_الطلبات}\n💰 إجمالي الطلب: {إجمالي_الطلب} ج.م\n🚚 التوصيل: {التوصيل}\n⭐ الإجمالي النهائي: {الإجمالي_النهائي} ج.م');
    
    setVal('admin-vip-whatsapp-template', globalSettings.vipWhatsappTemplate || 'السلام عليكم،\nأريد الانضمام لقائمة الـ VIP وحجز ({اسم_المنتج}) من الدفعة القادمة قبل نزولها المتجر. 👑');
    setVal('admin-ticktick-template', globalSettings.ticktickTemplate || '🧾 **تفاصيل الأوردر كاملة:**\n👤 الاسم: {اسم_العميل}\n📱 الموبايل: {الموبايل}\n📍 المنطقة: {المنطقة}\n{العنوان}\n🕒 الوقت: {الوقت}\n--------------------------------\n🛒 الطلبات:\n{تفاصيل_الطلبات}\n--------------------------------\n📦 قيمة الطلبات: {قيمة_الطلبات} ج.م\n{الخصم}🚚 رسوم التوصيل: {التوصيل}\n💰 الإجمالي النهائي: {الاجمالي} ج.م\n{ملاحظات}\n{الهاشتاجات}');

    // إعدادات المظهر
    const theme = globalSettings.theme || {};
    setVal('admin-theme-color', theme.themeColor || '#1b4332');
    setVal('admin-theme-header-bg', theme.headerBg || '');
    setCheck('admin-theme-popup-active', theme.popupActive || false);
    setVal('admin-theme-popup-title', theme.popupTitle || '');
    setVal('admin-theme-popup-msg', theme.popupMsg || '');
    setVal('admin-theme-popup-img', theme.popupImg || '');
    setCheck('admin-theme-show-badges', theme.showBadges !== false);
    setCheck('admin-theme-show-size', theme.showSizeGuide !== false);
    setCheck('admin-theme-show-extras', theme.showExtras !== false);

    const textsCont = document.getElementById('admin-texts-container');
    if(textsCont && typeof textsConfig !== 'undefined') {
        textsCont.innerHTML = '';
        textsConfig.forEach(t => {
            const val = (globalSettings.uiTexts && globalSettings.uiTexts[t.id]) ? globalSettings.uiTexts[t.id] : t.default;
            textsCont.innerHTML += `<div><label class="text-[10px] font-bold text-gray-500 block mb-1">${t.label}</label><input type="text" id="ui-txt-${t.id}" value="${val}" class="w-full border rounded p-2 text-xs font-bold text-brand-navy outline-none focus:border-brand-cyan"></div>`;
        });
    }

    tempProducts = JSON.parse(JSON.stringify(productsInfo));
    renderAdminProducts(); 
    
    const dashboardModal = document.getElementById('admin-dashboard-modal');
    if(dashboardModal) {
        dashboardModal.classList.remove('hidden'); 
        setTimeout(() => dashboardModal.classList.remove('opacity-0'), 10); 
    }
    switchAdminTab('stats');
};

window.closeAdminDashboard = () => { 
    const modal = document.getElementById('admin-dashboard-modal');
    if(modal) {
        modal.classList.add('opacity-0'); 
        setTimeout(() => modal.classList.add('hidden'), 300); 
    }
};

// ==================== الإحصائيات ====================
window.renderTopProductsStats = () => {
    const c = document.getElementById('top-products-list'); if(!c) return;
    if(globalSettings.bestSellers && globalSettings.bestSellers.length > 0) { 
        c.innerHTML = globalSettings.bestSellers.map(id => { 
            const p = productsInfo[id]; 
            return p ? `<div class="flex justify-between items-center bg-gray-50 p-2 rounded border"><span class="font-bold text-brand-navy">${p.name}</span><span class="text-[10px] bg-brand-yellow text-brand-navy px-2 py-0.5 rounded-full font-black">🔥 الأكثر مبيعاً</span></div>` : ''; 
        }).join(''); 
    } else { 
        c.innerHTML = '<div class="text-xs text-gray-400">لم تقم بتحديد منتجات كأكثر مبيعاً من قائمة المنتجات.</div>'; 
    }
}

// ==================== إدارة المنتجات ====================
window.moveProduct = (id, direction) => {
    syncAdminProductsFromDOM();
    const keys = Object.keys(tempProducts);
    const idx = keys.indexOf(id);
    if (direction === 'up' && idx > 0) {
        [keys[idx], keys[idx - 1]] = [keys[idx - 1], keys[idx]];
    } else if (direction === 'down' && idx < keys.length - 1) {
        [keys[idx], keys[idx + 1]] = [keys[idx + 1], keys[idx]];
    } else { return; }
    const newObj = {};
    keys.forEach(k => newObj[k] = tempProducts[k]);
    tempProducts = newObj;
    renderAdminProducts();
};

window.renderAdminProducts = () => {
    const container = document.getElementById('admin-inputs-container'); 
    if(!container) return;
    container.innerHTML = '';
    Object.keys(tempProducts).forEach(id => {
        const p = tempProducts[id]; const stock = globalStock[id] || 0; const price = globalPrices[id] || p.basePrice; const oldPrice = globalOldPrices[id] || price; const isDisc = globalDiscounts[id] || false; const isBest = globalSettings.bestSellers?.includes(id) || false;
        const imgSrc = (p.images && p.images.length > 0) ? p.images[0] : '';
        container.innerHTML += `<div class="bg-white border border-gray-200 rounded-xl p-3 shadow-sm mb-3">
            <div class="flex justify-between items-center cursor-pointer" onclick="document.getElementById('edit-p-${id}').classList.toggle('hidden')">
                <div class="font-black text-brand-navy flex items-center gap-2">
                    <div class="flex flex-col gap-1 ml-1 mr-[-5px]">
                        <button onclick="event.stopPropagation(); moveProduct('${id}', 'up')" class="text-gray-400 hover:text-brand-cyanDark text-[12px] bg-gray-100 rounded w-5 h-5 flex justify-center items-center"><i class="fa-solid fa-chevron-up"></i></button>
                        <button onclick="event.stopPropagation(); moveProduct('${id}', 'down')" class="text-gray-400 hover:text-brand-cyanDark text-[12px] bg-gray-100 rounded w-5 h-5 flex justify-center items-center"><i class="fa-solid fa-chevron-down"></i></button>
                    </div>
                    <img src="${imgSrc}" class="w-8 h-8 rounded object-cover" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\'><rect width=\\'100%\\' height=\\'100%\\' fill=\\'%23f1f5f9\\'/></svg>'"> ${p.name}
                </div>
                <div class="text-xs bg-gray-50 border px-2 py-1 rounded font-bold text-gray-600">تعديل <i class="fa-solid fa-chevron-down"></i></div>
            </div>
            <div id="edit-p-${id}" class="hidden mt-4 space-y-3 border-t pt-3">
                <div class="grid grid-cols-2 gap-2">
                    <div><label class="text-[10px] font-bold text-gray-500">الاسم</label><input type="text" id="p-name-${id}" value="${p.name}" class="w-full border p-2 rounded text-xs font-bold text-brand-navy outline-none focus:border-brand-cyan"></div>
                    <div><label class="text-[10px] font-bold text-gray-500">الوزن / الوصف</label><input type="text" id="p-weight-${id}" value="${p.weight}" class="w-full border p-2 rounded text-xs font-bold text-brand-navy outline-none focus:border-brand-cyan"></div>
                    <div><label class="text-[10px] font-bold text-gray-500">السعر (ج)</label><input type="number" id="p-price-${id}" value="${price}" class="w-full border p-2 rounded text-xs font-bold text-brand-cyanDark outline-none focus:border-brand-cyan"></div>
                    <div><label class="text-[10px] font-bold text-gray-500">المخزون المتوفر</label><input type="number" id="p-stock-${id}" value="${stock}" class="w-full border p-2 rounded text-xs font-black outline-none focus:border-brand-cyan ${stock<5?'border-red-500 bg-red-50 text-red-600':'text-brand-navy'}"></div>
                    <div class="col-span-2"><label class="text-[10px] font-bold text-gray-500">رابط الصورة</label><input type="text" id="p-img-${id}" value="${imgSrc}" class="w-full border p-2 rounded text-[10px] font-bold text-gray-500 outline-none focus:border-brand-cyan" dir="ltr"></div>
                </div>
                <div class="flex flex-wrap gap-3 bg-gray-50 p-2 rounded border mb-2">
                    <label class="flex items-center gap-1 text-[10px] font-bold cursor-pointer select-none"><input type="checkbox" id="p-extra-${id}" ${p.isExtra?'checked':''} class="accent-brand-cyanDark"> إضافي (بالأسفل)</label>
                    <label class="flex items-center gap-1 text-[10px] font-bold cursor-pointer select-none"><input type="checkbox" id="p-best-${id}" ${isBest?'checked':''} class="accent-brand-yellow"> الأكثر طلباً 🔥</label>
                    <label class="flex items-center gap-1 text-[10px] font-bold text-red-600 cursor-pointer select-none"><input type="checkbox" id="p-disc-${id}" ${isDisc?'checked':''} class="accent-red-500" onchange="document.getElementById('p-old-${id}').classList.toggle('hidden', !this.checked)"> خصم لسعر قديم:</label>
                    <input type="number" id="p-old-${id}" value="${oldPrice}" class="w-12 border rounded p-1 text-[10px] text-center bg-white text-red-500 font-bold line-through outline-none ${isDisc?'':'hidden'}">
                </div>
                <button onclick="deleteAdminProduct('${id}')" class="w-full mt-2 bg-red-50 border border-red-200 text-red-600 font-bold text-xs py-2 rounded hover:bg-red-100 transition-colors"><i class="fa-solid fa-trash"></i> حذف هذا المنتج نهائياً</button>
            </div>
        </div>`;
    });
};

window.addNewAdminProduct = () => { 
    const newId = 'p_' + Date.now(); 
    tempProducts[newId] = { name: "منتج جديد", basePrice: 0, weight: "1 طبق", images: [""], isExtra: false }; 
    globalStock[newId] = 0; globalPrices[newId] = 0; globalOldPrices[newId] = 0; globalDiscounts[newId] = false; 
    renderAdminProducts(); 
    setTimeout(()=>document.getElementById(`edit-p-${newId}`)?.classList.remove('hidden'), 100); 
};

window.deleteAdminProduct = (id) => { 
    if(!confirm('هل أنت متأكد من حذف هذا المنتج تماماً من المتجر؟')) return; 
    delete tempProducts[id]; delete globalStock[id]; delete globalPrices[id]; delete globalOldPrices[id]; delete globalDiscounts[id]; 
    renderAdminProducts(); 
};

window.syncAdminProductsFromDOM = () => {
    if(!document.getElementById('admin-inputs-container') || document.getElementById('admin-inputs-container').innerHTML === '') return;
    let newBest = [];
    Object.keys(tempProducts).forEach(id => {
        if(!document.getElementById(`p-name-${id}`)) return; 
        tempProducts[id].name = document.getElementById(`p-name-${id}`).value; 
        tempProducts[id].weight = document.getElementById(`p-weight-${id}`).value; 
        tempProducts[id].images = [document.getElementById(`p-img-${id}`).value]; 
        tempProducts[id].isExtra = document.getElementById(`p-extra-${id}`).checked;
        globalPrices[id] = parseInt(document.getElementById(`p-price-${id}`).value) || 0; 
        globalStock[id] = parseInt(document.getElementById(`p-stock-${id}`).value) || 0; 
        globalOldPrices[id] = parseInt(document.getElementById(`p-old-${id}`).value) || 0; 
        globalDiscounts[id] = document.getElementById(`p-disc-${id}`).checked;
        if(document.getElementById(`p-best-${id}`).checked) newBest.push(id);
    });
    globalSettings.bestSellers = newBest;
};

// ==================== مناطق التوصيل ====================
window.renderAdminZones = () => { 
    const c=document.getElementById('admin-zones-container'); 
    if(!c) return;
    c.innerHTML=''; 
    tempAdminZones.forEach((z,i) => c.innerHTML += `<div class="flex gap-2 items-center"><input type="text" value="${z.name}" class="flex-1 border rounded p-2 text-sm font-bold text-brand-navy outline-none focus:border-brand-cyan" onchange="tempAdminZones[${i}].name=this.value"><input type="number" value="${z.price}" class="w-16 border rounded p-2 text-sm text-center font-bold text-brand-cyanDark outline-none focus:border-brand-cyan" onchange="tempAdminZones[${i}].price=parseInt(this.value)"><button onclick="tempAdminZones.splice(${i},1);renderAdminZones()" class="text-red-500 hover:bg-red-50 rounded w-8 h-8 transition-colors"><i class="fa-solid fa-trash"></i></button></div>`); 
};
window.addNewAdminZone = () => { tempAdminZones.push({id:'z_'+Date.now(), name:'', price:0}); renderAdminZones(); };

// ==================== أكواد الخصم والتسويق ====================
window.renderAdminPromos = () => { 
    const c = document.getElementById('admin-promos-container'); 
    if(!c) return;
    c.innerHTML=''; 
    tempPromoCodes.forEach((p,i) => {
        const autoBadge = p.isAuto ? `<span class="bg-yellow-100 text-yellow-700 text-[8px] font-black px-1 rounded ml-1">تلقائي</span>` : '';
        if(p.usesLeft === undefined) p.usesLeft = p.isAuto ? 1 : 100;
        p.minOrder = p.minOrder || 0;
        p.maxDiscount = p.maxDiscount || 0;
        p.expiryDate = p.expiryDate || '';

        c.innerHTML += `
        <div class="flex flex-col gap-2 bg-gray-50 p-3 border border-gray-200 rounded-xl mb-3 relative overflow-hidden shadow-sm">
            ${p.customerPhone ? `<div class="absolute top-0 right-0 w-1 h-full bg-purple-500"></div>` : ''}
            <div class="flex gap-2 items-center flex-wrap pr-2">
                <input type="text" value="${p.code}" placeholder="الكود" class="w-24 border rounded p-1.5 text-xs text-center uppercase font-black text-brand-navy outline-none focus:border-brand-cyan" onchange="tempPromoCodes[${i}].code=this.value.toUpperCase()">
                ${autoBadge}
                <input type="number" value="${p.discount}" placeholder="خصم" class="w-16 border rounded p-1.5 text-xs text-center font-bold text-brand-cyanDark outline-none focus:border-brand-cyan" onchange="tempPromoCodes[${i}].discount=parseInt(this.value)">
                <select class="flex-1 border rounded p-1.5 text-xs bg-white font-bold text-gray-600 outline-none" onchange="tempPromoCodes[${i}].type=this.value; renderAdminPromos();">
                    <option value="fixed" ${p.type==='fixed'?'selected':''}>جنيه</option>
                    <option value="percent" ${p.type==='percent'?'selected':''}>%</option>
                    <option value="free_delivery" ${p.type==='free_delivery'?'selected':''}>توصيل مجاني</option>
                </select>
            </div>
            <div class="grid grid-cols-2 gap-2 mt-1">
                <div><label class="text-[10px] font-bold text-gray-500 block mb-0.5">الحد الأدنى للطلب (ج)</label><input type="number" value="${p.minOrder}" placeholder="بدون حد" class="w-full border rounded p-1.5 text-xs text-center font-bold text-brand-navy outline-none focus:border-brand-cyan" onchange="tempPromoCodes[${i}].minOrder=parseInt(this.value) || 0"></div>
                <div><label class="text-[10px] font-bold text-gray-500 block mb-0.5">الحد الأقصى للخصم (ج)</label><input type="number" value="${p.maxDiscount}" placeholder="بدون حد" class="w-full border rounded p-1.5 text-xs text-center font-bold text-brand-navy outline-none focus:border-brand-cyan ${p.type !== 'percent' ? 'bg-gray-100 cursor-not-allowed opacity-50' : ''}" ${p.type !== 'percent' ? 'disabled' : ''} onchange="tempPromoCodes[${i}].maxDiscount=parseInt(this.value) || 0"></div>
            </div>
            <div class="grid grid-cols-2 gap-2 mt-1">
                <div><label class="text-[10px] font-bold text-gray-500 block mb-0.5">تاريخ الانتهاء</label><input type="date" value="${p.expiryDate}" class="w-full border rounded p-1.5 text-xs text-center font-bold text-brand-navy outline-none focus:border-brand-cyan" onchange="tempPromoCodes[${i}].expiryDate=this.value"></div>
                <div><label class="text-[10px] font-bold text-gray-500 block mb-0.5">متاح لعدد أشخاص</label><input type="number" value="${p.usesLeft !== null ? p.usesLeft : ''}" placeholder="∞" class="w-full border rounded p-1.5 text-xs text-center font-bold text-brand-navy outline-none focus:border-brand-cyan" onchange="tempPromoCodes[${i}].usesLeft=this.value === '' ? null : parseInt(this.value)"></div>
            </div>
            <div class="flex items-center bg-white border rounded p-1.5 border-gray-300 mt-1">
                <i class="fa-solid fa-mobile-screen text-gray-400 text-[10px] w-4 text-center"></i>
                <input type="text" value="${p.customerPhone || ''}" placeholder="مخصص لرقم موبايل (اختياري)" class="flex-1 text-xs font-bold text-brand-navy outline-none bg-transparent" onchange="tempPromoCodes[${i}].customerPhone=this.value" dir="ltr" style="text-align: right;">
            </div>
            <button onclick="tempPromoCodes.splice(${i},1);renderAdminPromos()" class="absolute top-2 left-2 text-red-500 hover:bg-red-100 rounded w-7 h-7 flex justify-center items-center transition-colors"><i class="fa-solid fa-trash text-[12px]"></i></button>
        </div>`;
    }); 
};

window.addNewPromoCode = () => { 
    tempPromoCodes.push({ code: '', discount: 0, type: 'fixed', usesLeft: null, minOrder: 0, maxDiscount: 0, expiryDate: '', customerPhone: '' }); 
    renderAdminPromos(); 
};

window.generateBulkWhatsAppLinks = () => {
    const numbersRaw = document.getElementById('admin-bulk-numbers')?.value.trim();
    const messageTemplate = document.getElementById('admin-bulk-message')?.value.trim() || "شكراً لثقتك! كود الخصم بتاعك: {الكود}";
    const rewardType = document.getElementById('admin-bulk-reward-type')?.value;
    const rewardValue = parseInt(document.getElementById('admin-bulk-reward-value')?.value) || 0;

    if(!numbersRaw) { showAlert("تنبيه", "يرجى إدخال أرقام الموبايلات أولاً"); return; }

    const numbers = numbersRaw.split('\n').map(n => n.trim()).filter(n => n.length >= 10);

    if(numbers.length === 0) { showAlert("تنبيه", "لم يتم العثور على أرقام صحيحة"); return; }

    const linksContainer = document.getElementById('bulk-whatsapp-links');
    if(!linksContainer) return;
    
    linksContainer.innerHTML = '<p class="text-xs font-black text-brand-navy mb-2 border-b pb-2"><i class="fa-solid fa-check-double text-green-500"></i> اضغط "إرسال" قدام كل رقم:</p>';

    numbers.forEach(num => {
        const randomCode = "THX-" + Math.floor(1000 + Math.random() * 9000);
        
        tempPromoCodes.push({ 
            code: randomCode, 
            type: rewardType, 
            discount: rewardValue, 
            isAuto: true, 
            usesLeft: null,
            customerPhone: num,
            minOrder: 0,
            maxDiscount: 0,
            expiryDate: '' 
        });

        const finalMessage = messageTemplate.replace(/{الكود}/g, randomCode);
        let waNumber = num;
        if(waNumber.startsWith('0')) waNumber = '2' + waNumber; 

        const waLink = `https://api.whatsapp.com/send?phone=${waNumber}&text=${encodeURIComponent(finalMessage)}`;

        linksContainer.innerHTML += `
            <div class="flex justify-between items-center bg-white p-2 border border-gray-200 rounded-lg shadow-sm mb-2">
                <span class="text-xs font-bold text-gray-600" dir="ltr">${num}</span>
                <a href="${waLink}" target="_blank" class="bg-green-500 hover:bg-green-600 text-white text-[10px] px-4 py-1.5 rounded font-black transition-colors flex items-center gap-1">
                    إرسال <i class="fa-brands fa-whatsapp text-sm"></i>
                </a>
            </div>
        `;
    });

    renderAdminPromos();
    linksContainer.classList.remove('hidden');
    showAlert("تم التجهيز بنجاح 🎉", `تم إنشاء أكواد لـ ${numbers.length} عميل.\n\n⚠️ مهم جداً: انزل تحت في لوحة التحكم ودوس "حفظ الإعدادات" عشان الأكواد تتفعل في السيستم وتقدر تبعت الرسايل.`);
};

// ==================== إدارة الطلبات (CRM) ====================
window.sendMessageToCustomer = (phone, order) => {
    let itemsText = order.items.map(i => `${i.quantity}x ${i.name}`).join('\n');
    let msg = `مرحباً ${order.customerName}،\nتفاصيل طلبك:\n${itemsText}\nالإجمالي: ${order.total} ج.م\nشكراً لتعاملك معنا!`;
    let waNumber = phone.startsWith('0') ? '2' + phone : phone;
    window.open(`https://api.whatsapp.com/send?phone=${waNumber}&text=${encodeURIComponent(msg)}`, '_blank');
};

window.sendRatingRequest = (phone, order) => {
    let msg = `شكراً ${order.customerName} على طلبك!\nتقدر تقيم تجربتك معانا من هنا:\n⭐️ [رابط التقييم]\n(سيتم إضافة الرابط لاحقاً)`;
    let waNumber = phone.startsWith('0') ? '2' + phone : phone;
    window.open(`https://api.whatsapp.com/send?phone=${waNumber}&text=${encodeURIComponent(msg)}`, '_blank');
};

window.renderOrdersList = () => {
    const container = document.getElementById('orders-list-container');
    if(!container) return;
    
    const searchQuery = document.getElementById('order-search')?.value.trim().toLowerCase() || '';
    
    let filtered = ordersList.filter(o => {
        if(orderFilter !== 'all' && o.status !== orderFilter) return false;
        if(searchQuery) {
            const nameMatch = o.customerName?.toLowerCase().includes(searchQuery);
            const phoneMatch = o.customerPhone?.toLowerCase().includes(searchQuery);
            const zoneMatch = o.zone?.toLowerCase().includes(searchQuery);
            const addressMatch = o.customerAddress?.toLowerCase().includes(searchQuery);
            const itemsMatch = o.items?.some(i => i.name?.toLowerCase().includes(searchQuery));
            if(!nameMatch && !phoneMatch && !zoneMatch && !addressMatch && !itemsMatch) return false;
        }
        return true;
    });
    
    if(filtered.length === 0) { 
        container.innerHTML = '<p class="text-center text-gray-500 py-8 font-bold text-sm bg-gray-50 rounded-xl border border-dashed">لا توجد طلبات تطابق بحثك</p>'; 
        return; 
    }

    container.innerHTML = filtered.map(order => {
        let statusColor = order.status === 'new' ? 'bg-red-100 text-red-700 border-red-200' : (order.status === 'processing' ? 'bg-yellow-100 text-yellow-700 border-yellow-200' : 'bg-green-100 text-green-700 border-green-200');
        let statusText = order.status === 'new' ? 'جديد' : (order.status === 'processing' ? 'قيد التجهيز' : 'مكتمل');
        
        let itemsHtml = order.items.map(i => `<div class="flex justify-between text-xs text-gray-700 font-bold border-b border-gray-100 pb-1 mb-1 last:border-0 last:pb-0 last:mb-0"><span><span class="text-brand-cyanDark">${i.quantity}x</span> ${i.name}</span><span>${i.quantity*i.price} ج</span></div>`).join('');

        return `
        <div class="bg-white border rounded-xl p-4 shadow-sm relative overflow-hidden mb-3">
            <div class="absolute top-0 right-0 w-1 h-full ${order.status === 'new' ? 'bg-red-500' : (order.status === 'processing' ? 'bg-yellow-500' : 'bg-green-500')}"></div>
            <div class="flex justify-between items-start mb-3">
                <div>
                    <div class="font-black text-brand-navy">${order.customerName}</div>
                    <a href="tel:${order.customerPhone}" class="text-sm font-bold text-blue-600 hover:underline" dir="ltr">${order.customerPhone}</a>
                </div>
                <div class="flex gap-2 items-center">
                    <button onclick="sendMessageToCustomer('${order.customerPhone}', ordersList.find(o=>o.id==='${order.id}'))" class="text-[10px] bg-blue-500 text-white px-2 py-1 rounded font-bold"><i class="fa-brands fa-whatsapp"></i> رسالة</button>
                    <span class="px-2 py-1 rounded text-[10px] font-black border ${statusColor}">${statusText}</span>
                </div>
            </div>
            <div class="text-[11px] text-gray-500 mb-3 font-bold bg-gray-50 p-2 rounded">
                <i class="fa-solid fa-location-dot text-brand-cyanDark mr-1"></i> ${order.zone} ${order.customerAddress && order.customerAddress !== 'غير محدد' ? ' - ' + order.customerAddress : ''}
            </div>
            <div class="bg-gray-50 border border-gray-100 p-2 rounded-lg mb-3 space-y-1">${itemsHtml}</div>
            
            <div class="bg-brand-light/20 p-3 rounded-xl border border-brand-cyan/10 text-xs font-bold space-y-1 mb-3">
                <div class="flex justify-between"><span>قيمة الطلبات:</span> <span>${order.subtotal || 0} ج.م</span></div>
                ${(order.discount && order.discount > 0) ? `<div class="flex justify-between text-red-500"><span>الخصم:</span> <span>-${order.discount} ج.م</span></div>` : ''}
                <div class="flex justify-between text-gray-500"><span>التوصيل:</span> <span>${order.deliveryFee || 0} ج.م</span></div>
                <div class="flex justify-between text-sm font-black text-brand-navy border-t border-brand-cyan/20 pt-2 mt-2">
                    <span>الإجمالي:</span> 
                    <span class="text-brand-cyanDark text-lg">${order.total} <span class="text-[10px] text-gray-500">ج.م</span></span>
                </div>
            </div>
            
            <div class="flex gap-2 flex-wrap">
                ${order.status === 'new' ? `<button onclick="updateOrderStatus('${order.id}', 'processing')" class="flex-1 bg-yellow-500 hover:bg-yellow-600 transition-colors text-white py-2 rounded-lg text-xs font-black shadow-sm">قيد التجهيز</button>` : ''}
                ${order.status === 'processing' ? `<button onclick="updateOrderStatus('${order.id}', 'completed')" class="flex-1 bg-green-500 hover:bg-green-600 transition-colors text-white py-2 rounded-lg text-xs font-black shadow-sm">تم التوصيل</button>` : ''}
                ${order.status === 'completed' ? `<button onclick="sendRatingRequest('${order.customerPhone}', ordersList.find(o=>o.id==='${order.id}'))" class="flex-1 bg-purple-500 hover:bg-purple-600 text-white py-2 rounded-lg text-xs font-black"><i class="fa-solid fa-star"></i> إرسال تقييم</button>` : ''}
            </div>
        </div>`;
    }).join('');
};

document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('order-search');
    if (searchInput) searchInput.addEventListener('input', debounce(() => renderOrdersList(), 300));
});

async function loadOrders() { 
    if(!hasCloud || !db) return; 
    try { 
        const container = document.getElementById('orders-list-container');
        if(container) container.innerHTML = '<div class="text-center py-10 text-gray-400"><i class="fa-solid fa-spinner fa-spin text-2xl mb-2"></i><p class="text-xs font-bold">جاري جلب الطلبات...</p></div>';
        
        const snap = await db.collection("orders").orderBy("createdAt","desc").get(); 
        ordersList=[]; 
        snap.forEach(d=>ordersList.push({id:d.id, ...d.data()})); 
        renderOrdersList();
        
        dispatchOrdersList = ordersList.filter(o => o.status === 'processing');
        if(currentAdminTab === 'dispatch') renderDispatchOrders();
    } catch(e){ console.log("Error loading orders", e); } 
}

window.filterOrders = (f) => { orderFilter=f; renderOrdersList(); };

window.updateOrderStatus = async (id, s) => { 
    if(db){ 
        const btn = event.target; 
        if(btn) { btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; btn.disabled = true; }
        await db.collection("orders").doc(id).update({status:s}); 
        loadOrders(); 
    } 
};

window.deleteAllOrders = async () => {
    if(!confirm("⚠️ تحذير: هل أنت متأكد من مسح جميع الطلبات من السجل؟ لا يمكن التراجع عن هذا الإجراء!")) return;
    const btn = document.querySelector('button[onclick="deleteAllOrders()"]'); 
    const originalHtml = btn ? btn.innerHTML : '';
    if(btn) btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري المسح...';
    
    if(hasCloud && db) {
        try {
            const snap = await db.collection("orders").get();
            if(!snap.empty) {
                const batch = db.batch();
                snap.docs.forEach(doc => batch.delete(doc.ref));
                await batch.commit();
            }
            if(btn) btn.innerHTML = originalHtml; 
            showAlert("تم المسح", "تم مسح جميع سجلات الطلبات بنجاح."); 
            loadOrders();
        } catch(e) { 
            if(btn) btn.innerHTML = originalHtml; 
            showAlert("خطأ", "حدث خطأ أثناء المسح."); 
        }
    } else { 
        ordersList = []; 
        renderOrdersList(); 
        if(btn) btn.innerHTML = originalHtml; 
        showAlert("تم بنجاح", "تم المسح محلياً."); 
    }
};

window.resetStatsOnly = async () => {
    if(!confirm("⚠️ تحذير: هل أنت متأكد من تصفير عدادات الإحصائيات (مبيعات اليوم والطلبات) لتبدأ من صفر؟")) return;
    const btn = document.querySelector('button[onclick="resetStatsOnly()"]'); 
    const originalHtml = btn ? btn.innerHTML : '';
    if(btn) btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري التصفير...';
    
    if(hasCloud && db) {
        try {
            await db.collection("inventory").doc("stats").set({ sales: 0, orders: 0 });
            if(btn) btn.innerHTML = originalHtml; 
            showAlert("تم التصفير", "تم تصفير عدادات المبيعات بنجاح.");
        } catch(e) { 
            if(btn) btn.innerHTML = originalHtml; 
            showAlert("خطأ", "حدث خطأ أثناء الاتصال بقاعدة البيانات."); 
        }
    } else {
        if(typeof dailyStats !== 'undefined') dailyStats = { sales: 0, orders: 0 }; 
        if(document.getElementById('stat-sales')) document.getElementById('stat-sales').innerText = 0; 
        if(document.getElementById('stat-orders')) document.getElementById('stat-orders').innerText = 0;
        if(btn) btn.innerHTML = originalHtml; 
        showAlert("تم بنجاح", "تم التصفير محلياً.");
    }
};

// ==================== إدارة المناديب والتوزيع ====================
window.renderAdminDrivers = () => {
    const container = document.getElementById('admin-drivers-container');
    if(!container) return;
    container.innerHTML = '';
    
    if(tempDrivers.length === 0) {
        container.innerHTML = '<p class="text-[10px] text-gray-400 font-bold mb-2">لا يوجد مناديب مسجلين.</p>';
    }

    tempDrivers.forEach((d, i) => {
        container.innerHTML += `
        <div class="flex gap-2 items-center mb-2">
            <input type="text" value="${d.name}" placeholder="اسم المندوب" class="w-1/2 border rounded-lg p-2 text-xs font-bold text-brand-navy outline-none focus:border-brand-cyan" onchange="tempDrivers[${i}].name = this.value">
            <input type="tel" value="${d.phone}" placeholder="رقم الموبايل الواتساب" class="w-1/2 border rounded-lg p-2 text-xs font-bold text-brand-navy outline-none focus:border-brand-cyan" dir="ltr" onchange="tempDrivers[${i}].phone = this.value">
            <button onclick="tempDrivers.splice(${i},1); renderAdminDrivers();" class="text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors"><i class="fa-solid fa-trash"></i></button>
        </div>`;
    });
    renderDriverSelect();
};

window.addNewDriver = () => {
    tempDrivers.push({name: '', phone: ''});
    renderAdminDrivers();
};

window.renderDriverSelect = () => {
    const select = document.getElementById('dispatch-driver-select');
    if(!select) return;
    select.innerHTML = '<option value="">-- اختر المندوب --</option>' + 
        tempDrivers.filter(d => d.name && d.phone).map(d => `<option value="${d.phone}">${d.name} (${d.phone})</option>`).join('');
};

window.renderDispatchOrders = () => {
    const container = document.getElementById('dispatch-orders-container');
    if (!container) return;
    const zoneFilter = document.getElementById('dispatch-zone-filter')?.value || 'all';

    const zoneSelect = document.getElementById('dispatch-zone-filter');
    if (zoneSelect && dispatchOrdersList.length > 0) {
        const zones = [...new Set(dispatchOrdersList.map(o => o.zone))].sort();
        zoneSelect.innerHTML = '<option value="all">كل المناطق</option>' +
            zones.map(z => `<option value="${z}" ${zoneFilter === z ? 'selected' : ''}>${z}</option>`).join('');
    }

    let filtered = dispatchOrdersList;
    if (zoneFilter !== 'all') filtered = filtered.filter(o => o.zone === zoneFilter);

    if (filtered.length === 0) {
        container.innerHTML = '<p class="text-center text-gray-400 py-4 text-sm font-bold">لا توجد طلبات قيد التجهيز في هذه المنطقة</p>';
        return;
    }

    container.innerHTML = filtered.map(order => {
        const itemsText = order.items.map(i => `${i.quantity}x ${i.name}`).join('، ');
        const address = (order.customerAddress && order.customerAddress !== 'غير محدد') ? order.customerAddress : '';
        return `
        <div class="flex items-start gap-3 bg-white p-3 rounded-lg border shadow-sm cursor-pointer hover:border-brand-cyan transition-colors">
            <input type="checkbox" class="dispatch-checkbox mt-1 accent-brand-cyanDark w-5 h-5 cursor-pointer" data-id="${order.id}" onchange="updateDispatchCount()">
            <div class="flex-1" onclick="this.previousElementSibling.click()">
                <div class="font-black text-brand-navy">${order.customerName}</div>
                <div class="text-xs text-gray-500 mt-1">📱 ${order.customerPhone}</div>
                <div class="text-xs text-gray-500">📍 ${order.zone} ${address ? '- ' + address : ''}</div>
                <div class="text-[11px] mt-1 bg-gray-50 p-1.5 rounded font-bold text-gray-600">🛒 ${itemsText}</div>
                <div class="text-xs font-black text-brand-cyanDark mt-1">💰 الإجمالي: ${order.total} ج.م <span class="text-gray-400 font-bold">(توصيل: ${order.deliveryFee} ج)</span></div>
            </div>
        </div>`;
    }).join('');
    updateDispatchCount();
};

window.updateDispatchCount = () => {
    const checkboxes = document.querySelectorAll('.dispatch-checkbox:checked');
    if(!checkboxes) return;
    const span = document.getElementById('dispatch-selected-count');
    if (span) span.innerText = checkboxes.length;
};

window.toggleSelectAllDispatch = () => {
    const checkboxes = document.querySelectorAll('.dispatch-checkbox');
    const allChecked = [...checkboxes].every(cb => cb.checked);
    checkboxes.forEach(cb => cb.checked = !allChecked);
    updateDispatchCount();
};

window.sendDispatchToDriver = () => {
    const driverSelect = document.getElementById('dispatch-driver-select');
    const phone = driverSelect ? driverSelect.value : '';

    if (!phone) { showAlert('تنبيه', 'يرجى اختيار المندوب أولاً'); return; }

    const checkedOrders = [];
    document.querySelectorAll('.dispatch-checkbox:checked').forEach(cb => {
        const order = dispatchOrdersList.find(o => o.id === cb.getAttribute('data-id'));
        if (order) checkedOrders.push(order);
    });

    if (checkedOrders.length === 0) { showAlert('تنبيه', 'لم تختر أي طلب للإرسال'); return; }

    const template = (globalSettings.dispatchTemplate || 
        '📦 طلب جديد من {اسم_العميل}\n📱 {رقم_العميل}\n📍 {المنطقة} - {العنوان}\n🛒 الطلبات:\n{تفاصيل_الطلبات}\n💰 إجمالي الطلب: {إجمالي_الطلب} ج.م\n🚚 التوصيل: {التوصيل}\n⭐ الإجمالي النهائي: {الإجمالي_النهائي} ج.م');

    let fullMessage = `📋 كشف أوردرات (${new Date().toLocaleDateString('ar-EG')})\n\n`;
    
    checkedOrders.forEach(order => {
        let itemsText = order.items.map(i => `▪️ ${i.quantity}x ${i.name}`).join('\n');
        let address = (order.customerAddress && order.customerAddress !== 'غير محدد') ? order.customerAddress : '';
        let msg = template
            .replace(/{اسم_العميل}/g, order.customerName)
            .replace(/{رقم_العميل}/g, order.customerPhone)
            .replace(/{المنطقة}/g, order.zone)
            .replace(/{العنوان}/g, address)
            .replace(/{تفاصيل_الطلبات}/g, itemsText)
            .replace(/{إجمالي_الطلب}/g, order.subtotal)
            .replace(/{التوصيل}/g, order.deliveryFee)
            .replace(/{الإجمالي_النهائي}/g, order.total);
        fullMessage += msg + '\n\n' + '━'.repeat(15) + '\n\n';
    });

    let waNumber = phone.startsWith('0') ? '2' + phone : phone;
    window.open(`https://api.whatsapp.com/send?phone=${waNumber}&text=${encodeURIComponent(fullMessage.trim())}`, '_blank');
};

// ==================== دوال الحفظ ====================
const updateSettingsDB = async (updates, btnSelector) => {
    const btn = document.querySelector(btnSelector);
    const origHtml = btn ? btn.innerHTML : '';
    if(btn) { btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-xl"></i> جاري الحفظ...'; btn.disabled = true; }
    
    try {
        if(hasCloud && db) await db.collection("inventory").doc("settings").update(updates);
        Object.assign(globalSettings, updates);
        if(btn) { btn.innerHTML = origHtml; btn.disabled = false; }
        showAlert("تم بنجاح", "تم الحفظ بنجاح.");
    } catch(e) {
        if(btn) { btn.innerHTML = origHtml; btn.disabled = false; }
        showAlert("خطأ", "حدث خطأ أثناء الحفظ. تأكد من اتصالك بالإنترنت.");
    }
};

window.saveStoreSettings = () => {
    const el = id => document.getElementById(id);
    const updates = {};
    if(el('admin-store-open')) updates.storeOpen = el('admin-store-open').checked;
    if(el('admin-store-name')) updates.storeName = el('admin-store-name').value.trim();
    if(el('admin-store-desc')) updates.storeDesc = el('admin-store-desc').value.trim();
    if(el('admin-store-phone')) updates.storePhone = el('admin-store-phone').value.trim();
    if(el('admin-min-order')) updates.minOrder = parseInt(el('admin-min-order').value) || 0;
    
    updateSettingsDB(updates, 'button[onclick="saveStoreSettings()"]');
    if(typeof applySettingsToUI === 'function') applySettingsToUI();
};

window.saveProductsData = async () => {
    syncAdminProductsFromDOM();
    const btn = document.querySelector('button[onclick="saveProductsData()"]');
    const origHtml = btn ? btn.innerHTML : '';
    if(btn) { btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-xl"></i> جاري الحفظ...'; btn.disabled = true; }
    
    try {
        if(hasCloud && db) {
            await Promise.all([
                db.collection("inventory").doc("settings").update({bestSellers: globalSettings.bestSellers}),
                db.collection("inventory").doc("stock").set(globalStock),
                db.collection("inventory").doc("prices").set(globalPrices),
                db.collection("inventory").doc("old_prices").set(globalOldPrices),
                db.collection("inventory").doc("discounts_status").set(globalDiscounts)
            ]);
        }
        productsInfo = tempProducts;
        const container = document.getElementById('products-container'); 
        if(container) container.innerHTML = `<div class="text-center py-10 text-brand-cyanDark"><i class="fa-solid fa-spinner fa-spin text-3xl mb-3"></i></div>`; 
        setTimeout(() => { if(typeof renderProducts === 'function') renderProducts(); }, 500);
        
        if(btn) { btn.innerHTML = origHtml; btn.disabled = false; }
        showAlert("تم بنجاح", "تم حفظ المنتجات وتحديث المنيو.");
    } catch(e) { 
        if(btn) { btn.innerHTML = origHtml; btn.disabled = false; }
        showAlert("خطأ", "حدث خطأ أثناء حفظ المنتجات."); 
    }
};

window.saveDriversData = () => {
    const validDrivers = tempDrivers.filter(d => d.name.trim() && d.phone.trim());
    updateSettingsDB({drivers: validDrivers}, 'button[onclick="saveDriversData()"]');
};

window.saveDeliverySettings = () => {
    const el = id => document.getElementById(id);
    const updates = { deliveryZones: tempAdminZones.filter(z => z.name.trim()) };
    if(el('admin-free-delivery-active')) updates.freeDeliveryActive = el('admin-free-delivery-active').checked;
    if(el('admin-free-delivery-threshold')) updates.freeDeliveryThreshold = parseInt(el('admin-free-delivery-threshold').value) || 0;
    
    updateSettingsDB(updates, 'button[onclick="saveDeliverySettings()"]');
    globalDeliveryZones = updates.deliveryZones;
    if(typeof renderDeliveryZones === 'function') renderDeliveryZones();
    if(typeof updateUI === 'function') updateUI();
};

window.saveMarketingSettings = () => {
    const el = id => document.getElementById(id);
    const updates = { promoCodes: tempPromoCodes.filter(p => p.code.trim()) };
    
    if(el('admin-reward-active')) updates.rewardActive = el('admin-reward-active').checked;
    if(el('admin-reward-type')) updates.rewardType = el('admin-reward-type').value;
    if(el('admin-reward-value')) updates.rewardValue = parseInt(el('admin-reward-value').value) || 0;
    if(el('admin-reward-max-generations')) updates.rewardMaxGenerations = parseInt(el('admin-reward-max-generations').value) || 0;
    if(el('admin-banner-active')) updates.bannerActive = el('admin-banner-active').checked;
    if(el('admin-banner-text')) updates.bannerText = el('admin-banner-text').value.trim();
    if(el('admin-crosssell-active')) updates.crossSellActive = el('admin-crosssell-active').checked;
    if(el('admin-crosssell-product')) updates.crossSellProductId = el('admin-crosssell-product').value;
    if(el('admin-show-promo-field')) updates.showPromoField = el('admin-show-promo-field').checked;

    updateSettingsDB(updates, 'button[onclick="saveMarketingSettings()"]');
    if(typeof applySettingsToUI === 'function') applySettingsToUI();
};

window.saveAdvancedSettings = () => {
    const el = id => document.getElementById(id);
    const updates = {};
    if(el('admin-whatsapp-template')) updates.whatsappTemplate = el('admin-whatsapp-template').value.trim();
    if(el('admin-batch-hashtag')) updates.batchHashtag = el('admin-batch-hashtag').value.trim();
    if(el('admin-dispatch-template')) updates.dispatchTemplate = el('admin-dispatch-template').value.trim();
    
    updateSettingsDB(updates, 'button[onclick="saveAdvancedSettings()"]');
};

window.saveTextsSettings = () => {
    let newUiTexts = {};
    if(typeof textsConfig !== 'undefined') {
        textsConfig.forEach(t => {
            const el = document.getElementById(`ui-txt-${t.id}`);
            if(el) newUiTexts[t.id] = el.value.trim();
        });
    }
    updateSettingsDB({uiTexts: newUiTexts}, 'button[onclick="saveTextsSettings()"]');
    if(typeof applySettingsToUI === 'function') applySettingsToUI();
};

// ==================== إعدادات المظهر وتطبيقها (WOW Factor) ====================
window.saveThemeSettings = () => {
    const el = id => document.getElementById(id);
    const updates = { theme: {} };
    
    if(el('admin-theme-color')) updates.theme.themeColor = el('admin-theme-color').value.trim();
    if(el('admin-theme-header-bg')) updates.theme.headerBg = el('admin-theme-header-bg').value.trim();
    if(el('admin-theme-popup-active')) updates.theme.popupActive = el('admin-theme-popup-active').checked;
    if(el('admin-theme-popup-title')) updates.theme.popupTitle = el('admin-theme-popup-title').value.trim();
    if(el('admin-theme-popup-msg')) updates.theme.popupMsg = el('admin-theme-popup-msg').value.trim();
    if(el('admin-theme-popup-img')) updates.theme.popupImg = el('admin-theme-popup-img').value.trim();
    if(el('admin-theme-show-badges')) updates.theme.showBadges = el('admin-theme-show-badges').checked;
    if(el('admin-theme-show-size')) updates.theme.showSizeGuide = el('admin-theme-show-size').checked;
    if(el('admin-theme-show-extras')) updates.theme.showExtras = el('admin-theme-show-extras').checked;

    updateSettingsDB(updates, 'button[onclick="saveThemeSettings()"]');
    setTimeout(() => { if(typeof applyThemeSettings === 'function') applyThemeSettings(); }, 500); 
};

window.applyThemeSettings = () => {
    if(!globalSettings || !globalSettings.theme) return;
    const theme = globalSettings.theme;

    if(theme.themeColor) {
        document.documentElement.style.setProperty('--theme-color', theme.themeColor);
    }

    const header = document.querySelector('header');
    if(theme.headerBg && header) {
        header.style.backgroundImage = `url('${theme.headerBg}')`;
        header.style.backgroundSize = 'cover';
        header.style.backgroundPosition = 'center';
        header.classList.add('bg-blend-overlay');
        header.style.backgroundColor = 'rgba(0, 0, 0, 0.6)'; 
    } else if (header) {
        header.style.backgroundImage = '';
        header.classList.remove('bg-blend-overlay');
        header.style.backgroundColor = '';
    }

    const badges = document.getElementById('trust-badges-container');
    if(badges) badges.style.display = theme.showBadges !== false ? 'block' : 'none';

    const sizeGuide = document.getElementById('size-guide-container');
    if(sizeGuide) sizeGuide.style.display = theme.showSizeGuide !== false ? 'block' : 'none';

    const extrasSec = document.getElementById('extras-container');
    const extrasTitle = document.getElementById('lbl-extras-title');
    if(extrasSec && extrasTitle) {
        extrasSec.style.display = theme.showExtras !== false ? 'flex' : 'none';
        extrasTitle.style.display = theme.showExtras !== false ? 'block' : 'none';
    }

    if(theme.popupActive && !sessionStorage.getItem('greetingShown')) {
        const titleEl = document.getElementById('greeting-popup-title');
        const msgEl = document.getElementById('greeting-popup-msg');
        const modal = document.getElementById('greeting-popup-modal');
        
        if (titleEl && msgEl && modal) {
            titleEl.innerText = theme.popupTitle || '';
            msgEl.innerText = theme.popupMsg || '';
            
            const imgCont = document.getElementById('greeting-popup-img-container');
            const imgSrc = document.getElementById('greeting-popup-img-src');
            
            if(theme.popupImg && imgCont && imgSrc) {
                imgSrc.src = theme.popupImg;
                imgCont.classList.remove('hidden');
            } else if (imgCont) {
                imgCont.classList.add('hidden');
            }
            
            setTimeout(() => {
                modal.classList.remove('hidden');
                setTimeout(() => modal.classList.remove('opacity-0', 'scale-95'), 10);
            }, 1500); 
            
            sessionStorage.setItem('greetingShown', 'true');
        }
    }
};

window.closeGreetingPopup = () => {
    const modal = document.getElementById('greeting-popup-modal');
    if(modal) {
        modal.classList.add('opacity-0', 'scale-95');
        setTimeout(() => modal.classList.add('hidden'), 300);
    }
};

window.saveAdminData = async () => {
    syncAdminProductsFromDOM(); 
    
    let newUiTexts = {};
    if(typeof textsConfig !== 'undefined') {
        textsConfig.forEach(t => {
            const el = document.getElementById(`ui-txt-${t.id}`);
            if(el) newUiTexts[t.id] = el.value.trim();
        });
    }

    const newSettings = {
        storeOpen: document.getElementById('admin-store-open')?.checked ?? true, 
        storeName: document.getElementById('admin-store-name')?.value.trim() || 'المتجر', 
        storeDesc: document.getElementById('admin-store-desc')?.value.trim() || '', 
        storePhone: document.getElementById('admin-store-phone')?.value.trim() || '', 
        minOrder: parseInt(document.getElementById('admin-min-order')?.value) || 0,
        freeDeliveryActive: document.getElementById('admin-free-delivery-active')?.checked ?? false, 
        freeDeliveryThreshold: parseInt(document.getElementById('admin-free-delivery-threshold')?.value) || 0, 
        deliveryZones: tempAdminZones.filter(z=>z.name.trim()),
        rewardActive: document.getElementById('admin-reward-active')?.checked ?? false, 
        rewardType: document.getElementById('admin-reward-type')?.value || 'fixed', 
        rewardValue: parseInt(document.getElementById('admin-reward-value')?.value) || 0, 
        rewardMaxGenerations: parseInt(document.getElementById('admin-reward-max-generations')?.value) || 0,
        bannerActive: document.getElementById('admin-banner-active')?.checked ?? false, 
        bannerText: document.getElementById('admin-banner-text')?.value.trim() || '', 
        crossSellActive: document.getElementById('admin-crosssell-active')?.checked ?? false, 
        crossSellProductId: document.getElementById('admin-crosssell-product')?.value || '', 
        promoCodes: tempPromoCodes.filter(p=>p.code.trim()), 
        bestSellers: globalSettings.bestSellers,
        showPromoField: document.getElementById('admin-show-promo-field')?.checked ?? true,
        successTitle: document.getElementById('admin-success-title')?.value.trim() || '', 
        successMessage: document.getElementById('admin-success-message')?.value.trim() || '', 
        productsData: tempProducts,
        whatsappTemplate: document.getElementById('admin-whatsapp-template')?.value.trim() || 'السلام عليكم...',
        ticktickTemplate: document.getElementById('admin-ticktick-template')?.value.trim() || '',
        vipWhatsappTemplate: document.getElementById('admin-vip-whatsapp-template')?.value.trim() || '',
        batchHashtag: document.getElementById('admin-batch-hashtag')?.value.trim() || '',
        dispatchTemplate: document.getElementById('admin-dispatch-template')?.value.trim() || '',
        uiTexts: newUiTexts
    };

    const btn = document.querySelector('#admin-dashboard-modal button[onclick="saveAdminData()"]'); 
    const originalHtml = btn ? btn.innerHTML : ''; 
    if(btn) btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-xl"></i> جاري الحفظ...';
    
    if(typeof hasCloud !== 'undefined' && hasCloud && db) {
        try {
            await Promise.all([ 
                db.collection("inventory").doc("settings").set(newSettings), 
                db.collection("inventory").doc("stock").set(globalStock), 
                db.collection("inventory").doc("prices").set(globalPrices), 
                db.collection("inventory").doc("old_prices").set(globalOldPrices), 
                db.collection("inventory").doc("discounts_status").set(globalDiscounts) 
            ]);
            if(btn) btn.innerHTML = originalHtml; 
            closeAdminDashboard(); 
            if(document.getElementById('alert-icon-container')) document.getElementById('alert-icon-container').className = "w-16 h-16 bg-green-100 text-green-500 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl"; 
            if(document.getElementById('alert-icon')) document.getElementById('alert-icon').className = "fa-solid fa-check"; 
            showAlert("تم بنجاح", "تم حفظ جميع التعديلات بنجاح.");
        } catch(e) { 
            if(btn) btn.innerHTML = originalHtml; 
            showAlert("خطأ", "حدث خطأ أثناء الحفظ. تحقق من اتصالك بالإنترنت."); 
        }
    } else {
        Object.assign(globalSettings, newSettings); 
        productsInfo = tempProducts; 
        globalDeliveryZones = newSettings.deliveryZones; 
        closeAdminDashboard(); 
        if(btn) btn.innerHTML = originalHtml; 
        if(typeof applySettingsToUI === 'function') applySettingsToUI(); 
        if(typeof renderDeliveryZones === 'function') renderDeliveryZones(); 
        const container = document.getElementById('products-container'); 
        if(container) container.innerHTML = `<div class="text-center py-10 text-brand-cyanDark"><i class="fa-solid fa-spinner fa-spin text-3xl mb-3"></i><p class="font-bold text-sm">جاري التحديث...</p></div>`; 
        setTimeout(() => { if(typeof renderProducts === 'function') renderProducts(); }, 500); 
        if(typeof updateUI === 'function') updateUI(); 
        showAlert("تم محلياً", "تم الحفظ مؤقتاً لأن المتصفح غير متصل بقاعدة البيانات.");
    }
};
