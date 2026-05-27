// ملف theme-manager.js

// 1. دالة لتغيير اللون وحفظه
function changeSiteColor(newColor) {
    // بنغير اللون في الموقع فوراً
    document.documentElement.style.setProperty('--primary-color', newColor);
    
    // بنحفظ اللون في ذاكرة المتصفح عشان مايروحش لو عملنا ريفريش
    localStorage.setItem('site_primary_color', newColor);
    
    alert('تم تغيير لون الموقع بنجاح يا ريس!');
}

// 2. دالة بتشتغل أول ما الموقع يفتح عشان تحمل اللون اللي إنت حفظته
function loadSavedColor() {
    let savedColor = localStorage.getItem('site_primary_color');
    if (savedColor) {
        // لو لقينا لون محفوظ، بنطبقه
        document.documentElement.style.setProperty('--primary-color', savedColor);
    }
}

// تشغيل دالة التحميل أول ما الصفحة تفتح
window.onload = loadSavedColor;
