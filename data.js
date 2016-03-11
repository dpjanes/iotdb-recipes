/*
 *  data.js
 *
 *  David Janes
 *  IOTDB.org
 *  2015-02-03
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

var logger = iotdb.logger({
    name: 'iotdb-recipes',
    module: 'data',
});

var _datadsd = {};

var data = function (key, d) {
    if (d === undefined) {
        return _datadsd[key];
    } else if (_.isObject(d)) {
        var datads = _datadsd[key];
        if (datads === undefined) {
            datads = _datadsd[key] = [];
        }

        var found = false;
        if (d.id !== undefined) {
            for (var di in datads) {
                if (datads[di].id === d.id) {
                    datads.splice(di, 1, d);
                    found = true;
                    break;
                }
            }
        }

        if (!found) {
            datads.push(d);
        }

        return _datadsd[key];
    } else {
        throw new Error("IOT.data: the value must always be an object");
    }
};

var _group_default = "My Cookbook";
var _cookbook_name = _group_default;
var _cookbook_id;

var recipe = function (initd) {
    if (_cookbook_name && !initd.group) {
        initd.group = _cookbook_name;
    }
    if (_cookbook_id && !initd.cookbook_id) {
        initd.cookbook_id = _cookbook_id;
    }

    data("recipe", initd);
};

var cookbook = function (cookbook_name, cookbook_id) {
    if (cookbook_name) {
        _cookbook_name = cookbook_name;
    } else {
        _cookbook_name = _group_default;
    }

    if (cookbook_id) {
        _cookbook_id = cookbook_id;
    }
};

var dump = function() {
    console.log(_datadsd);
};

/**
 *  API
 */
exports.data = data;
exports.cookbook = cookbook;
exports.recipe = recipe;
exports.dump = dump;
