const fs = require('fs')

function load_from_json(key) {
    var path = "task_conf.json"
    let obj = {};

    if (fs.existsSync(path)) {
        obj = JSON.parse(fs.readFileSync(path, 'utf-8'));
        return obj[key]
    }
}

module.exports = {
    load_from_json
}
