// js/config.js - الإعدادات المركزية وأدوات الأمان المشتركة لمتجر سمان ههيا

// إعدادات الاتصال بقاعدة البيانات (مشتركة بين المتجر وصفحة التتبع)
const FIREBASE_CONFIG = {
    apiKey: "AIzaSyD7ZJP8n8fhMewPfEsTBANn0h9To_q15BY",
    authDomain: "sman-ca8f8.firebaseapp.com",
    projectId: "sman-ca8f8",
    storageBucket: "sman-ca8f8.firebasestorage.app",
    messagingSenderId: "538778803310",
    appId: "1:538778803310:web:5eeff42bae534375a21a7f"
};

// أدوات الأمان والتنسيق المشتركة (حماية ضد XSS + توحيد الأرقام + ترتيب الأصناف)
window.SMAN_UTILS = {
    // تنظيف النصوص قبل عرضها داخل HTML لمنع حقن الأكواد (XSS)
    escapeHtml: function (str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    },

    // تنظيف النصوص المستخدمة داخل خصائص onclick
    escapeJsAttr: function (str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/\\/g, '\\\\')
            .replace(/'/g, "\\'")
            .replace(/"/g, '&quot;')
            .replace(/\n/g, ' ')
            .replace(/\r/g, '');
    },

    // تحويل الأرقام العربية والفارسية إلى إنجليزية وتوحيد رقم الموبايل المصري (01XXXXXXXXX)
    normalizePhone: function (phone) {
        if (!phone) return '';
        let cleaned = String(phone)
            .replace(/[٠١٢٣٤٥٦٧٨٩]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 1632 + 48))
            .replace(/[۰۱۲۳۴۵۶۷۸۹]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 1776 + 48))
            .replace(/\D/g, '');

        if (cleaned.startsWith('00201') && cleaned.length >= 14) cleaned = '0' + cleaned.substring(4);
        else if (cleaned.startsWith('0201') && cleaned.length >= 13) cleaned = '0' + cleaned.substring(3);
        else if (cleaned.startsWith('201') && cleaned.length >= 12) cleaned = '0' + cleaned.substring(2);
        else if (cleaned.length === 10 && cleaned.startsWith('1')) cleaned = '0' + cleaned;

        return cleaned;
    },

    // تنسيق رقم الواتساب الدولي الصحيح لمصر (201XXXXXXXXX)
    formatWaPhone: function (phone) {
        const norm = window.SMAN_UTILS.normalizePhone(phone || '01208027294');
        if (!norm) return '201208027294';
        if (norm.startsWith('0')) return '2' + norm;
        if (norm.startsWith('20')) return norm;
        return '20' + norm;
    },

    // تحليل مصفوفة أوزان الجرام للأصناف المباعة بالوزن (فراخ تسمين / رومي)
    parseWeightsArray: function (rawVal) {
        if (Array.isArray(rawVal)) {
            return rawVal.map((n) => parseFloat(n)).filter((n) => !isNaN(n) && n > 0);
        }
        return String(rawVal || '')
            .split(/[\s,،;\n\r\-]+/)
            .map((w) => parseFloat(w.trim()))
            .filter((w) => !isNaN(w) && w > 0);
    },

    // تصنيف وترتيب الأصناف بنفس الترتيب الموحد في لوحة الـ CRM
    getProductCategoryAndRank: function (id, p) {
        const safeId = String(id || '').toLowerCase();
        const safeName = String(p?.name || '').toLowerCase();

        if (p && p.isWeightBased) {
            let wRank = 50;
            if (safeName.includes('فراخ') || safeName.includes('فرخ') || safeName.includes('تسمين')) wRank = 10;
            else if (safeName.includes('رومي')) wRank = 20;
            else if (safeName.includes('بط')) wRank = 30;
            return { group: 'weight', rank: wRank };
        }

        if (
            p?.isExtra ||
            safeId === 'eggs' || safeId === 'chicks' ||
            safeName.includes('بيض') || safeName.includes('كتكوت') ||
            safeName.includes('كتاكيت') || safeName.includes('عمر')
        ) {
            let ecRank = 50;
            if (safeId === 'eggs' || safeName.includes('بيض')) ecRank = 10;
            else if (safeId === 'chicks' || safeName.includes('كتكوت') || safeName.includes('كتاكيت') || safeName.includes('عمر')) ecRank = 20;
            return { group: 'eggs_chicks', rank: ecRank };
        }

        let qRank = 50;
        if (safeId === 'super' || (safeName.includes('سوبر') && !safeName.includes('سبشيال') && !safeName.includes('اسبيشيال'))) qRank = 10;
        else if (safeId === 'jumbo' || safeName.includes('جامبو')) qRank = 20;
        else if (safeId === 'special' || ((safeName.includes('سبشيال') || safeName.includes('اسبيشيال')) && !safeName.includes('سوبر'))) qRank = 30;
        else if (safeId === 'superspecial' || (safeName.includes('سوبر') && (safeName.includes('سبشيال') || safeName.includes('اسبيشيال')))) qRank = 40;
        else qRank = 50 + (Number(p?.basePrice) || 0) / 1000;

        return { group: 'quail', rank: qRank };
    }
};

// قاموس النصوص الافتراضية القابلة للتخصيص من لوحة الـ CRM
const textsConfig = [
    { id: 'cartTotalLabel', label: 'إجمالي السلة (الشريط السفلي)', default: 'الإجمالي (بدون التوصيل)' },
    { id: 'viewCartBtn', label: 'زر عرض السلة', default: 'عرض السلة' },
    { id: 'checkoutTitle', label: 'عنوان إتمام الحجز', default: 'سلة المشتريات' },
    { id: 'promoBtn', label: 'زر تفعيل الخصم', default: 'تفعيل' },
    { id: 'subtotalLabel', label: 'قيمة الطلبات', default: 'قيمة الطلبات:' },
    { id: 'deliveryLabel', label: 'مصاريف التوصيل', default: 'مصاريف التوصيل:' },
    { id: 'finalTotalLabel', label: 'الإجمالي المطلوب', default: 'الإجمالي النهائي:' },
    { id: 'menuTitle', label: 'عنوان قائمة المنتجات', default: 'سمان مذبوح طازج (بالجوز)' },
    { id: 'extrasTitle', label: 'عنوان منتجات أخرى', default: 'بيض سمان ومنتجات أخرى' },
    { id: 'emptyCartMsg', label: 'رسالة السلة الفارغة', default: 'السلة فارغة حالياً' },
    { id: 'emptyMenuMsg', label: 'رسالة عدم وجود منتجات', default: 'لا توجد منتجات متاحة حالياً' },
    { id: 'successTitle', label: 'عنوان شاشة نجاح الأوردر', default: 'تم تأكيد أوردرك بنجاح! 🎉' },
    { id: 'successMsgTemplate', label: 'نص رسالة النجاح', default: 'أوردرك اتسجل في السيستم عندنا خلاص وهيتم التجهيز والتواصل معاك للتأكيد.' },
    { id: 'waFollowUpBtn', label: 'زر المتابعة واتساب', default: 'التواصل والمتابعة ع الواتساب' },
    { id: 'closeFollowUpBtn', label: 'زر إغلاق شاشة النجاح', default: 'تمام، شكراً 👍' }
];

// الإعدادات الافتراضية للمتجر (تُحدّث تلقائياً من Firebase فور الفتح)
let globalSettings = {
    storeOpen: true,
    storeName: "سمان ههيا",
    storeDesc: "سمان مذبوح طازج بالطلب من المزرعة لطبقك — بدون تجميد وبأعلى معايير النظافة.",
    storePhone: "01208027294",
    minOrder: 0,
    freeDeliveryActive: false,
    freeDeliveryThreshold: 500,
    pointValueInEGP: 0.40,
    heroMessage: "",
    closedMessage: "المتجر مغلق حالياً، نعود قريباً!",

    trustBadges: [
        { icon: 'fa-regular fa-circle-check', title: 'أوزان دقيقة', desc: 'زي ما طلبت بالظبط' },
        { icon: 'fa-solid fa-snowflake', title: 'طازج بالطلب', desc: 'صفر تجميد ومخزون' },
        { icon: 'fa-regular fa-star', title: 'طلبك باسمك', desc: 'بوليصة وتغليف خاص' },
        { icon: 'fa-solid fa-shield-halved', title: 'تغليف آمن', desc: 'أطباق صحية محكمة' }
    ],

    galleryImages: ["all-sizes.jpg"],

    liveNotiActive: true,
    liveNotiNames: ["أحمد", "محمد", "محمود", "كريم", "مصطفى", "علي", "سارة", "نورهان", "إبراهيم", "طارق", "يوسف", "عمر"],
    liveNotiPlaces: ["ههيا", "الزقازيق", "أبو كبير", "الإبراهيمية", "المهدية", "العدوة"],

    crossSellActive: true,
    crossSellProductId: 'eggs',
    promoCodes: [],
    bestSellers: ['super', 'jumbo'],
    showPromoField: true,
    rewardActive: false,
    rewardType: "fixed",
    rewardValue: 20,
    rewardMaxDiscount: 0,
    rewardMaxGenerations: 0,
    whatsappTemplate: "السلام عليكم، أريد تأكيد حجزي من سمان ههيا:\n\n📋 *بيانات العميل:*\n{تفاصيل_العميل}\n\n🛒 *الطلبات:*\n{الطلبات}\n{الخصم}═════════════════\n📦 قيمة الطلبات: {قيمة_الطلبات} ج.م\n🚚 رسوم التوصيل: {التوصيل}\n💰 *الإجمالي النهائي: {الاجمالي} ج.م*\n\n(في انتظار تأكيد الحجز وموعد الاستلام)",
    batchHashtag: "",
    autoPromoModalMsg: "تم إصدار كود خصم خاص بك لطلبك القادم 🎁",
    uiTexts: {}
};

// المنتجات الافتراضية (كاحتياط لحين تحميل أحدث أسعار وأصناف من الـ CRM)
let productsInfo = {
    'super': { name: 'طبق سوبر', basePrice: 110, weight: '300-350 جم', images: ['super.png'], isExtra: false },
    'jumbo': { name: 'طبق جامبو', basePrice: 120, weight: '350-400 جم', images: ['jumbo.png'], isExtra: false },
    'special': { name: 'طبق سبشيال', basePrice: 130, weight: '400-450 جم', images: ['special.png'], isExtra: false },
    'superspecial': { name: 'سوبر سبشيال', basePrice: 140, weight: '450-500 جم', images: ['superspecial.png'], isExtra: false },
    'eggs': { name: 'طبق بيض سمان', basePrice: 50, weight: 'طبق 18 بيضة', images: ['eggs.jpg'], isExtra: true },
    'chicks': { name: 'كتاكيت سمان', basePrice: 8, weight: 'كتكوت عمر يوم', images: ['chicks.jpg'], isExtra: true }
};

// متغيرات حالة المتجر (State Variables)
let globalStock = {};
let globalPrices = {};
let globalOldPrices = {};
let globalDiscounts = {};
let globalBatches = {};
let globalDeliveryZones = [
    { id: 'ههيا', name: 'ههيا', price: 15 },
    { id: 'الزقازيق', name: 'الزقازيق', price: 25 },
    { id: 'أبو كبير', name: 'أبو كبير', price: 25 },
    { id: 'الإبراهيمية', name: 'الإبراهيمية', price: 20 },
    { id: 'المهدية', name: 'المهدية', price: 15 },
    { id: 'العدوة', name: 'العدوة', price: 15 },
    { id: 'مكان آخر', name: 'مكان آخر', price: 0 }
];

let dailyStats = { sales: 0, orders: 0 };
let cart = {};
let appliedPromo = null;
let db = null;
let hasCloud = false;
let isStoreDataLoaded = false;
