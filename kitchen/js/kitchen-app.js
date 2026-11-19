// kitchen/js/kitchen-app.js - المحرك الكامل لمطبخ سمان ههيا (المكتبة، الحاسبة، وضع الطهي المباشر، المؤقتات، التقييمات، والربط الحي بالمتجر)

(function () {
    let kDb = null;
    let allRecipes = [];
    let allGuides = [];
    let liveStoreProducts = {};
    let liveStorePrices = {};
    let liveStoreStock = {};

    const state = {
        category: 'all',
        method: 'all',
        difficulty: 'all',
        time: 'all',
        search: '',
        productFilter: '',
        activeRecipe: null,
        activeServings: 4,
        checkedIngredients: {},
        selectedRating: 5,
        selectedSuccess: 'yes'
    };

    // حالة وضع الطهي المباشر والمؤقتات
    const cookState = {
        stepIdx: 0,
        timerSeconds: 0,
        timerRunning: false,
        timerInterval: null,
        wakeLock: null
    };

    let toastTimer = null;

    // بطاقات سلامة الغذاء المرجعية الاحتياطية (مطابقة 100% لملف الـ JSON ومراجع FDA/FoodSafety.gov)
    const DEFAULT_KNOWLEDGE_CARDS = [
        {
            id: 'guide_01',
            order: 1,
            icon: 'fa-hand-sparkles',
            title: 'التعامل الآمن مع السمان والرومي النيء',
            content: 'لا تغسل الدواجن النيئة؛ الرذاذ قد ينقل الملوثات إلى الحوض والأسطح. احفظ النيء منفصلًا عن الطعام الجاهز، واستخدم لوحًا وأدوات منفصلة أو اغسلها جيدًا بعد الاستخدام. اغسل اليدين قبل وبعد لمس النيء. انقع أو تبّل الدواجن داخل الثلاجة فقط.'
        },
        {
            id: 'guide_02',
            order: 2,
            icon: 'fa-snowflake',
            title: 'إذابة التجميد بطريقة آمنة',
            content: 'أفضل طريقة هي الإذابة داخل الثلاجة في وعاء يمنع تسرب السوائل. يمكن استخدام ماء بارد مع كيس محكم، أو الميكروويف مع الطهي مباشرة بعده. لا تترك الدواجن على رخامة المطبخ ولا تذبها في الماء الدافئ.'
        },
        {
            id: 'guide_03',
            order: 3,
            icon: 'fa-temperature-high',
            title: 'الحرارة الداخلية التي نعتمد عليها',
            content: 'كل الدواجن بما فيها السمان والرومي، والطيور المحشوة والحشو الداخلي: 74°م. أطباق البيض مثل الأومليت والفريتاتا: 71°م. البيض العادي يطهى حتى يتماسك البياض والصفار. القياس بترمومتر طعام في أسمك جزء بعيدًا عن العظم هو الحكم؛ اللون والوقت وحدهما لا يكفيان.'
        },
        {
            id: 'guide_04',
            order: 4,
            icon: 'fa-box-open',
            title: 'التبريد والتجميد وبقايا الطعام',
            content: 'اضبط الثلاجة على 4°م أو أقل والفريزر على -18°م أو أقل. برّد الأطعمة سريعة التلف خلال ساعتين، أو خلال ساعة إذا تجاوز الجو 32°م. قسّم الكميات الكبيرة في أوعية ضحلة. بقايا الدواجن المطهية غالبًا 3-4 أيام في الثلاجة، وعند إعادة التسخين تصل إلى 74°م.'
        },
        {
            id: 'guide_05',
            order: 5,
            icon: 'fa-certificate',
            title: 'معيار اعتماد الوصفات في سمان ههيا',
            content: 'كل وصفة لها حالتان منفصلتان: (أ) مراجعة المعلومات: المقادير والخطوات والسلامة راجعها محرر المحتوى. (ب) تجربة عملية: لا تُمنح إلا بعد طهي الوصفة فعليًا وتسجيل وزن المنتج وحالة الفرن أو الأداة والوقت والحرارة والصور والنتيجة. لا نكتب كلمة «مجرّبة» قبل الاختبار الفعلي.'
        }
    ];

    // دليل "ماذا لو حصلت مشكلة أثناء الطهي؟"
    const TROUBLESHOOT_ITEMS = [
        {
            id: 'dry',
            label: '🔥 السمان طلع ناشف',
            cause: 'زيادة مدة الطهي بعد الوصول لحرارة النضج، أو تكديس الصينية على حرارة غير مناسبة.',
            solution: 'راقب الحرارة الداخلية بترمومتر الطعام وأخرج السمان فور وصول أسمك جزء إلى 74°م، ثم اتركه يرتاح 3-5 دقائق قبل التقديم ليحتفظ بعصارته.'
        },
        {
            id: 'burn',
            label: '⚫ الجلد اتحمر قبل نضج الداخل',
            cause: 'نار عالية مباشرة (خاصة مع الفحم أو وجود عسل/دبس رمان من البداية).',
            solution: 'غطِّ الوجه بورق قصدير في الفرن أو انقل الطيور لمنطقة حرارة غير مباشرة على الشواية، ولا تدهن الصوصات السكرية إلا في آخر 8-12 دقيقة فقط.'
        },
        {
            id: 'stuffing',
            label: '🍚 الطائر نضج والحشو لم يصل 74°م',
            cause: 'ضغط الحشو بكثافة داخل التجويف أو استخدام حشو بارد جدًا مع طائر كبير.',
            solution: 'أخرج السمان حتى لا يجف، وانقل الحشو إلى طبق منفصل وأكمل تسخينه في الفرن حتى يصل مركز الحشو إلى 74°م على الأقل. وفي المرات القادمة احشُ التجويف بخفة قبل الخَبز مباشرة.'
        },
        {
            id: 'raw_bone',
            label: '🦴 اللحم غير ناضج قرب العظم',
            cause: 'الاعتماد على لون الجلد أو الوقت المطبوع فقط دون قياس الحرارة، أو إدخال الطائر باردًا جدًا أو مجمدًا جزئيًا.',
            solution: 'أعد الطائر فورًا للفرن أو الطاسة حتى يقرأ الترمومتر 74°م في أسمك جزء من الصدر والفخذ بعيدًا عن ملامسة العظم. لا تُقدّم أي دواجن قبل بلوغ 74°م.'
        },
        {
            id: 'egg_peel',
            label: '🥚 قشرة بيض السمان تتفتت في التقشير',
            cause: 'الغليان العنيف أو عدم نقل البيض لماء بارد مباشرة بعد السلق.',
            solution: 'اسلق البيض على غليان هادئ 3-5 دقائق حتى يتماسك البياض والصفار، ثم انقله فورًا إلى وعاء ماء بارد وثلج، بعدها لفّ البيضة برفق على سطح نظيف لتتشقق القشرة وتنزع بسهولة.'
        },
        {
            id: 'watery',
            label: '💧 الصوص أو الفريتاتا مائية',
            cause: 'إضافة خضار عالية الماء (مثل الطماطم ببذورها أو السبانخ بدون عصرها) أو ازدحام الطاسة أثناء التشويح.',
            solution: 'شوّح الدواجن على دفعات في طاسة واسعة، وصفِّ السبانخ والخيار جيدًا قبل الخلط، واترك صلصة الطماطم تتسبك قبل إضافة البيض.'
        }
    ];

    function esc(str) {
        return String(str === null || str === undefined ? '' : str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function escAttr(str) {
        return String(str === null || str === undefined ? '' : str)
            .replace(/\\/g, '\\\\')
            .replace(/'/g, "\\'")
            .replace(/"/g, '&quot;');
    }

    function showToast(text, iconCls = 'fa-circle-check text-emerald-400') {
        const el = document.getElementById('kitchen-toast');
        const txt = document.getElementById('kitchen-toast-text');
        const ico = document.getElementById('kitchen-toast-icon');
        if (!el || !txt) return;
        txt.textContent = text;
        if (ico) ico.className = `fa-solid ${iconCls} text-sm`;
        el.classList.remove('opacity-0', '-translate-y-4');
        el.classList.add('opacity-100', 'translate-y-0');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => {
            el.classList.remove('opacity-100', 'translate-y-0');
            el.classList.add('opacity-0', '-translate-y-4');
        }, 2400);
    }

    // =========================================================================
    // 1. التشغيل والاتصال الآمن بقاعدة البيانات (للقراءة فقط من المتجر + مجموعات المطبخ)
    // =========================================================================
    document.addEventListener('DOMContentLoaded', () => {
        renderTroubleshootButtons();
        readUrlParams();
        initKitchenFirebase();
        window.addEventListener('popstate', () => {
            readUrlParams();
            syncViewFromState();
        });
    });

    function readUrlParams() {
        const params = new URLSearchParams(window.location.search);
        const pFilter = params.get('product') || '';
        const catParam = params.get('cat') || '';
        const recipeParam = params.get('recipe') || '';

        state.productFilter = pFilter;
        if (catParam) state.category = catParam;
        state.pendingRecipeId = recipeParam;
    }

    function initKitchenFirebase() {
        try {
            const cfg = (typeof FIREBASE_CONFIG !== 'undefined') ? FIREBASE_CONFIG : window.FIREBASE_CONFIG;
            if (!cfg) {
                renderGuides(DEFAULT_KNOWLEDGE_CARDS);
                renderRecipesGrid();
                return;
            }
            if (!firebase.apps.length) {
                firebase.initializeApp(cfg);
            }
            kDb = firebase.firestore();
            loadKitchenData();
        } catch (e) {
            console.error('Kitchen Firebase Init Error:', e);
            renderGuides(DEFAULT_KNOWLEDGE_CARDS);
            renderRecipesGrid();
        }
    }

    async function loadKitchenData() {
        if (!kDb) return;
        try {
            const [recipesSnap, guidesSnap, settingsDoc, pricesDoc, stockDoc] = await Promise.all([
                kDb.collection('kitchen_recipes').where('publishStatus', '==', 'published').get().catch(() => null),
                kDb.collection('kitchen_guides').get().catch(() => null),
                kDb.collection('inventory').doc('settings').get().catch(() => null),
                kDb.collection('inventory').doc('prices').get().catch(() => null),
                kDb.collection('inventory').doc('stock').get().catch(() => null)
            ]);

            allRecipes = [];
            if (recipesSnap && !recipesSnap.empty) {
                recipesSnap.forEach((doc) => {
                    const d = doc.data() || {};
                    allRecipes.push({ ...d, id: d.id || doc.id });
                });
                allRecipes.sort((a, b) => (Number(a.number) || 999) - (Number(b.number) || 999));
            }

            allGuides = [];
            if (guidesSnap && !guidesSnap.empty) {
                guidesSnap.forEach((doc) => {
                    allGuides.push({ id: doc.id, ...(doc.data() || {}) });
                });
                allGuides.sort((a, b) => (Number(a.order) || 99) - (Number(b.order) || 99));
            }
            if (allGuides.length === 0) allGuides = DEFAULT_KNOWLEDGE_CARDS;

            if (settingsDoc && settingsDoc.exists) {
                const sData = settingsDoc.data() || {};
                if (sData.productsData && typeof sData.productsData === 'object') {
                    liveStoreProducts = sData.productsData;
                }
            }
            if (pricesDoc && pricesDoc.exists) liveStorePrices = pricesDoc.data() || {};
            if (stockDoc && stockDoc.exists) liveStoreStock = stockDoc.data() || {};

            const countEl = document.getElementById('k-stat-count');
            if (countEl) countEl.textContent = allRecipes.length;

            renderGuides(allGuides);
            updateCategoryPillsUI();
            syncViewFromState();
        } catch (err) {
            console.error('Kitchen Load Error:', err);
            renderGuides(DEFAULT_KNOWLEDGE_CARDS);
            renderRecipesGrid();
        }
    }

    function syncViewFromState() {
        if (state.pendingRecipeId) {
            const found = allRecipes.find((r) => r.id === state.pendingRecipeId || r.slug === state.pendingRecipeId);
            if (found) {
                openRecipeDetailInternal(found, false);
                return;
            }
        }
        showHomeInternal(false);
    }

    // =========================================================================
    // 2. الربط الذكي بين كل وصفة وأصناف «سمان ههيا» الحية في المتجر
    // =========================================================================
    function getRecommendedProductsForRecipe(recipe) {
        const prodKeys = Object.keys(liveStoreProducts).filter((id) => {
            const p = liveStoreProducts[id];
            return p && !p.isHidden && p.isVisible !== false;
        });
        if (prodKeys.length === 0) return [];

        // 1. إذا حددت الإدارة أصنافاً معينة للوصفة من لوحة التحكم
        if (Array.isArray(recipe.recommendedProductIds) && recipe.recommendedProductIds.length > 0) {
            return recipe.recommendedProductIds
                .filter((id) => liveStoreProducts[id] && !liveStoreProducts[id].isHidden)
                .map((id) => formatLiveProd(id));
        }

        // 2. الربط الذكي التلقائي حسب التصنيف واسم الوصفة
        const cat = String(recipe.category || '');
        const title = String(recipe.title || '');
        const equip = String(recipe.equipment || '');
        const matchedIds = [];

        if (cat.includes('بيض السمان')) {
            prodKeys.forEach((id) => {
                const nm = String(liveStoreProducts[id].name || '').toLowerCase();
                if (id === 'eggs' || nm.includes('بيض')) matchedIds.push(id);
            });
        } else if (cat.includes('الرومي')) {
            prodKeys.forEach((id) => {
                const nm = String(liveStoreProducts[id].name || '').toLowerCase();
                if (nm.includes('رومي')) matchedIds.push(id);
            });
        } else if (cat.includes('وصفات السمان')) {
            const isStuffOrFeast = title.includes('محشي') || title.includes('فريك') || title.includes('برياني') || title.includes('طاجن') || title.includes('ملوخية');
            const isQuickGrill = title.includes('مشوي') || title.includes('قلاية') || title.includes('طاسة') || equip.includes('قلاية') || equip.includes('شواية');

            prodKeys.forEach((id) => {
                const sId = id.toLowerCase();
                const nm = String(liveStoreProducts[id].name || '').toLowerCase();
                if (liveStoreProducts[id].isWeightBased || sId === 'eggs' || sId === 'chicks' || nm.includes('بيض') || nm.includes('كتكوت')) return;

                if (isStuffOrFeast) {
                    if (sId === 'special' || sId === 'superspecial' || sId === 'jumbo' || nm.includes('سبشيال') || nm.includes('جامبو')) matchedIds.push(id);
                } else if (isQuickGrill) {
                    if (sId === 'super' || sId === 'jumbo' || (nm.includes('سوبر') && !nm.includes('سبشيال')) || nm.includes('جامبو')) matchedIds.push(id);
                } else {
                    if (sId === 'jumbo' || sId === 'special' || nm.includes('جامبو') || nm.includes('سبشيال')) matchedIds.push(id);
                }
            });
        }

        return matchedIds.slice(0, 3).map((id) => formatLiveProd(id));
    }

    function formatLiveProd(id) {
        const p = liveStoreProducts[id] || {};
        const price = Number(liveStorePrices[id] !== undefined ? liveStorePrices[id] : p.basePrice) || 0;
        const stock = Number(liveStoreStock[id]) || 0;
        return {
            id,
            name: p.name || id,
            weight: p.weight || '',
            price,
            stock,
            isWeightBased: Boolean(p.isWeightBased),
            image: (Array.isArray(p.images) && p.images[0]) ? p.images[0] : ''
        };
    }

    // =========================================================================
    // 3. البحث والفلاتر ورسم مكتبة الوصفات
    // =========================================================================
    function getNumericCookMinutes(cookStr) {
        const s = String(cookStr || '');
        if (s.includes('بدون طهي')) return 0;
        if (s.includes('ساعة') || s.includes('ساعات')) return 120;
        const m = s.match(/(\d+)/);
        return m ? parseInt(m[1], 10) : 30;
    }

    function recipeMatchesMethod(recipe, methodKey) {
        if (methodKey === 'all') return true;
        const hay = `${recipe.title || ''} ${recipe.equipment || ''} ${recipe.cook_minutes_estimate || ''}`.toLowerCase();
        if (methodKey === 'بدون طهي') return hay.includes('بدون طهي');
        if (methodKey === 'فرن') return hay.includes('فرن') || hay.includes('صينية') || hay.includes('قالب');
        if (methodKey === 'شواية') return hay.includes('شواية') || hay.includes('فحم') || hay.includes('جريل');
        if (methodKey === 'طاسة') return hay.includes('طاسة') || hay.includes('ووك');
        if (methodKey === 'حلة') return hay.includes('حلة') || hay.includes('طاجن') || hay.includes('شوربة');
        if (methodKey === 'قلاية هوائية') return hay.includes('قلاية هوائية');
        return true;
    }

    function recipeMatchesProductFilter(recipe, prodFilterKey) {
        if (!prodFilterKey) return true;
        const k = String(prodFilterKey).toLowerCase();
        const cat = String(recipe.category || '');
        const title = String(recipe.title || '');
        if (k === 'eggs' || k.includes('بيض')) return cat.includes('بيض السمان');
        if (k.includes('رومي') || k.includes('turkey')) return cat.includes('الرومي');
        if (k === 'super') return cat.includes('وصفات السمان') && (title.includes('مشوي') || title.includes('قلاية') || title.includes('طاسة') || title.includes('فرن') || title.includes('مقرمش'));
        if (k === 'special' || k === 'superspecial') return cat.includes('وصفات السمان') && (title.includes('محشي') || title.includes('فريك') || title.includes('طاجن') || title.includes('صينية') || title.includes('برياني') || title.includes('ملوخية') || title.includes('فرن'));
        return cat.includes('وصفات السمان');
    }

    window.kitchenSetCategory = function (cat) {
        state.category = cat || 'all';
        updateCategoryPillsUI();
        renderRecipesGrid();
    };

    function updateCategoryPillsUI() {
        document.querySelectorAll('#kitchen-category-pills .kitchen-pill').forEach((btn) => {
            const isAct = btn.getAttribute('data-cat') === state.category;
            btn.className = `kitchen-pill px-3.5 py-2 rounded-xl text-xs font-black border ${
                isAct ? 'active' : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-brand-navy/40'
            }`;
        });
    }

    window.kitchenHandleSearch = function (val) {
        state.search = String(val || '').trim().toLowerCase();
        renderRecipesGrid();
    };

    window.kitchenApplyFilters = function () {
        state.method = document.getElementById('kitchen-filter-method')?.value || 'all';
        state.difficulty = document.getElementById('kitchen-filter-difficulty')?.value || 'all';
        state.time = document.getElementById('kitchen-filter-time')?.value || 'all';
        renderRecipesGrid();
    };

    window.kitchenResetAllFilters = function () {
        state.category = 'all';
        state.method = 'all';
        state.difficulty = 'all';
        state.time = 'all';
        state.search = '';
        state.productFilter = '';
        const sInp = document.getElementById('kitchen-search-input');
        if (sInp) sInp.value = '';
        if (document.getElementById('kitchen-filter-method')) document.getElementById('kitchen-filter-method').value = 'all';
        if (document.getElementById('kitchen-filter-difficulty')) document.getElementById('kitchen-filter-difficulty').value = 'all';
        if (document.getElementById('kitchen-filter-time')) document.getElementById('kitchen-filter-time').value = 'all';
        updateCategoryPillsUI();
        renderRecipesGrid();
    };

    window.kitchenClearProductFilter = function () {
        state.productFilter = '';
        try {
            const url = new URL(window.location.href);
            url.searchParams.delete('product');
            history.replaceState({}, '', url.toString());
        } catch (e) {}
        renderRecipesGrid();
    };

    function getCategoryIcon(cat) {
        if (String(cat).includes('بيض')) return '🥚';
        if (String(cat).includes('الرومي')) return '🦃';
        if (String(cat).includes('جانبية')) return '🍚';
        if (String(cat).includes('صلصات')) return '🥣';
        return '🥩';
    }

    function renderRecipesGrid() {
        const grid = document.getElementById('kitchen-recipes-grid');
        const countBadge = document.getElementById('kitchen-results-count');
        const pBanner = document.getElementById('kitchen-product-filter-banner');
        const pBannerTxt = document.getElementById('kitchen-product-filter-text');
        if (!grid) return;

        if (pBanner) {
            if (state.productFilter) {
                const pName = liveStoreProducts[state.productFilter]?.name || state.productFilter;
                if (pBannerTxt) pBannerTxt.textContent = `الوصفات المقترحة لصنف: ${pName}`;
                pBanner.classList.remove('hidden');
            } else {
                pBanner.classList.add('hidden');
            }
        }

        // حالة عدم نشر أي وصفة بعد (جميع الوصفات لا تزال مسودات تحت مراجعة الإدارة)
        if (allRecipes.length === 0) {
            if (countBadge) countBadge.textContent = 'قريباً';
            grid.innerHTML = `
                <div class="col-span-full bg-white rounded-3xl p-7 sm:p-10 text-center border-2 border-dashed border-emerald-200 space-y-3">
                    <div class="w-16 h-16 rounded-2xl bg-emerald-50 text-brand-navy flex items-center justify-center text-3xl mx-auto">
                        <i class="fa-solid fa-hat-chef fa-fire-burner"></i>
                    </div>
                    <h3 class="text-base sm:text-lg font-black text-brand-navy">مطبخ سمان ههيا يتم تجهيزه بعناية</h3>
                    <p class="text-xs sm:text-sm font-bold text-slate-500 max-w-md mx-auto leading-relaxed">
                        تقوم الإدارة حالياً بمراجعة واعتماد أول دفعة من الوصفات قبل نشرها لضمان أعلى دقة. يمكنك تصفح أساسيات سلامة الغذاء بالأسفل أو العودة لطلب السمان الطازج من المتجر.
                    </p>
                    <div class="pt-2 flex flex-wrap justify-center gap-2">
                        <a href="../index.html" class="bg-brand-navy text-white px-5 py-2.5 rounded-xl text-xs font-black shadow-md">تصفح متجر سمان ههيا 🛒</a>
                        <button type="button" onclick="window.kitchenScrollToSafety()" class="bg-amber-50 text-amber-900 border border-amber-200 px-5 py-2.5 rounded-xl text-xs font-black">قواعد سلامة الغذاء 🛡️</button>
                    </div>
                </div>`;
            return;
        }

        const filtered = allRecipes.filter((r) => {
            if (state.category !== 'all' && r.category !== state.category) return false;
            if (!recipeMatchesMethod(r, state.method)) return false;
            if (state.difficulty !== 'all' && r.difficulty !== state.difficulty) return false;
            if (!recipeMatchesProductFilter(r, state.productFilter)) return false;

            if (state.time !== 'all') {
                const mins = getNumericCookMinutes(r.cook_minutes_estimate);
                if (state.time === 'quick' && mins > 20) return false;
                if (state.time === 'medium' && (mins <= 20 || mins > 45)) return false;
                if (state.time === 'feast' && mins < 35) return false;
            }

            if (state.search) {
                const hay = [
                    r.id, r.title, r.intro, r.category, r.equipment,
                    ...(Array.isArray(r.ingredients) ? r.ingredients : [])
                ].join(' ').toLowerCase();
                if (!hay.includes(state.search)) return false;
            }
            return true;
        });

        if (countBadge) countBadge.textContent = `${filtered.length} وصفة`;

        if (filtered.length === 0) {
            grid.innerHTML = `
                <div class="col-span-full bg-white rounded-3xl p-8 text-center border border-dashed border-slate-200 space-y-2.5">
                    <p class="text-sm font-black text-slate-600">لا توجد وصفات تطابق اختيارات البحث الحالية.</p>
                    <button type="button" onclick="window.kitchenResetAllFilters()" class="bg-brand-navy text-white px-4 py-2 rounded-xl text-xs font-black">عرض كل الوصفات المتاحة</button>
                </div>`;
            return;
        }

        grid.innerHTML = filtered.map((r) => {
            const isTested = r.verificationStatus === 'practically_tested';
            const badgeHtml = isTested
                ? `<span class="bg-emerald-600 text-white text-[10px] font-black px-2 py-0.5 rounded-lg shadow">✅ مجرّبة عملياً</span>`
                : `<span class="bg-amber-400/95 text-[#0b261c] text-[10px] font-black px-2 py-0.5 rounded-lg shadow">📋 مراجعة إرشادياً</span>`;

            const hasImg = Boolean(r.image_url && String(r.image_url).trim());
            const coverHtml = hasImg
                ? `<img loading="lazy" src="${esc(r.image_url)}" alt="${esc(r.image_alt_ar || r.title)}" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" onerror="this.parentElement.innerHTML='<div class=&quot;w-full h-full kitchen-cover-placeholder flex flex-col items-center justify-center text-white p-4 text-center&quot;><span class=&quot;text-4xl mb-1&quot;>${getCategoryIcon(r.category)}</span><span class=&quot;text-[11px] font-black text-amber-300&quot;>${esc(r.category)}</span></div>'">`
                : `<div class="w-full h-full kitchen-cover-placeholder flex flex-col items-center justify-center text-white p-4 text-center">
                        <span class="text-4xl mb-1.5 relative z-10">${getCategoryIcon(r.category)}</span>
                        <span class="text-[11px] font-black text-amber-300 relative z-10">${esc(r.category || 'مطبخ سمان ههيا')}</span>
                        <span class="text-[9px] font-bold text-emerald-200/80 mt-0.5 relative z-10" dir="ltr">${esc(r.id)}</span>
                   </div>`;

            const ratingHtml = (Number(r.ratingCount) > 0 && Number(r.ratingAvg) > 0)
                ? `<span class="text-[10px] font-black text-amber-600 flex items-center gap-0.5"><i class="fa-solid fa-star"></i> ${Number(r.ratingAvg).toFixed(1)} (${r.ratingCount})</span>`
                : '';

            return `
            <article onclick="window.kitchenOpenRecipe('${escAttr(r.id)}')" class="kitchen-card rounded-3xl p-2.5 flex flex-col justify-between cursor-pointer group">
                <div>
                    <div class="relative h-44 rounded-2xl overflow-hidden bg-slate-100">
                        ${coverHtml}
                        <div class="absolute top-2.5 right-2.5 flex items-center gap-1.5 z-10">
                            ${badgeHtml}
                        </div>
                        <span class="absolute bottom-2.5 right-2.5 bg-black/65 backdrop-blur-sm text-white text-[10px] font-black px-2.5 py-0.5 rounded-lg z-10">
                            ${getCategoryIcon(r.category)} ${esc(r.category)}
                        </span>
                        ${hasImg && !isTested ? `<span class="absolute bottom-2.5 left-2.5 bg-black/55 text-white/90 text-[9px] font-bold px-2 py-0.5 rounded-md z-10">صورة توضيحية</span>` : ''}
                    </div>

                    <div class="p-2 pt-3 space-y-1.5">
                        <div class="flex items-start justify-between gap-2">
                            <h3 class="text-sm sm:text-base font-black text-brand-navy leading-snug group-hover:text-emerald-700 transition-colors">${esc(r.title)}</h3>
                            ${ratingHtml}
                        </div>
                        <p class="text-[11px] font-bold text-slate-500 line-clamp-2 leading-relaxed">${esc(r.intro || '')}</p>
                    </div>
                </div>

                <div class="px-2 pt-2.5 pb-1 mt-1 border-t border-slate-100 flex items-center justify-between gap-2 text-[10px] font-black text-slate-600">
                    <div class="flex items-center gap-2.5 flex-wrap">
                        <span><i class="fa-regular fa-clock text-amber-500 ml-1"></i>${esc(r.cook_minutes_estimate || 'تقديري')}</span>
                        <span><i class="fa-solid fa-users text-emerald-600 ml-1"></i>${Number(r.servings) || 4} أفراد</span>
                        <span><i class="fa-solid fa-signal text-indigo-500 ml-1"></i>${esc(r.difficulty || 'سهل')}</span>
                    </div>
                    <span class="text-brand-navy font-black shrink-0">عرض ⬅️</span>
                </div>
            </article>`;
        }).join('');
    }

    // =========================================================================
    // 4. الصفحة التفصيلية للوصفة + حاسبة المقادير الذكية
    // =========================================================================
    window.kitchenOpenRecipe = function (recipeId) {
        const found = allRecipes.find((r) => r.id === recipeId);
        if (!found) return;
        openRecipeDetailInternal(found, true);
    };

    function openRecipeDetailInternal(recipe, pushHistory) {
        state.activeRecipe = recipe;
        state.activeServings = Number(recipe.servings) || 4;
        state.checkedIngredients = {};
        state.selectedRating = 5;
        state.selectedSuccess = 'yes';

        document.getElementById('kitchen-home-view')?.classList.add('hidden');
        document.getElementById('kitchen-detail-view')?.classList.remove('hidden');

        if (pushHistory) {
            try {
                const url = new URL(window.location.href);
                url.searchParams.set('recipe', recipe.id);
                history.pushState({ recipe: recipe.id }, '', url.toString());
            } catch (e) {}
        }

        renderRecipeDetail();
        loadApprovedFeedback(recipe.id);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    window.kitchenShowHome = function () {
        showHomeInternal(true);
    };

    function showHomeInternal(pushHistory) {
        state.activeRecipe = null;
        state.pendingRecipeId = '';
        document.getElementById('kitchen-detail-view')?.classList.add('hidden');
        document.getElementById('kitchen-home-view')?.classList.remove('hidden');
        if (pushHistory) {
            try {
                const url = new URL(window.location.href);
                url.searchParams.delete('recipe');
                history.pushState({}, '', url.toString());
            } catch (e) {}
        }
        renderRecipesGrid();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    window.kitchenScrollToSafety = function () {
        if (state.activeRecipe) showHomeInternal(true);
        setTimeout(() => {
            document.getElementById('kitchen-safety-school')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 80);
    };

    // محلل وحاسبة المقادير الذكية (تحافظ على النصوص العربية الأصلية ولا تعدّل أوقات النقع أو مقاسات السنتيمتر)
    function scaleIngredientText(text, baseServings, targetServings) {
        const base = Number(baseServings) || 1;
        const target = Number(targetServings) || base;
        if (base === target) return String(text || '');
        const ratio = target / base;

        const fmt = (num) => {
            const val = num * ratio;
            if (val >= 10) return String(Math.round(val));
            const rounded = Math.round(val * 10) / 10;
            return Number.isInteger(rounded) ? String(rounded) : String(rounded);
        };

        return String(text || '').replace(/(\d+(?:\.\d+)?)(?:\s*-\s*(\d+(?:\.\d+)?))?(?!\s*(?:سم|°م|°|درجة|دقيقة|دقائق|ساعة|ساعات|ثانية|ثوان))/g, (match, n1, n2) => {
            const a = parseFloat(n1);
            if (isNaN(a)) return match;
            if (n2 !== undefined) {
                const b = parseFloat(n2);
                if (!isNaN(b)) return `${fmt(a)}-${fmt(b)}`;
            }
            return fmt(a);
        });
    }

    function extractMinutesFromStep(stepText) {
        const s = String(stepText || '');
        const minMatch = s.match(/(\d+)(?:\s*-\s*\d+)?\s*(?:دقيقة|دقائق)/);
        if (minMatch) {
            const mins = parseInt(minMatch[1], 10);
            if (mins > 0 && mins <= 240) return mins;
        }
        const hourMatch = s.match(/(\d+)(?:\s*-\s*\d+)?\s*(?:ساعة|ساعات)/);
        if (hourMatch) {
            const hrs = parseInt(hourMatch[1], 10);
            if (hrs > 0 && hrs <= 5) return hrs * 60;
        }
        if (s.includes('ساعتين')) return 120;
        return null;
    }

    window.kitchenStepServings = function (delta) {
        state.activeServings = Math.max(1, Math.min(30, state.activeServings + delta));
        renderIngredientsListOnly();
    };

    window.kitchenResetServings = function () {
        if (!state.activeRecipe) return;
        state.activeServings = Number(state.activeRecipe.servings) || 4;
        renderIngredientsListOnly();
    };

    window.kitchenToggleIngredientCheck = function (idx) {
        state.checkedIngredients[idx] = !state.checkedIngredients[idx];
        renderIngredientsListOnly();
    };

    function renderIngredientsListOnly() {
        const r = state.activeRecipe;
        if (!r) return;
        const valEl = document.getElementById('detail-servings-val');
        const listEl = document.getElementById('detail-ingredients-list');
        if (valEl) valEl.textContent = state.activeServings;
        if (!listEl) return;

        const baseServ = Number(r.servings) || 4;
        const ings = Array.isArray(r.ingredients) ? r.ingredients : [];

        listEl.innerHTML = ings.map((raw, idx) => {
            const scaled = scaleIngredientText(raw, baseServ, state.activeServings);
            const isChk = Boolean(state.checkedIngredients[idx]);
            return `
                <label class="ingredient-check-item ${isChk ? 'checked' : ''} flex items-start gap-2.5 p-2.5 rounded-xl border border-slate-200/80 bg-slate-50/70 cursor-pointer text-xs sm:text-sm font-bold text-slate-800 transition-all">
                    <input type="checkbox" ${isChk ? 'checked' : ''} onchange="window.kitchenToggleIngredientCheck(${idx})" class="w-4 h-4 mt-0.5 accent-emerald-700 rounded shrink-0">
                    <span class="leading-snug">${esc(scaled)}</span>
                </label>`;
        }).join('');
    }

    function renderRecipeDetail() {
        const r = state.activeRecipe;
        const body = document.getElementById('kitchen-recipe-detail-body');
        if (!r || !body) return;

        const isTested = r.verificationStatus === 'practically_tested';
        const hasImg = Boolean(r.image_url && String(r.image_url).trim());
        const recProds = getRecommendedProductsForRecipe(r);

        const coverHtml = hasImg
            ? `<div class="relative h-60 sm:h-80 rounded-3xl overflow-hidden bg-slate-900">
                    <img src="${esc(r.image_url)}" alt="${esc(r.image_alt_ar || r.title)}" class="w-full h-full object-cover">
                    ${!isTested ? `<span class="absolute bottom-3 left-3 bg-black/65 text-white text-[10px] font-bold px-2.5 py-1 rounded-xl backdrop-blur-sm">صورة توضيحية للطبق</span>` : ''}
               </div>`
            : `<div class="h-48 sm:h-56 rounded-3xl kitchen-cover-placeholder flex flex-col items-center justify-center text-white p-6 text-center">
                    <span class="text-5xl mb-2 relative z-10">${getCategoryIcon(r.category)}</span>
                    <span class="text-sm font-black text-amber-300 relative z-10">${esc(r.category)}</span>
                    <span class="text-[11px] font-bold text-emerald-200/85 mt-1 relative z-10">لم تُضف صورة الطبق بعد — المحتوى والمقادير جاهزة للتطبيق</span>
               </div>`;

        const statusCardHtml = isTested
            ? `<div class="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 text-xs font-bold text-emerald-950 flex flex-wrap items-center justify-between gap-2">
                    <span><strong class="text-emerald-700">✅ وصفة مجرّبة ومعتمدة عملياً في مطبخ سمان ههيا</strong></span>
                    ${r.practicalTestLog?.testedAt ? `<span class="text-[10px] bg-white px-2.5 py-1 rounded-lg border border-emerald-200">تاريخ الاختبار: ${esc(r.practicalTestLog.testedAt)} ${r.practicalTestLog.reviewer ? '• المراجع: ' + esc(r.practicalTestLog.reviewer) : ''}</span>` : ''}
               </div>`
            : `<div class="bg-amber-50 border border-amber-200 rounded-2xl p-3 text-xs font-bold text-amber-950 flex items-start gap-2">
                    <i class="fa-solid fa-circle-info text-amber-600 mt-0.5 shrink-0"></i>
                    <span>${esc(r.editorial_status || 'محتوى مُراجع إرشادياً وفق قواعد سلامة الغذاء؛ لم يُوسم بعد كوصفة مجرّبة عملياً.')}</span>
               </div>`;

        const storeProductsHtml = recProds.length > 0 ? `
            <div class="bg-gradient-to-l from-[#0f3426] to-[#1b4332] text-white rounded-3xl p-4 shadow-md space-y-3">
                <div class="flex items-center justify-between gap-2">
                    <h3 class="text-xs sm:text-sm font-black text-amber-300 flex items-center gap-1.5">
                        <i class="fa-solid fa-kiwi-bird"></i> الأصناف الأنسب لهذه الوصفة من متجر سمان ههيا
                    </h3>
                    <a href="../index.html#products" class="text-[11px] font-black bg-amber-400 text-[#0b261c] px-3 py-1 rounded-xl shrink-0">افتح المتجر 🛒</a>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    ${recProds.map((p) => `
                        <a href="../index.html#products" class="bg-white/10 hover:bg-white/15 border border-white/15 rounded-2xl p-2.5 flex items-center justify-between gap-2 transition-colors">
                            <div class="min-w-0">
                                <span class="block text-xs font-black text-white truncate">${esc(p.name)}</span>
                                <span class="block text-[10px] font-bold text-emerald-200/85 truncate">${esc(p.weight || (p.isWeightBased ? 'بالوزن الدقيق' : 'طازج بالطلب'))}</span>
                            </div>
                            <span class="bg-amber-400 text-[#0b261c] px-2 py-1 rounded-xl text-xs font-black shrink-0">${p.price} ج</span>
                        </a>`).join('')}
                </div>
            </div>` : '';

        const steps = Array.isArray(r.steps) ? r.steps : [];
        const stepsHtml = steps.map((stText, idx) => {
            const detectedMins = extractMinutesFromStep(stText);
            return `
                <div class="step-row-card bg-white border border-slate-200/90 rounded-2xl p-3.5 flex items-start gap-3">
                    <span class="w-8 h-8 rounded-xl bg-brand-navy text-amber-300 font-black text-xs flex items-center justify-center shrink-0 shadow-sm">${idx + 1}</span>
                    <div class="flex-1 min-w-0 space-y-2">
                        <p class="text-xs sm:text-sm font-bold text-slate-800 leading-relaxed">${esc(stText)}</p>
                        <div class="flex flex-wrap items-center gap-1.5">
                            ${detectedMins ? `
                                <button type="button" onclick="window.kitchenStartStepTimerFromDetail(${idx}, ${detectedMins})" class="bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 px-2.5 py-1 rounded-xl text-[11px] font-black inline-flex items-center gap-1">
                                    <i class="fa-solid fa-stopwatch text-amber-600"></i> مؤقت ${detectedMins} دقيقة
                                </button>` : ''}
                            <button type="button" onclick="window.kitchenOpenCookMode(${idx})" class="bg-slate-50 hover:bg-emerald-50 text-slate-600 hover:text-brand-navy border border-slate-200 px-2.5 py-1 rounded-xl text-[11px] font-black inline-flex items-center gap-1">
                                <i class="fa-solid fa-expand text-[10px]"></i> افتح في وضع الطهي
                            </button>
                        </div>
                    </div>
                </div>`;
        }).join('');

        // القيم الغذائية: التزام صارم بعدم اختراع أرقام غير محسوبة
        const hasVerifiedNutrition = Boolean(r.nutrition && r.nutrition.status === 'verified' && r.nutrition.calories);
        const nutritionHtml = hasVerifiedNutrition
            ? `<p class="text-xs font-bold text-slate-700">تقدير الحصة الواحدة: ${esc(r.nutrition.summary || '')}</p>`
            : `<p class="text-xs font-bold text-slate-500">${esc(r.nutrition?.note || 'القيم الغذائية غير محسوبة بعد — لا نعرض أرقاماً تقديرية غير محسوبة من المقادير الفعلية ومصادر غذائية موثوقة.')}</p>`;

        body.innerHTML = `
            <!-- رأس الوصفة -->
            <div class="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/80 shadow-sm space-y-4">
                ${coverHtml}
                <div class="space-y-2">
                    <div class="flex flex-wrap items-center gap-2 text-[11px] font-black">
                        <span class="bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-0.5 rounded-lg">${getCategoryIcon(r.category)} ${esc(r.category)}</span>
                        <span class="bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-lg" dir="ltr">${esc(r.id)}</span>
                    </div>
                    <h1 class="text-xl sm:text-2xl font-black text-brand-navy leading-snug">${esc(r.title)}</h1>
                    <p class="text-xs sm:text-sm font-bold text-slate-600 leading-relaxed">${esc(r.intro || '')}</p>
                </div>

                ${statusCardHtml}

                <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                    <div class="bg-[#faf8f3] border border-slate-200/80 rounded-2xl p-2.5 text-center">
                        <span class="text-[10px] font-bold text-slate-400 block">التحضير</span>
                        <span class="text-xs font-black text-brand-navy">${esc(r.prep_minutes || '-')}</span>
                    </div>
                    <div class="bg-[#faf8f3] border border-slate-200/80 rounded-2xl p-2.5 text-center">
                        <span class="text-[10px] font-bold text-slate-400 block">الطهي (تقديري)</span>
                        <span class="text-xs font-black text-brand-navy">${esc(r.cook_minutes_estimate || '-')}</span>
                    </div>
                    <div class="bg-[#faf8f3] border border-slate-200/80 rounded-2xl p-2.5 text-center">
                        <span class="text-[10px] font-bold text-slate-400 block">المستوى</span>
                        <span class="text-xs font-black text-brand-navy">${esc(r.difficulty || 'سهل')}</span>
                    </div>
                    <div class="bg-[#faf8f3] border border-slate-200/80 rounded-2xl p-2.5 text-center">
                        <span class="text-[10px] font-bold text-slate-400 block">الأدوات</span>
                        <span class="text-[11px] font-black text-brand-navy line-clamp-2">${esc(r.equipment || '-')}</span>
                    </div>
                </div>
            </div>

            ${storeProductsHtml}

            <!-- حاسبة المقادير التفاعلية -->
            <div class="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/80 shadow-sm space-y-3.5">
                <div class="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
                    <div>
                        <h2 class="text-base font-black text-brand-navy flex items-center gap-1.5">
                            <i class="fa-solid fa-scale-balanced text-amber-500"></i> المقادير وحاسبة الأفراد
                        </h2>
                        <p class="text-[11px] font-bold text-slate-500">غيّر عدد الأفراد لإعادة حساب الجرامات تلقائياً، وعلّم على ما جهّزته</p>
                    </div>
                    <div class="flex items-center gap-1.5 bg-[#faf8f3] border border-slate-200 p-1 rounded-2xl">
                        <button type="button" onclick="window.kitchenStepServings(-1)" class="w-8 h-8 rounded-xl bg-white border border-slate-200 font-black text-slate-700 hover:bg-rose-500 hover:text-white">-</button>
                        <span class="px-2 text-xs font-black text-brand-navy"><strong id="detail-servings-val" class="text-base">${state.activeServings}</strong> أفراد</span>
                        <button type="button" onclick="window.kitchenStepServings(1)" class="w-8 h-8 rounded-xl bg-brand-navy text-white font-black">+</button>
                        <button type="button" onclick="window.kitchenResetServings()" title="العودة للأصل" class="px-2 h-8 rounded-xl text-[10px] font-black text-slate-500 hover:text-brand-navy">أصل (${Number(r.servings) || 4})</button>
                    </div>
                </div>

                <div id="detail-ingredients-list" class="grid grid-cols-1 sm:grid-cols-2 gap-2"></div>
            </div>

            <!-- خطوات التنفيذ + زر وضع الطهي المباشر -->
            <div class="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/80 shadow-sm space-y-3.5">
                <div class="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100">
                    <h2 class="text-base font-black text-brand-navy flex items-center gap-1.5">
                        <i class="fa-solid fa-list-ol text-emerald-600"></i> خطوات التحضير والطهي (${steps.length} خطوات)
                    </h2>
                    <button type="button" onclick="window.kitchenOpenCookMode(0)" class="bg-brand-navy hover:opacity-95 text-white px-4 py-2 rounded-xl text-xs font-black shadow-md flex items-center gap-1.5">
                        <i class="fa-solid fa-play text-amber-400"></i> وضع الطهي المباشر
                    </button>
                </div>
                <div class="space-y-2.5">${stepsHtml}</div>
            </div>

            <!-- علامات النضج والسلامة والأخطاء والتقديم والحفظ -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div class="bg-rose-50/70 border-2 border-rose-200 rounded-3xl p-4 space-y-1.5">
                    <h3 class="text-sm font-black text-rose-900 flex items-center gap-1.5">
                        <i class="fa-solid fa-temperature-high text-rose-600"></i> علامات النضج وسلامة الغذاء
                    </h3>
                    <p class="text-xs font-bold text-rose-950/90 leading-relaxed">${esc(r.doneness_and_safety || '')}</p>
                </div>

                <div class="bg-amber-50/70 border border-amber-200 rounded-3xl p-4 space-y-1.5">
                    <h3 class="text-sm font-black text-amber-950 flex items-center gap-1.5">
                        <i class="fa-solid fa-triangle-exclamation text-amber-600"></i> أخطاء شائعة تجنّبها
                    </h3>
                    <p class="text-xs font-bold text-amber-950/90 leading-relaxed">${esc(r.common_mistakes || '')}</p>
                </div>

                <div class="bg-white border border-slate-200 rounded-3xl p-4 space-y-1.5">
                    <h3 class="text-sm font-black text-brand-navy flex items-center gap-1.5">
                        <i class="fa-solid fa-utensils text-emerald-600"></i> اقتراحات التقديم
                    </h3>
                    <p class="text-xs font-bold text-slate-600 leading-relaxed">${esc(r.serving_suggestions || '')}</p>
                </div>

                <div class="bg-white border border-slate-200 rounded-3xl p-4 space-y-1.5">
                    <h3 class="text-sm font-black text-brand-navy flex items-center gap-1.5">
                        <i class="fa-solid fa-snowflake text-sky-600"></i> الحفظ وإعادة التسخين
                    </h3>
                    <p class="text-xs font-bold text-slate-600 leading-relaxed">${esc(r.storage || '')}</p>
                </div>

                <div class="bg-purple-50/60 border border-purple-200 rounded-3xl p-4 space-y-1.5">
                    <h3 class="text-sm font-black text-purple-950 flex items-center gap-1.5">
                        <i class="fa-solid fa-circle-exclamation text-purple-600"></i> مسببات الحساسية المحتملة
                    </h3>
                    <p class="text-xs font-bold text-purple-950/85 leading-relaxed">${esc(r.allergens || 'راجع ملصق أي مكونات جاهزة.')}</p>
                </div>

                <div class="bg-slate-50 border border-slate-200 rounded-3xl p-4 space-y-1.5">
                    <h3 class="text-sm font-black text-slate-800 flex items-center gap-1.5">
                        <i class="fa-solid fa-notes-medical text-slate-500"></i> المعلومات الغذائية
                    </h3>
                    ${nutritionHtml}
                </div>
            </div>

            <!-- تقييمات وملاحظات العملاء -->
            <div class="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/80 shadow-sm space-y-4">
                <div class="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100">
                    <h2 class="text-base font-black text-brand-navy flex items-center gap-1.5">
                        <i class="fa-solid fa-comments text-amber-500"></i> تجارب وملاحظات عملاء سمان ههيا
                    </h2>
                    <span id="detail-feedback-count" class="text-[11px] font-black text-slate-500"></span>
                </div>

                <div id="detail-feedback-list" class="space-y-2">
                    <p class="text-xs font-bold text-slate-400">جاري تحميل التقييمات المعتمدة...</p>
                </div>

                <!-- نموذج إضافة تقييم جديد -->
                <div class="bg-[#faf8f3] border border-slate-200 rounded-2xl p-3.5 space-y-3">
                    <h3 class="text-xs sm:text-sm font-black text-brand-navy">جرّبت الوصفة؟ شاركنا رأيك وملاحظاتك:</h3>

                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                            <label class="block text-[11px] font-black text-slate-600 mb-1">اسمك *</label>
                            <input type="text" id="k-fb-name" placeholder="مثال: أم سلمى / أحمد" class="w-full border border-slate-200 rounded-xl p-2 text-xs font-bold bg-white outline-none focus:border-brand-navy">
                        </div>
                        <div>
                            <label class="block text-[11px] font-black text-slate-600 mb-1">التقييم بالنجوم</label>
                            <div class="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-3 py-1.5" id="k-fb-stars">
                                ${[1, 2, 3, 4, 5].map((n) => `
                                    <button type="button" onclick="window.kitchenSetRating(${n})" class="k-star-btn text-lg text-amber-400">
                                        <i class="fa-solid fa-star"></i>
                                    </button>`).join('')}
                            </div>
                        </div>
                    </div>

                    <div>
                        <label class="block text-[11px] font-black text-slate-600 mb-1">هل نجحت الوصفة معك؟</label>
                        <div class="flex gap-2" id="k-fb-success-group">
                            <button type="button" data-val="yes" onclick="window.kitchenSetSuccess('yes')" class="flex-1 py-1.5 rounded-xl text-xs font-black bg-emerald-600 text-white border border-emerald-600">✅ نجحت ممتاز</button>
                            <button type="button" data-val="partial" onclick="window.kitchenSetSuccess('partial')" class="flex-1 py-1.5 rounded-xl text-xs font-black bg-white text-slate-600 border border-slate-200">🟡 مقبولة</button>
                            <button type="button" data-val="no" onclick="window.kitchenSetSuccess('no')" class="flex-1 py-1.5 rounded-xl text-xs font-black bg-white text-slate-600 border border-slate-200">⚠️ واجهت صعوبة</button>
                        </div>
                    </div>

                    <div>
                        <label class="block text-[11px] font-black text-slate-600 mb-1">ملاحظتك أو نصيحتك (اختياري)</label>
                        <textarea id="k-fb-comment" rows="2" maxlength="550" placeholder="اكتب رأيك في المقادير أو وقت التسوية في فرنك..." class="w-full border border-slate-200 rounded-xl p-2.5 text-xs font-bold bg-white outline-none focus:border-brand-navy resize-none"></textarea>
                    </div>

                    <button type="button" id="k-fb-submit-btn" onclick="window.kitchenSubmitFeedback()" class="bg-brand-navy hover:opacity-95 text-white font-black px-5 py-2.5 rounded-xl text-xs shadow-sm flex items-center gap-1.5">
                        <i class="fa-solid fa-paper-plane text-amber-400"></i> إرسال التقييم للمراجعة
                    </button>
                </div>
            </div>
        `;

        renderIngredientsListOnly();
    }

    // =========================================================================
    // 5. وضع الطهي المباشر خطوة بخطوة + المؤقتات + Wake Lock
    // =========================================================================
    window.kitchenStartStepTimerFromDetail = function (stepIdx, minutes) {
        window.kitchenOpenCookMode(stepIdx);
        cookState.timerSeconds = minutes * 60;
        updateCookTimerDisplay();
        if (!cookState.timerRunning) window.kitchenToggleTimer();
    };

    window.kitchenOpenCookMode = function (startIdx = 0) {
        const r = state.activeRecipe;
        if (!r || !Array.isArray(r.steps) || r.steps.length === 0) return;

        cookState.stepIdx = Math.max(0, Math.min(r.steps.length - 1, startIdx));
        document.getElementById('cook-mode-title').textContent = r.title;

        const safetyPill = document.getElementById('cook-safety-mini-pill');
        if (safetyPill) {
            if (String(r.category).includes('بيض')) safetyPill.textContent = '🌡️ أمان أطباق البيض: 71°م وتماسك كامل';
            else if (String(r.category).includes('السمان') || String(r.category).includes('الرومي')) safetyPill.textContent = '🌡️ أمان الدواجن والحشو: 74°م';
            else safetyPill.textContent = '🛡️ التزم بنظافة وفصل الأدوات';
        }

        // تحديث درج المقادير
        const baseServ = Number(r.servings) || 4;
        document.getElementById('cook-drawer-servings').textContent = state.activeServings;
        document.getElementById('cook-drawer-list').innerHTML = (r.ingredients || [])
            .map((raw) => `<li>${esc(scaleIngredientText(raw, baseServ, state.activeServings))}</li>`)
            .join('');

        renderCookModeStep();
        document.getElementById('kitchen-cook-modal')?.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    };

    window.kitchenCloseCookMode = function () {
        document.getElementById('kitchen-cook-modal')?.classList.add('hidden');
        document.getElementById('cook-ingredients-drawer')?.classList.add('hidden');
        document.body.style.overflow = '';
        releaseWakeLock();
    };

    window.kitchenToggleCookIngredientsDrawer = function () {
        document.getElementById('cook-ingredients-drawer')?.classList.toggle('hidden');
    };

    window.kitchenStepCookMode = function (delta) {
        const r = state.activeRecipe;
        if (!r || !Array.isArray(r.steps)) return;
        const next = cookState.stepIdx + delta;
        if (next >= r.steps.length) {
            window.kitchenCloseCookMode();
            showToast('ألف هنا وشفا! أنهيت جميع خطوات الوصفة 🎉');
            return;
        }
        if (next < 0) return;
        cookState.stepIdx = next;
        renderCookModeStep();
    };

    function renderCookModeStep() {
        const r = state.activeRecipe;
        if (!r) return;
        const steps = r.steps || [];
        const total = steps.length;
        const idx = cookState.stepIdx;
        const stepTxt = steps[idx] || '';

        document.getElementById('cook-step-counter').textContent = `الخطوة ${idx + 1} من ${total}`;
        document.getElementById('cook-step-badge').textContent = `الخطوة ${idx + 1}`;
        document.getElementById('cook-step-text').textContent = stepTxt;
        document.getElementById('cook-progress-bar').style.width = `${Math.round(((idx + 1) / total) * 100)}%`;

        const prevBtn = document.getElementById('cook-prev-btn');
        const nextBtn = document.getElementById('cook-next-btn');
        if (prevBtn) prevBtn.disabled = idx === 0;
        if (nextBtn) {
            nextBtn.innerHTML = (idx === total - 1)
                ? '<span>🎉 إنهاء الوصفة</span>'
                : '<span>الخطوة التالية</span> <i class="fa-solid fa-chevron-left"></i>';
        }

        const quickWrap = document.getElementById('cook-step-quick-timer-wrap');
        const mins = extractMinutesFromStep(stepTxt);
        if (quickWrap) {
            quickWrap.innerHTML = mins
                ? `<button type="button" onclick="window.kitchenLoadAndStartTimer(${mins})" class="bg-amber-400 hover:bg-amber-300 text-[#0b261c] px-4 py-2 rounded-xl text-xs font-black shadow inline-flex items-center gap-1.5">
                        <i class="fa-solid fa-stopwatch"></i> ضبط وتشغيل مؤقت هذه الخطوة (${mins} دقيقة)
                   </button>`
                : '';
        }
    }

    window.kitchenLoadAndStartTimer = function (mins) {
        cookState.timerSeconds = mins * 60;
        updateCookTimerDisplay();
        if (!cookState.timerRunning) window.kitchenToggleTimer();
        showToast(`⏱️ بدأ المؤقت لمدة ${mins} دقيقة`);
    };

    window.kitchenAddTimerMinutes = function (mins) {
        cookState.timerSeconds += mins * 60;
        updateCookTimerDisplay();
    };

    window.kitchenToggleTimer = function () {
        const btn = document.getElementById('cook-timer-toggle-btn');
        const icoBox = document.getElementById('cook-timer-icon-box');

        if (cookState.timerRunning) {
            clearInterval(cookState.timerInterval);
            cookState.timerRunning = false;
            if (btn) btn.textContent = 'استكمال';
            if (icoBox) icoBox.classList.remove('timer-running-badge');
            return;
        }

        if (cookState.timerSeconds <= 0) {
            cookState.timerSeconds = 5 * 60;
            updateCookTimerDisplay();
        }

        cookState.timerRunning = true;
        if (btn) btn.textContent = 'إيقاف مؤقت';
        if (icoBox) icoBox.classList.add('timer-running-badge');

        cookState.timerInterval = setInterval(() => {
            cookState.timerSeconds -= 1;
            updateCookTimerDisplay();
            if (cookState.timerSeconds <= 0) {
                clearInterval(cookState.timerInterval);
                cookState.timerRunning = false;
                if (btn) btn.textContent = 'تشغيل';
                if (icoBox) icoBox.classList.remove('timer-running-badge');
                playTimerDoneBeep();
                showToast('⏰ انتهى وقت المؤقت! افحص الطعام الآن.', 'fa-bell text-amber-400');
            }
        }, 1000);
    };

    window.kitchenResetTimer = function () {
        clearInterval(cookState.timerInterval);
        cookState.timerRunning = false;
        cookState.timerSeconds = 0;
        updateCookTimerDisplay();
        const btn = document.getElementById('cook-timer-toggle-btn');
        const icoBox = document.getElementById('cook-timer-icon-box');
        if (btn) btn.textContent = 'تشغيل';
        if (icoBox) icoBox.classList.remove('timer-running-badge');
    };

    function updateCookTimerDisplay() {
        const el = document.getElementById('cook-timer-display');
        if (!el) return;
        const s = Math.max(0, cookState.timerSeconds);
        const mm = String(Math.floor(s / 60)).padStart(2, '0');
        const ss = String(s % 60).padStart(2, '0');
        el.textContent = `${mm}:${ss}`;
    }

    function playTimerDoneBeep() {
        try {
            if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 300]);
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return;
            const ctx = new AudioCtx();
            [0, 0.25, 0.5].forEach((offset) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(880, ctx.currentTime + offset);
                gain.gain.setValueAtTime(0.18, ctx.currentTime + offset);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + offset + 0.2);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(ctx.currentTime + offset);
                osc.stop(ctx.currentTime + offset + 0.22);
            });
        } catch (e) {}
    }

    window.kitchenToggleWakeLock = async function () {
        const btn = document.getElementById('cook-wakelock-btn');
        if (!('wakeLock' in navigator)) {
            showToast('المتصفح الحالي لا يدعم قفل إضاءة الشاشة التلقائي', 'fa-circle-info text-amber-400');
            return;
        }
        if (cookState.wakeLock) {
            releaseWakeLock();
            showToast('تم إيقاف تثبيت إضاءة الشاشة');
            return;
        }
        try {
            cookState.wakeLock = await navigator.wakeLock.request('screen');
            if (btn) btn.classList.add('bg-emerald-500/30', 'border-emerald-400');
            showToast('☀️ الشاشة ستبقى مضاءة أثناء الطهي');
        } catch (e) {
            showToast('تعذر تفعيل إضاءة الشاشة حالياً', 'fa-circle-info text-amber-400');
        }
    };

    function releaseWakeLock() {
        if (cookState.wakeLock) {
            cookState.wakeLock.release().catch(() => {});
            cookState.wakeLock = null;
        }
        document.getElementById('cook-wakelock-btn')?.classList.remove('bg-emerald-500/30', 'border-emerald-400');
    }

    // =========================================================================
    // 6. تقييمات العملاء + أداة حل المشاكل + بطاقات سلامة الغذاء + المشاركة
    // =========================================================================
    window.kitchenSetRating = function (n) {
        state.selectedRating = n;
        const stars = document.querySelectorAll('#k-fb-stars .k-star-btn');
        stars.forEach((btn, i) => {
            btn.className = `k-star-btn text-lg ${i < n ? 'text-amber-400' : 'text-slate-300'}`;
        });
    };

    window.kitchenSetSuccess = function (val) {
        state.selectedSuccess = val;
        document.querySelectorAll('#k-fb-success-group button').forEach((btn) => {
            const act = btn.getAttribute('data-val') === val;
            btn.className = `flex-1 py-1.5 rounded-xl text-xs font-black border ${
                act ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-600 border-slate-200'
            }`;
        });
    };

    async function loadApprovedFeedback(recipeId) {
        const listEl = document.getElementById('detail-feedback-list');
        const cntEl = document.getElementById('detail-feedback-count');
        if (!listEl || !kDb) return;

        try {
            const snap = await kDb.collection('kitchen_feedback')
                .where('recipeId', '==', recipeId)
                .where('isApproved', '==', true)
                .get();

            const items = [];
            snap.forEach((d) => items.push({ id: d.id, ...(d.data() || {}) }));
            items.sort((a, b) => {
                const ta = (a.createdAt && a.createdAt.toMillis) ? a.createdAt.toMillis() : 0;
                const tb = (b.createdAt && b.createdAt.toMillis) ? b.createdAt.toMillis() : 0;
                return tb - ta;
            });

            if (cntEl) cntEl.textContent = `${items.length} تقييم معتمد`;

            if (items.length === 0) {
                listEl.innerHTML = '<p class="text-xs font-bold text-slate-400 bg-slate-50 p-3 rounded-xl text-center">كن أول من يشارك تجربته وملاحظاته على هذه الوصفة.</p>';
                return;
            }

            listEl.innerHTML = items.map((fb) => {
                const starsStr = '★'.repeat(Math.max(1, Math.min(5, Number(fb.rating) || 5)));
                const succTxt = fb.succeeded === 'yes' ? '✅ نجحت ممتاز' : (fb.succeeded === 'partial' ? '🟡 مقبولة' : '⚠️ واجه صعوبة');
                return `
                    <div class="bg-slate-50 border border-slate-200/80 rounded-2xl p-3 space-y-1">
                        <div class="flex items-center justify-between gap-2">
                            <span class="text-xs font-black text-brand-navy">${esc(fb.customerName || 'عميل سمان ههيا')}</span>
                            <div class="flex items-center gap-2">
                                <span class="text-[10px] font-black text-slate-500">${succTxt}</span>
                                <span class="text-amber-500 text-xs tracking-tighter">${starsStr}</span>
                            </div>
                        </div>
                        ${fb.comment ? `<p class="text-xs font-bold text-slate-600 leading-relaxed">${esc(fb.comment)}</p>` : ''}
                    </div>`;
            }).join('');
        } catch (e) {
            listEl.innerHTML = '<p class="text-xs font-bold text-slate-400">تعذر تحميل التقييمات حالياً.</p>';
        }
    }

    window.kitchenSubmitFeedback = async function () {
        const r = state.activeRecipe;
        if (!r || !kDb) return;
        const name = String(document.getElementById('k-fb-name')?.value || '').trim();
        const comment = String(document.getElementById('k-fb-comment')?.value || '').trim();
        if (name.length < 2) {
            showToast('يرجى كتابة اسمك أولاً', 'fa-circle-exclamation text-amber-400');
            return;
        }

        const btn = document.getElementById('k-fb-submit-btn');
        const origHtml = btn ? btn.innerHTML : '';
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري الإرسال...';
        }

        try {
            await kDb.collection('kitchen_feedback').add({
                recipeId: r.id,
                recipeTitle: r.title || '',
                customerName: name,
                rating: Number(state.selectedRating) || 5,
                succeeded: state.selectedSuccess || 'yes',
                comment: comment,
                isApproved: false,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            if (document.getElementById('k-fb-comment')) document.getElementById('k-fb-comment').value = '';
            showToast('✅ شكراً لك! تم استلام تقييمك وسيظهر بعد مراجعة الإدارة.');
        } catch (e) {
            console.error('Feedback error:', e);
            showToast('تعذر إرسال التقييم حالياً، حاول مرة أخرى.', 'fa-triangle-exclamation text-rose-400');
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = origHtml;
            }
        }
    };

    window.kitchenShareCurrentRecipe = function () {
        const r = state.activeRecipe;
        if (!r) return;
        const shareUrl = `${window.location.origin}${window.location.pathname}?recipe=${encodeURIComponent(r.id)}`;
        const txt = `👨‍🍳 وصفة من مطبخ سمان ههيا:\n*${r.title}*\n${r.intro || ''}\n\nشاهد المقادير والخطوات بالتفصيل:\n${shareUrl}`;
        window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(txt)}`, '_blank', 'noopener,noreferrer');
    };

    function renderTroubleshootButtons() {
        const wrap = document.getElementById('kitchen-trouble-buttons');
        if (!wrap) return;
        wrap.innerHTML = TROUBLESHOOT_ITEMS.map((item) => `
            <button type="button" data-tr="${item.id}" onclick="window.kitchenShowTrouble('${item.id}')" class="k-tr-btn bg-slate-50 hover:bg-rose-50 text-slate-700 hover:text-rose-800 border border-slate-200 px-3 py-2 rounded-xl text-xs font-black transition-all">
                ${esc(item.label)}
            </button>`).join('');
    }

    window.kitchenShowTrouble = function (id) {
        const item = TROUBLESHOOT_ITEMS.find((x) => x.id === id);
        const box = document.getElementById('kitchen-trouble-answer');
        if (!item || !box) return;

        document.querySelectorAll('.k-tr-btn').forEach((b) => {
            const act = b.getAttribute('data-tr') === id;
            b.className = `k-tr-btn px-3 py-2 rounded-xl text-xs font-black border transition-all ${
                act ? 'bg-brand-navy text-white border-brand-navy shadow-sm' : 'bg-slate-50 text-slate-700 border-slate-200'
            }`;
        });

        box.innerHTML = `
            <p><strong class="text-rose-700">السبب المحتمل:</strong> ${esc(item.cause)}</p>
            <p><strong class="text-emerald-800">الحل الآمن:</strong> ${esc(item.solution)}</p>
        `;
        box.classList.remove('hidden');
    };

    function renderGuides(guides) {
        const cont = document.getElementById('kitchen-guides-container');
        if (!cont) return;
        cont.innerHTML = (guides || []).map((g, idx) => `
            <div class="bg-white rounded-3xl p-4 border border-slate-200/80 shadow-sm space-y-2">
                <div class="flex items-center gap-2.5">
                    <span class="w-9 h-9 rounded-xl bg-emerald-50 text-brand-navy border border-emerald-200 flex items-center justify-center text-sm shrink-0">
                        <i class="fa-solid ${esc(g.icon || 'fa-shield-halved')}"></i>
                    </span>
                    <h3 class="text-sm font-black text-brand-navy">${idx + 1}. ${esc(g.title)}</h3>
                </div>
                <p class="text-xs font-bold text-slate-600 leading-relaxed">${esc(g.content)}</p>
            </div>`).join('');
    }
})();
