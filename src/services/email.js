const nodemailer = require('nodemailer');
const { config } = require('../config');

const transportOptions = {
  host: config.smtp.host,
  port: config.smtp.port,
  secure: config.smtp.secure
};

if (config.smtp.user) {
  transportOptions.auth = { user: config.smtp.user, pass: config.smtp.pass };
}

const transporter = nodemailer.createTransport(transportOptions);

async function sendMessage(message) {
  try {
    await transporter.sendMail(message);
    return { sent: true };
  } catch (error) {
    return { sent: false, error };
  }
}

function buildExistingSubscriberBody(requestId, payload, submittedAt) {
  const sub = payload.subscriber;
  const names = payload.productNames || {};
  const products = (payload.products || []).map((p) => `  - ${names[p] || p}`).join('\n') || '  (none)';
  const allTenants = (payload.productTenants || [])
    .flatMap((pt) => pt.tenantIds)
    .filter((v, i, arr) => arr.indexOf(v) === i);
  const tenants = allTenants.length > 0 ? allTenants.map((t) => `  - ${t}`).join('\n') : '  (none)';

  return [
    `Request ID:           ${requestId}`,
    `Date / Time:          ${submittedAt}`,
    '',
    '--- Subscriber Details ---',
    `Subscriber ID:        ${sub.subscriberId || ''}`,
    `Company Name:         ${sub.companyName || ''}`,
    `Company Email:        ${sub.email || ''}`,
    `Developer First Name: ${sub.firstName || ''}`,
    `Developer Last Name:  ${sub.lastName || ''}`,
    `Itron Sponsor Name:   ${sub.sponsorName || ''}`,
    `Itron Sponsor Email:  ${sub.sponsorEmail || ''}`,
    '',
    '--- Subscription Details ---',
    `Region:               ${payload.region || ''}`,
    '',
    'Selected Data Products:',
    products,
    '',
    'Tenant Short Codes:',
    tenants
  ].join('\n');
}

function buildNewSubscriberBody(requestId, payload, submittedAt) {
  const sub = payload.subscriber;
  const names = payload.productNames || {};
  const products = (payload.products || []).map((p) => `  - ${names[p] || p}`).join('\n') || '  (none)';
  const allTenants = (payload.productTenants || [])
    .flatMap((pt) => pt.tenantIds)
    .filter((v, i, arr) => arr.indexOf(v) === i);
  const tenants = allTenants.length > 0 ? allTenants.map((t) => `  - ${t}`).join('\n') : '  (none)';

  return [
    `Request ID:           ${requestId}`,
    `Date / Time:          ${submittedAt}`,
    '',
    '--- Subscriber Details ---',
    `Company Name:         ${sub.companyName || ''}`,
    `Company Address:      ${sub.companyAddress || ''}`,
    `Phone Number:         ${sub.phoneNumber || ''}`,
    `Company Email:        ${sub.email || ''}`,
    `Developer First Name: ${sub.firstName || ''}`,
    `Developer Last Name:  ${sub.lastName || ''}`,
    `Itron Sponsor Name:   ${sub.sponsorName || ''}`,
    `Itron Sponsor Email:  ${sub.sponsorEmail || ''}`,
    '',
    '--- Subscription Details ---',
    `Region:               ${payload.region || ''}`,
    '',
    'Selected Data Products:',
    products,
    '',
    'Tenant Short Codes:',
    tenants
  ].join('\n');
}

async function sendRequestSubmittedEmails({ requesterEmail, requestId, payload }) {
  const internalRecipients = config.smtp.alertEmails;
  const from = config.smtp.from;
  const submittedAt = new Date().toLocaleString('en-US', { timeZoneName: 'short' });
  const result = {
    internal: { attempted: false, sent: false },
    requester: { attempted: false, sent: false }
  };

  const isNew = payload?.subscriber?.flowType === 'new';
  const body = isNew
    ? buildNewSubscriberBody(requestId, payload, submittedAt)
    : buildExistingSubscriberBody(requestId, payload, submittedAt);

  if (internalRecipients.length > 0) {
    result.internal.attempted = true;
    const internalSend = await sendMessage({
      from,
      to: internalRecipients.join(','),
      subject: `New Subscription Request: ${requestId}`,
      text: `A new subscription request has been submitted.\n\n${body}`
    });
    result.internal.sent = internalSend.sent;
    if (!internalSend.sent) {
      result.internal.error = internalSend.error;
    }
  }

  if (requesterEmail) {
    result.requester.attempted = true;
    const requesterSend = await sendMessage({
      from,
      to: requesterEmail,
      subject: 'Your subscription request was received',
      text: `Thank you — your subscription request has been received and is pending review.\n\n${body}`
    });
    result.requester.sent = requesterSend.sent;
    if (!requesterSend.sent) {
      result.requester.error = requesterSend.error;
    }
  }

  return result;
}

module.exports = { sendRequestSubmittedEmails };
