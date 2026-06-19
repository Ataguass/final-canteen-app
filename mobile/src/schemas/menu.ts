import { z } from 'zod';

export const categorySchema = z.object({
  name: z.string().min(1, 'Category name is required.'),
  description: z.string().optional(),
  imageUrl: z.string().optional(),
});

export type CategoryFormData = z.infer<typeof categorySchema>;

export const menuItemSchema = z.object({
  categoryId: z.string().min(1, 'Category is required.'),
  name: z.string().min(1, 'Item name is required.'),
  description: z.string().optional(),
  price: z.coerce.number().min(0, 'Price must be 0 or greater.'),
  stockQty: z.coerce.number().int('Stock must be an integer').min(0, 'Stock must be 0 or greater.'),
  image: z.string().optional(),
  isTodaySpecial: z.boolean(),
});

export type MenuItemFormData = z.infer<typeof menuItemSchema>;
