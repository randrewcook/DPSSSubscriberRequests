const { z } = require('zod');

const regionEnum = z.string().min(1).max(64);

const existingSubscriberSchema = z.object({
  flowType: z.literal('existing'),
  subscriberId: z.string().uuid(),
  companyName: z.string().min(1).max(200),
  email: z.string().email().max(254),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  sponsorName: z.string().min(1).max(150),
  sponsorEmail: z.string().email().max(254)
});

const newSubscriberSchema = z.object({
  flowType: z.literal('new'),
  companyName: z.string().min(1).max(200),
  phoneNumber: z.string().min(1).max(40),
  companyAddress: z.string().min(1).max(300),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email().max(254),
  sponsorName: z.string().min(1).max(150),
  sponsorEmail: z.string().email().max(254)
});

const tenantSelectionSchema = z.object({
  dataProductId: z.string().min(1).max(100),
  tenantIds: z.array(z.string().min(1).max(100)).min(1)
});

const requestSubmissionSchema = z.object({
  recaptchaToken: z.string().min(1),
  region: regionEnum,
  subscriber: z.union([existingSubscriberSchema, newSubscriberSchema]),
  products: z.array(z.string().min(1).max(100)).min(1),
  productTenants: z.array(tenantSelectionSchema).min(1),
  productNames: z.record(z.string().max(200)).optional()
});

const statusUpdateSchema = z.object({
  status: z.enum(['New', 'In Review', 'Complete', 'Rejected'])
});

module.exports = {
  requestSubmissionSchema,
  statusUpdateSchema,
  regionEnum
};
