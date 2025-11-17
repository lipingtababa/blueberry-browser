import { session, Cookie } from "electron";
import * as fs from "fs";
import * as path from "path";
import { app } from "electron";

interface SavedSession {
  domain: string;
  cookies: Cookie[];
  savedAt: number;
  expiresAt?: number;
}

export class SessionManager {
  private sessionsDir: string;

  constructor() {
    this.sessionsDir = path.join(app.getPath("userData"), "sessions");
    this.ensureSessionsDir();
  }

  private ensureSessionsDir(): void {
    if (!fs.existsSync(this.sessionsDir)) {
      fs.mkdirSync(this.sessionsDir, { recursive: true });
    }
  }

  /**
   * Save the current session cookies for a specific domain
   */
  public async saveSession(domain: string, sessionName?: string): Promise<void> {
    const cookies = await session.defaultSession.cookies.get({ domain });

    const savedSession: SavedSession = {
      domain,
      cookies,
      savedAt: Date.now(),
      // Calculate expiration based on the shortest lived cookie
      expiresAt: cookies.reduce((earliest, cookie) => {
        if (cookie.expirationDate) {
          const expiration = cookie.expirationDate * 1000;
          return earliest ? Math.min(earliest, expiration) : expiration;
        }
        return earliest;
      }, 0),
    };

    const filename = sessionName || this.sanitizeDomain(domain);
    const filePath = path.join(this.sessionsDir, `${filename}.json`);

    fs.writeFileSync(filePath, JSON.stringify(savedSession, null, 2), "utf-8");
    console.log(`[SessionManager] Saved session for ${domain}`);
  }

  /**
   * Restore a saved session for a specific domain
   */
  public async restoreSession(domain: string, sessionName?: string): Promise<boolean> {
    const filename = sessionName || this.sanitizeDomain(domain);
    const filePath = path.join(this.sessionsDir, `${filename}.json`);

    if (!fs.existsSync(filePath)) {
      console.log(`[SessionManager] No saved session found for ${domain}`);
      return false;
    }

    try {
      const content = fs.readFileSync(filePath, "utf-8");
      const savedSession: SavedSession = JSON.parse(content);

      // Check if session has expired
      if (savedSession.expiresAt && savedSession.expiresAt < Date.now()) {
        console.log(`[SessionManager] Session for ${domain} has expired`);
        return false;
      }

      // Restore cookies
      for (const cookie of savedSession.cookies) {
        try {
          await session.defaultSession.cookies.set({
            url: `https://${cookie.domain}`,
            name: cookie.name,
            value: cookie.value,
            domain: cookie.domain,
            path: cookie.path,
            secure: cookie.secure,
            httpOnly: cookie.httpOnly,
            expirationDate: cookie.expirationDate,
            sameSite: cookie.sameSite as "unspecified" | "no_restriction" | "lax" | "strict",
          });
        } catch (error) {
          console.error(`[SessionManager] Error restoring cookie ${cookie.name}:`, error);
        }
      }

      console.log(`[SessionManager] Restored session for ${domain}`);
      return true;
    } catch (error) {
      console.error(`[SessionManager] Error restoring session for ${domain}:`, error);
      return false;
    }
  }

  /**
   * Check if a valid session exists for a domain
   */
  public hasValidSession(domain: string, sessionName?: string): boolean {
    const filename = sessionName || this.sanitizeDomain(domain);
    const filePath = path.join(this.sessionsDir, `${filename}.json`);

    if (!fs.existsSync(filePath)) {
      return false;
    }

    try {
      const content = fs.readFileSync(filePath, "utf-8");
      const savedSession: SavedSession = JSON.parse(content);

      // Check if session has expired
      if (savedSession.expiresAt && savedSession.expiresAt < Date.now()) {
        return false;
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Delete a saved session
   */
  public deleteSession(domain: string, sessionName?: string): void {
    const filename = sessionName || this.sanitizeDomain(domain);
    const filePath = path.join(this.sessionsDir, `${filename}.json`);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`[SessionManager] Deleted session for ${domain}`);
    }
  }

  /**
   * Clear all cookies for a domain
   */
  public async clearSession(domain: string): Promise<void> {
    const cookies = await session.defaultSession.cookies.get({ domain });
    for (const cookie of cookies) {
      await session.defaultSession.cookies.remove(
        `https://${cookie.domain}`,
        cookie.name
      );
    }
    console.log(`[SessionManager] Cleared session for ${domain}`);
  }

  /**
   * List all saved sessions
   */
  public listSessions(): Array<{ name: string; domain: string; savedAt: number; expiresAt?: number }> {
    try {
      const files = fs.readdirSync(this.sessionsDir);
      return files
        .filter((file) => file.endsWith(".json"))
        .map((file) => {
          const content = fs.readFileSync(
            path.join(this.sessionsDir, file),
            "utf-8"
          );
          const savedSession: SavedSession = JSON.parse(content);
          return {
            name: file.replace(".json", ""),
            domain: savedSession.domain,
            savedAt: savedSession.savedAt,
            expiresAt: savedSession.expiresAt,
          };
        })
        .sort((a, b) => b.savedAt - a.savedAt);
    } catch (error) {
      console.error("[SessionManager] Error listing sessions:", error);
      return [];
    }
  }

  private sanitizeDomain(domain: string): string {
    return domain.replace(/[^a-zA-Z0-9.-]/g, "_");
  }
}
