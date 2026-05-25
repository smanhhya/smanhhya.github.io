// js/config.js
const WEB3FORMS_ACCESS_KEY = "d8e4b3fe-018c-4c39-b15f-191ccc7cf10c";

const textsConfig = [
    { id: 'cartTotalLabel', label: 'إجمالي السلة (الشريط السفلي)', default: 'الإجمالي (بدون التوصيل)' },
    { id: 'viewCartBtn', label: 'زر عرض السلة', default: 'عرض السلة' },
    { id: 'checkoutTitle', label: 'عنوان إتمام الحجز', default: 'إتمام الحجز' },
    { id: 'tabNewCust', label: 'تبويب عميل جديد', default: 'أول مرة تطلب مننا؟ 😍' },
    { id: 'tabOldCust', label: 'تبويب عميل سابق', default: 'طلبت مننا قبل كده؟ 😎' },
    { id: 'zoneLabel', label: 'تسمية منطقة التوصيل', default: 'منطقة التوصيل' },
    { id: 'nameLabel', label: 'تسمية الاسم', default: 'اسم حضرتك' },
    { id: 'phoneLabel', label: 'تسمية الموبايل', default: 'رقم الموبايل' },
    { id: 'addressLabel', label: 'تسمية العنوان', default: 'العنوان بالتفصيل (اختياري)' },
    { id: 'oldCustMsg', label: 'رسالة العميل السابق (تلميح)', default: 'اكتب رقمك المسجل، والأوردر هيتم تأكيده في السيستم فوراً بدون أي خطوات إضافية!' },
    { id: 'oldPhoneLabel', label: 'تسمية موبايل العميل السابق', default: 'رقم الموبايل المسجل' },
    { id: 'whatsappCheck', label: 'تأكيد عبر واتساب', default: 'تأكيد عبر الواتساب (اختياري)' },
    { id: 'promoBtn', label: 'زر تفعيل الخصم', default: 'تفعيل' },
    { id: 'subtotalLabel', label: 'قيمة الطلبات', default: 'قيمة الطلبات:' },
    { id: 'deliveryLabel', label: 'مصاريف التوصيل', default: 'مصاريف التوصيل:' },
    { id: 'finalTotalLabel', label: 'الإجمالي المطلوب', default: 'الإجمالي المطلوب:' },
    { id: 'checkoutBtnNew', label: 'زر تأكيد عميل جديد', default: 'تأكيد وإرسال عبر واتساب' },
    { id: 'checkoutBtnOld', label: 'زر تأكيد عميل سابق', default: 'إرسال الأوردر فوراً' },
    { id: 'menuTitle', label: 'عنوان قائمة المنتجات', default: 'قائمة الأطباق' },
    { id: 'extrasTitle', label: 'عنوان منتجات أخرى', default: 'منتجات أخرى' },
    { id: 'addBtn', label: 'زر الإضافة للسلة', default: 'إضافة للسلة' },
    { id: 'vipBtn', label: 'زر حجز VIP', default: 'حجز للدفعة القادمة' },
    { id: 'closedBtn', label: 'زر المتجر مغلق', default: 'مغلق' },
    { id: 'emptyCartMsg', label: 'رسالة السلة الفارغة', default: 'السلة فارغة' },
    { id: 'emptyMenuMsg', label: 'رسالة عدم وجود منتجات', default: 'لا توجد منتجات حالياً' },
    { id: 'checkoutHint', label: 'تلميح استكمال البيانات', default: 'يرجى استكمال البيانات والمنطقة' }
];

let globalSettings = {
    storeOpen: true,
    storeName: "سمان ههيا",
    storeDesc: "مرحباً بك في متجر سمان ههيا.. نضمن لك أعلى جودة ونظافة.",
    storePhone: "01208027294",
    minOrder: 0,
    freeDeliveryActive: false, freeDeliveryThreshold: 500,
    bannerActive: true, bannerText: "متاح الآن حجز أوردرات - الكمية محدودة!",
    crossSellActive: true, crossSellProductId: 'eggs',
    promoCodes: [], bestSellers: ['super'],
    showPromoField: true, 
    successTitle: "تم استلام الأوردر! 🎉",
    successMessage: "شكراً لثقتك في سمان ههيا.. الأوردر وصل للسيستم بنجاح وهنجهزهولك فوراً. هنتواصل معاك قريباً للتأكيد.",
    rewardActive: false, rewardType: "fixed", rewardValue: 20, rewardMaxGenerations: 0,
    oldCustomerLabel: "عميل سابق",
    whatsappTemplate: "السلام عليكم، أريد تأكيد حجزي:\n\n📋 *بيانات العميل:*\n{تفاصيل_العميل}\n\n🛒 *الطلبات:*\n{الطلبات}\n{الخصم}═════════════════\n📦 قيمة الطلبات: {قيمة_الطلبات} ج.م\n🚚 رسوم التوصيل: {التوصيل}\n💰 *الإجمالي النهائي: {الاجمالي} ج.م*\n\n(في انتظار تأكيد الحجز وموعد الاستلام)",
    ticktickTemplate: "🧾 **تفاصيل الأوردر كاملة:**\n👤 الاسم: {اسم_العميل}\n📱 الموبايل: {الموبايل}\n📍 المنطقة: {المنطقة}\n{العنوان}\n🕒 الوقت: {الوقت}\n--------------------------------\n🛒 الطلبات:\n{تفاصيل_الطلبات}\n--------------------------------\n📦 قيمة الطلبات: {قيمة_الطلبات} ج.م\n{الخصم}🚚 رسوم التوصيل: {التوصيل}\n💰 الإجمالي النهائي: {الاجمالي} ج.م\n{ملاحظات}\n{الهاشتاجات}",
    vipWhatsappTemplate: "السلام عليكم،\nأريد الانضمام لقائمة الـ VIP وحجز ({اسم_المنتج}) من الدفعة القادمة قبل نزولها المتجر. 👑",
    batchHashtag: "",
    uiTexts: {}
};

let productsInfo = {
    'super': { name: 'طبق سوبر', basePrice: 100, weight: '300-350 جم', images: ['super.png'], isExtra: false },
    'jumbo': { name: 'طبق جامبو', basePrice: 110, weight: '350-400 جم', images: ['jumbo.png'], isExtra: false },
    'special': { name: 'طبق سبشيال', basePrice: 120, weight: '400-450 جم', images: ['special.png'], isExtra: false },
    'superspecial': { name: 'سوبر سبشيال', basePrice: 130, weight: '450-500 جم', images: ['superspecial.png'], isExtra: false },
    'eggs': { name: 'طبق بيض سمان', basePrice: 50, weight: 'طبق 18 بيضة', images: ['eggs.jpg'], isExtra: true },
    'chicks': { name: 'كتاكيت سمان', basePrice: 8, weight: 'كتكوت', images: ['chicks.jpg'], isExtra: true } 
};

let globalStock = {}; 
let globalPrices = {}; 
let globalOldPrices = {}; 
let globalDiscounts = {}; 
let globalDeliveryZones = [{ id: 'z1', name: 'ههيا', price: 15 }, { id: 'other', name: 'مكان آخر', price: 0 }];

let dailyStats = { sales: 0, orders: 0 };
let tempAdminZones = []; let tempPromoCodes = []; let tempProducts = {};
let cart = {}; let appliedPromo = null; 
let db = null; let hasCloud = false; let customerType = 'new'; 
let isStoreDataLoaded = false; 
