const fs = require('fs')

function save_to_json(key, value) {
    var path = "deploy_result.json"
    let obj = {};

    if (fs.existsSync(path)) {
        obj = JSON.parse(fs.readFileSync(path, 'utf-8'));
        obj[key] = value;
        let json = JSON.stringify(obj, '', ' ');
        fs.writeFileSync(path, json);
    } else {
        obj[key] = value;
        let json = JSON.stringify(obj, '', ' ');
        fs.writeFileSync(path, json);
    }
}

function load_from_json(key) {
    var path = "deploy_result.json"
    let obj = {};

    if (fs.existsSync(path)) {
        obj = JSON.parse(fs.readFileSync(path, 'utf-8'));
	return obj[key]
    } 
}

module.exports = {
    save_to_json,
    load_from_json
}

