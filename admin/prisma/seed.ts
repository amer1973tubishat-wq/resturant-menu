/**
 * Creates the first Super Admin and the baseline content.
 *
 * Safe to re-run: content is upserted by a stable key and the admin account is
 * only created if it is missing, so an existing password is never clobbered.
 */
import { PrismaClient, type Badge } from '@prisma/client';
import { hash } from '@node-rs/argon2';
import crypto from 'node:crypto';

const db = new PrismaClient();
const ARGON2ID = 2; // Algorithm.Argon2id — see src/lib/password.ts
const ARGON = { algorithm: ARGON2ID, memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

/** Meets the policy in src/lib/password.ts by construction. */
function strongPassword(): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnpqrstuvwxyz';
  const digits = '23456789';
  const symbols = '!@#$%^&*-_=+';
  const all = upper + lower + digits + symbols;
  const pick = (set: string) => set[crypto.randomInt(set.length)]!;
  const chars = [pick(upper), pick(lower), pick(digits), pick(symbols)];
  while (chars.length < 20) chars.push(pick(all));
  // Fisher-Yates with a CSPRNG so the guaranteed characters are not always first
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j]!, chars[i]!];
  }
  return chars.join('');
}

async function main() {
  // ---------------------------------------------------------------- admin
  const email = (process.env.SEED_ADMIN_EMAIL ?? 'admin@baytnaburger.jo').toLowerCase();
  const username = (process.env.SEED_ADMIN_USERNAME ?? 'admin').toLowerCase();
  const name = process.env.SEED_ADMIN_NAME ?? 'Super Admin';

  const existing = await db.user.findFirst({ where: { OR: [{ email }, { username }] } });

  if (existing) {
    console.log(`• Super Admin already exists (${existing.email}) — leaving it untouched.`);
  } else {
    const supplied = process.env.SEED_ADMIN_PASSWORD?.trim();
    const password = supplied && supplied.length >= 12 ? supplied : strongPassword();

    await db.user.create({
      data: {
        email,
        username,
        name,
        passwordHash: await hash(password, ARGON),
        role: 'SUPER_ADMIN',
        isActive: true,
        // The account cannot reach any page until this is cleared.
        mustChangePassword: true,
      },
    });

    console.log('\n' + '='.repeat(62));
    console.log('  SUPER ADMIN CREATED');
    console.log('='.repeat(62));
    console.log(`  Username : ${username}`);
    console.log(`  Email    : ${email}`);
    console.log(`  Password : ${password}`);
    console.log('-'.repeat(62));
    console.log('  This password is shown once and is not stored anywhere in');
    console.log('  readable form. You must change it at first sign-in.');
    console.log('='.repeat(62) + '\n');
  }

  // ---------------------------------------------------------------- hours
  // Sun-Thu 12:00-01:00, Fri 13:00-02:00, Sat 12:00-02:00 (Amman).
  const hours = [
    { dayOfWeek: 0, openMinutes: 720, closeMinutes: 1500 },
    { dayOfWeek: 1, openMinutes: 720, closeMinutes: 1500 },
    { dayOfWeek: 2, openMinutes: 720, closeMinutes: 1500 },
    { dayOfWeek: 3, openMinutes: 720, closeMinutes: 1500 },
    { dayOfWeek: 4, openMinutes: 720, closeMinutes: 1560 },
    { dayOfWeek: 5, openMinutes: 780, closeMinutes: 1560 },
    { dayOfWeek: 6, openMinutes: 720, closeMinutes: 1560 },
  ];
  for (const h of hours) {
    await db.openingHours.upsert({
      where: { dayOfWeek: h.dayOfWeek },
      create: { ...h, isClosed: false },
      update: {},
    });
  }

  // ---------------------------------------------------------------- settings
  await db.siteSettings.upsert({
    where: { id: 'singleton' },
    create: {
      id: 'singleton',
      seoTitleEn: 'Baytna Burger — Grilled in Amman, Loved Everywhere',
      seoTitleAr: 'بيتنا برجر — مشوي في عمّان، محبوب في كل مكان',
      seoDescEn: "Smashed local beef, za'atar and halloumi. Rainbow Street, Jabal Amman.",
      seoDescAr: 'لحم بلدي مضغوط، زعتر وحلوم. شارع الرينبو، جبل عمّان.',
      addressEn: 'Rainbow St, Jabal Amman, Amman, Jordan',
      addressAr: 'شارع الرينبو، جبل عمّان، عمّان، الأردن',
      lat: 31.9515, lng: 35.9239,
      phone: '+962790000000',
      whatsapp: '962790000000',
      email: 'hello@baytnaburger.jo',
      defaultLocale: 'en',
    },
    update: {},
  });

  // ---------------------------------------------------------------- menu
  const categories = [
    { slug: 'burgers', nameEn: 'Signature Burgers', nameAr: 'البرجر المميّز', order: 0 },
    { slug: 'sides', nameEn: 'Sides', nameAr: 'الإضافات', order: 1 },
    { slug: 'drinks', nameEn: 'Drinks', nameAr: 'المشروبات', order: 2 },
  ];
  for (const c of categories) {
    await db.category.upsert({ where: { slug: c.slug }, create: c, update: {} });
  }
  const burgers = await db.category.findUniqueOrThrow({ where: { slug: 'burgers' } });
  const sides = await db.category.findUniqueOrThrow({ where: { slug: 'sides' } });
  const drinks = await db.category.findUniqueOrThrow({ where: { slug: 'drinks' } });

  const items: Array<{
    categoryId: string; nameEn: string; nameAr: string; descEn: string; descAr: string;
    price: string; badges: Badge[]; spiceLevel: number; order: number;
  }> = [
    { categoryId: burgers.id, nameEn: 'Petra Smash', nameAr: 'سماش البتراء',
      descEn: 'Two smashed local beef patties, aged cheddar, house pickles and smash sauce.',
      descAr: 'قطعتا لحم بلدي مضغوطتان، شيدر معتّق، مخلل البيت وصوص السماش.',
      price: '6.50', badges: ['BEST_SELLER'], spiceLevel: 1, order: 0 },
    { categoryId: burgers.id, nameEn: 'Rainbow Street Classic', nameAr: 'كلاسيك الرينبو',
      descEn: 'Single patty, crisp lettuce, tomato, raw onion and the original sauce.',
      descAr: 'قطعة لحم واحدة، خس مقرمش، بندورة، بصل طازج، والصوص الأصلي.',
      price: '5.75', badges: [], spiceLevel: 0, order: 1 },
    { categoryId: burgers.id, nameEn: "Za'atar Crunch", nameAr: 'زعتر كرانش',
      descEn: "Za'atar-crusted patty, grilled halloumi, sumac onions, lemon-tahini.",
      descAr: 'لحم بقشرة زعتر، حلوم مشوي، بصل بالسماق، طحينة بالليمون.',
      price: '6.25', badges: ['CHEF_PICK'], spiceLevel: 2, order: 2 },
    { categoryId: burgers.id, nameEn: 'Jabal Amman Double', nameAr: 'دوبل جبل عمّان',
      descEn: 'Double beef, double cheddar, caramelised onion and garlic toum.',
      descAr: 'لحم مزدوج، شيدر مضاعف، بصل مكرمل وثوم.',
      price: '7.50', badges: [], spiceLevel: 1, order: 3 },
    { categoryId: burgers.id, nameEn: 'Shatta Fire', nameAr: 'نار الشطة',
      descEn: 'House shatta, pickled jalapeño, pepper jack and charred green chilli.',
      descAr: 'شطة البيت، هالابينو مخلل، جبنة حارة وفلفل أخضر مشوي.',
      price: '7.00', badges: ['SPICY'], spiceLevel: 4, order: 4 },
    { categoryId: burgers.id, nameEn: 'Halloumi Garden', nameAr: 'حديقة الحلوم',
      descEn: 'Thick-cut grilled halloumi, olive tapenade, rocket, roasted pepper.',
      descAr: 'حلوم مشوي سميك، تابيناد زيتون، جرجير وفلفل أحمر مشوي.',
      price: '5.50', badges: ['VEGETARIAN'], spiceLevel: 0, order: 5 },
    { categoryId: sides.id, nameEn: 'Sumac Fries', nameAr: 'بطاطا بالسماق',
      descEn: 'Skin-on, sumac salt.', descAr: 'بالقشرة، ملح السماق.',
      price: '2.00', badges: [], spiceLevel: 0, order: 0 },
    { categoryId: sides.id, nameEn: 'Halloumi Bites', nameAr: 'قطع الحلوم',
      descEn: "Honey and za'atar.", descAr: 'عسل وزعتر.',
      price: '3.50', badges: [], spiceLevel: 0, order: 1 },
    { categoryId: sides.id, nameEn: "Za'atar Onion Rings", nameAr: 'حلقات بصل بالزعتر',
      descEn: 'Six per basket.', descAr: 'ستة في السلة.',
      price: '2.75', badges: [], spiceLevel: 0, order: 2 },
    { categoryId: drinks.id, nameEn: 'Laban Ayran', nameAr: 'لبن عيران',
      descEn: 'Salted, ice cold.', descAr: 'مملّح ومثلّج.',
      price: '1.25', badges: [], spiceLevel: 0, order: 0 },
    { categoryId: drinks.id, nameEn: 'Lemon & Mint', nameAr: 'ليمون ونعناع',
      descEn: 'Pressed to order.', descAr: 'يُعصر عند الطلب.',
      price: '2.00', badges: [], spiceLevel: 0, order: 1 },
    { categoryId: drinks.id, nameEn: 'Tamarind', nameAr: 'تمر هندي',
      descEn: 'Ramadan all year.', descAr: 'رمضان طوال السنة.',
      price: '1.75', badges: [], spiceLevel: 0, order: 2 },
  ];

  for (const item of items) {
    const found = await db.menuItem.findFirst({ where: { nameEn: item.nameEn } });
    if (!found) await db.menuItem.create({ data: item });
  }

  // ---------------------------------------------------------------- hero + story
  if ((await db.heroSlide.count()) === 0) {
    await db.heroSlide.create({
      data: {
        titleEn: 'SMASHED OVER FIRE', titleAr: 'سماش على النار',
        subtitleEn: 'Grilled in Amman, loved everywhere.',
        subtitleAr: 'مشوي في عمّان، محبوب في كل مكان.',
        ctaTextEn: 'See the Menu', ctaTextAr: 'شوف المنيو',
        ctaHref: '#menu', overlayOpacity: 0.55, order: 0,
      },
    });
  }

  await db.storyBlock.upsert({
    where: { key: 'about' },
    create: {
      key: 'about',
      titleEn: 'A grill, a garage, and a city',
      titleAr: 'شوّاية، وكراج، ومدينة',
      bodyEn: '<p>Baytna started in 2016 in a converted garage off Rainbow Street, with one flat-top grill and a queue that spilled onto the pavement.</p>',
      bodyAr: '<p>بدأت بيتنا عام ٢٠١٦ في كراج مُحوَّل قرب شارع الرينبو، بشوّاية واحدة وطابور يمتد إلى الرصيف.</p>',
    },
    update: {},
  });

  // ---------------------------------------------------------------- builder
  const steps = [
    { key: 'bun', nameEn: 'Bun', nameAr: 'الخبز', order: 0, isMulti: false,
      options: [
        { nameEn: 'Sesame Brioche', nameAr: 'بريوش بالسمسم', price: '0.00' },
        { nameEn: 'Potato Bun', nameAr: 'خبز البطاطا', price: '0.25' },
        { nameEn: 'Saj Flatbread', nameAr: 'خبز الصاج', price: '0.50' },
      ] },
    { key: 'patty', nameEn: 'Patty', nameAr: 'اللحم', order: 1, isMulti: false,
      options: [
        { nameEn: 'Single Beef', nameAr: 'لحم مفرد', price: '4.00' },
        { nameEn: 'Double Beef', nameAr: 'لحم مزدوج', price: '5.50' },
        { nameEn: 'Grilled Halloumi', nameAr: 'حلوم مشوي', price: '4.25' },
        { nameEn: 'Chicken Thigh', nameAr: 'فخذ دجاج', price: '4.00' },
      ] },
    { key: 'toppings', nameEn: 'Toppings', nameAr: 'الإضافات', order: 2, isMulti: true,
      options: [
        { nameEn: 'Aged Cheddar', nameAr: 'شيدر معتّق', price: '0.50' },
        { nameEn: 'Grilled Halloumi', nameAr: 'حلوم مشوي', price: '0.75' },
        { nameEn: 'House Pickles', nameAr: 'مخلل البيت', price: '0.25' },
        { nameEn: 'Sumac Onions', nameAr: 'بصل بالسماق', price: '0.25' },
        { nameEn: 'Jalapeño', nameAr: 'هالابينو', price: '0.25' },
        { nameEn: 'Fried Egg', nameAr: 'بيضة مقلية', price: '0.50' },
      ] },
    { key: 'sauce', nameEn: 'Sauce', nameAr: 'الصوص', order: 3, isMulti: false,
      options: [
        { nameEn: 'Smash Sauce', nameAr: 'صوص السماش', price: '0.00' },
        { nameEn: 'Garlic Toum', nameAr: 'ثوم', price: '0.00' },
        { nameEn: 'Shatta', nameAr: 'شطة', price: '0.25' },
        { nameEn: "Za'atar Aioli", nameAr: 'أيولي بالزعتر', price: '0.25' },
      ] },
  ];

  for (const s of steps) {
    const step = await db.builderStep.upsert({
      where: { key: s.key },
      create: { key: s.key, nameEn: s.nameEn, nameAr: s.nameAr, order: s.order, isMulti: s.isMulti },
      update: {},
    });
    const count = await db.builderOption.count({ where: { stepId: step.id } });
    if (count === 0) {
      await db.builderOption.createMany({
        data: s.options.map((o, i) => ({ ...o, stepId: step.id, order: i })),
      });
    }
  }

  // ---------------------------------------------------------------- socials
  if ((await db.socialLink.count()) === 0) {
    await db.socialLink.createMany({
      data: [
        { platform: 'instagram', url: 'https://instagram.com/baytnaburger', order: 0 },
        { platform: 'facebook', url: 'https://facebook.com/baytnaburger', order: 1 },
        { platform: 'tiktok', url: 'https://tiktok.com/@baytnaburger', order: 2 },
      ],
    });
  }

  const counts = {
    users: await db.user.count(),
    categories: await db.category.count(),
    items: await db.menuItem.count(),
    builderOptions: await db.builderOption.count(),
  };
  console.log('Seed complete:', counts);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
