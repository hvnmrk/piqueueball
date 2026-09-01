const SUPABASE_URL = 'https://dseswtjzpykeixigerzz.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_sdBxKDgEGagJKI5AJ-tOaQ_p2QVKlYu';
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const form = document.getElementById('authForm');
const submitBtn = document.getElementById('submitBtn');
const messageEl = document.getElementById('message');

// --- Web Audio API Sound Synthesizer ---
function playSound(type = 'click') {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);

        if (type === 'click') {
            osc.frequency.setValueAtTime(500, audioCtx.currentTime);
            gain.gain.setValueAtTime(0.04, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.06);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.06);
        } else if (type === 'success') {
            osc.frequency.setValueAtTime(440, audioCtx.currentTime);
            osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.08);
            gain.gain.setValueAtTime(0.06, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.2);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.2);
        } else if (type === 'score') {
            osc.frequency.setValueAtTime(600, audioCtx.currentTime);
            osc.frequency.setValueAtTime(750, audioCtx.currentTime + 0.1);
            gain.gain.setValueAtTime(0.06, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.25);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.25);
        }
    } catch (e) {
        // AudioContext not supported or restricted before user interaction
    }
}

// --- Live Court Match Timer Interval ---
setInterval(() => {
    const timerEls = document.querySelectorAll('.match-timer-display');
    timerEls.forEach(el => {
        const startTime = parseInt(el.getAttribute('data-start'));
        if (startTime) {
            const elapsedSecs = Math.floor((Date.now() - startTime) / 1000);
            const mins = String(Math.floor(elapsedSecs / 60)).padStart(2, '0');
            const secs = String(elapsedSecs % 60).padStart(2, '0');
            el.innerText = `${mins}:${secs}`;
        }
    });
}, 1000);

document.addEventListener('DOMContentLoaded', () => {
    // --- URL Invite Link Handler ---
    const urlParams = new URLSearchParams(window.location.search);
    const joinHostEmail = urlParams.get('join');

    if (joinHostEmail) {
        document.getElementById('authView').style.display = 'none';
        document.getElementById('playerJoinView').style.display = 'block';

        db.from('users').select('club_name, name').eq('email', joinHostEmail).maybeSingle()
            .then(({ data }) => {
                if (data) {
                    document.getElementById('joinClubTitle').innerText = `Join ${data.club_name || data.name + "'s Club"}`;
                }
            });

        document.getElementById('playerJoinForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            playSound('success');
            const name = document.getElementById('joinName').value.trim();
            const email = document.getElementById('joinEmail').value.trim();
            const skill = parseFloat(document.getElementById('joinSkill').value);

            try {
                const { error } = await db.from('players').insert([{
                    id: String(Date.now() + Math.random()),
                    name,
                    email,
                    skill,
                    gender: 'M',
                    host_email: joinHostEmail,
                    games_played: 0,
                    wins: 0,
                    losses: 0
                }]);

                if (error) throw error;

                document.getElementById('playerJoinForm').innerHTML = `
                    <div style="padding: 20px; color: #059669; font-weight: 800; font-size: 1.1rem;">
                        Successfully Joined!<br>
                        <span style="font-size: 0.85rem; color: #64748b; font-weight: normal;">You are now on the active club roster. You can close this page.</span>
                    </div>
                `;
            } catch (err) {
                document.getElementById('joinMessage').innerText = err.message || 'Error joining club.';
                document.getElementById('joinMessage').className = 'error';
            }
        });
        return;
    }

    // --- Normal Host Login Check ---
    const savedHost = localStorage.getItem('piqueueHost');
    const savedEmail = localStorage.getItem('piqueueEmail');
    const savedClub = localStorage.getItem('piqueueClub');
    if (savedHost && savedEmail) {
        state.host.name = savedHost;
        state.host.email = savedEmail;
        state.host.clubName = savedClub || 'Piqueue Ball Club';
        fetchHostStats(savedEmail).then(() => {
            transitionToDashboard(savedHost);
            loadSavedPlayers();
        });
    }
});

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    playSound('success');
    const name = document.getElementById('name').value.trim();
    const clubName = document.getElementById('clubName').value.trim() || 'Piqueue Ball Club';
    const email = document.getElementById('email').value.trim();

    if (!email.toLowerCase().endsWith('@gmail.com')) {
        showMessage('Only @gmail.com addresses are permitted.', 'error');
        return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Verifying...';

    try {
        let { data: existingUser, error: selectError } = await db.from('users').select('*').eq('email', email).maybeSingle();
        if (selectError) throw selectError;

        if (existingUser) {
            localStorage.setItem('piqueueHost', existingUser.name);
            localStorage.setItem('piqueueEmail', existingUser.email);
            localStorage.setItem('piqueueClub', existingUser.club_name || clubName);
            state.host.name = existingUser.name;
            state.host.email = existingUser.email;
            state.host.clubName = existingUser.club_name || clubName;

            transitionToDashboard(existingUser.name);
            loadSavedPlayers();
        } else {
            const { data: newUser, error: insertError } = await db.from('users').insert([{ name, email, club_name: clubName }]).select().single();
            if (insertError) throw insertError;

            localStorage.setItem('piqueueHost', newUser.name);
            localStorage.setItem('piqueueEmail', newUser.email);
            localStorage.setItem('piqueueClub', clubName);
            state.host.name = newUser.name;
            state.host.email = newUser.email;
            state.host.clubName = clubName;

            transitionToDashboard(newUser.name);
            loadSavedPlayers();
        }
    } catch (error) {
        console.error("Auth error:", error);
        showMessage(error.message || 'Database error occurred.', 'error');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Continue to Dashboard';
    }
});

async function fetchHostStats(email) {
    try {
        let { data: user } = await db.from('users').select('*').eq('email', email).maybeSingle();
        if (user && user.club_name) {
            state.host.clubName = user.club_name;
        }
    } catch (err) {
        console.error("Error fetching host stats:", err);
    }
}

function showMessage(text, type) {
    messageEl.textContent = text;
    messageEl.className = type;
}

function transitionToDashboard(hostName) {
    document.getElementById('authView').style.display = 'none';
    document.getElementById('dashboardView').style.display = 'block';
    document.body.classList.remove('auth-mode');
    document.body.classList.add('dashboard-mode');
    document.querySelectorAll('#navClubTitle, .navClubTitle').forEach(el => el.innerText = state.host.clubName);
    updateHeaderStats();
}

function endSession() {
    playSound('click');
    if (confirm("Are you sure you want to log out?")) {
        localStorage.removeItem('piqueueHost');
        localStorage.removeItem('piqueueEmail');
        localStorage.removeItem('piqueueClub');
        state.players = [];
        state.savedPool = [];
        state.activeMatches = {};
        state.upNext = {};
        state.round = 1;
        document.getElementById('setupContainer').style.display = 'block';
        document.getElementById('sessionContainer').style.display = 'none';
        renderPlayers();
        document.getElementById('dashboardView').style.display = 'none';
        document.getElementById('authView').style.display = 'flex';
        document.body.classList.add('auth-mode');
        document.body.classList.remove('dashboard-mode');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Continue to Dashboard';
    }
}

// --- End Active Session, Auto-Save Roster/Stats via Upsert, and Open Results Modal ---
async function endActiveSession() {
    playSound('success');

    for (const p of state.players) {
        try {
            let { error } = await db.from('players').upsert([{
                id: String(p.id),
                name: p.name,
                email: p.email,
                skill: p.skill || 3.5,
                gender: p.gender || 'M',
                host_email: state.host.email,
                games_played: p.gamesPlayed,
                wins: p.wins,
                losses: p.losses
            }], { onConflict: 'id' });

            if (error) throw error;
        } catch (err) {
            console.error("Error auto-saving player stats:", err);
            alert(`Save failed for ${p.name}: ${err.message}`);
            return;
        }
    }

    const content = document.getElementById('summaryContent');
    const sorted = [...state.players].sort((a, b) => b.wins - a.wins);

    let standingsHtml = '';
    sorted.forEach((p, idx) => {
        const wr = p.gamesPlayed > 0 ? Math.round((p.wins / p.gamesPlayed) * 100) : 0;
        standingsHtml += `<tr><td>${idx + 1}. ${p.name}</td><td>${p.gamesPlayed}</td><td>${p.wins}W-${p.losses}L (${wr}%)</td></tr>`;
    });

    content.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 12px;">
            <div style="background: #f8fafc; padding: 12px; border-radius: 10px; border: 1px solid #e2e8f0;">
                <div style="font-size: 0.8rem; color: #64748b; font-weight: 700;">SESSION RESULTS</div>
                <div style="font-size: 1.1rem; font-weight: 800; color: #059669; margin-top: 2px;">Completed ${state.round - 1} Round(s)</div>
                <div style="font-size: 0.8rem; color: #16a34a; margin-top: 4px;">All player records successfully saved to database!</div>
            </div>
            <div style="max-height: 200px; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 8px;">
                <table class="standings-table" style="font-size: 0.85rem;">
                    <thead><tr><th>Player</th><th>Games</th><th>Record</th></tr></thead>
                    <tbody>${standingsHtml || '<tr><td colspan="3">No games played</td></tr>'}</tbody>
                </table>
            </div>
        </div>
    `;

    document.getElementById('summaryModal').style.display = 'flex';
}

function closeSummaryModal() {
    playSound('click');
    document.getElementById('summaryModal').style.display = 'none';

    state.activeMatches = {};
    state.upNext = {};
    state.round = 1;
    state.players = [];
    document.getElementById('sessionContainer').style.display = 'none';
    document.getElementById('setupContainer').style.display = 'block';
    renderPlayers();
    updateHeaderStats();
}

function returnToSetup() {
    playSound('click');
    if (confirm("Return to configuration setup? Active match boards will be reset.")) {
        state.activeMatches = {};
        state.upNext = {};
        state.round = 1;
        document.getElementById('sessionContainer').style.display = 'none';
        document.getElementById('setupContainer').style.display = 'block';
        updateHeaderStats();
    }
}

let state = {
    host: { name: '', email: '', clubName: 'Piqueue Ball Club' },
    courts: 2,
    mode: 'balanced',
    players: [],
    round: 1,
    activeMatches: {},
    upNext: {},
    savedPool: [],
    activeChooseCourt: null,
    chosenTeamA: [null, null],
    chosenTeamB: [null, null]
};

// --- Mobile/Tablet Navigation Sidebar Toggle (Right Side Drawer) ---
function toggleMobileSidebar() {
    playSound('click');
    const activeView = document.querySelector('.view-container:not([style*="display: none"])');
    if (activeView) {
        const sidebar = activeView.querySelector('.mobile-sidebar') || document.getElementById('mobileSidebar');
        const backdrop = activeView.querySelector('.sidebar-backdrop') || document.getElementById('sidebarBackdrop');
        if (sidebar) sidebar.classList.toggle('open');
        if (backdrop) backdrop.classList.toggle('open');
    }
}

// --- View Navigation ---
function showDashboardView() {
    playSound('click');
    document.getElementById('playersView').style.display = 'none';
    document.getElementById('clubSettingsView').style.display = 'none';
    document.getElementById('dashboardView').style.display = 'block';
}

function showPlayersView() {
    playSound('click');
    document.getElementById('dashboardView').style.display = 'none';
    document.getElementById('clubSettingsView').style.display = 'none';
    document.getElementById('playersView').style.display = 'block';
    renderPlayersManagementTable();
}

function showClubSettingsView() {
    playSound('click');
    document.getElementById('dashboardView').style.display = 'none';
    document.getElementById('playersView').style.display = 'none';
    document.getElementById('clubSettingsView').style.display = 'block';

    document.getElementById('settingClubNameInput').value = state.host.clubName;
    document.getElementById('clubCardHeaderTitle').innerText = state.host.clubName;

    const inviteLink = `${window.location.origin}${window.location.pathname}?join=${encodeURIComponent(state.host.email)}`;
    document.getElementById('clubLinkDisplay').innerText = inviteLink;
}

async function saveClubNameSetting() {
    playSound('success');
    const newName = document.getElementById('settingClubNameInput').value.trim() || 'Piqueue Ball Club';
    state.host.clubName = newName;
    localStorage.setItem('piqueueClub', newName);
    document.querySelectorAll('#navClubTitle, .navClubTitle').forEach(el => el.innerText = newName);
    document.getElementById('clubCardHeaderTitle').innerText = newName;

    try {
        let { error } = await db.from('users').update({ club_name: newName }).eq('email', state.host.email);
        if (error) throw error;
        alert("Club settings successfully updated!");
    } catch (err) {
        console.error("Error updating club name in database:", err);
        alert("Club settings updated locally.");
    }
}

function copyClubLink() {
    playSound('success');
    const linkText = document.getElementById('clubLinkDisplay').innerText;
    navigator.clipboard.writeText(linkText);
    alert("Club invitation link copied to clipboard!");
}

function updateCourts(change) {
    playSound('click');
    state.courts = Math.max(1, state.courts + change);
    document.getElementById('courtCount').innerText = state.courts;
    updateHeaderStats();
}

// --- Single Selection Matchmaking Mode Protocol ---
function setMode(mode) {
    playSound('click');
    document.querySelectorAll('.mode-option').forEach(el => el.classList.remove('active'));
    const selectedCard = document.getElementById(`modeCard_${mode}`);
    if (selectedCard) selectedCard.classList.add('active');

    state.mode = mode;
    const modeNames = { 'balanced': 'Balanced', 'social': 'Social Mix', 'winlose': 'Winners / Losers' };
    const label = modeNames[mode] || mode;
    document.getElementById('currentModeLabel').innerText = label;
    document.querySelectorAll('.mobileModeLabel').forEach(el => el.innerText = label);
}

// --- Player Roster & Persistent Storage (Saved to Saved Players Pool) ---
async function addPlayer(nameStr = null, emailStr = null) {
    playSound('success');
    const nameInput = document.getElementById('playerName');
    const emailInput = document.getElementById('playerEmail');
    const name = nameStr || nameInput.value.trim();
    const email = emailStr || emailInput.value.trim() || `${name.toLowerCase().replace(/\s+/g, '')}@gmail.com`;

    if (!name) {
        alert("Please enter a player name.");
        return;
    }

    if (!state.savedPool.find(p => p.email === email)) {
        const newPlayer = { id: String(Date.now() + Math.random()), name, email, skill: 3.5, gender: 'M', gamesPlayed: 0, wins: 0, losses: 0 };
        state.savedPool.push(newPlayer);
        updateSavedPlayersCountLabel();

        try {
            const { error } = await db.from('players').upsert([{
                id: newPlayer.id, name: newPlayer.name, email: newPlayer.email, skill: 3.5, gender: 'M',
                host_email: state.host.email, games_played: 0, wins: 0, losses: 0
            }], { onConflict: 'id' });
            if (error) throw error;
        } catch (err) {
            console.error("Database save error:", err);
            alert("Error saving player: " + err.message);
        }

        nameInput.value = '';
        emailInput.value = '';
        if (!nameStr) nameInput.focus();
    } else {
        alert("A player with this email is already in your Saved Players pool.");
    }
}

async function loadSavedPlayers() {
    try {
        let { data: savedPlayers, error } = await db.from('players').select('*').eq('host_email', state.host.email);
        if (error) throw error;
        if (savedPlayers) {
            state.savedPool = savedPlayers.map(p => ({
                id: p.id, name: p.name, email: p.email, skill: p.skill || 3.5, gender: p.gender || 'M',
                gamesPlayed: p.games_played || 0, wins: p.wins || 0, losses: p.losses || 0
            }));
            updateSavedPlayersCountLabel();
        }
    } catch (err) {
        console.error("Error loading saved players:", err);
    }
}

function updateSavedPlayersCountLabel() {
    const label = document.getElementById('savedPlayersCountLabel');
    if (label) label.innerText = `${state.savedPool.length} saved players`;
}

function toggleSavedPlayersModal() {
    playSound('click');
    const modal = document.getElementById('savedPlayersModal');
    if (modal.style.display === 'flex') {
        modal.style.display = 'none';
    } else {
        renderSavedPlayersModalList();
        modal.style.display = 'flex';
    }
}

function renderSavedPlayersModalList() {
    const container = document.getElementById('savedPlayersModalList');
    container.innerHTML = '';

    if (state.savedPool.length === 0) {
        container.innerHTML = `<p class="text-sm text-muted text-center">No saved players found in history.</p>`;
        return;
    }

    state.savedPool.forEach(sp => {
        const alreadyAdded = state.players.some(p => p.email === sp.email);
        container.innerHTML += `
            <div class="search-item" style="opacity: ${alreadyAdded ? '0.6' : '1'};">
                <div>
                    <strong>${sp.name}</strong>
                    <div style="font-size: 0.75rem; color: #64748b;">${sp.email}</div>
                </div>
                <div style="display: flex; gap: 6px; align-items: center;">
                    ${alreadyAdded ? '<span style="font-size:0.75rem; color:#059669; font-weight:800;">Added</span>' : `<button class="btn-solid" style="padding: 4px 10px; font-size:0.75rem;" onclick="addSavedPlayerToSession('${sp.name}', '${sp.email}')">+ Add</button>`}
                    <button class="chip-remove" style="font-size: 1rem; padding: 2px 6px;" onclick="deleteSavedPlayer('${sp.id}')">&times;</button>
                </div>
            </div>
        `;
    });
}

async function addSavedPlayerToSession(name, email) {
    playSound('click');
    if (!state.players.some(p => p.email === email)) {
        const found = state.savedPool.find(sp => sp.email === email);
        state.players.push(found ? { ...found } : { id: String(Date.now() + Math.random()), name, email, skill: 3.5, gender: 'M', gamesPlayed: 0, wins: 0, losses: 0 });
        renderPlayers();
        renderSavedPlayersModalList();
    }
}

async function deleteSavedPlayer(id) {
    playSound('click');
    if (confirm("Are you sure you want to delete this player permanently from your saved pool?")) {
        try {
            const { error } = await db.from('players').delete().eq('id', id);
            if (error) throw error;

            state.savedPool = state.savedPool.filter(p => p.id !== id);
            state.players = state.players.filter(p => p.id !== id);
            updateSavedPlayersCountLabel();
            renderPlayers();
            renderSavedPlayersModalList();
        } catch (err) {
            console.error("Error deleting player:", err);
            alert("Could not delete player: " + err.message);
        }
    }
}

async function removePlayer(id) {
    playSound('click');
    state.players = state.players.filter(p => p.id !== id);
    renderPlayers();
    renderPlayersManagementTable();
}

function renderPlayers() {
    const list = document.getElementById('playerList');
    const empty = document.getElementById('emptyState');
    const count = document.getElementById('playerCountLabel');
    if (!list) return;
    list.innerHTML = '';

    if (state.players.length === 0) {
        empty.style.display = 'block';
        count.innerText = '0';
        updateHeaderStats();
        return;
    }

    empty.style.display = 'none';
    count.innerText = state.players.length;

    state.players.forEach(p => {
        list.innerHTML += `
            <div class="chip">
                <div class="chip-content">
                    <span class="chip-name">${p.name}</span>
                    <span class="chip-email">${p.email}</span>
                </div>
                <button class="chip-remove" onclick="removePlayer('${p.id}')">Remove</button>
            </div>
        `;
    });
    updateHeaderStats();
}

function renderPlayersManagementTable() {
    const tbody = document.getElementById('playersManagementTableBody');
    const countEl = document.getElementById('playersCountDisplay');
    const query = document.getElementById('rosterSearchInput').value.toLowerCase();
    if (!tbody) return;

    tbody.innerHTML = '';
    const filtered = state.players.filter(p => p.name.toLowerCase().includes(query));
    countEl.innerText = `${filtered.length} players`;

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted" style="padding: 20px;">No players found</td></tr>`;
        return;
    }

    filtered.forEach(p => {
        const wr = p.gamesPlayed > 0 ? Math.round((p.wins / p.gamesPlayed) * 100) : 0;
        const skillText = p.skill ? `Beginner (~${p.skill} DUPR)` : 'Set skill';
        const isM = p.gender === 'M';

        tbody.innerHTML += `
            <tr>
                <td><strong>${p.name}</strong></td>
                <td>
                    <span style="color: #cbd5e1; cursor: pointer;">★☆☆☆☆☆</span> 
                    <span style="color: #64748b; font-size: 0.8rem; margin-left: 6px;">${skillText}</span>
                </td>
                <td style="color: #94a3b8;">-</td>
                <td>
                    <div class="gender-toggle-group">
                        <button class="gender-btn ${isM ? 'active-m' : ''}" onclick="setPlayerGender('${p.id}', 'M')">M</button>
                        <button class="gender-btn ${!isM ? 'active-f' : ''}" onclick="setPlayerGender('${p.id}', 'F')">F</button>
                    </div>
                </td>
                <td>
                    <div style="font-size: 0.85rem; font-weight: 700;">${p.wins}W-${p.losses}L</div>
                    <div style="font-size: 0.75rem; color: #64748b;">${p.gamesPlayed} games</div>
                    <div style="font-size: 0.75rem; color: #16a34a; font-weight: 700;">WR ${wr}%</div>
                </td>
                <td>
                    <button class="btn-outline" style="padding: 4px 12px; font-size: 0.75rem;" onclick="editPlayerPrompt('${p.id}')">Edit</button>
                </td>
            </tr>
        `;
    });
}

function setPlayerGender(id, gender) {
    playSound('click');
    const p = state.players.find(item => item.id === id);
    if (!p) return;
    p.gender = gender;
    renderPlayersManagementTable();
}

function editPlayerPrompt(id) {
    playSound('click');
    const p = state.players.find(item => item.id === id);
    if (!p) return;
    const newName = prompt("Edit player name:", p.name);
    if (newName && newName.trim()) {
        p.name = newName.trim();
        renderPlayers();
        renderPlayersManagementTable();
    }
}

function startSession() {
    playSound('success');
    const playersNeeded = state.courts * 4;
    if (state.players.length < playersNeeded) {
        alert(`You need at least ${playersNeeded} players to fill your ${state.courts} court(s).`);
        return;
    }

    state.players.forEach(p => {
        p.gamesPlayed = 0;
        p.wins = 0;
        p.losses = 0;
    });

    document.getElementById('setupContainer').style.display = 'none';
    document.getElementById('sessionContainer').style.display = 'block';
    state.activeMatches = {};
    state.upNext = {};
    refreshBoard();
}

function getSortedPool() {
    let pool = [...state.players];
    if (state.mode === 'winlose') {
        pool.sort((a, b) => b.wins !== a.wins ? b.wins - a.wins : a.gamesPlayed - b.gamesPlayed);
    } else if (state.mode === 'social') {
        pool.sort(() => Math.random() - 0.5);
        pool.sort((a, b) => a.gamesPlayed - b.gamesPlayed);
    } else {
        pool.sort((a, b) => a.gamesPlayed !== b.gamesPlayed ? a.gamesPlayed - b.gamesPlayed : b.wins - a.wins);
    }
    return pool;
}

function updateHeaderStats() {
    let activeCourtsCount = Object.keys(state.activeMatches).length;
    document.getElementById('activeCourtsStat').innerText = activeCourtsCount;
    document.getElementById('totalCourtsStat').innerText = state.courts;
    document.getElementById('totalPlayersStat').innerText = state.players.length;

    let busyPlayerIds = new Set();
    Object.values(state.activeMatches).forEach(match => {
        match.teamA.forEach(p => busyPlayerIds.add(p.id));
        match.teamB.forEach(p => busyPlayerIds.add(p.id));
    });
    Object.values(state.upNext).forEach(match => {
        match.teamA.forEach(p => busyPlayerIds.add(p.id));
        match.teamB.forEach(p => busyPlayerIds.add(p.id));
    });

    let pool = getSortedPool();
    let waitingPool = pool.filter(p => !busyPlayerIds.has(p.id));
    document.getElementById('queueCountStat').innerText = waitingPool.length;
}

function refreshBoard() {
    document.getElementById('roundLabel').innerText = state.round;
    let pool = getSortedPool();

    let busyPlayerIds = new Set();
    Object.values(state.activeMatches).forEach(match => {
        match.teamA.forEach(p => busyPlayerIds.add(p.id));
        match.teamB.forEach(p => busyPlayerIds.add(p.id));
    });
    Object.values(state.upNext).forEach(match => {
        match.teamA.forEach(p => busyPlayerIds.add(p.id));
        match.teamB.forEach(p => busyPlayerIds.add(p.id));
    });

    const waitingPool = pool.filter(p => !busyPlayerIds.has(p.id));
    updateHeaderStats();

    // 1. Render Queue Panel
    const queueList = document.getElementById('queueList');
    document.getElementById('queueCount').innerText = waitingPool.length;
    queueList.innerHTML = '';

    if (waitingPool.length === 0) {
        queueList.innerHTML = `<div style="text-align: center; color: #94a3b8; padding: 20px; font-size: 0.85rem;">No players in queue</div>`;
    } else {
        waitingPool.forEach((p, index) => {
            const winRate = p.gamesPlayed > 0 ? Math.round((p.wins / p.gamesPlayed) * 100) : 0;
            queueList.innerHTML += `
                <div class="queue-item-gw">
                    <span class="queue-number-gw">${index + 1}</span>
                    <div class="queue-info-gw">
                        <span class="queue-name-gw">${p.name}</span>
                        <span class="queue-stats-gw">Games: ${p.gamesPlayed} | W: ${p.wins} (${winRate}%) | L: ${p.losses}</span>
                    </div>
                </div>
            `;
        });
    }

    // 2. Render Live Courts
    const grid = document.getElementById('courtsGrid');
    grid.innerHTML = '';

    for (let i = 1; i <= state.courts; i++) {
        const match = state.activeMatches[i];
        const upNextMatch = state.upNext[i];

        if (match) {
            grid.innerHTML += `
                <div class="match-card" id="court_${i}">
                    <div class="court-top-bar">
                        <span>Court ${i}</span>
                        <span class="match-timer-display" data-start="${match.startTime}">00:00</span>
                        <span class="live-badge">LIVE</span>
                    </div>
                    <div class="court-body-ref">
                        <div class="team-container-ref">
                            <span class="team-label-blue">Team 1</span>
                            <div class="player-line">${match.teamA[0].name}</div>
                            <div class="player-line" style="margin-top:4px;">${match.teamA[1].name}</div>
                        </div>
                        <div style="font-weight: 800; color: #cbd5e1; font-size: 0.8rem; text-align:center;">VS</div>
                        <div class="team-container-ref">
                            <span class="team-label-orange">Team 2</span>
                            <div class="player-line">${match.teamB[0].name}</div>
                            <div class="player-line" style="margin-top:4px;">${match.teamB[1].name}</div>
                        </div>
                    </div>
                    <div class="court-actions-split">
                        <button class="btn-win-team1" onclick="recordScore(${i}, 'A')">Team 1 Win</button>
                        <button class="btn-win-team2" onclick="recordScore(${i}, 'B')">Team 2 Win</button>
                    </div>
                </div>
            `;
        } else {
            let previewText = upNextMatch ? `${upNextMatch.teamA[0].name} / ${upNextMatch.teamA[1].name} vs ${upNextMatch.teamB[0].name} / ${upNextMatch.teamB[1].name}` : 'No match queued';
            grid.innerHTML += `
                <div class="${upNextMatch ? 'court-box-ref' : 'court-box-empty'}">
                    <div class="court-header-row">
                        <span>Court ${i}</span>
                        ${upNextMatch ? '<span class="badge-ready">READY</span>' : ''}
                    </div>
                    <div class="match-vs-preview">${previewText}</div>
                    <button class="btn-court-green" onclick="${upNextMatch ? `sendToCourt(${i})` : `queueNext(${i}); sendToCourt(${i});`}">${upNextMatch ? 'Start Match' : 'Start Next Match'}</button>
                    <button class="btn-court-light" onclick="openChooseModal(${i})">Choose Players</button>
                </div>
            `;
        }
    }

    // 3. Render Up Next Cards
    const upNextContainer = document.getElementById('upNextContainer');
    upNextContainer.innerHTML = '';
    for (let i = 1; i <= state.courts; i++) {
        const nextMatch = state.upNext[i];
        if (nextMatch) {
            upNextContainer.innerHTML += `
                <div class="up-next-card-ref">
                    <div class="up-next-top-bar">
                        <span>Up Next ${i}</span>
                        <span style="display: flex; gap: 6px;"><span class="badge bg-green" style="font-size:0.65rem;">Auto</span></span>
                    </div>
                    <div class="up-next-split-grid">
                        <div class="team-box-side">
                            <div class="team-header-bar-blue" style="margin: -12px -12px 10px -12px;">TEAM 1</div>
                            <div class="player-line">${nextMatch.teamA[0].name}</div>
                            <div class="player-email-small">${nextMatch.teamA[0].email}</div>
                            <div class="player-line" style="margin-top:6px;">${nextMatch.teamA[1].name}</div>
                            <div class="player-email-small">${nextMatch.teamA[1].email}</div>
                        </div>
                        <div class="team-box-side">
                            <div class="team-header-bar-orange" style="margin: -12px -12px 10px -12px;">TEAM 2</div>
                            <div class="player-line">${nextMatch.teamB[0].name}</div>
                            <div class="player-email-small">${nextMatch.teamB[0].email}</div>
                            <div class="player-line" style="margin-top:6px;">${nextMatch.teamB[1].name}</div>
                            <div class="player-email-small">${nextMatch.teamB[1].email}</div>
                        </div>
                    </div>
                    <div class="up-next-footer-action">
                        <button class="btn-solid w-100" style="padding: 0.5rem; font-size: 0.85rem;" onclick="sendToCourt(${i})">Send to Court</button>
                        <button class="btn-outline" style="padding: 0.5rem; font-size: 0.85rem; border-color:#cbd5e1; color:#475569;">Call Players</button>
                    </div>
                </div>
            `;
        } else {
            upNextContainer.innerHTML += `
                <div class="up-next-card-ref" style="padding: 16px; opacity: 0.7;">
                    <div class="court-header-row" style="margin-bottom:8px;">
                        <span>Up Next ${i}</span>
                        <button class="btn-outline" style="padding: 4px 10px; font-size:0.75rem;" onclick="queueNext(${i})">+ Queue Match</button>
                    </div>
                    <p class="text-sm text-muted text-center" style="margin: 15px 0;">No match queued yet.</p>
                </div>
            `;
        }
    }

    renderStandings();
}

function queueNext(courtNum) {
    playSound('click');
    let busyPlayerIds = new Set();
    Object.values(state.activeMatches).forEach(match => {
        match.teamA.forEach(p => busyPlayerIds.add(p.id));
        match.teamB.forEach(p => busyPlayerIds.add(p.id));
    });
    Object.values(state.upNext).forEach(match => {
        match.teamA.forEach(p => busyPlayerIds.add(p.id));
        match.teamB.forEach(p => busyPlayerIds.add(p.id));
    });

    let waitingPool = getSortedPool().filter(p => !busyPlayerIds.has(p.id));

    if (waitingPool.length < 4) {
        alert("Not enough waiting players in the queue to form a match.");
        return;
    }

    state.upNext[courtNum] = {
        teamA: [waitingPool[0], waitingPool[1]],
        teamB: [waitingPool[2], waitingPool[3]]
    };

    refreshBoard();
}

function sendToCourt(courtNum) {
    playSound('click');
    if (!state.upNext[courtNum]) {
        queueNext(courtNum);
        if (!state.upNext[courtNum]) return;
    }

    state.activeMatches[courtNum] = {
        ...state.upNext[courtNum],
        startTime: Date.now()
    };
    delete state.upNext[courtNum];

    state.activeMatches[courtNum].teamA.forEach(p => state.players.find(sp => sp.id === p.id).gamesPlayed += 1);
    state.activeMatches[courtNum].teamB.forEach(p => state.players.find(sp => sp.id === p.id).gamesPlayed += 1);

    refreshBoard();
}

function recordScore(courtNum, winningTeam) {
    playSound('score');
    const match = state.activeMatches[courtNum];
    if (!match) return;

    const winners = winningTeam === 'A' ? match.teamA : match.teamB;
    const losers = winningTeam === 'A' ? match.teamB : match.teamA;

    winners.forEach(w => {
        const playerRef = state.players.find(p => p.id === w.id);
        if (playerRef) playerRef.wins += 1;
    });
    losers.forEach(l => {
        const playerRef = state.players.find(p => p.id === l.id);
        if (playerRef) playerRef.losses += 1;
    });

    delete state.activeMatches[courtNum];
    state.round++;

    renderStandings();
    refreshBoard();
}

function renderStandings() {
    const tbody = document.getElementById('standingsBody');
    tbody.innerHTML = '';
    const sorted = [...state.players].sort((a, b) => b.wins !== a.wins ? b.wins - a.wins : a.gamesPlayed - b.gamesPlayed);

    sorted.forEach(p => {
        const winRate = p.gamesPlayed > 0 ? Math.round((p.wins / p.gamesPlayed) * 100) : 0;
        tbody.innerHTML += `<tr><td>${p.name}</td><td>${p.gamesPlayed}</td><td class="text-green">${p.wins} (${winRate}%)</td><td>${p.losses}</td></tr>`;
    });
}

// --- Choose Players Modal Functions ---
function openChooseModal(courtNum) {
    playSound('click');
    state.activeChooseCourt = courtNum;
    state.chosenTeamA = [null, null];
    state.chosenTeamB = [null, null];
    document.getElementById('modalCourtTitle').innerText = `Court ${courtNum} Setup`;
    renderChooseSlots();
    renderModalSearchList();
    document.getElementById('choosePlayersModal').style.display = 'flex';
}

function closeChooseModal() {
    playSound('click');
    document.getElementById('choosePlayersModal').style.display = 'none';
}

function renderChooseSlots() {
    for (let i = 0; i < 2; i++) {
        const slotA = document.getElementById(`slot_a_${i}`);
        const pA = state.chosenTeamA[i];
        if (pA) {
            slotA.innerText = pA.name;
            slotA.className = 'player-slot filled';
        } else {
            slotA.innerText = 'Empty Slot';
            slotA.className = 'player-slot empty';
        }

        const slotB = document.getElementById(`slot_b_${i}`);
        const pB = state.chosenTeamB[i];
        if (pB) {
            slotB.innerText = pB.name;
            slotB.className = 'player-slot filled';
        } else {
            slotB.innerText = 'Empty Slot';
            slotB.className = 'player-slot empty';
        }
    }
}

function renderModalSearchList() {
    const list = document.getElementById('modalSearchList');
    const query = document.getElementById('modalSearchInput').value.toLowerCase();
    list.innerHTML = '';

    let chosenIds = new Set();
    state.chosenTeamA.forEach(p => { if (p) chosenIds.add(p.id); });
    state.chosenTeamB.forEach(p => { if (p) chosenIds.add(p.id); });

    let filtered = state.players.filter(p => !chosenIds.has(p.id) && p.name.toLowerCase().includes(query));

    if (filtered.length === 0) {
        list.innerHTML = `<div style="text-align: center; color: #64748b; padding: 10px; font-size: 0.8rem;">No available players found</div>`;
        return;
    }

    filtered.forEach(p => {
        const winRate = p.gamesPlayed > 0 ? Math.round((p.wins / p.gamesPlayed) * 100) : 0;
        list.innerHTML += `
            <div class="search-item" onclick="assignPlayerToNextOpenSlot('${p.id}')">
                <span><strong>${p.name}</strong></span>
                <span style="color: #64748b; font-size: 0.75rem;">Games: ${p.gamesPlayed} | W: ${p.wins} (${winRate}%)</span>
            </div>
        `;
    });
}

function assignPlayerToNextOpenSlot(playerId) {
    playSound('click');
    const player = state.players.find(p => p.id == playerId);
    if (!player) return;

    if (!state.chosenTeamA[0]) state.chosenTeamA[0] = player;
    else if (!state.chosenTeamA[1]) state.chosenTeamA[1] = player;
    else if (!state.chosenTeamB[0]) state.chosenTeamB[0] = player;
    else if (!state.chosenTeamB[1]) state.chosenTeamB[1] = player;

    renderChooseSlots();
    renderModalSearchList();
}

function removeSlotPlayer(team, index) {
    playSound('click');
    if (team === 'A') state.chosenTeamA[index] = null;
    if (team === 'B') state.chosenTeamB[index] = null;
    renderChooseSlots();
    renderModalSearchList();
}

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    playSound('success');
    const name = document.getElementById('name').value.trim();
    const clubName = document.getElementById('clubName').value.trim() || 'Piqueue Ball Club';
    const email = document.getElementById('email').value.trim();

    if (!email.toLowerCase().endsWith('@gmail.com')) {
        showMessage('Only @gmail.com addresses are permitted.', 'error');
        return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Verifying...';

    try {
        let { data: existingUser, error: selectError } = await db.from('users').select('*').eq('email', email).maybeSingle();
        if (selectError) throw selectError;

        if (existingUser) {
            localStorage.setItem('piqueueHost', existingUser.name);
            localStorage.setItem('piqueueEmail', existingUser.email);
            localStorage.setItem('piqueueClub', existingUser.club_name || clubName);
            state.host.name = existingUser.name;
            state.host.email = existingUser.email;
            state.host.clubName = existingUser.club_name || clubName;

            transitionToDashboard(existingUser.name);
            loadSavedPlayers();
        } else {
            const { data: newUser, error: insertError } = await db.from('users').insert([{ name, email, club_name: clubName }]).select().single();
            if (insertError) throw insertError;

            localStorage.setItem('piqueueHost', newUser.name);
            localStorage.setItem('piqueueEmail', newUser.email);
            localStorage.setItem('piqueueClub', clubName);
            state.host.name = newUser.name;
            state.host.email = newUser.email;
            state.host.clubName = clubName;

            transitionToDashboard(newUser.name);
            loadSavedPlayers();
        }
    } catch (error) {
        console.error("Auth error:", error);
        showMessage(error.message || 'Database error occurred.', 'error');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Continue to Dashboard';
    }
});

function confirmChooseModal() {
    playSound('success');
    if (!state.chosenTeamA[0] || !state.chosenTeamA[1] || !state.chosenTeamB[0] || !state.chosenTeamB[1]) {
        alert("Please fill all 4 player slots before starting the match.");
        return;
    }

    const courtNum = state.activeChooseCourt;
    state.activeMatches[courtNum] = {
        teamA: [...state.chosenTeamA],
        teamB: [...state.chosenTeamB],
        startTime: Date.now()
    };

    state.chosenTeamA.forEach(p => state.players.find(sp => sp.id === p.id).gamesPlayed += 1);
    state.chosenTeamB.forEach(p => state.players.find(sp => sp.id === p.id).gamesPlayed += 1);

    closeChooseModal();
    refreshBoard();
}

function openSummaryModal() {
    playSound('click');
    const content = document.getElementById('summaryContent');
    const totalPlayers = state.players.length;
    const sorted = [...state.players].sort((a, b) => b.wins - a.wins);

    content.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 12px;">
            <div style="background: #f8fafc; padding: 12px; border-radius: 10px; border: 1px solid #e2e8f0;">
                <div style="font-size: 0.8rem; color: #64748b; font-weight: 700;">SESSION PROGRESS</div>
                <div style="font-size: 1.1rem; font-weight: 800; color: #0f172a; margin-top: 2px;">Completed ${state.round - 1} Round(s)</div>
            </div>
            <div style="background: #f8fafc; padding: 12px; border-radius: 10px; border: 1px solid #e2e8f0;">
                <div style="font-size: 0.85rem; color: #64748b; font-weight: 700;">SAVED PLAYERS POOL</div>
                <div style="font-size: 1.0rem; font-weight: 800; color: #059669; margin-top: 2px;">${state.savedPool ? state.savedPool.length : 0} Saved in DB</div>
            </div>
            <div style="background: #f8fafc; padding: 12px; border-radius: 10px; border: 1px solid #e2e8f0;">
                <div style="font-size: 0.8rem; color: #64748b; font-weight: 700;">TOTAL PARTICIPANTS</div>
                <div style="font-size: 1.1rem; font-weight: 800; color: #0f172a; margin-top: 2px;">${totalPlayers} Players Active</div>
            </div>
        </div>
    `;
    document.getElementById('summaryModal').style.display = 'flex';
}