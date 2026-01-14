import { contextBridge, ipcRenderer } from "electron";
contextBridge.exposeInMainWorld("electronAPI", {
  // Authentication
  auth: {
    login: (email, password) => ipcRenderer.invoke("auth:login", { email, password }),
    logout: () => ipcRenderer.invoke("auth:logout"),
    getCurrentUser: () => ipcRenderer.invoke("auth:getCurrentUser"),
    isAuthenticated: () => ipcRenderer.invoke("auth:isAuthenticated"),
    createUser: (userData) => ipcRenderer.invoke("auth:createUser", userData),
    getAllUsers: () => ipcRenderer.invoke("auth:getAllUsers")
  },
  // SMS
  sms: {
    send: (message, recipients, userId) => ipcRenderer.invoke("sms:send", { message, recipients, userId }),
    getHistory: (userId, limit) => ipcRenderer.invoke("sms:getHistory", { userId, limit })
  },
  // Email
  email: {
    send: (subject, message, recipients, attachments, userId) => ipcRenderer.invoke("email:send", { subject, message, recipients, attachments, userId }),
    getHistory: (userId, limit) => ipcRenderer.invoke("email:getHistory", { userId, limit })
  },
  // Contacts
  contacts: {
    search: (searchTerm, limit) => ipcRenderer.invoke("contacts:search", { searchTerm, limit }),
    getAllPhones: (limit) => ipcRenderer.invoke("contacts:getAllPhones", { limit }),
    getAllEmails: (limit) => ipcRenderer.invoke("contacts:getAllEmails", { limit }),
    testConnection: () => ipcRenderer.invoke("contacts:testConnection")
  },
  // Bulletin
  bulletin: {
    create: (data) => ipcRenderer.invoke("bulletin:create", data),
    delete: (sourceId) => ipcRenderer.invoke("bulletin:delete", sourceId),
    getHistory: (userId, limit) => ipcRenderer.invoke("bulletin:getHistory", { userId, limit })
  },
  // Forms
  forms: {
    create: (data) => ipcRenderer.invoke("forms:create", data),
    update: (data) => ipcRenderer.invoke("forms:update", data),
    delete: (formId) => ipcRenderer.invoke("forms:delete", { formId }),
    get: (formId) => ipcRenderer.invoke("forms:get", { formId }),
    getAll: (userId) => ipcRenderer.invoke("forms:getAll", { userId }),
    submit: (data) => ipcRenderer.invoke("forms:submit", data),
    getSubmissions: (formId) => ipcRenderer.invoke("forms:getSubmissions", { formId }),
    deleteSubmission: (submissionId) => ipcRenderer.invoke("forms:deleteSubmission", { submissionId }),
    syncSubmissions: (formId) => ipcRenderer.invoke("forms:syncSubmissions", { formId })
  }
});
