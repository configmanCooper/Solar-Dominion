/* ============================================================
 * Solar Dominion — Economy Module
 * Dynamic economy with location inventories, production/
 * consumption cycles, supply/demand pricing, and NPC trading.
 * ============================================================ */
var Economy = (function () {
    'use strict';

    var _credits = 0;
    var _prices = {};          // per-location prices
    var _stocks = {};          // per-location inventory amounts
    var _deals = [];           // active economic deals
    var _tradeHistory = [];
    var _productionTimer = 0;
    var _activeEvents = {};    // per-location active events: { locId: [{event, remainingDuration}] }
    var _eventTimer = 0;

    function init() {
        _credits = Config.ECONOMY.STARTING_CREDITS;
        _deals = [];
        _tradeHistory = [];
        _productionTimer = 0;
        _activeEvents = {};
        _eventTimer = 0;
        _initLocationEconomies();
    }

    function _initLocationEconomies() {
        _prices = {};
        _stocks = {};
        var locs = Config.LOCATIONS;
        for (var i = 0; i < locs.length; i++) {
            var loc = locs[i];
            var locEcon = Config.LOCATION_ECONOMY[loc.id];
            _prices[loc.id] = {};
            _stocks[loc.id] = {};

            for (var res in Config.RESOURCES) {
                if (!Config.RESOURCES[res].tradeable) continue;
                var base = Config.RESOURCES[res].basePrice;
                var variance = (Math.random() - 0.5) * 2 * Config.ECONOMY.PRICE_VARIANCE;

                // Price modifier based on production/consumption
                var prodMod = 1.0;
                if (locEcon) {
                    if (locEcon.produces && locEcon.produces[res]) {
                        prodMod -= locEcon.produces[res] * 0.03; // producers have lower prices
                    }
                    if (locEcon.consumes && locEcon.consumes[res]) {
                        prodMod += locEcon.consumes[res] * 0.04; // consumers have higher prices
                    }
                }
                prodMod = Math.max(0.4, Math.min(2.0, prodMod));

                _prices[loc.id][res] = Math.max(1, Math.round(base * (1 + variance) * prodMod));

                // Initialize stock levels
                var startStock = 30; // base stock for everything
                if (locEcon) {
                    var cap = locEcon.stockCapacity || 200;
                    if (locEcon.produces && locEcon.produces[res]) {
                        startStock = Math.min(cap, 50 + locEcon.produces[res] * 10);
                    }
                    if (locEcon.consumes && locEcon.consumes[res]) {
                        startStock = Math.max(5, 20 - locEcon.consumes[res] * 2);
                    }
                }
                _stocks[loc.id][res] = startStock;
            }
        }
    }

    function getCredits() { return _credits; }

    function addCredits(amount) {
        _credits += amount;
        Events.emit('credits_changed', { credits: _credits, change: amount });
    }

    function spendCredits(amount) {
        if (_credits < amount) return false;
        _credits -= amount;
        Events.emit('credits_changed', { credits: _credits, change: -amount });
        return true;
    }

    function getStock(locationId, resource) {
        if (!_stocks[locationId]) return 0;
        return _stocks[locationId][resource] || 0;
    }

    function getLocationStocks(locationId) {
        return _stocks[locationId] || {};
    }

    function getBasePrice(resource) {
        return Config.RESOURCES[resource] ? Config.RESOURCES[resource].basePrice : null;
    }

    function getBuyPrice(locationId, resource) {
        if (!_prices[locationId]) return null;
        return _prices[locationId][resource] || null;
    }

    function getSellPrice(locationId, resource) {
        var buyP = getBuyPrice(locationId, resource);
        if (!buyP) return null;
        return Math.floor(buyP * 0.88);
    }

    function buyResource(locationId, resource, amount) {
        var price = getBuyPrice(locationId, resource);
        if (!price) return { success: false, reason: 'Not available here' };

        // Check location stock
        var stock = getStock(locationId, resource);
        if (stock <= 0) return { success: false, reason: 'Out of stock' };
        amount = Math.min(amount, stock);

        var totalCost = price * amount;
        if (_credits < totalCost) {
            amount = Math.floor(_credits / price);
            if (amount <= 0) return { success: false, reason: 'Not enough credits' };
            totalCost = price * amount;
        }

        var added = Ship.addItem(resource, amount);
        if (added <= 0) {
            var isFuel = resource === 'chemical_propellant' || resource === 'xenon_gas' || resource === 'plasma_cells' || resource === 'fusion_cores';
            return { success: false, reason: isFuel ? 'Fuel tanks full' : 'Cargo full' };
        }

        var actualCost = price * added;
        spendCredits(actualCost);

        // Reduce stock and increase price
        _stocks[locationId][resource] = Math.max(0, (_stocks[locationId][resource] || 0) - added);
        _prices[locationId][resource] = Math.round(
            _prices[locationId][resource] * (1 + Config.ECONOMY.SUPPLY_DEMAND_FACTOR * added)
        );

        _tradeHistory.push({ type: 'buy', location: locationId, resource: resource, amount: added, price: actualCost });
        return { success: true, amount: added, cost: actualCost };
    }

    function sellResource(locationId, resource, amount) {
        var price = getSellPrice(locationId, resource);
        if (!price) return { success: false, reason: 'Cannot sell here' };

        var removed = Ship.removeItem(resource, amount);
        if (removed <= 0) return { success: false, reason: 'None in cargo' };

        var revenue = price * removed;
        addCredits(revenue);

        // Increase stock and decrease price
        _stocks[locationId][resource] = (_stocks[locationId][resource] || 0) + removed;
        _prices[locationId][resource] = Math.max(1, Math.round(
            _prices[locationId][resource] * (1 - Config.ECONOMY.SUPPLY_DEMAND_FACTOR * removed)
        ));

        _tradeHistory.push({ type: 'sell', location: locationId, resource: resource, amount: removed, price: revenue });
        return { success: true, amount: removed, revenue: revenue };
    }

    // NPC trade: transfer goods between two locations
    function npcTrade(fromLocId, toLocId, resource, amount) {
        if (!_stocks[fromLocId] || !_stocks[toLocId]) return 0;
        var available = _stocks[fromLocId][resource] || 0;
        var transferred = Math.min(amount, available);
        if (transferred <= 0) return 0;

        _stocks[fromLocId][resource] = Math.max(0, available - transferred);
        _stocks[toLocId][resource] = (_stocks[toLocId][resource] || 0) + transferred;

        // Prices adjust
        _prices[fromLocId][resource] = Math.round(
            (_prices[fromLocId][resource] || 1) * (1 + Config.ECONOMY.SUPPLY_DEMAND_FACTOR * transferred * 0.5)
        );
        _prices[toLocId][resource] = Math.max(1, Math.round(
            (_prices[toLocId][resource] || 1) * (1 - Config.ECONOMY.SUPPLY_DEMAND_FACTOR * transferred * 0.5)
        ));
        return transferred;
    }

    // NPC picks up goods from a location (reduces stock, increases price)
    function npcPickup(locId, resource, amount) {
        if (!_stocks[locId] || !resource) return 0;
        var available = _stocks[locId][resource] || 0;
        var taken = Math.min(amount, available);
        if (taken <= 0) return 0;
        _stocks[locId][resource] = available - taken;
        if (_prices[locId] && _prices[locId][resource]) {
            _prices[locId][resource] = Math.round(
                _prices[locId][resource] * (1 + Config.ECONOMY.SUPPLY_DEMAND_FACTOR * taken * 0.5)
            );
        }
        return taken;
    }

    // NPC delivers goods to a location (increases stock, decreases price)
    function npcDeliver(locId, resource, amount) {
        if (!_stocks[locId] || !resource || amount <= 0) return 0;
        _stocks[locId][resource] = (_stocks[locId][resource] || 0) + amount;
        if (_prices[locId] && _prices[locId][resource]) {
            _prices[locId][resource] = Math.max(1, Math.round(
                _prices[locId][resource] * (1 - Config.ECONOMY.SUPPLY_DEMAND_FACTOR * amount * 0.5)
            ));
        }
        return amount;
    }

    function canAfford(costs) {
        if (costs.credits && _credits < costs.credits) return false;
        var ship = Ship.getShip();
        for (var key in costs) {
            if (key === 'credits') continue;
            if ((ship.inventory[key] || 0) < costs[key]) return false;
        }
        return true;
    }

    function payCosts(costs) {
        if (!canAfford(costs)) return false;
        if (costs.credits) spendCredits(costs.credits);
        for (var key in costs) {
            if (key === 'credits') continue;
            Ship.removeItem(key, costs[key]);
        }
        return true;
    }

    // Check if player has materials for a block
    function canAffordBlock(blockTypeKey) {
        var bt = Config.BLOCK_TYPES[blockTypeKey];
        if (!bt) return false;
        if (_credits < bt.cost) return false;
        if (bt.materials) {
            var ship = Ship.getShip();
            for (var mat in bt.materials) {
                if ((ship.inventory[mat] || 0) < bt.materials[mat]) return false;
            }
        }
        return true;
    }

    function payForBlock(blockTypeKey) {
        var bt = Config.BLOCK_TYPES[blockTypeKey];
        if (!bt || !canAffordBlock(blockTypeKey)) return false;
        spendCredits(bt.cost);
        if (bt.materials) {
            for (var mat in bt.materials) {
                Ship.removeItem(mat, bt.materials[mat]);
            }
        }
        return true;
    }

    // ── Location Events System ──────────────────────────────

    function _checkForEvents() {
        var locs = World.getLocations();
        for (var i = 0; i < locs.length; i++) {
            var loc = locs[i];
            if (!loc.dockable) continue;
            if (!_activeEvents[loc.id]) _activeEvents[loc.id] = [];

            // Skip if at max events
            if (_activeEvents[loc.id].length >= Config.ECONOMY.MAX_EVENTS_PER_LOCATION) continue;

            // Roll for event
            if (Math.random() > Config.ECONOMY.EVENT_CHANCE) continue;

            // Find eligible events for this location
            var eligible = [];
            var activeIds = _activeEvents[loc.id].map(function (e) { return e.id; });
            var allEvents = Config.LOCATION_EVENTS;

            for (var j = 0; j < allEvents.length; j++) {
                var ev = allEvents[j];
                // Check location eligibility
                if (ev.locations && ev.locations.indexOf(loc.id) === -1) continue;
                // Don't repeat active events
                if (activeIds.indexOf(ev.id) !== -1) continue;
                eligible.push(ev);
            }

            if (eligible.length === 0) continue;

            // Weighted random selection (crisis events are rarer)
            var weights = eligible.map(function (e) {
                switch (e.severity) {
                    case 'crisis': return 1;
                    case 'major': return 3;
                    case 'moderate': return 6;
                    case 'minor': return 10;
                    default: return 5;
                }
            });
            var totalWeight = weights.reduce(function (a, b) { return a + b; }, 0);
            var roll = Math.random() * totalWeight;
            var cumulative = 0;
            var selected = eligible[0];
            for (var w = 0; w < weights.length; w++) {
                cumulative += weights[w];
                if (roll <= cumulative) { selected = eligible[w]; break; }
            }

            // Activate event
            _activeEvents[loc.id].push({
                id: selected.id,
                name: selected.name,
                description: selected.description,
                severity: selected.severity,
                prodMod: selected.prodMod,
                consMod: selected.consMod,
                remaining: selected.duration
            });

            Events.emit('location_event_started', {
                locationId: loc.id,
                event: selected
            });
        }
    }

    function _tickEvents() {
        for (var locId in _activeEvents) {
            var events = _activeEvents[locId];
            for (var i = events.length - 1; i >= 0; i--) {
                events[i].remaining--;
                if (events[i].remaining <= 0) {
                    var ended = events.splice(i, 1)[0];
                    Events.emit('location_event_ended', {
                        locationId: locId,
                        event: ended
                    });
                }
            }
        }
    }

    function _getEventModifiers(locId) {
        var mods = { prodMod: {}, consMod: {} };
        var events = _activeEvents[locId];
        if (!events) return mods;

        for (var i = 0; i < events.length; i++) {
            var ev = events[i];
            if (ev.prodMod) {
                for (var res in ev.prodMod) {
                    mods.prodMod[res] = (mods.prodMod[res] || 1.0) * ev.prodMod[res];
                }
            }
            if (ev.consMod) {
                for (var cres in ev.consMod) {
                    mods.consMod[cres] = (mods.consMod[cres] || 1.0) * ev.consMod[cres];
                }
            }
        }
        return mods;
    }

    function getActiveEvents(locId) {
        if (locId) return (_activeEvents[locId] || []).slice();
        return JSON.parse(JSON.stringify(_activeEvents));
    }

    function tick() {
        // Production/consumption cycle
        _productionTimer++;
        if (_productionTimer >= Config.ECONOMY.PRODUCTION_INTERVAL) {
            _productionTimer = 0;
            _runProduction();
            _tickEvents(); // Decrement event durations each production cycle
        }

        // Event check (less frequent than production)
        _eventTimer++;
        if (_eventTimer >= Config.ECONOMY.EVENT_CHECK_INTERVAL) {
            _eventTimer = 0;
            _checkForEvents();
        }

        // Slow price drift toward equilibrium
        _driftPrices();

        // Player station income
        var locs = World.getLocations();
        for (var i = 0; i < locs.length; i++) {
            if (locs[i].isPlayerBuilt && locs[i].built) {
                addCredits(locs[i].income || 0);
            }
        }
    }

    function _runProduction() {
        var locs = World.getLocations();
        for (var i = 0; i < locs.length; i++) {
            var loc = locs[i];
            var locEcon = Config.LOCATION_ECONOMY[loc.id];
            if (!locEcon || !_stocks[loc.id]) continue;

            var cap = locEcon.stockCapacity || 200;
            var evMods = _getEventModifiers(loc.id);

            // Produce goods (with event modifiers)
            if (locEcon.produces) {
                for (var res in locEcon.produces) {
                    var rate = locEcon.produces[res];
                    if (evMods.prodMod[res]) rate = Math.round(rate * evMods.prodMod[res]);
                    var current = _stocks[loc.id][res] || 0;
                    if (current < cap) {
                        _stocks[loc.id][res] = Math.min(cap, current + rate);
                    }
                }
            }

            // Consume goods (with event modifiers)
            if (locEcon.consumes) {
                for (var cres in locEcon.consumes) {
                    var crate = locEcon.consumes[cres];
                    if (evMods.consMod[cres]) crate = Math.round(crate * evMods.consMod[cres]);
                    _stocks[loc.id][cres] = Math.max(0, (_stocks[loc.id][cres] || 0) - crate);
                }
            }
        }
    }

    function _driftPrices() {
        for (var locId in _prices) {
            var locEcon = Config.LOCATION_ECONOMY[locId];
            for (var res in _prices[locId]) {
                var base = Config.RESOURCES[res] ? Config.RESOURCES[res].basePrice : 10;
                // Equilibrium target based on production/consumption
                var target = base;
                if (locEcon) {
                    if (locEcon.produces && locEcon.produces[res]) {
                        target = Math.round(base * (1 - locEcon.produces[res] * 0.03));
                    }
                    if (locEcon.consumes && locEcon.consumes[res]) {
                        target = Math.round(base * (1 + locEcon.consumes[res] * 0.04));
                    }
                }
                target = Math.max(1, target);

                // Also adjust based on stock levels
                var stock = (_stocks[locId] && _stocks[locId][res]) || 0;
                var cap = (locEcon && locEcon.stockCapacity) || 200;
                var stockRatio = stock / Math.max(1, cap);
                // Low stock → higher price, high stock → lower price
                if (stockRatio < 0.2) target = Math.round(target * 1.3);
                else if (stockRatio > 0.8) target = Math.round(target * 0.8);

                var current = _prices[locId][res];
                if (current > target) _prices[locId][res] = Math.max(target, current - 1);
                if (current < target) _prices[locId][res] = Math.min(target, current + 1);
            }
        }
    }

    function serialize() {
        return {
            credits: _credits,
            prices: JSON.parse(JSON.stringify(_prices)),
            stocks: JSON.parse(JSON.stringify(_stocks)),
            deals: _deals.slice(),
            tradeHistory: _tradeHistory.slice(-50),
            productionTimer: _productionTimer,
            activeEvents: JSON.parse(JSON.stringify(_activeEvents)),
            eventTimer: _eventTimer
        };
    }

    function deserialize(data) {
        if (!data) return;
        _credits = data.credits || Config.ECONOMY.STARTING_CREDITS;
        _prices = data.prices || {};
        _stocks = data.stocks || {};
        _deals = data.deals || [];
        _tradeHistory = data.tradeHistory || [];
        _productionTimer = data.productionTimer || 0;
        _activeEvents = data.activeEvents || {};
        _eventTimer = data.eventTimer || 0;
        // If stocks empty (old save), reinitialize
        if (Object.keys(_stocks).length === 0) _initLocationEconomies();
        // Validate/clamp loaded prices to prevent NaN/negative
        for (var locId in _prices) {
            for (var res in _prices[locId]) {
                var p = _prices[locId][res];
                if (!p || isNaN(p) || p < 1) {
                    var base = Config.RESOURCES[res] ? Config.RESOURCES[res].basePrice : 10;
                    _prices[locId][res] = base;
                }
            }
        }
    }

    return {
        init: init,
        getCredits: getCredits,
        addCredits: addCredits,
        spendCredits: spendCredits,
        getBasePrice: getBasePrice,
        getBuyPrice: getBuyPrice,
        getSellPrice: getSellPrice,
        getStock: getStock,
        getLocationStocks: getLocationStocks,
        getActiveEvents: getActiveEvents,
        buyResource: buyResource,
        sellResource: sellResource,
        npcTrade: npcTrade,
        npcPickup: npcPickup,
        npcDeliver: npcDeliver,
        canAfford: canAfford,
        payCosts: payCosts,
        canAffordBlock: canAffordBlock,
        payForBlock: payForBlock,
        tick: tick,
        serialize: serialize,
        deserialize: deserialize
    };
})();
