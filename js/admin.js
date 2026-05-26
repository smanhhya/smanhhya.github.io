// ==================== admin.js - لوحة التحكم الشاملة ====================

// دالة تأخير للبحث السريع (عشان مايستهلكش موارد الجهاز)
function debounce(func, delay) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), delay);
    };
}

// متغيرات عامة لإدارة الحالة داخل لوحة التحكم
let tempProducts = {};
let tempAdminZones = [];
let tempPromoCodes = [];
let tempDrivers = [];
let currentAdminTab = 'stats'; 
let ordersList = []; 
let orderFilter = 'all';
window.dispatchOrdersList = [];

// تبديل حالة المتجر (مفتوح/مغلق)
const storeOpenToggle = document.getElementById('admin-store-open');
if (storeOpenToggle) {
    storeOpenToggle.addEventListener('change', function() {
        const label = document.getElementById('store-open-label');
        if (label) {
            label.innerText = this.checked ? 'مفتوح' : 'مغلق';
            label.className = this.checked ? 'mr-3 text-sm font-black text-green-600 w-12' : 'mr-3 text-sm font-black text-red-600 w-12';
        }
    });
}

window.openAdminLogin = () => { 
    console.log("1. تم الضغط على الزر والدالة تعمل بنجاح");
    
    if(window.firebase && window.firebase.auth && window.firebase.auth().currentUser) {
        console.log("2. الإدمن مسجل دخول بالفعل. جاري فتح اللوحة...");
        if (typeof window.openAdminDashboard === "function") {
            window.openAdminDashboard();
        } else {
            console.error("خطأ: دالة window.openAdminDashboard غير موجودة أو لم يتم تحميلها!");
            alert("خطأ برمجي: دالة فتح اللوحة غير موجودة.");
        }
    } else {
        console.log("2. الإدمن غير مسجل دخول. جاري إظهار نافذة كلمة المرور...");
        const modal = document.getElementById('admin-login-modal');
        if(modal) {
            modal.classList.remove('hidden'); 
            setTimeout(() => modal.classList.remove('opacity-0'), 10); 
            const passInput = document.getElementById('admin-password-input');
            if(passInput) passInput.value = ''; 
            console.log("3. تم إظهار نافذة تسجيل الدخول بنجاح.");
        } else {
            console.error("خطأ: لم يتم العثور على عنصر HTML يحمل الـ id: admin-login-modal");
            alert("تأكد من وجود نافذة تسجيل الدخول في ملف الـ HTML بـ id='admin-login-modal'");
        }
    }
};  //  ← القفل دا مهم جداً، هو اللي بيغلق الدالة كلها

window.closeAdminLogin = () => { 
    const modal = document.getElementById('admin-login-modal');
    if(modal) {
        modal.classList.add('opacity-0'); 
        setTimeout(() => modal.classList.add('hidden'), 300); 
    }
};

window.verifyAdminPin = () => { 
    const emailInput = document.getElementById('admin-email-input');
    const passInput = document.getElementById('admin-password-input');
    
    if(!emailInput || !passInput) return;
    
    const email = emailInput.value.trim();
    const pass = passInput.value.trim();
    const btn = window.event ? window.event.target : document.querySelector('#admin-login-modal button');
    
    let origHtml = 'تسجيل الدخول';
    if(btn) {
        origHtml = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري التحقق...';
        btn.disabled = true;
    }
    
    if(!email || !pass) { 
        if(typeof showAlert === 'function') showAlert("تنبيه", "يرجى كتابة البريد الإلكتروني وكلمة المرور."); 
        else alert("يرجى كتابة البريد الإلكتروني وكلمة المرور.");
        if(btn) { btn.innerHTML = origHtml; btn.disabled = false; }
        return; 
    }
    
    // تفعيل الجلسة المستمرة
    if(window.firebase) {
        firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL)
            .then(() => firebase.auth().signInWithEmailAndPassword(email, pass))
            .then((userCredential) => {
                closeAdminLogin(); 
                openAdminDashboard();
                if(btn) { btn.innerHTML = origHtml; btn.disabled = false; }
                passInput.value = '';
            })
            .catch((error) => {
                if(btn) { btn.innerHTML = origHtml; btn.disabled = false; }
                if(typeof showAlert === 'function') showAlert("خطأ", "بيانات الدخول غير صحيحة، أو ليس لديك صلاحية!");
                else alert("بيانات الدخول غير صحيحة!");
            });
    }
};

window.logoutAdmin = () => {
    if(window.firebase) {
        firebase.auth().signOut().then(() => {
            closeAdminDashboard();
            if(typeof showAlert === 'function') showAlert("تم", "تم تسجيل الخروج بنجاح.");
        }).catch(e => {
            closeAdminDashboard();
        });
    }
};

// ==================== فتح وإغلاق وتوجيه لوحة التحكم ====================
window.switchAdminTab = (tab) => {
    currentAdminTab = tab;
    const tabs = ['stats','store','products','orders','dispatch','delivery','marketing','advanced','texts'];
    
    tabs.forEach(t => {
        const panel = document.getElementById('admin-panel-'+t);
        const btn = document.getElementById('admin-tab-'+t);
        if(panel) panel.classList.add('hidden');
        if(btn) btn.className = t === tab 
            ? "px-4 py-2 rounded-lg font-bold text-sm bg-brand-cyanDark text-white whitespace-nowrap shadow-inner" 
            : "px-4 py-2 rounded-lg font-bold text-sm text-gray-600 hover:bg-gray-100 whitespace-nowrap";
    });
    
    const activePanel = document.getElementById('admin-panel-'+tab);
    if(activePanel) activePanel.classList.remove('hidden');
    
    if(tab === 'orders' || tab === 'dispatch') {
        if(typeof loadOrders === 'function') loadOrders();
    }
    if(tab === 'products') renderAdminProducts();
    if(tab === 'stats') renderTopProductsStats();
};

window.openAdminDashboard = () => {
    const storeToggle = document.getElementById('admin-store-open');
    if(storeToggle && window.globalSettings) {
        storeToggle.checked = globalSettings.storeOpen !== false;
        const storeOpenLabel = document.getElementById('store-open-label');
        if(storeOpenLabel) {
            storeOpenLabel.innerText = storeToggle.checked ? 'مفتوح' : 'مغلق';
            storeOpenLabel.className = storeToggle.checked ? 'mr-3 text-sm font-black text-green-600 w-12' : 'mr-3 text-sm font-black text-red-600 w-12';
        }
    }

    if(window.globalSettings) {
        // تحميل بيانات المتجر
        if(document.getElementById('admin-store-name')) document.getElementById('admin-store-name').value = globalSettings.storeName || ''; 
        if(document.getElementById('admin-store-desc')) document.getElementById('admin-store-desc').value = globalSettings.storeDesc || ''; 
        if(document.getElementById('admin-store-phone')) document.getElementById('admin-store-phone').value = globalSettings.storePhone || ''; 
        if(document.getElementById('admin-min-order')) document.getElementById('admin-min-order').value = globalSettings.minOrder || 0;
        
        // تحميل بيانات التوصيل والمناديب
        if(document.getElementById('admin-free-delivery-active')) document.getElementById('admin-free-delivery-active').checked = !!globalSettings.freeDeliveryActive; 
        if(document.getElementById('admin-free-delivery-threshold')) document.getElementById('admin-free-delivery-threshold').value = globalSettings.freeDeliveryThreshold || 0; 
        tempAdminZones = window.globalDeliveryZones ? JSON.parse(JSON.stringify(globalDeliveryZones)) : []; 
        renderAdminZones();
        
        tempDrivers = globalSettings.drivers ? JSON.parse(JSON.stringify(globalSettings.drivers)) : [];
        renderAdminDrivers();

        // التسويق
        if(document.getElementById('admin-reward-active')) document.getElementById('admin-reward-active').checked = !!globalSettings.rewardActive; 
        if(document.getElementById('admin-reward-type')) document.getElementById('admin-reward-type').value = globalSettings.rewardType || 'fixed'; 
        if(document.getElementById('admin-reward-value')) document.getElementById('admin-reward-value').value = globalSettings.rewardValue || 0; 
        if(document.getElementById('admin-reward-max-generations')) document.getElementById('admin-reward-max-generations').value = globalSettings.rewardMaxGenerations || 0; 
        if(document.getElementById('admin-banner-active')) document.getElementById('admin-banner-active').checked = !!globalSettings.bannerActive; 
        if(document.getElementById('admin-banner-text')) document.getElementById('admin-banner-text').value = globalSettings.bannerText || ''; 
        if(document.getElementById('admin-crosssell-active')) document.getElementById('admin-crosssell-active').checked = !!globalSettings.crossSellActive; 
        
        const csSelect = document.getElementById('admin-crosssell-product'); 
        if(csSelect && window.productsInfo) {
            csSelect.innerHTML=''; 
            Object.keys(productsInfo).forEach(id => {
                csSelect.innerHTML += `<option value="${id}" ${globalSettings.crossSellProductId===id?'selected':''}>${productsInfo[id].name}</option>`;
            });
        }
        
        tempPromoCodes = globalSettings.promoCodes ? JSON.parse(JSON.stringify(globalSettings.promoCodes)) : []; 
        renderAdminPromos();
        if(document.getElementById('admin-show-promo-field')) document.getElementById('admin-show-promo-field').checked = globalSettings.showPromoField !== false;
        
        // المتقدم
        if(document.getElementById('admin-success-title')) document.getElementById('admin-success-title').value = globalSettings.successTitle || ''; 
        if(document.getElementById('admin-success-message')) document.getElementById('admin-success-message').value = globalSettings.successMessage || ''; 
        if(document.getElementById('admin-whatsapp-template')) document.getElementById('admin-whatsapp-template').value = globalSettings.whatsappTemplate || 'السلام عليكم، أريد تأكيد حجزي:\n\n📋 *بيانات العميل:*\n{تفاصيل_العميل}\n\n🛒 *الطلبات:*\n{الطلبات}\n{الخصم}═════════════════\n📦 قيمة الطلبات: {قيمة_الطلبات} ج.م\n🚚 رسوم التوصيل: {التوصيل}\n💰 *الإجمالي النهائي: {الاجمالي} ج.م*\n\n(في انتظار تأكيد الحجز وموعد الاستلام)';
        if(document.getElementById('admin-batch-hashtag')) document.getElementById('admin-batch-hashtag').value = globalSettings.batchHashtag || '';
        if(document.getElementById('admin-vip-whatsapp-template')) document.getElementById('admin-vip-whatsapp-template').value = globalSettings.vipWhatsappTemplate || 'السلام عليكم،\nأريد الانضمام لقائمة الـ VIP وحجز ({اسم_المنتج}) من الدفعة القادمة قبل نزولها المتجر. 👑';
        if(document.getElementById('admin-ticktick-template')) document.getElementById('admin-ticktick-template').value = globalSettings.ticktickTemplate || '🧾 **تفاصيل الأوردر كاملة:**\n👤 الاسم: {اسم_العميل}\n📱 الموبايل: {الموبايل}\n📍 المنطقة: {المنطقة}\n{العنوان}\n🕒 الوقت: {الوقت}\n--------------------------------\n🛒 الطلبات:\n{تفاصيل_الطلبات}\n--------------------------------\n📦 قيمة الطلبات: {قيمة_الطلبات} ج.م\n{الخصم}🚚 رسوم التوصيل: {التوصيل}\n💰 الإجمالي النهائي: {الاجمالي} ج.م\n{ملاحظات}\n{الهاشتاجات}';
        if(document.getElementById('admin-dispatch-template')) document.getElementById('admin-dispatch-template').value = globalSettings.dispatchTemplate || '📦 طلب جديد من {اسم_العميل}\n📱 {رقم_العميل}\n📍 {المنطقة} - {العنوان}\n🛒 الطلبات:\n{تفاصيل_الطلبات}\n💰 إجمالي الطلب: {إجمالي_الطلب} ج.م\n🚚 التوصيل: {التوصيل}\n⭐ الإجمالي النهائي: {الإجمالي_النهائي} ج.م';
    }

    // القاموس
    const textsCont = document.getElementById('admin-texts-container');
    if(textsCont && window.textsConfig) {
        textsCont.innerHTML = '';
        textsConfig.forEach(t => {
            const val = (globalSettings.uiTexts && globalSettings.uiTexts[t.id]) ? globalSettings.uiTexts[t.id] : t.default;
            textsCont.innerHTML += `<div><label class="text-[10px] font-bold text-gray-500 block mb-1">${t.label}</label><input type="text" id="ui-txt-${t.id}" value="${val}" class="w-full border rounded p-2 text-xs font-bold text-brand-navy outline-none focus:border-brand-cyan"></div>`;
        });
    }

    if(window.productsInfo) {
        tempProducts = JSON.parse(JSON.stringify(productsInfo));
        renderAdminProducts(); 
    }
    
    const dashboard = document.getElementById('admin-dashboard-modal');
    if(dashboard) {
        dashboard.classList.remove('hidden'); 
        setTimeout(() => dashboard.classList.remove('opacity-0'), 10); 
    }
    switchAdminTab('stats');
};

window.closeAdminDashboard = () => { 
    const dashboard = document.getElementById('admin-dashboard-modal');
    if(dashboard) {
        dashboard.classList.add('opacity-0'); 
        setTimeout(() => dashboard.classList.add('hidden'), 300); 
    }
};

// ==================== الإحصائيات وإدارة المنتجات ====================
window.renderTopProductsStats = () => {
    const c = document.getElementById('top-products-list'); 
    if(!c) return;
    if(window.globalSettings && globalSettings.bestSellers && globalSettings.bestSellers.length > 0) { 
        c.innerHTML = globalSettings.bestSellers.map(id => { 
            const p = window.productsInfo ? productsInfo[id] : null; 
            return p ? `<div class="flex justify-between items-center bg-gray-50 p-2 rounded border"><span class="font-bold text-brand-navy">${p.name}</span><span class="text-[10px] bg-brand-yellow text-brand-navy px-2 py-0.5 rounded-full font-black">🔥 الأكثر مبيعاً</span></div>` : ''; 
        }).join(''); 
    } else { 
        c.innerHTML = '<div class="text-xs text-gray-400">لم تقم بتحديد منتجات كأكثر مبيعاً من قائمة المنتجات.</div>'; 
    }
};

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
        const p = tempProducts[id]; 
        const stock = (window.globalStock && globalStock[id]) || 0; 
        const price = (window.globalPrices && globalPrices[id]) || p.basePrice || 0; 
        const oldPrice = (window.globalOldPrices && globalOldPrices[id]) || price; 
        const isDisc = (window.globalDiscounts && globalDiscounts[id]) || false; 
        const isBest = (window.globalSettings && globalSettings.bestSellers?.includes(id)) || false;
        const imgSrc = (p.images && p.images.length > 0) ? p.images[0] : '';
        // استخدام صورة بديلة خفيفة لتجنب مشاكل علامات التنصيص
        const fallbackImg = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=";

        container.innerHTML += `<div class="bg-white border border-gray-200 rounded-xl p-3 shadow-sm mb-3">
            <div class="flex justify-between items-center cursor-pointer" onclick="document.getElementById('edit-p-${id}').classList.toggle('hidden')">
                <div class="font-black text-brand-navy flex items-center gap-2">
                    <div class="flex flex-col gap-1 ml-1 mr-[-5px]">
                        <button onclick="event.stopPropagation(); window.moveProduct('${id}', 'up')" class="text-gray-400 hover:text-brand-cyanDark text-[12px] bg-gray-100 rounded w-5 h-5 flex justify-center items-center"><i class="fa-solid fa-chevron-up"></i></button>
                        <button onclick="event.stopPropagation(); window.moveProduct('${id}', 'down')" class="text-gray-400 hover:text-brand-cyanDark text-[12px] bg-gray-100 rounded w-5 h-5 flex justify-center items-center"><i class="fa-solid fa-chevron-down"></i></button>
                    </div>
                    <img src="${imgSrc}" class="w-8 h-8 rounded object-cover" onerror="this.src='${fallbackImg}'"> ${p.name}
                </div>
                <div class="text-xs bg-gray-50 border px-2 py-1 rounded font-bold text-gray-600">تعديل <i class="fa-solid fa-chevron-down"></i></div>
            </div>
            <div id="edit-p-${id}" class="hidden mt-4 space-y-3 border-t pt-3 cursor-default" onclick="event.stopPropagation()">
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
                <button onclick="window.deleteAdminProduct('${id}')" class="w-full mt-2 bg-red-50 border border-red-200 text-red-600 font-bold text-xs py-2 rounded hover:bg-red-100 transition-colors"><i class="fa-solid fa-trash"></i> حذف هذا المنتج نهائياً</button>
            </div>
        </div>`;
    });
};

window.addNewAdminProduct = () => { 
    const newId = 'p_' + Date.now(); 
    tempProducts[newId] = { name: "منتج جديد", basePrice: 0, weight: "1 طبق", images: [""], isExtra: false }; 
    if(window.globalStock) globalStock[newId] = 0; 
    if(window.globalPrices) globalPrices[newId] = 0; 
    if(window.globalOldPrices) globalOldPrices[newId] = 0; 
    if(window.globalDiscounts) globalDiscounts[newId] = false; 
    renderAdminProducts(); 
    setTimeout(() => {
        const editBox = document.getElementById(`edit-p-${newId}`);
        if(editBox) editBox.classList.remove('hidden');
    }, 100); 
};

window.deleteAdminProduct = (id) => { 
    if(!confirm('هل أنت متأكد من حذف هذا المنتج تماماً من المتجر؟')) return; 
    delete tempProducts[id]; 
    if(window.globalStock) delete globalStock[id]; 
    if(window.globalPrices) delete globalPrices[id]; 
    if(window.globalOldPrices) delete globalOldPrices[id]; 
    if(window.globalDiscounts) delete globalDiscounts[id]; 
    renderAdminProducts(); 
};

window.syncAdminProductsFromDOM = () => {
    const container = document.getElementById('admin-inputs-container');
    if(!container || container.innerHTML === '') return;
    
    let newBest = [];
    Object.keys(tempProducts).forEach(id => {
        const nameInput = document.getElementById(`p-name-${id}`);
        if(!nameInput) return; 
        
        tempProducts[id].name = nameInput.value; 
        tempProducts[id].weight = document.getElementById(`p-weight-${id}`).value; 
        tempProducts[id].images = [document.getElementById(`p-img-${id}`).value]; 
        tempProducts[id].isExtra = document.getElementById(`p-extra-${id}`).checked;
        
        if(window.globalPrices) globalPrices[id] = parseInt(document.getElementById(`p-price-${id}`).value) || 0; 
        if(window.globalStock) globalStock[id] = parseInt(document.getElementById(`p-stock-${id}`).value) || 0; 
        if(window.globalOldPrices) globalOldPrices[id] = parseInt(document.getElementById(`p-old-${id}`).value) || 0; 
        if(window.globalDiscounts) globalDiscounts[id] = document.getElementById(`p-disc-${id}`).checked;
        
        if(document.getElementById(`p-best-${id}`).checked) newBest.push(id);
    });
    
    if(window.globalSettings) globalSettings.bestSellers = newBest;
};

// ==================== مناطق التوصيل والخصومات ====================
window.renderAdminZones = () => { 
    const c = document.getElementById('admin-zones-container'); 
    if(!c) return;
    c.innerHTML = ''; 
    tempAdminZones.forEach((z,i) => {
        c.innerHTML += `<div class="flex gap-2 items-center"><input type="text" value="${z.name}" class="flex-1 border rounded p-2 text-sm font-bold text-brand-navy outline-none focus:border-brand-cyan" onchange="tempAdminZones[${i}].name=this.value"><input type="number" value="${z.price}" class="w-16 border rounded p-2 text-sm text-center font-bold text-brand-cyanDark outline-none focus:border-brand-cyan" onchange="tempAdminZones[${i}].price=parseInt(this.value) || 0"><button onclick="tempAdminZones.splice(${i},1); window.renderAdminZones()" class="text-red-500 hover:bg-red-50 rounded w-8 h-8 transition-colors"><i class="fa-solid fa-trash"></i></button></div>`;
    }); 
};

window.addNewAdminZone = () => { 
    tempAdminZones.push({id: 'z_' + Date.now(), name: '', price: 0}); 
    renderAdminZones(); 
};

window.renderAdminPromos = () => { 
    const c = document.getElementById('admin-promos-container'); 
    if(!c) return;
    c.innerHTML = ''; 
    tempPromoCodes.forEach((p, i) => {
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
                <input type="number" value="${p.discount}" placeholder="خصم" class="w-16 border rounded p-1.5 text-xs text-center font-bold text-brand-cyanDark outline-none focus:border-brand-cyan" onchange="tempPromoCodes[${i}].discount=parseInt(this.value) || 0">
                <select class="flex-1 border rounded p-1.5 text-xs bg-white font-bold text-gray-600 outline-none" onchange="tempPromoCodes[${i}].type=this.value; window.renderAdminPromos();">
                    <option value="fixed" ${p.type === 'fixed' ? 'selected' : ''}>جنيه</option>
                    <option value="percent" ${p.type === 'percent' ? 'selected' : ''}>%</option>
                    <option value="free_delivery" ${p.type === 'free_delivery' ? 'selected' : ''}>توصيل مجاني</option>
                </select>
            </div>
            <div class="grid grid-cols-2 gap-2 mt-1">
                <div><label class="text-[10px] font-bold text-gray-500 block mb-0.5">الحد الأدنى (ج)</label><input type="number" value="${p.minOrder}" placeholder="بدون حد" class="w-full border rounded p-1.5 text-xs text-center font-bold text-brand-navy outline-none focus:border-brand-cyan" onchange="tempPromoCodes[${i}].minOrder=parseInt(this.value) || 0"></div>
                <div><label class="text-[10px] font-bold text-gray-500 block mb-0.5">أقصى خصم (ج)</label><input type="number" value="${p.maxDiscount}" placeholder="بدون حد" class="w-full border rounded p-1.5 text-xs text-center font-bold text-brand-navy outline-none focus:border-brand-cyan ${p.type !== 'percent' ? 'bg-gray-100 cursor-not-allowed opacity-50' : ''}" ${p.type !== 'percent' ? 'disabled' : ''} onchange="tempPromoCodes[${i}].maxDiscount=parseInt(this.value) || 0"></div>
            </div>
            <div class="grid grid-cols-2 gap-2 mt-1">
                <div><label class="text-[10px] font-bold text-gray-500 block mb-0.5">تاريخ الانتهاء</label><input type="date" value="${p.expiryDate}" class="w-full border rounded p-1.5 text-xs text-center font-bold text-brand-navy outline-none focus:border-brand-cyan" onchange="tempPromoCodes[${i}].expiryDate=this.value"></div>
                <div><label class="text-[10px] font-bold text-gray-500 block mb-0.5">متاح لـ (أشخاص)</label><input type="number" value="${p.usesLeft !== null ? p.usesLeft : ''}" placeholder="∞" class="w-full border rounded p-1.5 text-xs text-center font-bold text-brand-navy outline-none focus:border-brand-cyan" onchange="tempPromoCodes[${i}].usesLeft=this.value === '' ? null : parseInt(this.value)"></div>
            </div>
            <div class="flex items-center bg-white border rounded p-1.5 border-gray-300 mt-1">
                <i class="fa-solid fa-mobile-screen text-gray-400 text-[10px] w-4 text-center"></i>
                <input type="text" value="${p.customerPhone || ''}" placeholder="مخصص لرقم موبايل (اختياري)" class="flex-1 text-xs font-bold text-brand-navy outline-none bg-transparent" onchange="tempPromoCodes[${i}].customerPhone=this.value" dir="ltr" style="text-align: right;">
            </div>
            <button onclick="tempPromoCodes.splice(${i},1); window.renderAdminPromos()" class="absolute top-2 left-2 text-red-500 hover:bg-red-100 rounded w-7 h-7 flex justify-center items-center transition-colors"><i class="fa-solid fa-trash text-[12px]"></i></button>
        </div>`;
    }); 
};

window.addNewPromoCode = () => { 
    tempPromoCodes.push({ code: '', discount: 0, type: 'fixed', usesLeft: null, minOrder: 0, maxDiscount: 0, expiryDate: '', customerPhone: '' }); 
    renderAdminPromos(); 
};

// ==================== نظام الطلبات الذكي ====================
window.sendMessageToCustomer = (phone, order) => {
    if(!order) return;
    let itemsText = order.items.map(i => `${i.quantity}x ${i.name}`).join('\n');
    let msg = `مرحباً ${order.customerName}،\nتفاصيل طلبك:\n${itemsText}\nالإجمالي: ${order.total} ج.م\nشكراً لتعاملك معنا!`;
    let waNumber = phone.startsWith('0') ? '2' + phone : phone;
    window.open(`https://api.whatsapp.com/send?phone=${waNumber}&text=${encodeURIComponent(msg)}`, '_blank');
};

window.sendRatingRequest = (phone, order) => {
    if(!order) return;
    let msg = `شكراً ${order.customerName} على طلبك من سمان ههيا!\nتقدر تقيم تجربتك معانا من هنا وتفيدنا برأيك:\n⭐️ [رابط التقييم]\n(سيتم إضافة الرابط لاحقاً)`;
    let waNumber = phone.startsWith('0') ? '2' + phone : phone;
    window.open(`https://api.whatsapp.com/send?phone=${waNumber}&text=${encodeURIComponent(msg)}`, '_blank');
};

window.renderOrdersList = () => {
    const container = document.getElementById('orders-list-container');
    if(!container) return;
    
    const searchInput = document.getElementById('order-search');
    const searchQuery = searchInput ? searchInput.value.trim().toLowerCase() : '';
    
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
        
        let itemsHtml = order.items.map(i => `<div class="flex justify-between text-xs text-gray-700 font-bold border-b border-gray-100 pb-1 mb-1 last:border-0 last:pb-0 last:mb-0"><span><span class="text-brand-cyanDark">${i.quantity}x</span> ${i.name}</span><span>${i.quantity * i.price} ج</span></div>`).join('');

        return `
        <div class="bg-white border rounded-xl p-4 shadow-sm relative overflow-hidden mb-3">
            <div class="absolute top-0 right-0 w-1 h-full ${order.status === 'new' ? 'bg-red-500' : (order.status === 'processing' ? 'bg-yellow-500' : 'bg-green-500')}"></div>
            <div class="flex justify-between items-start mb-3">
                <div>
                    <div class="font-black text-brand-navy">${order.customerName}</div>
                    <a href="tel:${order.customerPhone}" class="text-sm font-bold text-blue-600 hover:underline" dir="ltr">${order.customerPhone}</a>
                </div>
                <div class="flex gap-2 items-center">
                    <button onclick="window.sendMessageToCustomer('${order.customerPhone}', ordersList.find(o=>o.id==='${order.id}'))" class="text-[10px] bg-blue-500 text-white px-2 py-1 rounded font-bold"><i class="fa-brands fa-whatsapp"></i> رسالة</button>
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
                ${order.status === 'new' ? `<button onclick="window.updateOrderStatus('${order.id}', 'processing')" class="flex-1 bg-yellow-500 hover:bg-yellow-600 transition-colors text-white py-2 rounded-lg text-xs font-black shadow-sm">قيد التجهيز</button>` : ''}
                ${order.status === 'processing' ? `<button onclick="window.updateOrderStatus('${order.id}', 'completed')" class="flex-1 bg-green-500 hover:bg-green-600 transition-colors text-white py-2 rounded-lg text-xs font-black shadow-sm">تم التوصيل</button>` : ''}
                ${order.status === 'completed' ? `<button onclick="window.sendRatingRequest('${order.customerPhone}', ordersList.find(o=>o.id==='${order.id}'))" class="flex-1 bg-purple-500 hover:bg-purple-600 text-white py-2 rounded-lg text-xs font-black"><i class="fa-solid fa-star"></i> إرسال تقييم</button>` : ''}
            </div>
        </div>`;
    }).join('');
};

document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('order-search');
    if (searchInput) searchInput.addEventListener('input', debounce(() => renderOrdersList(), 300));
});

window.loadOrders = async () => { 
    if(!window.hasCloud || !window.db) return; 
    const container = document.getElementById('orders-list-container');
    if(!container) return;
    
    try { 
        container.innerHTML = '<div class="text-center py-10 text-gray-400"><i class="fa-solid fa-spinner fa-spin text-2xl mb-2"></i><p class="text-xs font-bold">جاري جلب الطلبات...</p></div>';
        const snap = await db.collection("orders").orderBy("createdAt", "desc").get(); 
        ordersList = []; 
        snap.forEach(d => ordersList.push({id: d.id, ...d.data()})); 
        renderOrdersList();
        
        // تحديث التوزيع تلقائياً للطلبات (قيد التجهيز) فقط
        dispatchOrdersList = ordersList.filter(o => o.status === 'processing');
        if(currentAdminTab === 'dispatch') renderDispatchOrders();
    } catch(e) { 
        console.log("Error loading orders", e); 
    } 
};

window.filterOrders = (f) => { 
    orderFilter = f; 
    renderOrdersList(); 
};

window.updateOrderStatus = async (id, s) => { 
    if(window.db) { 
        const btn = window.event ? window.event.target : null;
        let origText = '';
        if(btn) {
            origText = btn.innerText;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; 
            btn.disabled = true;
        }
        try {
            await db.collection("orders").doc(id).update({status: s}); 
            if(typeof loadOrders === 'function') loadOrders(); 
        } catch (e) {
            if(btn) { 
                btn.innerHTML = origText; 
                btn.disabled = false; 
            }
            if(typeof showAlert === 'function') showAlert("خطأ", "حدث خطأ أثناء تحديث حالة الطلب");
        }
    } 
};

window.deleteAllOrders = async () => {
    if(!confirm("⚠️ تحذير: هل أنت متأكد من مسح جميع الطلبات من السجل؟ لا يمكن التراجع عن هذا الإجراء!")) return;
    
    const btn = document.querySelector('button[onclick="window.deleteAllOrders()"]') || (window.event ? window.event.target : null); 
    let originalHtml = 'مسح السجل';
    if(btn) {
        originalHtml = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري المسح...';
        btn.disabled = true;
    }
    
    if(window.hasCloud && window.db) {
        try {
            const snap = await db.collection("orders").get();
            if(!snap.empty) {
                const batch = db.batch();
                snap.docs.forEach(doc => batch.delete(doc.ref));
                await batch.commit();
            }
            if(btn) { btn.innerHTML = originalHtml; btn.disabled = false; }
            if(typeof showAlert === 'function') showAlert("تم المسح", "تم مسح جميع سجلات الطلبات بنجاح."); 
            loadOrders();
        } catch(e) { 
            if(btn) { btn.innerHTML = originalHtml; btn.disabled = false; }
            if(typeof showAlert === 'function') showAlert("خطأ", "حدث خطأ أثناء المسح."); 
        }
    } else { 
        ordersList = []; 
        renderOrdersList(); 
        if(btn) { btn.innerHTML = originalHtml; btn.disabled = false; }
        if(typeof showAlert === 'function') showAlert("تم بنجاح", "تم المسح محلياً."); 
    }
};

window.resetStatsOnly = async () => {
    if(!confirm("⚠️ تحذير: هل أنت متأكد من تصفير عدادات الإحصائيات (مبيعات اليوم والطلبات) لتبدأ من صفر؟")) return;
    
    const btn = document.querySelector('button[onclick="window.resetStatsOnly()"]') || (window.event ? window.event.target : null); 
    let originalHtml = 'تصفير';
    if(btn) {
        originalHtml = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري التصفير...';
        btn.disabled = true;
    }
    
    if(window.hasCloud && window.db) {
        try {
            await db.collection("inventory").doc("stats").set({ sales: 0, orders: 0 });
            if(btn) { btn.innerHTML = originalHtml; btn.disabled = false; }
            if(typeof showAlert === 'function') showAlert("تم التصفير", "تم تصفير عدادات المبيعات بنجاح.");
        } catch(e) { 
            if(btn) { btn.innerHTML = originalHtml; btn.disabled = false; }
            if(typeof showAlert === 'function') showAlert("خطأ", "حدث خطأ أثناء الاتصال بقاعدة البيانات."); 
        }
    } else {
        if(window.dailyStats) dailyStats = { sales: 0, orders: 0 }; 
        if(document.getElementById('stat-sales')) document.getElementById('stat-sales').innerText = 0; 
        if(document.getElementById('stat-orders')) document.getElementById('stat-orders').innerText = 0;
        if(btn) { btn.innerHTML = originalHtml; btn.disabled = false; }
        if(typeof showAlert === 'function') showAlert("تم بنجاح", "تم التصفير محلياً.");
    }
};

// ==================== إدارة المناديب (Drivers) ====================
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
            <input type="text" value="${d.name}" placeholder="اسم المندوب (مثال: كابتن أحمد)" class="w-1/2 border rounded-lg p-2 text-xs font-bold text-brand-navy outline-none focus:border-brand-cyan" onchange="tempDrivers[${i}].name = this.value">
            <input type="tel" value="${d.phone}" placeholder="رقم الموبايل الواتساب" class="w-1/2 border rounded-lg p-2 text-xs font-bold text-brand-navy outline-none focus:border-brand-cyan" dir="ltr" onchange="tempDrivers[${i}].phone = this.value">
            <button onclick="tempDrivers.splice(${i},1); window.renderAdminDrivers();" class="text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors"><i class="fa-solid fa-trash"></i></button>
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

// ==================== نظام التوزيع (Dispatch) ====================
window.renderDispatchOrders = () => {
    const container = document.getElementById('dispatch-orders-container');
    const zoneSelect = document.getElementById('dispatch-zone-filter');
    const zoneFilter = zoneSelect ? zoneSelect.value : 'all';
    if (!container) return;

    if (zoneSelect && dispatchOrdersList.length > 0) {
        const zones = [...new Set(dispatchOrdersList.map(o => o.zone))].sort();
        zoneSelect.innerHTML = '<option value="all">كل المناطق</option>' +
            zones.map(z => `<option value="${z}" ${zoneFilter === z ? 'selected' : ''}>${z}</option>`).join('');
    }

    let filtered = dispatchOrdersList;
    if (zoneFilter !== 'all') {
        filtered = filtered.filter(o => o.zone === zoneFilter);
    }

    if (filtered.length === 0) {
        container.innerHTML = '<p class="text-center text-gray-400 py-4 text-sm font-bold">لا توجد طلبات قيد التجهيز في هذه المنطقة</p>';
        return;
    }

    container.innerHTML = filtered.map(order => {
        const itemsText = order.items.map(i => `${i.quantity}x ${i.name}`).join('، ');
        const address = (order.customerAddress && order.customerAddress !== 'غير محدد') ? order.customerAddress : '';
        return `
        <div class="flex items-start gap-3 bg-white p-3 rounded-lg border shadow-sm cursor-pointer hover:border-brand-cyan transition-colors">
            <input type="checkbox" class="dispatch-checkbox mt-1 accent-brand-cyanDark w-5 h-5 cursor-pointer" data-id="${order.id}" onchange="window.updateDispatchCount()">
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
    const count = document.querySelectorAll('.dispatch-checkbox:checked').length;
    const span = document.getElementById('dispatch-selected-count');
    if (span) span.innerText = count;
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

    if (!phone) {
        if(typeof showAlert === 'function') showAlert('تنبيه', 'يرجى اختيار المندوب من القائمة أولاً');
        return;
    }

    const checkedOrders = [];
    document.querySelectorAll('.dispatch-checkbox:checked').forEach(cb => {
        const id = cb.getAttribute('data-id');
        const order = dispatchOrdersList.find(o => o.id === id);
        if (order) checkedOrders.push(order);
    });

    if (checkedOrders.length === 0) {
        if(typeof showAlert === 'function') showAlert('تنبيه', 'لم تختر أي طلب للإرسال');
        return;
    }

    const template = ((window.globalSettings && globalSettings.dispatchTemplate) || 
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
    const url = `https://api.whatsapp.com/send?phone=${waNumber}&text=${encodeURIComponent(fullMessage.trim())}`;
    window.open(url, '_blank');
};

// ==================== حملات الواتساب ====================
window.generateBulkWhatsAppLinks = () => {
    const numInput = document.getElementById('admin-bulk-numbers');
    if(!numInput) return;
    
    const numbersRaw = numInput.value.trim();
    const msgInput = document.getElementById('admin-bulk-message');
    const messageTemplate = (msgInput ? msgInput.value.trim() : '') || "شكراً لثقتك! كود الخصم بتاعك: {الكود}";
    
    const typeInput = document.getElementById('admin-bulk-reward-type');
    const rewardType = typeInput ? typeInput.value : 'fixed';
    
    const valInput = document.getElementById('admin-bulk-reward-value');
    const rewardValue = valInput ? parseInt(valInput.value) || 0 : 0;

    if(!numbersRaw) { 
        if(typeof showAlert === 'function') showAlert("تنبيه", "يرجى إدخال أرقام الموبايلات أولاً"); 
        return; 
    }
    
    const numbers = numbersRaw.split('\n').map(n => n.trim()).filter(n => n.length >= 10);
    if(numbers.length === 0) { 
        if(typeof showAlert === 'function') showAlert("تنبيه", "لم يتم العثور على أرقام صحيحة"); 
        return; 
    }

    const linksContainer = document.getElementById('bulk-whatsapp-links');
    if(!linksContainer) return;
    
    linksContainer.innerHTML = '<p class="text-xs font-black text-brand-navy mb-2 border-b pb-2"><i class="fa-solid fa-check-double text-green-500"></i> اضغط "إرسال" قدام كل رقم:</p>';

    numbers.forEach(num => {
        const randomCode = "THX-" + Math.floor(1000 + Math.random() * 9000);
        tempPromoCodes.push({ 
            code: randomCode, type: rewardType, discount: rewardValue, isAuto: true, usesLeft: null, customerPhone: num, minOrder: 0, maxDiscount: 0, expiryDate: '' 
        });

        const finalMessage = messageTemplate.replace(/{الكود}/g, randomCode);
        let waNumber = num.startsWith('0') ? '2' + num : num; 
        const waLink = `https://api.whatsapp.com/send?phone=${waNumber}&text=${encodeURIComponent(finalMessage)}`;

        linksContainer.innerHTML += `
            <div class="flex justify-between items-center bg-white p-2 border border-gray-200 rounded-lg shadow-sm">
                <span class="text-xs font-bold text-gray-600" dir="ltr">${num}</span>
                <a href="${waLink}" target="_blank" class="bg-green-500 hover:bg-green-600 text-white text-[10px] px-4 py-1.5 rounded font-black transition-colors flex items-center gap-1">
                    إرسال <i class="fa-brands fa-whatsapp text-sm"></i>
                </a>
            </div>`;
    });

    renderAdminPromos();
    linksContainer.classList.remove('hidden');
    if(typeof showAlert === 'function') {
        showAlert("تم التجهيز بنجاح 🎉", `تم إنشاء أكواد لـ ${numbers.length} عميل. \n\n⚠️ مهم جداً: انزل تحت في قسم التسويق ودوس "حفظ إعدادات التسويق" عشان الأكواد تتفعل في السيستم.`);
    }
};

// ==================== دوال الحفظ المفصولة ====================

// دالة مساعدة لرفع التعديلات للسحابة
const updateSettingsDB = async (updates, btnSelector) => {
    const btn = document.querySelector(btnSelector);
    let origHtml = '';
    if(btn) {
        origHtml = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-xl"></i> جاري الحفظ...';
        btn.disabled = true;
    }
    
    try {
        if(window.hasCloud && window.db) await db.collection("inventory").doc("settings").update(updates);
        if(window.globalSettings) Object.assign(globalSettings, updates);
        
        if(btn) { btn.innerHTML = origHtml; btn.disabled = false; }
        if(typeof showAlert === 'function') showAlert("تم بنجاح", "تم الحفظ بنجاح.");
    } catch(e) {
        if(btn) { btn.innerHTML = origHtml; btn.disabled = false; }
        if(typeof showAlert === 'function') showAlert("خطأ", "حدث خطأ أثناء الحفظ. تأكد من اتصالك بالإنترنت.");
    }
};

window.saveStoreSettings = () => {
    const storeOpenCheck = document.getElementById('admin-store-open');
    const storeNameInp = document.getElementById('admin-store-name');
    const storeDescInp = document.getElementById('admin-store-desc');
    const storePhoneInp = document.getElementById('admin-store-phone');
    const minOrderInp = document.getElementById('admin-min-order');
    
    const updates = {
        storeOpen: storeOpenCheck ? storeOpenCheck.checked : true,
        storeName: storeNameInp ? storeNameInp.value.trim() : '',
        storeDesc: storeDescInp ? storeDescInp.value.trim() : '',
        storePhone: storePhoneInp ? storePhoneInp.value.trim() : '',
        minOrder: minOrderInp ? (parseInt(minOrderInp.value) || 0) : 0
    };
    
    updateSettingsDB(updates, 'button[onclick="window.saveStoreSettings()"]');
    if(typeof applySettingsToUI === 'function') applySettingsToUI();
};

window.saveProductsData = async () => {
    syncAdminProductsFromDOM();
    const btn = document.querySelector('button[onclick="window.saveProductsData()"]');
    let origHtml = '';
    if(btn) {
        origHtml = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-xl"></i> جاري الحفظ...';
        btn.disabled = true;
    }
    
    try {
        if(window.hasCloud && window.db) {
            await Promise.all([
                db.collection("inventory").doc("settings").update({bestSellers: globalSettings.bestSellers || []}),
                db.collection("inventory").doc("stock").set(window.globalStock || {}),
                db.collection("inventory").doc("prices").set(window.globalPrices || {}),
                db.collection("inventory").doc("old_prices").set(window.globalOldPrices || {}),
                db.collection("inventory").doc("discounts_status").set(window.globalDiscounts || {})
            ]);
        }
        if(window.productsInfo) productsInfo = JSON.parse(JSON.stringify(tempProducts));
        
        const container = document.getElementById('products-container'); 
        if(container) container.innerHTML = `<div class="text-center py-10 text-brand-cyanDark"><i class="fa-solid fa-spinner fa-spin text-3xl mb-3"></i></div>`; 
        
        setTimeout(() => {
            if(typeof renderProducts === 'function') renderProducts();
        }, 500);
        
        if(btn) { btn.innerHTML = origHtml; btn.disabled = false; }
        if(typeof showAlert === 'function') showAlert("تم بنجاح", "تم حفظ المنتجات وتحديث المنيو.");
    } catch(e) { 
        if(btn) { btn.innerHTML = origHtml; btn.disabled = false; }
        if(typeof showAlert === 'function') showAlert("خطأ", "حدث خطأ أثناء حفظ المنتجات."); 
    }
};

window.saveDriversData = () => {
    const validDrivers = tempDrivers.filter(d => d.name.trim() && d.phone.trim());
    updateSettingsDB({drivers: validDrivers}, 'button[onclick="window.saveDriversData()"]');
};

window.saveDeliverySettings = () => {
    const freeDeliveryCheck = document.getElementById('admin-free-delivery-active');
    const freeDeliveryThresh = document.getElementById('admin-free-delivery-threshold');
    
    const updates = {
        freeDeliveryActive: freeDeliveryCheck ? freeDeliveryCheck.checked : false,
        freeDeliveryThreshold: freeDeliveryThresh ? (parseInt(freeDeliveryThresh.value) || 0) : 0,
        deliveryZones: tempAdminZones.filter(z => z.name.trim())
    };
    updateSettingsDB(updates, 'button[onclick="window.saveDeliverySettings()"]');
    
    if(window.globalDeliveryZones) globalDeliveryZones = updates.deliveryZones;
    if(typeof renderDeliveryZones === 'function') renderDeliveryZones();
    if(typeof updateUI === 'function') updateUI();
};

window.saveMarketingSettings = () => {
    const rewardActive = document.getElementById('admin-reward-active');
    const rewardType = document.getElementById('admin-reward-type');
    const rewardValue = document.getElementById('admin-reward-value');
    const rewardMaxGen = document.getElementById('admin-reward-max-generations');
    const bannerActive = document.getElementById('admin-banner-active');
    const bannerText = document.getElementById('admin-banner-text');
    const crossSellActive = document.getElementById('admin-crosssell-active');
    const crossSellProd = document.getElementById('admin-crosssell-product');
    const showPromoCheck = document.getElementById('admin-show-promo-field');

    const updates = {
        rewardActive: rewardActive ? rewardActive.checked : false,
        rewardType: rewardType ? rewardType.value : 'fixed',
        rewardValue: rewardValue ? (parseInt(rewardValue.value) || 0) : 0,
        rewardMaxGenerations: rewardMaxGen ? (parseInt(rewardMaxGen.value) || 0) : 0,
        bannerActive: bannerActive ? bannerActive.checked : false,
        bannerText: bannerText ? bannerText.value.trim() : '',
        crossSellActive: crossSellActive ? crossSellActive.checked : false,
        crossSellProductId: crossSellProd ? crossSellProd.value : null,
        promoCodes: tempPromoCodes.filter(p => p.code.trim()),
        showPromoField: showPromoCheck ? showPromoCheck.checked : true
    };
    
    updateSettingsDB(updates, 'button[onclick="window.saveMarketingSettings()"]');
    if(typeof applySettingsToUI === 'function') applySettingsToUI();
};

window.saveAdvancedSettings = () => {
    const waTemp = document.getElementById('admin-whatsapp-template');
    const ttTemp = document.getElementById('admin-ticktick-template');
    const vipTemp = document.getElementById('admin-vip-whatsapp-template');
    const hashTemp = document.getElementById('admin-batch-hashtag');
    const dispTemp = document.getElementById('admin-dispatch-template');

    const updates = {
        whatsappTemplate: waTemp ? waTemp.value.trim() : '',
        ticktickTemplate: ttTemp ? ttTemp.value.trim() : '',
        vipWhatsappTemplate: vipTemp ? vipTemp.value.trim() : '',
        batchHashtag: hashTemp ? hashTemp.value.trim() : '',
        dispatchTemplate: dispTemp ? dispTemp.value.trim() : ''
    };
    
    updateSettingsDB(updates, 'button[onclick="window.saveAdvancedSettings()"]');
};

window.saveTextsSettings = () => {
    let newUiTexts = {};
    if(window.textsConfig) {
        textsConfig.forEach(t => {
            const el = document.getElementById(`ui-txt-${t.id}`);
            if(el) newUiTexts[t.id] = el.value.trim();
        });
        updateSettingsDB({uiTexts: newUiTexts}, 'button[onclick="window.saveTextsSettings()"]');
        if(typeof applySettingsToUI === 'function') applySettingsToUI();
    }
};
console.log('admin.js loaded successfully');
