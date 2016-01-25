function parse_image_rule(rule) {
	rule = rule.replace(/\s+/g,' ');
	var tokens = jQuery.trim(rule).split(' ');
	load_image(tokens[1], tokens[2]);
}

function parse_inheritance_rule(rule) {
	rule = rule.replace(/\s+/g,' ');
	var index = rule.indexOf(':')+1;
	if (index == 0) { throw 'Expected colon in "'+rule+'"'; }
	var firstPart = rule.substring(0, index);
	firstPart = firstPart.substring(0, firstPart.indexOf(':'));
	var parentClass = firstPart.split(' ')[1];
	var childClasses = jQuery.trim(rule.substring(index)).split(' ');
	for (var i in childClasses) {
		var childClass = childClasses[i];
		if ( ! (autocell_inheritances[childClass] instanceof Array)) {
			autocell_inheritances[childClass] = [];
		}
		autocell_inheritances[childClass].push(parentClass);
	}
}

function set_rules(ruleText) {
	autocell_pics = {};
	load_image('NULL', 'images/null.png');
	
	$('#rules').html(ruleText);
	try {
		var new_autocell_rules = [];
		autocell_inheritances = [];
		var rules = ruleText.split('\n');
		for (var r in rules) {
			var rule = jQuery.trim(rules[r]);
			if (rule == "" || rule.indexOf('#') == 0 || rule.indexOf('//') == 0) continue;
			if (rule.indexOf('draw ') == 0) { parse_image_rule(rule); continue; }
			if (rule.indexOf('inherit ') == 0) { parse_inheritance_rule(rule); continue; }
			
			var index = rule.indexOf(':')+1;
			if (index == 0) { throw 'Expected colon in "'+rule+'"'; }
			var transition = rule.substring(0, index);
			transition = transition.substring(0, transition.indexOf(':'));
			
			rule = rule.substring(index).split(';');
			var condition = jQuery.trim(rule.shift());
			var variableDefinitions = [];
			for (var r in rule) {
				if (rule[r].indexOf(' definedAs ') == -1) { throw 'Expected "definedAs" in "'+rule[r]+'"'; }
				var varAndDef = rule[r].split(' definedAs ');
				varAndDef[0] = jQuery.trim(varAndDef[0]);
				varAndDef[1] = jQuery.trim(varAndDef[1]);
				variableDefinitions[varAndDef[0]] = parse_rule(varAndDef[1]);
			}
			
			if (transition.indexOf('->') == -1) { throw 'Expected arrow (->) in "'+transition+'"'; }
			var fromAndTo = transition.split('->');
			if (fromAndTo.length != 2) { throw '"'+transition+'" has undexpected number of arrows.'; }
			fromAndTo[0] = jQuery.trim(fromAndTo[0]);
			fromAndTo[1] = jQuery.trim(fromAndTo[1]);
			if ( ! (new_autocell_rules[fromAndTo[0]] instanceof Array)) {
				new_autocell_rules[fromAndTo[0]] = [];
			}
			new_autocell_rules[fromAndTo[0]].push({condition:parse_rule(condition), result:fromAndTo[1], variables:variableDefinitions});
		}
		autocell_rules = new_autocell_rules;
	} catch (err) {
		alert(err);
	}
}

function apply_rules(x,y,z) {
	var type = autocell_board[z][y][x];
	return apply_rules_to_type(type, x,y,z);
}

function apply_rules_to_type(type,x,y,z) {
	for(var r in autocell_rules[type]) {
		var rule = autocell_rules[type][r];
		
		if (evaluate_token(x,y,z, rule.condition, evaluate_vars(x,y,z,rule.variables))) {
			return rule.result;
		}
	}
	if (autocell_inheritances[type]) {
		for (var i in autocell_inheritances[type]) {
			var newType = apply_rules_to_type(autocell_inheritances[type][i],x,y,z);
			if (newType != autocell_inheritances[type][i]) {
				return newType;
			}
		}
	}
	return type;
}

function instance_of_class(type, desiredClass) {
	if (type == desiredClass) return true;
	if (autocell_inheritances[type]) {
		for (var i in autocell_inheritances[type]) {
			if (instance_of_class(autocell_inheritances[type][i], desiredClass)) {
				return true;
			}
		}
	}
	return false;
}

var possible_directions = {north:[0,-1,0], south:[0,1,0], east:[1,0,0], west:[-1,0,0],
	northeast:[1,-1,0], northwest:[-1,-1,0], southeast:[1,1,0], southwest:[-1,1,0],
	farnorth:[0,-2,0], farsouth:[0,2,0], fareast:[2,0,0], farwest:[-2,0,0], up:[0,0,1], down:[0,0,-1]};
	
function evaluate_vars(x,y,z,rawVariables) {
	var results = [];
	for (var v in rawVariables) {
		results[v] = evaluate_token(x,y,z,rawVariables[v],[]);
	}
	return results;
}

function evaluate_token(x,y,z,token,variables) {
	if (typeof token == 'object') {
		return token.evaluate(x,y,z,variables);
	} else if (token == 'thisPos') {
		return [x,y,z];
	} else if (token == 'cells') {
		return get_whole_board();
	} else if (token == 'neighbors') {
		return get_neighbors(x,y,z);
	} else if (token == 'orthogonals') {
		return get_orthogonals(x,y,z);
	} else if (token == 'diagonals') {
		return get_diagonals(x,y,z);
	} else if (possible_directions[token] !== undefined) {
		var dir = possible_directions[token];
		return get_cell(x+dir[0],y+dir[1],z+dir[2]);
	} else if (is_int(token)) {
		return parseInt(token);
	} else {
		for (var v in variables) {
			token = token.replace(new RegExp('\\?'+v+'\\?', 'g'),variables[v]);
		}
		try {
			return JSON.parse(token);
		} catch (err2) {
			return token;
		}
	}
}

function get_whole_board() {
	var flat1 = [];
	for (var z in autocell_board) {
		flat1 = flat1.concat(autocell_board[z]);
	}
	var flat2 = [];
	for (var y in flat1) {
		flat2 = flat2.concat(flat1[y]);
	}
	var flat3 = [];
	for (var x in flat2) {
		flat3 = flat3.concat(flat2[x]);
	}
	return flat3;
}

function get_neighbors(x,y,z) {
	var results = [
		get_cell(x-1,y-1,z), get_cell(x,y-1,z), get_cell(x+1,y-1,z),
		get_cell(x-1,y,z),                      get_cell(x+1,y,z),
		get_cell(x-1,y+1,z), get_cell(x,y+1,z), get_cell(x+1,y+1,z)];
	return results;
}

function get_orthogonals(x,y,z) {
	var results = [
		                   get_cell(x,y-1,z),
		get_cell(x-1,y,z),                    get_cell(x+1,y,z),
		                   get_cell(x,y+1,z)];
	return results;
}

function get_diagonals(x,y,z) {
	var results = [
		get_cell(x-1,y-1,z),                  get_cell(x+1,y-1,z),
		
		get_cell(x-1,y+1,z),                  get_cell(x+1,y+1,z)];
	return results;
}

function get_cell(x,y,z) {
	if (autocell_board[z] === undefined || autocell_board[z][y] === undefined || autocell_board[z][y][x] === undefined) return 'NULL';
	return autocell_board[z][y][x];
}

function get_delta(start, end) {
	if (start == end) return 0;
	return (end-start)/Math.abs(end-start)
}

var verbTemplates = {
	'fromStepUntil':{priority:10, form:'monadic', evaluate:function(x,y,z,variables){
		var args = evaluate_token(x,y,z,this.param1,variables);
		var pos = args[0];
		var step = args[1];
		var until = args[2];
		var path = [];
		for (var i=0; i < 100; i++) {
			pos = [pos[0]+step[0], pos[1]+step[1], pos[2]+step[2]];
			var cell = get_cell(pos[0], pos[1], pos[2]);
			if (cell == 'NULL') { break; }
			path.push(cell);
			if (cell == until) { break; }
		}
		return path;
		}},
	
	'ofType':{priority:10, form:'diadic', evaluate:function(x,y,z,variables){
		var list = evaluate_token(x,y,z,this.param1,variables);
		var type = evaluate_token(x,y,z,this.param2,variables);
		for (var i=0; i < list.length; i++) {
			if (instance_of_class(list[i], type)) {
				list.splice(i,1);
				i--;
			}
		}
		return list;
		}},
		
	'instanceOf':{priority:10, form:'diadic', evaluate:function(x,y,z,variables){
		return instance_of_class(evaluate_token(x,y,z,this.param1,variables), evaluate_token(x,y,z,this.param2,variables));
		}},
	
	'cellAt':{priority:10, form:'monadic', evaluate:function(x,y,z,variables){
		var pos = evaluate_token(x,y,z,this.param1,variables);
		return get_cell(pos[0],pos[1],pos[2]);
		}},
		
	'cellsBetween':{priority:10, form:'monadic', evaluate:function(x,y,z,variables){
	 	//cellsBetween excludes the start and end positions
		var args = evaluate_token(x,y,z,this.param1,variables);
		var start = args[0];
		var end = args[1];
		start = [start[0] + get_delta(start[0], end[0]), start[1] + get_delta(start[1], end[1]), start[2] + get_delta(start[2], end[2])];
		
		var results = [];
		for (var zPos = start[2]; zPos != end[2]; zPos += get_delta(start[2], end[2])) {
			for (var yPos = start[1]; yPos != end[1]; yPos += get_delta(start[1], end[1])) {
				for (var xPos = start[0]; xPos != end[0]; xPos += get_delta(start[0], end[0])) {
					results.push(get_cell(xPos,yPos,zPos));
				}
			}
		}
		return results;
		}},
		
	'neighborsOf':{priority:10, form:'monadic', evaluate:function(x,y,z,variables){
		var pos = evaluate_token(x,y,z,this.param1,variables);
		try {
			return get_neighbors(pos[0],pos[1],pos[2]);
		} catch (e) {
			throw 'Cannot find neighborsOf "'+pos+'".\nParameter is not not a coordinate!';
		}
		}},
	
	'contains':{priority:10, form:'diadic', evaluate:function(x,y,z,variables){
		var list = evaluate_token(x,y,z,this.param1,variables);
		var item = evaluate_token(x,y,z,this.param2,variables);
		return list.indexOf(item) != -1;
		}},
	
	'isIn':{priority:10, form:'diadic', evaluate:function(x,y,z,variables){
		var item = evaluate_token(x,y,z,this.param1,variables);
		var list = evaluate_token(x,y,z,this.param2,variables);
		return list.indexOf(item) != -1;
		}},
	
	'count':{priority:10, form:'monadic', evaluate:function(x,y,z,variables){ return evaluate_token(x,y,z,this.param1,variables).length; }},
	
	'xVal':{priority:10, form:'monadic', evaluate:function(x,y,z,variables){ return evaluate_token(x,y,z,this.param1,variables)[0]; }},
	'yVal':{priority:10, form:'monadic', evaluate:function(x,y,z,variables){ return evaluate_token(x,y,z,this.param1,variables)[1]; }},
	'zVal':{priority:10, form:'monadic', evaluate:function(x,y,z,variables){ return evaluate_token(x,y,z,this.param1,variables)[2]; }},
	
	'echo':{priority:10, form:'monadic', evaluate:function(x,y,z,variables){
		var val = evaluate_token(x,y,z,this.param1,variables);
		alert('Echo: '+val);
		return val;
		}},
		
	'not':{priority:10, form:'monadic', evaluate:function(x,y,z,variables){ return !evaluate_token(x,y,z,this.param1,variables); }},
	
	'(':{priority:100, form:'open-paren', evaluate:function(x,y,z,variables){ return; }},
	
	')':{priority:-100, form:'close-paren', evaluate:function(x,y,z,variables){ return; }},
	
	'or':{priority:5, form:'diadic', evaluate:function(x,y,z,variables){ return (evaluate_token(x,y,z,this.param1,variables) || evaluate_token(x,y,z,this.param2,variables)); }},
	
	'and':{priority:5, form:'diadic', evaluate:function(x,y,z,variables){ return (evaluate_token(x,y,z,this.param1,variables) && evaluate_token(x,y,z,this.param2,variables)); }},
	
	'wrapWith':{priority:10, form:'diadic', evaluate:function(x,y,z,variables){
		var left = evaluate_token(x,y,z,this.param1,variables);
		var right = evaluate_token(x,y,z,this.param2,variables);
		return [left, right];
		}},
		
	'push':{priority:10, form:'diadic', evaluate:function(x,y,z,variables){
		var left = evaluate_token(x,y,z,this.param1,variables);
		left.push(evaluate_token(x,y,z,this.param2,variables));
		return left;
		}},
	
	'+':{priority:10, form:'diadic', evaluate:function(x,y,z,variables){
		var left = evaluate_token(x,y,z,this.param1,variables);
		var right = evaluate_token(x,y,z,this.param2,variables);
		return [left[0]+right[0], left[1]+right[1], left[2]+right[2]];
		}},
	
	'=':{priority:10, form:'diadic', evaluate:function(x,y,z,variables){
		return (evaluate_token(x,y,z,this.param1,variables) == evaluate_token(x,y,z,this.param2,variables));
		}},
	
	'>':{priority:10, form:'diadic', evaluate:function(x,y,z,variables){
		return (evaluate_token(x,y,z,this.param1,variables) > evaluate_token(x,y,z,this.param2,variables));
		}},
	
	'<':{priority:10, form:'diadic', evaluate:function(x,y,z,variables){
		return (evaluate_token(x,y,z,this.param1,variables) < evaluate_token(x,y,z,this.param2,variables));
		}}
};

function Verb (verbTemplate, param1, param2) {
	this.evaluate = verbTemplate.evaluate;
	this.param1 = param1;
	this.param2 = param2;
}

function parse_rule(rule) {
	rule = rule.replace(/\(/g,' ( ');
	rule = rule.replace(/\)/g,' ) ');
	rule = rule.replace(/\+/g,' + ');
	rule = rule.replace(/\s+/g,' ');
	var tokens = jQuery.trim(rule).split(' ');
	
	while (tokens.length > 1) {
		var index = -1;
		var highestPriority = -100000000000;
		var priorityMod = 0;
		for(var i=0; i < tokens.length; i++) {
			if (tokens[i] == ')') {
				priorityMod -= 10000;
			}
			
			if (verbTemplates[tokens[i]] === undefined) { continue; }
			var priority = verbTemplates[tokens[i]].priority + priorityMod;
			if (priority > highestPriority) {
				highestPriority = priority;
				index = i;
			}
			
			if (tokens[i] == '(') {
				priorityMod += 10000;
			}
		}
		
		if (priorityMod != 0) { throw '\"'+rule+'" does not contain equal numbers of parentheses'; }
		
		if (index < 0) { throw '\"'+rule+'" resolves to more than one noun in its final state of "'+tokens.join(" ")+'"'; }
		
		var verbTemplate = verbTemplates[tokens[index]];
		
		if (verbTemplate.form == 'monadic') {
			if (index == tokens.length-1) { throw 'Cannot resolve "'+tokens[index]+'". No right parameter.'; }
			tokens.splice(index, 2, new Verb(verbTemplate, tokens[index+1], ''));
			
		} else if (verbTemplate.form == 'diadic') {
			if (index == 0) { throw 'Cannot resolve "'+tokens[index]+'". No left parameter.'; }
			if (index == tokens.length-1) { throw 'Cannot resolve "'+tokens[index]+'". No right parameter.'; }
			tokens.splice(index-1, 3, new Verb(verbTemplate, tokens[index-1], tokens[index+1]));
			
		} else if (verbTemplate.form == 'self-removing') {
			tokens.splice(index, 1);
			
		} else if (verbTemplate.form == 'open-paren') {
			var indexOfClose = tokens.indexOf(')', index);
			if (indexOfClose == -1) { throw 'Expected close paren in "'+rule+'"'; }
			tokens.splice(indexOfClose, 1);
			tokens.splice(index, 1);
			
		} else {
			throw 'Verb "'+tokens[index]+'" has unknown form "'+verbTemplate.form+'"';
		}
	}
	return tokens[0];
}

//Utility Functions:

//http://www.peterbe.com/plog/isint-function
function is_int(x) { 
	var y=parseInt(x);
	return (!isNaN(y)) && x==y && x.toString()==y.toString();
}