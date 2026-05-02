const https = require('https');

const BASE = 'site.api.espn.com';
const ACC_GROUP = 50;
const DEFAULT_PRIMARY = 150;
const DEFAULT_SECONDARY = [153, 152];

/** Default cache TTL: 1 hour for most ESPN API responses. */
const CACHE_TTL_MS = 60 * 60 * 1000;
/** Short TTL for live endpoints (scoreboard, game summary) to avoid stale data during games. */
const CACHE_TTL_LIVE_MS = 15 * 1000;

const cache = {};
const cacheExpiry = {};

/** Outbound HTTPS timeout for ESPN API (matches tests / avoids hung sockets). */
const REQUEST_TIMEOUT_MS = 10_000;

function getLeaguePath(league) {
  const path =
    league === 'womens'
      ? 'basketball/womens-college-basketball'
      : 'basketball/mens-college-basketball';
  return `/apis/site/v2/sports/${path}`;
}

function fetch(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: { Accept: 'application/json' },
        timeout: REQUEST_TIMEOUT_MS,
      },
      res => {
        const status = res.statusCode;
        const ok = status >= 200 && status < 300;

        if (!ok) {
          res.resume();
          reject(new Error(`ESPN API returned HTTP ${status}`));
          return;
        }

        let data = '';
        res.on('data', chunk => (data += chunk));
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch {
            reject(new Error(`ESPN API returned invalid JSON (HTTP ${status})`));
          }
        });
      },
    );

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('ESPN API request timed out'));
    });

    req.on('error', reject);
  });
}

function getCached(key, fetcher, ttlMs = CACHE_TTL_MS) {
  const now = Date.now();
  if (cache[key] && cacheExpiry[key] > now) {
    return Promise.resolve(cache[key]);
  }
  return fetcher().then(data => {
    cache[key] = data;
    cacheExpiry[key] = now + ttlMs;
    return data;
  });
}

// All ESPN API fetchers use getCached - no requests bypass the 1-hour cache.

async function getTeamSchedule(league, teamId, options = {}) {
  const path = getLeaguePath(league);
  let url = `https://${BASE}${path}/teams/${teamId}/schedule`;
  if (options.seasontype != null) {
    url += `?seasontype=${options.seasontype}`;
  }
  const cacheKey = `schedule:${league}:${teamId}:${options.seasontype ?? 'default'}`;
  return getCached(cacheKey, () => fetch(url));
}

async function getTeam(league, teamId) {
  const path = getLeaguePath(league);
  const url = `https://${BASE}${path}/teams/${teamId}`;
  return getCached(`team:${league}:${teamId}`, () => fetch(url));
}

async function getScoreboard(league, options = {}) {
  const path = getLeaguePath(league);
  let url = `https://${BASE}${path}/scoreboard`;
  if (options.groups) {
    url += `?groups=${options.groups}`;
  }
  if (options.dates) {
    url += (url.includes('?') ? '&' : '?') + `dates=${options.dates}`;
  }
  return getCached(
    `scoreboard:${league}:${options.groups || 'all'}:${options.dates || 'today'}`,
    () => fetch(url),
    CACHE_TTL_LIVE_MS,
  );
}

async function getNews(league) {
  const path = getLeaguePath(league);
  const url = `https://${BASE}${path}/news`;
  return getCached(`news:${league}`, () => fetch(url));
}

async function getGameSummary(league, eventId) {
  const path = getLeaguePath(league);
  const url = `https://${BASE}${path}/summary?event=${eventId}`;
  return getCached(`summary:${league}:${eventId}`, () => fetch(url), CACHE_TTL_LIVE_MS);
}

async function getTeamRoster(league, teamId) {
  const path = getLeaguePath(league);
  const url = `https://${BASE}${path}/teams/${teamId}/roster`;
  return getCached(`roster:${league}:${teamId}`, () => fetch(url));
}

function parseNewsItem(article) {
  const image = article.images?.[0]?.url || null;
  const link = article.links?.web?.href || article.links?.web?.self?.href || null;
  return {
    title: article.headline || '',
    contentSnippet: article.description || '',
    image,
    link,
  };
}

function parseTeamFromSchedule(scheduleRes) {
  if (!scheduleRes?.team) return null;
  const t = scheduleRes.team;
  return {
    id: t.id,
    name: t.displayName,
    shortName: t.shortDisplayName,
    logo: t.logo,
    color: t.color,
    alternateColor: t.alternateColor,
    record: t.recordSummary,
    standing: t.standingSummary,
    rank: t.curatedRank?.current,
  };
}

function parseTeamRecord(teamRes) {
  const items = teamRes?.team?.record?.items || [];
  const result = { recordHome: null, recordAway: null, streak: null, ppg: null };
  for (const item of items) {
    const summary = item.summary ?? item.displayValue;
    if (item.type === 'home') result.recordHome = summary;
    else if (item.type === 'road') result.recordAway = summary;
  }
  const totalItem = items.find(i => i.type === 'total');
  if (totalItem?.stats) {
    const streakStat = totalItem.stats.find(s => s.name === 'streak');
    if (streakStat != null && streakStat.value !== undefined) {
      const n = Math.abs(Math.round(streakStat.value));
      result.streak = n > 0 ? (streakStat.value > 0 ? `W${n}` : `L${n}`) : null;
    }
    const ppgStat = totalItem.stats.find(s => s.name === 'avgPointsFor');
    if (ppgStat != null && ppgStat.value != null) {
      result.ppg = Math.round(ppgStat.value * 10) / 10;
    }
  }
  return result;
}

function toScoreString(score) {
  if (score == null) return null;
  if (typeof score === 'string' || typeof score === 'number') return String(score);
  if (typeof score === 'object' && (score.displayValue != null || score.value != null)) {
    return String(score.displayValue ?? score.value ?? '');
  }
  return null;
}

function parseBroadcasts(comp) {
  const broadcasts = comp?.broadcasts || [];
  return broadcasts
    .filter(b => b.type?.shortName && b.media?.shortName)
    .map(b => ({ type: b.type.shortName, name: b.media.shortName }));
}

function parseVenue(comp) {
  const v = comp?.venue;
  if (!v) return null;
  const parts = [v.fullName];
  if (v.address?.city) parts.push(v.address.city);
  if (v.address?.state) parts.push(v.address.state);
  return { name: v.fullName, city: v.address?.city, state: v.address?.state, display: parts.join(', ') };
}

function parseEvent(event, league = 'mens') {
  if (!event?.competitions?.[0]) return null;
  const comp = event.competitions[0];
  const status = comp.status?.type;
  const statusObj = comp.status;
  const competitors = comp.competitors || [];
  const home = competitors.find(c => c.homeAway === 'home');
  const away = competitors.find(c => c.homeAway === 'away');

  const statusShortDetail = status?.shortDetail || status?.description || 'Scheduled';
  const isLive = status?.state === 'in';
  const seasonType = event.seasonType?.name || null;
  const neutralSite = comp.neutralSite === true;
  const venue = parseVenue(comp);
  const venueDisplay = venue
    ? neutralSite
      ? `Neutral: ${venue.display}`
      : venue.display
    : null;

  const leagueSlug = league === 'womens' ? 'womens-college-basketball' : 'mens-college-basketball';
  const gameUrl = event.id
    ? `https://www.espn.com/${leagueSlug}/game/_/gameId/${event.id}`
    : null;

  return {
    id: event.id,
    gameUrl,
    name: event.name,
    shortName: event.shortName,
    date: event.date,
    status: status?.description || statusShortDetail || 'Scheduled',
    statusShortDetail,
    displayClock: statusObj?.displayClock,
    period: statusObj?.period,
    isLive,
    completed: status?.completed,
    seasonType,
    neutralSite,
    broadcasts: parseBroadcasts(comp),
    venue: venue ? { ...venue, display: venueDisplay } : null,
    home: home
      ? {
          id: home.team?.id,
          name: home.team?.displayName,
          shortName: home.team?.shortDisplayName,
          logo: home.team?.logo ?? home.team?.logos?.[0]?.href,
          color: home.team?.color,
          score: toScoreString(home.score),
          winner: home.winner,
        }
      : null,
    away: away
      ? {
          id: away.team?.id,
          name: away.team?.displayName,
          shortName: away.team?.shortDisplayName,
          logo: away.team?.logo ?? away.team?.logos?.[0]?.href,
          color: away.team?.color,
          score: toScoreString(away.score),
          winner: away.winner,
        }
      : null,
  };
}

function parseBoxscorePlayers(summaryRes, teamId) {
  const box = summaryRes?.boxscore;
  if (!box?.players) return [];
  const teamPlayers = box.players.find(p => String(p.team?.id) === String(teamId));
  if (!teamPlayers?.statistics?.[0]?.athletes) return [];
  const keys = teamPlayers.statistics[0].keys || [];
  const athletes = teamPlayers.statistics[0].athletes || [];
  const idx = (k) => keys.indexOf(k);
  const num = (a, i) => {
    if (i < 0 || !a.stats?.[i]) return null;
    const v = parseFloat(String(a.stats[i]));
    return Number.isNaN(v) ? null : v;
  };
  const str = (a, i) => (i >= 0 && a.stats?.[i] ? String(a.stats[i]) : '');

  return athletes
    .filter(a => !a.didNotPlay && a.stats?.length)
    .map(a => {
      const ptsIdx = idx('points');
      const rebIdx = idx('rebounds');
      const astIdx = idx('assists');
      const minIdx = idx('minutes');
      const fgIdx = idx('fieldGoalsMade-fieldGoalsAttempted');
      const fg3Idx = idx('threePointFieldGoalsMade-threePointFieldGoalsAttempted');
      const ftIdx = idx('freeThrowsMade-freeThrowsAttempted');
      const stlIdx = idx('steals');
      const blkIdx = idx('blocks');
      const toIdx = idx('turnovers');

      return {
        id: a.athlete?.id,
        name: a.athlete?.displayName || a.athlete?.fullName || '',
        headshot: a.athlete?.headshot?.href || a.headshot?.href,
        position: a.athlete?.position?.abbreviation || a.position?.abbreviation || '',
        jersey: a.jersey || '',
        pts: num(a, ptsIdx) ?? 0,
        reb: num(a, rebIdx) ?? 0,
        ast: num(a, astIdx) ?? 0,
        min: str(a, minIdx),
        fg: str(a, fgIdx),
        fg3: str(a, fg3Idx),
        ft: str(a, ftIdx),
        stl: num(a, stlIdx),
        blk: num(a, blkIdx),
        to: num(a, toIdx),
      };
    });
}

function getLastCompletedEvent(events) {
  const now = new Date();
  const completed = (events || []).filter(e => {
    const comp = e.competitions?.[0];
    const isCompleted = comp?.status?.type?.completed === true;
    const gameDate = e.date ? new Date(e.date) : null;
    return isCompleted && gameDate && gameDate < now;
  });
  return completed.length > 0 ? completed[completed.length - 1] : null;
}

function getLastGame(events, league = 'mens') {
  const now = new Date();
  const completed = (events || []).filter(e => {
    const comp = e.competitions?.[0];
    const isCompleted = comp?.status?.type?.completed === true;
    const gameDate = e.date ? new Date(e.date) : null;
    return isCompleted && gameDate && gameDate < now;
  });
  return completed.length > 0 ? parseEvent(completed[completed.length - 1], league) : null;
}

function getUpcomingGames(events, limit = 5, league = 'mens') {
  const now = new Date();
  const upcoming = (events || []).filter(e => {
    const comp = e.competitions?.[0];
    const isCompleted = comp?.status?.type?.completed === true;
    const isLive = comp?.status?.type?.state === 'in';
    const gameDate = e.date ? new Date(e.date) : null;
    return !isCompleted && gameDate && (isLive || gameDate >= now);
  });
  return upcoming.slice(0, limit).map(e => parseEvent(e, league));
}

async function getNCAAData(league, teamIds = {}) {
  const leaguePath = league === 'womens' ? 'womens' : 'mens';
  const primaryId = teamIds.primaryTeamId ?? DEFAULT_PRIMARY;
  const secondaryIds = teamIds.secondaryTeamIds ?? DEFAULT_SECONDARY;
  const [s1, s2] = secondaryIds;

  const [primarySchedule, primaryTeamRes, sec1Schedule, sec2Schedule, accScoreboard] =
    await Promise.all([
      getTeamSchedule(leaguePath, primaryId),
      getTeam(leaguePath, primaryId),
      s1 ? getTeamSchedule(leaguePath, s1) : null,
      s2 ? getTeamSchedule(leaguePath, s2) : null,
      getScoreboard(leaguePath, { groups: ACC_GROUP }),
    ]);

  let newsRes = null;
  try {
    newsRes = await getNews(leaguePath);
  } catch {
    /* best-effort: news fetch failure does not fail the whole request */
  }

  const primaryTeam = parseTeamFromSchedule(primarySchedule);
  const sec1Team = s1 ? parseTeamFromSchedule(sec1Schedule) : null;
  const sec2Team = s2 ? parseTeamFromSchedule(sec2Schedule) : null;

  const recordExtras = parseTeamRecord(primaryTeamRes);
  if (primaryTeam) {
    Object.assign(primaryTeam, recordExtras);
    if (primaryTeamRes?.team?.alternateColor && !primaryTeam.alternateColor) {
      primaryTeam.alternateColor = primaryTeamRes.team.alternateColor;
    }
  }

  const primaryEvents = primarySchedule?.events || [];
  const sec1Events = sec1Schedule?.events || [];
  const sec2Events = sec2Schedule?.events || [];

  const primaryUpcoming = getUpcomingGames(primaryEvents, 5, leaguePath);
  const nextGame = primaryUpcoming[0] || null;

  const accEvents = accScoreboard?.events || [];
  const accGames = accEvents.map(e => parseEvent(e, leaguePath)).filter(Boolean);

  const allTeams = [primaryTeam, sec1Team, sec2Team].filter(Boolean);
  const standings = allTeams
    .map(t => ({
      id: t.id,
      team: t.name,
      shortName: t.shortName,
      logo: t.logo,
      record: t.record,
      standing: t.standing,
      rank: t.rank,
    }))
    .sort((a, b) => (a.rank || 99) - (b.rank || 99));

  const upcomingOnly = (events, limit, league) =>
    getUpcomingGames(events, limit, league).filter(g => !g.isLive);

  const secondary = [
    sec1Team
      ? {
          team: sec1Team,
          lastGame: getLastGame(sec1Events, leaguePath),
          upcomingGames: upcomingOnly(sec1Events, 3, leaguePath),
        }
      : null,
    sec2Team
      ? {
          team: sec2Team,
          lastGame: getLastGame(sec2Events, leaguePath),
          upcomingGames: upcomingOnly(sec2Events, 3, leaguePath),
        }
      : null,
  ].filter(Boolean);

  const espnNews = (newsRes?.articles || []).slice(0, 12).map(parseNewsItem);

  let playerStats = null;
  let eventsForPlayerStats = primaryEvents;
  if (getLastCompletedEvent(primaryEvents) == null && primaryId) {
    try {
      const regSeasonSchedule = await getTeamSchedule(leaguePath, primaryId, { seasontype: 2 });
      const regEvents = regSeasonSchedule?.events || [];
      if (regEvents.length > 0) eventsForPlayerStats = regEvents;
    } catch {
      /* ignore */
    }
  }
  const lastEvent = getLastCompletedEvent(eventsForPlayerStats);
  if (lastEvent?.id && primaryId) {
    try {
      const summaryRes = await getGameSummary(leaguePath, lastEvent.id);
      const players = parseBoxscorePlayers(summaryRes, primaryId);
      if (players.length > 0) {
        const mvp = players.reduce((best, p) => (p.pts > best.pts ? p : best), players[0]);
        const others = players.filter(p => p.id !== mvp.id);
        const randomPlayer = others.length > 0
          ? others[Math.floor(Math.random() * others.length)]
          : mvp;
        const opponent = lastEvent.competitions?.[0]?.competitors?.find(
          c => String(c.id) !== String(primaryId)
        );
        const opponentName = opponent?.team?.shortDisplayName || opponent?.team?.displayName || 'Opponent';
        playerStats = {
          randomPlayer: { ...randomPlayer, lastGameVs: opponentName },
          mvp: { ...mvp, lastGameVs: opponentName },
        };
      }
    } catch (err) {
      console.error('Failed to fetch player stats:', err.message);
    }
  }

  return {
    sport: leaguePath,
    primary: {
      team: primaryTeam,
      lastGame: getLastGame(primaryEvents, leaguePath),
      upcomingGames: primaryUpcoming,
      nextGame,
    },
    secondary,
    acc: {
      standings,
      todayGames: accGames,
    },
    news: espnNews,
    playerStats,
  };
}

module.exports = {
  getNCAAData,
  getTeamSchedule,
  getTeam,
  getScoreboard,
};
