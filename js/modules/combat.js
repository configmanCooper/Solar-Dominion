/* ============================================================
 * Solar Dominion — Combat Module
 * Handles projectile–entity collisions, NPC targeting, and
 * damage resolution.
 * ============================================================ */
var Combat = (function () {
    'use strict';

    var _combatLog = [];
    var _npcCombatTimer = 0;
    var NPC_COMBAT_INTERVAL = 3; // check NPC-vs-NPC every 3 ticks

    function init() {
        _combatLog = [];
        _npcCombatTimer = 0;
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
                        _damageNPC(npc, p.damage, p.type, true);
                        projectiles.splice(i, 1);
                        hit = true;
                        break;
                    }
                }
                if (hit) continue;
            } else {
                // NPC projectile: hits player, fleet ships, and enemy NPCs
                var ownerNpc = _findNPC(npcs, p.owner);
                var ownerFaction = ownerNpc ? ownerNpc.faction : null;

                // Hit player
                var dx2 = p.x - ship.x, dy2 = p.y - ship.y;
                if (dx2 * dx2 + dy2 * dy2 < 400) {
                    Ship.takeDamage(p.damage, p.type);
                    projectiles.splice(i, 1);
                    _log('Hit! ' + p.damage + ' ' + p.type + ' damage taken');
                    continue;
                }
                // Hit fleet ships
                var fHit = false;
                for (var f = 0; f < fleetShips.length; f++) {
                    var fs = fleetShips[f];
                    if (fs.dead) continue;
                    var fdx = p.x - fs.x, fdy = p.y - fs.y;
                    if (fdx * fdx + fdy * fdy < 400) {
                        _damageFleetShip(fs, p.damage, p.type);
                        projectiles.splice(i, 1);
                        fHit = true;
                        break;
                    }
                }
                if (fHit) continue;

                // Hit enemy NPCs (faction-vs-faction)
                if (ownerFaction) {
                    for (var en = 0; en < npcs.length; en++) {
                        var eNpc = npcs[en];
                        if (eNpc.dead || eNpc.id === p.owner) continue;
                        if (!_areFactionsHostile(ownerFaction, eNpc.faction)) continue;
                        var edx = p.x - eNpc.x, edy = p.y - eNpc.y;
                        if (edx * edx + edy * edy < 400) {
                            _damageNPC(eNpc, p.damage, p.type, false);
                            projectiles.splice(i, 1);
                            break;
                        }
                    }
                }
            }
        }

        // NPC combat AI — hostile NPCs attack player
        for (var k = 0; k < npcs.length; k++) {
            var n = npcs[k];
            if (n.dead || !n.weapon) continue;

            var hostile = Factions.isHostile(n.faction) || n.hostile;
            if (!hostile) continue;

            var ddx = ship.x - n.x, ddy = ship.y - n.y;
            var dist = Math.sqrt(ddx * ddx + ddy * ddy);

            if (dist < Config.COMBAT.AGGRO_RANGE) {
                n.angle = Math.atan2(ddy, ddx);
                n.destX = ship.x;
                n.destY = ship.y;

                n.fireTimer = (n.fireTimer || 0) - 1;
                if (n.fireTimer <= 0) {
                    _npcFire(n);
                }
            }
        }

        // NPC-vs-NPC faction combat (every few ticks to save CPU)
        _npcCombatTimer++;
        if (_npcCombatTimer >= NPC_COMBAT_INTERVAL) {
            _npcCombatTimer = 0;
            _tickNPCvNPC(npcs);
        }
    }

    function _findNPC(npcs, id) {
        for (var i = 0; i < npcs.length; i++) {
            if (npcs[i].id === id) return npcs[i];
        }
        return null;
    }

    function _areFactionsHostile(f1, f2) {
        if (f1 === f2) return false;
        // Earth and Mars are always hostile to each other
        if ((f1 === Config.FACTION.EARTH && f2 === Config.FACTION.MARS) ||
            (f1 === Config.FACTION.MARS && f2 === Config.FACTION.EARTH)) return true;
        return false;
    }

    function _npcFire(npc) {
        var wData = npc.weaponDef || Config.WEAPON_TYPES[npc.weapon] || Config.BLOCK_TYPES[npc.weapon];
        if (!wData) return;
        var dmg = wData.damage * 0.6;
        var wType = wData.dmgType || wData.type || 'energy';
        var wRange = wData.range || 250;
        World.addProjectile({
            x: npc.x + Math.cos(npc.angle) * 15,
            y: npc.y + Math.sin(npc.angle) * 15,
            angle: npc.angle,
            speed: Config.COMBAT.PROJECTILE_SPEED * 0.8,
            damage: dmg,
            type: wType,
            owner: npc.id,
            life: Math.ceil(wRange / Config.COMBAT.PROJECTILE_SPEED)
        });
        npc.fireTimer = wData.fireRate || 15;
    }

    function _tickNPCvNPC(npcs) {
        for (var i = 0; i < npcs.length; i++) {
            var a = npcs[i];
            if (a.dead || !a.weapon || a.behavior !== 'patrol') continue;

            // Skip if already targeting the player (player takes priority)
            var hostile = Factions.isHostile(a.faction) || a.hostile;
            if (hostile) {
                var ship = Ship.getShip();
                var pd = Math.sqrt((ship.x - a.x) * (ship.x - a.x) + (ship.y - a.y) * (ship.y - a.y));
                if (pd < Config.COMBAT.AGGRO_RANGE) continue; // already fighting player
            }

            // Find nearest enemy faction NPC
            var bestTarget = null, bestDist = Config.COMBAT.AGGRO_RANGE;
            for (var j = 0; j < npcs.length; j++) {
                if (i === j) continue;
                var b = npcs[j];
                if (b.dead) continue;
                if (!_areFactionsHostile(a.faction, b.faction)) continue;
                var dx = b.x - a.x, dy = b.y - a.y;
                var d = Math.sqrt(dx * dx + dy * dy);
                if (d < bestDist) { bestDist = d; bestTarget = b; }
            }

            if (bestTarget) {
                // Turn to face and move toward enemy
                var tdx = bestTarget.x - a.x, tdy = bestTarget.y - a.y;
                a.angle = Math.atan2(tdy, tdx);
                a.destX = bestTarget.x;
                a.destY = bestTarget.y;
                a.aiTimer = 10; // override patrol AI briefly

                // Fire
                a.fireTimer = (a.fireTimer || 0) - NPC_COMBAT_INTERVAL;
                if (a.fireTimer <= 0) {
                    _npcFire(a);
                }
            }
        }
    }

    function _damageNPC(npc, damage, type, killedByPlayer) {
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
            Events.emit('npc_destroyed', { npc: npc, byPlayer: !!killedByPlayer });

            // Reduce faction military power regardless of who killed them
            if (npc.faction === Config.FACTION.EARTH) {
                var earthF = Factions.getFaction(Config.FACTION.EARTH);
                if (earthF) earthF.militaryPower = Math.max(5, earthF.militaryPower - (npc.behavior === 'patrol' ? 3 : 1));
            } else if (npc.faction === Config.FACTION.MARS) {
                var marsF = Factions.getFaction(Config.FACTION.MARS);
                if (marsF) marsF.militaryPower = Math.max(5, marsF.militaryPower - (npc.behavior === 'patrol' ? 3 : 1));
            }

            // Player-only rewards
            if (killedByPlayer) {
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
                } else if (npc.faction === Config.FACTION.MARS) {
                    Factions.changeRep(Config.FACTION.MARS, -5);
                    Factions.changeRep(Config.FACTION.EARTH, 2);
                } else if (npc.faction === Config.FACTION.INDEPENDENT) {
                    Factions.changeRep(Config.FACTION.INDEPENDENT, -3);
                }
            } else {
                _log((npc.templateName || npc.id) + ' destroyed in faction battle');
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
