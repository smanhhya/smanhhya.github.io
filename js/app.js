// js/app.js

// --- تهيئة المتغيرات الأساسية ---
let cart = {};
let productsInfo = {};
let globalPrices = {};
let globalStock = {};
let globalOldPrices = {};
let globalDiscounts = {};
let globalSettings = {
    storeName: "سمان ههيا",
    storePhone: "01208027294",
    storeOpen: true,
    minOrder: 0,
    freeDeliveryActive: false,
    freeDeliveryThreshold: 0,
    promoCodes: [],
    uiTexts: {}
};
let globalDeliveryZones = [];
let appliedPromo = null;
let isStoreDataLoaded = false;
let db = null;
let hasCloud = false;
let dailyStats = { sales: 0, orders: 0 };
const WEB3FORMS_ACCESS_KEY = "64619920-5c68-45b1-873b-e018659d8738"; // مفتاحك الحالي

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

// --- تطبيق نصوص الواجهة (القاموس) ---
function applyUITexts() {
    const t = globalSettings.uiTexts || {};
    // قائمة النصوص الافتراضية
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
}

// --- تطبيق الإعدادات العامة على الواجهة ---
function applySettingsToUI() {
    // الألوان الديناميكية
    const savedNavy = localStorage.getItem('theme_navy');
    if(savedNavy) document.documentElement.style.setProperty('--brand-navy', savedNavy);

    const banner = document.getElementById('top-banner');
    if (globalSettings.bannerActive && globalSettings.bannerText && globalSettings.bannerText.trim() !== '') { 
        document.getElementById('top-banner-text').innerText = globalSettings.bannerText; 
        banner.classList.remove('hidden'); 
    } else { 
        banner.classList.add('hidden'); 
    }

    document.getElementById('header-store-name').innerText = globalSettings.storeName || 'سمان ههيا'; 
    document.getElementById('header-store-desc').innerText = globalSettings.storeDesc || 'صحي وطازة'; 
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
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }
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
    db.collection('inventory').doc('stock').onSnapshot(doc => { 
        if(doc.exists) { 
            Object.assign(globalStock, doc.data()); 
            isStoreDataLoaded = true;
            renderProducts(); 
            updateUI(); 
        } 
    });
}

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
        const isBestSeller = globalSettings.bestSellers && globalSettings.bestSellers.includes(id); 
        const stockBadgeClass = available <= 10 ? (available === 0 ? 'bg-red-50 text-red-600' : 'bg-orange-50 text-orange-600') : 'bg-green-50 text-green-700';
        
        let priceHtml = `<span class="font-black text-brand-navy text-lg"><span id="price-display-${id}">${currentPrice}</span> <span class="text-[10px] text-gray-400">ج.م</span></span>`;
        let bestSellerHtml = isBestSeller ? `<div class="absolute bottom-2 right-2 bg-brand-navy text-brand-yellow text-[10px] font-black px-2 py-1 rounded shadow z-10 border border-brand-yellow/30">الأكثر طلباً 🔥</div>` : ''; 
        const imgSrc = (item.images && item.images.length > 0) ? item.images[0] : '';
        
        // الأوسمة المخصصة (جديد، عرض، إلخ)
        let customTagHtml = '';
        if(item.tag === 'new') customTagHtml = `<span class="bg-blue-100 text-blue-700 text-[10px] font-black px-1.5 py-0.5 rounded border border-blue-200">🆕 جديد</span>`;
        else if(item.tag === 'hot') customTagHtml = `<span class="bg-orange-100 text-orange-700 text-[10px] font-black px-1.5 py-0.5 rounded border border-orange-200">🔥 قرب يخلص</span>`;

        const cardHTML = `
            <div class="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-row h-[130px] relative transition-transform hover:shadow-md">
                <div class="p-3 flex-1 flex flex-col justify-between bg-white min-w-0">
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
                        <div class="text-[10px] font-bold px-1.5 py-0.5 rounded border ${stockBadgeClass} shrink-0">المتاح: ${available}</div>
                        <div class="w-28 shrink-0">${getCardActionHTML(id)}</div>
                    </div>
                </div>
                <div class="w-32 shrink-0 relative bg-gray-50 border-r border-gray-100">
                    ${bestSellerHtml}
                    <img loading="lazy" src="${imgSrc}" class="w-full h-full object-cover">
                </div>
            </div>`;

        if (!item.isExtra) { 
            mainProductsCount++; 
            container.innerHTML += cardHTML; 
        } else {
            extrasContainer.innerHTML += cardHTML;
        }
    });
    
    if(mainProductsCount === 0) container.innerHTML = `<div class="text-center py-10 text-gray-400 font-bold">${globalSettings.uiTexts?.emptyMenuMsg || "لا توجد منتجات حالياً"}</div>`;
};

// --- منطق السلة والكميات ---
window.getCardActionHTML = function(id) {
    if (globalSettings.storeOpen === false) return `<div class="w-full bg-gray-100 text-gray-400 font-bold py-2 rounded-xl text-xs text-center">مغلق</div>`;
    const inCart = cart[id]?.quantity || 0; 
    const available = getAvailableStock(id);
    
    if (available === 0 && inCart === 0) {
        return `<div onclick="openVipPreOrder('${id}')" class="w-full bg-brand-yellow text-brand-navy font-black py-2 rounded-xl text-[10px] flex justify-center items-center gap-1 cursor-pointer shadow-sm"><i class="fa-solid fa-crown"></i> حجز VIP</div>`;
    }
    if (inCart > 0) {
        return `
            <div class="flex items-center justify-between bg-brand-light border border-brand-navy/10 rounded-xl p-1 h-[36px]">
                <div onclick="updateQuantity('${id}', 1)" class="w-8 h-full bg-white text-brand-navy rounded-lg shadow-sm font-black text-lg flex items-center justify-center cursor-pointer select-none">+</div>
                <span class="font-black text-brand-navy text-sm min-w-[20px] text-center">${inCart}</span>
                <div onclick="updateQuantity('${id}', -1)" class="w-8 h-full bg-white text-red-500 rounded-lg shadow-sm font-black text-xl flex items-center justify-center cursor-pointer select-none">-</div>
            </div>`;
    }
    return `<div onclick="addToCart('${id}')" class="w-full bg-brand-navy text-white font-black py-2 rounded-xl text-xs flex justify-center items-center gap-2 cursor-pointer shadow-sm hover:opacity-90"><i class="fa-solid fa-plus"></i> إضافة</div>`;
}

window.addToCart = function(id) { 
    if (globalSettings.storeOpen === false) return; 
    if (getAvailableStock(id) <= 0) { showAlert("عذراً", "الكمية المتاحة لا تكفي حالياً."); return; } 
    if (cart[id]) cart[id].quantity++; 
    else cart[id] = { quantity: 1, price: globalPrices[id] || productsInfo[id].basePrice, name: productsInfo[id].name }; 
    saveCart(); 
    updateUI(); 
    renderProducts(); 
};

window.updateQuantity = function(id, delta) { 
    if (!cart[id] || globalSettings.storeOpen === false) return; 
    if (delta === 1) { 
        if (getAvailableStock(id) > 0) cart[id].quantity++; 
        else showAlert("عذراً", "لا يوجد مخزون إضافي متاح."); 
    } else if (delta === -1) { 
        cart[id].quantity--; 
        if (cart[id].quantity <= 0) delete cart[id]; 
    } 
    saveCart(); 
    updateUI(); 
    renderProducts(); 
};

// --- تحديث واجهة السلة وحساب الحسابات ---
window.updateUI = function() {
    let totalItems = 0, subTotalPrice = 0; 
    const cartItemsContainer = document.getElementById('cart-items'); 
    if(cartItemsContainer) cartItemsContainer.innerHTML = '';
    
    for (let id in cart) {
        if (!productsInfo[id]) { delete cart[id]; continue; }
        const item = cart[id]; 
        totalItems += item.quantity; 
        subTotalPrice += item.quantity * item.price;
        if(cartItemsContainer) {
            cartItemsContainer.innerHTML += `
                <div class="bg-white p-3 rounded-xl border border-gray-100 flex justify-between items-center shadow-sm">
                    <div class="flex-1">
                        <h4 class="font-bold text-brand-navy text-xs">${item.name}</h4>
                        <div class="text-brand-navy font-black text-sm">${item.price} ج.م</div>
                    </div>
                    <div class="flex items-center gap-2 bg-gray-50 rounded-lg p-1 border border-gray-200">
                        <div onclick="updateQuantity('${id}', 1)" class="w-8 h-8 bg-white text-brand-navy rounded shadow-sm font-black flex items-center justify-center cursor-pointer">+</div>
                        <span class="font-black text-brand-navy text-sm">${item.quantity}</span>
                        <div onclick="updateQuantity('${id}', -1)" class="w-8 h-8 bg-white text-red-500 rounded shadow-sm font-black flex items-center justify-center cursor-pointer">-</div>
                    </div>
                </div>`;
        }
    }

    // شريط السلة السفلي
    const bottomBar = document.getElementById('bottom-cart-bar');
    if(bottomBar) { 
        document.getElementById('bottom-cart-total').innerText = subTotalPrice; 
        document.getElementById('bottom-cart-count').innerText = totalItems; 
        if (totalItems > 0) bottomBar.classList.remove('translate-y-full'); 
        else bottomBar.classList.add('translate-y-full'); 
    }

    // مؤشر التوصيل المجاني
    const tracker = document.getElementById('free-delivery-tracker');
    if (globalSettings.freeDeliveryActive && totalItems > 0) { 
        tracker.classList.remove('hidden'); 
        let threshold = globalSettings.freeDeliveryThreshold || 0;
        let remaining = Math.max(0, threshold - subTotalPrice); 
        document.getElementById('fd-progress').style.width = Math.min(100, (subTotalPrice / threshold) * 100) + '%'; 
        const fdRemaining = document.getElementById('fd-remaining');
        if(fdRemaining) fdRemaining.innerText = remaining;
    } else {
        if(tracker) tracker.classList.add('hidden');
    }

    // الحساب النهائي
    const deliverySelect = document.getElementById('delivery-zone');
    const selectedZone = globalDeliveryZones.find(z => z.id === deliverySelect?.value);
    const deliveryFee = selectedZone ? selectedZone.price : 0;
    const isFree = (globalSettings.freeDeliveryActive && subTotalPrice >= globalSettings.freeDeliveryThreshold);
    const finalDelivery = isFree ? 0 : deliveryFee;
    
    document.getElementById('cart-subtotal').innerText = subTotalPrice;
    document.getElementById('cart-step1-total').innerText = subTotalPrice;
    document.getElementById('cart-delivery-fee').innerText = isFree ? "مجاني 🎉" : `${finalDelivery} ج.م`;
    document.getElementById('cart-total').innerText = subTotalPrice + finalDelivery;

    // تفعيل زر المتابعة
    const proceedBtn = document.getElementById('btn-proceed-checkout');
    if(proceedBtn) proceedBtn.disabled = !(totalItems > 0 && subTotalPrice >= (globalSettings.minOrder || 0));
}

// --- نظام الـ VIP والواتساب ---
window.openVipPreOrder = function(id) {
    const item = productsInfo[id];
    const msgHTML = `
        <div class="text-5xl mb-3">👑</div>
        <div class="font-black text-brand-navy mb-2 text-xl">نفدت الكمية!</div>
        <div class="text-sm text-gray-600 font-bold mb-4 bg-brand-light p-3 rounded-xl border">
            الدفعة الجديدة من <strong>(${item.name})</strong> قربت تجهز.<br>تحب تحجز مكانك في قائمة الـ VIP؟
        </div>
        <button onclick="sendVipWhatsApp('${item.name}')" class="w-full bg-green-500 text-white font-black py-3 rounded-xl flex justify-center items-center gap-2 shadow-lg mb-2">
            <i class="fa-brands fa-whatsapp"></i> حجز عبر واتساب
        </button>`;
    
    document.getElementById('alert-message').innerHTML = msgHTML;
    document.getElementById('alert-title').innerText = "";
    const md = document.getElementById('alert-modal'); 
    md.classList.remove('hidden'); 
    setTimeout(()=>md.classList.remove('opacity-0'),10);
};

window.sendVipWhatsApp = function(itemName) { 
    const phone = globalSettings.storePhone || "01208027294"; 
    const message = `السلام عليكم، أريد حجز طبق (${itemName}) من الدفعة القادمة. 👑`; 
    window.open(`https://wa.me/20${phone}?text=${encodeURIComponent(message)}`, '_blank');
    closeAlert(); 
};

// --- إدارة النوافذ المنبثقة ---
window.toggleCart = function() { 
    const sidebar = document.getElementById('cart-sidebar'); 
    const overlay = document.getElementById('cart-overlay'); 
    if (sidebar.classList.contains('translate-x-full')) { 
        sidebar.classList.remove('translate-x-full'); 
        overlay.classList.remove('hidden'); 
        setTimeout(() => overlay.classList.remove('opacity-0'), 10); 
    } else { 
        sidebar.classList.add('translate-x-full'); 
        overlay.classList.add('opacity-0'); 
        setTimeout(() => overlay.classList.add('hidden'), 300); 
    } 
};

window.showAlert = function(t, m) { 
    document.getElementById('alert-title').innerText=t; 
    document.getElementById('alert-message').innerText=m; 
    const md=document.getElementById('alert-modal'); 
    md.classList.remove('hidden'); 
    setTimeout(()=>md.classList.remove('opacity-0'),10); 
};

window.closeAlert = function() { 
    document.getElementById('alert-modal').classList.add('opacity-0'); 
    setTimeout(() => document.getElementById('alert-modal').classList.add('hidden'), 300); 
};

// --- تشغيل النظام ---
document.addEventListener('DOMContentLoaded', () => { 
    initFirebase(); 
    loadCart(); 
    applySettingsToUI();
});
