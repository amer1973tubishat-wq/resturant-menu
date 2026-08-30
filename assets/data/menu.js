/* =========================================================
   شيف هاشم — بيانات القائمة
   Chef Hashem — menu data (single source of truth)

   هذا الملف هو المصدر الوحيد لمحتوى القائمة. عدّله يدوياً،
   أو استخدم لوحة التحكم (admin.html) ثم نزّل نسخة محدّثة
   واستبدل بها هذا الملف.

   This file is loaded with a plain <script> tag rather than
   fetched as JSON, so the site also works when opened straight
   from disk (file:// blocks fetch).
   ========================================================= */
window.MENU_DATA = {
  "version": 1,

  "restaurant": {
    "name": "شيف هاشم",
    "nameLatin": "Chef Hashem",
    "tagline": "برجر مشوي على الفحم · منذ 2014",
    "phone": "+966551234567",
    "phoneDisplay": "+966 55 123 4567",
    "whatsapp": "966551234567",
    "email": "hello@chefhashem.example",
    "addressLine1": "شارع الأمير سلطان، حي العليا",
    "addressLine2": "الرياض، المملكة العربية السعودية",
    "mapUrl": "https://maps.google.com/?q=Riyadh",
    "currency": "ر.س",
    "whatsappMessage": "مرحباً {name}، أود الطلب من القائمة.",
    "instagram": "#",
    "tiktok": "#",
    "x": "#",
    "hours": [
      { "day": "الأحد – الخميس", "time": "12:00 ظهراً – 1:00 فجراً" },
      { "day": "الجمعة", "time": "1:00 ظهراً – 2:00 فجراً" },
      { "day": "السبت", "time": "12:00 ظهراً – 2:00 فجراً" },
      { "day": "إغلاق المطبخ", "time": "قبل الإغلاق بنصف ساعة" }
    ]
  },

  "categories": [
    { "id": "beef",    "name": "برجر اللحم" },
    { "id": "chicken", "name": "برجر الدجاج" },
    { "id": "combo",   "name": "الوجبات" },
    { "id": "sides",   "name": "الإضافات" },
    { "id": "drinks",  "name": "المشروبات" },
    { "id": "sweets",  "name": "الحلويات" }
  ],

  "items": [
    {
      "id": "beef-double", "category": "beef", "featured": true,
      "name": "برجر هاشم المزدوج",
      "desc": "قطعتا لحم مشويتان على الفحم، جبن شيدر معتّق، صلصة هاشم الخاصة، بصل مخلل، وخبز محمّص بالزبدة.",
      "price": 45, "image": "thumb-burger.svg",
      "badge": "الأكثر مبيعاً", "badgeStyle": "hot",
      "tags": ["حار قليلاً", "مزدوج"]
    },
    {
      "id": "beef-blue", "category": "beef", "featured": false,
      "name": "برجر الجبن الأزرق",
      "desc": "لحم معتّق 28 يوماً، جبن أزرق ذائب، مربّى البصل، بصل مقرمش، وجرجير طازج.",
      "price": 49, "image": "thumb-burger.svg",
      "badge": "", "badgeStyle": "hot",
      "tags": ["لحم معتّق"]
    },
    {
      "id": "beef-brisket", "category": "beef", "featured": false,
      "name": "برجر البريسكِت المدخّن",
      "desc": "قرص لحم مشوي فوقه بريسكِت مدخّن 12 ساعة، سلطة كول سلو، وصلصة الباربكيو بالخردل.",
      "price": 55, "image": "thumb-burger.svg",
      "badge": "", "badgeStyle": "hot",
      "tags": ["مدخّن", "دسم"]
    },
    {
      "id": "beef-smash", "category": "beef", "featured": false,
      "name": "سماش كلاسيك",
      "desc": "قرص لحم مسحوق على الصاج بحواف مقرمشة، جبن شيدر، بصل مفروم، مخلل، وصلصة البيت.",
      "price": 32, "image": "thumb-burger.svg",
      "badge": "", "badgeStyle": "hot",
      "tags": ["جاهز خلال 10 دقائق"]
    },
    {
      "id": "beef-triple", "category": "beef", "featured": false,
      "name": "سماش ثلاثي",
      "desc": "ثلاثة أقراص لحم بحواف مقرمشة، ثلاث شرائح جبن، بصل مشوي، ومخلل الشبت.",
      "price": 47, "image": "thumb-burger.svg",
      "badge": "", "badgeStyle": "hot",
      "tags": ["ثلاثي"]
    },
    {
      "id": "beef-jalapeno", "category": "beef", "featured": false,
      "name": "سماش الهالبينو",
      "desc": "سماش مزدوج، جبن بيبر جاك، هالبينو مشوي، صلصة الشيبوتلي، ورقائق التورتيلا.",
      "price": 38, "image": "thumb-burger.svg",
      "badge": "", "badgeStyle": "hot",
      "tags": ["حار جداً"]
    },
    {
      "id": "beef-mushroom", "category": "beef", "featured": false,
      "name": "برجر الفطر والجبن السويسري",
      "desc": "لحم مشوي، فطر مقلي بالزبدة والثوم، جبن سويسري ذائب، وصلصة الترافل.",
      "price": 46, "image": "thumb-burger.svg",
      "badge": "جديد", "badgeStyle": "new",
      "tags": ["جديد"]
    },

    {
      "id": "chicken-crispy", "category": "chicken", "featured": true,
      "name": "برجر الدجاج المقرمش",
      "desc": "صدر دجاج متبّل بالبابريكا ومقلي حتى القرمشة، مخلل، صلصة الثوم، وخس طازج.",
      "price": 36, "image": "thumb-chicken.svg",
      "badge": "مفضّل الضيوف", "badgeStyle": "hot",
      "tags": ["مقرمش"]
    },
    {
      "id": "chicken-grilled", "category": "chicken", "featured": false,
      "name": "برجر الدجاج المشوي",
      "desc": "صدر دجاج مشوي على الفحم، أفوكادو، طماطم، وصلصة الزبادي بالأعشاب.",
      "price": 34, "image": "thumb-chicken.svg",
      "badge": "", "badgeStyle": "hot",
      "tags": ["خيار خفيف"]
    },
    {
      "id": "chicken-buffalo", "category": "chicken", "featured": false,
      "name": "برجر الدجاج الحار",
      "desc": "دجاج مقرمش مغموس بصلصة بافلو الحارة، جبن ذائب، وصلصة الرانش المبرّدة.",
      "price": 38, "image": "thumb-chicken.svg",
      "badge": "", "badgeStyle": "hot",
      "tags": ["حار جداً"]
    },
    {
      "id": "chicken-zinger", "category": "chicken", "featured": false,
      "name": "برجر الزنجر بالجبن",
      "desc": "شرائح دجاج مقرمشة، جبن شيدر مضاعف، خس، وصلصة المايونيز بالليمون.",
      "price": 39, "image": "thumb-chicken.svg",
      "badge": "", "badgeStyle": "hot",
      "tags": ["مضاعف الجبن"]
    },
    {
      "id": "veggie", "category": "chicken", "featured": false,
      "name": "برجر الخضار",
      "desc": "قرص فاصولياء سوداء وشمندر مشوي، صلصة البابريكا المدخّنة، أفوكادو، وطماطم بلدية.",
      "price": 30, "image": "thumb-salad.svg",
      "badge": "نباتي", "badgeStyle": "veg",
      "tags": ["نباتي", "خبز خالٍ من الجلوتين +5 ر.س"]
    },

    {
      "id": "combo-hashem", "category": "combo", "featured": true,
      "name": "وجبة هاشم",
      "desc": "برجر هاشم المزدوج مع بطاطس مقطّعة يدوياً ومشروب غازي أو ليموناضة.",
      "price": 62, "image": "thumb-combo.svg",
      "badge": "وفّر 12", "badgeStyle": "hot",
      "tags": ["وجبة كاملة"]
    },
    {
      "id": "combo-smash", "category": "combo", "featured": false,
      "name": "وجبة السماش",
      "desc": "سماش كلاسيك مع بطاطس مقطّعة يدوياً ومشروب. الخيار الأسرع في القائمة.",
      "price": 48, "image": "thumb-combo.svg",
      "badge": "", "badgeStyle": "hot",
      "tags": ["سريعة"]
    },
    {
      "id": "combo-chicken", "category": "combo", "featured": false,
      "name": "وجبة الدجاج المقرمش",
      "desc": "برجر الدجاج المقرمش مع بطاطس وحلقات بصل ومشروب.",
      "price": 55, "image": "thumb-combo.svg",
      "badge": "", "badgeStyle": "hot",
      "tags": ["وجبة كاملة"]
    },
    {
      "id": "combo-family", "category": "combo", "featured": false,
      "name": "وجبة العائلة",
      "desc": "أربعة برجر من اختيارك، طبقا بطاطس كبيران، حلقات بصل، وأربعة مشروبات.",
      "price": 165, "image": "thumb-combo.svg",
      "badge": "", "badgeStyle": "hot",
      "tags": ["تكفي 4 أشخاص", "للمشاركة"]
    },

    {
      "id": "side-fries", "category": "sides", "featured": false,
      "name": "بطاطس مقطّعة يدوياً",
      "desc": "بطاطس تُقطّع كل صباح وتُقلى مرتين، ملح بإكليل الجبل، وكاتشب مدخّن جانباً.",
      "price": 18, "image": "thumb-fries.svg",
      "badge": "", "badgeStyle": "hot",
      "tags": ["نباتي"]
    },
    {
      "id": "side-loaded", "category": "sides", "featured": false,
      "name": "بطاطس هاشم المحمّلة",
      "desc": "بطاطس مغطاة بصلصة الجبن، قطع لحم مدخّن، بصل أخضر، وفلفل مخلل.",
      "price": 29, "image": "thumb-fries.svg",
      "badge": "", "badgeStyle": "hot",
      "tags": ["للمشاركة"]
    },
    {
      "id": "side-rings", "category": "sides", "featured": false,
      "name": "حلقات البصل",
      "desc": "حلقات بصل حلو سميكة بخليط اللبن الرائب، مقلية حتى الذهبية، مع صلصة الرانش.",
      "price": 22, "image": "thumb-rings.svg",
      "badge": "", "badgeStyle": "hot",
      "tags": ["نباتي"]
    },
    {
      "id": "side-corn", "category": "sides", "featured": false,
      "name": "ذرة مشوية بالزبدة",
      "desc": "أرباع ذرة مشوية على الفحم، زبدة الليمون، جبن مبشور، ورشة فلفل أحمر.",
      "price": 24, "image": "thumb-fries.svg",
      "badge": "", "badgeStyle": "hot",
      "tags": ["نباتي", "خالٍ من الجلوتين"]
    },
    {
      "id": "side-salad", "category": "sides", "featured": false,
      "name": "سلطة جانبية",
      "desc": "خس روماني، طماطم كرزية، خيار، بصل أحمر، وصلصة الليمون والزيت.",
      "price": 19, "image": "thumb-salad.svg",
      "badge": "", "badgeStyle": "hot",
      "tags": ["نباتي", "خفيف"]
    },
    {
      "id": "side-cheese-fries", "category": "sides", "featured": false,
      "name": "بطاطس بالجبن",
      "desc": "بطاطس مقطّعة يدوياً مغمورة بصلصة الجبن الشيدر الساخنة.",
      "price": 24, "image": "thumb-fries.svg",
      "badge": "", "badgeStyle": "hot",
      "tags": ["نباتي"]
    },

    {
      "id": "drink-malt", "category": "drinks", "featured": false,
      "name": "ميلك شيك بالمالت المملّح",
      "desc": "كاسترد مثلج، شعير مالت، ملح البحر، وكريمة مخفوقة. كثيف بحيث تقف الملعقة فيه.",
      "price": 26, "image": "thumb-shake.svg",
      "badge": "", "badgeStyle": "hot",
      "tags": ["كثيف"]
    },
    {
      "id": "drink-honey", "category": "drinks", "featured": false,
      "name": "ميلك شيك بالعسل المحروق",
      "desc": "عسل مكرمل على النار، كاسترد الفانيلا، وفتات الشوفان المحمّص.",
      "price": 28, "image": "thumb-shake.svg",
      "badge": "", "badgeStyle": "hot",
      "tags": ["موسمي"]
    },
    {
      "id": "drink-soda", "category": "drinks", "featured": false,
      "name": "مشروب غازي",
      "desc": "تشكيلة مشروبات غازية مثلجة، مع تعبئة مجانية داخل الفرع.",
      "price": 12, "image": "thumb-soda.svg",
      "badge": "", "badgeStyle": "hot",
      "tags": ["تعبئة مجانية"]
    },
    {
      "id": "drink-lemonade", "category": "drinks", "featured": false,
      "name": "ليموناضة بالنعناع",
      "desc": "ليمون طازج يُعصر عند الطلب، نعناع مهروس، وثلج مجروش.",
      "price": 16, "image": "thumb-soda.svg",
      "badge": "", "badgeStyle": "hot",
      "tags": ["منعش"]
    },
    {
      "id": "drink-water", "category": "drinks", "featured": false,
      "name": "مياه معدنية",
      "desc": "عبوة 600 مل، مبرّدة.",
      "price": 4, "image": "thumb-soda.svg",
      "badge": "", "badgeStyle": "hot",
      "tags": []
    },

    {
      "id": "sweet-pie", "category": "sweets", "featured": false,
      "name": "فطيرة التفاح المحمّرة",
      "desc": "فطيرة تُحمَّر بالزبدة على الصاج، سكر بالقرفة، وكراميل دافئ.",
      "price": 24, "image": "thumb-dessert.svg",
      "badge": "", "badgeStyle": "hot",
      "tags": ["تكفي شخصين"]
    },
    {
      "id": "sweet-sundae", "category": "sweets", "featured": false,
      "name": "صنداي الكامب فاير",
      "desc": "مارشميلو محروق على النار، طبقة شوكولاتة داكنة، وفتات بسكويت الجراهام.",
      "price": 27, "image": "thumb-dessert.svg",
      "badge": "", "badgeStyle": "hot",
      "tags": ["نباتي"]
    },
    {
      "id": "sweet-kunafa", "category": "sweets", "featured": false,
      "name": "كنافة بالجبن",
      "desc": "كنافة طازجة بالجبن تُخبز عند الطلب، قطر بماء الزهر، وفستق حلبي.",
      "price": 29, "image": "thumb-dessert.svg",
      "badge": "", "badgeStyle": "hot",
      "tags": ["حلوى شرقية"]
    }
  ]
};
