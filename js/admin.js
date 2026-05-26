// js/admin.js

document.getElementById('admin-store-open')?.addEventListener('change', function() {
    const label = document.getElementById('store-open-label');
    label.innerText = this.checked ? 'مفتوح' : 'مغلق';
    label.className = this.checked ? 'mr-3 text-sm font-black text-green-600 w-12' : 'mr-3 text-sm font-black text-red-600 w-12';
});

window.openAdminLogin = () => { document.getElementById('admin-login-modal').classList.remove('hidden'); setTimeout(()=>document.getElementById('admin-login-modal').classList.remove('opacity-0'),10); document.getElementById('admin-password-input').value=''; };
window.closeAdminLogin = () => { document.getElementById('admin-login-modal').classList.add('opacity-0'); setTimeout(()=>document.getElementById('admin-login-modal').classList.add('hidden'),300); };

window.verifyAdminPin = () => { 
    const email = document.getElementById('admin-email-input').value.trim();
    const pass = document.getElementById('admin-password-input').value.trim();
    const btn = document.querySelector('#admin-login-modal button[onclick="verifyAdminPin()"]');
    const origHtml = btn.innerHTML;
    
    if(!email || !pass) { showAlert("تنبيه", "يرجى كتابة البريد الإلكتروني وكلمة المرور."); return; }

    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري التحقق...';
    btn.disabled = true;

    firebase.auth().signInWithEmailAndPassword(email, pass)
        .then((userCredential) => {
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

let currentAdminTab = 'stats'; let ordersList = []; let orderFilter = 'all';

window.switchAdminTab = (tab) => {
    currentAdminTab = tab;
    ['stats','store','products','orders','delivery','marketing','advanced','texts'].forEach(t => {
        document.getElementById('admin-panel-'+t)?.classList.add('hidden');
        const btn = document.getElementById('admin-tab-'+t);
        if(btn) btn.className = t===tab ? "px-4 py-2 rounded-lg font-bold text-sm bg-brand-cyanDark text-white whitespace-nowrap" : "px-4 py-2 rounded-lg font-bold text-sm text-gray-600 hover:bg-gray-100 whitespace-nowrap";
    });
    document.getElementById('admin-panel-'+tab)?.classList.remove('hidden');
    if(tab==='orders') loadOrders(); if(tab==='products') renderAdminProducts();
    if(tab==='stats') renderTopProductsStats();
};

window.openAdminDashboard = () => {
    const storeToggle = document.getElementById('admin-store-open');
    storeToggle.checked = globalSettings.storeOpen !== false;
    const storeOpenLabel = document.getElementById('store-open-label');
    storeOpenLabel.innerText = storeToggle.checked ? 'مفتوح' : 'مغلق';
    storeOpenLabel.className = storeToggle.checked ? 'mr-3 text-sm font-black text-green-600 w-12' : 'mr-3 text-sm font-black text-red-600 w-12';

    document.getElementById('admin-store-name').value = globalSettings.storeName || ''; document.getElementById('admin-store-desc').value = globalSettings.storeDesc || ''; document.getElementById('admin-store-phone').value = globalSettings.storePhone || ''; document.getElementById('admin-min-order').value = globalSettings.minOrder || 0;
    document.getElementById('admin-free-delivery-active').checked = globalSettings.freeDeliveryActive; document.getElementById('admin-free-delivery-threshold').value = globalSettings.freeDeliveryThreshold || 0; tempAdminZones = JSON.parse(JSON.stringify(globalDeliveryZones||[])); renderAdminZones();
    document.getElementById('admin-reward-active').checked = globalSettings.rewardActive; document.getElementById('admin-reward-type').value = globalSettings.rewardType || 'fixed'; document.getElementById('admin-reward-value').value = globalSettings.rewardValue || 0; document.getElementById('admin-reward-max-generations').value = globalSettings.rewardMaxGenerations || 0; document.getElementById('admin-banner-active').checked = globalSettings.bannerActive; document.getElementById('admin-banner-text').value = globalSettings.bannerText || ''; document.getElementById('admin-crosssell-active').checked = globalSettings.crossSellActive; const csSelect = document.getElementById('admin-crosssell-product'); csSelect.innerHTML=''; Object.keys(productsInfo).forEach(id => csSelect.innerHTML += `<option value="${id}" ${globalSettings.crossSellProductId===id?'selected':''}>${productsInfo[id].name}</option>`); tempPromoCodes = JSON.parse(JSON.stringify(globalSettings.promoCodes||[])); renderAdminPromos();
    document.getElementById('admin-show-promo-field').checked = globalSettings.showPromoField !== false;
    document.getElementById('admin-success-title').value = globalSettings.successTitle || ''; document.getElementById('admin-success-message').value = globalSettings.successMessage || ''; 
    
    document.getElementById('admin-old-customer-label').value = globalSettings.oldCustomerLabel || 'عميل سابق';
    document.getElementById('admin-whatsapp-template').value = globalSettings.whatsappTemplate || 'السلام عليكم، أريد تأكيد حجزي:\n\n📋 *بيانات العميل:*\n{تفاصيل_العميل}\n\n🛒 *الطلبات:*\n{الطلبات}\n{الخصم}═════════════════\n📦 قيمة الطلبات: {قيمة_الطلبات} ج.م\n🚚 رسوم التوصيل: {التوصيل}\n💰 *الإجمالي النهائي: {الاجمالي} ج.م*\n\n(في انتظار تأكيد الحجز وموعد الاستلام)';
    
    document.getElementById('admin-batch-hashtag').value = globalSettings.batchHashtag || '';
    document.getElementById('admin-vip-whatsapp-template').value = globalSettings.vipWhatsappTemplate || 'السلام عليكم،\nأريد الانضمام لقائمة الـ VIP وحجز ({اسم_المنتج}) من الدفعة القادمة قبل نزولها المتجر. 👑';
    document.getElementById('admin-ticktick-template').value = globalSettings.ticktickTemplate || '🧾 **تفاصيل الأوردر كاملة:**\n👤 الاسم: {اسم_العميل}\n📱 الموبايل: {الموبايل}\n📍 المنطقة: {المنطقة}\n{العنوان}\n🕒 الوقت: {الوقت}\n--------------------------------\n🛒 الطلبات:\n{تفاصيل_الطلبات}\n--------------------------------\n📦 قيمة الطلبات: {قيمة_الطلبات} ج.م\n{الخصم}🚚 رسوم التوصيل: {التوصيل}\n💰 الإجمالي النهائي: {الاجمالي} ج.م\n{ملاحظات}\n{الهاشتاجات}';

    // حقن حقول إعدادات الأكواد في تبويب التسويق
    if(!document.getElementById('admin-auto-prefix')) {
        const marketingDiv = document.querySelector('#admin-panel-marketing > div.border-l-green-500');
        if(marketingDiv) {
            marketingDiv.insertAdjacentHTML('beforeend', `
            <div class="mt-4 pt-3 border-t border-green-100">
                <label class="text-[10px] font-bold text-gray-500 block mb-1">اسم/بادئة الكود (مثال: VIP أو GIFT)</label>
                <input type="text" id="admin-auto-prefix" class="w-full border rounded p-2 mb-2 font-bold text-brand-navy" dir="ltr" style="text-align: right;">
                <label class="text-[10px] font-bold text-gray-500 block mb-1">رسالة التهنئة للكود (تظهر للعميل كرسالة منبثقة)</label>
                <textarea id="admin-auto-msg" rows="2" class="w-full border rounded p-2 font-bold text-brand-navy text-xs"></textarea>
            </div>`);
        }
    }
    document.getElementById('admin-auto-prefix').value = globalSettings.autoPromoPrefix || 'VIP-';
    document.getElementById('admin-auto-msg').value = globalSettings.autoPromoModalMsg || 'تم إصدار كود خصم خاص بك لطلبك القادم 🎁';

    const textsCont = document.getElementById('admin-texts-container');
    if(textsCont) {
        textsCont.innerHTML = '';
        textsConfig.forEach(t => {
            const val = (globalSettings.uiTexts && globalSettings.uiTexts[t.id]) ? globalSettings.uiTexts[t.id] : t.default;
            textsCont.innerHTML += `<div><label class="text-[10px] font-bold text-gray-500 block mb-1">${t.label}</label><input type="text" id="ui-txt-${t.id}" value="${val}" class="w-full border rounded p-2 text-xs font-bold text-brand-navy outline-none focus:border-brand-cyan"></div>`;
        });
    }

    tempProducts = JSON.parse(JSON.stringify(productsInfo));
    renderAdminProducts(); 
    document.getElementById('admin-dashboard-modal').classList.remove('hidden'); setTimeout(()=>document.getElementById('admin-dashboard-modal').classList.remove('opacity-0'),10); switchAdminTab('stats');
};

window.closeAdminDashboard = () => { document.getElementById('admin-dashboard-modal').classList.add('opacity-0'); setTimeout(()=>document.getElementById('admin-dashboard-modal').classList.add('hidden'),300); };

window.renderTopProductsStats = () => {
    const c = document.getElementById('top-products-list'); if(!c) return;
    if(globalSettings.bestSellers && globalSettings.bestSellers.length > 0) { c.innerHTML = globalSettings.bestSellers.map(id => { const p = productsInfo[id]; return p ? `<div class="flex justify-between items-center bg-gray-50 p-2 rounded border"><span class="font-bold text-brand-navy">${p.name}</span><span class="text-[10px] bg-brand-yellow text-brand-navy px-2 py-0.5 rounded-full font-black">🔥 الأكثر مبيعاً</span></div>` : ''; }).join(''); } 
    else { c.innerHTML = '<div class="text-xs text-gray-400">لم تقم بتحديد منتجات كأكثر مبيعاً من قائمة المنتجات.</div>'; }
}

window.moveProduct = (id, direction) => {
    syncAdminProductsFromDOM(); const keys = Object.keys(tempProducts); const idx = keys.indexOf(id);
    if (direction === 'up' && idx > 0) { [keys[idx], keys[idx - 1]] = [keys[idx - 1], keys[idx]]; } else if (direction === 'down' && idx < keys.length - 1) { [keys[idx], keys[idx + 1]] = [keys[idx + 1], keys[idx]]; } else { return; }
    const newObj = {}; keys.forEach(k => newObj[k] = tempProducts[k]); tempProducts = newObj; renderAdminProducts();
};

// --- [تحسين الأداء] ريندر المنتجات من الذاكرة دفعة واحدة ---
window.renderAdminProducts = () => {
    const container = document.getElementById('admin-inputs-container'); 
    let html = ''; // تخزين في الذاكرة لتسريع الريندر
    Object.keys(tempProducts).forEach(id => {
        const p = tempProducts[id]; const stock = globalStock[id] || 0; const price = globalPrices[id] || p.basePrice; const oldPrice = globalOldPrices[id] || price; const isDisc = globalDiscounts[id] || false; const isBest = globalSettings.bestSellers?.includes(id) || false;
        const imgSrc = (p.images && p.images.length > 0) ? p.images[0] : '';
        html += `<div class="bg-white border border-gray-200 rounded-xl p-3 shadow-sm mb-3">
            <div class="flex justify-between items-center cursor-pointer" onclick="document.getElementById('edit-p-${id}').classList.toggle('hidden')">
                <div class="font-black text-brand-navy flex items-center gap-2"><div class="flex flex-col gap-1 ml-1 mr-[-5px]"><button onclick="event.stopPropagation(); moveProduct('${id}', 'up')" class="text-gray-400 hover:text-brand-cyanDark text-[12px] bg-gray-100 rounded w-5 h-5 flex justify-center items-center"><i class="fa-solid fa-chevron-up"></i></button><button onclick="event.stopPropagation(); moveProduct('${id}', 'down')" class="text-gray-400 hover:text-brand-cyanDark text-[12px] bg-gray-100 rounded w-5 h-5 flex justify-center items-center"><i class="fa-solid fa-chevron-down"></i></button></div><img src="${imgSrc}" class="w-8 h-8 rounded object-cover" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\'><rect width=\\'100%\\' height=\\'100%\\' fill=\\'%23f1f5f9\\'/></svg>'"> ${p.name}</div>
                <div class="text-xs bg-gray-50 border px-2 py-1 rounded font-bold text-gray-600">تعديل <i class="fa-solid fa-chevron-down"></i></div>
            </div>
            <div id="edit-p-${id}" class="hidden mt-4 space-y-3 border-t pt-3">
                <div class="grid grid-cols-2 gap-2">
                    <div><label class="text-[10px] font-bold text-gray-500">الاسم</label><input type="text" id="p-name-${id}" value="${p.name}" class="w-full border p-2 rounded text-xs font-bold text-brand-navy outline-none focus:border-brand-cyan"></div>
                    <div><label class="text-[10px] font-bold text-gray-500">الوزن / الوصف</label><input type="text" id="p-weight-${id}" value="${p.weight}" class="w-full border p-2 rounded text-xs font-bold text-brand-navy outline-none focus:border-brand-cyan"></div>
                    <div><label class="text-[10px] font-bold text-gray-500">السعر (ج)</label><input type="number" id="p-price-${id}" value="${price}" class="w-full border p-2 rounded text-xs font-bold text-brand-cyanDark outline-none focus:border-brand-cyan"></div>
                    <div><label class="text-[10px] font-bold text-gray-500">المخزون المتوفر</label><input type="number" id="p-stock-${id}" value="${stock}" class="w-full border p-2 rounded text-xs font-black outline-none focus:border-brand-cyan ${stock<5?'border-red-500 bg-red-50 text-red-600':'text-brand-navy'}"></div>
                    <div class="col-span-2"><label class="text-[10px] font-bold text-gray-500">رابط الصورة</label><input type="text" id="p-img-${id}" value="${imgSrc}" class="w-full border p-2 rounded text-[10px] font-bold text-gray-500 outline-none focus:border-brand-cyan" dir="ltr" style="text-align: left;"></div>
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
    container.innerHTML = html; // رسم مرة واحدة
};

window.addNewAdminProduct = () => { const newId = 'p_' + Date.now(); tempProducts[newId] = { name: "منتج جديد", basePrice: 0, weight: "1 طبق", images: [""], isExtra: false }; globalStock[newId] = 0; globalPrices[newId] = 0; globalOldPrices[newId] = 0; globalDiscounts[newId] = false; renderAdminProducts(); setTimeout(()=>document.getElementById(`edit-p-${newId}`)?.classList.remove('hidden'), 100); };
window.deleteAdminProduct = (id) => { if(!confirm('هل أنت متأكد من حذف هذا المنتج تماماً من المتجر؟')) return; delete tempProducts[id]; delete globalStock[id]; delete globalPrices[id]; delete globalOldPrices[id]; delete globalDiscounts[id]; renderAdminProducts(); };
window.syncAdminProductsFromDOM = () => {
    if(!document.getElementById('admin-inputs-container') || document.getElementById('admin-inputs-container').innerHTML === '') return; let newBest = [];
    Object.keys(tempProducts).forEach(id => {
        if(!document.getElementById(`p-name-${id}`)) return; 
        tempProducts[id].name = document.getElementById(`p-name-${id}`).value; tempProducts[id].weight = document.getElementById(`p-weight-${id}`).value; tempProducts[id].images = [document.getElementById(`p-img-${id}`).value]; tempProducts[id].isExtra = document.getElementById(`p-extra-${id}`).checked;
        globalPrices[id] = parseInt(document.getElementById(`p-price-${id}`).value) || 0; globalStock[id] = parseInt(document.getElementById(`p-stock-${id}`).value) || 0; globalOldPrices[id] = parseInt(document.getElementById(`p-old-${id}`).value) || 0; globalDiscounts[id] = document.getElementById(`p-disc-${id}`).checked; if(document.getElementById(`p-best-${id}`).checked) newBest.push(id);
    });
    globalSettings.bestSellers = newBest;
};

window.renderAdminZones = () => { const c=document.getElementById('admin-zones-container'); c.innerHTML=''; tempAdminZones.forEach((z,i) => c.innerHTML += `<div class="flex gap-2 items-center"><input type="text" value="${z.name}" class="flex-1 border rounded p-2 text-sm font-bold text-brand-navy outline-none focus:border-brand-cyan" onchange="tempAdminZones[${i}].name=this.value"><input type="number" value="${z.price}" class="w-16 border rounded p-2 text-sm text-center font-bold text-brand-cyanDark outline-none focus:border-brand-cyan" onchange="tempAdminZones[${i}].price=parseInt(this.value)"><button onclick="tempAdminZones.splice(${i},1);renderAdminZones()" class="text-red-500 hover:bg-red-50 rounded w-8 h-8 transition-colors"><i class="fa-solid fa-trash"></i></button></div>`); };
window.addNewAdminZone = () => { tempAdminZones.push({id:'z_'+Date.now(), name:'', price:0}); renderAdminZones(); };

// --- [تحسين الأداء] ريندر الأكواد من الذاكرة دفعة واحدة ومع ميزة البحث ---
window.renderAdminPromos = () => { 
    const c = document.getElementById('admin-promos-container'); 
    
    if(!document.getElementById('promo-search-bar')) {
        const searchHtml = `<input type="text" id="promo-search-bar" placeholder="🔍 ابحث برقم الموبايل أو الكود..." class="w-full border-2 border-gray-200 rounded-xl p-3 mb-4 font-bold text-brand-navy outline-none focus:border-brand-cyan" onkeyup="renderAdminPromos()">`;
        c.insertAdjacentHTML('beforebegin', searchHtml);
    }
    
    const query = document.getElementById('promo-search-bar')?.value.toLowerCase() || '';
    let filteredPromos = tempPromoCodes;
    if(query) { filteredPromos = tempPromoCodes.filter(p => p.code.toLowerCase().includes(query) || (p.customerPhone && p.customerPhone.includes(query))); }

    if(filteredPromos.length === 0) { c.innerHTML = '<p class="text-center text-gray-400 text-xs font-bold">لا يوجد أكواد مسجلة</p>'; return; }

    let html = ''; // تخزين لتسريع الإدارة
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
    c.innerHTML = html; // رسم مرة واحدة
};

window.addNewPromoCode = () => { 
    tempPromoCodes.push({ code: '', discount: 0, type: 'fixed', usesLeft: null, minOrder: 0, maxDiscount: 0, expiryDate: '', customerPhone: '' }); 
    renderAdminPromos(); 
};

// --- [تحسين الأداء] ريندر الطلبات من الذاكرة دفعة واحدة ومع البحث والتفاصيل الجديدة ---
window.renderOrdersList = () => {
    const container = document.getElementById('orders-list-container');
    if(!container) return;
    
    let filtered = ordersList;
    if(orderFilter !== 'all') filtered = ordersList.filter(o => o.status === orderFilter);

    let searchQuery = document.getElementById('order-search')?.value.toLowerCase() || '';
    if (searchQuery) { filtered = filtered.filter(o => o.customerName.toLowerCase().includes(searchQuery) || o.customerPhone.includes(searchQuery)); }

    if(filtered.length === 0) { container.innerHTML = '<p class="text-center text-gray-500 py-8 font-bold text-sm bg-gray-50 rounded-xl border border-dashed">لا توجد طلبات</p>'; return; }

    let html = ''; // تخزين لتسريع الإدارة
    filtered.forEach(order => {
        let statusColor = order.status === 'new' ? 'bg-red-100 text-red-700 border-red-200' : (order.status === 'processing' ? 'bg-yellow-100 text-yellow-700 border-yellow-200' : 'bg-green-100 text-green-700 border-green-200');
        let statusText = order.status === 'new' ? 'جديد' : (order.status === 'processing' ? 'قيد التجهيز' : 'مكتمل');
        let itemsHtml = order.items.map(i => `<div class="flex justify-between text-xs text-gray-700 font-bold border-b border-gray-100 pb-1 mb-1 last:border-0 last:pb-0 last:mb-0"><span><span class="text-brand-cyanDark">${i.quantity}x</span> ${i.name}</span><span>${i.quantity*i.price} ج</span></div>`).join('');

        html += `
        <div class="bg-white border rounded-xl p-4 shadow-sm relative overflow-hidden">
            <div class="absolute top-0 right-0 w-1 h-full ${order.status === 'new' ? 'bg-red-500' : (order.status === 'processing' ? 'bg-yellow-500' : 'bg-green-500')}"></div>
            <div class="text-[10px] text-gray-400 mb-2 font-bold flex justify-between">
                <span><i class="fa-solid fa-clock"></i> ${order.orderDate || ''} - ${order.orderTime || ''}</span>
                <span class="text-brand-cyanDark">${order.batch ? 'دفعة: '+order.batch : ''}</span>
            </div>
            <div class="flex justify-between items-start mb-3 border-t pt-2">
                <div><div class="font-black text-brand-navy">${order.customerName}</div><a href="tel:${order.customerPhone}" class="text-sm font-bold text-blue-600 hover:underline" dir="ltr">${order.customerPhone}</a></div>
                <span class="px-2 py-1 rounded text-[10px] font-black border ${statusColor}">${statusText}</span>
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
                ${order.status === 'new' ? `<button onclick="updateOrderStatus('${order.id}', 'processing')" class="flex-1 bg-yellow-500 hover:bg-yellow-600 text-white py-2 rounded-lg text-[11px] font-black shadow-sm">تجهيز</button>` : ''}
                ${order.status !== 'completed' ? `<button onclick="updateOrderStatus('${order.id}', 'completed')" class="flex-1 bg-green-500 hover:bg-green-600 text-white py-2 rounded-lg text-[11px] font-black shadow-sm">توصيل ✔️</button>` : ''}
            </div>
            <div class="flex gap-2 mt-2 pt-2 border-t">
                <button onclick="sendWhatsAppFromOrder('${order.customerPhone}', '${order.customerName}')" class="flex-1 bg-green-50 text-green-700 border border-green-200 py-1.5 rounded-lg text-[10px] font-black hover:bg-green-100"><i class="fa-brands fa-whatsapp"></i> راسله</button>
                <button onclick="quickGenerateCodeFromOrder('${order.customerPhone}')" class="flex-1 bg-purple-50 text-purple-700 border border-purple-200 py-1.5 rounded-lg text-[10px] font-black hover:bg-purple-100"><i class="fa-solid fa-wand-magic-sparkles"></i> كود هدية</button>
            </div>
        </div>`;
    });
    container.innerHTML = html; // رسم مرة واحدة
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
    saveAdminData(); // الحفظ الفوري
    let waPhone = phone.startsWith('0') ? '2' + phone : phone;
    let msg = `عميلنا المميز، خصيصاً لك كود خصم لطلبك القادم: ${code} 🎁`;
    window.open(`https://api.whatsapp.com/send?phone=${waPhone}&text=${encodeURIComponent(msg)}`, '_blank');
};

async function loadOrders() { 
    if(!hasCloud || !db) return; 
    try { 
        document.getElementById('orders-list-container').innerHTML = '<div class="text-center py-10 text-gray-400"><i class="fa-solid fa-spinner fa-spin text-2xl mb-2"></i><p class="text-xs font-bold">جاري جلب الطلبات...</p></div>';
        const snap = await db.collection("orders").orderBy("createdAt","desc").get(); 
        ordersList=[]; snap.forEach(d=>ordersList.push({id:d.id, ...d.data()})); renderOrdersList(); 
    } catch(e){ console.log("Error loading orders", e); } 
}

window.filterOrders = (f) => { orderFilter=f; renderOrdersList(); };
window.updateOrderStatus = async (id, s) => { if(db){ const btn = event.target; const origText = btn.innerText; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; btn.disabled = true; await db.collection("orders").doc(id).update({status:s}); loadOrders(); } };

window.deleteAllOrders = async () => {
    if(!confirm("⚠️ تحذير: هل أنت متأكد من مسح جميع الطلبات من السجل؟ لا يمكن التراجع عن هذا الإجراء!")) return;
    const btn = document.querySelector('button[onclick="deleteAllOrders()"]'); const originalHtml = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري المسح...';
    if(hasCloud && db) {
        try {
            const snap = await db.collection("orders").get();
            if(!snap.empty) { const batch = db.batch(); snap.docs.forEach(doc => batch.delete(doc.ref)); await batch.commit(); }
            btn.innerHTML = originalHtml; showAlert("تم المسح", "تم مسح جميع سجلات الطلبات بنجاح."); loadOrders();
        } catch(e) { btn.innerHTML = originalHtml; showAlert("خطأ", "حدث خطأ أثناء المسح."); }
    } else { ordersList = []; renderOrdersList(); btn.innerHTML = originalHtml; showAlert("تم بنجاح", "تم المسح محلياً."); }
};

window.resetStatsOnly = async () => {
    if(!confirm("⚠️ تحذير: هل أنت متأكد من تصفير عدادات الإحصائيات (مبيعات اليوم والطلبات) لتبدأ من صفر؟")) return;
    const btn = document.querySelector('button[onclick="resetStatsOnly()"]'); const originalHtml = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري التصفير...';
    if(hasCloud && db) {
        try { await db.collection("inventory").doc("stats").set({ sales: 0, orders: 0 }); btn.innerHTML = originalHtml; showAlert("تم التصفير", "تم تصفير عدادات المبيعات بنجاح."); } catch(e) { btn.innerHTML = originalHtml; showAlert("خطأ", "حدث خطأ أثناء الاتصال بقاعدة البيانات."); }
    } else { dailyStats = { sales: 0, orders: 0 }; document.getElementById('stat-sales').innerText = 0; document.getElementById('stat-orders').innerText = 0; btn.innerHTML = originalHtml; showAlert("تم بنجاح", "تم التصفير محلياً."); }
};

window.generateBulkWhatsAppLinks = () => {
    const numbersRaw = document.getElementById('admin-bulk-numbers').value.trim(); const messageTemplate = document.getElementById('admin-bulk-message').value.trim() || "شكراً لثقتك! كود الخصم بتاعك: {الكود}"; const rewardType = document.getElementById('admin-bulk-reward-type').value; const rewardValue = parseInt(document.getElementById('admin-bulk-reward-value').value) || 0;
    if(!numbersRaw) { showAlert("تنبيه", "يرجى إدخال أرقام الموبايلات أولاً"); return; }
    const numbers = numbersRaw.split('\n').map(n => n.trim()).filter(n => n.length >= 10);
    if(numbers.length === 0) { showAlert("تنبيه", "لم يتم العثور على أرقام صحيحة"); return; }

    const linksContainer = document.getElementById('bulk-whatsapp-links');
    linksContainer.innerHTML = '<p class="text-xs font-black text-brand-navy mb-2 border-b pb-2"><i class="fa-solid fa-check-double text-green-500"></i> اضغط "إرسال" قدام كل رقم:</p>';
    
    const prefix = document.getElementById('admin-auto-prefix')?.value || globalSettings.autoPromoPrefix || 'VIP-';

    numbers.forEach(num => {
        const randomCode = prefix + Math.floor(1000 + Math.random() * 9000);
        tempPromoCodes.push({ code: randomCode, type: rewardType, discount: rewardValue, isAuto: true, usesLeft: 1, customerPhone: num, minOrder: 0, maxDiscount: 0, expiryDate: '' });
        const finalMessage = messageTemplate.replace(/{الكود}/g, randomCode);
        let waNumber = num; if(waNumber.startsWith('0')) waNumber = '2' + waNumber; 
        const waLink = `https://api.whatsapp.com/send?phone=${waNumber}&text=${encodeURIComponent(finalMessage)}`;
        linksContainer.innerHTML += `<div class="flex justify-between items-center bg-white p-2 border border-gray-200 rounded-lg shadow-sm"><span class="text-xs font-bold text-gray-600" dir="ltr">${num}</span><a href="${waLink}" target="_blank" class="bg-green-500 hover:bg-green-600 text-white text-[10px] px-4 py-1.5 rounded font-black transition-colors flex items-center gap-1">إرسال <i class="fa-brands fa-whatsapp text-sm"></i></a></div>`;
    });
    renderAdminPromos(); linksContainer.classList.remove('hidden'); showAlert("تم التجهيز بنجاح 🎉", `تم إنشاء أكواد لـ ${numbers.length} عميل. \n\n⚠️ مهم جداً: انزل تحت في لوحة التحكم ودوس "حفظ جميع التعديلات".`);
};

window.saveAdminData = async () => {
    syncAdminProductsFromDOM(); 
    let newUiTexts = {}; textsConfig.forEach(t => { const el = document.getElementById(`ui-txt-${t.id}`); if(el) newUiTexts[t.id] = el.value.trim(); });

    const newSettings = {
        storeOpen: document.getElementById('admin-store-open').checked, storeName: document.getElementById('admin-store-name').value.trim() || 'المتجر', storeDesc: document.getElementById('admin-store-desc').value.trim(), storePhone: document.getElementById('admin-store-phone').value.trim(), minOrder: parseInt(document.getElementById('admin-min-order').value) || 0,
        freeDeliveryActive: document.getElementById('admin-free-delivery-active').checked, freeDeliveryThreshold: parseInt(document.getElementById('admin-free-delivery-threshold').value) || 0, deliveryZones: tempAdminZones.filter(z=>z.name.trim()),
        rewardActive: document.getElementById('admin-reward-active').checked, rewardType: document.getElementById('admin-reward-type').value, rewardValue: parseInt(document.getElementById('admin-reward-value').value) || 0, rewardMaxGenerations: parseInt(document.getElementById('admin-reward-max-generations').value) || 0,
        bannerActive: document.getElementById('admin-banner-active').checked, bannerText: document.getElementById('admin-banner-text').value.trim(), crossSellActive: document.getElementById('admin-crosssell-active').checked, crossSellProductId: document.getElementById('admin-crosssell-product').value, promoCodes: tempPromoCodes.filter(p=>p.code.trim()), bestSellers: globalSettings.bestSellers,
        showPromoField: document.getElementById('admin-show-promo-field').checked, successTitle: document.getElementById('admin-success-title').value.trim(), successMessage: document.getElementById('admin-success-message').value.trim(), productsData: tempProducts,
        oldCustomerLabel: document.getElementById('admin-old-customer-label').value.trim() || 'عميل سابق', whatsappTemplate: document.getElementById('admin-whatsapp-template').value.trim() || 'السلام عليكم، أريد تأكيد حجزي:\n\n📋 *بيانات العميل:*\n{تفاصيل_العميل}\n\n🛒 *الطلبات:*\n{الطلبات}\n{الخصم}═════════════════\n📦 قيمة الطلبات: {قيمة_الطلبات} ج.م\n🚚 رسوم التوصيل: {التوصيل}\n💰 *الإجمالي النهائي: {الاجمالي} ج.م*\n\n(في انتظار تأكيد الحجز وموعد الاستلام)',
        ticktickTemplate: document.getElementById('admin-ticktick-template').value.trim(), vipWhatsappTemplate: document.getElementById('admin-vip-whatsapp-template').value.trim(), batchHashtag: document.getElementById('admin-batch-hashtag').value.trim(), uiTexts: newUiTexts,
        autoPromoPrefix: document.getElementById('admin-auto-prefix')?.value.trim() || 'VIP-', autoPromoModalMsg: document.getElementById('admin-auto-msg')?.value.trim() || 'تم إصدار كود خصم خاص بك لطلبك القادم 🎁'
    };

    const btn = document.querySelector('#admin-dashboard-modal button[onclick="saveAdminData()"]'); const originalHtml = btn.innerHTML; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-xl"></i> جاري الحفظ...';
    if(hasCloud && db) {
        try {
            await Promise.all([ db.collection("inventory").doc("settings").set(newSettings), db.collection("inventory").doc("stock").set(globalStock), db.collection("inventory").doc("prices").set(globalPrices), db.collection("inventory").doc("old_prices").set(globalOldPrices), db.collection("inventory").doc("discounts_status").set(globalDiscounts) ]);
            btn.innerHTML = originalHtml; closeAdminDashboard(); document.getElementById('alert-icon-container').className = "w-16 h-16 bg-green-100 text-green-500 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl"; document.getElementById('alert-icon').className = "fa-solid fa-check"; showAlert("تم بنجاح", "تم حفظ جميع التعديلات بنجاح.");
        } catch(e) { btn.innerHTML = originalHtml; showAlert("خطأ", "حدث خطأ أثناء الحفظ. تحقق من اتصالك بالإنترنت."); }
    } else { Object.assign(globalSettings, newSettings); productsInfo = tempProducts; globalDeliveryZones = newSettings.deliveryZones; closeAdminDashboard(); btn.innerHTML = originalHtml; applySettingsToUI(); renderDeliveryZones(); const container = document.getElementById('products-container'); if(container) container.innerHTML = `<div class="text-center py-10 text-brand-cyanDark"><i class="fa-solid fa-spinner fa-spin text-3xl mb-3"></i><p class="font-bold text-sm">جاري التحديث...</p></div>`; setTimeout(() => renderProducts(), 500); updateUI(); showAlert("تم محلياً", "تم الحفظ مؤقتاً لأن المتصفح غير متصل بقاعدة البيانات."); }
};
