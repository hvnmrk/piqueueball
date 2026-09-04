const SUPABASE_URL = 'https://dseswtjzpykeixigerzz.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_sdBxKDgEGagJKI5AJ-tOaQ_p2QVKlYu';
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Global Application State
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
    chosenTeamB: [null, null],
    paymentQr: '',
    isActiveSession: false,
    realtimeChannel: null
};

const loginForm = document.getElementById('loginForm');
const signupForm = document.getElementById('signupForm');
const loginSubmitBtn = document.getElementById('loginSubmitBtn');
const signupSubmitBtn = document.getElementById('signupSubmitBtn');
const loginMessageEl = document.getElementById('loginMessage');
const signupMessageEl = document.getElementById('signupMessage');
const tabLoginBtn = document.getElementById('tabLoginBtn');
const tabSignupBtn = document.getElementById('tabSignupBtn');

// --- Native Tab Switcher Listeners ---
if (tabLoginBtn && tabSignupBtn) {
    tabLoginBtn.addEventListener('click', () => switchAuthTab('login'));
    tabSignupBtn.addEventListener('click', () => switchAuthTab('signup'));
}

function switchAuthTab(tab) {
    playSound('click');
    if (!loginForm || !signupForm) return;

    if (tab === 'login') {
        loginForm.style.display = 'block';
        signupForm.style.display = 'none';
        tabLoginBtn.style.background = 'var(--primary)';
        tabLoginBtn.style.color = 'white';
        tabSignupBtn.style.background = 'transparent';
        tabSignupBtn.style.color = 'var(--text-muted)';
    } else {
        loginForm.style.display = 'none';
        signupForm.style.display = 'block';
        tabSignupBtn.style.background = 'var(--primary)';
        tabSignupBtn.style.color = 'white';
        tabLoginBtn.style.background = 'transparent';
        tabLoginBtn.style.color = 'var(--text-muted)';
    }
}

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
    const urlParams = new URLSearchParams(window.location.search);
    const liveHostEmail = urlParams.get('live');
    const joinHostEmail = urlParams.get('join');

    // 1. Shareable Live Game Spectator Route (?live=<host_email>)
    if (liveHostEmail) {
        loadSpectatorView(liveHostEmail);
        return;
    }

    // 2. Member / Player Join Invite Route (?join=<host_email>)
    if (joinHostEmail) {
        loadInvitePageView(joinHostEmail);

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
                    <div style="padding: 20px; color: #059669; font-weight: 800; font-size: 1.1rem; text-align: center;">
                        Successfully Joined!<br>
                        <span style="font-size: 0.85rem; color: #64748b; font-weight: normal;">You are now on the active club roster.</span>
                    </div>
                `;

                // Refresh invite player list
                loadInvitePageView(joinHostEmail);

                // Broadcast player join event
                broadcastSessionUpdate({
                    event: 'player_joined',
                    host_email: joinHostEmail,
                    player: { name, email, skill }
                });
            } catch (err) {
                document.getElementById('joinMessage').innerText = err.message || 'Error joining club.';
                document.getElementById('joinMessage').className = 'error';
            }
        });
        return;
    }

    // 3. Normal Host Dashboard Entry
    const savedHost = localStorage.getItem('piqueueHost');
    const savedEmail = localStorage.getItem('piqueueEmail');
    const savedClub = localStorage.getItem('piqueueClub');
    if (savedHost && savedEmail) {
        state.host.name = savedHost;
        state.host.email = savedEmail;
        state.host.clubName = savedClub || 'Piqueue Ball Club';
        state.paymentQr = localStorage.getItem('piqueue_payment_qr_' + savedEmail) || '';

        fetchHostStats(savedEmail).then(() => {
            transitionToDashboard(savedHost);
            loadSavedPlayers();
            initRealtimeChannel(savedEmail);
            restoreActiveSessionIfAny(savedEmail);
            renderPaymentQrDisplays();
        });
    }
});

// --- Login Form Handler ---
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    playSound('success');
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value.trim();

    if (!email.toLowerCase().endsWith('@gmail.com')) {
        loginMessageEl.textContent = 'Only @gmail.com addresses are permitted.';
        loginMessageEl.className = 'error';
        return;
    }

    loginSubmitBtn.disabled = true;
    loginSubmitBtn.textContent = 'Verifying...';

    try {
        let { data: existingUser, error: selectError } = await db.from('users').select('*').eq('email', email).maybeSingle();
        if (selectError) throw selectError;

        if (existingUser) {
            if (!existingUser.password) {
                await db.from('users').update({ password: password }).eq('email', email);
            } else if (existingUser.password !== password) {
                loginMessageEl.textContent = 'Incorrect password. Please try again.';
                loginMessageEl.className = 'error';
                loginSubmitBtn.disabled = false;
                loginSubmitBtn.textContent = 'Log In';
                return;
            }

            localStorage.setItem('piqueueHost', existingUser.name);
            localStorage.setItem('piqueueEmail', existingUser.email);
            localStorage.setItem('piqueueClub', existingUser.club_name || 'Piqueue Ball Club');
            state.host.name = existingUser.name;
            state.host.email = existingUser.email;
            state.host.clubName = existingUser.club_name || 'Piqueue Ball Club';
            state.paymentQr = localStorage.getItem('piqueue_payment_qr_' + existingUser.email) || '';

            transitionToDashboard(existingUser.name);
            loadSavedPlayers();
            initRealtimeChannel(existingUser.email);
            restoreActiveSessionIfAny(existingUser.email);
            renderPaymentQrDisplays();
        } else {
            loginMessageEl.textContent = 'Account not found. Click "Sign Up" tab to create one.';
            loginMessageEl.className = 'error';
            loginSubmitBtn.disabled = false;
            loginSubmitBtn.textContent = 'Log In';
        }
    } catch (error) {
        console.error("Login error:", error);
        loginMessageEl.textContent = error.message || 'Database error occurred.';
        loginMessageEl.className = 'error';
        loginSubmitBtn.disabled = false;
        loginSubmitBtn.textContent = 'Log In';
    }
});

// --- Sign Up Form Handler ---
signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    playSound('success');
    const name = document.getElementById('signupName').value.trim();
    const clubName = document.getElementById('signupClubName').value.trim() || 'Piqueue Ball Club';
    const email = document.getElementById('signupEmail').value.trim();
    const password = document.getElementById('signupPassword').value.trim();

    if (!email.toLowerCase().endsWith('@gmail.com')) {
        signupMessageEl.textContent = 'Only @gmail.com addresses are permitted.';
        signupMessageEl.className = 'error';
        return;
    }

    signupSubmitBtn.disabled = true;
    signupSubmitBtn.textContent = 'Creating Account...';

    try {
        let { data: existingUser } = await db.from('users').select('*').eq('email', email).maybeSingle();

        if (existingUser) {
            signupMessageEl.textContent = 'Account already exists. Please switch to Log In.';
            signupMessageEl.className = 'error';
            signupSubmitBtn.disabled = false;
            signupSubmitBtn.textContent = 'Create Account';
            return;
        }

        const { data: newUser, error: insertError } = await db.from('users').insert([{
            name: name,
            email: email,
            club_name: clubName,
            password: password
        }]).select().single();

        if (insertError) throw insertError;

        localStorage.setItem('piqueueHost', newUser.name);
        localStorage.setItem('piqueueEmail', newUser.email);
        localStorage.setItem('piqueueClub', clubName);
        state.host.name = newUser.name;
        state.host.email = newUser.email;
        state.host.clubName = clubName;
        state.paymentQr = '';

        transitionToDashboard(newUser.name);
        loadSavedPlayers();
        initRealtimeChannel(newUser.email);
    } catch (error) {
        console.error("Signup error:", error);
        signupMessageEl.textContent = error.message || 'Database error occurred.';
        signupMessageEl.className = 'error';
        signupSubmitBtn.disabled = false;
        signupSubmitBtn.textContent = 'Create Account';
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
    const confirmMsg = state.isActiveSession
        ? "You currently have an active open play session in progress. Are you sure you want to log out?"
        : "Are you sure you want to log out of your host account?";
    if (!confirm(confirmMsg)) {
        return;
    }
    localStorage.removeItem('piqueueHost');
    localStorage.removeItem('piqueueEmail');
    localStorage.removeItem('piqueueClub');
    if (state.host.email) {
        localStorage.removeItem('piqueue_active_session_' + state.host.email);
    }
    if (state.realtimeChannel) {
        try { db.removeChannel(state.realtimeChannel); } catch (e) {}
        state.realtimeChannel = null;
    }
    state.players = [];
    state.savedPool = [];
    state.activeMatches = {};
    state.upNext = {};
    state.round = 1;
    state.isActiveSession = false;
    document.getElementById('setupContainer').style.display = 'block';
    document.getElementById('sessionContainer').style.display = 'none';
    renderPlayers();
    document.getElementById('dashboardView').style.display = 'none';
    document.getElementById('authView').style.display = 'flex';
    document.body.classList.add('auth-mode');
    document.body.classList.remove('dashboard-mode');
    loginSubmitBtn.disabled = false;
    loginSubmitBtn.textContent = 'Log In';
    signupSubmitBtn.disabled = false;
    signupSubmitBtn.textContent = 'Create Account';
}

async function endActiveSession() {
    playSound('click');
    if (!confirm("Are you sure you want to end the current session? This will finalize all rounds, save player match statistics to Supabase, and archive the session results.")) {
        return;
    }
    playSound('success');
    state.isActiveSession = false;

    // Clear active session locally and mark inactive in Supabase
    if (state.host.email) {
        localStorage.removeItem('piqueue_active_session_' + state.host.email);
        broadcastSessionUpdate({
            host_email: state.host.email,
            is_active: false,
            ended: true
        });
        try {
            await db.from('active_sessions').update({ is_active: false }).eq('host_email', state.host.email);
        } catch (e) {}
    }

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
    const sorted = [...state.players].sort((a, b) => b.wins !== a.wins ? b.wins - a.wins : a.gamesPlayed - b.gamesPlayed);

    // Save completed session to persistent history archive
    const finishedSession = {
        id: 'sess_' + Date.now(),
        host_email: state.host.email,
        date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        timestamp: Date.now(),
        mode: state.mode,
        rounds: Math.max(0, state.round - 1),
        courts: state.courts,
        totalPlayers: state.players.length,
        standings: sorted.map((p, idx) => ({
            rank: idx + 1,
            name: p.name,
            email: p.email,
            gamesPlayed: p.gamesPlayed,
            wins: p.wins,
            losses: p.losses,
            winRate: p.gamesPlayed > 0 ? Math.round((p.wins / p.gamesPlayed) * 100) : 0
        }))
    };
    saveSessionToHistory(finishedSession);

    let standingsHtml = '';
    sorted.forEach((p, idx) => {
        const wr = p.gamesPlayed > 0 ? Math.round((p.wins / p.gamesPlayed) * 100) : 0;
        standingsHtml += `<tr><td>${idx + 1}. ${p.name}</td><td>${p.gamesPlayed}</td><td>${p.wins}W-${p.losses}L (${wr}%)</td></tr>`;
    });

    content.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 12px;">
            <div style="background: #f8fafc; padding: 14px; border-radius: 10px; border: 1px solid #e2e8f0;">
                <div style="font-size: 0.75rem; color: #64748b; font-weight: 700; letter-spacing: 0.5px;">SESSION COMPLETED</div>
                <div style="font-size: 1.15rem; font-weight: 800; color: #059669; margin-top: 2px;">Finished ${Math.max(0, state.round - 1)} Round(s)</div>
                <div style="margin-top: 8px; padding-top: 8px; border-top: 1px dashed #cbd5e1; font-size: 0.8rem; color: #334155;">
                    <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
                        <span style="color: #16a34a; font-weight: bold;">✔ Saved to Supabase:</span>
                        <span>All player career stats (W/L/Games) updated</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <span style="color: #0284c7; font-weight: bold;">✔ Saved to History:</span>
                        <span>Archived in your Session History log</span>
                    </div>
                </div>
            </div>
            <div style="max-height: 220px; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 8px;">
                <table class="standings-table" style="font-size: 0.85rem;">
                    <thead><tr><th>Player</th><th>Games</th><th>Record</th></tr></thead>
                    <tbody>${standingsHtml || '<tr><td colspan="3">No games played</td></tr>'}</tbody>
                </table>
            </div>
            <div style="display: flex; gap: 8px; margin-top: 4px;">
                <button class="btn-outline w-100" style="padding: 8px; font-size: 0.8rem;" onclick="openSessionHistoryModal()">📜 View Past Session History</button>
            </div>
        </div>
    `;
    document.getElementById('summaryModal').style.display = 'flex';
}

function getSessionHistory() {
    if (!state.host || !state.host.email) return [];
    try {
        const key = 'piqueue_history_' + state.host.email;
        return JSON.parse(localStorage.getItem(key) || '[]');
    } catch (e) {
        return [];
    }
}

function saveSessionToHistory(sessionData) {
    if (!state.host || !state.host.email) return;
    try {
        const key = 'piqueue_history_' + state.host.email;
        let history = getSessionHistory();
        history.unshift(sessionData);
        if (history.length > 50) history = history.slice(0, 50);
        localStorage.setItem(key, JSON.stringify(history));
    } catch (e) {
        console.warn("Could not save to session history:", e);
    }
}

function openSessionHistoryModal() {
    playSound('click');
    const modal = document.getElementById('sessionHistoryModal');
    if (!modal) return;
    renderSessionHistoryList();
    modal.style.display = 'flex';
}

function closeSessionHistoryModal() {
    playSound('click');
    const modal = document.getElementById('sessionHistoryModal');
    if (modal) modal.style.display = 'none';
}

function renderSessionHistoryList() {
    const list = document.getElementById('sessionHistoryList');
    if (!list) return;
    const history = getSessionHistory();
    if (history.length === 0) {
        list.innerHTML = `
            <div style="text-align: center; color: #94a3b8; padding: 30px 10px;">
                <p style="margin: 0; font-size: 0.95rem; font-weight: 600;">No past sessions recorded yet</p>
                <p style="margin: 6px 0 0 0; font-size: 0.8rem;">Finished sessions will be archived here automatically.</p>
            </div>
        `;
        return;
    }

    list.innerHTML = history.map(sess => {
        const modeLabel = { 'balanced': 'Balanced', 'social': 'Social Mix', 'winlose': 'Winners / Losers' }[sess.mode] || sess.mode;
        const top3 = (sess.standings || []).slice(0, 3).map(p => `${p.name} (${p.wins}W-${p.losses}L)`).join(', ');
        return `
            <div class="card mb-3" style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 14px; border-radius: 10px;">
                <div class="flex-between mb-2">
                    <div>
                        <strong style="font-size: 0.95rem; color: #0f172a;">Session on ${sess.date}</strong>
                        <span style="font-size: 0.75rem; color: #64748b; margin-left: 6px;">${sess.time || ''}</span>
                    </div>
                    <span class="badge bg-green" style="font-size: 0.7rem;">${sess.rounds} Rounds</span>
                </div>
                <div style="font-size: 0.8rem; color: #475569; margin-bottom: 8px;">
                    <span>Mode: <strong>${modeLabel}</strong></span> &bull; 
                    <span>Courts: <strong>${sess.courts}</strong></span> &bull; 
                    <span>Players: <strong>${sess.totalPlayers}</strong></span>
                </div>
                ${top3 ? `<div style="font-size: 0.78rem; color: #059669; font-weight: 600; margin-bottom: 8px;">Top: ${top3}</div>` : ''}
                <details style="font-size: 0.8rem;">
                    <summary style="cursor: pointer; color: #0284c7; font-weight: 600;">View Full Standings</summary>
                    <table class="standings-table mt-2" style="font-size: 0.78rem;">
                        <thead><tr><th>#</th><th>Player</th><th>Games</th><th>Record</th><th>Win Rate</th></tr></thead>
                        <tbody>
                            ${(sess.standings || []).map(p => `
                                <tr>
                                    <td>${p.rank}</td>
                                    <td><strong>${p.name}</strong></td>
                                    <td>${p.gamesPlayed}</td>
                                    <td>${p.wins}W-${p.losses}L</td>
                                    <td>${p.winRate}%</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </details>
            </div>
        `;
    }).join('');
}

function clearSessionHistory() {
    playSound('click');
    if (confirm("Are you sure you want to clear your local session history? This will not erase career player stats in Supabase.")) {
        if (state.host && state.host.email) {
            localStorage.removeItem('piqueue_history_' + state.host.email);
            renderSessionHistoryList();
        }
    }
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
        state.isActiveSession = false;
        if (state.host.email) {
            localStorage.removeItem('piqueue_active_session_' + state.host.email);
            broadcastSessionUpdate({ host_email: state.host.email, is_active: false });
            try { db.from('active_sessions').update({ is_active: false }).eq('host_email', state.host.email); } catch (e) {}
        }
        document.getElementById('sessionContainer').style.display = 'none';
        document.getElementById('setupContainer').style.display = 'block';
        updateHeaderStats();
    }
}

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

    const spectatorLink = `${window.location.origin}${window.location.pathname}?live=${encodeURIComponent(state.host.email)}`;
    const spectatorDisplay = document.getElementById('spectatorLinkDisplay');
    if (spectatorDisplay) spectatorDisplay.innerText = spectatorLink;

    renderPaymentQrDisplays();
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

async function addPlayer(nameStr = null, emailStr = null) {
    const nameInput = document.getElementById('playerName');
    const emailInput = document.getElementById('playerEmail');
    const name = (nameStr || (nameInput ? nameInput.value : '')).trim();
    const email = (emailStr || (emailInput ? emailInput.value : '')).trim();

    if (!name) {
        alert("Please enter a player name.");
        if (nameInput) nameInput.focus();
        return;
    }

    if (!email) {
        alert("Please enter an email address for the player.");
        if (emailInput) emailInput.focus();
        return;
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
        alert("Please enter a valid email address (e.g. name@gmail.com).");
        if (emailInput) emailInput.focus();
        return;
    }

    playSound('success');
    let savedPlayer = state.savedPool.find(p => p.email.toLowerCase() === email.toLowerCase());
    if (!savedPlayer) {
        savedPlayer = { id: String(Date.now() + Math.random()), name, email, skill: 3.5, gender: 'M', gamesPlayed: 0, wins: 0, losses: 0 };
        state.savedPool.push(savedPlayer);
        updateSavedPlayersCountLabel();

        try {
            await db.from('players').upsert([{
                id: savedPlayer.id, name: savedPlayer.name, email: savedPlayer.email, skill: 3.5, gender: 'M',
                host_email: state.host.email, games_played: 0, wins: 0, losses: 0
            }], { onConflict: 'id' });
        } catch (err) {
            console.error("Database save error:", err);
            alert("Error saving player: " + err.message);
        }
    }

    if (!state.players.some(p => p.email.toLowerCase() === email.toLowerCase())) {
        state.players.push({ ...savedPlayer });
        renderPlayers();
    } else {
        alert("This player is already in your active session roster.");
    }

    if (nameInput) nameInput.value = '';
    if (emailInput) emailInput.value = '';
    if (!nameStr && nameInput) nameInput.focus();
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

function addAllSavedPlayersToSession() {
    playSound('success');
    if (!state.savedPool || state.savedPool.length === 0) {
        alert("No saved players found in roster.");
        return;
    }
    let addedCount = 0;
    state.savedPool.forEach(sp => {
        if (!state.players.some(p => p.email === sp.email)) {
            state.players.push({ ...sp });
            addedCount++;
        }
    });
    renderPlayers();
    renderSavedPlayersModalList();
    updateHeaderStats();
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
            updateHeaderStats();
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
    updateHeaderStats();
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

// --- Render 1 to 5 Clickable Stars for Skill ---
function renderSkillStars(playerId, currentSkill) {
    let rating = 3;
    if (currentSkill) {
        if (currentSkill >= 4.5) rating = 5;
        else if (currentSkill >= 4.0) rating = 4;
        else if (currentSkill >= 3.5) rating = 3;
        else if (currentSkill >= 3.0) rating = 2;
        else rating = 1;
    }

    let starsHtml = '';
    const ratingValues = { 1: 2.5, 2: 3.0, 3: 3.5, 4: 4.0, 5: 4.5 };

    for (let i = 1; i <= 5; i++) {
        const color = i <= rating ? '#f59e0b' : '#cbd5e1';
        const val = ratingValues[i] || 3.5;
        starsHtml += `<span style="color: ${color}; cursor: pointer; font-size: 1.3rem; padding: 0 1px;" onclick="setPlayerSkillRating('${playerId}', ${val})" title="Rate ${val} DUPR">★</span>`;
    }
    return `<div style="display: flex; align-items: center; gap: 2px;">${starsHtml}</div>`;
}

async function setPlayerSkillRating(id, skillVal) {
    playSound('success');
    const p = state.savedPool.find(item => item.id === id);
    if (p) p.skill = skillVal;
    const activeP = state.players.find(item => item.id === id);
    if (activeP) activeP.skill = skillVal;

    renderPlayersManagementTable();

    try {
        await db.from('players').update({ skill: skillVal }).eq('id', String(id));
    } catch (err) {
        console.error("Error updating skill in database:", err);
    }
}

function renderPlayersManagementTable() {
    const tbody = document.getElementById('playersManagementTableBody');
    const countEl = document.getElementById('playersCountDisplay');
    const query = document.getElementById('rosterSearchInput').value.toLowerCase();
    if (!tbody) return;

    tbody.innerHTML = '';
    const filtered = state.savedPool.filter(p => p.name.toLowerCase().includes(query));
    countEl.innerText = `${filtered.length} players`;

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted" style="padding: 20px;">No players found</td></tr>`;
        return;
    }

    filtered.forEach(p => {
        const wr = p.gamesPlayed > 0 ? Math.round((p.wins / p.gamesPlayed) * 100) : 0;
        const isM = p.gender === 'M';
        const starsDisplay = renderSkillStars(p.id, p.skill);

        tbody.innerHTML += `
            <tr>
                <td><strong>${p.name}</strong></td>
                <td>
                    <div style="display: flex; flex-direction: column; gap: 2px;">
                        ${starsDisplay}
                        <span style="font-size: 0.7rem; color: #64748b;">~${p.skill || 3.5} DUPR</span>
                    </div>
                </td>
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

async function setPlayerGender(id, gender) {
    playSound('click');
    const p = state.savedPool.find(item => item.id === id);
    if (p) p.gender = gender;
    const activeP = state.players.find(item => item.id === id);
    if (activeP) activeP.gender = gender;

    renderPlayersManagementTable();
    try {
        await db.from('players').update({ gender: gender }).eq('id', String(id));
    } catch (err) {
        console.error("Error updating gender in database:", err);
    }
}

async function editPlayerPrompt(id) {
    playSound('click');
    const p = state.savedPool.find(item => item.id === id);
    if (!p) return;
    const newName = prompt("Edit player name:", p.name);
    if (newName && newName.trim()) {
        p.name = newName.trim();
        const activeP = state.players.find(item => item.id === id);
        if (activeP) activeP.name = newName.trim();

        renderPlayersManagementTable();
        try {
            await db.from('players').update({ name: p.name }).eq('id', String(id));
        } catch (err) {
            console.error("Error updating name in database:", err);
        }
    }
}

// --- Tournament Session Start & Board Logic ---
function startSession() {
    playSound('success');
    const playersNeeded = state.courts * 4;
    if (state.players.length < playersNeeded) {
        alert(`You need at least ${playersNeeded} players to fill your ${state.courts} court(s). Currently you have ${state.players.length}.`);
        return;
    }

    state.players.forEach(p => {
        p.gamesPlayed = 0;
        p.wins = 0;
        p.losses = 0;
    });

    state.isActiveSession = true;
    document.getElementById('setupContainer').style.display = 'none';
    document.getElementById('sessionContainer').style.display = 'block';
    state.activeMatches = {};
    state.upNext = {};

    // Sync in-session mode dropdown with current state.mode
    const inSessionMode = document.getElementById('inSessionModeSelect');
    if (inSessionMode) inSessionMode.value = state.mode;

    // Feature 4: Automatic queuing system - stage upcoming matches
    autoQueueMatches();

    // Feature 2: Save session state to localStorage and Supabase
    saveSessionState();

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
    if (document.getElementById('activeCourtsStat')) document.getElementById('activeCourtsStat').innerText = activeCourtsCount;
    if (document.getElementById('totalCourtsStat')) document.getElementById('totalCourtsStat').innerText = state.courts;
    if (document.getElementById('totalPlayersStat')) document.getElementById('totalPlayersStat').innerText = state.players.length;

    let busyPlayerIds = new Set();
    Object.values(state.activeMatches).forEach(match => {
        if (match && match.teamA && match.teamB) {
            match.teamA.forEach(p => busyPlayerIds.add(p.id));
            match.teamB.forEach(p => busyPlayerIds.add(p.id));
        }
    });
    Object.values(state.upNext).forEach(match => {
        if (match && match.teamA && match.teamB) {
            match.teamA.forEach(p => busyPlayerIds.add(p.id));
            match.teamB.forEach(p => busyPlayerIds.add(p.id));
        }
    });

    let pool = getSortedPool();
    let waitingPool = pool.filter(p => !busyPlayerIds.has(p.id));
    if (document.getElementById('queueCountStat')) document.getElementById('queueCountStat').innerText = waitingPool.length;
}

// Feature 4: Automatic Queuing System
function autoQueueMatches() {
    let busyPlayerIds = new Set();
    Object.values(state.activeMatches).forEach(match => {
        if (match && match.teamA && match.teamB) {
            match.teamA.forEach(p => busyPlayerIds.add(p.id));
            match.teamB.forEach(p => busyPlayerIds.add(p.id));
        }
    });
    Object.values(state.upNext).forEach(match => {
        if (match && match.teamA && match.teamB) {
            match.teamA.forEach(p => busyPlayerIds.add(p.id));
            match.teamB.forEach(p => busyPlayerIds.add(p.id));
        }
    });

    for (let i = 1; i <= state.courts; i++) {
        if (!state.upNext[i]) {
            let waitingPool = getSortedPool().filter(p => !busyPlayerIds.has(p.id));
            if (waitingPool.length >= 4) {
                state.upNext[i] = {
                    teamA: [waitingPool[0], waitingPool[1]],
                    teamB: [waitingPool[2], waitingPool[3]]
                };
                busyPlayerIds.add(waitingPool[0].id);
                busyPlayerIds.add(waitingPool[1].id);
                busyPlayerIds.add(waitingPool[2].id);
                busyPlayerIds.add(waitingPool[3].id);
            }
        }
    }
}

function refreshBoard() {
    document.getElementById('roundLabel').innerText = state.round;

    // Ensure automatic queue is populated whenever waiting players exist
    autoQueueMatches();

    let pool = getSortedPool();

    let busyPlayerIds = new Set();
    Object.values(state.activeMatches).forEach(match => {
        if (match && match.teamA && match.teamB) {
            match.teamA.forEach(p => busyPlayerIds.add(p.id));
            match.teamB.forEach(p => busyPlayerIds.add(p.id));
        }
    });
    Object.values(state.upNext).forEach(match => {
        if (match && match.teamA && match.teamB) {
            match.teamA.forEach(p => busyPlayerIds.add(p.id));
            match.teamB.forEach(p => busyPlayerIds.add(p.id));
        }
    });

    const waitingPool = pool.filter(p => !busyPlayerIds.has(p.id));
    updateHeaderStats();

    const queueList = document.getElementById('queueList');
    if (document.getElementById('queueCount')) document.getElementById('queueCount').innerText = waitingPool.length;
    if (queueList) {
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
    }

    const grid = document.getElementById('courtsGrid');
    if (grid) {
        grid.innerHTML = '';

        for (let i = 1; i <= state.courts; i++) {
            const match = state.activeMatches[i];
            const upNextMatch = state.upNext[i];

            // Feature 4: Show which players/team will be playing next below the current court assignments
            let nextUpBannerHtml = '';
            if (upNextMatch) {
                nextUpBannerHtml = `
                    <div class="court-next-up-banner">
                        <div class="court-next-up-header">
                            <span>NEXT UP ON COURT ${i}</span>
                            <span class="badge bg-green" style="font-size:0.62rem; padding: 2px 6px;">AUTO QUEUED</span>
                        </div>
                        <div class="court-next-up-teams">
                            <span style="color:var(--team-1); font-weight:700;">${upNextMatch.teamA[0].name} & ${upNextMatch.teamA[1].name}</span>
                            <span style="font-size:0.7rem; color:#94a3b8;">vs</span>
                            <span style="color:var(--team-2); font-weight:700;">${upNextMatch.teamB[0].name} & ${upNextMatch.teamB[1].name}</span>
                        </div>
                    </div>
                `;
            } else {
                nextUpBannerHtml = `
                    <div class="court-next-up-banner" style="opacity: 0.7;">
                        <div class="court-next-up-header">
                            <span>NEXT UP ON COURT ${i}</span>
                        </div>
                        <div style="font-size: 0.75rem; color: #94a3b8;">Waiting for queue rotation...</div>
                    </div>
                `;
            }

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
                        ${nextUpBannerHtml}
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
    }

    const upNextContainer = document.getElementById('upNextContainer');
    if (upNextContainer) {
        upNextContainer.innerHTML = '';
        for (let i = 1; i <= state.courts; i++) {
            const nextMatch = state.upNext[i];
            const isCourtBusy = !!state.activeMatches[i];
            if (nextMatch) {
                const actionBtnHtml = isCourtBusy
                    ? `<button class="btn-outline w-100" style="padding: 0.5rem; font-size: 0.82rem; opacity: 0.65; cursor: not-allowed; display: flex; align-items: center; justify-content: center; gap: 6px;" disabled title="Court ${i} is in play. Finish match and record score before sending next match."><span>⏳ Court ${i} In Play (Waiting)</span></button>`
                    : `<button class="btn-solid w-100" style="padding: 0.5rem; font-size: 0.85rem;" onclick="sendToCourt(${i})">Send to Court</button>`;

                upNextContainer.innerHTML += `
                    <div class="up-next-card-ref">
                        <div class="up-next-top-bar">
                            <span>Up Next Court ${i}</span>
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
                            ${actionBtnHtml}
                        </div>
                    </div>
                `;
            } else {
                upNextContainer.innerHTML += `
                    <div class="up-next-card-ref" style="padding: 16px; opacity: 0.7;">
                        <div class="court-header-row" style="margin-bottom:8px;">
                            <span>Up Next Court ${i}</span>
                            <button class="btn-outline" style="padding: 4px 10px; font-size:0.75rem;" onclick="queueNext(${i})">+ Queue Match</button>
                        </div>
                        <p class="text-sm text-muted text-center" style="margin: 15px 0;">No match queued yet.</p>
                    </div>
                `;
            }
        }
    }

    renderStandings();
}

function queueNext(courtNum) {
    playSound('click');
    let busyPlayerIds = new Set();
    Object.values(state.activeMatches).forEach(match => {
        if (match && match.teamA && match.teamB) {
            match.teamA.forEach(p => busyPlayerIds.add(p.id));
            match.teamB.forEach(p => busyPlayerIds.add(p.id));
        }
    });
    Object.values(state.upNext).forEach(match => {
        if (match && match.teamA && match.teamB) {
            match.teamA.forEach(p => busyPlayerIds.add(p.id));
            match.teamB.forEach(p => busyPlayerIds.add(p.id));
        }
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

    saveSessionState();
    refreshBoard();
}

function sendToCourt(courtNum) {
    playSound('click');
    if (state.activeMatches[courtNum]) {
        alert(`Court ${courtNum} currently has a match in progress! Please finish the active match (record the score) before sending the next match.`);
        return;
    }
    if (!state.upNext[courtNum]) {
        autoQueueMatches();
        if (!state.upNext[courtNum]) return;
    }

    state.activeMatches[courtNum] = {
        ...state.upNext[courtNum],
        startTime: Date.now()
    };
    delete state.upNext[courtNum];

    state.activeMatches[courtNum].teamA.forEach(p => {
        const found = state.players.find(sp => sp.id === p.id);
        if (found) found.gamesPlayed += 1;
    });
    state.activeMatches[courtNum].teamB.forEach(p => {
        const found = state.players.find(sp => sp.id === p.id);
        if (found) found.gamesPlayed += 1;
    });

    autoQueueMatches();
    saveSessionState();
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

    autoQueueMatches();
    saveSessionState();
    renderStandings();
    refreshBoard();
}

function renderStandings() {
    const tbody = document.getElementById('standingsBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    const sorted = [...state.players].sort((a, b) => b.wins !== a.wins ? b.wins - a.wins : a.gamesPlayed - b.gamesPlayed);

    sorted.forEach(p => {
        const winRate = p.gamesPlayed > 0 ? Math.round((p.wins / p.gamesPlayed) * 100) : 0;
        tbody.innerHTML += `<tr><td>${p.name}</td><td>${p.gamesPlayed}</td><td class="text-green">${p.wins} (${winRate}%)</td><td>${p.losses}</td></tr>`;
    });
}

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

function confirmChooseModal() {
    playSound('success');
    if (!state.chosenTeamA[0] || !state.chosenTeamA[1] || !state.chosenTeamB[0] || !state.chosenTeamB[1]) {
        alert("Please fill all 4 player slots before starting the match.");
        return;
    }

    const courtNum = state.activeChooseCourt;
    if (state.activeMatches[courtNum]) {
        alert(`Court ${courtNum} currently has a match in progress! Please finish the active match before starting a new one.`);
        return;
    }
    state.activeMatches[courtNum] = {
        teamA: [...state.chosenTeamA],
        teamB: [...state.chosenTeamB],
        startTime: Date.now()
    };

    state.chosenTeamA.forEach(p => {
        const found = state.players.find(sp => sp.id === p.id);
        if (found) found.gamesPlayed += 1;
    });
    state.chosenTeamB.forEach(p => {
        const found = state.players.find(sp => sp.id === p.id);
        if (found) found.gamesPlayed += 1;
    });

    closeChooseModal();
    autoQueueMatches();
    saveSessionState();
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

// ==========================================================================
// FEATURE 1 & 2: Realtime Synchronization & Session Persistence
// ==========================================================================
function initRealtimeChannel(hostEmail) {
    if (!hostEmail || !window.supabase) return;
    try {
        if (state.realtimeChannel) {
            db.removeChannel(state.realtimeChannel);
        }
        const safeChannelName = `piqueue_session_${hostEmail.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
        state.realtimeChannel = db.channel(safeChannelName)
            .on('broadcast', { event: 'session_update' }, ({ payload }) => {
                handleIncomingRealtimeUpdate(payload);
            })
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    console.log(`Connected to realtime channel: ${safeChannelName}`);
                }
            });
    } catch (err) {
        console.warn("Realtime channel note:", err);
    }
}

function broadcastSessionUpdate(payload) {
    if (state.realtimeChannel) {
        try {
            state.realtimeChannel.send({
                type: 'broadcast',
                event: 'session_update',
                payload: payload
            });
        } catch (e) {
            console.warn("Broadcast note:", e);
        }
    }
}

function handleIncomingRealtimeUpdate(payload) {
    if (!payload) return;

    // If viewing spectator mode, refresh spectator board
    const liveView = document.getElementById('liveSpectatorView');
    if (liveView && liveView.style.display !== 'none') {
        if (payload.ended) {
            alert("Tournament session has ended.");
        } else if (payload.is_active) {
            renderSpectatorBoard(payload);
        }
    }

    // If viewing invite page, update players and QR code
    const inviteView = document.getElementById('playerJoinView');
    if (inviteView && inviteView.style.display !== 'none') {
        if (payload.payment_qr) {
            state.paymentQr = payload.payment_qr;
            renderPaymentQrDisplays();
        }
        const urlParams = new URLSearchParams(window.location.search);
        const joinHost = urlParams.get('join');
        if (joinHost) {
            renderInvitePlayerList(joinHost, payload.is_active ? payload : null);
        }
    }
}

async function saveSessionState() {
    if (!state.host.email || !state.isActiveSession) return;

    const sessionPayload = {
        host_email: state.host.email,
        club_name: state.host.clubName,
        mode: state.mode,
        courts: state.courts,
        round: state.round,
        players: state.players,
        active_matches: state.activeMatches,
        up_next: state.upNext,
        payment_qr: state.paymentQr || '',
        is_active: true,
        updated_at: new Date().toISOString()
    };

    // 1. Instant local persistence for page refresh
    try {
        localStorage.setItem('piqueue_active_session_' + state.host.email, JSON.stringify(sessionPayload));
    } catch (e) {
        console.warn("LocalStorage save error:", e);
    }

    // 2. Broadcast to live spectators and open invite pages
    broadcastSessionUpdate(sessionPayload);

    // 3. Persist to Supabase active_sessions table if available
    try {
        await db.from('active_sessions').upsert([sessionPayload], { onConflict: 'host_email' });
    } catch (err) {
        // Table might not be created yet in user's Supabase instance
        console.log("Supabase active_sessions sync note:", err.message || err);
    }
}

async function restoreActiveSessionIfAny(hostEmail) {
    if (!hostEmail) return;

    let sessionData = null;

    // Check Supabase first
    try {
        const { data, error } = await db.from('active_sessions').select('*').eq('host_email', hostEmail).maybeSingle();
        if (!error && data && data.is_active) {
            sessionData = data;
        }
    } catch (e) {}

    // Fallback to localStorage
    if (!sessionData) {
        try {
            const localStr = localStorage.getItem('piqueue_active_session_' + hostEmail);
            if (localStr) {
                const parsed = JSON.parse(localStr);
                if (parsed && parsed.is_active) {
                    sessionData = parsed;
                }
            }
        } catch (e) {}
    }

    if (sessionData && sessionData.is_active && sessionData.players && sessionData.players.length > 0) {
        state.isActiveSession = true;
        state.courts = sessionData.courts || 2;
        state.mode = sessionData.mode || 'balanced';
        state.round = sessionData.round || 1;
        state.players = sessionData.players || [];
        state.activeMatches = sessionData.active_matches || sessionData.activeMatches || {};
        state.upNext = sessionData.up_next || sessionData.upNext || {};

        if (sessionData.payment_qr) {
            state.paymentQr = sessionData.payment_qr;
            localStorage.setItem('piqueue_payment_qr_' + hostEmail, sessionData.payment_qr);
        }

        // Apply UI mode updates
        setMode(state.mode);
        const inSessionMode = document.getElementById('inSessionModeSelect');
        if (inSessionMode) inSessionMode.value = state.mode;
        const courtCountEl = document.getElementById('courtCount');
        if (courtCountEl) courtCountEl.innerText = state.courts;

        // Switch directly to session container
        document.getElementById('setupContainer').style.display = 'none';
        document.getElementById('sessionContainer').style.display = 'block';

        autoQueueMatches();
        refreshBoard();
        console.log("Active tournament session successfully restored from storage!");
    }
}

// ==========================================================================
// FEATURE 3: Editable Current Session (Switch Mode & Add Players Mid-Session)
// ==========================================================================
function switchSessionMode(newMode) {
    playSound('click');
    setMode(newMode);
    const inSessionMode = document.getElementById('inSessionModeSelect');
    if (inSessionMode) inSessionMode.value = newMode;

    // Preserve already queued matches in state.upNext so players already staged aren't disrupted.
    // Future matches queued when current games finish will follow the new mode's logic.
    autoQueueMatches();
    saveSessionState();
    refreshBoard();
}

function openAddPlayerToSessionModal() {
    playSound('click');
    const modal = document.getElementById('addSessionPlayerModal');
    if (!modal) return;
    renderSessionSavedPlayersList();
    modal.style.display = 'flex';
}

function closeAddPlayerToSessionModal() {
    playSound('click');
    const modal = document.getElementById('addSessionPlayerModal');
    if (modal) modal.style.display = 'none';
}

function renderSessionSavedPlayersList() {
    const list = document.getElementById('sessionSavedPlayersList');
    if (!list) return;
    list.innerHTML = '';

    if (!state.savedPool || state.savedPool.length === 0) {
        list.innerHTML = `<p class="text-xs text-muted text-center" style="padding: 10px;">No saved players in pool</p>`;
        return;
    }

    state.savedPool.forEach(sp => {
        const inActive = state.players.some(p => p.email === sp.email);
        list.innerHTML += `
            <div class="search-item" style="opacity: ${inActive ? '0.6' : '1'};">
                <div>
                    <strong>${sp.name}</strong>
                    <div style="font-size: 0.75rem; color: #64748b;">${sp.email} (~${sp.skill || 3.5} DUPR)</div>
                </div>
                <div>
                    ${inActive 
                        ? '<span style="font-size:0.75rem; color:#059669; font-weight:800;">In Session</span>'
                        : `<button class="btn-solid" style="padding: 4px 10px; font-size: 0.75rem;" onclick="addSavedPlayerToActiveSession('${sp.name}', '${sp.email}')">+ Add</button>`
                    }
                </div>
            </div>
        `;
    });
}

async function addSavedPlayerToActiveSession(name, email) {
    playSound('success');
    const found = state.savedPool.find(sp => sp.email === email);
    const newPlayer = found ? { ...found } : {
        id: String(Date.now() + Math.random()),
        name,
        email,
        skill: 3.5,
        gender: 'M',
        gamesPlayed: 0,
        wins: 0,
        losses: 0
    };

    if (!state.players.some(p => p.email === email)) {
        state.players.push(newPlayer);
        autoQueueMatches();
        saveSessionState();
        refreshBoard();
        renderSessionSavedPlayersList();
    }
}

async function addAllSavedPlayersToActiveSession() {
    playSound('success');
    if (!state.savedPool || state.savedPool.length === 0) {
        alert("No saved players in roster.");
        return;
    }
    let addedCount = 0;
    state.savedPool.forEach(sp => {
        if (!state.players.some(p => p.email === sp.email)) {
            state.players.push({
                ...sp,
                gamesPlayed: sp.gamesPlayed || 0,
                wins: sp.wins || 0,
                losses: sp.losses || 0
            });
            addedCount++;
        }
    });
    if (addedCount > 0) {
        autoQueueMatches();
        saveSessionState();
        refreshBoard();
        renderSessionSavedPlayersList();
    }
}

async function submitNewPlayerToSession() {
    const nameInput = document.getElementById('sessionNewPlayerName');
    const emailInput = document.getElementById('sessionNewPlayerEmail');
    const name = nameInput ? nameInput.value.trim() : '';
    const email = emailInput ? emailInput.value.trim() : '';

    if (!name) {
        alert("Please enter a player name.");
        if (nameInput) nameInput.focus();
        return;
    }

    if (!email) {
        alert("Please enter an email address for the player.");
        if (emailInput) emailInput.focus();
        return;
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
        alert("Please enter a valid email address (e.g. name@gmail.com).");
        if (emailInput) emailInput.focus();
        return;
    }

    if (state.players.some(p => p.email.toLowerCase() === email.toLowerCase())) {
        alert("A player with this email is already in the active session.");
        return;
    }

    playSound('success');
    let savedPlayer = state.savedPool.find(p => p.email.toLowerCase() === email.toLowerCase());
    if (!savedPlayer) {
        savedPlayer = {
            id: String(Date.now() + Math.random()),
            name,
            email,
            skill: 3.5,
            gender: 'M',
            gamesPlayed: 0,
            wins: 0,
            losses: 0
        };
        state.savedPool.push(savedPlayer);
        updateSavedPlayersCountLabel();

        try {
            await db.from('players').upsert([{
                id: savedPlayer.id,
                name: savedPlayer.name,
                email: savedPlayer.email,
                skill: 3.5,
                gender: 'M',
                host_email: state.host.email,
                games_played: 0,
                wins: 0,
                losses: 0
            }], { onConflict: 'id' });
        } catch (e) {
            console.warn("DB save error:", e);
        }
    }

    state.players.push({ ...savedPlayer });
    if (nameInput) nameInput.value = '';
    if (emailInput) emailInput.value = '';

    autoQueueMatches();
    saveSessionState();
    refreshBoard();
    renderSessionSavedPlayersList();
    alert(`Player "${name}" added to session!`);
}

// ==========================================================================
// FEATURE 1: Shareable Live Game Spectator View
// ==========================================================================
function shareLiveGameLink() {
    playSound('success');
    const email = state.host.email || localStorage.getItem('piqueueEmail');
    if (!email) return;
    const spectatorUrl = `${window.location.origin}${window.location.pathname}?live=${encodeURIComponent(email)}`;
    navigator.clipboard.writeText(spectatorUrl);
    alert("Shareable Live Game link copied to clipboard!\n\nOthers can open this link on any device to view live matches and the queue in real-time.");
}

function copySpectatorLink() {
    playSound('success');
    const linkEl = document.getElementById('spectatorLinkDisplay');
    const url = (linkEl && linkEl.innerText) || `${window.location.origin}${window.location.pathname}?live=${encodeURIComponent(state.host.email)}`;
    navigator.clipboard.writeText(url);
    alert("Live Game Spectator link copied to clipboard!");
}

function copyCurrentUrl() {
    playSound('success');
    navigator.clipboard.writeText(window.location.href);
    alert("Live link copied to clipboard!");
}

function goToJoinView() {
    playSound('click');
    const urlParams = new URLSearchParams(window.location.search);
    const hostEmail = urlParams.get('live') || state.host.email;
    window.location.search = `?join=${encodeURIComponent(hostEmail)}`;
}

function openSpectatorQrModal() {
    if (state.paymentQr) {
        openEnlargeQrModal(state.paymentQr);
    } else {
        alert("The host has not uploaded a payment QR code yet.");
    }
}

async function loadSpectatorView(liveHostEmail) {
    document.getElementById('authView').style.display = 'none';
    const dashView = document.getElementById('dashboardView');
    if (dashView) dashView.style.display = 'none';
    const joinView = document.getElementById('playerJoinView');
    if (joinView) joinView.style.display = 'none';
    document.getElementById('liveSpectatorView').style.display = 'block';

    document.body.classList.remove('auth-mode');
    document.body.classList.add('dashboard-mode');

    // Fetch Host club name
    db.from('users').select('club_name, name').eq('email', liveHostEmail).maybeSingle()
        .then(({ data }) => {
            if (data) {
                const title = data.club_name || `${data.name}'s Club`;
                document.getElementById('spectatorClubTitle').innerText = title;
                document.getElementById('spectatorSubTitle').innerText = `${title} Open Play`;
            }
        });

    // Check cached QR
    const cachedQr = localStorage.getItem('piqueue_payment_qr_' + liveHostEmail);
    if (cachedQr) state.paymentQr = cachedQr;

    // Fetch active session
    let sessionData = null;
    try {
        const { data } = await db.from('active_sessions').select('*').eq('host_email', liveHostEmail).maybeSingle();
        if (data) sessionData = data;
    } catch (e) {}

    if (!sessionData) {
        try {
            const localStr = localStorage.getItem('piqueue_active_session_' + liveHostEmail);
            if (localStr) sessionData = JSON.parse(localStr);
        } catch (e) {}
    }

    if (sessionData && sessionData.is_active) {
        if (sessionData.payment_qr) state.paymentQr = sessionData.payment_qr;
        renderSpectatorBoard(sessionData);
    } else {
        renderSpectatorEmptyBoard(liveHostEmail);
    }

    // Subscribe to realtime updates for this host
    initRealtimeChannel(liveHostEmail);

    // Periodic fallback sync every 6 seconds
    setInterval(async () => {
        try {
            const { data } = await db.from('active_sessions').select('*').eq('host_email', liveHostEmail).maybeSingle();
            if (data && data.is_active) {
                renderSpectatorBoard(data);
            }
        } catch (e) {}
    }, 6000);
}

function renderSpectatorEmptyBoard(hostEmail) {
    document.getElementById('spectatorRoundLabel').innerText = '1';
    document.getElementById('spectatorActiveCourts').innerText = '0';
    document.getElementById('spectatorTotalCourts').innerText = '2';
    document.getElementById('spectatorTotalPlayers').innerText = '0';
    document.getElementById('spectatorQueueCount').innerText = '0';
    document.getElementById('spectatorQueueCountInner').innerText = '0';

    const grid = document.getElementById('spectatorCourtsGrid');
    if (grid) {
        grid.innerHTML = `
            <div class="card premium-card text-center" style="grid-column: 1/-1; padding: 40px 20px;">
                <h3 class="m-0 text-green">Waiting for Session to Start</h3>
                <p class="text-sm text-muted mt-2 mb-3">The host has not started the active tournament session yet.</p>
                <button class="btn-solid" onclick="goToJoinView()" style="font-size: 0.85rem; padding: 8px 18px;">Join Club Roster</button>
            </div>
        `;
    }
}

function renderSpectatorBoard(data) {
    const courtsCount = data.courts || 2;
    const mode = data.mode || 'balanced';
    const round = data.round || 1;
    const players = data.players || [];
    const activeMatches = data.active_matches || data.activeMatches || {};
    const upNext = data.up_next || data.upNext || {};

    const modeNames = { 'balanced': 'Balanced', 'social': 'Social Mix', 'winlose': 'Winners / Losers' };
    document.getElementById('spectatorModeLabel').innerText = modeNames[mode] || mode;
    document.getElementById('spectatorRoundLabel').innerText = round;

    let activeCourtsCount = Object.keys(activeMatches).length;
    document.getElementById('spectatorActiveCourts').innerText = activeCourtsCount;
    document.getElementById('spectatorTotalCourts').innerText = courtsCount;
    document.getElementById('spectatorTotalPlayers').innerText = players.length;

    let busyPlayerIds = new Set();
    Object.values(activeMatches).forEach(match => {
        if (match && match.teamA && match.teamB) {
            match.teamA.forEach(p => busyPlayerIds.add(p.id));
            match.teamB.forEach(p => busyPlayerIds.add(p.id));
        }
    });
    Object.values(upNext).forEach(match => {
        if (match && match.teamA && match.teamB) {
            match.teamA.forEach(p => busyPlayerIds.add(p.id));
            match.teamB.forEach(p => busyPlayerIds.add(p.id));
        }
    });

    let pool = [...players];
    if (mode === 'winlose') {
        pool.sort((a, b) => b.wins !== a.wins ? b.wins - a.wins : a.gamesPlayed - b.gamesPlayed);
    } else if (mode === 'social') {
        pool.sort((a, b) => a.gamesPlayed - b.gamesPlayed);
    } else {
        pool.sort((a, b) => a.gamesPlayed !== b.gamesPlayed ? a.gamesPlayed - b.gamesPlayed : b.wins - a.wins);
    }

    const waitingPool = pool.filter(p => !busyPlayerIds.has(p.id));
    document.getElementById('spectatorQueueCount').innerText = waitingPool.length;
    document.getElementById('spectatorQueueCountInner').innerText = waitingPool.length;

    // Queue list
    const queueList = document.getElementById('spectatorQueueList');
    if (queueList) {
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
    }

    // Courts Grid
    const grid = document.getElementById('spectatorCourtsGrid');
    if (grid) {
        grid.innerHTML = '';
        for (let i = 1; i <= courtsCount; i++) {
            const match = activeMatches[i];
            const nextMatch = upNext[i];

            let nextUpBannerHtml = '';
            if (nextMatch) {
                nextUpBannerHtml = `
                    <div class="court-next-up-banner">
                        <div class="court-next-up-header">
                            <span>NEXT UP ON COURT ${i}</span>
                            <span class="badge bg-green" style="font-size:0.62rem; padding: 2px 6px;">QUEUED</span>
                        </div>
                        <div class="court-next-up-teams">
                            <span style="color:var(--team-1); font-weight:700;">${nextMatch.teamA[0].name} & ${nextMatch.teamA[1].name}</span>
                            <span style="font-size:0.7rem; color:#94a3b8;">vs</span>
                            <span style="color:var(--team-2); font-weight:700;">${nextMatch.teamB[0].name} & ${nextMatch.teamB[1].name}</span>
                        </div>
                    </div>
                `;
            } else {
                nextUpBannerHtml = `
                    <div class="court-next-up-banner" style="opacity:0.7;">
                        <div class="court-next-up-header"><span>NEXT UP ON COURT ${i}</span></div>
                        <div style="font-size:0.75rem; color:#94a3b8;">Waiting for queue rotation...</div>
                    </div>
                `;
            }

            if (match) {
                grid.innerHTML += `
                    <div class="match-card">
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
                        ${nextUpBannerHtml}
                    </div>
                `;
            } else {
                grid.innerHTML += `
                    <div class="${nextMatch ? 'court-box-ref' : 'court-box-empty'}">
                        <div class="court-header-row">
                            <span>Court ${i}</span>
                            ${nextMatch ? '<span class="badge-ready">READY</span>' : ''}
                        </div>
                        <div class="match-vs-preview">${nextMatch ? `${nextMatch.teamA[0].name} / ${nextMatch.teamA[1].name} vs ${nextMatch.teamB[0].name} / ${nextMatch.teamB[1].name}` : 'Waiting for match to begin'}</div>
                    </div>
                `;
            }
        }
    }

    // Up Next Container
    const upNextContainer = document.getElementById('spectatorUpNextContainer');
    if (upNextContainer) {
        upNextContainer.innerHTML = '';
        for (let i = 1; i <= courtsCount; i++) {
            const nextMatch = upNext[i];
            if (nextMatch) {
                upNextContainer.innerHTML += `
                    <div class="up-next-card-ref">
                        <div class="up-next-top-bar">
                            <span>Up Next Court ${i}</span>
                            <span class="badge bg-green" style="font-size:0.65rem;">Auto</span>
                        </div>
                        <div class="up-next-split-grid">
                            <div class="team-box-side">
                                <div class="team-header-bar-blue" style="margin: -12px -12px 10px -12px;">TEAM 1</div>
                                <div class="player-line">${nextMatch.teamA[0].name}</div>
                                <div class="player-line" style="margin-top:6px;">${nextMatch.teamA[1].name}</div>
                            </div>
                            <div class="team-box-side">
                                <div class="team-header-bar-orange" style="margin: -12px -12px 10px -12px;">TEAM 2</div>
                                <div class="player-line">${nextMatch.teamB[0].name}</div>
                                <div class="player-line" style="margin-top:6px;">${nextMatch.teamB[1].name}</div>
                            </div>
                        </div>
                    </div>
                `;
            }
        }
    }

    // Standings
    const tbody = document.getElementById('spectatorStandingsBody');
    if (tbody) {
        tbody.innerHTML = '';
        const sorted = [...players].sort((a, b) => b.wins !== a.wins ? b.wins - a.wins : a.gamesPlayed - b.gamesPlayed);
        sorted.forEach(p => {
            const winRate = p.gamesPlayed > 0 ? Math.round((p.wins / p.gamesPlayed) * 100) : 0;
            tbody.innerHTML += `<tr><td>${p.name}</td><td>${p.gamesPlayed}</td><td class="text-green">${p.wins} (${winRate}%)</td><td>${p.losses}</td></tr>`;
        });
    }
}

// ==========================================================================
// FEATURE 5: Invitation Link Player List
// ==========================================================================
async function loadInvitePageView(joinHostEmail) {
    document.getElementById('authView').style.display = 'none';
    document.getElementById('playerJoinView').style.display = 'block';

    // Show host inline upload section if logged in as this host
    const savedEmail = localStorage.getItem('piqueueEmail');
    if (savedEmail && savedEmail.toLowerCase() === joinHostEmail.toLowerCase()) {
        const hostSection = document.getElementById('hostQrInlineUploadSection');
        if (hostSection) hostSection.style.display = 'block';
    }

    // Set watch live button handler
    const btnLive = document.getElementById('btnGoToLiveSpectator');
    if (btnLive) {
        btnLive.onclick = () => {
            window.location.search = `?live=${encodeURIComponent(joinHostEmail)}`;
        };
    }

    // Load QR from cache or state
    const cachedQr = localStorage.getItem('piqueue_payment_qr_' + joinHostEmail);
    if (cachedQr) {
        state.paymentQr = cachedQr;
    }
    renderPaymentQrDisplays();

    // Fetch Host details
    db.from('users').select('club_name, name').eq('email', joinHostEmail).maybeSingle()
        .then(({ data }) => {
            if (data) {
                document.getElementById('joinClubTitle').innerText = `Join ${data.club_name || data.name + "'s Club"}`;
            }
        });

    // Check if there is an active session for this host
    let activeSession = null;
    try {
        const { data } = await db.from('active_sessions').select('*').eq('host_email', joinHostEmail).maybeSingle();
        if (data && data.is_active) {
            activeSession = data;
            if (data.payment_qr) {
                state.paymentQr = data.payment_qr;
                renderPaymentQrDisplays();
            }
        }
    } catch (e) {}

    if (!activeSession) {
        try {
            const localSession = localStorage.getItem('piqueue_active_session_' + joinHostEmail);
            if (localSession) {
                const parsed = JSON.parse(localSession);
                if (parsed && parsed.is_active) activeSession = parsed;
            }
        } catch (e) {}
    }

    // Render player list
    renderInvitePlayerList(joinHostEmail, activeSession);

    // Subscribe to realtime channel for live updates
    initRealtimeChannel(joinHostEmail);
}

async function renderInvitePlayerList(hostEmail, activeSession = null) {
    const container = document.getElementById('invitePlayerListContainer');
    const countEl = document.getElementById('invitePlayerCount');
    const badgeEl = document.getElementById('inviteSessionStatusBadge');
    if (!container) return;

    if (activeSession && activeSession.is_active && activeSession.players && activeSession.players.length > 0) {
        if (badgeEl) badgeEl.innerText = "ACTIVE TOURNAMENT SESSION";
        if (countEl) countEl.innerText = activeSession.players.length;

        // Map who is on court vs in queue
        let busyPlayerIds = new Set();
        let courtPlayerMap = {};
        const matches = activeSession.active_matches || activeSession.activeMatches || {};
        Object.entries(matches).forEach(([courtNum, match]) => {
            if (match && match.teamA && match.teamB) {
                match.teamA.forEach(p => { busyPlayerIds.add(p.id); courtPlayerMap[p.id] = `Court ${courtNum}`; });
                match.teamB.forEach(p => { busyPlayerIds.add(p.id); courtPlayerMap[p.id] = `Court ${courtNum}`; });
            }
        });

        let html = '';
        activeSession.players.forEach(p => {
            let statusBadge = '';
            if (courtPlayerMap[p.id]) {
                statusBadge = `<span class="badge-on-court">Playing on ${courtPlayerMap[p.id]}</span>`;
            } else {
                statusBadge = `<span class="badge-in-queue">In Queue</span>`;
            }
            html += `
                <div class="invite-player-card">
                    <div>
                        <div class="invite-player-name">${p.name}</div>
                        <div class="invite-player-sub">Skill: ~${p.skill || 3.5} DUPR | Games: ${p.gamesPlayed || 0}</div>
                    </div>
                    <div>${statusBadge}</div>
                </div>
            `;
        });
        container.innerHTML = html;
    } else {
        // Fetch saved roster from database
        if (badgeEl) badgeEl.innerText = "CLUB ROSTER";
        try {
            const { data: players, error } = await db.from('players').select('*').eq('host_email', hostEmail);
            if (error) throw error;

            if (countEl) countEl.innerText = players ? players.length : 0;
            if (!players || players.length === 0) {
                container.innerHTML = `<p class="text-sm text-muted text-center" style="grid-column: 1/-1; padding: 20px;">No players registered yet. Be the first to join!</p>`;
                return;
            }

            let html = '';
            players.forEach(p => {
                html += `
                    <div class="invite-player-card">
                        <div>
                            <div class="invite-player-name">${p.name}</div>
                            <div class="invite-player-sub">Skill: ~${p.skill || 3.5} DUPR | Games: ${p.games_played || 0}</div>
                        </div>
                        <div><span class="badge-roster-ready">Roster Member</span></div>
                    </div>
                `;
            });
            container.innerHTML = html;
        } catch (err) {
            container.innerHTML = `<p class="text-sm text-muted text-center" style="grid-column: 1/-1; padding: 20px;">Could not load players.</p>`;
        }
    }
}

// ==========================================================================
// FEATURE 6: Uploadable Host Payment QR Code (GCash / Court Fees)
// ==========================================================================
function handleQrUpload(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        alert("Please select a valid image file (PNG, JPG, etc.).");
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            // Resize and compress via HTML5 canvas to keep size small and lightweight (< 50KB)
            const canvas = document.createElement('canvas');
            const maxDim = 500;
            let width = img.width;
            let height = img.height;

            if (width > maxDim || height > maxDim) {
                if (width > height) {
                    height = Math.round((height * maxDim) / width);
                    width = maxDim;
                } else {
                    width = Math.round((width * maxDim) / height);
                    height = maxDim;
                }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            const compressedBase64 = canvas.toDataURL('image/jpeg', 0.85);
            savePaymentQr(compressedBase64);
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

async function savePaymentQr(base64Str) {
    playSound('success');
    state.paymentQr = base64Str;
    const email = state.host.email || (new URLSearchParams(window.location.search)).get('join') || (new URLSearchParams(window.location.search)).get('live');
    if (email) {
        localStorage.setItem('piqueue_payment_qr_' + email, base64Str);
    }

    renderPaymentQrDisplays();

    // If session is active, broadcast update
    if (state.isActiveSession) {
        saveSessionState();
    }

    const statusEl = document.getElementById('qrUploadStatus');
    if (statusEl) {
        statusEl.innerText = "✓ Payment QR code saved successfully!";
        setTimeout(() => { statusEl.innerText = ""; }, 4000);
    }
}

function removePaymentQr() {
    playSound('click');
    if (confirm("Remove your payment QR code?")) {
        state.paymentQr = '';
        const email = state.host.email || (new URLSearchParams(window.location.search)).get('join');
        if (email) {
            localStorage.removeItem('piqueue_payment_qr_' + email);
        }
        renderPaymentQrDisplays();
        if (state.isActiveSession) {
            saveSessionState();
        }
    }
}

function renderPaymentQrDisplays() {
    const qrData = state.paymentQr;

    // 1. In Club Settings
    const settingsBox = document.getElementById('settingsQrPreviewBox');
    const removeBtn = document.getElementById('btnRemoveQr');
    if (settingsBox) {
        if (qrData) {
            settingsBox.innerHTML = `<img src="${qrData}" class="settings-qr-img" alt="Payment QR" onclick="openEnlargeQrModal('${qrData}')" style="cursor:pointer;" title="Click to enlarge">`;
            if (removeBtn) removeBtn.style.display = 'inline-block';
        } else {
            settingsBox.innerHTML = `<p class="text-xs text-muted text-center" style="margin: 0; padding: 20px 8px;">No QR code uploaded</p>`;
            if (removeBtn) removeBtn.style.display = 'none';
        }
    }

    // 2. In Invitation Page
    const inviteContainer = document.getElementById('inviteQrImageContainer');
    if (inviteContainer) {
        if (qrData) {
            inviteContainer.innerHTML = `
                <div class="qr-image-wrapper" onclick="openEnlargeQrModal('${qrData}')">
                    <img src="${qrData}" class="qr-preview-img" alt="Scan to pay court fee">
                </div>
                <p class="text-xs text-muted mt-2 mb-0">Tap / click image to enlarge</p>
            `;
        } else {
            inviteContainer.innerHTML = `<p class="text-sm text-muted" style="padding: 24px 10px;">No payment QR uploaded yet by host.</p>`;
        }
    }
}

function openEnlargeQrModal(qrSrc) {
    playSound('click');
    const src = qrSrc || state.paymentQr;
    if (!src) return;
    const modal = document.getElementById('enlargeQrModal');
    const container = document.getElementById('enlargeQrImgContainer');
    if (modal && container) {
        container.innerHTML = `<img src="${src}" style="max-width: 100%; height: auto; display: block; margin: 0 auto; border-radius: 8px;">`;
        modal.style.display = 'flex';
    }
}

function closeEnlargeQrModal() {
    playSound('click');
    const modal = document.getElementById('enlargeQrModal');
    if (modal) modal.style.display = 'none';
}