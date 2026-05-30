async function runBot() {
    // المفاتيح السرية
    const projectId = process.env.FIREBASE_PROJECT_ID; 
    const phoneId = process.env.PHONE_ID;
    const metaToken = process.env.META_TOKEN;
    const firebaseApiKey = process.env.FIREBASE_API_KEY; // ضفنا المتغير ده

    // الرابط الجديد اللي بيستخدم الـ API Key
    const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/orders?key=${firebaseApiKey}`;

    console.log("🚀 جاري فحص الأوردرات...");

    try {
        const response = await fetch(firestoreUrl);
        const data = await response.json();

        // لو جاب إيرور في القراءة هيطبعه هنا
        if (data.error) {
             console.error("❌ خطأ في الوصول لقاعدة البيانات:", data.error.message);
             return;
        }

        if (!data.documents || data.documents.length === 0) {
            console.log("لا يوجد أوردرات مسجلة حالياً.");
            return;
        }

        // ... (باقي الكود زي ما هو)
        for (const doc of data.documents) {
            const fields = doc.fields;
            
            const customerName = fields.customerName ? fields.customerName.stringValue : "يا فندم";
            const phone = fields.customerPhone ? fields.customerPhone.stringValue : "";
            const status = fields.status ? fields.status.stringValue : ""; 
            const isFollowUpSent = fields.isFollowUpSent ? fields.isFollowUpSent.booleanValue : false;

            if (status === "مكتمل" && !isFollowUpSent && phone) { // عدلتها لـ "مكتمل" زي ما هي في صورتك التانية
                
                let formattedPhone = phone.startsWith("0") ? "2" + phone : phone;
                const messageText = `أهلاً بك ${customerName} 🌟\nنتمنى تكون منتجات سمان ههيا عجبتك!\nعشان دايماً بنسعى نقدم الأفضل، رأيك في الأوردر يهمنا جداً.`;
                const whatsappUrl = `https://graph.facebook.com/v17.0/${phoneId}/messages`;
                
                const metaResponse = await fetch(whatsappUrl, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${metaToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        messaging_product: "whatsapp",
                        to: formattedPhone,
                        type: "text",
                        text: { body: messageText }
                    })
                });

                if (metaResponse.ok) {
                    console.log(`✅ تم إرسال رسالة التقييم للعميل: ${customerName} على الرقم (${formattedPhone})`);
                } else {
                    console.log(`❌ فشل إرسال الرسالة للعميل: ${customerName}`);
                }
            }
        }
        console.log("🏁 انتهت عملية الفحص بنجاح!");
    } catch (error) {
        console.error("❌ حدث خطأ في النظام:", error);
    }
}

runBot();
