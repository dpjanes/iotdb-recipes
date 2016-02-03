/*
 *  context.js
 *
 *  David Janes
 *  IOTDB.org
 *  2016-02-03
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

var events = require('events');
var util = require('util');

var logger = iotdb.logger({
    name: 'iotdb-recipes',
    module: 'context',
});

/**
 *  The "Context" is basically does the work of
 *  managing a running Recipe. You make them
 *  using the 'context' function below.
 *  <p>
 *  Might be horrible idea. Stop judging me.
 */
var Context = function (reciped) {
    var self = this;

    self.reciped = reciped;
    self.id = require('./recipe').recipe_to_id(reciped);

    self.reciped._context = self;
    self.reciped.state = {};

    self.created_timestamp = _.timestamp.make();
    self.modified_timestamp = _.timestamp.make();
    self.execute_timestamp = _.timestamp.make();

    self.status = {
        running: false,
        text: null,
        html: null,
        number: null,
        message: null,
    };

    events.EventEmitter.call(self);

    self.setMaxListeners(0);
};

util.inherits(Context, events.EventEmitter);

/*
 *  Format and emit a message (this will be picked up by MQTT elsewhere)
 *  This message should reflect the running state.
 */
Context.prototype.message = function (first) {
    var self = this;
    var old_running = self.status.running;
    var od = _.d.clone.shallow(self.status);

    if (first === undefined) {
        self.status.running = false;
        self.status.message = null;
    } else {
        self.status.running = true;
        self.status.message = util.format.apply(util.apply, Array.prototype.slice.call(arguments));
    }

    var changed = false;
    if (self.status.running !== od.running) {
        changed = true;
    } else if (self.status.message !== od.message) {
        changed = true;
    }

    if (!changed) {
        return;
    }

    /*
     *  Unfortunately we are sharing 'running' on 'ostate' also.
     *  Therefore, a change in running status must change
     *  our execute_timestamp
     */
    if (old_running !== self.status.running) {
        self.execute_timestamp = _.timestamp.make();
    }

    self.modified_timestamp = _.timestamp.make();
    self.emit("status");
};

/*
 *  Change (and emit) the state of this recipe. Typically
 *  this will be a string or whatever. It does not
 *  change the running state.
 */
Context.prototype.state = function (state) {
    var self = this;

    var od = _.d.clone.shallow(self.status);

    if ((state === undefined) || (state === null)) {
        self.status.text = null;
        self.status.html = null;
        self.status.number = null;
    } else if (_.isString(state)) {
        self.status.text = state;
        self.status.html = null;
        self.status.number = null;
    } else if (_.isBoolean(state)) {
        self.status.text = null;
        self.status.html = null;
        self.status.number = state ? 1 : 0;
    } else if (_.isNumber(state)) {
        self.status.text = null;
        self.status.html = null;
        self.status.number = state;
    } else if (!_.isObject(state)) {
        self.status.text = null;
        self.status.html = null;
        self.status.number = null;
    } else if (state) {
        _.extend(self.status, state);
    }

    var changed = false;
    if (self.status.text !== od.text) {
        changed = true;
    } else if (self.status.html !== od.html) {
        changed = true;
    } else if (self.status.number !== od.number) {
        changed = true;
    }

    if (changed) {
        self.modified_timestamp = _.timestamp.make();
        self.emit("status");
    }
};

/*
 *  Call the validate function on a recipe.
 *  Typically you'll just 'watch' to watch things,
 *  which will call validate when anyhing
 *  interesting changes
 */
Context.prototype.validate = function () {
    var self = this;
    if (self.reciped.onvalidate) {
        self.reciped.onvalidate(self);
    }
};

/**
 *  Finished. The message is sent to empty
 *  and the running state is set to false.
 *  All after a short delay.
 */
Context.prototype.done = function (timeout) {
    var self = this;

    if (timeout === undefined) {
        timeout = 0.8;
    }

    setTimeout(function () {
        self.message();
    }, timeout * 1000);
};

Context.prototype.onclick = function (value) {
    var self = this;

    self.status.running = false;

    if (self.reciped.onclick) {
        if (self.reciped._valued !== undefined) {
            value = self.reciped._valued[value];
        }

        _.timestamp.update(self, {
            key: 'execute_timestamp',
        });

        // self.execute_timestamp = _.timestamp.make();
        self.reciped.onclick(self, value);
    } else {
        logger.info({
            method: "onclick",
            cause: "attempt by the user to 'click' a recipe that doesn't want to be clicked",
        }, "no 'onclick' method");
    }
};

/*
 *  This is how you get Context objects
 */
var make_context = function (reciped) {
    if (reciped._context) {
        return reciped._context;
    } else {
        return new Context(reciped);
    }
};


/**
 *  API
 */
exports.make_context = make_context;
