import { AnimePahe, iFetchResponse } from './reqeusts';
import { Proxy } from './proxy';
import { Env, WorkerResponse } from './config';

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const userAgent = request.headers.get('user-agent');
		const { searchParams, pathname } = new URL(request.url);

		const method = searchParams.get('m') || searchParams.get('method');

		// Proxy helper (CORS + fetch a remote URL)
		switch (pathname) {
			case '/proxy': {
				return Proxy(request, env, ctx);
			}
		}

		if (!userAgent) {
			return WorkerResponse({ userAgent: false }, 'application/json');
		}

		if (!method) {
			return WorkerResponse({
				m: 'METHOD - (airing | search | release)',
				page: 'PAGE NO (required for airing/release)',
				q: 'SEARCH QUERY (required for search)',
				id: 'ANIME SESSION UUID (required for release)',
				session: 'EPISODE SESSION (required for release with session filter)',
				example: {
					"AIRING": 'https://anime.apex-cloud.workers.dev/api?m=airing&page=1',
					"SEARCH": 'https://anime.apex-cloud.workers.dev/api?m=search&q=naruto',
					"RELEASE": 'https://anime.apex-cloud.workers.dev/api?m=release&id=<anime_session>&page=1'
				}
			}, 'application/json');
		}

		try {
			switch (method) {
				case 'airing': {
					const page = searchParams.get('page') || '1';
					const res = await fetch(`https://animepahe.si/api?m=airing&page=${encodeURIComponent(page)}`, {
						headers: AnimePahe.Headers(false, userAgent),
					});
					const raw = await res.json() as iFetchResponse;

					const formatted = {
						paginationInfo: {
							total: raw.total,
							perPage: raw.per_page,
							currentPage: raw.current_page,
							lastPage: raw.last_page,
							nextPageUrl: raw.next_page_url,
							from: raw.from,
							to: raw.to,
						},
						data: (raw.data || []).map((item: any) => ({
							id: item.id,
							anime_id: item.anime_id,
							title: item.anime_title,
							episode: item.episode,
							episode2: item.episode2 ?? null,
							edition: item.edition || null,
							fansub: item.fansub,
							image: item.snapshot,
							disc: item.disc || null,
							session: item.anime_session,
							link: `https://animepahe.si/anime/${item.session}`,
							filler: item.filler === 1 ? true : null,
							created_at: item.created_at,
							completed: item.completed,
						})),
					};

					return WorkerResponse(formatted, 'application/json');
				}

				case 'search': {
					const query = searchParams.get('q') || searchParams.get('query');
					if (!query) {
						return WorkerResponse({ status: false }, 'application/json');
					}
					const raw = await AnimePahe.search(query, userAgent) as iFetchResponse;

					const formatted = {
						paginationInfo: {
							total: raw.total,
							perPage: raw.per_page,
							currentPage: raw.current_page,
							lastPage: raw.last_page,
							from: raw.from,
							to: raw.to,
						},
						data: (raw.data || []).map((item: any) => ({
							id: item.id,
							title: item.title,
							status: item.status,
							type: item.type,
							episodes: item.episodes,
							score: item.score,
							year: item.year,
							season: item.season,
							poster: item.poster,
							session: item.session,
							link: `https://animepahe.si/anime/${item.session}`,
						})),
					};

					return WorkerResponse(formatted, 'application/json');
				}

				case 'release': {
					const id = searchParams.get('id');
					if (!id) {
						return WorkerResponse({ status: false }, 'application/json');
					}

					const sort = searchParams.get('sort') || 'episode_asc';
					const page = searchParams.get('page') || '1';
					const session = searchParams.get('session');

					let url = `https://animepahe.si/api?m=release&id=${encodeURIComponent(id)}&sort=${encodeURIComponent(sort)}&page=${encodeURIComponent(page)}`;
					if (session) {
						url += `&session=${encodeURIComponent(session)}`;
					}

					const res = await fetch(url, {
						headers: AnimePahe.Headers(id, userAgent),
					});
					const raw = await res.json() as iFetchResponse;

					const formatted = {
						paginationInfo: {
							total: raw.total,
							perPage: raw.per_page,
							currentPage: raw.current_page,
							lastPage: raw.last_page,
							from: raw.from,
							to: raw.to,
						},
						data: (raw.data || []).map((item: any) => ({
							id: item.id,
							anime_id: item.anime_id,
							episode: item.episode,
							episode2: item.episode2 ?? null,
							edition: item.edition || null,
							title: item.title || null,
							snapshot: item.snapshot,
							disc: item.disc || null,
							audio: item.audio,
							duration: item.duration,
							session: item.session,
							link: `https://animepahe.si/play/${id}/${item.session}`,
							filler: item.filler === 1 ? true : null,
							created_at: item.created_at,
						})),
					};

					return WorkerResponse(formatted, 'application/json');
				}

				// Legacy helpers (kept for backwards compatibility)
				case 'series': {
					const session = searchParams.get('session');
					let page = searchParams.get('page') as string | false;
					if (!page) { page = false; }
					if (!session) {
						return WorkerResponse({ status: false }, 'application/json');
					}

					const Pahe = new AnimePahe(session, userAgent);
					const response = await Pahe.Episodes(page);
					return WorkerResponse(response, 'application/json');
				}

				case 'play':
				case 'episode': {
					const url = new URL(request.url);
					const pathParts = url.pathname.split('/').filter(p => p);
					let animeSlug: string;
					let episodeId: string;
					let debug = searchParams.get('debug') === '1';
					const trace = searchParams.get('trace') === '1';

					if (pathParts.length >= 3 && pathParts[0] === 'play') {
						// Path-based: /play/{anime-slug}/{session}
						animeSlug = pathParts[1];
						episodeId = pathParts[2];
					} else {
						// Query-based: supports both new (?m=episode&id=...&episodeId=...)
						// and old (?method=episode&session=...&ep=...) formats
						animeSlug = searchParams.get('id') || searchParams.get('session') || '';
						episodeId = searchParams.get('episodeId') || searchParams.get('ep') || '';
						if (!animeSlug || !episodeId) {
							return WorkerResponse({ status: false }, 'application/json');
						}
					}

					if (episodeId.includes('?')) {
						const [clean, query] = episodeId.split('?');
						episodeId = clean;
						if (!debug && query.includes('debug=1')) {
							debug = true;
						}
					}
					if (episodeId.includes('&')) {
						episodeId = episodeId.split('&')[0];
					}

					const animePahe = new AnimePahe(animeSlug, userAgent);

					const [animeTitle, ids, releaseData, links, linksF] = await Promise.all([
						animePahe.Series(),
						animePahe.getIds(),
						animePahe.Extract(false),
						animePahe.Links(episodeId),
						animePahe.LinksF(episodeId)
					]);

					if (debug) {
						const debugLinks = (linksF && linksF.length > 0) ? linksF : links;
						return WorkerResponse({ ids, session: episodeId, links: debugLinks }, 'application/json');
					}

					const episode = releaseData.data.find((d: any) => d.session === episodeId)?.episode || 1;
					ids.animepahe_id = releaseData.data[0]?.anime_id || ids.animepahe_id;

					// Fill missing external IDs using public APIs (Jikan + Anilist) and heuristics
					try {
						const idFetches: Promise<void>[] = [];

						if (!ids.mal_id) {
							idFetches.push(
								fetch(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(animeTitle)}&limit=1`, { headers: { 'User-Agent': userAgent } })
									.then(r => r.ok ? r.json() : null)
									.then((d: any) => {
										const animeData = d?.data?.[0];
										if (animeData?.mal_id) {
											ids.mal_id = animeData.mal_id;
											ids.myanimelist = String(animeData.mal_id);
										}
									})
									.catch(() => {})
							);
						}

						const fillFromAnilist = (media: any) => {
							if (!media) {
								return;
							}
							const anilistId = media.id;
							if (anilistId && !ids.anilist_id) {
								ids.anilist_id = anilistId;
								ids.anilist = String(anilistId);
							}
							const malId = media.idMal;
							if (malId && !ids.mal_id) {
								ids.mal_id = malId;
								ids.myanimelist = String(malId);
							}
							const links = Array.isArray(media.externalLinks) ? media.externalLinks : [];
							for (const link of links) {
								const site = (link?.site || '').toLowerCase();
								const url = link?.url || '';
								if (!url) {
									continue;
								}
								if (!ids.ann_id && (site.includes('anime news network') || site === 'ann')) {
									const annMatch = url.match(/id=(\d+)/i);
									if (annMatch) {
										ids.ann_id = parseInt(annMatch[1]);
										ids.ann = annMatch[1];
									}
								}
								if (!ids.anime_planet && site.includes('anime-planet')) {
									const apMatch = url.match(/anime-planet\.com\/anime\/([^/?#]+)/i);
									if (apMatch) {
										ids.anime_planet = apMatch[1];
									}
								}
								if (!ids.kitsu && site.includes('kitsu')) {
									const kitsuMatch = url.match(/kitsu\.io\/anime\/([^/?#]+)/i);
									if (kitsuMatch) {
										ids.kitsu = kitsuMatch[1];
									}
								}
							}
						};

						// Prefer Anilist lookup by MAL ID (more reliable than title search)
						if (ids.mal_id && (!ids.anilist_id || !ids.ann_id || !ids.anime_planet || !ids.kitsu)) {
							const gqlByMal = `query ($idMal: Int) { Media(idMal: $idMal, type: ANIME) { id idMal externalLinks { site url } } }`;
							idFetches.push(
								fetch('https://graphql.anilist.co', {
									method: 'POST',
									headers: { 'Content-Type': 'application/json' },
									body: JSON.stringify({ query: gqlByMal, variables: { idMal: ids.mal_id } }),
								})
									.then(r => r.ok ? r.json() : null)
									.then((d: any) => fillFromAnilist(d?.data?.Media))
									.catch(() => {})
							);
						}

						// Fallback: Anilist search by title
						if (!ids.anilist_id || !ids.ann_id || !ids.anime_planet || !ids.kitsu || !ids.mal_id) {
							const gql = `query ($search: String) { Media(search: $search, type: ANIME) { id idMal externalLinks { site url } } }`;
							idFetches.push(
								fetch('https://graphql.anilist.co', {
									method: 'POST',
									headers: { 'Content-Type': 'application/json' },
									body: JSON.stringify({ query: gql, variables: { search: animeTitle } }),
								})
									.then(r => r.ok ? r.json() : null)
									.then((d: any) => fillFromAnilist(d?.data?.Media))
									.catch(() => {})
							);
						}

						if (!ids.anime_planet) {
							ids.anime_planet = animeTitle
								.toLowerCase()
								.replace(/[^a-z0-9]+/g, '-')
								.replace(/^-+|-+$/g, '');
						}

						await Promise.all(idFetches);
					} catch (e) {
						// Ignore external API failures
					}

					const sources: Array<{
						url: string;
						isM3U8: boolean;
						embed: string;
						resolution: string;
						isDub: boolean;
						fanSub: string;
						download: string;
					}> = [];

					const downloads: Array<{
						fansub: string;
						quality: string;
						resolution: string;
						filesize: string;
						isDub: boolean;
						pahe: string;
						download: string;
					}> = [];
					const kwikTrace: Array<any> = [];
					const middleDot = '\u00B7';
					const embedLookup = new Map<string, string>();

					for (const item of links as any[]) {
						const fansub = item.fansub || '';
						const resolution = item.resolution || '';
						const isDub = (item.audio || '').toLowerCase() === 'eng';
						const key = `${fansub}|${resolution}|${isDub}`;
						const link = item.link || '';
						if (link.includes('/e/')) {
							embedLookup.set(key, link);
						}
					}

					const resolverPlayBase = env.RESOLVER_PLAY_BASE;
					const resolverApiKey = env.RESOLVER_API_KEY;
					const tryResolver = async (): Promise<any | null> => {
						if (!resolverPlayBase) {
							return null;
						}
						try {
							const base = resolverPlayBase.replace(/\/$/, '');
							const resolverUrl = `${base}/${encodeURIComponent(animeSlug)}?episodeId=${encodeURIComponent(episodeId)}`;
							const headers: Record<string, string> = { 'User-Agent': userAgent };
							if (resolverApiKey) {
								headers['x-api-key'] = resolverApiKey;
							}
							const resp = await fetch(resolverUrl, { headers });
							if (!resp.ok) {
								return null;
							}
							const data = await resp.json() as any;
							if ((Array.isArray(data?.sources) && data.sources.length > 0) ||
								(Array.isArray(data?.downloads) && data.downloads.length > 0)) {
								return data;
							}
						} catch {
							return null;
						}
						return null;
					};

					// Helper: rename file param from AnimePahe_ to Aniflix_ and strip fansub suffix
					const normalizeDownloadUrl = (originalUrl: string): string => {
						try {
							const u = new URL(originalUrl);
							const fileParam = u.searchParams.get('file') || '';
							let filename = decodeURIComponent(fileParam);
							filename = filename.replace(/^AnimePahe_/, 'Aniflix_');
							filename = filename.replace(/_-_(\d+)_/, (_m: string, ep: string) => `_-_${String(ep).padStart(2, '0')}_`);
							// Remove trailing fansub token before .mp4 (e.g. _Amazon.mp4 -> .mp4)
							filename = filename.replace(/_[^_]+\.mp4$/, '.mp4');
							filename = filename.replace(/__+/g, '_');
							u.searchParams.set('file', filename);
							return u.toString();
						} catch {
							return originalUrl;
						}
					};

					// Helper: derive m3u8 stream URL from mp4 vault URL
					const toM3u8 = (mp4Url: string): string => {
						try {
							const u = new URL(mp4Url);
							const streamHost = u.host.replace('.kwik.cx', '.owocdn.top');
							const parts = u.pathname.split('/');
							// Expect: /mp4/<a>/<b>/<hash>
							if (parts.length >= 5 && parts[1] === 'mp4') {
								return `https://${streamHost}/stream/${parts[2]}/${parts[3]}/${parts[4]}/uwu.m3u8`;
							}
							return '';
						} catch {
							return '';
						}
					};

					// --- Strategy 1: use data already resolved by Links() (embed URLs -> m3u8/mp4) ---
					// Links() returns objects with optional .m3u8 and .mp4 fields when resolveKwikEmbed succeeds.
					const resolvedFromEmbed = links.filter((l: any) => l.m3u8 && l.mp4);

					if (resolvedFromEmbed.length > 0) {
						for (const item of resolvedFromEmbed as any[]) {
							const modifiedUrl = normalizeDownloadUrl(item.mp4);
							const embedUrl = item.link.includes('/e/') ? item.link : '';

							sources.push({
								url: item.m3u8,
								isM3U8: true,
								embed: embedUrl,
								resolution: item.resolution || '',
								isDub: (item.audio || '').toLowerCase() === 'eng',
								fanSub: item.fansub || '',
								download: modifiedUrl,
							});

							downloads.push({
								fansub: item.fansub || '',
								quality: item.quality || item.name || `${item.fansub || ''} ${middleDot} ${item.resolution || ''}p`,
								resolution: item.resolution || '',
								filesize: item.filesize || '',
								isDub: (item.audio || '').toLowerCase() === 'eng',
								pahe: item.pahe || item.link,
								download: modifiedUrl,
							});
						}
					} else {
						// --- Strategy 2: use /f/ URLs (from LinksF if available) and resolve via access-kwik ---
						const linksForKwik = (linksF && linksF.length > 0) ? linksF : links;
						const isValidKwik = (url: string) => /https?:\/\/kwik\.[^/]+\/f\/[A-Za-z0-9]+/i.test(url);
						const resolveKwikItem = async (item: any) => {
							const rawLink: string = item.link || '';
							const paheUrl: string = item.pahe || '';
							const traceEntry: any = trace ? { rawLink, paheUrl } : null;
							let pushedTrace = false;
							const pushTrace = () => {
								if (trace && traceEntry && !pushedTrace) {
									kwikTrace.push(traceEntry);
									pushedTrace = true;
								}
							};
							const candidates: string[] = [];
							if (rawLink) {
								candidates.push(rawLink);
								const converted = rawLink.replace('/e/', '/f/').replace('/d/', '/f/');
								if (converted !== rawLink) {
									candidates.push(converted);
								}
							}
							if (paheUrl.includes('pahe.win')) {
								const resolved = await animePahe.Kwix(paheUrl);
								if (resolved) {
									candidates.push(resolved as string);
								}
							}
							const kwikUrl = candidates
								.filter((c) => isValidKwik(c))
								.sort((a, b) => b.length - a.length)[0] || '';
							if (traceEntry) {
								traceEntry.kwikUrl = kwikUrl;
							}
							if (!kwikUrl || !kwikUrl.includes('/f/')) {
								if (traceEntry) {
									traceEntry.error = 'missing_f_link';
								}
								pushTrace();
								return;
							}
							const nameValue: string = item.name || '';
							let nameParts: string[] = nameValue.split(' - ');
							if (nameParts.length < 2 && nameValue.includes(middleDot)) {
								nameParts = nameValue.split(` ${middleDot} `);
							}
							const fansub = item.fansub || nameParts[0] || '';
							const resolution = item.resolution || (nameParts[1]?.replace('p', '') ?? '');
							const filesizeMatch = (item.name || '').match(/\(([^)]+)\)/);
							const filesize = item.filesize || (filesizeMatch ? filesizeMatch[1] : '');
							const quality = item.quality || item.name || `${fansub} ${middleDot} ${resolution}p`;
							const isDub = (item.audio || '').toLowerCase() === 'eng';
							const key = `${fansub}|${resolution}|${isDub}`;
							const embedUrl = embedLookup.get(key) || (rawLink.includes('/e/') ? rawLink : '');

							try {
								const resp = await fetch('https://access-kwik.apex-cloud.workers.dev/', {
									method: 'POST',
									headers: {
										'Content-Type': 'application/json',
										'Accept': 'application/json',
										'User-Agent': userAgent,
										'Referer': 'https://access-kwik.apex-cloud.workers.dev/',
									},
									body: JSON.stringify({
										service: 'kwik',
										action: 'fetch',
										content: { kwik: kwikUrl },
										auth: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.O0FKaqhJjEZgCAVfZoLz6Pjd7Gs9Kv6qi0P8RyATjaE'
									}),
								});
								const rawText = await resp.text();
								let data: any = null;
								try {
									data = JSON.parse(rawText);
								} catch {
									data = null;
								}
								if (traceEntry) {
									traceEntry.access = {
										status: resp.status,
										ok: resp.ok,
										body: data ?? rawText.slice(0, 200),
									};
								}
								if (data.status && data.content?.url) {
									const originalUrl: string = data.content.url;
									const modifiedUrl = normalizeDownloadUrl(originalUrl);
									const m3u8Url = toM3u8(originalUrl);
									if (m3u8Url) {
										sources.push({
											url: m3u8Url,
											isM3U8: true,
											embed: embedUrl,
											resolution,
											isDub,
											fanSub: fansub,
											download: modifiedUrl,
										});
									}
									downloads.push({
										fansub,
										quality,
										resolution,
										filesize,
										isDub,
										pahe: paheUrl || kwikUrl,
										download: modifiedUrl,
									});
								}
								pushTrace();
								// Small delay to avoid rate-limits when resolving multiple qualities
								await new Promise((r) => setTimeout(r, 120));
							} catch (err) {
								if (traceEntry) {
									traceEntry.error = String(err);
								}
								pushTrace();
								await new Promise((r) => setTimeout(r, 120));
							}
						};

						for (const item of linksForKwik) {
							await resolveKwikItem(item);
						}
					}

					let resolverData: any | null = null;
					if (sources.length === 0 && downloads.length === 0) {
						resolverData = await tryResolver();
					}

					const formatted = {
						ids,
						session: episodeId,
						provider: 'kwik',
						episode: String(episode),
						anime_title: animeTitle,
						sources,
						downloads,
					};
					if (trace) {
						(formatted as any).trace = {
							kwik: kwikTrace,
						};
					}

					if (resolverData) {
						const merged = {
							...formatted,
							...resolverData,
							ids: { ...formatted.ids, ...(resolverData.ids || {}) },
							session: formatted.session,
							episode: resolverData.episode || formatted.episode,
							anime_title: resolverData.anime_title || formatted.anime_title,
						};
						return WorkerResponse(merged, 'application/json');
					}

					return WorkerResponse(formatted, 'application/json');
				}

				default: {
					return WorkerResponse({ status: false }, 'application/json');
				}
			}
		} catch (error) {
			return WorkerResponse({ status: false }, 'application/json');
		}
	},
};



