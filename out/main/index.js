import { app, ipcMain, BrowserWindow } from "electron";
import path, { join } from "path";
import { fileURLToPath } from "url";
import { config } from "dotenv";
import Store from "electron-store";
import { mkdir, writeFile } from "fs/promises";
import __cjs_mod__ from "node:module";
const __filename = import.meta.filename;
const __dirname = import.meta.dirname;
const require2 = __cjs_mod__.createRequire(import.meta.url);
function getPortalConfig() {
  const baseUrl = process.env.PORTAL_API_URL || process.env.TCN_PORTAL_URL;
  const apiKey = process.env.PORTAL_API_KEY || process.env.TCN_PORTAL_API_KEY;
  const normalizedUrl = baseUrl ? baseUrl.replace(/\/api\/sync\/?$/i, "") : baseUrl;
  return { baseUrl: normalizedUrl, apiKey };
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function apiRequest(endpoint, options = {}) {
  const { baseUrl, apiKey } = getPortalConfig();
  const maxRetries = options.retries ?? 2;
  const retryDelay = options.retryDelay ?? 1e3;
  const { retries, retryDelay: _, ...fetchOptions } = options;
  if (!baseUrl || !apiKey) {
    console.error("Portal not configured. baseUrl:", baseUrl ? "[SET]" : "[NOT SET]", "apiKey:", apiKey ? "[SET]" : "[NOT SET]");
    return { success: false, error: "VPS API not configured. Please check your environment settings." };
  }
  const url = `${baseUrl}${endpoint}`;
  const method = fetchOptions.method || "GET";
  let lastError = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (process.env.NODE_ENV !== "production") {
      if (attempt > 0) {
        console.log(`API Request retry ${attempt}/${maxRetries}: ${method} ${url}`);
      } else {
        console.log(`API Request: ${method} ${url}`);
      }
    }
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3e4);
      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "x-source": "tcn-comm",
          ...fetchOptions.headers
        }
      });
      clearTimeout(timeoutId);
      const text = await response.text();
      if (process.env.NODE_ENV !== "production") {
        console.log("API Response status:", response.status);
      }
      if (!response.ok) {
        if (response.status >= 400 && response.status < 500) {
          let errorMessage = `API error: ${response.status}`;
          try {
            const errorData = JSON.parse(text);
            errorMessage = errorData.error || errorData.message || errorMessage;
          } catch {
            if (text) errorMessage = text.substring(0, 200);
          }
          return { success: false, error: errorMessage };
        }
        throw new Error(`Server error: ${response.status} - ${text.substring(0, 200)}`);
      }
      if (!text || text.trim() === "") {
        return { success: true, data: null };
      }
      const result = JSON.parse(text);
      return result;
    } catch (error) {
      lastError = error;
      if (error.name === "AbortError") {
        console.error("API request timed out:", endpoint);
        lastError = new Error("Request timed out. Please try again.");
      } else if (error.message.includes("fetch") || error.message.includes("network")) {
        console.error("Network error:", error);
        lastError = new Error("Network error. Please check your connection.");
      }
      if (attempt < maxRetries) {
        console.log(`Retrying in ${retryDelay}ms...`);
        await sleep(retryDelay * (attempt + 1));
      }
    }
  }
  console.error("API request failed after retries:", lastError);
  return { success: false, error: lastError?.message || "Request failed after retries" };
}
function extractArray(result, ...keys) {
  if (!result) return [];
  for (const key of keys) {
    if (Array.isArray(result[key])) {
      return result[key];
    }
  }
  if (Array.isArray(result)) {
    return result;
  }
  return [];
}
let store;
try {
  const StoreClass = Store.default || Store;
  store = new StoreClass({
    encryptionKey: "tcn-communications-secret-key",
    name: "tcn-session"
  });
} catch (e) {
  console.error("Failed to initialize electron-store:", e);
  const memoryStore = {};
  store = {
    get: (key) => memoryStore[key],
    set: (key, value) => {
      memoryStore[key] = value;
    },
    delete: (key) => {
      delete memoryStore[key];
    }
  };
}
async function login(email, password) {
  try {
    console.log("Attempting login for:", email);
    const result = await apiRequest("/api/comm/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: email.toLowerCase(),
        password
      })
    });
    if (!result.success) {
      return { success: false, error: result.error || "Invalid email or password" };
    }
    const sessionData = {
      id: result.data.user.id,
      email: result.data.user.email,
      first_name: result.data.user.first_name,
      last_name: result.data.user.last_name,
      name: `${result.data.user.first_name} ${result.data.user.last_name}`,
      department: result.data.user.department,
      role: result.data.user.role,
      sessionToken: result.data.sessionToken,
      loggedInAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    store.set("currentUser", sessionData);
    return { success: true, user: sessionData };
  } catch (error) {
    console.error("Login error:", error);
    return { success: false, error: "An error occurred during login" };
  }
}
async function logout() {
  try {
    const currentUser = store.get("currentUser");
    if (currentUser?.sessionToken) {
      await apiRequest("/api/comm/auth/logout", {
        method: "POST",
        body: JSON.stringify({
          sessionToken: currentUser.sessionToken
        })
      });
    }
  } catch (error) {
    console.error("Logout API error (continuing anyway):", error);
  }
  store.delete("currentUser");
  return { success: true };
}
function getCurrentUser() {
  return store.get("currentUser") || null;
}
function isAuthenticated() {
  return !!store.get("currentUser");
}
async function createUser(userData) {
  try {
    const result = await apiRequest("/api/comm/users", {
      method: "POST",
      body: JSON.stringify({
        email: userData.email.toLowerCase(),
        password: userData.password,
        first_name: userData.first_name,
        last_name: userData.last_name,
        department: userData.department || "BAND_OFFICE",
        role: userData.role || "STAFF"
      })
    });
    if (!result.success) {
      return { success: false, error: result.error || "Failed to create user" };
    }
    return {
      success: true,
      user: result.data
    };
  } catch (error) {
    console.error("Create user error:", error);
    return { success: false, error: "Failed to create user" };
  }
}
async function getAllUsers() {
  try {
    const result = await apiRequest("/api/comm/users");
    if (!result.success) {
      return { success: false, error: result.error || "Failed to fetch users" };
    }
    return { success: true, users: result.data };
  } catch (error) {
    console.error("Get users error:", error);
    return { success: false, error: "Failed to fetch users" };
  }
}
let twilioClient = null;
async function getTwilioClient() {
  if (!twilioClient) {
    const twilio = await import("twilio");
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    if (!accountSid || !authToken) {
      throw new Error("Twilio credentials not configured");
    }
    twilioClient = twilio.default(accountSid, authToken);
  }
  return twilioClient;
}
function formatPhoneNumber(phone) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }
  return phone.startsWith("+") ? phone : `+${digits}`;
}
async function sendSms({ message, recipients, userId }) {
  const results = {
    successful: 0,
    failed: 0,
    total: recipients.length,
    messageIds: [],
    errors: []
  };
  try {
    const client = await getTwilioClient();
    const fromNumber = process.env.TWILIO_PHONE_NUMBER;
    if (!fromNumber) {
      throw new Error("Twilio phone number not configured");
    }
    for (const recipient of recipients) {
      try {
        const formattedNumber = formatPhoneNumber(recipient);
        const response = await client.messages.create({
          body: message,
          from: fromNumber,
          to: formattedNumber
        });
        results.messageIds.push(response.sid);
        results.successful++;
      } catch (error) {
        results.failed++;
        results.errors.push({
          recipient,
          error: error.message
        });
      }
    }
    let status = "sent";
    if (results.failed > 0 && results.successful > 0) {
      status = "partial";
    } else if (results.failed === results.total) {
      status = "failed";
    }
    await apiRequest("/api/comm/sms-logs", {
      method: "POST",
      body: JSON.stringify({
        message,
        recipients,
        status,
        messageIds: results.messageIds,
        error: results.errors.length > 0 ? JSON.stringify(results.errors) : null,
        userId
      })
    });
    return {
      success: status !== "failed",
      message: status === "sent" ? `Successfully sent ${results.successful} SMS messages` : status === "partial" ? `Sent ${results.successful} of ${results.total} messages` : "Failed to send messages",
      results
    };
  } catch (error) {
    await apiRequest("/api/comm/sms-logs", {
      method: "POST",
      body: JSON.stringify({
        message,
        recipients,
        status: "failed",
        messageIds: [],
        error: error.message,
        userId
      })
    });
    return {
      success: false,
      message: error.message,
      results
    };
  }
}
async function getSmsHistory(userId, limit = 50) {
  try {
    const endpoint = userId ? `/api/comm/sms-logs?userId=${userId}&limit=${limit}` : `/api/comm/sms-logs?limit=${limit}`;
    const result = await apiRequest(endpoint);
    if (!result.success) {
      return { success: false, error: result.error || "Failed to fetch SMS history" };
    }
    return { success: true, logs: result.data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
let resendClient = null;
async function getResendClient() {
  if (!resendClient) {
    const { Resend } = await import("resend");
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error("Resend API key not configured");
    }
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}
function createHtmlTemplate(message, subject) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${subject}</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }
        .header {
          border-bottom: 2px solid #00d9ff;
          padding-bottom: 20px;
          margin-bottom: 20px;
        }
        .header h1 {
          color: #1a1a2e;
          margin: 0;
          font-size: 24px;
        }
        .content {
          white-space: pre-wrap;
        }
        .footer {
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #eee;
          font-size: 12px;
          color: #666;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h2>Tataskweyak Cree Nation</h2>
      </div>
      <div class="content">${message.replace(/\n/g, "<br>")}</div>
      <div class="footer">
        <p>This email was sent by the Tataskweyak Cree Nation Band Office.</p>
      </div>
    </body>
    </html>
  `;
}
async function sendEmail({ subject, message, recipients, attachments, userId }) {
  const results = {
    successful: 0,
    failed: 0,
    total: recipients.length,
    messageId: null,
    errors: []
  };
  try {
    const resend = await getResendClient();
    const fromEmail = process.env.RESEND_FROM_EMAIL;
    const fromName = process.env.RESEND_FROM_NAME || "TCN Band Office";
    if (!fromEmail) {
      throw new Error("Resend from email not configured");
    }
    const htmlContent = createHtmlTemplate(message, subject);
    const emailAttachments = attachments?.map((att) => ({
      filename: att.filename,
      content: att.content
    })) || [];
    for (const recipient of recipients) {
      try {
        const response = await resend.emails.send({
          from: `${fromName} <${fromEmail}>`,
          to: [recipient],
          subject,
          html: htmlContent,
          text: message,
          attachments: emailAttachments
        });
        if (response.data?.id) {
          results.messageId = response.data.id;
          results.successful++;
        } else {
          throw new Error(response.error?.message || "Unknown error");
        }
      } catch (error) {
        results.failed++;
        results.errors.push({
          recipient,
          error: error.message
        });
      }
    }
    let status = "sent";
    if (results.failed > 0 && results.successful > 0) {
      status = "partial";
    } else if (results.failed === results.total) {
      status = "failed";
    }
    await apiRequest("/api/comm/email-logs", {
      method: "POST",
      body: JSON.stringify({
        subject,
        message,
        recipients,
        status,
        messageId: results.messageId,
        error: results.errors.length > 0 ? JSON.stringify(results.errors) : null,
        attachments: attachments ? attachments.map((a) => ({ filename: a.filename, size: a.size })) : null,
        userId
      })
    });
    return {
      success: status !== "failed",
      message: status === "sent" ? `Successfully sent ${results.successful} emails` : status === "partial" ? `Sent ${results.successful} of ${results.total} emails` : "Failed to send emails",
      results
    };
  } catch (error) {
    await apiRequest("/api/comm/email-logs", {
      method: "POST",
      body: JSON.stringify({
        subject,
        message,
        recipients,
        status: "failed",
        error: error.message,
        userId
      })
    });
    return {
      success: false,
      message: error.message,
      results
    };
  }
}
async function getEmailHistory(userId, limit = 50) {
  try {
    const endpoint = userId ? `/api/comm/email-logs?userId=${userId}&limit=${limit}` : `/api/comm/email-logs?limit=${limit}`;
    const result = await apiRequest(endpoint);
    if (!result.success) {
      return { success: false, error: result.error || "Failed to fetch email history" };
    }
    return { success: true, logs: result.data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
async function searchMembers(searchTerm, limit = 50) {
  try {
    const params = new URLSearchParams({
      query: searchTerm,
      limit: limit.toString(),
      activated: "true",
      fields: "both"
    });
    const result = await apiRequest(`/contacts?${params}`);
    if (result.success && result.data?.contacts) {
      return {
        success: true,
        members: result.data.contacts.map((contact) => ({
          id: contact.memberId,
          memberId: contact.memberId,
          t_number: contact.t_number,
          name: contact.name || `${contact.firstName} ${contact.lastName}`,
          firstName: contact.firstName,
          lastName: contact.lastName,
          phone: contact.phone,
          email: contact.email,
          community: contact.community,
          status: contact.status
        })),
        count: data.data.count,
        hasMore: data.data.pagination?.hasMore || false
      };
    }
    return { success: true, members: [], count: 0 };
  } catch (error) {
    console.error("Search members error:", error);
    return { success: false, error: error.message, members: [] };
  }
}
async function getAllPhoneNumbers(limit = 1e3) {
  try {
    const params = new URLSearchParams({
      limit: limit.toString(),
      activated: "true",
      fields: "phone"
    });
    const result = await apiRequest(`/contacts?${params}`);
    if (result.success && result.data?.contacts) {
      return {
        success: true,
        members: result.data.contacts.filter((c) => c.phone).map((contact) => ({
          id: contact.memberId,
          name: contact.name || `${contact.firstName} ${contact.lastName}`,
          phone: contact.phone
        }))
      };
    }
    return { success: true, members: [] };
  } catch (error) {
    return { success: false, error: error.message, members: [] };
  }
}
async function getAllEmails(limit = 1e3) {
  try {
    const params = new URLSearchParams({
      limit: limit.toString(),
      activated: "true",
      fields: "email"
    });
    const result = await apiRequest(`/contacts?${params}`);
    if (result.success && result.data?.contacts) {
      return {
        success: true,
        members: result.data.contacts.filter((c) => c.email).map((contact) => ({
          id: contact.memberId,
          name: contact.name || `${contact.firstName} ${contact.lastName}`,
          email: contact.email
        }))
      };
    }
    return { success: true, members: [] };
  } catch (error) {
    return { success: false, error: error.message, members: [] };
  }
}
async function testConnection() {
  try {
    const result = await apiRequest("/health");
    if (result.success) {
      return { success: true, message: "Portal API connected" };
    }
    return { success: false, error: result.error || "Connection failed" };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
function createMultipartFormData(fields, file) {
  const boundary = "----FormBoundary" + Math.random().toString(36).substring(2);
  const parts = [];
  for (const [name, value] of Object.entries(fields)) {
    parts.push(
      `--${boundary}\r
Content-Disposition: form-data; name="${name}"\r
\r
${value}\r
`
    );
  }
  if (file) {
    parts.push(
      `--${boundary}\r
Content-Disposition: form-data; name="file"; filename="${file.filename}"\r
Content-Type: ${file.contentType}\r
\r
`
    );
  }
  const header = Buffer.from(parts.join(""), "utf8");
  const footer = Buffer.from(`\r
--${boundary}--\r
`, "utf8");
  const body = Buffer.concat([header, file.data, footer]);
  return {
    body,
    contentType: `multipart/form-data; boundary=${boundary}`
  };
}
async function uploadPoster({ sourceId, filename, data: data2, mimeType }) {
  const { baseUrl, apiKey } = getPortalConfig();
  try {
    if (!baseUrl || !apiKey) {
      const uploadsDir = join(app.getPath("userData"), "uploads", "posters");
      await mkdir(uploadsDir, { recursive: true });
      const base64Data2 = data2.replace(/^data:image\/\w+;base64,/, "");
      const buffer2 = Buffer.from(base64Data2, "base64");
      const ext2 = filename.split(".").pop() || "jpg";
      const localFilename = `${sourceId}.${ext2}`;
      const filePath = join(uploadsDir, localFilename);
      await writeFile(filePath, buffer2);
      return {
        success: true,
        poster_url: `local://${filePath}`,
        message: "Poster saved locally (portal not configured)"
      };
    }
    const base64Data = data2.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");
    const ext = filename.split(".").pop() || "jpg";
    const uploadFilename = `${sourceId}.${ext}`;
    const { body, contentType } = createMultipartFormData(
      { sourceId, filename },
      { filename: uploadFilename, contentType: mimeType || "image/jpeg", data: buffer }
    );
    const response = await fetch(`${baseUrl}/api/comm/bulletin/poster`, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "x-source": "tcn-comm",
        "Content-Type": contentType
      },
      body
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Upload failed: ${response.status} - ${errorText}`);
    }
    const result = await response.json();
    if (!result.success) {
      throw new Error(result.message || "Upload failed");
    }
    return {
      success: true,
      poster_url: result.data.poster_url,
      message: "Poster uploaded successfully"
    };
  } catch (error) {
    console.error("Upload poster error:", error);
    return {
      success: false,
      message: error.message || "Failed to upload poster"
    };
  }
}
async function createBulletin({ title, subject, category, posterFile, userId }) {
  if (!posterFile || !posterFile.data) {
    return { success: false, message: "Poster image is required" };
  }
  try {
    const createResult = await apiRequest("/api/comm/bulletin", {
      method: "POST",
      body: JSON.stringify({
        title,
        subject,
        category: category || "ANNOUNCEMENTS",
        userId,
        poster_url: ""
        // Will update after upload
      })
    });
    if (!createResult.success) {
      return { success: false, message: createResult.error || "Failed to create bulletin" };
    }
    const bulletinId = createResult.data.id;
    const uploadResult = await uploadPoster({
      sourceId: bulletinId,
      filename: posterFile.filename,
      data: posterFile.data,
      mimeType: posterFile.mimeType
    });
    if (!uploadResult.success) {
      await apiRequest(`/api/comm/bulletin/${bulletinId}`, { method: "DELETE" });
      return { success: false, message: `Failed to upload poster: ${uploadResult.message}` };
    }
    const updateResult = await apiRequest(`/api/comm/bulletin/${bulletinId}`, {
      method: "PUT",
      body: JSON.stringify({ poster_url: uploadResult.poster_url })
    });
    if (!updateResult.success) {
      return {
        success: false,
        message: "Poster uploaded but failed to update bulletin",
        bulletin: { id: bulletinId, title, subject, poster_url: uploadResult.poster_url, synced: false }
      };
    }
    return {
      success: true,
      message: "Bulletin posted successfully",
      bulletin: {
        id: bulletinId,
        title,
        subject,
        poster_url: uploadResult.poster_url,
        category,
        synced: true
      }
    };
  } catch (error) {
    console.error("Create bulletin error:", error);
    return { success: false, message: error.message || "Failed to post bulletin" };
  }
}
async function deleteBulletin(bulletinId) {
  try {
    const result = await apiRequest(`/api/comm/bulletin/${bulletinId}`, {
      method: "DELETE"
    });
    if (!result.success) {
      return { success: false, message: result.error || "Failed to delete bulletin" };
    }
    return { success: true, message: "Bulletin deleted successfully" };
  } catch (error) {
    console.error("Delete bulletin error:", error);
    return { success: false, message: error.message };
  }
}
async function getBulletinHistory(userId, limit = 50) {
  try {
    const endpoint = userId ? `/api/comm/bulletin?userId=${userId}&limit=${limit}` : `/api/comm/bulletin?limit=${limit}`;
    const result = await apiRequest(endpoint);
    if (!result.success) {
      return { success: false, error: result.error || "Failed to fetch bulletins", logs: [] };
    }
    return { success: true, logs: result.data };
  } catch (error) {
    console.error("Get bulletin history error:", error);
    return { success: false, error: error.message, logs: [] };
  }
}
async function createForm({ title, description, category, deadline, maxEntries, allowResubmit, resubmitMessage, fields, userId }) {
  try {
    const result = await apiRequest("/api/comm/signup-forms", {
      method: "POST",
      body: JSON.stringify({
        title,
        description: description || null,
        category: category || "BAND_OFFICE",
        deadline: deadline ? new Date(deadline).toISOString() : null,
        maxEntries: maxEntries || null,
        isActive: true,
        allowResubmit: allowResubmit || false,
        resubmitMessage: resubmitMessage || null,
        createdBy: userId,
        fields: fields.map((field, index) => ({
          fieldId: field.fieldId || generateFieldId(field.label),
          label: field.label,
          fieldType: field.fieldType,
          options: field.options || null,
          placeholder: field.placeholder || null,
          required: field.required || false,
          order: index
        }))
      })
    });
    if (!result.success) {
      return { success: false, message: result.error || "Failed to create form" };
    }
    return { success: true, form: result.data };
  } catch (error) {
    console.error("Create form error:", error);
    return { success: false, message: error.message };
  }
}
function generateFieldId(label) {
  return label.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
}
async function updateForm({ formId, title, description, category, deadline, maxEntries, isActive, allowResubmit, resubmitMessage, fields }) {
  try {
    const result = await apiRequest(`/api/comm/signup-forms/${formId}`, {
      method: "PUT",
      body: JSON.stringify({
        title,
        description: description || null,
        category: category || "BAND_OFFICE",
        deadline: deadline ? new Date(deadline).toISOString() : null,
        maxEntries: maxEntries || null,
        isActive,
        allowResubmit: allowResubmit || false,
        resubmitMessage: resubmitMessage || null,
        fields: fields.map((field, index) => ({
          fieldId: field.fieldId || generateFieldId(field.label),
          label: field.label,
          fieldType: field.fieldType,
          options: field.options || null,
          placeholder: field.placeholder || null,
          required: field.required || false,
          order: index
        }))
      })
    });
    if (!result.success) {
      return { success: false, message: result.error || "Failed to update form" };
    }
    return { success: true, form: result.data };
  } catch (error) {
    console.error("Update form error:", error);
    return { success: false, message: error.message };
  }
}
async function deleteForm(formId) {
  try {
    const result = await apiRequest(`/api/comm/signup-forms/${formId}`, {
      method: "DELETE"
    });
    if (!result.success) {
      return { success: false, message: result.error || "Failed to delete form" };
    }
    return { success: true };
  } catch (error) {
    console.error("Delete form error:", error);
    return { success: false, message: error.message };
  }
}
async function getForm(formId) {
  try {
    const result = await apiRequest(`/api/comm/signup-forms/${formId}`);
    if (!result.success) {
      return { success: false, message: result.error || "Form not found" };
    }
    return { success: true, form: result.data };
  } catch (error) {
    console.error("Get form error:", error);
    return { success: false, message: error.message };
  }
}
async function getAllForms(userId = null) {
  try {
    const endpoint = userId ? `/api/comm/signup-forms?userId=${userId}` : "/api/comm/signup-forms";
    const result = await apiRequest(endpoint);
    console.log("Forms API result:", JSON.stringify(result, null, 2));
    if (!result.success) {
      return { success: false, message: result.error || "Failed to fetch forms", forms: [] };
    }
    const forms = Array.isArray(result.data) ? result.data : Array.isArray(result.forms) ? result.forms : result.data?.forms ? result.data.forms : [];
    return { success: true, forms };
  } catch (error) {
    console.error("Get all forms error:", error);
    return { success: false, message: error.message, forms: [] };
  }
}
async function submitForm({ formId, memberId, name, email, phone, responses }) {
  try {
    const result = await apiRequest(`/api/comm/signup-forms/${formId}/submissions`, {
      method: "POST",
      body: JSON.stringify({
        memberId: memberId || null,
        name,
        email: email || null,
        phone: phone || null,
        responses
      })
    });
    if (!result.success) {
      return { success: false, message: result.error || "Failed to submit form" };
    }
    return { success: true, submission: result.data };
  } catch (error) {
    console.error("Submit form error:", error);
    return { success: false, message: error.message };
  }
}
async function getFormSubmissions(formId) {
  try {
    const result = await apiRequest(`/api/comm/signup-forms/${formId}/submissions`);
    if (!result.success) {
      return { success: false, message: result.error || "Failed to fetch submissions", submissions: [] };
    }
    return { success: true, submissions: result.data };
  } catch (error) {
    console.error("Get submissions error:", error);
    return { success: false, message: error.message, submissions: [] };
  }
}
async function deleteSubmission(submissionId) {
  try {
    const result = await apiRequest(`/api/comm/signup-forms/submissions/${submissionId}`, {
      method: "DELETE"
    });
    if (!result.success) {
      return { success: false, message: result.error || "Failed to delete submission" };
    }
    return { success: true };
  } catch (error) {
    console.error("Delete submission error:", error);
    return { success: false, message: error.message };
  }
}
async function syncSubmissions(formId) {
  try {
    const result = await getFormSubmissions(formId);
    return {
      success: true,
      synced: result.submissions?.length || 0,
      skipped: 0,
      total: result.submissions?.length || 0,
      message: `Form has ${result.submissions?.length || 0} submissions on VPS`
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
function getPayPeriodDates(date = /* @__PURE__ */ new Date()) {
  const referenceDate = /* @__PURE__ */ new Date("2025-01-06");
  const targetDate = new Date(date);
  const daysSinceReference = Math.floor((targetDate - referenceDate) / (1e3 * 60 * 60 * 24));
  const periodIndex = Math.floor(daysSinceReference / 14);
  const periodStart = new Date(referenceDate);
  periodStart.setDate(periodStart.getDate() + periodIndex * 14);
  const periodEnd = new Date(periodStart);
  periodEnd.setDate(periodEnd.getDate() + 13);
  return {
    start: periodStart.toISOString(),
    end: periodEnd.toISOString()
  };
}
function calculateHoursFromTimes(startTime, endTime, breakMinutes = 0) {
  if (!startTime || !endTime) return 0;
  const [startHour, startMin] = startTime.split(":").map(Number);
  const [endHour, endMin] = endTime.split(":").map(Number);
  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;
  let totalMinutes = endMinutes - startMinutes - breakMinutes;
  if (totalMinutes < 0) totalMinutes = 0;
  return Math.round(totalMinutes / 60 * 100) / 100;
}
async function getOrCreateCurrentTimesheet({ userId }) {
  try {
    const { start, end } = getPayPeriodDates(/* @__PURE__ */ new Date());
    const getResult = await apiRequest(`/api/timesheets/user/${userId}`);
    if (getResult.success) {
      const timesheets = Array.isArray(getResult.data) ? getResult.data : Array.isArray(getResult.timesheets) ? getResult.timesheets : [];
      const currentTimesheet = timesheets.find((ts) => {
        const tsStart = new Date(ts.payPeriodStart).toDateString();
        const periodStart = new Date(start).toDateString();
        return tsStart === periodStart;
      });
      if (currentTimesheet) {
        return { success: true, timesheet: currentTimesheet };
      }
    }
    const createResult = await apiRequest("/api/timesheets", {
      method: "POST",
      body: JSON.stringify({
        userId,
        payPeriodStart: start,
        payPeriodEnd: end,
        dailyHours: {},
        status: "DRAFT"
      })
    });
    if (createResult.success) {
      return { success: true, timesheet: createResult.data };
    }
    return createResult;
  } catch (error) {
    console.error("Error getting/creating timesheet:", error);
    return { success: false, error: error.message };
  }
}
async function getTimesheetById({ timesheetId }) {
  return await apiRequest(`/api/timesheets/${timesheetId}`);
}
async function getUserTimesheets({ userId, status }) {
  const endpoint = status ? `/api/timesheets/user/${userId}?status=${status}` : `/api/timesheets/user/${userId}`;
  return await apiRequest(endpoint);
}
async function getAllTimesheets({ status, department }) {
  const params = new URLSearchParams();
  if (status) params.append("status", status);
  if (department) params.append("department", department);
  const queryString = params.toString();
  const endpoint = queryString ? `/api/timesheets?${queryString}` : "/api/timesheets";
  return await apiRequest(endpoint);
}
async function saveTimeEntry({ timesheetId, date, startTime, endTime, breakMinutes, totalHours }) {
  try {
    const getResult = await apiRequest(`/api/timesheets/${timesheetId}`);
    if (!getResult.success) {
      return getResult;
    }
    const timesheet = getResult.data;
    if (timesheet.status !== "DRAFT") {
      return { success: false, error: "Cannot edit a submitted timesheet" };
    }
    const hours = totalHours !== void 0 ? totalHours : calculateHoursFromTimes(startTime, endTime, breakMinutes || 0);
    const dailyHours = timesheet.dailyHours || {};
    const dateKey = new Date(date).toISOString().split("T")[0];
    dailyHours[dateKey] = {
      startTime,
      endTime,
      breakMinutes: breakMinutes || 0,
      totalHours: hours
    };
    let regularHours = 0;
    Object.values(dailyHours).forEach((entry) => {
      regularHours += entry.totalHours || 0;
    });
    const updateResult = await apiRequest("/api/timesheets", {
      method: "POST",
      // Upsert
      body: JSON.stringify({
        userId: timesheet.userId,
        payPeriodStart: timesheet.payPeriodStart,
        payPeriodEnd: timesheet.payPeriodEnd,
        dailyHours,
        regularHours: Math.round(regularHours * 100) / 100,
        totalHours: Math.round(regularHours * 100) / 100,
        status: "DRAFT"
      })
    });
    return updateResult;
  } catch (error) {
    console.error("Error saving time entry:", error);
    return { success: false, error: error.message };
  }
}
async function deleteTimeEntry({ timesheetId, date }) {
  try {
    const getResult = await apiRequest(`/api/timesheets/${timesheetId}`);
    if (!getResult.success) {
      return getResult;
    }
    const timesheet = getResult.data;
    if (timesheet.status !== "DRAFT") {
      return { success: false, error: "Cannot edit a submitted timesheet" };
    }
    const dailyHours = timesheet.dailyHours || {};
    const dateKey = new Date(date).toISOString().split("T")[0];
    delete dailyHours[dateKey];
    let regularHours = 0;
    Object.values(dailyHours).forEach((entry) => {
      regularHours += entry.totalHours || 0;
    });
    const updateResult = await apiRequest("/api/timesheets", {
      method: "POST",
      body: JSON.stringify({
        userId: timesheet.userId,
        payPeriodStart: timesheet.payPeriodStart,
        payPeriodEnd: timesheet.payPeriodEnd,
        dailyHours,
        regularHours: Math.round(regularHours * 100) / 100,
        totalHours: Math.round(regularHours * 100) / 100,
        status: "DRAFT"
      })
    });
    return updateResult;
  } catch (error) {
    console.error("Error deleting time entry:", error);
    return { success: false, error: error.message };
  }
}
async function submitTimesheet({ timesheetId }) {
  return await apiRequest(`/api/timesheets/${timesheetId}/submit`, {
    method: "POST"
  });
}
async function approveTimesheet({ timesheetId, approverId }) {
  return await apiRequest(`/api/timesheets/${timesheetId}/approve`, {
    method: "POST",
    body: JSON.stringify({ approverId })
  });
}
async function rejectTimesheet({ timesheetId, rejecterId, reason }) {
  return await apiRequest(`/api/timesheets/${timesheetId}/reject`, {
    method: "POST",
    body: JSON.stringify({ rejecterId, reason })
  });
}
async function revertToDraft({ timesheetId }) {
  const getResult = await apiRequest(`/api/timesheets/${timesheetId}`);
  if (!getResult.success) {
    return getResult;
  }
  const timesheet = getResult.data;
  if (timesheet.status !== "REJECTED") {
    return { success: false, error: "Only rejected timesheets can be reverted to draft" };
  }
  return await apiRequest("/api/timesheets", {
    method: "POST",
    body: JSON.stringify({
      userId: timesheet.userId,
      payPeriodStart: timesheet.payPeriodStart,
      payPeriodEnd: timesheet.payPeriodEnd,
      dailyHours: timesheet.dailyHours,
      regularHours: timesheet.regularHours,
      totalHours: timesheet.totalHours,
      status: "DRAFT"
    })
  });
}
async function deleteTimesheet({ timesheetId }) {
  return await apiRequest(`/api/timesheets/${timesheetId}`, {
    method: "DELETE"
  });
}
async function getPayPeriodInfo() {
  const { start, end } = getPayPeriodDates(/* @__PURE__ */ new Date());
  return {
    success: true,
    payPeriod: {
      start,
      end,
      startFormatted: new Date(start).toLocaleDateString(),
      endFormatted: new Date(end).toLocaleDateString()
    }
  };
}
async function getTimesheetStats(userId) {
  const result = await apiRequest(`/api/timesheets/stats/${userId}`);
  if (result.success) {
    return result.data;
  }
  return { pending: 0, currentPeriod: null };
}
const DEFAULT_RATES = {
  hotelRate: 200,
  privateRate: 50,
  breakfastRate: 20.5,
  lunchRate: 20.1,
  dinnerRate: 50.65,
  incidentalRate: 10,
  personalVehicleRate: 0.5,
  oneWayWinnipegKm: 904,
  oneWayThompsonKm: 150,
  winnipegFlatRate: 450,
  thompsonFlatRate: 100,
  taxiFareRate: 17.3
};
async function createTravelForm(data2) {
  const formData = {
    ...DEFAULT_RATES,
    ...data2
  };
  return await apiRequest("/api/travel-forms", {
    method: "POST",
    body: JSON.stringify(formData)
  });
}
async function updateTravelForm(data2) {
  const { formId, ...updateData } = data2;
  return await apiRequest(`/api/travel-forms/${formId}`, {
    method: "PUT",
    body: JSON.stringify(updateData)
  });
}
async function getTravelFormById({ formId }) {
  const result = await apiRequest(`/api/travel-forms/${formId}`);
  if (result.success) {
    return { success: true, travelForm: result.data };
  }
  return result;
}
async function getUserTravelForms({ userId, status }) {
  const endpoint = status && status !== "ALL" ? `/api/travel-forms/user/${userId}?status=${status}` : `/api/travel-forms/user/${userId}`;
  const result = await apiRequest(endpoint);
  if (result.success) {
    return { success: true, travelForms: result.data };
  }
  return result;
}
async function getAllTravelForms({ status, department }) {
  const params = new URLSearchParams();
  if (status && status !== "ALL") params.append("status", status);
  if (department) params.append("department", department);
  const queryString = params.toString();
  const endpoint = queryString ? `/api/travel-forms?${queryString}` : "/api/travel-forms";
  const result = await apiRequest(endpoint);
  if (result.success) {
    return { success: true, travelForms: result.data };
  }
  return result;
}
async function submitTravelForm({ formId }) {
  const result = await apiRequest(`/api/travel-forms/${formId}/submit`, {
    method: "POST"
  });
  if (result.success) {
    return { success: true, travelForm: result.data };
  }
  return result;
}
async function approveTravelForm({ formId, approverId }) {
  const result = await apiRequest(`/api/travel-forms/${formId}/approve`, {
    method: "POST",
    body: JSON.stringify({ approverId })
  });
  if (result.success) {
    return { success: true, travelForm: result.data };
  }
  return result;
}
async function rejectTravelForm({ formId, rejecterId, reason }) {
  const result = await apiRequest(`/api/travel-forms/${formId}/reject`, {
    method: "POST",
    body: JSON.stringify({ rejecterId, reason })
  });
  if (result.success) {
    return { success: true, travelForm: result.data };
  }
  return result;
}
async function deleteTravelForm({ formId }) {
  return await apiRequest(`/api/travel-forms/${formId}`, {
    method: "DELETE"
  });
}
async function getDefaultRates() {
  const result = await apiRequest("/api/travel-forms/rates");
  if (result.success) {
    return { success: true, rates: result.data };
  }
  return { success: true, rates: DEFAULT_RATES };
}
async function getTravelFormStats(userId) {
  const result = await apiRequest(`/api/travel-forms/stats/${userId}`);
  if (result.success) {
    return result.data;
  }
  return { drafts: 0, pending: 0 };
}
async function getAllMemos(department = null) {
  try {
    const endpoint = department ? `/api/memos?department=${encodeURIComponent(department)}` : "/api/memos";
    const result = await apiRequest(endpoint);
    if (!result.success) {
      console.error("Failed to fetch memos:", result.error);
      return [];
    }
    return extractArray(result, "data", "memos");
  } catch (error) {
    console.error("Get all memos error:", error);
    return [];
  }
}
async function getMemoById(memoId) {
  try {
    const result = await apiRequest(`/api/memos/${memoId}`);
    if (!result.success) {
      return { success: false, error: result.error };
    }
    return { success: true, memo: result.data || result.memo };
  } catch (error) {
    console.error("Get memo error:", error);
    return { success: false, error: error.message };
  }
}
async function createMemo({ title, content, priority, department, isPinned, authorId }) {
  try {
    const result = await apiRequest("/api/memos", {
      method: "POST",
      body: JSON.stringify({
        title,
        content,
        priority: priority || "low",
        department: department || null,
        isPinned: isPinned || false,
        authorId,
        isPublished: true
      })
    });
    if (!result.success) {
      return { success: false, error: result.error || "Failed to create memo" };
    }
    return { success: true, memo: result.data || result.memo };
  } catch (error) {
    console.error("Create memo error:", error);
    return { success: false, error: error.message };
  }
}
async function updateMemo(memoId, updates) {
  try {
    const result = await apiRequest(`/api/memos/${memoId}`, {
      method: "PUT",
      body: JSON.stringify(updates)
    });
    if (!result.success) {
      return { success: false, error: result.error || "Failed to update memo" };
    }
    return { success: true, memo: result.data || result.memo };
  } catch (error) {
    console.error("Update memo error:", error);
    return { success: false, error: error.message };
  }
}
async function deleteMemo(memoId) {
  try {
    const result = await apiRequest(`/api/memos/${memoId}`, {
      method: "DELETE"
    });
    if (!result.success) {
      return { success: false, error: result.error || "Failed to delete memo" };
    }
    return { success: true };
  } catch (error) {
    console.error("Delete memo error:", error);
    return { success: false, error: error.message };
  }
}
async function markMemoAsRead(memoId, userId) {
  try {
    const result = await apiRequest(`/api/memos/${memoId}/read`, {
      method: "POST",
      body: JSON.stringify({ userId })
    });
    if (!result.success) {
      return { success: false, error: result.error || "Failed to mark memo as read" };
    }
    return { success: true };
  } catch (error) {
    console.error("Mark memo as read error:", error);
    return { success: false, error: error.message };
  }
}
const __filename$1 = fileURLToPath(import.meta.url);
const __dirname$1 = path.dirname(__filename$1);
config({ path: path.resolve(__dirname$1, "../../.env") });
function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname$1, "../preload/index.mjs"),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    },
    titleBarStyle: "hiddenInset",
    backgroundColor: "#1a1a2e"
  });
  if (process.env.NODE_ENV === "development") {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname$1, "../renderer/index.html"));
  }
}
ipcMain.handle("auth:login", async (event, { email, password }) => {
  return await login(email, password);
});
ipcMain.handle("auth:logout", () => {
  return logout();
});
ipcMain.handle("auth:getCurrentUser", () => {
  return getCurrentUser();
});
ipcMain.handle("auth:isAuthenticated", () => {
  return isAuthenticated();
});
ipcMain.handle("auth:createUser", async (event, userData) => {
  return await createUser(userData);
});
ipcMain.handle("auth:getAllUsers", async () => {
  return await getAllUsers();
});
ipcMain.handle("sms:send", async (event, { message, recipients, userId }) => {
  return await sendSms({ message, recipients, userId });
});
ipcMain.handle("sms:getHistory", async (event, { userId, limit }) => {
  return await getSmsHistory(userId, limit);
});
ipcMain.handle("email:send", async (event, { subject, message, recipients, attachments, userId }) => {
  return await sendEmail({ subject, message, recipients, attachments, userId });
});
ipcMain.handle("email:getHistory", async (event, { userId, limit }) => {
  return await getEmailHistory(userId, limit);
});
ipcMain.handle("contacts:search", async (event, { searchTerm, limit }) => {
  return await searchMembers(searchTerm, limit);
});
ipcMain.handle("contacts:getAllPhones", async (event, { limit }) => {
  return await getAllPhoneNumbers(limit);
});
ipcMain.handle("contacts:getAllEmails", async (event, { limit }) => {
  return await getAllEmails(limit);
});
ipcMain.handle("contacts:testConnection", async () => {
  return await testConnection();
});
ipcMain.handle("bulletin:create", async (event, data2) => {
  return await createBulletin(data2);
});
ipcMain.handle("bulletin:delete", async (event, sourceId) => {
  return await deleteBulletin(sourceId);
});
ipcMain.handle("bulletin:getHistory", async (event, { userId, limit }) => {
  return await getBulletinHistory(userId, limit);
});
ipcMain.handle("forms:create", async (event, data2) => {
  return await createForm(data2);
});
ipcMain.handle("forms:update", async (event, data2) => {
  return await updateForm(data2);
});
ipcMain.handle("forms:delete", async (event, { formId }) => {
  return await deleteForm(formId);
});
ipcMain.handle("forms:get", async (event, { formId }) => {
  return await getForm(formId);
});
ipcMain.handle("forms:getAll", async (event, { userId }) => {
  return await getAllForms(userId);
});
ipcMain.handle("forms:submit", async (event, data2) => {
  return await submitForm(data2);
});
ipcMain.handle("forms:getSubmissions", async (event, { formId }) => {
  return await getFormSubmissions(formId);
});
ipcMain.handle("forms:deleteSubmission", async (event, { submissionId }) => {
  return await deleteSubmission(submissionId);
});
ipcMain.handle("forms:syncSubmissions", async (event, { formId }) => {
  return await syncSubmissions(formId);
});
ipcMain.handle("timesheets:getCurrent", async (event, { userId }) => {
  return await getOrCreateCurrentTimesheet({ userId });
});
ipcMain.handle("timesheets:getById", async (event, { timesheetId }) => {
  return await getTimesheetById({ timesheetId });
});
ipcMain.handle("timesheets:getUserTimesheets", async (event, { userId, status }) => {
  return await getUserTimesheets({ userId, status });
});
ipcMain.handle("timesheets:getAll", async (event, { status, department }) => {
  return await getAllTimesheets({ status, department });
});
ipcMain.handle("timesheets:saveEntry", async (event, data2) => {
  return await saveTimeEntry(data2);
});
ipcMain.handle("timesheets:deleteEntry", async (event, { entryId }) => {
  return await deleteTimeEntry({});
});
ipcMain.handle("timesheets:submit", async (event, { timesheetId }) => {
  return await submitTimesheet({ timesheetId });
});
ipcMain.handle("timesheets:approve", async (event, { timesheetId, approverId }) => {
  return await approveTimesheet({ timesheetId, approverId });
});
ipcMain.handle("timesheets:reject", async (event, { timesheetId, rejecterId, reason }) => {
  return await rejectTimesheet({ timesheetId, rejecterId, reason });
});
ipcMain.handle("timesheets:revertToDraft", async (event, { timesheetId }) => {
  return await revertToDraft({ timesheetId });
});
ipcMain.handle("timesheets:delete", async (event, { timesheetId }) => {
  return await deleteTimesheet({ timesheetId });
});
ipcMain.handle("timesheets:getPayPeriodInfo", async (event, { date }) => {
  return await getPayPeriodInfo();
});
ipcMain.handle("timesheets:getStats", async (event, { userId }) => {
  return await getTimesheetStats(userId);
});
ipcMain.handle("memos:getAll", async (event, { department }) => {
  return await getAllMemos(department);
});
ipcMain.handle("memos:getById", async (event, { memoId }) => {
  return await getMemoById(memoId);
});
ipcMain.handle("memos:create", async (event, data2) => {
  return await createMemo(data2);
});
ipcMain.handle("memos:update", async (event, { memoId, updates }) => {
  return await updateMemo(memoId, updates);
});
ipcMain.handle("memos:delete", async (event, { memoId }) => {
  return await deleteMemo(memoId);
});
ipcMain.handle("memos:markAsRead", async (event, { memoId, userId }) => {
  return await markMemoAsRead(memoId, userId);
});
ipcMain.handle("travelForms:create", async (event, data2) => {
  return await createTravelForm(data2);
});
ipcMain.handle("travelForms:update", async (event, data2) => {
  return await updateTravelForm(data2);
});
ipcMain.handle("travelForms:getById", async (event, { formId }) => {
  return await getTravelFormById({ formId });
});
ipcMain.handle("travelForms:getUserForms", async (event, { userId, status }) => {
  return await getUserTravelForms({ userId, status });
});
ipcMain.handle("travelForms:getAll", async (event, { status, department }) => {
  return await getAllTravelForms({ status, department });
});
ipcMain.handle("travelForms:submit", async (event, { formId }) => {
  return await submitTravelForm({ formId });
});
ipcMain.handle("travelForms:approve", async (event, { formId, approverId }) => {
  return await approveTravelForm({ formId, approverId });
});
ipcMain.handle("travelForms:reject", async (event, { formId, rejecterId, reason }) => {
  return await rejectTravelForm({ formId, rejecterId, reason });
});
ipcMain.handle("travelForms:delete", async (event, { formId }) => {
  return await deleteTravelForm({ formId });
});
ipcMain.handle("travelForms:getDefaultRates", async () => {
  return await getDefaultRates();
});
ipcMain.handle("travelForms:getStats", async (event, userId) => {
  return await getTravelFormStats(userId);
});
app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
app.on("window-all-closed", async () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
app.on("before-quit", async () => {
  try {
    await logout();
  } catch (e) {
  }
});
