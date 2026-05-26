// js/app.js

function saveCart() { try { localStorage.setItem('sman_cart', JSON.stringify(cart)); } catch(e) {} }

function loadCart() { 
    try { const savedCart = localStorage.getItem('sman_cart'); if (savedCart) { cart = JSON.parse(savedCart); } updateUI(); } 
    catch (e) { cart = {}; localStorage.removeItem('sman_cart'); } 
}

function getAvailableStock(id) { 
    if(!productsInfo[id]) return 0; const inCart = cart[id]?.quantity || 0; return Math.max(0, (globalStock[id] || 0) - inCart); 
}

function applyUITexts() {
    const t = globalSettings.uiTexts || {}; const getT = (id) => t[id] || textsConfig.find(x => x.id === id).default;
    const setTxt = (elId, val) => { const el = document.getElementById(elId); if(el) el.innerText = val; };
    setTxt('lbl-cart-total', getT('cartTotalLabel')); setTxt('lbl-view-cart', getT('viewCartBtn')); setTxt('lbl-checkout-title', getT('checkoutTitle')); setTxt('lbl-tab-new', getT('tabNewCust')); setTxt('lbl-tab-old', getT('tabOldCust')); setTxt('lbl-zone-label', getT('zoneLabel')); setTxt('lbl-name-label', getT('nameLabel')); setTxt('lbl-phone-label', getT('phoneLabel')); setTxt('lbl-address-label', getT('addressLabel')); setTxt('lbl-old-msg', getT('oldCustMsg')); setTxt('lbl-old-phone-label', getT('oldPhoneLabel')); setTxt('lbl-wa-check', getT('whatsappCheck')); setTxt('lbl-promo-btn', getT('promoBtn')); setTxt('lbl-subtotal', getT('subtotalLabel')); setTxt('lbl-delivery', getT('deliveryLabel')); setTxt('lbl-final-total', getT('finalTotalLabel')); setTxt('lbl-menu-title', getT('menuTitle')); setTxt('lbl-extras-title', getT('extrasTitle'));
}

function applySettingsToUI() {
    const banner = document.getElementById('top-banner');
    if (globalSettings.bannerActive && globalSettings.bannerText && globalSettings.bannerText.trim() !== '') { document.getElementById('top-banner-text').innerText = globalSettings.bannerText; banner.classList.remove('hidden'); } else { banner.classList.add('hidden'); }
    document.getElementById('header-store-name').innerText = globalSettings.storeName || ''; document.getElementById('header-store-desc').innerText = globalSettings.storeDesc || ''; document.getElementById('footer-store-name').innerText = globalSettings.storeName || '';
    const phoneStr = globalSettings.storePhone || "01208027294"; document.getElementById('footer-phone').innerText = phoneStr; document.getElementById('footer-phone-link').href = `tel:${phoneStr}`;
    const wrapper = document.getElementById('store-wrapper'); const msg = document.getElementById('store-closed-msg'); const mainCartBtn = document.getElementById('main-cart-btn');
    const isOpen = globalSettings.storeOpen !== false; 
    if(!isOpen) { wrapper.classList.add('store-closed-overlay'); if(msg) msg.classList.remove('hidden'); if(mainCartBtn) mainCartBtn.disabled = true; } 
    else { wrapper.classList.remove('store-closed-overlay'); if(msg) msg.classList.add('hidden'); if(mainCartBtn) mainCartBtn.disabled = false; }
    const minWarn = document.getElementById('min-order-warning');
    if (globalSettings.minOrder > 0) { document.getElementById('min-order-value').innerText = globalSettings.minOrder; minWarn.classList.remove('hidden'); } else { minWarn.classList.add('hidden'); }
    const promoContainer = document.getElementById('promo-input-container');
    if(promoContainer) { if(globalSettings.showPromoField !== false) promoContainer.classList.remove('hidden'); else { promoContainer.classList.add('hidden'); if(appliedPromo && !appliedPromo.isLoyalty) appliedPromo = null; } }
    applyUITexts();
}

function renderDeliveryZones() {
    const select = document.getElementById('delivery-zone'); if (!select) return;
    const currentVal = select.value; select.innerHTML = '<option value="" disabled selected>اختر منطقتك لحساب الشحن...</option>';
    globalDeliveryZones.forEach(zone => {
        const option = document.createElement('option'); option.value = zone.id;
        option.textContent = zone.price === 0 ? `${zone.name} (يحدد لاحقاً)` : `${zone.name} (${zone.price} جنيه)`; select.appendChild(option);
    });
    if (currentVal && globalDeliveryZones.find(z => z.id === currentVal)) select.value = currentVal;
}

document.addEventListener('DOMContentLoaded', () => { 
    renderDeliveryZones(); loadCart(); setupEventListeners(); initFirebase(); 
    setTimeout(() => { if(!isStoreDataLoaded) { isStoreDataLoaded = true; Object.keys(productsInfo).forEach(id => { if(globalStock[id] === undefined) globalStock[id] = 0; if(globalPrices[id] === undefined) globalPrices[id] = productsInfo[id].basePrice; }); renderProducts(); applySettingsToUI(); } }, 3000);
});

window.setupEventListeners = function() {
    const ids = ['customer-name', 'customer-phone'];
    ids.forEach(id => { const el = document.getElementById(id); if(el) el.addEventListener('input', updateUI); });
    if (document.getElementById('delivery-zone')) document.getElementById('delivery-zone').addEventListener('change', updateUI);
    document.getElementById('promo-code-input')?.addEventListener('input', () => { if (appliedPromo && !appliedPromo.isLoyalty && document.getElementById('promo-code-input').value.trim() === '') { appliedPromo = null; document.getElementById('promo-message').classList.add('hidden'); updateUI(); } });
}

function initFirebase() {
    const firebaseConfig = { apiKey: "AIzaSyD7ZJP8n8fhMewPfEsTBANn0h9To_q15BY", authDomain: "sman-ca8f8.firebaseapp.com", projectId: "sman-ca8f8", storageBucket: "sman-ca8f8.firebasestorage.app", messagingSenderId: "538778803310", appId: "1:538778803310:web:5eeff42bae534375a21a7f" };
    try { firebase.initializeApp(firebaseConfig); db = firebase.firestore(); firebase.auth().signInAnonymously().catch(() => {}); firebase.auth().onAuthStateChanged(user => { if(user) { hasCloud = true; listenToDatabase(); } }); } catch (e) { console.log("Firebase Error"); }
}

function listenToDatabase() {
    if(!db) return;
    db.collection('inventory').doc('settings').onSnapshot(doc => { 
        if(doc.exists) { 
            const data = doc.data(); if(data.productsData) productsInfo = data.productsData; Object.assign(globalSettings, data); 
            if(globalSettings.storeOpen === undefined) globalSettings.storeOpen = true; if(!globalSettings.promoCodes) globalSettings.promoCodes = []; if(!globalSettings.bestSellers) globalSettings.bestSellers = []; if(globalSettings.rewardMaxGenerations === undefined) globalSettings.rewardMaxGenerations = 0; if(!globalSettings.uiTexts) globalSettings.uiTexts = {};
            if(data.deliveryZones) globalDeliveryZones = data.deliveryZones; applySettingsToUI(); renderDeliveryZones(); updateUI(); 
        } 
    });
    db.collection('inventory').doc('prices').onSnapshot(doc => { if(doc.exists) { Object.assign(globalPrices, doc.data()); } });
    db.collection('inventory').doc('discounts_status').onSnapshot(doc => { if(doc.exists) { Object.assign(globalDiscounts, doc.data()); } });
    db.collection('inventory').doc('old_prices').onSnapshot(doc => { if(doc.exists) { Object.assign(globalOldPrices, doc.data()); } });
    db.collection('inventory').doc('stock').onSnapshot(doc => { if(doc.exists) { Object.assign(globalStock, doc.data()); if(!isStoreDataLoaded) { isStoreDataLoaded = true; renderProducts(); } else requestAnimationFrame(() => renderProducts()); updateUI(); } });
    db.collection('inventory').doc('stats').onSnapshot(doc => { if(doc.exists) { dailyStats = doc.data(); if(document.getElementById('stat-sales')) document.getElementById('stat-sales').innerText = dailyStats.sales || 0; if(document.getElementById('stat-orders')) document.getElementById('stat-orders').innerText = dailyStats.orders || 0; } });
}

window.applyPromoCode = function() {
    const input = document.getElementById('promo-code-input').value.trim().toUpperCase(); const msg = document.getElementById('promo-message'); if (input === '') return;
    let subTotal = 0; for (let id in cart) subTotal += cart[id].quantity * (globalPrices[id] || productsInfo[id].basePrice);
    const promo = (globalSettings.promoCodes || []).find(p => p.code.toUpperCase() === input);
    
    if (!promo) { msg.innerText = "كود غير صحيح."; msg.className = "text-[11px] font-bold mt-1 text-red-500"; msg.classList.remove('hidden'); return; }
    if (promo.usesLeft !== null && promo.usesLeft !== undefined && promo.usesLeft <= 0) { msg.innerText = "عفواً، انتهى الحد الأقصى لاستخدام هذا الكود."; msg.className = "text-[11px] font-bold mt-1 text-red-500"; msg.classList.remove('hidden'); return; }
    if (promo.expiryDate && new Date(promo.expiryDate) < new Date(new Date().toDateString())) { msg.innerText = "عفواً، هذا الكود منتهي الصلاحية."; msg.className = "text-[11px] font-bold mt-1 text-red-500"; msg.classList.remove('hidden'); return; }
    if (promo.minOrder && subTotal < promo.minOrder) { msg.innerText = `عشان تفعل الكود ده، لازم طلباتك تتخطى ${promo.minOrder} ج.م`; msg.className = "text-[11px] font-bold mt-1 text-red-500"; msg.classList.remove('hidden'); return; }
    
    appliedPromo = { ...promo, isLoyalty: false }; msg.innerText = "تم تفعيل كود الخصم بنجاح 🎉"; msg.className = "text-[11px] font-bold mt-1 text-green-600"; msg.classList.remove('hidden'); updateUI();
};

window.getCardActionHTML = function(id) {
    const t = globalSettings.uiTexts || {}; const txtClosed = t.closedBtn || "مغلق"; const txtVip = t.vipBtn || "حجز للدفعة القادمة"; const txtAdd = t.addBtn || "إضافة للسلة";
    if (globalSettings.storeOpen === false) return `<div class="w-full bg-gray-100 text-gray-400 font-bold py-2 rounded-xl text-sm border border-gray-200 text-center cursor-not-allowed">${txtClosed}</div>`;
    const inCart = cart[id]?.quantity || 0; const available = getAvailableStock(id);
    if (available === 0 && inCart === 0) return `<div onclick="openVipPreOrder('${id}')" class="w-full bg-gradient-to-r from-brand-yellow to-yellow-500 text-brand-navy hover:from-yellow-500 hover:to-yellow-600 font-black py-2 rounded-xl transition-all shadow-sm text-xs flex justify-center items-center gap-1 cursor-pointer select-none border border-yellow-400 transform hover:scale-105"><i class="fa-solid fa-crown"></i> ${txtVip}</div>`;
    if (inCart > 0) return `<div class="flex items-center justify-between bg-brand-light/50 border border-brand-cyan/40 rounded-xl p-1 h-[40px]"><div onclick="updateQuantity('${id}', 1)" class="w-9 h-full bg-white text-brand-cyanDark rounded-lg shadow-sm font-black text-xl flex items-center justify-center cursor-pointer select-none">+</div><span class="font-black text-brand-navy text-lg min-w-[28px] text-center select-none">${inCart}</span><div onclick="updateQuantity('${id}', -1)" class="w-9 h-full bg-white text-red-500 rounded-lg shadow-sm font-black text-2xl flex items-center justify-center cursor-pointer select-none pb-1">-</div></div>`;
    return `<div onclick="addToCart('${id}')" class="w-full bg-brand-cyanDark text-white hover:bg-brand-navy font-black py-2 rounded-xl transition-colors shadow-sm text-sm flex justify-center items-center gap-2 cursor-pointer select-none"><i class="fa-solid fa-plus"></i> ${txtAdd}</div>`;
}

window.openVipPreOrder = function(id) {
    const item = productsInfo[id];
    const msgHTML = `<div class="text-5xl mb-3">👑</div><div class="font-black text-brand-navy mb-2 text-xl">نفدت الكمية حالياً!</div><div class="text-sm text-gray-600 font-bold mb-4 leading-relaxed bg-brand-light/30 p-3 rounded-xl border border-brand-cyan/20">أنا مقدر جداً إنك بتفضل <strong>(${item.name})</strong>.<br>الدفعة الجديدة هتكون جاهزة قريب جداً.<br><br>تحب أسجلك معايا في <strong>(قائمة حجز الـ VIP)</strong> وأأكدلك أوردرك من دلوقتي قبل ما ينزلوا المتجر؟</div><div onclick="sendVipWhatsApp('${item.name}')" class="w-full bg-green-500 hover:bg-green-600 text-white font-black py-3 px-4 rounded-xl transition-colors flex justify-center items-center gap-2 shadow-lg mb-2 cursor-pointer"><i class="fa-brands fa-whatsapp text-xl"></i> تأكيد الحجز المسبق عبر واتساب</div>`;
    document.getElementById('alert-icon-container').classList.add('hidden'); document.getElementById('alert-title').classList.add('hidden'); document.getElementById('alert-message').innerHTML = msgHTML;
    const alertBtn = document.querySelector('#alert-box button'); if(alertBtn) { alertBtn.className = "text-gray-400 hover:text-gray-600 font-bold py-2 text-sm transition-colors underline w-full bg-transparent border-0"; alertBtn.innerHTML = 'لا شكراً، هشوف حاجة تانية'; }
    const md = document.getElementById('alert-modal'); md.classList.remove('hidden'); setTimeout(()=>md.classList.remove('opacity-0'),10);
};

window.sendVipWhatsApp = function(itemName) { const phone = globalSettings.storePhone || "01208027294"; let template = globalSettings.vipWhatsappTemplate || "السلام عليكم،\nأريد الانضمام لقائمة الـ VIP وحجز ({اسم_المنتج}) من الدفعة القادمة قبل نزولها المتجر. 👑"; const message = template.replace(/{اسم_المنتج}/g, itemName); window.location.href = `https://api.whatsapp.com/send?phone=20${phone}&text=${encodeURIComponent(message)}`; closeAlert(); };

window.renderProducts = function() {
    if(!isStoreDataLoaded) return; const container = document.getElementById('products-container'); const extrasContainer = document.getElementById('extras-container'); if(!container || !extrasContainer) return;
    container.innerHTML = ''; extrasContainer.innerHTML = ''; let mainProductsCount = 0;
    Object.keys(productsInfo).forEach(id => {
        const item = productsInfo[id]; const available = getAvailableStock(id); const currentPrice = globalPrices[id] || item.basePrice; const oldPrice = globalOldPrices[id]; const isDiscountActive = globalDiscounts[id]; const isBestSeller = globalSettings.bestSellers && globalSettings.bestSellers.includes(id); const stockBadgeClass = available <= 10 ? (available === 0 ? 'bg-red-50 text-red-600' : 'bg-orange-50 text-orange-600') : 'bg-green-50 text-green-700';
        let priceHtml = ''; let saleBadgeHtml = '';
        if (isDiscountActive) { saleBadgeHtml = `<div class="absolute top-4 left-4 bg-red-500 text-white text-[10px] font-black px-3 py-1 rounded-full shadow-lg sale-badge z-10"><i class="fa-solid fa-tag"></i> عرض</div>`; priceHtml = `<div class="flex flex-col"><span class="text-[11px] text-gray-400 line-through decoration-red-500 font-bold">${oldPrice} ج.م</span><span class="font-black text-red-600 text-xl"><span id="price-display-${id}">${currentPrice}</span> <span class="text-[10px] text-gray-500">ج.م</span></span></div>`; } else priceHtml = `<span class="font-black text-brand-cyanDark text-lg"><span id="price-display-${id}">${currentPrice}</span> <span class="text-[10px] text-gray-400">ج.م</span></span>`;
        let bestSellerHtml = isBestSeller ? `<div class="absolute bottom-2 right-2 bg-brand-navy text-brand-yellow text-[10px] font-black px-2 py-1 rounded shadow z-10 border border-brand-yellow/30">الأكثر طلباً 🔥</div>` : ''; const imgSrc = (item.images && item.images.length > 0) ? item.images[0] : '';
        if (!item.isExtra) { mainProductsCount++; container.innerHTML += `<div class="bg-white rounded-2xl shadow-sm border ${isDiscountActive ? 'border-red-200' : 'border-gray-200'} overflow-hidden flex flex-row h-[130px] relative">${saleBadgeHtml}<div class="p-3 flex-1 flex flex-col justify-between bg-white min-w-0"><div><h3 class="text-sm md:text-base font-black text-brand-navy truncate mb-1">${item.name}</h3><div class="flex items-center justify-between gap-2 mb-1">${priceHtml}<span class="bg-gray-50 text-gray-500 text-[10px] px-1.5 py-0.5 rounded border border-gray-200 font-bold whitespace-nowrap"><i class="fa-solid fa-scale-balanced mr-1"></i> ${item.weight}</span></div></div><div class="flex items-center justify-between mt-auto"><div class="text-[10px] font-bold px-1.5 py-0.5 rounded border ${stockBadgeClass} shrink-0">المتاح: <span id="stock-display-${id}">${available}</span></div><div class="w-28 shrink-0" id="card-action-${id}">${window.getCardActionHTML(id)}</div></div></div><div class="w-32 shrink-0 relative bg-gray-100 border-r border-gray-100">${bestSellerHtml}<img loading="lazy" src="${imgSrc}" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\'><rect width=\\'100%\\' height=\\'100%\\' fill=\\'%23f1f5f9\\'/></svg>'" class="w-full h-full object-cover"></div></div>`; } 
        else { let extraPriceHtml = isDiscountActive ? `<div class="flex gap-2 items-center"><span class="text-red-600 font-black text-sm"><span id="price-display-${id}">${currentPrice}</span> ج</span><span class="text-[10px] text-gray-400 line-through">${oldPrice}</span></div>` : `<div class="text-brand-cyanDark font-black text-sm"><span id="price-display-${id}">${currentPrice}</span> ج</div>`; extrasContainer.innerHTML += `<div class="bg-white rounded-2xl shadow-sm border ${isDiscountActive ? 'border-red-300' : 'border-gray-200'} overflow-hidden flex flex-row items-center p-2.5 gap-3 h-[90px] relative">${isDiscountActive ? `<div class="absolute top-1 right-1 bg-red-500 w-2 h-2 rounded-full sale-badge"></div>` : ''}<div class="flex-1 min-w-0"><h4 class="font-black text-brand-navy text-xs sm:text-sm truncate">${item.name}</h4>${extraPriceHtml}<div class="text-[10px] font-bold px-1.5 py-0.5 rounded inline-flex border ${stockBadgeClass} shrink-0 mt-1">المتاح: <span id="stock-display-${id}">${available}</span></div></div><div class="w-28 shrink-0" id="card-action-${id}">${window.getCardActionHTML(id)}</div><div class="w-16 h-16 sm:w-20 sm:h-20 shrink-0 relative overflow-hidden rounded-xl border border-gray-100">${bestSellerHtml}<img loading="lazy" src="${imgSrc}" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\'><rect width=\\'100%\\' height=\\'100%\\' fill=\\'%23f8fafc\\'/></svg>'" class="w-full h-full object-cover"></div></div>`; }
    });
    if(mainProductsCount === 0) container.innerHTML = `<div class="text-center py-10 text-gray-400 font-bold">${globalSettings.uiTexts?.emptyMenuMsg || "لا توجد منتجات حالياً"}</div>`;
};

window.addToCart = function(id) { if (globalSettings.storeOpen === false) return; if (getAvailableStock(id) <= 0) { showAlert("عذراً", "الكمية المتاحة لا تكفي حالياً."); return; } if (cart[id]) cart[id].quantity++; else cart[id] = { quantity: 1, price: globalPrices[id] || productsInfo[id].basePrice, name: productsInfo[id].name }; saveCart(); updateUI(); requestAnimationFrame(() => renderProducts()); };
window.updateQuantity = function(id, delta) { if (!cart[id] || globalSettings.storeOpen === false) return; if (delta === 1) { if (getAvailableStock(id) > 0) cart[id].quantity++; else showAlert("عذراً", "لا يوجد مخزون إضافي متاح."); } else if (delta === -1) { cart[id].quantity--; if (cart[id].quantity <= 0) delete cart[id]; } saveCart(); updateUI(); requestAnimationFrame(() => renderProducts()); };

// --- دوال الحركة بين الخطوتين ---
window.goToCheckoutStep2 = function() {
    document.getElementById('checkout-step-1').classList.add('hidden');
    document.getElementById('checkout-step-2').classList.remove('hidden');
    document.getElementById('btn-back-step').classList.remove('hidden');
    document.getElementById('lbl-checkout-title').innerText = "بيانات التوصيل";
    updateUI(); // تأكيد المراجعة بعد النقلة
};

window.backToCart = function() {
    document.getElementById('checkout-step-2').classList.add('hidden');
    document.getElementById('checkout-step-1').classList.remove('hidden');
    document.getElementById('btn-back-step').classList.add('hidden');
    document.getElementById('lbl-checkout-title').innerText = "سلة المشتريات";
    updateUI(); // تأكيد المراجعة
};

// --- الدالة الذكية لتحديث الواجهة ومراقبة الأزرار ---
window.updateUI = function() {
    let totalItems = 0, subTotalPrice = 0; const cartItemsContainer = document.getElementById('cart-items'); if(cartItemsContainer) cartItemsContainer.innerHTML = '';
    for (let id in cart) {
        if (!productsInfo[id]) { delete cart[id]; saveCart(); continue; }
        cart[id].price = globalPrices[id] || productsInfo[id].basePrice; const item = cart[id]; totalItems += item.quantity; subTotalPrice += item.quantity * item.price;
        if(cartItemsContainer) cartItemsContainer.innerHTML += `<div class="bg-white p-3 rounded-xl border border-gray-100 flex justify-between items-center shadow-sm"><div class="flex-1"><h4 class="font-bold text-brand-navy text-xs mb-1">${item.name}</h4><div class="text-brand-cyanDark font-black text-sm">${item.price} ج.م</div></div><div class="flex items-center gap-2 bg-gray-50 rounded-lg p-1 border border-gray-200 h-[36px]"><div onclick="updateQuantity('${id}', 1)" class="w-8 h-full bg-white text-brand-navy rounded shadow-sm font-black text-lg flex items-center justify-center cursor-pointer select-none">+</div><span class="font-black text-brand-navy min-w-[24px] text-center text-sm">${item.quantity}</span><div onclick="updateQuantity('${id}', -1)" class="w-8 h-full bg-white text-red-500 rounded shadow-sm font-black text-xl flex items-center justify-center pb-1 cursor-pointer select-none">-</div></div></div>`;
    }

    const bottomBar = document.getElementById('bottom-cart-bar');
    if(bottomBar) { document.getElementById('bottom-cart-total').innerText = subTotalPrice; document.getElementById('bottom-cart-count').innerText = totalItems; if (totalItems > 0) bottomBar.classList.remove('translate-y-full'); else { bottomBar.classList.add('translate-y-full'); if(cartItemsContainer) cartItemsContainer.innerHTML = `<div class="flex flex-col items-center justify-center py-10 text-gray-400 gap-3"><i class="fa-solid fa-basket-shopping text-5xl text-gray-200"></i><p class="font-bold text-sm">${globalSettings.uiTexts?.emptyCartMsg || "السلة فارغة"}</p></div>`; } }

    let freeDelivery = (globalSettings.freeDeliveryActive && subTotalPrice >= (globalSettings.freeDeliveryThreshold||0) && totalItems > 0);
    const tracker = document.getElementById('free-delivery-tracker');
    if (globalSettings.freeDeliveryActive && totalItems > 0) { tracker.classList.remove('hidden'); let remaining = Math.max(0, (globalSettings.freeDeliveryThreshold||0) - subTotalPrice); document.getElementById('fd-progress').style.width = Math.min(100, (subTotalPrice / (globalSettings.freeDeliveryThreshold||1)) * 100) + '%'; const textContainer = document.getElementById('free-delivery-text'); if (remaining > 0) { textContainer.innerHTML = `<span class="text-gray-600">باقي <span class="text-brand-cyanDark font-black text-sm">${remaining}</span> ج وتاخد توصيل مجاني!</span><i class="fa-solid fa-gift text-brand-cyanDark text-lg"></i>`; document.getElementById('fd-progress').className = "bg-gradient-to-l from-brand-cyan to-brand-cyanDark h-2.5 rounded-full progress-bar-animated"; } else { textContainer.innerHTML = `<span class="text-green-600 font-black">مبروك! التوصيل مجاني 🎉</span><i class="fa-solid fa-check-circle text-green-500 text-lg"></i>`; document.getElementById('fd-progress').className = "bg-green-500 h-2.5 rounded-full progress-bar-animated"; } } else tracker.classList.add('hidden');

    let discountAmount = 0; const promoRow = document.getElementById('promo-discount-row');
    if (appliedPromo && totalItems > 0) {
        if (appliedPromo.minOrder && subTotalPrice < appliedPromo.minOrder) {
            appliedPromo = null; const msg = document.getElementById('promo-message'); if(msg) { msg.innerText = "تم إلغاء الخصم لأن الطلبات قلت عن الحد الأدنى للكود."; msg.className = "text-[11px] font-bold mt-1 text-red-500"; msg.classList.remove('hidden'); } if(document.getElementById('promo-code-input')) document.getElementById('promo-code-input').value = '';
        } else {
            if(appliedPromo.type === 'free_delivery') { freeDelivery = true; discountAmount = 0; document.getElementById('promo-label').innerText = appliedPromo.code + " (توصيل مجاني)"; document.getElementById('cart-discount').innerText = "0"; } 
            else { discountAmount = appliedPromo.type === 'percent' ? (subTotalPrice * (appliedPromo.discount / 100)) : appliedPromo.discount; if (appliedPromo.type === 'percent' && appliedPromo.maxDiscount > 0) { discountAmount = Math.min(discountAmount, appliedPromo.maxDiscount); } discountAmount = Math.round(Math.min(discountAmount, subTotalPrice)); document.getElementById('promo-label').innerText = appliedPromo.code; document.getElementById('cart-discount').innerText = discountAmount; }
        }
        if(appliedPromo) promoRow.classList.remove('hidden'); else promoRow.classList.add('hidden');
    } else { promoRow.classList.add('hidden'); }

    const totalAfterPromo = subTotalPrice - discountAmount; const deliverySelect = document.getElementById('delivery-zone'); const selectedZone = globalDeliveryZones.find(z => z.id === deliverySelect?.value); const deliveryFee = selectedZone ? selectedZone.price : 0; const finalDelivery = freeDelivery ? 0 : deliveryFee; const finalTotal = totalAfterPromo + finalDelivery;

    if(document.getElementById('cart-subtotal')) document.getElementById('cart-subtotal').innerText = subTotalPrice;
    if(document.getElementById('cart-step1-total')) document.getElementById('cart-step1-total').innerText = totalAfterPromo;
    if(document.getElementById('cart-delivery-fee')) { if (freeDelivery) document.getElementById('cart-delivery-fee').innerHTML = `<span class="text-green-600 font-black">مجاني 🎉</span>`; else document.getElementById('cart-delivery-fee').innerText = (selectedZone && selectedZone.price === 0) ? "يحدد لاحقاً" : `${finalDelivery} ج.م`; }
    if(document.getElementById('cart-total')) document.getElementById('cart-total').innerText = Math.round(finalTotal);

    // --- مراقبة الأزرار في الخطوتين ---
    const proceedBtn = document.getElementById('btn-proceed-checkout');
    const checkoutBtn = document.getElementById('checkout-btn'); 
    const checkoutHintStep1 = document.getElementById('checkout-hint'); 
    const checkoutHintStep2 = document.getElementById('checkout-hint-step2'); 
    const meetsMinOrder = subTotalPrice >= (globalSettings.minOrder || 0);

    if (proceedBtn) {
        if (totalItems > 0 && meetsMinOrder) { proceedBtn.disabled = false; if(checkoutHintStep1) checkoutHintStep1.classList.add('hidden'); }
        else { proceedBtn.disabled = true; if(totalItems > 0 && !meetsMinOrder && checkoutHintStep1) { checkoutHintStep1.innerText = `الحد الأدنى للطلب ${globalSettings.minOrder} ج.م`; checkoutHintStep1.classList.remove('hidden'); } }
    }

    if (checkoutBtn && checkoutHintStep2) {
        let validForm = false;
        const nameVal = document.getElementById('customer-name')?.value.trim();
        const phoneVal = document.getElementById('customer-phone')?.value.trim();
        
        if (totalItems > 0 && deliverySelect && deliverySelect.value !== "" && meetsMinOrder) {
            if (nameVal && nameVal.length >= 3 && phoneVal && phoneVal.length >= 10) validForm = true;
        }
        checkoutBtn.disabled = !validForm;
        
        if(!validForm && totalItems > 0) { checkoutHintStep2.classList.remove('hidden'); } 
        else { checkoutHintStep2.classList.add('hidden'); }
    }
};

window.toggleCart = function() { 
    const sidebar = document.getElementById('cart-sidebar'); const overlay = document.getElementById('cart-overlay'); 
    if(!sidebar || !overlay) return; 
    if (sidebar.classList.contains('translate-x-full')) { 
        sidebar.classList.remove('translate-x-full'); overlay.classList.remove('hidden'); setTimeout(() => overlay.classList.remove('opacity-0'), 10); document.body.style.overflow = 'hidden'; 
        backToCart(); // يفتح دايماً على الخطوة الأولى
    } 
    else { sidebar.classList.add('translate-x-full'); overlay.classList.add('opacity-0'); setTimeout(() => overlay.classList.add('hidden'), 300); document.body.style.overflow = ''; } 
};

window.initiateCheckout = function() {
    if (globalSettings.crossSellActive && globalSettings.crossSellProductId && productsInfo[globalSettings.crossSellProductId] && !cart[globalSettings.crossSellProductId] && getAvailableStock(globalSettings.crossSellProductId) > 0) {
        const item = productsInfo[globalSettings.crossSellProductId]; document.getElementById('cross-sell-title').innerText = `جرب ${item.name}؟`; document.getElementById('cross-sell-price').innerText = globalPrices[globalSettings.crossSellProductId] || item.basePrice; document.getElementById('cross-sell-img').src = (item.images && item.images.length>0) ? item.images[0] : '';
        const modal = document.getElementById('cross-sell-modal'); const box = document.getElementById('cross-sell-box'); modal.classList.remove('hidden'); setTimeout(() => { modal.classList.remove('opacity-0'); box.classList.remove('scale-95'); box.classList.add('scale-100'); }, 10);
    } else finalCheckoutStep();
};

window.acceptCrossSell = function() { addToCart(globalSettings.crossSellProductId); const m = document.getElementById('cross-sell-modal'); m.classList.add('opacity-0'); setTimeout(() => { m.classList.add('hidden'); finalCheckoutStep(); }, 300); };
window.declineCrossSell = function() { const m = document.getElementById('cross-sell-modal'); m.classList.add('opacity-0'); setTimeout(() => { m.classList.add('hidden'); finalCheckoutStep(); }, 300); };

window.finalCheckoutStep = async function() {
    const checkoutBtn = document.getElementById('checkout-btn'); const originalBtnHtml = checkoutBtn.innerHTML;
    checkoutBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-2xl"></i> جاري تسجيل الطلب...'; checkoutBtn.disabled = true;

    const deliverySelect = document.getElementById('delivery-zone');
    const selectedZone = globalDeliveryZones.find(z => z.id === deliverySelect.value);
    const zoneName = selectedZone ? selectedZone.name : 'غير محدد'; const deliveryFee = selectedZone ? selectedZone.price : 0;
    
    let customerName = document.getElementById('customer-name').value.trim(); 
    let customerPhone = document.getElementById('customer-phone').value.trim(); 
    let customerAddress = document.getElementById('customer-address').value.trim();
    const wantsWhatsApp = true; 

    if (customerName.length < 3 || !/^[\u0600-\u06FF\sA-Za-z]+$/.test(customerName)) { showAlert("تنبيه", "يرجى كتابة اسم صحيح وخالي من الأرقام والرموز."); checkoutBtn.innerHTML = originalBtnHtml; checkoutBtn.disabled = false; return; }

    if (appliedPromo && appliedPromo.customerPhone) {
        let phoneToMatch = appliedPromo.customerPhone.replace(/\D/g, '').slice(-10); let userPhone = customerPhone.replace(/\D/g, '').slice(-10);
        if (phoneToMatch !== userPhone && phoneToMatch !== '') { showAlert("تنبيه", "عفواً، كود الخصم هذا مخصص لرقم هاتف آخر ولا يمكنك استخدامه."); checkoutBtn.innerHTML = originalBtnHtml; checkoutBtn.disabled = false; return; }
    }

    for (let id in cart) {
        if(!productsInfo[id]) continue;
        if (cart[id].quantity > globalStock[id]) { showAlert("تنبيه", `المنتج ${productsInfo[id].name} لم يعد متوفر بهذه الكمية، لقد تم حجزه بواسطة عميل آخر للتو.`); cart[id].quantity = globalStock[id]; if(cart[id].quantity === 0) delete cart[id]; saveCart(); updateUI(); renderProducts(); checkoutBtn.innerHTML = originalBtnHtml; checkoutBtn.disabled = false; return; }
    }

    const orderDate = new Date().toLocaleDateString('ar-EG'); const orderTime = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
    let subTotal = 0; let itemsSummaryArray = []; let smartTagsArray = ["#طلب_مباشر"];
    if (globalSettings.batchHashtag) { let cleanHashtag = globalSettings.batchHashtag.trim(); if (!cleanHashtag.startsWith('#')) cleanHashtag = '#' + cleanHashtag; smartTagsArray.push(cleanHashtag.replace(/\s+/g, '_')); }
    
    let customerDetailsStr = `👤 الاسم: ${customerName}\n📱 الموبايل: ${customerPhone}\n📍 المنطقة: ${zoneName}\n${customerAddress?`🏠 العنوان: ${customerAddress}\n`:''}`;
    customerDetailsStr += `🕒 الوقت: ${orderDate} - ${orderTime}`;

    let itemsStr = "";
    for (let id in cart) {
        if(!productsInfo[id]) continue;
        const item = cart[id]; const itemTotal = item.quantity * item.price; subTotal += itemTotal;
        let shortName = item.name.replace('طبق ', '').split(' (')[0]; itemsSummaryArray.push(`${item.quantity} ${shortName}`);
        let tagName = "#" + shortName.replace(/ /g, '_'); if(!smartTagsArray.includes(tagName)) smartTagsArray.push(tagName);
        itemsStr += `▪️ ${item.name}\n  └ ${item.quantity} × ${item.price} = ${itemTotal} ج.م\n`;
    }

    let discountAmount = 0; let discountTextTemplate = "";
    if (appliedPromo) {
        if(appliedPromo.type === 'free_delivery') { discountTextTemplate = `🎁 ${appliedPromo.code}: توصيل مجاني\n`; } 
        else { discountAmount = appliedPromo.type === 'percent' ? (subTotal * (appliedPromo.discount / 100)) : appliedPromo.discount; if (appliedPromo.type === 'percent' && appliedPromo.maxDiscount > 0) { discountAmount = Math.min(discountAmount, appliedPromo.maxDiscount); } discountAmount = Math.round(Math.min(discountAmount, subTotal)); discountTextTemplate = `🎁 كود (${appliedPromo.code}): -${discountAmount} ج\n`; }
    }

    const totalAfterPromo = subTotal - discountAmount;
    let freeDelivery = (globalSettings.freeDeliveryActive && totalAfterPromo >= (globalSettings.freeDeliveryThreshold||0)) || (appliedPromo && appliedPromo.type === 'free_delivery');
    const finalDelivery = freeDelivery ? 0 : deliveryFee; const finalTotal = totalAfterPromo + finalDelivery;
    let deliveryText = freeDelivery ? "مجاني 🎉" : ((deliveryFee === 0 && zoneName === 'مكان آخر') ? "يحدد لاحقاً" : `${deliveryFee} ج.م`);

    let template = globalSettings.whatsappTemplate || "السلام عليكم، أريد تأكيد حجزي:\n\n📋 *بيانات العميل:*\n{تفاصيل_العميل}\n\n🛒 *الطلبات:*\n{الطلبات}\n{الخصم}═════════════════\n📦 قيمة الطلبات: {قيمة_الطلبات} ج.م\n🚚 رسوم التوصيل: {التوصيل}\n💰 *الإجمالي النهائي: {الاجمالي} ج.م*\n\n(في انتظار تأكيد الحجز وموعد الاستلام)";
    let message = template.replace('{تفاصيل_العميل}', customerDetailsStr).replace('{الطلبات}', itemsStr.trim()).replace('{الخصم}', discountTextTemplate ? discountTextTemplate + '\n' : '').replace('{قيمة_الطلبات}', subTotal).replace('{التوصيل}', deliveryText).replace('{الاجمالي}', finalTotal);
    if(deliveryFee === 0 && zoneName === 'مكان آخر' && !freeDelivery) message += `\n*(الإجمالي غير شامل رسوم التوصيل)*`;

    let promoUpdated = false;
    if (appliedPromo) {
        let pIndex = globalSettings.promoCodes.findIndex(p => p.code === appliedPromo.code);
        if (pIndex !== -1) {
            let pObj = globalSettings.promoCodes[pIndex];
            if (pObj.usesLeft !== null && pObj.usesLeft !== undefined) { pObj.usesLeft -= 1; if (pObj.usesLeft <= 0) globalSettings.promoCodes.splice(pIndex, 1); } 
            else if (pObj.isAuto) { globalSettings.promoCodes.splice(pIndex, 1); }
            promoUpdated = true;
        }
    }

    let earnedLoyalty = false; let newPromoCode = ""; let canGenerateReward = false;
    if (globalSettings.rewardActive && !appliedPromo) { if (globalSettings.rewardMaxGenerations === 0) { canGenerateReward = true; } else if (globalSettings.rewardMaxGenerations > 0) { canGenerateReward = true; } }
    
    if (canGenerateReward) {
        const prefix = globalSettings.autoPromoPrefix || 'VIP-';
        newPromoCode = prefix + Math.floor(1000 + Math.random() * 9000); earnedLoyalty = true;
        const newPromoObj = { code: newPromoCode, type: globalSettings.rewardType, discount: globalSettings.rewardValue, isAuto: true, usesLeft: 1, customerPhone: customerPhone, minOrder: 0, maxDiscount: 0, expiryDate: '' };
        if(!globalSettings.promoCodes) globalSettings.promoCodes = []; globalSettings.promoCodes.push(newPromoObj);
        if (globalSettings.rewardMaxGenerations > 0) { globalSettings.rewardMaxGenerations -= 1; if (globalSettings.rewardMaxGenerations === 0) { globalSettings.rewardActive = false; } }
        promoUpdated = true;
    }

    let addressText = customerAddress ? `🏠 العنوان: ${customerAddress}` : "";
    let tickTickItemsStr = ""; for (let id in cart) { if(productsInfo[id]) tickTickItemsStr += `[ ${cart[id].quantity} ] ${cart[id].name} = ${cart[id].quantity * cart[id].price} ج.م\n`; }
    let discountTickTickText = discountAmount > 0 ? `🎁 الخصم: -${discountAmount} ج.م\n` : ""; let notesText = earnedLoyalty ? `\n🎟️ ملاحظة: كود المرة القادمة (${newPromoCode})` : "";
    let defaultTickTick = "🧾 **تفاصيل الأوردر كاملة:**\n👤 الاسم: {اسم_العميل}\n📱 الموبايل: {الموبايل}\n📍 المنطقة: {المنطقة}\n{العنوان}\n🕒 الوقت: {الوقت}\n--------------------------------\n🛒 الطلبات:\n{تفاصيل_الطلبات}\n--------------------------------\n📦 قيمة الطلبات: {قيمة_الطلبات} ج.م\n{الخصم}🚚 رسوم التوصيل: {التوصيل}\n💰 الإجمالي النهائي: {الاجمالي} ج.م\n{ملاحظات}\n{الهاشتاجات}";

    let orderDetailsForTickTick = (globalSettings.ticktickTemplate || defaultTickTick).replace('{اسم_العميل}', customerName).replace('{الموبايل}', customerPhone).replace('{المنطقة}', zoneName).replace('{العنوان}', addressText).replace('{الوقت}', `${orderDate} - ${orderTime}`).replace('{تفاصيل_الطلبات}', tickTickItemsStr.trim()).replace('{قيمة_الطلبات}', subTotal).replace('{الخصم}', discountTickTickText).replace('{التوصيل}', deliveryText).replace('{الاجمالي}', finalTotal).replace('{ملاحظات}', notesText).replace('{الهاشتاجات}', smartTagsArray.join(' ')); orderDetailsForTickTick = orderDetailsForTickTick.replace(/\n\s*\n/g, '\n');

    try {
        fetch('https://api.web3forms.com/submit', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: JSON.stringify({ access_key: WEB3FORMS_ACCESS_KEY, subject: `🛒 ${itemsSummaryArray.join(' ')}`, "التفاصيل": orderDetailsForTickTick }) }).catch(e=>console.log(e));

        if (hasCloud && db) {
            const orderData = { 
                customerName, customerPhone, customerAddress: customerAddress||"غير محدد", zone: zoneName, items: [], subtotal: subTotal, discount: discountAmount, deliveryFee: finalDelivery, total: finalTotal, status: "new", 
                usedPromo: appliedPromo ? appliedPromo.code : null, generatedPromo: newPromoCode || null, batch: globalSettings.batchHashtag || "", orderDate: orderDate, orderTime: orderTime, isRead: false, createdAt: firebase.firestore.FieldValue.serverTimestamp() 
            };
            for (let id in cart) orderData.items.push({ id, name: cart[id].name, quantity: cart[id].quantity, price: cart[id].price });
            
            await Promise.all([ db.collection("orders").add(orderData), db.collection('inventory').doc('stats').set({ sales: firebase.firestore.FieldValue.increment(finalTotal), orders: firebase.firestore.FieldValue.increment(1) }, { merge: true }), promoUpdated ? db.collection("inventory").doc("settings").set({ promoCodes: globalSettings.promoCodes, rewardMaxGenerations: globalSettings.rewardMaxGenerations, rewardActive: globalSettings.rewardActive }, { merge: true }) : Promise.resolve() ]);
            let updates = {}; for (let id in cart) updates[id] = firebase.firestore.FieldValue.increment(-cart[id].quantity); await db.collection('inventory').doc('stock').update(updates);
        }
    } catch(e) { console.log("Sync Error", e); }

    cart = {}; saveCart(); appliedPromo = null; if(document.getElementById('promo-code-input')) document.getElementById('promo-code-input').value = ""; if(document.getElementById('promo-message')) document.getElementById('promo-message').classList.add('hidden');
    document.getElementById('customer-name').value = ""; document.getElementById('customer-phone').value = ""; document.getElementById('customer-address').value = ""; 
    document.getElementById('delivery-zone').value = ""; updateUI(); const container = document.getElementById('products-container'); if(container) container.innerHTML = '<div class="text-center py-10 text-brand-cyanDark"><i class="fa-solid fa-spinner fa-spin text-3xl mb-3"></i><p class="font-bold text-sm">جاري التحديث...</p></div>'; renderProducts(); toggleCart(); checkoutBtn.innerHTML = originalBtnHtml; checkoutBtn.disabled = false;

    const successOrWhatsApp = () => { if (wantsWhatsApp) { window.location.href = `https://api.whatsapp.com/send?phone=20${globalSettings.storePhone}&text=${encodeURIComponent(message)}`; } else { document.getElementById('alert-icon-container').className = "w-16 h-16 bg-green-100 text-green-500 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl"; document.getElementById('alert-icon').className = "fa-solid fa-check"; showAlert(globalSettings.successTitle || "تم استلام الأوردر! 🎉", globalSettings.successMessage || "شكراً لثقتك.. الأوردر وصل للسيستم بنجاح."); } };

    if (earnedLoyalty) {
        const rewardDesc = globalSettings.rewardType === 'free_delivery' ? 'توصيل مجاني' : globalSettings.rewardType === 'percent' ? `خصم ${globalSettings.rewardValue}%` : `خصم ${globalSettings.rewardValue} ج.م`;
        const customMsg = globalSettings.autoPromoModalMsg || "تم إصدار كود خصم خاص بك لطلبك القادم 🎁";
        const msgHTML = `<div class="text-5xl mb-3">🎉</div><div class="font-black text-brand-navy mb-2 text-lg">شكراً لطلبك يا ${customerName.split(' ')[0]}!</div><div class="text-green-600 font-black text-sm mb-2">${customMsg}</div><div class="bg-gray-100 border-2 border-dashed border-gray-300 p-4 rounded-xl mb-4 relative"><span class="text-xs font-bold text-gray-500 block mb-1">كود الخصم الخاص بك:</span><span class="font-black text-3xl text-brand-cyanDark tracking-wider select-all block mb-2">${newPromoCode}</span><button onclick="navigator.clipboard.writeText('${newPromoCode}'); this.innerHTML='<i class=\\'fa-solid fa-check\\'></i> تم النسخ بنجاح'; this.classList.replace('bg-brand-navy', 'bg-green-500'); setTimeout(() => { this.innerHTML='<i class=\\'fa-regular fa-copy\\'></i> انسخ الكود'; this.classList.replace('bg-green-500', 'bg-brand-navy'); }, 2000);" class="w-full bg-brand-navy hover:bg-gray-800 text-white text-sm py-2 rounded-lg font-bold transition-colors flex justify-center items-center gap-2 shadow-sm"><i class="fa-regular fa-copy"></i> انسخ الكود</button><span class="text-xs font-bold text-gray-600 block mt-3">يمنحك ${rewardDesc}</span></div><div class="text-sm font-bold text-brand-navy mt-2">الأوردر وصل السيستم بنجاح وسيتم تجهيزه.</div>`;
        document.getElementById('alert-icon-container').classList.add('hidden'); document.getElementById('alert-title').classList.add('hidden'); document.getElementById('alert-message').innerHTML = msgHTML;

        const alertBtn = document.querySelector('#alert-box button'); 
        if (wantsWhatsApp) { alertBtn.className = "bg-green-500 hover:bg-green-600 text-white font-black py-4 px-6 rounded-xl w-full transition-colors flex justify-center items-center gap-2 shadow-lg"; alertBtn.innerHTML = 'موافق، تحويل للواتساب <i class="fa-brands fa-whatsapp text-xl"></i>'; alertBtn.onclick = () => { closeAlert(); window.location.href = `https://api.whatsapp.com/send?phone=20${globalSettings.storePhone}&text=${encodeURIComponent(message)}`; }; } 
        else { alertBtn.className = "bg-brand-navy hover:bg-gray-800 text-white font-bold py-3 px-6 rounded-xl w-full transition-colors"; alertBtn.innerHTML = 'حسناً'; alertBtn.onclick = closeAlert; }
        const md = document.getElementById('alert-modal'); md.classList.remove('hidden'); setTimeout(()=>md.classList.remove('opacity-0'),10);
    } else {
        if (wantsWhatsApp) { document.getElementById('alert-icon-container').className = "w-16 h-16 bg-green-100 text-green-500 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl"; document.getElementById('alert-icon').className = "fa-brands fa-whatsapp"; showAlert("جاري التحويل للواتساب 🚀", "تم تجهيز الأوردر بتاعك.. هيتم تحويلك للواتساب دلوقتي عشان تدوس إرسال وتأكد الحجز."); setTimeout(() => { window.location.href = `https://api.whatsapp.com/send?phone=20${globalSettings.storePhone}&text=${encodeURIComponent(message)}`; }, 2500); } 
        else { successOrWhatsApp(); }
    }
};

window.showAlert = function(t, m) { document.getElementById('alert-title').innerText=t; document.getElementById('alert-message').innerText=m; const md=document.getElementById('alert-modal'); md.classList.remove('hidden'); setTimeout(()=>md.classList.remove('opacity-0'),10); };
window.closeAlert = function() { document.getElementById('alert-modal').classList.add('opacity-0'); setTimeout(() => { document.getElementById('alert-modal').classList.add('hidden'); document.getElementById('alert-icon-container').className="w-16 h-16 bg-brand-light text-brand-cyanDark rounded-full flex items-center justify-center mx-auto mb-4 text-3xl"; document.getElementById('alert-icon-container').classList.remove('hidden'); document.getElementById('alert-title').classList.remove('hidden'); document.getElementById('alert-icon').className="fa-solid fa-bell"; document.getElementById('alert-message').innerHTML = "الرسالة"; const btn = document.querySelector('#alert-box button'); btn.className = "bg-brand-navy hover:bg-gray-800 text-white font-bold py-3 px-6 rounded-xl w-full transition-colors"; btn.innerHTML = 'حسناً'; btn.onclick = closeAlert; }, 300); };
