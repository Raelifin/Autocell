function parse_image_rule(rule) {
	rule = rule.replace(/\s+/g,' ');
	var tokens = jQuery.trim(rule).split(' ');
	load_image(tokens[1], tokens[2]);
}

function set_rules(ruleText) {
	autocell_pics = {};
	load_image('NULL', 'images/null.png');
	
	$('#rules').html(ruleText);
	try {
		var new_autocell_rules = [];
		var rules = ruleText.split('\n');
		for (var r in rules) {
			var rule = jQuery.trim(rules[r]);
			if (rule == "" || rule.indexOf('#') == 0 || rule.indexOf('//') == 0) continue;
			if (rule.indexOf('draw ') == 0) { parse_image_rule(rule); continue; }
			var index = rule.indexOf(':')+1;
			if (index == 0) { throw 'Expected colon in "'+rule+'"'; }
			var transition = rule.substring(0, index);
			rule = jQuery.trim(rule.substring(index));
			transition = transition.substring(0, transition.indexOf(':'));
			if (transition.indexOf('->') == -1) { throw 'Expected arrow (->) in "'+transition+'"'; }
			var fromAndTo = transition.split('->');
			if (fromAndTo.length != 2) { throw '"'+transition+'" has undexpected number of arrows.'; }
			fromAndTo[0] = jQuery.trim(fromAndTo[0]);
			fromAndTo[1] = jQuery.trim(fromAndTo[1]);
			if ( ! (new_autocell_rules[fromAndTo[0]] instanceof Array)) {
				new_autocell_rules[fromAndTo[0]] = [];
			}
			new_autocell_rules[fromAndTo[0]].push({condition:parse_rule(rule), result:fromAndTo[1]});
		}
		autocell_rules = new_autocell_rules;
	} catch (err) {
		alert(err);
	}
}

function apply_rules(x,y) {
	var type = autocell_board[y][x];
	for(var r in autocell_rules[type]) {
		var rule = autocell_rules[type][r];
		
		if (evaluate_token(x,y,rule.condition)) {
			return rule.result;
		}
	}
	return type;
}

var possible_directions = {north:[0,-1], south:[0,1], east:[1,0], west:[-1,0],
	northeast:[1,-1], northwest:[-1,-1], southeast:[1,1], southwest:[-1,1],
	farnorth:[0,-2], farsouth:[0,2], fareast:[2,0], farwest:[-2,0]};

function evaluate_token(x,y,token) {
	if (typeof token == 'object') {
		return token.evaluate(x,y);
	} else if (token == 'thisPos') {
		return [x,y];
	} else if (token == 'neighbors') {
		return get_neighbors(x,y);
	} else if (possible_directions[token] !== undefined) {
		var dir = possible_directions[token];
		return get_cell(x+dir[0],y+dir[1]);
	} else if (is_int(token)) {
		return parseInt(token);
	} else {
		try {
			return JSON.parse(token);
		} catch (err2) {
			return token;
		}
	}
}

function get_neighbors(x,y) {
	var results = [
		get_cell(x-1,y-1), get_cell(x,y-1), get_cell(x+1,y-1),
		get_cell(x-1,y),                    get_cell(x+1,y),
		get_cell(x-1,y+1), get_cell(x,y+1), get_cell(x+1,y+1)];
	return results;
}

function get_cell(x,y) {
	if (autocell_board[y] === undefined || autocell_board[y][x] === undefined) return 'NULL';
	return autocell_board[y][x];
}

var verbTemplates = {
	'ofType':{priority:10, form:'diadic', evaluate:function(x,y){
		var list = evaluate_token(x,y,this.param1);
		var type = evaluate_token(x,y,this.param2);
		for (var i=0; i < list.length; i++) {
			if (list[i] != type) {
				list.splice(i,1);
				i--;
			}
		}
		return list;
		}},
	
	'cellAt':{priority:10, form:'monadic', evaluate:function(x,y){
		var pos = evaluate_token(x,y,this.param1);
		return get_cell(pos[0],pos[1]);
		}},
		
	'neighborsOf':{priority:10, form:'monadic', evaluate:function(x,y){
		var pos = evaluate_token(x,y,this.param1);
		try {
			return get_neighbors(pos[0],pos[1]);
		} catch (e) {
			throw 'Cannot find neighborsOf "'+pos+'".\nParameter is not not a coordinate!';
		}
		}},
	
	'contains':{priority:10, form:'diadic', evaluate:function(x,y){
		var list = evaluate_token(x,y,this.param1);
		var item = evaluate_token(x,y,this.param2);
		return list.indexOf(item) != -1;
		}},
	
	'isIn':{priority:10, form:'diadic', evaluate:function(x,y){
		var item = evaluate_token(x,y,this.param1);
		var list = evaluate_token(x,y,this.param2);
		return list.indexOf(item) != -1;
		}},
	
	'count':{priority:10, form:'monadic', evaluate:function(x,y){ return evaluate_token(x,y,this.param1).length; }},
	
	'echo':{priority:10, form:'monadic', evaluate:function(x,y){
		var val = evaluate_token(x,y,this.param1);
		alert('Echo: '+val);
		return val;
		}},
		
	'not':{priority:10, form:'monadic', evaluate:function(x,y){ return !evaluate_token(x,y,this.param1); }},
	
	'(':{priority:100, form:'open-paren', evaluate:function(x,y){ return; }},
	
	')':{priority:-100, form:'close-paren', evaluate:function(x,y){ return; }},
	
	'or':{priority:5, form:'diadic', evaluate:function(x,y){ return (evaluate_token(x,y,this.param1) || evaluate_token(x,y,this.param2)); }},
	
	'and':{priority:5, form:'diadic', evaluate:function(x,y){ return (evaluate_token(x,y,this.param1) && evaluate_token(x,y,this.param2)); }},
	
	'+':{priority:10, form:'diadic', evaluate:function(x,y){
		var left = evaluate_token(x,y,this.param1);
		var right = evaluate_token(x,y,this.param2);
		return [left[0]+right[0],left[1]+right[1]];
		}},
	
	'=':{priority:10, form:'diadic', evaluate:function(x,y){ return (evaluate_token(x,y,this.param1) == evaluate_token(x,y,this.param2)); }},
	
	'>':{priority:10, form:'diadic', evaluate:function(x,y){ return (evaluate_token(x,y,this.param1) > evaluate_token(x,y,this.param2)); }},
	
	'<':{priority:10, form:'diadic', evaluate:function(x,y){ return (evaluate_token(x,y,this.param1) < evaluate_token(x,y,this.param2)); }}
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