// js/app.js
// المتغيرات الأساسية (cart, productsInfo, globalSettings...) بيتم قراءتها تلقائياً من ملف config.js

let globalBatches = {};
window.nextBatchCart = {}; 
window.updateNextBatch = function(id, delta) {
    if (!window.nextBatchCart[id]) window.nextBatchCart[id] = 0;
    window.nextBatchCart[id] += delta;
    if (window.nextBatchCart[id] <= 0) delete window.nextBatchCart[id];
    
    if(delta > 0 && window.nextBatchCart[id] === 1) {
        showAlert("حجز للدفعة القادمة ⏳", "تم إضافة هذا المنتج كملاحظة في طلبك ليتم تجهيزه لك في الدفعة القادمة، ولن يتم حسابه في فاتورة اليوم.");
    }
    renderProducts(); updateUI();
};

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
    
    const batchSelect = document.getElementById('user-batch-select');
    const batchId = batchSelect ? batchSelect.value : '';
    
    if (batchId && globalBatches[batchId]) {
        const batch = globalBatches[batchId];
        // هيقرأ من الـ CRM الأساسي لو الدفعة ملهاش رقم محدد
        const bStock = (batch.stock && batch.stock[id] !== undefined) ? parseInt(batch.stock[id]) : (globalStock[id] || 0);
        const bBooked = (batch.booked && batch.booked[id]) ? parseInt(batch.booked[id]) : 0;
        const remainingInBatch = Math.max(0, bStock - bBooked);
        return Math.max(0, remainingInBatch - inCart);
    }
    
    return Math.max(0, (globalStock[id] || 0) - inCart); 
}

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

window.openImageModal = function(imgSrc) {
    if(!imgSrc || imgSrc.trim() === '') return;
    let modal = document.getElementById('image-viewer-modal');
    
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'image-viewer-modal';
        modal.className = 'fixed inset-0 z-[100] bg-brand-navy/95 flex items-center justify-center hidden opacity-0 transition-all duration-300 backdrop-blur-md p-4 cursor-zoom-out';
        
        modal.onclick = function() {
            closeImageViewer();
            if(window.location.hash === '#catalog') { history.back(); }
        };
        
        modal.innerHTML = `
            <div class="relative w-full max-w-3xl h-full flex items-center justify-center">
                <i class="fa-solid fa-spinner fa-spin absolute text-brand-yellow text-4xl z-0" id="img-loader"></i>
                <img id="image-viewer-img" src="" onload="document.getElementById('img-loader').style.display='none'" class="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl scale-95 transition-transform duration-300 relative z-10">
                <button class="absolute top-4 right-4 bg-white/20 hover:bg-white/40 text-white rounded-full w-10 h-10 flex items-center justify-center backdrop-blur-md transition-colors shadow-sm z-20">
                    <i class="fa-solid fa-xmark text-xl"></i>
                </button>
            </div>
        `;
        document.body.appendChild(modal);
    }

    const imgEl = document.getElementById('image-viewer-img');
    const loader = document.getElementById('img-loader');
    
    if(loader) loader.style.display = 'block'; 
    imgEl.src = imgSrc;
    imgEl.classList.remove('scale-100');
    imgEl.classList.add('scale-95');
    
    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        modal.classList.add('opacity-100');
        imgEl.classList.remove('scale-95');
        imgEl.classList.add('scale-100');
    }, 10);

    history.pushState({ modalOpen: true }, "", "#catalog");
};

function closeImageViewer() {
    let modal = document.getElementById('image-viewer-modal');
    if (modal && !modal.classList.contains('hidden')) {
        modal.classList.remove('opacity-100');
        modal.classList.add('opacity-0');
        setTimeout(() => modal.classList.add('hidden'), 300);
    }
}

window.addEventListener('popstate', function(event) { closeImageViewer(); });


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
    
    if(images.length === 0) {
        track.innerHTML = `<div class="w-full shrink-0 h-64 bg-gray-100 flex items-center justify-center text-gray-400"><i class="fa-solid fa-image text-4xl"></i></div>`;
        return;
    }

    images.forEach((img, idx) => {
        track.innerHTML += `
        <div class="w-full shrink-0 h-[400px] bg-[#fdfbf7] overflow-hidden relative flex justify-center items-center p-2" onclick="openImageModal('${img}')">
            <img src="${img}" class="max-w-full max-h-full object-contain transition-transform duration-300 hover:scale-105" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\'><rect width=\\'100%\\' height=\\'100%\\' fill=\\'%23f1f5f9\\'/></svg>'">
        </div>`;
        
        if (images.length > 1) {
            dotsContainer.innerHTML += `<div class="slider-dot h-2 w-2 rounded-full transition-all duration-300 ${idx===0 ? 'active' : 'bg-gray-300'} shadow-sm cursor-pointer" onclick="event.stopPropagation(); window.currentSlide=${idx}; window.updateSliderView();"></div>`;
        }
    });

    const sliderContainer = document.getElementById('main-slider-container');
    if (sliderContainer) {
        const buttons = sliderContainer.querySelectorAll('button');
        buttons.forEach(btn => {
            if (images.length <= 1) { btn.classList.add('hidden'); } else { btn.classList.remove('hidden'); }
        });
    }

    window.currentSlide = 0;
    window.updateSliderView();
    
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
        setTimeout(() => { noti.classList.add('translate-y-20', 'opacity-0'); }, 5000); 
    }

    setTimeout(() => { showRandomNoti(); setInterval(showRandomNoti, 25000); }, 10000);
}

function applySettingsToUI() {
    const savedNavy = localStorage.getItem('theme_navy');
    if(savedNavy) document.documentElement.style.setProperty('--brand-navy', savedNavy);

    renderMarquee();
    renderSlider();

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

document.addEventListener('DOMContentLoaded', () => { 
    renderDeliveryZones(); loadCart(); setupEventListeners(); initFirebase(); 
});

window.setupEventListeners = function() {
    const ids = ['customer-name', 'customer-phone', 'customer-address'];
    ids.forEach(id => { const el = document.getElementById(id); if(el) el.addEventListener('input', updateUI); });
    const dZone = document.getElementById('delivery-zone');
    if (dZone) dZone.addEventListener('change', updateUI);
    
    const pInput = document.getElementById('promo-code-input');
    if (pInput) {
        pInput.addEventListener('input', () => { 
            if (appliedPromo && !appliedPromo.isLoyalty && pInput.value.trim() === '') { 
                appliedPromo = null; document.getElementById('promo-message').classList.add('hidden'); updateUI(); 
            } 
        });
    }

    const batchSelectEl = document.getElementById('user-batch-select');
    if (batchSelectEl) {
        batchSelectEl.addEventListener('change', () => {
            let stockAdjusted = false;
            for (let id in cart) {
                let pureAvailable = 0;
                const bId = batchSelectEl.value;
                if (bId && globalBatches[bId]) {
                    const batch = globalBatches[bId];
                    const bStock = (batch.stock && batch.stock[id] !== undefined) ? parseInt(batch.stock[id]) : (globalStock[id] || 0);
                    const bBooked = (batch.booked && batch.booked[id]) ? parseInt(batch.booked[id]) : 0;
                    pureAvailable = Math.max(0, bStock - bBooked);
                } else {
                    pureAvailable = globalStock[id] || 0;
                }
                
                if (cart[id].quantity > pureAvailable) {
                    cart[id].quantity = pureAvailable;
                    stockAdjusted = true;
                    if (cart[id].quantity === 0) delete cart[id];
                }
            }
            window.nextBatchCart = {};
            if (stockAdjusted) {
                showAlert("تنبيه", "تم تعديل كميات السلة لتتناسب مع المخزون المتاح في الدفعة التي اخترتها.");
                saveCart();
            }
            renderProducts();
            updateUI();
        });
    }
}

// --- تهيئة Firebase مع تفعيل الكاش المحلي لإنقاذ الموقع ---
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
        
        // 🌟 التعديل السحري: تفعيل الذاكرة المخبأة (عشان لو السيرفر قفل، المنيو يظهر من الموبايل) 🌟
        db.enablePersistence({synchronizeTabs: true}).catch(function(err) {
            console.log("Cache persistence error: ", err);
        });

        hasCloud = true; listenToDatabase(); 
        
        // 🌟 تايمر الإنقاذ: لو فايربيس ماردش خلال 2.5 ثانية، افتح المنيو فوراً بالبيانات الأساسية 🌟
        setTimeout(() => {
            if (!isStoreDataLoaded) {
                isStoreDataLoaded = true;
                Object.keys(productsInfo).forEach(id => { 
                    if(globalStock[id] === undefined) globalStock[id] = 0; 
                    if(globalPrices[id] === undefined) globalPrices[id] = productsInfo[id].basePrice; 
                });
                renderProducts(); applySettingsToUI(); updateUI();
                console.log("تم تشغيل وضع الإنقاذ (Offline Mode)");
            }
        }, 2500);

    } catch (e) { console.log("Firebase Error", e); }
}


function listenToDatabase() {
    if(!db) return;
    let settingsLoaded = false; let stockLoaded = false;

    const checkAndRender = () => {
        if (settingsLoaded && stockLoaded && !isStoreDataLoaded) {
            isStoreDataLoaded = true;
            Object.keys(productsInfo).forEach(id => { 
                if(globalStock[id] === undefined) globalStock[id] = 0; 
                if(globalPrices[id] === undefined) globalPrices[id] = productsInfo[id].basePrice; 
            }); 
            renderProducts(); applySettingsToUI(); startLiveNotifications(); updateUI();
        } else if (isStoreDataLoaded) { renderProducts(); updateUI(); }
    };

    db.collection('inventory').doc('settings').onSnapshot(doc => { 
        if(doc.exists) { 
            const data = doc.data(); 
            if(data.productsData) productsInfo = data.productsData; 
            Object.assign(globalSettings, data); 
            if(data.deliveryZones) globalDeliveryZones = data.deliveryZones; 
            applySettingsToUI(); renderDeliveryZones(); settingsLoaded = true; checkAndRender();
        } 
    });

    db.collection('inventory').doc('stock').onSnapshot(doc => { 
        if(doc.exists) { Object.assign(globalStock, doc.data()); stockLoaded = true; checkAndRender(); } 
    });

    db.collection('inventory').doc('prices').onSnapshot(doc => { 
        if(doc.exists) { Object.assign(globalPrices, doc.data()); if(isStoreDataLoaded) renderProducts(); } 
    });
    
    db.collection('inventory').doc('discounts_status').onSnapshot(doc => { 
        if(doc.exists) { Object.assign(globalDiscounts, doc.data()); if(isStoreDataLoaded) renderProducts(); } 
    });
    
    // 👇 السطر اللي كان مكسور اتصلح هنا 👇
    db.collection('inventory').doc('old_prices').onSnapshot(doc => { 
        if(doc.exists) { Object.assign(globalOldPrices, doc.data()); if(isStoreDataLoaded) renderProducts(); } 
    });

    db.collection('inventory').doc('stats').onSnapshot(doc => { 
        if(doc.exists) { 
            dailyStats = doc.data(); 
            if(document.getElementById('stat-sales')) document.getElementById('stat-sales').innerText = dailyStats.sales || 0; 
            if(document.getElementById('stat-orders')) document.getElementById('stat-orders').innerText = dailyStats.orders || 0; 
        } 
    });

    // ===== التعديل الجديد للدفعات بالكروت (بالتصميم الراقي) =====
    db.collection('inventory').doc('batches').onSnapshot(doc => {
        if(doc.exists) {
            globalBatches = doc.data() || {};
            let batchSelect = document.getElementById('user-batch-select');
            let batchContainer = document.getElementById('batch-selection-container');
            let cardsContainer = document.getElementById('batch-cards-wrapper');
            
            if(batchSelect && batchContainer && cardsContainer) {
                let currentVal = batchSelect.value;
                cardsContainer.innerHTML = ''; 
                let openBatchesCount = 0;
                let firstOpenBatch = null;
                
                Object.keys(globalBatches).forEach(bId => {
                    if(globalBatches[bId].isOpen) {
                        const batch = globalBatches[bId];
                        if(!firstOpenBatch) firstOpenBatch = bId;
                        openBatchesCount++;

                        let totalStock = 0, totalBooked = 0;
                        if(batch.stock) Object.values(batch.stock).forEach(s => totalStock += parseInt(s) || 0);
                        if(batch.booked) Object.values(batch.booked).forEach(b => totalBooked += parseInt(b) || 0);
                        
                        let percent = totalStock > 0 ? (totalBooked / totalStock) * 100 : 0;
                        let isSelected = currentVal === bId;

                        // 👇 التعديل الشيك: الحالات الذكية بدل الأرقام وشريط التقدم 👇
                        let smartBadgeHtml = '';
                        if (percent >= 80) {
                            smartBadgeHtml = `<div class="mt-2.5 flex items-center justify-center gap-1.5 bg-red-50 border border-red-100 text-red-700 text-[10px] font-bold p-1.5 rounded-lg shadow-sm"><i class="fa-solid fa-hourglass-half"></i> <span>اقترب اكتمال العدد لضمان الجودة</span></div>`;
                        } else if (percent >= 50) {
                            smartBadgeHtml = `<div class="mt-2.5 flex items-center justify-center gap-1.5 bg-brand-light border border-brand-navy/10 text-brand-navy text-[10px] font-bold p-1.5 rounded-lg shadow-sm"><i class="fa-solid fa-chart-line"></i> <span>الدفعة قيد الاكتمال والتجهيز</span></div>`;
                        } else {
                            smartBadgeHtml = `<div class="mt-2.5 flex items-center justify-center gap-1.5 bg-emerald-50 border border-emerald-100 text-emerald-700 text-[10px] font-bold p-1.5 rounded-lg shadow-sm"><i class="fa-solid fa-leaf"></i> <span>متاح لتسجيل حجزك الآن</span></div>`;
                        }

                        // رسم الكارت بالشكل الجديد
                        cardsContainer.innerHTML += `
                            <div id="card-${bId}" onclick="selectBatchAndScroll('${bId}')" 
                                 class="batch-card-item cursor-pointer border-2 ${isSelected ? 'border-brand-navy bg-brand-light scale-[1.02] shadow-md' : 'border-gray-100 bg-white opacity-80 hover:opacity-100 hover:border-brand-navy/30'} rounded-2xl p-4 transition-all duration-300 relative overflow-hidden flex flex-col justify-between min-h-[100px]">
                                
                                <div class="flex justify-between items-start mb-1">
                                    <h4 class="font-black text-brand-navy text-sm md:text-base">${batch.name}</h4>
                                    <div class="check-icon-container shrink-0">
                                        ${isSelected ? '<i class="fa-solid fa-circle-check text-brand-navy text-xl drop-shadow-sm"></i>' : '<i class="fa-regular fa-circle text-gray-300 text-xl"></i>'}
                                    </div>
                                </div>
                                
                                ${smartBadgeHtml}
                            </div>
                        `;
                    }
                });
                
                if (!currentVal && firstOpenBatch) {
                    batchSelect.value = firstOpenBatch;
                    batchSelect.dispatchEvent(new Event('change')); 
                }

                if(openBatchesCount > 0) batchContainer.style.display = 'block'; 
                else batchContainer.style.display = 'none';
                
                if(isStoreDataLoaded) { renderProducts(); updateUI(); }
            }
        }
    });
} // <--- نهاية listenToDatabase

// ===== دالة التحديد والنزول السلس (خارج دالة listenToDatabase) =====
window.selectBatchAndScroll = (bId) => {
    let hiddenInput = document.getElementById('user-batch-select');
    if(!hiddenInput) return;
    
    hiddenInput.value = bId;
    hiddenInput.dispatchEvent(new Event('change'));
    
    document.querySelectorAll('.batch-card-item').forEach(card => {
        let iconContainer = card.querySelector('.check-icon-container');
        if(card.id === `card-${bId}`) {
            card.className = "batch-card-item cursor-pointer border-2 border-brand-navy bg-brand-light scale-[1.02] shadow-md rounded-2xl p-4 transition-all duration-300 relative overflow-hidden flex flex-col justify-between";
            if(iconContainer) iconContainer.innerHTML = '<i class="fa-solid fa-circle-check text-brand-navy text-xl"></i>';
        } else {
            card.className = "batch-card-item cursor-pointer border-2 border-gray-100 bg-white opacity-70 hover:opacity-100 hover:border-brand-cyan/30 rounded-2xl p-4 transition-all duration-300 relative overflow-hidden flex flex-col justify-between";
            if(iconContainer) iconContainer.innerHTML = '<i class="fa-regular fa-circle text-gray-300 text-xl"></i>';
        }
    });
    
    setTimeout(() => {
        const menuTitle = document.getElementById('lbl-menu-title');
        if(menuTitle) {
            const yOffset = -70; 
            const y = menuTitle.getBoundingClientRect().top + window.scrollY + yOffset;
            window.scrollTo({top: y, behavior: 'smooth'});
        }
    }, 150);
};




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
            saleBadgeHtml = `<div class="absolute top-4 left-4 bg-red-500 text-white text-[10px] font-black px-3 py-1 rounded-full shadow-lg sale-badge z-10"><i class="fa-solid fa-tag"></i> عرض</div>`; 
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

        if (!item.isExtra) { 
            mainProductsCount++; container.innerHTML += cardHTML; 
        } else {
            extrasContainer.innerHTML += cardHTML;
        }
    });
    
    if(mainProductsCount === 0) container.innerHTML = `<div class="text-center py-10 text-gray-400 font-bold">${globalSettings.uiTexts?.emptyMenuMsg || "لا توجد منتجات حالياً"}</div>`;
};

// --- منطق السلة والكميات ---
window.scrollToBatch = function() {
    const batchBox = document.getElementById('batch-selection-container');
    if(batchBox) {
        // الشاشة تطلع لفوق ببطء
        batchBox.scrollIntoView({behavior: 'smooth', block: 'center'});
        
        // تأثير نبض/نور باللون الأحمر عشان يشتغل عندك 100%
        batchBox.classList.add('ring-4', 'ring-red-500', 'scale-105', 'transition-all', 'duration-300');
        setTimeout(() => {
            batchBox.classList.remove('ring-4', 'ring-red-500', 'scale-105');
        }, 1500);
    } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
};

window.getCardActionHTML = function(id) {
    if (globalSettings.storeOpen === false) return `<div class="w-full bg-gray-100 text-gray-400 font-bold py-2 rounded-xl text-xs text-center">مغلق</div>`;
    const inCart = cart[id]?.quantity || 0; 
    const available = getAvailableStock(id);
    
    // 👇 زرار العميل البسيط (مظبوط عشان ميبوظش مساحة الكارت)
    if (available === 0 && inCart === 0) {
        return `
        <div onclick="scrollToBatch()" class="w-full bg-red-50 flex flex-col justify-center items-center py-1 rounded-xl border border-red-300 cursor-pointer hover:bg-red-100 transition-colors shadow-sm">
            <span class="text-[11px] font-black text-red-600 mb-0.5">نفذت (خلصت)</span>
            <span class="text-[10px] font-bold text-white bg-red-500 px-2 py-0.5 rounded shadow-sm flex items-center gap-1 animate-pulse">
                غير الميعاد <i class="fa-solid fa-arrow-up"></i>
            </span>
        </div>`;
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
    if (cart[id]) cart[id].quantity++; else cart[id] = { quantity: 1, price: globalPrices[id] || productsInfo[id].basePrice, name: productsInfo[id].name }; 
    saveCart(); updateUI(); renderProducts(); 
};

window.updateQuantity = function(id, delta) { 
    if (!cart[id] || globalSettings.storeOpen === false) return; 
    if (delta === 1) { 
        if (getAvailableStock(id) > 0) cart[id].quantity++; else showAlert("عذراً", "لا يوجد مخزون إضافي متاح."); 
    } else if (delta === -1) { 
        cart[id].quantity--; if (cart[id].quantity <= 0) delete cart[id]; 
    } 
    saveCart(); updateUI(); renderProducts(); 
};

window.goToCheckoutStep2 = function() {
    document.getElementById('checkout-step-1').classList.add('hidden');
    document.getElementById('checkout-step-2').classList.remove('hidden');
    document.getElementById('btn-back-step').classList.remove('hidden');
    document.getElementById('lbl-checkout-title').innerText = "إتمام الطلب";
    document.getElementById('step-1-indicator').classList.replace('step-active', 'step-completed');
    document.getElementById('step-line-1').classList.add('active');
    document.getElementById('step-2-indicator').classList.replace('opacity-50', 'step-active');
    updateUI();
};

window.backToCart = function() {
    document.getElementById('checkout-step-2').classList.add('hidden');
    document.getElementById('checkout-step-1').classList.remove('hidden');
    document.getElementById('btn-back-step').classList.add('hidden');
    document.getElementById('lbl-checkout-title').innerText = "سلة المشتريات";
    document.getElementById('step-2-indicator').classList.replace('step-active', 'opacity-50');
    document.getElementById('step-line-1').classList.remove('active');
    document.getElementById('step-1-indicator').classList.replace('step-completed', 'step-active');
    updateUI();
};

window.updateUI = function() {
    let totalItems = 0, subTotalPrice = 0; 
    const cartItemsContainer = document.getElementById('cart-items'); 
    if(cartItemsContainer) cartItemsContainer.innerHTML = '';
    
    for (let id in cart) {
        if (!productsInfo[id]) { delete cart[id]; continue; }
        const item = cart[id]; item.price = globalPrices[id] || productsInfo[id].basePrice;
        totalItems += item.quantity; subTotalPrice += item.quantity * item.price;
        if(cartItemsContainer) {
            cartItemsContainer.innerHTML += `
                <div class="bg-white p-3 rounded-xl border border-gray-100 flex justify-between items-center shadow-sm">
                    <div class="flex-1"><h4 class="font-bold text-brand-navy text-xs mb-1">${item.name}</h4><div class="text-brand-cyanDark font-black text-sm">${item.price} ج.م</div></div>
                    <div class="flex items-center gap-2 bg-gray-50 rounded-lg p-1 border border-gray-200 h-[36px]">
                        <div onclick="updateQuantity('${id}', 1)" class="w-8 h-full bg-white text-brand-navy rounded shadow-sm font-black text-lg flex items-center justify-center cursor-pointer select-none">+</div>
                        <span class="font-black text-brand-navy min-w-[24px] text-center text-sm">${item.quantity}</span>
                        <div onclick="updateQuantity('${id}', -1)" class="w-8 h-full bg-white text-red-500 rounded shadow-sm font-black text-xl flex items-center justify-center cursor-pointer select-none pb-1">-</div>
                    </div>
                </div>`;
        }
    }
    
    let nextBatchHtml = '';
    for (let id in window.nextBatchCart) {
        const item = productsInfo[id];
        if(item) {
            nextBatchHtml += `<div class="flex justify-between items-center text-[11px] font-bold text-orange-700 bg-orange-50 p-2 rounded-lg border border-orange-200 mb-1 shadow-sm"><span>⏳ ${item.name}</span><div class="flex items-center gap-2 bg-white rounded border border-orange-200 px-1"><span class="cursor-pointer text-orange-600 px-1" onclick="updateNextBatch('${id}', 1)">+</span><span>${window.nextBatchCart[id]}</span><span class="cursor-pointer text-red-500 px-1" onclick="updateNextBatch('${id}', -1)">-</span></div></div>`;
        }
    }
    if(nextBatchHtml && cartItemsContainer) {
        cartItemsContainer.innerHTML += `<div class="mt-4"><h5 class="text-xs font-black text-brand-navy mb-2 border-b border-gray-200 pb-1"><i class="fa-solid fa-clock-rotate-left text-brand-yellow"></i> مطلوب للدفعة القادمة:</h5>${nextBatchHtml}</div>`;
        totalItems += 1; 
    }

    const bottomBar = document.getElementById('bottom-cart-bar');
    if(bottomBar) { 
        document.getElementById('bottom-cart-total').innerText = subTotalPrice; document.getElementById('bottom-cart-count').innerText = totalItems; 
        if (totalItems > 0) bottomBar.classList.remove('translate-y-full'); 
        else {
            bottomBar.classList.add('translate-y-full'); 
            if(cartItemsContainer) cartItemsContainer.innerHTML = `<div class="flex flex-col items-center justify-center py-10 text-gray-400 gap-3"><i class="fa-solid fa-basket-shopping text-5xl text-gray-200"></i><p class="font-bold text-sm">${globalSettings.uiTexts?.emptyCartMsg || "السلة فارغة"}</p></div>`;
        }
    }

    let freeDelivery = (globalSettings.freeDeliveryActive && subTotalPrice >= (globalSettings.freeDeliveryThreshold||0) && totalItems > 0);
    const tracker = document.getElementById('free-delivery-tracker');
    if (globalSettings.freeDeliveryActive && totalItems > 0) { 
        tracker.classList.remove('hidden'); let remaining = Math.max(0, (globalSettings.freeDeliveryThreshold||0) - subTotalPrice); 
        document.getElementById('fd-progress').style.width = Math.min(100, (subTotalPrice / (globalSettings.freeDeliveryThreshold||1)) * 100) + '%'; 
        const textContainer = document.getElementById('free-delivery-text'); 
        if (remaining > 0) { 
            textContainer.innerHTML = `<span class="text-gray-600">باقي <span class="text-brand-cyanDark font-black text-sm">${remaining}</span> ج وتاخد توصيل مجاني!</span><i class="fa-solid fa-gift text-brand-cyanDark text-lg"></i>`; 
            document.getElementById('fd-progress').className = "bg-gradient-to-l from-brand-cyan to-brand-cyanDark h-2.5 rounded-full progress-bar-animated"; 
        } else { 
            textContainer.innerHTML = `<span class="text-green-600 font-black">مبروك! التوصيل مجاني 🎉</span><i class="fa-solid fa-check-circle text-green-500 text-lg"></i>`; 
            document.getElementById('fd-progress').className = "bg-green-500 h-2.5 rounded-full progress-bar-animated"; 
        } 
    } else tracker.classList.add('hidden');

    let discountAmount = 0; const promoRow = document.getElementById('promo-discount-row');
    if (appliedPromo && totalItems > 0) {
        if (appliedPromo.minOrder && subTotalPrice < appliedPromo.minOrder) {
            appliedPromo = null; const msg = document.getElementById('promo-message'); 
            if(msg) { msg.innerText = "تم إلغاء الخصم لأن الطلبات قلت عن الحد الأدنى للكود."; msg.className = "text-[11px] font-bold mt-1 text-red-500"; msg.classList.remove('hidden'); } 
            if(document.getElementById('promo-code-input')) document.getElementById('promo-code-input').value = '';
        } else {
            if(appliedPromo.type === 'free_delivery') { 
                freeDelivery = true; discountAmount = 0; document.getElementById('promo-label').innerText = appliedPromo.code + " (توصيل مجاني)"; document.getElementById('cart-discount').innerText = "0"; 
            } else { 
                discountAmount = appliedPromo.type === 'percent' ? (subTotalPrice * (appliedPromo.discount / 100)) : appliedPromo.discount; 
                if (appliedPromo.type === 'percent' && appliedPromo.maxDiscount > 0) discountAmount = Math.min(discountAmount, appliedPromo.maxDiscount); 
                discountAmount = Math.round(Math.min(discountAmount, subTotalPrice)); 
                document.getElementById('promo-label').innerText = appliedPromo.code; document.getElementById('cart-discount').innerText = discountAmount; 
            }
        }
        if(appliedPromo) promoRow.classList.remove('hidden'); else promoRow.classList.add('hidden');
    } else { promoRow.classList.add('hidden'); }

    const totalAfterPromo = subTotalPrice - discountAmount; 
    const deliverySelect = document.getElementById('delivery-zone'); 
    const selectedZone = globalDeliveryZones.find(z => z.id === deliverySelect?.value); 
    const deliveryFee = selectedZone ? selectedZone.price : 0; 
    const finalDelivery = freeDelivery ? 0 : deliveryFee; const finalTotal = totalAfterPromo + finalDelivery;

    if(document.getElementById('cart-subtotal')) document.getElementById('cart-subtotal').innerText = subTotalPrice;
    if(document.getElementById('cart-step1-total')) document.getElementById('cart-step1-total').innerText = totalAfterPromo;
    if(document.getElementById('cart-delivery-fee')) { 
        if (freeDelivery) document.getElementById('cart-delivery-fee').innerHTML = `<span class="text-green-600 font-black">مجاني 🎉</span>`; 
        else document.getElementById('cart-delivery-fee').innerText = (selectedZone && selectedZone.price === 0) ? "يحدد لاحقاً" : `${finalDelivery} ج.م`; 
    }
    if(document.getElementById('cart-total')) document.getElementById('cart-total').innerText = Math.round(finalTotal);

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
        checkoutBtn.disabled = false;

        if(!validForm && totalItems > 0) checkoutHintStep2.classList.remove('hidden'); 
        else checkoutHintStep2.classList.add('hidden');
    }
};

window.toggleCart = function() { 
    const sidebar = document.getElementById('cart-sidebar'); const overlay = document.getElementById('cart-overlay'); 
    if(!sidebar || !overlay) return; 
    if (sidebar.classList.contains('translate-x-full')) { 
        sidebar.classList.remove('translate-x-full'); overlay.classList.remove('hidden'); setTimeout(() => overlay.classList.remove('opacity-0'), 10); document.body.style.overflow = 'hidden'; backToCart(); 
    } else { 
        sidebar.classList.add('translate-x-full'); overlay.classList.add('opacity-0'); setTimeout(() => overlay.classList.add('hidden'), 300); document.body.style.overflow = ''; 
    } 
};

window.showAlert = function(t, m) { 
    const iconCont = document.getElementById('alert-icon-container');
    if(iconCont) { iconCont.className = "w-16 h-16 bg-brand-light text-brand-cyanDark rounded-full flex items-center justify-center mx-auto mb-4 text-3xl"; iconCont.classList.remove('hidden'); }
    const icon = document.getElementById('alert-icon'); if(icon) icon.className = "fa-solid fa-bell"; 
    const title = document.getElementById('alert-title'); if(title) { title.innerText = t; title.classList.remove('hidden'); }
    document.getElementById('alert-message').innerText = m; 
    const btn = document.querySelector('#alert-box button'); 
    if(btn) { btn.className = "bg-brand-navy hover:opacity-90 text-white font-bold py-3 px-6 rounded-xl w-full transition-opacity"; btn.innerHTML = 'حسناً'; btn.onclick = closeAlert; btn.classList.remove('hidden'); }
    const md = document.getElementById('alert-modal'); md.classList.remove('hidden'); setTimeout(()=>md.classList.remove('opacity-0'),10); 
};
window.closeAlert = function() { document.getElementById('alert-modal').classList.add('opacity-0'); setTimeout(() => { document.getElementById('alert-modal').classList.add('hidden'); }, 300); };

window.initiateCheckout = function() {
    if (globalSettings.crossSellActive && globalSettings.crossSellProductId && productsInfo[globalSettings.crossSellProductId] && !cart[globalSettings.crossSellProductId] && getAvailableStock(globalSettings.crossSellProductId) > 0) {
        const item = productsInfo[globalSettings.crossSellProductId]; document.getElementById('cross-sell-title').innerText = globalSettings.crossSellTitle || `جرب ${item.name}؟`; document.getElementById('cross-sell-desc').innerText = globalSettings.crossSellDesc || 'مغذي جداً للأطفال وطعمه حكاية!'; document.getElementById('cross-sell-price').innerText = globalPrices[globalSettings.crossSellProductId] || item.basePrice; document.getElementById('cross-sell-img').src = (item.images && item.images.length>0) ? item.images[0] : '';
        const modal = document.getElementById('cross-sell-modal'); const box = document.getElementById('cross-sell-box'); modal.classList.remove('hidden'); setTimeout(() => { modal.classList.remove('opacity-0'); box.classList.remove('scale-95'); box.classList.add('scale-100'); }, 10);
    } else finalCheckoutStep();
};

window.acceptCrossSell = function() { addToCart(globalSettings.crossSellProductId); const m = document.getElementById('cross-sell-modal'); m.classList.add('opacity-0'); setTimeout(() => { m.classList.add('hidden'); finalCheckoutStep(); }, 300); };
window.declineCrossSell = function() { const m = document.getElementById('cross-sell-modal'); m.classList.add('opacity-0'); setTimeout(() => { m.classList.add('hidden'); finalCheckoutStep(); }, 300); };
// 🌟 دالة ذكية لتحويل تواريخ الـ CRM إلى رسائل تفاعلية للعميل
window.getFriendlyBatchDatePhrase = function(startDateStr, endDateStr) {
    if (!startDateStr) return "قريباً فور تجهيزها";
    
    const startDate = new Date(startDateStr);
    const day = startDate.getDate();
    const monthNames = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
    const monthText = monthNames[startDate.getMonth()];
    
    let timePhrase = "";
    // تحديد الفترة جوه الشهر (أول الشهر، منتصفه، آخره)
    if (day <= 10) {
        timePhrase = `أول شهر ${monthText}`; // مثلاً: أول شهر سبتمبر
    } else if (day > 10 && day <= 20) {
        timePhrase = `منتصف شهر ${monthText}`;
    } else {
        timePhrase = `أواخر شهر ${monthText}`;
    }
    
    return `خلال ${timePhrase} (وتحديداً من يوم ${day} في الشهر)`;
};

window.finalCheckoutStep = async function() {
    const checkoutBtn = document.getElementById('checkout-btn'); 
    const originalBtnHtml = checkoutBtn.innerHTML; 
    checkoutBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-2xl"></i> جاري تسجيل الطلب...'; 
    checkoutBtn.disabled = true;

    const deliverySelect = document.getElementById('delivery-zone'); 
    const selectedZone = globalDeliveryZones.find(z => z.id === deliverySelect.value || z.name === deliverySelect.value); 
    const zoneName = selectedZone ? selectedZone.name : 'غير محدد'; 
    const deliveryFee = selectedZone ? parseInt(selectedZone.price) || 0 : 0;
    
    const batchIdInput = document.getElementById('user-batch-select'); 
    const batchNameInput = document.getElementById('selected-batch-name'); 
    
    let batchId = (batchIdInput && batchIdInput.value !== "") ? batchIdInput.value : ''; 
    let batchName = (batchNameInput && batchNameInput.value !== "") ? batchNameInput.value : '';
    
    // 🌟 التعديل الاحترافي: اختيار أول دفعة متاحة تلقائياً لو حصلت تهنيجة 🌟
    if (batchId === '') {
        // البحث عن أول دفعة مفتوحة في السيستم
        let firstAvailableBatchId = Object.keys(globalBatches).find(bId => globalBatches[bId].isOpen);
        
        if (firstAvailableBatchId) {
            // لو لقينا دفعة مفتوحة، هنحمل بياناتها ونكمل الطلب عادي جداً
            batchId = firstAvailableBatchId;
            batchName = globalBatches[firstAvailableBatchId].name;
            
            let errorMsg = document.getElementById('batch-error-msg');
            if (errorMsg) errorMsg.classList.add('hidden');
        } else {
            // لو مفيش ولا دفعة مفتوحة أصلاً في السيستم، هنا بس لازم نوقفه ونطلعله رسالة
            let errorMsg = document.getElementById('batch-error-msg');
            if (errorMsg) {
                errorMsg.classList.remove('hidden');
                errorMsg.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            checkoutBtn.innerHTML = originalBtnHtml; 
            checkoutBtn.disabled = false;
            return; // الطلب هيقف هنا عشان مفيش دفعات
        }
    }

    
    // 🌟 الكود الجديد: تنظيف وتحويل فوري للأرقام العربية إلى إنجليزية عند المنبع 🌟
    let customerName = document.getElementById('customer-name').value.trim(); 
    let customerPhone = document.getElementById('customer-phone').value.trim(); 
    
    // استخدام دالة الفورمات اللي إنت كاتبها تحت عشان تفرتك أي أرقام هندية/عربية وتحولها إنجليزي فوراً
    customerPhone = window.formatPhoneNumber(customerPhone); 
    
    let customerAddress = document.getElementById('customer-address').value.trim();

    
    // 👇 التعديل هنا: سحب الملاحظة اللي العميل بيكتبها
    let customerNotesInput = document.getElementById('customer-notes') ? document.getElementById('customer-notes').value.trim() : '';

    // 1. فحص صحة الاسم
    if (customerName.length < 3 || !/^[\u0600-\u06FF\sA-Za-z]+$/.test(customerName)) {
        showAlert("تنبيه", "يرجى كتابة اسم صحيح وخالي من الأرقام والرموز.");
        checkoutBtn.innerHTML = originalBtnHtml;
        checkoutBtn.disabled = false;
        return;
    }

    // 2. فحص كود الخصم (إذا كان مخصصاً لرقم محدد)
    if (appliedPromo && appliedPromo.customerPhone) {
        let phoneToMatch = appliedPromo.customerPhone.replace(/\D/g, '').slice(-10);
        let userPhone = customerPhone.replace(/\D/g, '').slice(-10);
        
        if (phoneToMatch !== userPhone && phoneToMatch !== '') {
            showAlert("تنبيه", "عفواً، كود الخصم هذا مخصص لرقم هاتف آخر ولا يمكنك استخدامه.");
            checkoutBtn.innerHTML = originalBtnHtml;
            checkoutBtn.disabled = false;
            return;
        }
    }

    // 3. فحص طول رقم الموبايل (التعديل الجديد)
    if (customerPhone.length < 10) { 
        showAlert("تنبيه", "يرجى التأكد من كتابة رقم الموبايل بالكامل عشان نقدر نتواصل معاك."); 
        checkoutBtn.innerHTML = originalBtnHtml; 
        checkoutBtn.disabled = false; 
        return; 
    }

    // 4. فحص اختيار منطقة التوصيل (التعديل الجديد)
    if (!deliverySelect || deliverySelect.value === "") { 
        showAlert("تنبيه", "نسيت تختار منطقة التوصيل! يرجى تحديدها لحساب الإجمالي."); 
        checkoutBtn.innerHTML = originalBtnHtml; 
        checkoutBtn.disabled = false; 
        return; 
    }

    for (let id in cart) { 
        if(!productsInfo[id]) continue; 
        let pureAvailable = 0;
        if (batchId && globalBatches[batchId]) {
            const batch = globalBatches[batchId];
            const bStock = (batch.stock && batch.stock[id] !== undefined) ? parseInt(batch.stock[id]) : (globalStock[id] || 0);
            const bBooked = (batch.booked && batch.booked[id]) ? parseInt(batch.booked[id]) : 0;
            pureAvailable = Math.max(0, bStock - bBooked);
        } else {
            pureAvailable = globalStock[id] || 0;
        }

        if (cart[id].quantity > pureAvailable) { 
            showAlert("تنبيه", `المنتج ${productsInfo[id].name} لم يعد متوفر بهذه الكمية، لقد تم حجزه بواسطة عميل آخر للتو.`); 
            cart[id].quantity = pureAvailable; 
            if(cart[id].quantity === 0) delete cart[id]; 
            saveCart(); updateUI(); renderProducts(); checkoutBtn.innerHTML = originalBtnHtml; checkoutBtn.disabled = false; return; 
        } 
    }

    const orderDate = new Date().toLocaleDateString('ar-EG'); 
    const orderTime = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
    let subTotal = 0; let itemsSummaryArray = []; let smartTagsArray = ["#طلب_مباشر"];
    if (globalSettings.batchHashtag) { let cleanHashtag = globalSettings.batchHashtag.trim(); if (!cleanHashtag.startsWith('#')) cleanHashtag = '#' + cleanHashtag; smartTagsArray.push(cleanHashtag.replace(/\s+/g, '_')); }
    
    let customerDetailsStr = `👤 الاسم: ${customerName}\n📱 الموبايل: ${customerPhone}\n📍 المنطقة: ${zoneName}\n${customerAddress?`🏠 العنوان: ${customerAddress}\n`:''}🕒 الوقت: ${orderDate} - ${orderTime}`;
    let itemsStr = ""; 
    for (let id in cart) { 
        if(!productsInfo[id]) continue; 
        const item = cart[id]; const itemTotal = item.quantity * item.price; subTotal += itemTotal; 
        let shortName = item.name.replace('طبق ', '').split(' (')[0]; 
        itemsSummaryArray.push(`${item.quantity} ${shortName}`); 
        let tagName = "#" + shortName.replace(/ /g, '_'); 
        if(!smartTagsArray.includes(tagName)) smartTagsArray.push(tagName); 
        itemsStr += `▪ ${item.name}\n  └ ${item.quantity} × ${item.price} = ${itemTotal} ج.م\n`; 
    }

    let discountAmount = 0; let discountTextTemplate = "";
    if (appliedPromo) { if(appliedPromo.type === 'free_delivery') { discountTextTemplate = `🎁 ${appliedPromo.code}: توصيل مجاني\n`; } else { discountAmount = appliedPromo.type === 'percent' ? (subTotal * (appliedPromo.discount / 100)) : appliedPromo.discount; if (appliedPromo.type === 'percent' && appliedPromo.maxDiscount > 0) { discountAmount = Math.min(discountAmount, appliedPromo.maxDiscount); } discountAmount = Math.round(Math.min(discountAmount, subTotal)); discountTextTemplate = `🎁 كود (${appliedPromo.code}): -${discountAmount} ج\n`; } }

    const totalAfterPromo = subTotal - discountAmount; let freeDelivery = (globalSettings.freeDeliveryActive && totalAfterPromo >= (globalSettings.freeDeliveryThreshold||0)) || (appliedPromo && appliedPromo.type === 'free_delivery'); const finalDelivery = freeDelivery ? 0 : deliveryFee; const finalTotal = totalAfterPromo + finalDelivery;
    let deliveryText = freeDelivery ? "مجاني 🎉" : ((deliveryFee === 0 && zoneName === 'مكان آخر') ? "يحدد لاحقاً" : `${deliveryFee} ج.م`);

    let template = globalSettings.whatsappTemplate || "السلام عليكم، أريد تأكيد حجزي:\n\n📋 *بيانات العميل:*\n{تفاصيل_العميل}\n\n🛒 *الطلبات:*\n{الطلبات}\n{الخصم}═════════════════\n📦 قيمة الطلبات: {قيمة_الطلبات} ج.م\n🚚 رسوم التوصيل: {التوصيل}\n💰 *الإجمالي النهائي: {الاجمالي} ج.م*\n\n(في انتظار تأكيد الحجز وموعد الاستلام)";
    let message = template.replace('{تفاصيل_العميل}', customerDetailsStr).replace('{الطلبات}', itemsStr.trim()).replace('{الخصم}', discountTextTemplate ? discountTextTemplate + '\n' : '').replace('{قيمة_الطلبات}', subTotal).replace('{التوصيل}', deliveryText).replace('{الاجمالي}', finalTotal);
    if(deliveryFee === 0 && zoneName === 'مكان آخر' && !freeDelivery) message += `\n*(الإجمالي غير شامل رسوم التوصيل)*`;

    let promoUpdated = false;
    if (appliedPromo) { let pIndex = globalSettings.promoCodes.findIndex(p => p.code === appliedPromo.code); if (pIndex !== -1) { let pObj = globalSettings.promoCodes[pIndex]; if (pObj.usesLeft !== null && pObj.usesLeft !== undefined) { pObj.usesLeft -= 1; } promoUpdated = true; } }

    let earnedLoyalty = false; let newPromoCode = ""; let canGenerateReward = false;
    if (globalSettings.rewardActive && !appliedPromo) { if (globalSettings.rewardMaxGenerations >= 0) { canGenerateReward = true; } }
    if (canGenerateReward) { const prefix = globalSettings.autoPromoPrefix || 'VIP-'; newPromoCode = prefix + Math.floor(1000 + Math.random() * 9000); earnedLoyalty = true; const maxDisc = globalSettings.rewardMaxDiscount || 0; const newPromoObj = { code: newPromoCode, type: globalSettings.rewardType, discount: globalSettings.rewardValue, isAuto: true, usesLeft: 1, customerPhone: customerPhone, minOrder: 0, maxDiscount: maxDisc, expiryDate: '' }; if(!globalSettings.promoCodes) globalSettings.promoCodes = []; globalSettings.promoCodes.push(newPromoObj); if (globalSettings.rewardMaxGenerations > 0) { globalSettings.rewardMaxGenerations -= 1; } promoUpdated = true; }

    let nextBatchNotes = "";
    for (let id in window.nextBatchCart) { if(productsInfo[id]) nextBatchNotes += `▪ ${productsInfo[id].name} (الكمية: ${window.nextBatchCart[id]})\n`; }
    
    // 👇 التعديل هنا: تجهيز الملاحظات ودمجها مع بعض
    let adminAndCustomerNotes = earnedLoyalty ? `🎟 ملاحظة: كود المرة القادمة (${newPromoCode})` : "";
    if (nextBatchNotes) {
        adminAndCustomerNotes += `\n⏳ **مطلوب حجزه في الدفعة القادمة:**\n${nextBatchNotes.trim()}`;
        message += `\n\n⏳ **مطلوب حجزه في الدفعة القادمة:**\n${nextBatchNotes.trim()}`; 
    }
    
    if (customerNotesInput) {
        adminAndCustomerNotes += `\n\n📌 **ملاحظة من العميل:** ${customerNotesInput}`;
        message += `\n\n📌 *ملاحظة من العميل:* ${customerNotesInput}`; // رسالة الواتساب
    }

    let addressText = customerAddress ? `🏠 العنوان: ${customerAddress}` : "";
    let tickTickItemsStr = ""; for (let id in cart) { if(productsInfo[id]) tickTickItemsStr += `[ ${cart[id].quantity} ] ${cart[id].name} = ${cart[id].quantity * cart[id].price} ج.م\n`; }
    
    let discountTickTickText = discountAmount > 0 ? `🎁 الخصم: -${discountAmount} ج.م\n` : ""; 
    
    let batchTickTickLine = batchName ? `\n\n📌 **حجز تبع: ${batchName}**\n` : '';
    let defaultTickTick = "🧾 **تفاصيل الأوردر كاملة:**" + batchTickTickLine + "\n👤 الاسم: {اسم_العميل}\n📱 الموبايل: {الموبايل}\n📍 المنطقة: {المنطقة}\n{العنوان}\n🕒 الوقت: {الوقت}\n--------------------------------\n🛒 الطلبات:\n{تفاصيل_الطلبات}\n--------------------------------\n📦 قيمة الطلبات: {قيمة_الطلبات} ج.م\n{الخصم}🚚 رسوم التوصيل: {التوصيل}\n💰 الإجمالي النهائي: {الاجمالي} ج.م\n{ملاحظات}\n{الهاشتاجات}";

    let orderDetailsForTickTick = (globalSettings.ticktickTemplate || defaultTickTick).replace('{اسم_العميل}', customerName).replace('{الموبايل}', customerPhone).replace('{المنطقة}', zoneName).replace('{العنوان}', addressText).replace('{الوقت}', `${orderDate} - ${orderTime}`).replace('{تفاصيل_الطلبات}', tickTickItemsStr.trim()).replace('{قيمة_الطلبات}', subTotal).replace('{الخصم}', discountTickTickText).replace('{التوصيل}', deliveryText).replace('{الاجمالي}', finalTotal).replace('{ملاحظات}', adminAndCustomerNotes).replace('{الهاشتاجات}', smartTagsArray.join(' ')); orderDetailsForTickTick = orderDetailsForTickTick.replace(/\n\s*\n/g, '\n');

    try {
        if(typeof WEB3FORMS_ACCESS_KEY !== 'undefined') {
            fetch('https://api.web3forms.com/submit', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: JSON.stringify({ access_key: WEB3FORMS_ACCESS_KEY, subject: `🛒 ${itemsSummaryArray.join(' ')}`, "التفاصيل": orderDetailsForTickTick }) }).catch(e=>console.log(e));
        }

        if (hasCloud && db) {
            const orderData = { 
                customerName, customerPhone, customerAddress: customerAddress||"غير محدد", zone: zoneName, items: [], subtotal: subTotal, discount: discountAmount, deliveryFee: finalDelivery, total: finalTotal, status: "new", 
                usedPromo: appliedPromo ? appliedPromo.code : null, generatedPromo: newPromoCode || null, batch: globalSettings.batchHashtag || "", orderDate: orderDate, orderTime: orderTime, isRead: false, createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                batchId: batchId, batchName: batchName, 
                adminNote: adminAndCustomerNotes // 👇 حفظ الملاحظة هنا في الـ CRM
            };
            for (let id in cart) orderData.items.push({ id, name: cart[id].name, quantity: cart[id].quantity, price: cart[id].price });
            
            await db.collection("orders").add(orderData);
            
            await db.collection('inventory').doc('stats').set({ sales: firebase.firestore.FieldValue.increment(finalTotal), orders: firebase.firestore.FieldValue.increment(1) }, { merge: true });
            
            let cleanPhoneForDB = window.formatPhoneNumber(customerPhone);
            await db.collection("customers").doc(cleanPhoneForDB).set({ name: customerName, phone: cleanPhoneForDB, zone: zoneName, address: customerAddress || "", lastOrder: firebase.firestore.FieldValue.serverTimestamp(), imported: false }, { merge: true });
            
            if(batchId) {
                let bookedUpdates = {};
                for (let id in cart) { 
                    bookedUpdates[id] = firebase.firestore.FieldValue.increment(cart[id].quantity); 
                }
                await db.collection("inventory").doc("batches").set({ [batchId]: { booked: bookedUpdates } }, { merge: true });
            }

            if(promoUpdated) { 
                await db.collection("inventory").doc("settings").set({ promoCodes: globalSettings.promoCodes, rewardMaxGenerations: globalSettings.rewardMaxGenerations }, { merge: true }); 
            }
            
            let stockUpdates = {}; 
            for (let id in cart) { 
                stockUpdates[id] = firebase.firestore.FieldValue.increment(-cart[id].quantity); 
            }
            await db.collection('inventory').doc('stock').set(stockUpdates, { merge: true });

        }
    } catch(e) { console.log("Sync Error", e); }

    cart = {}; window.nextBatchCart = {}; saveCart(); appliedPromo = null; 
    if(document.getElementById('promo-code-input')) document.getElementById('promo-code-input').value = ""; 
    if(document.getElementById('promo-message')) document.getElementById('promo-message').classList.add('hidden');
    document.getElementById('customer-name').value = ""; document.getElementById('customer-phone').value = ""; document.getElementById('customer-address').value = ""; document.getElementById('delivery-zone').value = ""; 
    
    // تصفير خانة الملاحظات بعد الإرسال
    if(document.getElementById('customer-notes')) document.getElementById('customer-notes').value = ""; 
    
    updateUI(); const container = document.getElementById('products-container'); if(container) container.innerHTML = '<div class="text-center py-10 text-brand-cyanDark"><i class="fa-solid fa-spinner fa-spin text-3xl mb-3"></i><p class="font-bold text-sm">جاري التحديث...</p></div>'; renderProducts(); toggleCart(); checkoutBtn.innerHTML = originalBtnHtml; checkoutBtn.disabled = false;

    // 🌟 1. استخراج وقت الدفعة التفاعلي (ليعمل في الشاشتين معاً) 🌟
    let interactiveTime = "";
    let loyaltyBatchHtml = "";

    if (batchId && globalBatches[batchId]) {
        const batchData = globalBatches[batchId];
        interactiveTime = window.getFriendlyBatchDatePhrase(batchData.deliveryStart, batchData.deliveryEnd);
        // تصميم رسالة الدفعة اللي هتظهر في شاشة הـ VIP
        loyaltyBatchHtml = `<div class="bg-red-50 border border-red-100 p-3 rounded-xl mt-3 mb-3 shadow-sm"><span class="font-black text-brand-navy block mb-1">📦 ميعاد استلامك مخصص:</span><span class="font-black text-red-600">${interactiveTime}</span></div>`;
    }

    if (earnedLoyalty) {
        const rewardDesc = globalSettings.rewardType === 'free_delivery' ? 'توصيل مجاني' : globalSettings.rewardType === 'percent' ? `خصم ${globalSettings.rewardValue}%` : `خصم ${globalSettings.rewardValue} ج.م`;
        const customMsg = globalSettings.autoPromoModalMsg || "تم إصدار كود خصم خاص بك لطلبك القادم 🎁";
        
        // 🌟 2. دمج رسالة الدفعة (loyaltyBatchHtml) في كود הـ VIP بدون حذف أي شيء 🌟
        const msgHTML = `<div class="text-5xl mb-3">🎉</div><div class="font-black text-brand-navy mb-2 text-lg">شكراً لطلبك يا ${customerName.split(' ')[0]}!</div><div class="text-green-600 font-black text-sm mb-2">${customMsg}</div><div class="bg-gray-100 border-2 border-dashed border-gray-300 p-4 rounded-xl mb-4 relative"><span class="text-xs font-bold text-gray-500 block mb-1">كود الخصم الخاص بك:</span><span class="font-black text-3xl text-brand-cyanDark tracking-wider select-all block mb-2">${newPromoCode}</span><button onclick="navigator.clipboard.writeText('${newPromoCode}'); this.innerHTML='<i class=\\'fa-solid fa-check\\'></i> تم النسخ بنجاح'; this.classList.replace('bg-brand-navy', 'bg-green-500'); setTimeout(() => { this.innerHTML='<i class=\\'fa-regular fa-copy\\'></i> انسخ الكود'; this.classList.replace('bg-green-500', 'bg-brand-navy'); }, 2000);" class="w-full bg-brand-navy hover:opacity-90 text-white text-sm py-2 rounded-lg font-bold transition-colors flex justify-center items-center gap-2 shadow-sm"><i class="fa-regular fa-copy"></i> انسخ الكود</button><span class="text-xs font-bold text-gray-600 block mt-3">يمنحك ${rewardDesc}</span></div>${loyaltyBatchHtml}<div class="text-sm font-bold text-brand-navy mt-2">الأوردر وصل السيستم بنجاح وسيتم تجهيزه.</div>`;
        
        document.getElementById('alert-icon-container').classList.add('hidden'); document.getElementById('alert-title').classList.add('hidden'); document.getElementById('alert-message').innerHTML = msgHTML;

        const alertBtn = document.querySelector('#alert-box button'); 
        alertBtn.className = "bg-green-500 hover:bg-green-600 text-white font-black py-4 px-6 rounded-xl w-full transition-colors flex justify-center items-center gap-2 shadow-lg"; 
        alertBtn.innerHTML = 'موافق، تحويل للواتساب <i class="fa-brands fa-whatsapp text-xl"></i>'; 
        alertBtn.onclick = () => { closeAlert(); window.location.href = `https://api.whatsapp.com/send?phone=20${globalSettings.storePhone}&text=${encodeURIComponent(message)}`; };
        const md = document.getElementById('alert-modal'); md.classList.remove('hidden'); setTimeout(()=>md.classList.remove('opacity-0'),10);
    } else {
        const uiTexts = globalSettings.uiTexts || {};
        const titleText = uiTexts['successTitle'] || 'تم تأكيد أوردرك بنجاح! 🎉';
        
        // 1. الرسالة الافتراضية (لو الأوردر فوري مش تبع دفعة)
        let bodyText = uiTexts['successMsgTemplate'] || `أوردرك اتسجل في السيستم عندنا خلاص. هيتم التجهيز عشان تستلمه.`;
        
        // 2. التعديل التفاعلي (لو الأوردر تبع دفعة)
        if (batchId && globalBatches[batchId]) {
            bodyText = `أوردرك اتسجل بنجاح في <span class="font-black text-brand-navy">${batchName}</span>.<br>📦 وميعاد تسليم حضرتك مخصص <span class="font-black text-red-600">${interactiveTime}</span>. هيتم التواصل معاك للتأكيد قبل التحرك!`;
        }

        // 3. سطر الفورمات الممتاز بتاعك (عشان لو فيه أي تاريخ صريح 2026/09/03 يتنسق صح)
        bodyText = bodyText.replace(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/g, '<span dir="ltr" style="display: inline-block; font-weight: 900; color: #b91c1c;">$1</span>');
        
        const waBtnText = uiTexts['waFollowUpBtn'] || 'التواصل والمتابعة ع الواتساب';
        const closeBtnText = uiTexts['closeFollowUpBtn'] || 'تمام، شكراً 👍';

        window.currentOrderWaLink = `https://api.whatsapp.com/send?phone=20${globalSettings.storePhone}&text=${encodeURIComponent(message)}`;

        const msgHTML = `<div dir="rtl" class="w-full block clear-both" style="font-family: 'Cairo', sans-serif; text-align: right; direction: rtl;"><div class="text-center w-full mb-2"><div class="w-14 h-14 bg-green-100 text-green-500 rounded-full flex items-center justify-center mx-auto text-2xl shadow-sm"><i class="fa-solid fa-check"></i></div><h3 class="font-black text-brand-navy mt-2 text-base md:text-lg">${titleText}</h3></div><div class="text-xs md:text-sm font-bold text-green-800 leading-relaxed bg-[#f0fdf4] p-3 rounded-xl border border-green-200 block w-full mb-4 shadow-inner" style="text-align: right; direction: rtl; white-space: normal; word-break: break-word;">${bodyText}</div><div class="flex flex-col gap-2 w-full">
        <button onclick="closeAlert(); window.location.href='track.html?phone=${customerPhone}';" class="w-full bg-brand-navy hover:bg-green-800 text-white font-black py-3 px-4 rounded-xl transition-all flex justify-center items-center gap-2 shadow-md text-center"><i class="fa-solid fa-route"></i><span>تتبع حالة الطلب الآن</span></button>
        <button onclick="closeAlert(); window.open(window.currentOrderWaLink, '_blank');" class="w-full bg-[#25D366] hover:bg-[#1ebd57] text-white font-black py-3 px-4 rounded-xl transition-all flex justify-center items-center gap-2 shadow-md text-center"><i class="fa-brands fa-whatsapp text-xl"></i><span>${waBtnText}</span></button>
        <button onclick="closeAlert()" class="w-full bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold py-3 px-4 rounded-xl transition-colors shadow-sm text-center text-xs">${closeBtnText}</button></div></div>`;
        const alertBtn = document.querySelector('#alert-box button'); if(alertBtn) alertBtn.classList.add('hidden');
        document.getElementById('alert-icon-container').classList.add('hidden'); document.getElementById('alert-title').classList.add('hidden'); 
        const alertMsg = document.getElementById('alert-message'); if(alertMsg) { alertMsg.className = "w-full block p-0 m-0"; alertMsg.style.textAlign = "right"; alertMsg.innerHTML = msgHTML; }
        const md = document.getElementById('alert-modal'); if(md) { md.classList.remove('hidden'); setTimeout(() => md.classList.remove('opacity-0'), 10); }
    }
};

const invalidNameKeywords = ["جوز", "سمان", "طبق", "سوبر", "جامبو", "بيض", "دبح", "تنضيف", "كتاكيت", "سبشيال"];

function isNameValid(name) {
    if(!name || name.trim().length < 3) return false;
    let cleanName = name.toLowerCase();
    for(let keyword of invalidNameKeywords) {
        if(cleanName.includes(keyword)) return false;
    }
    return true;
}

window.formatPhoneNumber = function(phone) {
    if(!phone) return '';
    const arabicNumbers = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
    let cleaned = phone.replace(/[٠-٩]/g, w => arabicNumbers.indexOf(w));
    cleaned = cleaned.replace(/\D/g, '');
    if (cleaned.startsWith('201') && cleaned.length === 12) { cleaned = '0' + cleaned.substring(2); }
    return cleaned;
};

let phoneTimeout;
document.addEventListener('DOMContentLoaded', () => {
    const phoneInput = document.getElementById('customer-phone');
    if(phoneInput) {
        phoneInput.addEventListener('input', function(e) {
            clearTimeout(phoneTimeout); let cleanPhone = formatPhoneNumber(e.target.value);
            if(cleanPhone.length >= 10) { phoneTimeout = setTimeout(() => { checkCustomerLoyalty(cleanPhone); }, 800); } 
            else { hideCustomerWelcome(); }
        });
    }
});

window.checkCustomerLoyalty = async function(cleanPhone) {
    if(!hasCloud || !db) return;
    try {
        const doc = await db.collection('customers').doc(cleanPhone).get();
        if(doc.exists) {
            const data = doc.data();
            
            if(data.name && isNameValid(data.name)) {
                document.getElementById('customer-name').value = data.name;
            } else {
                document.getElementById('customer-name').value = ''; 
            }

            if(data.address && document.getElementById('customer-address')) document.getElementById('customer-address').value = data.address;
            
            if(data.zone && document.getElementById('delivery-zone')) {
                const zoneSelect = document.getElementById('delivery-zone');
                let found = Array.from(zoneSelect.options).some(opt => opt.text.includes(data.zone));
                if(found) {
                    for(let i=0; i<zoneSelect.options.length; i++) {
                        if(zoneSelect.options[i].text.includes(data.zone)) {
                            zoneSelect.selectedIndex = i; break;
                        }
                    }
                    renderDeliveryZones(); updateUI(); 
                }
            }
            
            let firstName = data.name.split(' ')[0];
            if(isNameValid(data.name)) {
                showCustomerWelcome(`أهلاً بيك مرة تانية في بيتك يا ${firstName}! 👑 جهزنا بياناتك.`, 'bg-green-50', 'text-green-700', 'border-green-200');
            } else {
                showCustomerWelcome(`أهلاً بيك معانا! ✨ ياريت تكتب اسمك ثلاثي عشان نأكدلك الحجز.`, 'bg-yellow-50', 'text-yellow-700', 'border-yellow-200');
            }
            updateUI(); 
        } else {
            showCustomerWelcome(`نورت عيلة سمان ههيا ! ✨ كمل بياناتك عشان تتسجل في الـ VIP.`, 'bg-blue-50', 'text-blue-700', 'border-blue-200');
        }
    } catch(e) { console.log("Customer lookup error", e); }
};

window.showCustomerWelcome = function(text, bgColor, textColor, borderColor) {
    let msgEl = document.getElementById('smart-welcome-msg');
    if(!msgEl) {
        msgEl = document.createElement('div'); msgEl.id = 'smart-welcome-msg';
        const nameInput = document.getElementById('customer-name'); nameInput.parentNode.insertBefore(msgEl, nameInput); 
    }
    msgEl.className = `p-3 mb-4 rounded-xl border text-xs font-black shadow-sm transition-all duration-300 ${bgColor} ${textColor} ${borderColor}`;
    msgEl.innerHTML = text; msgEl.classList.remove('hidden');
};

window.hideCustomerWelcome = function() {
    const msgEl = document.getElementById('smart-welcome-msg');
    if(msgEl) msgEl.classList.add('hidden');
};

// === 🕵️‍♂️ الفخ السري للدخول للوحة الإدارة ===
let secretClickCount = 0;
let secretClickTimer;

function checkSecretAdminAccess() {
    secretClickCount++;
    if (secretClickCount === 1) {
        // معاك ثانية ونص بس عشان تكمل الـ 3 ضغطات
        secretClickTimer = setTimeout(() => { secretClickCount = 0; }, 1500);
    }
    if (secretClickCount === 3) {
        clearTimeout(secretClickTimer);
        secretClickCount = 0;
        // التوجيه فوراً لصفحة الأدمن
        window.location.href = "admn.html"; 
    }
}

// ربط الضغطة السرية باسم المتجر اللي فوق (الهيدر)
document.addEventListener('DOMContentLoaded', () => {
    // هنستنى ثانية عشان نتأكد إن كل حاجة حملت
    setTimeout(() => {
        const storeNameElement = document.getElementById('header-store-name');
        if(storeNameElement) {
            storeNameElement.onclick = checkSecretAdminAccess;
            // عشان الماوس يتغير ويبقى كأنه زرار
            storeNameElement.style.cursor = "pointer"; 
            // عشان نمنع تظليل النص وإنت بتضغط بسرعة
            storeNameElement.style.userSelect = "none"; 
        }
    }, 1000);
});
