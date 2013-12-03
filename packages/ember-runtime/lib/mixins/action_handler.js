/**
@module ember
@submodule ember-runtime
*/

var get = Ember.get, typeOf = Ember.typeOf;

/**
  The `Ember.ActionHandler` mixin implements support for moving an `actions`
  property to an `_actions` property at extend time, and adding `_actions`
  to the object's mergedProperties list.

  `Ember.ActionHandler` is used internally by Ember in  `Ember.View`,
  `Ember.Controller`, and `Ember.Route`.

  @class ActionHandler
  @namespace Ember
*/
Ember.ActionHandler = Ember.Mixin.create({
  mergedProperties: ['_actions'],

  /**
    @private

    Moves `actions` to `_actions` at extend time. Note that this currently
    modifies the mixin themselves, which is technically dubious but
    is practically of little consequence. This may change in the future.

    @method willMergeMixin
  */
  willMergeMixin: function(props) {
    var hashName;

    if (!props._actions) {
      Ember.assert(this + " 'actions' should not be a function", typeof(props.actions) !== 'function');

      if (typeOf(props.actions) === 'object') {
        hashName = 'actions';
      } else if (typeOf(props.events) === 'object') {
        Ember.deprecate('Action handlers contained in an `events` object are deprecated in favor of putting them in an `actions` object', false);
        hashName = 'events';
      }

      if (hashName) {
        props._actions = Ember.merge(props._actions || {}, props[hashName]);
      }

      delete props[hashName];
    }
  },

  send: function(actionName) {
    var args = [].slice.call(arguments, 1), target;

    if (this._actions && this._actions[actionName] && this._actions[actionName]) {
      if (typeof this._actions[actionName] === 'function' && this._actions[actionName].apply(this, args) === true) {
        // handler returned true, so this action will bubble
      } else if (typeof this._actions[actionName] === 'object') {
        // we may have callbacks, so process them
        var beforeResult, result, context = this,
            before = this._actions[actionName].before,
            after = this._actions[actionName].after,
            action = this._actions[actionName].action;

        if(typeof before === 'function') {
          beforeResult = before.apply(this, args);
        }

        if(!Ember.isNone(beforeResult) && typeof beforeResult.then === 'function') {
          beforeResult.then(function() {
            result = action.apply(context, args);
          });
        } else {
          result = action.apply(this, args);
        }

        Ember.assert('An action handler with callbacks must implement the \'action\' callback', typeof action === 'function');

        result = result || {};

        if(typeof result.then === 'function') {
          result.then(function() {
            after.apply(context, args);
          });
        } else if(typeof after === 'function') {
          after.apply(this, args);
        }

      } else {
        return;
      }
    } else if (this.deprecatedSend && this.deprecatedSendHandles && this.deprecatedSendHandles(actionName)) {
      if (this.deprecatedSend.apply(this, [].slice.call(arguments)) === true) {
        // handler return true, so this action will bubble
      } else {
        return;
      }
    }

    if (target = get(this, 'target')) {
      Ember.assert("The `target` for " + this + " (" + target + ") does not have a `send` method", typeof target.send === 'function');
      target.send.apply(target, arguments);
    }
  }

});
