/* ============================================================
 * Solar Dominion — Renderer
 * Canvas rendering: camera, starfield, locations, ships,
 * projectiles, HUD, and minimap.
 * ============================================================ */
var Render = (function () {
    'use strict';

    var _canvas, _ctx;
    var _miniCanvas, _miniCtx;
    var _camX = 0, _camY = 0;
    var _starCache = null;
    var _lastStarCamX = -9999, _lastStarCamY = -9999;
    var _showGalaxyMap = false;
    var _shipInfoTarget = null;  // NPC or fleet ship clicked for details

    function init() {
        _canvas = document.getElementById('gameCanvas');
        _ctx = _canvas.getContext('2d');
        _canvas.width = Config.VIEWPORT_W;
        _canvas.height = Config.VIEWPORT_H;

        _miniCanvas = document.getElementById('minimapCanvas');
        _miniCtx = _miniCanvas.getContext('2d');
        _miniCanvas.width = Config.MINIMAP_W;
        _miniCanvas.height = Config.MINIMAP_H;

        // Minimap click → galaxy map
        _canvas.addEventListener('click', _onCanvasClick);
        _canvas.addEventListener('contextmenu', _onCanvasRightClick);
    }

    function getCanvas() { return _canvas; }
    function getCamX() { return _camX; }
    function getCamY() { return _camY; }

    function render() {
        var ship = Ship.getShip();
        var zoom = Input.getZoom();

        // Effective viewport in world units (shrinks when zoomed in)
        var viewW = Config.VIEWPORT_W / zoom;
        var viewH = Config.VIEWPORT_H / zoom;

        // Update camera to follow player (centered)
        _camX = ship.x - viewW / 2;
        _camY = ship.y - viewH / 2;
        _camX = Math.max(0, Math.min(Config.WORLD_W - viewW, _camX));
        _camY = Math.max(0, Math.min(Config.WORLD_H - viewH, _camY));

        Input.updateWorldMouse(_camX, _camY);

        // Clear
        _ctx.fillStyle = Config.COLORS.bg;
        _ctx.fillRect(0, 0, Config.VIEWPORT_W, Config.VIEWPORT_H);

        // World rendering (scaled + translated by camera)
        _ctx.save();
        _ctx.scale(zoom, zoom);
        _ctx.translate(-_camX, -_camY);

        _drawStars();
        _drawNebulae();
        _drawGrid();
        _drawLocations();
        _drawNPCs();
        _drawFleetShips();
        _drawProjectiles();
        _drawExplosions();
        _drawPlayerShip(ship);
        _drawWaypoint(ship);

        _ctx.restore();

        // HUD (screen-space, not affected by zoom)
        _drawHUD(ship);
        _drawMinimap(ship);

        // Galaxy map overlay
        if (_showGalaxyMap) {
            _drawGalaxyMap(ship);
        }

        // Ship info tooltip
        if (_shipInfoTarget) {
            _drawShipInfo();
        }
    }

    // Handle clicks on minimap area and ships in world
    function _onCanvasClick(e) {
        var rect = _canvas.getBoundingClientRect();
        var cx = e.clientX - rect.left;
        var cy = e.clientY - rect.top;

        // Check if click is in minimap area
        var mmX = Config.VIEWPORT_W - Config.MINIMAP_W - 10;
        var mmY = 10;
        if (cx >= mmX && cx <= mmX + Config.MINIMAP_W && cy >= mmY && cy <= mmY + Config.MINIMAP_H) {
            _showGalaxyMap = !_showGalaxyMap;
            _shipInfoTarget = null;
            return;
        }

        // If galaxy map open, click to close
        if (_showGalaxyMap) {
            _showGalaxyMap = false;
            return;
        }

        // Check if click is on an NPC or fleet ship in world coords
        var zoom = Input.getZoom();
        var viewW = Config.VIEWPORT_W / zoom;
        var viewH = Config.VIEWPORT_H / zoom;
        var worldX = _camX + cx / zoom;
        var worldY = _camY + cy / zoom;

        var clickRadius = 20 / zoom;

        // Check NPCs
        var npcs = World.getNPCs();
        for (var i = 0; i < npcs.length; i++) {
            var npc = npcs[i];
            if (npc.dead) continue;
            var dx = npc.x - worldX, dy = npc.y - worldY;
            if (Math.sqrt(dx * dx + dy * dy) < clickRadius) {
                _shipInfoTarget = { type: 'npc', data: npc, screenX: cx, screenY: cy };
                return;
            }
        }

        // Check fleet ships
        var fleet = Fleet.getShips();
        for (var fi = 0; fi < fleet.length; fi++) {
            var fs = fleet[fi];
            if (fs.dead) continue;
            var fdx = fs.x - worldX, fdy = fs.y - worldY;
            if (Math.sqrt(fdx * fdx + fdy * fdy) < clickRadius) {
                _shipInfoTarget = { type: 'fleet', data: fs, screenX: cx, screenY: cy };
                return;
            }
        }

        // Clicked nothing — dismiss info
        _shipInfoTarget = null;
    }

    function _onCanvasRightClick(e) {
        e.preventDefault();
        var rect = _canvas.getBoundingClientRect();
        var cx = e.clientX - rect.left;
        var cy = e.clientY - rect.top;
        var zoom = Input.getZoom();
        var worldX = _camX + cx / zoom;
        var worldY = _camY + cy / zoom;

        var ship = Ship.getShip();
        if (ship && !ship.docked) {
            Ship.setWaypoint(worldX, worldY);
        }
    }

    function _drawStars() {
        var zoom = Input.getZoom();
        var viewW = Config.VIEWPORT_W / zoom;
        var viewH = Config.VIEWPORT_H / zoom;
        var stars = World.getStars();
        _ctx.fillStyle = Config.COLORS.stars;
        for (var i = 0; i < stars.length; i++) {
            var s = stars[i];
            if (s.x < _camX - 5 || s.x > _camX + viewW + 5 ||
                s.y < _camY - 5 || s.y > _camY + viewH + 5) continue;
            _ctx.globalAlpha = s.brightness;
            _ctx.fillRect(s.x, s.y, s.size, s.size);
        }
        _ctx.globalAlpha = 1;
    }

    function _drawNebulae() {
        var zoom = Input.getZoom();
        var viewW = Config.VIEWPORT_W / zoom;
        var viewH = Config.VIEWPORT_H / zoom;
        var nebulae = World.getNebulae();
        for (var i = 0; i < nebulae.length; i++) {
            var n = nebulae[i];
            if (n.x + n.radius < _camX || n.x - n.radius > _camX + viewW ||
                n.y + n.radius < _camY || n.y - n.radius > _camY + viewH) continue;

            var grad = _ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.radius);
            grad.addColorStop(0, n.color);
            grad.addColorStop(1, 'transparent');
            _ctx.fillStyle = grad;
            _ctx.fillRect(n.x - n.radius, n.y - n.radius, n.radius * 2, n.radius * 2);
        }
    }

    function _drawGrid() {
        var zoom = Input.getZoom();
        var viewW = Config.VIEWPORT_W / zoom;
        var viewH = Config.VIEWPORT_H / zoom;
        var spacing = 500;
        _ctx.strokeStyle = Config.COLORS.grid;
        _ctx.lineWidth = 0.5;
        var startX = Math.floor(_camX / spacing) * spacing;
        var startY = Math.floor(_camY / spacing) * spacing;
        _ctx.beginPath();
        for (var x = startX; x < _camX + viewW; x += spacing) {
            _ctx.moveTo(x, _camY);
            _ctx.lineTo(x, _camY + viewH);
        }
        for (var y = startY; y < _camY + viewH; y += spacing) {
            _ctx.moveTo(_camX, y);
            _ctx.lineTo(_camX + viewW, y);
        }
        _ctx.stroke();
    }

    function _drawLocations() {
        var locs = World.getLocations();
        var zoom = Input.getZoom();
        var viewW = Config.VIEWPORT_W / zoom;
        var viewH = Config.VIEWPORT_H / zoom;

        // Draw faint orbit lines first (behind everything)
        _ctx.save();
        _ctx.globalAlpha = 0.12;
        _ctx.strokeStyle = '#445566';
        _ctx.lineWidth = 1;
        for (var o = 0; o < locs.length; o++) {
            var ol = locs[o];
            if (!ol.orbit) continue;
            var cx, cy;
            if (ol.orbit.parent === 'sun') {
                cx = Config.SUN_X;
                cy = Config.SUN_Y;
            } else {
                var parent = World.getLocation(ol.orbit.parent);
                if (!parent) continue;
                cx = parent.x;
                cy = parent.y;
            }
            _ctx.beginPath();
            _ctx.arc(cx, cy, ol.orbit.radius, 0, Math.PI * 2);
            _ctx.stroke();
        }
        _ctx.restore();

        for (var i = 0; i < locs.length; i++) {
            var loc = locs[i];
            // Frustum cull
            if (loc.x + loc.radius < _camX || loc.x - loc.radius > _camX + viewW ||
                loc.y + loc.radius < _camY || loc.y - loc.radius > _camY + viewH) continue;

            // Draw body
            if (loc.type === Config.LOC_TYPE.STAR) {
                _drawStar(loc);
            } else if (loc.type === Config.LOC_TYPE.ASTEROID) {
                _drawAsteroidField(loc);
            } else {
                _drawCelestialBody(loc);
            }

            // Draw name label — planets get bigger text, smart label positioning
            var isPlanetWorld = (loc.type === Config.LOC_TYPE.PLANET || loc.type === Config.LOC_TYPE.STAR || loc.type === Config.LOC_TYPE.MOON);
            var worldFontSize = isPlanetWorld ? 16 : 11;
            var worldFontWeight = isPlanetWorld ? 'bold ' : '';
            _ctx.font = worldFontWeight + worldFontSize + 'px monospace';
            _ctx.fillStyle = isPlanetWorld ? '#ffffff' : '#bbccdd';

            // Use same label placements as galaxy map for consistency
            var worldLabelPlacements = {
                'sun': 'below', 'mercury': 'below', 'venus': 'below',
                'earth': 'left', 'mars': 'right', 'luna': 'above',
                'mars_orbital': 'left', 'station_alpha': 'right',
                'station_beta': 'left', 'station_gamma': 'below',
                'asteroid_belt_1': 'left', 'asteroid_belt_2': 'right'
            };
            var wPlacement = worldLabelPlacements[loc.id] || 'below';
            var wGap = loc.radius + 10;

            switch (wPlacement) {
                case 'above':
                    _ctx.textAlign = 'center';
                    _ctx.fillText(loc.name, loc.x, loc.y - wGap);
                    break;
                case 'below':
                    _ctx.textAlign = 'center';
                    _ctx.fillText(loc.name, loc.x, loc.y + wGap + worldFontSize);
                    break;
                case 'left':
                    _ctx.textAlign = 'right';
                    _ctx.fillText(loc.name, loc.x - wGap, loc.y + worldFontSize * 0.35);
                    break;
                case 'right':
                    _ctx.textAlign = 'left';
                    _ctx.fillText(loc.name, loc.x + wGap, loc.y + worldFontSize * 0.35);
                    break;
            }

            // Faction indicator (skip for sun)
            if (loc.type !== Config.LOC_TYPE.STAR) {
                var fColor = _getFactionColor(loc.faction);
                _ctx.fillStyle = fColor;
                // Position faction bar near the label
                var fBarX = loc.x - 15, fBarY;
                if (wPlacement === 'above') {
                    fBarY = loc.y - wGap + 4;
                } else if (wPlacement === 'below') {
                    fBarY = loc.y + wGap + worldFontSize + 4;
                } else if (wPlacement === 'left') {
                    fBarX = loc.x - wGap - 30;
                    fBarY = loc.y + worldFontSize * 0.35 + 6;
                } else {
                    fBarX = loc.x + wGap;
                    fBarY = loc.y + worldFontSize * 0.35 + 6;
                }
                _ctx.fillRect(fBarX, fBarY, 30, 3);
            }

            // Building progress for player stations
            if (loc.isPlayerBuilt && !loc.built) {
                var progress = loc.buildProgress / loc.buildTime;
                _ctx.fillStyle = '#333';
                _ctx.fillRect(loc.x - 20, loc.y - loc.radius - 12, 40, 6);
                _ctx.fillStyle = Config.COLORS.player;
                _ctx.fillRect(loc.x - 20, loc.y - loc.radius - 12, 40 * progress, 6);
            }
        }
    }

    function _drawStar(loc) {
        var sx = loc.x, sy = loc.y;
        // Outer corona glow
        var corona = _ctx.createRadialGradient(sx, sy, loc.radius * 0.5, sx, sy, loc.radius * 1.8);
        corona.addColorStop(0, 'rgba(255,220,100,0.3)');
        corona.addColorStop(0.5, 'rgba(255,180,50,0.1)');
        corona.addColorStop(1, 'rgba(255,100,0,0)');
        _ctx.fillStyle = corona;
        _ctx.beginPath();
        _ctx.arc(sx, sy, loc.radius * 1.8, 0, Math.PI * 2);
        _ctx.fill();

        // Sun body with gradient
        var grad = _ctx.createRadialGradient(
            sx - loc.radius * 0.2, sy - loc.radius * 0.2, loc.radius * 0.05,
            sx, sy, loc.radius);
        grad.addColorStop(0, '#ffffee');
        grad.addColorStop(0.3, '#ffee66');
        grad.addColorStop(0.7, '#ffcc00');
        grad.addColorStop(1, '#dd8800');
        _ctx.beginPath();
        _ctx.arc(sx, sy, loc.radius, 0, Math.PI * 2);
        _ctx.fillStyle = grad;
        _ctx.fill();
    }

    function _drawCelestialBody(loc) {
        var cx = loc.x, cy = loc.y, r = loc.radius;

        _ctx.beginPath();
        _ctx.arc(cx, cy, r, 0, Math.PI * 2);

        if (loc.type === Config.LOC_TYPE.PLANET) {
            // Planet-specific rendering
            if (loc.id === 'earth') {
                // Earth: blue oceans, green/brown land hints, white cloud wisps
                var eg = _ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
                eg.addColorStop(0, '#6699dd');
                eg.addColorStop(0.3, '#4488cc');
                eg.addColorStop(0.6, '#336699');
                eg.addColorStop(1, '#224466');
                _ctx.fillStyle = eg;
                _ctx.fill();
                // Land masses (crude shapes)
                _ctx.save();
                _ctx.clip();
                _ctx.fillStyle = 'rgba(60,120,50,0.4)';
                _ctx.beginPath();
                _ctx.arc(cx - r * 0.2, cy - r * 0.1, r * 0.35, 0, Math.PI * 2);
                _ctx.fill();
                _ctx.fillStyle = 'rgba(80,140,60,0.3)';
                _ctx.beginPath();
                _ctx.arc(cx + r * 0.3, cy + r * 0.2, r * 0.25, 0, Math.PI * 2);
                _ctx.fill();
                // Cloud wisps
                _ctx.fillStyle = 'rgba(255,255,255,0.15)';
                _ctx.beginPath();
                _ctx.ellipse(cx - r * 0.1, cy - r * 0.3, r * 0.5, r * 0.1, 0.3, 0, Math.PI * 2);
                _ctx.fill();
                _ctx.beginPath();
                _ctx.ellipse(cx + r * 0.2, cy + r * 0.1, r * 0.4, r * 0.08, -0.2, 0, Math.PI * 2);
                _ctx.fill();
                _ctx.restore();
                // Atmosphere glow
                _ctx.beginPath();
                _ctx.arc(cx, cy, r + 6, 0, Math.PI * 2);
                _ctx.strokeStyle = 'rgba(100,180,255,0.25)';
                _ctx.lineWidth = 4;
                _ctx.stroke();
            } else if (loc.id === 'mars') {
                // Mars: rusty red with darker regions and white polar cap
                var mg = _ctx.createRadialGradient(cx - r * 0.25, cy - r * 0.25, r * 0.1, cx, cy, r);
                mg.addColorStop(0, '#cc7744');
                mg.addColorStop(0.4, '#bb5533');
                mg.addColorStop(0.8, '#993322');
                mg.addColorStop(1, '#662211');
                _ctx.fillStyle = mg;
                _ctx.fill();
                // Dark regions
                _ctx.save();
                _ctx.clip();
                _ctx.fillStyle = 'rgba(80,30,15,0.35)';
                _ctx.beginPath();
                _ctx.arc(cx + r * 0.1, cy + r * 0.15, r * 0.3, 0, Math.PI * 2);
                _ctx.fill();
                // Polar ice cap
                _ctx.fillStyle = 'rgba(220,220,230,0.5)';
                _ctx.beginPath();
                _ctx.arc(cx, cy - r * 0.85, r * 0.2, 0, Math.PI * 2);
                _ctx.fill();
                _ctx.restore();
                // Thin atmosphere
                _ctx.beginPath();
                _ctx.arc(cx, cy, r + 4, 0, Math.PI * 2);
                _ctx.strokeStyle = 'rgba(200,120,80,0.15)';
                _ctx.lineWidth = 3;
                _ctx.stroke();
            } else if (loc.id === 'venus') {
                // Venus: thick yellowish cloud cover
                var vg = _ctx.createRadialGradient(cx - r * 0.2, cy - r * 0.2, r * 0.1, cx, cy, r);
                vg.addColorStop(0, '#eedd99');
                vg.addColorStop(0.4, '#ccaa66');
                vg.addColorStop(0.8, '#aa8844');
                vg.addColorStop(1, '#887733');
                _ctx.fillStyle = vg;
                _ctx.fill();
                // Cloud bands
                _ctx.save();
                _ctx.clip();
                _ctx.fillStyle = 'rgba(200,180,120,0.2)';
                _ctx.beginPath();
                _ctx.ellipse(cx, cy - r * 0.3, r * 0.9, r * 0.12, 0.1, 0, Math.PI * 2);
                _ctx.fill();
                _ctx.beginPath();
                _ctx.ellipse(cx, cy + r * 0.2, r * 0.8, r * 0.1, -0.1, 0, Math.PI * 2);
                _ctx.fill();
                _ctx.restore();
                // Thick atmosphere glow
                _ctx.beginPath();
                _ctx.arc(cx, cy, r + 8, 0, Math.PI * 2);
                _ctx.strokeStyle = 'rgba(220,200,130,0.2)';
                _ctx.lineWidth = 6;
                _ctx.stroke();
            } else if (loc.id === 'mercury') {
                // Mercury: gray cratered surface
                var hg = _ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
                hg.addColorStop(0, '#bbaa99');
                hg.addColorStop(0.5, '#998877');
                hg.addColorStop(1, '#665544');
                _ctx.fillStyle = hg;
                _ctx.fill();
                // Craters
                _ctx.save();
                _ctx.clip();
                _ctx.fillStyle = 'rgba(80,70,60,0.3)';
                var rng = _seededRandom(12345);
                for (var cr = 0; cr < 5; cr++) {
                    _ctx.beginPath();
                    _ctx.arc(cx + (rng() - 0.5) * r * 1.4, cy + (rng() - 0.5) * r * 1.4, r * 0.1 + rng() * r * 0.12, 0, Math.PI * 2);
                    _ctx.fill();
                }
                _ctx.restore();
            } else {
                // Generic planet fallback
                var gg = _ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
                gg.addColorStop(0, _lightenColor(loc.color, 40));
                gg.addColorStop(1, loc.color);
                _ctx.fillStyle = gg;
                _ctx.fill();
                _ctx.beginPath();
                _ctx.arc(cx, cy, r + 8, 0, Math.PI * 2);
                _ctx.strokeStyle = loc.color + '44';
                _ctx.lineWidth = 4;
                _ctx.stroke();
            }
        } else if (loc.type === Config.LOC_TYPE.MOON) {
            // Moon: gray with craters
            var moonG = _ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
            moonG.addColorStop(0, '#dddddd');
            moonG.addColorStop(0.5, '#bbbbbb');
            moonG.addColorStop(1, '#888888');
            _ctx.fillStyle = moonG;
            _ctx.fill();
            // Craters
            _ctx.save();
            _ctx.beginPath();
            _ctx.arc(cx, cy, r, 0, Math.PI * 2);
            _ctx.clip();
            _ctx.fillStyle = 'rgba(100,100,100,0.3)';
            _ctx.beginPath(); _ctx.arc(cx - r * 0.25, cy - r * 0.1, r * 0.15, 0, Math.PI * 2); _ctx.fill();
            _ctx.beginPath(); _ctx.arc(cx + r * 0.3, cy + r * 0.2, r * 0.12, 0, Math.PI * 2); _ctx.fill();
            _ctx.beginPath(); _ctx.arc(cx + r * 0.05, cy + r * 0.4, r * 0.08, 0, Math.PI * 2); _ctx.fill();
            _ctx.restore();
        } else {
            // Station
            _ctx.fillStyle = loc.color;
            _ctx.fill();
            _ctx.beginPath();
            _ctx.arc(cx, cy, r + 5, 0, Math.PI * 2);
            _ctx.strokeStyle = loc.color;
            _ctx.lineWidth = 2;
            _ctx.stroke();
            // Antenna lines
            _ctx.beginPath();
            _ctx.moveTo(cx, cy - r - 8);
            _ctx.lineTo(cx, cy - r - 18);
            _ctx.moveTo(cx - 10, cy - r - 15);
            _ctx.lineTo(cx + 10, cy - r - 15);
            _ctx.strokeStyle = '#aaaaaa';
            _ctx.lineWidth = 1;
            _ctx.stroke();
        }

        // Docking indicator
        if (loc.dockable) {
            var ship = Ship.getShip();
            var ddx = loc.x - ship.x, ddy = loc.y - ship.y;
            var dist = Math.sqrt(ddx * ddx + ddy * ddy) - loc.radius;
            if (dist < 100) {
                _ctx.beginPath();
                _ctx.arc(cx, cy, r + 15, 0, Math.PI * 2);
                _ctx.strokeStyle = Config.COLORS.hud_highlight + '66';
                _ctx.lineWidth = 2;
                _ctx.setLineDash([5, 5]);
                _ctx.stroke();
                _ctx.setLineDash([]);

                if (dist < 60) {
                    _ctx.fillStyle = Config.COLORS.hud_highlight;
                    _ctx.font = '11px monospace';
                    _ctx.textAlign = 'center';
                    _ctx.fillText('[E] Dock', cx, cy - r - 20);
                }
            }
        }
    }

    function _drawAsteroidField(loc) {
        // Draw scattered rocks
        // Use id-based seed so asteroids look consistent while orbiting
        var seed = 0;
        for (var s = 0; s < loc.id.length; s++) seed = seed * 31 + loc.id.charCodeAt(s);
        var rng = _seededRandom(seed);
        for (var i = 0; i < 15; i++) {
            var ax = loc.x + (rng() - 0.5) * loc.radius * 2;
            var ay = loc.y + (rng() - 0.5) * loc.radius * 2;
            var ar = 3 + rng() * 8;
            _ctx.beginPath();
            _ctx.arc(ax, ay, ar, 0, Math.PI * 2);
            _ctx.fillStyle = '#' + (0x665544 + Math.floor(rng() * 0x222222)).toString(16);
            _ctx.fill();
        }
        // Label
        _ctx.fillStyle = '#999';
        _ctx.font = '10px monospace';
        _ctx.textAlign = 'center';
        _ctx.fillText('⛏ ' + loc.name, loc.x, loc.y + loc.radius + 12);
    }

    // Draw a block grid as a ship silhouette at given scale
    function _drawBlockGrid(grid, scale) {
        if (!grid || !grid.cells) return;
        var halfW = (grid.w * scale) / 2;
        var halfH = (grid.h * scale) / 2;
        for (var r = 0; r < grid.h; r++) {
            for (var c = 0; c < grid.w; c++) {
                var cell = grid.cells[r][c];
                if (!cell) continue;
                var def = Config.BLOCK_TYPES[cell.type];
                if (!def) continue;
                var bx = c * scale - halfW;
                var by = r * scale - halfH;
                // Color based on HP: normal→damaged→destroyed
                if (cell.hp <= 0) {
                    _ctx.fillStyle = 'rgba(40,40,40,0.3)';
                } else if (cell.hp < cell.maxHp * 0.5) {
                    _ctx.fillStyle = _darkenColor(def.color, 40);
                } else {
                    _ctx.fillStyle = def.color;
                }
                _ctx.fillRect(bx, by, scale - 0.5, scale - 0.5);
            }
        }
    }

    function _drawPlayerShip(ship) {
        if (ship.docked) {
            // Draw ship on the planet surface
            var loc = World.getLocation(ship.dockedAt);
            if (!loc) return;
            
            // Position ship slightly above center of the location (on its surface)
            var dockX = loc.x;
            var dockY = loc.y - loc.radius * 0.3;
            
            _ctx.save();
            _ctx.translate(dockX, dockY);
            // Ship faces upward when docked
            _ctx.rotate(0);
            
            var grid = ship.grid;
            if (grid && grid.cells) {
                _drawBlockGrid(grid, 3);
            } else {
                _ctx.beginPath();
                _ctx.moveTo(0, -18);
                _ctx.lineTo(-10, 10);
                _ctx.lineTo(0, 6);
                _ctx.lineTo(10, 10);
                _ctx.closePath();
                _ctx.fillStyle = Config.COLORS.player;
                _ctx.fill();
            }
            
            // Docking ring effect around ship
            var ringR = grid ? Math.max(grid.w, grid.h) * 2.5 : 20;
            _ctx.strokeStyle = 'rgba(100,180,255,0.25)';
            _ctx.lineWidth = 1.5;
            _ctx.beginPath();
            _ctx.arc(0, 0, ringR, 0, Math.PI * 2);
            _ctx.stroke();
            
            _ctx.restore();
            return;
        }

        _ctx.save();
        _ctx.translate(ship.x, ship.y);
        _ctx.rotate(ship.angle - Math.PI / 2); // grid top = forward direction

        var grid = ship.grid;
        if (grid && grid.cells) {
            _drawBlockGrid(grid, 3);
        } else {
            // Fallback triangle
            _ctx.beginPath();
            _ctx.moveTo(18, 0);
            _ctx.lineTo(-10, -10);
            _ctx.lineTo(-6, 0);
            _ctx.lineTo(-10, 10);
            _ctx.closePath();
            _ctx.fillStyle = Config.COLORS.player;
            _ctx.fill();
        }

        // Engine glow when thrusting
        if (Input.isDown('UP') && grid) {
            var halfH = (grid.h * 3) / 2;
            _ctx.fillStyle = '#ff8800';
            _ctx.beginPath();
            _ctx.moveTo(-4, halfH);
            _ctx.lineTo(0, halfH + 6 + Math.random() * 8);
            _ctx.lineTo(4, halfH);
            _ctx.fill();
        }

        _ctx.restore();

        // Shield effect
        if (ship.shieldHp > 0) {
            var shieldR = grid ? Math.max(grid.w, grid.h) * 1.8 : 22;
            _ctx.beginPath();
            _ctx.arc(ship.x, ship.y, shieldR, 0, Math.PI * 2);
            var alpha = Math.floor((ship.shieldHp / ship.maxShieldHp) * 40 + 10).toString(16);
            if (alpha.length === 1) alpha = '0' + alpha;
            _ctx.strokeStyle = Config.COLORS.shield + alpha;
            _ctx.lineWidth = 2;
            _ctx.stroke();
        }
    }

    function _drawNPCs() {
        var npcs = World.getNPCs();
        var zoom = Input.getZoom();
        var viewW = Config.VIEWPORT_W / zoom;
        var viewH = Config.VIEWPORT_H / zoom;
        for (var i = 0; i < npcs.length; i++) {
            var npc = npcs[i];
            if (npc.dead) continue;
            if (npc.x < _camX - 30 || npc.x > _camX + viewW + 30 ||
                npc.y < _camY - 30 || npc.y > _camY + viewH + 30) continue;

            var color = _getFactionColor(npc.faction);
            if (Factions.isHostile(npc.faction)) color = Config.COLORS.enemy;

            _ctx.save();
            _ctx.translate(npc.x, npc.y);
            _ctx.rotate(npc.angle - Math.PI / 2);

            if (npc.grid && npc.grid.cells) {
                _drawBlockGrid(npc.grid, 2.5);
            } else if (npc.behavior === 'patrol') {
                _ctx.beginPath();
                _ctx.moveTo(12, 0);
                _ctx.lineTo(-8, -7);
                _ctx.lineTo(-4, 0);
                _ctx.lineTo(-8, 7);
                _ctx.closePath();
                _ctx.fillStyle = color;
                _ctx.fill();
            } else {
                _ctx.beginPath();
                _ctx.moveTo(10, 0);
                _ctx.lineTo(0, -6);
                _ctx.lineTo(-10, 0);
                _ctx.lineTo(0, 6);
                _ctx.closePath();
                _ctx.fillStyle = color;
                _ctx.fill();
            }
            _ctx.restore();

            // HP bar for damaged NPCs
            if (npc.hp < npc.maxHp) {
                var barW = 20;
                var hpPct = npc.hp / npc.maxHp;
                _ctx.fillStyle = '#333';
                _ctx.fillRect(npc.x - barW / 2, npc.y - 18, barW, 3);
                _ctx.fillStyle = hpPct > 0.5 ? '#00cc00' : hpPct > 0.25 ? '#cccc00' : '#cc0000';
                _ctx.fillRect(npc.x - barW / 2, npc.y - 18, barW * hpPct, 3);
            }
        }
    }

    function _drawFleetShips() {
        var ships = Fleet.getShips();
        var zoom = Input.getZoom();
        var viewW = Config.VIEWPORT_W / zoom;
        var viewH = Config.VIEWPORT_H / zoom;
        for (var i = 0; i < ships.length; i++) {
            var s = ships[i];
            if (s.dead) continue;
            if (s.x < _camX - 30 || s.x > _camX + viewW + 30 ||
                s.y < _camY - 30 || s.y > _camY + viewH + 30) continue;

            _ctx.save();
            _ctx.translate(s.x, s.y);
            _ctx.rotate(s.angle - Math.PI / 2);
            if (s.grid && s.grid.cells) {
                _drawBlockGrid(s.grid, 2.5);
            } else {
                _ctx.beginPath();
                _ctx.moveTo(14, 0);
                _ctx.lineTo(-8, -8);
                _ctx.lineTo(-4, 0);
                _ctx.lineTo(-8, 8);
                _ctx.closePath();
                _ctx.fillStyle = Config.COLORS.ally;
                _ctx.fill();
            }
            _ctx.restore();

            // HP bar
            if (s.hp < s.maxHp) {
                var bw = 18;
                var hp = s.hp / s.maxHp;
                _ctx.fillStyle = '#333';
                _ctx.fillRect(s.x - bw / 2, s.y - 16, bw, 3);
                _ctx.fillStyle = '#44aaff';
                _ctx.fillRect(s.x - bw / 2, s.y - 16, bw * hp, 3);
            }
        }
    }

    function _drawProjectiles() {
        var projs = World.getProjectiles();
        var zoom = Input.getZoom();
        var viewW = Config.VIEWPORT_W / zoom;
        var viewH = Config.VIEWPORT_H / zoom;
        for (var i = 0; i < projs.length; i++) {
            var p = projs[i];
            if (p.x < _camX - 5 || p.x > _camX + viewW + 5 ||
                p.y < _camY - 5 || p.y > _camY + viewH + 5) continue;

            var color = p.owner === 'player' ? '#00ff88' : '#ff4444';
            if (p.type === 'explosive') color = p.owner === 'player' ? '#ffaa00' : '#ff6600';
            if (p.type === 'kinetic') color = p.owner === 'player' ? '#aaddff' : '#ff8888';

            _ctx.beginPath();
            _ctx.moveTo(p.x, p.y);
            _ctx.lineTo(p.x - Math.cos(p.angle) * 6, p.y - Math.sin(p.angle) * 6);
            _ctx.strokeStyle = color;
            _ctx.lineWidth = 2;
            _ctx.stroke();
        }
    }

    function _drawExplosions() {
        var exps = World.getExplosions();
        for (var i = 0; i < exps.length; i++) {
            var e = exps[i];
            var progress = 1 - (e.timer / Config.COMBAT.EXPLOSION_DURATION);
            var alpha = 1 - progress;
            var r = e.radius * (0.5 + progress * 0.5);

            var grad = _ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, r);
            grad.addColorStop(0, 'rgba(255,200,50,' + alpha + ')');
            grad.addColorStop(0.5, 'rgba(255,100,20,' + (alpha * 0.6) + ')');
            grad.addColorStop(1, 'rgba(255,50,10,0)');
            _ctx.fillStyle = grad;
            _ctx.fillRect(e.x - r, e.y - r, r * 2, r * 2);
        }
    }

    function _drawWaypoint(ship) {
        var wp = Ship.getWaypoint();
        if (!wp || ship.docked) return;

        var t = Date.now() * 0.003;
        var pulse = 0.5 + 0.3 * Math.sin(t);

        // Dashed line from ship to waypoint
        _ctx.save();
        _ctx.strokeStyle = 'rgba(0,255,136,' + (pulse * 0.4) + ')';
        _ctx.lineWidth = 1;
        _ctx.setLineDash([8, 6]);
        _ctx.beginPath();
        _ctx.moveTo(ship.x, ship.y);
        _ctx.lineTo(wp.x, wp.y);
        _ctx.stroke();
        _ctx.setLineDash([]);

        // Waypoint marker (animated ring)
        var r = 8 + 3 * Math.sin(t);
        _ctx.strokeStyle = 'rgba(0,255,136,' + pulse + ')';
        _ctx.lineWidth = 2;
        _ctx.beginPath();
        _ctx.arc(wp.x, wp.y, r, 0, Math.PI * 2);
        _ctx.stroke();

        // Inner dot
        _ctx.fillStyle = 'rgba(0,255,136,0.7)';
        _ctx.beginPath();
        _ctx.arc(wp.x, wp.y, 2, 0, Math.PI * 2);
        _ctx.fill();

        // Crosshair lines
        _ctx.strokeStyle = 'rgba(0,255,136,' + (pulse * 0.6) + ')';
        _ctx.lineWidth = 1;
        _ctx.beginPath();
        _ctx.moveTo(wp.x - r - 4, wp.y); _ctx.lineTo(wp.x - r + 2, wp.y);
        _ctx.moveTo(wp.x + r - 2, wp.y); _ctx.lineTo(wp.x + r + 4, wp.y);
        _ctx.moveTo(wp.x, wp.y - r - 4); _ctx.lineTo(wp.x, wp.y - r + 2);
        _ctx.moveTo(wp.x, wp.y + r - 2); _ctx.lineTo(wp.x, wp.y + r + 4);
        _ctx.stroke();

        _ctx.restore();
    }

    function _drawHUD(ship) {
        var pad = 10;

        // HUD background
        _ctx.fillStyle = 'rgba(0,0,0,0.4)';
        _ctx.fillRect(pad - 4, pad - 4, 164, 120);

        // HP Bar
        _drawBar(pad, pad, 150, 14, ship.hp, ship.maxHp, '#00cc44', 'HP');

        // Shield Bar
        _drawBar(pad, pad + 20, 150, 14, ship.shieldHp, ship.maxShieldHp, '#4466ff', 'Shield');

        // Fuel Bar — show total fuel across all types vs fuel capacity
        var totalFuel = 0;
        var fuelTypes = Ship.getFuelTypes();
        for (var ft in fuelTypes) {
            totalFuel += (ship.inventory[ft] || 0);
        }
        // If no fuel types tracked, show primary fuel
        if (totalFuel === 0 && Object.keys(fuelTypes).length === 0) {
            totalFuel = ship.inventory['chemical_propellant'] || 0;
        }
        var fuelMax = Math.max(totalFuel, ship.maxFuel || 100);
        _drawBar(pad, pad + 40, 150, 14, totalFuel, fuelMax, '#ffaa00', 'Fuel');

        // Credits
        _ctx.fillStyle = Config.COLORS.hud_text;
        _ctx.font = '13px monospace';
        _ctx.textAlign = 'left';
        _ctx.fillText('💰 ' + Economy.getCredits().toLocaleString(), pad, pad + 72);

        // Cargo & Fuel capacity
        _ctx.fillText('📦 ' + Ship.getCargoUsed() + '/' + ship.cargo, pad, pad + 88);
        _ctx.fillText('⛽ ' + Ship.getFuelUsed() + '/' + (ship.maxFuel || 0), pad + 120, pad + 88);

        // Active weapon
        var activeWpn = Ship.getActiveWeapon ? Ship.getActiveWeapon() : null;
        if (activeWpn) {
            var wDef = Config.WEAPON_TYPES[activeWpn] || Config.BLOCK_TYPES[activeWpn];
            var wName = wDef ? wDef.name : activeWpn;
            _ctx.fillText('🔫 ' + wName, pad, pad + 108);
        }

        // Location info
        var nearby = World.getNearbyLocation(ship.x, ship.y, 300);
        if (nearby) {
            _ctx.fillStyle = Config.COLORS.hud_text;
            _ctx.font = '12px monospace';
            _ctx.textAlign = 'left';
            var dx = nearby.x - ship.x, dy = nearby.y - ship.y;
            var dist = Math.floor(Math.sqrt(dx * dx + dy * dy));
            _ctx.fillText('📍 ' + nearby.name + ' (' + dist + 'u)', pad, pad + 124);
        }

        // Speed indicator
        _ctx.fillStyle = Config.COLORS.hud_text;
        _ctx.font = '11px monospace';
        _ctx.textAlign = 'right';
        var speed = Math.sqrt(ship.vx * ship.vx + ship.vy * ship.vy).toFixed(1);
        _ctx.fillText('Speed: ' + speed, Config.VIEWPORT_W - pad, pad + 14);

        // Game speed
        _ctx.fillText('Game: ' + Engine.getGameSpeed() + 'x', Config.VIEWPORT_W - pad, pad + 30);

        // Date
        var date = Engine.getDate();
        _ctx.fillText(date.monthName.substr(0, 3) + ' ' + date.day + ', ' + date.year, Config.VIEWPORT_W - pad, pad + 46);

        // Coordinates
        _ctx.fillText('X:' + Math.floor(ship.x) + ' Y:' + Math.floor(ship.y), Config.VIEWPORT_W - pad, pad + 62);

        // Docked status
        if (ship.docked) {
            _ctx.fillStyle = Config.COLORS.hud_highlight;
            _ctx.font = 'bold 14px monospace';
            _ctx.textAlign = 'center';
            // Show location name instead of ID
            var dockedLoc = World.getLocation(ship.dockedAt);
            var dockedName = dockedLoc ? dockedLoc.name : (ship.dockedAt || '???');
            _ctx.fillText('⚓ DOCKED at ' + dockedName, Config.VIEWPORT_W / 2, pad + 14);
        }

        // Paused overlay
        if (Engine.isPaused()) {
            _ctx.fillStyle = 'rgba(0,0,0,0.5)';
            _ctx.fillRect(0, 0, Config.VIEWPORT_W, Config.VIEWPORT_H);
            _ctx.fillStyle = '#ffffff';
            _ctx.font = 'bold 36px monospace';
            _ctx.textAlign = 'center';
            _ctx.fillText('PAUSED', Config.VIEWPORT_W / 2, Config.VIEWPORT_H / 2);
            _ctx.font = '16px monospace';
            _ctx.fillText('Press P to resume', Config.VIEWPORT_W / 2, Config.VIEWPORT_H / 2 + 30);
        }

        // Game over overlay
        if (Engine.isGameOver()) {
            _ctx.fillStyle = 'rgba(0,0,0,0.7)';
            _ctx.fillRect(0, 0, Config.VIEWPORT_W, Config.VIEWPORT_H);
            _ctx.fillStyle = '#ff4444';
            _ctx.font = 'bold 36px monospace';
            _ctx.textAlign = 'center';

            var victory = Diplomacy.checkVictory();
            if (victory.victory) {
                _ctx.fillStyle = '#00ff88';
                _ctx.fillText('VICTORY!', Config.VIEWPORT_W / 2, Config.VIEWPORT_H / 2 - 20);
                _ctx.font = '18px monospace';
                _ctx.fillStyle = '#ffffff';
                var vType = victory.type === 'peace' ? 'Peace has been achieved!' :
                    victory.type === 'war_earth' ? 'Earth wins the war!' : 'Mars wins the war!';
                _ctx.fillText(vType, Config.VIEWPORT_W / 2, Config.VIEWPORT_H / 2 + 20);
            } else {
                _ctx.fillText('DESTROYED', Config.VIEWPORT_W / 2, Config.VIEWPORT_H / 2 - 20);
                _ctx.font = '16px monospace';
                _ctx.fillStyle = '#ffffff';
                _ctx.fillText('Press R to respawn (10% credit penalty)', Config.VIEWPORT_W / 2, Config.VIEWPORT_H / 2 + 20);
            }
        }

        // Active missions indicator — show tracked mission with details
        var activeMissions = Missions.getActive();
        var tracked = Missions.getTrackedMission();
        if (activeMissions.length > 0) {
            // Calculate dynamic height based on content
            var objCount = tracked ? Math.min(tracked.objectives.length, 4) : 0;
            var boxW = 260, boxH = tracked ? (55 + objCount * 13 + 14) : 55;
            var boxX = Config.VIEWPORT_W - boxW - 5;
            var boxY = Config.VIEWPORT_H - boxH - 30;
            _ctx.fillStyle = Config.COLORS.hud_bg;
            _ctx.fillRect(boxX, boxY, boxW, boxH);
            _ctx.strokeStyle = Config.COLORS.hud_border;
            _ctx.strokeRect(boxX, boxY, boxW, boxH);

            _ctx.textAlign = 'left';
            var ty = boxY + 14;

            // Header with count
            _ctx.fillStyle = Config.COLORS.hud_highlight;
            _ctx.font = 'bold 11px monospace';
            _ctx.fillText('📋 Missions (' + activeMissions.length + ')  [J]', boxX + 6, ty);
            ty += 16;

            if (tracked) {
                // Tracked mission details
                var typeIcons = { delivery: '📦', combat: '⚔️', escort: '🛡️', spy: '🕵️', sabotage: '💣', diplomatic: '🕊️', mining: '⛏️' };
                var icon = typeIcons[tracked.type] || '📋';
                _ctx.fillStyle = '#ffcc44';
                _ctx.font = 'bold 11px monospace';
                _ctx.fillText('▶ ' + icon + ' ' + tracked.name, boxX + 6, ty);
                ty += 14;

                // Objective progress (cap at 4)
                _ctx.font = '10px monospace';
                var maxObj = Math.min(4, tracked.objectives.length);
                for (var oi = 0; oi < maxObj; oi++) {
                    var obj = tracked.objectives[oi];
                    var check = obj.done ? '✅' : '⬜';
                    var objText = '';
                    if (obj.type === 'go_to') {
                        var dest = World.getLocation(obj.target);
                        objText = 'Go to ' + (dest ? dest.name : '???');
                    } else if (obj.type === 'return') {
                        objText = 'Return to origin';
                    } else if (obj.type === 'destroy') {
                        objText = 'Destroy: ' + (obj.destroyed || 0) + '/' + obj.count;
                    } else if (obj.type === 'collect') {
                        var rName = Config.RESOURCES[obj.resource] ? Config.RESOURCES[obj.resource].name : obj.resource;
                        objText = 'Collect ' + rName + ': ' + (obj.collected || 0) + '/' + obj.amount;
                    }
                    _ctx.fillStyle = obj.done ? '#44cc88' : '#ccddee';
                    _ctx.fillText('  ' + check + ' ' + objText, boxX + 6, ty);
                    ty += 13;
                }

                // Reward line
                _ctx.fillStyle = '#88aa88';
                _ctx.font = '9px monospace';
                _ctx.fillText('  💰 ' + tracked.reward.credits + ' cr', boxX + 6, ty);
                if (tracked.reward.reputation) {
                    _ctx.fillText(' | Rep +' + tracked.reward.reputation.amount, boxX + 100, ty);
                }
            } else {
                // Just list mission names briefly
                _ctx.font = '10px monospace';
                _ctx.fillStyle = Config.COLORS.hud_text;
                for (var mi = 0; mi < Math.min(2, activeMissions.length); mi++) {
                    _ctx.fillText('• ' + activeMissions[mi].name, boxX + 6, ty);
                    ty += 13;
                }
                if (activeMissions.length > 2) {
                    _ctx.fillText('  +' + (activeMissions.length - 2) + ' more...', boxX + 6, ty);
                }
            }
        }

        // Path progress
        var path = Diplomacy.getPath();
        if (path !== 'none') {
            var progress = path === 'peace' ? Diplomacy.getPeaceProgress() : Diplomacy.getWarProgress();
            var label = path === 'peace' ? '🕊️ Peace' : '⚔️ War';
            _drawBar(pad, Config.VIEWPORT_H - 30, 150, 14, progress, 100, path === 'peace' ? '#44cc88' : '#cc4444', label + ' ' + Math.floor(progress) + '%');
        }

        // Controls help
        _ctx.fillStyle = 'rgba(170,200,230,0.4)';
        _ctx.font = '10px monospace';
        _ctx.textAlign = 'left';
        _ctx.fillText('WASD:Move  Space:Fire  E:Dock  J:Missions  Scroll:Zoom  P:Pause  M:Map  F:Fleet', pad, Config.VIEWPORT_H - 8);
    }

    function _drawBar(x, y, w, h, value, maxValue, color, label) {
        var pct = maxValue > 0 ? value / maxValue : 0;
        _ctx.fillStyle = Config.COLORS.hud_bg;
        _ctx.fillRect(x, y, w, h);
        _ctx.fillStyle = color;
        _ctx.fillRect(x, y, w * pct, h);
        _ctx.strokeStyle = Config.COLORS.hud_border;
        _ctx.strokeRect(x, y, w, h);
        _ctx.fillStyle = '#ffffff';
        _ctx.font = '10px monospace';
        _ctx.textAlign = 'left';
        _ctx.fillText(label + ': ' + Math.ceil(value) + '/' + Math.ceil(maxValue), x + 4, y + h - 3);
    }

    function _drawMinimap(ship) {
        var mx = Config.VIEWPORT_W - Config.MINIMAP_W - 10;
        var my = 10;

        _miniCtx.fillStyle = 'rgba(5,5,20,0.9)';
        _miniCtx.fillRect(0, 0, Config.MINIMAP_W, Config.MINIMAP_H);

        var scaleX = Config.MINIMAP_W / Config.WORLD_W;
        var scaleY = Config.MINIMAP_H / Config.WORLD_H;

        // Orbit rings on minimap
        _miniCtx.strokeStyle = 'rgba(60,70,90,0.4)';
        _miniCtx.lineWidth = 0.5;
        var locs = World.getLocations();
        for (var o = 0; o < locs.length; o++) {
            var ol = locs[o];
            if (!ol.orbit || ol.orbit.parent !== 'sun') continue;
            _miniCtx.beginPath();
            _miniCtx.arc(Config.SUN_X * scaleX, Config.SUN_Y * scaleY, ol.orbit.radius * scaleX, 0, Math.PI * 2);
            _miniCtx.stroke();
        }

        // Locations
        for (var i = 0; i < locs.length; i++) {
            var loc = locs[i];
            var lx = loc.x * scaleX;
            var ly = loc.y * scaleY;
            var lr = Math.max(1.5, loc.radius * scaleX);
            if (loc.type === Config.LOC_TYPE.STAR) lr = Math.max(4, lr);
            _miniCtx.beginPath();
            _miniCtx.arc(lx, ly, lr, 0, Math.PI * 2);
            _miniCtx.fillStyle = loc.color;
            _miniCtx.fill();
        }

        // Player
        _miniCtx.fillStyle = Config.COLORS.player;
        _miniCtx.fillRect(ship.x * scaleX - 2, ship.y * scaleY - 2, 4, 4);

        // Fleet
        var fleet = Fleet.getShips();
        for (var fi = 0; fi < fleet.length; fi++) {
            if (fleet[fi].dead) continue;
            _miniCtx.fillStyle = Config.COLORS.ally;
            _miniCtx.fillRect(fleet[fi].x * scaleX - 1, fleet[fi].y * scaleY - 1, 2, 2);
        }

        // NPCs
        var npcs = World.getNPCs();
        for (var ni = 0; ni < npcs.length; ni++) {
            if (npcs[ni].dead) continue;
            _miniCtx.fillStyle = Factions.isHostile(npcs[ni].faction) ? Config.COLORS.enemy : '#666666';
            _miniCtx.fillRect(npcs[ni].x * scaleX - 1, npcs[ni].y * scaleY - 1, 2, 2);
        }

        // Viewport rect
        _miniCtx.strokeStyle = '#ffffff44';
        _miniCtx.strokeRect(
            _camX * scaleX, _camY * scaleY,
            Config.VIEWPORT_W * scaleX, Config.VIEWPORT_H * scaleY
        );

        // Border
        _miniCtx.strokeStyle = Config.COLORS.hud_border;
        _miniCtx.strokeRect(0, 0, Config.MINIMAP_W, Config.MINIMAP_H);

        // Draw minimap on main canvas
        _ctx.drawImage(_miniCanvas, mx, my);
    }

    function _getFactionColor(faction) {
        switch (faction) {
            case Config.FACTION.EARTH: return Config.COLORS.earth;
            case Config.FACTION.MARS: return Config.COLORS.mars;
            case Config.FACTION.MOON: return Config.COLORS.moon;
            case Config.FACTION.PLAYER: return Config.COLORS.player;
            default: return Config.COLORS.neutral;
        }
    }

    function _lightenColor(hex, amount) {
        var r = parseInt(hex.slice(1, 3), 16);
        var g = parseInt(hex.slice(3, 5), 16);
        var b = parseInt(hex.slice(5, 7), 16);
        r = Math.min(255, r + amount);
        g = Math.min(255, g + amount);
        b = Math.min(255, b + amount);
        return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    }

    function _darkenColor(hex, amount) {
        var r = parseInt(hex.slice(1, 3), 16);
        var g = parseInt(hex.slice(3, 5), 16);
        var b = parseInt(hex.slice(5, 7), 16);
        r = Math.max(0, r - amount);
        g = Math.max(0, g - amount);
        b = Math.max(0, b - amount);
        return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    }

    function _drawGalaxyMap(ship) {
        // Full-screen galaxy map overlay
        var pad = 40;
        var mapW = Config.VIEWPORT_W - pad * 2;
        var mapH = Config.VIEWPORT_H - pad * 2;
        var scaleX = mapW / Config.WORLD_W;
        var scaleY = mapH / Config.WORLD_H;

        // Background
        _ctx.fillStyle = 'rgba(5,5,20,0.92)';
        _ctx.fillRect(pad, pad, mapW, mapH);
        _ctx.strokeStyle = '#445566';
        _ctx.lineWidth = 2;
        _ctx.strokeRect(pad, pad, mapW, mapH);

        // Title
        _ctx.fillStyle = '#00ffaa';
        _ctx.font = 'bold 18px monospace';
        _ctx.textAlign = 'center';
        _ctx.fillText('Galaxy Map', Config.VIEWPORT_W / 2, pad + 24);
        _ctx.font = '11px monospace';
        _ctx.fillStyle = '#888';
        _ctx.fillText('Click anywhere to close', Config.VIEWPORT_W / 2, pad + 40);

        var ox = pad;
        var oy = pad + 50;
        var drawH = mapH - 60;
        var drawScaleY = drawH / Config.WORLD_H;

        // Orbit rings
        var locs = World.getLocations();
        _ctx.strokeStyle = 'rgba(60,80,110,0.35)';
        _ctx.lineWidth = 1;
        for (var o = 0; o < locs.length; o++) {
            var ol = locs[o];
            if (!ol.orbit || ol.orbit.parent !== 'sun') continue;
            _ctx.beginPath();
            _ctx.arc(ox + Config.SUN_X * scaleX, oy + Config.SUN_Y * drawScaleY, ol.orbit.radius * scaleX, 0, Math.PI * 2);
            _ctx.stroke();
        }

        // Draw locations with labels — planets bigger text, smart label positioning
        // Pre-assign label positions to avoid overlap
        var labelPlacements = {
            'sun':           'below',
            'mercury':       'below',
            'venus':         'below',
            'earth':         'left',
            'mars':          'right',
            'luna':          'above',
            'mars_orbital':  'left',
            'station_alpha': 'right',
            'station_beta':  'left',
            'station_gamma': 'below',
            'asteroid_belt_1': 'left',
            'asteroid_belt_2': 'right'
        };

        for (var i = 0; i < locs.length; i++) {
            var loc = locs[i];
            var lx = ox + loc.x * scaleX;
            var ly = oy + loc.y * drawScaleY;
            var lr = Math.max(2, loc.radius * scaleX * 0.6);

            if (loc.type === Config.LOC_TYPE.STAR) {
                lr = Math.max(5, lr);
                var sunGrad = _ctx.createRadialGradient(lx, ly, 0, lx, ly, lr * 2);
                sunGrad.addColorStop(0, 'rgba(255,220,100,0.4)');
                sunGrad.addColorStop(1, 'rgba(255,100,0,0)');
                _ctx.fillStyle = sunGrad;
                _ctx.beginPath();
                _ctx.arc(lx, ly, lr * 2, 0, Math.PI * 2);
                _ctx.fill();
            }

            _ctx.beginPath();
            _ctx.arc(lx, ly, lr, 0, Math.PI * 2);
            _ctx.fillStyle = loc.color;
            _ctx.fill();

            // Determine text size — planets/star/moon get bigger labels
            var isPlanet = (loc.type === Config.LOC_TYPE.PLANET || loc.type === Config.LOC_TYPE.STAR || loc.type === Config.LOC_TYPE.MOON);
            var fontSize = isPlanet ? 14 : 10;
            var fontWeight = isPlanet ? 'bold ' : '';
            _ctx.font = fontWeight + fontSize + 'px monospace';

            // Label color — faction color for dockable, otherwise neutral
            if (loc.type !== Config.LOC_TYPE.STAR && loc.dockable) {
                _ctx.fillStyle = _getFactionColor(loc.faction);
            } else {
                _ctx.fillStyle = isPlanet ? '#dddddd' : '#aaaaaa';
            }

            // Position label based on placement assignment
            var placement = labelPlacements[loc.id] || 'below';
            var labelX = lx, labelY = ly;
            var anchorGap = lr + 6;

            switch (placement) {
                case 'above':
                    _ctx.textAlign = 'center';
                    labelY = ly - anchorGap;
                    break;
                case 'below':
                    _ctx.textAlign = 'center';
                    labelY = ly + anchorGap + fontSize;
                    break;
                case 'left':
                    _ctx.textAlign = 'right';
                    labelX = lx - anchorGap;
                    labelY = ly + fontSize * 0.35;
                    break;
                case 'right':
                    _ctx.textAlign = 'left';
                    labelX = lx + anchorGap;
                    labelY = ly + fontSize * 0.35;
                    break;
            }

            _ctx.fillText(loc.name, labelX, labelY);

            // Show dockable indicator
            if (loc.dockable) {
                _ctx.fillStyle = '#666';
                _ctx.font = '8px monospace';
                _ctx.textAlign = 'center';
                var dockY = placement === 'above' ? labelY - 12 : labelY + 10;
                _ctx.fillText('⚓', placement === 'left' ? lx - anchorGap - 4 : (placement === 'right' ? lx + anchorGap + 4 : lx), dockY);
            }
        }

        // Player position
        var px = ox + ship.x * scaleX;
        var py = oy + ship.y * drawScaleY;
        // Player marker with pulse effect
        _ctx.beginPath();
        _ctx.arc(px, py, 5, 0, Math.PI * 2);
        _ctx.fillStyle = Config.COLORS.player;
        _ctx.fill();
        _ctx.strokeStyle = '#ffffff';
        _ctx.lineWidth = 1.5;
        _ctx.stroke();
        // Label
        _ctx.fillStyle = Config.COLORS.player;
        _ctx.font = 'bold 10px monospace';
        _ctx.textAlign = 'center';
        _ctx.fillText('YOU', px, py - 10);

        // Fleet ships
        var fleet = Fleet.getShips();
        _ctx.fillStyle = Config.COLORS.ally;
        for (var fi = 0; fi < fleet.length; fi++) {
            if (fleet[fi].dead) continue;
            _ctx.fillRect(ox + fleet[fi].x * scaleX - 1, oy + fleet[fi].y * drawScaleY - 1, 3, 3);
        }

        // NPCs
        var npcs = World.getNPCs();
        for (var ni = 0; ni < npcs.length; ni++) {
            if (npcs[ni].dead) continue;
            _ctx.fillStyle = Factions.isHostile(npcs[ni].faction) ? Config.COLORS.enemy : '#555555';
            _ctx.fillRect(ox + npcs[ni].x * scaleX - 1, oy + npcs[ni].y * drawScaleY - 1, 2, 2);
        }

        // Viewport rectangle
        var zoom = Input.getZoom();
        var viewW = Config.VIEWPORT_W / zoom;
        var viewH = Config.VIEWPORT_H / zoom;
        _ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        _ctx.lineWidth = 1;
        _ctx.strokeRect(
            ox + _camX * scaleX, oy + _camY * drawScaleY,
            viewW * scaleX, viewH * drawScaleY
        );

        // Zoom level
        _ctx.fillStyle = '#888';
        _ctx.font = '10px monospace';
        _ctx.textAlign = 'right';
        _ctx.fillText('Zoom: ' + Input.getZoom().toFixed(1) + 'x', Config.VIEWPORT_W - pad - 10, pad + mapH - 10);
    }

    function _drawShipInfo() {
        if (!_shipInfoTarget) return;
        var d = _shipInfoTarget.data;

        // Tooltip dimensions
        var tw = 220, th = 140;
        var tx = Math.min(_shipInfoTarget.screenX + 10, Config.VIEWPORT_W - tw - 10);
        var ty = Math.min(_shipInfoTarget.screenY + 10, Config.VIEWPORT_H - th - 10);

        // Background
        _ctx.fillStyle = 'rgba(10,15,30,0.92)';
        _ctx.fillRect(tx, ty, tw, th);
        _ctx.strokeStyle = '#445566';
        _ctx.lineWidth = 1;
        _ctx.strokeRect(tx, ty, tw, th);

        var px = tx + 8, py = ty + 18;
        _ctx.textAlign = 'left';

        // Name
        _ctx.fillStyle = '#00ffaa';
        _ctx.font = 'bold 12px monospace';
        _ctx.fillText(d.name || d.id || 'Unknown', px, py);
        py += 16;

        // Type
        _ctx.fillStyle = '#aaaacc';
        _ctx.font = '11px monospace';
        if (_shipInfoTarget.type === 'npc') {
            var fName = d.faction || 'unknown';
            _ctx.fillStyle = _getFactionColor(d.faction);
            _ctx.fillText('Faction: ' + fName, px, py);
            py += 14;
            _ctx.fillStyle = '#aaaacc';
            _ctx.fillText('Role: ' + (d.behavior || d.role || 'patrol'), px, py);
            py += 14;
        } else {
            _ctx.fillStyle = Config.COLORS.ally;
            _ctx.fillText('Fleet Ship', px, py);
            py += 14;
            _ctx.fillStyle = '#aaaacc';
            _ctx.fillText('Order: ' + (d.order || 'follow'), px, py);
            py += 14;
        }

        // Stats
        _ctx.fillStyle = '#cccccc';
        _ctx.font = '10px monospace';
        var hpPct = d.maxHp > 0 ? Math.ceil(d.hp / d.maxHp * 100) : 0;
        _ctx.fillText('HP: ' + Math.ceil(d.hp) + '/' + Math.ceil(d.maxHp) + ' (' + hpPct + '%)', px, py);
        py += 13;
        _ctx.fillText('Shield: ' + Math.ceil(d.shieldHp || 0) + '/' + Math.ceil(d.maxShieldHp || 0), px, py);
        py += 13;
        _ctx.fillText('Speed: ' + (d.speed || 0).toFixed(1), px, py);
        py += 13;

        // Template info
        if (d.templateId) {
            _ctx.fillStyle = '#888';
            _ctx.fillText('Type: ' + d.templateId, px, py);
            py += 13;
        }

        // Weapon info
        if (d.weapon || d.weapons) {
            var wpnName = d.weapon || (d.weapons && d.weapons[0]) || 'none';
            var wpnDef = Config.BLOCK_TYPES[wpnName] || Config.WEAPON_TYPES[wpnName];
            _ctx.fillStyle = '#ff8844';
            _ctx.fillText('Weapon: ' + (wpnDef ? wpnDef.name : wpnName), px, py);
        }

        // Close hint
        _ctx.fillStyle = '#555';
        _ctx.font = '9px monospace';
        _ctx.textAlign = 'center';
        _ctx.fillText('Click elsewhere to dismiss', tx + tw / 2, ty + th - 5);
    }

    function _seededRandom(seed) {
        return function () {
            seed = (seed * 9301 + 49297) % 233280;
            return seed / 233280;
        };
    }

    return {
        init: init,
        render: render,
        getCanvas: getCanvas,
        getCamX: getCamX,
        getCamY: getCamY,
        toggleGalaxyMap: function () { _showGalaxyMap = !_showGalaxyMap; },
        isGalaxyMapOpen: function () { return _showGalaxyMap; }
    };
})();
