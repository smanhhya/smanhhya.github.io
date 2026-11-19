// js/app.js - محرك متجر سمان ههيا المطور (متوافق 100% مع الـ CRM ومحصّن أمنياً)

(function () {
    const U = window.SMAN_UTILS;
    const esc = U.escapeHtml;
    const escAttr = U.escapeJsAttr;

    window.nextBatchCart = {};
    window.currentSlide = 0;
    window.sliderImages = [];
    window.currentOrderWaLink = '';

    let isSubmittingOrder = false;
    let activeCustomerWallet = { phone: '', points: 0, discountEGP: 0, useWallet: false };
    let liveNotiStarted = false;

    // =========================================================================
    // 1. نافذة الترحيب والتخزين المحلي الآمن
    // =========================================================================
    document.addEventListener('DOMContentLoaded', () => {
        const alreadySeen = sessionStorage.getItem('sman_welcome_seen') === '1';
        const overlay = document.getElementById('smart-welcome-overlay');
        if (overlay && !alreadySeen) {
            overlay.classList.remove('hidden');
            setTimeout(() => {
                overlay.classList.remove('opacity-0');
                const box = document.getElementById('smart-welcome-box');
                if (box) {
                    box.classList.remove('scale-90');
                    box.classList.add('scale-100');
                }
            }, 40);
            document.body.style.overflow = 'hidden';
        }

        renderDeliveryZones();
        loadCart();
        loadSavedLocalProfile();
        setupEventListeners();
        initFirebase();
    });

    window.closeSmartWelcome = function () {
        sessionStorage.setItem('sman_welcome_seen', '1');
        const overlay = document.getElementById('smart-welcome-overlay');
        if (!overlay) return;
        overlay.classList.add('opacity-0');
        const box = document.getElementById('smart-welcome-box');
        if (box) {
            box.classList.remove('scale-100');
            box.classList.add('scale-90');
        }
        setTimeout(() => {
            overlay.classList.add('hidden');
            document.body.style.overflow = '';
            if (typeof window.scrollToBatch === 'function') window.scrollToBatch();
        }, 300);
    };

    function saveCart() {
        try {
            localStorage.setItem('sman_cart_v2', JSON.stringify(cart));
        } catch (e) {}
    }

    function loadCart() {
        try {
            const saved = localStorage.getItem('sman_cart_v2') || localStorage.getItem('sman_cart');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed && typeof parsed === 'object') cart = parsed;
            }
        } catch (e) {
            cart = {};
            localStorage.removeItem('sman_cart_v2');
        }
        updateUI();
    }

    // حفظ بيانات العميل على جهازه الشخصي فقط لتسهيل طلباته القادمة دون تسريب بيانات أي عميل آخر
    function saveLocalProfile(name, phone, zone, address) {
        try {
            localStorage.setItem('sman_my_profile', JSON.stringify({
                name: name || '',
                phone: phone || '',
                zone: zone || '',
                address: address || ''
            }));
        } catch (e) {}
    }

    function loadSavedLocalProfile() {
        try {
            const raw = localStorage.getItem('sman_my_profile');
            if (!raw) return;
            const prof = JSON.parse(raw);
            if (!prof) return;
            if (prof.name && document.getElementById('customer-name')) document.getElementById('customer-name').value = prof.name;
            if (prof.phone && document.getElementById('customer-phone')) document.getElementById('customer-phone').value = prof.phone;
            if (prof.address && document.getElementById('customer-address')) document.getElementById('customer-address').value = prof.address;
            if (prof.zone) window._preferredSavedZone = prof.zone;
        } catch (e) {}
    }

    // =========================================================================
    // 2. الاتصال السريع بقاعدة البيانات مع التخزين المخبأ ووضع الإنقاذ
    // =========================================================================
    function initFirebase() {
        try {
            if (!firebase.apps.length) {
                firebase.initializeApp(FIREBASE_CONFIG);
            }
            db = firebase.firestore();
            db.enablePersistence({ synchronizeTabs: true }).catch(() => {});
            hasCloud = true;
            listenToDatabase();

            // صمام أمان: فتح المتجر تلقائياً خلال 2.5 ثانية في حالة ضعف الشبكة
            setTimeout(() => {
                if (!isStoreDataLoaded) {
                    isStoreDataLoaded = true;
                    Object.keys(productsInfo).forEach((id) => {
                        if (globalStock[id] === undefined) globalStock[id] = 0;
                        if (globalPrices[id] === undefined) globalPrices[id] = productsInfo[id].basePrice || 0;
                    });
                    applySettingsToUI();
                    renderDeliveryZones();
                    renderBatchesSelection();
                    renderProducts();
                    updateUI();
                }
            }, 2500);
        } catch (e) {
            console.error('Firebase Init Error:', e);
        }
    }

    async function listenToDatabase() {
        if (!db) return;
        try {
            const [settingsDoc, stockDoc, pricesDoc, oldPricesDoc, batchesDoc, discountsDoc] = await Promise.all([
                db.collection('inventory').doc('settings').get(),
                db.collection('inventory').doc('stock').get(),
                db.collection('inventory').doc('prices').get(),
                db.collection('inventory').doc('old_prices').get().catch(() => ({ exists: false })),
                db.collection('inventory').doc('batches').get(),
                db.collection('inventory').doc('discounts_status').get().catch(() => ({ exists: false }))
            ]);

            if (settingsDoc.exists) {
                const data = settingsDoc.data() || {};
                if (data.productsData && typeof data.productsData === 'object') {
                    productsInfo = data.productsData;
                }
                // استبعاد أي حقول إدارية غير لازمة للمتجر
                const safeSettings = { ...data };
                delete safeSettings.drivers;
                Object.assign(globalSettings, safeSettings);

                if (Array.isArray(data.deliveryZones) && data.deliveryZones.length > 0) {
                    globalDeliveryZones = data.deliveryZones.map((z, idx) => ({
                        id: z.id || z.name || `zone_${idx}`,
                        name: z.name || 'منطقة',
                        price: Number(z.price) || 0
                    }));
                }
            }

            if (stockDoc.exists) Object.assign(globalStock, stockDoc.data() || {});
            if (pricesDoc.exists) Object.assign(globalPrices, pricesDoc.data() || {});
            if (oldPricesDoc && oldPricesDoc.exists) Object.assign(globalOldPrices, oldPricesDoc.data() || {});
            if (discountsDoc && discountsDoc.exists) Object.assign(globalDiscounts, discountsDoc.data() || {});
            if (batchesDoc.exists) globalBatches = batchesDoc.data() || {};

            isStoreDataLoaded = true;
            Object.keys(productsInfo).forEach((id) => {
                const p = productsInfo[id];
                if (!p) return;
                if (globalStock[id] === undefined) globalStock[id] = 0;
                if (globalPrices[id] === undefined) globalPrices[id] = Number(p.basePrice) || 0;
            });

            applySettingsToUI();
            renderDeliveryZones();
            renderBatchesSelection();
            renderProducts();
            startLiveNotifications();
            updateUI();

            // فحص رصيد المحفظة تلقائياً إذا كان رقم العميل محفوظاً على جهازه
            const phoneVal = document.getElementById('customer-phone')?.value || '';
            const norm = U.normalizePhone(phoneVal);
            if (norm.length >= 10) checkCustomerWalletSafe(norm);
        } catch (e) {
            console.error('Firebase Fetch Error:', e);
        }
    }

    // =========================================================================
    // 3. حسابات المخزون وسقف الدفعة بدقة متوافقة مع الـ CRM
    // =========================================================================
    function isMainQuailItem(id) {
        const p = productsInfo[id];
        if (!p) return true;
        const cat = U.getProductCategoryAndRank(id, p);
        return cat.group === 'quail';
    }

    function getBatchRemainingCeilingPairs(batch) {
        if (!batch) return null;
        const cap = Number(batch.publicPairs) || Number(batch.actualPairs) || 0;
        if (cap <= 0) return null;

        let bookedMain = 0;
        if (batch.booked && typeof batch.booked === 'object') {
            Object.keys(batch.booked).forEach((pId) => {
                if (isMainQuailItem(pId)) {
                    bookedMain += Number(batch.booked[pId]) || 0;
                }
            });
        }

        let inCartMain = 0;
        Object.keys(cart).forEach((pId) => {
            if (isMainQuailItem(pId)) {
                inCartMain += Number(cart[pId]?.quantity) || 0;
            }
        });

        return Math.max(0, cap - bookedMain - inCartMain);
    }

    function getPureAvailableStock(id) {
        const p = productsInfo[id];
        if (!p) return 0;

        if (p.isWeightBased) {
            return U.parseWeightsArray(p.weightsList).length;
        }

        const batchId = document.getElementById('user-batch-select')?.value || '';
        if (batchId && globalBatches[batchId]) {
            const batch = globalBatches[batchId];
            const bStock = (batch.stock && batch.stock[id] !== undefined && Number(batch.stock[id]) > 0)
                ? Number(batch.stock[id])
                : (Number(globalStock[id]) || 0);
            const bBooked = (batch.booked && batch.booked[id]) ? Number(batch.booked[id]) : 0;
            let rem = Math.max(0, bStock - bBooked);

            // احترام سقف الدفعة العام للأصناف الأساسية (سمان بالجوز)
            if (isMainQuailItem(id)) {
                const cap = Number(batch.publicPairs) || Number(batch.actualPairs) || 0;
                if (cap > 0) {
                    let bookedMain = 0;
                    if (batch.booked) {
                        Object.keys(batch.booked).forEach((k) => {
                            if (isMainQuailItem(k)) bookedMain += Number(batch.booked[k]) || 0;
                        });
                    }
                    const capRem = Math.max(0, cap - bookedMain);
                    rem = Math.min(rem > 0 ? rem : capRem, capRem);
                }
            }
            return Math.max(0, Math.floor(rem));
        }

        return Math.max(0, Math.floor(Number(globalStock[id]) || 0));
    }

    function getAvailableStock(id) {
        const p = productsInfo[id];
        if (!p) return 0;
        if (p.isWeightBased) {
            const allW = U.parseWeightsArray(p.weightsList);
            const pickedCount = Array.isArray(cart[id]?.selectedWeightsGrams) ? cart[id].selectedWeightsGrams.length : 0;
            return Math.max(0, allW.length - pickedCount);
        }

        const inCart = Number(cart[id]?.quantity) || 0;
        const pure = getPureAvailableStock(id);
        let rem = Math.max(0, pure - inCart);

        const batchId = document.getElementById('user-batch-select')?.value || '';
        if (batchId && globalBatches[batchId] && isMainQuailItem(id)) {
            const capRem = getBatchRemainingCeilingPairs(globalBatches[batchId]);
            if (capRem !== null) rem = Math.min(rem, Math.floor(capRem));
        }
        return Math.max(0, rem);
    }

    // =========================================================================
    // 4. عرض الإعدادات والنصوص والكتالوج والمناطق
    // =========================================================================
    function applyUITexts() {
        const t = globalSettings.uiTexts || {};
        const defaults = {
            cartTotalLabel: 'الإجمالي (بدون التوصيل)',
            viewCartBtn: 'عرض السلة',
            checkoutTitle: 'سلة المشتريات',
            promoBtn: 'تفعيل',
            subtotalLabel: 'قيمة الطلبات:',
            deliveryLabel: 'مصاريف التوصيل:',
            finalTotalLabel: 'الإجمالي النهائي:',
            menuTitle: 'سمان مذبوح طازج (بالجوز)',
            extrasTitle: 'بيض سمان وكتاكيت ومنتجات أخرى'
        };
        const setTxt = (id, key) => {
            const el = document.getElementById(id);
            if (el) el.textContent = t[key] || defaults[key] || '';
        };
        setTxt('lbl-cart-total', 'cartTotalLabel');
        setTxt('lbl-view-cart', 'viewCartBtn');
        setTxt('lbl-checkout-title', 'checkoutTitle');
        setTxt('lbl-promo-btn', 'promoBtn');
        setTxt('lbl-subtotal', 'subtotalLabel');
        setTxt('lbl-delivery-summary', 'deliveryLabel');
        setTxt('lbl-final-total', 'finalTotalLabel');
        setTxt('lbl-menu-title', 'menuTitle');
        setTxt('lbl-extras-title', 'extrasTitle');

        if (Array.isArray(globalSettings.trustBadges) && globalSettings.trustBadges.length === 4) {
            for (let i = 1; i <= 4; i++) {
                const badge = globalSettings.trustBadges[i - 1];
                const iconEl = document.getElementById(`badge-${i}-icon`);
                const titleEl = document.getElementById(`badge-${i}-title`);
                const descEl = document.getElementById(`badge-${i}-desc`);
                if (iconEl && badge.icon) iconEl.className = `${badge.icon} text-brand-navy text-xl`;
                if (titleEl) titleEl.textContent = badge.title || '';
                if (descEl) descEl.textContent = badge.desc || '';
            }
        }
    }

    function applySettingsToUI() {
        const storeName = globalSettings.storeName || 'سمان ههيا';
        const headerName = document.getElementById('header-store-name');
        const footerName = document.getElementById('footer-store-name');
        const descEl = document.getElementById('header-store-desc');
        if (headerName) headerName.textContent = storeName;
        if (footerName) footerName.textContent = storeName;
        if (descEl && globalSettings.storeDesc) descEl.textContent = globalSettings.storeDesc;

        const phoneStr = globalSettings.storePhone || '01208027294';
        const footerPhone = document.getElementById('footer-phone');
        const footerPhoneLink = document.getElementById('footer-phone-link');
        if (footerPhone) footerPhone.textContent = phoneStr;
        if (footerPhoneLink) footerPhoneLink.href = `tel:${phoneStr}`;

        // رسالة الإعلان الهام (تنظيف آمن ضد XSS)
        const card = document.getElementById('hero-announcement-card');
        const textEl = document.getElementById('hero-announcement-text');
        if (card && textEl) {
            if (globalSettings.heroMessage && globalSettings.heroMessage.trim() !== '') {
                textEl.textContent = globalSettings.heroMessage.trim();
                card.classList.remove('hidden');
            } else {
                card.classList.add('hidden');
            }
        }

        // حالة فتح/إغلاق المتجر
        const wrapper = document.getElementById('store-wrapper');
        const closedMsg = document.getElementById('store-closed-msg');
        const mainCartBtn = document.getElementById('main-cart-btn');
        const isOpen = globalSettings.storeOpen !== false;

        if (!isOpen) {
            if (wrapper) wrapper.classList.add('opacity-50', 'pointer-events-none');
            if (closedMsg) {
                closedMsg.classList.remove('hidden');
                const innerDiv = closedMsg.querySelector('div');
                if (innerDiv) innerDiv.textContent = globalSettings.closedMessage || 'المتجر مغلق حالياً، نعود قريباً!';
            }
            if (mainCartBtn) mainCartBtn.disabled = true;
        } else {
            if (wrapper) wrapper.classList.remove('opacity-50', 'pointer-events-none');
            if (closedMsg) closedMsg.classList.add('hidden');
            if (mainCartBtn) mainCartBtn.disabled = false;
        }

        const minWarn = document.getElementById('min-order-warning');
        if (Number(globalSettings.minOrder) > 0) {
            const minEl = document.getElementById('min-order-value');
            if (minEl) minEl.textContent = globalSettings.minOrder;
            if (minWarn) minWarn.classList.remove('hidden');
        } else if (minWarn) {
            minWarn.classList.add('hidden');
        }

        const promoToggle = document.getElementById('promo-toggle-btn');
        if (promoToggle) {
            promoToggle.classList.toggle('hidden', globalSettings.showPromoField === false);
        }

        renderSlider();
        applyUITexts();
    }

    function renderDeliveryZones() {
        const select = document.getElementById('delivery-zone');
        if (!select) return;
        const currentVal = select.value || window._preferredSavedZone || '';
        select.innerHTML = '<option value="" disabled selected>اختر منطقتك لحساب الشحن...</option>';

        globalDeliveryZones.forEach((zone) => {
            const opt = document.createElement('option');
            opt.value = zone.id || zone.name;
            opt.textContent = Number(zone.price) === 0
                ? `${zone.name} (يحدد لاحقاً)`
                : `${zone.name} (${zone.price} ج.م)`;
            select.appendChild(opt);
        });

        if (currentVal) {
            const match = globalDeliveryZones.find((z) => z.id === currentVal || z.name === currentVal);
            if (match) select.value = match.id || match.name;
        }
    }

    // --- السلايدر وعارض الصور المكبر ---
    window.moveSlider = function (direction) {
        if (!window.sliderImages || window.sliderImages.length <= 1) return;
        window.currentSlide = (window.currentSlide + direction + window.sliderImages.length) % window.sliderImages.length;
        window.updateSliderView();
    };

    window.updateSliderView = function () {
        const track = document.getElementById('slider-track');
        if (track) track.style.transform = `translateX(${window.currentSlide * 100}%)`;
        document.querySelectorAll('.slider-dot').forEach((dot, idx) => {
            dot.className = `slider-dot h-2 w-2 rounded-full transition-all duration-300 shadow-sm cursor-pointer ${idx === window.currentSlide ? 'active' : 'bg-gray-300'}`;
        });
    };

    function renderSlider() {
        const track = document.getElementById('slider-track');
        const dots = document.getElementById('slider-dots');
        const container = document.getElementById('main-slider-container');
        if (!track || !dots || !container) return;

        const images = (Array.isArray(globalSettings.galleryImages) && globalSettings.galleryImages.length > 0)
            ? globalSettings.galleryImages.filter((x) => x && String(x).trim() !== '')
            : ['all-sizes.jpg'];
        window.sliderImages = images;

        track.innerHTML = images.map((img) => {
            const safeImg = escAttr(img);
            return `
            <div class="w-full shrink-0 max-h-[380px] bg-[#fdfbf7] overflow-hidden relative flex justify-center items-center p-2 cursor-zoom-in" onclick="openImageModal('${safeImg}')">
                <img src="${esc(img)}" alt="دليل الأحجام" loading="lazy" class="max-w-full max-h-[360px] object-contain rounded-xl transition-transform duration-300 hover:scale-[1.02]" onerror="this.style.display='none'">
            </div>`;
        }).join('');

        dots.innerHTML = images.length > 1
            ? images.map((_, idx) => `<div class="slider-dot h-2 w-2 rounded-full transition-all duration-300 ${idx === 0 ? 'active' : 'bg-gray-300'} cursor-pointer" onclick="event.stopPropagation(); window.currentSlide=${idx}; window.updateSliderView();"></div>`).join('')
            : '';

        container.querySelectorAll('.slider-nav-btn').forEach((btn) => {
            btn.classList.toggle('hidden', images.length <= 1);
        });

        window.currentSlide = 0;
        window.updateSliderView();

        let touchStartX = 0;
        const viewport = document.getElementById('slider-viewport');
        if (viewport) {
            viewport.ontouchstart = (e) => { touchStartX = e.changedTouches[0].screenX; };
            viewport.ontouchend = (e) => {
                const diff = e.changedTouches[0].screenX - touchStartX;
                if (diff < -35) window.moveSlider(-1);
                if (diff > 35) window.moveSlider(1);
            };
        }
    }

    window.openImageModal = function (imgSrc) {
        if (!imgSrc || !String(imgSrc).trim()) return;
        let modal = document.getElementById('image-viewer-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'image-viewer-modal';
            modal.className = 'fixed inset-0 z-[120] bg-brand-navy/95 flex items-center justify-center hidden opacity-0 transition-all duration-300 backdrop-blur-md p-4 cursor-zoom-out';
            modal.onclick = () => {
                closeImageViewer();
                if (window.location.hash === '#catalog') history.back();
            };
            modal.innerHTML = `
                <div class="relative w-full max-w-3xl h-full flex items-center justify-center">
                    <i class="fa-solid fa-spinner fa-spin absolute text-brand-yellow text-3xl z-0" id="img-loader"></i>
                    <img id="image-viewer-img" src="" alt="" onload="document.getElementById('img-loader').style.display='none'" class="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl scale-95 transition-transform duration-300 relative z-10">
                    <button type="button" class="absolute top-3 right-3 bg-white/20 hover:bg-white/40 text-white rounded-full w-10 h-10 flex items-center justify-center z-20">
                        <i class="fa-solid fa-xmark text-xl"></i>
                    </button>
                </div>`;
            document.body.appendChild(modal);
        }

        const imgEl = document.getElementById('image-viewer-img');
        const loader = document.getElementById('img-loader');
        if (loader) loader.style.display = 'block';
        imgEl.src = imgSrc;
        modal.classList.remove('hidden');
        setTimeout(() => {
            modal.classList.remove('opacity-0');
            imgEl.classList.remove('scale-95');
            imgEl.classList.add('scale-100');
        }, 10);
        try { history.pushState({ modalOpen: true }, '', '#catalog'); } catch (e) {}
    };

    function closeImageViewer() {
        const modal = document.getElementById('image-viewer-modal');
        if (modal && !modal.classList.contains('hidden')) {
            modal.classList.add('opacity-0');
            setTimeout(() => modal.classList.add('hidden'), 250);
        }
    }
    window.addEventListener('popstate', closeImageViewer);

    // =========================================================================
    // 5. كروت الدفعات المتوافقة مع الـ CRM (العمر البيولوجي + التواريخ + السقف)
    // =========================================================================
    window.getFriendlyBatchDatePhrase = function (startDateStr, endDateStr) {
        if (!startDateStr) return 'قريباً فور التجهيز';
        const startDate = new Date(startDateStr);
        if (isNaN(startDate.getTime())) return esc(startDateStr);
        const day = startDate.getDate();
        const months = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
        const mText = months[startDate.getMonth()];
        const part = day <= 10 ? `أول شهر ${mText}` : (day <= 20 ? `منتصف شهر ${mText}` : `أواخر شهر ${mText}`);
        if (endDateStr) {
            const endD = new Date(endDateStr);
            if (!isNaN(endD.getTime()) && endD.getDate() !== day) {
                return `${part} (من يوم ${day} إلى ${endD.getDate()} ${mText})`;
            }
        }
        return `${part} (بداية من يوم ${day} ${mText})`;
    };

    function getBatchSmartCustomerNote(batch) {
        if (batch.urgentNote && batch.urgentNote.trim()) {
            return { isUrgent: true, text: batch.urgentNote.trim() };
        }
        if (batch.customerMsg && batch.customerMsg.trim()) {
            return { isUrgent: false, text: batch.customerMsg.trim() };
        }
        if (batch.slaughteredAt) {
            const days = (Date.now() - batch.slaughteredAt) / (1000 * 60 * 60 * 24);
            return {
                isUrgent: false,
                text: days >= 3 ? 'تم التسليم بالكامل للعملاء.. بالهنا والشفا!' : 'تم الذبح طازج وجاري التوزيع مع المناديب الآن!'
            };
        }
        if (batch.hatchDate && batch.slaughterAge) {
            const age = Math.max(0, Math.floor((Date.now() - batch.hatchDate) / (1000 * 60 * 60 * 24)));
            const rem = (Number(batch.slaughterAge) || 40) - age;
            if (!batch.isOpen) return { isUrgent: false, text: 'اكتفينا بالحجز والسمان الآن في مرحلة التجهيز للذبح.' };
            if (rem <= 0) return { isUrgent: false, text: 'السمان وصل لمرحلة النضج وجاهز فريش للتسليم قريباً!' };
            if (rem <= 5) return { isUrgent: false, text: 'أيام بسيطة جداً والسمان يكون جاهز طازج للتسليم!' };
            if (age <= 15) return { isUrgent: false, text: 'السمان حالياً في مرحلة التحضين والرعاية الأولية.' };
            return { isUrgent: false, text: 'السمان في مرحلة التسمين وبناء اللحم الممتاز.' };
        }
        return null;
    }

    function renderBatchesSelection() {
        const batchSelect = document.getElementById('user-batch-select');
        const batchNameHidden = document.getElementById('selected-batch-name');
        const batchContainer = document.getElementById('batch-selection-container');
        const cardsWrapper = document.getElementById('batch-cards-wrapper');
        if (!batchSelect || !batchContainer || !cardsWrapper) return;

        let batchesArr = Object.keys(globalBatches)
            .map((id) => ({ id, ...globalBatches[id] }))
            .filter((b) => b && b.name && b.name !== 'undefined' && b.isVisible !== false);

        const openBatches = batchesArr.filter((b) => b.isOpen).sort((a, b) => a.id.localeCompare(b.id));
        const closedBatches = batchesArr.filter((b) => !b.isOpen).sort((a, b) => b.id.localeCompare(a.id));
        const toShow = [...openBatches, ...closedBatches.slice(0, 2)];

        if (toShow.length === 0) {
            batchContainer.classList.add('hidden');
            updateWelcomeModalBatches([], []);
            return;
        }

        batchContainer.classList.remove('hidden');

        let currentVal = batchSelect.value;
        if ((!currentVal || !globalBatches[currentVal] || !globalBatches[currentVal].isOpen) && openBatches.length > 0) {
            currentVal = openBatches[0].id;
            batchSelect.value = currentVal;
            if (batchNameHidden) batchNameHidden.value = openBatches[0].name || '';
        }

        cardsWrapper.innerHTML = toShow.map((batch) => {
            const bId = batch.id;
            const safeId = escAttr(bId);
            const dateText = window.getFriendlyBatchDatePhrase(batch.deliveryStart, batch.deliveryEnd);
            const smartNote = getBatchSmartCustomerNote(batch);

            if (batch.isOpen) {
                let totalStock = Number(batch.publicPairs) || Number(batch.actualPairs) || 0;
                if (totalStock <= 0 && batch.stock) {
                    Object.values(batch.stock).forEach((v) => { totalStock += Number(v) || 0; });
                }
                let totalBooked = 0;
                if (batch.booked) {
                    Object.keys(batch.booked).forEach((k) => {
                        if (isMainQuailItem(k)) totalBooked += Number(batch.booked[k]) || 0;
                    });
                }
                const pct = totalStock > 0 ? Math.min(100, Math.round((totalBooked / totalStock) * 100)) : 0;
                const isSelected = currentVal === bId;

                let statusChip = '';
                if (pct >= 80) {
                    statusChip = `<div class="mt-2 bg-orange-50 border border-orange-200 text-orange-700 text-[11px] font-black py-1.5 px-2.5 rounded-xl flex items-center justify-center gap-1.5"><i class="fa-solid fa-fire animate-pulse text-orange-500"></i> العدد قرب يكتمل.. الحق احجز!</div>`;
                } else if (pct >= 45) {
                    statusChip = `<div class="mt-2 bg-blue-50 border border-blue-200 text-blue-700 text-[11px] font-black py-1.5 px-2.5 rounded-xl flex items-center justify-center gap-1.5"><i class="fa-solid fa-spinner fa-spin text-blue-500"></i> جاري استقبال الحجوزات والتجهيز</div>`;
                } else {
                    statusChip = `<div class="mt-2 bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-black py-1.5 px-2.5 rounded-xl flex items-center justify-center gap-1.5"><i class="fa-solid fa-door-open text-emerald-600"></i> باب الحجز مفتوح.. اطلب براحتك</div>`;
                }

                return `
                <div id="card-${esc(bId)}" onclick="selectBatchAndScroll('${safeId}')" class="batch-card-item cursor-pointer border-2 ${isSelected ? 'border-brand-navy bg-brand-light shadow-md ring-2 ring-brand-navy/15' : 'border-gray-200 bg-white hover:border-brand-navy/50'} rounded-2xl p-3.5 transition-all flex flex-col justify-between">
                    <div class="flex justify-between items-start gap-2 mb-1.5">
                        <div class="min-w-0">
                            <h4 class="font-black text-brand-navy text-sm sm:text-base truncate">${esc(batch.name)}</h4>
                            <p class="text-[11px] font-bold text-gray-600 mt-0.5"><i class="fa-regular fa-calendar-check text-brand-cyanDark ml-1"></i> ${esc(dateText)}</p>
                        </div>
                        <div class="check-icon-container shrink-0">
                            ${isSelected ? '<i class="fa-solid fa-circle-check text-brand-navy text-xl"></i>' : '<i class="fa-regular fa-circle text-gray-300 text-xl"></i>'}
                        </div>
                    </div>
                    ${smartNote ? `<div class="${smartNote.isUrgent ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-gray-50 border-gray-100 text-gray-600'} border px-2.5 py-1.5 rounded-xl text-[11px] font-bold leading-snug mt-1">${smartNote.isUrgent ? '📌 ' : ''}${esc(smartNote.text)}</div>` : ''}
                    ${statusChip}
                </div>`;
            }

            // الدفعة المغلقة
            const isPast = Boolean(batch.slaughteredAt) || (batch.deliveryStart && new Date(batch.deliveryStart).getTime() <= Date.now());
            return `
            <div class="border-2 border-gray-200 bg-gray-50 rounded-2xl p-3.5 opacity-80 flex flex-col justify-between">
                <div class="flex justify-between items-start gap-2 mb-1.5">
                    <div>
                        <h4 class="font-black text-gray-600 text-sm sm:text-base">${esc(batch.name)}</h4>
                        <p class="text-[11px] font-bold text-gray-400 ${isPast ? 'line-through' : ''}">${esc(dateText)}</p>
                    </div>
                    <i class="fa-solid ${isPast ? 'fa-medal text-amber-500' : 'fa-seedling text-emerald-600'} text-xl shrink-0"></i>
                </div>
                <div class="mt-2 bg-white py-1.5 px-2.5 rounded-xl border border-gray-200 text-[11px] font-black text-gray-600 text-center">
                    ${isPast ? '✅ اكتملت وتم التسليم بنجاح' : '⏳ اكتفينا بالحجز وجاري التجهيز'}
                </div>
            </div>`;
        }).join('');

        updateWelcomeModalBatches(openBatches, toShow);
    }

    function updateWelcomeModalBatches(openBatches, toShow) {
        const wSpinner = document.getElementById('welcome-spinner');
        const infoBox = document.getElementById('welcome-batch-info');
        const listDiv = document.getElementById('welcome-batches-list');
        const wBtn = document.getElementById('btn-welcome-continue');
        const wDesc = document.getElementById('welcome-modal-desc');

        if (wSpinner) wSpinner.classList.add('hidden');

        if (toShow.length > 0 && listDiv) {
            listDiv.innerHTML = toShow.map((batch) => {
                if (batch.isOpen) {
                    return `<div class="flex items-center gap-2 text-[11px] font-bold text-emerald-800 bg-emerald-50 p-2 rounded-xl border border-emerald-100"><i class="fa-solid fa-door-open text-emerald-600"></i> <span><strong class="text-brand-navy">${esc(batch.name)}:</strong> مفتوح للحجز الآن</span></div>`;
                }
                const isPast = Boolean(batch.slaughteredAt) || (batch.deliveryStart && new Date(batch.deliveryStart).getTime() <= Date.now());
                return `<div class="flex items-center gap-2 text-[11px] font-bold ${isPast ? 'text-gray-500 bg-gray-50 border-gray-200' : 'text-amber-800 bg-amber-50 border-amber-200'} p-2 rounded-xl border"><i class="fa-solid ${isPast ? 'fa-check-double text-gray-400' : 'fa-hourglass-half text-amber-500'}"></i> <span><strong>${esc(batch.name)}:</strong> ${isPast ? 'تم التسليم بنجاح' : 'اكتفينا بالحجز وجاري التجهيز'}</span></div>`;
            }).join('');

            if (infoBox) {
                infoBox.classList.remove('hidden');
                setTimeout(() => infoBox.classList.remove('translate-y-3', 'opacity-0'), 60);
            }
        }

        if (wBtn) {
            wBtn.disabled = false;
            if (openBatches.length > 0) {
                wBtn.innerHTML = 'تصفح المنيو واطلب براحتك <i class="fa-solid fa-cart-shopping"></i>';
                wBtn.className = 'w-full bg-brand-navy hover:opacity-95 text-white font-black py-3.5 rounded-xl shadow-lg transition-all flex justify-center items-center gap-2 pulse-animation cursor-pointer text-sm';
            } else {
                if (wDesc && toShow.length === 0) wDesc.textContent = 'مرحباً بك في سمان ههيا! تصفح الأصناف والأسعار المتاحة الآن.';
                wBtn.innerHTML = 'الدخول للمتجر <i class="fa-solid fa-arrow-left"></i>';
                wBtn.className = 'w-full bg-brand-navy text-white font-black py-3.5 rounded-xl shadow-md transition-all flex justify-center items-center gap-2 cursor-pointer text-sm';
            }
        }
    }

    window.selectBatchAndScroll = function (bId) {
        const batch = globalBatches[bId];
        if (!batch || !batch.isOpen) return;

        const batchInput = document.getElementById('user-batch-select');
        const batchNameInput = document.getElementById('selected-batch-name');
        if (batchInput) batchInput.value = bId;
        if (batchNameInput) batchNameInput.value = batch.name || '';
        document.getElementById('batch-error-msg')?.classList.add('hidden');

        // ضبط السلة إذا كانت كمياتها تتخطى المتاح في الدفعة المختارة
        let adjusted = false;
        Object.keys(cart).forEach((id) => {
            if (!productsInfo[id] || productsInfo[id].isWeightBased) return;
            const maxPure = getPureAvailableStock(id);
            if (cart[id].quantity > maxPure) {
                cart[id].quantity = maxPure;
                adjusted = true;
                if (cart[id].quantity <= 0) delete cart[id];
            }
        });
        window.nextBatchCart = {};
        if (adjusted) {
            saveCart();
            showAlert('تنبيه المخزون', 'تم ضبط كميات السلة لتناسب المتاح في الدفعة التي اخترتها.');
        }

        renderBatchesSelection();
        renderProducts();
        updateUI();

        setTimeout(() => {
            const target = document.getElementById('lbl-menu-title');
            if (target) {
                const y = target.getBoundingClientRect().top + window.scrollY - 70;
                window.scrollTo({ top: y, behavior: 'smooth' });
            }
        }, 120);
    };

    window.scrollToBatch = function () {
        const batchBox = document.getElementById('batch-selection-container');
        if (batchBox && !batchBox.classList.contains('hidden')) {
            batchBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
            batchBox.classList.add('ring-4', 'ring-brand-yellow', 'transition-all');
            setTimeout(() => batchBox.classList.remove('ring-4', 'ring-brand-yellow'), 1400);
        }
    };

    // =========================================================================
    // 6. محرك عرض المنتجات المرتب (سمان بالجوز / بيض وكتاكيت / طيور بالوزن)
    // =========================================================================
    function buildStandardProductCard(id, item) {
        const available = getAvailableStock(id);
        const currentPrice = Number(globalPrices[id] !== undefined ? globalPrices[id] : item.basePrice) || 0;
        const oldPrice = Number(item.oldPrice || globalOldPrices[id]) || 0;
        const isDiscountActive = Boolean((item.isDisc || globalDiscounts[id]) && oldPrice > currentPrice);
        const isBestSeller = Boolean(item.isBest || (Array.isArray(globalSettings.bestSellers) && globalSettings.bestSellers.includes(id)));

        const stockBadgeClass = available === 0
            ? 'bg-red-50 text-red-600 border-red-200'
            : (available <= 10 ? 'bg-orange-50 text-orange-700 border-orange-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200');

        let cardGlowClass = 'border-gray-100';
        if (available === 0) cardGlowClass = 'border-red-200 opacity-90';
        else if (available <= 10) cardGlowClass = 'border-orange-300 ring-2 ring-orange-100';
        else if (isDiscountActive) cardGlowClass = 'border-red-200';

        const priceHtml = isDiscountActive
            ? `<div class="flex items-center gap-1.5">
                   <span class="text-[10px] text-gray-400 line-through font-bold">${oldPrice} ج</span>
                   <div class="bg-red-50 border border-red-200 px-2 py-0.5 rounded-lg"><span class="font-black text-red-600 text-base sm:text-lg">${currentPrice} <span class="text-[9px]">ج.م</span></span></div>
               </div>`
            : `<div class="bg-brand-light border border-brand-cyan/30 px-2.5 py-0.5 rounded-lg"><span class="font-black text-brand-navy text-base sm:text-lg">${currentPrice} <span class="text-[9px] text-brand-navy/70">ج.م</span></span></div>`;

        const saleBadgeHtml = isDiscountActive
            ? `<div class="absolute top-2.5 left-2.5 bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-lg shadow-md sale-badge z-20"><i class="fa-solid fa-tag"></i> عرض</div>`
            : '';

        const bestSellerHtml = isBestSeller
            ? `<div class="absolute bottom-2 right-2 bg-brand-navy text-brand-yellow text-[9px] font-black px-2 py-0.5 rounded-md shadow-md z-10 border border-brand-yellow/30"><i class="fa-solid fa-star text-[8px] ml-0.5"></i> الأكثر طلباً</div>`
            : '';

        const imgSrc = (Array.isArray(item.images) && item.images.length > 0 && item.images[0]) ? item.images[0] : '';
        const safeId = escAttr(id);
        const safeImg = escAttr(imgSrc);

        return `
        <div class="bg-white rounded-2xl shadow-sm border ${cardGlowClass} overflow-hidden flex flex-row min-h-[136px] relative transition-all duration-200 hover:shadow-md group">
            ${saleBadgeHtml}
            <div class="p-3 flex-1 flex flex-col justify-between min-w-0 z-10">
                <div>
                    <h3 class="text-sm sm:text-base font-black text-brand-navy truncate mb-1.5">${esc(item.name)}</h3>
                    <div class="flex flex-wrap items-center justify-between gap-1.5 mb-2">
                        ${priceHtml}
                        ${item.weight ? `<span class="bg-gray-50 text-gray-500 text-[10px] px-2 py-0.5 rounded-lg border border-gray-100 font-bold whitespace-nowrap"><i class="fa-solid fa-scale-balanced ml-1 text-gray-400"></i>${esc(item.weight)}</span>` : ''}
                    </div>
                </div>
                <div class="flex items-center justify-between gap-2 mt-auto">
                    <div class="text-[10px] font-black px-2 py-1 rounded-lg border ${stockBadgeClass} shrink-0 flex items-center gap-1">
                        ${available <= 10 && available > 0 ? '<i class="fa-solid fa-fire text-orange-500 animate-pulse"></i>' : ''}
                        <span>المتاح: <strong id="stock-display-${esc(id)}">${available}</strong></span>
                    </div>
                    <div class="w-28 shrink-0" id="card-action-${esc(id)}">${getCardActionHTML(id)}</div>
                </div>
            </div>

            <div class="w-28 sm:w-36 shrink-0 relative border-r border-gray-100 overflow-hidden bg-gray-50 cursor-zoom-in" onclick="openImageModal('${safeImg}')">
                ${bestSellerHtml}
                ${imgSrc
                    ? `<img loading="lazy" src="${esc(imgSrc)}" alt="${esc(item.name)}" class="w-full h-full object-cover object-center transition-transform duration-500 group-hover:scale-105" onerror="this.style.display='none'">`
                    : `<div class="w-full h-full flex items-center justify-center text-gray-300"><i class="fa-solid fa-kiwi-bird text-3xl"></i></div>`}
            </div>
        </div>`;
    }

    // كارت خاص للأصناف المباعة بالوزن (فراخ تسمين / رومي)
    function buildWeightProductCard(id, item) {
        const kiloPrice = Number(globalPrices[id] !== undefined ? globalPrices[id] : item.basePrice) || 0;
        const weightsArr = U.parseWeightsArray(item.weightsList);
        const pickedIndices = Array.isArray(cart[id]?.selectedIndices) ? cart[id].selectedIndices : [];
        const imgSrc = (Array.isArray(item.images) && item.images.length > 0 && item.images[0]) ? item.images[0] : '';
        const safeId = escAttr(id);

        const chipsHtml = weightsArr.length > 0
            ? weightsArr.map((grams, idx) => {
                const kg = (grams / 1000).toFixed(2);
                const estPrice = Math.round((grams / 1000) * kiloPrice);
                const isPicked = pickedIndices.includes(idx);
                return `
                    <button type="button" onclick="toggleWeightBirdInCart('${safeId}', ${idx}, ${grams})" class="px-2.5 py-1.5 rounded-xl text-[11px] font-black border transition-all flex items-center gap-1.5 ${isPicked ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-white text-slate-700 border-indigo-200 hover:bg-indigo-50'}">
                        <i class="fa-solid ${isPicked ? 'fa-check-circle text-amber-300' : 'fa-plus text-indigo-500'} text-[10px]"></i>
                        <span>${kg} كجم (${estPrice} ج)</span>
                    </button>`;
            }).join('')
            : `<span class="text-xs font-bold text-gray-400">نفذت الأوزان المتاحة حالياً — تابعنا في الدفعة القادمة</span>`;

        return `
        <div class="bg-white rounded-2xl shadow-sm border-2 ${pickedIndices.length > 0 ? 'border-indigo-500 ring-2 ring-indigo-100' : 'border-indigo-100'} p-3.5 space-y-2.5">
            <div class="flex items-center justify-between gap-3">
                <div class="flex items-center gap-2.5 min-w-0">
                    ${imgSrc ? `<img src="${esc(imgSrc)}" alt="${esc(item.name)}" onclick="openImageModal('${escAttr(imgSrc)}')" class="w-12 h-12 rounded-xl object-cover border border-indigo-100 cursor-zoom-in shrink-0">` : `<div class="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0"><i class="fa-solid fa-scale-balanced text-lg"></i></div>`}
                    <div class="min-w-0">
                        <h3 class="text-sm sm:text-base font-black text-indigo-950 truncate">${esc(item.name)}</h3>
                        <p class="text-[11px] font-bold text-gray-500">سعر الكيلو: <strong class="text-indigo-700">${kiloPrice} ج.م</strong> • متاح (${weightsArr.length})</p>
                    </div>
                </div>
                ${pickedIndices.length > 0 ? `<span class="bg-indigo-600 text-white text-[10px] font-black px-2.5 py-1 rounded-lg shrink-0">بالسلة: ${pickedIndices.length}</span>` : ''}
            </div>

            <div class="bg-indigo-50/50 p-2.5 rounded-xl border border-indigo-100">
                <p class="text-[10px] font-black text-indigo-900 mb-2"><i class="fa-solid fa-hand-pointer ml-1 text-indigo-500"></i> اضغط على الوزن المناسب لإضافته لسلتك:</p>
                <div class="flex flex-wrap gap-1.5">${chipsHtml}</div>
            </div>
        </div>`;
    }

    window.toggleWeightBirdInCart = function (id, idx, grams) {
        if (globalSettings.storeOpen === false) return;
        const p = productsInfo[id];
        if (!p) return;

        const kiloPrice = Number(globalPrices[id] !== undefined ? globalPrices[id] : p.basePrice) || 0;
        const existing = cart[id] || {
            isWeightBased: true,
            name: p.name,
            baseName: p.name,
            price: kiloPrice,
            quantity: 0,
            selectedIndices: [],
            selectedWeightsGrams: []
        };

        const pos = existing.selectedIndices.indexOf(idx);
        if (pos > -1) {
            existing.selectedIndices.splice(pos, 1);
            existing.selectedWeightsGrams.splice(pos, 1);
            if (navigator.vibrate) navigator.vibrate(20);
        } else {
            existing.selectedIndices.push(idx);
            existing.selectedWeightsGrams.push(grams);
            if (navigator.vibrate) navigator.vibrate(45);
        }

        if (existing.selectedWeightsGrams.length === 0) {
            delete cart[id];
        } else {
            const totalGrams = existing.selectedWeightsGrams.reduce((s, v) => s + v, 0);
            const totalKg = Number((totalGrams / 1000).toFixed(3));
            existing.quantity = totalKg;
            existing.price = kiloPrice;
            existing.name = `${p.name} [${existing.selectedWeightsGrams.join('+')}جم]`;
            cart[id] = existing;
        }

        saveCart();
        renderProducts();
        updateUI();
    };

    window.renderProducts = function () {
        if (!isStoreDataLoaded) return;
        const container = document.getElementById('products-container');
        const extrasContainer = document.getElementById('extras-container');
        const extrasWrap = document.getElementById('extras-section-wrap');
        const weightContainer = document.getElementById('weight-products-container');
        const weightWrap = document.getElementById('weight-section-wrap');
        const tabsBar = document.getElementById('store-category-tabs');
        if (!container) return;

        const groups = { quail: [], eggs_chicks: [], weight: [] };
        Object.keys(productsInfo).forEach((id) => {
            const item = productsInfo[id];
            if (!item || item.isVisible === false || item.isHidden === true) return;
            const meta = U.getProductCategoryAndRank(id, item);
            groups[meta.group].push({ id, item, rank: meta.rank });
        });

        groups.quail.sort((a, b) => a.rank - b.rank);
        groups.eggs_chicks.sort((a, b) => a.rank - b.rank);
        groups.weight.sort((a, b) => a.rank - b.rank);

        container.innerHTML = groups.quail.length > 0
            ? groups.quail.map((g) => buildStandardProductCard(g.id, g.item)).join('')
            : `<div class="text-center py-8 text-gray-400 font-bold bg-white rounded-2xl border border-dashed border-gray-200">${esc(globalSettings.uiTexts?.emptyMenuMsg || 'لا توجد منتجات متاحة حالياً')}</div>`;

        if (extrasContainer && extrasWrap) {
            if (groups.eggs_chicks.length > 0) {
                extrasContainer.innerHTML = groups.eggs_chicks.map((g) => buildStandardProductCard(g.id, g.item)).join('');
                extrasWrap.classList.remove('hidden');
            } else {
                extrasWrap.classList.add('hidden');
            }
        }

        if (weightContainer && weightWrap) {
            if (groups.weight.length > 0) {
                weightContainer.innerHTML = groups.weight.map((g) => buildWeightProductCard(g.id, g.item)).join('');
                weightWrap.classList.remove('hidden');
            } else {
                weightWrap.classList.add('hidden');
            }
        }

        // شريط التنقل السريع بين الأقسام إذا وُجد أكثر من قسم
        if (tabsBar) {
            const activeSecs = [];
            if (groups.quail.length > 0) activeSecs.push({ target: 'quail-section-wrap', label: `🥩 سمان بالجوز (${groups.quail.length})` });
            if (groups.eggs_chicks.length > 0) activeSecs.push({ target: 'extras-section-wrap', label: `🥚 بيض وكتاكيت (${groups.eggs_chicks.length})` });
            if (groups.weight.length > 0) activeSecs.push({ target: 'weight-section-wrap', label: `⚖️ طيور بالوزن (${groups.weight.length})` });

            if (activeSecs.length > 1) {
                tabsBar.innerHTML = activeSecs.map((s) => `
                    <button type="button" onclick="document.getElementById('${s.target}').scrollIntoView({behavior:'smooth', block:'start'})" class="whitespace-nowrap bg-white hover:bg-brand-navy text-brand-navy hover:text-white border border-gray-200 px-3 py-1.5 rounded-xl text-xs font-black shadow-sm transition-colors">
                        ${s.label}
                    </button>`).join('');
                tabsBar.classList.remove('hidden');
            } else {
                tabsBar.classList.add('hidden');
            }
        }
    };

    window.getCardActionHTML = function (id) {
        if (globalSettings.storeOpen === false) {
            return `<div class="w-full bg-gray-100 text-gray-400 font-black py-2 rounded-xl text-xs text-center">مغلق</div>`;
        }
        const inCart = Number(cart[id]?.quantity) || 0;
        const available = getAvailableStock(id);
        const safeId = escAttr(id);

        if (available === 0 && inCart === 0) {
            const hasOpenBatch = Object.values(globalBatches).some((b) => b && b.isOpen && b.isVisible !== false);
            return `
            <button type="button" onclick="${hasOpenBatch ? 'scrollToBatch()' : `updateNextBatch('${safeId}', 1)`}" class="w-full bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl py-1 px-1.5 flex flex-col items-center justify-center transition-colors">
                <span class="text-[10px] font-black text-red-600 leading-tight">نفذت الكمية</span>
                <span class="text-[9px] font-black text-white bg-red-500 px-1.5 py-0.5 rounded mt-0.5">${hasOpenBatch ? 'غيّر الدفعة ↑' : 'حجز للقادمة'}</span>
            </button>`;
        }

        if (inCart > 0) {
            return `
            <div class="flex items-center justify-between bg-brand-light border border-brand-navy/15 rounded-xl p-1 h-[36px]">
                <button type="button" onclick="updateQuantity('${safeId}', 1)" class="w-8 h-full bg-white text-brand-navy rounded-lg shadow-sm font-black text-base flex items-center justify-center active:scale-90">+</button>
                <span id="qty-num-${esc(id)}" class="font-black text-brand-navy text-sm min-w-[20px] text-center">${inCart}</span>
                <button type="button" onclick="updateQuantity('${safeId}', -1)" class="w-8 h-full bg-white text-red-500 rounded-lg shadow-sm font-black text-lg flex items-center justify-center active:scale-90">-</button>
            </div>`;
        }

        return `<button type="button" onclick="addToCart('${safeId}')" class="w-full bg-brand-navy hover:opacity-95 text-white font-black py-2 rounded-xl text-xs flex justify-center items-center gap-1.5 shadow-sm active:scale-95 transition-transform"><i class="fa-solid fa-plus text-brand-yellow"></i> إضافة</button>`;
    };

    window.updateNextBatch = function (id, delta) {
        if (!window.nextBatchCart[id]) window.nextBatchCart[id] = 0;
        window.nextBatchCart[id] += delta;
        if (window.nextBatchCart[id] <= 0) delete window.nextBatchCart[id];
        if (delta > 0 && window.nextBatchCart[id] === 1) {
            showAlert('حجز للدفعة القادمة ⏳', 'تم إضافة هذا المنتج كملاحظة ليتم تجهيزه لك في الدفعة القادمة، ولن يُحسب في فاتورة اليوم.');
        }
        renderProducts();
        updateUI();
    };

    window.addToCart = function (id) {
        if (globalSettings.storeOpen === false) return;
        const hasOpenBatches = Object.values(globalBatches).some((b) => b && b.isOpen && b.isVisible !== false);
        const batchSelect = document.getElementById('user-batch-select');
        if (hasOpenBatches && (!batchSelect || !batchSelect.value)) {
            showAlert('اختر الدفعة أولاً', 'برجاء اختيار ميعاد الاستلام (الدفعة) أولاً.');
            window.scrollToBatch();
            return;
        }
        if (getAvailableStock(id) <= 0) {
            showAlert('عذراً', 'الكمية المتاحة لا تكفي حالياً.');
            return;
        }
        if (navigator.vibrate) navigator.vibrate(45);

        const unitPrice = Number(globalPrices[id] !== undefined ? globalPrices[id] : productsInfo[id].basePrice) || 0;
        if (cart[id]) cart[id].quantity++;
        else cart[id] = { quantity: 1, price: unitPrice, name: productsInfo[id].name };

        saveCart();
        renderProducts();
        updateUI();

        const qtyEl = document.getElementById(`qty-num-${id}`);
        if (qtyEl) {
            qtyEl.classList.add('pop-anim');
            setTimeout(() => qtyEl.classList.remove('pop-anim'), 300);
        }
    };

    window.updateQuantity = function (id, delta) {
        if (!cart[id] || globalSettings.storeOpen === false) return;
        if (cart[id].isWeightBased) {
            if (delta < 0) {
                delete cart[id];
                saveCart();
                renderProducts();
                updateUI();
            }
            return;
        }

        if (delta > 0) {
            if (getAvailableStock(id) > 0) {
                cart[id].quantity++;
                if (navigator.vibrate) navigator.vibrate(45);
            } else {
                showAlert('عذراً', 'وصلت للحد الأقصى المتاح في هذه الدفعة.');
                return;
            }
        } else {
            cart[id].quantity--;
            if (navigator.vibrate) navigator.vibrate(20);
            if (cart[id].quantity <= 0) delete cart[id];
        }

        saveCart();
        renderProducts();
        updateUI();
    };

    // =========================================================================
    // 7. السلة، الكوبونات، ومحفظة النقاط
    // =========================================================================
    window.applyPromoCode = function () {
        const inputEl = document.getElementById('promo-code-input');
        const msg = document.getElementById('promo-message');
        if (!inputEl || !msg) return;
        const code = inputEl.value.trim().toUpperCase();
        if (!code) return;

        let subTotal = calculateCartSubtotal();
        const promo = (Array.isArray(globalSettings.promoCodes) ? globalSettings.promoCodes : [])
            .find((p) => p && String(p.code || '').toUpperCase() === code);

        const showErr = (txt) => {
            msg.textContent = txt;
            msg.className = 'text-[11px] font-bold mt-1.5 text-red-500';
            msg.classList.remove('hidden');
        };

        if (!promo) return showErr('كود الخصم غير صحيح.');
        if (promo.usesLeft !== null && promo.usesLeft !== undefined && promo.usesLeft <= 0) return showErr('عفواً، تم استهلاك هذا الكود بالكامل.');
        if (promo.expiryDate && new Date(promo.expiryDate) < new Date(new Date().toDateString())) return showErr('عفواً، هذا الكود منتهي الصلاحية.');
        if (promo.minOrder && subTotal < Number(promo.minOrder)) return showErr(`لتفعيل هذا الكود يجب أن تتخطى طلباتك ${promo.minOrder} ج.م.`);

        appliedPromo = { ...promo, isLoyalty: false };
        msg.textContent = 'تم تفعيل كود الخصم بنجاح 🎉';
        msg.className = 'text-[11px] font-black mt-1.5 text-emerald-600';
        msg.classList.remove('hidden');
        updateUI();
    };

    window.toggleCheckoutWalletDiscount = function (checked) {
        activeCustomerWallet.useWallet = Boolean(checked);
        updateUI();
    };

    function calculateCartSubtotal() {
        let sum = 0;
        Object.keys(cart).forEach((id) => {
            if (!productsInfo[id]) return;
            const item = cart[id];
            const unitPrice = Number(globalPrices[id] !== undefined ? globalPrices[id] : productsInfo[id].basePrice) || 0;
            item.price = unitPrice;
            sum += Math.round((Number(item.quantity) || 0) * unitPrice);
        });
        return sum;
    }

    window.updateUI = function () {
        let totalItems = 0;
        let subTotalPrice = 0;
        const cartItemsContainer = document.getElementById('cart-items');
        if (cartItemsContainer) cartItemsContainer.innerHTML = '';

        Object.keys(cart).forEach((id) => {
            if (!productsInfo[id]) {
                delete cart[id];
                return;
            }
            const item = cart[id];
            item.price = Number(globalPrices[id] !== undefined ? globalPrices[id] : productsInfo[id].basePrice) || 0;
            const lineTotal = Math.round((Number(item.quantity) || 0) * item.price);
            subTotalPrice += lineTotal;
            totalItems += item.isWeightBased ? (item.selectedWeightsGrams?.length || 1) : Number(item.quantity);

            if (cartItemsContainer) {
                const safeId = escAttr(id);
                cartItemsContainer.innerHTML += item.isWeightBased
                    ? `
                    <div class="bg-white p-3 rounded-xl border border-indigo-100 flex justify-between items-center gap-2 shadow-sm">
                        <div class="min-w-0 flex-1">
                            <h4 class="font-black text-indigo-950 text-xs truncate">${esc(item.name)}</h4>
                            <div class="text-indigo-700 font-black text-xs mt-0.5">${item.quantity} كجم × ${item.price} = ${lineTotal} ج.م</div>
                        </div>
                        <button type="button" onclick="updateQuantity('${safeId}', -1)" class="bg-red-50 text-red-500 hover:bg-red-500 hover:text-white w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors" title="حذف"><i class="fa-solid fa-trash text-xs"></i></button>
                    </div>`
                    : `
                    <div class="bg-white p-3 rounded-xl border border-gray-100 flex justify-between items-center gap-2 shadow-sm">
                        <div class="min-w-0 flex-1">
                            <h4 class="font-black text-brand-navy text-xs truncate">${esc(item.name)}</h4>
                            <div class="text-brand-cyanDark font-black text-xs mt-0.5">${item.price} ج.م للطبق</div>
                        </div>
                        <div class="flex items-center gap-1.5 bg-gray-50 rounded-xl p-1 border border-gray-200 h-[34px] shrink-0">
                            <button type="button" onclick="updateQuantity('${safeId}', 1)" class="w-7 h-full bg-white text-brand-navy rounded-lg shadow-sm font-black text-base flex items-center justify-center">+</button>
                            <span class="font-black text-brand-navy min-w-[22px] text-center text-xs">${item.quantity}</span>
                            <button type="button" onclick="updateQuantity('${safeId}', -1)" class="w-7 h-full bg-white text-red-500 rounded-lg shadow-sm font-black text-base flex items-center justify-center">-</button>
                        </div>
                    </div>`;
            }
        });

        let nextBatchHtml = '';
        Object.keys(window.nextBatchCart).forEach((id) => {
            const p = productsInfo[id];
            if (!p) return;
            const safeId = escAttr(id);
            nextBatchHtml += `
                <div class="flex justify-between items-center text-[11px] font-bold text-orange-800 bg-orange-50 p-2 rounded-xl border border-orange-200 mb-1">
                    <span>⏳ ${esc(p.name)}</span>
                    <div class="flex items-center gap-2 bg-white rounded-lg border border-orange-200 px-1.5 py-0.5">
                        <button type="button" class="text-orange-600 font-black px-1" onclick="updateNextBatch('${safeId}', 1)">+</button>
                        <span>${window.nextBatchCart[id]}</span>
                        <button type="button" class="text-red-500 font-black px-1" onclick="updateNextBatch('${safeId}', -1)">-</button>
                    </div>
                </div>`;
        });
        if (nextBatchHtml && cartItemsContainer) {
            cartItemsContainer.innerHTML += `<div class="mt-3 pt-2 border-t border-gray-200"><h5 class="text-xs font-black text-brand-navy mb-2">مطلوب للدفعة القادمة (كملاحظة):</h5>${nextBatchHtml}</div>`;
            if (totalItems === 0) totalItems = 1;
        }

        const bottomBar = document.getElementById('bottom-cart-bar');
        if (bottomBar) {
            document.getElementById('bottom-cart-total').textContent = subTotalPrice;
            document.getElementById('bottom-cart-count').textContent = totalItems;
            if (totalItems > 0) {
                bottomBar.classList.remove('translate-y-full');
            } else {
                bottomBar.classList.add('translate-y-full');
                if (cartItemsContainer) {
                    cartItemsContainer.innerHTML = `
                        <div class="flex flex-col items-center justify-center py-12 text-gray-400 gap-2.5">
                            <i class="fa-solid fa-basket-shopping text-5xl text-gray-200"></i>
                            <p class="font-bold text-sm">${esc(globalSettings.uiTexts?.emptyCartMsg || 'السلة فارغة حالياً')}</p>
                        </div>`;
                }
            }
        }

        // شريط التوصيل المجاني
        let freeDelivery = Boolean(globalSettings.freeDeliveryActive && subTotalPrice >= (Number(globalSettings.freeDeliveryThreshold) || 0) && subTotalPrice > 0);
        const tracker = document.getElementById('free-delivery-tracker');
        if (tracker) {
            if (globalSettings.freeDeliveryActive && subTotalPrice > 0) {
                tracker.classList.remove('hidden');
                const threshold = Number(globalSettings.freeDeliveryThreshold) || 1;
                const rem = Math.max(0, threshold - subTotalPrice);
                const prog = document.getElementById('fd-progress');
                const txt = document.getElementById('free-delivery-text');
                if (prog) {
                    prog.style.width = `${Math.min(100, (subTotalPrice / threshold) * 100)}%`;
                    prog.className = rem > 0 ? 'bg-brand-navy h-2 rounded-full progress-bar-animated' : 'bg-emerald-500 h-2 rounded-full progress-bar-animated';
                }
                if (txt) {
                    txt.innerHTML = rem > 0
                        ? `<span class="text-gray-600">باقي <strong class="text-brand-cyanDark">${rem} ج.م</strong> وتاخد توصيل مجاني!</span><i class="fa-solid fa-gift text-brand-yellow"></i>`
                        : `<span class="text-emerald-600 font-black">مبروك! التوصيل مجاني 🎉</span><i class="fa-solid fa-circle-check text-emerald-500"></i>`;
                }
            } else {
                tracker.classList.add('hidden');
            }
        }

        // حساب الخصم (الكوبون + محفظة النقاط)
        let promoDiscount = 0;
        const promoRow = document.getElementById('promo-discount-row');
        if (appliedPromo && subTotalPrice > 0) {
            if (appliedPromo.minOrder && subTotalPrice < Number(appliedPromo.minOrder)) {
                appliedPromo = null;
                if (promoRow) promoRow.classList.add('hidden');
            } else {
                if (appliedPromo.type === 'free_delivery') {
                    freeDelivery = true;
                    document.getElementById('promo-label').textContent = `${appliedPromo.code} (توصيل مجاني)`;
                    document.getElementById('cart-discount').textContent = '0';
                } else {
                    promoDiscount = appliedPromo.type === 'percent'
                        ? (subTotalPrice * (Number(appliedPromo.discount) / 100))
                        : Number(appliedPromo.discount) || 0;
                    if (appliedPromo.type === 'percent' && Number(appliedPromo.maxDiscount) > 0) {
                        promoDiscount = Math.min(promoDiscount, Number(appliedPromo.maxDiscount));
                    }
                    promoDiscount = Math.round(Math.min(promoDiscount, subTotalPrice));
                    document.getElementById('promo-label').textContent = appliedPromo.code;
                    document.getElementById('cart-discount').textContent = promoDiscount;
                }
                if (promoRow) promoRow.classList.remove('hidden');
            }
        } else if (promoRow) {
            promoRow.classList.add('hidden');
        }

        const totalAfterPromo = Math.max(0, subTotalPrice - promoDiscount);
        let walletDiscount = 0;
        const walletRow = document.getElementById('wallet-discount-row');
        if (activeCustomerWallet.useWallet && activeCustomerWallet.discountEGP > 0 && totalAfterPromo > 0) {
            walletDiscount = Math.min(activeCustomerWallet.discountEGP, totalAfterPromo);
            if (walletRow) walletRow.classList.remove('hidden');
            if (document.getElementById('cart-wallet-discount')) document.getElementById('cart-wallet-discount').textContent = walletDiscount;
        } else if (walletRow) {
            walletRow.classList.add('hidden');
        }

        const deliverySelect = document.getElementById('delivery-zone');
        const selectedZone = globalDeliveryZones.find((z) => z.id === deliverySelect?.value || z.name === deliverySelect?.value);
        const rawDelivery = selectedZone ? Number(selectedZone.price) || 0 : 0;
        const finalDelivery = freeDelivery ? 0 : rawDelivery;
        const finalTotal = Math.max(0, totalAfterPromo - walletDiscount + finalDelivery);

        if (document.getElementById('cart-subtotal')) document.getElementById('cart-subtotal').textContent = subTotalPrice;
        if (document.getElementById('cart-step1-total')) document.getElementById('cart-step1-total').textContent = totalAfterPromo;
        if (document.getElementById('cart-delivery-fee')) {
            const feeEl = document.getElementById('cart-delivery-fee');
            if (freeDelivery) feeEl.innerHTML = '<span class="text-emerald-600 font-black">مجاني 🎉</span>';
            else feeEl.textContent = (selectedZone && Number(selectedZone.price) === 0) ? 'يحدد لاحقاً' : `${finalDelivery} ج.م`;
        }
        if (document.getElementById('cart-total')) document.getElementById('cart-total').textContent = Math.round(finalTotal);

        const proceedBtn = document.getElementById('btn-proceed-checkout');
        const hint1 = document.getElementById('checkout-hint');
        const meetsMin = subTotalPrice >= (Number(globalSettings.minOrder) || 0);
        if (proceedBtn) {
            const canProceed = Object.keys(cart).length > 0 && meetsMin;
            proceedBtn.disabled = !canProceed;
            if (hint1) {
                if (Object.keys(cart).length > 0 && !meetsMin) {
                    hint1.textContent = `الحد الأدنى للطلب هو ${globalSettings.minOrder} ج.م`;
                    hint1.classList.remove('hidden');
                } else {
                    hint1.classList.add('hidden');
                }
            }
        }

        const checkoutHint2 = document.getElementById('checkout-hint-step2');
        if (checkoutHint2) {
            const nVal = document.getElementById('customer-name')?.value.trim() || '';
            const pVal = U.normalizePhone(document.getElementById('customer-phone')?.value || '');
            const isValid = Object.keys(cart).length > 0 && deliverySelect?.value && nVal.length >= 3 && pVal.length >= 10 && meetsMin;
            checkoutHint2.classList.toggle('hidden', Boolean(isValid || Object.keys(cart).length === 0));
        }
    };

    window.goToCheckoutStep2 = function () {
        const hasOpenBatches = Object.values(globalBatches).some((b) => b && b.isOpen && b.isVisible !== false);
        const batchSelect = document.getElementById('user-batch-select');
        if (hasOpenBatches && (!batchSelect || !batchSelect.value)) {
            showAlert('تنبيه مهم', 'برجاء تحديد ميعاد الاستلام (الدفعة) قبل إتمام الطلب.');
            toggleCart();
            setTimeout(() => window.scrollToBatch(), 300);
            return;
        }
        document.getElementById('checkout-step-1').classList.add('hidden');
        document.getElementById('checkout-step-2').classList.remove('hidden');
        document.getElementById('btn-back-step').classList.remove('hidden');
        document.getElementById('lbl-checkout-title').textContent = 'بيانات التوصيل والتأكيد';
        document.getElementById('step-1-indicator').classList.replace('step-active', 'step-completed');
        document.getElementById('step-line-1').classList.add('active');
        document.getElementById('step-2-indicator').classList.replace('opacity-50', 'step-active');
        updateUI();
    };

    window.backToCart = function () {
        document.getElementById('checkout-step-2').classList.add('hidden');
        document.getElementById('checkout-step-1').classList.remove('hidden');
        document.getElementById('btn-back-step').classList.add('hidden');
        document.getElementById('lbl-checkout-title').textContent = globalSettings.uiTexts?.checkoutTitle || 'سلة المشتريات';
        document.getElementById('step-2-indicator').classList.replace('step-active', 'opacity-50');
        document.getElementById('step-line-1').classList.remove('active');
        document.getElementById('step-1-indicator').classList.replace('step-completed', 'step-active');
        updateUI();
    };

    window.toggleCart = function () {
        const sidebar = document.getElementById('cart-sidebar');
        const overlay = document.getElementById('cart-overlay');
        if (!sidebar || !overlay) return;
        if (sidebar.classList.contains('translate-x-full')) {
            sidebar.classList.remove('translate-x-full');
            overlay.classList.remove('hidden');
            setTimeout(() => overlay.classList.remove('opacity-0'), 10);
            document.body.style.overflow = 'hidden';
            backToCart();
        } else {
            sidebar.classList.add('translate-x-full');
            overlay.classList.add('opacity-0');
            setTimeout(() => overlay.classList.add('hidden'), 300);
            document.body.style.overflow = '';
        }
    };

    // =========================================================================
    // 8. التحقق الآمن من رصيد محفظة العميل (بدون تسريب بياناته الشخصية لأي غريب)
    // =========================================================================
    function setupEventListeners() {
        ['customer-name', 'customer-phone', 'customer-address'].forEach((id) => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('input', updateUI);
        });
        const dZone = document.getElementById('delivery-zone');
        if (dZone) dZone.addEventListener('change', updateUI);

        const pInput = document.getElementById('promo-code-input');
        if (pInput) {
            pInput.addEventListener('input', () => {
                if (appliedPromo && !appliedPromo.isLoyalty && pInput.value.trim() === '') {
                    appliedPromo = null;
                    document.getElementById('promo-message')?.classList.add('hidden');
                    updateUI();
                }
            });
        }

        let phoneTimer = null;
        const phoneInput = document.getElementById('customer-phone');
        if (phoneInput) {
            phoneInput.addEventListener('input', (e) => {
                clearTimeout(phoneTimer);
                const norm = U.normalizePhone(e.target.value);
                if (norm.length >= 10) {
                    phoneTimer = setTimeout(() => checkCustomerWalletSafe(norm), 650);
                } else {
                    resetWalletBanner();
                }
            });
        }
    }

    function resetWalletBanner() {
        activeCustomerWallet = { phone: '', points: 0, discountEGP: 0, useWallet: false };
        const box = document.getElementById('checkout-wallet-box');
        const cb = document.getElementById('checkout-wallet-toggle');
        const msg = document.getElementById('smart-welcome-msg');
        if (box) box.classList.add('hidden');
        if (cb) cb.checked = false;
        if (msg) msg.classList.add('hidden');
        updateUI();
    }

    const invalidNameKeywords = ['جوز', 'سمان', 'طبق', 'سوبر', 'جامبو', 'بيض', 'دبح', 'تنضيف', 'كتاكيت', 'سبشيال'];

    function isCustomerNameValid(name) {
        if (!name || String(name).trim().length < 3) return false;
        const clean = String(name).toLowerCase();
        return !invalidNameKeywords.some((kw) => clean.includes(kw));
    }

    async function checkCustomerWalletSafe(cleanPhone) {
        if (!hasCloud || !db || !cleanPhone) return;
        try {
            const doc = await db.collection('customers').doc(cleanPhone).get();
            const msgEl = document.getElementById('smart-welcome-msg');
            const walletBox = document.getElementById('checkout-wallet-box');
            const walletTxt = document.getElementById('checkout-wallet-text');
            const nameInput = document.getElementById('customer-name');
            const addrInput = document.getElementById('customer-address');
            const zoneSelect = document.getElementById('delivery-zone');

            if (doc.exists) {
                const data = doc.data() || {};

                // 1. الملء التلقائي للاسم والعنوان والمنطقة من قاعدة البيانات
                const hasValidName = Boolean(data.name && isCustomerNameValid(data.name));
                if (nameInput) {
                    nameInput.value = hasValidName ? data.name : '';
                }
                if (addrInput && data.address) {
                    addrInput.value = data.address;
                }
                if (zoneSelect && data.zone) {
                    const targetZone = String(data.zone).trim();
                    for (let i = 0; i < zoneSelect.options.length; i++) {
                        const opt = zoneSelect.options[i];
                        if (opt.value === targetZone || opt.textContent.includes(targetZone)) {
                            zoneSelect.selectedIndex = i;
                            break;
                        }
                    }
                }

                // 2. رسالة الترحيب بالعميل (باستخدام textContent الآمن)
                if (msgEl) {
                    if (hasValidName) {
                        const firstName = String(data.name).trim().split(/\s+/)[0];
                        msgEl.className = 'p-2.5 rounded-xl border text-xs font-black bg-emerald-50 text-emerald-800 border-emerald-200';
                        msgEl.textContent = `أهلاً بيك مرة تانية في بيتك يا ${firstName}! 👑 جهزنا بياناتك تلقائياً.`;
                    } else {
                        msgEl.className = 'p-2.5 rounded-xl border text-xs font-black bg-amber-50 text-amber-800 border-amber-200';
                        msgEl.textContent = 'أهلاً بيك معانا! ✨ ياريت تكتب اسمك بالكامل عشان نأكدلك الحجز.';
                    }
                    msgEl.classList.remove('hidden');
                }

                // 3. عرض رصيد محفظة النقاط إن وجد
                const pts = Math.max(0, parseInt(data.walletPoints) || 0);
                const pVal = Number(globalSettings.pointValueInEGP) || 0.40;
                const disc = Math.floor(pts * pVal);

                if (pts > 0 && disc > 0 && walletBox && walletTxt) {
                    activeCustomerWallet = { phone: cleanPhone, points: pts, discountEGP: disc, useWallet: false };
                    walletTxt.textContent = `لديك ${pts} نقطة ولاء = خصم ${disc} ج.م`;
                    const cb = document.getElementById('checkout-wallet-toggle');
                    if (cb) cb.checked = false;
                    walletBox.classList.remove('hidden');
                } else {
                    if (walletBox) walletBox.classList.add('hidden');
                    activeCustomerWallet = { phone: cleanPhone, points: 0, discountEGP: 0, useWallet: false };
                }
            } else {
                if (walletBox) walletBox.classList.add('hidden');
                activeCustomerWallet = { phone: '', points: 0, discountEGP: 0, useWallet: false };
                if (msgEl) {
                    msgEl.className = 'p-2.5 rounded-xl border text-xs font-black bg-blue-50 text-blue-800 border-blue-200';
                    msgEl.textContent = '✨ نورت عيلة سمان ههيا! كمل بياناتك عشان تتسجل في نظام النقاط والـ VIP.';
                    msgEl.classList.remove('hidden');
                }
            }
            updateUI();
        } catch (e) {
            console.error('Customer lookup error:', e);
        }
    }

    // =========================================================================
    // 9. إتمام وتسجيل الطلب في Firebase (متوافق 100% مع الـ CRM وبدون Web3Forms)
    // =========================================================================
    window.initiateCheckout = function () {
        if (isSubmittingOrder) return;
        const csId = globalSettings.crossSellProductId;
        if (
            globalSettings.crossSellActive &&
            csId &&
            productsInfo[csId] &&
            !productsInfo[csId].isWeightBased &&
            !cart[csId] &&
            getAvailableStock(csId) > 0
        ) {
            const item = productsInfo[csId];
            document.getElementById('cross-sell-title').textContent = globalSettings.crossSellTitle || `جربت ${item.name}؟`;
            document.getElementById('cross-sell-desc').textContent = globalSettings.crossSellDesc || 'مغذي جداً للأطفال وطعمه حكاية!';
            document.getElementById('cross-sell-price').textContent = globalPrices[csId] || item.basePrice || 0;
            document.getElementById('cross-sell-img').src = (item.images && item.images[0]) ? item.images[0] : '';

            const modal = document.getElementById('cross-sell-modal');
            const box = document.getElementById('cross-sell-box');
            modal.classList.remove('hidden');
            setTimeout(() => {
                modal.classList.remove('opacity-0');
                box.classList.remove('scale-95');
                box.classList.add('scale-100');
            }, 10);
        } else {
            finalCheckoutStep();
        }
    };

    window.acceptCrossSell = function () {
        addToCart(globalSettings.crossSellProductId);
        const m = document.getElementById('cross-sell-modal');
        m.classList.add('opacity-0');
        setTimeout(() => { m.classList.add('hidden'); finalCheckoutStep(); }, 250);
    };

    window.declineCrossSell = function () {
        const m = document.getElementById('cross-sell-modal');
        m.classList.add('opacity-0');
        setTimeout(() => { m.classList.add('hidden'); finalCheckoutStep(); }, 250);
    };

    window.finalCheckoutStep = async function () {
        if (isSubmittingOrder) return;

        // حماية ضد التكرار العشوائي السريع (Cooldown 10 ثواني)
        const lastSubmitMs = Number(sessionStorage.getItem('sman_last_order_ms')) || 0;
        if (Date.now() - lastSubmitMs < 10000) {
            showAlert('تم تسجيل طلبك بالفعل', 'برجاء الانتظار ثوانٍ قليلة قبل تسجيل طلب جديد.');
            return;
        }

        const checkoutBtn = document.getElementById('checkout-btn');
        const origHtml = checkoutBtn.innerHTML;

        const customerName = (document.getElementById('customer-name')?.value || '').trim();
        const customerPhone = U.normalizePhone(document.getElementById('customer-phone')?.value || '');
        const customerAddress = (document.getElementById('customer-address')?.value || '').trim();
        const customerNotes = (document.getElementById('customer-notes')?.value || '').trim();
        const deliverySelect = document.getElementById('delivery-zone');
        const selectedZone = globalDeliveryZones.find((z) => z.id === deliverySelect?.value || z.name === deliverySelect?.value);

        // التحقق من المدخلات
        if (Object.keys(cart).length === 0) {
            return showAlert('السلة فارغة', 'اختر صنفاً واحداً على الأقل قبل تأكيد الطلب.');
        }
        if (customerName.length < 3 || !/^[\u0600-\u06FF\sA-Za-z.]+$/.test(customerName)) {
            return showAlert('الاسم غير مكتمل', 'يرجى كتابة الاسم الصحيح (3 أحرف على الأقل وبدون أرقام أو رموز).');
        }
        if (!/^01[0125][0-9]{8}$/.test(customerPhone)) {
            return showAlert('رقم الموبايل غير صحيح', 'يرجى كتابة رقم موبايل مصري صحيح مكون من 11 رقم (يبدأ بـ 010 أو 011 أو 012 أو 015).');
        }
        if (!selectedZone) {
            return showAlert('منطقة التوصيل مطلوبة', 'يرجى اختيار منطقة التوصيل لحساب إجمالي الطلب.');
        }

        if (appliedPromo && appliedPromo.customerPhone) {
            const locked = U.normalizePhone(appliedPromo.customerPhone).slice(-10);
            if (locked && locked !== customerPhone.slice(-10)) {
                return showAlert('تنبيه كود الخصم', 'عفواً، كود الخصم هذا مخصص لرقم هاتف آخر.');
            }
        }

        // التحقق من الدفعة
        let batchId = document.getElementById('user-batch-select')?.value || '';
        let batchName = document.getElementById('selected-batch-name')?.value || '';
        if (batchId && globalBatches[batchId]) {
            batchName = globalBatches[batchId].name || batchName;
        } else {
            const firstOpenId = Object.keys(globalBatches).find((id) => globalBatches[id]?.isOpen && globalBatches[id]?.isVisible !== false);
            if (firstOpenId) {
                batchId = firstOpenId;
                batchName = globalBatches[firstOpenId].name || '';
            }
        }

        // فحص نهائي للمخزون
        for (const id of Object.keys(cart)) {
            const p = productsInfo[id];
            if (!p || p.isWeightBased) continue;
            const pureAvail = getPureAvailableStock(id);
            if (cart[id].quantity > pureAvail) {
                showAlert('تنبيه المخزون', `الصنف (${p.name}) لم يعد متوفراً بهذه الكمية؛ تم تعديل الكمية تلقائياً للمتاح.`);
                cart[id].quantity = pureAvail;
                if (cart[id].quantity <= 0) delete cart[id];
                saveCart();
                renderProducts();
                updateUI();
                return;
            }
        }

        isSubmittingOrder = true;
        checkoutBtn.disabled = true;
        checkoutBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-lg"></i> جاري تسجيل طلبك...';

        const zoneName = selectedZone.name;
        const deliveryFee = Number(selectedZone.price) || 0;
        const subTotal = calculateCartSubtotal();

        let promoDiscount = 0;
        let discountText = '';
        if (appliedPromo) {
            if (appliedPromo.type === 'free_delivery') {
                discountText = `🎁 كود (${appliedPromo.code}): توصيل مجاني\n`;
            } else {
                promoDiscount = appliedPromo.type === 'percent'
                    ? (subTotal * (Number(appliedPromo.discount) / 100))
                    : Number(appliedPromo.discount) || 0;
                if (appliedPromo.type === 'percent' && Number(appliedPromo.maxDiscount) > 0) {
                    promoDiscount = Math.min(promoDiscount, Number(appliedPromo.maxDiscount));
                }
                promoDiscount = Math.round(Math.min(promoDiscount, subTotal));
                discountText = `🎁 كود (${appliedPromo.code}): -${promoDiscount} ج\n`;
            }
        }

        const totalAfterPromo = Math.max(0, subTotal - promoDiscount);
        const walletUsed = Boolean(activeCustomerWallet.useWallet && activeCustomerWallet.phone === customerPhone && activeCustomerWallet.points > 0 && totalAfterPromo > 0);
        const walletDiscount = walletUsed ? Math.min(activeCustomerWallet.discountEGP, totalAfterPromo) : 0;
        const walletPtsToDeduct = walletUsed ? activeCustomerWallet.points : 0;
        if (walletDiscount > 0) discountText += `🎁 خصم محفظة النقاط: -${walletDiscount} ج\n`;

        const totalDiscount = promoDiscount + walletDiscount;
        const freeDelivery = Boolean((globalSettings.freeDeliveryActive && totalAfterPromo >= (Number(globalSettings.freeDeliveryThreshold) || 0)) || (appliedPromo && appliedPromo.type === 'free_delivery'));
        const finalDelivery = freeDelivery ? 0 : deliveryFee;
        const finalTotal = Math.max(0, subTotal - totalDiscount + finalDelivery);

        // تنسيق التواريخ متوافق 100% مع تقارير الـ CRM (en-US)
        const now = new Date();
        const orderDateEn = now.toLocaleDateString('en-US');
        const orderDateAr = now.toLocaleDateString('ar-EG');
        const orderTime = now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

        // كود خصم تلقائي للطلب القادم إذا كان مفعلاً من الإعدادات
        let promoUpdated = false;
        if (appliedPromo && Array.isArray(globalSettings.promoCodes)) {
            const pIdx = globalSettings.promoCodes.findIndex((p) => p && p.code === appliedPromo.code);
            if (pIdx !== -1 && globalSettings.promoCodes[pIdx].usesLeft !== null && globalSettings.promoCodes[pIdx].usesLeft !== undefined) {
                globalSettings.promoCodes[pIdx].usesLeft = Math.max(0, globalSettings.promoCodes[pIdx].usesLeft - 1);
                promoUpdated = true;
            }
        }

        let earnedLoyalty = false;
        let newPromoCode = '';
        if (globalSettings.rewardActive && !appliedPromo && Number(globalSettings.rewardMaxGenerations) >= 0) {
            const prefix = globalSettings.autoPromoPrefix || 'VIP-';
            newPromoCode = prefix + Math.floor(1000 + Math.random() * 9000);
            earnedLoyalty = true;
            if (!Array.isArray(globalSettings.promoCodes)) globalSettings.promoCodes = [];
            globalSettings.promoCodes.push({
                code: newPromoCode,
                type: globalSettings.rewardType,
                discount: globalSettings.rewardValue,
                isAuto: true,
                usesLeft: 1,
                customerPhone: customerPhone,
                minOrder: 0,
                maxDiscount: Number(globalSettings.rewardMaxDiscount) || 0,
                expiryDate: ''
            });
            if (Number(globalSettings.rewardMaxGenerations) > 0) globalSettings.rewardMaxGenerations -= 1;
            promoUpdated = true;
        }

        // تجهيز مصفوفة الأصناف ورسالة الواتساب والملاحظات
        const orderItems = [];
        let itemsWaStr = '';
        Object.keys(cart).forEach((id) => {
            if (!productsInfo[id]) return;
            const item = cart[id];
            const lineTotal = Math.round(item.quantity * item.price);
            const cleanItemObj = {
                id: id,
                name: item.name,
                quantity: item.quantity,
                price: item.price
            };
            if (item.isWeightBased && Array.isArray(item.selectedWeightsGrams)) {
                cleanItemObj.isWeightBased = true;
                cleanItemObj.selectedWeightsGrams = item.selectedWeightsGrams;
            }
            orderItems.push(cleanItemObj);
            itemsWaStr += `▪ ${item.name}\n  └ ${item.quantity} × ${item.price} = ${lineTotal} ج.م\n`;
        });

        let notesChunks = [];
        if (walletUsed) notesChunks.push(`🎁 العميل فعّل خصم المحفظة (${walletDiscount} ج.م) بـ ${walletPtsToDeduct} نقطة.`);
        if (earnedLoyalty) notesChunks.push(`🎟 كود الخصم للطلب القادم: ${newPromoCode}`);
        const nextBatchKeys = Object.keys(window.nextBatchCart);
        if (nextBatchKeys.length > 0) {
            const nbStr = nextBatchKeys.map((id) => `${window.nextBatchCart[id]}x ${productsInfo[id]?.name || id}`).join(' + ');
            notesChunks.push(`⏳ مطلوب للدفعة القادمة: ${nbStr}`);
        }
        if (customerNotes) notesChunks.push(`📌 ملاحظة العميل: ${customerNotes}`);
        const finalAdminNote = notesChunks.join('\n---\n');

        const deliveryText = freeDelivery ? 'مجاني 🎉' : (deliveryFee === 0 ? 'يحدد لاحقاً' : `${deliveryFee} ج.م`);
        const custDetailsWa = `👤 الاسم: ${customerName}\n📱 الموبايل: ${customerPhone}\n📍 المنطقة: ${zoneName}\n${customerAddress ? `🏠 العنوان: ${customerAddress}\n` : ''}${batchName ? `📅 الدفعة: ${batchName}\n` : ''}🕒 الوقت: ${orderDateAr} - ${orderTime}`;
        let waMsg = (globalSettings.whatsappTemplate || '')
            .replace('{تفاصيل_العميل}', custDetailsWa)
            .replace('{الطلبات}', itemsWaStr.trim())
            .replace('{الخصم}', discountText ? discountText + '\n' : '')
            .replace('{قيمة_الطلبات}', subTotal)
            .replace('{التوصيل}', deliveryText)
            .replace('{الاجمالي}', finalTotal);
        if (customerNotes) waMsg += `\n\n📌 *ملاحظة:* ${customerNotes}`;

        try {
            if (hasCloud && db) {
                const orderData = {
                    customerName,
                    customerPhone,
                    customerAddress: customerAddress || 'غير محدد',
                    zone: zoneName,
                    items: orderItems,
                    subtotal: subTotal,
                    discount: totalDiscount,
                    deliveryFee: finalDelivery,
                    total: finalTotal,
                    status: 'new',
                    paymentMethod: 'cash',
                    paidCash: finalTotal,
                    paidOnline: 0,
                    usedPromo: appliedPromo ? appliedPromo.code : null,
                    generatedPromo: newPromoCode || null,
                    batch: globalSettings.batchHashtag || '',
                    batchId: batchId,
                    batchName: batchName,
                    orderDate: orderDateEn,
                    orderTime: orderTime,
                    isRead: false,
                    adminNote: finalAdminNote,
                    source: 'storefront_v2',
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                };

                await db.collection('orders').add(orderData);

                // تحديث الإحصائيات وملف العميل والدفعة والمخزون
                const batchOps = db.batch();
                batchOps.set(db.collection('inventory').doc('stats'), {
                    sales: firebase.firestore.FieldValue.increment(finalTotal),
                    orders: firebase.firestore.FieldValue.increment(1)
                }, { merge: true });

                const custUpdate = {
                    name: customerName,
                    phone: customerPhone,
                    zone: zoneName,
                    address: customerAddress || '',
                    ordersCount: firebase.firestore.FieldValue.increment(1),
                    totalSpent: firebase.firestore.FieldValue.increment(finalTotal),
                    lastOrder: firebase.firestore.FieldValue.serverTimestamp()
                };
                if (walletUsed && walletPtsToDeduct > 0) {
                    custUpdate.walletPoints = firebase.firestore.FieldValue.increment(-walletPtsToDeduct);
                }
                batchOps.set(db.collection('customers').doc(customerPhone), custUpdate, { merge: true });

                const stockUpdates = {};
                const bookedUpdates = {};
                orderItems.forEach((it) => {
                    if (!it.isWeightBased) {
                        stockUpdates[it.id] = firebase.firestore.FieldValue.increment(-it.quantity);
                        bookedUpdates[it.id] = firebase.firestore.FieldValue.increment(it.quantity);
                    }
                });

                if (Object.keys(stockUpdates).length > 0) {
                    batchOps.set(db.collection('inventory').doc('stock'), stockUpdates, { merge: true });
                }
                if (batchId && Object.keys(bookedUpdates).length > 0) {
                    batchOps.set(db.collection('inventory').doc('batches'), { [batchId]: { booked: bookedUpdates } }, { merge: true });
                }
                if (promoUpdated) {
                    batchOps.set(db.collection('inventory').doc('settings'), {
                        promoCodes: globalSettings.promoCodes,
                        rewardMaxGenerations: globalSettings.rewardMaxGenerations
                    }, { merge: true });
                }

                await batchOps.commit();
            }

            // حفظ بيانات العميل محلياً على جهازه للطلب القادم
            saveLocalProfile(customerName, customerPhone, zoneName, customerAddress);
            sessionStorage.setItem('sman_last_order_ms', String(Date.now()));

            // تفريغ السلة
            cart = {};
            window.nextBatchCart = {};
            appliedPromo = null;
            resetWalletBanner();
            saveCart();
            if (document.getElementById('promo-code-input')) document.getElementById('promo-code-input').value = '';
            if (document.getElementById('customer-notes')) document.getElementById('customer-notes').value = '';

            renderProducts();
            updateUI();
            toggleCart();

            // عرض شاشة النجاح وروابط التتبع والواتساب الصحيحة
            const waStoreNum = U.formatWaPhone(globalSettings.storePhone);
            window.currentOrderWaLink = `https://api.whatsapp.com/send?phone=${waStoreNum}&text=${encodeURIComponent(waMsg)}`;
            const interactiveTime = (batchId && globalBatches[batchId])
                ? window.getFriendlyBatchDatePhrase(globalBatches[batchId].deliveryStart, globalBatches[batchId].deliveryEnd)
                : '';

            showOrderSuccessModal({
                customerName,
                customerPhone,
                batchName,
                interactiveTime,
                earnedLoyalty,
                newPromoCode
            });
        } catch (e) {
            console.error('Order Submit Error:', e);
            showAlert('تعذر إرسال الطلب', 'حدث خطأ في الاتصال بالسيرفر، يرجى المحاولة مرة أخرى بعد ثوانٍ.');
        } finally {
            isSubmittingOrder = false;
            checkoutBtn.disabled = false;
            checkoutBtn.innerHTML = origHtml;
        }
    };

    function showOrderSuccessModal(info) {
        const uiTexts = globalSettings.uiTexts || {};
        const firstName = esc((info.customerName || '').split(' ')[0] || 'فندم');
        const safePhone = encodeURIComponent(info.customerPhone);
        const titleText = esc(uiTexts.successTitle || 'تم تأكيد أوردرك بنجاح! 🎉');

        let bodyHtml = info.batchName
            ? `أوردرك اتسجل بنجاح في <strong class="text-brand-navy">${esc(info.batchName)}</strong>.<br>📦 موعد الاستلام المتوقع: <strong class="text-red-600">${esc(info.interactiveTime)}</strong>.<br>هنتواصل معاك للتأكيد قبل التحرك!`
            : esc(uiTexts.successMsgTemplate || 'أوردرك اتسجل في السيستم عندنا خلاص وهيتم التجهيز والتواصل معاك للتأكيد.');

        let rewardHtml = '';
        if (info.earnedLoyalty && info.newPromoCode) {
            const safeCode = esc(info.newPromoCode);
            rewardHtml = `
                <div class="bg-amber-50 border-2 border-dashed border-amber-300 p-3 rounded-xl my-3 text-center">
                    <span class="text-[11px] font-black text-amber-800 block">🎁 هديتك لطلبك القادم (كود خصم خاص بك):</span>
                    <span class="font-black text-2xl text-brand-navy tracking-wider select-all block my-1">${safeCode}</span>
                    <button type="button" onclick="navigator.clipboard.writeText('${escAttr(info.newPromoCode)}'); this.textContent='✅ تم نسخ الكود';" class="bg-brand-navy text-white text-xs font-black px-4 py-1.5 rounded-lg">نسخ الكود</button>
                </div>`;
        }

        const msgHTML = `
            <div dir="rtl" class="text-right space-y-3">
                <div class="text-center">
                    <div class="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto text-2xl shadow-sm">
                        <i class="fa-solid fa-check"></i>
                    </div>
                    <h3 class="font-black text-brand-navy mt-2 text-base">${titleText}</h3>
                    <p class="text-xs font-bold text-gray-500">شكراً لثقتك في سمان ههيا يا ${firstName} 🌿</p>
                </div>
                <div class="text-xs font-bold text-emerald-900 leading-relaxed bg-emerald-50 p-3 rounded-xl border border-emerald-200">${bodyHtml}</div>
                ${rewardHtml}
                <div class="flex flex-col gap-2">
                    <button type="button" onclick="closeAlert(); window.location.href='track.html?phone=${safePhone}';" class="w-full bg-brand-navy hover:opacity-95 text-white font-black py-3 px-4 rounded-xl flex justify-center items-center gap-2 shadow-md text-xs sm:text-sm">
                        <i class="fa-solid fa-route text-brand-yellow"></i> تتبع حالة طلبك الآن
                    </button>
                    <button type="button" onclick="closeAlert(); window.open(window.currentOrderWaLink, '_blank');" class="w-full bg-[#25D366] hover:bg-[#1ebd57] text-white font-black py-3 px-4 rounded-xl flex justify-center items-center gap-2 shadow-md text-xs sm:text-sm">
                        <i class="fa-brands fa-whatsapp text-lg"></i> ${esc(uiTexts.waFollowUpBtn || 'تأكيد ومتابعة عبر واتساب')}
                    </button>
                    <button type="button" onclick="closeAlert()" class="w-full bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold py-2.5 rounded-xl text-xs">
                        ${esc(uiTexts.closeFollowUpBtn || 'تمام، شكراً 👍')}
                    </button>
                </div>
            </div>`;

        document.getElementById('alert-icon-container')?.classList.add('hidden');
        document.getElementById('alert-title')?.classList.add('hidden');
        document.getElementById('alert-default-btn')?.classList.add('hidden');
        const alertMsg = document.getElementById('alert-message');
        if (alertMsg) {
            alertMsg.className = 'w-full m-0 p-0';
            alertMsg.innerHTML = msgHTML;
        }
        const md = document.getElementById('alert-modal');
        if (md) {
            md.classList.remove('hidden');
            setTimeout(() => md.classList.remove('opacity-0'), 10);
        }
    }

    // =========================================================================
    // 10. التنبيهات وإشعارات المبيعات الحية
    // =========================================================================
    window.showAlert = function (title, message) {
        const iconCont = document.getElementById('alert-icon-container');
        const titleEl = document.getElementById('alert-title');
        const msgEl = document.getElementById('alert-message');
        const btn = document.getElementById('alert-default-btn');
        if (iconCont) iconCont.classList.remove('hidden');
        if (titleEl) {
            titleEl.textContent = title || 'تنبيه';
            titleEl.classList.remove('hidden');
        }
        if (msgEl) {
            msgEl.className = 'text-gray-600 mb-5 font-bold text-sm leading-relaxed whitespace-pre-wrap';
            msgEl.textContent = message || '';
        }
        if (btn) {
            btn.className = 'bg-brand-navy hover:opacity-95 text-white font-black py-3 px-6 rounded-xl w-full transition-opacity text-sm';
            btn.textContent = 'حسناً';
            btn.onclick = window.closeAlert;
            btn.classList.remove('hidden');
        }
        const md = document.getElementById('alert-modal');
        if (md) {
            md.classList.remove('hidden');
            setTimeout(() => md.classList.remove('opacity-0'), 10);
        }
    };

    window.closeAlert = function () {
        const md = document.getElementById('alert-modal');
        if (!md) return;
        md.classList.add('opacity-0');
        setTimeout(() => md.classList.add('hidden'), 250);
    };

    function startLiveNotifications() {
        if (liveNotiStarted) return;
        const noti = document.getElementById('live-notification');
        if (!noti || !globalSettings.liveNotiActive || !Array.isArray(globalSettings.liveNotiNames) || globalSettings.liveNotiNames.length === 0) return;

        liveNotiStarted = true;
        const names = globalSettings.liveNotiNames;
        const places = Array.isArray(globalSettings.liveNotiPlaces) ? globalSettings.liveNotiPlaces : [];
        const products = ['طبق سوبر', 'طبق جامبو', 'طبق سبشيال', 'سوبر سبشيال', 'بيض سمان'];

        const triggerOne = () => {
            const name = names[Math.floor(Math.random() * names.length)];
            const place = places.length > 0 ? ` من ${places[Math.floor(Math.random() * places.length)]}` : '';
            const prod = products[Math.floor(Math.random() * products.length)];
            const mins = Math.floor(Math.random() * 6) + 1;

            const txtEl = document.getElementById('live-noti-text');
            const timeEl = document.getElementById('live-noti-time');
            if (txtEl) txtEl.textContent = `${name}${place} حجز ${prod}`;
            if (timeEl) timeEl.textContent = `منذ ${mins} دقيقة`;

            noti.classList.remove('translate-y-24', 'opacity-0');
            setTimeout(() => noti.classList.add('translate-y-24', 'opacity-0'), 4500);
        };

        setTimeout(() => {
            triggerOne();
            setInterval(triggerOne, 26000);
        }, 9000);
    }
})();
