import { Injectable } from '@nestjs/common';
import * as http from 'http';
import * as https from 'https';

export interface LiveStatusResult {
  available: boolean;
  total?: number;
  connected?: number;
  notConnected?: number;
  notLogin?: number;
  fetchedAt?: string;
  error?: string;
}

export interface LiveSiteDetail {
  userId: string;
  siteName: string;
  address: string;
  lastLogin: string;
  lastLogout: string;
}

export interface LiveStatusDetails {
  available: boolean;
  count?: number;
  sites?: LiveSiteDetail[];
  fetchedAt?: string;
  error?: string;
}

export type DetailCategory = 'connected' | 'notConnected' | 'notLogin';

// Site_Login_Details.aspx?status=N mapping (verified against the live page)
const STATUS_CODE: Record<DetailCategory, number> = {
  connected: 1,
  notConnected: 2,
  notLogin: 3,
};

const CACHE_TTL = 30 * 1000; // 30s
const DETAILS_TTL = 60 * 1000; // 60s — detail pages are heavy (up to ~450KB)
let cachedResult: { data: LiveStatusResult; ts: number } | null = null;
const cachedDetails: Partial<Record<DetailCategory, { data: LiveStatusDetails; ts: number }>> = {};
// The detail pages return "no records" without the ASP.NET session cookie
// issued by livestatus.aspx, so we keep the cookie from the last summary fetch.
let sessionCookie: string | null = null;

@Injectable()
export class LiveStatusService {
  async get(): Promise<LiveStatusResult> {
    if (cachedResult && Date.now() - cachedResult.ts < CACHE_TTL) {
      return cachedResult.data;
    }

    const url = process.env.LIVE_STATUS_URL ?? 'http://intranet.valuableedubeam.com:157/livestatus.aspx';

    try {
      const html = await this.fetchSummary(url);

      // The number may be wrapped in nested tags, e.g.
      // <span id="lbltotal"><font color="#0033CC">500</font></span>
      const extract = (id: string): number | undefined => {
        const re = new RegExp(`id="${id}"[^>]*>(?:\\s*<[^>]+>)*\\s*(\\d+)`);
        const m = html.match(re);
        return m ? parseInt(m[1], 10) : undefined;
      };

      const total        = extract('lbltotal');
      const connected    = extract('lnkgreen');
      const notConnected = extract('lnkred');
      const notLogin     = extract('lnknlogin');

      if (total == null || connected == null || notConnected == null || notLogin == null) {
        const snip = html.slice(0, 300).replace(/\s+/g, ' ');
        console.warn('[LiveStatus] element IDs not found. HTML snippet:', snip);
        const data: LiveStatusResult = { available: false, error: `Element IDs not found in HTML. Snippet: ${snip}` };
        cachedResult = { data, ts: Date.now() };
        return data;
      }

      const data: LiveStatusResult = {
        available: true,
        total,
        connected,
        notConnected,
        notLogin,
        fetchedAt: new Date().toISOString(),
      };
      cachedResult = { data, ts: Date.now() };
      return data;
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      console.warn('[LiveStatus] fetch failed:', msg);
      const data: LiveStatusResult = { available: false, error: msg };
      return data;
    }
  }

  async getDetails(category: DetailCategory): Promise<LiveStatusDetails> {
    const cached = cachedDetails[category];
    if (cached && Date.now() - cached.ts < DETAILS_TTL) {
      return cached.data;
    }

    const base = process.env.LIVE_STATUS_URL ?? 'http://intranet.valuableedubeam.com:157/livestatus.aspx';

    try {
      // Ensure we hold a live session cookie (summary fetch stores it)
      if (!sessionCookie) await this.fetchSummary(base);

      const detailsUrl = new URL(base);
      detailsUrl.pathname = detailsUrl.pathname.replace(/[^/]*$/, 'Site_Login_Details.aspx');
      detailsUrl.search = `?status=${STATUS_CODE[category]}&client_id=`;

      let html = await this.fetchHtml(detailsUrl.toString(), sessionCookie ?? undefined);

      // Session may have expired — refresh cookie and retry once
      if (html.includes('no records')) {
        await this.fetchSummary(base);
        html = await this.fetchHtml(detailsUrl.toString(), sessionCookie ?? undefined);
      }

      const sites = this.parseDetailRows(html);
      const data: LiveStatusDetails = {
        available: true,
        count: sites.length,
        sites,
        fetchedAt: new Date().toISOString(),
      };
      cachedDetails[category] = { data, ts: Date.now() };
      return data;
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      console.warn(`[LiveStatus] details(${category}) fetch failed:`, msg);
      return { available: false, error: msg };
    }
  }

  // Rows look like:
  // <tr bgcolor="#EFF3FB"><td ...><font ...>1</font></td><td>...userId...</td>
  //   <td>...siteName...</td><td>...address...</td><td>...lastLogin...</td><td>...lastLogout...</td></tr>
  private parseDetailRows(html: string): LiveSiteDetail[] {
    const tableMatch = html.match(/<table[^>]*id="GridView1"[\s\S]*?<\/table>/);
    if (!tableMatch) return [];

    const clean = (cell: string) =>
      cell
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/\s+/g, ' ')
        .trim();

    const sites: LiveSiteDetail[] = [];
    const rowRe = /<tr[^>]*bgcolor[^>]*>([\s\S]*?)<\/tr>/g;
    let row: RegExpExecArray | null;
    while ((row = rowRe.exec(tableMatch[0])) !== null) {
      const cells = [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => clean(m[1]));
      if (cells.length < 6) continue; // header row has <th>, not <td>
      sites.push({
        userId: cells[1],
        siteName: cells[2],
        address: cells[3],
        lastLogin: cells[4],
        lastLogout: cells[5],
      });
    }
    return sites;
  }

  /** Fetch the summary page and capture the ASP.NET session cookie. */
  private fetchSummary(url: string): Promise<string> {
    return this.fetchHtml(url, undefined, (cookies) => {
      const session = cookies.find((c) => c.startsWith('ASP.NET_SessionId'));
      if (session) sessionCookie = session.split(';')[0];
    });
  }

  private fetchHtml(
    rawUrl: string,
    cookie?: string,
    onCookies?: (cookies: string[]) => void,
  ): Promise<string> {
    const parsed = new URL(rawUrl);
    const transport = parsed.protocol === 'https:' ? https : http;

    return new Promise((resolve, reject) => {
      const req = transport.get(
        rawUrl,
        {
          headers: {
            'User-Agent': 'EdubeamLMS/1.0',
            ...(cookie ? { Cookie: cookie } : {}),
          },
        },
        (res) => {
          if (onCookies && res.headers['set-cookie']) onCookies(res.headers['set-cookie']);
          if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location) {
            res.resume();
            this.fetchHtml(res.headers.location, cookie, onCookies).then(resolve).catch(reject);
            return;
          }
          if (res.statusCode !== 200) {
            res.resume();
            reject(new Error(`HTTP ${res.statusCode}`));
            return;
          }
          const chunks: Buffer[] = [];
          res.on('data', (c: Buffer) => chunks.push(c));
          res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
          res.on('error', reject);
        },
      );
      // The ASPX pages are slow (~15s observed) — allow up to 45s
      req.setTimeout(45_000, () => { req.destroy(new Error('timeout after 45s')); });
      req.on('error', reject);
    });
  }
}
