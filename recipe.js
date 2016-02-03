/*
 *  recipe.js
 *
 *  David Janes
 *  IOTDB.org
 *  2014-12-14
 *
 *  Copyright [2013-2015] [David P. Janes]
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

"use strict";

var iotdb = require('iotdb');
var _ = iotdb.helpers;
var cfg = iotdb.cfg;

var events = require('events');
var util = require('util');
var path = require('path');

var data = require('./data');
var ctx = require('./context');

var logger = iotdb.logger({
    name: 'iotdb-recipes',
    module: 'recipe',
});

var recipe_to_id;

var _load_js;
var _load_iotql;
var _is_post_init;
var _init_recipe;
var _recipes_loaded = false;

/**
 *  Use this to load recipes
 *  <p>
 *  They end up in data.data('recipes')
 */
var load_recipes = function (initd) {
    if (_recipes_loaded) {
        return;
    }
    _recipes_loaded = true;

    initd = _.defaults(initd, {
        cookbooks_path: "cookbooks",
        iotql: null,
        db: null,
    });

    iotdb.__recipes_path = initd.cookbooks_path;
    iotdb.cookbook = data.cookbook;
    iotdb.recipe = data.recipe;

    _load_js(initd);
    _load_iotql(initd);
    _init_recipes();
};

var _load_js = function (initd) {
    logger.info({
        method: "_load_js",
        cookbooks_path: initd.cookbooks_path,
    }, "loading recipes");

    var filenames = cfg.cfg_find(iotdb.iot().envd, initd.cookbooks_path, /[.]js$/);
    cfg.cfg_load_js(filenames, function (paramd) {
        if (paramd.error !== undefined) {
            if (paramd.filename) {
                logger.error({
                    method: "_load_recipes",
                    filename: paramd.filename,
                    error: paramd.error,
                    exception: paramd.exception ? "" + paramd.exception : "",
                }, "error loading JS Model");
            }
            return;
        }

        logger.debug({
            method: "_load_recipes",
            filename: paramd.filename
        }, "found Model");

        // this resets the groups and ID for every file
        iotdb.cookbook();
    });
};

var _load_iotql = function (initd) {
    if (!initd.iotql || !initd.db) {
        return;
    }

    logger.info({
        method: "_load_iotql",
        cookbooks_path: initd.cookbooks_path,
    }, "loading IoTQL recipes");

    // track new scenes being added
    initd.db.on("scene", function (name, metad) {
        var rd = {
            enabled: true,
            name: name,
            group: "Scenes",
            cookbook_id: "9d94e5c1-e99c-48e3-96d3-37f96f95dff0",
            onclick: function (context, value) {
                initd.db.execute("DO " + name, function(error, result) {
                    console.log("DB SCENE EXECUTE FROM RECIPE! " + name);
                });
            }
        };

        iotdb.recipe(rd);

        if (_is_post_init) {
            _init_recipe(rd);
        }
    });

    // load any IoTQL 
    var filenames = cfg.cfg_find(iotdb.iot().envd, initd.cookbooks_path, /[.]iotql$/);
    cfg.cfg_load_file(filenames, function (paramd) {
        if (paramd.error !== undefined) {
            if (paramd.filename) {
                logger.error({
                    method: "_load_iotql",
                    filename: paramd.filename,
                    error: paramd.error,
                    exception: paramd.exception ? "" + paramd.exception : "",
                }, "error loading JS Model");
            }
            return;
        }

        logger.debug({
            method: "_load_iotql",
            filename: paramd.filename
        }, "found IoTQL");

        initd.db.execute(paramd.doc, function (error, result) {
            // console.log("HERE:AAA", paramd.doc);
        });
    });
};

var _init_recipes = function () {
    var iot = iotdb.iot();
    var cds = data.data("recipe");
    if (!cds || !cds.length) {
        return;
    }

    for (var ci in cds) {
        // console.log("HERE:B"); console.trace(0); process.exit(0);
        _init_recipe(cds[ci]);
    }

    _is_post_init = true;
};

var _init_recipe = function (reciped) {
    // does not need to be redone
    if (reciped._id) {
        return;
    }

    reciped._id = recipe_to_id(reciped);
    reciped.state = {};

    /* enabled: if false, do not use */
    if (reciped.enabled === false) {
        return;
    }

    /* this handles manipulating the recipe */
    var context = ctx.make_context(reciped);

    /* IOTDB types */
    var keys = ["value", "type", "format", "unit", ];
    for (var ki in keys) {
        var key = keys[ki];

        var value = reciped[key];
        if (value === undefined) {
            continue;
        }

        value = _.ld.compact(reciped[key], {
            json: true,
            scrub: true
        });

        if (_.isObject(value)) {
            var vkeys = ["iot:type", "iot:format", "iot:unit", "iot:purpose", ];
            for (var vi in vkeys) {
                var vkey = vkeys[vi];
                var vvalue = value[vkey];
                if ((vvalue !== undefined) && (_.isArray(vvalue) || !_.isObject(vvalue))) {
                    reciped[vkey] = vvalue;
                }
            }
        } else {
            reciped[key] = value;
        }
    }


    delete reciped.value;
    if (reciped.type) {
        reciped['iot:type'] = reciped.type;
        delete reciped.type;
    }
    if (reciped.format) {
        reciped['iot:format'] = reciped.format;
        delete reciped.format;
    }
    if (reciped.type) {
        reciped['iot:unit'] = reciped.unit;
        delete reciped.unit;
    }
    if (reciped.purpose) {
        reciped['iot:purpose'] = reciped.purpose;
        delete reciped.purpose;
    }

    reciped._name = reciped.name;

    /* JavaScript types */
    var type = reciped['iot:type'];
    if (type === undefined) {
        if (reciped.values) {
            reciped['iot:type'] = 'iot:type.string';
        } else {
            reciped['iot:type'] = 'iot:type.null';
        }
    }

    /* run: old name for onclick: */
    if ((reciped.run !== undefined) && (reciped.onclick === undefined)) {
        reciped.onclick = reciped.run;
    }

    /* watch: ThingArrays we need to monitor for reachable changes */
    if (reciped.watch) {
        if (!_.isArray(reciped.watch)) {
            reciped.watch = [reciped.watch];
        }

        var _validate = function () {
            context.validate();
        };

        for (var wi in reciped.watch) {
            var things = reciped.watch[wi];

            things.on_thing(_validate);
            things.on_meta(_validate);
        }
    }

    /* validation function default */
    if (reciped.watch && !reciped.onvalidate) {
        reciped.onvalidate = function (context) {
            for (var wi in reciped.watch) {
                var things = reciped.watch[wi];
                if (things.reachable() === 0) {
                    context.state("Some Things have not been found (yet)");
                    return;
                }
            }

            context.state("");
        };
    }

    /* oninit: initialization function */
    if (reciped.oninit) {
        reciped.oninit(context);
    }

    context.validate();
};

/**
 *  Use this for the standard ordering of Actions
 */
var order_recipe = function (a, b) {
    if (a.group < b.group) {
        return -1;
    } else if (a.group > b.group) {
        return 1;
    }

    if (a.name < b.name) {
        return -1;
    } else if (a.name > b.name) {
        return 1;
    }

    return 0;
};

/**
 *  Make a unique ID for an Action
 */
var recipe_to_id = function (reciped) {
    if (reciped.group_id) {
        return "urn:iotdb:recipe:" + reciped.group_id;
    } else {
        return "urn:iotdb:recipe:" + _.hash.md5("2014-12-13T06:34:00", reciped.group, reciped.name);
    }
};

/**
 *  Find an Action by ID
 */
var recipe_by_id = function (id) {
    var iot = iotdb.iot();
    var cds = data.data("recipe");
    if (!cds || !cds.length) {
        return null;
    }

    for (var ci in cds) {
        var reciped = cds[ci];
        if (reciped.enabled === false) {
            continue;
        }
        if (recipe_to_id(reciped) === id) {
            return reciped;
        }
    }

    return null;
};

/**
 *  Group recipes by their group,
 *  then sort by name. The
 *  returned datastructure looks
 *  something like:
 *  <pre>
 *  {
 *      "Group 1": [
 *          {
 *              "name": "Action 1",
 *          },
 *          {
 *              "name": "Action 2",
 *          },
 *      ],
 *      "Group 2": [
 *      ],
 *  }
 *  </pre>
 */
var group_recipes = function () {
    var iot = iotdb.iot();
    var cds = data.data("recipe");
    if (!cds || !cds.length) {
        cds = [];
    }

    cds.sort(order_recipe);

    var gdsd = {};

    for (var ci in cds) {
        var reciped = cds[ci];
        if (reciped.enabled === false) {
            continue;
        }

        var gds = gdsd[reciped.group];
        if (gds === undefined) {
            gds = gdsd[reciped.group] = [];
        }

        gds.push(reciped);
    }

    return gdsd;
};

/**
 *  Return all the recipes, ordered
 */
var recipes = function () {
    var iot = iotdb.iot();
    var recipeds = data.data("recipe");
    if (!recipeds || !recipeds.length) {
        return [];
    }

    var rds = [];
    for (var ri in recipeds) {
        var reciped = recipeds[ri];
        if (reciped.enabled === false) {
            continue;
        }

        rds.push(reciped);
    }

    rds.sort(order_recipe);
    return rds;
};

/**
 */
var recipe_model = function (recipe) {
    var context = ctx.make_context(recipe);

    var value_attribute = {
        "@type": "iot:Attribute",
        "@id": "#value",
        "iot:purpose": recipe["iot:purpose"] || "iot-purpose:value",
        "schema:name": "value",
        "iot:type": recipe["iot:type"] || "iot:type.null",
        "iot:write": true,
        "iot:read": true,
        "iot:role": ["iot-purpose:role-control", "iot-purpose:role-reading", ],
    };
    if (recipe.values) {
        value_attribute['iot:format.enumeration'] = recipe.values;
    }

    return {
        "@context": {
            "iot": _.ld.namespace["iot"],
            "iot-unit": _.ld.namespace["iot-unit"],
            "iot-purpose": _.ld.namespace["iot-purpose"],
            "schema": _.ld.namespace["schema"],
        },
        "@id": "/api/recipes/" + recipe._id + "/model",
        "@type": ["iot:Model", "iot:Recipe", ],
        "@timestamp": context.created_timestamp,
        "schema:name": recipe.name,
        "iot:attribute": [
            value_attribute, {
                "@type": "iot:Attribute",
                "@id": "#message",
                "iot:purpose": "iot-purpose:message.html",
                "schema:name": "text",
                "iot:type": "iot:type.string",
                "iot:read": true,
                "iot:role": ["iot-purpose:role-reading", ],
            }, {
                "@type": "iot:Attribute",
                "@id": "#text",
                "iot:purpose": "iot-purpose:message.text",
                "schema:name": "text",
                "iot:type": "iot:type.string",
                "iot:read": true,
                "iot:role": ["iot-purpose:role-reading", ],
            }, {
                "@type": "iot:Attribute",
                "@id": "#running",
                "iot:purpose": "iot-purpose:sensor.running",
                "schema:name": "text",
                "iot:type": "iot:type.boolean",
                "iot:read": true,
                "iot:role": ["iot-purpose:role-reading", ],
            },
        ]
    };
};

/**
 */
var recipe_recipe = function (recipe) {
    var base = "/api/recipes/" + recipe._id;
    return {
        "@id": base,
        "schema:name": recipe._name,
        "cookbook": recipe.group,
        "istate": base + "/ibase",
        "ostate": base + "/obase",
        "model": base + "/model",
        "status": base + "/status",
    };
};

/**
 */
var recipe_istate = function (recipe, context) {
    if (!context) {
        context = ctx.make_context(recipe);
    }

    var d = _.defaults({
            "@timestamp": context.modified_timestamp,
        },
        recipe.state, {
            value: null,
            "@id": "/api/recipes/" + recipe._id + "/istate",
        }
    );
    d["value"] = null;


    if (context.status.text) {
        d["text"] = context.status.text;
    }
    if (context.status.message) {
        d["message"] = context.status.message;
    }

    return d;
};

/**
 */
var recipe_ostate = function (recipe, context) {
    if (!context) {
        context = ctx.make_context(recipe);
    }

    var d = {
        value: null,
        "@timestamp": context.execute_timestamp,
        "@id": "/api/recipes/" + recipe._id + "/ostate",
    };

    /* really should be istate, but this makes everything work automatically */
    if (context.status.running) {
        d["running"] = true;
    }

    return d;
};

/**
 */
var recipe_status = function (recipe, context) {
    var self = this;

    if (!context) {
        context = ctx.make_context(recipe);
    }

    var d = _.deepCopy(context.status);
    d["@id"] = "/api/recipes/" + recipe._id + "/status";

    return d;
};

/**
 */
var recipe_meta = function (recipe, context) {
    var self = this;

    if (!context) {
        context = ctx.make_context(recipe);
    }

    var d = {
        "@timestamp": context.created_timestamp,
        "iot:thing-id": context.id,
        "iot:cookbook": recipe.group || "",
        "schema:name": recipe.name || "",
    };

    if (recipe.cookbook_id) {
        d["iot:device-id"] = "urn:iotdb:cookbook:" + recipe.cookbook_id;
    }

    return d;
};

/**
 *  API
 */
exports.order_recipe = order_recipe;
exports.load_recipes = load_recipes;
exports.recipes = recipes;
exports.group_recipes = group_recipes;
exports.recipe_to_id = recipe_to_id;
exports.recipe_by_id = recipe_by_id;

exports.recipe_istate = recipe_istate;
exports.recipe_ostate = recipe_ostate;
exports.recipe_model = recipe_model;
exports.recipe_status = recipe_status;
exports.recipe_meta = recipe_meta;
