/* ============================================================
 * Solar Dominion — Combat Module
 * Handles projectile–entity collisions, NPC targeting, and
 * damage resolution.
 * ============================================================ */
var Combat = (function () {
    'use strict';

    var _combatLog = [];

    function init() {
        _combatLog = [];
    }

    function tick() {
        var ship = Ship.getShip();
        var npcs = World.getNPCs();
        var projectiles = World.getProjectiles();
        var fleetShips = Fleet.getShips ? Fleet.getShips() : [];

        // Projectile collisions
        for (var i = projectiles.length - 1; i >= 0; i--) {
            var p = projectiles[i];
            var isPlayerProj = p.owner === 'player';
            var isFleetProj = typeof p.owner === 'string' && p.owner.indexOf('fleet_') === 0;

            if (isPlayerProj || isFleetProj) {
                // Player/fleet projectiles hit NPCs
                var hit = false;
                for (var j = 0; j < npcs.length; j++) {
                    var npc = npcs[j];
                    if (npc.dead) continue;
                    var dx = p.x - npc.x, dy = p.y - npc.y;
                    if (dx * dx + dy * dy < 400) {
                        _damageNPC(npc, p.damage, p.type);
                        projectiles.splice(i, 1);
                        hit = true;
                        break;
                    }
                }
                if (hit) continue;
            } else {
                // NPC projectile: hits player and fleet ships
                var dx2 = p.x - ship.x, dy2 = p.y - ship.y;
                if (dx2 * dx2 + dy2 * dy2 < 400) {
                    Ship.takeDamage(p.damage, p.type);
                    projectiles.splice(i, 1);
                    _log('Hit! ' + p.damage + ' ' + p.type + ' damage taken');
                    continue;
                }
                // Check fleet ships
                for (var f = 0; f < fleetShips.length; f++) {
                    var fs = fleetShips[f];
                    if (fs.dead) continue;
                    var fdx = p.x - fs.x, fdy = p.y - fs.y;
                    if (fdx * fdx + fdy * fdy < 400) {
                        _damageFleetShip(fs, p.damage, p.type);
                        projectiles.splice(i, 1);
                        break;
                    }
                }
            }
        }

        // NPC combat AI — hostile NPCs attack player
        for (var k = 0; k < npcs.length; k++) {
            var n = npcs[k];
            if (n.dead || !n.weapon) continue;

            var hostile = Factions.isHostile(n.faction);
            if (!hostile) continue;

            var ddx = ship.x - n.x, ddy = ship.y - n.y;
            var dist = Math.sqrt(ddx * ddx + ddy * ddy);

            if (dist < Config.COMBAT.AGGRO_RANGE) {
                n.angle = Math.atan2(ddy, ddx);
                n.destX = ship.x;
                n.destY = ship.y;

                n.fireTimer = (n.fireTimer || 0) - 1;
                if (n.fireTimer <= 0) {
                    // Use weaponDef from template if available, else lookup
                    var wData = n.weaponDef || Config.WEAPON_TYPES[n.weapon] || Config.BLOCK_TYPES[n.weapon];
                    if (wData) {
                        var dmg = wData.damage * 0.6;
                        var wType = wData.dmgType || wData.type || 'energy';
                        var wRange = wData.range || 250;
                        World.addProjectile({
                            x: n.x + Math.cos(n.angle) * 15,
                            y: n.y + Math.sin(n.angle) * 15,
                            angle: n.angle,
                            speed: Config.COMBAT.PROJECTILE_SPEED * 0.8,
                            damage: dmg,
                            type: wType,
                            owner: n.id,
                            life: Math.ceil(wRange / Config.COMBAT.PROJECTILE_SPEED)
                        });
                        n.fireTimer = wData.fireRate || 15;
                    }
                }
            }
        }
    }

    function _damageNPC(npc, damage, type) {
        // Shield absorption — shields absorb 70% of incoming damage
        if (npc.shieldHp > 0) {
            var absorbed = damage * 0.7;
            var shieldDmg = Math.min(npc.shieldHp, absorbed);
            npc.shieldHp -= shieldDmg;
            damage -= shieldDmg;
        }

        // Locational damage if NPC has grid
        if (npc.grid && npc.grid.cells) {
            var hitPos = ShipGrid.hitCell(npc.grid, 0, npc.angle);
            if (hitPos) {
                var result = ShipGrid.damageBlock(npc.grid, hitPos.r, hitPos.c, damage);
                // Recalculate stats
                var stats = npc.grid.stats;
                npc.hp = stats.totalHP;
                npc.maxHp = stats.totalHP;
                npc.maxShieldHp = stats.shieldHP;
                npc.shieldHp = Math.min(npc.shieldHp, npc.maxShieldHp);
                // Update weapon/speed from remaining blocks
                npc.speed = Config.BASE_SPEED * stats.maxSpeed * stats.powerRatio * 0.8;
                if (stats.weapons.length > 0) {
                    npc.weapon = stats.weapons[0].typeKey;
                    npc.weaponDef = stats.weapons[0].def;
                } else {
                    npc.weapon = null;
                    npc.weaponDef = null;
                }

                if (result.cockpitHit) {
                    npc.hp = 0; // cockpit destroyed = instant kill
                }
            }
        } else {
            npc.hp -= damage;
        }

        if (npc.hp <= 0) {
            npc.dead = true;
            World.addExplosion(npc.x, npc.y, 30);
            Events.emit('npc_destroyed', { npc: npc });
            _log('Destroyed ' + (npc.templateName || npc.id));

            // Loot
            if (Math.random() < Config.COMBAT.LOOT_CHANCE) {
                var loot = Math.floor(Math.random() * 200) + 50;
                Economy.addCredits(loot);
                _log('Salvaged ' + loot + ' credits');
            }

            // Rep consequences
            if (npc.faction === Config.FACTION.EARTH) {
                Factions.changeRep(Config.FACTION.EARTH, -5);
                Factions.changeRep(Config.FACTION.MARS, 2);
                // Reduce faction military power when their ships are destroyed
                var earthF = Factions.getFaction(Config.FACTION.EARTH);
                if (earthF) earthF.militaryPower = Math.max(5, earthF.militaryPower - (npc.behavior === 'patrol' ? 3 : 1));
            } else if (npc.faction === Config.FACTION.MARS) {
                Factions.changeRep(Config.FACTION.MARS, -5);
                Factions.changeRep(Config.FACTION.EARTH, 2);
                var marsF = Factions.getFaction(Config.FACTION.MARS);
                if (marsF) marsF.militaryPower = Math.max(5, marsF.militaryPower - (npc.behavior === 'patrol' ? 3 : 1));
            } else if (npc.faction === Config.FACTION.INDEPENDENT) {
                Factions.changeRep(Config.FACTION.INDEPENDENT, -3);
            }
        }
    }

    function _damageFleetShip(fs, damage, type) {
        if (fs.shieldHp > 0) {
            var absorbed = damage * 0.7;
            var shieldDmg = Math.min(fs.shieldHp, absorbed);
            fs.shieldHp -= shieldDmg;
            damage -= shieldDmg;
        }

        // Locational damage if fleet ship has grid
        if (fs.grid && fs.grid.cells) {
            var hitPos = ShipGrid.hitCell(fs.grid, 0, fs.angle);
            if (hitPos) {
                var result = ShipGrid.damageBlock(fs.grid, hitPos.r, hitPos.c, damage);
                var stats = fs.grid.stats;
                fs.hp = stats.totalHP;
                fs.maxHp = stats.totalHP;
                if (result.cockpitHit) fs.hp = 0;
            }
        } else {
            fs.hp -= damage;
        }

        if (fs.hp <= 0) {
            fs.dead = true;
            World.addExplosion(fs.x, fs.y, 20);
            _log('Fleet ship destroyed');
        }
    }

    function _log(msg) {
        _combatLog.push({ tick: Date.now(), message: msg });
        if (_combatLog.length > 50) _combatLog.shift();
    }

    function getCombatLog() { return _combatLog; }

    function serialize() {
        return { combatLog: _combatLog.slice(-20) };
    }

    function deserialize(data) {
        if (!data) return;
        _combatLog = data.combatLog || [];
    }

    return {
        init: init,
        tick: tick,
        getCombatLog: getCombatLog,
        serialize: serialize,
        deserialize: deserialize
    };
})();
