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

    // تطبيق المربعات الأربعة من config
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

// --- ميزة تكبير الصور (Lightbox) ---
window.openLightbox = function(imgSrc) {
    if (!imgSrc) return;
    let modal = document.getElementById('custom-lightbox');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'custom-lightbox';
        modal.className = 'fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center p-4 opacity-0 pointer-events-none transition-opacity duration-300';
        modal.innerHTML = `
            <button onclick="closeLightbox()" class="absolute top-4 right-4 text-white hover:text-red-500 text-4xl font-black z-50">&times;</button>
            <img id="lightbox-image" src="" class="max-w-full max-h-full object-contain rounded-lg shadow-2xl transform scale-95 transition-transform duration-300">
        `;
        document.body.appendChild(modal);
    }
    
    document.getElementById('lightbox-image').src = imgSrc;
    modal.classList.remove('opacity-0', 'pointer-events-none');
    
    setTimeout(() => {
        document.getElementById('lightbox-image').classList.remove('scale-95');
        document.getElementById('lightbox-image').classList.add('scale-100');
    }, 10);
};

window.closeLightbox = function() {
    const modal = document.getElementById('custom-lightbox');
    if (modal) {
        modal.classList.add('opacity-0', 'pointer-events-none');
        document.getElementById('lightbox-image').classList.remove('scale-100');
        document.getElementById('lightbox-image').classList.add('scale-95');
    }
};

// --- تشغيل الميزات المرئية الذكية (سلايدر، شريط أخبار، إشعارات) ---
window.currentSlide = 0;
window.sliderImages = [];

window.moveSlider = function(direction) {
    if (!window.sliderImages || window.sliderImages.length <= 1) return;
    window.currentSlide = (window.currentSlide + direction + window.sliderImages.length) % window.sliderImages.length;
    window.updateSliderView();
};

window.updateSliderView = function() {
    const track = document.getElementById('slider-track');
    if(track) track.style.transform = `translateX(${window.currentSlide * 100}%)`;
    
    const dots = document.querySelectorAll('.slider-dot');
    dots.forEach((dot, index) => {
        dot.className = `slider-dot h-2 w-2 rounded-full transition-all duration-300 shadow-sm cursor-pointer ${index === window.currentSlide ? 'active' : 'bg-gray-300'}`;
    });
};

function renderSlider() {
    const track = document.getElementById('slider-track');
    const dotsContainer = document.getElementById('slider-dots');
    if(!track || !dotsContainer) return;
    
    const images = globalSettings.galleryImages || ["all-sizes.jpg"];
    window.sliderImages = images; 
    
    track.innerHTML = '';
    dotsContainer.innerHTML = '';
    
    // لو مفيش صور خالص
    if(images.length === 0) {
        track.innerHTML += `<div class="w-full shrink-0 h-64 bg-gray-100"><img src="" class="w-full h-full object-cover object-center" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\'><rect width=\\'100%\\' height=\\'100%\\' fill=\\'%23f1f5f9\\'/></svg>'"></div>`;
    }

    // رسم الصور والنقط (مع إضافة ميزة التكبير عند الضغط)
    images.forEach((img, idx) => {
        track.innerHTML += `<div class="w-full shrink-0 h-64 bg-white flex items-center justify-center cursor-pointer overflow-hidden" onclick="openLightbox('${img}')">
            <img src="${img}" class="w-full h-full object-contain hover:scale-105 transition-transform duration-300" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\'><rect width=\\'100%\\' height=\\'100%\\' fill=\\'%23f1f5f9\\'/></svg>'">
        </div>`;
        
        // إخفاء النقط لو هي صورة واحدة بس
        if (images.length > 1) {
            dotsContainer.innerHTML += `<div class="slider-dot h-2 w-2 rounded-full transition-all duration-300 ${idx===0 ? 'active' : 'bg-gray-300'} shadow-sm cursor-pointer" onclick="event.stopPropagation(); window.currentSlide=${idx}; window.updateSliderView();"></div>`;
        }
    });
    
    // إخفاء زراير التقليب لو صورة واحدة
    const rightBtn = document.querySelector('button[onclick="moveSlider(-1)"]');
    const leftBtn = document.querySelector('button[onclick="moveSlider(1)"]');
    if (images.length <= 1) {
        if(rightBtn) rightBtn.classList.add('hidden');
        if(leftBtn) leftBtn.classList.add('hidden');
    } else {
        if(rightBtn) rightBtn.classList.remove('hidden');
        if(leftBtn) leftBtn.classList.remove('hidden');
    }

    window.currentSlide = 0;
    window.updateSliderView();
    
    // تفعيل السحب بالإصبع (Touch Swipe) للموبايل
    let touchStartX = 0; let touchEndX = 0;
    const sliderViewport = document.getElementById('slider-viewport');
    if(sliderViewport) {
        sliderViewport.ontouchstart = e => { touchStartX = e.changedTouches[0].screenX; };
        sliderViewport.ontouchend = e => { 
            touchEndX = e.changedTouches[0].screenX; 
            if(touchEndX < touchStartX - 30) window.moveSlider(-1); 
            if(touchEndX > touchStartX + 30) window.moveSlider(1);  
        };
    }
}

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
        
        setTimeout(() => {
            noti.classList.add('translate-y-20', 'opacity-0');
        }, 5000); 
    }

    setTimeout(() => {
        showRandomNoti();
        setInterval(showRandomNoti, 25000);
    }, 10000);
}

// --- تطبيق الإعدادات العامة على الواجهة ---
function applySettingsToUI() {
    const savedNavy = localStorage.getItem('theme_navy');
    if(savedNavy) document.documentElement.style.setProperty('--brand-navy', savedNavy);

    renderMarquee();
    renderSlider();

    document.getElementById('header-store-name').innerText = globalSettings.storeName || 'سمان ههيا'; 
    const descEl = document.getElementById('header-store-desc');
    if(descEl) {
        descEl.innerText = globalSettings.storeDesc || 'صحي وطازة'; 
        descEl.classList.remove('hidden'); 
    }
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
        if(msg) { 
            msg.classList.remove('hidden'); 
            const msgDiv = msg.querySelector('div');
            if(msgDiv) msgDiv.innerText = globalSettings.closedMessage || 'المتجر مغلق حالياً، نعود قريباً!';
        } 
        if(mainCartBtn) mainCartBtn.disabled = true; 
    } else { 
        if(wrapper) wrapper.classList.remove('opacity-50', 'pointer-events-none'); 
        if(msg) msg.classList.add('hidden'); 
        if(mainCartBtn) mainCartBtn.disabled = false; 
    }

    const minWarn = document.getElementById('min-order-warning');
    if (globalSettings.minOrder > 0) { 
        const minValEl = document.getElementById('min-order-value');
        if(minValEl) minValEl.innerText = globalSettings.minOrder; 
        if(minWarn) minWarn.classList.remove('hidden'); 
    } else { 
        if(minWarn) minWarn.classList.add('hidden'); 
    }

    const promoContainer = document.getElementById('promo-input-container');
    if(promoContainer) { 
        if(globalSettings.showPromoField !== false) promoContainer.classList.remove('hidden'); 
        else { 
            promoContainer.classList.add('hidden'); 
            if(appliedPromo && !appliedPromo.isLoyalty) appliedPromo = null; 
        } 
    }

    applyUITexts();
}

function renderDeliveryZones() {
    const select = document.getElementById('delivery-zone'); 
    if (!select) return;
    const currentVal = select.value; 
    select.innerHTML = '<option value="" disabled selected>اختر منطقتك لحساب الشحن...</option>';
    
    globalDeliveryZones.forEach(zone => {
        const option = document.createElement('option'); 
        option.value = zone.id;
        option.textContent = zone.price === 0 ? `${zone.name} (يحدد لاحقاً)` : `${zone.name} (${zone.price} جنيه)`; 
        select.appendChild(option);
    });
    if (currentVal && globalDeliveryZones.find(z => z.id === currentVal)) select.value = currentVal;
}

// --- بداية تشغيل الموقع ---
document.addEventListener('DOMContentLoaded', () => { 
    renderDeliveryZones(); 
    loadCart(); 
    setupEventListeners(); 
    initFirebase(); 
    setTimeout(() => { 
        if(!isStoreDataLoaded) { 
            isStoreDataLoaded = true; 
            Object.keys(productsInfo).forEach(id => { 
                if(globalStock[id] === undefined) globalStock[id] = 0; 
                if(globalPrices[id] === undefined) globalPrices[id] = productsInfo[id].basePrice; 
            }); 
            renderProducts(); 
            applySettingsToUI(); 
            startLiveNotifications();
        } 
    }, 3000);
});

window.setupEventListeners = function() {
    const ids = ['customer-name', 'customer-phone'];
    ids.forEach(id => { const el = document.getElementById(id); if(el) el.addEventListener('input', updateUI); });
    const dZone = document.getElementById('delivery-zone');
    if (dZone) dZone.addEventListener('change', updateUI);
    
    const pInput = document.getElementById('promo-code-input');
    if (pInput) {
        pInput.addEventListener('input', () => { 
            if (appliedPromo && !appliedPromo.isLoyalty && pInput.value.trim() === '') { 
                appliedPromo = null; 
                document.getElementById('promo-message').classList.add('hidden'); 
                updateUI(); 
            } 
        });
    }
}

// --- تهيئة Firebase ---
function initFirebase() {
    const firebaseConfig = { 
        apiKey: "AIzaSyD7ZJP8n8fhMewPfEsTBANn0h9To_q15BY", 
        authDomain: "sman-ca8f8.firebaseapp.com", 
        projectId: "sman-ca8f8", 
        storageBucket: "sman-ca8f8.firebasestorage.app", 
        messagingSenderId: "538778803310", 
        appId: "1:538778803310:web:5eeff42bae534375a21a7f" 
    };
    try { 
        if (!firebase.apps.length) { firebase.initializeApp(firebaseConfig); }
        db = firebase.firestore(); 
        firebase.auth().signInAnonymously().catch(() => {}); 
        firebase.auth().onAuthStateChanged(user => { 
            if(user) { hasCloud = true; listenToDatabase(); } 
        }); 
    } catch (e) { console.log("Firebase Error", e); }
}

function listenToDatabase() {
    if(!db) return;
    db.collection('inventory').doc('settings').onSnapshot(doc => { 
        if(doc.exists) { 
            const data = doc.data(); 
            if(data.productsData) productsInfo = data.productsData; 
            Object.assign(globalSettings, data); 
            if(data.deliveryZones) globalDeliveryZones = data.deliveryZones; 
            applySettingsToUI(); 
            renderDeliveryZones(); 
            updateUI(); 
        } 
    });
    db.collection('inventory').doc('prices').onSnapshot(doc => { if(doc.exists) { Object.assign(globalPrices, doc.data()); renderProducts(); } });
    db.collection('inventory').doc('discounts_status').onSnapshot(doc => { if(doc.exists) { Object.assign(globalDiscounts, doc.data()); renderProducts(); } });
    db.collection('inventory').doc('old_prices').onSnapshot(doc => { if(doc.exists) { Object.assign(globalOldPrices, doc.data()); renderProducts(); } });
    db.collection('inventory').doc('stock').onSnapshot(doc => { 
        if(doc.exists) { 
            Object.assign(globalStock, doc.data()); 
            isStoreDataLoaded = true;
            renderProducts(); 
            updateUI(); 
        } 
    });
    db.collection('inventory').doc('stats').onSnapshot(doc => { 
        if(doc.exists) { 
            dailyStats = doc.data(); 
            if(document.getElementById('stat-sales')) document.getElementById('stat-sales').innerText = dailyStats.sales || 0; 
            if(document.getElementById('stat-orders')) document.getElementById('stat-orders').innerText = dailyStats.orders || 0; 
        } 
    });
}

// --- نظام الكوبونات والخصم ---
window.applyPromoCode = function() {
    const input = document.getElementById('promo-code-input').value.trim().toUpperCase(); 
    const msg = document.getElementById('promo-message'); 
    if (input === '') return;
    
    let subTotal = 0; 
    for (let id in cart) subTotal += cart[id].quantity * (globalPrices[id] || productsInfo[id].basePrice);
    
    const promo = (globalSettings.promoCodes || []).find(p => p.code.toUpperCase() === input);
    
    if (!promo) { msg.innerText = "كود غير صحيح."; msg.className = "text-[11px] font-bold mt-1 text-red-500"; msg.classList.remove('hidden'); return; }
    if (promo.usesLeft !== null && promo.usesLeft !== undefined && promo.usesLeft <= 0) { msg.innerText = "عفواً، تم استخدام هذا الكود من قبل."; msg.className = "text-[11px] font-bold mt-1 text-red-500"; msg.classList.remove('hidden'); return; }
    if (promo.expiryDate && new Date(promo.expiryDate) < new Date(new Date().toDateString())) { msg.innerText = "عفواً، هذا الكود منتهي الصلاحية."; msg.className = "text-[11px] font-bold mt-1 text-red-500"; msg.classList.remove('hidden'); return; }
    if (promo.minOrder && subTotal < promo.minOrder) { msg.innerText = `عشان تفعل الكود ده، لازم طلباتك تتخطى ${promo.minOrder} ج.م`; msg.className = "text-[11px] font-bold mt-1 text-red-500"; msg.classList.remove('hidden'); return; }
    
    appliedPromo = { ...promo, isLoyalty: false }; 
    msg.innerText = "تم تفعيل كود الخصم بنجاح 🎉"; 
    msg.className = "text-[11px] font-bold mt-1 text-green-600"; 
    msg.classList.remove('hidden'); 
    updateUI();
};

// --- محرك عرض المنتجات ---
window.renderProducts = function() {
    if(!isStoreDataLoaded) return; 
    const container = document.getElementById('products-container'); 
    const extrasContainer = document.getElementById('extras-container'); 
    if(!container || !extrasContainer) return;

    container.innerHTML = ''; 
    extrasContainer.innerHTML = ''; 
    let mainProductsCount = 0;

    Object.keys(productsInfo).forEach(id => {
        const item = productsInfo[id]; 
        if(item.isVisible === false) return; 

        const available = getAvailableStock(id); 
        const currentPrice = globalPrices[id] || item.basePrice; 
        const oldPrice = globalOldPrices[id]; 
        const isDiscountActive = globalDiscounts[id];
        const isBestSeller = globalSettings.bestSellers && globalSettings.bestSellers.includes(id); 
        const stockBadgeClass = available <= 10 ? (available === 0 ? 'bg-red-50 text-red-600' : 'bg-orange-50 text-orange-600') : 'bg-green-50 text-green-700';
        
        let priceHtml = ''; let saleBadgeHtml = '';
        if (isDiscountActive) { 
            saleBadgeHtml = `<div class="absolute top-2 right-2 bg-red-500 text-white text-[10px] font-black px-3 py-1 rounded-full shadow-lg sale-badge z-10"><i class="fa-solid fa-tag"></i> عرض</div>`; 
            priceHtml = `<div class="flex flex-col"><span class="text-[11px] text-gray-400 line-through decoration-red-500 font-bold">${oldPrice} ج.م</span><span class="font-black text-red-600 text-xl">${currentPrice} <span class="text-[10px] text-gray-500">ج.م</span></span></div>`; 
        } else {
            priceHtml = `<span class="font-black text-brand-cyanDark text-lg">${currentPrice} <span class="text-[10px] text-gray-400">ج.م</span></span>`;
        }

        let bestSellerHtml = isBestSeller ? `<div class="absolute bottom-2 right-2 bg-brand-navy text-brand-yellow text-[10px] font-black px-2 py-1 rounded shadow z-10 border border-brand-yellow/30">الأكثر طلباً 🔥</div>` : ''; 
        const imgSrc = (item.images && item.images.length > 0) ? item.images[0] : '';
        
        let customTagHtml = '';
        if(item.tag === 'new') customTagHtml = `<span class="bg-blue-100 text-blue-700 text-[10px] font-black px-1.5 py-0.5 rounded border border-blue-200">🆕 جديد</span>`;
        else if(item.tag === 'hot') customTagHtml = `<span class="bg-orange-100 text-orange-700 text-[10px] font-black px-1.5 py-0.5 rounded border border-orange-200">🔥 قرب يخلص</span>`;
        else if(item.tag === 'offer') customTagHtml = `<span class="bg-purple-100 text-purple-700 text-[10px] font-black px-1.5 py-0.5 rounded border border-purple-200">⏱ عرض محدود</span>`;

        // إكمال تصميم الكارت اللي كان مقطوع وتعديل مساحة الصورة
        const cardHTML = `
            <div class="bg-white rounded-2xl shadow-sm border ${isDiscountActive ? 'border-red-200' : 'border-gray-200'} overflow-hidden flex flex-row h-[130px] relative transition-transform hover:shadow-md">
                
                <div class="w-[120px] sm:w-[140px] shrink-0 h-full relative bg-gray-50 border-l border-gray-100 cursor-pointer overflow-hidden group" onclick="openLightbox('${imgSrc}')">
                    ${saleBadgeHtml}
                    ${bestSellerHtml}
                    <img src="${imgSrc}" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\'><rect width=\\'100%\\' height=\\'100%\\' fill=\\'%23f1f5f9\\'/></svg>'">
                    <div class="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <i class="fa-solid fa-magnifying-glass text-white text-xl"></i>
                    </div>
                </div>

                <div class="p-3 flex-1 flex flex-col justify-between bg-white min-w-0">
                    <div>
                        <div class="flex gap-1 items-center mb-1">
                            <h3 class="text-sm md:text-base font-black text-brand-navy truncate">${item.name}</h3>
                            ${customTagHtml}
                        </div>
                        <div class="text-xs text-gray-500 line-clamp-2">
                            ${item.description || 'منتج طازج وممتاز'}
                        </div>
                    </div>
                    
                    <div class="flex items-end justify-between mt-2">
                        ${priceHtml}
                        
                        <button onclick="addToCart('${id}')" class="bg-brand-navy text-white text-xs px-3 py-1.5 rounded-lg font-bold hover:bg-opacity-90 transition-colors">
                            أضف للسلة
                        </button>
                    </div>
                </div>
            </div>`;
            
        // وضع المنتج في القسم المناسب (افتراضاً المنتجات الرئيسية، ويمكنك تعديلها حسب الـ category)
        if (item.category === 'extras') {
            extrasContainer.innerHTML += cardHTML;
        } else {
            container.innerHTML += cardHTML;
            mainProductsCount++;
        }
    });
};
