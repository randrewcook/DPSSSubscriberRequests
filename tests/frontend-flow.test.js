const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { jest: jestObject } = require('@jest/globals');

class FakeElement {
  constructor(id) {
    this.id = id;
    this.value = '';
    this.textContent = '';
    this.disabled = false;
    this.innerHTMLValue = '';
    this.style = { display: '' };
    this.listeners = new Map();
    this.options = [];
    this.productCheckboxes = [];
  }

  addEventListener(type, handler) {
    const handlers = this.listeners.get(type) || [];
    handlers.push(handler);
    this.listeners.set(type, handlers);
  }

  async dispatch(type, event = {}) {
    const handlers = this.listeners.get(type) || [];
    for (const handler of handlers) {
      await handler({
        target: this,
        preventDefault() {},
        clipboardData: event.clipboardData,
        key: event.key,
        ...event
      });
    }
  }

  scrollIntoView() {}

  focus() {}

  getAttribute(name) {
    return this[name];
  }

  set innerHTML(value) {
    this.innerHTMLValue = value;
    if (this.id === 'region') {
      const optionRegex = /<option value="([^"]+)"(?:[^>]*)>([^<]*)<\/option>/g;
      const options = [];
      let match = optionRegex.exec(value);
      while (match) {
        options.push({ value: match[1], text: match[2], selected: false });
        match = optionRegex.exec(value);
      }
      this.options = options;
      if (options.length > 0) {
        this.value = options[0].value;
      }
    }
    if (this.id === 'products') {
      const checkboxRegex = /<input type="checkbox" class="product-checkbox" value="([^"]+)"/g;
      const productCheckboxes = [];
      let match = checkboxRegex.exec(value);
      while (match) {
        productCheckboxes.push({ value: match[1], checked: false });
        match = checkboxRegex.exec(value);
      }
      this.productCheckboxes = productCheckboxes;
    }
  }

  get innerHTML() {
    return this.innerHTMLValue;
  }

  get selectedOptions() {
    return this.options.filter((option) => option.selected);
  }

  querySelectorAll(selector) {
    if (this.id === 'products' && selector === 'input.product-checkbox') {
      return this.productCheckboxes;
    }
    if (this.id === 'products' && selector === 'input.product-checkbox:checked') {
      return this.productCheckboxes.filter((checkbox) => checkbox.checked);
    }
    return [];
  }
}

function createHarness(overrides = {}) {
  const ids = [
    'flowType', 'existingFields', 'newFields', 'validateExistingBtn', 'continueNewBtn',
    'existingValidationResult', 'existingSubscriptionsGroup', 'existingSubscriptionsBody',
    'existingContactFields',
    'step2Panel', 'region', 'loadProductsBtn', 'selectAllProductsCheckbox', 'clearAllProductsCheckbox',
    'products', 'productsGroup', 'productsValidation', 'tenantsGroup', 'submitGroup',
    'submitBtn', 'result', 'tenantTokenList', 'tenantShortCodes', 'tenantValidation',
    'subscriberId',
    'companyName', 'companyAddress', 'phoneNumber',
    'email', 'firstName', 'lastName', 'sponsorName', 'sponsorEmail',
    'existingCompanyName', 'existingEmail',
    'existingFirstName', 'existingLastName', 'existingSponsorName', 'existingSponsorEmail',
    'aboutModal', 'aboutUsBtn', 'closeAboutBtn'
  ];

  const elements = Object.fromEntries(ids.map((id) => [id, new FakeElement(id)]));
  elements.flowType.value = 'existing';
  elements.region.value = 'USA';
  elements.existingSubscriptionsGroup.style.display = 'none';
  elements.existingContactFields.style.display = 'none';
  elements.newFields.style.display = 'none';
  elements.step2Panel.style.display = 'none';
  elements.productsGroup.style.display = 'none';
  elements.tenantsGroup.style.display = 'none';
  elements.submitGroup.style.display = 'none';
  elements.aboutModal.style.display = 'none';
  elements.products.options = [];

  const document = {
    getElementById(id) {
      if (!elements[id]) {
        throw new Error(`Unknown element: ${id}`);
      }
      return elements[id];
    }
  };

  const requests = [];
  const fetch = jestObject.fn(async (url, options = {}) => {
    requests.push({ url, options });
    if (url === '/captcha-config') {
      return { ok: true, json: async () => ({ siteKey: 'site-key' }) };
    }
    if (url === '/region-environment-map') {
      return { ok: true, json: async () => ({ mapping: { USA: 'itrontotal.com', Canada: 'itrontotal.ca' } }) };
    }
    if (url === '/api/public/validate-existing') {
      return {
        ok: true,
        json: async () => ({
          valid: true,
          region: 'Canada',
          subscriber: {
            firstName: 'Jane',
            lastName: 'Doe',
            companyName: 'Acme Corp',
            email: 'dev@acme.com'
          },
          subscriptions: [
            {
              subscriptionId: 'sub-1',
              tenantShortCode: 'TEN-1',
              dataProductName: 'Product One',
              status: 'Active',
              startDate: '2026-01-01T00:00:00.000Z',
              endDate: '2026-12-31T00:00:00.000Z'
            }
          ]
        })
      };
    }
    if (url === '/api/public/data-products') {
      return {
        ok: true,
        json: async () => ([
          { dataProductId: 'prod-1', name: 'Product One' },
          { dataProductId: 'prod-2', name: 'Product Two' }
        ])
      };
    }
    if (url === '/api/public/requests') {
      return {
        ok: true,
        json: async () => ({ id: 42, status: 'New' })
      };
    }
    if (overrides.fetch) {
      return overrides.fetch(url, options);
    }
    throw new Error(`Unhandled fetch URL: ${url}`);
  });

  const window = { RECAPTCHA_SITE_KEY: null };
  const context = {
    window,
    document,
    fetch,
    grecaptcha: { execute: jestObject.fn().mockResolvedValue('captcha-token') },
    alert: jestObject.fn(),
    console
  };
  context.window.document = document;

  const script = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
  vm.runInNewContext(script, context, { filename: 'public/app.js' });

  return { elements, fetch, context, requests };
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
}

describe('frontend two-step flow', () => {
  it('renders existing subscriptions and submits selected products with tenant tokens', async () => {
    const { elements, requests } = createHarness();
    await flushPromises();

    elements.subscriberId.value = '00000000-0000-0000-0000-000000000000';

    await elements.validateExistingBtn.dispatch('click');

    expect(elements.existingSubscriptionsGroup.style.display).toBe('');
    expect(elements.existingSubscriptionsBody.innerHTML).toContain('sub-1');
    expect(elements.region.value).toBe('Canada');
    expect(elements.step2Panel.style.display).toBe('');
    // auto-filled from API response
    expect(elements.existingCompanyName.value).toBe('Acme Corp');
    expect(elements.existingEmail.value).toBe('dev@acme.com');

    // user fills remaining editable fields
    elements.existingSponsorName.value = 'John Smith';
    elements.existingSponsorEmail.value = 'john@itron.com';

    await elements.loadProductsBtn.dispatch('click');
    expect(elements.products.productCheckboxes).toHaveLength(2);

    elements.selectAllProductsCheckbox.checked = true;
    await elements.selectAllProductsCheckbox.dispatch('change');
    expect(elements.products.productCheckboxes.filter((item) => item.checked)).toHaveLength(2);

    elements.tenantShortCodes.value = 'TEN-1,TEN-2';
    await elements.tenantShortCodes.dispatch('blur');

    await elements.submitBtn.dispatch('click');

    const submitRequest = requests.find((entry) => entry.url === '/api/public/requests');
    const payload = JSON.parse(submitRequest.options.body);
    expect(payload.products).toEqual(['prod-1', 'prod-2']);
    expect(payload.productTenants).toEqual([
      { dataProductId: 'prod-1', tenantIds: ['TEN-1', 'TEN-2'] },
      { dataProductId: 'prod-2', tenantIds: ['TEN-1', 'TEN-2'] }
    ]);
  });

  it('supports the new subscriber flow with token validation and product controls', async () => {
    const { elements, context, requests } = createHarness();
    await flushPromises();

    elements.flowType.value = 'new';
    await elements.flowType.dispatch('change');

    elements.companyName.value = 'Example Co';
    elements.companyAddress.value = '123 Main';
    elements.phoneNumber.value = '555-1111';
    elements.email.value = 'dev@example.com';
    elements.firstName.value = 'Dev';
    elements.lastName.value = 'User';
    elements.sponsorName.value = 'Sponsor';
    elements.sponsorEmail.value = 'sponsor@example.com';

    await elements.continueNewBtn.dispatch('click');
    expect(elements.step2Panel.style.display).toBe('');

    await elements.loadProductsBtn.dispatch('click');
    elements.products.productCheckboxes[0].checked = true;
    elements.tenantShortCodes.value = 'bad code';
    await elements.submitBtn.dispatch('click');
    expect(elements.tenantValidation.textContent).toContain('Invalid tenant short code');

    elements.tenantShortCodes.value = 'TEN_A,TEN-B';
    await elements.tenantShortCodes.dispatch('blur');
    elements.clearAllProductsCheckbox.checked = true;
    await elements.clearAllProductsCheckbox.dispatch('change');
    expect(elements.products.productCheckboxes.filter((item) => item.checked)).toHaveLength(0);
    elements.selectAllProductsCheckbox.checked = true;
    await elements.selectAllProductsCheckbox.dispatch('change');
    expect(elements.products.productCheckboxes.filter((item) => item.checked)).toHaveLength(2);

    await elements.submitBtn.dispatch('click');

    const submitRequest = requests.find((entry) => entry.url === '/api/public/requests');
    const payload = JSON.parse(submitRequest.options.body);
    expect(payload.subscriber.flowType).toBe('new');
    expect(payload.subscriber.companyName).toBe('Example Co');
    expect(payload.productTenants[0].tenantIds).toEqual(['TEN_A', 'TEN-B']);
    expect(context.alert).not.toHaveBeenCalled();
  });
});