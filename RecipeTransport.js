/*
 *  RecipeTransport.js
 *
 *  David Janes
 *  IOTDB.org
 *  2015-05-13
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
var iotdb_transport = require('iotdb-transport');
const errors = require('iotdb-errors');
var _ = iotdb._;

var path = require('path');

var util = require('util');
var url = require('url');

var recipe = require('./recipe');
var ctx = require('./context');

var logger = iotdb.logger({
    name: "iotdb-homestar",
    module: 'app/RecipeTransport',
});

/* --- constructor --- */
/**
 *  <p>
 *  See {iotdb_transport.Transport#Transport} for documentation.
 *
 *  @constructor
 */
var RecipeTransport = function (initd) {
    var self = this;

    self.initd = _.defaults(
        initd,
        iotdb.keystore().get("/transports/RecipeTransport/initd"), {
            authorize: function (authd, callback) {
                return callback(null, true);
            },
            user: null,
        }
    );
};

RecipeTransport.prototype = new iotdb_transport.Transport();
RecipeTransport.prototype._class = "RecipeTransport";

/* --- methods --- */
/**
 *  See {iotdb_transport.Transport#list} for documentation.
 */
RecipeTransport.prototype.list = function (paramd, callback) {
    var self = this;

    self._validate_list(paramd, callback);

    var rds = recipe.recipes();
    var count = rds.length;
    if (count === 0) {
        return callback(null, null);
    }

    var _authorize = function (rd) {
        var r_id = recipe.recipe_to_id(rd);
        var _after_authorize = function (_error, is_authorized) {
            if (count === 0) {
                return;
            }

            if (is_authorized) {
                var ld = _.d.clone.shallow(paramd);
                ld.id = r_id;
                delete ld.band;
                delete ld.value;

                var r = callback(null, ld);
                if (!r) {
                    count--;
                } else {
                    count = 0;
                }

                if (count === 0) {
                    return callback(null, null);
                }
            } else {
                count = 0;

                return callback(new errors.NotAuthorized(), null);
            }
        };

        var authd = {
            id: r_id,
            authorize: "read",
            user: paramd.user,
        };
        self.initd.authorize(authd, _after_authorize);
    };

    for (var rdi = 0; rdi < rds.length; rdi++) {
        _authorize(rds[rdi]);
    }
};

/**
 *  See {iotdb_transport.Transport#added} for documentation.
 */
RecipeTransport.prototype.added = function (paramd, callback) {
    var self = this;

    self._validate_added(paramd, callback);

    var ad = _.d.clone.shallow(paramd);
    callback(new errors.NeverImplemented(), ad);
};

/**
 *  See {iotdb_transport.Transport#about} for documentation.
 */
RecipeTransport.prototype.bands = function (paramd, callback) {
    var self = this;

    self._validate_about(paramd, callback);

    /*
    var thing = recipe.recipe_by_id(paramd.id);
    if (!thing) {
        return callback({
            id: paramd.id,
        });
    }
    */

    var authd = {
        id: paramd.id,
        authorize: "read",
        user: paramd.user,
    };
    self.initd.authorize(authd, function (error, is_authorized) {
        var bd = _.d.clone.shallow(paramd);

        if (error) {
            return callback(new errors.NotAuthorized(), bd);
        }

        bd.bandd = {
            "istate": null, 
            "ostate": null, 
            "model": null, 
            "meta": null, 
            "status": null, 
        };

        return callback(callbackd);
    });
};

/**
 *  See {iotdb_transport.Transport#get} for documentation.
 */
RecipeTransport.prototype.get = function (paramd, callback) {
    var self = this;
    var d;

    self._validate_get(paramd, callback);

    var gd = _.d.clone.shallow(paramd);
    delete gd.value;

    var rd = recipe.recipe_by_id(paramd.id);
    if (!rd) {
        return callback(new errors.NotFound(), gd);
    }

    var authd = {
        id: paramd.id,
        authorize: "read",
        band: paramd.band,
        user: paramd.user,
    };
    self.initd.authorize(authd, function (error, is_authorized) {
        if (!is_authorized) {
            var callbackd = {
                id: paramd.id,
                band: paramd.band,
                user: paramd.user,
                value: null,
                error: new errors.NotAuthorized(),
            };
            return callback(new errors.NotAuthorized(), gd);
        }

        if (paramd.band === "istate") {
            d = recipe.recipe_istate(rd);
            delete d["@id"];

            gd.value = d;
            return callback(null, gd);
        } else if (paramd.band === "ostate") {
            d = recipe.recipe_ostate(rd);
            delete d["@value"]; // we're executing
            delete d["@id"];

            gd.value = d;
            return callback(null, gd);
        } else if (paramd.band === "status") {
            d = recipe.recipe_status(rd);
            delete d["@value"]; // we're executing
            delete d["@id"];

            gd.value = d;
            return callback(null, gd);
        } else if (paramd.band === "model") {
            d = recipe.recipe_model(rd);
            delete d["@id"];

            gd.value = d;
            return callback(null, gd);
        } else if (paramd.band === "meta") {
            d = recipe.recipe_meta(rd);
            delete d["@id"];

            gd.value = d;
            return callback(null, gd);
        } else {
            return callback(new errors.NotFound(), gd);
        }
    });
};

/**
 *  See {iotdb_transport.Transport#update} for documentation.
 */
RecipeTransport.prototype.put = function (paramd, callback) {
    var self = this;
    var callbackd;
    var authd;

    self._validate_update(paramd, callback);

    var pd = _.d.clone.shallow(paramd);

    if (!paramd.id.match(/^urn:iotdb:recipe:/)) {
        return callback(new errors.NotAppropriate(), pd);
    }

    var xd = recipe.recipe_by_id(paramd.id);
    if (!xd) {
        logger.error({
            method: "put",
            id: paramd.id,
            cause: "probably a bad request from the net",
        }, "recipe not found");
        return callback(new errors.NotFound(), pd);
    }

    if (paramd.band === "ostate") {
        authd = {
            id: paramd.id,
            authorize: "write",
            band: paramd.band,
            user: paramd.user,
        };
        self.initd.authorize(authd, function (error, is_authorized) {
            if (!is_authorized) {
                logger.error({
                    method: "put",
                    id: paramd.id,
                }, "not authorized [ostate]");

                return callback(new errors.NotAuthorized(), pd);
            }

            var context = ctx.make_context(xd);

            var new_timestamp = paramd.value["@timestamp"];
            var old_timestamp = context.execute_timestamp;

            if (!_.timestamp.check.values(old_timestamp, new_timestamp)) {
                logger.error({
                    method: "put",
                    id: paramd.id,
                    new_timestamp: new_timestamp,
                    old_timestamp: old_timestamp,
                }, "timestamp issue");

                return callback(new errors.Timestamp(), pd);
            }

            context.execute_timestamp = new_timestamp;
            context.onclick(paramd.value.value);

            return callback(null, pd);
        });
    } else if (paramd.band === "meta") {
        authd = {
            id: paramd.id,
            authorize: "write",
            band: paramd.band,
            user: paramd.user,
        };
        self.initd.authorize(authd, function (error, is_authorized) {
            if (!is_authorized) {
                logger.error({
                    method: "put",
                    id: paramd.id,
                }, "not authorized [meta]");

                return callback(new errors.NotAuthorized(), pd);
            }

            return callback(new errors.NotImplemented(), pd);
        });
    } else {
        logger.error({
            method: "put",
            id: paramd.id,
        }, "not allowd");

        return callback(new errors.MethodNotAllowed(), pd);
    }
};

/**
 *  See {iotdb_transport.Transport#updated} for documentation.
 */
RecipeTransport.prototype.updated = function (paramd, callback) {
    var self = this;

    self._validate_updated(paramd, callback);

    var _monitor_band = function (_band) {

        if ((_band === "istate") || (_band === "ostate") || (_band === "meta") || (_band === "status")) {
            var _handle_status = function (context) {
                context.on("status", function () {
                    if (paramd.id && (context.id !== paramd.id)) {
                        return;
                    }

                    var authd = {
                        id: paramd.id,
                        authorize: "read",
                        band: _band,
                        user: paramd.user,
                    };
                    self.initd.authorize(authd, function (error, is_authorized) {
                        if (!is_authorized) {
                            return;
                        }

                        self.get({
                            id: context.id,
                            band: _band,
                            user: paramd.user,
                        }, callback);
                    });
                });
            };

            var recipeds = recipe.recipes();
            for (var ri in recipeds) {
                var reciped = recipeds[ri];
                var context = ctx.make_context(reciped);

                _handle_status(context);
            }

        } else if (_band === "model") {} else {}
    };

    if (paramd.band) {
        _monitor_band(paramd.band);
    } else {
        var bands = ["istate", "ostate", "meta", "model", "status", ];
        for (var bi in bands) {
            _monitor_band(bands[bi]);
        }
    }
};

/**
 *  API
 */
exports.RecipeTransport = RecipeTransport;
