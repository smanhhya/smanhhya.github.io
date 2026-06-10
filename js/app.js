// js/app.js
// المتغيرات الأساسية (cart, productsInfo, globalSettings...) بيتم قراءتها تلقائياً من ملف config.js

// --- دوال الحفظ والتحميل ---
function saveCart() { try { localStorage.setItem('sman_cart', JSON.stringify(cart)); } catch(e) {} }

function loadCart() { 
    try { 
        const savedCart = localStorage.getItem('sman_cart'); 
        if (savedCart) { cart = JSON.parse(savedCart); } 
        updateUI(); 
    } 
    catch (e) { cart = {}; localStorage.removeItem('sman_cart'); } 
}

function getAvailableStock(id) { 
    if(!productsInfo[id]) return 0; 
    const inCart = cart[id]?.quantity || 0; 
    return Math.max(0, (globalStock[id] || 0) - inCart); 
}

// --- تطبيق نصوص الواجهة والمربعات الأربعة (Trust Badges) ---
function applyUITexts() {
    const t = globalSettings.uiTexts || {};
    const defaultTexts = {
        cartTotalLabel: "الإجمالي (بدون التوصيل)",
        viewCartBtn: "عرض السلة",
        checkoutTitle: "سلة المشتريات",
        promoBtn: "تفعيل",
        subtotalLabel: "قيمة الطلبات:",
        deliveryLabel: "مصاريف التوصيل:",
        finalTotalLabel: "الإجمالي النهائي:",
        menuTitle: "قائمة الأطباق",
        extrasTitle: "منتجات أخرى",
        emptyCartMsg: "السلة فارغة",
        emptyMenuMsg: "لا توجد منتجات حالياً"
    };

    const getT = (id) => t[id] || defaultTexts[id] || "";
    const setTxt = (elId, val) => { const el = document.getElementById(elId); if(el) el.innerText = val; };
    
    setTxt('lbl-cart-total', getT('cartTotalLabel')); 
    setTxt('lbl-view-cart', getT('viewCartBtn')); 
    setTxt('lbl-checkout-title', getT('checkoutTitle')); 
    setTxt('lbl-promo-btn', getT('promoBtn')); 
    setTxt('lbl-subtotal', getT('subtotalLabel')); 
    setTxt('lbl-delivery-summary', getT('deliveryLabel')); 
    setTxt('lbl-final-total', getT('finalTotalLabel')); 
    setTxt('lbl-menu-title', getT('menuTitle')); 
    setTxt('lbl-extras-title', getT('extrasTitle'));

    if(globalSettings.trustBadges && globalSettings.trustBadges.length === 4) {
        for(let i=1; i<=4; i++) {
            const badge = globalSettings.trustBadges[i-1];
            const iconEl = document.getElementById(`badge-${i}-icon`);
            if(iconEl) iconEl.className = `${badge.icon} text-brand-navy text-2xl mb-2`;
            setTxt(`badge-${i}-title`, badge.title);
            setTxt(`badge-${i}-desc`, badge.desc);
        }
    }
}

// --- تشغيل الميزات المرئية الذكية (سلايدر، شريط أخبار) ---
function renderMarquee() {
    const banner = document.getElementById('top-banner');
    const textContainer = document.getElementById('top-banner-text');
    if(!banner || !textContainer) return;

    if (globalSettings.bannerActive && globalSettings.marqueeMessages && globalSettings.marqueeMessages.length > 0) {
        const fullMsg = globalSettings.marqueeMessages.join(' &nbsp; &nbsp; <i class="fa-solid fa-star text-[8px] text-orange-400 mx-2"></i> &nbsp; &nbsp; ');
        textContainer.innerHTML = fullMsg;
        banner.classList.remove('hidden');
    } else if (globalSettings.bannerActive && globalSettings.bannerText) {
        textContainer.innerHTML = globalSettings.bannerText;
        banner.classList.remove('hidden');
    } else {
        banner.classList.add('hidden');
    }
}

function startLiveNotifications() {
    const noti = document.getElementById('live-notification');
    if (!noti || !globalSettings.liveNotiActive || !globalSettings.liveNotiNames || globalSettings.liveNotiNames.length === 0) return;

    const names = globalSettings.liveNotiNames;
    const places = globalSettings.liveNotiPlaces || [];
    const products = ["طبق سوبر", "طبق جامبو", "كتاكيت سمان", "طبق سبشيال", "بيض سمان"];
    
    function showRandomNoti() {
        const name = names[Math.floor(Math.random() * names.length)];
        const place = places.length > 0 ? places[Math.floor(Math.random() * places.length)] : "";
        const product = products[Math.floor(Math.random() * products.length)];
        const time = Math.floor(Math.random() * 5) + 1;

        const placeText = place ? ` من ${place}` : "";
        document.getElementById('live-noti-text').innerHTML = `<span class="font-black text-brand-navy">${name}${placeText}</span> حجز ${product}`;
        document.getElementById('live-noti-time').innerText = `منذ ${time} دقيقة`;

        noti.classList.remove('translate-y-20', 'opacity-0');
        setTimeout(() => { noti.classList.add('translate-y-20', 'opacity-0'); }, 5000); 
    }
    setTimeout(() => { showRandomNoti(); setInterval(showRandomNoti, 25000); }, 10000);
}

function applySettingsToUI() {
    renderMarquee();
    document.getElementById('header-store-name').innerText = globalSettings.storeName || 'سمان ههيا'; 
    const descEl = document.getElementById('header-store-desc');
    if(descEl) { descEl.innerText = globalSettings.storeDesc || 'صحي وطازة'; descEl.classList.remove('hidden'); }
    document.getElementById('footer-store-name').innerText = globalSettings.storeName || 'سمان ههيا';
    
    const phoneStr = globalSettings.storePhone || "01208027294"; 
    document.getElementById('footer-phone').innerText = phoneStr; 
    const phoneLink = document.getElementById('footer-phone-link');
    if(phoneLink) phoneLink.href = `tel:${phoneStr}`;

    const wrapper = document.getElementById('store-wrapper'); 
    const msg = document.getElementById('store-closed-msg'); 
    const mainCartBtn = document.getElementById('main-cart-btn');
    const isOpen = globalSettings.storeOpen !== false; 

    if(!isOpen) { 
        if(wrapper) wrapper.classList.add('opacity-50', 'pointer-events-none'); 
        if(msg) { msg.classList.remove('hidden'); const msgDiv = msg.querySelector('div'); if(msgDiv) msgDiv.innerText = globalSettings.closedMessage || 'المتجر مغلق حالياً، نعود قريباً!'; } 
        if(mainCartBtn) mainCartBtn.disabled = true; 
    } else { 
        if(wrapper) wrapper.classList.remove('opacity-50', 'pointer-events-none'); 
        if(msg) msg.classList.add('hidden'); 
        if(mainCartBtn) mainCartBtn.disabled = false; 
    }

    const minWarn = document.getElementById('min-order-warning');
    if (globalSettings.minOrder > 0) { 
        const minValEl = document.getElementById('min-order-value'); if(minValEl) minValEl.innerText = globalSettings.minOrder; 
        if(minWarn) minWarn.classList.remove('hidden'); 
    } else { if(minWarn) minWarn.classList.add('hidden'); }

    const promoContainer = document.getElementById('promo-input-container');
    if(promoContainer) { 
        if(globalSettings.showPromoField !== false) promoContainer.classList.remove('hidden'); 
        else { promoContainer.classList.add('hidden'); if(appliedPromo && !appliedPromo.isLoyalty) appliedPromo = null; } 
    }
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

// --- بداية تشغيل الموقع (سريع) ---
document.addEventListener('DOMContentLoaded', () => { 
    renderDeliveryZones(); loadCart(); setupEventListeners(); initFirebase(); 
});

window.setupEventListeners = function() {
    const ids = ['customer-name', 'customer-phone', 'customer-address'];
    ids.forEach(id => { const el = document.getElementById(id); if(el) el.addEventListener('input', updateUI); });
    const dZone = document.getElementById('delivery-zone'); if (dZone) dZone.addEventListener('change', updateUI);
    const pInput = document.getElementById('promo-code-input');
    if (pInput) { pInput.addEventListener('input', () => { if (appliedPromo && !appliedPromo.isLoyalty && pInput.value.trim() === '') { appliedPromo = null; document.getElementById('promo-message').classList.add('hidden'); updateUI(); } }); }
}

// --- تهيئة Firebase ---
function initFirebase() {
    const firebaseConfig = { apiKey: "AIzaSyD7ZJP8n8fhMewPfEsTBANn0h9To_q15BY", authDomain: "sman-ca8f8.firebaseapp.com", projectId: "sman-ca8f8", storageBucket: "sman-ca8f8.firebasestorage.app", messagingSenderId: "538778803310", appId: "1:538778803310:web:5eeff42bae534375a21a7f" };
    try { 
        if (!firebase.apps.length) { firebase.initializeApp(firebaseConfig); }
        db = firebase.firestore(); 
        firebase.auth().signInAnonymously().catch(() => {}); 
        firebase.auth().onAuthStateChanged(user => { if(user) { hasCloud = true; listenToDatabase(); } }); 
    } catch (e) { console.log("Firebase Error", e); }
}

function listenToDatabase() {
    if(!db) return;
    let settingsLoaded = false; let stockLoaded = false;
    const checkAndRender = () => {
        if (settingsLoaded && stockLoaded && !isStoreDataLoaded) {
            isStoreDataLoaded = true;
            Object.keys(productsInfo).forEach(id => { if(globalStock[id] === undefined) globalStock[id] = 0; if(globalPrices[id] === undefined) globalPrices[id] = productsInfo[id].basePrice; }); 
            renderProducts(); applySettingsToUI(); startLiveNotifications(); updateUI();
        } else if (isStoreDataLoaded) { renderProducts(); updateUI(); }
    };

    db.collection('inventory').doc('settings').onSnapshot(doc => { 
        if(doc.exists) { 
            const data = doc.data(); if(data.productsData) productsInfo = data.productsData; Object.assign(globalSettings, data); if(data.deliveryZones) globalDeliveryZones = data.deliveryZones; 
            applySettingsToUI(); renderDeliveryZones(); settingsLoaded = true; checkAndRender();
        } 
    });
    db.collection('inventory').doc('stock').onSnapshot(doc => { if(doc.exists) { Object.assign(globalStock, doc.data()); stockLoaded = true; checkAndRender(); } });
    db.collection('inventory').doc('prices').onSnapshot(doc => { if(doc.exists) { Object.assign(globalPrices, doc.data()); if(isStoreDataLoaded) renderProducts(); } });
    db.collection('inventory').doc('discounts_status').onSnapshot(doc => { if(doc.exists) { Object.assign(globalDiscounts, doc.data()); if(isStoreDataLoaded) renderProducts(); } });
    db.collection('inventory').doc('old_prices').onSnapshot(doc => { if(doc.exists) { Object.assign(globalOldPrices, doc.data()); if(isStoreDataLoaded) renderProducts(); } });
    
    // سحب الدفعات من الـ CRM
    db.collection('inventory').doc('batches').onSnapshot(doc => {
        if(doc.exists) {
            let batches = doc.data() || {};
            let batchSelect = document.getElementById('user-batch-select');
            let batchContainer = document.getElementById('batch-selection-container');
            if(batchSelect && batchContainer) {
                batchSelect.innerHTML = '<option value="" selected>بدون حجز مسبق (طلب عادي)</option>';
                let openBatchesCount = 0;
                Object.keys(batches).forEach(bId => {
                    if(batches[bId].isOpen) {
                        batchSelect.innerHTML += `<option value="${bId}">${batches[bId].name}</option>`;
                        openBatchesCount++;
                    }
                });
                if(openBatchesCount > 0) batchContainer.style.display = 'block'; else batchContainer.style.display = 'none';
            }
        }
    });
}

// --- نظام الكوبونات والخصم ---
window.applyPromoCode = function() {
    const input = document.getElementById('promo-code-input').value.trim().toUpperCase(); const msg = document.getElementById('promo-message'); if (input === '') return;
    let subTotal = 0; for (let id in cart) subTotal += cart[id].quantity * (globalPrices[id] || productsInfo[id].basePrice);
    const promo = (globalSettings.promoCodes || []).find(p => p.code.toUpperCase() === input);
    if (!promo) { msg.innerText = "كود غير صحيح."; msg.className = "text-[11px] font-bold mt-1 text-red-500"; msg.classList.remove('hidden'); return; }
    if (promo.usesLeft !== null && promo.usesLeft !== undefined && promo.usesLeft <= 0) { msg.innerText = "عفواً، تم استخدام هذا الكود من قبل."; msg.className = "text-[11px] font-bold mt-1 text-red-500"; msg.classList.remove('hidden'); return; }
    if (promo.expiryDate && new Date(promo.expiryDate) < new Date(new Date().toDateString())) { msg.innerText = "عفواً، هذا الكود منتهي الصلاحية."; msg.className = "text-[11px] font-bold mt-1 text-red-500"; msg.classList.remove('hidden'); return; }
    if (promo.minOrder && subTotal < promo.minOrder) { msg.innerText = `عشان تفعل الكود ده، لازم طلباتك تتخطى ${promo.minOrder} ج.م`; msg.className = "text-[11px] font-bold mt-1 text-red-500"; msg.classList.remove('hidden'); return; }
    appliedPromo = { ...promo, isLoyalty: false }; msg.innerText = "تم تفعيل كود الخصم بنجاح 🎉"; msg.className = "text-[11px] font-bold mt-1 text-green-600"; msg.classList.remove('hidden'); updateUI();
};

// --- محرك عرض المنتجات ---
window.renderProducts = function() {
    if(!isStoreDataLoaded) return; 
    const container = document.getElementById('products-container'); const extrasContainer = document.getElementById('extras-container'); 
    if(!container || !extrasContainer) return;

    container.innerHTML = ''; extrasContainer.innerHTML = ''; let mainProductsCount = 0;

    Object.keys(productsInfo).forEach(id => {
        const item = productsInfo[id]; if(item.isVisible === false) return; 
        const available = getAvailableStock(id); const currentPrice = globalPrices[id] || item.basePrice; const oldPrice = globalOldPrices[id]; const isDiscountActive = globalDiscounts[id]; const isBestSeller = globalSettings.bestSellers && globalSettings.bestSellers.includes(id); const stockBadgeClass = available <= 10 ? (available === 0 ? 'bg-red-50 text-red-600' : 'bg-orange-50 text-orange-600') : 'bg-green-50 text-green-700';
        let priceHtml = ''; let saleBadgeHtml = '';
        if (isDiscountActive) { saleBadgeHtml = `<div class="absolute top-4 left-4 bg-red-500 text-white text-[10px] font-black px-3 py-1 rounded-full shadow-lg sale-badge z-10"><i class="fa-solid fa-tag"></i> عرض</div>`; priceHtml = `<div class="flex flex-col"><span class="text-[11px] text-gray-400 line-through decoration-red-500 font-bold">${oldPrice} ج.م</span><span class="font-black text-red-600 text-xl">${currentPrice} <span class="text-[10px] text-gray-500">ج.م</span></span></div>`; } else { priceHtml = `<span class="font-black text-brand-cyanDark text-lg">${currentPrice} <span class="text-[10px] text-gray-400">ج.م</span></span>`; }
        let bestSellerHtml = isBestSeller ? `<div class="absolute bottom-2 right-2 bg-brand-navy text-brand-yellow text-[10px] font-black px-2 py-1 rounded shadow z-10 border border-brand-yellow/30">الأكثر طلباً 🔥</div>` : ''; const imgSrc = (item.images && item.images.length > 0) ? item.images[0] : '';
        let customTagHtml = ''; if(item.tag === 'new') customTagHtml = `<span class="bg-blue-100 text-blue-700 text-[10px] font-black px-1.5 py-0.5 rounded border border-blue-200">🆕 جديد</span>`; else if(item.tag === 'hot') customTagHtml = `<span class="bg-orange-100 text-orange-700 text-[10px] font-black px-1.5 py-0.5 rounded border border-orange-200">🔥 قرب يخلص</span>`; else if(item.tag === 'offer') customTagHtml = `<span class="bg-purple-100 text-purple-700 text-[10px] font-black px-1.5 py-0.5 rounded border border-purple-200">⏱ عرض محدود</span>`;
        const cardHTML = `
            <div class="bg-white rounded-2xl shadow-sm border ${isDiscountActive ? 'border-red-200' : 'border-gray-200'} overflow-hidden flex flex-row h-[140px] relative transition-transform hover:shadow-md">
                ${saleBadgeHtml}
                <div class="p-3 flex-1 flex flex-col justify-between bg-white min-w-0 z-10">
                    <div>
                        <div class="flex gap-1 items-center mb-1">
                            <h3 class="text-sm md:text-base font-black text-brand-navy truncate">${item.name}</h3>
                            ${customTagHtml}
                        </div>
                        <div class="flex items-center justify-between gap-2 mb-1">
                            ${priceHtml}
                            <span class="bg-gray-50 text-gray-500 text-[10px] px-1.5 py-0.5 rounded border border-gray-200 font-bold whitespace-nowrap"><i class="fa-solid fa-scale-balanced mr-1"></i> ${item.weight}</span>
                        </div>
                    </div>
                    <div class="flex items-center justify-between mt-auto">
                        <div class="text-[10px] font-bold px-1.5 py-0.5 rounded border ${stockBadgeClass} shrink-0">المتاح: <span id="stock-display-${id}">${available}</span></div>
                        <div class="w-28 shrink-0" id="card-action-${id}">${getCardActionHTML(id)}</div>
                    </div>
                </div>
                <div class="w-32 sm:w-36 shrink-0 relative border-r border-gray-100 overflow-hidden bg-gray-50 cursor-zoom-in" onclick="openImageModal('${imgSrc}')">
                    ${bestSellerHtml}
                    <img loading="lazy" src="${imgSrc}" class="w-full h-full object-cover object-center transition-transform duration-300 hover:scale-110" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\'><rect width=\\'100%\\' height=\\'100%\\' fill=\\'%23f1f5f9\\'/></svg>'">
                </div>
            </div>`;
        if (!item.isExtra) { mainProductsCount++; container.innerHTML += cardHTML; } else { extrasContainer.innerHTML += cardHTML; }
    });
    if(mainProductsCount === 0) container.innerHTML = `<div class="text-center py-10 text-gray-400 font-bold">${globalSettings.uiTexts?.emptyMenuMsg || "لا توجد منتجات حالياً"}</div>`;
};

// --- منطق السلة والكميات ---
window.getCardActionHTML = function(id) {
    if (globalSettings.storeOpen === false) return `<div class="w-full bg-gray-100 text-gray-400 font-bold py-2 rounded-xl text-xs text-center">مغلق</div>`;
    const inCart = cart[id]?.quantity || 0; const available = getAvailableStock(id);
    if (available === 0 && inCart === 0) return `<div onclick="openVipPreOrder('${id}')" class="w-full bg-brand-yellow text-brand-navy font-black py-2 rounded-xl text-[10px] flex justify-center items-center gap-1 cursor-pointer shadow-sm"><i class="fa-solid fa-crown"></i> حجز VIP</div>`;
    if (inCart > 0) return `<div class="flex items-center justify-between bg-brand-light border border-brand-navy/10 rounded-xl p-1 h-[36px]"><div onclick="updateQuantity('${id}', 1)" class="w-8 h-full bg-white text-brand-navy rounded-lg shadow-sm font-black text-lg flex items-center justify-center cursor-pointer select-none">+</div><span class="font-black text-brand-navy text-sm min-w-[20px] text-center">${inCart}</span><div onclick="updateQuantity('${id}', -1)" class="w-8 h-full bg-white text-red-500 rounded-lg shadow-sm font-black text-xl flex items-center justify-center cursor-pointer select-none">-</div></div>`;
    return `<div onclick="addToCart('${id}')" class="w-full bg-brand-navy text-white font-black py-2 rounded-xl text-xs flex justify-center items-center gap-2 cursor-pointer shadow-sm hover:opacity-90"><i class="fa-solid fa-plus"></i> إضافة</div>`;
}

window.addToCart = function(id) { if (globalSettings.storeOpen === false) return; if (getAvailableStock(id) <= 0) { showAlert("عذراً", "الكمية المتاحة لا تكفي حالياً."); return; } if (cart[id]) cart[id].quantity++; else cart[id] = { quantity: 1, price: globalPrices[id] || productsInfo[id].basePrice, name: productsInfo[id].name }; saveCart(); updateUI(); renderProducts(); };
window.updateQuantity = function(id, delta) { if (!cart[id] || globalSettings.storeOpen === false) return; if (delta === 1) { if (getAvailableStock(id) > 0) cart[id].quantity++; else showAlert("عذراً", "لا يوجد مخزون إضافي متاح."); } else if (delta === -1) { cart[id].quantity--; if (cart[id].quantity <= 0) delete cart[id]; } saveCart(); updateUI(); renderProducts(); };

// --- التنقل بين خطوات السلة وتغيير الشاشات ---
window.goToCheckoutStep2 = function() {
    document.getElementById('checkout-step-1').classList.add('hidden'); document.getElementById('checkout-step-2').classList.remove('hidden'); document.getElementById('btn-back-step').classList.remove('hidden'); document.getElementById('lbl-checkout-title').innerText = "إتمام الطلب";
    document.getElementById('step-1-indicator').classList.replace('step-active', 'step-completed'); document.getElementById('step-line-1').classList.add('active'); document.getElementById('step-2-indicator').classList.replace('opacity-50', 'step-active');
    updateUI();
};

window.backToCart = function() {
    document.getElementById('checkout-step-2').classList.add('hidden'); document.getElementById('checkout-step-1').classList.remove('hidden'); document.getElementById('btn-back-step').classList.add('hidden'); document.getElementById('lbl-checkout-title').innerText = "سلة المشتريات";
    document.getElementById('step-2-indicator').classList.replace('step-active', 'opacity-50'); document.getElementById('step-line-1').classList.remove('active'); document.getElementById('step-1-indicator').classList.replace('step-completed', 'step-active');
    updateUI();
};

window.updateUI = function() {
    let totalItems = 0, subTotalPrice = 0; const cartItemsContainer = document.getElementById('cart-items'); if(cartItemsContainer) cartItemsContainer.innerHTML = '';
    for (let id in cart) {
        if (!productsInfo[id]) { delete cart[id]; continue; }
        const item = cart[id]; item.price = globalPrices[id] || productsInfo[id].basePrice; totalItems += item.quantity; subTotalPrice += item.quantity * item.price;
        if(cartItemsContainer) {
            cartItemsContainer.innerHTML += `
                <div class="bg-white p-3 rounded-xl border border-gray-100 flex justify-between items-center shadow-sm">
                    <div class="flex-1"><h4 class="font-bold text-brand-navy text-xs mb-1">${item.name}</h4><div class="text-brand-cyanDark font-black text-sm">${item.price} ج.م</div></div>
                    <div class="flex items-center gap-2 bg-gray-50 rounded-lg p-1 border border-gray-200 h-[36px]"><div onclick="updateQuantity('${id}', 1)" class="w-8 h-full bg-white text-brand-navy rounded shadow-sm font-black text-lg flex items-center justify-center cursor-pointer select-none">+</div><span class="font-black text-brand-navy min-w-[24px] text-center text-sm">${item.quantity}</span><div onclick="updateQuantity('${id}', -1)" class="w-8 h-full bg-white text-red-500 rounded shadow-sm font-black text-xl flex items-center justify-center cursor-pointer select-none pb-1">-</div></div>
                </div>`;
        }
    }

    const bottomBar = document.getElementById('bottom-cart-bar');
    if(bottomBar) { 
        document.getElementById('bottom-cart-total').innerText = subTotalPrice; document.getElementById('bottom-cart-count').innerText = totalItems; 
        if (totalItems > 0) bottomBar.classList.remove('translate-y-full'); 
        else { bottomBar.classList.add('translate-y-full'); if(cartItemsContainer) cartItemsContainer.innerHTML = `<div class="flex flex-col items-center justify-center py-10 text-gray-400 gap-3"><i class="fa-solid fa-basket-shopping text-5xl text-gray-200"></i><p class="font-bold text-sm">${globalSettings.uiTexts?.emptyCartMsg || "السلة فارغة"}</p></div>`; }
    }

    let freeDelivery = (globalSettings.freeDeliveryActive && subTotalPrice >= (globalSettings.freeDeliveryThreshold||0) && totalItems > 0);
    const tracker = document.getElementById('free-delivery-tracker');
    if (globalSettings.freeDeliveryActive && totalItems > 0) { 
        tracker.classList.remove('hidden'); let remaining = Math.max(0, (globalSettings.freeDeliveryThreshold||0) - subTotalPrice); document.getElementById('fd-progress').style.width = Math.min(100, (subTotalPrice / (globalSettings.freeDeliveryThreshold||1)) * 100) + '%'; const textContainer = document.getElementById('free-delivery-text'); 
        if (remaining > 0) { textContainer.innerHTML = `<span class="text-gray-600">باقي <span class="text-brand-cyanDark font-black text-sm">${remaining}</span> ج وتاخد توصيل مجاني!</span><i class="fa-solid fa-gift text-brand-cyanDark text-lg"></i>`; document.getElementById('fd-progress').className = "bg-gradient-to-l from-brand-cyan to-brand-cyanDark h-2.5 rounded-full progress-bar-animated"; } else { textContainer.innerHTML = `<span class="text-green-600 font-black">مبروك! التوصيل مجاني 🎉</span><i class="fa-solid fa-check-circle text-green-500 text-lg"></i>`; document.getElementById('fd-progress').className = "bg-green-500 h-2.5 rounded-full progress-bar-animated"; } 
    } else tracker.classList.add('hidden');

    let discountAmount = 0; const promoRow = document.getElementById('promo-discount-row');
    if (appliedPromo && totalItems > 0) {
        if (appliedPromo.minOrder && subTotalPrice < appliedPromo.minOrder) { appliedPromo = null; const msg = document.getElementById('promo-message'); if(msg) { msg.innerText = "تم إلغاء الخصم لأن الطلبات قلت عن الحد الأدنى للكود."; msg.className = "text-[11px] font-bold mt-1 text-red-500"; msg.classList.remove('hidden'); } if(document.getElementById('promo-code-input')) document.getElementById('promo-code-input').value = ''; } else {
            if(appliedPromo.type === 'free_delivery') { freeDelivery = true; discountAmount = 0; document.getElementById('promo-label').innerText = appliedPromo.code + " (توصيل مجاني)"; document.getElementById('cart-discount').innerText = "0"; } else { discountAmount = appliedPromo.type === 'percent' ? (subTotalPrice * (appliedPromo.discount / 100)) : appliedPromo.discount; if (appliedPromo.type === 'percent' && appliedPromo.maxDiscount > 0) discountAmount = Math.min(discountAmount, appliedPromo.maxDiscount); discountAmount = Math.round(Math.min(discountAmount, subTotalPrice)); document.getElementById('promo-label').innerText = appliedPromo.code; document.getElementById('cart-discount').innerText = discountAmount; }
        }
        if(appliedPromo) promoRow.classList.remove('hidden'); else promoRow.classList.add('hidden');
    } else { promoRow.classList.add('hidden'); }

    const totalAfterPromo = subTotalPrice - discountAmount; const deliverySelect = document.getElementById('delivery-zone'); const selectedZone = globalDeliveryZones.find(z => z.id === deliverySelect?.value); const deliveryFee = selectedZone ? selectedZone.price : 0; const finalDelivery = freeDelivery ? 0 : deliveryFee; const finalTotal = totalAfterPromo + finalDelivery;

    if(document.getElementById('cart-subtotal')) document.getElementById('cart-subtotal').innerText = subTotalPrice;
    if(document.getElementById('cart-step1-total')) document.getElementById('cart-step1-total').innerText = totalAfterPromo;
    if(document.getElementById('cart-delivery-fee')) { if (freeDelivery) document.getElementById('cart-delivery-fee').innerHTML = `<span class="text-green-600 font-black">مجاني 🎉</span>`; else document.getElementById('cart-delivery-fee').innerText = (selectedZone && selectedZone.price === 0) ? "يحدد لاحقاً" : `${finalDelivery} ج.م`; }
    if(document.getElementById('cart-total')) document.getElementById('cart-total').innerText = Math.round(finalTotal);

    const proceedBtn = document.getElementById('btn-proceed-checkout'); const checkoutBtn = document.getElementById('checkout-btn'); const checkoutHintStep1 = document.getElementById('checkout-hint'); const checkoutHintStep2 = document.getElementById('checkout-hint-step2'); const meetsMinOrder = subTotalPrice >= (globalSettings.minOrder || 0);

    if (proceedBtn) { if (totalItems > 0 && meetsMinOrder) { proceedBtn.disabled = false; if(checkoutHintStep1) checkoutHintStep1.classList.add('hidden'); } else { proceedBtn.disabled = true; if(totalItems > 0 && !meetsMinOrder && checkoutHintStep1) { checkoutHintStep1.innerText = `الحد الأدنى للطلب ${globalSettings.minOrder} ج.م`; checkoutHintStep1.classList.remove('hidden'); } } }

    if (checkoutBtn && checkoutHintStep2) {
        let validForm = false; const nameVal = document.getElementById('customer-name')?.value.trim(); const phoneVal = document.getElementById('customer-phone')?.value.trim();
        if (totalItems > 0 && deliverySelect && deliverySelect.value !== "" && meetsMinOrder) { if (nameVal && nameVal.length >= 3 && phoneVal && phoneVal.length >= 10) validForm = true; }
        checkoutBtn.disabled = !validForm; if(!validForm && totalItems > 0) checkoutHintStep2.classList.remove('hidden'); else checkoutHintStep2.classList.add('hidden');
    }
};

window.toggleCart = function() { 
    const sidebar = document.getElementById('cart-sidebar'); const overlay = document.getElementById('cart-overlay'); if(!sidebar || !overlay) return; 
    if (sidebar.classList.contains('translate-x-full')) { sidebar.classList.remove('translate-x-full'); overlay.classList.remove('hidden'); setTimeout(() => overlay.classList.remove('opacity-0'), 10); document.body.style.overflow = 'hidden'; backToCart(); } else { sidebar.classList.add('translate-x-full'); overlay.classList.add('opacity-0'); setTimeout(() => overlay.classList.add('hidden'), 300); document.body.style.overflow = ''; } 
};

window.showAlert = function(t, m) { 
    const iconCont = document.getElementById('alert-icon-container'); if(iconCont) { iconCont.className = "w-16 h-16 bg-brand-light text-brand-cyanDark rounded-full flex items-center justify-center mx-auto mb-4 text-3xl"; iconCont.classList.remove('hidden'); }
    const icon = document.getElementById('alert-icon'); if(icon) icon.className = "fa-solid fa-bell"; 
    const title = document.getElementById('alert-title'); if(title) { title.innerText = t; title.classList.remove('hidden'); }
    document.getElementById('alert-message').innerText = m; 
    const btn = document.querySelector('#alert-box button'); if(btn) { btn.className = "bg-brand-navy hover:opacity-90 text-white font-bold py-3 px-6 rounded-xl w-full transition-opacity"; btn.innerHTML = 'حسناً'; btn.onclick = closeAlert; btn.classList.remove('hidden'); }
    const md = document.getElementById('alert-modal'); md.classList.remove('hidden'); setTimeout(()=>md.classList.remove('opacity-0'),10); 
};
window.closeAlert = function() { document.getElementById('alert-modal').classList.add('opacity-0'); setTimeout(() => { document.getElementById('alert-modal').classList.add('hidden'); }, 300); };

window.openVipPreOrder = function(id) {
    const item = productsInfo[id];
    const msgHTML = `<div class="text-5xl mb-3">👑</div><div class="font-black text-brand-navy mb-2 text-xl">نفدت الكمية حالياً!</div><div class="text-sm text-gray-600 font-bold mb-4 leading-relaxed bg-brand-light/30 p-3 rounded-xl border border-brand-cyan/20">الدفعة الجديدة هتكون جاهزة قريب جداً.<br><br>تحب أسجلك معايا في قائمة الحجز وأأكدلك أوردرك؟</div><div onclick="sendVipWhatsApp('${item.name}')" class="w-full bg-green-500 hover:bg-green-600 text-white font-black py-3 px-4 rounded-xl transition-colors flex justify-center items-center gap-2 shadow-lg mb-2 cursor-pointer"><i class="fa-brands fa-whatsapp text-xl"></i> تأكيد الحجز المسبق</div>`;
    document.getElementById('alert-icon-container').classList.add('hidden'); document.getElementById('alert-title').classList.add('hidden'); document.getElementById('alert-message').innerHTML = msgHTML;
    const alertBtn = document.querySelector('#alert-box button'); if(alertBtn) { alertBtn.className = "text-gray-400 hover:text-gray-600 font-bold py-2 text-sm transition-colors underline w-full bg-transparent border-0 shadow-none"; alertBtn.innerHTML = 'لا شكراً، هشوف حاجة تانية'; }
    const md = document.getElementById('alert-modal'); md.classList.remove('hidden'); setTimeout(()=>md.classList.remove('opacity-0'),10);
};
window.sendVipWhatsApp = function(itemName) { const phone = globalSettings.storePhone || "01208027294"; let template = "السلام عليكم، أريد الانضمام لحجز ({اسم_المنتج}) من الدفعة القادمة."; window.location.href = `https://api.whatsapp.com/send?phone=20${phone}&text=${encodeURIComponent(template.replace(/{اسم_المنتج}/g, itemName))}`; closeAlert(); };

// --- إتمام الطلب وحفظ البيانات في الـ CRM ---
window.initiateCheckout = function() {
    if (globalSettings.crossSellActive && globalSettings.crossSellProductId && productsInfo[globalSettings.crossSellProductId] && !cart[globalSettings.crossSellProductId] && getAvailableStock(globalSettings.crossSellProductId) > 0) {
        const item = productsInfo[globalSettings.crossSellProductId]; document.getElementById('cross-sell-title').innerText = globalSettings.crossSellTitle || `جرب ${item.name}؟`; document.getElementById('cross-sell-desc').innerText = globalSettings.crossSellDesc || 'مغذي جداً للأطفال وطعمه حكاية!'; document.getElementById('cross-sell-price').innerText = globalPrices[globalSettings.crossSellProductId] || item.basePrice; document.getElementById('cross-sell-img').src = (item.images && item.images.length>0) ? item.images[0] : '';
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
    
    // سحب الدفعة اللي الزبون اختارها
    const batchSelect = document.getElementById('user-batch-select');
    const batchId = (batchSelect && batchSelect.value !== "") ? batchSelect.value : '';
    const batchName = (batchSelect && batchSelect.value !== "") ? batchSelect.options[batchSelect.selectedIndex].text : '';

    let customerName = document.getElementById('customer-name').value.trim(); 
    let customerPhone = document.getElementById('customer-phone').value.trim(); 
    let customerAddress = document.getElementById('customer-address').value.trim();

    if (customerName.length < 3 || !/^[\u0600-\u06FF\sA-Za-z]+$/.test(customerName)) { showAlert("تنبيه", "يرجى كتابة اسم صحيح وخالي من الأرقام والرموز."); checkoutBtn.innerHTML = originalBtnHtml; checkoutBtn.disabled = false; return; }

    if (appliedPromo && appliedPromo.customerPhone) {
        let phoneToMatch = appliedPromo.customerPhone.replace(/\D/g, '').slice(-10); let userPhone = customerPhone.replace(/\D/g, '').slice(-10);
        if (phoneToMatch !== userPhone && phoneToMatch !== '') { showAlert("تنبيه", "عفواً، كود الخصم هذا مخصص لرقم هاتف آخر."); checkoutBtn.innerHTML = originalBtnHtml; checkoutBtn.disabled = false; return; }
    }

    let subTotal = 0; let itemsStr = ""; let batchUpdates = {};
    for (let id in cart) {
        if(!productsInfo[id]) continue;
        if (cart[id].quantity > globalStock[id]) { showAlert("تنبيه", `المنتج ${productsInfo[id].name} لم يعد متوفر بهذه الكمية.`); checkoutBtn.innerHTML = originalBtnHtml; checkoutBtn.disabled = false; return; }
        const item = cart[id]; subTotal += (item.quantity * item.price);
        itemsStr += `▪ ${item.name} (${item.quantity})\n`;
        if(batchId) batchUpdates[id] = item.quantity;
    }

    let discountAmount = 0; 
    if (appliedPromo) {
        if(appliedPromo.type !== 'free_delivery') { discountAmount = appliedPromo.type === 'percent' ? (subTotal * (appliedPromo.discount / 100)) : appliedPromo.discount; if (appliedPromo.type === 'percent' && appliedPromo.maxDiscount > 0) discountAmount = Math.min(discountAmount, appliedPromo.maxDiscount); discountAmount = Math.round(Math.min(discountAmount, subTotal)); }
    }
    const totalAfterPromo = subTotal - discountAmount;
    let freeDelivery = (globalSettings.freeDeliveryActive && totalAfterPromo >= (globalSettings.freeDeliveryThreshold||0)) || (appliedPromo && appliedPromo.type === 'free_delivery');
    const finalDelivery = freeDelivery ? 0 : deliveryFee; const finalTotal = totalAfterPromo + finalDelivery;

    try {
        if (hasCloud && db) {
            const orderData = { 
                customerName, customerPhone, customerAddress: customerAddress||"غير محدد", zone: zoneName, 
                batchId: batchId, batchName: batchName, items: [], subtotal: subTotal, discount: discountAmount, 
                deliveryFee: finalDelivery, total: finalTotal, status: "new", usedPromo: appliedPromo ? appliedPromo.code : null, 
                orderDate: new Date().toLocaleDateString('ar-EG'), orderTime: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }), createdAt: firebase.firestore.FieldValue.serverTimestamp() 
            };
            for (let id in cart) orderData.items.push({ id, name: cart[id].name, quantity: cart[id].quantity, price: cart[id].price });
            
            let promises = [];
            promises.push(db.collection("orders").add(orderData));
            promises.push(db.collection('inventory').doc('stats').set({ sales: firebase.firestore.FieldValue.increment(finalTotal), orders: firebase.firestore.FieldValue.increment(1) }, { merge: true }));
            
            let cleanPhoneForDB = window.formatPhoneNumber(customerPhone);
            promises.push(db.collection("customers").doc(cleanPhoneForDB).set({ name: customerName, phone: cleanPhoneForDB, zone: zoneName, address: customerAddress || "", ordersCount: firebase.firestore.FieldValue.increment(1), totalSpent: firebase.firestore.FieldValue.increment(finalTotal), lastOrder: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true }));
            
            // الربط الذكي: تحديث عداد المحجوز في الدفعة لو الزبون مختارها
            if(batchId) {
                const batchRef = db.collection("inventory").doc("batches");
                const docSnap = await batchRef.get();
                if(docSnap.exists) {
                    let batchesData = docSnap.data();
                    if(batchesData[batchId]) {
                        if(!batchesData[batchId].booked) batchesData[batchId].booked = {};
                        Object.keys(batchUpdates).forEach(pId => {
                            batchesData[batchId].booked[pId] = (batchesData[batchId].booked[pId] || 0) + batchUpdates[pId];
                        });
                        promises.push(batchRef.update(batchesData));
                    }
                }
            }

            if (appliedPromo) {
                let pIndex = globalSettings.promoCodes.findIndex(p => p.code === appliedPromo.code);
                if (pIndex !== -1 && globalSettings.promoCodes[pIndex].usesLeft !== null) {
                    globalSettings.promoCodes[pIndex].usesLeft -= 1;
                    promises.push(db.collection("inventory").doc("settings").update({ promoCodes: globalSettings.promoCodes }));
                }
            }
            
            let stockUpdates = {}; for (let id in cart) stockUpdates[id] = firebase.firestore.FieldValue.increment(-cart[id].quantity); 
            promises.push(db.collection('inventory').doc('stock').update(stockUpdates));
            await Promise.all(promises);
        }
    } catch(e) { console.log("Sync Error", e); }

    cart = {}; saveCart(); appliedPromo = null; 
    document.getElementById('customer-name').value = ""; document.getElementById('customer-phone').value = ""; document.getElementById('customer-address').value = ""; document.getElementById('delivery-zone').value = ""; if(document.getElementById('user-batch-select')) document.getElementById('user-batch-select').value = "";
    updateUI(); const container = document.getElementById('products-container'); if(container) container.innerHTML = '<div class="text-center py-10 text-brand-cyanDark"><i class="fa-solid fa-spinner fa-spin text-3xl mb-3"></i><p class="font-bold text-sm">جاري التحديث...</p></div>'; renderProducts(); toggleCart(); checkoutBtn.innerHTML = originalBtnHtml; checkoutBtn.disabled = false;

    let bodyText = `أوردرك اتسجل في السيستم. ${batchId ? `ميعاد استلامك المحجوز: ${batchName}` : 'هيتم تجهيز الأوردر قريب.'}`;
    const msgHTML = `
        <div dir="rtl" class="w-full block clear-both" style="font-family: 'Cairo', sans-serif; text-align: right; direction: rtl;">
            <div class="text-center w-full mb-2"><div class="w-14 h-14 bg-green-100 text-green-500 rounded-full flex items-center justify-center mx-auto text-2xl shadow-sm"><i class="fa-solid fa-check"></i></div><h3 class="font-black text-brand-navy mt-2 text-base md:text-lg">تم تأكيد أوردرك بنجاح! 🎉</h3></div>
            <div class="text-xs md:text-sm font-bold text-green-800 leading-relaxed bg-[#f0fdf4] p-3 rounded-xl border border-green-200 block w-full mb-4 shadow-inner text-center">${bodyText}</div>
            <button onclick="closeAlert()" class="w-full bg-[#25D366] hover:bg-[#1ebd57] text-white font-black py-3 px-4 rounded-xl transition-all shadow-md text-center">شكراً 👍</button>
        </div>`;
    
    document.getElementById('alert-icon-container').classList.add('hidden'); document.getElementById('alert-title').classList.add('hidden'); 
    const alertMsg = document.getElementById('alert-message'); if(alertMsg) { alertMsg.className = "w-full block p-0 m-0"; alertMsg.innerHTML = msgHTML; }
    document.querySelector('#alert-box button').classList.add('hidden');
    const md = document.getElementById('alert-modal'); if(md) { md.classList.remove('hidden'); setTimeout(() => md.classList.remove('opacity-0'), 10); }
};

window.formatPhoneNumber = function(phone) {
    if(!phone) return ''; const arabicNumbers = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
    let cleaned = phone.replace(/[٠-٩]/g, w => arabicNumbers.indexOf(w)); cleaned = cleaned.replace(/\D/g, '');
    if (cleaned.startsWith('201') && cleaned.length === 12) cleaned = '0' + cleaned.substring(2); return cleaned;
};

let phoneTimeout;
document.addEventListener('DOMContentLoaded', () => {
    const phoneInput = document.getElementById('customer-phone');
    if(phoneInput) {
        phoneInput.addEventListener('input', function(e) {
            clearTimeout(phoneTimeout); let cleanPhone = formatPhoneNumber(e.target.value);
            if(cleanPhone.length >= 10) phoneTimeout = setTimeout(() => { checkCustomerLoyalty(cleanPhone); }, 800); else hideCustomerWelcome();
        });
    }
});

window.checkCustomerLoyalty = async function(cleanPhone) {
    if(!hasCloud || !db) return;
    try {
        const doc = await db.collection('customers').doc(cleanPhone).get();
        if(doc.exists && doc.data().lastOrder && !doc.data().imported) {
            const data = doc.data();
            if(data.name) document.getElementById('customer-name').value = data.name;
            if(data.address && document.getElementById('customer-address')) document.getElementById('customer-address').value = data.address;
            if(data.zone && document.getElementById('delivery-zone')) { document.getElementById('delivery-zone').value = data.zone; renderDeliveryZones(); }
            let firstName = data.name.split(' ')[0]; showCustomerWelcome(`أهلاً بيك مرة تانية يا ${firstName}! 👑 جهزنا بياناتك.`, 'bg-green-50', 'text-green-700', 'border-green-200'); updateUI();
        } else { showCustomerWelcome(`نورت عيلة سمان ههيا! ✨ كمل بياناتك عشان تتسجل في الـ VIP.`, 'bg-blue-50', 'text-blue-700', 'border-blue-200'); }
    } catch(e) { console.log("Customer lookup error", e); }
};

window.showCustomerWelcome = function(text, bgColor, textColor, borderColor) {
    let msgEl = document.getElementById('smart-welcome-msg');
    if(!msgEl) { msgEl = document.createElement('div'); msgEl.id = 'smart-welcome-msg'; const nameInput = document.getElementById('customer-name'); nameInput.parentNode.insertBefore(msgEl, nameInput); }
    msgEl.className = `p-3 mb-4 rounded-xl border text-xs font-black shadow-sm transition-all duration-300 ${bgColor} ${textColor} ${borderColor}`; msgEl.innerHTML = text; msgEl.classList.remove('hidden');
};
window.hideCustomerWelcome = function() { const msgEl = document.getElementById('smart-welcome-msg'); if(msgEl) msgEl.classList.add('hidden'); };
