const https = require('https');

const BASE = 'site.api.espn.com';
const ACC_GROUP = 50;
const DEFAULT_PRIMARY = 150;
const DEFAULT_SECONDARY = [153, 152];
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

const cache = {};
const cacheExpiry = {};

function getLeaguePath(league) {
  const path =
    league === 'womens'
      ? 'basketball/womens-college-basketball'
      : 'basketball/mens-college-basketball';
  return `/apis/site/v2/sports/${path}`;
}

function fetch(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { Accept: 'application/json' } }, res => {
        let data = '';
        res.on('data', chunk => (data += chunk));
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch {
            reject(new Error('Invalid JSON'));
          }
        });
      })
      .on('error', reject);
  });
}

function getCached(key, fetcher) {
  const now = Date.now();
  if (cache[key] && cacheExpiry[key] > now) {
    return Promise.resolve(cache[key]);
  }
  return fetcher().then(data => {
    cache[key] = data;
    cacheExpiry[key] = now + CACHE_TTL_MS;
    return data;
  });
}

async function getTeamSchedule(league, teamId) {
  const path = getLeaguePath(league);
  const url = `https://${BASE}${path}/teams/${teamId}/schedule`;
  return getCached(`schedule:${league}:${teamId}`, () => fetch(url));
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
  return getCached(`scoreboard:${league}:${options.groups || 'all'}:${options.dates || 'today'}`, () =>
    fetch(url),
  );
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
    record: t.recordSummary,
    standing: t.standingSummary,
    rank: t.curatedRank?.current,
  };
}

function parseTeamRecord(teamRes) {
  const items = teamRes?.team?.record?.items || [];
  const result = { recordHome: null, recordAway: null, streak: null };
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

function parseEvent(event) {
  if (!event?.competitions?.[0]) return null;
  const comp = event.competitions[0];
  const status = comp.status?.type;
  const competitors = comp.competitors || [];
  const home = competitors.find(c => c.homeAway === 'home');
  const away = competitors.find(c => c.homeAway === 'away');

  return {
    id: event.id,
    name: event.name,
    shortName: event.shortName,
    date: event.date,
    status: status?.description || status?.shortDetail || 'Scheduled',
    completed: status?.completed,
    broadcasts: parseBroadcasts(comp),
    venue: parseVenue(comp),
    home: home
      ? {
          id: home.team?.id,
          name: home.team?.displayName,
          shortName: home.team?.shortDisplayName,
          logo: home.team?.logo,
          score: toScoreString(home.score),
          winner: home.winner,
        }
      : null,
    away: away
      ? {
          id: away.team?.id,
          name: away.team?.displayName,
          shortName: away.team?.shortDisplayName,
          logo: away.team?.logo,
          score: toScoreString(away.score),
          winner: away.winner,
        }
      : null,
  };
}

function getLastGame(events) {
  const now = new Date();
  const completed = (events || []).filter(e => {
    const comp = e.competitions?.[0];
    const isCompleted = comp?.status?.type?.completed === true;
    const gameDate = e.date ? new Date(e.date) : null;
    return isCompleted && gameDate && gameDate < now;
  });
  return completed.length > 0 ? parseEvent(completed[completed.length - 1]) : null;
}

function getUpcomingGames(events, limit = 5) {
  const now = new Date();
  const upcoming = (events || []).filter(e => {
    const comp = e.competitions?.[0];
    const isCompleted = comp?.status?.type?.completed === true;
    const gameDate = e.date ? new Date(e.date) : null;
    return !isCompleted && gameDate && gameDate >= now;
  });
  return upcoming.slice(0, limit).map(parseEvent);
}

async function getNCAAData(league, teamIds = {}) {
  const leaguePath = league === 'womens' ? 'womens' : 'mens';
  const primaryId = teamIds.primaryTeamId ?? DEFAULT_PRIMARY;
  const secondaryIds = teamIds.secondaryTeamIds ?? DEFAULT_SECONDARY;
  const [s1, s2] = secondaryIds;

  const [primarySchedule, primaryTeamRes, sec1Schedule, sec2Schedule, accScoreboard] = await Promise.all([
    getTeamSchedule(leaguePath, primaryId),
    getTeam(leaguePath, primaryId),
    s1 ? getTeamSchedule(leaguePath, s1) : null,
    s2 ? getTeamSchedule(leaguePath, s2) : null,
    getScoreboard(leaguePath, { groups: ACC_GROUP }),
  ]);

  const primaryTeam = parseTeamFromSchedule(primarySchedule);
  const sec1Team = s1 ? parseTeamFromSchedule(sec1Schedule) : null;
  const sec2Team = s2 ? parseTeamFromSchedule(sec2Schedule) : null;

  const recordExtras = parseTeamRecord(primaryTeamRes);
  if (primaryTeam) {
    Object.assign(primaryTeam, recordExtras);
  }

  const primaryEvents = primarySchedule?.events || [];
  const sec1Events = sec1Schedule?.events || [];
  const sec2Events = sec2Schedule?.events || [];

  const primaryUpcoming = getUpcomingGames(primaryEvents);
  const nextGame = primaryUpcoming[0] || null;

  const accEvents = accScoreboard?.events || [];
  const accGames = accEvents.map(parseEvent).filter(Boolean);

  const allTeams = [primaryTeam, sec1Team, sec2Team].filter(Boolean);
  const standings = allTeams
    .map(t => ({
      team: t.name,
      shortName: t.shortName,
      logo: t.logo,
      record: t.record,
      standing: t.standing,
      rank: t.rank,
    }))
    .sort((a, b) => (a.rank || 99) - (b.rank || 99));

  const secondary = [
    sec1Team
      ? {
          team: sec1Team,
          lastGame: getLastGame(sec1Events),
          upcomingGames: getUpcomingGames(sec1Events, 3),
        }
      : null,
    sec2Team
      ? {
          team: sec2Team,
          lastGame: getLastGame(sec2Events),
          upcomingGames: getUpcomingGames(sec2Events, 3),
        }
      : null,
  ].filter(Boolean);

  return {
    sport: leaguePath,
    primary: {
      team: primaryTeam,
      lastGame: getLastGame(primaryEvents),
      upcomingGames: primaryUpcoming,
      nextGame,
    },
    secondary,
    acc: {
      standings,
      todayGames: accGames,
    },
  };
}

module.exports = {
  getNCAAData,
  getTeamSchedule,
  getTeam,
  getScoreboard,
};
