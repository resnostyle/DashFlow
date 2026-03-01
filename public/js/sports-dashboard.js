// Sports dashboard - primary team + secondary teams + ACC
let sportsPageRotationInterval = null;

function clearSportsPageRotation() {
    if (sportsPageRotationInterval) {
        clearInterval(sportsPageRotationInterval);
        sportsPageRotationInterval = null;
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

function renderNewsSlider(newsItems) {
    if (!newsItems?.length) return '';
    const items = newsItems.slice(0, 8).map(item => {
        const safeImage = typeof safeUrl === 'function' ? safeUrl(item.image) : '';
        const hasImage = !!safeImage;
        const mediaHtml = hasImage
            ? `<div class="sports-news-card-media"><img src="${escapeHtml(safeImage)}" alt="" class="sports-news-card-img" loading="lazy" /></div>`
            : '';
        const snippet = item.contentSnippet
            ? `<div class="sports-news-card-snippet">${escapeHtml(item.contentSnippet.slice(0, 120))}${item.contentSnippet.length > 120 ? '…' : ''}</div>`
            : '';
        return `<div class="sports-news-card ${hasImage ? 'sports-news-card-has-img' : ''}">
            ${mediaHtml}
            <div class="sports-news-card-body">
                <div class="sports-news-card-title">${escapeHtml(item.title || '')}</div>
                ${snippet}
            </div>
        </div>`;
    }).join('');
    const trackContent = items + items;
    return `<div class="sports-news-slider">
        <div class="sports-news-slider-track">${trackContent}</div>
    </div>`;
}

function renderTeamCard(team, lastGame, upcomingGames) {
    if (!team) return '';
    const rankStr = team.rank && team.rank < 99 ? `#${team.rank}` : '';
    const ourCompetitor = lastGame
        ? [lastGame.home, lastGame.away].find(c => c && String(c.id) === String(team.id))
        : null;
    const won = ourCompetitor?.winner;
    const awayLogoSafe = lastGame?.away?.logo && (typeof safeUrl === 'function' ? safeUrl(lastGame.away.logo) : lastGame.away.logo);
    const homeLogoSafe = lastGame?.home?.logo && (typeof safeUrl === 'function' ? safeUrl(lastGame.home.logo) : lastGame.home.logo);
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
                const gAwayLogo = g.away?.logo && (typeof safeUrl === 'function' ? safeUrl(g.away.logo) : g.away.logo);
                const gHomeLogo = g.home?.logo && (typeof safeUrl === 'function' ? safeUrl(g.home.logo) : g.home.logo);
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
    const teamLogoSafe = team.logo && (typeof safeUrl === 'function' ? safeUrl(team.logo) : team.logo);
    return `
        <div class="sports-team-card">
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

function renderPrimaryPage(primary, newsItems = []) {
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
    if (team?.recordHome) statsParts.push({ label: 'Home', value: team.recordHome });
    if (team?.recordAway) statsParts.push({ label: 'Away', value: team.recordAway });

    const primaryAwayLogoSafe = lastGame?.away?.logo && (typeof safeUrl === 'function' ? safeUrl(lastGame.away.logo) : lastGame.away.logo);
    const primaryHomeLogoSafe = lastGame?.home?.logo && (typeof safeUrl === 'function' ? safeUrl(lastGame.home.logo) : lastGame.home.logo);
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
                const gAwayLogo = g.away?.logo && (typeof safeUrl === 'function' ? safeUrl(g.away.logo) : g.away.logo);
                const gHomeLogo = g.home?.logo && (typeof safeUrl === 'function' ? safeUrl(g.home.logo) : g.home.logo);
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

    const newsHtml = newsItems?.length ? renderNewsSlider(newsItems) : '';

    const primaryTeamLogoSafe = team?.logo && (typeof safeUrl === 'function' ? safeUrl(team.logo) : team.logo);
    const nextAwayLogoSafe = nextGame?.away?.logo && (typeof safeUrl === 'function' ? safeUrl(nextGame.away.logo) : nextGame.away.logo);
    const nextHomeLogoSafe = nextGame?.home?.logo && (typeof safeUrl === 'function' ? safeUrl(nextGame.home.logo) : nextGame.home.logo);
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
            <div class="sports-primary-next">
                ${nextGame ? `
                <div class="sports-primary-next-label">Next Game</div>
                <div class="sports-primary-next-date">${escapeHtml(formatNextGameDate(nextGame.date))}</div>
                <div class="sports-primary-next-matchup">
                    ${nextAwayLogoSafe ? `<img src="${escapeHtml(nextAwayLogoSafe)}" alt="" class="sports-primary-next-logo" />` : ''}
                    <span>${escapeHtml(nextGame.away?.shortName || 'TBD')}</span>
                    <span class="sports-game-at">@</span>
                    ${nextHomeLogoSafe ? `<img src="${escapeHtml(nextHomeLogoSafe)}" alt="" class="sports-primary-next-logo" />` : ''}
                    <span>${escapeHtml(nextGame.home?.shortName || 'TBD')}</span>
                </div>
                ${nextGame.venue?.display ? `<div class="sports-primary-next-venue">${escapeHtml(nextGame.venue.display)}</div>` : ''}
                ${nextGame.broadcasts?.length ? `<div class="sports-primary-next-broadcast">${escapeHtml(nextGame.broadcasts.map(b => `${b.type}: ${b.name}`).join(' · '))}</div>` : ''}
                ` : '<div class="sports-primary-next-empty">No upcoming games</div>'}
            </div>
            <div class="sports-primary-stats">
                ${statsParts.length ? statsParts.map(s => `<span class="sports-primary-stat"><span class="sports-primary-stat-label">${escapeHtml(s.label)}</span> ${escapeHtml(s.value)}</span>`).join('') : ''}
            </div>
            <div class="sports-primary-recent">
                ${lastGameHtml}
                ${upcomingHtml}
            </div>
            ${newsHtml}
        </div>
    `;
}

function renderACCGames(games) {
    if (!games?.length) return '<p class="sports-empty">No ACC games today</p>';
    return games.map(g => `
        <div class="sports-acc-game">
            <span class="sports-acc-away">${escapeHtml(g.away?.shortName || 'TBD')}</span>
            <span class="sports-acc-score">${escapeHtml(g.completed ? `${g.away?.score || '-'} - ${g.home?.score || '-'}` : (g.status || ''))}</span>
            <span class="sports-acc-home">${escapeHtml(g.home?.shortName || 'TBD')}</span>
        </div>
    `).join('');
}

function renderACCStandings(standings) {
    if (!standings?.length) return '<p class="sports-empty">Standings loading...</p>';
    return `
        <div class="sports-standings">
            ${standings.map((s, i) => {
                const sLogoSafe = s.logo && (typeof safeUrl === 'function' ? safeUrl(s.logo) : s.logo);
                return `
                <div class="sports-standings-row">
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

function renderSportsDashboard(data, sportLabel, newsItems = [], rotationIntervalMs = 30000) {
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
                ${renderPrimaryPage(primary, newsItems)}
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
                        ${renderACCStandings(data.acc?.standings)}
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
