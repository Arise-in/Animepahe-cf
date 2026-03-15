export interface iFetchResponse {
	"total": number,
	"per_page": number,
	"current_page": number,
	"last_page": number,
	"next_page_url": null | string,
	"prev_page_url": null | string,
	"from": number,
	"to": number,
	"data": Array<{
		"id": number,
		"anime_id": number,
		"episode": number,
		"episode2": number,
		"edition": string,
		"title": string,
		"snapshot": string,
		"disc": string,
		"audio": "jpn" | "eng",
		"duration": string,
		"session": string,
		"filler": number,
		"created_at": string
	}>
}

export class AnimePahe {
	constructor(
		private readonly streamUrl: string,
		private readonly userAgent: string
	) { }

	public static Headers(streamUrl: string | false, userAgent: string, cookie?: string) {
		return {
			'authority': 'animepahe.si',
			'accept': 'application/json, text/javascript, */*; q=0.01',
			'accept-language': 'en-US,en;q=0.9',
			'cookie': cookie ?? '__ddg2_=',
			'dnt': '1',
			'sec-ch-ua': '"Not A(Brand";v="99", "Microsoft Edge";v="121", "Chromium";v="121"',
			'sec-ch-ua-mobile': '?0',
			'sec-ch-ua-platform': '"Windows"',
			'sec-fetch-dest': 'empty',
			'sec-fetch-mode': 'cors',
			'sec-fetch-site': 'same-origin',
			'x-requested-with': 'XMLHttpRequest',
			'referer': streamUrl ? `https://animepahe.si/anime/${ streamUrl }` : 'https://animepahe.si',
			'user-agent': userAgent,
		}
	}

	public async Series() {
		const res = /<h1[^>]*><span[^>]*>(?<title>[^<]+)<\/span>/.exec(await fetch(`https://animepahe.si/anime/${this.streamUrl}`, {
			headers: AnimePahe.Headers(this.streamUrl, this.userAgent, AnimePahe.ddosGuardCookie())
		}).then(async (res) => await res.text())) as RegExpExecArray
		return (res.groups as Record<string, string>)['title']
	}

	public async Extract(page: string | false) {
		return await fetch(`https://animepahe.si/api?m=release&id=${this.streamUrl}&sort=episode_asc&page=${page ? page : 1}`, {
			headers: AnimePahe.Headers(this.streamUrl, this.userAgent)
		}).then((res) => res.json<iFetchResponse>());
	}

	private decoder (QM: string, Y_: number, eZ: number) {
		const g = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ+/".split("");
		const h = g.slice(0, Y_);
		const i = g.slice(0, eZ);

		let j = QM.split("").reverse().reduce((wM, Js, Ra) => {
			if (h.indexOf(Js) !== -1) {
				return wM += h.indexOf(Js) * (Math.pow(Y_, Ra))
			}
			return 0
		}, 0);

		let k = "";
		while (j > 0) {
			k = i[j % eZ] + k;
			j = (j - (j % eZ)) / eZ
		}
		return k || 0
	}

	private decodeContent(encString: string, num1: number, encToken: string, num2: number, num3: number, num4: number | string) {
		num4 = "";
		for (let i = 0, len = encString.length; i < len; i ++) {
			let s = "";
			while (encString[i] !== encToken[num3]) {
				s += encString[i];
				i ++
			}
			for (let j = 0; j < encToken.length; j ++) {
				s = s.replace(new RegExp(encToken[j], "g"), j.toString());
			}
			num4 += String.fromCharCode(Number(this.decoder(s, num3, 10)) - num2)
		}
		const value = decodeURIComponent(encodeURI(num4))
		return value;
	}

	private DecodePaheWin(kwikText: string) {
		const bodyString = /\(("(?<encString>.+?)",(?<num1>\d+),"(?<encToken>.+?)",(?<num2>\d+),(?<num3>\d+),(?<num4>\d+).+?\))/.exec(kwikText) as RegExpExecArray
		const Tokens = bodyString.groups as {
			encString: string | false,
			encToken: string | false
			num1: string | false,
			num2: string | false,
			num3: string | false,
			num4: string | false,
		}
		if (
			Tokens.encString &&
			Tokens.encToken &&
			Tokens.num1 &&
			Tokens.num2 &&
			Tokens.num3 &&
			Tokens.num4
		) {
			const { encString, num1, encToken, num2, num3, num4 } = Tokens
			const decoded = this.decodeContent(encString, parseInt(num1), encToken, parseInt(num2), parseInt(num3), parseInt(num4))
			return decoded;
		}
		return false;
	}

	private static ddosGuardCookie() {
		if (typeof crypto !== 'undefined' && typeof (crypto as any).randomUUID === 'function') {
			return `__ddg2_=${(crypto as any).randomUUID().replace(/-/g, '')}`;
		}
		return `__ddg2_=${Math.random().toString(36).slice(2, 12)}`;
	}

	private decodePackedString(packed: string, keys: string[]) {
		const alphabet = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
		const base = Math.min(keys.length || alphabet.length, alphabet.length);
		const decodeBase = (input: string) => {
			let acc = 0;
			for (const ch of input) {
				const idx = alphabet.indexOf(ch);
				if (idx < 0 || idx >= base) {
					return -1;
				}
				acc = acc * base + idx;
			}
			return acc;
		};

		return packed.replace(/\b[0-9a-zA-Z]+\b/g, (match) => {
			const idx = decodeBase(match);
			return idx >= 0 && idx < keys.length && keys[idx] ? keys[idx] : match;
		});
	}

	private extractFirstM3u8(text: string) {
		const m = /https?:\/\/[^"'<> \n\r]+\.m3u8[^\s"'<>]*/i.exec(text);
		return m ? m[0] : '';
	}

	private unpackPacker(source: string) {
		const re = /eval\(function\(p,a,c,k,e,d\)\{[\s\S]+?\}\(\s*(['"])(?<p>[\s\S]*?)\1\s*,\s*(?<a>\d+)\s*,\s*(?<c>\d+)\s*,\s*(['"])(?<k>[\s\S]*?)\4\.split\('\|'\)/i;
		const m = re.exec(source);
		if (!m || !m.groups) {
			return '';
		}

		const packed = m.groups.p || '';
		const keys = (m.groups.k || '').split('|');
		if (!packed || keys.length === 0) {
			return '';
		}

		return this.decodePackedString(packed, keys);
	}

	private m3u8ToMp4(m3u8: string, filename: string) {
		try {
			const u = new URL(m3u8);
			const hostParts = u.hostname.split('.');
			if (hostParts[0].startsWith('vault-')) {
				u.hostname = `${hostParts[0]}.kwik.cx`;
			} else {
				u.hostname = 'kwik.cx';
			}
			u.pathname = u.pathname.replace('/stream/', '/mp4/');
			u.pathname = u.pathname.replace(/\/uwu\.m3u8$/, '');
			u.pathname = u.pathname.replace(/\.m3u8$/, '');
			if (filename) {
				u.searchParams.set('file', filename);
			}
			return u.toString();
		} catch {
			return '';
		}
	}

	private async resolveKwikEmbed(embedUrl: string) {
		try {
			const res = await fetch(embedUrl, {
				headers: {
					'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
					'accept-language': 'en-US,en;q=0.9',
					'referer': this.streamUrl ? `https://animepahe.si/anime/${this.streamUrl}` : 'https://animepahe.si',
					'user-agent': this.userAgent,
					'cookie': AnimePahe.ddosGuardCookie(),
				},
			});
			const html = await res.text();

			if (/just a moment|checking your browser|ddos-guard|cf-browser-verification/i.test(html)) {
				return false;
			}

			const titleMatch = /<title>([^<]+)<\/title>/i.exec(html);
			const filename = titleMatch ? titleMatch[1].trim() : '';

			const directM3u8 = this.extractFirstM3u8(html);
			if (directM3u8) {
				const mp4 = this.m3u8ToMp4(directM3u8, filename);
				if (mp4) {
					return { m3u8: directM3u8, mp4, filename };
				}
			}

			const qMatch = /q\s*=\s*(?:\\?['\"])([^'\"]+)(?:\\?['\"])/i.exec(html);
			const keysMatch = /['\"]([^'\"]*)['\"]\.split\('\|'\)/.exec(html);
			if (qMatch && keysMatch) {
				const packed = qMatch[1].replace(/\\/g, '');
				const keys = keysMatch[1].split('|');
				const decoded = this.decodePackedString(packed, keys);
				const m3u8 = this.extractFirstM3u8(decoded) || decoded;
				if (/^https?:\/\//.test(m3u8)) {
					const mp4 = this.m3u8ToMp4(m3u8, filename);
					if (mp4) {
						return { m3u8, mp4, filename };
					}
				}
			}

			const unpacked = this.unpackPacker(html);
			if (unpacked) {
				const m3u8 = this.extractFirstM3u8(unpacked);
				if (m3u8) {
					const mp4 = this.m3u8ToMp4(m3u8, filename);
					if (mp4) {
						return { m3u8, mp4, filename };
					}
				}
			}
			return false;
		} catch {
			return false;
		}
	}

	public async Kwix(pahe: string) {
		const response = await fetch(pahe, {
			headers: {
				'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
				'referer': 'https://animepahe.si',
				'user-agent': this.userAgent,
				'cookie': AnimePahe.ddosGuardCookie(),
			}
		}).then(async (res) => await res.text())

		const cleaned = response.replace(/\s+/g, '');
		const direct = /(?<kwik>https?:\/\/kwik\.[a-z0-9]+\/[fd]\/[^"'<>]+)/i.exec(cleaned) as RegExpExecArray
		if (direct) {
			const url = (direct.groups as Record<string, string>)['kwik']
			return url.replace('/d/', '/f/')
		}
		const content = this.DecodePaheWin(response);
		if (content) {
			const cleanedContent = content.replace(/\s+/g, '');
			const res = /(?<kwik>https?:\/\/kwik\.[^/\s"<>]+\/[^/\s"<>]+\/[^"\s<>]*)/.exec(cleanedContent) as RegExpExecArray
			if (res) {
				const modifiedUrl = (res.groups as Record<string, string>)['kwik'].replace("/d/", "/f/");
				return modifiedUrl;
			}
		}
		const loose = /https?:\/\/kwik\.[^"'\\s<>]+/i.exec(cleaned) || (content ? /https?:\/\/kwik\.[^"'\\s<>]+/i.exec(content.replace(/\s+/g, '')) : null)
		if (loose) {
			return loose[0].replace("/d/", "/f/");
		}
		return false;
	}

	public async Episodes(page: string | false) {
		const [title, { data, total }] = await Promise.all([
			this.Series(),
			this.Extract(page)
		])

		const response: {
			title: string,
			total: number,
			next: boolean,
			page: number,
			total_pages: number,
			episodes: Array<Record<string, string | number>>
		} = {
			title: title,
			total: total,
			page: parseInt(page || "1"),
			total_pages: Math.ceil(total / 30),
			next: false,
			episodes: []
		}

		if (total > 30 && (total - (30 * parseInt(page || "1")) > 0)) {
			response.next = true
		}

		for (const { episode, session, snapshot } of data) {
			response.episodes.push({ episode: String(episode).padStart(2, '0'), session, snapshot })
		}

		return response
	}

	public async Links(session: string) {
		return await fetch(`https://animepahe.si/play/${this.streamUrl}/${session}`, {
			headers: AnimePahe.Headers(this.streamUrl, this.userAgent, AnimePahe.ddosGuardCookie())
		}).then(async (res) => {
			const raw = await res.text()
			const data: Array<{
				link: string;
				name: string;
				pahe: string;
				quality?: string;
				filesize?: string;
				fansub: string;
				resolution: string;
				audio: string;
				isDub?: boolean;
				m3u8?: string;
				mp4?: string;
				filename?: string;
			}> = []
			let m: RegExpExecArray | null;
			const downloadMeta: Array<{
				pahe: string;
				quality: string;
				fansub: string;
				resolution: string;
				filesize: string;
				isDub: boolean;
			}> = [];
			const middleDot = '\u00B7';

			// Extract download list (pahe.win) metadata from play page
			const downloadRegex = /<a[^>]+href=["'](?<href>https?:\/\/pahe\.win\/[^"']+)["'][^>]*>(?<text>[^<]+)<\/a>/gi
			while ((m = downloadRegex.exec(raw) as RegExpExecArray) !== null) {
				const href = (m.groups as Record<string, string>)?.href || ''
				const rawText = (m.groups as Record<string, string>)?.text || ''
				if (!href || !rawText) {
					continue
				}
				const text = rawText
					.replace(/&nbsp;/g, ' ')
					.replace(/&middot;|&#183;|&#8226;|&#xB7;|&bull;/g, middleDot)
					.replace(/\uFFFD/g, middleDot)
					.replace(/\s+/g, ' ')
					.trim()

				const parts = text.split(middleDot).map(p => p.trim()).filter(Boolean)
				let fansub = ''
				let rest = ''
				if (parts.length >= 2) {
					fansub = parts[0]
					rest = parts.slice(1).join(` ${middleDot} `)
				} else {
					rest = parts[0] || ''
				}

				const resMatch = /(\d+)p/i.exec(rest)
				const sizeMatch = /\(([^)]+)\)/i.exec(rest)
				const resolution = resMatch ? resMatch[1] : ''
				const filesize = sizeMatch ? sizeMatch[1] : ''
				const isDub = /\beng\b/i.test(rest)

				downloadMeta.push({
					pahe: href,
					quality: text,
					fansub,
					resolution,
					filesize,
					isDub,
				})
			}

			// Match both /e/ (embed) and /f/ (download page) kwik links â€” animepahe may serve either
			const regex = /data-src=["'](?<link>https?:\/\/kwik\.[a-z0-9]+\/[ef]\/[^"']+)["'][^>]*?data-fansub=["'](?<fansub>[^"']+)["'][^>]*?data-resolution=["'](?<resolution>\d+)["'][^>]*?data-audio=["'](?<audio>[^"']+)["']/g
			const resolvePromises: Array<Promise<false | { m3u8: string; mp4: string; filename: string }>> = []
			const cleaned = raw.replace(/\n/g, '')

			while ((m = regex.exec(cleaned) as RegExpExecArray) !== null) {
				if (m.index === regex.lastIndex) {
					regex.lastIndex++;
				}

				const groups = m.groups as Record<string, string>
				const rawLink = groups.link
				const fansub = groups.fansub || ''
				const resolution = groups.resolution || ''
				const audio = groups.audio || ''
                const isDub = audio.toLowerCase() === 'eng'
				const name = [fansub, `${resolution}p`, audio ? audio : null].filter(Boolean).join(` ${middleDot} `)

				// Normalize to embed URL for resolveKwikEmbed (/f/ -> /e/)
				const embedLink = rawLink.replace('/f/', '/e/')

				const matchedDownload = downloadMeta.find(d =>
					d.resolution === resolution &&
					(d.fansub === fansub || (!d.fansub && !fansub)) &&
					d.isDub === isDub
				)

				data.push({
					link: rawLink,   // keep original â€” /f/ links work directly with access-kwik API
					name,
					pahe: matchedDownload?.pahe || rawLink,
					quality: matchedDownload?.quality,
					filesize: matchedDownload?.filesize,
					fansub,
					resolution,
					audio,
					isDub,
				})

				resolvePromises.push(this.resolveKwikEmbed(embedLink))
			}

			// If the strict regex fails (attribute order changes), fall back to a looser tag scan.
			if (data.length === 0) {
				const tagRegex = /<[^>]*data-src=["'](?<link>https?:\/\/[^"']*kwik[^"']*)["'][^>]*>/gi
				while ((m = tagRegex.exec(cleaned) as RegExpExecArray) !== null) {
					const tag = m[0] || ''
					const rawLink = (m.groups as Record<string, string>)?.link || ''
					if (!rawLink) {
						continue
					}
					const fansub = (/data-fansub=["']([^"']*)/i.exec(tag)?.[1] ?? '').trim()
					const resolution = (/data-resolution=["'](\d+)/i.exec(tag)?.[1] ?? '').trim()
					const audio = (/data-audio=["']([^"']*)/i.exec(tag)?.[1] ?? '').trim()
					const isDub = audio.toLowerCase() === 'eng'
					const name = [fansub, `${resolution}p`, audio ? audio : null].filter(Boolean).join(` ${middleDot} `)
					const embedLink = rawLink.replace('/f/', '/e/')

					const matchedDownload = downloadMeta.find(d =>
						d.resolution === resolution &&
						(d.fansub === fansub || (!d.fansub && !fansub)) &&
						d.isDub === isDub
					)

					data.push({
						link: rawLink,
						name,
						pahe: matchedDownload?.pahe || rawLink,
						quality: matchedDownload?.quality,
						filesize: matchedDownload?.filesize,
						fansub,
						resolution,
						audio,
						isDub,
					})
					resolvePromises.push(this.resolveKwikEmbed(embedLink))
				}
			}

			const resolved = await Promise.all(resolvePromises)
			for (let i = 0; i < resolved.length; i++) {
				const item = resolved[i]
				if (item) {
					data[i].m3u8 = item.m3u8
					data[i].mp4 = item.mp4
					data[i].filename = item.filename
				}
			}

			// Return ALL items â€” resolved ones have .m3u8/.mp4 set, unresolved ones can be
			// picked up by the worker's fallback strategy (access-kwik API).
			return data;
		});
	}

	public async LinksF(session: string) {
		return await fetch(`https://animepahe.si/play/${this.streamUrl}/${session}`, {
			headers: AnimePahe.Headers(this.streamUrl, this.userAgent, AnimePahe.ddosGuardCookie())
		}).then(async (res) => {
			const raw = await res.text();
			const data: Array<{
				link: string;
				name: string;
				pahe: string;
				quality: string;
				fansub: string;
				resolution: string;
				filesize: string;
				isDub: boolean;
			}> = [];
			let m: RegExpExecArray | null;
			const middleDot = '\u00B7';

			const regex = /href=["'](?<link>https?:\/\/pahe[.]win\/[^"']+)["'][^>]*>(?<name>[^<]+)/g;
			const kwixArray: Array<Promise<string | false>> = [];

			while ((m = regex.exec(raw.replace(/\n/g, '')) as RegExpExecArray) !== null) {
				if (m.index === regex.lastIndex) {
					regex.lastIndex++;
				}

				const pahe = (m.groups as Record<string, string>)['link'];
				const rawName = (m.groups as Record<string, string>)['name'] || '';
				const name = rawName
					.replace(/&nbsp;/g, ' ')
					.replace(/&middot;|&#183;|&#8226;|&#xB7;|&bull;/g, middleDot)
					.replace(/\uFFFD/g, middleDot)
					.replace(/\s+/g, ' ')
					.trim();

				kwixArray.push(this.Kwix(pahe));

				// parse metadata from name: "Amazon · 360p (54MB)"
				const parts = name.split(middleDot).map(p => p.trim()).filter(Boolean);
				let fansub = '';
				let rest = '';
				if (parts.length >= 2) {
					fansub = parts[0];
					rest = parts.slice(1).join(` ${middleDot} `);
				} else {
					rest = parts[0] || '';
				}
				if (!fansub) {
					const fsMatch = /^(.+?)\s*\d+p/i.exec(rest);
					if (fsMatch) {
						fansub = fsMatch[1].trim();
					}
				}
				const resMatch = /(\d+)p/i.exec(rest);
				const sizeMatch = /\(([^)]+)\)/i.exec(rest);
				const resolution = resMatch ? resMatch[1] : '';
				const filesize = sizeMatch ? sizeMatch[1] : '';
				const isDub = /\beng\b/i.test(rest);

				data.push({
					link: '',
					name: name.replace(/\s+/g, ' '),
					pahe,
					quality: name,
					fansub,
					resolution,
					filesize,
					isDub,
				});
			}

			const resolved = await Promise.all(kwixArray);
			for (let i = 0; i < resolved.length; i++) {
				const content = resolved[i];
				if (content) {
					data[i].link = content;
				}
			}

			return data.filter(obj => !!obj.link);
		});
	}

	public async getIds() {
		const page = await fetch(`https://animepahe.si/anime/${this.streamUrl}`, {
			headers: AnimePahe.Headers(this.streamUrl, this.userAgent, AnimePahe.ddosGuardCookie())
		}).then(async (res) => await res.text());

		const ids: any = {
			animepahe_id: null,
			mal_id: null,
			anilist_id: null,
			anime_planet_id: null,
			ann_id: null,
			anilist: null,
			anime_planet: null,
			ann: null,
			kitsu: null,
			myanimelist: null,
		};

		// Extract MAL ID
		const malMatches = [...page.matchAll(/https?:\/\/myanimelist\.net\/anime\/(\d+)/g)];
		if (malMatches.length > 0) {
			ids.mal_id = parseInt(malMatches[0][1]);
			ids.myanimelist = malMatches.length > 1 ? malMatches[1][1] : malMatches[0][1];
		}

		// Extract Anilist ID
		const anilistMatches = [...page.matchAll(/https?:\/\/anilist\.co\/anime\/(\d+)/g)];
		if (anilistMatches.length > 0) {
			ids.anilist_id = parseInt(anilistMatches[0][1]);
			ids.anilist = anilistMatches[0][1];
		}

		// Extract Anime-Planet
		const apMatch = page.match(/https?:\/\/www\.anime-planet\.com\/anime\/([^"']+)/);
		if (apMatch) {
			ids.anime_planet = apMatch[1];
		}

		// Extract ANN
		const annMatches = [...page.matchAll(/https?:\/\/www\.animenewsnetwork\.com\/encyclopedia\/anime\.php\?id=(\d+)/g)];
		if (annMatches.length > 0) {
			ids.ann_id = parseInt(annMatches[0][1]);
			ids.ann = annMatches[0][1];
		}

		// Extract Kitsu
		const kitsuMatch = page.match(/https?:\/\/kitsu\.io\/anime\/([^"']+)/);
		if (kitsuMatch) {
			ids.kitsu = kitsuMatch[1];
		}

		// AnimePahe ID from URL or something, but placeholder
		ids.animepahe_id = null; // Would need to extract from page

		return ids;
	}

	public static async search(query: string, userAgent: string) {
		return await fetch(`https://animepahe.si/api?m=search&q=${encodeURIComponent(query)}`, {
			headers: AnimePahe.Headers(false, userAgent)
		}).then((res) => res.json<iFetchResponse>());
	}
}








