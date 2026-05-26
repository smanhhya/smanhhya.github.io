// js/admin.js

// الإعلان الرسمي عن المتغيرات لمنع مشاكل الـ Strict Mode وسهولة الكاش
let currentAdminTab = 'stats'; 
let ordersList = []; 
let orderFilter = 'all'; 
let selectedOrdersForDispatch = [];
let tempAdminZones = [];
let tempPromoCodes = [];
let tempProducts = {};

// تحسين تفاعل زر فتح وإغلاق المتجر
document.getElementById('admin-store-open')?.addEventListener('change', function() {
    const label = document.getElementById('store-open-label');
    if (label) {
        label.innerText = this.checked ? 'مفتوح' : 'مغلق';
        label.className = this.checked ? 'mr-3 text-sm font-black text-green-600 w-12' : 'mr-3 text-sm font-black text-red-600 w-12';
    }
});

window.openAdminLogin = () => { 
    document.getElementById('admin-login-modal')?.classList.remove('hidden'); 
    setTimeout(() => document.getElementById('admin-login-modal')?.classList.remove('opacity-0'), 10); 
    const passInput = document.getElementById('admin-password-input');
    if (passInput) passInput.value = ''; 
};

window.closeAdminLogin = () => { 
    document.getElementById('admin-login-modal')?.classList.add('opacity-0'); 
    setTimeout(() => document.getElementById('admin-login-modal')?.classList.add('hidden'), 300); 
};

window.verifyAdminPin = () => { 
    const emailEl = document.getElementById('admin-email-input');
    const passEl = document.getElementById('admin-password-input');
    if (!emailEl || !passEl) return;

    const email = emailEl.value.trim();
    const pass = passEl.value.trim();
    const btn = document.querySelector('#admin-login-modal button[onclick*="verifyAdminPin"]');
    if (!email || !pass) { showAlert("تنبيه", "يرجى كتابة البريد الإلكتروني وكلمة المرور."); return; }

    let origHtml = btn ? btn.innerHTML : "دخول";
    if (btn) { btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري التحقق...'; btn.disabled = true; }

    firebase.auth().signInWithEmailAndPassword(email, pass)
        .then((userCredential) => {
            closeAdminLogin(); 
            openAdminDashboard();
            if (btn) { btn.innerHTML = origHtml; btn.disabled = false; }
            passEl.value = '';
        })
        .catch((error) => {
            if (btn) { btn.innerHTML = origHtml; btn.disabled = false; }
            showAlert("خطأ", "بيانات الدخول غير صحيحة، أو ليس لديك صلاحية!");
        });
};

window.switchAdminTab = (tab) => {
    currentAdminTab = tab;
    ['stats','store','products','orders','delivery','marketing','advanced','texts'].forEach(t => {
        document.getElementById('admin-panel-'+t)?.classList.add('hidden');
        const btn = document.getElementById('admin-tab-'+t);
        if(btn) btn.className = t===tab ? "px-4 py-2 rounded-lg font-bold text-sm bg-brand-cyanDark text-white whitespace-nowrap" : "px-4 py-2 rounded-lg font-bold text-sm text-gray-600 hover:bg-gray-100 whitespace-nowrap";
    });
    document.getElementById('admin-panel-'+tab)?.classList.remove('hidden');
    if(tab==='orders') loadOrders(); 
    if(tab==='products') renderAdminProducts();
    if(tab==='stats') renderTopProductsStats();
};

window.openAdminDashboard = () => {
    const storeToggle = document.getElementById('admin-store-open');
    if(storeToggle) storeToggle.checked = globalSettings.storeOpen !== false;
    
    const storeOpenLabel = document.getElementById('store-open-label');
    if(storeOpenLabel && storeToggle) {
        storeOpenLabel.innerText = storeToggle.checked ? 'مفتوح' : 'مغلق';
        storeOpenLabel.className = storeToggle.checked ? 'mr-3 text-sm font-black text-green-600 w-12' : 'mr-3 text-sm font-black text-red-600 w-12';
    }

    if(document.getElementById('admin-store-name')) document.getElementById('admin-store-name').value = globalSettings.storeName || ''; 
    if(document.getElementById('admin-store-desc')) document.getElementById('admin-store-desc').value = globalSettings.storeDesc || ''; 
    if(document.getElementById('admin-store-phone')) document.getElementById('admin-store-phone').value = globalSettings.storePhone || ''; 
    if(document.getElementById('admin-min-order')) document.getElementById('admin-min-order').value = globalSettings.minOrder || 0;
    if(document.getElementById('admin-free-delivery-active')) document.getElementById('admin-free-delivery-active').checked = globalSettings.freeDeliveryActive; 
    if(document.getElementById('admin-free-delivery-threshold')) document.getElementById('admin-free-delivery-threshold').value = globalSettings.freeDeliveryThreshold || 0; 
    
    tempAdminZones = JSON.parse(JSON.stringify(globalDeliveryZones||[])); 
    renderAdminZones();
    
    if(document.getElementById('admin-reward-active')) document.getElementById('admin-reward-active').checked = globalSettings.rewardActive; 
    if(document.getElementById('admin-reward-type')) document.getElementById('admin-reward-type').value = globalSettings.rewardType || 'fixed'; 
    if(document.getElementById('admin-reward-value')) document.getElementById('admin-reward-value').value = globalSettings.rewardValue || 0; 
    if(document.getElementById('admin-reward-max-generations')) document.getElementById('admin-reward-max-generations').value = globalSettings.rewardMaxGenerations || 0; 
    if(document.getElementById('admin-banner-active')) document.getElementById('admin-banner-active').checked = globalSettings.bannerActive; 
    if(document.getElementById('admin-banner-text')) document.getElementById('admin-banner-text').value = globalSettings.bannerText || ''; 
    if(document.getElementById('admin-crosssell-active')) document.getElementById('admin-crosssell-active').checked = globalSettings.crossSellActive; 
    
    const csSelect = document.getElementById('admin-crosssell-product'); 
    if(csSelect) {
        csSelect.innerHTML=''; 
        Object.keys(productsInfo).forEach(id => csSelect.innerHTML += `<option value="${id}" ${globalSettings.crossSellProductId===id?'selected':''}>${productsInfo[id].name}</option>`);
    }
    
    tempPromoCodes = JSON.parse(JSON.stringify(globalSettings.promoCodes||[])); 
    renderAdminPromos();
    
    if(document.getElementById('admin-show-promo-field')) document.getElementById('admin-show-promo-field').checked = globalSettings.showPromoField !== false;
    if(document.getElementById('admin-success-title')) document.getElementById('admin-success-title').value = globalSettings.successTitle || ''; 
    if(document.getElementById('admin-success-message')) document.getElementById('admin-success-message').value = globalSettings.successMessage || ''; 
    
    if(document.getElementById('admin-whatsapp-template')) document.getElementById('admin-whatsapp-template').value = globalSettings.whatsappTemplate || '';
    if(document.getElementById('admin-batch-hashtag')) document.getElementById('admin-batch-hashtag').value = globalSettings.batchHashtag || '';
    if(document.getElementById('admin-vip-whatsapp-template')) document.getElementById('admin-vip-whatsapp-template').value = globalSettings.vipWhatsappTemplate || '';
    if(document.getElementById('admin-ticktick-template')) document.getElementById('admin-ticktick-template').value = globalSettings.ticktickTemplate || '';

    // حقن قالب رسائل المندوب مع تأمين كامل من الـ Null Pointer
    if(!document.getElementById('admin-driver-template')) {
        const advDiv = document.querySelector('#admin-panel-advanced');
        if(advDiv) {
            advDiv.insertAdjacentHTML('afterbegin', `
            <div class="bg-brand-light/30 border border-brand-cyan/40 rounded-xl p-4 shadow-sm mb-4">
                <h3 class="font-black text-brand-navy mb-3"><i class="fa-solid fa-motorcycle text-brand-cyanDark"></i> قالب رسالة المندوب (التوزيع)</h3>
                <p class="text-[10px] text-gray-500 font-bold mb-2">المتغيرات: {اسم_العميل} , {الموبايل} , {المنطقة} , {العنوان} , {الطلبات} , {الاجمالي} , {التوصيل}</p>
                <textarea id="admin-driver-template" rows="5" class="w-full border rounded-lg p-2 font-bold text-brand-navy whitespace-pre-wrap" dir="rtl"></textarea>
            </div>`);
        }
    }
    const driverTemplateEl = document.getElementById('admin-driver-template');
    if(driverTemplateEl) {
        driverTemplateEl.value = globalSettings.driverTemplate || '📦 *طلب جديد للتوصيل*\n👤 {اسم_العميل} - {الموبايل}\n📍 {المنطقة} - {العنوان}\n🛒 الطلبات:\n{الطلبات}\n💰 الإجمالي للتحصيل: *{الاجمالي} ج.م* (منهم {التوصيل} رسوم توصيل)\n-------------------';
    }

    // تنظيف تريكة الماضي
    const oldLabelInput = document.getElementById('admin-old-customer-label');
    if(oldLabelInput && oldLabelInput.parentElement) { oldLabelInput.parentElement.style.display = 'none'; }

    // حقن حقل رسالة إغلاق المتجر بأمان
    if(!document.getElementById('admin-closed-msg')) {
        const storeDiv = document.querySelector('#admin-panel-store .bg-white.border.rounded-xl');
        if(storeDiv) storeDiv.insertAdjacentHTML('beforeend', `<div class="mt-3 pt-3 border-t"><label class="text-xs font-bold text-gray-500">رسالة إغلاق المتجر</label><input type="text" id="admin-closed-msg" class="w-full border rounded-lg p-2 font-bold text-brand-navy"></div>`);
    }
    const closedMsgEl = document.getElementById('admin-closed-msg');
    if(closedMsgEl) closedMsgEl.value = globalSettings.closedMessage || 'المتجر مغلق حالياً، نعود قريباً!';

    // حقن بادئة توليد الأكواد التلقائية الذكية
    if(!document.getElementById('admin-auto-prefix')) {
        const marketingDiv = document.querySelector('#admin-panel-marketing > div.border-l-green-500');
        if(marketingDiv) marketingDiv.insertAdjacentHTML('beforeend', `<div class="mt-4 pt-3 border-t border-green-100"><label class="text-[10px] font-bold text-gray-500 block mb-1">اسم/بادئة الكود (مثال: VIP أو GIFT)</label><input type="text" id="admin-auto-prefix" class="w-full border rounded p-2 mb-2 font-bold text-brand-navy" dir="ltr" style="text-align: right;"><label class="text-[10px] font-bold text-gray-500 block mb-1">رسالة التهنئة للكود (تظهر للعميل)</label><textarea id="admin-auto-msg" rows="2" class="w-full border rounded p-2 font-bold text-brand-navy text-xs"></textarea></div>`);
    }
    const autoPrefixEl = document.getElementById('admin-auto-prefix');
    const autoMsgEl = document.getElementById('admin-auto-msg');
    if(autoPrefixEl) autoPrefixEl.value = globalSettings.autoPromoPrefix || 'VIP-'; 
    if(autoMsgEl) autoMsgEl.value = globalSettings.autoPromoModalMsg || 'تم إصدار كود خصم خاص بك لطلبك القادم 🎁';

    // فلترة وبناء القاموس بدون التابات القديمة
    const textsCont = document.getElementById('admin-texts-container');
    if(textsCont) { 
        textsCont.innerHTML = ''; 
        const obsoleteKeys = ['tabNewCust', 'tabOldCust', 'oldCustMsg', 'oldPhoneLabel'];
        textsConfig.forEach(t => { 
            if(!obsoleteKeys.includes(t.id)) {
                const val = (globalSettings.uiTexts && globalSettings.uiTexts[t.id]) ? globalSettings.uiTexts[t.id] : t.default; 
                textsCont.innerHTML += `<div><label class="text-[10px] font-bold text-gray-500 block mb-1">${t.label}</label><input type="text" id="ui-txt-${t.id}" value="${val}" class="w-full border rounded p-2 text-xs font-bold text-brand-navy outline-none focus:border-brand-cyan"></div>`; 
            }
        }); 
    }

    tempProducts = JSON.parse(JSON.stringify(productsInfo || {})); 
    renderAdminProducts(); 
    document.getElementById('admin-dashboard-modal')?.classList.remove('hidden'); 
    setTimeout(() => document.getElementById('admin-dashboard-modal')?.classList.remove('opacity-0'), 10); 
    switchAdminTab('stats');
};

window.closeAdminDashboard = () => { 
    document.getElementById('admin-dashboard-modal')?.classList.add('opacity-0'); 
    setTimeout(() => document.getElementById('admin-dashboard-modal')?.classList.add('hidden'), 300); 
};

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
};

window.moveProduct = (id, direction) => {
    syncAdminProductsFromDOM(); 
    const keys = Object.keys(tempProducts); const idx = keys.indexOf(id);
    if (direction === 'up' && idx > 0) { [keys[idx], keys[idx - 1]] = [keys[idx - 1], keys[idx]]; } 
    else if (direction === 'down' && idx < keys.length - 1) { [keys[idx], keys[idx + 1]] = [keys[idx + 1], keys[idx]]; } 
    else { return; }
    const newObj = {}; keys.forEach(k => newObj[k] = tempProducts[k]); tempProducts = newObj; 
    renderAdminProducts();
};

window.renderAdminProducts = () => {
    const container = document.getElementById('admin-inputs-container'); 
    if(!container) return;
    let html = ''; 
    Object.keys(tempProducts).forEach(id => {
        const p = tempProducts[id]; const stock = globalStock[id] || 0; const price = globalPrices[id] || p.basePrice; const oldPrice = globalOldPrices[id] || price; const isDisc = globalDiscounts[id] || false; const isBest = globalSettings.bestSellers?.includes(id) || false;
        const isVisible = p.isVisible !== false; const tag = p.tag || ''; const imgSrc = (p.images && p.images.length > 0) ? p.images[0] : '';
        html += `<div class="bg-white border ${isVisible ? 'border-gray-200' : 'border-red-300 opacity-70'} rounded-xl p-3 shadow-sm mb-3">
            <div class="flex justify-between items-center cursor-pointer" onclick="document.getElementById('edit-p-${id}').classList.toggle('hidden')">
                <div class="font-black text-brand-navy flex items-center gap-2"><div class="flex flex-col gap-1 ml-1 mr-[-5px]"><button onclick="event.stopPropagation(); moveProduct('${id}', 'up')" class="text-gray-400 hover:text-brand-cyanDark text-[12px] bg-gray-100 rounded w-5 h-5 flex justify-center items-center"><i class="fa-solid fa-chevron-up"></i></button><button onclick="event.stopPropagation(); moveProduct('${id}', 'down')" class="text-gray-400 hover:text-brand-cyanDark text-[12px] bg-gray-100 rounded w-5 h-5 flex justify-center items-center"><i class="fa-solid fa-chevron-down"></i></button></div><img src="${imgSrc}" class="w-8 h-8 rounded object-cover" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\'><rect width=\\'100%\\' height=\\'100%\\' fill=\\'%23f1f5f9\\'/></svg>'"> ${p.name} ${!isVisible ? '<span class="text-[10px] text-red-500 bg-red-50 px-1 rounded">مخفي</span>' : ''}</div>
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
                <div class="flex flex-wrap gap-2 bg-gray-50 p-2 rounded border mb-2 items-center">
                    <label class="flex items-center gap-1 text-[10px] font-bold cursor-pointer select-none bg-white border p-1 rounded"><input type="checkbox" id="p-visible-${id}" ${isVisible?'checked':''} class="accent-brand-navy"> معروض للزبون 👁️</label>
                    <select id="p-tag-${id}" class="border rounded p-1 text-[10px] font-bold text-gray-600 outline-none">
                        <option value="" ${tag===''?'selected':''}>بدون تاج</option>
                        <option value="new" ${tag==='new'?'selected':''}>🆕 جديد</option>
                        <option value="hot" ${tag==='hot'?'selected':''}>🔥 قرب يخلص</option>
                        <option value="offer" ${tag==='offer'?'selected':''}>⏱️ عرض محدود</option>
                    </select>
                    <label class="flex items-center gap-1 text-[10px] font-bold cursor-pointer select-none ml-auto"><input type="checkbox" id="p-extra-${id}" ${p.isExtra?'checked':''} class="accent-brand-cyanDark"> إضافي</label>
                    <label class="flex items-center gap-1 text-[10px] font-bold cursor-pointer select-none"><input type="checkbox" id="p-best-${id}" ${isBest?'checked':''} class="accent-brand-yellow"> 🔥 طلباً</label>
                    <label class="flex items-center gap-1 text-[10px] font-bold text-red-600 cursor-pointer select-none w-full mt-1 pt-1 border-t"><input type="checkbox" id="p-disc-${id}" ${isDisc?'checked':''} class="accent-red-500" onchange="document.getElementById('p-old-${id}').classList.toggle('hidden', !this.checked)"> خصم لسعر قديم: <input type="number" id="p-old-${id}" value="${oldPrice}" class="w-12 border rounded p-1 text-[10px] text-center bg-white text-red-500 font-bold line-through outline-none ${isDisc?'':'hidden'}"></label>
                </div>
                <button onclick="deleteAdminProduct('${id}')" class="w-full mt-2 bg-red-50 border border-red-200 text-red-600 font-bold text-xs py-2 rounded hover:bg-red-100 transition-colors"><i class="fa-solid fa-trash"></i> حذف هذا المنتج نهائياً</button>
            </div>
        </div>`;
    });
    container.innerHTML = html; 
};

window.addNewAdminProduct = () => { 
    const newId = 'p_' + Date.now(); 
    tempProducts[newId] = { name: "منتج جديد", basePrice: 0, weight: "1 طبق", images: [""], isExtra: false, isVisible: true }; 
    globalStock[newId] = 0; globalPrices[newId] = 0; globalOldPrices[newId] = 0; globalDiscounts[newId] = false; 
    renderAdminProducts(); 
    setTimeout(() => document.getElementById(`edit-p-${newId}`)?.classList.remove('hidden'), 100); 
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
        tempProducts[id].isVisible = document.getElementById(`p-visible-${id}`).checked; 
        tempProducts[id].tag = document.getElementById(`p-tag-${id}`).value;
        globalPrices[id] = parseInt(document.getElementById(`p-price-${id}`).value) || 0; 
        globalStock[id] = parseInt(document.getElementById(`p-stock-${id}`).value) || 0; 
        globalOldPrices[id] = parseInt(document.getElementById(`p-old-${id}`).value) || 0; 
        globalDiscounts[id] = document.getElementById(`p-disc-${id}`).checked; 
        if(document.getElementById(`p-best-${id}`).checked) newBest.push(id);
    });
    if(!globalSettings) globalSettings = {};
    globalSettings.bestSellers = newBest;
};

window.renderAdminZones = () => { 
    const c=document.getElementById('admin-zones-container'); if(!c) return;
    c.innerHTML=''; 
    tempAdminZones.forEach((z,i) => c.innerHTML += `<div class="flex gap-2 items-center"><input type="text" value="${z.name}" class="flex-1 border rounded p-2 text-sm font-bold text-brand-navy outline-none focus:border-brand-cyan" onchange="tempAdminZones[${i}].name=this.value"><input type="number" value="${z.price}" class="w-16 border rounded p-2 text-sm text-center font-bold text-brand-cyanDark outline-none focus:border-brand-cyan" onchange="tempAdminZones[${i}].price=parseInt(this.value)"><button onclick="tempAdminZones.splice(${i},1);renderAdminZones()" class="text-red-500 hover:bg-red-50 rounded w-8 h-8 transition-colors"><i class="fa-solid fa-trash"></i></button></div>`); 
};

window.addNewAdminZone = () => { tempAdminZones.push({id:'z_'+Date.now(), name:'', price:0}); renderAdminZones(); };

window.renderAdminPromos = () => { 
    const c = document.getElementById('admin-promos-container'); if(!c) return;
    if(!document.getElementById('promo-search-bar')) {
        const searchHtml = `<input type="text" id="promo-search-bar" placeholder="🔍 ابحث برقم الموبايل أو الكود..." class="w-full border-2 border-gray-200 rounded-xl p-3 mb-4 font-bold text-brand-navy outline-none focus:border-brand-cyan" onkeyup="renderAdminPromos()">`;
        c.insertAdjacentHTML('beforebegin', searchHtml);
    }
    
    const query = document.getElementById('promo-search-bar')?.value.toLowerCase() || '';
    let filteredPromos = tempPromoCodes;
    if(query) { filteredPromos = tempPromoCodes.filter(p => p.code.toLowerCase().includes(query) || (p.customerPhone && p.customerPhone.includes(query))); }
    if(filteredPromos.length === 0) { c.innerHTML = '<p class="text-center text-gray-400 text-xs font-bold">لا يوجد أكواد مسجلة</p>'; return; }

    let html = ''; 
    filteredPromos.forEach((p) => {
        let i = tempPromoCodes.indexOf(p);
        const autoBadge = p.isAuto ? `<span class="bg-yellow-100 text-yellow-700 text-[8px] font-black px-1 rounded ml-1">تلقائي</span>` : '';
        html += `
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
                <div><label class="text-[10px] font-bold text-gray-500 block mb-0.5">الحد الأدنى للطلب</label><input type="number" value="${p.minOrder || 0}" placeholder="مثال: 150" class="w-full border rounded p-1.5 text-xs text-center font-bold text-brand-navy outline-none focus:border-brand-cyan" onchange="tempPromoCodes[${i}].minOrder=parseInt(this.value) || 0"></div>
                <div><label class="text-[10px] font-bold text-gray-500 block mb-0.5">الحد الأقصى للخصم</label><input type="number" value="${p.maxDiscount || 0}" placeholder="بدون حد" class="w-full border rounded p-1.5 text-xs text-center font-bold text-brand-navy outline-none focus:border-brand-cyan ${p.type !== 'percent' ? 'bg-gray-100 cursor-not-allowed opacity-50' : ''}" ${p.type !== 'percent' ? 'disabled' : ''} onchange="tempPromoCodes[${i}].maxDiscount=parseInt(this.value) || 0"></div>
            </div>
            <div class="grid grid-cols-2 gap-2 mt-1">
                <div><label class="text-[10px] font-bold text-gray-500 block mb-0.5">تاريخ الانتهاء</label><input type="date" value="${p.expiryDate || ''}" class="w-full border rounded p-1.5 text-xs text-center font-bold text-brand-navy outline-none focus:border-brand-cyan" onchange="tempPromoCodes[${i}].expiryDate=this.value"></div>
                <div><label class="text-[10px] font-bold text-gray-500 block mb-0.5">مرات الاستخدام</label><input type="number" value="${p.usesLeft === null ? '' : p.usesLeft}" placeholder="لا نهائي" class="w-full border rounded p-1.5 text-xs text-center font-bold text-brand-navy outline-none focus:border-brand-cyan" onchange="let val = this.value; tempPromoCodes[${i}].usesLeft = (val === '' || val <= 0) ? null : parseInt(val);"></div>
            </div>
            <div class="flex items-center bg-white border rounded p-1.5 border-gray-300 mt-1">
                <i class="fa-solid fa-mobile-screen text-gray-400 text-[10px] w-4 text-center"></i><input type="text" value="${p.customerPhone || ''}" placeholder="مخصص لرقم موبايل (اختياري)" class="flex-1 text-xs font-bold text-brand-navy outline-none bg-transparent" onchange="tempPromoCodes[${i}].customerPhone=this.value" dir="ltr" style="text-align: right;">
            </div>
            <button onclick="tempPromoCodes.splice(${i},1);renderAdminPromos()" class="absolute top-2 left-2 text-red-500 hover:bg-red-100 rounded w-7 h-7 flex justify-center items-center transition-colors"><i class="fa-solid fa-trash text-[12px]"></i></button>
        </div>`;
    });
    c.innerHTML = html;
};

window.addNewPromoCode = () => { tempPromoCodes.push({ code: '', discount: 0, type: 'fixed', usesLeft: null, minOrder: 0, maxDiscount: 0, expiryDate: '', customerPhone: '' }); renderAdminPromos(); };

// --- 🌟 نظام المناديب والـ Dispatch 🌟 ---
window.toggleOrderSelection = function(orderId) {
    const idx = selectedOrdersForDispatch.indexOf(orderId);
    if (idx > -1) selectedOrdersForDispatch.splice(idx, 1);
    else selectedOrdersForDispatch.push(orderId);
    
    const actionBar = document.getElementById('dispatch-action-bar');
    const countSpan = document.getElementById('dispatch-count');
    if (selectedOrdersForDispatch.length > 0) {
        if(actionBar) actionBar.classList.remove('hidden');
        if(countSpan) countSpan.innerText = selectedOrdersForDispatch.length;
    } else {
        if(actionBar) actionBar.classList.add('hidden');
    }
};

window.dispatchSelectedOrders = function() {
    if(selectedOrdersForDispatch.length === 0) return;
    
    let driverPhone = prompt("أدخل رقم واتساب المندوب (مثال: 01012345678):", "");
    if(driverPhone === null || driverPhone.trim() === "") return;
    
    let fullDispatchMessage = `🚚 *كشف توزيع جديد (${selectedOrdersForDispatch.length} طلبات)* 🚚\n\n`;
    let template = document.getElementById('admin-driver-template')?.value || globalSettings.driverTemplate || '📦 *طلب*\n👤 {اسم_العميل} - {الموبايل}\n📍 {المنطقة} - {العنوان}\n🛒 الطلبات:\n{الطلبات}\n💰 الإجمالي للتحصيل: *{الاجمالي} ج.م* (منهم {التوصيل} ج توصيل)\n-------------------';
    
    let totalToCollect = 0;

    selectedOrdersForDispatch.forEach(id => {
        let order = ordersList.find(o => o.id === id);
        if(order) {
            let itemsStr = order.items.map(i => `▪️ ${i.quantity}x ${i.name}`).join('\n');
            // استخدام replaceAll لضمان استبدال كل الخانات مكررة المتغيرات
            let orderText = template
                .replaceAll('{اسم_العميل}', order.customerName || '')
                .replaceAll('{الموبايل}', order.customerPhone || '')
                .replaceAll('{المنطقة}', order.zone || '')
                .replaceAll('{العنوان}', order.customerAddress && order.customerAddress !== 'غير محدد' ? order.customerAddress : 'بدون عنوان تفصيلي')
                .replaceAll('{الطلبات}', itemsStr)
                .replaceAll('{الاجمالي}', order.total || 0)
                .replaceAll('{التوصيل}', order.deliveryFee || 0);
            
            fullDispatchMessage += orderText + '\n';
            totalToCollect += parseInt(order.total) || 0;
        }
    });

    fullDispatchMessage += `\n💵 *إجمالي التحصيل لكل الطلبات: ${totalToCollect} ج.م*`;

    let waPhone = driverPhone.startsWith('0') ? '2' + driverPhone : driverPhone;
    window.open(`https://api.whatsapp.com/send?phone=${waPhone}&text=${encodeURIComponent(fullDispatchMessage)}`, '_blank');
    
    selectedOrdersForDispatch = [];
    document.getElementById('dispatch-action-bar')?.classList.add('hidden');
    renderOrdersList(); 
};

window.renderOrdersList = () => {
    const container = document.getElementById('orders-list-container');
    if(!container) return;
    
    let filtered = ordersList;
    if(orderFilter !== 'all') filtered = ordersList.filter(o => o.status === orderFilter);

    let searchQuery = document.getElementById('order-search')?.value.toLowerCase() || '';
    if (searchQuery) { filtered = filtered.filter(o => o.customerName.toLowerCase().includes(searchQuery) || o.customerPhone.includes(searchQuery) || o.zone.toLowerCase().includes(searchQuery)); }

    if(!document.getElementById('dispatch-action-bar')) {
        container.insertAdjacentHTML('beforebegin', `
        <div id="dispatch-action-bar" class="hidden bg-brand-navy p-3 rounded-xl mb-4 flex justify-between items-center shadow-[0_10px_20px_rgba(0,0,0,0.15)] border-2 border-brand-cyanDark transform transition-all">
            <span class="text-white font-bold text-sm">تم تحديد <span id="dispatch-count" class="text-brand-yellow font-black text-lg px-1">0</span> طلبات</span>
            <button onclick="dispatchSelectedOrders()" class="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-xs font-black transition-colors flex items-center gap-2"><i class="fa-solid fa-motorcycle"></i> إرسال للمندوب</button>
        </div>`);
    }

    if(filtered.length === 0) { container.innerHTML = '<p class="text-center text-gray-500 py-8 font-bold text-sm bg-gray-50 rounded-xl border border-dashed">لا توجد طلبات</p>'; return; }

    let html = ''; 
    filtered.forEach(order => {
        let statusColor = order.status === 'new' ? 'bg-red-100 text-red-700 border-red-200' : (order.status === 'processing' ? 'bg-yellow-100 text-yellow-700 border-yellow-200' : 'bg-green-100 text-green-700 border-green-200');
        let statusText = order.status === 'new' ? 'جديد' : (order.status === 'processing' ? 'قيد التجهيز' : 'مكتمل');
        let itemsHtml = order.items.map(i => `<div class="flex justify-between text-xs text-gray-700 font-bold border-b border-gray-100 pb-1 mb-1 last:border-0 last:pb-0 last:mb-0"><span><span class="text-brand-cyanDark">${i.quantity}x</span> ${i.name}</span><span>${i.quantity*i.price} ج</span></div>`).join('');
        
        let isChecked = selectedOrdersForDispatch.includes(order.id) ? 'checked' : '';

        html += `
        <div class="bg-white border rounded-xl p-4 shadow-sm relative overflow-hidden transition-all ${isChecked ? 'ring-2 ring-brand-cyanDark bg-brand-light/20' : ''}">
            <div class="absolute top-0 right-0 w-1 h-full ${order.status === 'new' ? 'bg-red-500' : (order.status === 'processing' ? 'bg-yellow-500' : 'bg-green-500')}"></div>
            
            <input type="checkbox" class="absolute top-3 left-3 w-5 h-5 accent-brand-cyanDark z-10 cursor-pointer" value="${order.id}" onchange="toggleOrderSelection('${order.id}')" ${isChecked}>

            <div class="text-[10px] text-gray-400 mb-2 font-bold flex justify-between pr-6">
                <span><i class="fa-solid fa-clock"></i> ${order.orderDate || ''} - ${order.orderTime || ''}</span>
                <span class="text-brand-cyanDark">${order.batch ? 'دفعة: '+order.batch : ''}</span>
            </div>
            <div class="flex justify-between items-start mb-3 border-t pt-2">
                <div><div class="font-black text-brand-navy">${order.customerName}</div><a href="tel:${order.customerPhone}" class="text-sm font-bold text-blue-600 hover:underline" dir="ltr">${order.customerPhone}</a></div>
                <span class="px-2 py-1 rounded text-[10px] font-black border ${statusColor} ml-6">${statusText}</span>
            </div>
            <div class="text-[11px] text-gray-500 mb-3 font-bold bg-gray-50 p-2 rounded"><i class="fa-solid fa-location-dot text-brand-cyanDark mr-1"></i> ${order.zone} ${order.customerAddress && order.customerAddress !== 'غير محدد' ? ' - ' + order.customerAddress : ''}</div>
            <div class="bg-gray-50 border border-gray-100 p-2 rounded-lg mb-3 space-y-1">${itemsHtml}</div>
            <div class="bg-brand-light/20 p-3 rounded-xl border border-brand-cyan/10 text-xs font-bold space-y-1 mb-3">
                <div class="flex justify-between"><span>قيمة الطلبات:</span> <span>${order.subtotal || 0} ج.م</span></div>
                ${(order.discount && order.discount > 0) ? `<div class="flex justify-between text-red-500"><span>الخصم:</span> <span>-${order.discount} ج.م</span></div>` : ''}
                <div class="flex justify-between text-gray-500"><span>التوصيل:</span> <span>${order.deliveryFee || 0} ج.م</span></div>
                <div class="flex justify-between text-sm font-black text-brand-navy border-t border-brand-cyan/20 pt-2 mt-2"><span>الإجمالي:</span> <span class="text-brand-cyanDark text-lg">${order.total} <span class="text-[10px] text-gray-500">ج.م</span></span></div>
            </div>
            ${order.usedPromo ? `<div class="text-[10px] text-red-500 font-bold mb-1 bg-red-50 p-1.5 rounded"><i class="fa-solid fa-ticket"></i> استخدم كود: ${order.usedPromo}</div>` : ''}
            ${order.generatedPromo ? `<div class="text-[10px] text-green-600 font-bold mb-2 bg-green-50 p-1.5 rounded"><i class="fa-solid fa-gift"></i> السيستم طلعله كود: ${order.generatedPromo}</div>` : ''}
            <div class="flex gap-2 mt-3">
                ${order.status === 'new' ? `<button onclick="updateOrderStatus('${order.id}', 'processing', event)" class="flex-1 bg-yellow-500 hover:bg-yellow-600 text-white py-2 rounded-lg text-[11px] font-black shadow-sm">تجهيز</button>` : ''}
                ${order.status !== 'completed' ? `<button onclick="updateOrderStatus('${order.id}', 'completed', event)" class="flex-1 bg-green-500 hover:bg-green-600 text-white py-2 rounded-lg text-[11px] font-black shadow-sm">توصيل ✔️</button>` : ''}
            </div>
            <div class="flex gap-2 mt-2 pt-2 border-t">
                <button onclick="sendWhatsAppFromOrder('${order.customerPhone}', '${order.customerName}')" class="flex-1 bg-green-50 text-green-700 border border-green-200 py-1.5 rounded-lg text-[10px] font-black hover:bg-green-100"><i class="fa-brands fa-whatsapp"></i> راسله</button>
                <button onclick="quickGenerateCodeFromOrder('${order.customerPhone}')" class="flex-1 bg-purple-50 text-purple-700 border border-purple-200 py-1.5 rounded-lg text-[10px] font-black hover:bg-purple-100"><i class="fa-solid fa-wand-magic-sparkles"></i> كود هدية</button>
            </div>
        </div>`;
    });
    container.innerHTML = html; 
};

window.sendWhatsAppFromOrder = (phone, name) => {
    let msg = `أهلاً بك يا ${name} في سمان ههيا.. `;
    let waPhone = phone.startsWith('0') ? '2' + phone : phone;
    window.open(`https://api.whatsapp.com/send?phone=${waPhone}&text=${encodeURIComponent(msg)}`, '_blank');
};

window.quickGenerateCodeFromOrder = (phone) => {
    const prefix = document.getElementById('admin-auto-prefix')?.value || globalSettings.autoPromoPrefix || 'VIP-';
    const code = prefix + Math.floor(1000 + Math.random() * 9000);
    tempPromoCodes.push({ code: code, type: 'fixed', discount: 20, isAuto: true, usesLeft: 1, customerPhone: phone, minOrder: 0, maxDiscount: 0, expiryDate: '' });
    saveAdminData(); 
    let waPhone = phone.startsWith('0') ? '2' + phone : phone;
    let msg = `عميلنا المميز، خصيصاً لك كود خصم لطلبك القادم: ${code} 🎁`;
    window.open(`https://api.whatsapp.com/send?phone=${waPhone}&text=${encodeURIComponent(msg)}`, '_blank');
};

async function loadOrders() { 
    if(!hasCloud || !db) return; 
    try { 
        const container = document.getElementById('orders-list-container');
        if(container) container.innerHTML = '<div class="text-center py-10 text-gray-400"><i class="fa-solid fa-spinner fa-spin text-2xl mb-2"></i><p class="text-xs font-bold">جاري جلب الطلبات...</p></div>';
        const snap = await db.collection("orders").orderBy("createdAt","desc").get(); 
        ordersList=[]; snap.forEach(d=>ordersList.push({id:d.id, ...d.data()})); 
        renderOrdersList(); 
    } catch(e){ console.log("Error loading orders", e); } 
}

window.filterOrders = (f) => { 
    orderFilter=f; 
    selectedOrdersForDispatch=[]; 
    document.getElementById('dispatch-action-bar')?.classList.add('hidden'); 
    renderOrdersList(); 
};

window.updateOrderStatus = async (id, s, e) => { 
    if(db){ 
        // تأمين الـ Event Target وتمريره يدوياً لمنع الـ crash
        const btn = e ? e.target : (window.event ? window.event.target : null);
        let origText = btn ? btn.innerText : "..."; 
        if(btn) { btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; btn.disabled = true; }
        
        try {
            await db.collection("orders").doc(id).update({status:s}); 
            await loadOrders(); 
        } catch(err) {
            console.error(err);
            if(btn) { btn.innerText = origText; btn.disabled = false; }
        }
    } 
};

window.deleteAllOrders = async () => {
    if(!confirm("⚠️ تحذير: هل أنت متأكد من مسح جميع الطلبات من السجل؟ لا يمكن التراجع عن هذا الإجراء!")) return;
    const btn = document.querySelector('button[onclick*="deleteAllOrders"]'); 
    const originalHtml = btn ? btn.innerHTML : "مسح";
    if(btn) btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري المسح...';
    
    if(hasCloud && db) {
        try {
            const snap = await db.collection("orders").get();
            if(!snap.empty) { const batch = db.batch(); snap.docs.forEach(doc => batch.delete(doc.ref)); await batch.commit(); }
            if(btn) btn.innerHTML = originalHtml; 
            showAlert("تم المسح", "تم مسح جميع سجلات الطلبات بنجاح."); 
            loadOrders();
        } catch(e) { if(btn) btn.innerHTML = originalHtml; showAlert("خطأ", "حدث خطأ أثناء المسح."); }
    } else { 
        ordersList = []; renderOrdersList(); 
        if(btn) btn.innerHTML = originalHtml; 
        showAlert("تم بنجاح", "تم المسح محلياً."); 
    }
};

window.resetStatsOnly = async () => {
    if(!confirm("⚠️ تحذير: هل أنت متأكد من تصفير عدادات الإحصائيات (مبيعات اليوم والطلبات) لتبدأ من صفر؟")) return;
    const btn = document.querySelector('button[onclick*="resetStatsOnly"]'); 
    const originalHtml = btn ? btn.innerHTML : "تصفير";
    if(btn) btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري التصفير...';
    
    if(hasCloud && db) {
        try { 
            await db.collection("inventory").doc("stats").set({ sales: 0, orders: 0 }); 
            if(btn) btn.innerHTML = originalHtml; 
            showAlert("تم التصفير", "تم تصفير عدادات المبيعات بنجاح."); 
        } catch(e) { if(btn) btn.innerHTML = originalHtml; showAlert("خطأ", "حدث خطأ أثناء الاتصال بقاعدة البيانات."); }
    } else { 
        dailyStats = { sales: 0, orders: 0 }; 
        if(document.getElementById('stat-sales')) document.getElementById('stat-sales').innerText = 0; 
        if(document.getElementById('stat-orders')) document.getElementById('stat-orders').innerText = 0; 
        if(btn) btn.innerHTML = originalHtml; 
        showAlert("تم بنجاح", "تم التصفير محلياً."); 
    }
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
    if(linksContainer) {
        linksContainer.innerHTML = '<p class="text-xs font-black text-brand-navy mb-2 border-b pb-2"><i class="fa-solid fa-check-double text-green-500"></i> اضغط "إرسال" قدام كل رقم:</p>';
        const prefix = document.getElementById('admin-auto-prefix')?.value || globalSettings.autoPromoPrefix || 'VIP-';

        numbers.forEach(num => {
            const randomCode = prefix + Math.floor(1000 + Math.random() * 9000);
            tempPromoCodes.push({ code: randomCode, type: rewardType, discount: rewardValue, isAuto: true, usesLeft: 1, customerPhone: num, minOrder: 0, maxDiscount: 0, expiryDate: '' });
            const finalMessage = messageTemplate.replaceAll(/{الكود}/g, randomCode);
            let waNumber = num; if(waNumber.startsWith('0')) waNumber = '2' + waNumber; 
            const waLink = `https://api.whatsapp.com/send?phone=${waNumber}&text=${encodeURIComponent(finalMessage)}`;
            linksContainer.innerHTML += `<div class="flex justify-between items-center bg-white p-2 border border-gray-200 rounded-lg shadow-sm"><span class="text-xs font-bold text-gray-600" dir="ltr">${num}</span><a href="${waLink}" target="_blank" class="bg-green-500 hover:bg-green-600 text-white text-[10px] px-4 py-1.5 rounded font-black transition-colors flex items-center gap-1">إرسال <i class="fa-brands fa-whatsapp text-sm"></i></a></div>`;
        });
        renderAdminPromos(); 
        linksContainer.classList.remove('hidden'); 
        showAlert("تم التجهيز بنجاح 🎉", `تم إنشاء أكواد لـ ${numbers.length} عميل. \n\n⚠️ مهم جداً: انزل تحت في لوحة التحكم ودوس "حفظ جميع التعديلات".`);
    }
};

window.saveAdminData = async () => {
    syncAdminProductsFromDOM(); 
    let newUiTexts = {}; 
    textsConfig.forEach(t => { const el = document.getElementById(`ui-txt-${t.id}`); if(el) newUiTexts[t.id] = el.value.trim(); });

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
        bestSellers: globalSettings.bestSellers || [],
        showPromoField: document.getElementById('admin-show-promo-field')?.checked ?? true, 
        successTitle: document.getElementById('admin-success-title')?.value.trim() || '', 
        successMessage: document.getElementById('admin-success-message')?.value.trim() || '', 
        productsData: tempProducts,
        whatsappTemplate: document.getElementById('admin-whatsapp-template')?.value.trim() || '',
        ticktickTemplate: document.getElementById('admin-ticktick-template')?.value.trim() || '', 
        vipWhatsappTemplate: document.getElementById('admin-vip-whatsapp-template')?.value.trim() || '', 
        batchHashtag: document.getElementById('admin-batch-hashtag')?.value.trim() || '', 
        uiTexts: newUiTexts,
        autoPromoPrefix: document.getElementById('admin-auto-prefix')?.value.trim() || 'VIP-', 
        autoPromoModalMsg: document.getElementById('admin-auto-msg')?.value.trim() || 'تم إصدار كود خصم خاص بك لطلبك القادم 🎁',
        closedMessage: document.getElementById('admin-closed-msg')?.value.trim() || 'المتجر مغلق حالياً، نعود قريباً!', 
        crossSellTitle: document.getElementById('admin-crosssell-title')?.value.trim() || 'جربت منتجاتنا التكميلية؟', 
        crossSellDesc: document.getElementById('admin-crosssell-desc')?.value.trim() || '',
        driverTemplate: document.getElementById('admin-driver-template')?.value.trim() || '📦 *طلب جديد للتوصيل*\n👤 {اسم_العميل} - {الموبايل}\n📍 {المنطقة} - {العنوان}\n🛒 الطلبات:\n{الطلبات}\n💰 الإجمالي للتحصيل: *{الاجمالي} ج.م* (منهم {التوصيل} رسوم توصيل)\n-------------------'
    };

    const btn = document.querySelector('#admin-dashboard-modal button[onclick*="saveAdminData"]'); 
    const originalHtml = btn ? btn.innerHTML : "حفظ"; 
    if(btn) btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-xl"></i> جاري الحفظ...';
    
    if(hasCloud && db) {
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
            const iconContainer = document.getElementById('alert-icon-container');
            const alertIcon = document.getElementById('alert-icon');
            if(iconContainer) iconContainer.className = "w-16 h-16 bg-green-100 text-green-500 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl"; 
            if(alertIcon) alertIcon.className = "fa-solid fa-check"; 
            showAlert("تم بنجاح", "تم حفظ التعديلات! الواجهة هتتحدث تلقائياً."); 
            setTimeout(() => { if(typeof window.applySettingsToUI === 'function') window.applySettingsToUI(); }, 1000); 
        } catch(e) { if(btn) btn.innerHTML = originalHtml; showAlert("خطأ", "حدث خطأ أثناء الحفظ. تحقق من اتصالك بالإنترنت."); }
    } else { 
        Object.assign(globalSettings, newSettings); 
        productsInfo = tempProducts; 
        globalDeliveryZones = newSettings.deliveryZones; 
        closeAdminDashboard(); 
        if(btn) btn.innerHTML = originalHtml; 
        if(typeof window.applySettingsToUI === 'function') window.applySettingsToUI(); 
        if(typeof renderDeliveryZones === 'function') renderDeliveryZones(); 
        const container = document.getElementById('products-container'); 
        if(container) container.innerHTML = `<div class="text-center py-10 text-brand-cyanDark"><i class="fa-solid fa-spinner fa-spin text-3xl mb-3"></i><p class="font-bold text-sm">جاري التحديث...</p></div>`; 
        setTimeout(() => { if(typeof renderProducts === 'function') renderProducts(); }, 500); 
        if(typeof updateUI === 'function') updateUI(); 
        showAlert("تم محلياً", "تم الحفظ مؤقتاً لأن المتصفح غير متصل بقاعدة البيانات."); 
    }
};
