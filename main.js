// V Feb-1
// gueritolh 2015
if (false) {
	resetSpawns();
} else {
	var spawn = Game.spawns.Spawn1;
	var bd = makeBuildQueue(spawn, false);
	for (var i in bd) {
		var d = bd[i];
		console.log("queue #"+i+": ("+d.x+","+d.y+"), " + d.type + ", " + d.priority);
	}
	//processAllSpawns();
	//processAllCreeps();
	
}

function processAllSpawns() {
	console.log("processAllSpawns");
	for ( var s in Game.spawns) {
		var spawn = Game.spawns[s];
		processSpawn(spawn);
	}
}

function processAllCreeps() {
	console.log("processAllCreeps");
	for ( var c in Game.creeps) {
		var creep = Game.creeps[c];
		if (!creep.spawning) {
			processCreep(creep);
		}
	}
}

function processSpawn(spawn) {
	console.log("processSpawn: " + spawn);
	if ((!getVar(spawn, "isInitialized")) || (isEmpty(spawn, "isInitialized"))) {
		initializeSpawn(spawn);
	} else {
		spawnCheckDeployment(spawn);
	}
}

function processCreep(creep) {
	console.log("processCreep: " + creep);
	creepTick(creep);
	switch (getVar(creep, "task")) {
	case "move":
		move(creep);
		break;
	case "store":
		store(creep);
		break;
	case "pickup":
		pickup(creep);
		break;
	case "build":
		build(creep);
		break;
	case "harvest":
		harvest(creep);
		break;
	case "find":
		find(creep);
		break;
	}
}

function creepTick(creep) {
	console.log("creepTick: " + creep);
	if (creep.energy < creep.energyCapacity) {
		checkForOpportunisticPickup(creep);
	}
	if (creep.ticksToLive < 75) {
		// TODO: temporary fix, need to find out how far are we from best spawn
		checkIfDying(creep);
	}
}

function definePath(object, target) {
	var path = object.room.findPath(object.pos, target.pos, {
		ignoreCreeps : true,
		ignoreDestructibleStructures : true
	});
	path.length--;
	path.shift();
	return path;
}

function pickup(creep) {
	console.log("pickup: " + creep);
	var target = Game.getObjectById(getVar(creep, "targetID"));
	creep.pickup(target);
	if (getVar(creep, "opportunisticPickup")) {
		setVar(creep, "targetID", getVar(creep, "previousTargetID"));
		setVar(creep, "task", getVar(creep, "previousTask"));
		setVar(creep, "nextTask", getVar(creep, "previousNextTask"));
		setVar(creep, "path", definePath(creep, getVar(creep, "target")));
		setVar(creep, "opportunisticPickup", false);
		setVar(creep, "previousTargetID", null);
		setVar(creep, "previousTask", null);
		setVar(creep, "previousNextTask", null);
	} else {
		setVar(creep, "task", "find");
	}
}

function build(creep) {
	console.log("build: " + creep);
	if (creep.energy == 0) {
		setVar(creep, "task", "find");
	} else {

	}
}

function harvest(creep) {
	console.log("harvest: " + creep);
	if (creep.energy == creep.energyCapacity) {
		setVar(creep, "task", "find");
	} else {
		var target = Game.getObjectById(getVar(creep, "targetID"));
		var result = creep.harvest(target);
		if (result == Game.ERR_NOT_ENOUGH_ENERGY) {
			setVar(creep, "task", "find");
		}
	}
}

function store(creep) {
	console.log("store: " + creep);
	if (creep.energy == 0) {
		setVar(creep, "task", "find");
	} else {
		var target = Game.getObjectById(getVar(creep, "targetID"));
		creep.transferEnergy(target);
	}
}

function move(creep) {
	console.log("move: " + creep);
	var target = Game.getObjectById(getVar(creep, "targetID"));
	if (creep.pos.isNearTo(target)) {
		setVar(creep, "task", getVar(creep, "nextTask"));
		setVar(creep, "nextTask", null);
	} else {
		if (!creep.fatigue) {
			var step = getVar(creep, "path").shift();
			if (step) {
				var result = creep.move(step.direction);
				if (result == Game.OK) {
					setVar(creep, "lastPos", formatPos(creep.pos));
					setVar(creep, "counter", 0);
					setVar(creep, "stuck", 0);
				} else {
					var cnt = getVar(creep, "counter") + 1;
					setVar(creep, "counter", cnt);
					if (cnt > 10) {
						setVar(creep, "counter", 0);
						setVar(creep, "task", "find");
						setVar(creep, "stuck", 1);
						// TODO: How to best fix stuck, this is temporary
					}
				}
			} else {
				setVar(creep, "counter", 0);
				setVar(creep, "task", "find");
				// TODO: What happened?, this is temporary
			}
		}
	}
}

function checkIfDying(creep) {
	console.log("checkIfDying: " + creep);
	var spawn = prioritizeSpawns(creep)[0];
	if (creep.ticksToLive <= 25) { // TODO: better calculation to distance to
		// best spawn
		setVar(creep, "task", "move");
		setVar(creep, "nextTask", "store");
		setVar(creep, "targetID", spawn.id);
		var sourceSpawn = Game.getObjectById(getVar(creep, "spawnID"));
		var roleNo = find(sourceSpawn.memory.roleName, getVar(creep, "role"));
		setVarArray(sourceSpawn, "activeCount", roleNo, getVarArray(
				sourceSpawn, "activeCount", roleNo) - 1);
	}
}

function formatPos(pos) {
	return pos.x + "," + pos.y;
}

function checkForOpportunisticPickup(creep) {
	console.log("checkForOpportunisticPickup: " + creep);
	if (getVar(creep, "isOpportunistic")) {
		var drop = creep.pos.findNearest(Game.DROPPED_ENERGY, {
			filter : function(object) {
				return (definePath(creep, drop).length < 4);
			}
		});
		if (drop != null) {
			setVar(creep, "path", null);
			setVar(creep, "previousTargetID", getVar(creep, "targetID"));
			setVar(creep, "previousTask", getVar(creep, "task"));
			setVar(creep, "previousNextTask", getVar(creep, "nextTask"));
			setVar(creep, "targetID", drop.id);
			setVar(creep, "task", "move");
			setVar(creep, "nextTask", "pickup");
			setVar(creep, "opportunisticPickup", true);
		}
	}
}

function find(creep) {
	console.log("find: " + creep);
	switch (getVar(creep, "role")) {
	case "harvester":
		harvesterFind(creep);
		break;
	case "builder":
		builderFind(creep);
		break;
	case "mule":
		break;
	case "healer":
		break;
	case "melee":
		break;
	case "ranged":
		break;
	}
}

function harvesterFind(creep) {
	console.log("harvesterFind: " + creep);
	var target = null;
	var nextTask = null;
	if (creep.energy / creep.energyCapacity > 0.75) {
		target = prioritizeSpawns(creep, false)[0];
		nextTask = "store";
	}
	if (target === null) {
		target = prioritizeSources(creep, false)[0];
		nextTask = "harvest";
	}
	if (target === null) {
		console.log("targetID is null!");
		// TODO:
	} else {
		setVar(creep, "path", definePath(creep, target));
		setVar(creep, "targetID", target.id);
		setVar(creep, "task", "move");
		setVar(creep, "nextTask", nextTask);
	}
}

function builderFind(creep) {
	console.log("builderFind: " + creep);
	var target = null;
	var task = null;
	if (creep.energy / creep.energyCapacity > 0.75) {
		target = prioritizeSources(creep, false)[0];
		task = "build";
	} else {
		target = prioritizeSpawns(creep, false)[0];
		task = "load";
	}
	if (target === null) {
		console.log("targetID is null!");
		// TODO:
	} else {
		setVar(creep, "path", definePath(creep, target));
		setVar(creep, "targetID", target.id);
		setVar(creep, "task", task);
		setVar(creep, "nextTask", null);
	}
}

function prioritizeSpawns(checkObject, structureFlag) {
	console.log("prioritizeSpawns: " + checkObject);
	var sources = checkObject.room.find(Game.MY_SPAWNS, {
		ignoreCreeps : true,
		ignoreDestructibleStructures : structureFlag
	});
	sources
			.sort(function(a, b) {
				var distanceA = checkObject.room.findPath(checkObject.pos,
						a.pos).length;
				var distanceB = checkObject.room.findPath(checkObject.pos,
						b.pos).length;
				var capacityA = (a.energy / a.energyCapacity) / 30;
				var capacityB = (b.energy / b.energyCapacity) / 30;
				var totalA = distanceA + capacityA;
				var totalB = distanceB + capacityB;
				return (totalA - totalB);
			});
	return sources;
}

function prioritizeSources(checkObject, structureFlag) {
	console.log("prioritizeSources: " + checkObject);
	var sources = checkObject.room.find(Game.SOURCES, {
		ignoreCreeps : true,
		ignoreDestructibleStructures : structureFlag
	});
	sources
			.sort(function(a, b) {
				var distanceA = checkObject.room.findPath(checkObject.pos,
						a.pos).length;
				var distanceB = checkObject.room.findPath(checkObject.pos,
						b.pos).length;
				var capacityA = (1 - (a.energy / a.energyCapacity)) / 30;
				var capacityB = (1 - (b.energy / b.energyCapacity)) / 30;
				var regenA = (1 - (a.ticksToRegeneration / 300)) / 20;
				var regenB = (1 - (b.ticksToRegeneration / 300)) / 20;
				var totalA = distanceA + capacityA + regenA;
				var totalB = distanceB + capacityB + regenB;
				return (totalA - totalB);
			});
	return sources;
}

function spawnCheckDeployment(spawn) {
	console.log("spawnCheckDeployment: " + spawn);
	var totalRoles = getVar(spawn, "roleName");
	for ( var i in totalRoles) {
		if ((getVarArray(spawn, "goalCount", i) > getVarArray(spawn,
				"activeCount", i))
				&& (!spawn.spawning)) {
			var roleName = getVarArray(spawn, "roleName", i);
			var name = roleName.substring(0, 3)
					+ pad(getVarArray(spawn, "activeCount", i) + 1, 3);
			var result = 0;
			switch (roleName) {
			case "harvester":
				result = spawn.createCreep([ Game.WORK, Game.WORK, Game.CARRY,
						Game.CARRY, Game.MOVE ], name, {
					role : roleName,
					task : "find",
					spawnID : spawn.id,
					lastPos : null,
					counter : 0,
					isOpportunistic : true
				});
				break;
			case "builder":
				result = spawn.createCreep([ Game.WORK, Game.WORK, Game.WORK,
						Game.CARRY, Game.MOVE ], name, {
					role : roleName,
					task : "find",
					spawnID : spawn.id,
					lastPos : null,
					counter : 0,
					isOpportunistic : true
				});
				break;
			case "mule":
				break;
			case "scavenger":
				break;
			case "healer":
				break;
			case "melee":
				break;
			case "ranged":
				break;
			}
			if (result == Game.OK) {
				setVarArray(spawn, "activeCount", i, getVarArray(spawn,
						"activeCount", i) + 1);
				// TODO: check is OK
			} else {
				// TODO: check errored out
			}
		}
	}
}

function initializeSpawn(spawn) {
	console.log("initializeSpawn: " + spawn);
	setVar(spawn, "isInitialized", true);
	setVar(spawn, "level", 0);
	setVar(spawn, "roleName", {
		harvester : "harvester",
		builder : "builder",
		mule : "mule",
		scavenger : "scavenger",
		healer : "healer",
		melee : "melee",
		ranged : "ranged"
	});
	setVar(spawn, "activeCount", {
		harvester : 0,
		builder : 0,
		mule : 0,
		scavenger : 0,
		healer : 0,
		melee : 0,
		ranged : 0
	});
	setVar(spawn, "goalCount", {
		harvester : 3,
		builder : 1,
		mule : 0,
		scavenger : 0,
		melee : 0,
		ranged : 0,
		healer : 0
	});
	setVar(makeBuildQueue(spawn, false), "buildQueue");
}

function makeBuildQueue(spawn, structureFlag) {
	console.log("makeBuildQueue: " + spawn);
	var sources = prioritizeSources(spawn);
	var buildList = [];
	for ( var i in sources) {
		var path = spawn.room.findPath(spawn.pos, sources[i].pos, {
			ignoreCreeps : true,
			ignoreDestructibleStructures : structureFlag
		});
	    path.forEach(function(a) {
	    	var prio = path.indexOf(a);
	    	if ((prio != 0) && (prio != (path.length-1))) {
    		    if (!posIsSwamp(spawn.room, a.x, a.y)) { 
    		    	prio = prio + 7;
				}
				buildList.push({
					x : a.x,
					y : a.y,
					type : "road",
					priority : prio});
	    	}
	    });
	}
	buildList.sort(function(a, b) {
		return (a.priority - b.priority);
	});
	return buildList;
}

function posIsSwamp(room, x, y) {
	var look = room.lookAt(x, y);
	return look.some(function(a) {
		return (a.terrain == 'swamp');
	});
}

function setVar(creep, entry, value) {
	creep.memory[entry] = value;
}

function getVar(creep, entry) {
	return creep.memory[entry];
}

function addVarToArray(creep, entry, value) {
	creep.memory[entry].push(value);
}

function setVarArray(creep, entry, value, pos) {
	creep.memory[entry][pos] = value;
}

function getVarArray(creep, entry, pos) {
	return creep.memory[entry][pos];
}

function isEmpty(obj, prop) {
	for ( var prop in obj.memory) {
		if (obj.memory.hasOwnProperty(prop))
			return false;
	}
	return true;
}

function pad(num, size) {
	return String("0000" + num).slice(-size);
}

function resetSpawns() {
	console.log("resetSpawns");
	if (Game.spawns.length > 0) {
		var targets = Game.spawns.Spawn1.room.find(Game.MY_CREEPS);
		for ( var m in targets) {
			targets[m].suicide();
		}
		setVar(Game.spawns.Spawn1, "isInitialized", false);
	} else {
		console.log("No active spawn detected!");
	}
}
