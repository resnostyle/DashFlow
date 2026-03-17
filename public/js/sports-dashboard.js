// Sports dashboard - primary team + secondary teams + ACC
let sportsPageRotationInterval = null;
let newsRotationInterval = null;

function clearSportsPageRotation() {
    if (sportsPageRotationInterval) {
        clearInterval(sportsPageRotationInterval);
        sportsPageRotationInterval = null;
    }
    if (newsRotationInterval) {
        clearInterval(newsRotationInterval);
        newsRotationInterval = null;
    }
}

function formatGameDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
}

function formatNextGameDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
    }) + ' · ' + d.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
    });
}

function buildNewsCardHtml(item) {
    const safeImage = typeof safeUrl === 'function' ? safeUrl(item.image) : null;
    const hasImage = !!safeImage;
    const mediaHtml = hasImage
        ? `<div class="sports-news-card-media"><img src="${escapeHtml(safeImage)}" alt="" class="sports-news-card-img" loading="lazy" /></div>`
        : '';
    const snippet = item.contentSnippet
        ? `<div class="sports-news-card-snippet">${escapeHtml(item.contentSnippet.slice(0, 280))}${item.contentSnippet.length > 280 ? '…' : ''}</div>`
        : '';
    return `<div class="sports-news-card ${hasImage ? 'sports-news-card-has-img' : ''}">
        ${mediaHtml}
        <div class="sports-news-card-body">
            <div class="sports-news-card-title">${escapeHtml(item.title || '')}</div>
            ${snippet}
        </div>
    </div>`;
}

function renderNewsSlider(newsItems) {
    if (!newsItems?.length) return '';
    const items = newsItems.slice(0, 8);
    const firstCard = buildNewsCardHtml(items[0]);
    const secondCard = items.length > 1 ? buildNewsCardHtml(items[1]) : '';
    const multiClass = items.length > 1 ? ' sports-news-slider-multi' : '';
    return `<div class="sports-news-slider${multiClass}">
        <div class="sports-news-slider-view sports-news-slider-left">${firstCard}</div>
        <div class="sports-news-slider-view sports-news-slider-right">${secondCard}</div>
    </div>`;
}

function setupNewsRotation(container, newsItems) {
    if (!newsItems?.length) return;
    const slider = container?.querySelector('.sports-news-slider');
    if (!slider) return;
    const viewLeft = slider.querySelector('.sports-news-slider-left');
    const viewRight = slider.querySelector('.sports-news-slider-right');
    if (!viewLeft) return;
    if (newsRotationInterval) {
        clearInterval(newsRotationInterval);
        newsRotationInterval = null;
    }
    const WIDE_BREAKPOINT = 1100;
    const isWide = () => window.matchMedia(`(min-width: ${WIDE_BREAKPOINT}px)`).matches;
    let index = 0;
    const update = (advance) => {
        if (isWide() && newsItems.length > 1) {
            viewLeft.innerHTML = buildNewsCardHtml(newsItems[index]);
            viewRight.innerHTML = buildNewsCardHtml(newsItems[(index + 1) % newsItems.length]);
            if (advance) index = (index + 2) % newsItems.length;
        } else {
            viewLeft.innerHTML = buildNewsCardHtml(newsItems[index]);
            if (advance) index = (index + 1) % newsItems.length;
        }
    };
    const rotate = () => update(true);
    update(false);
    newsRotationInterval = setInterval(rotate, 8000);
}

function renderTeamCard(team, lastGame, upcomingGames) {
    if (!team) return '';
    const rankStr = team.rank && team.rank < 99 ? `#${team.rank}` : '';
    const ourCompetitor = lastGame
        ? [lastGame.home, lastGame.away].find(c => c && String(c.id) === String(team.id))
        : null;
    const won = ourCompetitor?.winner;
    const awayLogoSafe = lastGame?.away?.logo && (typeof safeUrl === 'function' ? safeUrl(lastGame.away.logo) : null);
    const homeLogoSafe = lastGame?.home?.logo && (typeof safeUrl === 'function' ? safeUrl(lastGame.home.logo) : null);
    const lastGameHtml = lastGame
        ? `<div class="sports-last-game">
            ${won !== undefined ? `<span class="sports-result ${won ? 'sports-win' : 'sports-loss'}">${won ? 'W' : 'L'}</span>` : ''}
            <span class="sports-game-matchup">
                ${awayLogoSafe ? `<img src="${escapeHtml(awayLogoSafe)}" alt="" class="sports-schedule-logo" />` : ''}
                ${escapeHtml(lastGame.away?.shortName || '')} ${escapeHtml(String(lastGame.away?.score ?? ''))}
            </span>
            <span class="sports-game-at">@</span>
            <span class="sports-game-matchup">
                ${homeLogoSafe ? `<img src="${escapeHtml(homeLogoSafe)}" alt="" class="sports-schedule-logo" />` : ''}
                ${escapeHtml(lastGame.home?.shortName || '')} ${escapeHtml(String(lastGame.home?.score ?? ''))}
            </span>
           </div>`
        : '';
    const upcomingHtml = upcomingGames?.length > 0
        ? `<div class="sports-upcoming">
            ${upcomingGames.slice(0, 2).map(g => {
                const gAwayLogo = g.away?.logo && (typeof safeUrl === 'function' ? safeUrl(g.away.logo) : null);
                const gHomeLogo = g.home?.logo && (typeof safeUrl === 'function' ? safeUrl(g.home.logo) : null);
                return `<div class="sports-upcoming-game">
                    <span class="sports-upcoming-date">${escapeHtml(formatGameDate(g.date))}</span>
                    <span class="sports-game-matchup">
                        ${gAwayLogo ? `<img src="${escapeHtml(gAwayLogo)}" alt="" class="sports-schedule-logo" />` : ''}
                        ${escapeHtml(g.away?.shortName || 'TBD')}
                    </span>
                    <span class="sports-game-at">@</span>
                    <span class="sports-game-matchup">
                        ${gHomeLogo ? `<img src="${escapeHtml(gHomeLogo)}" alt="" class="sports-schedule-logo" />` : ''}
                        ${escapeHtml(g.home?.shortName || 'TBD')}
                    </span>
                </div>`;
            }).join('')}
           </div>`
        : '';
    const teamLogoSafe = team.logo && (typeof safeUrl === 'function' ? safeUrl(team.logo) : null);
    const teamColorHex = team.color && typeof normalizeTeamColor === 'function' ? normalizeTeamColor(team.color) : null;
    const cardLight = teamColorHex && typeof lightenHex === 'function' ? lightenHex(teamColorHex, 0.5) : null;
    const cardStyle = teamColorHex
        ? ` style="--sports-team-card-color: ${escapeHtml(teamColorHex)}${cardLight ? '; --sports-team-card-light: ' + escapeHtml(cardLight) : ''}"`
        : '';
    return `
        <div class="sports-team-card"${cardStyle}>
            <div class="sports-team-header">
                ${teamLogoSafe ? `<img src="${escapeHtml(teamLogoSafe)}" alt="${escapeHtml(team.name || '')}" class="sports-team-logo" />` : ''}
                <div class="sports-team-info">
                    <span class="sports-team-name">${escapeHtml(team.name || '')}</span>
                    ${rankStr ? `<span class="sports-team-rank">${escapeHtml(rankStr)}</span>` : ''}
                </div>
            </div>
            <div class="sports-team-record">${escapeHtml(team.record || '-')}</div>
            <div class="sports-team-standing">${escapeHtml(team.standing || '')}</div>
            ${lastGameHtml}
            ${upcomingHtml}
        </div>
    `;
}

function renderPlayerStatsSection(playerStats) {
    if (!playerStats?.randomPlayer && !playerStats?.mvp) return '';
    const card = (p, label) => {
        if (!p) return '';
        const headshot = p.headshot && (typeof safeUrl === 'function' ? safeUrl(p.headshot) : null);
        return `
            <div class="sports-player-card">
                <div class="sports-player-card-label">${escapeHtml(label)}</div>
                <div class="sports-player-card-content">
                    ${headshot ? `<img src="${escapeHtml(headshot)}" alt="" class="sports-player-card-headshot" />` : ''}
                    <div class="sports-player-card-info">
                        <div class="sports-player-card-name">${escapeHtml(p.name || '')}</div>
                        ${p.position ? `<span class="sports-player-card-pos">${escapeHtml(p.position)}</span>` : ''}
                        ${p.lastGameVs ? `<span class="sports-player-card-game">vs ${escapeHtml(p.lastGameVs)}</span>` : ''}
                        <div class="sports-player-card-stats">
                            <span>${escapeHtml(String(p.pts ?? '-'))} PTS</span>
                            <span>${escapeHtml(String(p.reb ?? '-'))} REB</span>
                            <span>${escapeHtml(String(p.ast ?? '-'))} AST</span>
                        </div>
                    </div>
                </div>
            </div>`;
    };
    return `
        <div class="sports-player-stats-section">
            ${card(playerStats.randomPlayer, 'Player Spotlight')}
            ${card(playerStats.mvp, 'MVP')}
        </div>`;
}

function renderPrimaryPage(primary, newsItems = [], espnNews = [], playerStats = null) {
    const team = primary?.team;
    const lastGame = primary?.lastGame;
    const upcomingGames = primary?.upcomingGames || [];
    const nextGame = primary?.nextGame;

    const rankStr = team?.rank && team.rank < 99 ? `#${team.rank}` : '';
    const ourCompetitor = lastGame
        ? [lastGame.home, lastGame.away].find(c => c && String(c.id) === String(team?.id))
        : null;
    const won = ourCompetitor?.winner;

    const statsParts = [];
    if (team?.record) statsParts.push({ label: 'Record', value: team.record });
    if (team?.streak) statsParts.push({ label: 'Streak', value: team.streak });
    if (team?.standing) statsParts.push({ label: 'ACC', value: team.standing });
    if (team?.ppg != null) statsParts.push({ label: 'PPG', value: String(team.ppg) });
    if (team?.recordHome) statsParts.push({ label: 'Home', value: team.recordHome });
    if (team?.recordAway) statsParts.push({ label: 'Away', value: team.recordAway });

    const primaryAwayLogoSafe = lastGame?.away?.logo && (typeof safeUrl === 'function' ? safeUrl(lastGame.away.logo) : null);
    const primaryHomeLogoSafe = lastGame?.home?.logo && (typeof safeUrl === 'function' ? safeUrl(lastGame.home.logo) : null);
    const lastGameHtml = lastGame
        ? `<div class="sports-primary-last">
            <span class="sports-primary-last-label">Last:</span>
            ${won !== undefined ? `<span class="sports-result ${won ? 'sports-win' : 'sports-loss'}">${won ? 'W' : 'L'}</span>` : ''}
            <span class="sports-game-matchup">
                ${primaryAwayLogoSafe ? `<img src="${escapeHtml(primaryAwayLogoSafe)}" alt="" class="sports-schedule-logo" />` : ''}
                ${escapeHtml(lastGame.away?.shortName || '')} ${escapeHtml(String(lastGame.away?.score ?? ''))}
            </span>
            <span class="sports-game-at">@</span>
            <span class="sports-game-matchup">
                ${primaryHomeLogoSafe ? `<img src="${escapeHtml(primaryHomeLogoSafe)}" alt="" class="sports-schedule-logo" />` : ''}
                ${escapeHtml(lastGame.home?.shortName || '')} ${escapeHtml(String(lastGame.home?.score ?? ''))}
            </span>
        </div>`
        : '';

    const moreUpcoming = upcomingGames.slice(1, 4);
    const upcomingHtml = moreUpcoming.length
        ? `<div class="sports-primary-upcoming">
            ${moreUpcoming.map(g => {
                const gAwayLogo = g.away?.logo && (typeof safeUrl === 'function' ? safeUrl(g.away.logo) : null);
                const gHomeLogo = g.home?.logo && (typeof safeUrl === 'function' ? safeUrl(g.home.logo) : null);
                return `<div class="sports-primary-upcoming-game">
                    <span class="sports-upcoming-date">${escapeHtml(formatGameDate(g.date))}</span>
                    <span class="sports-game-matchup">
                        ${gAwayLogo ? `<img src="${escapeHtml(gAwayLogo)}" alt="" class="sports-schedule-logo" />` : ''}
                        ${escapeHtml(g.away?.shortName || 'TBD')}
                    </span>
                    <span class="sports-game-at">@</span>
                    <span class="sports-game-matchup">
                        ${gHomeLogo ? `<img src="${escapeHtml(gHomeLogo)}" alt="" class="sports-schedule-logo" />` : ''}
                        ${escapeHtml(g.home?.shortName || 'TBD')}
                    </span>
                </div>`;
            }).join('')}
        </div>`
        : '';

    const mergedNews = (espnNews?.length ? espnNews : newsItems) || [];
    const newsHtml = mergedNews.length ? renderNewsSlider(mergedNews) : '';
    const playerStatsHtml = renderPlayerStatsSection(playerStats);

    const primaryTeamLogoSafe = team?.logo && (typeof safeUrl === 'function' ? safeUrl(team.logo) : null);
    const nextAwayLogoSafe = nextGame?.away?.logo && (typeof safeUrl === 'function' ? safeUrl(nextGame.away.logo) : null);
    const nextHomeLogoSafe = nextGame?.home?.logo && (typeof safeUrl === 'function' ? safeUrl(nextGame.home.logo) : null);
    const nextLabel = nextGame?.isLive ? 'Live' : 'Next Game';
    const seasonBadge = nextGame?.seasonType === 'Postseason'
        ? '<span class="sports-season-badge">Postseason</span>'
        : '';
    const nextDateOrStatus = nextGame?.isLive
        ? (nextGame.statusShortDetail || nextGame.displayClock || nextGame.status || '')
        : formatNextGameDate(nextGame?.date);
    const nextScores = nextGame?.isLive && (nextGame.away?.score != null || nextGame.home?.score != null)
        ? `${escapeHtml(String(nextGame.away?.score ?? '-'))} - ${escapeHtml(String(nextGame.home?.score ?? '-'))}`
        : null;
    const nextMatchupHtml = nextScores
        ? `${nextAwayLogoSafe ? `<img src="${escapeHtml(nextAwayLogoSafe)}" alt="" class="sports-primary-next-logo" />` : ''}<span>${escapeHtml(nextGame.away?.shortName || 'TBD')}</span><span class="sports-primary-next-scores">${nextScores}</span><span class="sports-game-at">@</span>${nextHomeLogoSafe ? `<img src="${escapeHtml(nextHomeLogoSafe)}" alt="" class="sports-primary-next-logo" />` : ''}<span>${escapeHtml(nextGame.home?.shortName || 'TBD')}</span>`
        : `${nextAwayLogoSafe ? `<img src="${escapeHtml(nextAwayLogoSafe)}" alt="" class="sports-primary-next-logo" />` : ''}<span>${escapeHtml(nextGame.away?.shortName || 'TBD')}</span><span class="sports-game-at">@</span>${nextHomeLogoSafe ? `<img src="${escapeHtml(nextHomeLogoSafe)}" alt="" class="sports-primary-next-logo" />` : ''}<span>${escapeHtml(nextGame.home?.shortName || 'TBD')}</span>`;
    return `
        <div class="sports-primary-grid">
            <div class="sports-primary-hero">
                ${primaryTeamLogoSafe ? `<img src="${escapeHtml(primaryTeamLogoSafe)}" alt="${escapeHtml(team?.name || '')}" class="sports-primary-logo" />` : ''}
                <div class="sports-primary-hero-info">
                    <h1 class="sports-primary-name">${escapeHtml(team?.name || 'Team')}</h1>
                    ${rankStr ? `<span class="sports-primary-rank">${escapeHtml(rankStr)}</span>` : ''}
                </div>
                <div class="sports-primary-record">${escapeHtml(team?.record || '-')}</div>
            </div>
            <div class="sports-primary-next${nextGame?.isLive ? ' sports-primary-next-live' : ''}">
                ${nextGame ? `
                <div class="sports-primary-next-label">${nextGame.isLive ? '<span class="sports-live-badge">LIVE</span> ' : ''}${escapeHtml(nextLabel)}${seasonBadge ? ' ' + seasonBadge : ''}</div>
                <div class="sports-primary-next-date">${escapeHtml(nextDateOrStatus)}</div>
                <div class="sports-primary-next-matchup">${nextMatchupHtml}</div>
                ${nextGame.venue?.display ? `<div class="sports-primary-next-venue">${escapeHtml(nextGame.venue.display)}</div>` : ''}
                ${nextGame.broadcasts?.length ? `<div class="sports-primary-next-broadcast">${escapeHtml(nextGame.broadcasts.map(b => `${b.type}: ${b.name}`).join(' · '))}</div>` : ''}
                ${nextGame.gameUrl ? `<a href="${escapeHtml(nextGame.gameUrl)}" target="_blank" rel="noopener" class="sports-primary-next-link">View on ESPN</a>` : ''}
                ` : '<div class="sports-primary-next-empty">No upcoming games</div>'}
            </div>
            <div class="sports-primary-stats">
                ${statsParts.length ? statsParts.map((s, i) => `<span class="sports-primary-stat"><span class="sports-primary-stat-label">${escapeHtml(s.label)}</span>${escapeHtml(s.value)}</span>${i < statsParts.length - 1 ? '<span class="sports-primary-stat-sep" aria-hidden="true">·</span>' : ''}`).join('') : ''}
            </div>
            <div class="sports-primary-recent">
                ${lastGameHtml}
                ${upcomingHtml}
            </div>
            ${newsHtml}
            ${playerStatsHtml}
        </div>
    `;
}

function renderACCGames(games) {
    if (!games?.length) return '<p class="sports-empty">No ACC games today</p>';
    return games.map(g => {
        const scoreOrStatus = g.completed
            ? `${g.away?.score || '-'} - ${g.home?.score || '-'}`
            : (g.statusShortDetail || g.status || 'Scheduled');
        const awayLogoSafe = g.away?.logo && (typeof safeUrl === 'function' ? safeUrl(g.away.logo) : null);
        const homeLogoSafe = g.home?.logo && (typeof safeUrl === 'function' ? safeUrl(g.home.logo) : null);
        return `
        <div class="sports-acc-game">
            <span class="sports-acc-away">
                ${awayLogoSafe ? `<img src="${escapeHtml(awayLogoSafe)}" alt="" class="sports-acc-game-logo" />` : ''}
                ${escapeHtml(g.away?.shortName || 'TBD')}
            </span>
            <span class="sports-acc-score">${escapeHtml(scoreOrStatus)}</span>
            <span class="sports-acc-home">
                ${homeLogoSafe ? `<img src="${escapeHtml(homeLogoSafe)}" alt="" class="sports-acc-game-logo" />` : ''}
                ${escapeHtml(g.home?.shortName || 'TBD')}
            </span>
        </div>
    `;
    }).join('');
}

function renderACCStandings(standings, primaryTeamId, secondaryTeamIds = []) {
    if (!standings?.length) return '<p class="sports-empty">Standings loading...</p>';
    const highlightIds = new Set([primaryTeamId, ...(secondaryTeamIds || [])].filter(Boolean).map(String));
    return `
        <div class="sports-standings">
            ${standings.map((s, i) => {
                const sLogoSafe = s.logo && (typeof safeUrl === 'function' ? safeUrl(s.logo) : null);
                const isPrimary = s.id && highlightIds.has(String(s.id));
                const rowClass = isPrimary ? ' sports-standings-row-highlight' : '';
                return `
                <div class="sports-standings-row${rowClass}">
                    <span class="sports-standings-rank">${i + 1}</span>
                    ${sLogoSafe ? `<img src="${escapeHtml(sLogoSafe)}" alt="" class="sports-standings-logo" />` : ''}
                    <span class="sports-standings-team">${escapeHtml(s.shortName || s.team || '')}</span>
                    <span class="sports-standings-record">${escapeHtml(s.record || '-')}</span>
                </div>
            `;
            }).join('')}
        </div>
    `;
}

function rotateSportsPage() {
    const dashboard = document.querySelector('.sports-dashboard');
    if (!dashboard) return;
    const primaryPage = dashboard.querySelector('.sports-page-primary');
    const secondaryPage = dashboard.querySelector('.sports-page-secondary');
    if (!primaryPage || !secondaryPage) return;
    const primaryActive = primaryPage.classList.contains('sports-page-active');
    primaryPage.classList.toggle('sports-page-active', !primaryActive);
    secondaryPage.classList.toggle('sports-page-active', primaryActive);
}

function applyTeamTheme(dashboardEl, primaryColor) {
    if (!dashboardEl || !primaryColor) return;
    const hex = typeof normalizeTeamColor === 'function' ? normalizeTeamColor(primaryColor) : null;
    if (!hex) return;
    const dark = typeof darkenHex === 'function' ? darkenHex(hex, 0.15) : '#0a1628';
    const light = typeof lightenHex === 'function' ? lightenHex(hex, 0.5) : '#4a9eff';
    dashboardEl.style.setProperty('--sports-team-primary', hex);
    dashboardEl.style.setProperty('--sports-team-primary-dark', dark);
    dashboardEl.style.setProperty('--sports-team-primary-light', light);
}

function renderSportsDashboard(data, sportLabel, newsItems = [], rotationIntervalMs = 30000, espnNews = null) {
    const container = document.getElementById('contentArea');
    if (!container) return;

    clearSportsPageRotation();
    container.classList.add('sports-active');

    const sportTitle = sportLabel === 'womens' ? "NCAA Women's Basketball" : "NCAA Men's Basketball";
    const intervalMs = Math.max(5000, rotationIntervalMs || 30000);

    const primary = data.primary;
    const secondary = data.secondary || [];

    const primaryPageHtml = `
        <div class="sports-page sports-page-primary sports-page-active">
            <h1 class="sports-title">${sportTitle}</h1>
            <div class="sports-page-primary-content">
                ${renderPrimaryPage(primary, newsItems, espnNews ?? data?.news, data?.playerStats)}
            </div>
        </div>
    `;

    const secondaryCards = secondary.map(s => renderTeamCard(s?.team, s?.lastGame, s?.upcomingGames)).join('');
    const secondaryPageHtml = `
        <div class="sports-page sports-page-secondary">
            <h1 class="sports-title">${sportTitle} — Conference</h1>
            <div class="sports-page-acc-content">
                <div class="sports-acc-teams">
                    ${secondaryCards}
                </div>
                <div class="sports-acc-row">
                    <div class="sports-acc-section">
                        <h2 class="sports-section-title">ACC Standings</h2>
                        ${renderACCStandings(data.acc?.standings, primary?.team?.id, secondary?.map(s => s?.team?.id).filter(Boolean))}
                    </div>
                    <div class="sports-acc-section">
                        <h2 class="sports-section-title">ACC Today</h2>
                        ${renderACCGames(data.acc?.todayGames)}
                    </div>
                </div>
            </div>
        </div>
    `;

    container.innerHTML = `
        <div class="sports-dashboard">
            ${primaryPageHtml}
            ${secondaryPageHtml}
        </div>
    `;

    const dashboardEl = container.querySelector('.sports-dashboard');
    const primaryColor = primary?.team?.color;
    if (dashboardEl && primaryColor && typeof applyTeamTheme === 'function') {
        applyTeamTheme(dashboardEl, primaryColor);
    }

    const mergedNews = (espnNews ?? data?.news)?.length ? (espnNews ?? data?.news) : newsItems;
    if (mergedNews?.length) {
        setupNewsRotation(container, mergedNews);
    }

    sportsPageRotationInterval = setInterval(rotateSportsPage, intervalMs);
}

function renderSportsLoading(sportLabel) {
    const container = document.getElementById('contentArea');
    if (!container) return;

    container.classList.add('sports-active');
    const sportTitle = sportLabel === 'womens' ? "NCAA Women's Basketball" : "NCAA Men's Basketball";

    container.innerHTML = `
        <div class="sports-dashboard">
            <h1 class="sports-title">${sportTitle}</h1>
            <div class="sports-loading">Loading sports data...</div>
        </div>
    `;
}
