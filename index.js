/*
 *  index.js
 *
 *  David Janes
 *  IOTDB.org
 *  2015-07-23
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

var recipe = require('./recipe');
for (var key in recipe) {
    exports[key] = recipe[key];
}

exports.Transport = require('./RecipeTransport').RecipeTransport;

/**
 *  Unfortunately we cannot do this because HomeStar
 *  wants to paramaterize load_recipes
exports.setup = function(iotdb) {
    exports.load_recipes();
    exports.recipe.init_recipes();
};
 */
