// =========================================================================
// 💬 زر واتساب العائم القابل للسحب باليد في جميع صفحات موقع سمان ههيا (js/floating-wa.js)
// - يعمل تلقائياً في المتجر والتتبع وآراء العملاء والمطبخ (بدون الاعتماد على مكتبات خارجية)
// - يدعم السحب باليد على الموبايل وبالماوس على الكمبيوتر مع تمييز ذكي بين الضغطة والسحب
// - ينجذب بنعومة لأقرب حافة (يمين أو يسار) ويحفظ مكانه تلقائياً في المتصفح
// =========================================================================

(function () {
    if (window.__smanFloatingWaInit) return;
    window.__smanFloatingWaInit = true;

    const STORAGE_KEY = 'sman_floating_wa_pos_v1';
    const DEFAULT_WA_PHONE = '201208027294';
    const BTN_SIZE = 56;
    const EDGE_MARGIN = 14;
    const TOP_SAFE = 72;
    const DRAG_THRESHOLD = 8;

    function normalizeWaPhone(raw) {
        let d = String(raw || '')
            .replace(/[\u0660-\u0669]/g, (c) => String(c.charCodeAt(0) - 0x0660))
            .replace(/[\u06F0-\u06F9]/g, (c) => String(c.charCodeAt(0) - 0x06F0))
            .replace(/\D/g, '');
        if (!d) return DEFAULT_WA_PHONE;
        if (d.startsWith('0020')) d = d.slice(2);
        else if (d.startsWith('01') && d.length === 11) d = '2' + d;
        else if (d.startsWith('1') && d.length === 10) d = '20' + d;
        return d.length >= 11 ? d : DEFAULT_WA_PHONE;
    }

    function getPageContextualMessage() {
        const path = String(location.pathname || '').toLowerCase();
        if (path.includes('track')) return 'أهلاً، لدي استفسار بخصوص طلبي في سمان ههيا.';
        if (path.includes('reviews')) return 'أهلاً سمان ههيا، شفت آراء العملاء وحابب أستفسر وأطلب.';
        if (path.includes('kitchen')) return 'أهلاً سمان ههيا، حابب أستفسر عن السمان ووصفات المطبخ.';
        return 'أهلاً سمان ههيا، حابب أستفسر عن السمان المتاح والأسعار.';
    }

    function isTrackPage() {
        return String(location.pathname || '').toLowerCase().includes('track');
    }

    function hasBottomCartBar() {
        return Boolean(document.getElementById('bottom-cart-bar'));
    }

    function injectFloatingWaStyles() {
        if (document.getElementById('sman-floating-wa-css')) return;
        const style = document.createElement('style');
        style.id = 'sman-floating-wa-css';
        style.textContent = `
            #floating-wa.sman-wa-fab {
                position: fixed !important;
                width: ${BTN_SIZE}px !important;
                height: ${BTN_SIZE}px !important;
                border-radius: 9999px !important;
                background: linear-gradient(135deg, #25D366 0%, #16a34a 100%) !important;
                color: #ffffff !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                box-shadow: 0 10px 26px rgba(22, 163, 74, 0.38), 0 0 0 3px rgba(255, 255, 255, 0.92) !important;
                z-index: 45 !important;
                cursor: grab !important;
                touch-action: none !important;
                user-select: none !important;
                -webkit-user-select: none !important;
                -webkit-touch-callout: none !important;
                text-decoration: none !important;
                bottom: auto !important;
                right: auto !important;
                will-change: left, top, transform;
            }
            #floating-wa.sman-wa-fab.sman-wa-snapping {
                transition: left 0.26s cubic-bezier(0.22, 1, 0.36, 1), top 0.26s cubic-bezier(0.22, 1, 0.36, 1), transform 0.18s ease, box-shadow 0.18s ease !important;
            }
            #floating-wa.sman-wa-fab.sman-wa-dragging {
                cursor: grabbing !important;
                transform: scale(1.1) !important;
                box-shadow: 0 16px 34px rgba(15, 23, 42, 0.32), 0 0 0 4px rgba(250, 204, 21, 0.9) !important;
                transition: transform 0.12s ease, box-shadow 0.12s ease !important;
            }
            #floating-wa.sman-wa-fab:not(.sman-wa-dragging):hover {
                transform: scale(1.06);
            }
            #floating-wa.sman-wa-fab::before {
                content: '';
                position: absolute;
                inset: -4px;
                border-radius: 9999px;
                border: 2px solid rgba(37, 211, 102, 0.45);
                animation: smanWaPulse 2.4s ease-out infinite;
                pointer-events: none;
            }
            #floating-wa.sman-wa-fab.sman-wa-dragging::before {
                animation: none !important;
                opacity: 0 !important;
            }
            @keyframes smanWaPulse {
                0%   { transform: scale(0.95); opacity: 0.75; }
                75%  { transform: scale(1.28); opacity: 0; }
                100% { transform: scale(1.28); opacity: 0; }
            }
            #floating-wa.sman-wa-fab svg {
                width: 31px;
                height: 31px;
                fill: currentColor;
                pointer-events: none;
                display: block;
            }
            #floating-wa.sman-wa-fab i {
                pointer-events: none;
            }
        `;
        document.head.appendChild(style);
    }

    function createOrAdoptButton() {
        let btn = document.getElementById('floating-wa');
        const msg = getPageContextualMessage();
        const defaultHref = `https://wa.me/${DEFAULT_WA_PHONE}?text=${encodeURIComponent(msg)}`;

        if (!btn) {
            btn = document.createElement('a');
            btn.id = 'floating-wa';
            btn.href = defaultHref;
            btn.target = '_blank';
            btn.rel = 'noopener noreferrer';
            btn.title = 'تواصل واتساب مع سمان ههيا (اسحب لتغيير المكان)';
            btn.setAttribute('aria-label', 'تواصل واتساب مع سمان ههيا');
            btn.innerHTML = `<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16.01 3C8.84 3 3 8.83 3 16c0 2.3.6 4.54 1.75 6.52L3 29l6.66-1.74A12.94 12.94 0 0 0 16.01 29C23.17 29 29 23.17 29 16S23.17 3 16.01 3zm0 23.62c-2.06 0-4.08-.55-5.85-1.6l-.42-.25-3.95 1.03 1.06-3.85-.27-.44A10.56 10.56 0 0 1 5.38 16c0-5.86 4.77-10.62 10.63-10.62 5.86 0 10.62 4.76 10.62 10.62 0 5.86-4.76 10.62-10.62 10.62zm5.83-7.95c-.32-.16-1.89-.93-2.18-1.04-.29-.11-.5-.16-.72.16-.21.32-.82 1.04-1.01 1.25-.19.21-.37.24-.69.08-.32-.16-1.35-.5-2.57-1.59-.95-.85-1.59-1.9-1.78-2.22-.19-.32-.02-.49.14-.65.14-.14.32-.37.48-.56.16-.19.21-.32.32-.53.11-.21.05-.4-.03-.56-.08-.16-.72-1.73-.98-2.37-.26-.62-.52-.54-.72-.55h-.61c-.21 0-.56.08-.85.4-.29.32-1.12 1.09-1.12 2.66 0 1.57 1.15 3.09 1.31 3.3.16.21 2.26 3.45 5.47 4.84.76.33 1.36.53 1.82.68.77.24 1.46.21 2.01.13.61-.09 1.89-.77 2.16-1.52.27-.75.27-1.38.19-1.52-.08-.13-.29-.21-.61-.37z"/></svg>`;
            document.body.appendChild(btn);
        } else {
            btn.title = 'تواصل واتساب مع سمان ههيا (اسحب لتغيير المكان)';
            if (!btn.getAttribute('href') || btn.getAttribute('href') === '#') {
                btn.href = defaultHref;
            }
        }

        btn.classList.add('sman-wa-fab');
        btn.setAttribute('draggable', 'false');
        return btn;
    }

    function syncLiveStorePhone(btn) {
        if (!btn || isTrackPage()) return;
        try {
            if (typeof firebase === 'undefined' || typeof firebase.firestore !== 'function') return;
            const fsDb = (typeof db !== 'undefined' && db) ? db : firebase.firestore();
            fsDb.collection('inventory').doc('settings').get().then((snap) => {
                if (!snap || !snap.exists) return;
                const s = snap.data() || {};
                if (s.storePhone) {
                    const waPhone = normalizeWaPhone(s.storePhone);
                    btn.href = `https://wa.me/${waPhone}?text=${encodeURIComponent(getPageContextualMessage())}`;
                }
            }).catch(() => {});
        } catch (e) {}
    }

    function getClampedBounds(left, top) {
        const vw = window.innerWidth || document.documentElement.clientWidth || 360;
        const vh = window.innerHeight || document.documentElement.clientHeight || 640;
        const bottomSafe = hasBottomCartBar() ? 86 : 18;
        const minLeft = EDGE_MARGIN;
        const maxLeft = Math.max(EDGE_MARGIN, vw - BTN_SIZE - EDGE_MARGIN);
        const minTop = TOP_SAFE;
        const maxTop = Math.max(TOP_SAFE, vh - BTN_SIZE - bottomSafe);

        return {
            left: Math.min(Math.max(left, minLeft), maxLeft),
            top: Math.min(Math.max(top, minTop), maxTop),
            vw,
            vh,
            minLeft,
            maxLeft,
            minTop,
            maxTop
        };
    }

    function applyInitialOrSavedPosition(btn) {
        const vw = window.innerWidth || document.documentElement.clientWidth || 360;
        const vh = window.innerHeight || document.documentElement.clientHeight || 640;
        const defaultBottomOffset = hasBottomCartBar() ? 92 : 22;

        let targetLeft = EDGE_MARGIN;
        let targetTop = vh - BTN_SIZE - defaultBottomOffset;

        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const saved = JSON.parse(raw);
                if (saved && typeof saved.topPct === 'number') {
                    targetLeft = (saved.side === 'right') ? (vw - BTN_SIZE - EDGE_MARGIN) : EDGE_MARGIN;
                    targetTop = saved.topPct * vh;
                }
            }
        } catch (e) {}

        const clamped = getClampedBounds(targetLeft, targetTop);
        btn.style.left = `${Math.round(clamped.left)}px`;
        btn.style.top = `${Math.round(clamped.top)}px`;
    }

    function savePosition(left, top) {
        try {
            const vw = window.innerWidth || document.documentElement.clientWidth || 360;
            const vh = window.innerHeight || document.documentElement.clientHeight || 640;
            const side = (left + BTN_SIZE / 2) >= (vw / 2) ? 'right' : 'left';
            const topPct = Math.max(0.08, Math.min(0.92, top / vh));
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ side, topPct }));
        } catch (e) {}
    }

    function attachDragController(btn) {
        let isPointerDown = false;
        let hasDragged = false;
        let activePointerId = null;
        let startX = 0;
        let startY = 0;
        let startLeft = 0;
        let startTop = 0;
        let blockNextClickUntil = 0;

        btn.addEventListener('dragstart', (e) => e.preventDefault());

        btn.addEventListener('pointerdown', (e) => {
            if (e.pointerType === 'mouse' && e.button !== 0) return;
            isPointerDown = true;
            hasDragged = false;
            activePointerId = e.pointerId;
            startX = e.clientX;
            startY = e.clientY;
            const rect = btn.getBoundingClientRect();
            startLeft = rect.left;
            startTop = rect.top;
            btn.classList.remove('sman-wa-snapping');
            try { btn.setPointerCapture(e.pointerId); } catch (err) {}
        });

        btn.addEventListener('pointermove', (e) => {
            if (!isPointerDown || e.pointerId !== activePointerId) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;

            if (!hasDragged && Math.hypot(dx, dy) >= DRAG_THRESHOLD) {
                hasDragged = true;
                btn.classList.add('sman-wa-dragging');
            }

            if (hasDragged) {
                const clamped = getClampedBounds(startLeft + dx, startTop + dy);
                btn.style.left = `${Math.round(clamped.left)}px`;
                btn.style.top = `${Math.round(clamped.top)}px`;
            }
        });

        function finishDrag(e) {
            if (!isPointerDown || (activePointerId !== null && e.pointerId !== activePointerId)) return;
            isPointerDown = false;
            try { btn.releasePointerCapture(e.pointerId); } catch (err) {}
            activePointerId = null;

            if (hasDragged) {
                blockNextClickUntil = Date.now() + 350;
                btn.classList.remove('sman-wa-dragging');
                btn.classList.add('sman-wa-snapping');

                const rect = btn.getBoundingClientRect();
                const bounds = getClampedBounds(rect.left, rect.top);
                const snapLeft = (rect.left + BTN_SIZE / 2) >= (bounds.vw / 2) ? bounds.maxLeft : bounds.minLeft;

                btn.style.left = `${Math.round(snapLeft)}px`;
                btn.style.top = `${Math.round(bounds.top)}px`;
                savePosition(snapLeft, bounds.top);
            }
        }

        btn.addEventListener('pointerup', finishDrag);
        btn.addEventListener('pointercancel', finishDrag);

        btn.addEventListener('click', (e) => {
            if (hasDragged || Date.now() < blockNextClickUntil) {
                e.preventDefault();
                e.stopPropagation();
                hasDragged = false;
            }
        }, true);

        let resizeTimer = null;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => {
                btn.classList.add('sman-wa-snapping');
                applyInitialOrSavedPosition(btn);
            }, 120);
        });
    }

    function bootFloatingWa() {
        injectFloatingWaStyles();
        const btn = createOrAdoptButton();
        applyInitialOrSavedPosition(btn);
        attachDragController(btn);
        syncLiveStorePhone(btn);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bootFloatingWa);
    } else {
        bootFloatingWa();
    }
})();
