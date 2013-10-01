/*
Characters.js controls everything dealing with a character.json file, no in game commands are
defined here. Commands.js does share some function names with this module, as they -- are --  commands 
and therefore defined in commands.js. See: save().
*/
var fs = require('fs'),
crypto = require('crypto'),
Room = require('./rooms').room,
Dice = require('./dice').roller,
races = require('../config').server.races,
classes = require('../config').server.classes,
players = require('../server').players,
areas = require('../server').areas;

var Character = function () {

}

Character.prototype.login = function(r, s, fn) {
	var name = r.msg.replace(/_.*/,'').toLowerCase();
	
	if (r.msg.length > 3 ) {
		if  (/^[a-z]+$/g.test(r.msg) === true) {
			fs.stat('./players/' + name + '.json', function (err, stat) {
				if (err === null) {
					return fn(name, s, true);
				} else {
					return fn(name, s, false);
				}
			});
		} else {
			return s.emit('msg', {msg : '<b>Invalid Entry</b>. Enter your name:', res: 'login', styleClass: 'enter-name'});
		}
	} else {
		s.emit('msg', {
			msg: 'Invalid name choice, must be more than three characters.',
			res: 'login',
			styleClass: 'error'
		});
	}
}

Character.prototype.load = function(name, s, fn) {
	fs.readFile('./players/'  + name + '.json', function (err, r) {
		if (err) {
			throw err;
		}
		
		s.player = JSON.parse(r);
		s.player.sid = s.id;
		
		return fn(s);
	});
}

Character.prototype.hashPassword = function(salt, password, iterations, fn) {
	var hash = password,
	i = 0;
		
	for (i; i < iterations; i += 1) {
		hash = crypto.createHmac('sha256', salt).update(hash).digest('hex');
	} 
			
	fn(hash);	
};

Character.prototype.generateSalt = function(fn) {
	crypto.randomBytes(128, function(ex, buf) {
		if (ex) {
			throw ex;
		}
			
		fn(buf.toString('hex'));
	});
};

Character.prototype.getPassword = function(s, fn) {
	var character = this;
	s.emit('msg', {msg: 'What is your password: ', res: 'enterPassword'});

	s.on('password', function (r) {
		if (r.msg.length > 7) {
			character.hashPassword(s.player.salt, r.msg, 1000, function(hash) {
				if (s.player.password === hash) {
					character.addPlayer(s, function(added, msg) {
						if (added) {
							Room.checkArea(s.player.area, function(fnd) {
								if (!fnd) {
									Room.getArea(s.player.area, function(area) {
										areas.push(area);
									});
								}
							});
						
							character.motd(s, function() {		
								Room.getRoom(s, function() {
				  					fn(s);
									return character.prompt(s);
								});
							});
						} else {
							if (msg === undefined) {
								s.emit('msg', {msg: 'Error logging in, please retry.'});
							} else {
								s.emit('msg', {msg: msg})
							}
							
							return s.disconnect();
						}
					});
				} else {
					s.emit('msg', {msg: 'Wrong! You are flagged after 5 incorrect responses.', res: 'enterPassword'});
					return s.emit('msg', {msg: 'What is your password: ', res: 'enterPassword'});
				}
			});
		} else {
			s.emit('msg', {msg: 'Password had to be over eight characters.', res: 'enterPassword'});
			return s.emit('msg', {msg: 'What is your password: ', res: 'enterPassword'});
		}
	});
}

// Add a player reference object to the players array
Character.prototype.addPlayer = function(s, fn) {
	var  i = 0;	

	if (players.length > 0) {
		for (i; i < players.length; i += 1) {
			if (s.player.name === players[i].name) {
				return fn(false, 'Already Logged in');
			}
		}
		
		players.push({
			name: s.player.name, 
			sid: s.id,
			area: s.player.area,
			roomid: s.player.roomid
		});
			
		return fn(true);
	} else {
		players.push({
			name: s.player.name, 
			sid: s.id,
			area: s.player.area,
			roomid: s.player.roomid
		});

		return fn(true);
	}
}

//  A New Character is saved
Character.prototype.create = function(r, s, fn) { 
	s.player = {
		name: s.player.name,
		lastname: '',
		title: '',
		role: 'player',
		password: s.player.password,
		salt: '',
		race: s.player.race,
		charClass: s.player.charClass,
		created: new Date().toString(), // time of creation
		level: 1,
		exp: 1,
		expToLevel: 1000,
		position: 'standing',
		alignment: '',
		chp: 100, // current hp
		hp: 100, // total hp
		cmana: 100,
		mana: 100,
		cmv: 80,
		mv: 100,
		str: 12,
		wis: 12,
		int: 12,
		dex: 12,
		con: 12,
		wait: 0,
		ac: 10,
		gold: 5,
		hunger: 0,
		thirst: 0,
		carry: 10,
		load: 0,
		visible: true,
		area: 'midgaard', // must match an area file
		roomid: 1, // current room
		recall: 1, // id to recall to
		description: 'A brand new citizen.',
		eq: {
			head: '',
			chest: '',
			rightHand: '',
			leftHand: '',
			arms: '',
			hands: '',
			legs: '',
			feet: '',
			necklace1: '',
			necklace2: '',
			ring1: '',
			ring2: '',
			floating: ''
		},
		items: [
			{
				"name": "Pot Pie", 
				"short": "A Chicken Pot Pie",
				"long": "An over-stuffed simple pot pie",
				"id": 4, 
				"area": "all",
				"level": 1,
				"itemType": "food",
				"flags": [
					{"hunger": -7},
					{"carry": 1} 
				]
			}
		],
		channels: ['say', 'yell', 'chat', 'tell']
	},
	character = this;
	
	character.rollStats(s.player, function(player) {
		s.player = player;
	
		character.generateSalt(function(salt) {
			s.player.salt = salt;
			character.hashPassword(salt, s.player.password, 1000, function(hash) {
				s.player.password = hash;
				fs.writeFile('./players/' + s.player.name + '.json', JSON.stringify(s.player, null, 4), function (err) {
					var i = 0;
		
					if (err) {
						throw err;
					}
					
					for (i; i < players.length; i += 1) {
						if (players[i].sid === s.id) {
							players.splice(i, 1);
						}
					}
		
					s.leave('creation'); // No longer creating the character so leave the channel and join the game
					s.join('mud');		
					
					character.addPlayer(s, function(added) {
						if (added) {
							character.motd(s, function() {
								fn(s);
								Room.getRoom(s);			
								character.prompt(s);
							});
						} else {
							s.emit('msg', {msg: 'Error logging in, please retry.'});
							s.disconnect();
						}
					});
				});	
			});
		});	
	});
}

// Rolling stats for a new character
Character.prototype.rollStats = function(player, fn) { 
	var i = 0,
	j = 0,
	raceKey, // property of the race defines in raceList
	classKey; // property of the class defines in classList

	for (i; i < races.length; i += 1) {		// looking for race
		if (races[i].name.toLowerCase() === player.race) {	 // found race		
			for (raceKey in player) {
				if (player[raceKey] in races[i] && raceKey != 'name') { // found, add in stat bonus						
						player[player[raceKey]] = player[player[raceKey]] + races[i][player[raceKey]];	
				}
			}
		}		
				
		if (i === races.length - 1) { // rolling stats is finished
			for (j; j < classes.length; j += 1) { // looking through classes
				if (classes[j].name.toLowerCase() === player.charClass) { // class match found
					for (classKey in player) {
						if (classKey in classes[j] && classKey != 'name') {
							if (classKey !== undefined) {
								player[classKey] = classes[j][classKey] + player[classKey];
							} else {
								player[classKey] = classes[j][classKey];
							}
						} 
					}
				}
			}
			
			player.carry = player.str * 10;
			return fn(player);
		}
	}		
}

Character.prototype.newCharacter = function(s, fn) {
	var character = this,
	i = 0, 
	str = '';
	
	for (i; i < races.length; i += 1) {
		str += '<li>' + races[i].name + '</li>';

		if	(races.length - 1 === i) {
			s.emit('msg', {msg: s.player.name + ' is a new character! There are three more steps until ' + s.player.name + 
			' is saved. The next step is to select your race: <ul>' + str + '</ul>', res: 'selectRace', styleClass: 'race-selection'});		
	
			s.on('raceSelection', function (r) { 
				r.msg = r.msg.toLowerCase();
			
				character.raceSelection(r, function(fnd) {
					if (fnd) {
						i = 0;
						str = '';
						s.player.race = r.msg;
	
						for (i; i < classes.length; i += 1) {
							str += '<li>' + classes[i].name + '</li>';

							if	(classes.length - 1 === i) {
								s.emit('msg', {
									msg: 'Great! Now time to select a class ' + s.player.name + '. Pick on of the following: <ul>' + 
									str + '</ul>', 
									res: 'selectClass', 
									styleClass: 'race-selection'
								});
								
								s.on('classSelection', function(r) {
									r.msg = r.msg.toLowerCase();
			
									character.classSelection(r, function(fnd) {
										if (fnd) {
											s.player.charClass = r.msg;
											
											s.emit('msg', {
												msg: s.player.name + ' is a ' + s.player.charClass + '! There is 1 more step ' + s.player.name + 
												' is saved. Please define a password (8 characters):', 
												res: 'createPassword', 
												styleClass: 'race-selection'
											});	
								
											s.on('setPassword', function(r) {
												if (r.msg.length > 7) {
													s.player.password = r.msg;
													character.create(r, s, fn);
												} else {
													s.emit('msg', {msg: 'Password should be longer', styleClass: 'error' });
												}											
											});											
										} else {
											s.emit('msg', {msg: 'That class is not on the list, please try again', styleClass: 'error' });
										}									
									}); 
								});
							}
						}										
					} else {
						s.emit('msg', {msg: 'That race is not on the list, please try again', styleClass: 'error' });
					}
				});
			});			
		}
	}	
}

Character.prototype.raceSelection = function(r, fn) {
	var i = 0;
	
	for (i; i < races.length; i += 1) {
		if (r.msg === races[i].name.toLowerCase()) {
			return fn(true);
		}
	}
	
	return fn(false);
}

Character.prototype.classSelection = function(r, fn) {
	var i = 0;	
	
	for (i; i < classes.length; i += 1) {
		if (r.msg === classes[i].name.toLowerCase()) {
			return fn(true)
		}
	}
	
	return fn(false)
}

Character.prototype.motd = function(s, fn) {	
	fs.readFile('./motd.json', function (err, data) {
		if (err) {
			throw err;
		}
	
		s.emit('msg', {msg : JSON.parse(data).motd, res: 'logged', styleClass: 'motd'});
		return fn();
	});
}

Character.prototype.save = function(s, fn) {
	if (s.player != undefined) {
		s.player.saved = new Date().toString();
	
		fs.writeFile('./players/' + s.player.name.toLowerCase() + '.json', JSON.stringify(s.player, null, 4), function (err) {
			if (err) {
				return s.emit('msg', {msg: 'Error saving character.'});
			} else {
				if (typeof fn === 'function') {
					return fn();
				}	
			}
		});
	};
}

Character.prototype.hpRegen = function(s, fn) {
	var conMod = Math.ceil(s.player.con/4);

	if (s.player.chp < s.player.hp) {

		if (s.player.position === 'fighting' || s.player.position === 'sleeping') {
			conMod = conMod + 2;
		}


		Dice.roll(1, 8, function(total) {
			if (typeof fn === 'function') {
				fn(s.player.chp + total + conMod);
			} else {
				s.player.chp = s.player.chp + total + conMod;
				
				if (s.player.chp > s.player.hp) {
					return s.player.chp = s.player.hp;
				} 
			}
		});
	} else {
		fn(s.player.chp);
	}
}

Character.prototype.hunger = function(s, fn) {
	var character = this,
	conMod = Math.ceil(s.player.con/3);
	
	if (s.player.hunger < 10) {
		Dice.roll(1, 4, function(total) {
			if ((total + conMod) < s.player.con/2) { 
				s.player.hunger = s.player.hunger + 1;
			}			
						
			if (s.player.hunger >= 5) {	
				if (total < 4) {
					s.player.chp = s.player.chp - 1;
				}
			
				s.emit('msg', {msg: 'You are hungry.', styleClass: 'hunger'});
		
				fn();
			}
		});
	} else {
		s.player.chp = (s.player.chp - 10 + conMod);
		s.emit('msg', {msg: 'You are dying of hunger.', styleClass: 'hunger'});
		
		fn();
	}
}

Character.prototype.thirst = function(s, fn) {
	var character = this,
	dexMod = Math.ceil(s.player.dex/3);
	
	if (s.player.thirst < 10) {
		Dice.roll(1, 4, function(total) {
			if (total + dexMod < 5) { 
				s.player.thirst = s.player.thirst + 1;
			}			
						
			if (s.player.thirst >= 5) {
				s.player.chp = s.player.chp - 1;
			
				s.emit('msg', {msg: 'You need to find something to drink.', styleClass: 'thirst'});

				fn();
			}
		});	
	} else {
		s.player.chp = (s.player.chp - 5 + dexMod);
		s.emit('msg', {msg: 'You are dying of thirst.', styleClass: 'thirst'});
		
		fn();
	}
}

// boolean if item with the same vnum is in a players inventory
Character.prototype.checkInventory = function(r, s, fn) {
	var i = 0,
	msgPatt = new RegExp('^' + r.msg);
	
	if (s.player.items.length > 0) {
		for (i; i < s.player.items.length; i += 1){
			if (msgPatt.test(s.player.items[i].name.toLowerCase())) {
				fn(true, s.player.items[i]);
			} else if (i === s.player.items.length - 1) {
				fn(false);
			}
		}
	} else {
		fn(false);
	}
}

// push an item into a players inventory, checks items to ensure a player can use it
Character.prototype.addToInventory = function(s, item, fn) {
	s.player.items.push(item);
	
	fn(true);
}

// remove from inventory -- I AM HERE
Character.prototype.removeFromInventory = function(s, itemObj, fn) {
	var i = 0;
	if (s.player.items.length > 0) {
		s.player.items = s.player.items.filter(function(item, i) {
			if (item.id === itemObj.id) {
				return false;
			} else {
				return true;
			}				
		});
		
		fn(true);		
	} else {
		fn(false);
	}
}

Character.prototype.move = function(s, id, fn) {
    s.player.roomid = id;
    return fn(s);
}

// Updates a players reference in players[] with some data attached to the socket
Character.prototype.updatePlayer = function(s, fn) {
	var  i = 0;

	for (i; i < players.length; i += 1) {
		if (s.player.name === players[i].name) {
			players[i] = {
				name: s.player.name, 
				sid: s.id,
				area: s.player.area,
				roomid: s.player.roomid
			};
			
			if (typeof fn === 'function') {
				fn(true);
			} 
		}
	}
}

Character.prototype.prompt = function(s) {
	return s.emit('msg', {msg: s.player.chp + '/'  + s.player.hp + 'hps ' +
		s.player.cmana + '/'  + s.player.mana + 'mana ' +  
		s.player.cmv + '/'  + s.player.mv +'mv room:' +
		s.player.roomid + '> ', styleClass: 'cprompt'});
}

Character.prototype.level = function(s, fn) {

}

module.exports.character = new Character();