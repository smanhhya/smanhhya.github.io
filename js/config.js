// js/config.js

// مفتاح ربط الإيميل (Web3Forms) الجديد بتاعك
const WEB3FORMS_ACCESS_KEY = "29c14342-5ab0-4c2a-a57d-16f2e2bac1d8";

// قاموس النصوص الأساسية اللي تقدر تعدلها من لوحة التحكم (تم تنظيفه من الزوائد القديمة)
const textsConfig = [
    { id: 'cartTotalLabel', label: 'إجمالي السلة (الشريط السفلي)', default: 'الإجمالي (بدون التوصيل)' },
    { id: 'viewCartBtn', label: 'زر عرض السلة', default: 'عرض السلة' },
    { id: 'checkoutTitle', label: 'عنوان إتمام الحجز', default: 'سلة المشتريات' },
    { id: 'promoBtn', label: 'زر تفعيل الخصم', default: 'تفعيل' },
    { id: 'subtotalLabel', label: 'قيمة الطلبات', default: 'قيمة الطلبات:' },
    { id: 'deliveryLabel', label: 'مصاريف التوصيل', default: 'مصاريف التوصيل:' },
    { id: 'finalTotalLabel', label: 'الإجمالي المطلوب', default: 'الإجمالي النهائي:' },
    { id: 'menuTitle', label: 'عنوان قائمة المنتجات', default: 'قائمة الأطباق' },
    { id: 'extrasTitle', label: 'عنوان منتجات أخرى', default: 'منتجات أخرى' },
    { id: 'addBtn', label: 'زر الإضافة للسلة', default: 'إضافة للسلة' },
    { id: 'vipBtn', label: 'زر حجز VIP', default: 'حجز للدفعة القادمة' },
    { id: 'closedBtn', label: 'زر المتجر مغلق', default: 'مغلق' },
    { id: 'emptyCartMsg', label: 'رسالة السلة الفارغة', default: 'السلة فارغة' },
    { id: 'emptyMenuMsg', label: 'رسالة عدم وجود منتجات', default: 'لا توجد منتجات حالياً' }
];

// الإعدادات الافتراضية للموقع (تم إضافة الكتالوج والإشعارات وشريط الأخبار)
let globalSettings = {
    storeOpen: true,
    storeName: "سمان ههيا",
    storeDesc: "مرحباً بك في متجر سمان ههيا.. نضمن لك أعلى جودة ونظافة.",
    storePhone: "01208027294",
    minOrder: 0,
    freeDeliveryActive: false, 
    freeDeliveryThreshold: 500,
    
    // إعدادات شريط الأخبار المتحرك
    bannerActive: true, 
    bannerText: "متاح الآن حجز أوردرات - الكمية محدودة!", // اختياري للنسخ القديمة
    marqueeMessages: [
        "🔥 متاح الآن حجز أوردرات - الكمية محدودة!",
        "🚚 توصيل مجاني للطلبات فوق 500 ج.م",
        "🌿 سمان ههيا.. طازج، صحي، ومضمون 100%"
    ],
    
    // إعدادات كتالوج الصور (السلايدر)
    galleryImages: [
        "all-sizes.jpg" // صورتك القديمة كأول سلايد
    ],
    
    // إعدادات الإشعارات الحية (Social Proof)
    liveNotiActive: true,
    liveNotiNames: ["أحمد", "محمد", "محمود", "كريم", "مصطفى", "علي", "سارة", "نورهان", "إبراهيم", "طارق", "يوسف", "عمر"],
    liveNotiPlaces: ["الزقازيق", "ههيا", "أبو كبير", "ديرب نجم", "الإبراهيمية", "فاقوس", "القنايات", "بلبيس", "منيا القمح"],

    crossSellActive: true, 
    crossSellProductId: 'eggs',
    promoCodes: [], 
    bestSellers: ['super'],
    showPromoField: true, 
    successTitle: "تم استلام الأوردر! 🎉",
    successMessage: "شكراً لثقتك في سمان ههيا.. الأوردر وصل للسيستم بنجاح وهنجهزهولك فوراً. هنتواصل معاك قريباً للتأكيد.",
    rewardActive: false, 
    rewardType: "fixed", 
    rewardValue: 20, 
    rewardMaxDiscount: 0,
    rewardMaxGenerations: 0,
    whatsappTemplate: "السلام عليكم، أريد تأكيد حجزي:\n\n📋 *بيانات العميل:*\n{تفاصيل_العميل}\n\n🛒 *الطلبات:*\n{الطلبات}\n{الخصم}═════════════════\n📦 قيمة الطلبات: {قيمة_الطلبات} ج.م\n🚚 رسوم التوصيل: {التوصيل}\n💰 *الإجمالي النهائي: {الاجمالي} ج.م*\n\n(في انتظار تأكيد الحجز وموعد الاستلام)",
    ticktickTemplate: "🧾 **تفاصيل الأوردر كاملة:**\n👤 الاسم: {اسم_العميل}\n📱 الموبايل: {الموبايل}\n📍 المنطقة: {المنطقة}\n{العنوان}\n🕒 الوقت: {الوقت}\n--------------------------------\n🛒 الطلبات:\n{تفاصيل_الطلبات}\n--------------------------------\n📦 قيمة الطلبات: {قيمة_الطلبات} ج.م\n{الخصم}🚚 رسوم التوصيل: {التوصيل}\n💰 الإجمالي النهائي: {الاجمالي} ج.م\n{ملاحظات}\n{الهاشتاجات}",
    vipWhatsappTemplate: "السلام عليكم،\nأريد الانضمام لقائمة الـ VIP وحجز ({اسم_المنتج}) من الدفعة القادمة قبل نزولها المتجر. 👑",
    dispatchTemplate: "📦 طلب جديد من {اسم_العميل}\n📱 {رقم_العميل}\n📍 {المنطقة} - {العنوان}\n🛒 الطلبات:\n{تفاصيل_الطلبات}\n💰 إجمالي الطلب: {إجمالي_الطلب} ج.م\n🚚 التوصيل: {التوصيل}\n⭐ الإجمالي النهائي: {الإجمالي_النهائي} ج.م",
    batchHashtag: "",
    autoPromoModalMsg: "تم إصدار كود خصم خاص بك لطلبك القادم 🎁",
    uiTexts: {}
};

// المنتجات الافتراضية بأوزانها الصحيحة والمضبوطة
let productsInfo = {
    'super': { name: 'طبق سوبر', basePrice: 100, weight: '300-350 جم', images: ['super.png'], isExtra: false },
    'jumbo': { name: 'طبق جامبو', basePrice: 110, weight: '350-400 جم', images: ['jumbo.png'], isExtra: false },
    'special': { name: 'طبق سبشيال', basePrice: 120, weight: '400-450 جم', images: ['special.png'], isExtra: false },
    'superspecial': { name: 'سوبر سبشيال', basePrice: 130, weight: '450-500 جم', images: ['superspecial.png'], isExtra: false },
    'eggs': { name: 'طبق بيض سمان', basePrice: 50, weight: 'طبق 18 بيضة', images: ['eggs.jpg'], isExtra: true },
    'chicks': { name: 'كتاكيت سمان', basePrice: 8, weight: 'كتكوت', images: ['chicks.jpg'], isExtra: true } 
};

// --- تهيئة المتغيرات الأساسية للموقع (State Variables) ---
let globalStock = {}; 
let globalPrices = {}; 
let globalOldPrices = {}; 
let globalDiscounts = {}; 
let globalDeliveryZones = [{ id: 'z1', name: 'ههيا', price: 15 }, { id: 'other', name: 'مكان آخر', price: 0 }];

let dailyStats = { sales: 0, orders: 0 };
let tempAdminZones = []; 
let tempPromoCodes = []; 
let tempProducts = {};
let cart = {}; 
let appliedPromo = null; 
let db = null; 
let hasCloud = false; 
let isStoreDataLoaded = false;
let dispatchOrdersList = [];
