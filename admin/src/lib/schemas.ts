import { z } from 'zod';
import { cleanText, sanitizeHtml } from './sanitize';

/** Trimmed, control-characters stripped, length-capped. */
const text = (max = 200) => z.string().transform((v) => cleanText(v, max));
const requiredText = (max = 200) =>
  z.string().min(1, 'Required').transform((v) => cleanText(v, max)).refine((v) => v.length > 0, 'Required');

/** Money is parsed as a fixed-2 string so it survives Prisma's Decimal cleanly. */
export const price = z
  .union([z.number(), z.string()])
  .transform((v) => (typeof v === 'number' ? v : Number(v)))
  .refine((v) => Number.isFinite(v) && v >= 0 && v <= 9999, 'Price must be between 0 and 9999')
  .transform((v) => v.toFixed(2));

export const badgeEnum = z.enum(['BEST_SELLER', 'NEW', 'SPICY', 'VEGETARIAN', 'CHEF_PICK']);
export const roleEnum = z.enum(['SUPER_ADMIN', 'ADMIN', 'EDITOR', 'VIEWER']);

export const categoryCreate = z.object({
  slug: z.string().regex(/^[a-z0-9-]{2,60}$/, 'Lowercase letters, numbers and hyphens only'),
  nameEn: requiredText(80),
  nameAr: requiredText(80),
  isVisible: z.boolean().default(true),
});
export const categoryUpdate = categoryCreate.partial();

export const menuItemCreate = z.object({
  categoryId: z.string().min(1),
  nameEn: requiredText(120),
  nameAr: requiredText(120),
  descEn: text(600).default(''),
  descAr: text(600).default(''),
  price,
  imageId: z.string().nullable().optional(),
  badges: z.array(badgeEnum).max(5).default([]),
  spiceLevel: z.coerce.number().int().min(0).max(5).default(0),
  isAvailable: z.boolean().default(true),
  isPublished: z.boolean().default(true),
});
export const menuItemUpdate = menuItemCreate.partial();

export const reorder = z.object({
  ids: z.array(z.string().min(1)).min(1).max(500),
});

export const bulkAction = z.object({
  ids: z.array(z.string().min(1)).min(1).max(200),
  action: z.enum(['delete', 'publish', 'unpublish', 'available', 'unavailable', 'duplicate']),
});

export const heroSlide = z.object({
  mediaId: z.string().nullable().optional(),
  videoUrl: z.string().url().nullable().optional().or(z.literal('')),
  titleEn: text(120).default(''),
  titleAr: text(120).default(''),
  subtitleEn: text(300).default(''),
  subtitleAr: text(300).default(''),
  ctaTextEn: text(60).default(''),
  ctaTextAr: text(60).default(''),
  ctaHref: text(200).default('#menu'),
  overlayOpacity: z.coerce.number().min(0).max(1).default(0.5),
  isActive: z.boolean().default(true),
});

export const storyBlock = z.object({
  titleEn: text(160).default(''),
  titleAr: text(160).default(''),
  // the only fields where markup is kept — sanitised with an allow-list
  bodyEn: z.string().max(20000).transform(sanitizeHtml).default(''),
  bodyAr: z.string().max(20000).transform(sanitizeHtml).default(''),
  mediaId: z.string().nullable().optional(),
});

export const openingHours = z.object({
  days: z.array(
    z.object({
      dayOfWeek: z.number().int().min(0).max(6),
      openMinutes: z.number().int().min(0).max(1439),
      // may exceed 1440 to express a closing time after midnight
      closeMinutes: z.number().int().min(0).max(2879),
      isClosed: z.boolean(),
    }),
  ).length(7),
});

export const socialLink = z.object({
  platform: z.enum(['instagram', 'facebook', 'tiktok', 'x', 'youtube', 'snapchat']),
  url: z.string().url().max(300),
  isActive: z.boolean().default(true),
});

export const promotion = z.object({
  titleEn: requiredText(120),
  titleAr: requiredText(120),
  descEn: text(600).default(''),
  descAr: text(600).default(''),
  mediaId: z.string().nullable().optional(),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  isActive: z.boolean().default(true),
}).refine((d) => d.endsAt > d.startsAt, { message: 'End date must be after the start date', path: ['endsAt'] });

export const builderStep = z.object({
  key: z.string().regex(/^[a-z0-9-]{2,40}$/),
  nameEn: requiredText(80),
  nameAr: requiredText(80),
  isMulti: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

export const builderOption = z.object({
  stepId: z.string().min(1),
  nameEn: requiredText(80),
  nameAr: requiredText(80),
  descEn: text(200).default(''),
  descAr: text(200).default(''),
  price,
  mediaId: z.string().nullable().optional(),
  isActive: z.boolean().default(true),
});

export const userCreate = z.object({
  email: z.string().email().max(200).transform((v) => v.toLowerCase()),
  username: z.string().regex(/^[a-zA-Z0-9._-]{3,40}$/, '3–40 letters, numbers, dot, underscore or hyphen')
    .transform((v) => v.toLowerCase()),
  name: requiredText(120),
  role: roleEnum,
});

export const userUpdate = z.object({
  name: requiredText(120).optional(),
  role: roleEnum.optional(),
  isActive: z.boolean().optional(),
});

export const settingsUpdate = z.object({
  logoId: z.string().nullable().optional(),
  faviconId: z.string().nullable().optional(),
  ogImageId: z.string().nullable().optional(),
  colorPrimary: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  colorAccent: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  colorCta: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  colorBackground: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  fontFamily: text(80).optional(),
  seoTitleEn: text(120).optional(),
  seoTitleAr: text(120).optional(),
  seoDescEn: text(320).optional(),
  seoDescAr: text(320).optional(),
  seoKeywords: text(400).optional(),
  addressEn: text(240).optional(),
  addressAr: text(240).optional(),
  lat: z.number().min(-90).max(90).nullable().optional(),
  lng: z.number().min(-180).max(180).nullable().optional(),
  phone: text(40).optional(),
  whatsapp: text(40).optional(),
  email: z.string().email().max(200).optional().or(z.literal('')),
  defaultLocale: z.enum(['en', 'ar']).optional(),
  showLanguageSwitcher: z.boolean().optional(),
  maintenanceMode: z.boolean().optional(),
  maintenanceMsgEn: text(300).optional(),
  maintenanceMsgAr: text(300).optional(),
});
