const adminLoginBtn = document.getElementById('adminLoginBtn');
const adminEmail = document.getElementById('adminEmail');
const adminPassword = document.getElementById('adminPassword');
const authResult = document.getElementById('authResult');
const authSection = document.getElementById('authSection');
const queueSection = document.getElementById('queueSection');
const detailSection = document.getElementById('detailSection');
const logoutBtn = document.getElementById('logoutBtn');
const loadRequestsBtn = document.getElementById('loadRequestsBtn');
const backBtn = document.getElementById('backBtn');
const statusFilter = document.getElementById('statusFilter');
const requestsBody = document.getElementById('requestsBody');
const detailContent = document.getElementById('detailContent');

let token = '';
let currentDetailRequestId = null;

adminLoginBtn.addEventListener('click', async () => {
  const email = String(adminEmail.value || '').trim();
  const password = adminPassword.value || '';

  try {
    const response = await fetch('/api/admin/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();
    if (!response.ok) {
      authResult.textContent = JSON.stringify(data, null, 2);
      return;
    }

    token = data.token || '';
    adminEmail.value = '';
    adminPassword.value = '';
    authResult.textContent = '';
    authSection.style.display = 'none';
    queueSection.style.display = 'block';
    await loadRequests();
  } catch (error) {
    authResult.textContent = `Error: ${error.message}`;
  }
});

logoutBtn.addEventListener('click', () => {
  token = '';
  authSection.style.display = 'block';
  queueSection.style.display = 'none';
  detailSection.style.display = 'none';
  authResult.textContent = '';
});

backBtn.addEventListener('click', () => {
  detailSection.style.display = 'none';
  queueSection.style.display = 'block';
});

statusFilter.addEventListener('change', loadRequests);
loadRequestsBtn.addEventListener('click', loadRequests);

async function loadRequests() {
  const filter = String(statusFilter.value || 'open');

  try {
    const response = await fetch(`/api/admin/requests?status=${encodeURIComponent(filter)}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!response.ok) {
      const data = await response.json();
      authResult.textContent = JSON.stringify(data, null, 2);
      return;
    }

    const requests = await response.json();
    requestsBody.innerHTML = requests.map((item) => {
      const createdAt = new Date(item.created_at).toLocaleString();
      const submitter = item.email || `${item.first_name || ''} ${item.last_name || ''}`.trim() || item.company_name || 'Unknown';
      return `
        <tr>
          <td>${item.id}</td>
          <td>${item.status}</td>
          <td>${item.flow_type}</td>
          <td>${submitter}</td>
          <td>${createdAt}</td>
          <td><button type="button" class="action-btn" onclick="viewDetail(${item.id})">View</button></td>
        </tr>
      `;
    }).join('');
  } catch (error) {
    authResult.textContent = `Error: ${error.message}`;
  }
}

async function viewDetail(requestId) {
  currentDetailRequestId = requestId;

  try {
    const response = await fetch(`/api/admin/requests/${requestId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!response.ok) {
      const data = await response.json();
      detailContent.innerHTML = `<pre>${JSON.stringify(data, null, 2)}</pre>`;
      queueSection.style.display = 'none';
      detailSection.style.display = 'block';
      return;
    }

    const data = await response.json();
    const req = data.request;
    const products = data.products.map((p) => p.data_product_id).join(', ');
    const history = data.history.map((h) => `${h.changed_at}: ${h.old_status} → ${h.new_status} (${h.changed_by})`).join('<br>');

    let detailHtml = `
      <div class="detail-card">
      <h3 class="detail-heading">Request #${req.id}</h3>
      <table class="detail-table">
        <tr>
          <td class="detail-key">Status</td>
          <td>${req.status}</td>
        </tr>
        <tr>
          <td class="detail-key">Flow Type</td>
          <td>${req.flow_type}</td>
        </tr>
        <tr>
          <td class="detail-key">Region</td>
          <td>${req.region}</td>
        </tr>
        <tr>
          <td class="detail-key">Products</td>
          <td>${products}</td>
        </tr>
        <tr>
          <td class="detail-key">Name</td>
          <td>${req.first_name || ''} ${req.last_name || ''} (${req.company_name || 'N/A'})</td>
        </tr>
        <tr>
          <td class="detail-key">Email</td>
          <td>${req.email || 'N/A'}</td>
        </tr>
        <tr>
          <td class="detail-key">Created</td>
          <td>${new Date(req.created_at).toLocaleString()}</td>
        </tr>
      </table>

      <div class="detail-actions">
        <h3 class="detail-heading">Change Status</h3>
        <label for="newStatus">New Status</label>
        <select id="newStatus">
          <option value="">-- Select Status --</option>
          <option value="New">New</option>
          <option value="In Review">In Review</option>
          <option value="Complete">Complete</option>
          <option value="Rejected">Rejected</option>
        </select>
        <label for="statusNotes">Notes</label>
        <textarea id="statusNotes" rows="3" placeholder="Optional notes for this status change"></textarea>
        <button type="button" onclick="updateStatus()">Update Status</button>
      </div>

      <h3 class="detail-heading" style="margin-top: 14px;">Status History</h3>
      <div class="history-box">${history || 'No history yet'}</div>
      </div>
    `;

    detailContent.innerHTML = detailHtml;
    queueSection.style.display = 'none';
    detailSection.style.display = 'block';
  } catch (error) {
    detailContent.innerHTML = `<pre>Error: ${error.message}</pre>`;
    queueSection.style.display = 'none';
    detailSection.style.display = 'block';
  }
}

async function updateStatus() {
  const newStatus = String(document.getElementById('newStatus').value || '').trim();
  const notes = String(document.getElementById('statusNotes').value || '').trim();

  if (!newStatus) {
    alert('Please select a new status.');
    return;
  }

  try {
    const response = await fetch(`/api/admin/requests/${currentDetailRequestId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ status: newStatus, notes })
    });

    if (!response.ok) {
      const data = await response.json();
      alert(`Error: ${data.error}`);
      return;
    }

    alert('Status updated successfully.');
    await viewDetail(currentDetailRequestId);
  } catch (error) {
    alert(`Error: ${error.message}`);
  }
}

window.viewDetail = viewDetail;
window.updateStatus = updateStatus;

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


