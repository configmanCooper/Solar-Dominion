/* ============================================================
 * Solar Dominion — UI Module
 * DOM-based panels for docking, trade, missions, upgrades,
 * fleet, diplomacy, and story dialogs.
 * ============================================================ */
var UI = (function () {
    'use strict';

    var _elements = {};
    var _currentPanel = null;
    var _toasts = [];
    var _storyQueue = [];
    var _godMode = false;
    var _godSpeedBonus = 0;
    var _cheatBuffer = '';
    var _cheatTimeout = null;

    function init() {
        _elements = {
            overlay: document.getElementById('uiOverlay'),
            panel: document.getElementById('panelContent'),
            panelTitle: document.getElementById('panelTitle'),
            panelContainer: document.getElementById('panelContainer'),
            closeBtn: document.getElementById('panelClose'),
            toastContainer: document.getElementById('toastContainer'),
            storyOverlay: document.getElementById('storyOverlay'),
            storyTitle: document.getElementById('storyTitle'),
            storyText: document.getElementById('storyText'),
            storyClose: document.getElementById('storyClose'),
            navBar: document.getElementById('navBar')
        };

        _elements.closeBtn.addEventListener('click', closePanel);
        _elements.overlay.addEventListener('click', closePanel);
        _elements.storyClose.addEventListener('click', closeStory);

        // Nav buttons (DOM listeners, only need to bind once)
        document.getElementById('btnMap').addEventListener('click', function () { _togglePanel('map'); });
        document.getElementById('btnFleet').addEventListener('click', function () { _togglePanel('fleet'); });
        document.getElementById('btnDiplomacy').addEventListener('click', function () { _togglePanel('diplomacy'); });
        document.getElementById('btnLog').addEventListener('click', function () { _togglePanel('log'); });

        // Speed control buttons
        var speedButtons = [
            { id: 'btnPause', speed: 0 },
            { id: 'btnSpeed1', speed: 1 },
            { id: 'btnSpeed2', speed: 2 },
            { id: 'btnSpeed4', speed: 4 },
            { id: 'btnSpeed10', speed: 10 }
        ];
        speedButtons.forEach(function (btn) {
            document.getElementById(btn.id).addEventListener('click', function () {
                if (btn.speed === 0) {
                    if (!Engine.isPaused()) Engine.togglePause();
                } else {
                    if (Engine.isPaused()) Engine.togglePause();
                    Engine.setGameSpeed(btn.speed);
                }
                _updateSpeedButtons();
            });
        });

        // Listen for speed/pause changes to update button states
        Events.on('speed_changed', function () { _updateSpeedButtons(); });
        Events.on('pause_changed', function () { _updateSpeedButtons(); });

        // Cheat code listener: type "solar" to toggle god mode
        window.addEventListener('keydown', function (e) {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            var ch = e.key.toLowerCase();
            if (ch.length === 1 && ch >= 'a' && ch <= 'z') {
                _cheatBuffer += ch;
                if (_cheatTimeout) clearTimeout(_cheatTimeout);
                _cheatTimeout = setTimeout(function () { _cheatBuffer = ''; }, 2000);
                if (_cheatBuffer.indexOf('solar') !== -1) {
                    _cheatBuffer = '';
                    _toggleGodMode();
                }
            }
        });

        wireEvents();

        // Set initial speed button state (game starts unpaused at 1x)
        _updateSpeedButtons();
    }

    function wireEvents() {
        // Event bus listeners — must be called after Events.clear()
        Events.on('ship_docked', function (data) {
            _showDockPanel(data.locationId);
        });
        Events.on('ship_undocked', function () {
            closePanel();
        });
        Events.on('mission_completed', function (data) {
            showToast('Mission Complete: ' + data.mission.name + ' (+' + data.mission.reward.credits + ' credits)', 'success');
        });
        Events.on('reputation_changed', function (data) {
            var sign = data.change > 0 ? '+' : '';
            showToast(data.faction + ' rep ' + sign + data.change, data.change > 0 ? 'info' : 'warning');
        });
        Events.on('story_chapter', function (data) {
            _storyQueue.push({ title: data.title, text: data.text });
            if (!_isStoryVisible()) _showNextStory();
        });
        Events.on('station_built', function (data) {
            showToast('Station construction complete!', 'success');
        });
        Events.on('player_respawned', function () {
            showToast('Respawned at Luna Colony (-10% credits)', 'warning');
        });
        Events.on('victory', function (data) {
            var title = data.type === 'peace' ? '🕊️ Peace Achieved!' :
                data.type === 'war_earth' ? '⚔️ Earth Victorious!' :
                data.type === 'war_mars' ? '⚔️ Mars Victorious!' :
                data.type === 'domination' ? '👑 Solar Dominion!' : '🏆 Victory!';
            _storyQueue.push({
                title: title,
                text: _getVictoryText(data.type)
            });
            if (!_isStoryVisible()) _showNextStory();
        });
        Events.on('path_chosen', function (data) {
            var pathName = data.path === 'peace' ? 'Peace' :
                data.path === 'war_earth' ? 'Earth Alliance' :
                data.path === 'war_mars' ? 'Mars Confederacy' :
                data.path === 'domination' ? 'Solar Dominion (Hidden Path!)' : data.path;
            showToast('Path chosen: ' + pathName, 'success');
        });
        Events.on('weapon_switched', function (data) {
            var wData = Config.WEAPON_TYPES[data.weapon];
            showToast('Weapon: ' + (wData ? wData.name : data.weapon), 'info');
        });
        Events.on('location_event_started', function (data) {
            var loc = World.getLocation(data.locationId);
            var locName = loc ? loc.name : data.locationId;
            var sevIcons = { crisis: '🚨', major: '⚠️', moderate: '📢', minor: '📰' };
            var icon = sevIcons[data.event.severity] || '📰';
            showToast(icon + ' ' + locName + ': ' + data.event.name, data.event.severity === 'crisis' ? 'warning' : 'info');
        });
        Events.on('mission_expired', function (data) {
            showToast('Mission expired: ' + data.mission.name, 'warning');
        });
        Events.on('station_flipped', function (data) {
            showToast('👑 ' + data.stationName + ' is now under your control!', 'success');
        });
        Events.on('domination_declared', function () {
            showToast('🔥 The Solar Dominion rises! Both factions are now hostile!', 'warning');
        });
        Events.on('faction_subjugated', function (data) {
            showToast('👑 ' + data.name + ' has surrendered to the Solar Dominion!', 'success');
        });
        Events.on('faction_ship_built', function (data) {
            var fName = (Factions.getFaction(data.faction) || {}).name || data.faction;
            showToast('⚙️ ' + fName + ' built: ' + data.shipName, 'info');
        });
        Events.on('political_crisis', function (data) {
            showToast('🏛️ ' + data.factionName + ': ' + data.name + ' — ' + data.desc, 'warning');
        });
        Events.on('political_crisis_ended', function (data) {
            var fName = (Factions.getFaction(data.faction) || {}).name || data.faction;
            showToast('🏛️ ' + fName + ': ' + data.name + ' crisis resolved', 'info');
        });
        Events.on('fleet_attack_launched', function (e) {
            showToast('⚔️ ' + e.factionName + ' launched fleet attack on ' + e.targetName + '!', 'combat');
        });
        Events.on('fleet_attack_result', function (e) {
            showToast('⚔️ ' + e.message, 'combat');
        });

        // Mining events
        Events.on('mining_started', function () {
            showToast('⛏ Mining started — press [R] to stop', 'info');
        });
        Events.on('mining_stopped', function () {
            showToast('⛏ Mining stopped', 'info');
        });
        Events.on('mining_error', function (data) {
            showToast('⛏ ' + data.reason, 'warning');
        });
        Events.on('resource_mined', function (data) {
            var rDef = Config.RESOURCES[data.resource];
            var name = rDef ? rDef.name : data.resource;
            showToast((rDef ? rDef.icon : '') + ' +' + data.amount + ' ' + name, 'success');
        });
        Events.on('asteroid_depleted', function () {
            showToast('⛏ Asteroid depleted!', 'info');
        });
    }

    function handleInput() {
        if (Input.justPressed('ESCAPE')) {
            // Close ship editor first if open
            if (_editorOpen) {
                _closeShipEditor();
                return;
            }
            // Close galaxy map if open
            if (Render.isGalaxyMapOpen && Render.isGalaxyMapOpen()) {
                Render.toggleGalaxyMap();
                return;
            }
            if (_currentPanel !== null) {
                closePanel();
                return;
            }
            Engine.togglePause();
            return;
        }
        if (Input.justPressed('MAP')) _togglePanel('map');
        if (Input.justPressed('FLEET')) _togglePanel('fleet');
        if (Input.justPressed('DIPLO')) _togglePanel('diplomacy');
        if (Input.justPressed('LOG')) _togglePanel('log');
        if (Input.justPressed('MISSIONS')) {
            if (_currentPanel === 'mission_tracker' || _currentPanel === 'mission_detail') {
                closePanel();
            } else {
                _showMissionTracker();
            }
        }
        if (Input.justPressed('PAUSE')) Engine.togglePause();
        if (Input.justPressed('SPEED_UP')) Engine.setGameSpeed(Engine.getGameSpeed() + 0.5);
        if (Input.justPressed('SPEED_DOWN')) Engine.setGameSpeed(Engine.getGameSpeed() - 0.5);

        // Mining toggle
        if (Input.justPressed('MINE')) {
            if (Mining.isMining()) {
                Mining.stopMining();
            } else {
                var ship = Ship.getShip();
                if (!ship.docked) {
                    var nearAst = Mining.getNearbyAsteroid(ship.x, ship.y);
                    if (nearAst) {
                        Mining.startMining(nearAst.id);
                    }
                }
            }
        }
    }

    // ── Panel management ─────────────────────────────────────

    function _togglePanel(panelId) {
        if (_currentPanel === panelId) {
            closePanel();
        } else {
            _showPanel(panelId);
        }
    }

    function _showPanel(panelId) {
        _currentPanel = panelId;
        _elements.panelContainer.style.display = 'flex';
        _elements.overlay.style.display = 'block';

        // Toggle wide mode for trade panel
        if (panelId === 'trade') {
            _elements.panelContainer.classList.add('trade-wide');
        } else {
            _elements.panelContainer.classList.remove('trade-wide');
        }

        switch (panelId) {
            case 'dock': _showDockPanel(Ship.getShip().dockedAt); break;
            case 'trade': _showTradePanel(); break;
            case 'missions': _showMissionsPanel(); break;
            case 'mission_tracker': break; // content set by caller
            case 'mission_detail': break;  // content set by caller
            case 'upgrade': _showUpgradePanel(); break;
            case 'fleet': _showFleetPanel(); break;
            case 'diplomacy': _showDiplomacyPanel(); break;
            case 'map': _showMapPanel(); break;
            case 'log': _showLogPanel(); break;
            case 'station_build': _showStationBuildPanel(); break;
            case 'path_select': _showPathSelectPanel(); break;
        }
    }

    function closePanel() {
        _elements.panelContainer.classList.remove('trade-wide');
        // Mission panels opened via J key should close completely
        if (_currentPanel === 'mission_tracker' || _currentPanel === 'mission_detail') {
            _currentPanel = null;
            _elements.panelContainer.style.display = 'none';
            _elements.overlay.style.display = 'none';
            return;
        }
        // If docked, go back to dock panel instead of closing entirely
        var ship = Ship.getShip();
        if (ship.docked && _currentPanel !== null && _currentPanel !== 'dock') {
            _showDockPanel(ship.dockedAt);
            return;
        }
        _currentPanel = null;
        _elements.panelContainer.style.display = 'none';
        _elements.overlay.style.display = 'none';
    }

    function isPanelOpen() { return _currentPanel !== null; }

    // ── Dock Panel ───────────────────────────────────────────

    function _showDockPanel(locationId) {
        var loc = World.getLocation(locationId);
        if (!loc) return;

        Missions.generateForLocation(locationId);

        _elements.panelTitle.textContent = '⚓ ' + loc.name;
        var html = '<p class="loc-desc">' + loc.description + '</p>';
        html += '<p class="loc-faction">Faction: <span style="color:' + _getFactionColorCSS(loc.faction) + '">' + _factionName(loc.faction) + '</span></p>';

        // Influence display for neutral locations
        if (loc.influence) {
            html += '<div class="influence-bar">';
            html += '<span class="earth-inf">Earth: ' + Math.floor(loc.influence.earth) + '</span>';
            html += '<span class="mars-inf">Mars: ' + Math.floor(loc.influence.mars) + '</span>';
            html += '</div>';
        }

        html += '<div class="dock-buttons">';
        if (loc.services.indexOf('trade') !== -1) {
            html += '<button class="panel-btn" onclick="UI.openSub(\'trade\')">🏪 Trade</button>';
        }
        if (loc.services.indexOf('missions') !== -1) {
            html += '<button class="panel-btn" onclick="UI.openSub(\'missions\')">📋 Missions</button>';
        }
        if (loc.services.indexOf('upgrade') !== -1 || loc.services.indexOf('shipyard') !== -1) {
            html += '<button class="panel-btn" onclick="UI.openSub(\'upgrade\')">🔧 Upgrade Ship</button>';
        }
        if (loc.services.indexOf('shipyard') !== -1) {
            html += '<button class="panel-btn" onclick="UI.openSub(\'fleet\')">🚀 Fleet Shipyard</button>';
        }
        if (loc.services.indexOf('fuel') !== -1 || loc.services.indexOf('trade') !== -1) {
            var _fuelType = Ship.getFuelType();
            var _fuelFree = Ship.getFuelFree();
            var _fuelPrice = Economy.getBuyPrice(loc.id, _fuelType);
            var _refuelCost = (_fuelFree > 0 && _fuelPrice) ? (_fuelFree * _fuelPrice).toFixed(2) : '0';
            html += '<button class="panel-btn" onclick="UI._refuel()">⛽ Refuel (' + _refuelCost + ' cr)</button>';
        }
        html += '<button class="panel-btn" onclick="UI.openSub(\'diplomacy\')">🤝 Diplomacy</button>';
        html += '<button class="panel-btn" onclick="UI.openSub(\'station_build\')">🏗️ Build Station</button>';

        if (Diplomacy.getPath() === 'none' && Missions.getCompleted().length >= 3) {
            html += '<button class="panel-btn highlight" onclick="UI.openSub(\'path_select\')">⭐ Choose Your Path</button>';
        }

        // Domination path controls
        if (Diplomacy.getPath() === 'domination') {
            var isControlled = Diplomacy.getControlledStations().indexOf(locationId) !== -1;
            var isHomeworld = locationId === 'earth' || locationId === 'mars';

            if (isControlled) {
                html += '<p style="color:#ff4444;font-weight:bold;">👑 Under your control</p>';
            } else if (isHomeworld && Diplomacy.isDominationDeclared()) {
                var hwFaction = locationId === 'earth' ? Config.FACTION.EARTH : Config.FACTION.MARS;
                html += '<button class="panel-btn" style="background:#440000;border-color:#ff4444;" onclick="UI._subjugateFaction(\'' + hwFaction + '\')">⚔️ Subjugate ' + _factionName(hwFaction) + '</button>';
            } else if (!isHomeworld) {
                html += '<button class="panel-btn" style="background:#440022;border-color:#ff4444;" onclick="UI._flipStation(\'' + locationId + '\')">👑 Flip to Your Control</button>';
            }

            if (!Diplomacy.isDominationDeclared()) {
                html += '<button class="panel-btn" style="background:#660000;border-color:#ff6644;" onclick="UI._declareDomination()">🔥 Declare Domination</button>';
            }

            html += '<p style="color:#ffaa44;font-size:0.8em;">Domination Progress: ' + Diplomacy.getDominationProgress() + '%</p>';
        }

        html += '<button class="panel-btn undock-btn" onclick="Ship.undock()">🚀 Undock</button>';
        html += '</div>';

        // Repair if damaged
        var ship = Ship.getShip();
        if (ship.hp < ship.maxHp) {
            var repairCost = Math.ceil((ship.maxHp - ship.hp) * 5);
            html += '<button class="panel-btn repair-btn" onclick="UI._repair(' + repairCost + ')">🔨 Repair (' + repairCost + ' cr)</button>';
        }

        _elements.panel.innerHTML = html;
        _currentPanel = 'dock';
        _elements.panelContainer.style.display = 'flex';
        _elements.overlay.style.display = 'block';
    }

    // ── Trade Panel ──────────────────────────────────────────

    function _showTradePanel() {
        var ship = Ship.getShip();
        var locId = ship.dockedAt;
        if (!locId) return;

        var loc = World.getLocation(locId);
        var locName = loc ? loc.name : locId;

        _elements.panelTitle.textContent = '🏪 Trade';
        var html = '<p>Credits: 💰' + Economy.getCredits().toLocaleString() + ' | Cargo: ' + Ship.getCargoUsed() + '/' + ship.cargo + ' | Fuel: ' + Ship.getFuelUsed() + '/' + (ship.maxFuel || 0) + '</p>';

        html += '<div class="trade-columns">';

        // LEFT SIDE: Location inventory (buy from)
        html += '<div class="trade-col trade-col-left">';
        html += '<h3 class="trade-col-title">📍 ' + locName + ' Stock</h3>';
        html += '<table class="trade-table">';
        html += '<tr><th>Resource</th><th>Stock</th><th>Price</th><th></th></tr>';

        var lastCategory = '';
        for (var res in Config.RESOURCES) {
            if (!Config.RESOURCES[res].tradeable) continue;
            var rDef = Config.RESOURCES[res];
            if (rDef.category && rDef.category !== lastCategory) {
                lastCategory = rDef.category;
                var catNames = { raw: '⛏️ Raw', processed: '🔧 Processed', consumer: '🛍️ Consumer', military: '⚔️ Military', special: '✨ Special', fuel: '⛽ Fuel' };
                html += '<tr class="trade-cat-row"><td colspan="4"><strong>' + (catNames[lastCategory] || lastCategory) + '</strong></td></tr>';
            }
            var buyP = Economy.getBuyPrice(locId, res);
            var stock = Economy.getStock(locId, res);
            if (!buyP) continue; // Skip resources not available here

            var baseP = Economy.getBasePrice(res) || buyP;
            var buyColor = _getPriceColor(buyP, baseP, 'buy');

            html += '<tr>';
            html += '<td>' + rDef.icon + ' ' + rDef.name + '</td>';
            html += '<td>' + stock + '</td>';
            html += '<td style="color:' + buyColor + '">' + buyP + '</td>';
            html += '<td>';
            if (stock > 0) {
                html += '<button class="sm-btn" onclick="UI._buy(\'' + res + '\',1)">Buy 1</button>';
                html += '<button class="sm-btn" onclick="UI._buy(\'' + res + '\',10)">10</button>';
                html += '<button class="sm-btn" onclick="UI._buy(\'' + res + '\',100)">100</button>';
            }
            html += '</td></tr>';
        }
        html += '</table></div>';

        // RIGHT SIDE: Ship inventory (sell to)
        html += '<div class="trade-col trade-col-right">';
        html += '<h3 class="trade-col-title">🚀 Your Cargo</h3>';
        html += '<table class="trade-table">';
        html += '<tr><th>Resource</th><th>Have</th><th>Price</th><th></th></tr>';

        var hasAnyCargo = false;
        lastCategory = '';
        for (var res2 in Config.RESOURCES) {
            if (!Config.RESOURCES[res2].tradeable) continue;
            var rDef2 = Config.RESOURCES[res2];
            var have = ship.inventory[res2] || 0;
            if (have <= 0) continue;

            hasAnyCargo = true;
            if (rDef2.category && rDef2.category !== lastCategory) {
                lastCategory = rDef2.category;
                var catNames2 = { raw: '⛏️ Raw', processed: '🔧 Processed', consumer: '🛍️ Consumer', military: '⚔️ Military', special: '✨ Special', fuel: '⛽ Fuel' };
                html += '<tr class="trade-cat-row"><td colspan="4"><strong>' + (catNames2[lastCategory] || lastCategory) + '</strong></td></tr>';
            }
            var sellP = Economy.getSellPrice(locId, res2);
            var baseP2 = Economy.getBasePrice(res2);
            var baseSell = baseP2 ? Math.floor(baseP2 * 0.88) : sellP;
            var sellColor = _getPriceColor(sellP, baseSell, 'sell');

            html += '<tr>';
            html += '<td>' + rDef2.icon + ' ' + rDef2.name + '</td>';
            html += '<td>' + have + '</td>';
            html += '<td style="color:' + (sellP ? sellColor : '#666') + '">' + (sellP || '-') + '</td>';
            html += '<td>';
            if (sellP) {
                html += '<button class="sm-btn" onclick="UI._sell(\'' + res2 + '\',1)">Sell 1</button>';
                html += '<button class="sm-btn" onclick="UI._sell(\'' + res2 + '\',10)">10</button>';
                html += '<button class="sm-btn" onclick="UI._sell(\'' + res2 + '\',0)">All</button>';
            }
            html += '</td></tr>';
        }
        if (!hasAnyCargo) {
            html += '<tr><td colspan="4" style="text-align:center;color:#667788;padding:20px;">Cargo is empty</td></tr>';
        }
        html += '</table></div>';

        html += '</div>'; // end trade-columns

        // Show active events affecting this location
        var locEvents = Economy.getActiveEvents(locId);
        if (locEvents.length > 0) {
            html += '<div class="trade-events">';
            html += '<h4>📢 Active Events</h4>';
            for (var ei = 0; ei < locEvents.length; ei++) {
                var ev = locEvents[ei];
                var sevColors = { crisis: '#ff4444', major: '#ff8844', moderate: '#ffcc44', minor: '#88aacc' };
                var sevColor = sevColors[ev.severity] || '#88aacc';
                html += '<div class="trade-event-item" style="border-left-color:' + sevColor + '">';
                html += '<span class="trade-event-name" style="color:' + sevColor + '">' + ev.name + '</span>';
                html += '<span class="trade-event-desc">' + ev.description + '</span>';
                html += '<span class="trade-event-duration">' + ev.remaining + ' cycles left</span>';
                html += '</div>';
            }
            html += '</div>';
        }

        html += '<p class="trade-legend">Price colors: <span style="color:#44cc88">■</span> Good deal | <span style="color:#ccddee">■</span> Average | <span style="color:#ff6666">■</span> Bad deal</p>';
        html += '<button class="panel-btn" onclick="UI.openSub(\'dock\')">← Back</button>';

        _elements.panel.innerHTML = html;
    }

    function _getPriceColor(price, basePrice, mode) {
        if (!price || !basePrice) return '#ccddee';
        var ratio = price / basePrice;
        if (mode === 'buy') {
            // Buying: below average = green (good), above = red (bad)
            if (ratio < 0.9) return '#44cc88';
            if (ratio > 1.1) return '#ff6666';
            return '#ccddee';
        } else {
            // Selling: above average = green (good), below = red (bad)
            if (ratio > 1.1) return '#44cc88';
            if (ratio < 0.9) return '#ff6666';
            return '#ccddee';
        }
    }

    // ── Mission Panel ────────────────────────────────────────

    function _showMissionsPanel() {
        _elements.panelTitle.textContent = '📋 Missions';
        var html = '';

        var active = Missions.getActive();
        if (active.length > 0) {
            html += '<h3>Active Missions (' + active.length + ')</h3>';
            html += '<p style="font-size:10px;color:#667788;margin-bottom:6px;">Press J anytime for full mission tracker</p>';
            for (var i = 0; i < active.length; i++) {
                var m = active[i];
                var typeIcons = { delivery: '📦', combat: '⚔️', escort: '🛡️', spy: '🕵️', sabotage: '💣', diplomatic: '🕊️', mining: '⛏️' };
                var icon = typeIcons[m.type] || '📋';
                var isTracked = (m.id === Missions.getTrackedId());
                html += '<div class="mission-card active' + (isTracked ? ' tracked' : '') + '">';
                html += '<strong>' + icon + ' ' + m.name + '</strong> <span class="mission-type">[' + m.type + ']</span>';
                if (isTracked) html += ' <span style="color:#ffcc44;font-size:10px;">▶ tracked</span>';
                html += '<p>' + m.description + '</p>';
                html += '<p>💰 ' + m.reward.credits;
                if (m.reward.reputation) html += ' | <span style="color:' + _getFactionColorCSS(m.reward.reputation.faction) + '">Rep +' + m.reward.reputation.amount + '</span>';
                html += '</p>';
                html += '<div class="objectives">';
                for (var j = 0; j < m.objectives.length; j++) {
                    var obj = m.objectives[j];
                    var check = obj.done ? '✅' : '⬜';
                    html += '<p>' + check + ' ' + _objectiveText(obj) + '</p>';
                }
                html += '</div></div>';
            }
        }

        var available = Missions.getAvailable();
        if (available.length > 0) {
            html += '<h3>Available Missions</h3>';
            for (var k = 0; k < available.length; k++) {
                var av = available[k];
                var typeIcons2 = { delivery: '📦', combat: '⚔️', escort: '🛡️', spy: '🕵️', sabotage: '💣', diplomatic: '🕊️', mining: '⛏️' };
                var icon2 = typeIcons2[av.type] || '📋';
                html += '<div class="mission-card">';
                html += '<strong>' + icon2 + ' ' + av.name + '</strong> <span class="mission-type">[' + av.type + ']</span>';
                if (av.advancesPath) html += ' <span style="color:#ffcc44;font-size:10px;">⭐ ' + av.advancesPath + '</span>';
                html += '<p>' + av.description + '</p>';
                html += '<p>💰 ' + av.reward.credits;
                if (av.reward.reputation) html += ' | <span style="color:' + _getFactionColorCSS(av.reward.reputation.faction) + '">Rep +' + av.reward.reputation.amount + '</span>';
                html += '</p>';
                html += '<button class="panel-btn" onclick="UI._acceptMission(\'' + av.id + '\')">Accept</button>';
                html += '</div>';
            }
        }

        if (active.length === 0 && available.length === 0) {
            html += '<p>No missions available at this location.</p>';
        }

        html += '<button class="panel-btn" onclick="UI.openSub(\'dock\')">← Back</button>';
        _elements.panel.innerHTML = html;
    }

    // ── Mission Tracker (accessible anytime via J key) ──────

    function _showMissionTracker() {
        _showPanel('mission_tracker');
        _elements.panelTitle.textContent = '📋 Mission Tracker';
        _buildMissionTrackerHTML();
    }

    function _buildMissionTrackerHTML() {
        var active = Missions.getActive();
        var trackedId = Missions.getTrackedId();
        var html = '';

        if (active.length === 0) {
            html += '<div style="text-align:center;padding:20px;color:#88aacc;">';
            html += '<p style="font-size:16px;">No Active Missions</p>';
            html += '<p style="font-size:11px;color:#667788;">Accept missions at stations when docked.</p>';
            html += '</div>';
        } else {
            html += '<p style="color:#88aacc;font-size:11px;margin-bottom:8px;">Click a mission for details. Tracked mission (▶) shows in HUD.</p>';

            for (var i = 0; i < active.length; i++) {
                var m = active[i];
                var isTracked = (m.id === trackedId);
                var typeIcons = { delivery: '📦', combat: '⚔️', escort: '🛡️', spy: '🕵️', sabotage: '💣', diplomatic: '🕊️', mining: '⛏️' };
                var icon = typeIcons[m.type] || '📋';
                var progressPct = _getMissionProgress(m);

                html += '<div class="mission-tracker-card' + (isTracked ? ' tracked' : '') + '" onclick="UI._showMissionDetail(\'' + m.id + '\')">';
                html += '<div class="mission-tracker-header">';
                html += '<span class="mission-tracker-icon">' + icon + '</span>';
                html += '<span class="mission-tracker-name">' + (isTracked ? '▶ ' : '') + m.name + '</span>';
                html += '<span class="mission-tracker-type">[' + m.type + ']</span>';
                html += '</div>';

                // Short objective summary
                html += '<div class="mission-tracker-objectives">';
                for (var j = 0; j < m.objectives.length; j++) {
                    var obj = m.objectives[j];
                    html += '<span class="' + (obj.done ? 'obj-done' : 'obj-pending') + '">';
                    html += (obj.done ? '✅' : '⬜') + ' ' + _objectiveTextShort(obj);
                    html += '</span>';
                }
                html += '</div>';

                // Progress bar
                html += '<div class="mission-progress-bar"><div class="mission-progress-fill" style="width:' + progressPct + '%"></div></div>';

                // Bottom info
                html += '<div class="mission-tracker-info">';
                html += '<span>💰 ' + m.reward.credits + '</span>';
                if (m.reward.reputation) {
                    html += ' <span style="color:' + _getFactionColorCSS(m.reward.reputation.faction) + '">Rep +' + m.reward.reputation.amount + '</span>';
                }
                if (m.advancesPath) {
                    html += ' <span style="color:#ffcc44;">⭐ ' + m.advancesPath + ' path</span>';
                }
                html += '</div>';
                html += '</div>';
            }
        }

        html += '<div style="margin-top:10px;">';
        html += '<button class="panel-btn" onclick="UI.closePanel()">Close [J/ESC]</button>';
        html += '</div>';

        _elements.panel.innerHTML = html;
    }

    function _showMissionDetail(missionId) {
        var m = Missions.getMissionById(missionId);
        if (!m) {
            // Mission no longer exists, go back to tracker
            _showMissionTracker();
            return;
        }

        _showPanel('mission_detail');
        _elements.panelTitle.textContent = '📋 Mission Details';

        var trackedId = Missions.getTrackedId();
        var isTracked = (m.id === trackedId);
        var typeIcons = { delivery: '📦', combat: '⚔️', escort: '🛡️', spy: '🕵️', sabotage: '💣', diplomatic: '🕊️', mining: '⛏️' };
        var icon = typeIcons[m.type] || '📋';

        var html = '';
        html += '<div class="mission-detail">';

        // Title
        html += '<h3>' + icon + ' ' + m.name + '</h3>';
        html += '<p class="mission-detail-type">' + m.type.charAt(0).toUpperCase() + m.type.slice(1) + ' Mission';
        if (m.advancesPath) html += ' — <span style="color:#ffcc44;">⭐ Advances ' + m.advancesPath + ' path</span>';
        html += '</p>';

        // Description
        html += '<div class="mission-detail-desc">' + m.description + '</div>';

        // Faction info
        html += '<p class="mission-detail-faction">From: <span style="color:' + _getFactionColorCSS(m.sourceFaction) + '">' + _factionName(m.sourceFaction) + '</span>';
        if (m.sourceLocation) {
            var srcLoc = World.getLocation(m.sourceLocation);
            html += ' at ' + (srcLoc ? srcLoc.name : m.sourceLocation);
        }
        html += '</p>';

        // Objectives with full detail
        html += '<div class="mission-detail-section"><h4>Objectives</h4>';
        for (var j = 0; j < m.objectives.length; j++) {
            var obj = m.objectives[j];
            var check = obj.done ? '✅' : '⬜';
            html += '<div class="mission-obj-row ' + (obj.done ? 'done' : '') + '">';
            html += check + ' ' + _objectiveText(obj);
            // Progress for collect objectives
            if (obj.type === 'collect' && !obj.done) {
                var pct = Math.min(100, Math.floor(((obj.collected || 0) / obj.amount) * 100));
                html += '<div class="mission-progress-bar small"><div class="mission-progress-fill" style="width:' + pct + '%"></div></div>';
            }
            if (obj.type === 'destroy' && !obj.done) {
                var dPct = Math.min(100, Math.floor(((obj.destroyed || 0) / obj.count) * 100));
                html += '<div class="mission-progress-bar small"><div class="mission-progress-fill" style="width:' + dPct + '%"></div></div>';
            }
            html += '</div>';
        }
        html += '</div>';

        // Destination
        if (m.targetLocation) {
            var destLoc = World.getLocation(m.targetLocation);
            if (destLoc) {
                html += '<div class="mission-detail-section">';
                html += '<h4>Destination</h4>';
                html += '<p>' + destLoc.name + ' <span style="color:#667788;">(' + _factionName(destLoc.faction) + ')</span></p>';
                html += '</div>';
            }
        }

        // Rewards
        html += '<div class="mission-detail-section"><h4>Rewards</h4>';
        html += '<p>💰 ' + m.reward.credits + ' Credits</p>';
        if (m.reward.reputation) {
            html += '<p style="color:' + _getFactionColorCSS(m.reward.reputation.faction) + '">Rep +' + m.reward.reputation.amount + ' with ' + _factionName(m.reward.reputation.faction) + '</p>';
        }
        html += '</div>';

        html += '</div>'; // end mission-detail

        // Action buttons
        html += '<div class="mission-detail-actions">';
        if (!isTracked) {
            html += '<button class="panel-btn track-btn" onclick="UI._trackMission(\'' + m.id + '\')">▶ Track This Mission</button>';
        } else {
            html += '<button class="panel-btn tracked-btn" onclick="UI._untrackMission()">⏹ Untrack Mission</button>';
        }
        html += '<button class="panel-btn abandon-btn" onclick="UI._abandonMission(\'' + m.id + '\')">✖ Abandon Mission</button>';
        html += '</div>';

        html += '<button class="panel-btn" onclick="UI._showMissionTracker()">← Back to Missions</button>';

        _elements.panel.innerHTML = html;
    }

    function _trackMission(missionId) {
        // Validate mission exists before tracking
        if (!Missions.getMissionById(missionId)) return;
        Missions.setTrackedId(missionId);
        showToast('Mission tracked!', 'success');
        _showMissionDetail(missionId);
    }

    function _untrackMission() {
        Missions.setTrackedId(null);
        showToast('Mission untracked.', 'info');
        _showMissionTracker();
    }

    function _abandonMission(missionId) {
        if (Missions.abandonMission(missionId)) {
            showToast('Mission abandoned. Rep penalty applied.', 'warning');
            _showMissionTracker();
        }
    }

    function _getMissionProgress(mission) {
        if (!mission.objectives || mission.objectives.length === 0) return 0;
        var done = 0;
        var total = mission.objectives.length;
        for (var i = 0; i < mission.objectives.length; i++) {
            var obj = mission.objectives[i];
            if (obj.done) { done++; continue; }
            // Partial progress for collect/destroy
            if (obj.type === 'collect' && obj.amount > 0) {
                done += (obj.collected || 0) / obj.amount;
            } else if (obj.type === 'destroy' && obj.count > 0) {
                done += (obj.destroyed || 0) / obj.count;
            }
        }
        return Math.floor((done / total) * 100);
    }

    function _objectiveTextShort(obj) {
        switch (obj.type) {
            case 'go_to':
                var loc = World.getLocation(obj.target);
                return (loc ? loc.name : 'target');
            case 'return': return 'Return';
            case 'destroy': return 'Kill ' + (obj.destroyed || 0) + '/' + obj.count;
            case 'collect':
                var rName = Config.RESOURCES[obj.resource] ? Config.RESOURCES[obj.resource].name : obj.resource;
                return rName + ' ' + (obj.collected || 0) + '/' + obj.amount;
            default: return obj.type;
        }
    }

    // ── Upgrade Panel ────────────────────────────────────────

    // Ship editor state
    var _editorCanvas = null;
    var _editorCtx = null;
    var _editorOpen = false;
    var _editorCellSize = 60;  // px per grid cell
    var _editorOffsetX = 0, _editorOffsetY = 0;
    var _dragBlockType = null;
    var _dragGhost = null;
    var _editorHover = { r: -1, c: -1 };

    function _showUpgradePanel() {
        // Close regular panel and open ship editor overlay instead
        _currentPanel = 'upgrade';
        _elements.panelContainer.style.display = 'none';
        _elements.overlay.style.display = 'none';
        _openShipEditor();
    }

    function _openShipEditor() {
        var overlay = document.getElementById('shipEditorOverlay');
        if (!_editorCanvas) {
            _editorCanvas = document.getElementById('shipEditorCanvas');
            _editorCtx = _editorCanvas.getContext('2d');
            _dragGhost = document.getElementById('dragGhost');

            // Mouse events on editor canvas
            _editorCanvas.addEventListener('mousemove', _editorMouseMove);
            _editorCanvas.addEventListener('mouseup', _editorMouseUp);
            _editorCanvas.addEventListener('click', _editorClick);
            _editorCanvas.addEventListener('contextmenu', function (e) { e.preventDefault(); _editorRightClick(e); });

            // Drag events on the whole overlay
            overlay.addEventListener('mousemove', _editorDragMove);
            overlay.addEventListener('mouseup', _editorDragEnd);
        }

        overlay.style.display = 'block';
        _editorOpen = true;
        _buildShopPanel();
        _renderEditor();
    }

    function _closeShipEditor() {
        document.getElementById('shipEditorOverlay').style.display = 'none';
        _editorOpen = false;
        _dragBlockType = null;
        _dragGhost.style.display = 'none';
        // Go back to dock
        var ship = Ship.getShip();
        if (ship.docked) {
            _currentPanel = null;
            _showDockPanel(ship.dockedAt);
        } else {
            _currentPanel = null;
            _elements.panelContainer.style.display = 'none';
            _elements.overlay.style.display = 'none';
        }
    }

    function _classifyShip(stats, grid) {
        var weaponCount = stats.weapons.length;
        var shieldHP = stats.shieldHP;
        var cargo = stats.cargoCapacity;
        var diplo = stats.diploBonus;
        var thrust = stats.totalThrust;
        var weight = stats.totalWeight;
        var scanRange = stats.scanRange;
        var repairRate = stats.repairRate;
        var ratio = weight > 0 ? thrust / weight : 0;
        
        // Score each role
        var scores = {
            fighter: weaponCount * 3 + (shieldHP > 0 ? 1 : 0) + (ratio > 0.2 ? 2 : 0),
            bomber: 0,
            tank: (shieldHP / 30) + (stats.totalHP / 100) + (weight > 100 ? 2 : 0),
            trader: (cargo / 30) + (weaponCount === 0 ? 2 : 0),
            scout: (ratio > 0.3 ? 3 : 0) + (scanRange > 300 ? 2 : 0) + (weight < 50 ? 2 : 0),
            diplomat: diplo * 12 + (cargo > 0 ? 1 : 0),
            support: (repairRate * 4) + (shieldHP > 80 ? 1 : 0),
            carrier: stats.blockCount > 20 ? 2 : 0
        };
        // Boost bomber for heavy weapons
        for (var wi = 0; wi < weaponCount; wi++) {
            var wd = stats.weapons[wi].def;
            if (wd && wd.damage >= 30) scores.bomber += 2;
        }
        
        var best = 'fighter';
        var bestScore = -1;
        for (var role in scores) {
            if (scores[role] > bestScore) { bestScore = scores[role]; best = role; }
        }
        
        var classifications = {
            fighter:  { name: '⚔️ Combat Fighter',       desc: 'Fast and agile with weapons focused loadout. Built for dogfights.' },
            bomber:   { name: '💣 Heavy Bomber',          desc: 'Equipped with heavy ordnance for devastating strikes on large targets.' },
            tank:     { name: '🛡️ Armored Cruiser',       desc: 'Heavy armor and shields designed to absorb punishment in prolonged engagements.' },
            trader:   { name: '📦 Trade Vessel',          desc: 'Large cargo capacity optimized for commerce and resource transportation.' },
            scout:    { name: '🔭 Recon Scout',           desc: 'Lightweight and fast with advanced sensors. Built for exploration and intelligence.' },
            diplomat: { name: '🕊️ Diplomatic Envoy',      desc: 'Equipped with diplomatic suites for negotiations and peace missions.' },
            support:  { name: '🔧 Support Frigate',       desc: 'Repair systems and shields focused on keeping allies operational.' },
            carrier:  { name: '🚀 Fleet Carrier',         desc: 'Large hull designed to coordinate and support fleet operations.' }
        };
        
        if (weaponCount === 0 && cargo === 0 && diplo === 0) {
            return { name: '🔩 Unclassified Hull', desc: 'Bare hull with no specialized systems. Add blocks to define its role.' };
        }
        
        return classifications[best] || classifications.fighter;
    }

    function _buildShopPanel() {
        var statsBar = document.getElementById('shipEditorStatsBar');
        var shop = document.getElementById('shipEditorShop');
        var ship = Ship.getShip();
        var grid = ship.grid;
        var stats = grid.stats || ShipGrid.deriveStats(grid);
        var hc = Config.HULL_CLASSES[grid.hullClass];

        // ── Stats bar (top, landscape) ──
        var shtml = '';
        var classification = _classifyShip(stats, grid);
        
        shtml += '<div class="stats-bar-header">';
        shtml += '<h3 style="margin:0 0 2px 0;color:#0f8;font-size:16px;">' + classification.name + '</h3>';
        shtml += '<p style="color:#aaa;margin:0 0 6px 0;font-size:11px;">' + classification.desc + '</p>';
        shtml += '<span style="color:#ffcc44;font-size:12px;">💰 ' + Economy.getCredits().toLocaleString() + ' credits</span>';
        shtml += '</div>';
        
        shtml += '<div class="stats-bar-columns">';
        
        // Column 1: Hull & Propulsion
        shtml += '<div class="stats-col">';
        shtml += '<table class="stat-table">';
        shtml += '<tr><td colspan="2" class="stat-header">Hull &amp; Structure</td></tr>';
        shtml += '<tr><td>Class</td><td>' + (hc ? hc.name : grid.hullClass) + ' (' + grid.w + '×' + grid.h + ')</td></tr>';
        shtml += '<tr><td>Hull HP</td><td>' + Math.ceil(stats.totalHP) + '</td></tr>';
        shtml += '<tr><td>Shield HP</td><td>' + Math.ceil(stats.shieldHP) + (stats.shieldRegen > 0 ? ' <span style="color:#4466ff">(+' + stats.effectiveShieldRegen.toFixed(1) + '/s)</span>' : '') + '</td></tr>';
        shtml += '<tr><td>Weight</td><td>' + stats.totalWeight + ' tons</td></tr>';
        shtml += '<tr><td>Blocks</td><td>' + stats.blockCount + '/' + (grid.w * grid.h) + '</td></tr>';
        shtml += '</table>';
        shtml += '</div>';
        
        // Column 2: Propulsion
        shtml += '<div class="stats-col">';
        shtml += '<table class="stat-table">';
        shtml += '<tr><td colspan="2" class="stat-header">Propulsion</td></tr>';
        shtml += '<tr><td>Thrust</td><td>' + stats.effectiveThrust.toFixed(0) + ' (' + stats.totalThrust + ' raw)</td></tr>';
        shtml += '<tr><td>Max Speed</td><td>' + stats.maxSpeed.toFixed(1) + '</td></tr>';
        shtml += '<tr><td>Acceleration</td><td>' + stats.acceleration.toFixed(3) + '</td></tr>';
        shtml += '<tr><td>T/W Ratio</td><td>' + (stats.totalWeight > 0 ? (stats.totalThrust / stats.totalWeight).toFixed(3) : '0') + '</td></tr>';
        shtml += '<tr><td>Engines</td><td>' + stats.engines.length + '</td></tr>';
        shtml += '</table>';
        shtml += '</div>';
        
        // Column 3: Fuel System
        shtml += '<div class="stats-col">';
        shtml += '<table class="stat-table">';
        shtml += '<tr><td colspan="2" class="stat-header">Fuel System</td></tr>';
        shtml += '<tr><td>Capacity</td><td>' + stats.fuelCapacity + ' units</td></tr>';
        var fuelInv = Ship.getFuelUsed();
        shtml += '<tr><td>Stored</td><td>' + fuelInv + '/' + stats.fuelCapacity + '</td></tr>';
        var fuelTypeNames = [];
        for (var ft in stats.fuelTypes) {
            var fuelRes = Config.RESOURCES[ft];
            var rate = stats.fuelTypes[ft];
            var stored = ship.inventory[ft] || 0;
            fuelTypeNames.push((fuelRes ? fuelRes.icon + ' ' + fuelRes.name : ft) + ' (' + stored + ', ' + rate.toFixed(2) + '/t)');
        }
        if (fuelTypeNames.length > 0) {
            for (var fti = 0; fti < fuelTypeNames.length; fti++) {
                shtml += '<tr><td>Fuel ' + (fti + 1) + '</td><td style="font-size:10px;">' + fuelTypeNames[fti] + '</td></tr>';
            }
            var minTicks = Infinity;
            for (var ftt in stats.fuelTypes) {
                var fuelAmt = ship.inventory[ftt] || 0;
                var fuelRate = stats.fuelTypes[ftt];
                if (fuelRate > 0) minTicks = Math.min(minTicks, fuelAmt / fuelRate);
            }
            if (minTicks !== Infinity && minTicks > 0) {
                var rangeSec = minTicks * 0.1;
                shtml += '<tr><td>Range</td><td>' + (rangeSec > 60 ? (rangeSec / 60).toFixed(1) + ' min' : rangeSec.toFixed(0) + ' sec') + '</td></tr>';
            }
        } else {
            shtml += '<tr><td>Type</td><td style="color:#ff6644;">No engines</td></tr>';
        }
        shtml += '</table>';
        shtml += '</div>';
        
        // Column 4: Power Grid
        shtml += '<div class="stats-col">';
        shtml += '<table class="stat-table">';
        shtml += '<tr><td colspan="2" class="stat-header">Power Grid</td></tr>';
        shtml += '<tr><td>Generation</td><td>' + stats.totalPowerGen + '</td></tr>';
        shtml += '<tr><td>Draw</td><td>' + stats.totalPowerDraw + '</td></tr>';
        var powerBal = stats.totalPowerGen - stats.totalPowerDraw;
        shtml += '<tr><td>Balance</td><td>';
        if (powerBal >= 0) {
            shtml += '<span style="color:#0f8;">+' + powerBal + '</span>';
        } else {
            shtml += '<span style="color:#ff4444;">' + powerBal + ' (' + Math.floor(stats.powerRatio * 100) + '%)</span>';
        }
        shtml += '</td></tr>';
        var hasSolar = false, hasFusionGen = false;
        for (var pr = 0; pr < grid.h; pr++) {
            for (var pcol = 0; pcol < grid.w; pcol++) {
                var pcell = grid.cells[pr][pcol];
                if (pcell && pcell.hp > 0) {
                    if (pcell.type === 'power_solar') hasSolar = true;
                    if (pcell.type === 'power_fusion_gen') hasFusionGen = true;
                }
            }
        }
        var powerSources = [];
        if (hasSolar) powerSources.push('☀️ Solar');
        if (hasFusionGen) powerSources.push('⚛️ Fusion');
        var pcCount = 0;
        for (var pr2 = 0; pr2 < grid.h; pr2++) { for (var pc2 = 0; pc2 < grid.w; pc2++) { if (grid.cells[pr2][pc2] && grid.cells[pr2][pc2].type === 'power_core') pcCount++; } }
        if (pcCount > 0) powerSources.push('🔋 Core ×' + pcCount);
        shtml += '<tr><td>Sources</td><td style="font-size:10px;">' + (powerSources.length > 0 ? powerSources.join(', ') : 'None') + '</td></tr>';
        shtml += '</table>';
        shtml += '</div>';
        
        // Column 5: Weapons & Cargo & Specials
        shtml += '<div class="stats-col">';
        shtml += '<table class="stat-table">';
        shtml += '<tr><td colspan="2" class="stat-header">Weapons (' + stats.weapons.length + ')</td></tr>';
        if (stats.weapons.length > 0) {
            var wpnSummary = {};
            var totalDPS = 0;
            for (var wi = 0; wi < stats.weapons.length; wi++) {
                var w = stats.weapons[wi];
                var wd = w.def;
                wpnSummary[wd.name] = (wpnSummary[wd.name] || 0) + 1;
                if (wd.damage && wd.fireRate) totalDPS += (wd.damage / (wd.fireRate * 0.1));
            }
            for (var wn in wpnSummary) {
                shtml += '<tr><td>' + wn + '</td><td>×' + wpnSummary[wn] + '</td></tr>';
            }
            shtml += '<tr><td>DPS</td><td style="color:#ff6644;">' + totalDPS.toFixed(1) + '</td></tr>';
        } else {
            shtml += '<tr><td colspan="2" style="color:#666;">None</td></tr>';
        }
        shtml += '<tr><td colspan="2" class="stat-header">Cargo</td></tr>';
        shtml += '<tr><td>Capacity</td><td>' + stats.cargoCapacity + '</td></tr>';
        shtml += '<tr><td>Used</td><td>' + Ship.getCargoUsed() + '/' + stats.cargoCapacity + '</td></tr>';
        var specials = [];
        if (stats.scanRange > 200) specials.push('🔭 ' + stats.scanRange);
        if (stats.repairRate > 0) specials.push('🔧 ' + stats.repairRate.toFixed(1) + '/s');
        if (stats.diploBonus > 0) specials.push('🕊️ +' + Math.floor(stats.diploBonus * 100) + '%');
        if (specials.length > 0) {
            shtml += '<tr><td colspan="2" class="stat-header">Special</td></tr>';
            shtml += '<tr><td colspan="2">' + specials.join(' | ') + '</td></tr>';
        }
        shtml += '</table>';
        shtml += '</div>';
        
        shtml += '</div>'; // end stats-bar-columns
        
        statsBar.innerHTML = shtml;

        // ── Shop panel (right side) ──
        var html = '';
        html += '<h3>Select a block, then click grid to place</h3>';
        html += '<p style="color:#666;font-size:10px;margin-bottom:6px;">Click block to select &amp; view details. Click grid to place. Right-click grid to remove.</p>';

        var categories = {};
        for (var bk in Config.BLOCK_TYPES) {
            var bd = Config.BLOCK_TYPES[bk];
            if (!categories[bd.cat]) categories[bd.cat] = [];
            categories[bd.cat].push({ key: bk, def: bd });
        }
        for (var cat in categories) {
            html += '<h4>' + cat + '</h4>';
            for (var bi = 0; bi < categories[cat].length; bi++) {
                var b = categories[cat][bi];
                var isActive = (window._selectedBlock === b.key);
                html += '<div class="shop-block' + (isActive ? ' active-part' : '') + '" data-block="' + b.key + '" onclick="UI._selectBlockAndDetail(\'' + b.key + '\')" style="cursor:pointer;">';
                html += '<span class="swatch" style="background:' + b.def.color + '"></span>';
                html += '<strong>' + b.def.name + '</strong>';
                html += '<p>HP:' + b.def.hp + ' Wt:' + b.def.weight;
                if (b.def.powerGen) html += ' P+' + b.def.powerGen;
                if (b.def.powerDraw) html += ' P-' + b.def.powerDraw;
                if (b.def.thrust) html += ' T:' + b.def.thrust;
                if (b.def.speedBoost) html += ' Spd+' + b.def.speedBoost;
                if (b.def.damage) html += ' D:' + b.def.damage;
                if (b.def.shieldHP) html += ' S:' + b.def.shieldHP;
                if (b.def.cargoCapacity) html += ' C:' + b.def.cargoCapacity;
                if (b.def.fuelCapacity) html += ' F:' + b.def.fuelCapacity;
                html += '</p>';
                html += '<span class="cost">' + b.def.cost + ' cr</span>';
                if (b.def.materials && Object.keys(b.def.materials).length > 0) {
                    var matParts = [];
                    for (var mk in b.def.materials) {
                        var mIcon = Config.RESOURCES[mk] ? Config.RESOURCES[mk].icon : '';
                        matParts.push(mIcon + b.def.materials[mk]);
                    }
                    html += '<br><span style="color:#ccaa66;font-size:10px;">⚒ ' + matParts.join(' ') + '</span>';
                }
                html += ' <span style="color:#666;font-size:9px;">' + (b.def.placement || 'any') + '</span>';
                html += '</div>';
            }
        }

        // Hull class upgrades
        html += '<h3>Hull Class</h3>';
        for (var hk in Config.HULL_CLASSES) {
            var hcDef = Config.HULL_CLASSES[hk];
            var isCurrent = (grid.hullClass === hk);
            html += '<div class="shop-block' + (isCurrent ? ' selected' : '') + '" style="cursor:pointer;" onclick="UI._changeHullClass(\'' + hk + '\',' + hcDef.cost + ')">';
            html += '<strong>' + hcDef.name + '</strong> (' + hcDef.gridW + '×' + hcDef.gridH + ')';
            html += '<p>Spd:' + hcDef.maxSpeed + ' Mass:' + hcDef.baseMass + '</p>';
            if (isCurrent) html += '<span style="color:#0f8">✓ Current</span>';
            else html += '<span class="cost">' + hcDef.cost + ' cr</span>';
            html += '</div>';
        }

        // Repair
        var repairCost = _getRepairCost();
        html += '<h3>Repair</h3>';
        if (repairCost > 0) {
            html += '<button class="editor-btn" onclick="UI._repairAll(' + repairCost + ')">🔧 Repair All (' + repairCost + ' cr)</button>';
        } else {
            html += '<p style="color:#0f8">Ship fully repaired.</p>';
        }

        html += '<div style="margin-top:12px;">';
        html += '<button class="editor-btn danger" onclick="UI._closeShipEditor()">← Back to Dock</button>';
        html += '</div>';

        shop.innerHTML = html;
    }

    // Draw a detailed block representation for the ship editor
    function _drawBlockDetailed(ctx, x, y, sz, cell, def) {
        var damaged = cell.hp <= 0;
        var halfDmg = cell.hp < cell.maxHp * 0.5;
        
        // Base fill
        if (damaged) {
            ctx.fillStyle = 'rgba(30,30,30,0.6)';
            ctx.fillRect(x, y, sz, sz);
            // Destroyed X mark
            ctx.strokeStyle = '#ff2222';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(x + 4, y + 4); ctx.lineTo(x + sz - 4, y + sz - 4);
            ctx.moveTo(x + sz - 4, y + 4); ctx.lineTo(x + 4, y + sz - 4);
            ctx.stroke();
            return;
        }
        
        var baseColor = halfDmg ? _darkenHex(def.color, 40) : def.color;
        ctx.fillStyle = baseColor;
        ctx.fillRect(x, y, sz, sz);
        
        var cx = x + sz / 2;
        var cy = y + sz / 2;
        var m = sz * 0.08; // margin unit
        
        switch (cell.type) {
            case 'hull_basic':
                // Metal plate with rivet pattern
                ctx.strokeStyle = _darkenHex(def.color, 30);
                ctx.lineWidth = 1;
                ctx.strokeRect(x + m * 2, y + m * 2, sz - m * 4, sz - m * 4);
                // Rivets in corners
                ctx.fillStyle = '#889aaa';
                var rivSz = Math.max(2, sz * 0.06);
                ctx.fillRect(x + m * 3, y + m * 3, rivSz, rivSz);
                ctx.fillRect(x + sz - m * 3 - rivSz, y + m * 3, rivSz, rivSz);
                ctx.fillRect(x + m * 3, y + sz - m * 3 - rivSz, rivSz, rivSz);
                ctx.fillRect(x + sz - m * 3 - rivSz, y + sz - m * 3 - rivSz, rivSz, rivSz);
                // Horizontal seam
                ctx.strokeStyle = 'rgba(0,0,0,0.2)';
                ctx.beginPath();
                ctx.moveTo(x + m * 2, cy);
                ctx.lineTo(x + sz - m * 2, cy);
                ctx.stroke();
                break;
                
            case 'hull_armored':
                // Heavy plating with chevron pattern
                ctx.strokeStyle = _darkenHex(def.color, 25);
                ctx.lineWidth = 1.5;
                ctx.strokeRect(x + m, y + m, sz - m * 2, sz - m * 2);
                // Chevron armor lines
                ctx.strokeStyle = 'rgba(200,210,220,0.25)';
                ctx.lineWidth = 1;
                for (var ai = 0; ai < 3; ai++) {
                    var ay = y + sz * 0.25 + ai * sz * 0.2;
                    ctx.beginPath();
                    ctx.moveTo(x + m * 2, ay + sz * 0.1);
                    ctx.lineTo(cx, ay);
                    ctx.lineTo(x + sz - m * 2, ay + sz * 0.1);
                    ctx.stroke();
                }
                // Bolt pattern
                ctx.fillStyle = '#99aabb';
                var bsz = Math.max(2, sz * 0.05);
                ctx.fillRect(x + m * 2, y + m * 2, bsz, bsz);
                ctx.fillRect(x + sz - m * 2 - bsz, y + m * 2, bsz, bsz);
                ctx.fillRect(x + m * 2, y + sz - m * 2 - bsz, bsz, bsz);
                ctx.fillRect(x + sz - m * 2 - bsz, y + sz - m * 2 - bsz, bsz, bsz);
                ctx.fillRect(cx - bsz / 2, y + m * 2, bsz, bsz);
                ctx.fillRect(cx - bsz / 2, y + sz - m * 2 - bsz, bsz, bsz);
                break;
                
            case 'cockpit':
                // Cockpit with window canopy
                ctx.fillStyle = _darkenHex(def.color, 20);
                ctx.fillRect(x, y, sz, sz);
                // Windshield (dome shape)
                ctx.fillStyle = '#225566';
                ctx.beginPath();
                ctx.ellipse(cx, cy - sz * 0.05, sz * 0.32, sz * 0.38, 0, 0, Math.PI * 2);
                ctx.fill();
                // Glass reflection
                ctx.fillStyle = 'rgba(100,220,255,0.4)';
                ctx.beginPath();
                ctx.ellipse(cx, cy - sz * 0.08, sz * 0.25, sz * 0.3, 0, 0, Math.PI * 2);
                ctx.fill();
                // Reflection highlight
                ctx.fillStyle = 'rgba(180,255,255,0.3)';
                ctx.beginPath();
                ctx.ellipse(cx - sz * 0.08, cy - sz * 0.18, sz * 0.08, sz * 0.12, -0.3, 0, Math.PI * 2);
                ctx.fill();
                // HUD indicator dots
                ctx.fillStyle = '#00ff88';
                ctx.fillRect(cx - sz * 0.15, cy + sz * 0.12, sz * 0.04, sz * 0.04);
                ctx.fillStyle = '#ffaa00';
                ctx.fillRect(cx, cy + sz * 0.12, sz * 0.04, sz * 0.04);
                ctx.fillStyle = '#ff4444';
                ctx.fillRect(cx + sz * 0.15, cy + sz * 0.12, sz * 0.04, sz * 0.04);
                break;
                
            case 'power_core':
                // Glowing power core with energy rings
                ctx.fillStyle = '#332200';
                ctx.fillRect(x, y, sz, sz);
                // Central glow
                var pcGrad = ctx.createRadialGradient(cx, cy, sz * 0.05, cx, cy, sz * 0.4);
                pcGrad.addColorStop(0, '#ffee66');
                pcGrad.addColorStop(0.4, '#ffaa22');
                pcGrad.addColorStop(1, 'rgba(255,120,0,0.1)');
                ctx.fillStyle = pcGrad;
                ctx.beginPath();
                ctx.arc(cx, cy, sz * 0.4, 0, Math.PI * 2);
                ctx.fill();
                // Energy rings
                ctx.strokeStyle = 'rgba(255,200,50,0.5)';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.arc(cx, cy, sz * 0.25, 0, Math.PI * 2);
                ctx.stroke();
                ctx.strokeStyle = 'rgba(255,200,50,0.25)';
                ctx.beginPath();
                ctx.arc(cx, cy, sz * 0.38, 0, Math.PI * 2);
                ctx.stroke();
                break;
                
            case 'engine_chemical':
                // Rocket nozzle
                ctx.fillStyle = '#553322';
                ctx.fillRect(x, y, sz, sz);
                // Nozzle cone
                ctx.fillStyle = '#aa6633';
                ctx.beginPath();
                ctx.moveTo(cx - sz * 0.35, y + m * 2);
                ctx.lineTo(cx + sz * 0.35, y + m * 2);
                ctx.lineTo(cx + sz * 0.2, y + sz - m * 2);
                ctx.lineTo(cx - sz * 0.2, y + sz - m * 2);
                ctx.closePath();
                ctx.fill();
                // Nozzle interior
                ctx.fillStyle = '#331100';
                ctx.beginPath();
                ctx.ellipse(cx, y + sz - m * 3, sz * 0.15, sz * 0.06, 0, 0, Math.PI * 2);
                ctx.fill();
                // Exhaust glow
                ctx.fillStyle = 'rgba(255,120,20,0.5)';
                ctx.beginPath();
                ctx.moveTo(cx - sz * 0.12, y + sz - m * 2);
                ctx.lineTo(cx, y + sz + m);
                ctx.lineTo(cx + sz * 0.12, y + sz - m * 2);
                ctx.fill();
                break;
                
            case 'engine_ion':
                // Blue ion thruster grid
                ctx.fillStyle = '#112233';
                ctx.fillRect(x, y, sz, sz);
                // Thruster housing
                ctx.fillStyle = '#334466';
                ctx.fillRect(x + m * 2, y + m * 2, sz - m * 4, sz - m * 3);
                // Ion emitter grid (dots)
                ctx.fillStyle = '#66ccff';
                var ionStep = sz / 5;
                for (var ir = 1; ir < 4; ir++) {
                    for (var ic = 1; ic < 4; ic++) {
                        ctx.beginPath();
                        ctx.arc(x + ic * ionStep + ionStep * 0.1, y + ir * ionStep, sz * 0.04, 0, Math.PI * 2);
                        ctx.fill();
                    }
                }
                // Blue glow at bottom
                var ionGrad = ctx.createLinearGradient(x, y + sz * 0.7, x, y + sz);
                ionGrad.addColorStop(0, 'rgba(68,170,255,0)');
                ionGrad.addColorStop(1, 'rgba(68,170,255,0.4)');
                ctx.fillStyle = ionGrad;
                ctx.fillRect(x + m * 2, y + sz * 0.7, sz - m * 4, sz * 0.3);
                break;
                
            case 'engine_plasma':
                // Purple plasma containment
                ctx.fillStyle = '#1a0a2a';
                ctx.fillRect(x, y, sz, sz);
                // Containment ring
                ctx.strokeStyle = '#9944cc';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(cx, cy, sz * 0.3, 0, Math.PI * 2);
                ctx.stroke();
                // Plasma swirl inside
                ctx.fillStyle = 'rgba(200,80,255,0.6)';
                ctx.beginPath();
                ctx.arc(cx - sz * 0.08, cy - sz * 0.05, sz * 0.12, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = 'rgba(255,120,255,0.4)';
                ctx.beginPath();
                ctx.arc(cx + sz * 0.1, cy + sz * 0.08, sz * 0.1, 0, Math.PI * 2);
                ctx.fill();
                // Bottom exhaust
                ctx.fillStyle = 'rgba(200,100,255,0.5)';
                ctx.beginPath();
                ctx.moveTo(cx - sz * 0.15, y + sz - m * 2);
                ctx.lineTo(cx, y + sz + m);
                ctx.lineTo(cx + sz * 0.15, y + sz - m * 2);
                ctx.fill();
                break;
                
            case 'engine_fusion':
                // Fusion drive with toroidal chamber
                ctx.fillStyle = '#220a1a';
                ctx.fillRect(x, y, sz, sz);
                // Torus shape
                ctx.strokeStyle = '#ff44aa';
                ctx.lineWidth = 2.5;
                ctx.beginPath();
                ctx.ellipse(cx, cy - sz * 0.05, sz * 0.3, sz * 0.22, 0, 0, Math.PI * 2);
                ctx.stroke();
                // Central hot spot
                var fuGrad = ctx.createRadialGradient(cx, cy - sz * 0.05, 0, cx, cy - sz * 0.05, sz * 0.15);
                fuGrad.addColorStop(0, '#ffffff');
                fuGrad.addColorStop(0.5, '#ff88cc');
                fuGrad.addColorStop(1, 'rgba(255,68,170,0)');
                ctx.fillStyle = fuGrad;
                ctx.beginPath();
                ctx.arc(cx, cy - sz * 0.05, sz * 0.15, 0, Math.PI * 2);
                ctx.fill();
                // Exhaust
                ctx.fillStyle = 'rgba(255,100,180,0.6)';
                ctx.beginPath();
                ctx.moveTo(cx - sz * 0.2, y + sz - m);
                ctx.lineTo(cx, y + sz + m * 2);
                ctx.lineTo(cx + sz * 0.2, y + sz - m);
                ctx.fill();
                break;
                
            case 'weapon_laser':
                // Laser cannon barrel
                ctx.fillStyle = '#330000';
                ctx.fillRect(x, y, sz, sz);
                // Barrel
                ctx.fillStyle = '#884444';
                ctx.fillRect(cx - sz * 0.06, y + m, sz * 0.12, sz * 0.65);
                // Barrel tip glow
                ctx.fillStyle = '#ff2222';
                ctx.beginPath();
                ctx.arc(cx, y + m * 2, sz * 0.08, 0, Math.PI * 2);
                ctx.fill();
                // Laser beam hint
                ctx.strokeStyle = 'rgba(255,50,50,0.6)';
                ctx.lineWidth = 1;
                ctx.setLineDash([3, 3]);
                ctx.beginPath();
                ctx.moveTo(cx, y);
                ctx.lineTo(cx, y - sz * 0.2);
                ctx.stroke();
                ctx.setLineDash([]);
                // Housing
                ctx.fillStyle = '#664444';
                ctx.fillRect(cx - sz * 0.2, cy + sz * 0.05, sz * 0.4, sz * 0.3);
                // Power conduit
                ctx.fillStyle = '#ff6644';
                ctx.fillRect(cx - sz * 0.04, cy + sz * 0.12, sz * 0.08, sz * 0.15);
                break;
                
            case 'weapon_missile':
                // Missile rack with tubes
                ctx.fillStyle = '#331a00';
                ctx.fillRect(x, y, sz, sz);
                // Missile tubes (3 tubes)
                ctx.fillStyle = '#555555';
                for (var mt = 0; mt < 3; mt++) {
                    var mtx = x + sz * 0.2 + mt * sz * 0.22;
                    ctx.fillRect(mtx, y + m * 2, sz * 0.14, sz * 0.6);
                    // Missile tip
                    ctx.fillStyle = '#ff6644';
                    ctx.beginPath();
                    ctx.moveTo(mtx, y + m * 2);
                    ctx.lineTo(mtx + sz * 0.07, y + m);
                    ctx.lineTo(mtx + sz * 0.14, y + m * 2);
                    ctx.fill();
                    ctx.fillStyle = '#555555';
                }
                // Rack frame
                ctx.strokeStyle = '#777777';
                ctx.lineWidth = 1;
                ctx.strokeRect(x + sz * 0.15, y + m * 2, sz * 0.7, sz * 0.65);
                break;
                
            case 'weapon_railgun':
                // Long rail with electromagnetic coils
                ctx.fillStyle = '#332200';
                ctx.fillRect(x, y, sz, sz);
                // Rails (two parallel)
                ctx.fillStyle = '#aa8822';
                ctx.fillRect(cx - sz * 0.15, y + m, sz * 0.05, sz * 0.8);
                ctx.fillRect(cx + sz * 0.1, y + m, sz * 0.05, sz * 0.8);
                // Coils
                ctx.strokeStyle = '#ddaa44';
                ctx.lineWidth = 1;
                for (var rc = 0; rc < 4; rc++) {
                    var rcy = y + m * 3 + rc * sz * 0.18;
                    ctx.beginPath();
                    ctx.moveTo(cx - sz * 0.2, rcy);
                    ctx.lineTo(cx + sz * 0.2, rcy);
                    ctx.stroke();
                }
                // Projectile glow at tip
                ctx.fillStyle = '#ffdd44';
                ctx.beginPath();
                ctx.arc(cx, y + m * 2, sz * 0.06, 0, Math.PI * 2);
                ctx.fill();
                // Capacitor bank
                ctx.fillStyle = '#887722';
                ctx.fillRect(x + m * 2, y + sz * 0.75, sz - m * 4, sz * 0.15);
                break;
                
            case 'weapon_torpedo':
                // Large torpedo bay
                ctx.fillStyle = '#330000';
                ctx.fillRect(x, y, sz, sz);
                // Torpedo shape
                ctx.fillStyle = '#884444';
                ctx.beginPath();
                ctx.ellipse(cx, cy - sz * 0.05, sz * 0.12, sz * 0.35, 0, 0, Math.PI * 2);
                ctx.fill();
                // Warhead (red tip)
                ctx.fillStyle = '#ff2222';
                ctx.beginPath();
                ctx.arc(cx, y + m * 3, sz * 0.1, Math.PI, 0);
                ctx.fill();
                // Fins
                ctx.fillStyle = '#666666';
                ctx.fillRect(cx - sz * 0.25, cy + sz * 0.2, sz * 0.1, sz * 0.12);
                ctx.fillRect(cx + sz * 0.15, cy + sz * 0.2, sz * 0.1, sz * 0.12);
                // Bay door frame
                ctx.strokeStyle = '#664444';
                ctx.lineWidth = 2;
                ctx.strokeRect(x + m * 2, y + m, sz - m * 4, sz - m * 2);
                break;
                
            case 'shield_basic':
                // Shield generator with energy field
                ctx.fillStyle = '#111144';
                ctx.fillRect(x, y, sz, sz);
                // Generator dome
                ctx.fillStyle = '#223366';
                ctx.beginPath();
                ctx.arc(cx, cy, sz * 0.3, 0, Math.PI * 2);
                ctx.fill();
                // Shield field arcs
                ctx.strokeStyle = 'rgba(80,120,255,0.6)';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.arc(cx, cy, sz * 0.38, -Math.PI * 0.7, -Math.PI * 0.3);
                ctx.stroke();
                ctx.beginPath();
                ctx.arc(cx, cy, sz * 0.38, Math.PI * 0.1, Math.PI * 0.5);
                ctx.stroke();
                // Core glow
                var sgGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, sz * 0.2);
                sgGrad.addColorStop(0, 'rgba(100,150,255,0.6)');
                sgGrad.addColorStop(1, 'rgba(50,80,200,0)');
                ctx.fillStyle = sgGrad;
                ctx.beginPath();
                ctx.arc(cx, cy, sz * 0.2, 0, Math.PI * 2);
                ctx.fill();
                break;
                
            case 'shield_heavy':
                // Heavy shield with multiple layers
                ctx.fillStyle = '#0a0a33';
                ctx.fillRect(x, y, sz, sz);
                // Triple ring
                ctx.strokeStyle = 'rgba(40,80,220,0.7)';
                ctx.lineWidth = 2;
                ctx.beginPath(); ctx.arc(cx, cy, sz * 0.38, 0, Math.PI * 2); ctx.stroke();
                ctx.strokeStyle = 'rgba(60,100,240,0.5)';
                ctx.beginPath(); ctx.arc(cx, cy, sz * 0.28, 0, Math.PI * 2); ctx.stroke();
                ctx.strokeStyle = 'rgba(80,120,255,0.3)';
                ctx.beginPath(); ctx.arc(cx, cy, sz * 0.18, 0, Math.PI * 2); ctx.stroke();
                // Core
                var hsGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, sz * 0.15);
                hsGrad.addColorStop(0, '#aaccff');
                hsGrad.addColorStop(1, 'rgba(40,80,200,0)');
                ctx.fillStyle = hsGrad;
                ctx.beginPath();
                ctx.arc(cx, cy, sz * 0.15, 0, Math.PI * 2);
                ctx.fill();
                break;
                
            case 'power_solar':
                // Solar panel grid
                ctx.fillStyle = '#112244';
                ctx.fillRect(x, y, sz, sz);
                // Panel cells
                var panelCols = 3, panelRows = 4;
                var pw = (sz - m * 6) / panelCols;
                var ph = (sz - m * 6) / panelRows;
                for (var spr = 0; spr < panelRows; spr++) {
                    for (var spc = 0; spc < panelCols; spc++) {
                        ctx.fillStyle = (spr + spc) % 2 === 0 ? '#3366aa' : '#4488cc';
                        ctx.fillRect(x + m * 3 + spc * pw, y + m * 3 + spr * ph, pw - 1, ph - 1);
                    }
                }
                // Grid lines
                ctx.strokeStyle = '#556688';
                ctx.lineWidth = 0.5;
                ctx.strokeRect(x + m * 2, y + m * 2, sz - m * 4, sz - m * 4);
                break;
                
            case 'power_fusion_gen':
                // Fusion generator — tokamak style
                ctx.fillStyle = '#222200';
                ctx.fillRect(x, y, sz, sz);
                // Torus/ring
                ctx.strokeStyle = '#ccaa22';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(cx, cy, sz * 0.3, 0, Math.PI * 2);
                ctx.stroke();
                // Plasma inside
                var fgGrad = ctx.createRadialGradient(cx, cy, sz * 0.1, cx, cy, sz * 0.28);
                fgGrad.addColorStop(0, 'rgba(255,238,80,0.7)');
                fgGrad.addColorStop(1, 'rgba(255,200,0,0)');
                ctx.fillStyle = fgGrad;
                ctx.beginPath();
                ctx.arc(cx, cy, sz * 0.28, 0, Math.PI * 2);
                ctx.fill();
                // Warning stripes
                ctx.fillStyle = '#ffcc00';
                ctx.fillRect(x + m, y + sz - m * 3, sz * 0.15, m * 1.5);
                ctx.fillStyle = '#222200';
                ctx.fillRect(x + m + sz * 0.05, y + sz - m * 3, sz * 0.05, m * 1.5);
                break;
                
            case 'cargo_bay':
                // Cargo hold with crates
                ctx.fillStyle = '#2a3322';
                ctx.fillRect(x, y, sz, sz);
                // Bay door frame
                ctx.strokeStyle = '#556644';
                ctx.lineWidth = 1.5;
                ctx.strokeRect(x + m * 2, y + m * 2, sz - m * 4, sz - m * 4);
                // Mini crates
                ctx.fillStyle = '#8a9966';
                ctx.fillRect(x + m * 4, y + m * 4, sz * 0.25, sz * 0.2);
                ctx.fillRect(x + sz * 0.45, y + m * 4, sz * 0.25, sz * 0.2);
                ctx.fillRect(x + m * 4, y + sz * 0.4, sz * 0.3, sz * 0.22);
                ctx.fillStyle = '#667744';
                ctx.fillRect(x + sz * 0.4, y + sz * 0.45, sz * 0.25, sz * 0.18);
                ctx.fillRect(x + m * 4, y + sz * 0.68, sz * 0.55, sz * 0.15);
                break;
                
            case 'fuel_tank':
                // Cylindrical fuel tank
                ctx.fillStyle = '#332211';
                ctx.fillRect(x, y, sz, sz);
                // Tank body
                ctx.fillStyle = '#886633';
                ctx.beginPath();
                ctx.ellipse(cx, cy, sz * 0.25, sz * 0.38, 0, 0, Math.PI * 2);
                ctx.fill();
                // Fuel level (fill from bottom)
                var fuelPct = 0.7;
                ctx.fillStyle = 'rgba(255,170,50,0.5)';
                ctx.beginPath();
                ctx.ellipse(cx, cy + sz * 0.38 * (1 - fuelPct * 2) * 0.5, sz * 0.22, sz * 0.38 * fuelPct, 0, 0, Math.PI * 2);
                ctx.fill();
                // Tank top cap
                ctx.strokeStyle = '#aa8844';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.ellipse(cx, cy - sz * 0.35, sz * 0.2, sz * 0.06, 0, 0, Math.PI * 2);
                ctx.stroke();
                // Gauge
                ctx.fillStyle = '#00ff44';
                ctx.fillRect(x + sz * 0.72, cy - sz * 0.2, sz * 0.06, sz * 0.3);
                break;
                
            case 'sensor_array':
                // Radar/sensor dish
                ctx.fillStyle = '#0a2222';
                ctx.fillRect(x, y, sz, sz);
                // Dish
                ctx.strokeStyle = '#44ffaa';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(cx, cy - sz * 0.05, sz * 0.3, Math.PI * 0.8, Math.PI * 0.2, true);
                ctx.stroke();
                // Receiver stalk
                ctx.strokeStyle = '#339977';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.moveTo(cx, cy + sz * 0.25);
                ctx.lineTo(cx, cy - sz * 0.12);
                ctx.stroke();
                // Signal waves
                ctx.strokeStyle = 'rgba(68,255,170,0.3)';
                ctx.lineWidth = 1;
                for (var sw = 1; sw <= 3; sw++) {
                    ctx.beginPath();
                    ctx.arc(cx, cy - sz * 0.15, sz * 0.1 * sw, -Math.PI * 0.6, -Math.PI * 0.4);
                    ctx.stroke();
                }
                // Base
                ctx.fillStyle = '#336655';
                ctx.fillRect(cx - sz * 0.15, cy + sz * 0.2, sz * 0.3, sz * 0.15);
                break;
                
            case 'repair_bay':
                // Repair bay with wrench icon
                ctx.fillStyle = '#1a3322';
                ctx.fillRect(x, y, sz, sz);
                // Wrench shape
                ctx.strokeStyle = '#44cc88';
                ctx.lineWidth = 2.5;
                ctx.beginPath();
                ctx.moveTo(cx - sz * 0.2, cy - sz * 0.25);
                ctx.lineTo(cx + sz * 0.15, cy + sz * 0.15);
                ctx.stroke();
                // Wrench head
                ctx.strokeStyle = '#44cc88';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(cx - sz * 0.2, cy - sz * 0.25, sz * 0.1, 0, Math.PI * 1.5);
                ctx.stroke();
                // Sparks
                ctx.fillStyle = '#88ffaa';
                ctx.fillRect(cx + sz * 0.1, cy - sz * 0.1, sz * 0.04, sz * 0.04);
                ctx.fillRect(cx + sz * 0.2, cy, sz * 0.03, sz * 0.03);
                ctx.fillRect(cx - sz * 0.05, cy + sz * 0.15, sz * 0.03, sz * 0.03);
                // Work bench
                ctx.fillStyle = '#336644';
                ctx.fillRect(x + m * 2, y + sz - m * 4, sz - m * 4, m * 2);
                break;
                
            case 'diplo_suite':
                // Diplomatic suite with dove/handshake
                ctx.fillStyle = '#2a2211';
                ctx.fillRect(x, y, sz, sz);
                // Table (oval)
                ctx.fillStyle = '#887744';
                ctx.beginPath();
                ctx.ellipse(cx, cy + sz * 0.05, sz * 0.3, sz * 0.15, 0, 0, Math.PI * 2);
                ctx.fill();
                // Chairs (small rectangles)
                ctx.fillStyle = '#666633';
                ctx.fillRect(cx - sz * 0.35, cy - sz * 0.05, sz * 0.1, sz * 0.12);
                ctx.fillRect(cx + sz * 0.25, cy - sz * 0.05, sz * 0.1, sz * 0.12);
                // Flag/star emblem above
                ctx.fillStyle = '#ccaa44';
                ctx.font = Math.floor(sz * 0.25) + 'px serif';
                ctx.textAlign = 'center';
                ctx.fillText('☆', cx, cy - sz * 0.2);
                // Comm lines
                ctx.strokeStyle = 'rgba(200,170,70,0.3)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.arc(cx, y + m * 3, sz * 0.15, Math.PI * 0.2, Math.PI * 0.8);
                ctx.stroke();
                break;
                
            default:
                // Fallback: just the color with label
                ctx.fillStyle = '#ffffff';
                ctx.font = Math.max(8, Math.floor(sz * 0.18)) + 'px monospace';
                ctx.textAlign = 'center';
                ctx.fillText(def.code || cell.type.substr(0, 2), cx, cy + sz * 0.05);
                break;
        }
        
        // Damage overlay — smoke/cracks for half damaged
        if (halfDmg) {
            ctx.fillStyle = 'rgba(0,0,0,0.25)';
            ctx.fillRect(x, y, sz, sz);
            // Crack lines
            ctx.strokeStyle = 'rgba(255,100,50,0.4)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(x + sz * 0.2, y + sz * 0.1);
            ctx.lineTo(cx, cy);
            ctx.lineTo(x + sz * 0.8, y + sz * 0.7);
            ctx.stroke();
        }
        
        // HP bar at bottom of block
        if (cell.hp < cell.maxHp) {
            var hpPct = cell.hp / cell.maxHp;
            var barH = Math.max(2, sz * 0.05);
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fillRect(x, y + sz - barH, sz, barH);
            ctx.fillStyle = hpPct > 0.5 ? '#00ff44' : (hpPct > 0.25 ? '#ffaa00' : '#ff2222');
            ctx.fillRect(x, y + sz - barH, sz * hpPct, barH);
        }
    }

    function _renderEditor() {
        if (!_editorOpen || !_editorCtx) return;
        var ctx = _editorCtx;
        var ship = Ship.getShip();
        var grid = ship.grid;
        var cw = 1420, ch = 880;

        // Clear
        ctx.fillStyle = '#080818';
        ctx.fillRect(0, 0, cw, ch);

        // Draw background — docked location as large planet surface behind ship grid
        if (ship.docked) {
            var loc = World.getLocation(ship.dockedAt);
            if (loc) {
                // Large planet filling the lower portion as if ship is on surface
                var bgRadius = Math.max(cw, ch) * 0.8;
                var bgX = cw / 2;
                var bgY = ch * 0.5 + bgRadius * 0.55;
                
                // Main planet body
                var grad = ctx.createRadialGradient(bgX, bgY - bgRadius * 0.4, bgRadius * 0.05, bgX, bgY, bgRadius);
                grad.addColorStop(0, loc.color);
                grad.addColorStop(0.4, _darkenHex(loc.color, 30));
                grad.addColorStop(0.7, _darkenHex(loc.color, 60));
                grad.addColorStop(1, 'transparent');
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.arc(bgX, bgY, bgRadius, 0, Math.PI * 2);
                ctx.fill();

                // Surface texture lines
                ctx.strokeStyle = 'rgba(255,255,255,0.05)';
                ctx.lineWidth = 1;
                for (var li = 0; li < 12; li++) {
                    ctx.beginPath();
                    ctx.arc(bgX, bgY, bgRadius * (0.6 + li * 0.03), -Math.PI * 0.9 + li * 0.12, -Math.PI * 0.1 - li * 0.08);
                    ctx.stroke();
                }

                // Atmospheric glow at horizon
                var horizonY = bgY - bgRadius + 20;
                if (horizonY > 0 && horizonY < ch) {
                    // Convert hex to rgba for gradient
                    var hr = parseInt(loc.color.slice(1,3), 16);
                    var hg = parseInt(loc.color.slice(3,5), 16);
                    var hb = parseInt(loc.color.slice(5,7), 16);
                    var atmGrad = ctx.createLinearGradient(0, horizonY - 40, 0, horizonY + 60);
                    atmGrad.addColorStop(0, 'transparent');
                    atmGrad.addColorStop(0.5, 'rgba(' + hr + ',' + hg + ',' + hb + ',0.1)');
                    atmGrad.addColorStop(1, 'transparent');
                    ctx.fillStyle = atmGrad;
                    ctx.fillRect(0, horizonY - 40, cw, 100);
                }

                // Location name at bottom
                ctx.fillStyle = 'rgba(255,255,255,0.2)';
                ctx.font = '18px monospace';
                ctx.textAlign = 'center';
                ctx.fillText('Docked at ' + loc.name, cw / 2, ch - 20);
            }
        }

        // Stars in background
        ctx.fillStyle = '#ffffff';
        for (var si = 0; si < 60; si++) {
            var sx = ((si * 7919) % cw);
            var sy = ((si * 4231) % (ch - 100));
            ctx.globalAlpha = 0.2 + (si % 5) * 0.1;
            ctx.fillRect(sx, sy, 1, 1);
        }
        ctx.globalAlpha = 1;

        // Calculate grid position — centered
        var cellSz = _editorCellSize;
        var gridPxW = grid.w * cellSz;
        var gridPxH = grid.h * cellSz;
        _editorOffsetX = Math.floor((cw - gridPxW) / 2);
        _editorOffsetY = Math.floor((ch - gridPxH) / 2) - 20;

        // Grid background — semi-transparent so planet surface shows through
        ctx.fillStyle = 'rgba(10,10,30,0.5)';
        ctx.fillRect(_editorOffsetX - 4, _editorOffsetY - 4, gridPxW + 8, gridPxH + 8);

        // Draw grid cells
        for (var r = 0; r < grid.h; r++) {
            for (var c = 0; c < grid.w; c++) {
                var cx = _editorOffsetX + c * cellSz;
                var cy = _editorOffsetY + r * cellSz;
                var cell = grid.cells[r][c];

                if (cell) {
                    var def = Config.BLOCK_TYPES[cell.type];
                    if (def) {
                        _drawBlockDetailed(ctx, cx + 1, cy + 1, cellSz - 2, cell, def);
                    }
                } else {
                    // Empty cell
                    ctx.fillStyle = 'rgba(20,20,50,0.5)';
                    ctx.fillRect(cx + 1, cy + 1, cellSz - 2, cellSz - 2);
                }

                // Cell border
                ctx.strokeStyle = (r === _editorHover.r && c === _editorHover.c) ? '#00ff88' : '#2a2a4a';
                ctx.lineWidth = (r === _editorHover.r && c === _editorHover.c) ? 2 : 1;
                ctx.strokeRect(cx, cy, cellSz, cellSz);
            }
        }

        // Placement guide — highlight valid cells when a block is selected
        var activeBlockKey = _dragBlockType || window._selectedBlock;
        if (activeBlockKey) {
            var guideDef = Config.BLOCK_TYPES[activeBlockKey];
            if (guideDef) {
                ctx.globalAlpha = 0.2;
                for (var dr = 0; dr < grid.h; dr++) {
                    for (var dc = 0; dc < grid.w; dc++) {
                        if (grid.cells[dr][dc]) continue;
                        var canPlace = _checkPlacement(guideDef, dr, dc, grid);
                        ctx.fillStyle = canPlace ? '#00ff88' : '#ff4444';
                        ctx.fillRect(_editorOffsetX + dc * cellSz + 2, _editorOffsetY + dr * cellSz + 2, cellSz - 4, cellSz - 4);
                    }
                }
                ctx.globalAlpha = 1;
            }
        }

        // Grid labels
        ctx.fillStyle = '#556';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        for (var lc = 0; lc < grid.w; lc++) {
            ctx.fillText(lc, _editorOffsetX + lc * cellSz + cellSz / 2, _editorOffsetY - 6);
        }
        ctx.textAlign = 'right';
        for (var lr = 0; lr < grid.h; lr++) {
            ctx.fillText(lr, _editorOffsetX - 6, _editorOffsetY + lr * cellSz + cellSz / 2 + 3);
        }

        // Legend
        ctx.fillStyle = '#667';
        ctx.font = '10px monospace';
        ctx.textAlign = 'left';
        ctx.fillText('TOP = Forward (front of ship)', _editorOffsetX, _editorOffsetY - 18);

        requestAnimationFrame(function () { if (_editorOpen) _renderEditor(); });
    }

    function _checkPlacement(def, row, col, grid) {
        var placement = def.placement || 'any';
        if (placement === 'aft') return row >= grid.h - 2;
        if (placement === 'edge') return row === 0 || row === grid.h - 1 || col === 0 || col === grid.w - 1;
        if (placement === 'core') return row > 0 && row < grid.h - 1 && col > 0 && col < grid.w - 1;
        return true;
    }

    function _darkenHex(hex, amount) {
        if (!hex || hex.charAt(0) !== '#') return hex;
        var r = parseInt(hex.slice(1, 3), 16);
        var g = parseInt(hex.slice(3, 5), 16);
        var b = parseInt(hex.slice(5, 7), 16);
        r = Math.max(0, r - amount);
        g = Math.max(0, g - amount);
        b = Math.max(0, b - amount);
        return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    }

    // Drag & drop handlers
    function _startDrag(e, blockTypeKey) {
        e.preventDefault();
        _dragBlockType = blockTypeKey;
        var def = Config.BLOCK_TYPES[blockTypeKey];
        if (!def) return;
        var overlay = document.getElementById('shipEditorOverlay');
        var rect = overlay.getBoundingClientRect();
        _dragGhost.style.display = 'block';
        _dragGhost.style.width = _editorCellSize + 'px';
        _dragGhost.style.height = _editorCellSize + 'px';
        _dragGhost.style.background = def.color;
        _dragGhost.style.left = (e.clientX - rect.left - _editorCellSize / 2) + 'px';
        _dragGhost.style.top = (e.clientY - rect.top - _editorCellSize / 2) + 'px';
    }

    function _editorDragMove(e) {
        if (!_dragBlockType) return;
        var overlay = document.getElementById('shipEditorOverlay');
        var rect = overlay.getBoundingClientRect();
        _dragGhost.style.left = (e.clientX - rect.left - _editorCellSize / 2) + 'px';
        _dragGhost.style.top = (e.clientY - rect.top - _editorCellSize / 2) + 'px';

        // Update hover cell
        var canvasRect = _editorCanvas.getBoundingClientRect();
        var mx = e.clientX - canvasRect.left;
        var my = e.clientY - canvasRect.top;
        _editorHover.c = Math.floor((mx - _editorOffsetX) / _editorCellSize);
        _editorHover.r = Math.floor((my - _editorOffsetY) / _editorCellSize);
    }

    function _editorDragEnd(e) {
        if (!_dragBlockType) return;
        _dragGhost.style.display = 'none';

        // Find which grid cell we dropped on
        var rect = _editorCanvas.getBoundingClientRect();
        var mx = e.clientX - rect.left;
        var my = e.clientY - rect.top;
        var col = Math.floor((mx - _editorOffsetX) / _editorCellSize);
        var row = Math.floor((my - _editorOffsetY) / _editorCellSize);

        var grid = Ship.getGrid();
        if (row >= 0 && row < grid.h && col >= 0 && col < grid.w) {
            _placeGridBlock(row, col, _dragBlockType);
        }

        _dragBlockType = null;
        _editorHover = { r: -1, c: -1 };
    }

    function _editorMouseMove(e) {
        var rect = _editorCanvas.getBoundingClientRect();
        var mx = e.clientX - rect.left;
        var my = e.clientY - rect.top;
        var grid = Ship.getGrid();
        _editorHover.c = Math.floor((mx - _editorOffsetX) / _editorCellSize);
        _editorHover.r = Math.floor((my - _editorOffsetY) / _editorCellSize);
        if (_editorHover.r < 0 || _editorHover.r >= grid.h || _editorHover.c < 0 || _editorHover.c >= grid.w) {
            _editorHover = { r: -1, c: -1 };
        }
    }

    function _editorMouseUp(e) {
        // If was dragging, handled by _editorDragEnd
    }

    function _editorClick(e) {
        var rect = _editorCanvas.getBoundingClientRect();
        var mx = e.clientX - rect.left;
        var my = e.clientY - rect.top;
        var grid = Ship.getGrid();
        var col = Math.floor((mx - _editorOffsetX) / _editorCellSize);
        var row = Math.floor((my - _editorOffsetY) / _editorCellSize);
        if (row < 0 || row >= grid.h || col < 0 || col >= grid.w) return;

        var cell = grid.cells[row][col];
        if (cell) {
            // Clicking an existing block shows its info in the part detail panel
            _updatePartDetail(cell.type);
            var def = Config.BLOCK_TYPES[cell.type];
            var info = def ? def.name : cell.type;
            info += ' (HP: ' + Math.ceil(cell.hp) + '/' + cell.maxHp + ')';
            showToast(info, 'info');
        } else if (window._selectedBlock) {
            // Place the selected block on an empty cell
            _placeGridBlock(row, col, window._selectedBlock);
        }
    }

    function _editorRightClick(e) {
        var rect = _editorCanvas.getBoundingClientRect();
        var mx = e.clientX - rect.left;
        var my = e.clientY - rect.top;
        var grid = Ship.getGrid();
        var col = Math.floor((mx - _editorOffsetX) / _editorCellSize);
        var row = Math.floor((my - _editorOffsetY) / _editorCellSize);
        if (row < 0 || row >= grid.h || col < 0 || col >= grid.w) return;

        var cell = grid.cells[row][col];
        if (cell) {
            _removeGridBlock(row, col);
        }
    }

    function _getRepairCost() {
        var grid = Ship.getGrid();
        if (!grid) return 0;
        var cost = 0;
        for (var r = 0; r < grid.h; r++) {
            for (var c = 0; c < grid.w; c++) {
                var cell = grid.cells[r][c];
                if (cell && cell.hp < cell.maxHp) {
                    var def = Config.BLOCK_TYPES[cell.type];
                    var pct = 1 - (cell.hp / cell.maxHp);
                    cost += Math.ceil((def ? def.cost : 100) * pct * 0.3);
                }
            }
        }
        return cost;
    }

    // ── Fleet Panel ──────────────────────────────────────────

    function _showFleetPanel() {
        _elements.panelTitle.textContent = '🚀 Fleet (' + Fleet.getShipCount() + '/' + Config.FLEET.MAX_FLEET_SIZE + ')';
        var html = '';
        var ships = Fleet.getShips();

        if (ships.length > 0) {
            html += '<h3>Your Fleet</h3>';
            for (var i = 0; i < ships.length; i++) {
                var s = ships[i];
                html += '<div class="fleet-card">';
                html += '<strong>' + s.name + '</strong>';
                html += '<p>Hull: ' + s.hull + ' | HP: ' + Math.ceil(s.hp) + '/' + s.maxHp + '</p>';
                html += '<p>Order: <select onchange="Fleet.setOrder(\'' + s.id + '\',this.value)">';
                ['follow', 'patrol', 'defend', 'attack'].forEach(function (o) {
                    html += '<option value="' + o + '"' + (s.order === o ? ' selected' : '') + '>' + o + '</option>';
                });
                html += '</select></p>';
                html += '</div>';
            }
            html += '<p>Fleet upkeep: ' + Fleet.getUpkeepCost() + ' credits/cycle</p>';

            html += '<h3>Fleet Orders</h3>';
            html += '<button class="panel-btn" onclick="Fleet.setAllOrders(\'follow\')">All Follow</button>';
            html += '<button class="panel-btn" onclick="Fleet.setAllOrders(\'defend\')">All Defend</button>';
            html += '<button class="panel-btn" onclick="Fleet.setAllOrders(\'patrol\')">All Patrol</button>';
        }

        // Build new ship (if at shipyard)
        var ship = Ship.getShip();
        if (ship.docked) {
            var loc = World.getLocation(ship.dockedAt);
            if (loc && loc.services.indexOf('shipyard') !== -1) {
                html += '<h3>Build Fleet Ship from Template</h3>';
                html += '<div class="upgrade-grid">';
                var templates = ShipTemplates.getAll();
                for (var ti = 0; ti < templates.length; ti++) {
                    var tmpl = templates[ti];
                    // Only show templates for available factions or moon/independent
                    if (tmpl.faction !== 'moon' && tmpl.faction !== 'independent' &&
                        tmpl.faction !== (loc.faction === Config.FACTION.EARTH ? 'earth' : '') &&
                        tmpl.faction !== (loc.faction === Config.FACTION.MARS ? 'mars' : '')) continue;

                    var tGrid = ShipGrid.fromTemplate(tmpl.hullClass, tmpl.blocks);
                    var tStats = tGrid.stats;
                    var tCost = 0;
                    for (var tr = 0; tr < tGrid.h; tr++)
                        for (var tc = 0; tc < tGrid.w; tc++)
                            if (tGrid.cells[tr][tc]) {
                                var tDef = Config.BLOCK_TYPES[tGrid.cells[tr][tc].type];
                                if (tDef) tCost += tDef.cost;
                            }
                    var hcDef = Config.HULL_CLASSES[tmpl.hullClass];
                    if (hcDef) tCost += hcDef.cost;

                    html += '<div class="upgrade-card">';
                    html += '<strong>' + tmpl.name + '</strong> <span style="color:#888;font-size:10px;">(' + tmpl.rarity + ')</span>';
                    html += '<p>HP:' + Math.ceil(tStats.totalHP) + ' Shd:' + Math.ceil(tStats.shieldHP) + ' Wpn:' + tStats.weapons.length + ' Spd:' + tStats.maxSpeed.toFixed(1) + '</p>';
                    html += '<button class="sm-btn" onclick="UI._buildFleetFromTemplate(\'' + tmpl.id + '\',' + tCost + ')">' + tCost + ' cr</button>';
                    html += '</div>';
                }
                html += '</div>';
            }
        }

        if (ships.length === 0 && (!ship.docked || !World.getLocation(ship.dockedAt) || World.getLocation(ship.dockedAt).services.indexOf('shipyard') === -1)) {
            html += '<p>Visit a shipyard to build fleet ships.</p>';
        }

        html += '<button class="panel-btn" onclick="UI.openSub(\'dock\')">← Back</button>';
        _elements.panel.innerHTML = html;
    }

    // ── Diplomacy Panel ──────────────────────────────────────

    function _showDiplomacyPanel() {
        _elements.panelTitle.textContent = '🤝 Diplomacy';
        var html = '';

        // Player path
        var path = Diplomacy.getPath();
        html += '<h3>Your Path: ' + (path === 'none' ? 'Undecided' : path === 'peace' ? '🕊️ Peace' : path === 'domination' ? '👑 Solar Dominion' : '⚔️ War (' + (path === 'war_earth' ? 'Earth' : 'Mars') + ')') + '</h3>';

        if (path === 'peace') {
            html += '<div class="progress-section">';
            html += '<p>Peace Progress: ' + Math.floor(Diplomacy.getPeaceProgress()) + '%</p>';
            html += '<div class="progress-bar"><div class="progress-fill peace" style="width:' + Diplomacy.getPeaceProgress() + '%"></div></div>';
            html += '<p>Neutral Zones: ' + Diplomacy.getNeutralZones().length + '/' + Config.DIPLOMACY.PEACE_ZONES_REQUIRED + '</p>';
            html += '<p>Agreements Signed: ' + Diplomacy.getAgreements().length + '</p>';
            html += '</div>';
        } else if (path.startsWith('war')) {
            html += '<div class="progress-section">';
            html += '<p>War Progress: ' + Math.floor(Diplomacy.getWarProgress()) + '%</p>';
            html += '<div class="progress-bar"><div class="progress-fill war" style="width:' + Diplomacy.getWarProgress() + '%"></div></div>';
            html += '<p>Campaigns: ' + Diplomacy.getWarCampaigns() + '/' + Config.DIPLOMACY.WAR_CAMPAIGNS_REQUIRED + '</p>';
            html += '<p>Fleet Size: ' + Fleet.getShipCount() + '/' + Config.FLEET.MAX_FLEET_SIZE + '</p>';
            html += '</div>';
        } else if (path === 'domination') {
            html += '<div class="progress-section">';
            html += '<p style="color:#ff4444;">Domination Progress: ' + Math.floor(Diplomacy.getDominationProgress()) + '%</p>';
            html += '<div class="progress-bar"><div class="progress-fill" style="width:' + Diplomacy.getDominationProgress() + '%;background:#ff4444;"></div></div>';
            var controlled = Diplomacy.getControlledStations();
            html += '<p>Stations Controlled: ' + controlled.length + '</p>';
            if (controlled.length > 0) {
                html += '<ul style="margin:4px 0;padding-left:18px;">';
                for (var ci = 0; ci < controlled.length; ci++) {
                    var cLoc = World.getLocation(controlled[ci]);
                    html += '<li style="color:#ff8844;">' + (cLoc ? cLoc.name : controlled[ci]) + '</li>';
                }
                html += '</ul>';
            }
            html += '<p>Fleet Size: ' + Fleet.getShipCount() + '/' + Config.DIPLOMACY.DOMINATION_FLEET_REQUIRED + '</p>';
            html += '<p>Declared: ' + (Diplomacy.isDominationDeclared() ? '<span style="color:#ff4444;">YES — Both factions hostile!</span>' : '<span style="color:#88ff88;">No (covert)</span>') + '</p>';

            // Show faction military power for strategic planning
            var earthF = Factions.getFaction(Config.FACTION.EARTH);
            var marsF = Factions.getFaction(Config.FACTION.MARS);
            html += '<h4 style="color:#ffaa44;">Enemy Strength</h4>';
            var milThresh = Config.DIPLOMACY.DOMINATION_MILITARY_THRESHOLD || 30;
            html += '<p>Earth Military: ' + (earthF ? Math.round(earthF.militaryPower) : '?') + ' (need ≤' + milThresh + ' to subjugate)</p>';
            html += '<p>Mars Military: ' + (marsF ? Math.round(marsF.militaryPower) : '?') + ' (need ≤' + milThresh + ' to subjugate)</p>';
            html += '</div>';
        }

        // Faction standings
        html += '<h3>Faction Standing</h3>';
        var factions = [Config.FACTION.EARTH, Config.FACTION.MARS, Config.FACTION.MOON, Config.FACTION.MARS_STATION, Config.FACTION.INDEPENDENT];
        for (var i = 0; i < factions.length; i++) {
            var fid = factions[i];
            var f = Factions.getFaction(fid);
            var rep = Factions.getRep(fid);
            var standing = Factions.getStanding(fid);
            var color = _getStandingColor(standing);
            html += '<div class="faction-row">';
            html += '<span class="faction-name" style="color:' + _getFactionColorCSS(fid) + '">' + f.name + '</span>';
            html += '<span class="faction-rep" style="color:' + color + '">' + rep + ' (' + standing + ')</span>';
            html += '</div>';
        }

        // Internal politics overview
        html += '<h3>🏛️ Internal Politics</h3>';
        var polFactions = [Config.FACTION.EARTH, Config.FACTION.MARS];
        for (var pi = 0; pi < polFactions.length; pi++) {
            var pfid = polFactions[pi];
            var pf = Factions.getFaction(pfid);
            var pol = Factions.getPolitics(pfid);
            if (!pf || !pol) continue;
            var unityColor = pol.unity > 60 ? '#88ff88' : pol.unity > 35 ? '#ffaa44' : '#ff4444';
            html += '<div style="margin-bottom:8px;">';
            html += '<p style="color:' + _getFactionColorCSS(pfid) + ';margin-bottom:2px;"><b>' + pf.name + '</b> — Unity: <span style="color:' + unityColor + '">' + Math.round(pol.unity) + '%</span></p>';
            // Show internal factions
            for (var pfi = 0; pfi < pol.factions.length; pfi++) {
                var ipf = pol.factions[pfi];
                var barW = Math.round(ipf.support);
                html += '<p style="font-size:11px;margin:1px 0;">' + ipf.name + ': <span style="color:#aaa;">' + Math.round(ipf.support) + '%</span>';
                html += ' <span style="display:inline-block;width:' + barW + 'px;height:6px;background:' + _getFactionColorCSS(pfid) + ';vertical-align:middle;border-radius:2px;"></span></p>';
            }
            // Show active crisis
            if (pol.crisisActive) {
                html += '<p style="color:#ff8844;font-size:11px;">⚠ ' + pol.crisisActive.name + ' — ' + Math.round(pol.crisisActive.remaining / 10) + 's remaining</p>';
            }
            html += '</div>';
        }

        // Neutral location influence
        html += '<h3>Neutral Location Influence</h3>';
        var luna = World.getLocation('luna');
        var marsOrb = World.getLocation('mars_orbital');
        if (luna) {
            html += '<p>Luna Colony — Leaning: ' + (Factions.getLeaning(Config.FACTION.MOON) || 'neutral') + '</p>';
            html += '<p>&nbsp; Earth influence: ' + Math.floor(luna.influence.earth) + ' | Mars: ' + Math.floor(luna.influence.mars) + '</p>';
            if (path === 'peace' && Diplomacy.getNeutralZones().indexOf('luna') === -1) {
                html += '<button class="sm-btn" onclick="UI._establishNeutralZone(\'luna\')">Establish Neutral Zone (5000 cr)</button>';
            }
            if (path.startsWith('war')) {
                var side = path === 'war_earth' ? 'earth' : 'mars';
                html += '<button class="sm-btn" onclick="UI._influence(\'luna\',\'' + side + '\')">Influence toward ' + side + ' (1000 cr)</button>';
            }
        }
        if (marsOrb) {
            html += '<p>Ares Station — Leaning: ' + (Factions.getLeaning(Config.FACTION.MARS_STATION) || 'neutral') + '</p>';
            html += '<p>&nbsp; Earth influence: ' + Math.floor(marsOrb.influence.earth) + ' | Mars: ' + Math.floor(marsOrb.influence.mars) + '</p>';
            if (path === 'peace' && Diplomacy.getNeutralZones().indexOf('mars_orbital') === -1) {
                html += '<button class="sm-btn" onclick="UI._establishNeutralZone(\'mars_orbital\')">Establish Neutral Zone (5000 cr)</button>';
            }
            if (path.startsWith('war')) {
                var side2 = path === 'war_earth' ? 'earth' : 'mars';
                html += '<button class="sm-btn" onclick="UI._influence(\'mars_orbital\',\'' + side2 + '\')">Influence toward ' + side2 + ' (1000 cr)</button>';
            }
        }

        // Peace talks
        if (path === 'peace') {
            html += '<h3>Peace Talks</h3>';
            if (Diplomacy.getNeutralZones().length >= Config.DIPLOMACY.PEACE_ZONES_REQUIRED) {
                html += '<button class="panel-btn highlight" onclick="UI._startPeaceTalk()">Initiate Peace Talks</button>';
            } else {
                html += '<p>Establish ' + Config.DIPLOMACY.PEACE_ZONES_REQUIRED + ' neutral zones to begin peace talks.</p>';
            }

            var talks = Diplomacy.getAgreements();
            if (talks.length > 0) {
                html += '<p>Agreements signed: ' + talks.length + '</p>';
            }
        }

        html += '<button class="panel-btn" onclick="UI.openSub(\'dock\')">← Back</button>';
        _elements.panel.innerHTML = html;
    }

    // ── Path Select Panel ────────────────────────────────────

    function _showPathSelectPanel() {
        _elements.panelTitle.textContent = '⭐ Choose Your Destiny';
        var html = '<p>You\'ve proven yourself capable. Now choose how you\'ll shape the solar system.</p>';
        html += '<div class="path-options">';
        html += '<div class="path-card peace"><h3>🕊️ Path of Peace</h3>';
        html += '<p>Unite the warring factions through diplomacy. Establish neutral zones, negotiate agreements, and broker peace.</p>';
        html += '<button class="panel-btn" onclick="UI._choosePath(\'peace\')">Choose Peace</button></div>';
        html += '<div class="path-card war"><h3>⚔️ Side with Earth</h3>';
        html += '<p>Join Earth\'s industrial might. Build military fleets and crush Mars\'s rebellion.</p>';
        html += '<p>Bonus: Cheaper ships, stronger shields</p>';
        html += '<button class="panel-btn" onclick="UI._choosePath(\'war_earth\')">Side with Earth</button></div>';
        html += '<div class="path-card war"><h3>⚔️ Side with Mars</h3>';
        html += '<p>Join Mars\'s advanced forces. Use technology to overcome Earth\'s numbers.</p>';
        html += '<p>Bonus: Better weapons, faster engines</p>';
        html += '<button class="panel-btn" onclick="UI._choosePath(\'war_mars\')">Side with Mars</button></div>';

        // Hidden domination path — only visible if player has built up enough
        var moonRep = Factions.getRep(Config.FACTION.MOON);
        var indRep = Factions.getRep(Config.FACTION.INDEPENDENT);
        var fleetSize = Fleet.getShipCount();
        var credits = Economy.getCredits();
        var canDominate = moonRep >= 30 && indRep >= 20 && fleetSize >= 2 && credits >= 10000;

        if (canDominate) {
            html += '<div class="path-card domination"><h3>👑 Solar Dominion</h3>';
            html += '<p style="color:#ff4444;font-style:italic;">A hidden path. Why serve when you can rule?</p>';
            html += '<p>Unite the neutral stations under YOUR banner. Build an empire, then subjugate both Earth and Mars. The hardest path — you will fight everyone.</p>';
            html += '<p style="color:#ffaa44;">⚠️ EXTREME DIFFICULTY</p>';
            html += '<button class="panel-btn" style="background:#660022;border-color:#ff4444;" onclick="UI._choosePath(\'domination\')">Seize Power</button></div>';
        } else {
            html += '<div class="path-card" style="opacity:0.3;pointer-events:none;border-color:#333;"><h3>❓ ???</h3>';
            html += '<p style="color:#666;">Something stirs in the shadows... Perhaps if you were more influential, wealthier, and commanded a fleet...</p></div>';
        }

        html += '</div>';
        html += '<button class="panel-btn" onclick="UI.openSub(\'dock\')">← Not Yet</button>';
        _elements.panel.innerHTML = html;
    }

    // ── Map Panel ────────────────────────────────────────────

    function _showMapPanel() {
        _elements.panelTitle.textContent = '🗺️ Star Map';
        var html = '<div class="map-list">';
        var locs = World.getLocations();
        var ship = Ship.getShip();
        for (var i = 0; i < locs.length; i++) {
            var loc = locs[i];
            var dx = loc.x - ship.x, dy = loc.y - ship.y;
            var dist = Math.floor(Math.sqrt(dx * dx + dy * dy));
            html += '<div class="map-entry" style="border-left: 3px solid ' + loc.color + '">';
            html += '<strong>' + loc.name + '</strong>';
            html += '<span class="map-dist">' + dist + 'u</span>';
            html += '<p>' + _factionName(loc.faction) + ' | ' + loc.type + '</p>';
            if (loc.isPlayerBuilt && !loc.built) {
                html += '<p>🏗️ Building: ' + Math.floor((loc.buildProgress / loc.buildTime) * 100) + '%</p>';
            }
            html += '</div>';
        }
        html += '</div>';
        html += '<button class="panel-btn" onclick="UI.closePanel()">Close</button>';
        _elements.panel.innerHTML = html;
    }

    // ── Log Panel ────────────────────────────────────────────

    function _showLogPanel() {
        _elements.panelTitle.textContent = '📜 Combat Log';
        var html = '<div class="log-entries">';
        var log = Combat.getCombatLog();
        for (var i = log.length - 1; i >= 0; i--) {
            html += '<p>' + log[i].message + '</p>';
        }
        if (log.length === 0) html += '<p>No combat events yet.</p>';
        html += '</div>';
        html += '<button class="panel-btn" onclick="UI.closePanel()">Close</button>';
        _elements.panel.innerHTML = html;
    }

    // ── Station Build Panel ──────────────────────────────────

    function _showStationBuildPanel() {
        _elements.panelTitle.textContent = '🏗️ Build Space Station';
        var html = '<p>Build a station at your current location. Requires significant resources.</p>';
        html += '<div class="upgrade-grid">';
        for (var st in Config.STATION_TYPES) {
            var sType = Config.STATION_TYPES[st];
            html += '<div class="upgrade-card">';
            html += '<strong>' + sType.name + '</strong>';
            html += '<p>Income: ' + sType.income + '/cycle | Influence: ' + sType.influence + '</p>';
            html += '<p>Cost: 💰' + sType.cost.credits + ' 🔩' + sType.cost.metal + ' 💡' + sType.cost.electronics + '</p>';
            html += '<p>Build time: ' + sType.buildTime + ' ticks</p>';
            html += '<button class="panel-btn" onclick="UI._buildStation(\'' + st + '\')">Build</button>';
            html += '</div>';
        }
        html += '</div>';
        html += '<button class="panel-btn" onclick="UI.openSub(\'dock\')">← Back</button>';
        _elements.panel.innerHTML = html;
    }

    // ── Action handlers ──────────────────────────────────────

    function _buy(res, amount) {
        var result = Economy.buyResource(Ship.getShip().dockedAt, res, amount);
        if (result.success) {
            showToast('Bought ' + result.amount + ' ' + Config.RESOURCES[res].name + ' for ' + result.cost + ' cr', 'info');
        } else {
            showToast(result.reason, 'warning');
        }
        _showTradePanel();
    }

    function _sell(res, amount) {
        if (amount === 0) amount = Ship.getShip().inventory[res] || 0;
        if (amount <= 0) return;
        var result = Economy.sellResource(Ship.getShip().dockedAt, res, amount);
        if (result.success) {
            showToast('Sold ' + result.amount + ' ' + Config.RESOURCES[res].name + ' for ' + result.revenue + ' cr', 'info');
        } else {
            showToast(result.reason, 'warning');
        }
        _showTradePanel();
    }

    function _acceptMission(missionId) {
        if (Missions.acceptMission(missionId)) {
            showToast('Mission accepted!', 'success');
            _showMissionsPanel();
        }
    }

    function _upgrade(component, type, cost) {
        if (!Economy.spendCredits(cost)) {
            showToast('Not enough credits!', 'warning');
            return;
        }
        Ship.upgrade(component, type);
        showToast('Upgraded to ' + type + '!', 'success');
        _buildShopPanel();
    }

    // Grid builder handlers
    function _selectBlock(blockKey) {
        window._selectedBlock = blockKey;
        var def = Config.BLOCK_TYPES[blockKey];
        showToast('Selected: ' + (def ? def.name : blockKey), 'info');
        _buildShopPanel();
    }

    function _selectBlockAndDetail(blockKey) {
        window._selectedBlock = blockKey;
        _updatePartDetail(blockKey);
        _buildShopPanel();
    }

    function _updatePartDetail(blockKey) {
        var panel = document.getElementById('shipEditorPartDetail');
        if (!panel) return;
        if (!blockKey) {
            panel.innerHTML = '<p style="color:#556;font-style:italic;margin-top:20px;">Click a block in the shop to see its details here.</p>';
            return;
        }
        var def = Config.BLOCK_TYPES[blockKey];
        if (!def) { panel.innerHTML = ''; return; }

        var h = '';
        h += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">';
        h += '<span style="display:inline-block;width:24px;height:24px;background:' + def.color + ';border:1px solid #556;border-radius:3px;"></span>';
        h += '<h3 style="margin:0;color:#0f8;font-size:15px;">' + def.name + '</h3>';
        h += '<span style="color:#ffcc44;font-size:12px;">' + def.cost + ' cr</span>';
        h += '</div>';

        // Description based on type
        var desc = _getBlockDescription(blockKey, def);
        h += '<p style="color:#99aabb;font-size:11px;margin:0 0 6px 0;">' + desc + '</p>';

        // Stats table
        h += '<table class="stat-table" style="font-size:11px;">';
        h += '<tr><td>Category</td><td>' + def.cat + '</td></tr>';
        h += '<tr><td>Placement</td><td>' + _getPlacementDesc(def.placement) + '</td></tr>';
        h += '<tr><td>HP</td><td>' + def.hp + '</td></tr>';
        h += '<tr><td>Weight</td><td>' + def.weight + ' tons</td></tr>';
        if (def.powerGen > 0) h += '<tr><td>Power Output</td><td style="color:#0f8;">+' + def.powerGen + '</td></tr>';
        if (def.powerDraw > 0) h += '<tr><td>Power Draw</td><td style="color:#ff8844;">-' + def.powerDraw + '</td></tr>';
        if (def.thrust) h += '<tr><td>Thrust</td><td>' + def.thrust + '</td></tr>';
        if (def.speedBoost) h += '<tr><td>Speed Boost</td><td style="color:#44ccff;">+' + def.speedBoost + '</td></tr>';
        if (def.fuelType) h += '<tr><td>Fuel Type</td><td>' + (Config.RESOURCES[def.fuelType] ? Config.RESOURCES[def.fuelType].icon + ' ' + Config.RESOURCES[def.fuelType].name : def.fuelType) + '</td></tr>';
        if (def.fuelRate) h += '<tr><td>Fuel Rate</td><td>' + def.fuelRate + '/tick</td></tr>';
        if (def.damage) h += '<tr><td>Damage</td><td>' + def.damage + ' (' + (def.dmgType || 'kinetic') + ')</td></tr>';
        if (def.range) h += '<tr><td>Range</td><td>' + def.range + '</td></tr>';
        if (def.fireRate) h += '<tr><td>Fire Rate</td><td>every ' + (def.fireRate * 0.1).toFixed(1) + 's</td></tr>';
        if (def.shieldHP) h += '<tr><td>Shield HP</td><td>' + def.shieldHP + '</td></tr>';
        if (def.regenRate) h += '<tr><td>Shield Regen</td><td>' + def.regenRate + '/s</td></tr>';
        if (def.cargoCapacity) h += '<tr><td>Cargo Space</td><td>' + def.cargoCapacity + ' units</td></tr>';
        if (def.fuelCapacity) h += '<tr><td>Fuel Storage</td><td>' + def.fuelCapacity + ' units</td></tr>';
        if (def.scanRange) h += '<tr><td>Scan Range</td><td>' + def.scanRange + '</td></tr>';
        if (def.repairRate) h += '<tr><td>Repair Rate</td><td>' + def.repairRate + '/s</td></tr>';
        if (def.diploBonus) h += '<tr><td>Diplo Bonus</td><td>+' + Math.floor(def.diploBonus * 100) + '%</td></tr>';
        h += '</table>';

        // Requirements / synergies
        var reqs = _getBlockRequirements(blockKey, def);
        if (reqs.length > 0) {
            h += '<div style="margin-top:6px;padding-top:4px;border-top:1px solid #334;">';
            h += '<p style="color:#88aacc;font-weight:bold;font-size:10px;margin:0 0 2px 0;">Requirements & Synergies</p>';
            for (var ri = 0; ri < reqs.length; ri++) {
                h += '<p style="font-size:10px;margin:1px 0;color:#99aabb;">' + reqs[ri] + '</p>';
            }
            h += '</div>';
        }

        panel.innerHTML = h;
    }

    function _getPlacementDesc(placement) {
        var descs = {
            'any': 'Anywhere on grid',
            'aft': 'Bottom 2 rows only (rear of ship)',
            'edge': 'Perimeter cells only (top/sides)',
            'core': 'Center area of the grid'
        };
        return descs[placement] || placement || 'Anywhere';
    }

    function _getBlockDescription(key, def) {
        var descs = {
            'hull_basic': 'Standard hull plating. Lightweight and cheap. Provides structure to mount other systems on. Every ship needs hull blocks to expand its layout.',
            'hull_armored': 'Reinforced armor plating with 2.5× the HP of basic hull but heavier. Use on exposed sides of your ship to absorb enemy fire and protect critical systems.',
            'cockpit': 'The brain of your ship. Required — destroying it means instant death. Place it deep inside your ship, surrounded by hull blocks for protection.',
            'power_core': 'Primary power source generating 10 power units. All systems draw power — without enough generation, weapons, shields, and engines operate at reduced efficiency.',
            'engine_chemical': 'Basic rocket engine using chemical propellant. Cheap fuel but lowest thrust and speed boost. Good for budget builds and early-game ships.',
            'engine_ion': 'Efficient ion drive using xenon gas. Better thrust-to-weight than chemical, with moderate speed boost. Uses less fuel per tick. Great for scouts.',
            'engine_plasma': 'High-performance plasma thruster. Strong thrust and speed boost but high power draw. Needs plasma cells fuel. Good balance of speed and power.',
            'engine_fusion': 'Top-tier propulsion. Massive thrust and best speed boost but very heavy, expensive, and power-hungry. Uses rare fusion cores. For capital ships.',
            'weapon_laser': 'Fast-firing energy weapon. Low damage per shot but rapid fire rate. No ammo needed — just power. Effective against shields.',
            'weapon_missile': 'Explosive missile rack. High burst damage with tracking ability. Slow reload but devastating against hull. Edge-mounted.',
            'weapon_railgun': 'Electromagnetic kinetic weapon. Very high single-shot damage that penetrates armor. Slow fire rate, high power cost, but excellent range.',
            'weapon_torpedo': 'Heavy torpedo launcher. Highest damage weapon available. Extremely slow reload but can cripple ships in one hit. End-game weapon.',
            'shield_basic': 'Standard energy shield generator. Absorbs 50 damage before hull takes hits. Regenerates over time. Needs power to function.',
            'shield_heavy': 'Advanced shield system with 120 shield HP and slower regen. Heavy and power-hungry but makes your ship extremely durable in prolonged fights.',
            'power_solar': 'Free power from sunlight — no fuel cost. Low output (5 power) but zero weight. Best placed on edges. Less effective far from the Sun.',
            'power_fusion_gen': 'High-output fusion reactor generating 40 power. Consumes fusion cores as fuel. Powers entire fleets of systems. Essential for large ships.',
            'cargo_bay': 'Storage for trade goods, resources, and supplies. Each bay holds 50 units. Essential for traders and any ship needing to carry resources.',
            'fuel_tank': 'Stores 180 units of any fuel type. Without tanks, your ship runs out of fuel quickly. More tanks = longer range between refueling stops.',
            'sensor_array': 'Advanced sensors extending detection range to 500. Reveals hidden ships and provides tactical info. Edge-mounted for best reception.',
            'repair_bay': 'Automated repair system that slowly restores HP to damaged blocks during flight. Invaluable for long missions away from stations.',
            'diplo_suite': 'Diplomatic communications and negotiation suite. Boosts reputation gains by 25%. Essential for peace path gameplay and trade negotiations.'
        };
        return descs[key] || 'A ' + def.cat.toLowerCase() + ' component for your ship.';
    }

    function _getBlockRequirements(key, def) {
        var reqs = [];
        // Material costs
        if (def.materials && Object.keys(def.materials).length > 0) {
            var matList = [];
            for (var mat in def.materials) {
                var matName = Config.RESOURCES[mat] ? Config.RESOURCES[mat].icon + ' ' + Config.RESOURCES[mat].name : mat;
                matList.push(def.materials[mat] + '× ' + matName);
            }
            reqs.push('🧱 Materials: ' + matList.join(', '));
        }
        if (def.powerDraw > 0) reqs.push('⚡ Draws ' + def.powerDraw + ' power — needs Power Core or generators');
        if (def.fuelType) {
            var fuelName = Config.RESOURCES[def.fuelType] ? Config.RESOURCES[def.fuelType].name : def.fuelType;
            reqs.push('⛽ Requires ' + fuelName + ' — buy from stations or carry in Fuel Tanks');
        }
        if (def.placement === 'aft') reqs.push('📍 Must be placed in bottom 2 rows (engine bay)');
        if (def.placement === 'edge') reqs.push('📍 Must be placed on grid perimeter');
        if (def.placement === 'core') reqs.push('📍 Must be placed in center of grid');
        if (def.cat === 'Weapon') reqs.push('🔗 Fires automatically at hostile targets in range');
        if (def.cat === 'Defense') reqs.push('🔗 Shield absorbs damage before hull HP is hit');
        if (def.cat === 'Propulsion') reqs.push('🔗 More engines = higher thrust and speed');
        if (key === 'cockpit') reqs.push('⚠️ CRITICAL: Ship is destroyed if cockpit is destroyed');
        if (def.cargoCapacity) reqs.push('🔗 Cargo is separate from fuel — fuel uses Fuel Tanks');
        if (def.fuelCapacity) reqs.push('🔗 Stores fuel for engines and fuel-burning generators');
        if (def.diploBonus) reqs.push('🔗 Affects peace talks, negotiations, and reputation gains');
        return reqs;
    }

    function _placeGridBlock(row, col, blockTypeOverride) {
        var blockKey = blockTypeOverride || window._selectedBlock;
        if (!blockKey) {
            showToast('Select a block type first!', 'warning');
            return;
        }
        var def = Config.BLOCK_TYPES[blockKey];
        if (!def) return;

        // Check materials and credits
        if (!Economy.canAffordBlock(blockKey)) {
            var missing = [];
            if (Economy.getCredits() < def.cost) missing.push(def.cost + ' credits');
            if (def.materials) {
                var ship = Ship.getShip();
                for (var mat in def.materials) {
                    var have = ship.inventory[mat] || 0;
                    if (have < def.materials[mat]) {
                        var matName = Config.RESOURCES[mat] ? Config.RESOURCES[mat].name : mat;
                        missing.push(def.materials[mat] + ' ' + matName + ' (have ' + have + ')');
                    }
                }
            }
            showToast('Need: ' + missing.join(', '), 'warning');
            return;
        }

        if (!Economy.payForBlock(blockKey)) {
            showToast('Cannot afford this block!', 'warning');
            return;
        }

        if (!Ship.placeBlock(row, col, blockKey)) {
            // Refund everything
            Economy.addCredits(def.cost);
            if (def.materials) {
                for (var m in def.materials) Ship.addItem(m, def.materials[m]);
            }
            showToast('Cannot place here! Check placement rules.', 'warning');
            return;
        }

        // Validate connectivity
        var grid = Ship.getGrid();
        if (!ShipGrid.isConnected(grid)) {
            Ship.removeShipBlock(row, col);
            Economy.addCredits(def.cost);
            if (def.materials) {
                for (var m2 in def.materials) Ship.addItem(m2, def.materials[m2]);
            }
            showToast('Block would create disconnected sections!', 'warning');
            return;
        }

        showToast('Placed ' + def.name, 'success');
        _buildShopPanel();
    }

    function _removeGridBlock(row, col) {
        var grid = Ship.getGrid();
        var cell = grid.cells[row][col];
        if (!cell) return;

        if (cell.type === 'cockpit') {
            showToast('Cannot remove cockpit!', 'warning');
            return;
        }

        var typeKey = Ship.removeShipBlock(row, col);
        if (typeKey) {
            // Check connectivity after removal
            if (!ShipGrid.isConnected(grid)) {
                // Re-place the block
                var def = Config.BLOCK_TYPES[typeKey];
                grid.cells[row][col] = { type: typeKey, hp: def.hp, maxHp: def.hp };
                grid.stats = ShipGrid.deriveStats(grid);
                showToast('Removing would disconnect blocks!', 'warning');
                _buildShopPanel();
                return;
            }
            // Refund 50% of cost
            var bDef = Config.BLOCK_TYPES[typeKey];
            if (bDef) Economy.addCredits(Math.floor(bDef.cost * 0.5));
            showToast('Removed ' + (bDef ? bDef.name : typeKey) + ' (50% refund)', 'info');
        }
        _buildShopPanel();
    }

    function _changeHullClass(newClass, cost) {
        if (!Economy.spendCredits(cost)) {
            showToast('Not enough credits!', 'warning');
            return;
        }
        if (Ship.changeHullClass(newClass)) {
            showToast('Upgraded to ' + Config.HULL_CLASSES[newClass].name + '!', 'success');
        } else {
            Economy.addCredits(cost);
            showToast('Cannot change hull class', 'warning');
        }
        _buildShopPanel();
    }

    function _repairAll(cost) {
        if (!Economy.spendCredits(cost)) {
            showToast('Not enough credits!', 'warning');
            return;
        }
        var grid = Ship.getGrid();
        for (var r = 0; r < grid.h; r++) {
            for (var c = 0; c < grid.w; c++) {
                var cell = grid.cells[r][c];
                if (cell && cell.hp < cell.maxHp) {
                    ShipGrid.repairBlock(grid, r, c);
                }
            }
        }
        showToast('Ship fully repaired!', 'success');
        _buildShopPanel();
    }

    function _buildFleetShip() {
        // Legacy fleet builder — kept for backwards compat
        showToast('Use template-based fleet building', 'info');
        _showFleetPanel();
    }

    function _buildFleetFromTemplate(templateId, cost) {
        var result = Fleet.buildFromTemplate(null, templateId);
        if (result.success) {
            showToast('Built ' + result.ship.name + '!', 'success');
        } else {
            showToast(result.reason, 'warning');
        }
        _showFleetPanel();
    }

    function _refuel() {
        var fuelType = Ship.getFuelType();
        var fuelFree = Ship.getFuelFree();
        if (fuelFree <= 0) {
            showToast('Fuel tanks already full!', 'info');
            return;
        }
        var totalBought = 0;
        // Buy in chunks to fill up, stopping when out of credits or full
        var remaining = Math.ceil(fuelFree);
        var result = Economy.buyResource(Ship.getShip().dockedAt, fuelType, remaining);
        if (result.success) {
            totalBought = result.amount;
            showToast('Refueled with ' + totalBought + ' ' + Config.RESOURCES[fuelType].name, 'info');
        } else {
            showToast('Cannot refuel: ' + result.reason, 'warning');
        }
    }

    function _repair(cost) {
        if (!Economy.spendCredits(cost)) {
            showToast('Not enough credits!', 'warning');
            return;
        }
        Ship.repair(Ship.getShip().maxHp);
        showToast('Ship fully repaired!', 'success');
        _showDockPanel(Ship.getShip().dockedAt);
    }

    function _choosePath(path) {
        Diplomacy.choosePath(path);
        closePanel();
    }

    function _flipStation(locId) {
        var result = Diplomacy.flipStation(locId);
        if (result.success) {
            showToast('Station flipped to your control!', 'success');
            _showDockPanel(locId);
        } else {
            showToast(result.reason, 'warning');
        }
    }

    function _declareDomination() {
        var result = Diplomacy.declareDomination();
        if (result.success) {
            showToast('⚠️ DOMINATION DECLARED — Both factions are now hostile!', 'warning');
            var dockedAt = Ship.getShip().dockedAt;
            if (dockedAt) _showDockPanel(dockedAt);
        } else {
            showToast(result.reason, 'warning');
        }
    }

    function _subjugateFaction(factionId) {
        var result = Diplomacy.subjugateFaction(factionId);
        if (result.success) {
            var fName = (Factions.getFaction(factionId) || {}).name || factionId;
            showToast('👑 ' + fName + ' has been subjugated!', 'success');
            var dockedAt = Ship.getShip().dockedAt;
            if (dockedAt) _showDockPanel(dockedAt);
        } else {
            showToast(result.reason, 'warning');
        }
    }

    function _establishNeutralZone(locId) {
        var result = Diplomacy.establishNeutralZone(locId);
        if (result.success) {
            showToast('Neutral zone established!', 'success');
        } else {
            showToast(result.reason, 'warning');
        }
        _showDiplomacyPanel();
    }

    function _influence(locId, side) {
        if (!Economy.spendCredits(1000)) {
            showToast('Need 1000 credits', 'warning');
            return;
        }
        Diplomacy.influenceLocation(locId, side, 10);
        showToast('Influence increased!', 'info');
        _showDiplomacyPanel();
    }

    function _startPeaceTalk() {
        var ship = Ship.getShip();
        var result = Diplomacy.initiatePeaceTalk(ship.dockedAt || 'luna');
        if (result.success) {
            showToast('Peace talks initiated!', 'success');
            Diplomacy.advancePeaceTalk(0);
        } else {
            showToast(result.reason, 'warning');
        }
        _showDiplomacyPanel();
    }

    function _buildStation(type) {
        var ship = Ship.getShip();
        var result = Stations.buildStation('Player Station', type, ship.x + 100, ship.y + 100);
        if (result.success) {
            showToast('Station construction started!', 'success');
        } else {
            showToast(result.reason, 'warning');
        }
        _showStationBuildPanel();
    }

    // ── Toast system ─────────────────────────────────────────

    function showToast(message, type) {
        type = type || 'info';
        // Limit to 5 toasts max
        var toasts = _elements.toastContainer.children;
        while (toasts.length >= 5) {
            toasts[0].remove();
        }
        var toast = document.createElement('div');
        toast.className = 'toast toast-' + type;
        toast.textContent = message;
        _elements.toastContainer.appendChild(toast);

        setTimeout(function () {
            toast.classList.add('toast-fade');
            setTimeout(function () { toast.remove(); }, 500);
        }, 3000);
    }

    // ── Story overlay ────────────────────────────────────────

    function _showNextStory() {
        if (_storyQueue.length === 0) return;
        var story = _storyQueue.shift();
        _elements.storyTitle.textContent = story.title;
        _elements.storyText.textContent = story.text;
        _elements.storyOverlay.style.display = 'flex';
    }

    function closeStory() {
        _elements.storyOverlay.style.display = 'none';
        if (_storyQueue.length > 0) {
            setTimeout(_showNextStory, 500);
        }
    }

    function _isStoryVisible() {
        return _elements.storyOverlay.style.display === 'flex';
    }

    function _getVictoryText(type) {
        if (type === 'peace') return 'Through tireless diplomacy and unwavering determination, you\'ve brought Earth and Mars to the peace table. The solar system enters a new era of cooperation. Your name will be remembered as the one who united humanity among the stars.';
        if (type === 'war_earth') return 'With Earth\'s industrial might and your strategic genius, Mars has surrendered. Earth now controls the solar system. Whether this brings lasting peace or continued oppression remains to be seen...';
        if (type === 'war_mars') return 'Mars\'s technological superiority, combined with your tactical brilliance, has forced Earth to capitulate. The red planet now leads humanity\'s future. A new order rises from the dust.';
        if (type === 'domination') return 'Against all odds, you have conquered the entire solar system. Neither Earth nor Mars could stand against your cunning and military prowess. From a lone pilot on a neutral moon, you have risen to become the supreme ruler of humanity\'s domain. The Solar Dominion stands eternal — but at what cost? History will judge whether your iron hand brings unity or tyranny to the stars.';
        return 'Victory achieved!';
    }

    // ── Helpers ──────────────────────────────────────────────

    function _objectiveText(obj) {
        switch (obj.type) {
            case 'go_to':
                var loc = World.getLocation(obj.target);
                return 'Travel to ' + (loc ? loc.name : 'target');
            case 'return': return 'Return to mission giver';
            case 'destroy': return 'Destroy targets: ' + (obj.destroyed || 0) + '/' + obj.count;
            case 'collect': return 'Collect ' + obj.resource + ': ' + (obj.collected || 0) + '/' + obj.amount;
            default: return obj.type;
        }
    }

    function _factionName(id) {
        if (id === Config.FACTION.PLAYER) return 'Solar Dominion';
        var f = Factions.getFaction(id);
        return f ? f.name : id;
    }

    function _getFactionColorCSS(faction) {
        switch (faction) {
            case Config.FACTION.EARTH: return Config.COLORS.earth;
            case Config.FACTION.MARS: return Config.COLORS.mars;
            case Config.FACTION.MOON: return Config.COLORS.moon;
            case Config.FACTION.PLAYER: return Config.COLORS.player;
            default: return Config.COLORS.neutral;
        }
    }

    function _getStandingColor(standing) {
        switch (standing) {
            case 'allied': return '#00ff88';
            case 'friendly': return '#88ccff';
            case 'neutral': return '#cccccc';
            case 'unfriendly': return '#ffaa44';
            case 'hostile': return '#ff4444';
            default: return '#ffffff';
        }
    }

    function openSub(panelId) {
        _showPanel(panelId);
    }

    function _updateSpeedButtons() {
        var paused = (typeof Engine !== 'undefined' && Engine.isPaused) ? Engine.isPaused() : false;
        var speed = (typeof Engine !== 'undefined' && Engine.getGameSpeed) ? Engine.getGameSpeed() : 1;
        var map = { btnPause: 0, btnSpeed1: 1, btnSpeed2: 2, btnSpeed4: 4, btnSpeed10: 10 };
        for (var id in map) {
            var el = document.getElementById(id);
            if (!el) continue;
            if (id === 'btnPause') {
                el.classList.toggle('active', paused);
            } else {
                el.classList.toggle('active', !paused && speed === map[id]);
            }
        }
    }

    // ── God Mode ──────────────────────────────────────────────
    function _toggleGodMode() {
        _godMode = !_godMode;
        if (_godMode) {
            showToast('☀️ GOD MODE ACTIVATED — Type "solar" again to deactivate', 'success');
            _showGodPanel();
        } else {
            showToast('God mode deactivated', 'info');
            _godSpeedBonus = 0;
            var ship = Ship.getShip();
            if (ship) ship._invincible = false;
            var godEl = document.getElementById('godModePanel');
            if (godEl) godEl.remove();
        }
    }

    function _showGodPanel() {
        var existing = document.getElementById('godModePanel');
        if (existing) existing.remove();

        var panel = document.createElement('div');
        panel.id = 'godModePanel';
        panel.style.cssText = 'position:fixed;top:60px;right:10px;background:rgba(20,10,40,0.95);border:2px solid #ffaa00;border-radius:8px;padding:12px;color:#fff;font-size:13px;z-index:10000;min-width:220px;font-family:monospace;';
        _updateGodPanelContent(panel);
        document.body.appendChild(panel);

        // Auto-refresh god panel every second
        if (window._godPanelInterval) clearInterval(window._godPanelInterval);
        window._godPanelInterval = setInterval(function () {
            if (!_godMode) { clearInterval(window._godPanelInterval); return; }
            _updateGodPanelContent();
        }, 1000);
    }

    function _updateGodPanelContent(panel) {
        if (!panel) panel = document.getElementById('godModePanel');
        if (!panel) return;
        var ship = Ship.getShip();
        var stats = ship.grid ? ship.grid.stats : {};
        var fuelUsed = Ship.getFuelUsed();
        var maxFuel = ship.maxFuel || 0;

        var html = '<div style="text-align:center;color:#ffaa00;font-weight:bold;margin-bottom:8px;">☀️ GOD MODE</div>';

        // Speed
        html += '<div style="margin-bottom:8px;border-bottom:1px solid #555;padding-bottom:6px;">';
        html += '<div style="color:#88ccff;">🚀 Speed Bonus: +' + _godSpeedBonus + '</div>';
        html += '<div style="color:#aaa;font-size:11px;">Base: ' + (Ship.getSpeed()).toFixed(2) + ' | +God: ' + _godSpeedBonus + '</div>';
        html += '<button onclick="UI._godSpeed(1)" style="margin:3px;padding:4px 10px;cursor:pointer;background:#334;color:#88ff88;border:1px solid #88ff88;border-radius:4px;">+1 Speed</button>';
        html += '<button onclick="UI._godSpeed(5)" style="margin:3px;padding:4px 10px;cursor:pointer;background:#334;color:#88ff88;border:1px solid #88ff88;border-radius:4px;">+5 Speed</button>';
        html += '<button onclick="UI._godSpeed(-1)" style="margin:3px;padding:4px 10px;cursor:pointer;background:#334;color:#ff8888;border:1px solid #ff8888;border-radius:4px;">-1</button>';
        html += '<button onclick="UI._godSpeed(0)" style="margin:3px;padding:4px 10px;cursor:pointer;background:#334;color:#ffaa44;border:1px solid #ffaa44;border-radius:4px;">Reset</button>';
        html += '</div>';

        // Fuel
        html += '<div style="margin-bottom:8px;border-bottom:1px solid #555;padding-bottom:6px;">';
        html += '<div style="color:#aa8844;">⛽ Fuel: ' + fuelUsed + '/' + maxFuel + '</div>';
        html += '<button onclick="UI._godFillFuel()" style="margin:3px;padding:4px 10px;cursor:pointer;background:#334;color:#ffcc44;border:1px solid #ffcc44;border-radius:4px;">Fill Fuel</button>';
        html += '</div>';

        // Credits
        html += '<div style="margin-bottom:8px;border-bottom:1px solid #555;padding-bottom:6px;">';
        html += '<div style="color:#88ff88;">💰 Credits: ' + Economy.getCredits().toLocaleString() + '</div>';
        html += '<button onclick="UI._godCredits(10000)" style="margin:3px;padding:4px 10px;cursor:pointer;background:#334;color:#88ff88;border:1px solid #88ff88;border-radius:4px;">+10K</button>';
        html += '<button onclick="UI._godCredits(100000)" style="margin:3px;padding:4px 10px;cursor:pointer;background:#334;color:#88ff88;border:1px solid #88ff88;border-radius:4px;">+100K</button>';
        html += '<button onclick="UI._godCredits(1000000)" style="margin:3px;padding:4px 10px;cursor:pointer;background:#334;color:#88ff88;border:1px solid #88ff88;border-radius:4px;">+1M</button>';
        html += '</div>';

        // Health
        html += '<div style="margin-bottom:8px;border-bottom:1px solid #555;padding-bottom:6px;">';
        html += '<div style="color:#ff4444;">❤️ HP: ' + Math.round(ship.hp) + '/' + ship.maxHp + ' | Shield: ' + Math.round(ship.shieldHp) + '/' + ship.maxShieldHp + '</div>';
        html += '<button onclick="UI._godHeal()" style="margin:3px;padding:4px 10px;cursor:pointer;background:#334;color:#ff8888;border:1px solid #ff8888;border-radius:4px;">Full Heal</button>';
        html += '<button onclick="UI._godInvincible()" style="margin:3px;padding:4px 10px;cursor:pointer;background:#334;color:#ff44ff;border:1px solid #ff44ff;border-radius:4px;">' + (ship._invincible ? '🛡️ INVINCIBLE' : 'Invincible OFF') + '</button>';
        html += '</div>';

        // Reputation
        html += '<div style="margin-bottom:6px;">';
        html += '<div style="color:#ccccff;">🤝 Reputation</div>';
        html += '<button onclick="UI._godRep(\'earth\',20)" style="margin:2px;padding:3px 8px;cursor:pointer;background:#334;color:#4488ff;border:1px solid #4488ff;border-radius:3px;font-size:11px;">Earth +20</button>';
        html += '<button onclick="UI._godRep(\'mars\',20)" style="margin:2px;padding:3px 8px;cursor:pointer;background:#334;color:#ff4444;border:1px solid #ff4444;border-radius:3px;font-size:11px;">Mars +20</button>';
        html += '<button onclick="UI._godRep(\'moon\',20)" style="margin:2px;padding:3px 8px;cursor:pointer;background:#334;color:#cccccc;border:1px solid #cccccc;border-radius:3px;font-size:11px;">Moon +20</button>';
        html += '</div>';

        panel.innerHTML = html;
    }

    function _godSpeed(amount) {
        if (amount === 0) {
            _godSpeedBonus = 0;
        } else {
            _godSpeedBonus = Math.max(0, _godSpeedBonus + amount);
        }
        _updateGodPanelContent();
    }

    function _godFillFuel() {
        var ship = Ship.getShip();
        var stats = ship.grid ? ship.grid.stats : {};
        if (stats.fuelTypes) {
            for (var ft in stats.fuelTypes) {
                ship.inventory[ft] = ship.maxFuel || 180;
            }
        }
        showToast('⛽ Fuel filled to max!', 'success');
        _updateGodPanelContent();
    }

    function _godCredits(amount) {
        Economy.addCredits(amount);
        showToast('💰 +' + amount.toLocaleString() + ' credits', 'success');
        _updateGodPanelContent();
    }

    function _godHeal() {
        var ship = Ship.getShip();
        ship.hp = ship.maxHp;
        ship.shieldHp = ship.maxShieldHp;
        if (ship.grid && ship.grid.cells) {
            for (var r = 0; r < ship.grid.cells.length; r++) {
                for (var c = 0; c < ship.grid.cells[r].length; c++) {
                    var cell = ship.grid.cells[r][c];
                    if (cell && cell.type) cell.hp = cell.maxHp;
                }
            }
        }
        showToast('❤️ Fully healed!', 'success');
        _updateGodPanelContent();
    }

    function _godInvincible() {
        var ship = Ship.getShip();
        ship._invincible = !ship._invincible;
        showToast(ship._invincible ? '🛡️ Invincible ON' : '🛡️ Invincible OFF', 'info');
        _updateGodPanelContent();
    }

    function _godRep(faction, amount) {
        Factions.changeRep(faction, amount);
        showToast('🤝 ' + faction + ' rep +' + amount, 'success');
        _updateGodPanelContent();
    }

    function isGodMode() { return _godMode; }
    function getGodSpeedBonus() { return _godSpeedBonus; }

    return {
        init: init,
        wireEvents: wireEvents,
        handleInput: handleInput,
        closePanel: closePanel,
        isPanelOpen: isPanelOpen,
        showToast: showToast,
        openSub: openSub,
        closeStory: closeStory,
        // Expose action handlers for onclick
        _buy: _buy,
        _sell: _sell,
        _acceptMission: _acceptMission,
        _upgrade: _upgrade,
        _selectBlock: _selectBlock,
        _placeGridBlock: _placeGridBlock,
        _removeGridBlock: _removeGridBlock,
        _changeHullClass: _changeHullClass,
        _repairAll: _repairAll,
        _buildFleetShip: _buildFleetShip,
        _buildFleetFromTemplate: _buildFleetFromTemplate,
        _refuel: _refuel,
        _repair: _repair,
        _choosePath: _choosePath,
        _flipStation: _flipStation,
        _declareDomination: _declareDomination,
        _subjugateFaction: _subjugateFaction,
        _establishNeutralZone: _establishNeutralZone,
        _influence: _influence,
        _startPeaceTalk: _startPeaceTalk,
        _buildStation: _buildStation,
        _closeShipEditor: _closeShipEditor,
        _startDrag: _startDrag,
        _selectBlockAndDetail: _selectBlockAndDetail,
        _showMissionTracker: _showMissionTracker,
        _showMissionDetail: _showMissionDetail,
        _trackMission: _trackMission,
        _untrackMission: _untrackMission,
        _abandonMission: _abandonMission,
        // God mode
        isGodMode: isGodMode,
        getGodSpeedBonus: getGodSpeedBonus,
        _godSpeed: _godSpeed,
        _godFillFuel: _godFillFuel,
        _godCredits: _godCredits,
        _godHeal: _godHeal,
        _godInvincible: _godInvincible,
        _godRep: _godRep
    };
})();
