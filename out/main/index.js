import { app, ipcMain, BrowserWindow } from "electron";
import path, { join } from "path";
import bcrypt from "bcryptjs";
import Store from "electron-store";
import { PrismaClient } from "@prisma/client";
import { mkdir, writeFile } from "fs/promises";
import __cjs_mod__ from "node:module";
const __filename = import.meta.filename;
const __dirname = import.meta.dirname;
const require2 = __cjs_mod__.createRequire(import.meta.url);
let prisma = null;
function getPrisma() {
  if (!prisma) {
    prisma = new PrismaClient();
  }
  return prisma;
}
async function disconnectPrisma() {
  if (prisma) {
    await prisma.$disconnect();
    prisma = null;
  }
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
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION = 30 * 60 * 1e3;
async function login(email, password) {
  const prisma2 = getPrisma();
  try {
    console.log("Attempting login for:", email);
    const user = await prisma2.user.findUnique({
      where: { email: email.toLowerCase() }
    });
    if (!user) {
      return { success: false, error: "Invalid email or password" };
    }
    if (user.lockedUntil && new Date(user.lockedUntil) > /* @__PURE__ */ new Date()) {
      const remainingTime = Math.ceil((new Date(user.lockedUntil) - /* @__PURE__ */ new Date()) / 6e4);
      return {
        success: false,
        error: `Account locked. Try again in ${remainingTime} minutes.`
      };
    }
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      const newAttempts = user.loginAttempts + 1;
      const updateData = { loginAttempts: newAttempts };
      if (newAttempts >= MAX_LOGIN_ATTEMPTS) {
        updateData.lockedUntil = new Date(Date.now() + LOCKOUT_DURATION);
      }
      await prisma2.user.update({
        where: { id: user.id },
        data: updateData
      });
      await prisma2.loginLog.create({
        data: {
          userId: user.id,
          department: user.department,
          success: false,
          failReason: "Invalid password"
        }
      });
      return { success: false, error: "Invalid email or password" };
    }
    await prisma2.user.update({
      where: { id: user.id },
      data: {
        loginAttempts: 0,
        lockedUntil: null,
        lastLogin: /* @__PURE__ */ new Date()
      }
    });
    await prisma2.loginLog.create({
      data: {
        userId: user.id,
        department: user.department,
        success: true
      }
    });
    const sessionData = {
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      name: `${user.first_name} ${user.last_name}`,
      department: user.department,
      role: user.role,
      loggedInAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    store.set("currentUser", sessionData);
    return { success: true, user: sessionData };
  } catch (error) {
    console.error("Login error:", error);
    return { success: false, error: "An error occurred during login" };
  }
}
function logout() {
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
  const prisma2 = getPrisma();
  try {
    const hashedPassword = await bcrypt.hash(userData.password, 10);
    const user = await prisma2.user.create({
      data: {
        email: userData.email.toLowerCase(),
        password: hashedPassword,
        first_name: userData.first_name,
        last_name: userData.last_name,
        department: userData.department || "BAND_OFFICE",
        role: userData.role || "STAFF"
      }
    });
    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        department: user.department,
        role: user.role
      }
    };
  } catch (error) {
    if (error.code === "P2002") {
      return { success: false, error: "Email already exists" };
    }
    console.error("Create user error:", error);
    return { success: false, error: "Failed to create user" };
  }
}
async function getAllUsers() {
  const prisma2 = getPrisma();
  try {
    const users = await prisma2.user.findMany({
      select: {
        id: true,
        email: true,
        first_name: true,
        last_name: true,
        department: true,
        role: true,
        created: true,
        lastLogin: true
      },
      orderBy: { created: "desc" }
    });
    return { success: true, users };
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
  const prisma2 = getPrisma();
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
    await prisma2.smsLog.create({
      data: {
        message,
        recipients: JSON.stringify(recipients),
        status,
        messageIds: JSON.stringify(results.messageIds),
        error: results.errors.length > 0 ? JSON.stringify(results.errors) : null,
        userId
      }
    });
    return {
      success: status !== "failed",
      message: status === "sent" ? `Successfully sent ${results.successful} SMS messages` : status === "partial" ? `Sent ${results.successful} of ${results.total} messages` : "Failed to send messages",
      results
    };
  } catch (error) {
    await prisma2.smsLog.create({
      data: {
        message,
        recipients: JSON.stringify(recipients),
        status: "failed",
        messageIds: "[]",
        error: error.message,
        userId
      }
    });
    return {
      success: false,
      message: error.message,
      results
    };
  }
}
async function getSmsHistory(userId, limit = 50) {
  const prisma2 = getPrisma();
  try {
    const logs = await prisma2.smsLog.findMany({
      where: userId ? { userId } : {},
      orderBy: { created: "desc" },
      take: limit,
      include: {
        user: {
          select: {
            first_name: true,
            last_name: true,
            email: true
          }
        }
      }
    });
    return {
      success: true,
      logs: logs.map((log) => ({
        ...log,
        recipients: JSON.parse(log.recipients),
        messageIds: JSON.parse(log.messageIds)
      }))
    };
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
  const prisma2 = getPrisma();
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
      // Base64 encoded content
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
    await prisma2.emailLog.create({
      data: {
        subject,
        message,
        recipients: JSON.stringify(recipients),
        status,
        messageId: results.messageId,
        error: results.errors.length > 0 ? JSON.stringify(results.errors) : null,
        attachments: attachments ? JSON.stringify({ files: attachments.map((a) => ({ filename: a.filename, size: a.size })) }) : null,
        userId
      }
    });
    return {
      success: status !== "failed",
      message: status === "sent" ? `Successfully sent ${results.successful} emails` : status === "partial" ? `Sent ${results.successful} of ${results.total} emails` : "Failed to send emails",
      results
    };
  } catch (error) {
    await prisma2.emailLog.create({
      data: {
        subject,
        message,
        recipients: JSON.stringify(recipients),
        status: "failed",
        error: error.message,
        userId
      }
    });
    return {
      success: false,
      message: error.message,
      results
    };
  }
}
async function getEmailHistory(userId, limit = 50) {
  const prisma2 = getPrisma();
  try {
    const logs = await prisma2.emailLog.findMany({
      where: userId ? { userId } : {},
      orderBy: { created: "desc" },
      take: limit,
      include: {
        user: {
          select: {
            first_name: true,
            last_name: true,
            email: true
          }
        }
      }
    });
    return {
      success: true,
      logs: logs.map((log) => ({
        ...log,
        recipients: JSON.parse(log.recipients),
        attachments: log.attachments ? JSON.parse(log.attachments) : null
      }))
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
async function portalFetch(endpoint, options = {}) {
  const baseUrl = process.env.PORTAL_API_URL;
  const apiKey = process.env.PORTAL_API_KEY;
  if (!baseUrl || !apiKey) {
    throw new Error("Portal API not configured");
  }
  const response = await fetch(`${baseUrl}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": apiKey,
      "X-Source": "tcn-comm",
      ...options.headers
    }
  });
  if (!response.ok) {
    throw new Error(`Portal API error: ${response.status}`);
  }
  return response.json();
}
async function searchMembers(searchTerm, limit = 50) {
  try {
    const params = new URLSearchParams({
      query: searchTerm,
      limit: limit.toString(),
      activated: "true",
      fields: "both"
    });
    const data = await portalFetch(`/contacts?${params}`);
    if (data.success && data.data?.contacts) {
      return {
        success: true,
        members: data.data.contacts.map((contact) => ({
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
    const data = await portalFetch(`/contacts?${params}`);
    if (data.success && data.data?.contacts) {
      return {
        success: true,
        members: data.data.contacts.filter((c) => c.phone).map((contact) => ({
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
    const data = await portalFetch(`/contacts?${params}`);
    if (data.success && data.data?.contacts) {
      return {
        success: true,
        members: data.data.contacts.filter((c) => c.email).map((contact) => ({
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
    await portalFetch("/health");
    return { success: true, message: "Portal API connected" };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
const getPortalConfig$1 = () => {
  const baseUrl = process.env.PORTAL_API_URL || process.env.TCN_PORTAL_URL;
  const apiKey = process.env.PORTAL_API_KEY || process.env.TCN_PORTAL_API_KEY;
  return { baseUrl, apiKey };
};
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
async function uploadPoster({ sourceId, filename, data, mimeType }) {
  const { baseUrl, apiKey } = getPortalConfig$1();
  try {
    if (!baseUrl || !apiKey) {
      const uploadsDir = join(app.getPath("userData"), "uploads", "posters");
      await mkdir(uploadsDir, { recursive: true });
      const base64Data2 = data.replace(/^data:image\/\w+;base64,/, "");
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
    const base64Data = data.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");
    const ext = filename.split(".").pop() || "jpg";
    const uploadFilename = `${sourceId}.${ext}`;
    const { body, contentType } = createMultipartFormData(
      {
        sourceId,
        filename
      },
      {
        filename: uploadFilename,
        contentType: mimeType || "image/jpeg",
        data: buffer
      }
    );
    const response = await fetch(`${baseUrl}/poster`, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
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
async function syncBulletinToPortal({ sourceId, title, subject, poster_url, category, userId, created }) {
  const { baseUrl, apiKey } = getPortalConfig$1();
  if (!baseUrl || !apiKey) {
    return { success: false, message: "Portal API not configured" };
  }
  try {
    const response = await fetch(`${baseUrl}/bulletin`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey
      },
      body: JSON.stringify({
        sourceId,
        title,
        subject,
        poster_url,
        category,
        userId,
        created
      })
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Sync failed: ${response.status} - ${errorText}`);
    }
    const result = await response.json();
    if (!result.success) {
      throw new Error(result.message || "Sync failed");
    }
    return {
      success: true,
      data: result.data,
      message: "Bulletin synced successfully"
    };
  } catch (error) {
    console.error("Sync bulletin error:", error);
    return {
      success: false,
      message: error.message || "Failed to sync bulletin"
    };
  }
}
async function createBulletin({ title, subject, category, posterFile, userId }) {
  const prisma2 = getPrisma();
  if (!posterFile || !posterFile.data) {
    return {
      success: false,
      message: "Poster image is required"
    };
  }
  try {
    const localBulletin = await prisma2.bulletinApiLog.create({
      data: {
        title,
        subject,
        poster_url: "",
        // Will update after upload
        category: category || "ANNOUNCEMENTS",
        userId
      }
    });
    const sourceId = localBulletin.id;
    const uploadResult = await uploadPoster({
      sourceId,
      filename: posterFile.filename,
      data: posterFile.data,
      mimeType: posterFile.mimeType
    });
    if (!uploadResult.success) {
      await prisma2.bulletinApiLog.delete({ where: { id: sourceId } });
      return {
        success: false,
        message: `Failed to upload poster: ${uploadResult.message}`
      };
    }
    const poster_url = uploadResult.poster_url;
    await prisma2.bulletinApiLog.update({
      where: { id: sourceId },
      data: { poster_url }
    });
    const syncResult = await syncBulletinToPortal({
      sourceId,
      title,
      subject,
      poster_url,
      category: category || "ANNOUNCEMENTS",
      userId,
      created: localBulletin.created.toISOString()
    });
    if (!syncResult.success) {
      return {
        success: false,
        message: `Poster uploaded but sync failed: ${syncResult.message}`,
        bulletin: {
          id: sourceId,
          title,
          subject,
          poster_url,
          category,
          synced: false
        }
      };
    }
    return {
      success: true,
      message: "Bulletin posted successfully",
      bulletin: {
        id: sourceId,
        portalId: syncResult.data?.id,
        title,
        subject,
        poster_url,
        category,
        synced: true
      }
    };
  } catch (error) {
    console.error("Create bulletin error:", error);
    return {
      success: false,
      message: error.message || "Failed to post bulletin"
    };
  }
}
async function deleteBulletin(sourceId) {
  const prisma2 = getPrisma();
  const { baseUrl, apiKey } = getPortalConfig$1();
  try {
    if (baseUrl && apiKey) {
      const response = await fetch(`${baseUrl}/bulletin`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey
        },
        body: JSON.stringify({ sourceId })
      });
      if (!response.ok) {
        console.error("Failed to delete from portal:", await response.text());
      }
      await fetch(`${baseUrl}/poster`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey
        },
        body: JSON.stringify({ sourceId })
      });
    }
    await prisma2.bulletinApiLog.delete({ where: { id: sourceId } });
    return { success: true, message: "Bulletin deleted successfully" };
  } catch (error) {
    console.error("Delete bulletin error:", error);
    return { success: false, message: error.message };
  }
}
async function getBulletinHistory(userId, limit = 50) {
  const prisma2 = getPrisma();
  try {
    const logs = await prisma2.bulletinApiLog.findMany({
      where: userId ? { userId } : {},
      orderBy: { created: "desc" },
      take: limit,
      include: {
        user: {
          select: {
            first_name: true,
            last_name: true,
            email: true
          }
        }
      }
    });
    return { success: true, logs };
  } catch (error) {
    console.error("Get bulletin history error:", error);
    return { success: false, error: error.message, logs: [] };
  }
}
const getPortalConfig = () => {
  const baseUrl = process.env.TCN_PORTAL_URL || process.env.PORTAL_API_URL?.replace("/api/sync", "");
  const apiKey = process.env.TCN_PORTAL_API_KEY || process.env.PORTAL_API_KEY;
  return { baseUrl, apiKey };
};
async function syncFormToPortal(form) {
  const { baseUrl, apiKey } = getPortalConfig();
  if (!baseUrl || !apiKey) {
    console.error("Portal not configured. baseUrl:", baseUrl, "apiKey:", apiKey ? "[SET]" : "[NOT SET]");
    return { success: false, error: "Portal not configured" };
  }
  try {
    const endpoint = form.portalFormId ? `${baseUrl}/api/signup-forms/${form.portalFormId}` : `${baseUrl}/api/signup-forms`;
    const method = form.portalFormId ? "PATCH" : "POST";
    console.log(`Syncing form to portal: ${method} ${endpoint}`);
    const response = await fetch(endpoint, {
      method,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "x-source": "tcn-comm"
      },
      body: JSON.stringify({
        formId: form.id,
        title: form.title,
        description: form.description,
        deadline: form.deadline,
        maxEntries: form.maxEntries,
        isActive: form.isActive,
        category: form.category || "BAND_OFFICE",
        allowResubmit: form.allowResubmit || false,
        resubmitMessage: form.resubmitMessage || null,
        createdBy: form.createdBy,
        fields: form.fields.map((f) => ({
          fieldId: f.fieldId,
          label: f.label,
          fieldType: f.fieldType,
          options: f.options ? typeof f.options === "string" ? JSON.parse(f.options) : f.options : null,
          placeholder: f.placeholder,
          required: f.required,
          order: f.order
        }))
      })
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Portal sync failed: ${response.status} - ${errorText}`);
    }
    const result = await response.json();
    return {
      success: true,
      portalFormId: result.data?.id || result.portalFormId,
      data: result.data
    };
  } catch (error) {
    console.error("Portal sync error:", error);
    return { success: false, error: error.message };
  }
}
async function deleteFormFromPortal(portalFormId) {
  const { baseUrl, apiKey } = getPortalConfig();
  if (!baseUrl || !apiKey || !portalFormId) {
    return { success: false };
  }
  try {
    const response = await fetch(`${baseUrl}/api/signup-forms/${portalFormId}`, {
      method: "DELETE",
      headers: {
        "x-api-key": apiKey,
        "x-source": "tcn-comm"
      }
    });
    return { success: response.ok };
  } catch (error) {
    console.error("Portal delete error:", error);
    return { success: false, error: error.message };
  }
}
async function createForm({ title, description, category, deadline, maxEntries, allowResubmit, resubmitMessage, fields, userId }) {
  const prisma2 = getPrisma();
  try {
    const form = await prisma2.signUpForm.create({
      data: {
        title,
        description: description || null,
        category: category || "BAND_OFFICE",
        deadline: deadline ? new Date(deadline) : null,
        maxEntries: maxEntries || null,
        isActive: true,
        allowResubmit: allowResubmit || false,
        resubmitMessage: resubmitMessage || null,
        createdBy: userId,
        fields: {
          create: fields.map((field, index) => ({
            fieldId: field.fieldId || generateFieldId(field.label),
            label: field.label,
            fieldType: field.fieldType,
            options: field.options ? JSON.stringify(field.options) : null,
            placeholder: field.placeholder || null,
            required: field.required || false,
            order: index
          }))
        }
      },
      include: {
        fields: { orderBy: { order: "asc" } }
      }
    });
    const syncResult = await syncFormToPortal(form);
    if (syncResult.success && syncResult.portalFormId) {
      await prisma2.signUpForm.update({
        where: { id: form.id },
        data: {
          portalFormId: syncResult.portalFormId,
          syncedAt: /* @__PURE__ */ new Date()
        }
      });
    }
    return {
      success: true,
      form,
      portalSynced: syncResult.success,
      portalFormId: syncResult.portalFormId,
      portalError: syncResult.error
    };
  } catch (error) {
    console.error("Create form error:", error);
    return { success: false, message: error.message };
  }
}
function generateFieldId(label) {
  return label.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
}
async function updateForm({ formId, title, description, category, deadline, maxEntries, isActive, allowResubmit, resubmitMessage, fields }) {
  const prisma2 = getPrisma();
  try {
    await prisma2.formField.deleteMany({
      where: { formId }
    });
    const form = await prisma2.signUpForm.update({
      where: { id: formId },
      data: {
        title,
        description: description || null,
        category: category || "BAND_OFFICE",
        deadline: deadline ? new Date(deadline) : null,
        maxEntries: maxEntries || null,
        isActive,
        allowResubmit: allowResubmit || false,
        resubmitMessage: resubmitMessage || null,
        fields: {
          create: fields.map((field, index) => ({
            fieldId: field.fieldId || generateFieldId(field.label),
            label: field.label,
            fieldType: field.fieldType,
            options: field.options ? JSON.stringify(field.options) : null,
            placeholder: field.placeholder || null,
            required: field.required || false,
            order: index
          }))
        }
      },
      include: {
        fields: { orderBy: { order: "asc" } }
      }
    });
    const syncResult = await syncFormToPortal(form);
    if (syncResult.success) {
      await prisma2.signUpForm.update({
        where: { id: form.id },
        data: { syncedAt: /* @__PURE__ */ new Date() }
      });
    }
    return {
      success: true,
      form,
      portalSynced: syncResult.success,
      portalError: syncResult.error
    };
  } catch (error) {
    console.error("Update form error:", error);
    return { success: false, message: error.message };
  }
}
async function deleteForm(formId) {
  const prisma2 = getPrisma();
  try {
    const form = await prisma2.signUpForm.findUnique({
      where: { id: formId },
      select: { portalFormId: true }
    });
    if (form?.portalFormId) {
      await deleteFormFromPortal(form.portalFormId);
    }
    await prisma2.signUpForm.delete({
      where: { id: formId }
    });
    return { success: true };
  } catch (error) {
    console.error("Delete form error:", error);
    return { success: false, message: error.message };
  }
}
async function getForm(formId) {
  const prisma2 = getPrisma();
  try {
    const form = await prisma2.signUpForm.findUnique({
      where: { id: formId },
      include: {
        fields: { orderBy: { order: "asc" } },
        submissions: { orderBy: { submittedAt: "desc" } },
        creator: {
          select: {
            first_name: true,
            last_name: true,
            email: true
          }
        }
      }
    });
    if (!form) {
      return { success: false, message: "Form not found" };
    }
    const formWithParsedFields = {
      ...form,
      fields: form.fields.map((f) => ({
        ...f,
        options: f.options ? JSON.parse(f.options) : null
      }))
    };
    return { success: true, form: formWithParsedFields };
  } catch (error) {
    console.error("Get form error:", error);
    return { success: false, message: error.message };
  }
}
async function getAllForms(userId = null) {
  const prisma2 = getPrisma();
  try {
    const forms = await prisma2.signUpForm.findMany({
      where: userId ? { createdBy: userId } : {},
      orderBy: { createdAt: "desc" },
      include: {
        fields: { orderBy: { order: "asc" } },
        _count: { select: { submissions: true } },
        creator: {
          select: {
            first_name: true,
            last_name: true
          }
        }
      }
    });
    return { success: true, forms };
  } catch (error) {
    console.error("Get all forms error:", error);
    return { success: false, message: error.message, forms: [] };
  }
}
async function submitForm({ formId, memberId, name, email, phone, responses }) {
  const prisma2 = getPrisma();
  try {
    const form = await prisma2.signUpForm.findUnique({
      where: { id: formId },
      include: { _count: { select: { submissions: true } } }
    });
    if (!form) {
      return { success: false, message: "Form not found" };
    }
    if (!form.isActive) {
      return { success: false, message: "Form is no longer accepting submissions" };
    }
    if (form.deadline && /* @__PURE__ */ new Date() > form.deadline) {
      return { success: false, message: "Submission deadline has passed" };
    }
    if (form.maxEntries && form._count.submissions >= form.maxEntries) {
      return { success: false, message: "Maximum entries reached" };
    }
    const submission = await prisma2.formSubmission.create({
      data: {
        formId,
        memberId: memberId || null,
        name,
        email: email || null,
        phone: phone || null,
        responses: JSON.stringify(responses)
      }
    });
    return { success: true, submission };
  } catch (error) {
    console.error("Submit form error:", error);
    return { success: false, message: error.message };
  }
}
async function getFormSubmissions(formId) {
  const prisma2 = getPrisma();
  try {
    const submissions = await prisma2.formSubmission.findMany({
      where: { formId },
      orderBy: { submittedAt: "desc" }
    });
    const parsed = submissions.map((s) => ({
      ...s,
      responses: typeof s.responses === "string" ? JSON.parse(s.responses) : s.responses
    }));
    return { success: true, submissions: parsed };
  } catch (error) {
    console.error("Get submissions error:", error);
    return { success: false, message: error.message, submissions: [] };
  }
}
async function deleteSubmission(submissionId) {
  const prisma2 = getPrisma();
  try {
    await prisma2.formSubmission.delete({
      where: { id: submissionId }
    });
    return { success: true };
  } catch (error) {
    console.error("Delete submission error:", error);
    return { success: false, message: error.message };
  }
}
async function syncSubmissions(formId) {
  const prisma2 = getPrisma();
  const { baseUrl, apiKey } = getPortalConfig();
  console.log("=== syncSubmissions called ===");
  console.log("formId:", formId);
  console.log("baseUrl:", baseUrl);
  console.log("apiKey:", apiKey ? "[SET]" : "[NOT SET]");
  if (!baseUrl || !apiKey) {
    return { success: false, error: "Portal not configured" };
  }
  try {
    const form = await prisma2.signUpForm.findUnique({
      where: { id: formId },
      select: { id: true, portalFormId: true, syncedAt: true }
    });
    console.log("Local form found:", form);
    if (!form) {
      return { success: false, error: "Form not found" };
    }
    if (!form.portalFormId) {
      return { success: false, error: "Form not synced to portal" };
    }
    const url = `${baseUrl}/api/signup-forms/submissions?formId=${form.id}`;
    console.log("Fetching submissions from:", url);
    const response = await fetch(url, {
      headers: {
        "x-api-key": apiKey,
        "x-source": "tcn-comm"
      }
    });
    console.log("Response status:", response.status);
    if (!response.ok) {
      const errorText = await response.text();
      console.error("Portal fetch error:", errorText);
      throw new Error(`Portal fetch failed: ${response.status} - ${errorText}`);
    }
    const result = await response.json();
    console.log("Portal response:", JSON.stringify(result, null, 2));
    const portalSubmissions = Array.isArray(result) ? result : Array.isArray(result?.data?.submissions) ? result.data.submissions : Array.isArray(result?.submissions) ? result.submissions : Array.isArray(result?.data) ? result.data : [];
    console.log("Submissions to process:", portalSubmissions.length);
    let synced = 0;
    let skipped = 0;
    for (const sub of portalSubmissions) {
      const existing = await prisma2.formSubmission.findFirst({
        where: {
          formId,
          name: sub.submitter?.name || sub.name,
          submittedAt: new Date(sub.submittedAt)
        }
      });
      if (existing) {
        skipped++;
        continue;
      }
      await prisma2.formSubmission.create({
        data: {
          formId,
          memberId: sub.submitter?.memberId || sub.memberId || null,
          name: sub.submitter?.name || sub.name,
          email: sub.submitter?.email || sub.email || null,
          phone: sub.submitter?.phone || sub.phone || null,
          responses: JSON.stringify(sub.responses),
          submittedAt: new Date(sub.submittedAt)
        }
      });
      synced++;
    }
    await prisma2.signUpForm.update({
      where: { id: formId },
      data: { syncedAt: /* @__PURE__ */ new Date() }
    });
    return {
      success: true,
      synced,
      skipped,
      total: portalSubmissions.length,
      message: `Synced ${synced} submissions, skipped ${skipped} duplicates`
    };
  } catch (error) {
    console.error("Sync submissions error:", error);
    return { success: false, error: error.message };
  }
}
function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.mjs"),
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
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
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
ipcMain.handle("bulletin:create", async (event, data) => {
  return await createBulletin(data);
});
ipcMain.handle("bulletin:delete", async (event, sourceId) => {
  return await deleteBulletin(sourceId);
});
ipcMain.handle("bulletin:getHistory", async (event, { userId, limit }) => {
  return await getBulletinHistory(userId, limit);
});
ipcMain.handle("forms:create", async (event, data) => {
  return await createForm(data);
});
ipcMain.handle("forms:update", async (event, data) => {
  return await updateForm(data);
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
ipcMain.handle("forms:submit", async (event, data) => {
  return await submitForm(data);
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
app.whenReady().then(() => {
  getPrisma();
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
app.on("window-all-closed", async () => {
  await disconnectPrisma();
  if (process.platform !== "darwin") {
    app.quit();
  }
});
app.on("before-quit", async () => {
  await disconnectPrisma();
});
