// js/app.js - محرك متجر سمان ههيا البريميوم (معرض Filmstrip + كروت متوازنة + تجربة سلة وإتمام طلب فاخرة)

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
    let lastCheckedCustomerPhone = '';
    let activeProductFilter = 'all';
    let toastTimer = null;
    let currentQuickViewId = null;

    let currentStoryIdx = 0;
    const TOTAL_STORIES = 5;
    const feastState = { adults: 4, kids: 0, style: 'grill', includeEggs: false, plan: [] };

    // =========================================================================
    // 1. التشغيل الأولي والتخزين المحلي وإشعار Toast
    // =========================================================================
    document.addEventListener('DOMContentLoaded', () => {
        renderDeliveryZones();
        loadCart();
        loadSavedLocalProfile();
        setupEventListeners();
        initFirebase();
    });

    function showStoreToast(text, iconCls = 'fa-circle-check text-emerald-400') {
        const el = document.getElementById('store-toast');
        const txt = document.getElementById('store-toast-text');
        const ico = document.getElementById('store-toast-icon');
        if (!el || !txt) return;
        txt.textContent = text;
        if (ico) ico.className = `fa-solid ${iconCls} text-sm`;
        el.classList.remove('opacity-0', '-translate-y-4');
        el.classList.add('opacity-100', 'translate-y-0');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => {
            el.classList.remove('opacity-100', 'translate-y-0');
            el.classList.add('opacity-0', '-translate-y-4');
        }, 2100);
    }

    function saveCart() {
        try { localStorage.setItem('sman_cart_v2', JSON.stringify(cart)); } catch (e) {}
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

            const phoneVal = document.getElementById('customer-phone')?.value || '';
            const norm = U.normalizePhone(phoneVal);
            if (norm.length >= 10) checkCustomerWalletSafe(norm, phoneVal);
        } catch (e) {
            console.error('Firebase Fetch Error:', e);
        }
    }

    // =========================================================================
    // 3. حسابات المخزون وسقف الدفعة ونصائح الطهي لكل حجم
    function classifyStoreProduct(id, p) {
        if (p && p.categoryType === 'custom') return { group: 'custom', rank: 50 };
        if (p && p.categoryType === 'weight') return { group: 'weight', rank: 50 };
        if (p && p.categoryType === 'eggs_chicks') return { group: 'eggs_chicks', rank: 50 };
        if (p && p.categoryType === 'quail') return { group: 'quail', rank: 50 };
        return U.getProductCategoryAndRank(id, p);
    }

    function isMainQuailItem(id) {
        const p = productsInfo[id];
        if (!p) return true;
        return classifyStoreProduct(id, p).group === 'quail';
    }

    function getShortUsageTag(id, p) {
        const sId = String(id || '').toLowerCase();
        const sName = String(p?.name || '').toLowerCase();
        if (p?.categoryType === 'custom') return p.weight ? `✨ ${p.weight}` : '✨ منتج خاص';
        if (p?.isWeightBased) return '⚖️ بالميزان الطازج';
        if (sId === 'eggs' || sName.includes('بيض')) return '🥚 مغذي للأطفال';
        if (sId === 'chicks' || sName.includes('كتكوت')) return '🐣 تربية ممتازة';
        if (sId === 'superspecial' || (sName.includes('سوبر') && (sName.includes('سبشيال') || sName.includes('اسبيشيال')))) return '👑 ملكي للعزومات';
        if (sId === 'special' || sName.includes('سبشيال') || sName.includes('اسبيشيال')) return '🍚 مثالي للحشو';
        if (sId === 'jumbo' || sName.includes('جامبو')) return '⭐ شوي وحشو';
        if (sId === 'super' || sName.includes('سوبر')) return '🔥 مثالي للشوي';
        return '🌿 طازج بالطلب';
    }

    function getCookingTipForProduct(id, p) {
        const sId = String(id || '').toLowerCase();
        const sName = String(p?.name || '').toLowerCase();
        if (p?.categoryType === 'custom') return p.weight || 'منتج خاص متاح للطلب المباشر من سمان ههيا.';
        if (p?.isWeightBased) return 'مذبوح ومنظف طازج بالوزن الدقيق — اختر الوزن المناسب لأسرتك.';
        if (sId === 'eggs' || sName.includes('بيض')) return 'طبق طازج غني بالفيتامينات والحديد — مثالي للأطفال والرياضيين.';
        if (sId === 'chicks' || sName.includes('كتكوت')) return 'كتاكيت سمان أبيض هجين بصحة ممتازة جاهزة للتربية.';
        if (sId === 'superspecial' || (sName.includes('سوبر') && (sName.includes('سبشيال') || sName.includes('اسبيشيال')))) {
            return 'حجم فاخر ممتلئ اللحم — الخيار الأول للعزومات الفخمة والحشو الملكي.';
        }
        if (sId === 'special' || sName.includes('سبشيال') || sName.includes('اسبيشيال')) {
            return 'وزن ممتاز مثالي للحشو بالفريك أو الأرز بالخلطة والتحمير.';
        }
        if (sId === 'jumbo' || sName.includes('جامبو')) {
            return 'الحجم المتوازن الأشهر — ممتاز للشوي على الفحم وللحشو معاً.';
        }
        if (sId === 'super' || sName.includes('سوبر')) {
            return 'سريع التسوية ومثالي للشوي والتحمير السريع بطعم طازج رائع.';
        }
        return 'منتج طازج من مزرعة سمان ههيا — يُذبح ويُغلف بالطلب.';
    }

    function matchesStoreFilter(id, p, group) {
        if (activeProductFilter === 'all') return true;
        if (activeProductFilter === 'eggs_chicks') return group === 'eggs_chicks';
        if (activeProductFilter === 'weight') return group === 'weight';
        if (activeProductFilter === 'custom') return group === 'custom';
        if (group !== 'quail') return false;


        const sId = String(id || '').toLowerCase();
        const sName = String(p?.name || '').toLowerCase();
        if (activeProductFilter === 'grill') {
            return sId === 'super' || sId === 'jumbo' || (sName.includes('سوبر') && !sName.includes('سبشيال')) || sName.includes('جامبو');
        }
        if (activeProductFilter === 'stuff') {
            return sId === 'jumbo' || sId === 'special' || sId === 'superspecial' || sName.includes('جامبو') || sName.includes('سبشيال') || sName.includes('اسبيشيال');
        }
        return true;
    }

    window.setStoreProductFilter = function (filterKey) {
        activeProductFilter = filterKey || 'all';
        document.querySelectorAll('.store-filter-btn').forEach((btn) => {
            const isAct = btn.getAttribute('data-filter') === activeProductFilter;
            btn.className = `store-filter-btn whitespace-nowrap px-3.5 py-2 rounded-xl text-xs font-black transition-all ${
                isAct
                    ? 'bg-brand-navy text-white shadow-sm'
                    : 'bg-white text-slate-600 border border-slate-200 hover:border-brand-navy/40'
            }`;
        });
        renderProducts();
    };

    // تحديد نوع مسار الدفعة (متوافق 100% مع الدفعات القديمة تلقائياً بدون تعديل بياناتها)
    function getBatchTrackType(batch) {
        if (!batch) return 'quail';
        if (batch.batchType === 'quail' || batch.batchType === 'chicks' || batch.batchType === 'weight') {
            return batch.batchType;
        }
        const n = String(batch.name || '').toLowerCase();
        if (n.includes('كتكوت') || n.includes('كتاكيت') || n.includes('عمر يوم') || n.includes('تفريخ') || n.includes('فقس')) {
            return 'chicks';
        }
        if (n.includes('فراخ') || n.includes('تسمين') || n.includes('رومي') || n.includes('بط')) {
            return 'weight';
        }
        return 'quail';
    }

    // تحديد مسار المنتج: quail (سمان مذبوح) | chicks (كتاكيت عمر يوم) | weight (طيور بالوزن) | immediate (بيض يومي أو صنف مستقل)
    function getProductTrackType(id) {
        const p = productsInfo[id];
        if (!p) return 'quail';
        if (p.categoryType === 'custom') return 'immediate';
        const meta = classifyStoreProduct(id, p);
        if (meta.group === 'weight' || p.isWeightBased) return 'weight';
        if (meta.group === 'quail') return 'quail';
        const sId = String(id || '').toLowerCase();
        const sName = String(p.name || '').toLowerCase();
        if (sId === 'chicks' || sName.includes('كتكوت') || sName.includes('كتاكيت') || sName.includes('عمر يوم') || sName.includes('عمر')) {
            return 'chicks';
        }
        return 'immediate';
    }

    function getVisibleBatchesByTrack(trackType) {
        return Object.keys(globalBatches)
            .map((id) => ({ id, ...globalBatches[id] }))
            .filter((b) => b && b.name && b.name !== 'undefined' && b.isVisible !== false && getBatchTrackType(b) === trackType);
    }

    function getBatchRemainingCeilingPairs(batch) {
        if (!batch) return null;
        const cap = Number(batch.publicPairs) || Number(batch.actualPairs) || 0;
        if (cap <= 0) return null;

        let bookedMain = 0;
        if (batch.booked && typeof batch.booked === 'object') {
            Object.keys(batch.booked).forEach((pId) => {
                if (getProductTrackType(pId) === 'quail') bookedMain += Number(batch.booked[pId]) || 0;
            });
        }
        let inCartMain = 0;
        Object.keys(cart).forEach((pId) => {
            if (getProductTrackType(pId) === 'quail') inCartMain += Number(cart[pId]?.quantity) || 0;
        });
        return Math.max(0, cap - bookedMain - inCartMain);
    }

    function getPureAvailableStock(id) {
        const p = productsInfo[id];
        if (!p) return 0;
        const track = getProductTrackType(id);

        // المسار 2-أ: فراخ تسمين / رومي بالوزن — مستقل تماماً (من مصفوفة الجرامات فقط)
        if (track === 'weight') {
            return U.parseWeightsArray(p.weightsList).length;
        }

        // المسار 2-ب: البيض والمنتجات اليومية الفورية — مستقل تماماً عن جميع الدفعات
        if (track === 'immediate') {
            return Math.max(0, Math.floor(Number(globalStock[id]) || 0));
        }

        // المسار 3: كتاكيت عمر يوم — مرتبط بدورة التفريخ المفتوحة (إن وُجدت)، وإلا بالمخزون المباشر
        if (track === 'chicks') {
            const cBatchId = document.getElementById('user-chicks-batch-select')?.value || '';
            if (cBatchId && globalBatches[cBatchId]) {
                const cb = globalBatches[cBatchId];
                const bStock = (cb.stock && cb.stock[id] !== undefined && Number(cb.stock[id]) > 0)
                    ? Number(cb.stock[id])
                    : (Number(cb.publicPairs) || Number(cb.actualPairs) || Number(globalStock[id]) || 0);
                const bBooked = (cb.booked && cb.booked[id]) ? Number(cb.booked[id]) : 0;
                return Math.max(0, Math.floor(bStock - bBooked));
            }
            return Math.max(0, Math.floor(Number(globalStock[id]) || 0));
        }

        // المسار 1: السمان المذبوح بالجوز — مرتبط بدفعات السمان المذبوح فقط
        const batchId = document.getElementById('user-batch-select')?.value || '';
        if (batchId && globalBatches[batchId] && getBatchTrackType(globalBatches[batchId]) === 'quail') {
            const batch = globalBatches[batchId];
            const bStock = (batch.stock && batch.stock[id] !== undefined && Number(batch.stock[id]) > 0)
                ? Number(batch.stock[id])
                : (Number(globalStock[id]) || 0);
            const bBooked = (batch.booked && batch.booked[id]) ? Number(batch.booked[id]) : 0;
            let rem = Math.max(0, bStock - bBooked);

            const cap = Number(batch.publicPairs) || Number(batch.actualPairs) || 0;
            if (cap > 0) {
                let bookedMain = 0;
                if (batch.booked) {
                    Object.keys(batch.booked).forEach((k) => {
                        if (getProductTrackType(k) === 'quail') bookedMain += Number(batch.booked[k]) || 0;
                    });
                }
                const capRem = Math.max(0, cap - bookedMain);
                rem = Math.min(rem > 0 ? rem : capRem, capRem);
            }
            return Math.max(0, Math.floor(rem));
        }

        return Math.max(0, Math.floor(Number(globalStock[id]) || 0));
    }

    function getAvailableStock(id) {
        const p = productsInfo[id];
        if (!p) return 0;
        const track = getProductTrackType(id);

        if (track === 'weight') {
            const allW = U.parseWeightsArray(p.weightsList);
            const pickedCount = Array.isArray(cart[id]?.selectedWeightsGrams) ? cart[id].selectedWeightsGrams.length : 0;
            return Math.max(0, allW.length - pickedCount);
        }

        const inCart = Number(cart[id]?.quantity) || 0;
        const pure = getPureAvailableStock(id);
        let rem = Math.max(0, pure - inCart);

        if (track === 'quail') {
            const batchId = document.getElementById('user-batch-select')?.value || '';
            if (batchId && globalBatches[batchId] && getBatchTrackType(globalBatches[batchId]) === 'quail') {
                const capRem = getBatchRemainingCeilingPairs(globalBatches[batchId]);
                if (capRem !== null) rem = Math.min(rem, Math.floor(capRem));
            }
        }
        return Math.max(0, rem);
    }


    // =========================================================================
    // 4. عرض الإعدادات والمناطق (مع أزرار اختيار المناطق السريعة) والكتالوج الفاخر
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
            finalTotalLabel: 'الإجمالي النهائي:'
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
    }

    function applySettingsToUI() {
        const storeName = globalSettings.storeName || 'سمان ههيا';
        const headerName = document.getElementById('header-store-name');
        const descEl = document.getElementById('header-store-desc');
        if (headerName) headerName.textContent = storeName;
        if (descEl && globalSettings.storeDesc) descEl.textContent = globalSettings.storeDesc;

        const phoneStr = globalSettings.storePhone || '01208027294';
        const footerPhone = document.getElementById('footer-phone');
        const footerPhoneLink = document.getElementById('footer-phone-link');
        if (footerPhone) footerPhone.textContent = phoneStr;
        if (footerPhoneLink) footerPhoneLink.href = `tel:${phoneStr}`;

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

        const wrapper = document.getElementById('store-wrapper');
        const closedMsg = document.getElementById('store-closed-msg');
        const mainCartBtn = document.getElementById('main-cart-btn');
        const navStatus = document.getElementById('nav-live-status');
        const isOpen = globalSettings.storeOpen !== false;

        if (!isOpen) {
            if (wrapper) wrapper.classList.add('opacity-50', 'pointer-events-none');
            if (closedMsg) {
                closedMsg.classList.remove('hidden');
                closedMsg.style.display = 'flex';
                const innerDiv = closedMsg.querySelector('div');
                if (innerDiv) innerDiv.textContent = globalSettings.closedMessage || 'المتجر مغلق حالياً، نعود قريباً!';
            }
            if (mainCartBtn) mainCartBtn.disabled = true;
            if (navStatus) navStatus.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-rose-400"></span><span class="text-rose-300">مغلق مؤقتاً</span>';
        } else {
            if (wrapper) wrapper.classList.remove('opacity-50', 'pointer-events-none');
            if (closedMsg) {
                closedMsg.classList.add('hidden');
                closedMsg.style.display = 'none';
            }
            if (mainCartBtn) mainCartBtn.disabled = false;
            if (navStatus) navStatus.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span><span>متاح للحجز الآن</span>';
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
        if (promoToggle) promoToggle.classList.toggle('hidden', globalSettings.showPromoField === false);

        renderCatalogFilmstrip();
        applyUITexts();
    }

    function renderDeliveryZones() {
        const select = document.getElementById('delivery-zone');
        if (!select) return;
        const currentVal = select.value || window._preferredSavedZone || '';
        select.innerHTML = '<option value="" disabled selected>أو اختر من القائمة الكاملة للمناطق...</option>';

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

        renderQuickZoneChips();
    }

    function renderQuickZoneChips() {
        const wrap = document.getElementById('quick-zone-chips');
        const select = document.getElementById('delivery-zone');
        if (!wrap || !select) return;

        const curVal = select.value;
        wrap.innerHTML = globalDeliveryZones.slice(0, 8).map((z) => {
            const val = z.id || z.name;
            const isSel = curVal === val || curVal === z.name;
            const priceTxt = Number(z.price) === 0 ? 'تُحدد لاحقاً' : `${z.price}ج`;
            return `
                <button type="button" data-zone-val="${esc(val)}" onclick="selectQuickZoneChip('${escAttr(val)}')" class="zone-chip ${isSel ? 'active' : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-brand-navy/40'} border-2 px-3 py-1.5 rounded-xl text-[11px] font-black flex items-center gap-1.5">
                    <span>${esc(z.name)}</span>
                    <span class="text-[9px] px-1.5 py-0.5 rounded-md ${isSel ? 'bg-amber-400 text-[#0b261c]' : 'bg-white text-slate-500 border border-slate-200'}">${priceTxt}</span>
                </button>`;
        }).join('');
    }

    window.selectQuickZoneChip = function (val) {
        const select = document.getElementById('delivery-zone');
        if (!select) return;
        select.value = val;
        if (navigator.vibrate) navigator.vibrate(25);
        window.syncQuickZoneChipsUI();
        updateUI();
    };

    window.syncQuickZoneChipsUI = function () {
        renderQuickZoneChips();
    };

    window.appendQuickNote = function (txt) {
        const ta = document.getElementById('customer-notes');
        if (!ta) return;
        const cur = ta.value.trim();
        if (cur.includes(txt)) return;
        ta.value = cur ? `${cur} - ${txt}` : txt;
        if (navigator.vibrate) navigator.vibrate(20);
        showStoreToast('تمت إضافة الملاحظة للطلب');
    };

    // --- معرض الكتالوج الفاخر (Luxury Filmstrip Cards — صفر مساحات بيضاء جانبية) ---
    function renderCatalogFilmstrip() {
        const strip = document.getElementById('catalog-filmstrip');
        const badge = document.getElementById('catalog-count-badge');
        if (!strip) return;

        const images = (Array.isArray(globalSettings.galleryImages) && globalSettings.galleryImages.length > 0)
            ? globalSettings.galleryImages.filter((x) => x && String(x).trim() !== '')
            : ['all-sizes.jpg'];
        window.sliderImages = images;

        if (badge) badge.textContent = `${images.length} ${images.length === 1 ? 'صورة' : 'صور'}`;

        const isSingle = images.length === 1;
        strip.innerHTML = images.map((img, idx) => {
            const safeImg = escAttr(img);
            const widthCls = isSingle ? 'w-full h-[300px] sm:h-[340px]' : 'w-[74%] sm:w-[44%] h-[280px] sm:h-[310px]';
            return `
                <div onclick="openImageModal('${safeImg}')" class="catalog-slide-card ${widthCls} cursor-zoom-in border border-white/15 shadow-lg group">
                    <img src="${esc(img)}" alt="" aria-hidden="true" class="catalog-blur-bg">
                    <img src="${esc(img)}" alt="صورة من مزرعة سمان ههيا ${idx + 1}" loading="lazy" class="relative z-10 w-full h-full object-contain p-1.5 transition-transform duration-300 group-hover:scale-[1.03]" onerror="this.style.display='none'">
                    <div class="absolute bottom-2.5 right-2.5 z-20 bg-black/60 backdrop-blur-sm text-white text-[10px] font-black px-2.5 py-1 rounded-full border border-white/15 flex items-center gap-1">
                        <i class="fa-solid fa-magnifying-glass-plus text-amber-400 text-[9px]"></i>
                        <span>${idx + 1} / ${images.length}</span>
                    </div>
                </div>`;
        }).join('');
    }

    window.moveSlider = function (dir) {
        const strip = document.getElementById('catalog-filmstrip');
        if (strip) strip.scrollBy({ left: dir * -260, behavior: 'smooth' });
    };
    window.updateSliderView = function () {};

    window.openImageModal = function (imgSrc) {
        if (!imgSrc || !String(imgSrc).trim()) return;
        let modal = document.getElementById('image-viewer-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'image-viewer-modal';
            modal.className = 'fixed inset-0 z-[140] bg-[#071812]/95 flex items-center justify-center hidden opacity-0 transition-all duration-200 backdrop-blur-md p-4 cursor-zoom-out';
            modal.onclick = () => {
                closeImageViewer();
                if (window.location.hash === '#catalog') history.back();
            };
            modal.innerHTML = `
                <div class="relative w-full max-w-3xl h-full flex items-center justify-center">
                    <i class="fa-solid fa-spinner fa-spin absolute text-amber-400 text-3xl z-0" id="img-loader"></i>
                    <img id="image-viewer-img" src="" alt="" onload="document.getElementById('img-loader').style.display='none'" class="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl scale-95 transition-transform duration-200 relative z-10">
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
            setTimeout(() => modal.classList.add('hidden'), 200);
        }
    }
    window.addEventListener('popstate', closeImageViewer);

    // =========================================================================
    // 5. عارض القصص التفاعلي (Instagram Stories Viewer)
    // =========================================================================
    function renderStoryContent(idx) {
        currentStoryIdx = ((idx % TOTAL_STORIES) + TOTAL_STORIES) % TOTAL_STORIES;

        const bars = document.getElementById('story-progress-bars');
        if (bars) {
            bars.innerHTML = Array.from({ length: TOTAL_STORIES }).map((_, i) => `
                <div class="story-progress-bar">
                    <div class="story-progress-fill ${i < currentStoryIdx ? 'done' : (i === currentStoryIdx ? 'active' : '')}"></div>
                </div>`).join('');
        }

        const titleEl = document.getElementById('story-header-title');
        const iconEl = document.getElementById('story-header-icon');
        const bodyEl = document.getElementById('story-body');
        const counterEl = document.getElementById('story-counter');
        if (counterEl) counterEl.textContent = `${currentStoryIdx + 1} / ${TOTAL_STORIES}`;

        if (currentStoryIdx === 0) {
            titleEl.textContent = 'دليل الأحجام على الطبيعة';
            iconEl.innerHTML = '<i class="fa-solid fa-ruler-combined"></i>';
            const imgs = (Array.isArray(globalSettings.galleryImages) && globalSettings.galleryImages.length > 0)
                ? globalSettings.galleryImages : ['all-sizes.jpg'];
            const imgsHtml = imgs.map((src) => `
                <img src="${esc(src)}" alt="دليل الأحجام" onclick="openImageModal('${escAttr(src)}')" class="w-full rounded-2xl border border-white/15 bg-white/5 max-h-60 object-contain cursor-zoom-in">`).join('');

            const quailSummary = Object.keys(productsInfo)
                .filter((id) => productsInfo[id] && !productsInfo[id].isHidden && isMainQuailItem(id))
                .sort((a, b) => U.getProductCategoryAndRank(a, productsInfo[a]).rank - U.getProductCategoryAndRank(b, productsInfo[b]).rank)
                .map((id) => {
                    const p = productsInfo[id];
                    const pr = Number(globalPrices[id] !== undefined ? globalPrices[id] : p.basePrice) || 0;
                    return `<div class="flex items-center justify-between bg-white/10 px-3 py-2 rounded-xl text-xs">
                        <span class="font-black text-white">${esc(p.name)} <span class="text-emerald-200/80 font-bold">(${esc(p.weight || '')})</span></span>
                        <span class="font-black text-amber-300">${pr} ج.م</span>
                    </div>`;
                }).join('');

            bodyEl.innerHTML = `
                <div class="space-y-2.5">${imgsHtml}</div>
                <div class="space-y-1.5 pt-1">${quailSummary}</div>
                <p class="text-[11px] text-emerald-200/80 text-center font-bold">اضغط على أي صورة لتكبيرها ومشاهدة التفاصيل</p>
            `;
        } else if (currentStoryIdx === 1) {
            titleEl.textContent = 'ليه سمان ههيا طعمه مختلف؟';
            iconEl.innerHTML = '<i class="fa-solid fa-leaf"></i>';
            const badges = (Array.isArray(globalSettings.trustBadges) && globalSettings.trustBadges.length > 0)
                ? globalSettings.trustBadges
                : [
                    { icon: 'fa-regular fa-circle-check', title: 'أوزان دقيقة', desc: 'زي ما طلبت بالظبط بدون مبالغة' },
                    { icon: 'fa-solid fa-snowflake', title: 'صفر تجميد', desc: 'بنذبح بالطلب فقط لكل دفعة محجوزة' },
                    { icon: 'fa-regular fa-star', title: 'طلبك باسمك', desc: 'بوليصة مطبوعة وتغليف خاص بطلبك' },
                    { icon: 'fa-solid fa-shield-halved', title: 'نظافة فائقة', desc: 'تنظيف دقيق وتغليف محكم آمن صحياً' }
                ];
            bodyEl.innerHTML = `
                <div class="bg-amber-400/15 border border-amber-400/30 rounded-2xl p-3.5 text-center">
                    <p class="text-sm font-black text-amber-300">🌿 "أصل الطعم يبدأ من التربية"</p>
                    <p class="text-xs font-bold text-emerald-100 mt-1 leading-relaxed">نعمل بنظام الحجز المسبق بالدفعات؛ لا نحتفظ بأي مخزون مجمد، فيصلك السمان مذبوحاً في يومه طازجاً 100%.</p>
                </div>
                <div class="grid grid-cols-2 gap-2.5">
                    ${badges.map((b) => `
                        <div class="bg-white/10 border border-white/10 rounded-2xl p-3 text-center">
                            <i class="${esc(b.icon || 'fa-solid fa-check')} text-amber-400 text-xl mb-1.5"></i>
                            <h4 class="text-xs font-black text-white">${esc(b.title)}</h4>
                            <p class="text-[10px] font-bold text-emerald-100/80 mt-0.5">${esc(b.desc)}</p>
                        </div>`).join('')}
                </div>
            `;
        } else if (currentStoryIdx === 2) {
            titleEl.textContent = 'نظام نقاط الولاء والهدايا 🎁';
            iconEl.innerHTML = '<i class="fa-solid fa-gift"></i>';
            bodyEl.innerHTML = `
                <div class="bg-white/10 border border-white/15 rounded-2xl p-4 space-y-3">
                    <div class="flex items-start gap-3">
                        <span class="w-8 h-8 rounded-xl bg-amber-400 text-[#0b261c] font-black flex items-center justify-center shrink-0">1</span>
                        <div>
                            <h4 class="text-xs font-black text-white">اكسب نقاط مع كل طلب مكتمل</h4>
                            <p class="text-[11px] font-bold text-emerald-100/80 mt-0.5">بمجرد استلام طلبك تتحول قيمة مشترياتك تلقائياً لنقاط محفوظة على رقم موبايلك.</p>
                        </div>
                    </div>
                    <div class="flex items-start gap-3">
                        <span class="w-8 h-8 rounded-xl bg-amber-400 text-[#0b261c] font-black flex items-center justify-center shrink-0">2</span>
                        <div>
                            <h4 class="text-xs font-black text-white">استبدلها بخصم أو أطباق هدية مجاناً</h4>
                            <p class="text-[11px] font-bold text-emerald-100/80 mt-0.5">تقدر تفعل الخصم مباشرة من السلة أثناء الطلب أو تستبدل نقاطك بأطباق مجانية من صفحة تتبع الطلب.</p>
                        </div>
                    </div>
                </div>
                <a href="track.html" class="w-full bg-amber-400 hover:bg-amber-300 text-[#0b261c] font-black py-3 rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg">
                    <i class="fa-solid fa-crown"></i> اعرف رصيد نقاطك الآن
                </a>
            `;
        } else if (currentStoryIdx === 3) {
            titleEl.textContent = 'مناطق التوصيل ورسوم الشحن';
            iconEl.innerHTML = '<i class="fa-solid fa-truck-fast"></i>';
            const zonesHtml = globalDeliveryZones.map((z) => `
                <div class="flex items-center justify-between bg-white/10 border border-white/10 px-3.5 py-2.5 rounded-xl text-xs">
                    <span class="font-black text-white"><i class="fa-solid fa-location-dot text-amber-400 ml-1.5"></i>${esc(z.name)}</span>
                    <span class="font-black ${Number(z.price) === 0 ? 'text-emerald-300' : 'text-amber-300'}">${Number(z.price) === 0 ? 'يحدد لاحقاً' : `${z.price} ج.م`}</span>
                </div>`).join('');
            bodyEl.innerHTML = `
                <p class="text-xs font-bold text-emerald-100/85 leading-relaxed">التوصيل المباشر في الشرقية عبر مناديبنا حتى باب البيت في الميعاد المحدد للدفعة:</p>
                <div class="space-y-2">${zonesHtml}</div>
                ${globalSettings.freeDeliveryActive ? `<div class="bg-emerald-500/20 border border-emerald-400/30 p-2.5 rounded-xl text-center text-xs font-black text-emerald-200">🎉 التوصيل مجاني للطلبات فوق ${globalSettings.freeDeliveryThreshold} ج.م</div>` : ''}
            `;
        } else {
            titleEl.textContent = 'دليل اختيار الحجم حسب الأكلة 🍳';
            iconEl.innerHTML = '<i class="fa-solid fa-fire-burner"></i>';
            bodyEl.innerHTML = `
                <div class="space-y-2.5">
                    <div class="bg-white/10 border border-white/10 p-3 rounded-2xl">
                        <h4 class="text-xs font-black text-amber-300">🔥 طبق سوبر (300–350 جم للجوز)</h4>
                        <p class="text-[11px] font-bold text-emerald-100/85 mt-1">مثالي للشوي السريع على الفحم أو الجريل، يستوي بسرعة ويطلع طري ومقرمش.</p>
                    </div>
                    <div class="bg-white/10 border border-white/10 p-3 rounded-2xl">
                        <h4 class="text-xs font-black text-amber-300">⭐ طبق جامبو (350–400 جم للجوز)</h4>
                        <p class="text-[11px] font-bold text-emerald-100/85 mt-1">الحجم الأكثر طلباً للعائلات؛ يمشي ممتاز شوي وحشو فريك أو أرز.</p>
                    </div>
                    <div class="bg-white/10 border border-white/10 p-3 rounded-2xl">
                        <h4 class="text-xs font-black text-amber-300">👑 سبشيال وسوبر سبشيال (400–500 جم للجوز)</h4>
                        <p class="text-[11px] font-bold text-emerald-100/85 mt-1">لحم وفير جداً — الأفضل للحشو الملكي والعزومات اللي بتشرّف قدام الضيوف.</p>
                    </div>
                </div>
                <button type="button" onclick="closeStoryModal(); openFeastCalculator();" class="w-full bg-amber-400 text-[#0b261c] font-black py-3 rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg">
                    <i class="fa-solid fa-calculator"></i> احسب الكمية المناسبة لأسرتك الآن
                </button>
            `;
        }
    }

    window.openStoryModal = function (idx) {
        const md = document.getElementById('story-modal');
        if (!md) return;
        renderStoryContent(idx || 0);
        md.classList.remove('hidden');
        setTimeout(() => md.classList.remove('opacity-0'), 15);
        document.body.style.overflow = 'hidden';
    };

    window.closeStoryModal = function () {
        const md = document.getElementById('story-modal');
        if (!md) return;
        md.classList.add('opacity-0');
        setTimeout(() => md.classList.add('hidden'), 200);
        document.body.style.overflow = '';
    };

    window.stepStoryModal = function (delta) {
        if (currentStoryIdx + delta >= TOTAL_STORIES) {
            closeStoryModal();
            return;
        }
        renderStoryContent(currentStoryIdx + delta);
    };

    // =========================================================================
    // 6. حاسبة العزومة الذكية
    // =========================================================================
    window.openFeastCalculator = function () {
        const md = document.getElementById('feast-calc-modal');
        if (!md) return;
        recalcFeastRecommendation();
        md.classList.remove('hidden');
        setTimeout(() => md.classList.remove('opacity-0'), 15);
        document.body.style.overflow = 'hidden';
    };

    window.closeFeastCalculator = function () {
        const md = document.getElementById('feast-calc-modal');
        if (!md) return;
        md.classList.add('opacity-0');
        setTimeout(() => md.classList.add('hidden'), 200);
        document.body.style.overflow = '';
    };

    window.stepFeastCount = function (key, delta) {
        if (key === 'adults') {
            feastState.adults = Math.max(1, Math.min(25, feastState.adults + delta));
            document.getElementById('feast-adults-val').textContent = feastState.adults;
        } else {
            feastState.kids = Math.max(0, Math.min(15, feastState.kids + delta));
            document.getElementById('feast-kids-val').textContent = feastState.kids;
        }
        recalcFeastRecommendation();
    };

    window.setFeastStyle = function (style) {
        feastState.style = style;
        document.querySelectorAll('.feast-style-btn').forEach((btn) => {
            const act = btn.getAttribute('data-style') === style;
            btn.className = `feast-style-btn p-2.5 rounded-2xl border-2 text-center transition-all ${
                act ? 'border-brand-navy bg-emerald-50 text-brand-navy shadow-sm' : 'border-slate-200 bg-white text-slate-600'
            }`;
        });
        recalcFeastRecommendation();
    };

    function findBestAvailableQuailId(preferredOrder) {
        const quailIds = Object.keys(productsInfo).filter((id) => productsInfo[id] && !productsInfo[id].isHidden && isMainQuailItem(id));
        for (const pref of preferredOrder) {
            const match = quailIds.find((id) => {
                const sId = id.toLowerCase();
                const sName = String(productsInfo[id].name || '').toLowerCase();
                if (pref === 'superspecial') return sId === 'superspecial' || (sName.includes('سوبر') && (sName.includes('سبشيال') || sName.includes('اسبيشيال')));
                if (pref === 'special') return sId === 'special' || ((sName.includes('سبشيال') || sName.includes('اسبيشيال')) && !sName.includes('سوبر'));
                if (pref === 'jumbo') return sId === 'jumbo' || sName.includes('جامبو');
                if (pref === 'super') return sId === 'super' || (sName.includes('سوبر') && !sName.includes('سبشيال'));
                return false;
            });
            if (match && getPureAvailableStock(match) > 0) return match;
        }
        return quailIds.find((id) => getPureAvailableStock(id) > 0) || quailIds[0] || null;
    }

    window.recalcFeastRecommendation = function () {
        feastState.includeEggs = Boolean(document.getElementById('feast-include-eggs')?.checked);
        const basePlates = Math.max(1, Math.ceil(feastState.adults + (feastState.kids * 0.5)));
        const prefMap = {
            grill: ['super', 'jumbo', 'special', 'superspecial'],
            stuff: ['jumbo', 'special', 'superspecial', 'super'],
            vip: ['superspecial', 'special', 'jumbo', 'super']
        };

        const mainId = findBestAvailableQuailId(prefMap[feastState.style] || prefMap.grill);
        const eggsId = Object.keys(productsInfo).find((id) => id === 'eggs' || String(productsInfo[id]?.name || '').includes('بيض'));

        const plan = [];
        if (mainId && productsInfo[mainId]) {
            const avail = getPureAvailableStock(mainId);
            const qty = avail > 0 ? Math.min(basePlates, avail) : basePlates;
            const unitPrice = Number(globalPrices[mainId] !== undefined ? globalPrices[mainId] : productsInfo[mainId].basePrice) || 0;
            plan.push({ id: mainId, name: productsInfo[mainId].name, weight: productsInfo[mainId].weight || '', qty, unitPrice, avail });
        }

        if (feastState.includeEggs && eggsId && productsInfo[eggsId] && !productsInfo[eggsId].isHidden) {
            const eAvail = getPureAvailableStock(eggsId);
            const ePrice = Number(globalPrices[eggsId] !== undefined ? globalPrices[eggsId] : productsInfo[eggsId].basePrice) || 0;
            if (eAvail > 0) {
                plan.push({ id: eggsId, name: productsInfo[eggsId].name, weight: productsInfo[eggsId].weight || '', qty: 1, unitPrice: ePrice, avail: eAvail });
            }
        }

        feastState.plan = plan;
        const resultEl = document.getElementById('feast-result-card');
        const applyBtn = document.getElementById('feast-apply-btn');
        if (!resultEl) return;

        if (plan.length === 0) {
            resultEl.innerHTML = '<p class="text-xs font-bold text-slate-500 text-center py-2">لا توجد أصناف متاحة حالياً في هذه الدفعة.</p>';
            if (applyBtn) applyBtn.disabled = true;
            return;
        }

        const totalEst = plan.reduce((s, x) => s + (x.qty * x.unitPrice), 0);
        const totalBirds = plan.filter((x) => isMainQuailItem(x.id)).reduce((s, x) => s + (x.qty * 2), 0);

        resultEl.innerHTML = `
            <div class="flex items-center justify-between border-b border-emerald-200 pb-2">
                <span class="text-xs font-black text-brand-navy"><i class="fa-solid fa-sparkles text-amber-500 ml-1"></i> التشكيلة المقترحة لك:</span>
                <span class="text-[11px] font-black bg-white text-emerald-800 px-2.5 py-0.5 rounded-lg border border-emerald-200">${totalBirds} فردة سمان</span>
            </div>
            <div class="space-y-1.5">
                ${plan.map((item) => `
                    <div class="flex items-center justify-between text-xs bg-white px-3 py-2 rounded-xl border border-emerald-100">
                        <div>
                            <strong class="text-brand-navy">${item.qty} × ${esc(item.name)}</strong>
                            ${item.weight ? `<span class="text-[10px] text-slate-400 block">${esc(item.weight)}</span>` : ''}
                        </div>
                        <strong class="text-emerald-700">${item.qty * item.unitPrice} ج.م</strong>
                    </div>`).join('')}
            </div>
            <div class="flex items-center justify-between pt-2 border-t border-emerald-200 text-sm font-black text-brand-navy">
                <span>الإجمالي التقديري:</span>
                <span class="text-lg text-emerald-700">${totalEst} ج.م</span>
            </div>
        `;
        if (applyBtn) applyBtn.disabled = false;
    };

    window.applyFeastRecommendationToCart = function () {
        if (globalSettings.storeOpen === false) return showAlert('المتجر مغلق', 'المتجر مغلق مؤقتاً حالياً.');
        let addedAny = false;
        feastState.plan.forEach((item) => {
            const avail = getAvailableStock(item.id);
            const toAdd = Math.min(item.qty, avail);
            if (toAdd > 0) {
                if (cart[item.id]) cart[item.id].quantity += toAdd;
                else cart[item.id] = { quantity: toAdd, price: item.unitPrice, name: item.name };
                addedAny = true;
            }
        });

        closeFeastCalculator();
        if (addedAny) {
            if (navigator.vibrate) navigator.vibrate([40, 30, 50]);
            saveCart();
            renderProducts();
            updateUI();
            showStoreToast('تمت إضافة التشكيلة المقترحة لسلتك بنجاح 🎉');
        } else {
            showAlert('تنبيه المخزون', 'الكمية المتاحة في هذه الدفعة غير كافية حالياً، يمكنك اختيار دفعة أخرى.');
        }
    };

    // =========================================================================
    // 7. كروت الدفعات المدمجة
    // =========================================================================
    window.getFriendlyBatchDatePhrase = function (startDateStr, endDateStr) {
        if (!startDateStr) return 'قريباً فور التجهيز';
        const startDate = new Date(startDateStr);
        if (isNaN(startDate.getTime())) return String(startDateStr);
        const day = startDate.getDate();
        const months = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
        const mText = months[startDate.getMonth()];
        if (endDateStr) {
            const endD = new Date(endDateStr);
            if (!isNaN(endD.getTime()) && endD.getDate() !== day) {
                return `من ${day} إلى ${endD.getDate()} ${mText}`;
            }
        }
        return `بداية من ${day} ${mText}`;
    };

    function getBatchSmartCustomerNote(batch) {
        if (batch.urgentNote && batch.urgentNote.trim()) return { isUrgent: true, text: batch.urgentNote.trim() };
        if (batch.customerMsg && batch.customerMsg.trim()) return { isUrgent: false, text: batch.customerMsg.trim() };
        if (batch.slaughteredAt) {
            const days = (Date.now() - batch.slaughteredAt) / (1000 * 60 * 60 * 24);
            return { isUrgent: false, text: days >= 3 ? 'تم التسليم بالكامل' : 'تم الذبح وجاري التوزيع 🛵' };
        }
        if (batch.hatchDate && batch.slaughterAge) {
            const age = Math.max(0, Math.floor((Date.now() - batch.hatchDate) / (1000 * 60 * 60 * 24)));
            const rem = (Number(batch.slaughterAge) || 40) - age;
            if (!batch.isOpen) return { isUrgent: false, text: 'مكتملة الحجز وجاري التجهيز' };
            if (rem <= 0) return { isUrgent: false, text: 'جاهز فريش للتسليم قريباً 🔪' };
            if (rem <= 5) return { isUrgent: false, text: `باقي ${rem} أيام تقريباً على الجاهزية` };
            if (age <= 15) return { isUrgent: false, text: 'مرحلة التحضين والرعاية 🐣' };
            return { isUrgent: false, text: 'مرحلة التسمين وبناء اللحم 📈' };
        }
        return null;
    }

    function updateCartBatchBanner() {
        const pill = document.getElementById('cart-active-batch-pill');
        const nameEl = document.getElementById('cart-batch-pill-name');
        const dateEl = document.getElementById('cart-batch-pill-date');
        if (!pill) return;

        const cartKeys = Object.keys(cart);
        const hasQuail = cartKeys.some((id) => getProductTrackType(id) === 'quail');
        const hasChicks = cartKeys.some((id) => getProductTrackType(id) === 'chicks');

        const qId = document.getElementById('user-batch-select')?.value || '';
        const qBatch = (qId && globalBatches[qId]) ? globalBatches[qId] : null;
        const cId = document.getElementById('user-chicks-batch-select')?.value || '';
        const cBatch = (cId && globalBatches[cId]) ? globalBatches[cId] : null;

        if (hasQuail && qBatch) {
            if (nameEl) nameEl.textContent = qBatch.name;
            if (dateEl) dateEl.textContent = window.getFriendlyBatchDatePhrase(qBatch.deliveryStart, qBatch.deliveryEnd);
            pill.classList.remove('hidden');
        } else if (hasChicks && cBatch) {
            if (nameEl) nameEl.textContent = `🐣 ${cBatch.name}`;
            if (dateEl) dateEl.textContent = window.getFriendlyBatchDatePhrase(cBatch.deliveryStart, cBatch.deliveryEnd);
            pill.classList.remove('hidden');
        } else if (cartKeys.length > 0 && !hasQuail && !hasChicks) {
            if (nameEl) nameEl.textContent = 'طلب فوري مستقل (بيض / طيور بالوزن)';
            if (dateEl) dateEl.textContent = '⚡ متاح فوراً';
            pill.classList.remove('hidden');
        } else if (qBatch) {
            if (nameEl) nameEl.textContent = qBatch.name;
            if (dateEl) dateEl.textContent = window.getFriendlyBatchDatePhrase(qBatch.deliveryStart, qBatch.deliveryEnd);
            pill.classList.remove('hidden');
        } else {
            pill.classList.add('hidden');
        }
    }

    function renderBatchesSelection() {
        const batchSelect = document.getElementById('user-batch-select');
        const batchNameHidden = document.getElementById('selected-batch-name');
        const chicksSelect = document.getElementById('user-chicks-batch-select');
        const chicksNameHidden = document.getElementById('selected-chicks-batch-name');
        const batchContainer = document.getElementById('batch-selection-container');
        const cardsWrapper = document.getElementById('batch-cards-wrapper');
        const heroPillName = document.getElementById('hero-batch-pill-name');
        const heroPillLabel = document.getElementById('hero-batch-pill-label');
        if (!batchSelect || !batchContainer || !cardsWrapper) return;

        // 1. ضبط دورات التفريخ (كتاكيت عمر يوم) بشكل مستقل تماماً عن السمان المذبوح
        const chicksBatches = getVisibleBatchesByTrack('chicks');
        const openChicksBatches = chicksBatches.filter((b) => b.isOpen).sort((a, b) => a.id.localeCompare(b.id));
        if (chicksSelect) {
            let curChicks = chicksSelect.value;
            if ((!curChicks || !globalBatches[curChicks] || !globalBatches[curChicks].isOpen || getBatchTrackType(globalBatches[curChicks]) !== 'chicks') && openChicksBatches.length > 0) {
                curChicks = openChicksBatches[0].id;
                chicksSelect.value = curChicks;
                if (chicksNameHidden) chicksNameHidden.value = openChicksBatches[0].name || '';
            } else if (openChicksBatches.length === 0) {
                chicksSelect.value = '';
                if (chicksNameHidden) chicksNameHidden.value = '';
            }
        }

        // 2. دورات السمان المذبوح فقط في شريط قسم السمان
        const quailBatches = getVisibleBatchesByTrack('quail');
        const openBatches = quailBatches.filter((b) => b.isOpen).sort((a, b) => a.id.localeCompare(b.id));
        const closedBatches = quailBatches.filter((b) => !b.isOpen).sort((a, b) => b.id.localeCompare(a.id));
        const toShow = [...openBatches, ...closedBatches.slice(0, 2)];

        if (toShow.length === 0) {
            batchContainer.classList.add('hidden');
            batchSelect.value = '';
            if (batchNameHidden) batchNameHidden.value = '';
            if (heroPillName) {
                if (openChicksBatches.length > 0) {
                    heroPillName.textContent = `🐣 ${openChicksBatches[0].name}`;
                    if (heroPillLabel) heroPillLabel.textContent = 'حجز تفريخ عمر يوم متاح الآن';
                } else {
                    heroPillName.textContent = 'متاح للطلب المباشر من المنيو';
                    if (heroPillLabel) heroPillLabel.textContent = 'بيض ومنتجات المزرعة الطازجة';
                }
            }
            updateCartBatchBanner();
            return;
        }

        batchContainer.classList.remove('hidden');

        let currentVal = batchSelect.value;
        if ((!currentVal || !globalBatches[currentVal] || !globalBatches[currentVal].isOpen || getBatchTrackType(globalBatches[currentVal]) !== 'quail') && openBatches.length > 0) {
            currentVal = openBatches[0].id;
            batchSelect.value = currentVal;
            if (batchNameHidden) batchNameHidden.value = openBatches[0].name || '';
        } else if (openBatches.length === 0) {
            currentVal = '';
            batchSelect.value = '';
            if (batchNameHidden) batchNameHidden.value = '';
        }

        const activeObj = (currentVal && globalBatches[currentVal]) ? globalBatches[currentVal] : (openBatches[0] || toShow[0]);
        if (heroPillName && activeObj) {
            heroPillName.textContent = activeObj.name;
            if (heroPillLabel) {
                heroPillLabel.textContent = activeObj.isOpen
                    ? `التسليم: ${window.getFriendlyBatchDatePhrase(activeObj.deliveryStart, activeObj.deliveryEnd)}`
                    : 'آخر دفعة سمان (البيض والمنتجات اليومية متاحة)';
            }
        }

        cardsWrapper.innerHTML = toShow.map((batch) => {
            const bId = batch.id;
            const safeId = escAttr(bId);
            const dateText = window.getFriendlyBatchDatePhrase(batch.deliveryStart, batch.deliveryEnd);
            const smartNote = getBatchSmartCustomerNote(batch);

            if (batch.isOpen) {
                let totalStock = Number(batch.publicPairs) || Number(batch.actualPairs) || 0;
                if (totalStock <= 0 && batch.stock) {
                    Object.keys(batch.stock).forEach((k) => {
                        if (getProductTrackType(k) === 'quail') totalStock += Number(batch.stock[k]) || 0;
                    });
                }
                let totalBooked = 0;
                if (batch.booked) {
                    Object.keys(batch.booked).forEach((k) => {
                        if (getProductTrackType(k) === 'quail') totalBooked += Number(batch.booked[k]) || 0;
                    });
                }
                const pct = totalStock > 0 ? Math.min(100, Math.round((totalBooked / totalStock) * 100)) : 0;
                const isSelected = currentVal === bId;

                return `
                <div id="card-${esc(bId)}" onclick="selectBatchAndScroll('${safeId}')" class="cursor-pointer shrink-0 min-w-[235px] sm:min-w-[260px] rounded-2xl p-3 border-2 transition-all flex flex-col justify-between gap-2 ${
                    isSelected
                        ? 'bg-gradient-to-l from-[#0f3426] to-[#1b4332] text-white border-amber-400 shadow-md'
                        : 'bg-white text-slate-800 border-slate-200 hover:border-brand-navy/50'
                }">
                    <div class="flex items-start justify-between gap-2">
                        <div class="min-w-0">
                            <h4 class="font-black text-xs sm:text-sm truncate ${isSelected ? 'text-white' : 'text-brand-navy'}">${esc(batch.name)}</h4>
                            <p class="text-[10px] font-bold mt-0.5 ${isSelected ? 'text-emerald-200' : 'text-slate-500'}">
                                <i class="fa-regular fa-calendar-check ${isSelected ? 'text-amber-400' : 'text-emerald-600'} ml-1"></i>${esc(dateText)}
                            </p>
                        </div>
                        <span class="shrink-0 text-lg ${isSelected ? 'text-amber-400' : 'text-slate-300'}">
                            <i class="fa-solid ${isSelected ? 'fa-circle-check' : 'fa-circle'}"></i>
                        </span>
                    </div>

                    ${smartNote ? `<p class="text-[10px] font-bold px-2 py-1 rounded-lg truncate ${
                        isSelected ? 'bg-white/10 text-amber-200' : (smartNote.isUrgent ? 'bg-amber-50 text-amber-800' : 'bg-slate-50 text-slate-600')
                    }">${smartNote.isUrgent ? '📌 ' : ''}${esc(smartNote.text)}</p>` : ''}

                    <div class="space-y-1">
                        <div class="flex items-center justify-between text-[10px] font-black">
                            <span class="${isSelected ? 'text-emerald-200' : 'text-emerald-700'}">${pct >= 80 ? '🔥 قرب يكتمل!' : '🟢 مفتوح للحجز'}</span>
                            <span class="${isSelected ? 'text-amber-300' : 'text-slate-400'}">${pct}% محجوز</span>
                        </div>
                        <div class="w-full h-1.5 rounded-full overflow-hidden ${isSelected ? 'bg-white/15' : 'bg-slate-100'}">
                            <div class="h-full rounded-full ${pct >= 80 ? 'bg-amber-400' : 'bg-emerald-500'}" style="width: ${Math.max(8, pct)}%"></div>
                        </div>
                    </div>
                </div>`;
            }

            const isPast = Boolean(batch.slaughteredAt) || (batch.deliveryStart && new Date(batch.deliveryStart).getTime() <= Date.now());
            return `
            <div class="shrink-0 min-w-[205px] rounded-2xl p-3 border border-slate-200 bg-slate-100/80 opacity-75 flex flex-col justify-between gap-2">
                <div class="flex items-start justify-between gap-2">
                    <div class="min-w-0">
                        <h4 class="font-black text-xs text-slate-600 truncate">${esc(batch.name)}</h4>
                        <p class="text-[10px] font-bold text-slate-400 mt-0.5 ${isPast ? 'line-through' : ''}">${esc(dateText)}</p>
                    </div>
                    <i class="fa-solid ${isPast ? 'fa-medal text-amber-500' : 'fa-hourglass-half text-slate-400'} text-sm"></i>
                </div>
                <span class="text-[10px] font-black text-slate-600 bg-white px-2 py-1 rounded-lg border border-slate-200 text-center">
                    ${isPast ? '✅ اكتملت وتم التسليم' : '🔒 اكتفينا وجاري التجهيز'}
                </span>
            </div>`;
        }).join('');

        updateCartBatchBanner();
    }

    window.selectBatchAndScroll = function (bId) {
        const batch = globalBatches[bId];
        if (!batch || !batch.isOpen || getBatchTrackType(batch) !== 'quail') return;

        const batchInput = document.getElementById('user-batch-select');
        const batchNameInput = document.getElementById('selected-batch-name');
        if (batchInput) batchInput.value = bId;
        if (batchNameInput) batchNameInput.value = batch.name || '';
        document.getElementById('batch-error-msg')?.classList.add('hidden');

        // ضبط كميات السمان المذبوح فقط عند تبديل الدفعة (بدون المساس بالبيض أو الكتاكيت أو الطيور بالوزن)
        let adjusted = false;
        Object.keys(cart).forEach((id) => {
            if (!productsInfo[id] || getProductTrackType(id) !== 'quail') return;
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
            showStoreToast('تم ضبط كميات السمان لتناسب متاح هذه الدفعة', 'fa-circle-info text-amber-400');
        } else {
            showStoreToast(`تم اختيار دفعة السمان: ${batch.name}`);
        }

        renderBatchesSelection();
        renderProducts();
        updateUI();
    };

    window.selectChicksBatch = function (bId) {
        const batch = globalBatches[bId];
        if (!batch || !batch.isOpen || getBatchTrackType(batch) !== 'chicks') return;
        const cInp = document.getElementById('user-chicks-batch-select');
        const cNameInp = document.getElementById('selected-chicks-batch-name');
        if (cInp) cInp.value = bId;
        if (cNameInp) cNameInp.value = batch.name || '';

        Object.keys(cart).forEach((id) => {
            if (getProductTrackType(id) !== 'chicks') return;
            const maxPure = getPureAvailableStock(id);
            if (cart[id].quantity > maxPure) {
                cart[id].quantity = maxPure;
                if (cart[id].quantity <= 0) delete cart[id];
            }
        });
        saveCart();
        showStoreToast(`🐣 تم اختيار دورة التفريخ: ${batch.name}`);
        renderProducts();
        updateUI();
    };


    window.scrollToBatch = function () {
        const batchBox = document.getElementById('batch-selection-container');
        if (batchBox && !batchBox.classList.contains('hidden')) {
            batchBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
            batchBox.classList.add('ring-4', 'ring-amber-400/60', 'rounded-2xl', 'p-1', 'transition-all');
            setTimeout(() => batchBox.classList.remove('ring-4', 'ring-amber-400/60', 'p-1'), 1300);
        }
    };

    // =========================================================================
    // 8. شبكة المنتجات المصقولة (صور مربعة كاملة + كارت أفقي للصنف الوحيد)
    // =========================================================================
    function buildAppGridProductCard(id, item, isFullWidthSingle = false) {
        const available = getAvailableStock(id);
        const inCart = Number(cart[id]?.quantity) || 0;
        const currentPrice = Number(globalPrices[id] !== undefined ? globalPrices[id] : item.basePrice) || 0;
        const oldPrice = Number(item.oldPrice || globalOldPrices[id]) || 0;
        const isDiscountActive = Boolean((item.isDisc || globalDiscounts[id]) && oldPrice > currentPrice);
        const savePct = isDiscountActive ? Math.round(((oldPrice - currentPrice) / oldPrice) * 100) : 0;
        const isBestSeller = Boolean(item.isBest || (Array.isArray(globalSettings.bestSellers) && globalSettings.bestSellers.includes(id)));

        const imgSrc = (Array.isArray(item.images) && item.images.length > 0 && item.images[0]) ? item.images[0] : '';
        const safeId = escAttr(id);
        const usageTag = getShortUsageTag(id, item);
        const trackType = getProductTrackType(id);

        // شارة دورة التفريخ (عمر يوم) تظهر على كارت الكتاكيت نفسه فقط ولا تلمس باقي الأصناف
        let chicksHatchBadgeHtml = '';
        if (trackType === 'chicks') {
            const openChicks = getVisibleBatchesByTrack('chicks').filter((b) => b.isOpen).sort((a, b) => a.id.localeCompare(b.id));
            const selectedChicksId = document.getElementById('user-chicks-batch-select')?.value || '';
            if (openChicks.length === 1) {
                const cb = openChicks[0];
                const dTxt = window.getFriendlyBatchDatePhrase(cb.deliveryStart, cb.deliveryEnd);
                chicksHatchBadgeHtml = `<div class="mt-1 bg-amber-50 border border-amber-200 text-amber-900 px-2 py-1 rounded-lg text-[9px] font-black leading-tight">🐣 ${esc(cb.name)} • ${esc(dTxt)}</div>`;
            } else if (openChicks.length > 1) {
                chicksHatchBadgeHtml = `
                    <div class="mt-1 flex flex-wrap gap-1" onclick="event.stopPropagation()">
                        ${openChicks.map((cb) => `
                            <button type="button" onclick="selectChicksBatch('${escAttr(cb.id)}')" class="px-2 py-0.5 rounded-md text-[9px] font-black border transition-all ${selectedChicksId === cb.id ? 'bg-amber-500 text-slate-950 border-amber-600' : 'bg-amber-50 text-amber-900 border-amber-200'}">
                                🐣 ${esc(cb.name)}
                            </button>`).join('')}
                    </div>`;
            }
        }

        const stockLine = available === 0
            ? `<span class="text-[10px] font-black text-rose-600 flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-rose-500"></span> نفذت الكمية</span>`
            : (available <= 10
                ? `<span class="text-[10px] font-black text-amber-700 flex items-center gap-1"><i class="fa-solid fa-fire text-orange-500 animate-pulse text-[9px]"></i> متبقي ${available} فقط!</span>`
                : `<span class="text-[10px] font-bold text-emerald-700 flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> متاح (${available})</span>`);

        // إذا كان الصنف وحيداً في قسم الإضافات (مثل بيض سمان فقط) يُعرض ككارت أفقي مميز بلا أي فراغ أبيض جانبي
        if (isFullWidthSingle) {
            return `
            <div class="col-span-full product-app-card ${inCart > 0 ? 'in-cart' : ''} rounded-3xl p-2.5 flex items-center gap-3 relative overflow-hidden">
                <div onclick="openProductQuickView('${safeId}')" class="relative w-28 h-28 sm:w-32 sm:h-32 rounded-2xl overflow-hidden bg-[#f4f1ea] shrink-0 cursor-pointer">
                    ${imgSrc
                        ? `<img loading="lazy" src="${esc(imgSrc)}" alt="${esc(item.name)}" class="w-full h-full object-cover" onerror="this.style.display='none'">`
                        : `<div class="w-full h-full flex items-center justify-center text-amber-500 bg-amber-50"><i class="fa-solid fa-egg text-3xl"></i></div>`}
                    ${item.weight ? `<span class="absolute bottom-1.5 right-1.5 bg-black/65 text-white text-[9px] font-bold px-2 py-0.5 rounded-md">${esc(item.weight)}</span>` : ''}
                </div>
                <div class="flex-1 min-w-0 flex flex-col justify-between self-stretch py-0.5">
                    <div onclick="openProductQuickView('${safeId}')" class="cursor-pointer space-y-1">
                        <div class="flex items-center gap-1.5 flex-wrap">
                            <h3 class="text-sm sm:text-base font-black text-brand-navy">${esc(item.name)}</h3>
                            <span class="text-[10px] font-black bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-lg">${usageTag}</span>
                        </div>
                        <p class="text-[11px] font-bold text-slate-500 line-clamp-1">${esc(getCookingTipForProduct(id, item))}</p>
                        <div>${stockLine}</div>
                        ${chicksHatchBadgeHtml}
                    </div>
                    <div class="flex items-end justify-between gap-2 pt-2 border-t border-slate-100 mt-2">
                        <div>
                            ${isDiscountActive ? `<span class="block text-[10px] text-slate-400 line-through font-bold">${oldPrice} ج</span>` : ''}
                            <span class="font-black text-lg ${isDiscountActive ? 'text-rose-600' : 'text-brand-navy'}">${currentPrice} <span class="text-[10px] font-bold text-slate-400">ج.م</span></span>
                        </div>
                        <div id="card-action-${esc(id)}" class="shrink-0">${getCardActionHTML(id)}</div>
                    </div>
                </div>
            </div>`;
        }

        // الكارت المربع المتوازن لأطباق السمان والمنتجات
        return `
        <div class="product-app-card ${inCart > 0 ? 'in-cart' : ''} ${available === 0 && inCart === 0 ? 'opacity-85' : ''} rounded-3xl p-2 flex flex-col justify-between relative overflow-hidden">
            <div onclick="openProductQuickView('${safeId}')" class="relative aspect-square rounded-2xl overflow-hidden bg-[#f4f1ea] cursor-pointer group">
                ${imgSrc
                    ? `<img loading="lazy" src="${esc(imgSrc)}" alt="${esc(item.name)}" class="w-full h-full object-cover object-center transition-transform duration-500 group-hover:scale-105" onerror="this.style.display='none'">`
                    : `<div class="w-full h-full flex items-center justify-center text-slate-300"><i class="fa-solid fa-kiwi-bird text-3xl"></i></div>`}

                ${isDiscountActive ? `<span class="absolute top-2 left-2 bg-rose-600 text-white text-[9px] font-black px-2 py-0.5 rounded-lg shadow-md sale-badge">وفر ${savePct}%</span>` : ''}
                ${isBestSeller ? `<span class="absolute top-2 right-2 bg-[#0b261c]/90 text-amber-300 text-[9px] font-black px-2 py-0.5 rounded-lg shadow-md backdrop-blur-sm border border-amber-400/30">👑 الأكثر طلباً</span>` : ''}
                ${item.weight ? `<span class="absolute bottom-2 right-2 bg-black/70 backdrop-blur-sm text-white text-[9px] font-bold px-2 py-0.5 rounded-md">${esc(item.weight)}</span>` : ''}
            </div>

            <div class="pt-2 px-1 pb-0.5 flex-1 flex flex-col justify-between gap-1.5">
                <div onclick="openProductQuickView('${safeId}')" class="cursor-pointer space-y-0.5">
                    <h3 class="text-xs sm:text-sm font-black text-brand-navy leading-snug line-clamp-1">${esc(item.name)}</h3>
                    <span class="inline-block text-[10px] font-bold text-slate-500">${usageTag}</span>
                    <div>${stockLine}</div>
                    ${chicksHatchBadgeHtml}
                </div>

                <div class="flex items-center justify-between gap-1 pt-1.5 border-t border-slate-100 mt-1">
                    <div>
                        ${isDiscountActive ? `<span class="block text-[10px] text-slate-400 line-through font-bold leading-none">${oldPrice} ج</span>` : ''}
                        <span class="font-black text-base sm:text-lg ${isDiscountActive ? 'text-rose-600' : 'text-brand-navy'} leading-none">${currentPrice} <span class="text-[10px] font-bold text-slate-400">ج.م</span></span>
                    </div>
                    <div id="card-action-${esc(id)}" class="shrink-0">${getCardActionHTML(id)}</div>
                </div>
            </div>
        </div>`;
    }

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
                    <button type="button" onclick="toggleWeightBirdInCart('${safeId}', ${idx}, ${grams})" class="px-2.5 py-1.5 rounded-xl text-[11px] font-black border transition-all flex items-center gap-1.5 ${
                        isPicked ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-white text-slate-700 border-indigo-200 hover:bg-indigo-50'
                    }">
                        <i class="fa-solid ${isPicked ? 'fa-check-circle text-amber-300' : 'fa-plus text-indigo-500'} text-[10px]"></i>
                        <span>${kg} كجم (${estPrice} ج)</span>
                    </button>`;
            }).join('')
            : `<span class="text-xs font-bold text-slate-400">نفذت الأوزان المتاحة حالياً — تابعنا في الدفعة القادمة</span>`;

        return `
        <div class="bg-white rounded-3xl shadow-sm border-2 ${pickedIndices.length > 0 ? 'border-indigo-500 ring-2 ring-indigo-100' : 'border-indigo-100'} p-3.5 space-y-2.5">
            <div class="flex items-center justify-between gap-3">
                <div class="flex items-center gap-2.5 min-w-0">
                    ${imgSrc
                        ? `<img src="${esc(imgSrc)}" alt="${esc(item.name)}" onclick="openImageModal('${escAttr(imgSrc)}')" class="w-12 h-12 rounded-2xl object-cover border border-indigo-100 cursor-zoom-in shrink-0">`
                        : `<div class="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0"><i class="fa-solid fa-scale-balanced text-lg"></i></div>`}
                    <div class="min-w-0">
                        <h3 class="text-sm font-black text-indigo-950 truncate">${esc(item.name)}</h3>
                        <p class="text-[11px] font-bold text-slate-500">سعر الكيلو: <strong class="text-indigo-700">${kiloPrice} ج.م</strong> • متاح (${weightsArr.length})</p>
                    </div>
                </div>
                ${pickedIndices.length > 0 ? `<span class="bg-indigo-600 text-white text-[10px] font-black px-2.5 py-1 rounded-xl shrink-0">بالسلة: ${pickedIndices.length}</span>` : ''}
            </div>
            <div class="bg-indigo-50/50 p-2.5 rounded-2xl border border-indigo-100">
                <p class="text-[10px] font-black text-indigo-900 mb-2"><i class="fa-solid fa-hand-pointer ml-1 text-indigo-500"></i> اضغط على الوزن المناسب لإضافته لسلتك:</p>
                <div class="flex flex-wrap gap-1.5">${chipsHtml}</div>
            </div>
        </div>`;
    }

    window.openProductQuickView = function (id) {
        const item = productsInfo[id];
        if (!item) return;
        currentQuickViewId = id;
        const imgSrc = (Array.isArray(item.images) && item.images[0]) ? item.images[0] : '';
        const price = Number(globalPrices[id] !== undefined ? globalPrices[id] : item.basePrice) || 0;
        const oldPrice = Number(item.oldPrice || globalOldPrices[id]) || 0;
        const isDisc = Boolean((item.isDisc || globalDiscounts[id]) && oldPrice > price);
        const avail = getAvailableStock(id);

        const imgEl = document.getElementById('pq-img');
        imgEl.src = imgSrc || '';
        imgEl.style.display = imgSrc ? 'block' : 'none';
        document.getElementById('pq-weight-badge').textContent = item.weight || 'طازج بالطلب';
        document.getElementById('pq-name').textContent = item.name;
        document.getElementById('pq-tip').textContent = getCookingTipForProduct(id, item);
        document.getElementById('pq-price-wrap').innerHTML = isDisc
            ? `<span class="block text-xs text-slate-400 line-through font-bold">${oldPrice} ج.م</span><span class="text-xl font-black text-rose-600">${price} <span class="text-xs">ج.م</span></span>`
            : `<span class="text-xl font-black text-brand-navy">${price} <span class="text-xs">ج.م</span></span>`;

        document.getElementById('pq-stock-line').innerHTML = avail > 0
            ? `<span class="text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-xl inline-block">🟢 متاح للحجز الآن: ${avail}</span>`
            : `<span class="text-rose-600 bg-rose-50 border border-rose-200 px-3 py-1 rounded-xl inline-block">🔴 نفذت الكمية في هذه الدفعة</span>`;

        updateQuickViewActionButton();

        const md = document.getElementById('product-quick-modal');
        const box = document.getElementById('product-quick-box');
        md.classList.remove('hidden');
        setTimeout(() => {
            md.classList.remove('opacity-0');
            box.classList.remove('translate-y-6');
        }, 15);
    };

    function updateQuickViewActionButton() {
        const wrap = document.getElementById('pq-action-wrap');
        if (!wrap || !currentQuickViewId || !productsInfo[currentQuickViewId]) return;
        const id = currentQuickViewId;
        const safeId = escAttr(id);
        const inCart = Number(cart[id]?.quantity) || 0;
        const avail = getAvailableStock(id);

        if (globalSettings.storeOpen === false) {
            wrap.innerHTML = '<div class="w-full py-3 rounded-xl bg-slate-100 text-slate-400 text-center text-sm font-black">المتجر مغلق حالياً</div>';
            return;
        }
        if (avail === 0 && inCart === 0) {
            wrap.innerHTML = `<button type="button" onclick="closeProductQuickView(); scrollToBatch();" class="w-full py-3 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 font-black text-sm">نفذت الكمية — اختر دفعة أخرى ↑</button>`;
            return;
        }
        if (inCart > 0) {
            wrap.innerHTML = `
                <div class="flex items-center gap-3">
                    <div class="flex-1 flex items-center justify-between bg-emerald-50 border-2 border-brand-navy/20 rounded-xl p-1.5">
                        <button type="button" onclick="updateQuantity('${safeId}', 1)" class="w-10 h-10 bg-brand-navy text-white rounded-lg font-black text-lg">+</button>
                        <span class="font-black text-lg text-brand-navy">${inCart}</span>
                        <button type="button" onclick="updateQuantity('${safeId}', -1)" class="w-10 h-10 bg-white text-rose-600 rounded-lg font-black text-lg shadow-sm">-</button>
                    </div>
                    <button type="button" onclick="closeProductQuickView(); toggleCart();" class="bg-amber-400 text-[#0b261c] font-black px-5 py-3.5 rounded-xl text-xs shadow-md shrink-0">عرض السلة</button>
                </div>`;
        } else {
            wrap.innerHTML = `<button type="button" onclick="addToCart('${safeId}')" class="w-full bg-brand-navy hover:opacity-95 text-white font-black py-3.5 rounded-xl text-sm shadow-lg flex items-center justify-center gap-2"><i class="fa-solid fa-plus text-amber-400"></i> إضافة للسلة</button>`;
        }
    }

    window.closeProductQuickView = function () {
        const md = document.getElementById('product-quick-modal');
        const box = document.getElementById('product-quick-box');
        if (!md) return;
        md.classList.add('opacity-0');
        if (box) box.classList.add('translate-y-6');
        setTimeout(() => { md.classList.add('hidden'); currentQuickViewId = null; }, 200);
    };

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
            showStoreToast(`تمت إضافة ${(grams / 1000).toFixed(2)} كجم من ${p.name}`);
        }

        if (existing.selectedWeightsGrams.length === 0) {
            delete cart[id];
        } else {
            const totalGrams = existing.selectedWeightsGrams.reduce((s, v) => s + v, 0);
            existing.quantity = Number((totalGrams / 1000).toFixed(3));
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
        const quailWrap = document.getElementById('quail-section-wrap');
        const extrasContainer = document.getElementById('extras-container');
        const extrasWrap = document.getElementById('extras-section-wrap');
        const weightContainer = document.getElementById('weight-products-container');
        const weightWrap = document.getElementById('weight-section-wrap');
        const customWrap = document.getElementById('custom-sections-wrap');
        if (!container) return;

        const groups = { quail: [], eggs_chicks: [], weight: [], custom: [] };
        let hasAnyWeightProduct = false;
        let hasAnyCustomProduct = false;

        Object.keys(productsInfo).forEach((id) => {
            const item = productsInfo[id];
            if (!item || item.isVisible === false || item.isHidden === true) return;
            const meta = classifyStoreProduct(id, item);
            if (meta.group === 'weight') hasAnyWeightProduct = true;
            if (meta.group === 'custom') hasAnyCustomProduct = true;
            if (!matchesStoreFilter(id, item, meta.group)) return;
            if (!groups[meta.group]) groups.custom.push({ id, item, rank: meta.rank });
            else groups[meta.group].push({ id, item, rank: meta.rank });
        });

        const weightFilterBtn = document.querySelector('.store-filter-btn[data-filter="weight"]');
        if (weightFilterBtn) weightFilterBtn.classList.toggle('hidden', !hasAnyWeightProduct);

        const customFilterBtn = document.querySelector('.store-filter-btn[data-filter="custom"]');
        if (customFilterBtn) customFilterBtn.classList.toggle('hidden', !hasAnyCustomProduct);

        groups.quail.sort((a, b) => a.rank - b.rank);
        groups.eggs_chicks.sort((a, b) => a.rank - b.rank);
        groups.weight.sort((a, b) => a.rank - b.rank);
        groups.custom.sort((a, b) => a.rank - b.rank);

        if (quailWrap) {
            if (groups.quail.length > 0) {
                container.innerHTML = groups.quail.map((g) => buildAppGridProductCard(g.id, g.item, false)).join('');
                quailWrap.classList.remove('hidden');
            } else if (activeProductFilter === 'all' && groups.eggs_chicks.length === 0 && groups.custom.length === 0) {
                container.innerHTML = `<div class="col-span-full text-center py-8 text-slate-400 font-bold bg-white rounded-2xl border border-dashed border-slate-200">${esc(globalSettings.uiTexts?.emptyMenuMsg || 'لا توجد منتجات متاحة حالياً')}</div>`;
                quailWrap.classList.remove('hidden');
            } else {
                quailWrap.classList.add('hidden');
            }
        }

        if (extrasContainer && extrasWrap) {
            if (groups.eggs_chicks.length > 0) {
                const isSingleExtra = groups.eggs_chicks.length === 1;
                extrasContainer.innerHTML = groups.eggs_chicks.map((g) => buildAppGridProductCard(g.id, g.item, isSingleExtra)).join('');
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

        // رسم الأقسام المستقلة المفتوحة (كل قسم باسمه المخصص الذي كتبته في الـ CRM)
        if (customWrap) {
            if (groups.custom.length > 0) {
                const bySectionTitle = {};
                groups.custom.forEach((g) => {
                    const secTitle = (g.item.customGroupTitle && g.item.customGroupTitle.trim())
                        ? g.item.customGroupTitle.trim()
                        : 'أصناف ومنتجات خاصة';
                    if (!bySectionTitle[secTitle]) bySectionTitle[secTitle] = [];
                    bySectionTitle[secTitle].push(g);
                });

                customWrap.innerHTML = Object.keys(bySectionTitle).map((secTitle) => {
                    const secItems = bySectionTitle[secTitle];
                    const isSingle = secItems.length === 1;
                    return `
                    <div class="space-y-3">
                        <h2 class="text-base sm:text-lg font-black text-brand-navy flex items-center gap-2">
                            <span class="w-1.5 h-5 rounded-full bg-purple-600 inline-block"></span>
                            <span>${esc(secTitle)}</span>
                        </h2>
                        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-3">
                            ${secItems.map((g) => buildAppGridProductCard(g.id, g.item, isSingle)).join('')}
                        </div>
                    </div>`;
                }).join('');
                customWrap.classList.remove('hidden');
            } else {
                customWrap.innerHTML = '';
                customWrap.classList.add('hidden');
            }
        }

        updateQuickViewActionButton();
    };

    window.getCardActionHTML = function (id) {
        if (globalSettings.storeOpen === false) {
            return `<span class="px-2.5 py-1.5 rounded-xl bg-slate-100 text-slate-400 text-[10px] font-black">مغلق</span>`;
        }
        const inCart = Number(cart[id]?.quantity) || 0;
        const available = getAvailableStock(id);
        const safeId = escAttr(id);

        if (available === 0 && inCart === 0) {
            const isQuailProd = getProductTrackType(id) === 'quail';
            const hasOpenQuailBatch = isQuailProd && getVisibleBatchesByTrack('quail').some((b) => b.isOpen);
            return `<button type="button" onclick="${hasOpenQuailBatch ? 'scrollToBatch()' : `updateNextBatch('${safeId}', 1)`}" class="px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 text-[10px] font-black transition-colors">${hasOpenQuailBatch ? 'غيّر الدفعة' : 'للقادمة'}</button>`;
        }


        if (inCart > 0) {
            return `
            <div class="flex items-center gap-1 bg-emerald-50 border border-brand-navy/20 rounded-xl p-0.5">
                <button type="button" onclick="updateQuantity('${safeId}', 1)" class="w-7 h-7 bg-brand-navy text-white rounded-lg font-black text-sm flex items-center justify-center active:scale-90">+</button>
                <span id="qty-num-${esc(id)}" class="font-black text-brand-navy text-xs min-w-[18px] text-center">${inCart}</span>
                <button type="button" onclick="updateQuantity('${safeId}', -1)" class="w-7 h-7 bg-white text-rose-600 rounded-lg font-black text-sm shadow-sm flex items-center justify-center active:scale-90">-</button>
            </div>`;
        }

        return `<button type="button" onclick="addToCart('${safeId}')" aria-label="إضافة للسلة" class="w-9 h-9 rounded-xl bg-brand-navy hover:bg-emerald-800 text-amber-400 shadow-md flex items-center justify-center active:scale-90 transition-transform"><i class="fa-solid fa-plus text-sm"></i></button>`;
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
        if (getProductTrackType(id) === 'quail') {
            const hasOpenQuailBatches = getVisibleBatchesByTrack('quail').some((b) => b.isOpen);
            const batchSelect = document.getElementById('user-batch-select');
            if (hasOpenQuailBatches && (!batchSelect || !batchSelect.value)) {
                showAlert('اختر دفعة السمان أولاً', 'برجاء اختيار ميعاد ذبح واستلام السمان أولاً.');
                window.scrollToBatch();
                return;
            }
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
        showStoreToast(`تمت إضافة ${productsInfo[id].name} للسلة`);

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
                if (navigator.vibrate) navigator.vibrate(40);
            } else {
                showStoreToast('وصلت للحد الأقصى المتاح بهذه الدفعة', 'fa-circle-exclamation text-amber-400');
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
    // 9. السلة، شريط الإضافة السريعة، الكوبونات، وملخص الخطوة 2
    // =========================================================================
    function renderInCartQuickAddons() {
        const wrap = document.getElementById('cart-quick-addons-wrap');
        const list = document.getElementById('cart-quick-addons-list');
        if (!wrap || !list) return;

        if (Object.keys(cart).length === 0) {
            wrap.classList.add('hidden');
            return;
        }

        const suggestions = Object.keys(productsInfo)
            .filter((id) => {
                const p = productsInfo[id];
                return p && !p.isHidden && !p.isWeightBased && !cart[id] && getAvailableStock(id) > 0;
            })
            .sort((a, b) => {
                // أولوية لبيض السمان ثم الأكثر طلباً ثم الترتيب الطبيعي
                const aEgg = (a === 'eggs' || String(productsInfo[a]?.name || '').includes('بيض')) ? 0 : 1;
                const bEgg = (b === 'eggs' || String(productsInfo[b]?.name || '').includes('بيض')) ? 0 : 1;
                if (aEgg !== bEgg) return aEgg - bEgg;
                return (productsInfo[b]?.isBest ? 1 : 0) - (productsInfo[a]?.isBest ? 1 : 0);
            })
            .slice(0, 3);

        if (suggestions.length === 0) {
            wrap.classList.add('hidden');
            return;
        }

        wrap.classList.remove('hidden');
        list.innerHTML = suggestions.map((id) => {
            const p = productsInfo[id];
            const pr = Number(globalPrices[id] !== undefined ? globalPrices[id] : p.basePrice) || 0;
            const imgSrc = (Array.isArray(p.images) && p.images[0]) ? p.images[0] : '';
            const safeId = escAttr(id);
            return `
                <div class="shrink-0 w-44 bg-white border border-slate-200 rounded-2xl p-2 flex items-center gap-2 shadow-sm">
                    ${imgSrc
                        ? `<img src="${esc(imgSrc)}" alt="${esc(p.name)}" class="w-11 h-11 rounded-xl object-cover shrink-0 bg-slate-50">`
                        : `<div class="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0"><i class="fa-solid fa-egg"></i></div>`}
                    <div class="min-w-0 flex-1">
                        <span class="block text-[11px] font-black text-brand-navy truncate">${esc(p.name)}</span>
                        <span class="block text-[10px] font-black text-emerald-700">${pr} ج.م</span>
                    </div>
                    <button type="button" onclick="addToCart('${safeId}')" class="w-7 h-7 rounded-lg bg-brand-navy text-amber-400 font-black flex items-center justify-center shrink-0 active:scale-90">+</button>
                </div>`;
        }).join('');
    }

    window.applyPromoCode = function () {
        const inputEl = document.getElementById('promo-code-input');
        const msg = document.getElementById('promo-message');
        if (!inputEl || !msg) return;
        const code = inputEl.value.trim().toUpperCase();
        if (!code) return;

        const subTotal = calculateCartSubtotal();
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

        const step2Lines = [];

        Object.keys(cart).forEach((id) => {
            if (!productsInfo[id]) {
                delete cart[id];
                return;
            }
            const p = productsInfo[id];
            const item = cart[id];
            item.price = Number(globalPrices[id] !== undefined ? globalPrices[id] : p.basePrice) || 0;
            const lineTotal = Math.round((Number(item.quantity) || 0) * item.price);
            subTotalPrice += lineTotal;
            totalItems += item.isWeightBased ? (item.selectedWeightsGrams?.length || 1) : Number(item.quantity);

            const thumbSrc = (Array.isArray(p.images) && p.images[0]) ? p.images[0] : '';
            step2Lines.push(`<div class="flex justify-between items-center text-slate-700 font-bold"><span>${esc(item.quantity)} × ${esc(item.name)}</span><strong class="text-brand-navy">${lineTotal} ج.م</strong></div>`);

            if (cartItemsContainer) {
                const safeId = escAttr(id);
                const thumbHtml = thumbSrc
                    ? `<img src="${esc(thumbSrc)}" alt="${esc(item.name)}" class="w-13 h-13 w-[52px] h-[52px] rounded-xl object-cover shrink-0 border border-slate-100 bg-slate-50">`
                    : `<div class="w-[52px] h-[52px] rounded-xl bg-emerald-50 text-brand-navy flex items-center justify-center shrink-0"><i class="fa-solid fa-kiwi-bird text-lg"></i></div>`;

                cartItemsContainer.innerHTML += item.isWeightBased
                    ? `
                    <div class="bg-white p-2.5 rounded-2xl border border-indigo-100 flex items-center gap-2.5 shadow-sm">
                        ${thumbHtml}
                        <div class="min-w-0 flex-1">
                            <h4 class="font-black text-indigo-950 text-xs truncate">${esc(item.name)}</h4>
                            <div class="text-indigo-700 font-black text-xs mt-0.5">${item.quantity} كجم × ${item.price} = <strong>${lineTotal} ج.م</strong></div>
                        </div>
                        <button type="button" onclick="updateQuantity('${safeId}', -1)" class="bg-rose-50 text-rose-500 hover:bg-rose-500 hover:text-white w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-colors"><i class="fa-solid fa-trash text-xs"></i></button>
                    </div>`
                    : `
                    <div class="bg-white p-2.5 rounded-2xl border border-slate-200/70 flex items-center gap-2.5 shadow-sm">
                        ${thumbHtml}
                        <div class="min-w-0 flex-1">
                            <h4 class="font-black text-brand-navy text-xs truncate">${esc(item.name)}</h4>
                            <div class="flex items-center gap-1.5 mt-0.5">
                                <span class="text-[11px] font-bold text-slate-400">${item.price} ج</span>
                                <span class="text-slate-300">•</span>
                                <span class="text-xs font-black text-emerald-700">${lineTotal} ج.م</span>
                            </div>
                        </div>
                        <div class="flex items-center gap-1 bg-slate-50 rounded-xl p-1 border border-slate-200 h-[34px] shrink-0">
                            <button type="button" onclick="updateQuantity('${safeId}', 1)" class="w-7 h-full bg-brand-navy text-white rounded-lg font-black text-sm flex items-center justify-center active:scale-90">+</button>
                            <span class="font-black text-brand-navy min-w-[20px] text-center text-xs">${item.quantity}</span>
                            <button type="button" onclick="updateQuantity('${safeId}', -1)" class="w-7 h-full bg-white text-rose-500 rounded-lg shadow-sm font-black text-sm flex items-center justify-center active:scale-90">-</button>
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
                <div class="flex justify-between items-center text-[11px] font-bold text-amber-900 bg-amber-50 p-2 rounded-xl border border-amber-200 mb-1">
                    <span>⏳ ${esc(p.name)}</span>
                    <div class="flex items-center gap-2 bg-white rounded-lg border border-amber-200 px-1.5 py-0.5">
                        <button type="button" class="text-amber-700 font-black px-1" onclick="updateNextBatch('${safeId}', 1)">+</button>
                        <span>${window.nextBatchCart[id]}</span>
                        <button type="button" class="text-rose-500 font-black px-1" onclick="updateNextBatch('${safeId}', -1)">-</button>
                    </div>
                </div>`;
        });
        if (nextBatchHtml && cartItemsContainer) {
            cartItemsContainer.innerHTML += `<div class="mt-3 pt-2 border-t border-slate-200"><h5 class="text-xs font-black text-brand-navy mb-2">مطلوب للدفعة القادمة (كملاحظة):</h5>${nextBatchHtml}</div>`;
            if (totalItems === 0) totalItems = 1;
        }

        const bottomBar = document.getElementById('bottom-cart-bar');
        const storeFooter = document.getElementById('store-footer');
        if (bottomBar) {
            document.getElementById('bottom-cart-total').textContent = subTotalPrice;
            document.getElementById('bottom-cart-count').textContent = totalItems;
            if (totalItems > 0) {
                bottomBar.classList.remove('translate-y-full');
                if (storeFooter) storeFooter.style.paddingBottom = '6.5rem';
            } else {
                bottomBar.classList.add('translate-y-full');
                if (storeFooter) storeFooter.style.paddingBottom = '';
               if (cartItemsContainer) {
                    cartItemsContainer.innerHTML = `
                        <div class="flex flex-col items-center justify-center py-12 text-slate-400 gap-2.5">
                            <i class="fa-solid fa-basket-shopping text-5xl text-slate-200"></i>
                            <p class="font-bold text-sm">${esc(globalSettings.uiTexts?.emptyCartMsg || 'السلة فارغة حالياً')}</p>
                        </div>`;
                }
            }
        }

        renderInCartQuickAddons();

        // تحديث ملخص الخطوة 2 القابل للفتح
        const step2Title = document.getElementById('step2-summary-title');
        const step2Sub = document.getElementById('step2-summary-sub');
        const step2Collapse = document.getElementById('step2-items-collapse');
        const bNameNow = document.getElementById('selected-batch-name')?.value || '';
        if (step2Title) step2Title.textContent = `ملخص طلبك (${totalItems} صنف • ${subTotalPrice} ج.م)`;
        if (step2Sub) step2Sub.textContent = bNameNow ? `حجز ضمن: ${bNameNow} — اضغط لعرض التفاصيل` : 'اضغط لعرض الأصناف المختارة';
        if (step2Collapse) step2Collapse.innerHTML = step2Lines.join('') || '<p class="text-slate-400">لا توجد أصناف</p>';

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
                        ? `<span class="text-slate-600">باقي <strong class="text-rose-600">${rem} ج.م</strong> وتاخد توصيل مجاني!</span><i class="fa-solid fa-gift text-amber-500"></i>`
                        : `<span class="text-emerald-600 font-black">مبروك! التوصيل مجاني 🎉</span><i class="fa-solid fa-circle-check text-emerald-500"></i>`;
                }
            } else {
                tracker.classList.add('hidden');
            }
        }

        let promoDiscount = 0;
        const promoRow = document.getElementById('promo-discount-row');
        const step2PromoRow = document.getElementById('step2-promo-row');
        if (appliedPromo && subTotalPrice > 0) {
            if (appliedPromo.minOrder && subTotalPrice < Number(appliedPromo.minOrder)) {
                appliedPromo = null;
                if (promoRow) promoRow.classList.add('hidden');
                if (step2PromoRow) step2PromoRow.classList.add('hidden');
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
                if (step2PromoRow && promoDiscount > 0) {
                    document.getElementById('step2-promo-val').textContent = promoDiscount;
                    step2PromoRow.classList.remove('hidden');
                }
            }
        } else {
            if (promoRow) promoRow.classList.add('hidden');
            if (step2PromoRow) step2PromoRow.classList.add('hidden');
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
        if (document.getElementById('step2-subtotal-val')) document.getElementById('step2-subtotal-val').textContent = subTotalPrice;
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
        const hasQuailInCart = Object.keys(cart).some((id) => getProductTrackType(id) === 'quail');
        if (hasQuailInCart) {
            const hasOpenQuailBatches = getVisibleBatchesByTrack('quail').some((b) => b.isOpen);
            const batchSelect = document.getElementById('user-batch-select');
            if (hasOpenQuailBatches && (!batchSelect || !batchSelect.value)) {
                showAlert('تنبيه مهم', 'برجاء تحديد ميعاد استلام دفعة السمان قبل إتمام الطلب.');
                toggleCart();
                setTimeout(() => window.scrollToBatch(), 300);
                return;
            }
        }
        updateCartBatchBanner();
        document.getElementById('checkout-step-1').classList.add('hidden');
        document.getElementById('checkout-step-2').classList.remove('hidden');
        document.getElementById('btn-back-step').classList.remove('hidden');
        document.getElementById('lbl-checkout-title').textContent = 'التوصيل والتأكيد';
        document.getElementById('step-1-indicator').classList.replace('step-active', 'step-completed');
        document.getElementById('step-line-1').classList.add('active');
        document.getElementById('step-2-indicator').classList.replace('opacity-60', 'step-active');
        renderQuickZoneChips();
        updateUI();
    };

    window.backToCart = function () {
        document.getElementById('checkout-step-2').classList.add('hidden');
        document.getElementById('checkout-step-1').classList.remove('hidden');
        document.getElementById('btn-back-step').classList.add('hidden');
        document.getElementById('lbl-checkout-title').textContent = globalSettings.uiTexts?.checkoutTitle || 'سلة المشتريات';
        document.getElementById('step-2-indicator').classList.replace('step-active', 'opacity-60');
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
            updateCartBatchBanner();
            backToCart();
        } else {
            sidebar.classList.add('translate-x-full');
            overlay.classList.add('opacity-0');
            setTimeout(() => overlay.classList.add('hidden'), 300);
            document.body.style.overflow = '';
        }
    };

    // =========================================================================
    // 10. جلب بيانات العميل المسجل ورصيد محفظته (بكل صيغ الرقم + الرجوع لآخر طلب)
    // =========================================================================
    function setupEventListeners() {
        ['customer-name', 'customer-phone', 'customer-address'].forEach((id) => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('input', updateUI);
        });
        const dZone = document.getElementById('delivery-zone');
        if (dZone) dZone.addEventListener('change', () => { renderQuickZoneChips(); updateUI(); });

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
        const triggerLookup = (immediate) => {
            if (!phoneInput) return;
            clearTimeout(phoneTimer);
            const rawVal = phoneInput.value || '';
            const norm = U.normalizePhone(rawVal);
            if (norm.length >= 10) {
                if (immediate) checkCustomerWalletSafe(norm, rawVal);
                else phoneTimer = setTimeout(() => checkCustomerWalletSafe(norm, rawVal), 500);
            } else {
                lastCheckedCustomerPhone = '';
                resetWalletBanner();
            }
        };

        if (phoneInput) {
            phoneInput.addEventListener('input', () => triggerLookup(false));
            phoneInput.addEventListener('change', () => triggerLookup(true));
            phoneInput.addEventListener('blur', () => triggerLookup(true));
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

    function toArabicDigitsStr(str) {
        const ar = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
        return String(str || '').replace(/[0-9]/g, (d) => ar[Number(d)]);
    }

    function buildCustomerPhoneCandidates(cleanPhone, rawPhone) {
        const set = new Set();
        const norm = U.normalizePhone(cleanPhone || rawPhone || '');
        const rawTrim = String(rawPhone || '').trim();
        if (norm) set.add(norm);
        if (rawTrim && rawTrim.length >= 10) set.add(rawTrim);
        if (norm.startsWith('01') && norm.length === 11) {
            set.add(norm.substring(1));
            set.add('2' + norm);
            set.add('+2' + norm);
            set.add('002' + norm);
            set.add(toArabicDigitsStr(norm));
        }
        return Array.from(set);
    }

    async function checkCustomerWalletSafe(cleanPhone, rawPhone = '') {
        if (!hasCloud || !db || !cleanPhone) return;
        const norm = U.normalizePhone(cleanPhone);
        if (norm.length < 10) return;

        if (lastCheckedCustomerPhone === norm && document.getElementById('customer-name')?.value.trim()) {
            return;
        }

        const msgEl = document.getElementById('smart-welcome-msg');
        const walletBox = document.getElementById('checkout-wallet-box');
        const walletTxt = document.getElementById('checkout-wallet-text');
        const nameInput = document.getElementById('customer-name');
        const addrInput = document.getElementById('customer-address');
        const zoneSelect = document.getElementById('delivery-zone');

        if (msgEl) {
            msgEl.className = 'p-2.5 rounded-xl border text-xs font-black bg-slate-50 text-slate-600 border-slate-200';
            msgEl.textContent = '⏳ جاري التحقق من بياناتك المسجلة...';
            msgEl.classList.remove('hidden');
        }

        try {
            const candidates = buildCustomerPhoneCandidates(norm, rawPhone);
            const custSnaps = await Promise.all(
                candidates.map((docId) => db.collection('customers').doc(docId).get().catch(() => null))
            );

            let custData = null;
            let matchedWalletDocId = norm;
            for (let i = 0; i < custSnaps.length; i++) {
                const snap = custSnaps[i];
                if (snap && snap.exists) {
                    custData = snap.data() || {};
                    matchedWalletDocId = snap.id;
                    break;
                }
            }

            let finalName = custData?.name || '';
            let finalAddress = (custData?.address && custData.address !== 'غير محدد') ? custData.address : '';
            let finalZone = custData?.zone || '';

            if (!custData || !finalName || !finalAddress || !finalZone) {
                const orderSnaps = await Promise.all(
                    candidates.slice(0, 4).map((pVal) =>
                        db.collection('orders').where('customerPhone', '==', pVal).limit(5).get().catch(() => null)
                    )
                );

                const matchedOrders = [];
                orderSnaps.forEach((snap) => {
                    if (!snap || snap.empty) return;
                    snap.forEach((d) => matchedOrders.push(d.data() || {}));
                });

                if (matchedOrders.length > 0) {
                    matchedOrders.sort((a, b) => {
                        const ma = (a.createdAt && typeof a.createdAt.toMillis === 'function') ? a.createdAt.toMillis() : 0;
                        const mb = (b.createdAt && typeof b.createdAt.toMillis === 'function') ? b.createdAt.toMillis() : 0;
                        return mb - ma;
                    });
                    const latestOrd = matchedOrders[0];
                    if (!finalName && latestOrd.customerName) finalName = latestOrd.customerName;
                    if (!finalAddress && latestOrd.customerAddress && latestOrd.customerAddress !== 'غير محدد') finalAddress = latestOrd.customerAddress;
                    if (!finalZone && latestOrd.zone) finalZone = latestOrd.zone;
                }
            }

            const foundAnyRecord = Boolean(custData || finalName || finalAddress || finalZone);
            lastCheckedCustomerPhone = norm;

            if (foundAnyRecord) {
                const hasValidName = Boolean(finalName && isCustomerNameValid(finalName));
                if (nameInput && hasValidName) nameInput.value = finalName;
                if (addrInput && finalAddress) addrInput.value = finalAddress;
                if (zoneSelect && finalZone) {
                    const targetZone = String(finalZone).trim();
                    for (let i = 0; i < zoneSelect.options.length; i++) {
                        const opt = zoneSelect.options[i];
                        if (opt.value === targetZone || opt.textContent.includes(targetZone)) {
                            zoneSelect.selectedIndex = i;
                            break;
                        }
                    }
                    renderQuickZoneChips();
                }

                if (msgEl) {
                    if (hasValidName) {
                        const firstName = String(finalName).trim().split(/\s+/)[0];
                        msgEl.className = 'p-2.5 rounded-xl border text-xs font-black bg-emerald-50 text-emerald-800 border-emerald-200';
                        msgEl.textContent = `أهلاً بيك مرة تانية في بيتك يا ${firstName}! 👑 جهزنا بياناتك تلقائياً.`;
                    } else {
                        msgEl.className = 'p-2.5 rounded-xl border text-xs font-black bg-amber-50 text-amber-800 border-amber-200';
                        msgEl.textContent = 'أهلاً بيك معانا! ✨ ياريت تكتب اسمك بالكامل عشان نأكدلك الحجز.';
                    }
                    msgEl.classList.remove('hidden');
                }

                const pts = Math.max(0, parseInt(custData?.walletPoints) || 0);
                const pVal = Number(globalSettings.pointValueInEGP) || 0.40;
                const disc = Math.floor(pts * pVal);

                if (pts > 0 && disc > 0 && walletBox && walletTxt) {
                    activeCustomerWallet = { phone: matchedWalletDocId, points: pts, discountEGP: disc, useWallet: false };
                    walletTxt.textContent = `لديك ${pts} نقطة = خصم ${disc} ج.م`;
                    const cb = document.getElementById('checkout-wallet-toggle');
                    if (cb) cb.checked = false;
                    walletBox.classList.remove('hidden');
                } else {
                    if (walletBox) walletBox.classList.add('hidden');
                    activeCustomerWallet = { phone: '', points: 0, discountEGP: 0, useWallet: false };
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
            if (msgEl) msgEl.classList.add('hidden');
        }
    }

    // =========================================================================
    // 11. إتمام وتسجيل الطلب في Firebase (متوافق 100% مع الـ CRM وبدون Web3Forms)
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

        if (Object.keys(cart).length === 0) return showAlert('السلة فارغة', 'اختر صنفاً واحداً على الأقل قبل تأكيد الطلب.');
        if (customerName.length < 3 || !/^[\u0600-\u06FF\sA-Za-z.]+$/.test(customerName)) {
            return showAlert('الاسم غير مكتمل', 'يرجى كتابة الاسم الصحيح (3 أحرف على الأقل وبدون أرقام أو رموز).');
        }
        if (!/^01[0125][0-9]{8}$/.test(customerPhone)) {
            return showAlert('رقم الموبايل غير صحيح', 'يرجى كتابة رقم موبايل مصري صحيح مكون من 11 رقم (يبدأ بـ 010 أو 011 أو 012 أو 015).');
        }
        if (!selectedZone) return showAlert('منطقة التوصيل مطلوبة', 'يرجى اختيار منطقة التوصيل لحساب إجمالي الطلب.');

        if (appliedPromo && appliedPromo.customerPhone) {
            const locked = U.normalizePhone(appliedPromo.customerPhone).slice(-10);
            if (locked && locked !== customerPhone.slice(-10)) {
                return showAlert('تنبيه كود الخصم', 'عفواً، كود الخصم هذا مخصص لرقم هاتف آخر.');
            }
        }

        const cartIdsNow = Object.keys(cart);
        const hasQuailInCart = cartIdsNow.some((id) => getProductTrackType(id) === 'quail');
        const hasChicksInCart = cartIdsNow.some((id) => getProductTrackType(id) === 'chicks');

        let quailBatchId = document.getElementById('user-batch-select')?.value || '';
        let quailBatchName = (quailBatchId && globalBatches[quailBatchId]) ? (globalBatches[quailBatchId].name || '') : '';
        if (hasQuailInCart && !quailBatchId) {
            const firstOpenQ = getVisibleBatchesByTrack('quail').find((b) => b.isOpen);
            if (firstOpenQ) { quailBatchId = firstOpenQ.id; quailBatchName = firstOpenQ.name || ''; }
        }

        let chicksBatchId = document.getElementById('user-chicks-batch-select')?.value || '';
        let chicksBatchName = (chicksBatchId && globalBatches[chicksBatchId]) ? (globalBatches[chicksBatchId].name || '') : '';
        if (hasChicksInCart && !chicksBatchId) {
            const firstOpenC = getVisibleBatchesByTrack('chicks').find((b) => b.isOpen);
            if (firstOpenC) { chicksBatchId = firstOpenC.id; chicksBatchName = firstOpenC.name || ''; }
        }

        // السمان يرتبط بدفعة الذبح، والكتاكيت وحدها ترتبط بدورة التفريخ، والبيض/الفراخ وحدها طلب فوري مستقل
        let batchId = '';
        let batchName = '';
        if (hasQuailInCart && quailBatchId) {
            batchId = quailBatchId;
            batchName = quailBatchName;
        } else if (hasChicksInCart && chicksBatchId) {
            batchId = chicksBatchId;
            batchName = chicksBatchName;
        }


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
        const walletUsed = Boolean(
            activeCustomerWallet.useWallet &&
            activeCustomerWallet.points > 0 &&
            totalAfterPromo > 0 &&
            U.normalizePhone(activeCustomerWallet.phone) === customerPhone
        );
        const walletDiscount = walletUsed ? Math.min(activeCustomerWallet.discountEGP, totalAfterPromo) : 0;
        const walletPtsToDeduct = walletUsed ? activeCustomerWallet.points : 0;
        if (walletDiscount > 0) discountText += `🎁 خصم محفظة النقاط: -${walletDiscount} ج\n`;

        const totalDiscount = promoDiscount + walletDiscount;
        const freeDelivery = Boolean((globalSettings.freeDeliveryActive && totalAfterPromo >= (Number(globalSettings.freeDeliveryThreshold) || 0)) || (appliedPromo && appliedPromo.type === 'free_delivery'));
        const finalDelivery = freeDelivery ? 0 : deliveryFee;
        const finalTotal = Math.max(0, subTotal - totalDiscount + finalDelivery);

        const now = new Date();
        const orderDateEn = now.toLocaleDateString('en-US');
        const orderDateAr = now.toLocaleDateString('ar-EG');
        const orderTime = now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

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

        const orderItems = [];
        let itemsWaStr = '';
        Object.keys(cart).forEach((id) => {
            if (!productsInfo[id]) return;
            const item = cart[id];
            const lineTotal = Math.round(item.quantity * item.price);
            const cleanItemObj = { id, name: item.name, quantity: item.quantity, price: item.price };
            if (item.isWeightBased && Array.isArray(item.selectedWeightsGrams)) {
                cleanItemObj.isWeightBased = true;
                cleanItemObj.selectedWeightsGrams = item.selectedWeightsGrams;
            }
            orderItems.push(cleanItemObj);
            itemsWaStr += `▪ ${item.name}\n  └ ${item.quantity} × ${item.price} = ${lineTotal} ج.م\n`;
        });

        const notesChunks = [];
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
                    source: 'storefront_v4',
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                };

                await db.collection('orders').add(orderData);

                const batchOps = db.batch();
                batchOps.set(db.collection('inventory').doc('stats'), {
                    sales: firebase.firestore.FieldValue.increment(finalTotal),
                    orders: firebase.firestore.FieldValue.increment(1)
                }, { merge: true });

                const custUpdate = {
                    name: customerName,
                    phone: customerPhone,
                    zone: zoneName,
                    ordersCount: firebase.firestore.FieldValue.increment(1),
                    totalSpent: firebase.firestore.FieldValue.increment(finalTotal),
                    lastOrder: firebase.firestore.FieldValue.serverTimestamp()
                };
                if (customerAddress) custUpdate.address = customerAddress;
                if (walletUsed && walletPtsToDeduct > 0) {
                    custUpdate.walletPoints = firebase.firestore.FieldValue.increment(-walletPtsToDeduct);
                }
                batchOps.set(db.collection('customers').doc(customerPhone), custUpdate, { merge: true });

                const stockUpdates = {};
                const quailBookedUpdates = {};
                const chicksBookedUpdates = {};

                orderItems.forEach((it) => {
                    if (it.isWeightBased) return;
                    const trk = getProductTrackType(it.id);
                    stockUpdates[it.id] = firebase.firestore.FieldValue.increment(-it.quantity);
                    if (trk === 'quail' && quailBatchId) {
                        quailBookedUpdates[it.id] = firebase.firestore.FieldValue.increment(it.quantity);
                    } else if (trk === 'chicks' && chicksBatchId) {
                        chicksBookedUpdates[it.id] = firebase.firestore.FieldValue.increment(it.quantity);
                    }
                });

                if (Object.keys(stockUpdates).length > 0) {
                    batchOps.set(db.collection('inventory').doc('stock'), stockUpdates, { merge: true });
                }

                const batchesPayload = {};
                if (quailBatchId && Object.keys(quailBookedUpdates).length > 0) {
                    batchesPayload[quailBatchId] = { booked: quailBookedUpdates };
                }
                if (chicksBatchId && Object.keys(chicksBookedUpdates).length > 0) {
                    batchesPayload[chicksBatchId] = { booked: chicksBookedUpdates };
                }
                if (Object.keys(batchesPayload).length > 0) {
                    batchOps.set(db.collection('inventory').doc('batches'), batchesPayload, { merge: true });
                }

                if (promoUpdated) {
                    batchOps.set(db.collection('inventory').doc('settings'), {
                        promoCodes: globalSettings.promoCodes,
                        rewardMaxGenerations: globalSettings.rewardMaxGenerations
                    }, { merge: true });
                }

                await batchOps.commit();
            }

            saveLocalProfile(customerName, customerPhone, zoneName, customerAddress);
            sessionStorage.setItem('sman_last_order_ms', String(Date.now()));

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

            const waStoreNum = U.formatWaPhone(globalSettings.storePhone);
            window.currentOrderWaLink = `https://api.whatsapp.com/send?phone=${waStoreNum}&text=${encodeURIComponent(waMsg)}`;
            const interactiveTime = (batchId && globalBatches[batchId])
                ? window.getFriendlyBatchDatePhrase(globalBatches[batchId].deliveryStart, globalBatches[batchId].deliveryEnd)
                : '';

            showOrderSuccessModal({ customerName, customerPhone, batchName, interactiveTime, earnedLoyalty, newPromoCode });
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

        const bodyHtml = info.batchName
            ? `أوردرك اتسجل بنجاح في <strong class="text-brand-navy">${esc(info.batchName)}</strong>.<br>📦 موعد الاستلام المتوقع: <strong class="text-rose-600">${esc(info.interactiveTime)}</strong>.<br>هنتواصل معاك للتأكيد قبل التحرك!`
            : esc(uiTexts.successMsgTemplate || 'أوردرك اتسجل في السيستم عندنا خلاص وهيتم التجهيز والتواصل معاك للتأكيد.');

        const rewardHtml = (info.earnedLoyalty && info.newPromoCode)
            ? `<div class="bg-amber-50 border-2 border-dashed border-amber-300 p-3 rounded-xl my-2 text-center">
                   <span class="text-[11px] font-black text-amber-800 block">🎁 هديتك لطلبك القادم:</span>
                   <span class="font-black text-2xl text-brand-navy tracking-wider select-all block my-1">${esc(info.newPromoCode)}</span>
                   <button type="button" onclick="navigator.clipboard.writeText('${escAttr(info.newPromoCode)}'); this.textContent='✅ تم نسخ الكود';" class="bg-brand-navy text-white text-xs font-black px-4 py-1.5 rounded-lg">نسخ الكود</button>
               </div>`
            : '';

        const msgHTML = `
            <div dir="rtl" class="text-right space-y-3">
                <div class="text-center">
                    <div class="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto text-2xl shadow-sm">
                        <i class="fa-solid fa-check"></i>
                    </div>
                    <h3 class="font-black text-brand-navy mt-2 text-base">${titleText}</h3>
                    <p class="text-xs font-bold text-slate-500">شكراً لثقتك في سمان ههيا يا ${firstName} 🌿</p>
                </div>
                <div class="text-xs font-bold text-emerald-900 leading-relaxed bg-emerald-50 p-3 rounded-xl border border-emerald-200">${bodyHtml}</div>
                ${rewardHtml}
                <div class="flex flex-col gap-2">
                    <button type="button" onclick="closeAlert(); window.location.href='track.html?phone=${safePhone}';" class="w-full bg-brand-navy hover:opacity-95 text-white font-black py-3 px-4 rounded-xl flex justify-center items-center gap-2 shadow-md text-xs sm:text-sm">
                        <i class="fa-solid fa-route text-amber-400"></i> تتبع حالة طلبك الآن
                    </button>
                    <button type="button" onclick="closeAlert(); window.open(window.currentOrderWaLink, '_blank');" class="w-full bg-[#25D366] hover:bg-[#1ebd57] text-white font-black py-3 px-4 rounded-xl flex justify-center items-center gap-2 shadow-md text-xs sm:text-sm">
                        <i class="fa-brands fa-whatsapp text-lg"></i> ${esc(uiTexts.waFollowUpBtn || 'تأكيد ومتابعة عبر واتساب')}
                    </button>
                    <button type="button" onclick="closeAlert()" class="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-2.5 rounded-xl text-xs">
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
    // 12. التنبيهات وإشعارات المبيعات الحية
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
            msgEl.className = 'text-slate-600 mb-5 font-bold text-sm leading-relaxed whitespace-pre-wrap';
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
