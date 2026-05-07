import LoginApi from "./LoginApi";
import { get as getConfig } from "./ConfigStorage";

export default class UserApi {
    _url = "https://user.betaflight.com";
    _loginApi;

    constructor(loginApi = new LoginApi()) {
        this._loginApi = loginApi;
    }

    _saveLocal(email) {
        if (!email) throw new Error("Email is required");

        const accounts = JSON.parse(localStorage.getItem("accounts") || "[]");

        if (accounts.includes(email)) throw new Error("Account already exists");

        accounts.push(email);
        localStorage.setItem("accounts", JSON.stringify(accounts));

        return { success: true, email };
    }

    _getLocalAccounts() {
        return JSON.parse(localStorage.getItem("accounts") || "[]");
    }

    getLocalAccounts() {
        return this._getLocalAccounts();
    }

    _getLocalSessionEmail() {
        const sessionConfig = getConfig("localSession") || {};
        return sessionConfig.localSession?.email || null;
    }

    _getLocalBackupsKey(email) {
        return `localBackups:${encodeURIComponent(email)}`;
    }

    _getLocalBackups(email) {
        if (!email) return [];
        return JSON.parse(localStorage.getItem(this._getLocalBackupsKey(email)) || "[]");
    }

    _saveLocalBackups(email, backups) {
        localStorage.setItem(this._getLocalBackupsKey(email), JSON.stringify(backups));
        return backups;
    }

    _generateLocalBackupId() {
        if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
            return crypto.randomUUID();
        }
        return `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    }

    _getLocalBackup(email, backupId) {
        const backups = this._getLocalBackups(email);
        return backups.find((backup) => backup.id === backupId) || null;
    }

    hasLocalAccount(email) {
        if (!email) return false;
        const accounts = this._getLocalAccounts();
        return accounts.includes(email);
    }

    async getLocalProfile(email) {
        if (!this.hasLocalAccount(email)) {
            throw new Error("Local account not found");
        }
        return { email };
    }

    async _authHeaders() {
        if (!this._loginApi) {
            throw new Error("Login API is not initialized.");
        }

        try {
            const token = await this._loginApi.getAccessToken();
            if (token) {
                return { Authorization: `Bearer ${token}` };
            }
        } catch (_error) {
            console.warn(`Unable to obtain access token for User API. ${_error}`);
        }
        throw new Error("Unable to obtain access token for User API.");
    }

    /* Profile Functionality */
    async profile() {
        const authHeaders = await this._authHeaders();
        const response = await fetch(`${this._url}/api/user`, {
            method: "GET",
            headers: {
                ...authHeaders,
            },
        });

        if (response.status === 401) {
            // token is bad - logout
            this._loginApi.signOut();
            throw new Error("Unauthorized access to User API.");
        }

        if (!response.ok) {
            throw new Error(await response.text());
        }
        return await response.json();
    }

    async updateProfile(profile) {
        const authHeaders = await this._authHeaders();
        const response = await fetch(`${this._url}/api/user`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                ...authHeaders,
            },
            body: JSON.stringify(profile),
        });

        if (!response.ok) {
            throw new Error(await response.text());
        }

        return await response.json();
    }

    /* User Token Management Functionality */
    async getTokens() {
        const authHeaders = await this._authHeaders();
        const response = await fetch(`${this._url}/api/user/tokens`, {
            method: "GET",
            headers: {
                ...authHeaders,
            },
        });

        if (!response.ok) {
            throw new Error(await response.text());
        }
        return await response.json();
    }

    async deleteToken(tokenId) {
        const authHeaders = await this._authHeaders();
        const response = await fetch(`${this._url}/api/user/tokens/${tokenId}`, {
            method: "DELETE",
            headers: {
                ...authHeaders,
            },
        });

        if (!response.ok) {
            throw new Error(await response.text());
        }
    }

    /* User Passkey Management Functionality */
    async getPasskeys() {
        const authHeaders = await this._authHeaders();
        const response = await fetch(`${this._url}/api/user/passkeys`, {
            method: "GET",
            headers: {
                ...authHeaders,
            },
        });

        if (!response.ok) {
            throw new Error(await response.text());
        }
        return await response.json();
    }

    async deletePasskey(passkeyId) {
        const authHeaders = await this._authHeaders();
        const response = await fetch(`${this._url}/api/user/passkeys/${passkeyId}`, {
            method: "DELETE",
            headers: {
                ...authHeaders,
            },
        });

        if (!response.ok) {
            throw new Error(await response.text());
        }
    }

    /* User Backup Functionality */
    async getBackups() {
        const localEmail = this._getLocalSessionEmail();
        const tokenValid = await this._loginApi.checkToken().catch(() => false);

        if (localEmail && !tokenValid) {
            return {
                backups: this._getLocalBackups(localEmail),
            };
        }

        const authHeaders = await this._authHeaders();
        const response = await fetch(`${this._url}/api/backups`, {
            method: "GET",
            headers: {
                ...authHeaders,
            },
        });

        if (!response.ok) {
            throw new Error(await response.text());
        }
        return await response.json();
    }

    async deleteBackup(backupId) {
        const localEmail = this._getLocalSessionEmail();
        const tokenValid = await this._loginApi.checkToken().catch(() => false);

        if (localEmail && !tokenValid) {
            const backups = this._getLocalBackups(localEmail).filter((backup) => backup.id !== backupId);
            this._saveLocalBackups(localEmail, backups);
            return;
        }

        const authHeaders = await this._authHeaders();
        const response = await fetch(`${this._url}/api/backups/${backupId}`, {
            method: "DELETE",
            headers: {
                ...authHeaders,
            },
        });

        if (!response.ok) {
            throw new Error(await response.text());
        }
    }

    async uploadBackup(data) {
        const localEmail = this._getLocalSessionEmail();
        const tokenValid = await this._loginApi.checkToken().catch(() => false);

        if (localEmail && !tokenValid) {
            const backups = this._getLocalBackups(localEmail);
            const created = new Date().toISOString();
            const backup = {
                id: this._generateLocalBackupId(),
                name: `Local Backup ${created}.txt`,
                description: "",
                created,
                key: "Local",
                file: data,
            };
            backups.unshift(backup);
            this._saveLocalBackups(localEmail, backups);
            return { backup };
        }

        const authHeaders = await this._authHeaders();
        const response = await fetch(`${this._url}/api/backups/file`, {
            method: "POST",
            headers: {
                "Content-Type": "text/plain",
                ...authHeaders,
            },
            body: data,
        });

        if (!response.ok) {
            throw new Error(await response.text());
        }
        return await response.json();
    }

    async downloadBackupFile(backupId) {
        const localEmail = this._getLocalSessionEmail();
        const tokenValid = await this._loginApi.checkToken().catch(() => false);

        if (localEmail && !tokenValid) {
            const backup = this._getLocalBackup(localEmail, backupId);
            if (!backup) {
                throw new Error("Backup not found");
            }
            return {
                name: backup.name || "backup.txt",
                file: backup.file || "",
            };
        }

        const authHeaders = await this._authHeaders();
        const response = await fetch(`${this._url}/api/backups/${backupId}/file`, {
            method: "GET",
            headers: {
                Accept: "text/plain",
                ...authHeaders,
            },
        });

        if (!response.ok) {
            throw new Error(await response.text());
        }

        // Parse filename from Content-Disposition header safely
        const contentDisposition = response.headers.get("Content-Disposition");
        let filename = "backup.txt";

        if (contentDisposition?.includes("filename=")) {
            const parts = contentDisposition.split("filename=");
            if (parts.length > 1) {
                // Remove surrounding quotes and whitespace
                filename = parts[1].trim().replaceAll(/(^["'])|(["']$)/g, "");
            }
        }

        // Return raw text content
        const text = await response.text();

        return {
            name: filename,
            file: text,
        };
    }

    async updateBackup(backup) {
        const localEmail = this._getLocalSessionEmail();
        const tokenValid = await this._loginApi.checkToken().catch(() => false);

        if (localEmail && !tokenValid) {
            const backups = this._getLocalBackups(localEmail).map((item) => {
                if (item.id !== backup.Id) {
                    return item;
                }
                return {
                    ...item,
                    name: backup.name,
                    description: backup.description,
                };
            });
            this._saveLocalBackups(localEmail, backups);
            return;
        }

        const authHeaders = await this._authHeaders();
        const response = await fetch(`${this._url}/api/backups/${backup.Id}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                ...authHeaders,
            },
            body: JSON.stringify(backup),
        });

        if (!response.ok) {
            throw new Error(await response.text());
        }
    }

    async createLocalAccount(email) {
        return this._saveLocal(email);
    }
}
