// ── DOM refs ─────────────────────────────────────────────────────────────────
const flowType                 = document.getElementById('flowType');
const existingFields           = document.getElementById('existingFields');
const newFields                = document.getElementById('newFields');
const validateExistingBtn      = document.getElementById('validateExistingBtn');
const continueNewBtn           = document.getElementById('continueNewBtn');
const existingValidationResult = document.getElementById('existingValidationResult');
const existingSubscriptionsGroup = document.getElementById('existingSubscriptionsGroup');
const existingSubscriptionsBody = document.getElementById('existingSubscriptionsBody');

const existingContactFields = document.getElementById('existingContactFields');
const step2Panel    = document.getElementById('step2Panel');
const regionSelect  = document.getElementById('region');
const loadProductsBtn = document.getElementById('loadProductsBtn');
const selectAllProductsCheckbox = document.getElementById('selectAllProductsCheckbox');
const clearAllProductsCheckbox = document.getElementById('clearAllProductsCheckbox');
const productsEl    = document.getElementById('products');
const productsGroup = document.getElementById('productsGroup');
const productsValidation = document.getElementById('productsValidation');
const tenantsGroup  = document.getElementById('tenantsGroup');
const submitGroup   = document.getElementById('submitGroup');
const submitBtn     = document.getElementById('submitBtn');
const resultEl      = document.getElementById('result');
const tenantTokenList = document.getElementById('tenantTokenList');
const tenantShortCodesInput = document.getElementById('tenantShortCodes');
const tenantValidation = document.getElementById('tenantValidation');

let regionEnvironmentMap = {};
let subscriberValidated = false;
let tenantShortCodes = [];
let productNamesMap = {};

// ── Region map bootstrap ─────────────────────────────────────────────────────
async function loadRegionEnvironmentMap() {
  try {
    const response = await fetch('/region-environment-map');
    const data = await response.json();
    const mapping = data?.mapping || {};
    if (typeof mapping !== 'object' || Array.isArray(mapping) || Object.keys(mapping).length === 0) {
      return;
    }
    regionEnvironmentMap = mapping;
    regionSelect.innerHTML = Object.keys(regionEnvironmentMap)
      .map((r) => `<option value="${r}">${r}</option>`)
      .join('');
  } catch {
    // Keep fallback options already in the markup.
  }
}

// ── reCAPTCHA ─────────────────────────────────────────────────────────────────
let recaptchaScriptPromise;

function ensureRecaptchaScript() {
  if (!window.RECAPTCHA_SITE_KEY) {
    return Promise.resolve();
  }

  if (recaptchaScriptPromise) {
    return recaptchaScriptPromise;
  }

  recaptchaScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://www.google.com/recaptcha/api.js?render=explicit';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load reCAPTCHA script.'));
    document.head.appendChild(script);
  });

  return recaptchaScriptPromise;
}

fetch('/captcha-config')
  .then((r) => r.json())
  .then((data) => {
    window.RECAPTCHA_SITE_KEY = data.siteKey || null;
    return ensureRecaptchaScript();
  })
  .catch(() => { window.RECAPTCHA_SITE_KEY = null; });

async function getRecaptchaToken() {
  if (typeof grecaptcha === 'undefined' || !window.RECAPTCHA_SITE_KEY) {
    return 'dev-bypass';
  }
  await ensureRecaptchaScript();
  return grecaptcha.execute(window.RECAPTCHA_SITE_KEY, { action: 'submit' });
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function val(id) {
  return String(document.getElementById(id)?.value || '').trim();
}

function setMsg(el, message, isError) {
  el.textContent = message;
  el.style.display = message ? '' : 'none';
  el.style.color = isError ? 'var(--color-danger, #c0392b)' : 'var(--itron-blue, #006f9f)';
}

function setFieldValidation(el, message) {
  el.textContent = message;
  el.style.display = message ? '' : 'none';
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

function isValidUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value || '').trim());
}

function formatApiValidationError(data) {
  if (!data || !Array.isArray(data.details) || data.details.length === 0) {
    return data?.error || 'Submission failed.';
  }

  const issueLines = data.details
    .map((issue) => {
      const path = Array.isArray(issue.path) && issue.path.length > 0
        ? issue.path.join('.')
        : 'payload';
      const message = issue.message || 'Invalid value';
      return `${path}: ${message}`;
    })
    .join(' | ');

  return `${data.error || 'Invalid payload.'} ${issueLines}`;
}

function showStep2() {
  step2Panel.style.display = '';
  step2Panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function formatDate(value) {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  return date.toLocaleDateString();
}

function getValue(source, keys) {
  for (const key of keys) {
    if (source && source[key] !== undefined && source[key] !== null && source[key] !== '') {
      return source[key];
    }
  }
  return '';
}

function renderExistingSubscriptions(subscriptions) {
  if (!Array.isArray(subscriptions) || subscriptions.length === 0) {
    existingSubscriptionsBody.innerHTML = '<tr><td colspan="6">No existing subscriptions found.</td></tr>';
    existingSubscriptionsGroup.style.display = '';
    return;
  }

  existingSubscriptionsBody.innerHTML = subscriptions.map((subscription) => {
    const subscriptionId = getValue(subscription, ['subscriptionId', 'id']);
    const tenantShortCode = getValue(subscription, ['tenantShortCode', 'tenantCode', 'tenantId']);
    const dataProductName = getValue(subscription, ['dataProductName', 'productName', 'name']);
    const status = getValue(subscription, ['status']);
    const startDate = formatDate(getValue(subscription, ['startDate', 'subscriptionStartDate', 'effectiveStartDate']));
    const endDate = formatDate(getValue(subscription, ['endDate', 'subscriptionEndDate', 'effectiveEndDate']));
    return `
      <tr>
        <td>${subscriptionId}</td>
        <td>${tenantShortCode}</td>
        <td>${dataProductName}</td>
        <td>${status}</td>
        <td>${startDate}</td>
        <td>${endDate}</td>
      </tr>`;
  }).join('');
  existingSubscriptionsGroup.style.display = '';
}

function getSelectedProductIds() {
  return Array.from(productsEl.querySelectorAll('input.product-checkbox:checked')).map((checkbox) => checkbox.value);
}

function setAllProductsChecked(checked) {
  for (const checkbox of productsEl.querySelectorAll('input.product-checkbox')) {
    checkbox.checked = checked;
  }
}

function getTenantShortCodes() {
  return [...tenantShortCodes];
}

function renderTenantTokens() {
  tenantTokenList.innerHTML = tenantShortCodes.map((shortCode) => (`
    <span class="token-chip">
      <span>${shortCode}</span>
      <button type="button" data-token-remove="${shortCode}" aria-label="Remove ${shortCode}">x</button>
    </span>
  `)).join('');
}

function normalizeTenantShortCode(value) {
  return String(value || '').trim();
}

function isValidTenantShortCode(value) {
  return /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value);
}

function addTenantShortCodes(rawValue) {
  const parts = String(rawValue || '')
    .split(',')
    .map(normalizeTenantShortCode)
    .filter(Boolean);

  if (parts.length === 0) {
    return true;
  }

  const invalid = parts.find((part) => !isValidTenantShortCode(part));
  if (invalid) {
    setFieldValidation(tenantValidation, `Invalid tenant short code: ${invalid}`);
    return false;
  }

  let added = false;
  for (const part of parts) {
    if (!tenantShortCodes.includes(part)) {
      tenantShortCodes.push(part);
      added = true;
    }
  }

  if (added) {
    renderTenantTokens();
  }
  tenantShortCodesInput.value = '';
  setFieldValidation(tenantValidation, '');
  return true;
}

function resetStep2() {
  const autoFillIds = ['existingCompanyName', 'existingEmail', 'existingFirstName', 'existingLastName'];
  for (const id of autoFillIds) {
    const el = document.getElementById(id);
    el.readOnly = false;
    el.style.background = '';
    el.value = '';
  }
  document.getElementById('existingSponsorName').value = '';
  document.getElementById('existingSponsorEmail').value = '';
  existingContactFields.style.display = 'none';
  step2Panel.style.display = 'none';
  productsGroup.style.display = 'none';
  tenantsGroup.style.display = 'none';
  submitGroup.style.display = 'none';
  productsEl.innerHTML = '';
  selectAllProductsCheckbox.checked = false;
  clearAllProductsCheckbox.checked = false;
  tenantShortCodes = [];
  renderTenantTokens();
  tenantShortCodesInput.value = '';
  setFieldValidation(productsValidation, '');
  setFieldValidation(tenantValidation, '');
  resultEl.textContent = '';
  subscriberValidated = false;
}

// ── Flow toggle ───────────────────────────────────────────────────────────────
flowType.addEventListener('change', () => {
  const isExisting = flowType.value === 'existing';
  existingFields.style.display = isExisting ? '' : 'none';
  newFields.style.display      = isExisting ? 'none' : '';
  existingValidationResult.style.display = 'none';
  existingSubscriptionsGroup.style.display = 'none';
  existingSubscriptionsBody.innerHTML = '';
  resetStep2();
});

// ── Step 1 — Existing: Validate ───────────────────────────────────────────────
validateExistingBtn.addEventListener('click', async () => {
  const subscriberId = val('subscriberId');

  if (!subscriberId) {
    setMsg(existingValidationResult, 'Subscriber ID is required.', true);
    return;
  }

  validateExistingBtn.disabled = true;
  validateExistingBtn.textContent = 'Validating…';

  try {
    const response = await fetch('/api/public/validate-existing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscriberId, region: regionSelect.value })
    });

    const data = await response.json();
    if (!response.ok || !data.valid) {
      setMsg(existingValidationResult, `Validation failed: ${data.error || 'Unknown error'}`, true);
      return;
    }

    const sub = data.subscriber || {};
    const autoFillFields = [
      ['existingCompanyName', sub.companyName],
      ['existingEmail',       sub.email],
      ['existingFirstName',   sub.firstName],
      ['existingLastName',    sub.lastName]
    ];
    for (const [id, value] of autoFillFields) {
      const el = document.getElementById(id);
      el.value = value || '';
      el.readOnly = true;
      el.style.background = '#f4f6f8';
    }

    setMsg(existingValidationResult, `Subscriber validated. ${data.subscriptions?.length ?? 0} existing subscription(s) found. Complete the remaining fields below.`, false);
    if (data.region) {
      regionSelect.value = data.region;
    }
    renderExistingSubscriptions(data.subscriptions || []);
    existingContactFields.style.display = '';
    subscriberValidated = true;
    showStep2();
  } catch (err) {
    setMsg(existingValidationResult, `Error: ${err.message}`, true);
  } finally {
    validateExistingBtn.disabled = false;
    validateExistingBtn.textContent = 'Validate Subscriber';
  }
});

// ── Step 1 — New: Continue ────────────────────────────────────────────────────
continueNewBtn.addEventListener('click', () => {
  const required = [
    ['companyName',    'Company Name'],
    ['companyAddress', 'Company Address'],
    ['phoneNumber',    'Phone Number'],
    ['email',         'Company Email'],
    ['firstName',     'Developer First Name'],
    ['lastName',      'Developer Last Name'],
    ['sponsorName',   'Itron Sponsor Name'],
    ['sponsorEmail',  'Itron Sponsor Email'],
  ];
  const missing = required.filter(([id]) => !val(id)).map(([, label]) => label);
  if (missing.length > 0) {
    alert(`Please fill in: ${missing.join(', ')}`);
    return;
  }

  if (!isValidEmail(val('email'))) {
    alert('Please enter a valid Company Email.');
    return;
  }

  if (!isValidEmail(val('sponsorEmail'))) {
    alert('Please enter a valid Itron Sponsor Email.');
    return;
  }

  subscriberValidated = true;
  showStep2();
});

// ── Step 2 — Load Data Products ───────────────────────────────────────────────
loadProductsBtn.addEventListener('click', async () => {
  loadProductsBtn.disabled = true;
  loadProductsBtn.textContent = 'Loading…';

  try {
    const body = { region: regionSelect.value };
    if (flowType.value === 'existing') {
      // server uses service credentials; no user creds needed
    }

    const response = await fetch('/api/public/data-products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Unable to load data products.');
    }

    productNamesMap = {};
    if (!Array.isArray(data) || data.length === 0) {
      productsEl.innerHTML = '';
    } else {
      productsEl.innerHTML = data.map((item) => {
        const id   = item.dataProductId || item.id;
        const name = item.name || id;
        productNamesMap[id] = name;
        return `<label><input type="checkbox" class="product-checkbox" value="${id}" /> ${name}</label>`;
      }).join('');
    }

    productsGroup.style.display = '';
    tenantsGroup.style.display  = '';
    submitGroup.style.display   = '';
    selectAllProductsCheckbox.checked = false;
    clearAllProductsCheckbox.checked = false;
    setFieldValidation(productsValidation, '');
  } catch (err) {
    alert(`Failed to load data products: ${err.message}`);
  } finally {
    loadProductsBtn.disabled = false;
    loadProductsBtn.textContent = 'Load Data Products';
  }
});

selectAllProductsCheckbox.addEventListener('change', () => {
  if (!selectAllProductsCheckbox.checked) {
    return;
  }
  setAllProductsChecked(true);
  clearAllProductsCheckbox.checked = false;
  setFieldValidation(productsValidation, '');
});

clearAllProductsCheckbox.addEventListener('change', () => {
  if (!clearAllProductsCheckbox.checked) {
    return;
  }
  setAllProductsChecked(false);
  selectAllProductsCheckbox.checked = false;
  setFieldValidation(productsValidation, '');
});

productsEl.addEventListener('change', () => {
  const selectedCount = getSelectedProductIds().length;
  const totalCount = productsEl.querySelectorAll('input.product-checkbox').length;
  if (selectedCount > 0) {
    setFieldValidation(productsValidation, '');
  }
  selectAllProductsCheckbox.checked = totalCount > 0 && selectedCount === totalCount;
  clearAllProductsCheckbox.checked = selectedCount === 0;
});

tenantShortCodesInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ',') {
    event.preventDefault();
    addTenantShortCodes(tenantShortCodesInput.value);
  }
});

tenantShortCodesInput.addEventListener('blur', () => {
  if (tenantShortCodesInput.value.trim()) {
    addTenantShortCodes(tenantShortCodesInput.value);
  }
});

tenantShortCodesInput.addEventListener('paste', (event) => {
  const pastedText = event.clipboardData ? event.clipboardData.getData('text') : '';
  if (pastedText.includes(',')) {
    event.preventDefault();
    addTenantShortCodes(pastedText);
  }
});

tenantTokenList.addEventListener('click', (event) => {
  const shortCode = event.target?.getAttribute('data-token-remove');
  if (!shortCode) {
    return;
  }
  tenantShortCodes = tenantShortCodes.filter((value) => value !== shortCode);
  renderTenantTokens();
});

// ── Step 2 — Submit ───────────────────────────────────────────────────────────
submitBtn.addEventListener('click', async () => {
  if (!subscriberValidated) {
    alert('Please complete Step 1 first.');
    return;
  }

  const selectedProducts = getSelectedProductIds();
  if (tenantShortCodesInput.value.trim() && !addTenantShortCodes(tenantShortCodesInput.value)) {
    setMsg(resultEl, '', false);
    return;
  }
  const tenantShortCodes = getTenantShortCodes();

  if (selectedProducts.length === 0) {
    setFieldValidation(productsValidation, 'Select at least one data product.');
    setMsg(resultEl, '', false);
    return;
  }

  if (tenantShortCodes.length === 0) {
    setFieldValidation(tenantValidation, 'Enter at least one tenant short code.');
    setMsg(resultEl, '', false);
    return;
  }

  setFieldValidation(productsValidation, '');
  setFieldValidation(tenantValidation, '');

  const isExisting = flowType.value === 'existing';
  if (isExisting && !isValidUuid(val('subscriberId'))) {
    setMsg(resultEl, 'Error: Subscriber ID must be a valid UUID.', true);
    return;
  }

  if (isExisting) {
    const existingRequired = [
      ['existingSponsorName',    'Itron Sponsor Name'],
      ['existingSponsorEmail',   'Itron Sponsor Email'],
    ];
    const missingExisting = existingRequired.filter(([id]) => !val(id)).map(([, label]) => label);
    if (missingExisting.length > 0) {
      setMsg(resultEl, `Please fill in: ${missingExisting.join(', ')}`, true);
      return;
    }
    if (!isValidEmail(val('existingSponsorEmail'))) {
      setMsg(resultEl, 'Please enter a valid Itron Sponsor Email.', true);
      return;
    }
  }

  const subscriber = isExisting
    ? {
        flowType:     'existing',
        subscriberId: val('subscriberId'),
        companyName:  val('existingCompanyName'),
        email:        val('existingEmail'),
        firstName:    val('existingFirstName'),
        lastName:     val('existingLastName'),
        sponsorName:  val('existingSponsorName'),
        sponsorEmail: val('existingSponsorEmail'),
      }
    : {
        flowType:       'new',
        companyName:    val('companyName'),
        companyAddress: val('companyAddress'),
        phoneNumber:    val('phoneNumber'),
        email:          val('email'),
        firstName:      val('firstName'),
        lastName:       val('lastName'),
        sponsorName:    val('sponsorName'),
        sponsorEmail:   val('sponsorEmail'),
      };

  submitBtn.disabled = true;
  submitBtn.textContent = 'Submitting…';

  try {
    const recaptchaToken = await getRecaptchaToken();
    const payload = {
      recaptchaToken,
      region: regionSelect.value,
      subscriber,
      products: selectedProducts,
      productTenants: selectedProducts.map((dataProductId) => ({
        dataProductId,
        tenantIds: tenantShortCodes
      })),
      productNames: { ...productNamesMap }
    };

    const response = await fetch('/api/public/requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok) {
      setMsg(resultEl, `Error: ${formatApiValidationError(data)}`, true);
    } else {
      const referenceId = data.id || data.requestId || 'N/A';
      const internalSent = data?.emailNotifications?.internal;
      const requesterSent = data?.emailNotifications?.requester;
      const emailFailures = [];
      if (internalSent === false) {
        emailFailures.push('internal notification');
      }
      if (requesterSent === false) {
        emailFailures.push('requester acknowledgment');
      }

      if (emailFailures.length > 0) {
        setMsg(resultEl, `Request submitted successfully. Reference ID: ${referenceId}. Email delivery pending for: ${emailFailures.join(', ')}.`, false);
      } else {
        setMsg(resultEl, `Request submitted successfully. Reference ID: ${referenceId}`, false);
      }
    }
  } catch (err) {
    setMsg(resultEl, `Error: ${err.message}`, true);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Submit Request';
  }
});

// ── About Us Modal ────────────────────────────────────────────────────────────
const aboutModal = document.getElementById('aboutModal');
const aboutUsBtn = document.getElementById('aboutUsBtn');
const closeAboutBtn = document.getElementById('closeAboutBtn');

function openAboutModal() {
  aboutModal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closeAboutModal() {
  aboutModal.style.display = 'none';
  document.body.style.overflow = '';
}

aboutUsBtn.addEventListener('click', openAboutModal);
closeAboutBtn.addEventListener('click', closeAboutModal);
aboutModal.addEventListener('click', (event) => {
  if (event.target === aboutModal) {
    closeAboutModal();
  }
});

// ── Bootstrap ─────────────────────────────────────────────────────────────────
loadRegionEnvironmentMap();

if (typeof window !== 'undefined') {
  window.__DPSS_APP_TEST_HOOKS__ = {
    getSelectedProductIds,
    getTenantShortCodes,
    addTenantShortCodes,
    renderTenantTokens
  };
}
