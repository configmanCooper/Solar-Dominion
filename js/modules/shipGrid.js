/* ============================================================
 * Solar Dominion — Ship Grid Module
 * Block-based ship grid: creation, placement, stats, damage.
 * ============================================================ */
var ShipGrid = (function () {
    'use strict';

    // Create an empty grid of given dimensions
    function createGrid(hullClass) {
        var hc = Config.HULL_CLASSES[hullClass];
        if (!hc) return null;
        var grid = {
            hullClass: hullClass,
            w: hc.gridW,
            h: hc.gridH,
            cells: [],
            // Cached derived stats (call deriveStats to update)
            stats: null
        };
        for (var r = 0; r < hc.gridH; r++) {
            grid.cells[r] = [];
            for (var c = 0; c < hc.gridW; c++) {
                grid.cells[r][c] = null;
            }
        }
        return grid;
    }

    // Deep-copy a grid (for NPC/fleet instantiation from templates)
    function cloneGrid(src) {
        var grid = {
            hullClass: src.hullClass,
            w: src.w,
            h: src.h,
            cells: [],
            stats: null
        };
        for (var r = 0; r < src.h; r++) {
            grid.cells[r] = [];
            for (var c = 0; c < src.w; c++) {
                var cell = src.cells[r][c];
                if (cell) {
                    grid.cells[r][c] = { type: cell.type, hp: cell.hp, maxHp: cell.maxHp };
                } else {
                    grid.cells[r][c] = null;
                }
            }
        }
        grid.stats = deriveStats(grid);
        return grid;
    }

    // Place a block on the grid. Returns true if successful.
    function placeBlock(grid, row, col, blockTypeKey) {
        if (row < 0 || row >= grid.h || col < 0 || col >= grid.w) return false;
        if (grid.cells[row][col] !== null) return false;

        var def = Config.BLOCK_TYPES[blockTypeKey];
        if (!def) return false;

        // Placement rule validation
        if (def.placement === 'aft' && row < grid.h - 2) return false;
        if (def.placement === 'edge' && !_isEdge(grid, row, col)) return false;
        if (def.unique && _countBlockType(grid, blockTypeKey) > 0) return false;

        grid.cells[row][col] = {
            type: blockTypeKey,
            hp: def.hp,
            maxHp: def.hp
        };

        grid.stats = deriveStats(grid);
        return true;
    }

    // Remove a block. Returns the block type key or null.
    function removeBlock(grid, row, col) {
        if (row < 0 || row >= grid.h || col < 0 || col >= grid.w) return null;
        var cell = grid.cells[row][col];
        if (!cell) return null;
        var typeKey = cell.type;
        grid.cells[row][col] = null;
        grid.stats = deriveStats(grid);
        return typeKey;
    }

    // Check if all occupied cells form one connected component from cockpit
    function isConnected(grid) {
        var cockpitPos = _findBlock(grid, 'cockpit');
        if (!cockpitPos) return false;

        var visited = {};
        var queue = [cockpitPos];
        visited[cockpitPos.r + ',' + cockpitPos.c] = true;
        var count = 0;

        while (queue.length > 0) {
            var pos = queue.shift();
            count++;
            var neighbors = [
                { r: pos.r - 1, c: pos.c }, { r: pos.r + 1, c: pos.c },
                { r: pos.r, c: pos.c - 1 }, { r: pos.r, c: pos.c + 1 }
            ];
            for (var i = 0; i < neighbors.length; i++) {
                var n = neighbors[i];
                var key = n.r + ',' + n.c;
                if (n.r >= 0 && n.r < grid.h && n.c >= 0 && n.c < grid.w &&
                    grid.cells[n.r][n.c] !== null && !visited[key]) {
                    visited[key] = true;
                    queue.push(n);
                }
            }
        }

        return count === _countOccupied(grid);
    }

    // Get disconnected blocks (not reachable from cockpit)
    function getDisconnected(grid) {
        var cockpitPos = _findBlock(grid, 'cockpit');
        if (!cockpitPos) {
            // Everything is disconnected
            var all = [];
            for (var r = 0; r < grid.h; r++)
                for (var c = 0; c < grid.w; c++)
                    if (grid.cells[r][c]) all.push({ r: r, c: c });
            return all;
        }

        var visited = {};
        var queue = [cockpitPos];
        visited[cockpitPos.r + ',' + cockpitPos.c] = true;
        while (queue.length > 0) {
            var pos = queue.shift();
            var neighbors = [
                { r: pos.r - 1, c: pos.c }, { r: pos.r + 1, c: pos.c },
                { r: pos.r, c: pos.c - 1 }, { r: pos.r, c: pos.c + 1 }
            ];
            for (var i = 0; i < neighbors.length; i++) {
                var n = neighbors[i];
                var key = n.r + ',' + n.c;
                if (n.r >= 0 && n.r < grid.h && n.c >= 0 && n.c < grid.w &&
                    grid.cells[n.r][n.c] !== null && !visited[key]) {
                    visited[key] = true;
                    queue.push(n);
                }
            }
        }

        var disconnected = [];
        for (var r2 = 0; r2 < grid.h; r2++) {
            for (var c2 = 0; c2 < grid.w; c2++) {
                if (grid.cells[r2][c2] !== null && !visited[r2 + ',' + c2]) {
                    disconnected.push({ r: r2, c: c2 });
                }
            }
        }
        return disconnected;
    }

    // Derive all ship stats from grid blocks
    function deriveStats(grid) {
        var hc = Config.HULL_CLASSES[grid.hullClass];
        var stats = {
            totalWeight: hc ? hc.baseMass : 0,
            totalThrust: 0,
            maxSpeed: hc ? hc.maxSpeed : 2.0,
            acceleration: 0,
            totalPowerGen: 0,
            totalPowerDraw: 0,
            powerRatio: 1.0,
            totalHP: 0,
            shieldHP: 0,
            shieldRegen: 0,
            cargoCapacity: 0,
            fuelCapacity: 0,
            weapons: [],       // [{row, col, typeKey, def}]
            engines: [],       // [{row, col, typeKey, def}]
            fuelTypes: {},     // { fuelType: totalRate }
            scanRange: 200,    // base
            repairRate: 0,
            diploBonus: 0,
            blockCount: 0
        };

        for (var r = 0; r < grid.h; r++) {
            for (var c = 0; c < grid.w; c++) {
                var cell = grid.cells[r][c];
                if (!cell) continue;
                if (cell.hp <= 0) continue; // destroyed blocks don't contribute

                var def = Config.BLOCK_TYPES[cell.type];
                if (!def) continue;

                stats.blockCount++;
                stats.totalWeight += def.weight;
                stats.totalHP += cell.hp;
                stats.totalPowerGen += def.powerGen;
                stats.totalPowerDraw += def.powerDraw;

                if (def.cat === Config.BLOCK_CAT.PROPULSION) {
                    stats.totalThrust += (def.thrust || 0);
                    stats.maxSpeed += (def.speedBoost || 0);
                    stats.engines.push({ row: r, col: c, typeKey: cell.type, def: def });
                    if (def.fuelType) {
                        stats.fuelTypes[def.fuelType] = (stats.fuelTypes[def.fuelType] || 0) + (def.fuelRate || 0);
                    }
                }

                if (def.cat === Config.BLOCK_CAT.WEAPON) {
                    stats.weapons.push({ row: r, col: c, typeKey: cell.type, def: def });
                }

                if (def.cat === Config.BLOCK_CAT.DEFENSE) {
                    stats.shieldHP += (def.shieldHP || 0);
                    stats.shieldRegen += (def.regenRate || 0);
                }

                if (def.cargoCapacity) stats.cargoCapacity += def.cargoCapacity;
                if (def.fuelCapacity) stats.fuelCapacity += def.fuelCapacity;
                if (def.scanRange) stats.scanRange = Math.max(stats.scanRange, def.scanRange);
                if (def.repairRate) stats.repairRate += def.repairRate;
                if (def.diploBonus) stats.diploBonus += def.diploBonus;

                // Power generators that use fuel
                if (def.cat === Config.BLOCK_CAT.POWER && def.fuelType) {
                    stats.fuelTypes[def.fuelType] = (stats.fuelTypes[def.fuelType] || 0) + (def.fuelRate || 0);
                }
            }
        }

        // Acceleration and effective speed
        if (stats.totalWeight > 0) {
            stats.acceleration = stats.totalThrust / stats.totalWeight;
        }
        // Power efficiency
        if (stats.totalPowerDraw > 0 && stats.totalPowerGen < stats.totalPowerDraw) {
            stats.powerRatio = stats.totalPowerGen / stats.totalPowerDraw;
        }
        // Power ratio affects effective systems
        stats.effectiveThrust = stats.totalThrust * stats.powerRatio;
        stats.effectiveShieldRegen = stats.shieldRegen * stats.powerRatio;
        if (stats.totalWeight > 0) {
            stats.acceleration = stats.effectiveThrust / stats.totalWeight;
        }

        return stats;
    }

    // Validate a ship grid — returns { valid, errors[] }
    function validate(grid) {
        var errors = [];
        var cockpit = _findBlock(grid, 'cockpit');
        if (!cockpit) errors.push('Ship must have a cockpit');
        if (_countOccupied(grid) === 0) errors.push('Ship has no blocks');
        if (_countOccupied(grid) > 0 && !isConnected(grid)) errors.push('All blocks must be connected');

        var stats = deriveStats(grid);
        if (stats.engines.length === 0) errors.push('Ship needs at least one engine');
        if (stats.totalPowerGen === 0) errors.push('Ship needs at least one power source');
        if (stats.fuelCapacity === 0 && Object.keys(stats.fuelTypes).length > 0) {
            errors.push('Ship has engines but no fuel tank');
        }

        return { valid: errors.length === 0, errors: errors };
    }

    // Determine which grid cell a projectile hits
    // angle: projectile travel angle, shipAngle: ship's facing angle
    function hitCell(grid, projAngle, shipAngle) {
        // Convert projectile angle to ship-local direction
        var localAngle = projAngle - shipAngle + Math.PI; // from which direction it hits
        var dx = Math.cos(localAngle);
        var dy = Math.sin(localAngle);

        // Find occupied cells
        var occupied = [];
        for (var r = 0; r < grid.h; r++) {
            for (var c = 0; c < grid.w; c++) {
                if (grid.cells[r][c] && grid.cells[r][c].hp > 0) {
                    occupied.push({ r: r, c: c });
                }
            }
        }
        if (occupied.length === 0) return null;

        // Weight cells by how exposed they are to the hit direction
        // Center of grid
        var midR = (grid.h - 1) / 2;
        var midC = (grid.w - 1) / 2;
        var weighted = [];
        var totalWeight = 0;

        for (var i = 0; i < occupied.length; i++) {
            var cell = occupied[i];
            // Offset from center
            var cr = cell.r - midR;
            var cc = cell.c - midC;
            // Dot product with hit direction (higher = more exposed)
            var dot = cr * dy + cc * dx;
            // Edge bonus: cells on the perimeter are more exposed
            var edgeBonus = _isEdgeCell(grid, cell.r, cell.c) ? 1.5 : 0.5;
            var w = Math.max(0.05, dot + 1.5) * edgeBonus * (dot > 0 ? 3.0 : 1.0);
            weighted.push({ r: cell.r, c: cell.c, w: w });
            totalWeight += w;
        }

        // Weighted random selection
        var roll = Math.random() * totalWeight;
        var cumulative = 0;
        for (var j = 0; j < weighted.length; j++) {
            cumulative += weighted[j].w;
            if (roll <= cumulative) {
                return { r: weighted[j].r, c: weighted[j].c };
            }
        }
        return weighted[weighted.length - 1];
    }

    // Apply damage to a specific cell. Returns { destroyed, cockpitHit, splashTargets[] }
    function damageBlock(grid, row, col, amount) {
        var cell = grid.cells[row][col];
        if (!cell || cell.hp <= 0) return { destroyed: false, cockpitHit: false, splashTargets: [] };

        cell.hp -= amount;
        var result = { destroyed: false, cockpitHit: false, splashTargets: [] };

        if (cell.hp <= 0) {
            cell.hp = 0;
            result.destroyed = true;
            result.cockpitHit = (cell.type === 'cockpit');

            // Splash damage to adjacent blocks (25%)
            var splashDmg = amount * 0.25;
            var adj = [
                { r: row - 1, c: col }, { r: row + 1, c: col },
                { r: row, c: col - 1 }, { r: row, c: col + 1 }
            ];
            for (var i = 0; i < adj.length; i++) {
                var n = adj[i];
                if (n.r >= 0 && n.r < grid.h && n.c >= 0 && n.c < grid.w) {
                    var nc = grid.cells[n.r][n.c];
                    if (nc && nc.hp > 0) {
                        nc.hp = Math.max(0, nc.hp - splashDmg);
                        result.splashTargets.push(n);
                    }
                }
            }

            // Recompute stats after destruction
            grid.stats = deriveStats(grid);
        }

        return result;
    }

    // Repair a destroyed block (restore to full HP). Costs handled externally.
    function repairBlock(grid, row, col) {
        var cell = grid.cells[row][col];
        if (!cell) return false;
        cell.hp = cell.maxHp;
        grid.stats = deriveStats(grid);
        return true;
    }

    // Repair all blocks by given amount (passive repair bay)
    function repairAll(grid, amount) {
        for (var r = 0; r < grid.h; r++) {
            for (var c = 0; c < grid.w; c++) {
                var cell = grid.cells[r][c];
                if (cell && cell.hp < cell.maxHp && cell.hp > 0) {
                    cell.hp = Math.min(cell.maxHp, cell.hp + amount);
                }
            }
        }
    }

    // Get the active weapon list (non-destroyed weapons)
    function getActiveWeapons(grid) {
        if (grid.stats) return grid.stats.weapons;
        return deriveStats(grid).weapons;
    }

    // Serialize grid for save
    function serializeGrid(grid) {
        var cells = [];
        for (var r = 0; r < grid.h; r++) {
            var row = [];
            for (var c = 0; c < grid.w; c++) {
                var cell = grid.cells[r][c];
                if (cell) {
                    var def = Config.BLOCK_TYPES[cell.type];
                    row.push(def ? def.code + ':' + cell.hp : null);
                } else {
                    row.push(null);
                }
            }
            cells.push(row);
        }
        return { hullClass: grid.hullClass, w: grid.w, h: grid.h, cells: cells };
    }

    // Deserialize grid from save
    function deserializeGrid(data) {
        var grid = {
            hullClass: data.hullClass,
            w: data.w,
            h: data.h,
            cells: [],
            stats: null
        };
        for (var r = 0; r < data.h; r++) {
            grid.cells[r] = [];
            for (var c = 0; c < data.w; c++) {
                var cellData = data.cells[r] ? data.cells[r][c] : null;
                if (cellData && typeof cellData === 'string') {
                    var parts = cellData.split(':');
                    var code = parts[0];
                    var hp = parseFloat(parts[1]);
                    var typeKey = Config.BLOCK_CODE_MAP[code];
                    if (typeKey) {
                        var def = Config.BLOCK_TYPES[typeKey];
                        grid.cells[r][c] = { type: typeKey, hp: hp, maxHp: def.hp };
                    } else {
                        grid.cells[r][c] = null;
                    }
                } else {
                    grid.cells[r][c] = null;
                }
            }
        }
        grid.stats = deriveStats(grid);
        return grid;
    }

    // Build a grid from a template shortcode array
    function fromTemplate(hullClass, blockRows) {
        var grid = createGrid(hullClass);
        if (!grid) return null;
        for (var r = 0; r < blockRows.length && r < grid.h; r++) {
            for (var c = 0; c < blockRows[r].length && c < grid.w; c++) {
                var code = blockRows[r][c];
                if (code && code !== '.') {
                    var typeKey = Config.BLOCK_CODE_MAP[code];
                    if (typeKey) {
                        var def = Config.BLOCK_TYPES[typeKey];
                        grid.cells[r][c] = { type: typeKey, hp: def.hp, maxHp: def.hp };
                    }
                }
            }
        }
        grid.stats = deriveStats(grid);
        return grid;
    }

    // ── Private helpers ──────────────────────────────────────

    function _isEdge(grid, row, col) {
        return row === 0 || row === grid.h - 1 || col === 0 || col === grid.w - 1;
    }

    function _isEdgeCell(grid, row, col) {
        // A cell is "edge" if it has at least one empty neighbor
        var dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
        for (var i = 0; i < dirs.length; i++) {
            var nr = row + dirs[i][0], nc = col + dirs[i][1];
            if (nr < 0 || nr >= grid.h || nc < 0 || nc >= grid.w) return true;
            if (!grid.cells[nr][nc]) return true;
        }
        return false;
    }

    function _findBlock(grid, typeKey) {
        for (var r = 0; r < grid.h; r++) {
            for (var c = 0; c < grid.w; c++) {
                if (grid.cells[r][c] && grid.cells[r][c].type === typeKey) {
                    return { r: r, c: c };
                }
            }
        }
        return null;
    }

    function _countBlockType(grid, typeKey) {
        var count = 0;
        for (var r = 0; r < grid.h; r++)
            for (var c = 0; c < grid.w; c++)
                if (grid.cells[r][c] && grid.cells[r][c].type === typeKey) count++;
        return count;
    }

    function _countOccupied(grid) {
        var count = 0;
        for (var r = 0; r < grid.h; r++)
            for (var c = 0; c < grid.w; c++)
                if (grid.cells[r][c]) count++;
        return count;
    }

    return {
        createGrid: createGrid,
        cloneGrid: cloneGrid,
        placeBlock: placeBlock,
        removeBlock: removeBlock,
        isConnected: isConnected,
        getDisconnected: getDisconnected,
        deriveStats: deriveStats,
        validate: validate,
        hitCell: hitCell,
        damageBlock: damageBlock,
        repairBlock: repairBlock,
        repairAll: repairAll,
        getActiveWeapons: getActiveWeapons,
        serializeGrid: serializeGrid,
        deserializeGrid: deserializeGrid,
        fromTemplate: fromTemplate
    };
})();
