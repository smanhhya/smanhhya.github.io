// kitchen/js/kitchen-admin.js - محرك إدارة مطبخ سمان ههيا (الاستيراد، النشر، الاعتماد العملي، الصور، والتقييمات)

(function () {
    let kDb = null;
    let kAuth = null;
    let currentAdminUser = null;
    let adminRecipes = [];
    let adminFeedback = [];
    let storeProductsMap = {};
    let toastTimer = null;

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
        const el = document.getElementById('ka-toast');
        const txt = document.getElementById('ka-toast-text');
        const ico = document.getElementById('ka-toast-icon');
        if (!el || !txt) return;
        txt.textContent = text;
        if (ico) ico.className = `fa-solid ${iconCls}`;
        el.classList.remove('opacity-0', '-translate-y-4');
        el.classList.add('opacity-100', 'translate-y-0');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => {
            el.classList.remove('opacity-100', 'translate-y-0');
            el.classList.add('opacity-0', '-translate-y-4');
        }, 2500);
    }

    function makeSlug(id, title) {
        const cleanTitle = String(title || '').trim().replace(/\s+/g, '-').replace(/[^\u0600-\u06FFa-zA-Z0-9\-]/g, '');
        return `${String(id || '').toLowerCase()}-${cleanTitle}`.slice(0, 80);
    }

    // =========================================================================
    // 1. تهيئة Firebase والمصادقة الآمنة
    // =========================================================================
    document.addEventListener('DOMContentLoaded', () => {
        try {
            const cfg = (typeof FIREBASE_CONFIG !== 'undefined') ? FIREBASE_CONFIG : window.FIREBASE_CONFIG;
            if (!firebase.apps.length && cfg) {
                firebase.initializeApp(cfg);
            }
            kDb = firebase.firestore();
            kAuth = firebase.auth();

            const savedKey = localStorage.getItem('sman_imgbb_api_key') || '';
            if (document.getElementById('ka-imgbb-key')) {
                document.getElementById('ka-imgbb-key').value = savedKey;
            }

            kAuth.onAuthStateChanged((user) => {
                if (user) {
                    currentAdminUser = user;
                    document.getElementById('ka-login-screen')?.classList.add('hidden');
                    document.getElementById('ka-app-shell')?.classList.remove('hidden');
                    const tag = document.getElementById('ka-admin-email-tag');
                    if (tag) tag.textContent = user.email || user.uid;
                    loadAllAdminData();
                } else {
                    currentAdminUser = null;
                    document.getElementById('ka-app-shell')?.classList.add('hidden');
                    document.getElementById('ka-login-screen')?.classList.remove('hidden');
                }
            });
        } catch (e) {
            console.error('Kitchen Admin Init Error:', e);
        }
    });

    window.kaHandleLogin = async function () {
        const email = String(document.getElementById('ka-email')?.value || '').trim();
        const pass = String(document.getElementById('ka-password')?.value || '');
        const errEl = document.getElementById('ka-login-err');
        const btn = document.getElementById('ka-login-btn');
        if (errEl) errEl.classList.add('hidden');

        if (!kAuth) {
            if (errEl) {
                errEl.textContent = '⚠️ لم يتم تهيئة Firebase Auth — تأكد من تحميل ملف ../js/config.js ووجود FIREBASE_CONFIG بداخله.';
                errEl.classList.remove('hidden');
            }
            return;
        }

        if (btn) btn.disabled = true;

        try {
            await kAuth.signInWithEmailAndPassword(email, pass);
        } catch (err) {
            const code = String(err?.code || '');
            let msg = `خطأ غير متوقع (${code || err?.message || 'unknown'})`;
            if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
                msg = `الإيميل أو كلمة المرور غير مطابقة لحساب الإدارة في Firebase (${code}).`;
            } else if (code === 'auth/invalid-email') {
                msg = 'صيغة البريد الإلكتروني غير صحيحة.';
            } else if (code === 'auth/too-many-requests') {
                msg = 'تم إيقاف المحاولات مؤقتاً لكثرة المحاولات الخاطئة؛ انتظر بضع دقائق وحاول مجدداً.';
            } else if (code === 'auth/network-request-failed') {
                msg = 'تعذر الاتصال بسيرفر Firebase — تأكد من الإنترنت أو حالة sw.js.';
            } else if (code === 'auth/operation-not-allowed') {
                msg = 'تسجيل الدخول بالإيميل غير مفعّل في هذا المشروع على Firebase.';
            }
            if (errEl) {
                errEl.textContent = msg;
                errEl.classList.remove('hidden');
            }
        } finally {
            if (btn) btn.disabled = false;
        }
    };

    window.kaHandleLogout = function () {
        if (confirm('هل تريد تسجيل الخروج من لوحة إدارة المطبخ؟')) {
            kAuth.signOut();
        }
    };

    // =========================================================================
    // 2. تحميل البيانات والإحصائيات والتبويبات
    // =========================================================================
    async function loadAllAdminData() {
        if (!kDb) return;
        try {
            const [recSnap, fbSnap, settingsDoc] = await Promise.all([
                kDb.collection('kitchen_recipes').get(),
                kDb.collection('kitchen_feedback').get(),
                kDb.collection('inventory').doc('settings').get().catch(() => null)
            ]);

            adminRecipes = [];
            recSnap.forEach((d) => {
                const data = d.data() || {};
                adminRecipes.push({ ...data, id: data.id || d.id });
            });
            adminRecipes.sort((a, b) => (Number(a.number) || 999) - (Number(b.number) || 999));

            adminFeedback = [];
            fbSnap.forEach((d) => adminFeedback.push({ id: d.id, ...(d.data() || {}) }));
            adminFeedback.sort((a, b) => {
                if (Boolean(a.isApproved) !== Boolean(b.isApproved)) return a.isApproved ? 1 : -1;
                const ta = (a.createdAt && a.createdAt.toMillis) ? a.createdAt.toMillis() : 0;
                const tb = (b.createdAt && b.createdAt.toMillis) ? b.createdAt.toMillis() : 0;
                return tb - ta;
            });

            if (settingsDoc && settingsDoc.exists) {
                const sData = settingsDoc.data() || {};
                if (sData.productsData) storeProductsMap = sData.productsData;
            }

            updateStats();
            window.kaRenderRecipesList();
            window.kaRenderFeedbackList();
        } catch (err) {
            console.error('Admin Load Error:', err);
            showToast('⚠️ تأكد أن هذا الحساب يملك صلاحية الأدمن في firestore.rules', 'fa-triangle-exclamation text-rose-400');
        }
    }

    function updateStats() {
        const total = adminRecipes.length;
        const pub = adminRecipes.filter((r) => r.publishStatus === 'published').length;
        const draft = total - pub;
        const tested = adminRecipes.filter((r) => r.verificationStatus === 'practically_tested').length;
        const pendingFb = adminFeedback.filter((f) => !f.isApproved).length;

        const setTxt = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
        setTxt('ka-stat-total', total);
        setTxt('ka-stat-pub', pub);
        setTxt('ka-stat-draft', draft);
        setTxt('ka-stat-tested', tested);
        setTxt('ka-stat-fb', pendingFb);
    }

    window.kaSwitchTab = function (tabKey) {
        ['recipes', 'feedback', 'import'].forEach((k) => {
            document.getElementById(`ka-tab-${k}`)?.classList.toggle('hidden', k !== tabKey);
            const btn = document.getElementById(`ka-btn-tab-${k}`);
            if (btn) {
                btn.className = (k === tabKey)
                    ? 'py-2.5 px-2 rounded-xl text-xs font-black bg-brand-navy text-white shadow-sm'
                    : 'py-2.5 px-2 rounded-xl text-xs font-black bg-slate-100 text-slate-600 hover:bg-slate-200';
            }
        });
    };

    // =========================================================================
    // 3. استيراد ملف sman_hhya_kitchen_50_recipes.json بضغطة واحدة وبأمان
    // =========================================================================
    window.kaImportJsonFile = async function () {
        const fileInp = document.getElementById('ka-json-file');
        const logEl = document.getElementById('ka-import-log');
        const btn = document.getElementById('ka-import-btn');
        const file = fileInp?.files?.[0];

        if (!file) {
            showToast('اختر ملف sman_hhya_kitchen_50_recipes.json أولاً', 'fa-circle-exclamation text-amber-400');
            return;
        }

        if (btn) btn.disabled = true;
        if (logEl) {
            logEl.className = 'text-xs font-bold p-3 rounded-xl border bg-slate-50 border-slate-200 text-slate-700';
            logEl.textContent = '⏳ جاري قراءة الملف واستيراد الوصفات...';
            logEl.classList.remove('hidden');
        }

        try {
            const text = await file.text();
            const json = JSON.parse(text);
            const recipesArr = Array.isArray(json.recipes) ? json.recipes : [];
            const guidesArr = Array.isArray(json.knowledge_cards) ? json.knowledge_cards : [];

            if (recipesArr.length === 0) {
                throw new Error('لم يتم العثور على مصفوفة recipes داخل الملف المختار.');
            }

            const existingMap = new Map(adminRecipes.map((r) => [r.id, r]));
            const batch = kDb.batch();
            let addedCount = 0;
            let imagesLinkedCount = 0;
            let skippedCount = 0;
            const nowStr = new Date().toLocaleString('ar-EG');
            const actor = currentAdminUser?.email || 'Admin';

            function normalizeRecipeImgUrl(raw) {
                const s = String(raw || '').trim();
                if (!s) return '';
                if (/^(https?:\/\/|\/|\.\/|\.\.\/)/i.test(s)) return s;
                return './' + s;
            }

            recipesArr.forEach((rec, idx) => {
                const docId = String(rec.id || `SHK-${String(idx + 1).padStart(3, '0')}`).trim();
                const resolvedImg = normalizeRecipeImgUrl(rec.image_url || rec.image_path || '');
                const existingRec = existingMap.get(docId);

                if (existingRec) {
                    const hasCurrentImg = Boolean(existingRec.image_url && String(existingRec.image_url).trim());
                    if (!hasCurrentImg && resolvedImg) {
                        const audit = Array.isArray(existingRec.auditLog) ? [...existingRec.auditLog] : [];
                        audit.unshift({ at: nowStr, by: actor, action: 'ربط صورة الوصفة تلقائياً من حزمة الصور' });
                        batch.set(kDb.collection('kitchen_recipes').doc(docId), {
                            image_url: resolvedImg,
                            image_status: rec.image_status || 'صورة توضيحية مولّدة؛ ليست توثيقاً لتجربة فعلية',
                            auditLog: audit.slice(0, 25),
                            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                        }, { merge: true });
                        imagesLinkedCount++;
                    } else {
                        skippedCount++;
                    }
                    return;
                }

                const payload = {
                    ...rec,
                    id: docId,
                    number: Number(rec.number) || (idx + 1),
                    slug: makeSlug(docId, rec.title),
                    image_url: resolvedImg,
                    image_status: rec.image_status || '',
                    recommendedProductIds: Array.isArray(rec.recommendedProductIds) ? rec.recommendedProductIds : [],
                    publishStatus: 'draft',
                    verificationStatus: 'needs_practical_test',
                    practicalTestLog: null,
                    ratingAvg: 0,
                    ratingCount: 0,
                    auditLog: [{ at: nowStr, by: actor, action: 'استيراد تأسيسي من ملف الـ 50 وصفة مع ربط الصورة (مسودة)' }],
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                };

                batch.set(kDb.collection('kitchen_recipes').doc(docId), payload);
                addedCount++;
            });

            const guideIcons = ['fa-hand-sparkles', 'fa-snowflake', 'fa-temperature-high', 'fa-box-open', 'fa-certificate'];
            guidesArr.forEach((g, idx) => {
                const gId = `guide_${String(idx + 1).padStart(2, '0')}`;
                batch.set(kDb.collection('kitchen_guides').doc(gId), {
                    order: idx + 1,
                    icon: guideIcons[idx] || 'fa-shield-halved',
                    title: g.title || '',
                    content: g.content || ''
                }, { merge: true });
            });

            await batch.commit();

            if (logEl) {
                logEl.className = 'text-xs font-black p-3.5 rounded-xl border bg-emerald-50 border-emerald-200 text-emerald-900';
                logEl.innerHTML = `✅ اكتمل الاستيراد وربط الصور بنجاح!<br>• وصفات جديدة أُضيفت (كمسودات): ${addedCount}<br>• وصفات موجودة تم ربط صورها تلقائياً (دون لمس نصوصها أو نشرها): ${imagesLinkedCount}<br>• وصفات مكتملة مسبقاً لم تُمس: ${skippedCount}<br>• بطاقات سلامة الغذاء: ${guidesArr.length}`;
            }

            await loadAllAdminData();
            showToast(`🎉 تم إضافة ${addedCount} وصفة وربط ${imagesLinkedCount} صورة بنجاح!`);
        } catch (err) {
            console.error('Import JSON Error:', err);
            if (logEl) {
                logEl.className = 'text-xs font-black p-3 rounded-xl border bg-rose-50 border-rose-200 text-rose-700';
                logEl.textContent = `❌ خطأ أثناء الاستيراد: ${err.message}`;
            }
        } finally {
            if (btn) btn.disabled = false;
        }
    };

    // =========================================================================
    // 4. عرض قائمة الوصفات + التبديل السريع للنشر/الإخفاء
    // =========================================================================
    window.kaRenderRecipesList = function () {
        const cont = document.getElementById('ka-recipes-list');
        if (!cont) return;

        const q = String(document.getElementById('ka-search')?.value || '').trim().toLowerCase();
        const fCat = document.getElementById('ka-filter-cat')?.value || 'all';
        const fPub = document.getElementById('ka-filter-pub')?.value || 'all';
        const fVer = document.getElementById('ka-filter-ver')?.value || 'all';

        const filtered = adminRecipes.filter((r) => {
            if (fCat !== 'all' && r.category !== fCat) return false;
            const pub = r.publishStatus === 'published' ? 'published' : 'draft';
            if (fPub !== 'all' && pub !== fPub) return false;
            const ver = r.verificationStatus === 'practically_tested' ? 'practically_tested' : 'needs_practical_test';
            if (fVer !== 'all' && ver !== fVer) return false;
            if (q && !`${r.id} ${r.title} ${r.category}`.toLowerCase().includes(q)) return false;
            return true;
        });

        if (filtered.length === 0) {
            cont.innerHTML = `<div class="col-span-full bg-white rounded-3xl p-8 text-center border-2 border-dashed border-slate-200 space-y-2">
                <p class="text-sm font-black text-slate-600">${adminRecipes.length === 0 ? 'لم يتم استيراد الـ 50 وصفة بعد.' : 'لا توجد وصفات تطابق الفلتر الحالي.'}</p>
                ${adminRecipes.length === 0 ? `<button type="button" onclick="window.kaSwitchTab('import')" class="bg-brand-navy text-white px-4 py-2 rounded-xl text-xs font-black">اذهب لتبويب الاستيراد 📥</button>` : ''}
            </div>`;
            return;
        }

        cont.innerHTML = filtered.map((r) => {
            const isPub = r.publishStatus === 'published';
            const isTested = r.verificationStatus === 'practically_tested';
            const hasImg = Boolean(r.image_url && String(r.image_url).trim());
            const safeId = escAttr(r.id);

            return `
            <div class="bg-white rounded-2xl p-3.5 border-2 ${isPub ? 'border-emerald-200' : 'border-slate-200'} shadow-sm flex flex-col justify-between gap-3">
                <div class="flex items-start gap-3">
                    <div class="w-16 h-16 rounded-xl overflow-hidden shrink-0 ${hasImg ? 'bg-slate-100' : 'kitchen-cover-placeholder'} flex items-center justify-center text-white text-xs font-black">
                        ${hasImg ? `<img src="${esc(r.image_url)}" alt="" class="w-full h-full object-cover">` : `<span dir="ltr" class="relative z-10 text-[10px] text-amber-300">${esc(r.id)}</span>`}
                    </div>
                    <div class="min-w-0 flex-1 space-y-1">
                        <div class="flex flex-wrap items-center gap-1.5">
                            <span class="text-[10px] font-black bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded" dir="ltr">${esc(r.id)}</span>
                            <span class="text-[10px] font-black ${isPub ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'} px-2 py-0.5 rounded-md">${isPub ? '🟢 منشورة' : '📝 مسودة'}</span>
                            <span class="text-[10px] font-black ${isTested ? 'bg-sky-100 text-sky-800' : 'bg-slate-100 text-slate-500'} px-2 py-0.5 rounded-md">${isTested ? '✅ مجرّبة' : '📋 إرشادية'}</span>
                        </div>
                        <h4 class="text-sm font-black text-brand-navy truncate">${esc(r.title)}</h4>
                        <p class="text-[10px] font-bold text-slate-500">${esc(r.category)} • ${hasImg ? '🖼️ بها صورة' : '⚠️ بدون صورة بعد'}</p>
                    </div>
                </div>

                <div class="flex items-center gap-1.5 pt-2 border-t border-slate-100">
                    <button type="button" onclick="window.kaQuickTogglePublish('${safeId}')" class="flex-1 py-2 px-2.5 rounded-xl text-[11px] font-black transition-all ${isPub ? 'bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200' : 'bg-emerald-600 hover:bg-emerald-700 text-white'}">
                        ${isPub ? '⏸️ تحويل لمسودة' : '🚀 نشر للعملاء'}
                    </button>
                    <button type="button" onclick="window.kaOpenEditor('${safeId}')" class="bg-slate-900 hover:bg-brand-navy text-white py-2 px-3.5 rounded-xl text-[11px] font-black">
                        <i class="fa-solid fa-pen text-amber-400 ml-1"></i> تعديل واعتماد
                    </button>
                </div>
            </div>`;
        }).join('');
    };

    window.kaQuickTogglePublish = async function (recipeId) {
        const rec = adminRecipes.find((r) => r.id === recipeId);
        if (!rec || !kDb) return;

        const nextStatus = rec.publishStatus === 'published' ? 'draft' : 'published';
        const audit = Array.isArray(rec.auditLog) ? [...rec.auditLog] : [];
        audit.unshift({
            at: new Date().toLocaleString('ar-EG'),
            by: currentAdminUser?.email || 'Admin',
            action: nextStatus === 'published' ? 'نشر الوصفة في المطبخ العام' : 'إخفاء الوصفة وتحويلها لمسودة'
        });

        try {
            await kDb.collection('kitchen_recipes').doc(recipeId).update({
                publishStatus: nextStatus,
                auditLog: audit.slice(0, 20),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            rec.publishStatus = nextStatus;
            rec.auditLog = audit.slice(0, 20);
            updateStats();
            window.kaRenderRecipesList();
            showToast(nextStatus === 'published' ? `🚀 تم نشر (${rec.title}) للعملاء!` : `📝 تم إخفاء (${rec.title}) كمسودة.`);
        } catch (e) {
            showToast('تعذر تحديث حالة النشر', 'fa-triangle-exclamation text-rose-400');
        }
    };

    // =========================================================================
    // 5. محرر الوصفة + توثيق التجربة العملية + رفع الصور
    // =========================================================================
    window.kaTogglePracticalBox = function () {
        const val = document.getElementById('ke-verify-status')?.value;
        document.getElementById('ke-practical-box')?.classList.toggle('hidden', val !== 'practically_tested');
    };

    window.kaUpdateImgPreview = function () {
        const url = String(document.getElementById('ke-image-url')?.value || '').trim();
        const img = document.getElementById('ke-img-preview');
        if (!img) return;
        if (url) {
            img.src = url;
            img.classList.remove('hidden');
        } else {
            img.classList.add('hidden');
        }
    };

    window.kaCopyImagePrompt = function () {
        const txt = String(document.getElementById('ke-image-prompt')?.value || '').trim();
        if (!txt) return;
        navigator.clipboard?.writeText(txt).then(() => showToast('📋 تم نسخ برومبت الصورة بنجاح')).catch(() => {});
    };

    window.kaOpenEditor = function (recipeId) {
        const rec = recipeId ? adminRecipes.find((r) => r.id === recipeId) : null;
        const isNew = !rec;

        const nextNum = adminRecipes.length + 1;
        const defaultId = isNew ? `SHK-${String(nextNum).padStart(3, '0')}` : rec.id;

        document.getElementById('ke-id').value = isNew ? '' : rec.id;
        document.getElementById('ke-modal-title').textContent = isNew ? 'إضافة وصفة جديدة' : `تعديل: ${rec.title}`;
        document.getElementById('ke-modal-id-sub').textContent = defaultId;
        document.getElementById('ke-delete-btn')?.classList.toggle('hidden', isNew);

        const setV = (id, v) => { const el = document.getElementById(id); if (el) el.value = v !== undefined && v !== null ? v : ''; };
        setV('ke-publish-status', rec?.publishStatus || 'draft');
        setV('ke-verify-status', rec?.verificationStatus || 'needs_practical_test');
        setV('ke-title', rec?.title || '');
        setV('ke-category', rec?.category || 'وصفات السمان');
        setV('ke-servings', rec?.servings || 4);
        setV('ke-difficulty', rec?.difficulty || 'سهل');
        setV('ke-prep', rec?.prep_minutes || '');
        setV('ke-cook', rec?.cook_minutes_estimate || '');
        setV('ke-intro', rec?.intro || '');
        setV('ke-equipment', rec?.equipment || '');
        setV('ke-image-url', rec?.image_url || '');
        setV('ke-image-prompt', rec?.image_prompt_ar || '');
        setV('ke-ingredients', Array.isArray(rec?.ingredients) ? rec.ingredients.join('\n') : '');
        setV('ke-steps', Array.isArray(rec?.steps) ? rec.steps.join('\n') : '');
        setV('ke-safety', rec?.doneness_and_safety || '');
        setV('ke-mistakes', rec?.common_mistakes || '');
        setV('ke-serving', rec?.serving_suggestions || '');
        setV('ke-storage', rec?.storage || '');
        setV('ke-allergens', rec?.allergens || '');

        const pLog = rec?.practicalTestLog || {};
        setV('ke-test-reviewer', pLog.reviewer || '');
        setV('ke-test-date', pLog.testedAt || new Date().toISOString().split('T')[0]);
        setV('ke-test-temp', pLog.measuredTemp || '');
        setV('ke-test-weight', pLog.productWeight || '');
        setV('ke-test-device', pLog.deviceUsed || '');
        setV('ke-test-notes', pLog.resultNotes || '');

        window.kaTogglePracticalBox();
        window.kaUpdateImgPreview();

        // رسم أصناف المتجر للربط
        const linkedWrap = document.getElementById('ke-linked-products');
        const selectedProds = Array.isArray(rec?.recommendedProductIds) ? rec.recommendedProductIds : [];
        if (linkedWrap) {
            const pKeys = Object.keys(storeProductsMap).filter((k) => storeProductsMap[k] && !storeProductsMap[k].isHidden);
            linkedWrap.innerHTML = pKeys.map((pid) => {
                const p = storeProductsMap[pid];
                const chk = selectedProds.includes(pid) ? 'checked' : '';
                return `
                    <label class="inline-flex items-center gap-1.5 bg-white border border-slate-200 px-2.5 py-1.5 rounded-xl text-[11px] font-black cursor-pointer">
                        <input type="checkbox" class="ke-prod-chk w-3.5 h-3.5 accent-emerald-700" value="${esc(pid)}" ${chk}>
                        <span>${esc(p.name)}</span>
                    </label>`;
            }).join('') || '<span class="text-[11px] font-bold text-slate-400">سيتم الربط التلقائي بأصناف المتجر.</span>';
        }

        // سجل التعديلات
        const auditWrap = document.getElementById('ke-audit-wrap');
        const auditBox = document.getElementById('ke-audit-log');
        if (auditWrap && auditBox) {
            const logs = Array.isArray(rec?.auditLog) ? rec.auditLog : [];
            if (logs.length > 0) {
                auditBox.innerHTML = logs.map((l) => `<div>• <strong>${esc(l.action)}</strong> — ${esc(l.by)} (${esc(l.at)})</div>`).join('');
                auditWrap.classList.remove('hidden');
            } else {
                auditWrap.classList.add('hidden');
            }
        }

        document.getElementById('ka-edit-modal')?.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    };

    window.kaCloseEditor = function () {
        document.getElementById('ka-edit-modal')?.classList.add('hidden');
        document.body.style.overflow = '';
    };

    window.kaSaveRecipeFromModal = async function () {
        const existingId = String(document.getElementById('ke-id')?.value || '').trim();
        const title = String(document.getElementById('ke-title')?.value || '').trim();
        if (!title) return alert('يرجى كتابة عنوان الوصفة.');

        const verStatus = document.getElementById('ke-verify-status')?.value || 'needs_practical_test';
        let practicalTestLog = null;

        if (verStatus === 'practically_tested') {
            const reviewer = String(document.getElementById('ke-test-reviewer')?.value || '').trim();
            const measuredTemp = String(document.getElementById('ke-test-temp')?.value || '').trim();
            if (!reviewer || !measuredTemp) {
                return alert('التزاماً بمعيار اعتماد سمان ههيا: يجب كتابة اسم المراجع والحرارة المقاسة بالترمومتر لتفعيل شارة «مجرّبة عملياً».');
            }
            practicalTestLog = {
                reviewer,
                testedAt: document.getElementById('ke-test-date')?.value || '',
                measuredTemp,
                productWeight: String(document.getElementById('ke-test-weight')?.value || '').trim(),
                deviceUsed: String(document.getElementById('ke-test-device')?.value || '').trim(),
                resultNotes: String(document.getElementById('ke-test-notes')?.value || '').trim()
            };
        }

        const btn = document.getElementById('ke-save-btn');
        if (btn) btn.disabled = true;

        try {
            const oldRec = existingId ? adminRecipes.find((r) => r.id === existingId) : null;
            const docId = existingId || `SHK-${String(adminRecipes.length + 1).padStart(3, '0')}-${Date.now().toString().slice(-3)}`;

            const selectedProds = [...document.querySelectorAll('.ke-prod-chk:checked')].map((el) => el.value);
            const ingredients = String(document.getElementById('ke-ingredients')?.value || '').split('\n').map((s) => s.trim()).filter(Boolean);
            const steps = String(document.getElementById('ke-steps')?.value || '').split('\n').map((s) => s.trim()).filter(Boolean);

            const auditLog = Array.isArray(oldRec?.auditLog) ? [...oldRec.auditLog] : [];
            auditLog.unshift({
                at: new Date().toLocaleString('ar-EG'),
                by: currentAdminUser?.email || 'Admin',
                action: existingId ? 'تحديث بيانات الوصفة' : 'إنشاء وصفة جديدة'
            });

            const payload = {
                id: docId,
                number: oldRec ? (Number(oldRec.number) || 999) : (adminRecipes.length + 1),
                slug: oldRec?.slug || makeSlug(docId, title),
                title,
                category: document.getElementById('ke-category')?.value || 'وصفات السمان',
                servings: Math.max(1, parseInt(document.getElementById('ke-servings')?.value, 10) || 4),
                difficulty: document.getElementById('ke-difficulty')?.value || 'سهل',
                prep_minutes: String(document.getElementById('ke-prep')?.value || '').trim(),
                cook_minutes_estimate: String(document.getElementById('ke-cook')?.value || '').trim(),
                intro: String(document.getElementById('ke-intro')?.value || '').trim(),
                equipment: String(document.getElementById('ke-equipment')?.value || '').trim(),
                image_url: String(document.getElementById('ke-image-url')?.value || '').trim(),
                image_prompt_ar: String(document.getElementById('ke-image-prompt')?.value || '').trim(),
                image_alt_ar: `طبق ${title} مقدم للتناول`,
                recommendedProductIds: selectedProds,
                ingredients,
                steps,
                doneness_and_safety: String(document.getElementById('ke-safety')?.value || '').trim(),
                common_mistakes: String(document.getElementById('ke-mistakes')?.value || '').trim(),
                serving_suggestions: String(document.getElementById('ke-serving')?.value || '').trim(),
                storage: String(document.getElementById('ke-storage')?.value || '').trim(),
                allergens: String(document.getElementById('ke-allergens')?.value || '').trim(),
                publishStatus: document.getElementById('ke-publish-status')?.value || 'draft',
                verificationStatus: verStatus,
                practicalTestLog: practicalTestLog,
                editorial_status: verStatus === 'practically_tested'
                    ? 'وصفة مجرّبة ومعتمدة عملياً في مطبخ سمان ههيا.'
                    : 'محتوى أولي مُراجع إرشادياً؛ يحتاج تجربة عملية قبل وصفه بأنه مجرّب.',
                nutrition: oldRec?.nutrition || {
                    status: 'غير محسوبة بعد',
                    note: 'لا تُنشر أرقام غذائية قبل حسابها من المقادير الفعلية وقاعدة بيانات موثوقة.'
                },
                ratingAvg: Number(oldRec?.ratingAvg) || 0,
                ratingCount: Number(oldRec?.ratingCount) || 0,
                auditLog: auditLog.slice(0, 25),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            await kDb.collection('kitchen_recipes').doc(docId).set(payload, { merge: true });
            window.kaCloseEditor();
            await loadAllAdminData();
            showToast(`✅ تم حفظ وصفة (${title}) بنجاح!`);
        } catch (err) {
            console.error('Save Recipe Error:', err);
            alert('تعذر حفظ الوصفة: ' + err.message);
        } finally {
            if (btn) btn.disabled = false;
        }
    };

    window.kaDeleteCurrentRecipe = async function () {
        const docId = String(document.getElementById('ke-id')?.value || '').trim();
        if (!docId) return;
        if (!confirm(`⚠️ هل أنت متأكد من حذف الوصفة (${docId}) نهائياً؟`)) return;

        try {
            await kDb.collection('kitchen_recipes').doc(docId).delete();
            window.kaCloseEditor();
            await loadAllAdminData();
            showToast('🗑️ تم حذف الوصفة نهائياً');
        } catch (e) {
            alert('تعذر حذف الوصفة!');
        }
    };

    // رفع صورة الوصفة مباشرة عبر ImgBB
    window.kaSaveImgbbKey = function () {
        const val = String(document.getElementById('ka-imgbb-key')?.value || '').trim();
        if (val) localStorage.setItem('sman_imgbb_api_key', val);
        else localStorage.removeItem('sman_imgbb_api_key');
        showToast('🔑 تم حفظ مفتاح ImgBB على جهازك بأمان');
    };

    window.kaUploadRecipeImage = async function (event) {
        const file = event?.target?.files?.[0];
        if (!file) return;
        const apiKey = (localStorage.getItem('sman_imgbb_api_key') || '').trim();
        if (!apiKey) {
            alert('🔑 الصق مفتاح ImgBB API أولاً في تبويب (الاستيراد والصور) ثم أعد المحاولة.');
            return;
        }

        const btn = document.getElementById('ke-upload-img-btn');
        const origHtml = btn ? btn.innerHTML : '';
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري الرفع...';
        }

        try {
            const base64 = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onerror = () => reject(new Error('تعذر قراءة الصورة'));
                reader.onload = (ev) => {
                    const img = new Image();
                    img.onerror = () => reject(new Error('ملف غير صالح'));
                    img.onload = () => {
                        const cnv = document.createElement('canvas');
                        const maxD = 1000;
                        const sc = Math.min(1, maxD / Math.max(img.width, img.height));
                        cnv.width = Math.round(img.width * sc);
                        cnv.height = Math.round(img.height * sc);
                        cnv.getContext('2d').drawImage(img, 0, 0, cnv.width, cnv.height);
                        resolve(cnv.toDataURL('image/jpeg', 0.84).split(',')[1]);
                    };
                    img.src = ev.target.result;
                };
                reader.readAsDataURL(file);
            });

            const fd = new FormData();
            fd.append('image', base64);
            const res = await fetch(`https://api.imgbb.com/1/upload?key=${encodeURIComponent(apiKey)}`, { method: 'POST', body: fd });
            const json = await res.json();
            if (!res.ok || !json?.success) throw new Error(json?.error?.message || 'فشل الرفع');

            document.getElementById('ke-image-url').value = json.data.display_url || json.data.url;
            window.kaUpdateImgPreview();
            showToast('✅ تم رفع الصورة وربطها بالوصفة (اضغط حفظ التعديلات)');
        } catch (err) {
            alert('خطأ في رفع الصورة: ' + err.message);
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = origHtml;
            }
            event.target.value = '';
        }
    };

    // =========================================================================
    // 6. مراجعة واعتماد تقييمات العملاء وتحديث متوسط تقييم الوصفة تلقائياً
    // =========================================================================
    window.kaRenderFeedbackList = function () {
        const cont = document.getElementById('ka-feedback-list');
        if (!cont) return;

        const mode = document.getElementById('ka-fb-filter')?.value || 'pending';
        const list = mode === 'pending' ? adminFeedback.filter((f) => !f.isApproved) : adminFeedback;

        if (list.length === 0) {
            cont.innerHTML = '<div class="bg-white rounded-2xl p-8 text-center text-xs font-bold text-slate-400 border border-dashed border-slate-200">لا توجد تقييمات في هذا القسم حالياً.</div>';
            return;
        }

        cont.innerHTML = list.map((fb) => {
            const safeId = escAttr(fb.id);
            const safeRecId = escAttr(fb.recipeId || '');
            const stars = '★'.repeat(Math.max(1, Math.min(5, Number(fb.rating) || 5)));
            return `
            <div class="bg-white rounded-2xl p-4 border ${fb.isApproved ? 'border-emerald-200' : 'border-amber-300 bg-amber-50/20'} shadow-sm flex flex-wrap items-start justify-between gap-3">
                <div class="space-y-1 flex-1 min-w-[200px]">
                    <div class="flex flex-wrap items-center gap-2">
                        <span class="text-xs font-black text-brand-navy">${esc(fb.customerName || 'عميل')}</span>
                        <span class="text-amber-500 text-xs">${stars}</span>
                        <span class="text-[10px] font-black px-2 py-0.5 rounded-md ${fb.isApproved ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'}">${fb.isApproved ? '✅ معتمد ومنشور' : '⏳ بانتظار المراجعة'}</span>
                    </div>
                    <p class="text-[11px] font-black text-slate-500">الوصفة: ${esc(fb.recipeTitle || fb.recipeId)}</p>
                    ${fb.comment ? `<p class="text-xs font-bold text-slate-700 bg-slate-50 p-2 rounded-xl border border-slate-100">${esc(fb.comment)}</p>` : ''}
                </div>
                <div class="flex items-center gap-1.5 shrink-0">
                    <button type="button" onclick="window.kaSetFeedbackApproval('${safeId}', '${safeRecId}', ${!fb.isApproved})" class="px-3 py-2 rounded-xl text-[11px] font-black ${fb.isApproved ? 'bg-amber-100 text-amber-900' : 'bg-emerald-600 text-white'}">
                        ${fb.isApproved ? 'إخفاء' : '✅ اعتماد ونشر'}
                    </button>
                    <button type="button" onclick="window.kaDeleteFeedback('${safeId}', '${safeRecId}')" class="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white flex items-center justify-center">
                        <i class="fa-solid fa-trash text-xs"></i>
                    </button>
                </div>
            </div>`;
        }).join('');
    };

    async function recalcRecipeRating(recipeId) {
        if (!recipeId || !kDb) return;
        const approved = adminFeedback.filter((f) => f.recipeId === recipeId && f.isApproved);
        const count = approved.length;
        const avg = count > 0 ? Number((approved.reduce((s, f) => s + (Number(f.rating) || 5), 0) / count).toFixed(1)) : 0;
        await kDb.collection('kitchen_recipes').doc(recipeId).set({ ratingAvg: avg, ratingCount: count }, { merge: true }).catch(() => {});
    }

    window.kaSetFeedbackApproval = async function (fbId, recipeId, approve) {
        try {
            await kDb.collection('kitchen_feedback').doc(fbId).update({ isApproved: Boolean(approve) });
            const item = adminFeedback.find((f) => f.id === fbId);
            if (item) item.isApproved = Boolean(approve);
            await recalcRecipeRating(recipeId);
            updateStats();
            window.kaRenderFeedbackList();
            showToast(approve ? '✅ تم اعتماد ونشر التقييم' : 'تم إخفاء التقييم');
        } catch (e) {
            showToast('تعذر تحديث حالة التقييم', 'fa-triangle-exclamation text-rose-400');
        }
    };

    window.kaDeleteFeedback = async function (fbId, recipeId) {
        if (!confirm('هل تريد حذف هذا التقييم نهائياً؟')) return;
        try {
            await kDb.collection('kitchen_feedback').doc(fbId).delete();
            adminFeedback = adminFeedback.filter((f) => f.id !== fbId);
            await recalcRecipeRating(recipeId);
            updateStats();
            window.kaRenderFeedbackList();
            showToast('🗑️ تم حذف التقييم');
        } catch (e) {
            showToast('تعذر حذف التقييم', 'fa-triangle-exclamation text-rose-400');
        }
    };
})();
